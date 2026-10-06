// The "Words" Launch Kit deliverable (the launch-words skill): one copy
// deck the owner or the customer pastes into their Google Business Profile,
// the site's search listing, review requests and social profiles. The skill
// writes words.json (and words.pdf, the same deck to print); the server
// (netlify/functions/_lib/kit/words.js) passes words.json through
// sanitizeWords below and stores the result as design.kit.words.data, which
// the admin view (src/components/admin/kit/WordsResult.jsx) shows and later
// kit runs (claims, print, social, handover) read.
//
// data:
//   gbp      { description (<= 750), services: [{ name, description }] (the
//            site's service names), categories: [{ name, confirm: true }]
//            (first = suggested primary; always to confirm in GBP), posts:
//            [{ title, body (<= 1500), cta: 'BOOK' | 'CALL' | 'LEARN_MORE',
//            link (the button's link, set here from the run's links, never
//            by the model), imageHint, photo: { path, name } | null (one of
//            the customer's photo uploads) }] (12) }
//   seo      { title (<= 60), description (<= 160), keywords: [string] }
//   reviews  { requestSms (<= 300), requestEmail: { subject, body },
//            replies: [{ rating 1-5, text }] (one per rating, 5 first),
//            link (Google's write-a-review link, '' without a Google place:
//            then the requests carry REVIEW_LINK_PLACEHOLDER) }
//   social   { bio (<= 150), captions: [string] (3) }
//   adjustments  [string]: what this sanitizer changed, and what it found
//            for the admin to check (an unsourced claim, a review incentive)
//
// The limits and the claim words mirror the skill's own data files
// (skills/api/launch-words/data/limits.json and claim_terms.json, which its
// validate_words.py enforces before delivery); words.test.js keeps them
// equal. Lengths count like String.length (an emoji counts 2).
//
// Pure module with no imports: the browser, the functions and the tests all
// load it. Regular expressions with lookbehind are built on first use, so
// merely loading the module (the admin view does) works in any browser.

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function deepFreeze(v) {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) deepFreeze(v[k]);
    Object.freeze(v);
  }
  return v;
}

// ─── The contract ────────────────────────────────────────────────────

// = skills/api/launch-words/data/limits.json (without its _doc).
export const WORDS_LIMITS = deepFreeze({
  gbp: {
    description: { min: 250, max: 750 },
    services: { max: 30, name: 120, description: 300 },
    categories: { min: 1, max: 10, name: 100 },
    posts: { count: 12, title: 58, bodyMin: 150, body: 1500, imageHint: 200 },
  },
  seo: {
    title: { min: 20, max: 60 },
    description: { min: 110, max: 160 },
    keywords: { min: 4, max: 12, each: 60 },
  },
  reviews: { requestSms: 300, subject: 80, emailBody: 1500, replies: 5, reply: 1000 },
  social: { bio: 150, captions: 3, caption: 2200, hashtags: 30 },
  notes: { max: 8, each: 300 },
  ctas: ['BOOK', 'CALL', 'LEARN_MORE'],
  placeholders: { name: '[name]', reviewLink: '[review link]' },
});

export const WORDS_CTAS = WORDS_LIMITS.ctas;
export const WORDS_CTA_LABELS = Object.freeze({ BOOK: 'Book', CALL: 'Call now', LEARN_MORE: 'Learn more' });
export const NAME_PLACEHOLDER = WORDS_LIMITS.placeholders.name;
export const REVIEW_LINK_PLACEHOLDER = WORDS_LIMITS.placeholders.reviewLink;
export const WORDS_ADJUSTMENTS_MAX = 20;

// = skills/api/launch-words/data/claim_terms.json (without its _doc): see
// there for how they match.
export const CLAIM_TERMS = deepFreeze({
  neutral: ['feel free', 'worry free', 'hassle free', 'stress free', 'spot free', 'swirl free', 'scratch free', 'streak free', 'lint free', 'residue free', 'license plate', 'license plates'],
  hard: [
    ['#1', 'no. 1', 'number one', 'number 1'],
    ['top-rated', 'top rated', 'highest-rated', 'highest rated', 'best-rated', 'best rated'],
    ['5-star', '5 star', 'five-star', 'five star', '5-stars', '5 stars', 'five stars'],
    ['award', 'awards', 'award-winning', 'award winning'],
    ['voted'],
    ['certified', 'certification', 'certifications', 'accredited'],
    ['licensed', 'license'],
    ['insured', 'insurance'],
    ['bonded'],
    ['guarantee', 'guarantees', 'guaranteed'],
    ['warranty', 'warranties', 'warrantied'],
    ['lifetime'],
    ['family-owned', 'family owned', 'family-run', 'family run'],
    ['veteran-owned', 'veteran owned'],
    ['woman-owned', 'woman owned', 'women-owned', 'women owned'],
    ['locally owned', 'locally-owned'],
    ['trusted by'],
    ['same-day', 'same day'],
    ['24/7', '24-7', 'around the clock'],
    ['open now'],
    ['fastest'],
    ['cheapest', 'lowest price', 'lowest prices', 'best price', 'best prices'],
    ['eco-friendly', 'eco friendly', 'environmentally friendly', 'biodegradable', 'non-toxic', 'non toxic'],
    ['free'],
    ['financing'],
  ],
  soft: [
    ['best'],
    ['expert', 'experts', 'expertise'],
    ['experienced', 'years of experience'],
    ['premium'],
    ['professional-grade', 'pro-grade'],
    ['satisfaction'],
    ['we come to you', 'come to you', 'mobile'],
    ['affordable'],
    ['leading'],
  ],
  numbers: {
    money: '\\$\\s?\\d[\\d,]*(?:\\.\\d{1,2})?',
    percent: '\\d+(?:\\.\\d+)?\\s?(?:%|percent\\b)',
    count: '\\b(\\d[\\d,]*)\\+?\\s*(?:years?|yrs?|cars?|vehicles?|customers?|clients?|reviews?|jobs?|details?|trucks?|boats?|happy|satisfied|locations?|employees?|technicians?)\\b',
    since: '\\b(?:since|established|est\\.?|founded|serving\\s+\\S+(?:\\s+\\S+)?\\s+since)\\s+((?:19|20)\\d\\d)\\b',
    rating: '\\b([1-5](?:\\.\\d)?)\\s*(?:-\\s*)?(?:stars?\\b|★)|\\brated\\s+([1-5](?:\\.\\d)?)\\b',
  },
  incentives: [
    '\\bdiscounts?\\b',
    '\\bcoupons?\\b',
    '\\bpromo(?:tion(?:al)?)?\\s+codes?\\b',
    '\\bgift\\s*cards?\\b',
    '\\bgifts?\\b',
    '\\bgiveaways?\\b',
    '\\braffles?\\b',
    '\\bprizes?\\b',
    '\\brewards?\\b',
    '(?<![a-z0-9-])free(?![a-z0-9-])',
    '\\b\\d+\\s*%\\s*off\\b',
    '\\$\\s*\\d+\\s*off\\b',
    '\\b(?:chance|entry|entered|enter)\\s+to\\s+win\\b',
    '\\bin\\s+exchange\\b',
    '\\bstore\\s+credit\\b',
    '\\bcash\\b',
  ],
  gating: [
    '\\b(?:5|five)[- ]?stars?\\b',
    '\\bif\\s+you\\s+(?:were|are|felt|feel)\\s+(?:happy|satisfied|pleased)\\b',
    '\\bif\\s+you\\s+(?:loved|liked|enjoyed)\\b',
    '\\bonly\\s+if\\b',
    '\\b(?:positive|good|great|glowing)\\s+reviews?\\b',
    '\\bbefore\\s+(?:leaving|writing|posting)\\s+(?:a|your)\\s+review\\b',
  ],
  phone: '(?:\\+?1[\\s.-]?)?(?:\\(\\d{3}\\)|\\b\\d{3})[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b',
  url: '(?:https?://|www\\.)[^\\s)\\]]+|\\b[a-z0-9][a-z0-9-]*\\.(?:com|net|org|co|us|biz|info|io|app|site|shop|auto|cars)\\b(?:/[^\\s)\\]]*)?',
  onlineBooking: '\\b(?:book(?:ing)?\\s+(?:a\\s+time\\s+|a\\s+detail\\s+|one\\s+|it\\s+)?online|online\\s+booking|book\\s+on\\s+(?:our|the)\\s+(?:web)?site)\\b',
});

// The JSON schema words.json must match (sent with the request). The
// skill's validate_words.py checks the rest: lengths, the site's service
// names, links, facts.
const str = (maxLength) => ({ type: 'string', maxLength });
export const WORDS_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  required: ['gbp', 'seo', 'reviews', 'social', 'notes'],
  properties: {
    gbp: {
      type: 'object',
      additionalProperties: false,
      required: ['description', 'services', 'categories', 'posts'],
      properties: {
        description: str(WORDS_LIMITS.gbp.description.max),
        services: {
          type: 'array',
          maxItems: WORDS_LIMITS.gbp.services.max,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'description'],
            properties: { name: str(WORDS_LIMITS.gbp.services.name), description: str(WORDS_LIMITS.gbp.services.description) },
          },
        },
        categories: {
          type: 'array',
          minItems: WORDS_LIMITS.gbp.categories.min,
          maxItems: WORDS_LIMITS.gbp.categories.max,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'confirm'],
            properties: { name: str(WORDS_LIMITS.gbp.categories.name), confirm: { const: true } },
          },
        },
        posts: {
          type: 'array',
          minItems: WORDS_LIMITS.gbp.posts.count,
          maxItems: WORDS_LIMITS.gbp.posts.count,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'body', 'cta', 'imageHint', 'photo'],
            properties: {
              title: str(WORDS_LIMITS.gbp.posts.title),
              body: str(WORDS_LIMITS.gbp.posts.body),
              cta: { enum: [...WORDS_LIMITS.ctas] },
              imageHint: str(WORDS_LIMITS.gbp.posts.imageHint),
              photo: { type: ['string', 'null'], description: 'The photo ref from the request ("photo-3"), or null' },
            },
          },
        },
      },
    },
    seo: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'description', 'keywords'],
      properties: {
        title: str(WORDS_LIMITS.seo.title.max),
        description: str(WORDS_LIMITS.seo.description.max),
        keywords: { type: 'array', minItems: 1, maxItems: WORDS_LIMITS.seo.keywords.max, items: str(WORDS_LIMITS.seo.keywords.each) },
      },
    },
    reviews: {
      type: 'object',
      additionalProperties: false,
      required: ['requestSms', 'requestEmail', 'replies'],
      properties: {
        requestSms: str(WORDS_LIMITS.reviews.requestSms),
        requestEmail: {
          type: 'object',
          additionalProperties: false,
          required: ['subject', 'body'],
          properties: { subject: str(WORDS_LIMITS.reviews.subject), body: str(WORDS_LIMITS.reviews.emailBody) },
        },
        replies: {
          type: 'array',
          minItems: WORDS_LIMITS.reviews.replies,
          maxItems: WORDS_LIMITS.reviews.replies,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['rating', 'text'],
            properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, text: str(WORDS_LIMITS.reviews.reply) },
          },
        },
      },
    },
    social: {
      type: 'object',
      additionalProperties: false,
      required: ['bio', 'captions'],
      properties: {
        bio: str(WORDS_LIMITS.social.bio),
        captions: { type: 'array', minItems: WORDS_LIMITS.social.captions, maxItems: WORDS_LIMITS.social.captions, items: str(WORDS_LIMITS.social.caption) },
      },
    },
    notes: { type: 'array', maxItems: WORDS_LIMITS.notes.max, items: str(WORDS_LIMITS.notes.each) },
  },
});

// ─── Text ─────────────────────────────────────────────────────────────

// One line: control characters and whitespace runs become one space.
export function oneLine(v) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

// A block of text that keeps its line breaks: \r\n made \n, no other
// control characters, no spaces at line ends, at most one blank line in a
// row (the same form the skill's clean_block() checks for).
export function cleanBlock(v) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, ' ')
    .split('\n').map((line) => line.replace(/[ \u00a0]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// `text` cut to `max` where a sentence ends (when that keeps at least half),
// else at a word with an ellipsis. Paste-ready text is never cut mid-word.
export function fitText(text, max) {
  if (text.length <= max) return { text, cut: false };
  const head = text.slice(0, max + 1);
  const ends = [...head.matchAll(/[.!?](?=\s|$)/g)].map((m) => m.index + 1).filter((i) => i <= max);
  const end = ends.length ? ends[ends.length - 1] : 0;
  if (end >= max / 2) return { text: text.slice(0, end).trim(), cut: true };
  const room = text.slice(0, max);
  const space = room.lastIndexOf(' ');
  // A cut inside an emoji would leave half of it (a lone surrogate).
  const base = (space > max / 2 ? room.slice(0, space) : room.slice(0, max - 1))
    .replace(/[\uD800-\uDBFF]$/, '')
    .replace(/[\s,;:-]+$/, '');
  return { text: `${base}…`, cut: true };
}

const QUOTES = { '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'", '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"' };
const HYPHENS = { '‐': '-', '‑': '-', '‒': '-', '⁃': '-', '−': '-' };

// Lowercase, straight quotes, ASCII hyphens, one space between words: the
// form claims are matched in (skill: words_lib.norm).
export function normText(v) {
  return String(v ?? '').toLowerCase()
    .replace(/[‘’‚‛′“”„‟″]/g, (c) => QUOTES[c])
    .replace(/[‐‑‒⁃−]/g, (c) => HYPHENS[c])
    .replace(/\s+/g, ' ')
    .trim();
}

// A service or category name for matching: letters and digits only, '&'
// read as 'and' (skill: words_lib.name_key).
export function nameKey(v) {
  return normText(v).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

// ─── Checks ──────────────────────────────────────────────────────────

let compiled = null;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const termRe = (t) => new RegExp(`(?<![a-z0-9-])${escapeRe(normText(t))}(?![a-z0-9-])`);

function rx() {
  if (!compiled) {
    compiled = {
      neutral: CLAIM_TERMS.neutral.map((p) => new RegExp(`(?<![a-z0-9-])${escapeRe(normText(p))}(?![a-z0-9-])`, 'g')),
      hard: CLAIM_TERMS.hard.map((g) => g.map((t) => [t, termRe(t)])),
      soft: CLAIM_TERMS.soft.map((g) => g.map((t) => [t, termRe(t)])),
      num: Object.fromEntries(Object.entries(CLAIM_TERMS.numbers).map(([k, v]) => [k, new RegExp(v, 'gi')])),
      incentives: CLAIM_TERMS.incentives.map((p) => new RegExp(p, 'i')),
      gating: CLAIM_TERMS.gating.map((p) => new RegExp(p, 'i')),
      phone: new RegExp(CLAIM_TERMS.phone, 'gi'),
      url: new RegExp(CLAIM_TERMS.url, 'gi'),
      onlineBooking: new RegExp(CLAIM_TERMS.onlineBooking, 'i'),
    };
  }
  return compiled;
}

// The form the checks read: normText with the neutral phrases ("feel
// free") blanked, so a figure of speech never counts as a claim.
function checkText(v) {
  let s = normText(v);
  for (const re of rx().neutral) s = s.replace(re, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const numOf = (v) => {
  let s = String(v).replace(/,/g, '');
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
};
const numbersIn = (text) => new Set([...String(text || '').matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => numOf(m[0])));
const digitsOf = (s) => numOf(String(s).replace(/[^\d.,]/g, ''));

// Text without links and phone numbers (their digits are no claims).
function stripLinks(text) {
  const r = rx();
  return String(text || '').replace(r.url, ' ').replace(r.phone, ' ');
}

// What copy may rest on, in the matching form: primary (the customer's
// answers and the site's business facts), reviews (the pasted reviews:
// claims from them only as word-for-word quotes) and site (the written
// site's copy: a claim only it makes is soft, the claims ledger checks it).
export function wordsSources({ primary = '', reviews = '', site = '' } = {}) {
  const p = checkText(primary);
  const r = checkText(reviews);
  return {
    primary: p,
    reviews: r,
    site: checkText(site),
    numbers: new Set([...numbersIn(p), ...numbersIn(r)]),
    percents: new Set([...`${p} ${r}`.matchAll(rx().num.percent)].map((m) => digitsOf(m[0]))),
  };
}

function inReviewQuote(raw, re, sources) {
  for (const m of checkText(raw).matchAll(/"([^"]{3,})"/g)) {
    const span = m[1].replace(/^[ .,!?]+|[ .,!?]+$/g, '');
    if (span && re.test(m[1]) && sources.reviews.includes(span)) return true;
  }
  return false;
}

// Claims in `text` its sources don't back: [{ level: 'hard' | 'soft',
// claim }] (skill: words_lib.claim_findings; the skill's check is the gate,
// this is the server's second look for the admin).
export function unsourcedClaims(text, sources) {
  if (!text || !sources) return [];
  const r = rx();
  const raw = stripLinks(text);
  const t = checkText(raw);
  const out = [];
  const push = (level, claim) => {
    if (!out.some((o) => o.claim === claim)) out.push({ level, claim });
  };
  for (const level of ['hard', 'soft']) {
    for (const group of r[level]) {
      const used = group.find(([, re]) => re.test(t));
      if (!used) continue;
      if (group.some(([, re]) => re.test(sources.primary))) continue;
      if (group.some(([, re]) => re.test(sources.reviews))) {
        if (level === 'hard' && !inReviewQuote(raw, used[1], sources)) push('hard', used[0]);
        continue;
      }
      if (group.some(([, re]) => re.test(sources.site))) {
        push('soft', used[0]);
        continue;
      }
      push(level, used[0]);
    }
  }
  const scan = (key, test) => {
    for (const m of t.matchAll(r.num[key])) if (!test(m)) push('hard', m[0].trim());
  };
  scan('money', (m) => sources.numbers.has(digitsOf(m[0])));
  scan('percent', (m) => sources.percents.has(digitsOf(m[0])));
  scan('count', (m) => sources.numbers.has(numOf(m[1])));
  scan('since', (m) => sources.numbers.has(m[1]));
  scan('rating', (m) => sources.numbers.has(numOf(m[1] || m[2])));
  return out;
}

const firstHits = (list, text) => {
  const t = checkText(text);
  return list.map((re) => re.exec(t)?.[0]).filter(Boolean);
};

// Offers in return for a review (Google forbids them): the words found.
export function incentiveHits(text) {
  return firstHits(rx().incentives, text);
}

// Asking for a particular kind of review (Google forbids selective asks).
export function gatingHits(text) {
  return firstHits(rx().gating, text);
}

export function phoneHits(text) {
  const r = rx();
  return [...String(text || '').replace(r.url, ' ').matchAll(r.phone)].map((m) => m[0].trim());
}

export function urlHits(text) {
  return [...String(text || '').matchAll(rx().url)].map((m) => m[0]);
}

// Prices in the text ("$220").
export function moneyHits(text) {
  return [...stripLinks(text).matchAll(rx().num.money)].map((m) => m[0].trim().replace(/,+$/, ''));
}

// Copy that says customers can book online.
export function saysBookOnline(text) {
  return rx().onlineBooking.test(String(text || ''));
}

export function placeholdersIn(text) {
  return [...String(text || '').matchAll(/\[[^[\]\n]{1,40}\]/g)].map((m) => m[0]);
}

// ─── The sanitizer ───────────────────────────────────────────────────

const short = (s, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// A text field: cleaned (one line or a block), cut to `max` with a note.
function field(v, max, where, adj, { block = false } = {}) {
  const clean = block ? cleanBlock(v) : oneLine(v);
  if (!clean) return '';
  const { text, cut } = fitText(clean, max);
  if (cut) adj.push(`Shortened ${where} to ${max} characters.`);
  return text;
}

// Flags for one piece of copy: claims, placeholders, phones, links.
function flag(text, where, ctx, adj, { allowed = [], phones = 'own', links = 'own' } = {}) {
  if (!text) return;
  if (ctx.sources) {
    const hard = unsourcedClaims(text, ctx.sources).filter((c) => c.level === 'hard').map((c) => `"${c.claim}"`);
    if (hard.length) adj.push(`Check ${where}: ${hard.slice(0, 3).join(', ')} isn't in the customer's answers.`);
  }
  const ph = placeholdersIn(text).filter((p) => !allowed.includes(p));
  if (ph.length) adj.push(`Check ${where}: fill in ${[...new Set(ph)].slice(0, 2).join(', ')} before use.`);
  const phonesFound = phoneHits(text);
  if (phones === 'none' && phonesFound.length) adj.push(`Check ${where}: Google rejects posts with a phone number in the text (${phonesFound[0]}).`);
  else if (phones === 'own' && phonesFound.some((p) => p.replace(/\D/g, '').slice(-10) !== ctx.phoneDigits)) {
    adj.push(`Check ${where}: a phone number that isn't the business phone.`);
  }
  const foreign = urlHits(text).filter((u) => links === 'none' || !ctx.hosts.has(hostOf(u)));
  if (foreign.length) adj.push(`Check ${where}: ${links === 'none' ? 'leave the link out' : 'a link that isn\'t the business\'s'} (${short(foreign[0])}).`);
  if (!ctx.urls.booking && saysBookOnline(text)) adj.push(`Check ${where}: it says to book online, but the site takes no online bookings.`);
}

export function hostOf(u) {
  const s = String(u || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0];
  return s.startsWith('www.') ? s.slice(4) : s;
}

function sanitizeGbp(raw, ctx, adj) {
  const g = isObject(raw) ? raw : {};
  const L = WORDS_LIMITS.gbp;
  const description = field(g.description, L.description.max, 'the GBP description', adj, { block: true });
  flag(description, 'the GBP description', ctx, adj, { links: 'none' });
  const prices = moneyHits(description);
  if (prices.length) adj.push(`Check the GBP description: Google keeps prices out of it (${prices[0]}).`);

  // Services: the site's names, in the site's order, whatever the model
  // wrote; one the site doesn't have is dropped, one it missed comes back
  // without a description.
  const written = (Array.isArray(g.services) ? g.services : []).filter(isObject).map((s) => ({
    name: field(s.name, L.services.name, 'a GBP service name', adj),
    description: field(s.description, L.services.description, 'a GBP service description', adj, { block: true }),
  })).filter((s) => s.name);
  let services;
  if (ctx.services.length) {
    const byKey = new Map();
    for (const s of written) if (!byKey.has(nameKey(s.name))) byKey.set(nameKey(s.name), s);
    const siteKeys = new Set(ctx.services.map(nameKey));
    const extra = written.filter((s) => !siteKeys.has(nameKey(s.name)));
    if (extra.length) adj.push(`Left out GBP services the site doesn't list: ${extra.slice(0, 3).map((s) => `"${short(s.name)}"`).join(', ')}.`);
    services = ctx.services.slice(0, L.services.max).map((name) => {
      const hit = byKey.get(nameKey(name));
      if (!hit) adj.push(`Added the site's service "${short(name)}" to the GBP services, without a description.`);
      return { name: fitText(oneLine(name), L.services.name).text, description: hit?.description || '' };
    });
  } else {
    const seen = new Set();
    services = written.filter((s) => !seen.has(nameKey(s.name)) && seen.add(nameKey(s.name))).slice(0, L.services.max);
  }
  services.forEach((s, i) => flag(s.description, `GBP service ${i + 1}`, ctx, adj, { links: 'none' }));

  const seenCats = new Set();
  const categories = (Array.isArray(g.categories) ? g.categories : [])
    .map((c) => field(isObject(c) ? c.name : c, L.categories.name, 'a GBP category', adj))
    .filter((name) => name && !seenCats.has(nameKey(name)) && seenCats.add(nameKey(name)))
    .slice(0, L.categories.max)
    // Every category is a suggestion the owner confirms in GBP, whatever
    // the file said.
    .map((name) => ({ name, confirm: true }));

  const posts = [];
  const rawPosts = (Array.isArray(g.posts) ? g.posts : []).filter(isObject);
  if (rawPosts.length > L.posts.count) adj.push(`Kept the first ${L.posts.count} of ${rawPosts.length} GBP posts.`);
  for (const p of rawPosts.slice(0, L.posts.count)) {
    const n = posts.length + 1;
    const title = field(p.title, L.posts.title, `post ${n}'s title`, adj);
    const body = field(p.body, L.posts.body, `post ${n}`, adj, { block: true });
    if (!title || !body) {
      adj.push(`Left out a GBP post without a ${title ? 'text' : 'title'}.`);
      continue;
    }
    let cta = WORDS_CTAS.includes(p.cta) ? p.cta : 'LEARN_MORE';
    if (cta !== p.cta) adj.push(`Post ${n}'s button "${short(oneLine(String(p.cta ?? '')) || 'none', 20)}" isn't a GBP button; set to Learn more.`);
    if (cta === 'CALL' && !ctx.phoneDigits) {
      cta = 'LEARN_MORE';
      adj.push(`Post ${n} had a Call button but the business has no phone; set to Learn more.`);
    }
    const ref = typeof p.photo === 'string' ? p.photo.trim() : '';
    const photo = ref ? ctx.photos.find((ph) => ph.ref === ref || ph.file === ref) || null : null;
    if (ref && !photo) adj.push(`Post ${n} named a photo the run didn't have ("${short(oneLine(ref), 30)}").`);
    const imageHint = field(p.imageHint, L.posts.imageHint, `post ${n}'s image hint`, adj);
    flag(title, `post ${n}'s title`, ctx, adj, { phones: 'none', links: 'none' });
    flag(body, `post ${n}`, ctx, adj, { phones: 'none' });
    flag(imageHint, `post ${n}'s image hint`, ctx, adj, { links: 'none' });
    posts.push({
      title,
      body,
      cta,
      link: cta === 'BOOK' ? ctx.urls.booking || ctx.urls.site : cta === 'LEARN_MORE' ? ctx.urls.site : '',
      imageHint,
      photo: photo ? { path: photo.path, name: photo.name || photo.file || photo.ref } : null,
    });
  }
  if (posts.length && posts.length < L.posts.count) adj.push(`Only ${posts.length} of ${L.posts.count} GBP posts came back.`);
  return { description, services, categories, posts };
}

function sanitizeSeo(raw, ctx, adj) {
  const s = isObject(raw) ? raw : {};
  const L = WORDS_LIMITS.seo;
  const title = field(s.title, L.title.max, 'the SEO title', adj);
  const description = field(s.description, L.description.max, 'the SEO description', adj);
  flag(title, 'the SEO title', ctx, adj, { links: 'none', phones: 'none' });
  flag(description, 'the SEO description', ctx, adj, { links: 'none' });
  const seen = new Set();
  const keywords = (Array.isArray(s.keywords) ? s.keywords : [])
    .map((k) => field(k, L.keywords.each, 'an SEO keyword', adj))
    .filter((k) => k && !seen.has(normText(k)) && seen.add(normText(k)))
    .slice(0, L.keywords.max);
  keywords.forEach((k, i) => flag(k, `SEO keyword ${i + 1}`, ctx, adj, { links: 'none', phones: 'none' }));
  return { title, description, keywords };
}

// Text with a placeholder or link taken out: no doubled spaces, no space
// before punctuation, no spaces at line ends, at most one blank line.
const tidy = (t) => t
  .replace(/[ ]{2,}/g, ' ')
  .replace(/ +([.,!?;:])/g, '$1')
  .replace(/[ ]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// A review request with the review link where it belongs, within `max`:
// the real link replaces the placeholder (or is added at the end); without
// a Google place the placeholder stays, and is added when missing.
function withReviewLink(text, max, where, ctx, adj) {
  if (!text) return '';
  const link = ctx.urls.review;
  const PH = REVIEW_LINK_PLACEHOLDER;
  if (link) {
    if (text.includes(link)) {
      if (!text.includes(PH)) return text;
      adj.push(`Took ${PH} out of ${where}: the Google review link is already there.`);
      return tidy(text.split(PH).join(''));
    }
    if (text.includes(PH)) {
      const out = text.split(PH).join(link);
      if (out.length <= max) {
        adj.push(`Put the Google review link in place of ${PH} in ${where}.`);
        return out;
      }
    }
    // A link the length cut left half of ("https://search.goo…") goes too.
    const rest = tidy(text.split(PH).join('').replace(/\s*https?:\/\/\S*…$/, ''));
    const base = fitText(rest, max - link.length - 1).text;
    adj.push(`Added the Google review link to ${where}.`);
    return `${base}${base.includes('\n') ? '\n' : ' '}${link}`;
  }
  if (text.includes(REVIEW_LINK_PLACEHOLDER)) return text;
  const base = fitText(text, max - REVIEW_LINK_PLACEHOLDER.length - 1).text;
  adj.push(`Added ${REVIEW_LINK_PLACEHOLDER} to ${where}: there is no Google place for the real link yet.`);
  return `${base} ${REVIEW_LINK_PLACEHOLDER}`;
}

function policyFlags(text, where, adj, { gating = true } = {}) {
  const inc = incentiveHits(text);
  if (inc.length) adj.push(`Check ${where}: "${inc[0]}" reads as something in return for a review, which Google forbids.`);
  const gate = gating ? gatingHits(text) : [];
  if (gate.length) adj.push(`Check ${where}: "${gate[0]}" asks for a particular kind of review; ask for an honest one.`);
}

function sanitizeReviews(raw, ctx, adj) {
  const r = isObject(raw) ? raw : {};
  const L = WORDS_LIMITS.reviews;
  const allowed = [NAME_PLACEHOLDER, REVIEW_LINK_PLACEHOLDER];
  const sms = withReviewLink(field(r.requestSms, L.requestSms, 'the review request text', adj, { block: true }), L.requestSms, 'the review request text', ctx, adj);
  const email = isObject(r.requestEmail) ? r.requestEmail : {};
  const subject = field(email.subject, L.subject, 'the review email subject', adj);
  const body = withReviewLink(field(email.body, L.emailBody, 'the review email', adj, { block: true }), L.emailBody, 'the review email', ctx, adj);
  for (const [text, where] of [[sms, 'the review request text'], [subject, 'the review email subject'], [body, 'the review email']]) {
    flag(text, where, ctx, adj, { allowed });
    policyFlags(text, where, adj);
  }
  const byRating = new Map();
  for (const rep of Array.isArray(r.replies) ? r.replies : []) {
    const rating = isObject(rep) ? Number(rep.rating) : NaN;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || byRating.has(rating)) continue;
    const text = field(rep.text, L.reply, `the ${rating}-star reply`, adj, { block: true });
    if (!text) continue;
    flag(text, `the ${rating}-star reply`, ctx, adj, { allowed: [NAME_PLACEHOLDER] });
    policyFlags(text, `the ${rating}-star reply`, adj, { gating: false });
    byRating.set(rating, text);
  }
  const missing = [1, 2, 3, 4, 5].filter((n) => !byRating.has(n));
  if (missing.length && byRating.size) adj.push(`No reply template for ${missing.join(', ')} star${missing.length === 1 && missing[0] === 1 ? '' : 's'}.`);
  const replies = [5, 4, 3, 2, 1].filter((n) => byRating.has(n)).map((rating) => ({ rating, text: byRating.get(rating) }));
  return { requestSms: sms, requestEmail: { subject, body }, replies, link: ctx.urls.review || '' };
}

function sanitizeSocial(raw, ctx, adj) {
  const s = isObject(raw) ? raw : {};
  const L = WORDS_LIMITS.social;
  const bio = field(s.bio, L.bio, 'the social bio', adj, { block: true });
  flag(bio, 'the social bio', ctx, adj);
  const seen = new Set();
  const captions = (Array.isArray(s.captions) ? s.captions : [])
    .map((c, i) => field(c, L.caption, `caption ${i + 1}`, adj, { block: true }))
    .filter((c) => c && !seen.has(normText(c)) && seen.add(normText(c)))
    .slice(0, L.captions);
  captions.forEach((c, i) => flag(c, `caption ${i + 1}`, ctx, adj));
  return { bio, captions };
}

// The run's facts the sanitizer checks against, from the spec's inputs:
//   services  the site's service names ([string]; [] = take the model's)
//   phone     the business phone ('' = no Call button)
//   urls      { site, booking, review }: http(s) links only (anything else
//             counts as no link, so a post's button never gets one)
//   photos    [{ ref ('photo-3'), file ('photo-3.jpg' or ''), path (the
//             upload's storage path), name (their file name) }]
//   sources   { primary, reviews, site } texts (wordsSources), or null to
//             skip the claim flags
const httpLink = (u) => (typeof u === 'string' && /^https?:\/\/[^\s<>"'`]+$/i.test(u) ? u : '');

function contextOf(opts = {}) {
  const urls = isObject(opts.urls) ? opts.urls : {};
  const clean = { site: httpLink(urls.site), booking: httpLink(urls.booking), review: httpLink(urls.review) };
  return {
    services: (Array.isArray(opts.services) ? opts.services : []).map((s) => oneLine(typeof s === 'string' ? s : s?.name)).filter(Boolean),
    phoneDigits: String(opts.phone || '').replace(/\D/g, '').slice(-10),
    urls: clean,
    hosts: new Set(Object.values(clean).filter(Boolean).map(hostOf)),
    photos: (Array.isArray(opts.photos) ? opts.photos : []).filter((p) => isObject(p) && typeof p.ref === 'string' && typeof p.path === 'string'),
    sources: isObject(opts.sources) ? wordsSources(opts.sources) : null,
  };
}

// Untrusted words.json as clean data plus what changed:
// { data (null when nothing in it is usable), adjustments }.
export function wordsReport(raw, opts = {}) {
  if (!isObject(raw)) return { data: null, adjustments: [] };
  const ctx = contextOf(opts);
  const adj = [];
  const gbp = sanitizeGbp(raw.gbp, ctx, adj);
  const seo = sanitizeSeo(raw.seo, ctx, adj);
  const reviews = sanitizeReviews(raw.reviews, ctx, adj);
  const social = sanitizeSocial(raw.social, ctx, adj);
  const usable = gbp.description || gbp.posts.length || seo.title || seo.description || reviews.requestSms || reviews.replies.length || social.bio || social.captions.length;
  const adjustments = [...new Set(adj)];
  if (!usable) return { data: null, adjustments };
  return { data: { gbp, seo, reviews, social, adjustments: adjustments.slice(0, WORDS_ADJUSTMENTS_MAX) }, adjustments };
}

export function sanitizeWords(raw, opts = {}) {
  return wordsReport(raw, opts).data;
}

// ─── Showing it ──────────────────────────────────────────────────────

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The deck as sections of copyable pieces, for the admin view (and any
// other page that shows it): [{ id, title, hint, items: [{ id, label, text,
// max (limit for the count, or 0), meta: [string] }] }]. Empty pieces are
// left out; `data` is sanitized data.
export function wordsSections(data) {
  if (!isObject(data)) return [];
  const L = WORDS_LIMITS;
  const g = isObject(data.gbp) ? data.gbp : {};
  const seo = isObject(data.seo) ? data.seo : {};
  const rv = isObject(data.reviews) ? data.reviews : {};
  const so = isObject(data.social) ? data.social : {};
  const item = (id, label, text, max = 0, meta = []) => ({ id, label, text: typeof text === 'string' ? text : '', max, meta: meta.filter(Boolean) });
  const list = (v) => (Array.isArray(v) ? v : []);

  const gbpItems = [item('gbp-description', 'Business description', g.description, L.gbp.description.max)];
  list(g.services).forEach((s, i) => gbpItems.push(item(`gbp-service-${i}`, `Service: ${s?.name || ''}`, s?.description, L.gbp.services.description, s?.description ? [] : ['No description: add the name only'])));
  const cats = list(g.categories).map((c) => c?.name).filter(Boolean);
  if (cats.length) {
    gbpItems.push(item('gbp-categories', 'Categories (suggestions)', cats.join('\n'), 0, [`${cats[0]} as the primary category. Confirm each name in the GBP category box.`]));
  }

  const postItems = list(g.posts).map((p, i) => item(`post-${i}`, `Post ${i + 1}: ${p?.title || ''}`, p?.body, L.gbp.posts.body, [
    `Button: ${WORDS_CTA_LABELS[p?.cta] || p?.cta || ''}${p?.link ? ` (${p.link})` : p?.cta === 'CALL' ? ' (the profile\'s phone)' : ''}`,
    p?.imageHint ? `Image: ${p.imageHint}${p?.photo?.name ? ` (their photo: ${p.photo.name})` : ''}` : '',
  ]));

  const seoItems = [
    item('seo-title', 'Title', seo.title, L.seo.title.max),
    item('seo-description', 'Description', seo.description, L.seo.description.max),
    item('seo-keywords', 'Keywords', list(seo.keywords).join(', ')),
  ];

  const email = isObject(rv.requestEmail) ? rv.requestEmail : {};
  const reviewItems = [
    item('review-sms', 'Review request: text message', rv.requestSms, L.reviews.requestSms),
    item('review-subject', 'Review request: email subject', email.subject, L.reviews.subject),
    item('review-email', 'Review request: email', email.body, L.reviews.emailBody),
    ...list(rv.replies).map((r) => item(`reply-${r?.rating}`, `Reply to a ${plural(Number(r?.rating) || 0, 'star')} review`, r?.text, L.reviews.reply)),
  ];

  const socialItems = [
    item('social-bio', 'Profile bio', so.bio, L.social.bio),
    ...list(so.captions).map((c, i) => item(`caption-${i}`, `Launch caption ${i + 1}`, c, L.social.caption)),
  ];

  const keep = (items) => items.filter((it) => it.text);
  return [
    { id: 'gbp', title: 'Google Business Profile', hint: 'Paste into the profile. Categories are suggestions to confirm in GBP.', items: keep(gbpItems) },
    { id: 'posts', title: `Starter posts (${postItems.length})`, hint: 'One a week. Each names its button and the photo to use.', items: keep(postItems) },
    { id: 'seo', title: 'Search listing', hint: 'The site\'s title and description in Google results.', items: keep(seoItems) },
    {
      id: 'reviews',
      title: 'Reviews',
      hint: rv.link ? `Google review link: ${rv.link}` : `No Google place yet: replace ${REVIEW_LINK_PLACEHOLDER} with the review link.`,
      items: keep(reviewItems),
    },
    { id: 'social', title: 'Social', hint: 'Bio and three captions for the launch.', items: keep(socialItems) },
  ].filter((s) => s.items.length);
}

// The whole deck as plain text (one "Copy everything" for an email or doc).
export function wordsPlainText(data) {
  return wordsSections(data).map((s) => [
    s.title.toUpperCase(),
    ...s.items.map((it) => [`${it.label}:`, it.text, ...it.meta.map((m) => `(${m})`)].join('\n')),
  ].join('\n\n')).join('\n\n\n');
}
