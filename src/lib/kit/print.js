// The Print studio of the Launch Kit (skill launch-print-studio, kit key
// "print"): print-ready PDFs with 0.125in bleed and crop marks for the
// customer to hand to a print shop. Pure: the server's spec
// (netlify/functions/_lib/kit/print.js) builds the skill's input file and
// sanitizes its print.json with it, the admin's result view
// (components/admin/kit/PrintResult.jsx) reads the stored data through it,
// and the skill's Python side mirrors it: data/pieces.json (the pieces),
// data/claims.json (the limits, the claim patterns and the review-policy
// patterns), checked by scripts/validate_print.py. print.test.js keeps the
// copies equal.
//
// The stored shape (design.kit.print.data), version 1:
//   { version: 1,
//     pieces: [{ file, name, size: 'w x h in', bleed: '0.125in',
//                pages: ['front' | 'back' | 'die-line'],
//                qr: [{ label, kind, url, vcard, sizeIn }],
//                text: [every printed line], note }],
//     omitted: [{ file, reason }],       review pieces left out, and why
//     fonts: { heading, body, fallback }, the faces embedded in the PDFs
//     colors: { panel, ink, accent, cmykRisk: ['#rrggbb'] },
//     notes: [string] }
//   qr.kind     review | booking | site | call | contact
//   qr.url      exactly what the code opens: one of the customer's own links
//               (the Google review link, the booking page, the site, a tel:
//               link), '' for a contact code
//   qr.vcard    exactly the vCard a contact code holds ('' otherwise)
//   qr.sizeIn   the printed code without its quiet zone, in inches
//
// QR codes are the one thing on a printed piece nobody can fix after the
// print run, so the server never trusts the skill with a link: it builds
// every link (and the vCard) itself, sends them in print-inputs.json, and
// sanitizePrint() fails the run when a code points anywhere else.

export const PRINT_VERSION = 1;
export const PRINT_INPUTS_VERSION = 1;
export const PRINT_INPUTS_FILE = 'print-inputs.json';
export const PRINT_BLEED = '0.125in';
// A printed code smaller than this is hard to scan from a counter or a
// mirror; the skill draws them at least this big (without the quiet zone).
export const QR_MIN_IN = 0.75;
const QR_MAX_IN = 4;

const piece = (file, name, size, pages, review) => Object.freeze({ file, name, size, pages: Object.freeze(pages), review });

// Every piece the skill can make, in the order the view lists them. The
// review pieces need a Google review link; the rest are always made.
export const PRINT_PIECES = Object.freeze([
  piece('review-hang-tag.pdf', 'Review hang tag', '3.5 x 8.5 in', ['front', 'back', 'die-line'], true),
  piece('counter-card.pdf', 'Counter card', '4 x 6 in', ['front'], true),
  piece('glovebox-card.pdf', 'Glovebox card', '3.5 x 2 in', ['front', 'back'], false),
  piece('business-cards.pdf', 'Business cards', '3.5 x 2 in', ['front', 'back'], false),
]);
const PIECE_BY_FILE = Object.freeze(Object.fromEntries(PRINT_PIECES.map((p) => [p.file, p])));
export const REVIEW_PIECE_FILES = Object.freeze(PRINT_PIECES.filter((p) => p.review).map((p) => p.file));

export const QR_KINDS = Object.freeze(['review', 'booking', 'site', 'call', 'contact']);
export const QR_KIND_LABELS = Object.freeze({
  review: 'Google review',
  booking: 'Booking page',
  site: 'Website',
  call: 'Phone call',
  contact: 'Contact card',
});
export const PAGE_LABELS = Object.freeze({ front: 'Front', back: 'Back', 'die-line': 'Die-line (cut path, not printed)' });

// The skill's validator enforces the same caps, so a print.json that passes
// it is stored as written.
export const PRINT_LIMITS = Object.freeze({
  name: 80, label: 60, note: 300, reason: 200, text: 200, textLines: 40, qr: 3, vcard: 400, url: 600, font: 60,
  notes: 8, risk: 5, tagline: 48,
});

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const HEX_RE = /^#[0-9a-f]{6}$/;

// Model text on one line, capped.
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// ─── Links the server builds ─────────────────────────────────────────

// The address as people type it, for the printed line under a code:
// "https://www.shine.com/" → "shine.com". '' when it isn't an http(s) link.
export function printSiteLabel(url) {
  let u;
  try {
    u = new URL(String(url || ''));
  } catch {
    return '';
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
  return `${host}${path}`;
}

const digitsOf = (v) => String(v || '').replace(/\D+/g, '');

// The phone in international form for a tel: link or a vCard: "+1" for a
// 10-digit North American number, the number as given when it starts with
// "+", else the digits. '' when it can't be a phone number.
export function phoneE164(phone) {
  const raw = String(phone || '').trim();
  const digits = digitsOf(raw);
  if (digits.length < 7 || digits.length > 15) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits;
}

// A tel: link the phone camera opens in the dialer, or ''.
export function telLink(phone) {
  const n = phoneE164(phone);
  return n ? `tel:${n}` : '';
}

// An https link a code may hold, or ''. Repeated slashes in the path are
// folded: a base with a trailing slash plus "/book" gives
// "https://site.com//book#book", a different path on some hosts, and a
// printed code can't be corrected later.
function httpsLink(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s)) return '';
  let u;
  try {
    u = new URL(s);
  } catch {
    return '';
  }
  u.pathname = u.pathname.replace(/\/{2,}/g, '/');
  return u.href.length <= PRINT_LIMITS.url ? u.href : '';
}

// vCard 3.0 text values: backslash, comma and semicolon escaped, one line.
const vcardValue = (v) => oneLine(v, 200).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;');

// The contact card a "save our contact" code holds: the business as the
// contact (people look up "Shine Auto Spa", not the owner's name), with the
// phone, the site and the email. CRLF lines as the vCard spec asks. A card
// too long for a small code drops the email, then the site, then shortens
// the name (it is written three times): always a whole card, never one cut
// mid-line without its END:VCARD. '' without a business name or any way to
// reach them.
export function vcardText({ business, phone, email, url } = {}) {
  const raw = oneLine(business, 200);
  const tel = phoneE164(phone);
  const site = /^https?:\/\//i.test(String(url || '')) ? oneLine(url, 300) : '';
  const mail = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(email || '').trim()) ? String(email).trim() : '';
  if (!raw || (!tel && !site && !mail)) return '';
  const build = (nameText, withMail, withSite) => {
    const name = vcardValue(nameText);
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${name};;;;`,
      `FN:${name}`,
      `ORG:${name}`,
      tel ? `TEL;TYPE=WORK,VOICE:${tel}` : '',
      withMail && mail ? `EMAIL;TYPE=WORK:${mail}` : '',
      withSite && site ? `URL:${site}` : '',
      'X-ABShowAs:COMPANY',
      'END:VCARD',
    ].filter(Boolean).join('\r\n');
  };
  const fits = (v) => v.length <= PRINT_LIMITS.vcard;
  // Every variant keeps at least one way to reach them.
  const reaches = ([withMail, withSite]) => !!tel || (withMail && !!mail) || (withSite && !!site);
  const variants = [[true, true], [false, true], [true, false], [false, false]].filter(reaches);
  for (const [withMail, withSite] of variants) {
    const v = build(raw, withMail, withSite);
    if (fits(v)) return v;
  }
  // Only a very long name is left: drop whole words from its end, then
  // characters, with the smallest variant.
  const [withMail, withSite] = variants[variants.length - 1];
  const words = raw.split(' ');
  for (let k = words.length - 1; k >= 1; k -= 1) {
    const v = build(words.slice(0, k).join(' ').replace(/[\s,;&-]+$/, ''), withMail, withSite);
    if (fits(v)) return v;
  }
  for (let n = words[0].length - 1; n >= 1; n -= 1) {
    const v = build(words[0].slice(0, n), withMail, withSite);
    if (fits(v)) return v;
  }
  return '';
}

// Every link a printed code may hold, built by the server from the
// customer's own records (never by the skill): { site, booking, review,
// call, vcard }, '' where there is none.
export function printLinks({ site = '', booking = '', review = '', phone = '', email = '', business = '' } = {}) {
  const siteUrl = httpsLink(site);
  return {
    site: siteUrl,
    booking: httpsLink(booking),
    review: httpsLink(review),
    call: telLink(phone),
    vcard: vcardText({ business, phone, email, url: siteUrl }),
  };
}

// What the "book your next visit" codes open: the booking page, else the
// site, else the phone. '' when there is none of them.
export const REBOOK_ORDER = Object.freeze(['booking', 'site', 'call']);
export function rebookKind(links) {
  return REBOOK_ORDER.find((k) => isObject(links) && links[k]) || '';
}

// ─── Claims on print ─────────────────────────────────────────────────

// Phrases a printed line may only carry when the customer's answers or the
// site's facts say them. The skill's data/claims.json holds the same list
// (print.test.js compares them); Python's re and JS RegExp read these
// patterns alike, case-insensitive.
export const PRINT_CLAIM_PATTERNS = Object.freeze([
  '\\b\\d+\\s*\\+?\\s*(?:years?|yrs)\\b',
  '\\b(?:since|est\\.?|established)\\s+(?:in\\s+)?(?:19|20)\\d{2}\\b',
  '\\b\\d[\\d,]*\\s*\\+',
  '\\d+(?:\\.\\d+)?\\s*%',
  '#\\s*1\\b',
  '\\b(?:number one|no\\.\\s*1)\\b',
  '\\b(?:best|top[- ]rated|highest[- ]rated|award[- ]winning|awards?|certified|certification|licensed|insured|bonded|guaranteed?|guarantees|warrant(?:y|ies|ied)|five[- ]star|5[- ]star|rated)\\b',
  '[\\u2605\\u2B50]',
  '\\$\\s*\\d',
  '\\b(?:cheapest|lowest price)\\b',
  '\\bfree\\s+(?:quotes?|estimates?|inspections?|pick-?ups?|delivery|washes|wash|consultations?)\\b',
]);
const CLAIM_RES = PRINT_CLAIM_PATTERNS.map((p) => new RegExp(p, 'gi'));

// Never printed on a review piece, nor on any line that mentions a review
// (Google's review policy: no incentives, no asking only happy customers).
// = data/claims.json reviewBanned.
export const PRINT_REVIEW_BANNED_PATTERNS = Object.freeze([
  '\\b(?:discount|coupon|voucher|gift\\s*card|giveaway|raffle|prize|reward|cash\\s*back|rebate)s?\\b',
  '\\b(?:\\d+\\s*%|\\$\\s*\\d+)\\s*off\\b',
  '\\bin\\s+exchange\\s+for\\b',
  '\\b(?:free|win|earn|get)\\b[^.!?]{0,40}\\b(?:review|reviews|reviewing)\\b',
  '\\b(?:review|reviews|reviewing)\\b[^.!?]{0,40}\\b(?:free|win|earn|entry|entered)\\b',
  '\\bif\\s+you\\s+(?:were|are|felt|feel)\\s+(?:happy|satisfied|pleased)\\b',
  '\\bif\\s+you\\s+(?:loved|liked|enjoyed)\\b',
  '\\b(?:5|five)[- ]stars?\\b',
  '\\bleave\\s+(?:us\\s+)?(?:a\\s+)?(?:positive|good|great|glowing)\\s+review\\b',
]);
const REVIEW_BANNED_RES = PRINT_REVIEW_BANNED_PATTERNS.map((p) => new RegExp(p, 'i'));

// The business's own name and address as printed (print-inputs.json): never
// read as a review incentive. "Thanks for choosing 5 Star Auto Spa" on a
// review piece is the shop's name, not a request for five stars, and a
// "Discount Tire & Wheel" would otherwise fail every run. The skill's
// printkit.own_names builds the same list.
export function printOwnNames(inputs) {
  const b = isObject(inputs?.business) ? inputs.business : {};
  const names = [oneLine(b.name, 120), oneLine(b.site, 200), printSiteLabel(inputs?.links?.site)];
  return names.filter((n, i) => n && names.indexOf(n) === i);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// [{ line, phrase }]: review incentives or gating in `lines` (every line of
// a review piece; elsewhere only lines that mention a review). `exempt`
// (printOwnNames) is taken out of a line before it is checked.
export function printReviewFlags(lines, reviewPiece = false, exempt = []) {
  const out = [];
  const own = (Array.isArray(exempt) ? exempt : []).filter((n) => typeof n === 'string' && n).map((n) => new RegExp(escapeRe(n), 'gi'));
  for (const line of Array.isArray(lines) ? lines : []) {
    if (typeof line !== 'string') continue;
    const check = own.reduce((s, re) => s.replace(re, ' '), line);
    if (!reviewPiece && !/\breview/i.test(check)) continue;
    for (const re of REVIEW_BANNED_RES) {
      const m = re.exec(check);
      if (m && !out.some((o) => o.line === line && o.phrase === m[0])) out.push({ line, phrase: m[0] });
    }
  }
  return out;
}

// What a printed claim may come from, as one text: print-inputs.json's
// facts and the business fields themselves (a name like "Best Choice
// Auto" is a fact). The skill's printkit.facts_text builds the same.
export function printFacts(inputs) {
  const b = isObject(inputs?.business) ? inputs.business : {};
  return [inputs?.facts, ...['name', 'type', 'person', 'phone', 'email', 'site', 'address', 'city', 'state', 'serviceArea'].map((k) => b[k])]
    .filter((v) => typeof v === 'string' && v).join('\n');
}

const norm = (s) => String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, '\'').replace(/\s+/g, ' ').trim();

// The claim-like phrases in `lines` that `facts` (the customer's answers
// and the site's facts, as text) doesn't contain: [{ line, phrase }].
export function printClaimFlags(lines, facts) {
  const known = norm(facts);
  const out = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    if (typeof line !== 'string') continue;
    for (const re of CLAIM_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const phrase = norm(m[0]);
        if (phrase && !known.includes(phrase) && !out.some((o) => o.line === line && o.phrase === phrase)) out.push({ line, phrase });
        if (m[0] === '') re.lastIndex += 1;
      }
    }
  }
  return out;
}

// ─── print.json ──────────────────────────────────────────────────────

const qrSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'kind', 'url', 'vcard', 'sizeIn'],
  properties: {
    label: { type: 'string', maxLength: PRINT_LIMITS.label, description: 'The words printed with the code' },
    kind: { type: 'string', enum: [...QR_KINDS] },
    url: { type: 'string', description: 'Exactly what the code opens, copied from print-inputs.json links; "" for a contact code' },
    vcard: { type: 'string', description: 'For a contact code exactly links.vcard from print-inputs.json; "" otherwise' },
    sizeIn: { type: 'number', minimum: QR_MIN_IN, maximum: QR_MAX_IN, description: 'Printed size without the quiet zone, inches' },
  },
};

// The JSON schema of print.json, for the request (build_print.py writes the
// file; the model only fixes it when validate_print.py says so).
export const PRINT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['version', 'pieces', 'omitted', 'fonts', 'colors', 'notes'],
  properties: {
    version: { const: PRINT_VERSION },
    pieces: {
      type: 'array',
      maxItems: PRINT_PIECES.length,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'name', 'size', 'bleed', 'pages', 'qr', 'text', 'note'],
        properties: {
          file: { type: 'string', enum: PRINT_PIECES.map((p) => p.file) },
          name: { type: 'string', maxLength: PRINT_LIMITS.name },
          size: { type: 'string', enum: [...new Set(PRINT_PIECES.map((p) => p.size))], description: 'Trim size' },
          bleed: { const: PRINT_BLEED },
          pages: { type: 'array', items: { type: 'string', enum: Object.keys(PAGE_LABELS) } },
          qr: { type: 'array', maxItems: PRINT_LIMITS.qr, items: qrSchema },
          text: { type: 'array', maxItems: PRINT_LIMITS.textLines, items: { type: 'string', maxLength: PRINT_LIMITS.text }, description: 'Every printed line' },
          note: { type: 'string', maxLength: PRINT_LIMITS.note, description: 'One line for the print shop or the admin' },
        },
      },
    },
    omitted: {
      type: 'array',
      maxItems: REVIEW_PIECE_FILES.length,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'reason'],
        properties: { file: { type: 'string', enum: [...REVIEW_PIECE_FILES] }, reason: { type: 'string', maxLength: PRINT_LIMITS.reason } },
      },
    },
    fonts: {
      type: 'object',
      additionalProperties: false,
      required: ['heading', 'body', 'fallback'],
      properties: { heading: { type: 'string' }, body: { type: 'string' }, fallback: { type: 'boolean' } },
    },
    colors: {
      type: 'object',
      additionalProperties: false,
      required: ['panel', 'ink', 'accent', 'cmykRisk'],
      properties: {
        panel: { type: 'string', pattern: '^#[0-9a-f]{6}$' },
        ink: { type: 'string', pattern: '^#[0-9a-f]{6}$' },
        accent: { type: 'string', pattern: '^#[0-9a-f]{6}$' },
        cmykRisk: { type: 'array', maxItems: PRINT_LIMITS.risk, items: { type: 'string', pattern: '^#[0-9a-f]{6}$' } },
      },
    },
    notes: { type: 'array', maxItems: PRINT_LIMITS.notes, items: { type: 'string', maxLength: PRINT_LIMITS.note } },
  },
});

// A print.json check that must fail the run (a code that points somewhere
// else, a review piece without a review link). Its message is the run's error.
export class PrintCheckError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PrintCheckError';
  }
}

const lineList = (raw, maxLines, max) => (Array.isArray(raw) ? raw : [])
  .map((v) => oneLine(v, max)).filter(Boolean).slice(0, maxLines);

function hexOf(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return HEX_RE.test(s) ? s : '';
}

// A link a code may hold when nothing says which links are this
// customer's (the result view): https, or a tel: link.
const plausibleUrl = (u) => /^https:\/\/[^\s"'<>]+$/i.test(u) || /^tel:\+?\d{3,15}$/.test(u);

// What `kind` must hold for this customer, from print-inputs.json links.
function expectedTarget(kind, links) {
  switch (kind) {
    case 'review': return { url: links.review || '' };
    case 'booking': return { url: links.booking || '' };
    case 'site': return { url: links.site || '' };
    case 'call': return { url: links.call || '' };
    case 'contact': return { vcard: links.vcard || '' };
    default: return null;
  }
}

function sanitizeQr(raw, file, links) {
  const out = [];
  for (const q of Array.isArray(raw) ? raw : []) {
    if (!isObject(q)) continue;
    const kind = QR_KINDS.includes(q.kind) ? q.kind : '';
    const label = oneLine(q.label, PRINT_LIMITS.label);
    const url = typeof q.url === 'string' ? q.url.trim() : '';
    // A vCard keeps its line breaks: they are part of what the code holds.
    const vcard = typeof q.vcard === 'string' ? q.vcard.trim() : '';
    const size = Number(q.sizeIn);
    if (links) {
      const where = `the "${label || kind || 'unnamed'}" code on ${file}`;
      if (!kind) throw new PrintCheckError(`print.json: ${where} has no known kind.`);
      const want = expectedTarget(kind, links);
      if (kind === 'contact') {
        if (!want.vcard || vcard !== want.vcard || url) throw new PrintCheckError(`print.json: ${where} doesn't hold this customer's contact card.`);
      } else if (!want.url || url !== want.url || vcard) {
        throw new PrintCheckError(`print.json: ${where} points to ${oneLine(url, 120) || 'nothing'}, which isn't this customer's ${QR_KIND_LABELS[kind].toLowerCase()} link.`);
      }
      if (!(size >= QR_MIN_IN)) throw new PrintCheckError(`print.json: ${where} is under ${QR_MIN_IN} in.`);
    } else {
      // The view: drop what can't be shown safely, never throw.
      if (!kind) continue;
      if (kind === 'contact' ? (!/^BEGIN:VCARD/i.test(vcard) || url) : !plausibleUrl(url)) continue;
    }
    out.push({
      label: label || QR_KIND_LABELS[kind],
      kind,
      url: kind === 'contact' ? '' : url.slice(0, PRINT_LIMITS.url),
      vcard: kind === 'contact' ? vcard.slice(0, PRINT_LIMITS.vcard) : '',
      sizeIn: Number.isFinite(size) ? Math.round(Math.min(Math.max(size, 0), QR_MAX_IN) * 100) / 100 : 0,
    });
    if (out.length >= PRINT_LIMITS.qr) break;
  }
  return out;
}

// print.json as stored, or null when it isn't one. With `inputs` (the
// print-inputs.json the server sent), it is the server's check: every code
// must hold exactly one of the links in inputs.links, a review piece needs
// a review link, and the pieces that are always made must be there; any of
// that failing throws PrintCheckError (the run fails, nothing goes to
// print). Without `inputs` (the result view), it only cleans the shape.
export function sanitizePrint(raw, { inputs = null } = {}) {
  if (!isObject(raw)) return null;
  const links = inputs ? (isObject(inputs.links) ? inputs.links : {}) : null;
  const own = inputs ? printOwnNames(inputs) : [];
  const pieces = [];
  for (const p of Array.isArray(raw.pieces) ? raw.pieces : []) {
    if (!isObject(p) || typeof p.file !== 'string' || !has(PIECE_BY_FILE, p.file)) continue;
    const spec = PIECE_BY_FILE[p.file];
    if (pieces.some((x) => x.file === spec.file)) continue;
    if (links && spec.review && !links.review) {
      throw new PrintCheckError(`print.json: ${spec.file} needs the Google review link, and this customer has none.`);
    }
    const qr = sanitizeQr(p.qr, spec.file, links);
    const text = lineList(p.text, PRINT_LIMITS.textLines, PRINT_LIMITS.text);
    if (links) {
      if (spec.review && !qr.some((q) => q.kind === 'review')) throw new PrintCheckError(`print.json: ${spec.file} has no review code.`);
      // With a contact card, the glovebox front holds it; without one (no
      // business name), its code opens the site or dials the phone.
      if (spec.file === 'glovebox-card.pdf' && (links.vcard ? !qr.some((q) => q.kind === 'contact') : !qr.length)) {
        throw new PrintCheckError(`print.json: ${spec.file} has no save-contact code.`);
      }
      const banned = printReviewFlags(text, spec.review, own);
      if (banned.length) {
        throw new PrintCheckError(`print.json: "${oneLine(banned[0].line, 120)}" on ${spec.file} goes against Google's review policy ("${banned[0].phrase}").`);
      }
    }
    pieces.push({
      file: spec.file,
      name: oneLine(p.name, PRINT_LIMITS.name) || spec.name,
      // Size, bleed and pages are the piece's own, whatever the file says
      // (the skill's validator checks the PDF has exactly these pages): the
      // view shows what the PDF was built for.
      size: spec.size,
      bleed: PRINT_BLEED,
      pages: [...spec.pages],
      qr,
      text,
      note: oneLine(p.note, PRINT_LIMITS.note),
    });
  }
  pieces.sort((a, b) => PRINT_PIECES.indexOf(PIECE_BY_FILE[a.file]) - PRINT_PIECES.indexOf(PIECE_BY_FILE[b.file]));
  if (links) {
    const missing = PRINT_PIECES.filter((s) => !s.review && !pieces.some((p) => p.file === s.file));
    if (missing.length) throw new PrintCheckError(`print.json doesn't describe ${missing.map((s) => s.file).join(' and ')}.`);
  }
  if (!pieces.length) return null;

  const omitted = [];
  for (const o of Array.isArray(raw.omitted) ? raw.omitted : []) {
    if (!isObject(o) || !REVIEW_PIECE_FILES.includes(o.file) || pieces.some((p) => p.file === o.file) || omitted.some((x) => x.file === o.file)) continue;
    omitted.push({ file: o.file, reason: oneLine(o.reason, PRINT_LIMITS.reason) || 'Left out' });
  }
  // A review piece that is neither made nor explained still gets a line.
  if (links && !links.review) {
    for (const file of REVIEW_PIECE_FILES) {
      if (!omitted.some((o) => o.file === file)) omitted.push({ file, reason: 'No Google profile is linked, so there is no review link.' });
    }
  }

  const fonts = isObject(raw.fonts) ? raw.fonts : {};
  const colors = isObject(raw.colors) ? raw.colors : {};
  return {
    version: PRINT_VERSION,
    pieces,
    omitted,
    fonts: {
      heading: oneLine(fonts.heading, PRINT_LIMITS.font),
      body: oneLine(fonts.body, PRINT_LIMITS.font),
      fallback: fonts.fallback === true,
    },
    colors: {
      panel: hexOf(colors.panel),
      ink: hexOf(colors.ink),
      accent: hexOf(colors.accent),
      cmykRisk: [...new Set((Array.isArray(colors.cmykRisk) ? colors.cmykRisk : []).map(hexOf).filter(Boolean))].slice(0, PRINT_LIMITS.risk),
    },
    notes: lineList(raw.notes, PRINT_LIMITS.notes, PRINT_LIMITS.note),
  };
}

// The registry entry of a piece (name, size, pages, review), or null.
export function printPieceSpec(file) {
  return typeof file === 'string' && has(PIECE_BY_FILE, file) ? PIECE_BY_FILE[file] : null;
}

// What a code's target reads as in the view: the link without "https://",
// "Call +1…", or "Contact card: <name>".
export function qrTargetLabel(q) {
  if (!isObject(q)) return '';
  if (q.kind === 'contact') {
    const fn = /(?:^|\n)FN:([^\r\n]*)/.exec(String(q.vcard || ''))?.[1] || '';
    return `Contact card${fn ? `: ${fn.replace(/\\([,;\\])/g, '$1')}` : ''}`;
  }
  if (/^tel:/i.test(q.url || '')) return `Call ${String(q.url).slice(4)}`;
  return printSiteLabel(q.url) || String(q.url || '');
}

// The order notes for a print shop, one line per piece (the view's "Copy"
// button).
export function printShopNotes(data) {
  return (Array.isArray(data?.pieces) ? data.pieces : [])
    .map((p) => `${p.name} (${p.file}): ${p.note || `${p.size}, ${p.bleed} bleed`}`)
    .join('\n');
}
