// The claims ledger of the Launch Kit (skill launch-claims-ledger, kit key
// "claims"): every factual claim in the site's copy and business facts and
// in the kit's Google profile, SEO, social and print texts, traced to what
// the customer actually told us. Pure: the server's spec
// (netlify/functions/_lib/kit/claims.js) sanitizes the skill's ledger.json
// with it, the admin's result view (components/admin/kit/ClaimsResult.jsx)
// filters and groups with it, and the skill's Python validator
// (scripts/validate_claims.py) mirrors its rules; claims.test.js writes the
// shared fixtures both sides are tested against.
//
// The stored shape (design.kit.claims.data):
//   { version: 1,
//     claims: [{ text, where, kind, path, source: { field, quote } | null,
//                status, suggestion, note? }],
//     counts: { sourced, unsourced, needsRewrite, total },
//     scope: [where values that were checked], dismissed: n }
//   text        the claim, copied from the checked text
//   where       where it appears: site | gbp (Google profile) | seo | social | print
//   kind        what sort of claim it is (CLAIM_KINDS)
//   path        where in that text ("aboutText", "words.gbp.posts[3].body")
//   source      the customer's answer (field = intake field id), the
//               confirmed business info ("businessInfo.<key>") or their
//               pasted reviews ("testimonials"), with a word-for-word quote
//   status      sourced | unsourced | needs-rewrite (a source exists but the
//               claim says more than it)
//   suggestion  the replacement text, or what to do ('' when sourced)
//   note        why the server changed what the skill said (only then)
import { FORM_FIELDS } from '../customSiteForm.js';

export const LEDGER_VERSION = 1;

// Display order too: what needs work first.
export const CLAIM_STATUSES = Object.freeze(['needs-rewrite', 'unsourced', 'sourced']);
export const CLAIM_WHERE = Object.freeze(['site', 'gbp', 'seo', 'social', 'print']);
export const CLAIM_KINDS = Object.freeze([
  'price', 'rating', 'review', 'years', 'number', 'award', 'certification', 'guarantee', 'warranty', 'brand', 'area',
  'superlative', 'availability', 'other',
]);
// The skill's validator enforces the same caps, so a ledger that passes it
// is stored as written.
export const CLAIM_LIMITS = Object.freeze({ claims: 200, text: 300, quote: 300, suggestion: 300, path: 120, note: 200 });

// The pasted reviews: they back a review shown as a review, nothing else.
export const REVIEW_FIELD = 'testimonials';
export const BUSINESS_INFO_PREFIX = 'businessInfo.';
// Intake answers a claim may be quoted from: what the customer wrote about
// their own business (designSuggest.js FACT_SOURCE_FIELDS, plus the name,
// hours and deadline). The personal contact fields never go into a run.
export const CLAIM_SOURCE_FIELDS = Object.freeze([
  'businessName', 'serviceArea', 'address', 'hours', 'services', 'about', 'whyUs', 'brandNotes', 'notes', 'deadline',
]);

export const CLAIM_STATUS_LABELS = Object.freeze({
  'needs-rewrite': 'Needs a rewrite',
  unsourced: 'No source',
  sourced: 'Sourced',
});
export const CLAIM_WHERE_LABELS = Object.freeze({
  site: 'Site',
  gbp: 'Google profile',
  seo: 'Search (SEO)',
  social: 'Social',
  print: 'Print',
});
export const CLAIM_KIND_LABELS = Object.freeze({
  price: 'Price or offer',
  rating: 'Rating',
  review: 'Review',
  years: 'Years',
  number: 'Number',
  award: 'Award',
  certification: 'Certification',
  guarantee: 'Guarantee',
  warranty: 'Warranty',
  brand: 'Brand',
  area: 'Service area',
  superlative: 'Best / #1 / only',
  availability: 'Availability',
  other: 'Other',
});

// business_info keys as the admin knows them (the Studio's facts and the site).
const INFO_LABELS = Object.freeze({
  businessName: 'Business name',
  tagline: 'Tagline',
  yearsInBusiness: 'Years in business',
  warranty: 'Warranty',
  awards: 'Awards',
  certifications: 'Certifications',
  insured: 'Insured',
  paymentMethods: 'Payment methods',
  serviceAreas: 'Service areas',
  serviceArea: 'Service area',
  services: 'Services and prices',
  packages: 'Packages',
  priceRange: 'Price range',
  specialties: 'Specialties',
  googlePlace: 'Google profile',
  city: 'City',
  state: 'State',
  address: 'Address',
  brands: 'Brands',
  filmBrands: 'Film brands',
  tireBrands: 'Tire brands',
});

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Model text on one line, capped (launchKit.js oneLine).
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// ─── Comparing text ───────────────────────────────────────────────────

// Text compared for quotes: case, spacing, typographic quotes and dashes
// don't count (the model may straighten a curly apostrophe). The same as
// designSuggest.js normalizeText, and scripts/claimlib.py normalize().
export function normalizeClaimText(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, '\'')
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const trimQuote = (q) => q.replace(/^["'\s.\u2026]+|["'\s.\u2026]+$/g, '');

// Is `quote` a word-for-word excerpt of `text` (case- and space-insensitive)?
// Wrapping quotation marks, ellipses and a final period are ignored; a quote
// shorter than 4 characters proves nothing and never matches.
export function quoteInText(quote, text) {
  const q = trimQuote(normalizeClaimText(quote));
  return q.length >= 4 && normalizeClaimText(text).includes(q);
}

const NUMBER_WORDS = Object.freeze({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
});
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const UNITS = 'one|two|three|four|five|six|seven|eight|nine';
const WORD_NUMBER_RE = new RegExp(`\\b(?:(${TENS})[ -](${UNITS})|(${Object.keys(NUMBER_WORDS).join('|')}))\\b`, 'g');
const DIGITS_RE = /\d+(?:,\d{3})*(?:\.\d+)?/g;

// "1,299.00" → "1299", "08" → "8", "4.90" → "4.9".
function canonicalNumber(s) {
  const [whole, frac = ''] = s.replace(/,/g, '').split('.');
  const int = whole.replace(/^0+(?=\d)/, '');
  const dec = frac.replace(/0+$/, '');
  return dec ? `${int}.${dec}` : int;
}

// The numbers a text states, digits or words ("five-year" and "5 year" are
// both "5"), as sorted unique strings. A claim's numbers must all be in its
// source quote: "10+ years" is not backed by "8 years".
export function claimNumbers(text) {
  const t = normalizeClaimText(text);
  const out = new Set();
  for (const m of t.matchAll(DIGITS_RE)) out.add(canonicalNumber(m[0]));
  for (const m of t.matchAll(WORD_NUMBER_RE)) {
    out.add(String(m[3] ? NUMBER_WORDS[m[3]] : NUMBER_WORDS[m[1]] + NUMBER_WORDS[m[2]]));
  }
  return [...out].sort();
}

// A checked text that is a review shown on the site: the text of one of the
// site's testimonials ("testimonialPlaceholders[1].text"). Its name, the
// section title and the Words kit's review replies are not reviews.
// scripts/claimlib.py REVIEW_PATH is the same pattern (parity.json).
const REVIEW_PATH_RE = /testimonial\w*\[\d+\](?:\.(?:text|quote|review|body))?$/i;

export function isReviewPath(path) {
  return typeof path === 'string' && REVIEW_PATH_RE.test(path);
}

// ─── Sources ──────────────────────────────────────────────────────────

// The canonical name of a source field, or '' when it isn't one:
// intake field ids as they are ("about"; "intake.about" is read as that),
// "testimonials" (also "reviews"), "businessInfo.<top-level key>"
// ("businessInfo.services[0].price" is read as "businessInfo.services").
export function sourceFieldOf(field) {
  const f = oneLine(field, 160).replace(/^intake\s*[.:]\s*/i, '');
  if (/^(testimonials|reviews?|pasted[ _-]?reviews?)$/i.test(f)) return REVIEW_FIELD;
  const info = /^business[ _]?info\s*[.:]\s*([A-Za-z][A-Za-z0-9_]{0,40})/i.exec(f);
  if (info) return `${BUSINESS_INFO_PREFIX}${info[1]}`;
  return /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(f) ? f : '';
}

// How the admin reads a source field: "Intake: Your story", "Business info:
// Years in business", "Pasted reviews".
export function sourceLabel(field) {
  const f = sourceFieldOf(field);
  if (!f) return 'Unknown source';
  if (f === REVIEW_FIELD) return 'Pasted reviews';
  if (f.startsWith(BUSINESS_INFO_PREFIX)) {
    const key = f.slice(BUSINESS_INFO_PREFIX.length);
    return `Business info: ${Object.prototype.hasOwnProperty.call(INFO_LABELS, key) ? INFO_LABELS[key] : key}`;
  }
  const form = FORM_FIELDS.find((x) => x.id === f);
  return `Intake: ${form ? form.label : f}`;
}

// ─── The ledger ───────────────────────────────────────────────────────

export function claimCounts(claims) {
  const list = Array.isArray(claims) ? claims : [];
  const n = (s) => list.filter((c) => c?.status === s).length;
  return { sourced: n('sourced'), unsourced: n('unsourced'), needsRewrite: n('needs-rewrite'), total: list.length };
}

const DEFAULT_SUGGESTION = Object.freeze({
  unsourced: 'Remove it, or get it confirmed by the customer in writing and add their answer to the project first.',
  rewrite: 'Reword it so it says only what the customer told us, or remove it.',
  review: 'Show it only as a review: the reviewer\'s own words, exactly, with their name.',
});

const cap = (s, max) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}\u2026` : s);

function cleanSource(raw) {
  if (!isObject(raw)) return null;
  const field = sourceFieldOf(raw.field);
  const quote = oneLine(raw.quote, CLAIM_LIMITS.quote);
  return field && quote ? { field, quote } : null;
}

// The field whose text holds `quote` (the named one first), or ''.
function fieldWithQuote(quote, field, byField) {
  if (byField.has(field) && quoteInText(quote, byField.get(field))) return field;
  for (const [f, text] of byField) if (quoteInText(quote, text)) return f;
  return '';
}

// What the run sent, for checking claims against it (null fields when the
// caller has no sources: the view re-reading stored data).
//   byField        Map(field → text) of the sources
//   reviews        the pasted reviews' text, '' without any
//   reviewsShown   the texts of the reviews shown on the site
//   sourceNumbers  every number the sources state
function checkContext(sources, checked) {
  if (!Array.isArray(sources)) return { byField: null, reviews: '', reviewsShown: [], sourceNumbers: null };
  const byField = new Map(sources
    .filter((s) => isObject(s) && sourceFieldOf(s.field) && typeof s.text === 'string')
    .map((s) => [sourceFieldOf(s.field), s.text]));
  const sourceNumbers = new Set();
  for (const text of byField.values()) for (const n of claimNumbers(text)) sourceNumbers.add(n);
  const reviewsShown = (Array.isArray(checked) ? checked : [])
    .filter((u) => isObject(u) && u.where === 'site' && isReviewPath(u.path) && typeof u.text === 'string')
    .map((u) => u.text);
  return { byField, reviews: byField.get(REVIEW_FIELD) || '', reviewsShown, sourceNumbers };
}

// Is a review on the page the customer's own, word for word? The claim's
// text must be in the pasted reviews, and so must every review on the site
// that holds it (an excerpt of a reworded review isn't the customer's).
function reviewIsVerbatim(text, check) {
  if (!quoteInText(text, check.reviews)) return false;
  const t = normalizeClaimText(text);
  return check.reviewsShown.every((u) => !normalizeClaimText(u).includes(t) || quoteInText(u, check.reviews));
}

// One claim from the skill's JSON, or null. With the sources the run sent
// (check.byField), a quote must be in the customer's answers, the business
// info or the reviews, word for word: the skill can't make a claim sourced
// by citing something that isn't there. The same rules as the skill's
// validator (scripts/validate_claims.py), so a ledger that passed it is
// stored as written.
function cleanClaim(c, check) {
  const { byField } = check;
  if (!isObject(c)) return null;
  const text = oneLine(c.text, CLAIM_LIMITS.text);
  if (!text) return null;
  const where = CLAIM_WHERE.includes(c.where) ? c.where : 'site';
  const kind = CLAIM_KINDS.includes(c.kind) ? c.kind : 'other';
  const path = oneLine(c.path, CLAIM_LIMITS.path);
  let status = CLAIM_STATUSES.includes(c.status) ? c.status : 'unsourced';
  let source = status === 'unsourced' ? null : cleanSource(c.source);
  let suggestion = oneLine(c.suggestion, CLAIM_LIMITS.suggestion);
  const notes = [];

  if (source && byField) {
    const found = fieldWithQuote(source.quote, source.field, byField);
    if (!found) {
      source = null;
      if (status === 'sourced') {
        status = 'unsourced';
        notes.push('The quoted source isn\'t in the customer\'s answers, the business info or the reviews.');
      }
    } else {
      source = { ...source, field: found };
    }
  }
  if (status === 'sourced') {
    if (!source) {
      status = 'unsourced';
      if (!notes.length) notes.push('It was marked sourced without a source.');
    } else if (kind === 'review' && source.field !== REVIEW_FIELD) {
      status = 'unsourced';
      notes.push('A review on the page has to be one of the customer\'s pasted reviews, word for word.');
    } else if (kind !== 'review' && source.field === REVIEW_FIELD) {
      status = 'needs-rewrite';
      notes.push('A pasted review backs a review shown as a review, not the business\'s own claim.');
      if (!suggestion) suggestion = DEFAULT_SUGGESTION.review;
    } else if (kind === 'review' && byField && !reviewIsVerbatim(text, check)) {
      status = 'needs-rewrite';
      notes.push('The review on the page isn\'t word for word one of the pasted reviews.');
      if (!suggestion) suggestion = cap(`Use the customer's own wording exactly: "${source.quote}"`, CLAIM_LIMITS.suggestion);
    } else {
      const have = new Set(claimNumbers(source.quote));
      const missing = claimNumbers(text).filter((n) => !have.has(n));
      if (missing.length) {
        status = 'needs-rewrite';
        notes.push(`The source doesn't say ${missing.join(', ')}.`);
      }
    }
  }
  // Unsourced means nothing backs it: no source to show.
  if (status === 'unsourced') source = null;
  if (status === 'sourced') {
    suggestion = '';
  } else if (suggestion && check.sourceNumbers) {
    // A rewrite may repeat the claim's own numbers ('Remove "500+ cars"')
    // or the sources' ones, never bring in a new one.
    const own = new Set(claimNumbers(text));
    const added = claimNumbers(suggestion).filter((n) => !check.sourceNumbers.has(n) && !own.has(n));
    if (added.length) {
      notes.push(`The suggested rewrite said ${added.join(', ')}, which no source states.`);
      suggestion = '';
    }
  }
  if (status !== 'sourced' && !suggestion) {
    suggestion = status === 'unsourced'
      ? DEFAULT_SUGGESTION.unsourced
      : (source ? cap(`Say only what the source says: "${source.quote}"`, CLAIM_LIMITS.suggestion) : DEFAULT_SUGGESTION.rewrite);
  }
  // A note the server wrote on an earlier pass stays when the stored data
  // is read again (the view: no sources); a new one replaces it. The
  // skill's own ledger.json (checked against the run's sources) has no
  // `note`: one it wrote would read as the server's.
  const note = notes.length
    ? oneLine(notes.join(' '), CLAIM_LIMITS.note)
    : (byField ? '' : oneLine(c.note, CLAIM_LIMITS.note));
  return { text, where, kind, path, source, status, suggestion, ...(note ? { note } : {}) };
}

// The ledger as stored, from the skill's ledger.json (untrusted), or null
// when it isn't a ledger. `sources` ([{ field, text }], the texts the run
// sent) checks every quote, review and suggested number; `checked` (the
// run's texts, [{ where, path, text }]) says which reviews the site shows;
// `scope` (where values) says what was checked. Counts are always
// recomputed; a repeated claim (same place, path and text) is kept once.
// The same claim in another text (two posts) stays: the admin fixes each.
export function sanitizeLedger(raw, { sources = null, checked = null, scope = null } = {}) {
  if (!isObject(raw) || !Array.isArray(raw.claims)) return null;
  const check = checkContext(sources, checked);
  const claims = [];
  const seen = new Set();
  for (const c of raw.claims) {
    const claim = cleanClaim(c, check);
    if (!claim) continue;
    const key = `${claim.where}|${normalizeClaimText(claim.path)}|${normalizeClaimText(claim.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push(claim);
    if (claims.length >= CLAIM_LIMITS.claims) break;
  }
  const scoped = (Array.isArray(scope) ? scope : Array.isArray(raw.scope) ? raw.scope : []).filter((w) => CLAIM_WHERE.includes(w));
  const dismissed = Array.isArray(raw.dismissed) ? raw.dismissed.length : Number.isInteger(raw.dismissed) && raw.dismissed > 0 ? raw.dismissed : 0;
  return {
    version: LEDGER_VERSION,
    claims,
    counts: claimCounts(claims),
    scope: CLAIM_WHERE.filter((w) => scoped.includes(w)),
    dismissed,
  };
}

// ─── The admin's view ─────────────────────────────────────────────────

// The claims a filter shows: status and where ('all' or '' for any) and a
// search over the claim, its source and its suggestion.
export function filterClaims(claims, { status = 'all', where = 'all', query = '' } = {}) {
  const q = normalizeClaimText(query);
  return (Array.isArray(claims) ? claims : []).filter((c) => (
    (!status || status === 'all' || c.status === status)
    && (!where || where === 'all' || c.where === where)
    && (!q || normalizeClaimText([c.text, c.path, c.source?.quote, c.suggestion, CLAIM_KIND_LABELS[c.kind]].join(' ')).includes(q))
  ));
}

// Claims grouped by status in CLAIM_STATUSES order, empty groups left out:
// [{ status, label, claims }].
export function groupClaims(claims) {
  const list = Array.isArray(claims) ? claims : [];
  return CLAIM_STATUSES
    .map((status) => ({ status, label: CLAIM_STATUS_LABELS[status], claims: list.filter((c) => c.status === status) }))
    .filter((g) => g.claims.length);
}

// One line for the admin (and the handover's sign-off summary):
// "2 need a rewrite, 1 has no source, 14 sourced".
export function ledgerSummary(data) {
  const c = isObject(data?.counts) ? data.counts : claimCounts(data?.claims);
  const n = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
  const total = n(c.total) || n(c.sourced) + n(c.unsourced) + n(c.needsRewrite);
  if (!total) return 'No claims found to check.';
  const parts = [];
  if (n(c.needsRewrite)) parts.push(`${c.needsRewrite} ${c.needsRewrite === 1 ? 'needs' : 'need'} a rewrite`);
  if (n(c.unsourced)) parts.push(`${c.unsourced} ${c.unsourced === 1 ? 'has' : 'have'} no source`);
  if (n(c.sourced)) parts.push(`${c.sourced} sourced`);
  return parts.join(', ');
}

// How many claims still need the admin (unsourced or needing a rewrite).
export function openClaims(data) {
  const c = isObject(data?.counts) ? data.counts : claimCounts(data?.claims);
  return (Number(c.unsourced) || 0) + (Number(c.needsRewrite) || 0);
}

// ─── Sign-off ─────────────────────────────────────────────────────────

const isoOrEmpty = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : '');

// The admin's sign-off of one ledger, from untrusted input (the browser, or
// a stored record): { at, by, open, startedAt } or null when not signed off.
//   at         when (ISO, '' when unknown)
//   by         who, as the server recorded it ('' when unknown)
//   open       how many claims were still open then (null when unknown)
//   startedAt  the run it signs off (a rebuild is a new ledger to check)
// `true` reads as signed off with nothing else known.
export function sanitizeClaimsSignOff(raw) {
  if (raw === true) return { at: '', by: '', open: null, startedAt: '' };
  if (!isObject(raw) || raw.signedOff === false) return null;
  return {
    at: isoOrEmpty(raw.at),
    by: oneLine(raw.by, 120),
    open: Number.isInteger(raw.open) && raw.open >= 0 ? raw.open : null,
    startedAt: isoOrEmpty(raw.startedAt),
  };
}

// One line for the handover: "Signed off 2026-10-05 by Sam; 2 claims were
// still open." or "Not signed off: 2 need a rewrite, 14 sourced". A sign-off
// of another run (an older ledger) doesn't count.
export function claimsSignOffLine(data, signOff, { startedAt = '' } = {}) {
  const s = sanitizeClaimsSignOff(signOff);
  const current = s && (!s.startedAt || !isoOrEmpty(startedAt) || s.startedAt === isoOrEmpty(startedAt));
  if (!current) return `Not signed off: ${ledgerSummary(data)}`;
  const when = s.at ? ` ${s.at.slice(0, 10)}` : '';
  const who = s.by ? ` by ${s.by}` : '';
  const open = s.open === null ? '' : s.open === 0 ? '; every claim was fixed or sourced.' : `; ${s.open} claim${s.open === 1 ? ' was' : 's were'} still open.`;
  return `Signed off${when}${who}${open || '.'}`;
}
