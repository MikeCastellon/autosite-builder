// Pure logic behind the FAQ band (kit/Faq.jsx): which questions a page
// shows, the limits that keep the band (and its search-engine data) the
// size the design was drawn for, and the FAQPage JSON-LD. No React and no
// browser globals; tolerates whatever a saved row holds (missing keys,
// wrong types).
//
// The data, written by the editor's FAQ tab (Edit > FAQ) or a site run:
//   copy.faq = { title?, intro?, items: [{ q, a }] }
// The object being there switches the band on: a site without it renders
// exactly as before (themes with live sites stay byte-identical). An item
// is an entry of items below FAQ_LIMITS.items, so the editor and the page
// agree on which twelve count. The published page shows only items with
// both a question and an answer, and the band only when there is at least
// one; the editor shows every item, so an incomplete one can say what it
// still needs.
import { sectionTitle } from './content.js';

// What the editor's fields allow. The page clips anything longer (a row
// written by an older editor or a generator), so a pasted essay can neither
// stretch the band nor reach the JSON-LD.
export const FAQ_LIMITS = Object.freeze({ title: 80, intro: 200, q: 160, a: 600, items: 12 });

// The section id (copy.sectionOrder / copy.hiddenSections, data-section).
export const FAQ_SECTION = 'faq';

// The design's own words while the owner typed none. No claims: the
// owner's questions make the point.
export const FAQ_DEFAULTS = Object.freeze({ eyebrow: 'FAQ', title: 'Questions, Answered' });

// The Edit panel tab every hint names (editorCapabilities.js EDITOR_TABS
// must hold a tab with exactly this label).
export const FAQ_TAB = 'FAQ';

// Editor-only hints: the empty band, and an item that will not publish yet
// (no answer, no question, or neither).
export const FAQ_HINTS = Object.freeze({
  empty: `Add your questions and answers in Edit > ${FAQ_TAB}.`,
  noAnswer: `Add an answer in Edit > ${FAQ_TAB}. Until then this question stays off your site.`,
  noQuestion: `Add the question in Edit > ${FAQ_TAB}. Until then this answer stays off your site.`,
  blank: `An empty question: fill it in or remove it in Edit > ${FAQ_TAB}.`,
});

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const raw = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
// Titles, intros and questions are one line: any run of whitespace
// (a pasted line break included) is one space.
const oneLine = (v) => raw(v).replace(/\s+/g, ' ').trim();
// An answer keeps the owner's line breaks (the band prints them, and a
// blank line starts a new paragraph); spaces inside a line collapse and at
// most one blank line separates paragraphs.
const paragraphs = (v) => raw(v)
  .replace(/\r\n?/g, '\n')
  .replace(/[^\S\n]+/g, ' ')
  .replace(/ ?\n ?/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// `text` cut to at most `max` characters (code points, so an emoji is never
// split): at the last word break when that keeps most of the text, never
// ending on a space or a dangling comma, and closed with "…". Text within
// the limit comes back unchanged.
export function clipText(text, max) {
  const s = typeof text === 'string' ? text : '';
  const chars = Array.from(s);
  if (!(max > 0) || chars.length <= max) return s;
  let cut = chars.slice(0, max - 1).join('');
  const space = cut.search(/\s\S*$/);
  if (space >= cut.length * 0.6) cut = cut.slice(0, space);
  return `${cut.replace(/[\s.,;:!?…-]+$/u, '')}…`;
}

// The band's content, or null while copy.faq is not an object (the band is
// off). -> { title, intro, items, complete }
//   title / intro  the owner's text, one line, clipped ('' = the design's own)
//   items          [{ index, q, a, complete }]: complete items only on the
//                  published page, every item in the editor; index is the
//                  entry's place in copy.faq.items
//   complete       how many items have both a question and an answer
export function faqItems(faq, { editor = false } = {}) {
  if (!isObj(faq)) return null;
  const own = Array.isArray(faq.items) ? faq.items.slice(0, FAQ_LIMITS.items) : [];
  const all = own.map((entry, index) => {
    const e = isObj(entry) ? entry : {};
    const q = clipText(oneLine(e.q), FAQ_LIMITS.q);
    const a = clipText(paragraphs(e.a), FAQ_LIMITS.a);
    return { index, q, a, complete: Boolean(q && a) };
  });
  const complete = all.filter((it) => it.complete);
  return {
    title: clipText(oneLine(faq.title), FAQ_LIMITS.title),
    intro: clipText(oneLine(faq.intro), FAQ_LIMITS.intro),
    items: editor ? all : complete,
    complete: complete.length,
  };
}

// The heading the band prints: the owner's title / intro (copy.faq, which
// Edit > Headings edits too when a theme's headingFields says titleFrom
// 'faq.title'), else copy.sectionTitles.faq, else the design's own (FAQ_DEFAULTS,
// or the theme's `defaults`). Eyebrow and highlighted words come from
// copy.sectionTitles.faq only. -> { eyebrow, title, accent, intro }
export function faqHeading(faq, sectionTitles, defaults = FAQ_DEFAULTS) {
  const own = isObj(faq) ? faq : {};
  const st = sectionTitle(sectionTitles, FAQ_SECTION);
  const d = isObj(defaults) ? defaults : FAQ_DEFAULTS;
  // The first non-empty value, one line, within the field's limit.
  const first = (limit, ...vals) => clipText(vals.map(oneLine).find(Boolean) || '', limit);
  return {
    eyebrow: first(FAQ_LIMITS.title, st.eyebrow, d.eyebrow),
    title: first(FAQ_LIMITS.title, own.title, st.title, d.title),
    accent: st.accent,
    intro: first(FAQ_LIMITS.intro, own.intro, st.intro),
  };
}

// schema.org FAQPage data for the questions the published page shows, or
// null when it shows none. Search engines only trust FAQ data that matches
// the visible questions word for word, so it is built from the same
// (clipped) items the band prints.
export function faqJsonLd(faq) {
  const data = faqItems(faq);
  if (!data || data.items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

// JSON for the inside of a <script> element. The HTML parser ends a script
// at the first "</script" whatever the JSON means, and "<!--" changes how
// it reads what follows, so <, > and & are written as JSON \u escapes
// (still the same strings to any JSON parser). U+2028 / U+2029 are escaped
// too: some older JavaScript-based readers choke on them.
export function scriptSafeJson(value) {
  const json = JSON.stringify(value);
  if (typeof json !== 'string') return '';
  return json.replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
