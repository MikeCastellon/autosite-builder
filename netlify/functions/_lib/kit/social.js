// The "social" Launch Kit skill (skills/api/launch-social-kit): the launch
// set for the customer's social profiles. A share image (also the site's
// og:image later), a Facebook cover, a profile picture from the logo
// mark, three launch posts and a story, composed with Pillow from the
// customer's own photos and logo in the brand colors and fonts, plus a
// caption per post (the Words kit's, when it is ready).
//
// One container upload carries the brief, social-input.json: the business,
// the colors and fonts (brand system > Studio levers > the site), the
// logo, the photos with the photo desk's picks (focal point, plate/face
// boxes to blur), the links, the Words kit's captions and every text an
// image may quote, each tagged with its kind (facts, owner, site, words,
// reviews). The skill copies image lines from those texts word for word
// (scripts/textrules.py is the gate); the same rules run again here
// (src/lib/kit/social.js sanitizeSocial), and what they flag is stored next
// to the image for the admin. The logo, up to PHOTO_LIMIT photos (the photo
// desk's best first, its skips left out) and the brand fonts' TTF files go
// in as files too.
import { deflateSync } from 'node:zlib';
import { SOCIAL_FILES, sanitizeSocial, socialNotes, socialTokens } from '../../../../src/lib/kit/social.js';
import { FORM_FIELDS, answerText, isFieldShown } from '../../../../src/lib/customSiteForm.js';
import {
  dataText, fileListText, kitData, loadAssetImages, oneLine, pastedReviews, siteView, skippedText,
} from './inputs.js';

export const INPUT_FILE = 'social-input.json';
// Photos the skill may choose from (each is also shown to Claude).
export const PHOTO_LIMIT = 8;
// One source text, all of them in the brief, and the share of them the
// request repeats (the brief has them all).
const SOURCE_MAX = 1500;
const SOURCES_MAX_CHARS = 40000;
const PROMPT_SOURCES_MAX = 14000;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── Text sources ─────────────────────────────────────────────────────

// Copy keys that are settings or widget plumbing, not words on the page
// (inputs.js siteCopyText skips the same), plus SEO keywords and the
// site's testimonials: those may be the sample quotes written for the
// template (copyGeneration.js testimonialPlaceholders), never a customer's
// words, so a social image never shows them; reviews come only from the
// pasted reviews.
const COPY_SKIP = /^(sectionOrder|hiddenSections|heroLayout|aboutLayout|[a-zA-Z]*WidgetKey|googleBadge|heroCard|vehicleMakes|footer[A-Z]?\w*Columns|keywords|schemaType|testimonialPlaceholders|testimonials|reviews|reviewMode|googleReviewsTheme|show[A-Z]\w*)$/;
const LINK_KEY = /(url|href|image|photo|src|icon|color|colour|font|logo)$/i;
const URLISH = /^(https?:|data:|\/\/|#|mailto:|tel:)/i;
// business_info keys that are never words for an image (contact the site
// doesn't show, links, settings, hours: free text the site formats itself).
const INFO_SKIP = /^(customProjectId|email|instagram|facebook|tiktok|youtube|website|googleProfile|googlePlace|businessType|hours|colors|logo|images|slug|timezone|lat|lng|latitude|longitude|placeId|place_id|id|mapsUrl|bookingUrl|businessName|city|state|zip|postalCode|phone|address|serviceArea|reviewSource|reviewMode|testimonials|reviews|[a-zA-Z]*WidgetKey)$/i;
// A true boolean is a fact only when it isn't a setting: "hideAwards: true"
// must not become the text "hide awards" that backs an "awards" claim.
const SETTING_KEY = /^(show|hide|use|enable|disable|allow|no|is|has|can|auto|custom)([A-Z_]|$)/;
// The intake answers that are the owner's own words about the business.
// Their personal contact fields never go into a run.
export const OWNER_FIELDS = Object.freeze([
  'businessName', 'sitePhone', 'serviceArea', 'address', 'services', 'about', 'whyUs', 'instagram', 'facebook', 'tiktok', 'youtube',
]);
const WORDS_PATHS = Object.freeze([
  ['social.bio', 'Social bio'],
  ['social.captions', 'Social caption'],
  ['gbp.description', 'Google profile description'],
  ['gbp.services', 'Google profile service'],
  ['gbp.posts', 'Google profile post'],
  ['seo.title', 'Search title'],
  ['seo.description', 'Search description'],
]);

const leaf = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

// Every string under `value` as [path, text].
function leaves(value, path, out, depth = 0) {
  if (depth > 6 || out.length > 400) return out;
  if (leaf(value)) {
    if (!URLISH.test(leaf(value))) out.push([path, leaf(value)]);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => leaves(v, `${path}[${i}]`, out, depth + 1));
  } else if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_') || COPY_SKIP.test(k) || LINK_KEY.test(k)) continue;
      leaves(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
  }
  return out;
}

const get = (obj, path) => path.split('.').reduce((o, k) => (isObject(o) ? o[k] : undefined), obj);

// The host people type ("sampleshine.com"), or ''.
export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// [{ id, kind, label, text }]: every text an image may quote.
//   facts    the business facts the site shows (business_info, confirmed by
//            our team) and the site's address
//   owner    the customer's own intake answers about the business
//   site     the written site's copy
//   words    the Words kit's texts, when it is ready
//   reviews  the reviews the customer pasted (quotes only)
export function socialSources({ project, site, words = null, urls = {} }) {
  const out = [];
  let chars = 0;
  const push = (id, kind, label, text) => {
    const t = dataText(text, SOURCE_MAX);
    if (!t || chars + t.length > SOURCES_MAX_CHARS || out.some((s) => s.kind === kind && s.text === t)) return;
    chars += t.length;
    out.push({ id, kind, label, text: t });
  };
  const info = isObject(site?.businessInfo) ? site.businessInfo : {};
  const form = isObject(project?.form) ? project.form : {};

  push('facts.businessName', 'facts', 'Business name', leaf(info.businessName) || leaf(project?.business_name));
  push('facts.location', 'facts', 'City and state', [leaf(info.city), leaf(info.state)].filter(Boolean).join(', '));
  push('facts.serviceArea', 'facts', 'Service area', leaf(info.serviceArea));
  push('facts.address', 'facts', 'Address', leaf(info.address));
  push('facts.phone', 'facts', 'Phone', leaf(info.phone));
  push('facts.site', 'facts', 'Site address', hostOf(urls.site));
  for (const [key, v] of Object.entries(info)) {
    if (INFO_SKIP.test(key) || LINK_KEY.test(key) || key.startsWith('_')) continue;
    if (key === 'yearsInBusiness' && leaf(v)) {
      // "12" reads "12 years in business"; anything else ("Since 2015") as
      // the owner wrote it, never with words they didn't write around it.
      push('facts.yearsInBusiness', 'facts', 'Years in business', /^\d{1,3}$/.test(leaf(v)) ? `${leaf(v)} years in business` : leaf(v));
    } else if (typeof v === 'boolean') {
      if (v && !SETTING_KEY.test(key)) push(`facts.${key}`, 'facts', key, key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
    } else if (leaf(v)) {
      push(`facts.${key}`, 'facts', key, leaf(v));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (leaf(item)) {
          push(`facts.${key}[${i}]`, 'facts', key, leaf(item));
        } else if (isObject(item)) {
          const name = leaf(item.name) || leaf(item.title);
          if (name) push(`facts.${key}[${i}]`, 'facts', key, name);
          if (name && leaf(item.price)) push(`facts.${key}[${i}].price`, 'facts', `${key} price`, `${name} ${leaf(item.price)}`);
          if (leaf(item.description)) push(`facts.${key}[${i}].description`, 'facts', `${key} description`, leaf(item.description));
        }
      });
    }
  }

  for (const id of OWNER_FIELDS) {
    const field = FORM_FIELDS.find((f) => f.id === id);
    if (!field || !isFieldShown(field, form)) continue;
    push(`owner.${id}`, 'owner', field.label, answerText(field, form[id]));
  }

  for (const [path, text] of leaves(site?.copy, '', [])) push(`site.${path}`, 'site', path, text);

  if (isObject(words)) {
    for (const [path, label] of WORDS_PATHS) {
      const v = get(words, path);
      for (const [p, text] of leaves(v, `words.${path}`, [])) {
        if (/\.(cta|imageHint|link|photo|confirm)$/.test(p) || /\.photo\./.test(p)) continue;
        push(p, 'words', label, text);
      }
    }
  }

  push('reviews', 'reviews', 'Pasted reviews', pastedReviews(project));
  return out;
}

// ─── Inputs ───────────────────────────────────────────────────────────

const ROLE_RANK = { hero: 0, about: 1, after: 2, gallery: 3, before: 4 };

// The photo desk's picks in the order a social image wants them (hero,
// about, after shots, the gallery by score, before shots) and the photos
// it skipped.
export function photoOrder(photosData) {
  const picks = Array.isArray(photosData?.picks) ? photosData.picks.filter((p) => isObject(p) && typeof p.path === 'string') : [];
  const first = picks
    .filter((p) => Object.prototype.hasOwnProperty.call(ROLE_RANK, p.role))
    .map((p, i) => [p, i])
    .sort((a, b) => ROLE_RANK[a[0].role] - ROLE_RANK[b[0].role] || (Number(b[0].score) || 0) - (Number(a[0].score) || 0) || a[1] - b[1])
    .map(([p]) => p.path);
  const skipped = new Set(picks.filter((p) => p.role === 'skip').map((p) => p.path));
  return { first, skipped, byPath: new Map(picks.map((p) => [p.path, p])) };
}

const fraction = (v) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : null);

function photoEntry(file, pick) {
  const focal = isObject(pick?.focal) && fraction(pick.focal.x) !== null && fraction(pick.focal.y) !== null
    ? { x: fraction(pick.focal.x), y: fraction(pick.focal.y) }
    : null;
  const blur = (Array.isArray(pick?.blur) ? pick.blur : [])
    .filter((b) => isObject(b) && ['x', 'y', 'w', 'h'].every((k) => fraction(b[k]) !== null) && b.w > 0 && b.h > 0)
    .slice(0, 12)
    .map((b) => ({ x: fraction(b.x), y: fraction(b.y), w: fraction(b.w), h: fraction(b.h), kind: b.kind === 'face' ? 'face' : 'plate' }));
  return {
    file: file.name,
    width: Number(pick?.width) || file.width || null,
    height: Number(pick?.height) || file.height || null,
    role: pick?.role || null,
    score: Number.isFinite(Number(pick?.score)) ? Number(pick.score) : null,
    alt: oneLine(pick?.alt, 160),
    focal,
    blur,
    note: dataText(file.note, 300),
  };
}

function businessOf(project, site) {
  const form = isObject(project?.form) ? project.form : {};
  const name = dataText(site?.businessInfo?.businessName || form.businessName || project?.business_name, 160) || 'this business';
  const typeField = FORM_FIELDS.find((f) => f.id === 'businessType');
  return { name, type: typeField ? dataText(answerText(typeField, form.businessType), 80) : '' };
}

export async function loadInputs(ctx) {
  const { project, site, look = {}, urls = {} } = ctx;
  if (!site) throw new Error('The social kit needs the written site first.');
  const warnings = [];
  const order = photoOrder(kitData(project, 'photos'));
  const assets = Array.isArray(project?.assets) ? project.assets : [];
  const kept = assets.filter((a) => !(a?.kind === 'photo' && order.skipped.has(a.path)));
  // When the desk skipped every photo, the skill still gets them to judge.
  const useKept = kept.some((a) => a?.kind === 'photo') || !assets.some((a) => a?.kind === 'photo');
  const { files: images, skipped } = await loadAssetImages(ctx.db, { ...project, assets: useKept ? kept : assets }, {
    limits: { logo: 1, photo: PHOTO_LIMIT }, first: order.first,
  });
  if (useKept) {
    for (const a of assets.filter((x) => x?.kind === 'photo' && order.skipped.has(x.path))) {
      skipped.push({ path: a.path, kind: 'photo', name: a.name || '', reason: 'The photo desk skipped it' });
    }
  }
  const logoFile = images.find((f) => f.kind === 'logo') || null;
  const photoFiles = images.filter((f) => f.kind === 'photo');
  if (!logoFile && !photoFiles.length) {
    warnings.push('No logo or photos could be sent: the images use the brand colors and text only.');
  }

  const fontsWanted = [look.fonts?.heading, look.fonts?.body].filter(Boolean);
  const fontRes = fontsWanted.length && typeof ctx.fonts === 'function' ? await ctx.fonts(fontsWanted) : { files: [], warnings: [] };
  warnings.push(...(fontRes.warnings || []).map((w) => `Fonts: ${w}`));
  const fontFiles = fontRes.files || [];
  const fontSlot = (family) => (family ? {
    family,
    files: fontFiles.filter((f) => f.family === family).map((f) => ({ name: f.name, weight: f.weight })),
  } : null);

  const words = kitData(project, 'words');
  const sources = socialSources({ project, site, words, urls });
  const phone = !!(site.businessInfo && typeof site.businessInfo.phone === 'string' && site.businessInfo.phone.trim());
  const links = { site: urls.site || '', host: hostOf(urls.site), booking: !!urls.booking, phone };
  const wordCaptions = (Array.isArray(words?.social?.captions) ? words.social.captions : []).filter((c) => typeof c === 'string' && c.trim());
  if (!look.palette) warnings.push('No brand colors were found: the images use a neutral dark palette.');

  const brief = {
    version: 1,
    business: businessOf(project, site),
    palette: look.palette || null,
    paletteSource: look.source?.palette || 'none',
    fonts: { heading: fontSlot(look.fonts?.heading), body: fontSlot(look.fonts?.body) },
    logo: logoFile ? {
      file: logoFile.name, width: logoFile.width || null, height: logoFile.height || null,
      reading: isObject(look.logo) ? look.logo : null,
    } : null,
    photos: photoFiles.map((f) => photoEntry(f, order.byPath.get(f.path))),
    links,
    words: { ready: !!words, captions: wordCaptions.map((c) => dataText(c, 2200)), bio: dataText(words?.social?.bio, 300) },
    sources,
  };
  return {
    files: [
      { name: INPUT_FILE, mediaType: 'application/json', data: Buffer.from(`${JSON.stringify(brief, null, 1)}\n`), vision: false },
      ...images,
      ...fontFiles,
    ],
    brief,
    images,
    fontFiles,
    sources,
    links,
    photos: photoFiles.map((f) => ({ name: f.name, path: f.path })),
    words: brief.words.captions,
    skipped,
    warnings,
  };
}

// ─── Prompt ───────────────────────────────────────────────────────────

const SYSTEM = `You are the social media designer at Genius Websites, which builds websites for automotive businesses (detailing, mobile detailing, tint and PPF, wheels and tires, repair shops, car washes). When a paid custom website launches you make the customer's social launch set: a share image for links, a Facebook cover, a profile picture from their logo, three launch posts and a story, with a caption for each post. The skill's scripts draw the images with Pillow; you choose the photos, the layouts and the words, and you fix what the checks report.

Only the customer's own photos and logo appear in the images; never draw, generate or borrow other pictures. The words on the images come from the brief's texts, copied word for word (a shorter run of words is fine, rewording is not), or from the skill's short list of allowed phrases. Reviews appear only as quotes, word for word, from the reviews the customer pasted. Every number and every claim (best, certified, years, free, guaranteed, insured and the like) must be in the business facts or the owner's answers.`;

const SOURCE_TAGS = Object.freeze([
  ['facts', 'business_facts', 'The business facts the site shows (claims may rest on these)'],
  ['owner', 'owner_answers', 'The owner\'s own intake answers (claims may rest on these)'],
  ['site', 'site_copy', 'The written site\'s copy'],
  ['words', 'words_kit', 'The Words kit (Google profile, search and social texts)'],
  ['reviews', 'pasted_reviews', 'The reviews the customer pasted (quotes only)'],
]);

const PHOTO_LABELS = { photo: 'photo', logo: 'logo' };

function photoLine(entry) {
  if (!entry) return '';
  const bits = [];
  if (entry.role) bits.push(`photo desk: ${entry.role}${entry.score !== null ? ` ${entry.score}/10` : ''}`);
  if (entry.focal) bits.push(`focal ${entry.focal.x.toFixed(2)},${entry.focal.y.toFixed(2)}`);
  if (entry.blur.length) bits.push(`${entry.blur.length} plate/face area${entry.blur.length === 1 ? '' : 's'} to blur`);
  return bits.length ? ` (${bits.join('; ')})` : '';
}

export function buildPrompt(ctx) {
  const inputs = ctx.inputs || {};
  const brief = inputs.brief || {};
  const { name, type } = brief.business || businessOf(ctx.project, ctx.site);
  const photos = new Map((brief.photos || []).map((p) => [p.file, p]));
  const fileLines = [`- ${INPUT_FILE}: the brief (colors, fonts, logo, photos with the photo desk's picks, links, the Words kit's captions and every text an image may quote, by kind).`];
  for (const line of fileListText(inputs.images || [], PHOTO_LABELS).split('\n').filter(Boolean)) {
    const fileName = /^- ([^:]+):/.exec(line)?.[1];
    fileLines.push(`${line}${photoLine(photos.get(fileName))}`);
  }
  for (const f of inputs.fontFiles || []) fileLines.push(`- ${f.name}: the ${f.family} font file (${f.weight}).`);
  const skipped = skippedText(inputs.skipped || []);

  const pal = brief.palette;
  const fonts = brief.fonts || {};
  const fontLine = ['heading', 'body'].map((slot) => {
    const f = fonts[slot];
    if (!f) return `${slot}: none chosen (DejaVu Sans stands in)`;
    return `${slot}: ${f.family}${f.files.length ? '' : ' (its file could not be fetched: DejaVu Sans stands in)'}`;
  }).join('; ');
  const links = brief.links || {};
  const words = brief.words || {};
  const hasReviews = (inputs.sources || []).some((s) => s.kind === 'reviews');

  const tasks = [];
  if (!brief.logo) tasks.push('No logo was sent: leave profile-800.png out and say so in the notes.');
  if (!(brief.photos || []).length) tasks.push('No photos were sent: use the brand layouts only and say so in the notes.');
  tasks.push(words.ready && (words.captions || []).length
    ? 'Captions: use the Words kit\'s captions (in the brief and below) for post-1, post-2 and post-3 as written, matched to the post they fit. Change one only to remove a claim the checks flag, and say so in the notes.'
    : 'Captions: the Words kit has no ready run, so write a short caption for each post from the site\'s copy and the business facts, with no claim the facts or the owner\'s answers don\'t back.');
  tasks.push(hasReviews
    ? 'A quote post may quote one pasted review: whole sentences, word for word, with the reviewer\'s name as written as the cite.'
    : 'No reviews were pasted: no quote post.');
  tasks.push(links.booking ? 'The site takes bookings online: "Book online" may be a button.' : 'The site takes no online bookings: no booking phrases.');

  let budget = PROMPT_SOURCES_MAX;
  const blocks = SOURCE_TAGS.map(([kind, tag, label]) => {
    const lines = [];
    for (const s of (inputs.sources || []).filter((x) => x.kind === kind)) {
      const line = `[${s.id}] ${s.text}`;
      if (line.length > budget) break;
      budget -= line.length;
      lines.push(line);
    }
    return `${label}:\n<${tag}>\n${lines.join('\n') || '(none)'}\n</${tag}>`;
  });

  const userText = `Make the social launch kit for ${name}${type ? ` (${type})` : ''}.

Files in the container:
${fileLines.join('\n')}${skipped ? `\n\nUploads that were not sent:\n${skipped}` : ''}

Brand: ${pal ? `bg ${pal.bg}, secondary ${pal.secondary}, text ${pal.text}, muted ${pal.muted}, accent ${pal.accent} (from the ${brief.paletteSource === 'brand' ? 'brand system' : brief.paletteSource === 'levers' ? 'Design Studio' : 'site as written'})` : 'no colors found (a neutral dark palette is used)'}. Fonts: ${fontLine}.
Links: ${links.host ? `the site is ${links.host}` : 'the site has no live address yet (no address on the images)'}; online booking ${links.booking ? 'yes' : 'no'}; phone on the site ${links.phone ? 'yes' : 'no'}.

${tasks.map((t) => `- ${t}`).join('\n')}

The texts an image may quote, as data (the same as the brief's "sources"; ids in brackets):
${blocks.join('\n\n')}`;
  return { system: SYSTEM, userText };
}

// ─── The result ───────────────────────────────────────────────────────

export function sanitize(json, ctx) {
  const inputs = ctx?.inputs || {};
  return sanitizeSocial(json, {
    sources: Array.isArray(inputs.sources) ? inputs.sources : null,
    links: inputs.links || {},
    photos: inputs.photos || [],
    words: inputs.words || [],
  });
}

export function notes(json, data) {
  return socialNotes(json, data);
}

// ─── Smoke test ───────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// An 8-bit RGBA PNG of width x height from paint(x, y) -> [r, g, b, a].
export function samplePng(width, height, paint) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = paint(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// A stand-in "photo of a car": sky, ground, a body with a cabin, two
// wheels and a plate (where the sample's photo desk marked one).
function carPhoto(width, height, { sky, ground, body, seed = 0 }) {
  const horizon = height * 0.58;
  const cx = width * 0.52;
  const cy = height * 0.62;
  const w = width * 0.56;
  const h = height * 0.2;
  const wheels = [cx - w / 3, cx + w / 3];
  const r = h * 0.42;
  return samplePng(width, height, (x, y) => {
    let c = y < horizon ? mixc(sky[0], sky[1], y / horizon) : mixc(ground, [0, 0, 0], ((y - horizon) / (height - horizon)) * 0.25);
    const n = ((x * 73856093) ^ (y * 19349663) ^ seed) % 9;
    c = c.map((v) => Math.max(0, Math.min(255, v + n - 4)));
    if (Math.abs(x - cx) < w / 2 && Math.abs(y - cy) < h / 2) c = body;
    if (x > cx - w / 3 && x < cx + w / 4 && y > cy - h && y < cy - h / 2) c = mixc(body, [20, 28, 40], 0.7);
    for (const wx of wheels) {
      const d = Math.hypot(x - wx, y - (cy + h / 2));
      if (d < r) c = d < r / 2 ? [150, 150, 160] : [20, 20, 22];
    }
    if (x > cx - width * 0.05 && x < cx + width * 0.05 && y > cy + h * 0.05 && y < cy + h * 0.05 + height * 0.05) c = [245, 245, 240];
    return c;
  });
}

// A lockup: a round red icon left of a light wordmark, transparent around.
function lockupLogo() {
  const W = 900;
  const H = 260;
  return samplePng(W, H, (x, y) => {
    if (Math.hypot(x - 130, y - 130) < 110) {
      const inTri = y > 70 && y < 170 && Math.abs(x - 130) < (y - 70) / 2;
      return inTri ? [245, 245, 245, 255] : [238, 53, 51, 255];
    }
    if (y > 80 && y < 180 && x > 320 && x < 872 && (x - 320) % 92 < 70) return [245, 245, 245, 255];
    if (y > 200 && y < 214 && x > 320 && x < 850) return [238, 53, 51, 255];
    return [0, 0, 0, 0];
  });
}

const SAMPLE_ID = '00000000-0000-4000-8000-00000000c0c1';
const SAMPLE_SITE_ID = '00000000-0000-4000-8000-00000000c0c2';
const P = (n) => `${SAMPLE_ID}/photo/sample-${n}.png`;

// A made-up mobile detailer (obviously fake names): logo, three photos the
// photo desk ranked (one plate to blur, one skipped), a brand system, the
// Words kit with a caption that claims "500+ happy customers" (nothing
// backs it: the skill must rewrite or replace that caption), pasted
// reviews, online booking.
// Drawn once per process (each call gets a fresh project, the same bytes).
let sampleFiles = null;
function sampleImages() {
  if (!sampleFiles) {
    sampleFiles = Object.freeze({
      [`${SAMPLE_ID}/logo/sample-logo.png`]: lockupLogo(),
      [P(1)]: carPhoto(1200, 800, { sky: [[70, 110, 170], [160, 190, 230]], ground: [90, 95, 100], body: [200, 30, 40], seed: 1 }),
      [P(2)]: carPhoto(1200, 800, { sky: [[235, 235, 240], [255, 255, 255]], ground: [220, 220, 215], body: [250, 250, 250], seed: 2 }),
      [P(3)]: carPhoto(1000, 1000, { sky: [[20, 20, 30], [60, 60, 90]], ground: [40, 40, 40], body: [30, 120, 200], seed: 3 }),
      [P(4)]: carPhoto(640, 480, { sky: [[120, 90, 60], [230, 180, 120]], ground: [60, 50, 45], body: [20, 20, 20], seed: 4 }),
    });
  }
  return sampleFiles;
}

export function smokeSample() {
  const logoPath = `${SAMPLE_ID}/logo/sample-logo.png`;
  const files = { ...sampleImages() };
  const asset = (path, kind, name) => ({ path, kind, name, size: files[path].length, type: 'image/png' });
  const row = {
    id: SAMPLE_SITE_ID,
    slug: 'sample-shine',
    template_id: 'mobile_redline',
    business_info: {
      businessName: 'Sample Shine Mobile Detailing',
      businessType: 'mobile_detailing',
      phone: '(555) 010-0199',
      email: 'hello@example.test',
      city: 'Exampleton',
      state: 'FL',
      serviceArea: 'Exampleton and Sampleville',
      yearsInBusiness: '8',
      services: [
        { name: 'Full Detail', price: '$199', description: 'Inside and out, at your place.' },
        { name: 'Ceramic Coating', price: '$899', description: '' },
        { name: 'Interior Refresh', price: '$119', description: '' },
      ],
      customProjectId: SAMPLE_ID,
    },
    generated_content: {
      headline: 'Showroom shine, wherever you park',
      subheadline: 'Mobile detailing in Exampleton and Sampleville. We bring the water and the power.',
      aboutText: 'Sam has been detailing cars for 8 years. Every job is done by hand, at your home or office.',
      ctaPrimary: 'Book a detail',
      footerTagline: 'Showroom shine, wherever you park.',
      metaTitle: 'Sample Shine Mobile Detailing | Exampleton, FL',
      _images: { hero: 'https://example.test/hero.jpg' },
    },
    published_url: 'https://sample-shine.autocaregeniushub.com',
    custom_domain: null,
    custom_domain_status: null,
    site_type: 'website',
    scheduler_enabled: true,
  };
  const pick = (path, role, score, extra = {}) => ({
    path, role, score, reason: 'Sample pick.', alt: role === 'skip' ? '' : 'A car parked outside on a clear day.',
    focal: { x: 0.52, y: 0.6 }, crops: {}, blur: [], width: 1200, height: 800, ...extra,
  });
  const project = {
    id: SAMPLE_ID,
    business_name: 'Sample Shine Mobile Detailing',
    site_id: SAMPLE_SITE_ID,
    form: {
      businessName: 'Sample Shine Mobile Detailing',
      businessType: 'mobile_detailing',
      contactName: 'Sam Sample',
      contactEmail: 'sam@example.test',
      contactPhone: '(555) 010-0100',
      serviceArea: 'Exampleton and Sampleville',
      services: 'Full Detail - $199\nCeramic Coating - $899\nInterior Refresh - $119',
      about: 'I have been detailing cars for 8 years. I come to you with my own water and power.',
      whyUs: 'I show up on time and I don\'t rush the job.',
      instagram: '@sampleshine',
      testimonials: '"Sam made my truck look brand new. Showed up right on time!" - Riley Q.\n"Friendly, careful and the car looks great." - Casey V.',
    },
    assets: [
      asset(logoPath, 'logo', 'Sample Shine logo.png'),
      asset(P(1), 'photo', 'red car.png'),
      asset(P(2), 'photo', 'white car.png'),
      asset(P(3), 'photo', 'blue car night.png'),
      asset(P(4), 'photo', 'blurry.png'),
    ],
    design: {
      siteId: SAMPLE_SITE_ID,
      brand: {
        status: 'ready',
        brand: {
          version: 1,
          palette: { bg: '#0a0909', secondary: '#1a1818', text: '#f8f8f8', muted: '#a7a3a4', accent: '#ee3533' },
          fonts: { heading: 'Oswald', body: 'Inter' },
          logo: { dominant: ['#ee3533', '#f5f5f5'], background: 'transparent', hasText: true },
        },
      },
      kit: {
        photos: {
          status: 'ready',
          startedAt: '2026-10-05T10:00:00.000Z',
          finishedAt: '2026-10-05T10:03:00.000Z',
          files: [],
          data: {
            version: 1,
            picks: [
              pick(P(2), 'gallery', 7.1),
              pick(P(1), 'hero', 8.6, { blur: [{ x: 0.47, y: 0.63, w: 0.1, h: 0.06, kind: 'plate' }] }),
              pick(P(3), 'gallery', 7.8, { width: 1000, height: 1000, focal: { x: 0.5, y: 0.55 } }),
              pick(P(4), 'skip', 2.1, { reason: 'Out of focus.' }),
            ],
            pairs: [],
            shotList: [],
            notes: [],
          },
        },
        words: {
          status: 'ready',
          startedAt: '2026-10-05T11:00:00.000Z',
          finishedAt: '2026-10-05T11:04:00.000Z',
          files: [],
          data: {
            gbp: { description: 'Sample Shine brings mobile detailing to Exampleton and Sampleville.', services: [], categories: [], posts: [] },
            seo: { title: 'Mobile Detailing in Exampleton | Sample Shine', description: 'Mobile detailing in Exampleton and Sampleville.', keywords: [] },
            reviews: { requestSms: '', requestEmail: { subject: '', body: '' }, replies: [] },
            social: {
              bio: 'Mobile detailing in Exampleton and Sampleville. We come to you.',
              captions: [
                'Our new website is live! Book a Full Detail at home or at work, in a few taps.',
                'Inside and out, at your place. See every service on the new site.',
                'Trusted by 500+ happy customers in Exampleton.',
              ],
            },
          },
        },
      },
    },
  };
  return { project, site: siteView(row), files };
}

// The smoke test's strict reading: every image back, nothing the server
// had to flag, the planted claim gone, real fonts.
export function smokeCheck(raw, data, outputs) {
  const problems = [];
  const names = new Set((outputs || []).map((o) => o.name));
  for (const f of SOCIAL_FILES) if (!names.has(f)) problems.push(`${f} did not come back`);
  const rawImages = Array.isArray(raw?.images) ? raw.images.length : 0;
  if (rawImages !== (data?.images || []).length) problems.push(`social.json lists ${rawImages} images; ${(data?.images || []).length} were kept`);
  for (const im of data?.images || []) for (const c of im.checks || []) problems.push(`${im.file}: ${c}`);
  for (const c of data?.captionChecks || []) for (const x of c.checks || []) problems.push(`${c.file}: ${x}`);
  if ((data?.captions || []).length !== 3) problems.push(`${(data?.captions || []).length} captions (one per post)`);
  if ((data?.captions || []).some((c) => socialTokens(c.text).includes('500'))) problems.push('the unsourced "500+ happy customers" caption was kept');
  if (!(data?.captionChecks || []).some((c) => c.source === 'words')) problems.push('no Words kit caption was used');
  if (data?.fonts?.standIn) problems.push('the brand fonts were not used (DejaVu stood in)');
  return problems;
}

export const spec = {
  // Plan, render, validate, fix: a few rounds of container commands.
  maxTurns: 10,
  loadInputs,
  buildPrompt,
  sanitize,
  notes,
  smokeSample,
  smokeCheck,
};

// For tests: the stored path of a sample photo.
export const SAMPLE_PHOTO_PATH = P;
