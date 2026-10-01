// Pure content helpers for theme-ready templates: headings with a highlighted
// phrase, per-section heading overrides, "what's included" lists, service
// areas, phone and hours formatting. No React and no browser globals, so they
// run in the editor preview and in exportHtml's renderToStaticMarkup alike.
// Every helper tolerates whatever a saved row holds (missing keys, wrong
// types) and returns '' / [] / null instead of throwing.

const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Apostrophes count as word characters, so "Denver" never lights up inside
// "Denver's" (the possessive would be cut across two elements).
const WORD_CHAR = /[\p{L}\p{N}'’]/u;

// Splits `title` around the first case-insensitive, whole-word occurrence of
// `accent`: { before, match, after } (match keeps the title's own casing), or
// null when either is empty or the phrase is not in the title. Whole words
// only ("Car" never lights up inside "Cards"), so a heading's first word is
// never cut across elements. Word boundaries are checked by hand rather than
// with a lookbehind regex, which older Safari cannot parse.
export function splitAccent(title, accent) {
  const t = str(title);
  const a = str(accent);
  if (!t || !a) return null;
  const re = new RegExp(escapeRe(a), 'giu');
  let m;
  while ((m = re.exec(t))) {
    const start = m.index;
    const end = start + m[0].length;
    const okBefore = start === 0 || !WORD_CHAR.test(t[start - 1]) || !WORD_CHAR.test(a[0]);
    const okAfter = end === t.length || !WORD_CHAR.test(t[end]) || !WORD_CHAR.test(a[a.length - 1]);
    if (okBefore && okAfter) return { before: t.slice(0, start), match: m[0], after: t.slice(end) };
    re.lastIndex = start + 1;
  }
  return null;
}

// The last `n` words of a title as an accent phrase, only when the title has
// more words than that (so a two-word heading is never all accent).
export function trailingWords(title, n = 2) {
  const words = str(title).split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.length > 1 ? words[words.length - 1] : '';
  return words.slice(-n).join(' ');
}

// copy.sectionTitles[sectionId] -> { eyebrow, title, accent, intro } as
// trimmed strings ('' when unset). Keyed by the template's section ids, so
// saved headings survive a template switch for the ids templates share.
export function sectionTitle(sectionTitles, id) {
  const entry = sectionTitles && typeof sectionTitles === 'object' ? sectionTitles[id] : null;
  const e = entry && typeof entry === 'object' ? entry : {};
  return { eyebrow: str(e.eyebrow), title: str(e.title), accent: str(e.accent), intro: str(e.intro) };
}

// A service's "what's included" list: strings or { text, highlight } items.
// A text ending in ':' is a group heading ("Interior:"), never highlighted;
// highlight: true marks what this package adds over the previous one.
// -> [{ text, heading, highlight }]
export function serviceIncludes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const text = typeof item === 'string' ? item.trim() : str(item?.text);
    if (!text) continue;
    const heading = /:\s*$/.test(text);
    out.push({ text, heading, highlight: !heading && item?.highlight === true });
  }
  return out;
}

// Bullet items the owner typed into a free-text description ("• Vacuum\n•
// Windows", "- Foam bath - Tire shine", one item per line). Only a clear
// list qualifies (2-16 short items); anything else -> null, and the
// template shows the description as written.
export function bulletItems(text) {
  const s = str(text);
  if (!s) return null;
  let parts = null;
  if (/^[\s]*[-–—•*✓✔]/.test(s) || (s.match(/[•✓✔]/g) || []).length >= 2) {
    parts = s.split(/(?:^|\n|\s)[-–—•*✓✔]+\s*/);
  } else if (/\n/.test(s)) {
    parts = s.split(/\s*\n+\s*/);
  }
  if (!parts) return null;
  const items = parts.map((p) => str(p).replace(/[.;,]\s*$/, '')).filter(Boolean);
  if (items.length < 2 || items.length > 16 || items.some((p) => p.length > 70)) return null;
  return items;
}

// Areas the business serves, in the owner's order: businessInfo.serviceAreas
// (a list, or a string split like the wizard's list fields), else the
// free-text serviceArea split on , · ; | and newlines when that gives 2+
// short names, else serviceArea as one entry, else the owner's city, else
// []. Never invents areas.
export function serviceAreasOf(biz) {
  const clean = (list) => {
    const seen = new Set();
    return list.map(str).filter((a) => {
      const k = a.toLowerCase();
      if (!a || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const own = biz?.serviceAreas;
  if (Array.isArray(own)) {
    const list = clean(own);
    if (list.length) return list;
  } else if (typeof own === 'string' && own.trim()) {
    return clean(own.split(/[,·;|\n]+/));
  }
  const area = str(biz?.serviceArea);
  if (!area) {
    const city = str(biz?.city);
    return city ? [city] : [];
  }
  const parts = clean(area.split(/\s*[,·;|\n]+\s*/));
  if (parts.length >= 2 && parts.every((p) => p.length <= 40)) return parts;
  return [area];
}

// Footer columns a template can build from copy.footer (Edit > Footer):
// the brand block, the Explore links, the service areas, the contact list
// and the hours. The whole shape, as the editor writes it:
//   copy.footer = { columns?: [{ type, title?, show? }], showCta?: boolean
//   (absent = true; false removes the footer button), ctaText?, ctaUrl?,
//   bottomText? } | null.
// There is no footer showGoogle key: the footer's Google rating line is the
// 'footer' entry of copy.googleBadge.placements (Edit > Google Rating), so
// one switch decides it.
export const FOOTER_COLUMN_TYPES = ['brand', 'links', 'areas', 'contact', 'hours'];

// copy.footer.columns -> [{ type, title, show }] for every type. Without a
// columns array (no footer saved, or an old / broken value) the design's own
// footer: every type in the default order, shown, untitled. With one: the
// known types in the owner's order (the first entry of a type wins, show
// unless show === false), then any type the array lacks, hidden. The editor's
// Footer panel (editor/footerBuilder.js) reads the same way; keep the two in
// step.
export function footerColumnsOf(footer) {
  const cols = footer && typeof footer === 'object' && !Array.isArray(footer) && Array.isArray(footer.columns)
    ? footer.columns
    : null;
  if (!cols) return FOOTER_COLUMN_TYPES.map((type) => ({ type, title: '', show: true }));
  const out = [];
  const seen = new Set();
  for (const c of cols) {
    const type = c && typeof c === 'object' ? c.type : null;
    if (!FOOTER_COLUMN_TYPES.includes(type) || seen.has(type)) continue;
    seen.add(type);
    out.push({ type, title: str(c.title), show: c.show !== false });
  }
  for (const type of FOOTER_COLUMN_TYPES) if (!seen.has(type)) out.push({ type, title: '', show: false });
  return out;
}

// Where a button goes when the owner gave it no URL: its wording decides
// (the owner's text or the AI draft's: "Call Now", "Get a Quote", "Book
// Today", "View Our Services"), else `fallback`. `map` holds the targets the
// page has: { tel, quote, contact, services, process, gallery, reviews,
// areas }; a missing one lets that wording fall through to `fallback`.
// "Quote" / "estimate" / "price" go to an on-page price card (map.quote)
// when there is one, else to the contact target.
export function intentHref(label, map, fallback) {
  const s = str(label).toLowerCase();
  const m = map && typeof map === 'object' ? map : {};
  if (!s) return fallback;
  if (/\b(call|phone|ring)\b/.test(s) && m.tel) return m.tel;
  if (/\b(quote|estimate|price)\b/.test(s) && m.quote) return m.quote;
  if (/\b(book|booking|schedule|appointment|quote|estimate|contact|touch|reserve|visit|message|email)\b/.test(s)) return m.contact || fallback;
  if (/\b(services?|packages?|pricing|prices|menu|plans?)\b/.test(s)) return m.services || fallback;
  if (/\b(how|process|steps?|works)\b/.test(s)) return m.process || fallback;
  if (/\b(work|gallery|photos?|portfolio|results)\b/.test(s)) return m.gallery || fallback;
  if (/\b(reviews?|testimonials?)\b/.test(s)) return m.reviews || fallback;
  if (/\b(areas?|locations?|hours)\b/.test(s)) return m.areas || fallback;
  return fallback;
}

// A label that asks to book ("Book Now", "Schedule Service"): such a button
// also opens the booking widget (data-scheduler-trigger) when it has no URL.
export function bookingWorded(label) {
  return /\b(book|booking|schedule|appointment|reserve)\b/i.test(str(label));
}

// "(555) 201-3344" -> "555-201-3344" for US numbers (10 digits, or 11
// starting with 1); anything else is shown as the owner typed it.
export function phoneDisplay(phone) {
  const raw = str(phone);
  const digits = raw.replace(/\D/g, '');
  const us = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (us.length === 10 && !/^\+(?!1)/.test(raw)) return `${us.slice(0, 3)}-${us.slice(3, 6)}-${us.slice(6)}`;
  return raw;
}

// 'tel:+15552013344'-style href (digits and +), or null without digits.
export function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// "8am-6pm" / "8:30am - 6pm" / "9 AM–5 PM" -> "8:00 AM – 6:00 PM". A value
// that is not a plain time range ("By appointment") comes back unchanged:
// this only reformats, it never reinterprets what the owner wrote.
const TIME = '(\\d{1,2})(?::(\\d{2}))?\\s*([ap])\\.?\\s*m\\.?';
const RANGE_RE = new RegExp(`^${TIME}\\s*(?:-|–|—|to)\\s*${TIME}$`, 'i');
export function formatTimeRange(value) {
  const s = str(value);
  const m = s.match(RANGE_RE);
  if (!m) return s;
  const one = (h, min, ap) => `${Number(h)}:${min || '00'} ${ap.toUpperCase()}M`;
  return `${one(m[1], m[2], m[3])} – ${one(m[4], m[5], m[6])}`;
}

// Trust-bar items the editor used to seed and WheelApex filled in by
// default (a 4.9 rating, 0% finance, a fitment guarantee): an item saved
// exactly as seeded was never written by the owner, so it is dropped, and
// a seeded claim sub-line is cleared (WheelApex's SEEDED_TRUST rule).
const SEEDED_TRUST = new Set([
  'fitment guaranteed|or free return',
  'finance available|0% for 12 months',
  '4.9 star rating|customer reviews',
]);
const SEEDED_SUBS = new Set(['0% for 12 months', 'or free return', 'or we make it right']);

// copy.trustBar (Edit > Trust Bar) -> [{ emoji, label, sub }] in the owner's
// order: items with a label, minus the old seeded samples. emoji is the
// picker's value ('icon:shield', an emoji character, or '').
export function trustItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((it) => ({
      emoji: typeof it?.emoji === 'string' ? it.emoji.trim() : '',
      label: str(it?.label),
      sub: str(it?.sub),
    }))
    .filter((it) => it.label && !SEEDED_TRUST.has(`${it.label.toLowerCase()}|${it.sub.toLowerCase()}`))
    .map((it) => ({ ...it, sub: SEEDED_SUBS.has(it.sub.toLowerCase()) ? '' : it.sub }));
}

// The wizard's business type ids. Older sites store free-form types
// ("detailing", "Mobile Detail"): map those onto the ids so type-specific
// defaults (fallback copy, "Fully Mobile") still apply. Unknown -> as given.
const KNOWN_KINDS = ['mobile_detailing', 'detailing_shop', 'car_wash', 'tint_shop', 'wheel_shop', 'mechanic_shop'];
export function businessKindOf(value) {
  const raw = str(value);
  if (!raw || KNOWN_KINDS.includes(raw)) return raw;
  if (/mobile/i.test(raw)) return 'mobile_detailing';
  if (/wash/i.test(raw)) return 'car_wash';
  if (/detail/i.test(raw)) return 'detailing_shop';
  if (/tint|film/i.test(raw)) return 'tint_shop';
  if (/wheel|tire|rim/i.test(raw)) return 'wheel_shop';
  if (/mechanic|repair/i.test(raw)) return 'mechanic_shop';
  return raw;
}
