// Data helpers for the Headings tab (HeadingsPanel.jsx): which heading fields
// each section offers, where each field's text lives, and the cleaned
// copy.sectionTitles object a change writes. Pure, so the tests run them
// without a DOM.
//
// copy.sectionTitles = { [sectionId]: { eyebrow?, title?, accent?, intro? } },
// keyed by the template's `sections` ids (never renamed, so saved headings
// survive a template switch for the ids templates share). Some headings
// already have an owner key elsewhere (the hero headline, the services
// heading and intro, the contact headline and subtext): the template reads
// those keys first, so the Headings tab edits that key instead of writing a
// sectionTitles value the template would ignore.
import { splitAccent } from '../templates/kit/content.js';
import { normalizeBusinessInfo } from '../../../lib/normalizeBusinessInfo.js';

export const HEADING_KEYS = ['eyebrow', 'title', 'accent', 'intro'];

// Copy keys that own a heading's text, with the tab and field that also edit
// them (shown as "Same text as ..." under the Headings field).
export const FROM_LABELS = {
  headline: 'Hero > Headline',
  'servicesSection.title': 'Services > Services Heading',
  'servicesSection.intro': 'Services > Services Intro',
  ctaHeadline: 'Contact > Headline',
  ctaSubtext: 'Contact > Subtext',
  'beforeAfter.title': 'Before & After > Heading',
  'beforeAfter.intro': 'Before & After > Intro line',
  // The reference-site bands keep their heading on their own copy key too
  // (the kit band reads it first).
  'vehicleTypes.title': 'Vehicle Types > Heading',
  'vehicleTypes.intro': 'Vehicle Types > Intro line',
  'showcase.title': 'Detail Showcase > Heading',
  'showcase.intro': 'Detail Showcase > Intro line',
  'comparison.title': 'Comparison > Heading',
  'comparison.intro': 'Comparison > Intro line',
  'faq.title': 'FAQ > Heading',
  'faq.intro': 'FAQ > Intro line',
};

// The keys that own a section's title / intro whatever the template (the
// sectionTitles precedence rules): used for templates without headingFields,
// so the generic rows never write a sectionTitles title the page ignores.
const OWNED = {
  hero: { titleFrom: 'headline' },
  services: { titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro' },
  cta: { titleFrom: 'ctaHeadline', introFrom: 'ctaSubtext' },
};

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const fromKey = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(FROM_LABELS, v) ? v : null);

// One row per section the Headings tab lists, in the owner's section order:
// [{ id, label, fields, titleFrom, introFrom, placeholder, generic }].
// With the template's `headingFields` export only the sections it names, with
// the fields it uses; a section left with no known field is skipped. Without
// it (a template that reads sectionTitles but does not say how) every section
// gets all four fields, flagged generic so the panel can say some may be
// unused; the hero, services and cta titles still go to the keys that own
// them.
export function headingRows(sections, headingFields) {
  const list = (Array.isArray(sections) ? sections : []).filter((s) => isObj(s) && typeof s.id === 'string' && s.id);
  const labelOf = (s) => (typeof s.label === 'string' && s.label.trim() ? s.label : s.id);
  if (!isObj(headingFields)) {
    return list.map((s) => ({
      id: s.id,
      label: labelOf(s),
      fields: [...HEADING_KEYS],
      titleFrom: OWNED[s.id]?.titleFrom || null,
      introFrom: OWNED[s.id]?.introFrom || null,
      placeholder: {},
      generic: true,
    }));
  }
  const rows = [];
  for (const s of list) {
    const entry = headingFields[s.id];
    if (!isObj(entry)) continue;
    const fields = (Array.isArray(entry.fields) ? entry.fields : []).filter((f, i, all) => HEADING_KEYS.includes(f) && all.indexOf(f) === i);
    if (!fields.length) continue;
    rows.push({
      id: s.id,
      label: labelOf(s),
      fields,
      titleFrom: fromKey(entry.titleFrom),
      introFrom: fromKey(entry.introFrom),
      placeholder: isObj(entry.placeholder) ? entry.placeholder : {},
      generic: false,
    });
  }
  return rows;
}

// obj at a dot path ('servicesSection.title'), or undefined.
export function getPath(obj, path) {
  if (typeof path !== 'string' || !path) return undefined;
  let o = obj;
  for (const part of path.split('.')) {
    if (o == null || typeof o !== 'object') return undefined;
    o = o[part];
  }
  return o;
}

// The text a heading field shows: the owning copy key for a title / intro
// that has one, otherwise copy.sectionTitles[id][key]. '' for anything that
// is not a string (a saved row may hold anything).
export function headingValue(copy, row, key) {
  let v;
  if (key === 'title' && row?.titleFrom) v = getPath(copy, row.titleFrom);
  else if (key === 'intro' && row?.introFrom) v = getPath(copy, row.introFrom);
  else {
    const titles = isObj(copy?.sectionTitles) ? copy.sectionTitles : null;
    const entry = titles && isObj(titles[row?.id]) ? titles[row.id] : null;
    v = entry ? entry[key] : undefined;
  }
  return typeof v === 'string' ? v : '';
}

// Drops blank values and entries left empty, so the saved object only holds
// what the owner typed. Values are kept as typed (a trailing space while the
// owner is mid-word must survive); readers trim.
function cleanTitles(titles) {
  const out = {};
  for (const [id, entry] of Object.entries(titles)) {
    if (!isObj(entry)) continue;
    const kept = {};
    for (const [k, v] of Object.entries(entry)) {
      if (typeof v === 'string' && v.trim() !== '') kept[k] = v;
    }
    if (Object.keys(kept).length) out[id] = kept;
  }
  return Object.keys(out).length ? out : null;
}

// copy.sectionTitles with one field changed: a new, cleaned object, or null
// when nothing is left. '' (or blank) removes the field. Never mutates.
export function setSectionTitle(sectionTitles, id, key, value) {
  const base = isObj(sectionTitles) ? sectionTitles : {};
  const next = {};
  for (const [k, entry] of Object.entries(base)) if (isObj(entry)) next[k] = { ...entry };
  next[id] = { ...(next[id] || {}), [key]: typeof value === 'string' ? value : '' };
  return cleanTitles(next);
}

// The live check under "Highlighted words": the same whole-word,
// case-insensitive match the templates use (kit splitAccent), so what the
// preview shows is what the page highlights. fallbackTitle is the design's
// own heading (the template's headingDefaults): while the owner's heading
// field is empty the page shows that one and highlights the words in it,
// so they are checked against it (design: true). tone null: nothing to
// check.
export function accentStatus(title, accent, fallbackTitle = '') {
  const a = typeof accent === 'string' ? accent.trim() : '';
  if (!a) return { tone: null };
  const own = typeof title === 'string' ? title.trim() : '';
  const t = own || (typeof fallbackTitle === 'string' ? fallbackTitle.trim() : '');
  if (!t) return { tone: 'warn', text: 'Type a heading first: highlighted words must be part of it.' };
  const parts = splitAccent(t, a);
  if (!parts) return { tone: 'error', text: `"${a}" isn't in the heading as whole words, so nothing is highlighted. Use whole words from the heading.` };
  return own ? { tone: 'ok', parts } : { tone: 'ok', parts, design: true };
}

// What an empty Highlighted words field does on the page, for a template
// that says (headingDefaults): the design's own pick, or no highlight.
export function emptyAccentText(defaultAccent) {
  const d = typeof defaultAccent === 'string' ? defaultAccent.trim() : '';
  return d ? `Empty: the design highlights "${d}".` : 'Empty: nothing is highlighted.';
}

// The template's headingDefaults (its own heading text per section) for
// this site, with businessInfo as the template receives it; null when the
// template exports none, or it threw on odd data (the panels then fall
// back to their generic text).
export function designDefaults(headingDefaults, businessInfo, copy) {
  if (typeof headingDefaults !== 'function') return null;
  try {
    const d = headingDefaults(normalizeBusinessInfo(businessInfo || {}), copy || {});
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}
