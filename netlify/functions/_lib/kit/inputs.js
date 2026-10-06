// Shared input loaders for the Launch Kit skills (_lib/kit/<key>.js). Each
// skill's loadInputs(ctx) picks from these; nothing here writes anything:
// the customer's uploads and the stored kit files are downloaded from the
// private custom-site-assets bucket, the site row is only read.
//
// What goes into a request is data from the customer (intake answers,
// notes, file names, pasted reviews), from their site (copy Claude wrote
// earlier, business_info) and from earlier kit runs. All of it reaches the
// model as data inside tags, never as instructions: text passes through
// dataText (no control characters, no angle brackets that could close a
// tag, capped), files get plain container names ("photo-3.jpg"), never the
// customer's own file names.
//
// Contact details (the intake's contact name, email and phone) stay out of
// requests unless a deliverable needs them: intakeText({ contact: true })
// and contactDetails() are for the vCard and print pieces only.
import { sniffImage } from '../custom-site-suggest-ai.js';
import { ASSET_BUCKET, FORM_FIELDS, answerText, isFieldShown, safeHref } from '../../../../src/lib/customSiteForm.js';
import { COLOR_ROLES } from '../../../../src/lib/designLevers.js';
import { FONT_CATALOG, catalogFamily, familyFromStack } from '../../../../src/lib/fontCatalog.js';
import { bookingShareUrl } from '../../../../src/lib/bookingUrl.js';
import { isKitKey, kitRunOf, kitRunState, parseKitFilePath } from '../../../../src/lib/launchKit.js';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const mb = (n) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

// ─── Text ─────────────────────────────────────────────────────────────

// Customer (or model) text as data inside a request: no control characters,
// no angle brackets (they could close the tags it sits in), capped.
export function dataText(v, max = 2000) {
  return String(v ?? '')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/</g, '‹').replace(/>/g, '›')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

// Text on one line, capped.
export function oneLine(v, max = 300) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// The intake's personal contact fields: left out unless asked for.
export const CONTACT_FIELDS = Object.freeze(['contactName', 'contactEmail', 'contactPhone']);

// The intake answers as "Label: value" lines (files and hidden fields left
// out). `only` limits to those field ids, `skip` drops some; the contact
// fields only come with `contact: true`.
export function intakeText(project, { contact = false, only = null, skip = [] } = {}) {
  const form = isObject(project?.form) ? project.form : {};
  const lines = [];
  if (!form.businessName && project?.business_name && (!only || only.includes('businessName'))) {
    lines.push(`Business name: ${dataText(project.business_name, 160)}`);
  }
  for (const field of FORM_FIELDS) {
    if (field.type === 'files' || !isFieldShown(field, form)) continue;
    if (!contact && CONTACT_FIELDS.includes(field.id)) continue;
    if ((only && !only.includes(field.id)) || skip.includes(field.id)) continue;
    let value;
    if (field.type === 'sites') {
      value = (Array.isArray(form[field.id]) ? form[field.id] : [])
        .map((r) => `\n- ${safeHref(r?.url) || '(no usable link)'}${r?.note ? `: ${dataText(r.note, 500)}` : ''}`)
        .join('');
    } else {
      value = dataText(answerText(field, form[field.id]), field.type === 'textarea' ? 5000 : 500);
    }
    if (value) lines.push(`${field.label}: ${value.includes('\n') && !value.startsWith('\n') ? `\n${value}` : value}`);
  }
  return lines.join('\n');
}

// The reviews the customer pasted into the intake, as they wrote them (the
// only reviews any deliverable may quote), or ''.
export function pastedReviews(project) {
  return dataText(project?.form?.testimonials, 5000);
}

// ─── The customer's images ────────────────────────────────────────────

// Each image goes to the container and is shown to Claude, which the API
// refuses over 5 MB; 4.5 MB keeps clear of it. The total keeps one run's
// uploads (and the function's memory) bounded.
export const KIT_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const KIT_IMAGE_EXT = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' });
export const KIT_IMAGE_MAX_BYTES = Math.floor(4.5 * 1024 * 1024);
export const KIT_IMAGES_TOTAL_BYTES = 60 * 1024 * 1024;
// Claude reads images up to 8000 px on a side; bigger ones still go to the
// container, where the skill reads them with Pillow.
const MAX_VISION_SIDE = 8000;
const IMAGE_NAME = /\.(png|jpe?g|webp|gif)$/i;
const ASSET_KIND_NAMES = { logo: 'logo', brand: 'brand file', reference: 'inspiration image', photo: 'photo' };

const skipOf = (a, reason) => ({ path: a.path, kind: a.kind, name: a.name || '', reason });

// The uploads a run may try, per kind in upload order (`first` paths lead
// their kind), and those it won't send at all, with the reason.
export function imageCandidates(assets, limits, { maxBytes = KIT_IMAGE_MAX_BYTES, first = [] } = {}) {
  const out = { skipped: [] };
  for (const kind of Object.keys(limits || {})) out[kind] = [];
  for (const a of Array.isArray(assets) ? assets : []) {
    if (!a || typeof a.path !== 'string' || !Object.prototype.hasOwnProperty.call(out, a.kind) || a.kind === 'skipped') continue;
    const name = String(a.name || a.path);
    if (!IMAGE_NAME.test(name)) {
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] || 'This').toUpperCase();
      out.skipped.push(skipOf(a, `${ext} files aren't sent; only PNG, JPEG, WebP and GIF images are`));
    } else if (Number(a.size) > maxBytes) {
      out.skipped.push(skipOf(a, `Too large to send (${mb(a.size)}; the limit is ${mb(maxBytes)})`));
    } else {
      out[a.kind].push(a);
    }
  }
  const rank = (a) => {
    const i = first.indexOf(a.path);
    return i < 0 ? first.length : i;
  };
  for (const kind of Object.keys(limits || {})) out[kind] = out[kind].map((a, i) => [a, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(([a]) => a);
  return out;
}

async function downloadAsset(db, path) {
  const { data, error } = await db.storage.from(ASSET_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message || 'no data');
  return Buffer.from(await data.arrayBuffer());
}

// The customer's images for one run: at most `limits[kind]` of each kind
// (e.g. { logo: 1, photo: 12 }), in upload order, each checked after
// download (its real format from its bytes, its size). A file that can't
// be sent makes room for the next of its kind. Each gets a plain container
// name ("photo-3.jpg"). Returns { files: [{ name, kind, path, mediaType,
// data, originalName, note, vision, width, height }], skipped: [{ path,
// kind, name, reason }] }; `files` go to runSkillRequest as they are.
export async function loadAssetImages(db, project, {
  limits, maxBytes = KIT_IMAGE_MAX_BYTES, totalBytes = KIT_IMAGES_TOTAL_BYTES, first = [], namePrefix = '',
} = {}) {
  const candidates = imageCandidates(project?.assets, limits, { maxBytes, first });
  const skipped = [...candidates.skipped];
  const files = [];
  let budget = totalBytes;
  for (const kind of Object.keys(limits || {})) {
    const limit = Math.max(0, Number(limits[kind]) || 0);
    const queue = candidates[kind].slice();
    let taken = 0;
    while (queue.length && taken < limit) {
      // A few at a time: a kind with many large photos must not sit in
      // memory all at once before the total budget applies.
      const batch = queue.splice(0, Math.min(4, limit - taken));
      const loaded = await Promise.all(batch.map(async (a) => {
        try {
          return { a, buf: await downloadAsset(db, a.path) };
        } catch (err) {
          console.warn('[kit-inputs] download failed:', a.path, err?.message || err);
          return { a, skip: 'Could not be downloaded' };
        }
      }));
      for (const { a, buf, skip } of loaded) {
        if (skip) { skipped.push(skipOf(a, skip)); continue; }
        // What the file really is, from its bytes: the name and stored type
        // can be wrong, and a wrong media type fails the request.
        const info = sniffImage(buf);
        if (!info || !KIT_IMAGE_TYPES.includes(info.mediaType)) { skipped.push(skipOf(a, 'Not a readable PNG, JPEG, WebP or GIF image')); continue; }
        if (buf.length > maxBytes) { skipped.push(skipOf(a, `Too large to send (over ${mb(maxBytes)})`)); continue; }
        if (buf.length > budget) { skipped.push(skipOf(a, 'Left out to keep the run under its size limit')); continue; }
        budget -= buf.length;
        taken += 1;
        files.push({
          name: `${namePrefix}${kind}-${taken}.${KIT_IMAGE_EXT[info.mediaType]}`,
          kind,
          path: a.path,
          mediaType: info.mediaType,
          data: buf,
          originalName: a.name || '',
          note: a.note || '',
          vision: !(info.width > MAX_VISION_SIDE || info.height > MAX_VISION_SIDE),
          width: info.width,
          height: info.height,
        });
      }
    }
    for (const a of queue) {
      skipped.push(skipOf(a, kind === 'logo' ? 'Another version of the logo (one is sent)' : `Only the first ${limit} ${ASSET_KIND_NAMES[kind] || kind}s are sent`));
    }
  }
  return { files, skipped };
}

// The files a run sent, as request lines: "- photo-1.jpg: a photo. Their
// file name: "…". Their note: "…"." (the customer's names and notes as data).
export function fileListText(files, labels = ASSET_KIND_NAMES) {
  return (files || []).map((f) => {
    const what = labels[f.kind] ? `${/^[aeiou]/i.test(labels[f.kind]) ? 'an' : 'a'} ${labels[f.kind]}` : 'a file';
    const original = f.originalName ? ` Their file name: "${dataText(f.originalName, 120)}".` : '';
    const note = f.note ? ` Their note: "${dataText(f.note, 500)}".` : '';
    return `- ${f.name}: ${what}.${original}${note}`;
  }).join('\n');
}

// What was left out, as request lines (at most 20).
export function skippedText(skipped) {
  return (skipped || []).slice(0, 20).map((s) => `- ${dataText(s.name || s.path, 120)} (${s.kind}): ${dataText(s.reason, 200)}`).join('\n');
}

// ─── The written site (read only) ─────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_COLUMNS = 'id, slug, template_id, business_info, generated_content, published_url, custom_domain, custom_domain_status, site_type, scheduler_enabled';

// sites.generated_content split into the copy and the side data saveSite
// stashes in it. The same split as src/lib/siteRender.js
// unpackGeneratedContent, which can't be imported here: siteRender loads
// the template registry, and with it the React templates, which have no
// place in a function bundle (kit-inputs.test.js keeps the two equal).
export function unpackContent(generatedContent) {
  const { _images, _customColors, _customFonts, ...copy } = isObject(generatedContent) ? generatedContent : {};
  return { copy, images: _images || {}, customColors: _customColors || {}, customFonts: _customFonts || {} };
}

// The project's site, read only: { id, slug, templateId, businessInfo,
// copy, images, customColors, customFonts, publishedUrl, customDomain,
// domainStatus, siteType, schedulerEnabled }, or null without one.
export async function loadSite(db, project) {
  const siteId = [project?.site_id, project?.design?.siteId].find((v) => typeof v === 'string' && UUID_RE.test(v));
  if (!siteId) return null;
  try {
    const { data: row, error } = await db.from('sites').select(SITE_COLUMNS).eq('id', siteId).maybeSingle();
    if (error || !row) return null;
    return siteView(row);
  } catch (err) {
    console.warn('[kit-inputs] site not loaded:', err?.message || err);
    return null;
  }
}

// A sites row in the shape loadSite returns (smoke samples build one too).
export function siteView(row) {
  const { copy, images, customColors, customFonts } = unpackContent(row?.generated_content);
  return {
    id: row?.id || null,
    slug: row?.slug || '',
    templateId: row?.template_id || '',
    businessInfo: isObject(row?.business_info) ? row.business_info : {},
    copy,
    images,
    customColors,
    customFonts,
    publishedUrl: safeHref(row?.published_url) || '',
    customDomain: typeof row?.custom_domain === 'string' ? row.custom_domain : '',
    domainStatus: typeof row?.custom_domain_status === 'string' ? row.custom_domain_status : '',
    siteType: row?.site_type || 'website',
    schedulerEnabled: !!row?.scheduler_enabled,
  };
}

// Copy keys that are settings or widget plumbing, not words on the page.
const COPY_SKIP = /^(sectionOrder|hiddenSections|heroLayout|aboutLayout|[a-zA-Z]*WidgetKey|googleBadge|heroCard|vehicleMakes|footer[A-Z]?\w*Columns)$/;
const URLISH = /^(https?:|data:|\/\/|#|mailto:|tel:)/i;

function flatten(value, path, out, depth) {
  if (depth > 6 || out.length > 600) return;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s && !URLISH.test(s)) out.push(`${path}: ${s}`);
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(`${path}: ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${path}[${i}]`, out, depth + 1));
  } else if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_') || COPY_SKIP.test(k) || /(url|href|image|photo|src)$/i.test(k)) continue;
      flatten(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
  }
}

// The words on the written site as "path: text" lines (settings, links and
// image references left out), capped. For prompts and claim checks.
export function siteCopyText(copy, { max = 20000 } = {}) {
  const out = [];
  flatten(isObject(copy) ? copy : {}, '', out, 0);
  return dataText(out.join('\n'), max);
}

// business_info (the facts the site shows) the same way.
export function businessInfoText(info, { max = 8000 } = {}) {
  const out = [];
  flatten(isObject(info) ? info : {}, '', out, 0);
  return dataText(out.join('\n'), max);
}

// ─── Brand look ───────────────────────────────────────────────────────

const look = (bg, secondary, text, muted, accent, font, bodyFont) => Object.freeze({
  colors: Object.freeze({ bg, secondary, text, muted, accent }), font, bodyFont,
});

// Each template's own colors and fonts: a mirror of src/data/templates.js,
// which can't be imported here (it loads the React templates). Only used
// when neither the brand system nor the Studio set a look.
// kit-inputs.test.js fails when a template changes and this doesn't.
export const TEMPLATE_LOOKS = Object.freeze({
  detailing_sporty: look('#111111', '#1f1f1f', '#ffffff', '#aaaaaa', '#e53e3e', "'Inter', sans-serif", "'Inter', sans-serif"),
  mobile_bold: look('#1a1a1a', '#2a2a2a', '#ffffff', '#aaaaaa', '#f97316', "'Inter', sans-serif", "'Inter', sans-serif"),
  mobile_modern: look('#ffffff', '#eff6ff', '#1e293b', '#64748b', '#2563eb', "'Inter', sans-serif", "'Inter', sans-serif"),
  mobile_rugged: look('#1a2318', '#2a3328', '#f0ede0', '#9aaa8a', '#8a9a4a', "'Inter', sans-serif", "'Inter', sans-serif"),
  wheel_edge: look('#0d0d0d', '#1a1a2e', '#ffffff', '#888888', '#00b4d8', "'Inter', sans-serif", "'Inter', sans-serif"),
  wheel_clean: look('#f8f9fa', '#e5e7eb', '#111827', '#6b7280', '#374151', "'Inter', sans-serif", "'Inter', sans-serif"),
  tint_dark: look('#080808', '#111111', '#ffffff', '#888888', '#7c3aed', "'Inter', sans-serif", "'Inter', sans-serif"),
  tint_sleek: look('#1f2937', '#374151', '#f9fafb', '#9ca3af', '#14b8a6', "'Inter', sans-serif", "'Inter', sans-serif"),
  detailing_coastal: look('#f0f9ff', '#e0f2fe', '#0c4a6e', '#64748b', '#0891b2', "'Inter', sans-serif", "'Inter', sans-serif"),
  mechanic_industrial: look('#1c1c1c', '#2c2c2c', '#ffffff', '#999999', '#eab308', "'Inter', sans-serif", "'Inter', sans-serif"),
  mechanic_friendly: look('#ffffff', '#eff6ff', '#1e293b', '#64748b', '#1d4ed8', "'Inter', sans-serif", "'Inter', sans-serif"),
  mechanic_garage: look('#1a1a1a', '#262626', '#ffffff', '#a3a3a3', '#f97316', "'Inter', sans-serif", "'Inter', sans-serif"),
  mobile_chrome: look('#0a0a0a', '#141414', '#ffffff', '#888888', '#94a3b8', "'Inter', sans-serif", "'Inter', sans-serif"),
  tint_elite: look('#030303', '#0f0f0f', '#ffffff', '#777777', '#ca8a04', "'Playfair Display', Georgia, serif", "'Inter', sans-serif"),
  tint_obsidian: look('#050507', '#0d0d12', '#ffffff', '#888888', '#7C3AED', "'Syne', sans-serif", "'Outfit', sans-serif"),
  mobile_sudsy: look('#fffbeb', '#fef3c7', '#1c1917', '#78716c', '#f59e0b', "'Boogaloo', cursive", "'Nunito', sans-serif"),
  wheel_apex: look('#F0F1F3', '#FFFFFF', '#1C1E24', '#7A7D88', '#A8813A', "'Bebas Neue', sans-serif", "'DM Sans', sans-serif"),
  detailing_autosync_dark: look('#080A0D', '#0E1116', '#ffffff', '#888888', '#C9A84C', "'Cormorant Garamond', serif", "'Barlow', sans-serif"),
  detailing_autosync_white: look('#ffffff', '#f5f5f7', '#1d1d1f', '#6e6e73', '#0071E3', "'DM Serif Display', serif", "'DM Sans', sans-serif"),
  mechanic_ironclad: look('#111111', '#1e1e1e', '#ffffff', '#aaaaaa', '#C0392B', "'Bebas Neue', sans-serif", "'Barlow', sans-serif"),
  carwash_bubble: look('#f0f9ff', '#e0f7fa', '#0c4a6e', '#64748b', '#06b6d4', "'Righteous', cursive", "'Nunito', sans-serif"),
  mobile_redline: look('#0a0909', '#1a1818', '#f8f8f8', '#a7a3a4', '#ee3533', "'Inter', sans-serif", "'Inter', sans-serif"),
});

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hex(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!HEX_RE.test(s)) return '';
  return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
}

// All 5 roles as '#rrggbb', or null when any is missing.
function fullPalette(raw) {
  if (!isObject(raw)) return null;
  const out = {};
  for (const role of COLOR_ROLES) {
    const v = hex(raw[role]);
    if (!v) return null;
    out[role] = v;
  }
  return out;
}

const family = (v) => catalogFamily(v) || catalogFamily(familyFromStack(v)) || '';

// The colors and fonts the deliverables use, and where each came from:
// the ready brand system first, then the Studio's levers, then the site
// as written (its template's colors with the editor's custom colors on
// top). Returns { palette: { bg, secondary, text, muted, accent },
// fonts: { heading, body } (FONT_CATALOG families, '' when unknown),
// source: { palette, fonts } ('brand' | 'levers' | 'site' | 'none'),
// logo: the brand run's logo reading or null }.
export function brandLook(project, site = null) {
  const design = isObject(project?.design) ? project.design : {};
  const brand = design.brand?.status === 'ready' && isObject(design.brand.brand) ? design.brand.brand : null;
  const levers = isObject(design.levers) ? design.levers : {};
  const templateId = site?.templateId || design.templateId || '';
  const tpl = Object.prototype.hasOwnProperty.call(TEMPLATE_LOOKS, templateId) ? TEMPLATE_LOOKS[templateId] : null;

  let palette = fullPalette(brand?.palette);
  let paletteSource = palette ? 'brand' : '';
  if (!palette && fullPalette(levers.palette)) {
    palette = fullPalette(levers.palette);
    paletteSource = 'levers';
  }
  if (!palette && tpl) {
    // The site as written: template colors, the setup's custom colors, the
    // Studio's partial picks and the editor's own changes, later wins.
    const merged = { ...tpl.colors };
    for (const src of [design.customColors, levers.palette, site?.customColors]) {
      for (const role of COLOR_ROLES) if (hex(src?.[role])) merged[role] = hex(src[role]);
    }
    palette = fullPalette(merged);
    paletteSource = palette ? 'site' : '';
  }

  const fonts = { heading: '', body: '' };
  const fontSource = { heading: '', body: '' };
  const pick = (slot, value, source) => {
    const f = family(value);
    if (!fonts[slot] && f) { fonts[slot] = f; fontSource[slot] = source; }
  };
  pick('heading', brand?.fonts?.heading, 'brand');
  pick('body', brand?.fonts?.body, 'brand');
  pick('heading', levers.fonts?.heading, 'levers');
  pick('body', levers.fonts?.body, 'levers');
  pick('heading', site?.customFonts?.font, 'site');
  pick('body', site?.customFonts?.bodyFont, 'site');
  pick('heading', tpl?.font, 'site');
  pick('body', tpl?.bodyFont, 'site');

  return {
    palette: palette || null,
    fonts,
    source: { palette: paletteSource || 'none', fonts: fontSource.heading || fontSource.body || 'none' },
    logo: isObject(brand?.logo) ? brand.logo : null,
  };
}

// ─── Earlier kit runs ─────────────────────────────────────────────────

// The data of a ready kit run (sanitized when it was stored), or null.
export function kitData(project, key) {
  const run = kitRunOf(project, key);
  return kitRunState(run) === 'ready' ? run.data : null;
}

// Stored kit files go into a run as container uploads (the handover zip
// takes every other run's files). Per file and per run caps keep the
// function's memory and the upload bounded. The run total stays under the
// 50 MB the server takes back as launch-kit.zip (KIT_OUTPUT_MAX_BYTES, also
// Supabase Storage's default object limit): PNGs and PDFs barely compress,
// so a zip of more than this would come back too large and be left out
// whole, where a skipped file or two still leaves a usable zip.
export const KIT_INPUT_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const KIT_INPUT_FILES_TOTAL_BYTES = 45 * 1024 * 1024;

// A shared byte budget for one run's kit file downloads.
export function kitFilesBudget(total = KIT_INPUT_FILES_TOTAL_BYTES) {
  return { left: total };
}

// The stored files of the ready run of `key` (only paths that are this
// project's kit files of that key; `names` limits to some outputs), each
// downloaded within the caps. Returns { files: [{ key, name, path, type,
// size, data }], skipped: [{ key, name, reason }] }.
export async function loadKitFiles(db, project, key, {
  names = null, maxBytes = KIT_INPUT_FILE_MAX_BYTES, budget = kitFilesBudget(),
} = {}) {
  const files = [];
  const skipped = [];
  if (!isKitKey(key) || typeof project?.id !== 'string') return { files, skipped };
  const run = kitRunOf(project, key);
  if (kitRunState(run) !== 'ready') return { files, skipped };
  for (const f of Array.isArray(run.files) ? run.files : []) {
    if (!f || typeof f.name !== 'string' || (names && !names.includes(f.name))) continue;
    const p = parseKitFilePath(project.id, f.path);
    if (!p || p.key !== key || p.name !== f.name) continue;
    if (Number(f.size) > maxBytes) { skipped.push({ key, name: f.name, reason: `Too large (${mb(f.size)})` }); continue; }
    if (Number(f.size) > budget.left) { skipped.push({ key, name: f.name, reason: 'Left out to keep the run under its size limit' }); continue; }
    try {
      const data = await downloadAsset(db, f.path);
      if (data.length > maxBytes || data.length > budget.left) {
        skipped.push({ key, name: f.name, reason: 'Too large' });
        continue;
      }
      budget.left -= data.length;
      files.push({ key, name: f.name, path: f.path, type: f.type || 'application/octet-stream', size: data.length, data });
    } catch (err) {
      console.warn('[kit-inputs] kit file not downloaded:', f.path, err?.message || err);
      skipped.push({ key, name: f.name, reason: 'Could not be downloaded' });
    }
  }
  return { files, skipped };
}

// Stored kit files as runSkillRequest files: "kit-<key>-<name>" in the
// container, never shown as images (they're deliverables to pack, and an
// image block per file would cost tokens for nothing).
export function kitFilesForContainer(list) {
  return (list || []).map((f) => ({ name: `kit-${f.key}-${f.name}`, mediaType: f.type || 'application/octet-stream', data: f.data, vision: false }));
}

// ─── Links ────────────────────────────────────────────────────────────

// Google's "write a review" link for a place id, or ''.
export function reviewUrl(placeId) {
  const id = typeof placeId === 'string' ? placeId.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,300}$/.test(id)) return '';
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`;
}

// The Google profile the Studio linked (design.levers.googlePlace), else
// the one on the site; null without one.
export function googlePlaceOf(project, site = null) {
  const p = project?.design?.levers?.googlePlace || site?.businessInfo?.googlePlace;
  return isObject(p) && typeof p.placeId === 'string' && p.placeId.trim() ? p : null;
}

// The addresses the deliverables point at, '' when there is none:
//   site      the live address: the custom domain once it serves HTTPS,
//             else the published subdomain, else the project's site link
//   published the published subdomain
//   domain    https://www.<custom domain> once it serves HTTPS
//   booking   the booking page, only while the site takes bookings
//   review    Google's write-a-review link, only with a Google place
export function liveUrls(project, site = null) {
  const domainLive = !!site?.customDomain && site.domainStatus === 'active_ssl';
  const domain = domainLive ? safeHref(`https://www.${site.customDomain}`) || '' : '';
  const published = site?.publishedUrl || '';
  const siteUrl = domain || published || safeHref(project?.site_url) || '';
  const booking = site?.schedulerEnabled
    // bookingShareUrl appends '/book#book': a published address ending in
    // '/' would otherwise give '…com//book'.
    ? safeHref(bookingShareUrl({
      custom_domain: site.customDomain, custom_domain_status: site.domainStatus, published_url: published.replace(/\/+$/, ''), site_type: site.siteType,
    })) || ''
    : '';
  return {
    site: siteUrl,
    published,
    domain,
    booking,
    review: reviewUrl(googlePlaceOf(project, site)?.placeId),
  };
}

// The business's contact details for a contact card or print piece (never
// for prompts that don't need them): the site's facts first, then the
// intake. Returns { business, person, phone, email, url, address, city,
// state }, '' where unknown.
export function contactDetails(project, site = null) {
  const form = isObject(project?.form) ? project.form : {};
  const info = isObject(site?.businessInfo) ? site.businessInfo : {};
  const bi = isObject(project?.design?.businessInfo) ? project.design.businessInfo : {};
  const first = (...vals) => vals.map((v) => oneLine(typeof v === 'string' ? v : '', 200)).find(Boolean) || '';
  return {
    business: first(info.businessName, bi.businessName, form.businessName, project?.business_name),
    person: first(form.contactName, project?.client_name),
    phone: first(info.phone, bi.phone, form.sitePhone, form.contactPhone, project?.client_phone),
    email: first(info.email, form.contactEmail, project?.client_email),
    url: liveUrls(project, site).site,
    address: first(info.address, bi.address, form.address),
    city: first(info.city, bi.city),
    state: first(info.state, bi.state),
  };
}

// ─── Brand fonts (TTF) ────────────────────────────────────────────────

// Print and social render with the real brand fonts. The Google Fonts css2
// API answers a non-browser User-Agent with TrueType files, which Pillow and
// reportlab read; skills fall back to DejaVu (matplotlib) without them.
const FONT_CSS = 'https://fonts.googleapis.com/css2';
const FONT_UA = 'GeniusWebsites-LaunchKit/1.0 (server)';
const FONT_HOST = 'https://fonts.gstatic.com/';
export const FONT_FILES_MAX_BYTES = 2 * 1024 * 1024;

const isFontFile = (buf) => buf.length > 12
  && (buf.readUInt32BE(0) === 0x00010000 || buf.toString('latin1', 0, 4) === 'true' || buf.toString('latin1', 0, 4) === 'OTTO');

// The catalog weights closest to the wanted ones (a single-weight face has
// just 400), without repeats.
function weightsFor(familyName, wanted) {
  const have = FONT_CATALOG[familyName].weights.length ? FONT_CATALOG[familyName].weights : [400];
  const out = [];
  for (const w of wanted) {
    const best = [...have].sort((a, b) => Math.abs(a - w) - Math.abs(b - w) || b - a)[0];
    if (!out.includes(best)) out.push(best);
  }
  return out;
}

// TTF files for up to `maxFamilies` FONT_CATALOG families, `weights` each
// (400 and 700 by default), within `maxBytes` in all. Best effort: what
// can't be fetched is a warning, never an error. Returns { files: [{ name
// ("font-Oswald-700.ttf"), family, weight, mediaType, data, vision: false }],
// warnings }; `files` go to runSkillRequest as they are.
export async function fetchFontFiles(families, {
  weights = [400, 700], maxFamilies = 2, maxBytes = FONT_FILES_MAX_BYTES, timeoutMs = 8000, fetchImpl = globalThis.fetch,
} = {}) {
  const files = [];
  const warnings = [];
  const list = [...new Set((Array.isArray(families) ? families : [families]).map(family).filter(Boolean))].slice(0, maxFamilies);
  let left = maxBytes;
  for (const name of list) {
    const want = weightsFor(name, weights.slice(0, 2));
    const param = FONT_CATALOG[name].weights.length ? `${name.replace(/ /g, '+')}:wght@${[...want].sort((a, b) => a - b).join(';')}` : name.replace(/ /g, '+');
    let css;
    try {
      const res = await fetchImpl(`${FONT_CSS}?family=${param}`, { headers: { 'User-Agent': FONT_UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`Google Fonts answered ${res.status}`);
      css = await res.text();
    } catch (err) {
      warnings.push(`${name}: the font files could not be fetched (${oneLine(err?.message, 120) || 'network error'})`);
      continue;
    }
    for (const block of String(css).match(/@font-face\s*{[^}]*}/g) || []) {
      const weight = Number(/font-weight:\s*(\d{3})/.exec(block)?.[1]) || 400;
      const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)'"\s]+)\)/.exec(block)?.[1];
      if (!url || !url.startsWith(FONT_HOST) || /font-style:\s*italic/.test(block) || !want.includes(weight)) continue;
      if (files.some((f) => f.family === name && f.weight === weight)) continue;
      try {
        // No redirects: the bytes come from fonts.gstatic.com or not at all.
        const res = await fetchImpl(url, { headers: { 'User-Agent': FONT_UA }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) throw new Error(`answered ${res.status}`);
        const data = Buffer.from(await res.arrayBuffer());
        if (!isFontFile(data)) throw new Error('not a TrueType or OpenType file');
        if (data.length > left) {
          warnings.push(`${name} ${weight}: left out to keep the fonts under ${mb(maxBytes)}`);
          continue;
        }
        left -= data.length;
        files.push({ name: `font-${name.replace(/[^A-Za-z0-9]+/g, '')}-${weight}.ttf`, family: name, weight, mediaType: 'font/ttf', data, vision: false });
      } catch (err) {
        warnings.push(`${name} ${weight}: ${oneLine(err?.message, 120) || 'download failed'}`);
      }
    }
    if (!files.some((f) => f.family === name)) warnings.push(`${name}: no font files came back`);
  }
  return { files, warnings };
}
