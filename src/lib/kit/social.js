// The Social kit of the Launch Kit (skill launch-social-kit, kit key
// "social"): a share image, a Facebook cover, a profile picture, three
// launch posts and a story, composed from the customer's own photos and
// logo in the brand colors and fonts, with captions. Pure: the server's
// spec (netlify/functions/_lib/kit/social.js) sanitizes the skill's
// social.json with sanitizeSocial, and the admin's result view
// (components/admin/kit/SocialResult.jsx) shows the stored data with
// socialView.
//
// The stored shape (design.kit.social.data):
//   { version: 1,
//     images: [{ file, size: 'WxH', purpose, alt, layout,
//                photo: <the stored upload path> | '',
//                text: [{ role, text }], checks: [string] }],
//     captions: [{ file, text }],
//     captionChecks: [{ file, source: 'words' | 'skill', checks: [string] }],
//     fonts: { heading, body, standIn } }
//   images   in SOCIAL_FORMATS order, only files the kit knows; size and
//            purpose come from SOCIAL_FORMATS, never from the model
//   text     the words drawn on the image (an addition to the kit
//            contract, so the server can check them): each line copied
//            from the site's copy, the Words kit, the business facts or the
//            owner's answers, or an allowed phrase; quotes from the pasted
//            reviews only
//   checks   what the server's second look found (an unsourced line, a
//            claim nothing backs): the PNG can't be changed here, so the
//            admin sees it next to the image
//   captions one per post, exactly the kit contract's { file, text } (the
//            claims ledger reads every value under captions)
//   captionChecks  per caption: source 'words' when it is one of the Words
//            kit's captions as written, and what the server flagged
//   fonts    the faces the text is set in; standIn: the brand fonts weren't
//            sent and DejaVu Sans stood in
//
// The rules and formats mirror the skill's data files
// (skills/api/launch-social-kit/data/text_rules.json and formats.json,
// which scripts/textrules.py and validate_social.py enforce before
// delivery); src/lib/kit/social.test.js keeps them equal and runs the
// skill's tests/textrules_fixtures.json through both sides.

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function deepFreeze(v) {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) deepFreeze(v[k]);
    Object.freeze(v);
  }
  return v;
}

export const SOCIAL_VERSION = 1;
export const SOCIAL_TEXT_ROLES = Object.freeze(['eyebrow', 'headline', 'sub', 'items', 'quote', 'cite', 'cta', 'footer']);
export const SOCIAL_ROLE_LABELS = Object.freeze({
  eyebrow: 'Eyebrow', headline: 'Headline', sub: 'Line', items: 'Item', quote: 'Quote', cite: 'Reviewer', cta: 'Button', footer: 'Footer',
});

const ALL_ROLES = ['eyebrow', 'headline', 'sub', 'items', 'quote', 'cite', 'cta', 'footer'];
const POST_LAYOUTS = ['photo-overlay', 'photo-band', 'brand', 'quote', 'services'];
const post = (n) => ({
  file: `post-${n}.png`, kind: 'post', size: [1080, 1080], required: false,
  purpose: `Launch post ${n} (Instagram and Facebook feed)`, layouts: POST_LAYOUTS, roles: ALL_ROLES, items: 5,
});

// = skills/api/launch-social-kit/data/formats.json (file, kind, size,
// required, purpose, layouts, the text roles and the most items).
export const SOCIAL_FORMATS = deepFreeze([
  {
    file: 'share-1200x630.png', kind: 'share', size: [1200, 630], required: true,
    purpose: 'Link preview when the site is shared (also the site\'s og:image later)',
    layouts: ['photo-left', 'photo-right', 'photo-full', 'brand'], roles: ALL_ROLES, items: 4,
  },
  {
    file: 'facebook-cover.png', kind: 'cover', size: [1640, 624], required: false,
    purpose: 'Facebook page cover photo',
    layouts: ['photo-left', 'photo-right', 'photo-full', 'photo-only', 'brand'], roles: ALL_ROLES, items: 3,
  },
  {
    file: 'profile-800.png', kind: 'profile', size: [800, 800], required: false,
    purpose: 'Profile picture for Facebook, Instagram and Google (shown as a circle)',
    layouts: ['logo'], roles: [], items: 0,
  },
  post(1),
  post(2),
  post(3),
  {
    file: 'story-1080x1920.png', kind: 'story', size: [1080, 1920], required: false,
    purpose: 'Instagram and Facebook story',
    layouts: ['photo-top', 'photo-full', 'brand'], roles: ALL_ROLES, items: 5,
  },
]);
export const SOCIAL_FILES = Object.freeze(SOCIAL_FORMATS.map((f) => f.file));
const FORMAT_BY_FILE = Object.freeze(Object.fromEntries(SOCIAL_FORMATS.map((f) => [f.file, f])));
export const socialFormat = (file) => (Object.prototype.hasOwnProperty.call(FORMAT_BY_FILE, file) ? FORMAT_BY_FILE[file] : null);

// = skills/api/launch-social-kit/data/text_rules.json (without its _doc).
export const SOCIAL_TEXT_RULES = deepFreeze({
  version: 1,
  sourceKinds: ['facts', 'owner', 'site', 'words', 'reviews'],
  claimSources: ['facts', 'owner'],
  quoteSources: ['reviews'],
  limits: { line: 160, caption: 2200, hashtags: 30, alt: 250 },
  phrases: [
    { text: 'Our new website is live' },
    { text: 'Our new site is live' },
    { text: 'Our website is live' },
    { text: 'Our new website' },
    { text: 'New website' },
    { text: 'New site' },
    { text: 'Now live' },
    { text: 'Now online' },
    { text: 'We have a new website' },
    { text: 'Check out our new website' },
    { text: 'Check out our new site' },
    { text: 'Take a look' },
    { text: 'Visit our website' },
    { text: 'Visit us online' },
    { text: 'Find us online' },
    { text: 'See our work' },
    { text: 'See more' },
    { text: 'Learn more' },
    { text: 'Link in bio' },
    { text: 'Tap the link' },
    { text: 'Follow along' },
    { text: 'Follow us' },
    { text: 'What our customers say', needs: 'quote' },
    { text: 'From our customers', needs: 'quote' },
    { text: 'Our services' },
    { text: 'What we do' },
    { text: 'Before and after' },
    { text: 'Book online', needs: 'booking' },
    { text: 'Book now', needs: 'booking' },
    { text: 'Now booking', needs: 'booking' },
    { text: 'Book your appointment online', needs: 'booking' },
    { text: 'Book in a few taps', needs: 'booking' },
    { text: 'Call us', needs: 'phone' },
    { text: 'Call or text', needs: 'phone' },
    { text: 'Call today', needs: 'phone' },
    { text: 'Give us a call', needs: 'phone' },
  ],
  claimPhrases: [
    'number one', 'top rated', 'highest rated', 'best rated', 'rated',
    'five star', 'five stars',
    'award', 'awards', 'awarded', 'award winning', 'winning', 'voted',
    'certified', 'certification', 'certifications', 'accredited',
    'licensed', 'license', 'insured', 'insurance', 'bonded',
    'guarantee', 'guarantees', 'guaranteed', 'warranty', 'warranties', 'warrantied', 'lifetime',
    'family owned', 'family run', 'veteran owned', 'woman owned', 'women owned', 'locally owned',
    'trusted', 'same day', 'around the clock', 'open now',
    'fastest', 'cheapest', 'lowest price', 'lowest prices', 'best price', 'best prices',
    'eco friendly', 'environmentally friendly', 'biodegradable', 'non toxic',
    'free', 'financing',
    'best', 'leading', 'premier', 'premium', 'finest', 'greatest', 'unbeatable', 'unmatched',
    'expert', 'experts', 'expertise', 'experienced', 'satisfaction', 'affordable', 'years', 'yrs',
  ],
  neutralPhrases: [
    'feel free', 'worry free', 'hassle free', 'stress free', 'spot free', 'swirl free',
    'scratch free', 'streak free', 'lint free', 'residue free', 'toll free',
  ],
});

export const SOCIAL_LIMITS = Object.freeze({ ...SOCIAL_TEXT_RULES.limits, notes: 8, note: 300, checks: 6, lines: 12 });

// ─── Text ─────────────────────────────────────────────────────────────

// Model text on one line, capped.
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// A caption: line breaks kept (at most one blank line), capped.
function block(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]+/g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

// Words for matching: accents dropped, lowercase, '&' read as 'and', only
// a-z and 0-9 runs (scripts/textrules.py tokens).
export function socialTokens(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .match(/[a-z0-9]+/g) || [];
}

function contains(hay, needle) {
  const n = needle.length;
  if (!n || n > hay.length) return false;
  for (let i = 0; i + n <= hay.length; i += 1) {
    if (hay[i] !== needle[0]) continue;
    let ok = true;
    for (let k = 1; k < n; k += 1) {
      if (hay[i + k] !== needle[k]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

const same = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);

// The reviews as pasted, one per line: each non-empty line as a list of
// its sentences' tokens (a sentence ends at . ! or ?, with any closing
// quote, before whitespace). textrules.py review_lines.
export function reviewLines(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const sentences = line.replace(/([.!?]+["'\u201d\u2019)\]]*)\s+/g, '$1\n').split('\n').map(socialTokens).filter((t) => t.length);
    if (sentences.length) out.push(sentences);
  }
  return out;
}

// The review text as sentences of tokens (textrules.py sentences).
export function reviewSentences(text) {
  return reviewLines(text).flat();
}

// The sources of one run, prepared for the checks (textrules.py Index).
export function textIndex(sources, links = {}, rules = SOCIAL_TEXT_RULES) {
  const prepared = [];
  // The pasted reviews line by line: { source, sentences, tokens }.
  const reviewRows = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    if (!isObject(s) || !rules.sourceKinds.includes(s.kind) || typeof s.text !== 'string') continue;
    const tokens = socialTokens(s.text);
    if (!tokens.length) continue;
    prepared.push({ id: s.id || '', kind: s.kind, tokens });
    if (rules.quoteSources.includes(s.kind)) {
      for (const line of reviewLines(s.text)) reviewRows.push({ source: prepared.length - 1, sentences: line, tokens: line.flat() });
    }
  }
  const neutral = rules.neutralPhrases.map((p) => socialTokens(p));
  // What a claim may rest on, neutral phrases blanked: "feel free" in the
  // owner's answers backs no "free".
  for (const s of prepared) s.claimTokens = blankNeutral(s.tokens, neutral);
  return {
    rules,
    sources: prepared,
    reviewLines: reviewRows,
    links: { booking: !!links?.booking, phone: !!links?.phone },
    phrases: rules.phrases.map((p) => ({ tokens: socialTokens(p.text), needs: p.needs || null })),
    claimPhrases: rules.claimPhrases.map((p) => [p, socialTokens(p)]),
    neutral,
  };
}

function blankNeutral(tokens, neutral) {
  const t = tokens.slice();
  for (const ph of neutral) {
    const n = ph.length;
    let i = 0;
    while (n && i <= t.length - n) {
      if (same(t.slice(i, i + n), ph)) {
        for (let k = i; k < i + n; k += 1) t[k] = '';
        i += n;
      } else {
        i += 1;
      }
    }
  }
  return t;
}

// The review lines in which `tokens` are one or more whole consecutive
// sentences (indexes into index.reviewLines; textrules.py quote_lines).
function quoteLines(tokens, index) {
  const out = [];
  index.reviewLines.forEach((line, li) => {
    const rs = line.sentences;
    for (let i = 0; i < rs.length; i += 1) {
      let joined = [];
      for (let j = i; j < rs.length; j += 1) {
        joined = joined.concat(rs[j]);
        if (joined.length > tokens.length) break;
        if (same(joined, tokens)) {
          out.push(li);
          return;
        }
      }
    }
  });
  return out;
}

// Are `tokens` one or more whole consecutive sentences of one review line?
const reviewRun = (tokens, index) => quoteLines(tokens, index).length > 0;

// A review line this short with one sentence is a name pasted under the
// review above it ("- Casey V.", "Casey V., Tampa FL").
const NAME_LINE_TOKENS = 4;

// Is the cite in the quoted review's own line, or in the line after it
// when that line is only a name (never the next review)? textrules.py
// cite_fits.
function citeFits(quoteTokens, citeTokens, index) {
  const rl = index.reviewLines;
  return quoteLines(quoteTokens, index).some((li) => {
    if (contains(rl[li].tokens, citeTokens)) return true;
    const next = rl[li + 1];
    return !!next && next.source === rl[li].source && next.sentences.length === 1
      && next.tokens.length <= NAME_LINE_TOKENS && contains(next.tokens, citeTokens);
  });
}

// Claim terms in `tokens`: numbers first (in order), then claim phrases (in
// rule order), each once; neutral phrases ("feel free") don't count.
export function claimsIn(tokens, index) {
  const t = blankNeutral(tokens, index.neutral);
  const found = [];
  for (const tok of t) if (tok && /\d/.test(tok) && !found.includes(tok)) found.push(tok);
  for (const [text, ph] of index.claimPhrases) if (ph.length && contains(t, ph) && !found.includes(text)) found.push(text);
  return found;
}

function backed(term, index) {
  const toks = socialTokens(term);
  return index.sources.some((s) => index.rules.claimSources.includes(s.kind) && contains(s.claimTokens, toks));
}

const unbacked = (tokens, index) => claimsIn(tokens, index).filter((c) => !backed(c, index));

// The claims in an image line nothing backs (textrules.py Index.unbacked).
export function unbackedClaims(text, index) {
  return unbacked(socialTokens(text), index);
}

// Why an image line can't be used ([] when it can): textrules.py line_problems.
export function lineProblems(role, text, index) {
  if (!SOCIAL_TEXT_ROLES.includes(role)) return [`unknown text role "${role}"`];
  if (typeof text !== 'string' || !text.trim()) return [`${role} is empty`];
  const out = [];
  if (text.length > index.rules.limits.line) out.push(`${role} is longer than ${index.rules.limits.line} characters`);
  const toks = socialTokens(text);
  if (!toks.length) return [...out, `${role} has no words`];
  const { quoteSources } = index.rules;
  if (role === 'quote') {
    if (!reviewRun(toks, index)) out.push(`quote "${text}" is not one or more whole sentences of one pasted review, word for word`);
    return out;
  }
  if (role === 'cite') {
    if (!index.sources.some((s) => quoteSources.includes(s.kind) && contains(s.tokens, toks))) {
      out.push(`cite "${text}" is not in the pasted reviews`);
    }
    return out;
  }
  const phrase = index.phrases.find((p) => same(p.tokens, toks));
  if (phrase) {
    // 'quote' is an image's matter (imageProblems), not a link.
    if (phrase.needs && phrase.needs !== 'quote' && !index.links[phrase.needs]) out.push(`"${text}" needs a ${phrase.needs} link, and this site has none`);
    return out;
  }
  const found = index.sources.filter((s) => contains(s.tokens, toks));
  if (!found.length) {
    out.push(`${role} "${text}" is not in the site's copy, the Words kit or the business facts`);
    return out;
  }
  if (found.every((s) => quoteSources.includes(s.kind))) {
    out.push(`${role} "${text}" comes from the pasted reviews: reviews go only in the quote role`);
    return out;
  }
  for (const c of unbacked(toks, index)) out.push(`${role} "${text}": the claim "${c}" is not in the business facts or the owner's answers`);
  return out;
}

// What one image's lines break together ([] when nothing): a cite without
// a quote, a cite that isn't the quoted reviewer, and a phrase that needs a
// quote ("What our customers say") on an image without one. `items` is
// [{ role, text }] (textrules.py image_problems).
export function imageProblems(items, index) {
  const list = (Array.isArray(items) ? items : []).filter((t) => isObject(t) && typeof t.text === 'string');
  const quotes = list.filter((t) => t.role === 'quote').map((t) => t.text);
  const cites = list.filter((t) => t.role === 'cite').map((t) => t.text);
  const out = [];
  if (cites.length && !quotes.length) {
    out.push('a cite goes with a quote');
  } else if (cites.length) {
    const q = socialTokens(quotes[0]);
    if (quoteLines(q, index).length) {
      for (const c of cites) {
        const ct = socialTokens(c);
        if (ct.length && !citeFits(q, ct, index)) out.push(`cite "${c}" is not the name pasted with the quoted review (quote and name must be one review)`);
      }
    }
  }
  if (!quotes.length) {
    for (const t of list) {
      const toks = socialTokens(t.text);
      if (index.phrases.some((p) => p.needs === 'quote' && same(p.tokens, toks))) out.push(`"${t.text}" goes only on an image with a quote from the pasted reviews`);
    }
  }
  return out;
}

const QUOTED = /"([^"\n]{2,})"|\u201c([^\u201d\n]{2,})\u201d/g;

// The claims in free text nothing backs; whole review sentences in
// quotation marks are the reviewer's words and don't count
// (textrules.py free_unbacked).
export function freeTextUnbacked(text, index) {
  let rest = String(text ?? '');
  for (const m of rest.matchAll(QUOTED)) {
    const inner = m[1] !== undefined ? m[1] : m[2];
    if (reviewRun(socialTokens(inner), index)) rest = rest.split(m[0]).join(' ');
  }
  return unbacked(socialTokens(rest), index);
}

function freeTextProblems(text, index, what, limit) {
  if (typeof text !== 'string' || !text.trim()) return [`${what} is empty`];
  const out = [];
  if (text.length > limit) out.push(`${what} is longer than ${limit} characters`);
  for (const c of freeTextUnbacked(text, index)) out.push(`${what}: the claim "${c}" is not in the business facts or the owner's answers`);
  return out;
}

export function captionProblems(text, index, what = 'caption') {
  const out = freeTextProblems(text, index, what, index.rules.limits.caption);
  if (typeof text === 'string' && (text.match(/#[A-Za-z0-9_]+/g) || []).length > index.rules.limits.hashtags) {
    out.push(`${what} has more than ${index.rules.limits.hashtags} hashtags`);
  }
  return out;
}

export function altProblems(text, index, what = 'alt') {
  return freeTextProblems(text, index, what, index.rules.limits.alt);
}

// ─── The sanitizer ───────────────────────────────────────────────────

// The skill's social.json as stored, or null when it has no usable image.
//   sources  the run's text sources (social-input.json): the lines,
//            captions and alt texts are checked against them (no check
//            without them)
//   links    { booking, phone } of the run
//   photos   [{ name, path }]: the container names the run sent, mapped
//            back to the stored uploads
//   words    the Words kit's captions the run sent ([string])
export function sanitizeSocial(raw, { sources = null, links = {}, photos = [], words = [] } = {}) {
  if (!isObject(raw) || !Array.isArray(raw.images)) return null;
  const index = Array.isArray(sources) ? textIndex(sources, links) : null;
  const photoPath = new Map((Array.isArray(photos) ? photos : []).filter((p) => p && p.name && p.path).map((p) => [p.name, p.path]));
  const L = SOCIAL_LIMITS;
  const byFile = new Map();
  for (const im of raw.images) {
    if (!isObject(im) || byFile.has(im.file)) continue;
    const fmt = socialFormat(im.file);
    if (!fmt) continue;
    const counts = {};
    const text = [];
    for (const t of Array.isArray(im.text) ? im.text : []) {
      if (!isObject(t) || !fmt.roles.includes(t.role)) continue;
      const line = oneLine(t.text, L.line);
      if (!line) continue;
      const most = t.role === 'items' ? fmt.items : 1;
      counts[t.role] = (counts[t.role] || 0) + 1;
      if (counts[t.role] > most || text.length >= L.lines) continue;
      text.push({ role: t.role, text: line });
    }
    const alt = oneLine(im.alt, L.alt);
    const checks = [];
    if (index) {
      for (const t of text) checks.push(...lineProblems(t.role, t.text, index));
      checks.push(...imageProblems(text, index));
      if (alt) checks.push(...altProblems(alt, index, 'Alt text'));
    }
    if (!alt) checks.push('no alt text');
    byFile.set(im.file, {
      file: im.file,
      size: `${fmt.size[0]}x${fmt.size[1]}`,
      purpose: fmt.purpose,
      alt,
      layout: fmt.layouts.includes(im.layout) ? im.layout : '',
      photo: (typeof im.photo === 'string' && photoPath.get(im.photo)) || '',
      text,
      checks: checks.map((c) => oneLine(c, L.note)).slice(0, L.checks),
    });
  }
  const images = SOCIAL_FILES.filter((f) => byFile.has(f)).map((f) => byFile.get(f));
  if (!images.length) return null;

  const postFiles = images.filter((im) => socialFormat(im.file).kind === 'post').map((im) => im.file);
  const wordCaps = (Array.isArray(words) ? words : []).filter((w) => typeof w === 'string').map(socialTokens);
  const seen = new Set();
  const kept = [];
  for (const c of Array.isArray(raw.captions) ? raw.captions : []) {
    if (!isObject(c) || !postFiles.includes(c.file) || seen.has(c.file)) continue;
    const text = block(c.text, L.caption);
    if (!text) continue;
    seen.add(c.file);
    kept.push({ file: c.file, text });
  }
  kept.sort((a, b) => SOCIAL_FILES.indexOf(a.file) - SOCIAL_FILES.indexOf(b.file));

  const f = isObject(raw.fonts) ? raw.fonts : {};
  return {
    version: SOCIAL_VERSION,
    images,
    captions: kept,
    captionChecks: kept.map((c) => ({
      file: c.file,
      source: wordCaps.some((w) => same(w, socialTokens(c.text))) ? 'words' : 'skill',
      checks: index ? captionProblems(c.text, index, 'Caption').map((x) => oneLine(x, L.note)).slice(0, L.checks) : [],
    })),
    fonts: { heading: oneLine(f.heading, 80), body: oneLine(f.body, 80), standIn: f.standIn === true },
  };
}

// Lines for the admin: the server's findings first, then the skill's notes.
export function socialNotes(raw, data) {
  const own = (Array.isArray(raw?.notes) ? raw.notes : []).map((n) => oneLine(n, SOCIAL_LIMITS.note)).filter(Boolean);
  const flagged = [...(data?.images || []), ...(data?.captionChecks || [])].filter((x) => x.checks?.length).length;
  return [
    ...(flagged ? [`The server's check flagged ${flagged} image${flagged === 1 ? '' : 's'} or caption${flagged === 1 ? '' : 's'}: see "Check" under each before posting.`] : []),
    ...own,
  ].slice(0, SOCIAL_LIMITS.notes);
}

// ─── The admin view ──────────────────────────────────────────────────

const KIND_LABELS = Object.freeze({ share: 'Share image', cover: 'Facebook cover', profile: 'Profile picture', post: 'Post', story: 'Story' });

// A signed storage link that downloads the file under `name`: the server
// signs images to open inline, and Supabase Storage serves a signed object
// as an attachment when the link carries download=<name>. '' for anything
// that isn't an http(s) link.
export function downloadHref(url, name) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    u.searchParams.set('download', String(name || ''));
    return u.toString();
  } catch {
    return '';
  }
}

// The captions as one text to paste somewhere ("Post 1:" then the caption).
export function captionsText(captions) {
  return (Array.isArray(captions) ? captions : []).map((c) => `${c.label}:\n${c.text}`).join('\n\n');
}

// What the result view shows: every stored image in format order, with
// its data (alt, text, checks) and its file (signed link, byte size);
// captions next to the post they go with. `files` is kitFiles('social',
// run, urls) (customSiteKit.js): only images that came back are shown.
export function socialView(data, files = []) {
  const fileBy = new Map((Array.isArray(files) ? files : []).filter((f) => f && f.kind === 'image').map((f) => [f.name, f]));
  const dataBy = new Map((Array.isArray(data?.images) ? data.images : []).filter(isObject).map((im) => [im.file, im]));
  const images = SOCIAL_FORMATS
    .filter((fmt) => fileBy.has(fmt.file))
    .map((fmt) => {
      const d = dataBy.get(fmt.file) || {};
      const file = fileBy.get(fmt.file);
      const n = /^post-(\d)\.png$/.exec(fmt.file)?.[1];
      return {
        file: fmt.file,
        label: n ? `Post ${n}` : KIND_LABELS[fmt.kind],
        purpose: fmt.purpose,
        kind: fmt.kind,
        px: fmt.size,
        sizeLabel: file.sizeLabel || '',
        url: file.url || '',
        alt: typeof d.alt === 'string' ? d.alt : '',
        text: Array.isArray(d.text) ? d.text.filter((t) => isObject(t) && typeof t.text === 'string') : [],
        checks: Array.isArray(d.checks) ? d.checks.filter((c) => typeof c === 'string') : [],
      };
    });
  const shown = new Set(images.map((im) => im.file));
  const meta = new Map((Array.isArray(data?.captionChecks) ? data.captionChecks : []).filter(isObject).map((m) => [m.file, m]));
  const captions = (Array.isArray(data?.captions) ? data.captions : [])
    .filter((c) => isObject(c) && typeof c.text === 'string' && c.text && socialFormat(c.file))
    .map((c) => {
      const m = meta.get(c.file) || {};
      return {
        file: c.file,
        label: images.find((im) => im.file === c.file)?.label || c.file,
        text: c.text,
        source: m.source === 'words' ? 'words' : 'skill',
        checks: Array.isArray(m.checks) ? m.checks.filter((x) => typeof x === 'string') : [],
        url: shown.has(c.file) ? fileBy.get(c.file).url || '' : '',
      };
    });
  const fonts = isObject(data?.fonts) ? data.fonts : null;
  return { images, captions, fonts };
}
