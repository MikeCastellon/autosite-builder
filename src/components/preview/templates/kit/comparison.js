// Pure logic behind the Comparison band (kit/Comparison.jsx): the rows of
// the "us vs. them" table a page shows, what each cell says, and the
// heading. No React and no browser globals; tolerates whatever a saved row
// holds (missing keys, wrong types).
//
// The data, written by the editor's Comparison tab or a site run:
//   copy.comparison = { title?, intro?, usLabel?, themLabel?,
//                       rows: [{ label, us, them }] }
//   us / them: true (a check, "Yes"), false (a dash, "No") or a short text
// The object being there switches the band on: a site without it renders
// exactly as before (themes with live sites stay byte-identical). A row is
// an entry of rows below CMP_LIMITS.rows, so the editor and the page agree
// on which ten count. The published page shows only rows with a label, and
// the band only when there is at least one; the editor shows every row, so
// an unlabelled one can say what it still needs. The block never invents a
// row or fills an empty cell: the design only supplies the heading and the
// two column labels (CMP_DEFAULTS).

import { sectionTitle } from './content.js';

// What the editor's fields allow. The page clips anything longer (a row
// written before the limits, or by a generator), so a pasted sentence can
// never stretch the table.
export const CMP_LIMITS = Object.freeze({ title: 80, intro: 200, usLabel: 40, themLabel: 40, label: 80, cell: 40, rows: 10 });

// The section id (copy.sectionOrder / copy.hiddenSections, data-section).
export const CMP_SECTION = 'comparison';

// The Edit panel tab every hint names, also the Sections list label
// (editorCapabilities.js EDITOR_TABS must hold a tab with exactly this
// label).
export const CMP_TAB = 'Comparison';

// The design's own words while the owner typed none: the heading, and the
// column labels (usLabel: only when the business has no name either). No
// claims: the owner's rows make the point.
export const CMP_DEFAULTS = Object.freeze({
  eyebrow: 'The Difference',
  title: 'How We Compare',
  usLabel: 'Us',
  themLabel: 'Automated car wash',
});

// Editor-only hints: the empty band, and a row that will not publish yet.
export const CMP_HINTS = Object.freeze({
  empty: `Add the rows you compare in Edit > ${CMP_TAB}.`,
  noLabel: `Name this row in Edit > ${CMP_TAB}. Until then it stays off your site.`,
});

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const raw = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
// Every field is one line: any run of whitespace (a pasted line break
// included) is one space.
const oneLine = (v) => raw(v).replace(/\s+/g, ' ').trim();

// `text` cut to at most `max` characters (code points, so an emoji is never
// split): at the last word break when that keeps most of the text, never
// ending on a space or a dangling comma, and closed with "…". Text within
// the limit comes back unchanged. (The FAQ band clips the same way.)
function clip(text, max) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  let cut = chars.slice(0, max - 1).join('');
  const space = cut.search(/\s\S*$/);
  if (space >= cut.length * 0.6) cut = cut.slice(0, space);
  return `${cut.replace(/[\s.,;:!?…-]+$/u, '')}…`;
}
const field = (v, max) => clip(oneLine(v), max);

// Text that only says yes or no, the way an import or a generator may write
// a mark ("Yes", "✓", "No", "—"), counts as that mark, so it gets the same
// accessible check / dash.
const YES_TEXT = /^(yes|true|[✓✔☑✅]️?)$/iu;
const NO_TEXT = /^(no|false|[✗✘×❌—–−-]️?)$/iu;

// One cell -> { kind, text }: kind 'yes' (true), 'no' (false), 'text' (the
// owner's words, one line, clipped) or 'empty' (anything else: missing, '',
// null). An empty cell stays empty on the page; it never turns into a "No".
export function comparisonCell(value) {
  if (value === true) return { kind: 'yes', text: '' };
  if (value === false) return { kind: 'no', text: '' };
  const text = field(value, CMP_LIMITS.cell);
  if (!text) return { kind: 'empty', text: '' };
  if (YES_TEXT.test(text)) return { kind: 'yes', text: '' };
  if (NO_TEXT.test(text)) return { kind: 'no', text: '' };
  return { kind: 'text', text };
}

// The band's content, or null while copy.comparison is not an object (the
// band is off). businessName: the column label while the owner gave none.
// -> { title, intro, usLabel, themLabel, rows, labelled }
//   title / intro  the owner's text, one line, clipped ('' = the design's own)
//   usLabel        the owner's, else the business name, else CMP_DEFAULTS
//   themLabel      the owner's, else CMP_DEFAULTS
//   rows           [{ index, label, us, them, labelled }] (us / them:
//                  comparisonCell): labelled rows only on the published
//                  page, every row in the editor; index is the entry's
//                  place in copy.comparison.rows
//   labelled       how many rows have a label (what the page shows)
export function comparisonOf(comparison, { editor = false, businessName = '' } = {}) {
  if (!isObj(comparison)) return null;
  const own = Array.isArray(comparison.rows) ? comparison.rows.slice(0, CMP_LIMITS.rows) : [];
  const all = own.map((entry, index) => {
    const e = isObj(entry) ? entry : {};
    const label = field(e.label, CMP_LIMITS.label);
    return { index, label, us: comparisonCell(e.us), them: comparisonCell(e.them), labelled: Boolean(label) };
  });
  const labelled = all.filter((r) => r.labelled);
  return {
    title: field(comparison.title, CMP_LIMITS.title),
    intro: field(comparison.intro, CMP_LIMITS.intro),
    usLabel: field(comparison.usLabel, CMP_LIMITS.usLabel) || field(businessName, CMP_LIMITS.usLabel) || CMP_DEFAULTS.usLabel,
    themLabel: field(comparison.themLabel, CMP_LIMITS.themLabel) || CMP_DEFAULTS.themLabel,
    rows: editor ? all : labelled,
    labelled: labelled.length,
  };
}

// The heading the band prints: the owner's title / intro (copy.comparison,
// which Edit > Headings edits too when a theme's headingFields says
// titleFrom 'comparison.title'), else copy.sectionTitles.comparison, else
// the design's own (CMP_DEFAULTS, merged with the theme's `defaults`; ''
// there leaves a part out). Eyebrow and highlighted words come from
// copy.sectionTitles.comparison only. -> { eyebrow, title, accent, intro }
export function comparisonHeading(comparison, sectionTitles, defaults) {
  const own = comparisonOf(comparison) || { title: '', intro: '' };
  const st = sectionTitle(sectionTitles, CMP_SECTION);
  const d = { ...CMP_DEFAULTS, ...(isObj(defaults) ? defaults : {}) };
  return {
    eyebrow: st.eyebrow || oneLine(d.eyebrow),
    title: own.title || field(st.title, CMP_LIMITS.title) || oneLine(d.title),
    accent: st.accent || oneLine(d.accent),
    intro: own.intro || field(st.intro, CMP_LIMITS.intro) || oneLine(d.intro),
  };
}
