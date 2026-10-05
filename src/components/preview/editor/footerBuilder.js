// Data helpers for the footer builder (FooterBuilderPanel.jsx): the footer's
// columns in the owner's order and the cleaned copy.footer a change writes.
// Pure, so the tests run them without a DOM.
//
// copy.footer = { columns?: [{ type, title?, show? }], showCta?, ctaText?,
// ctaUrl?, bottomText? } | null. Absent (or no columns array) is the design's
// own footer: every column, in FOOTER_TYPES order, with its default title.
// The reading rules here must stay the same as the template kit's
// (footerColumnsOf), which renders what this panel lists: known types in the
// owner's order, the first entry of a type wins, show !== false, and a type
// missing from a saved array is hidden (the panel always writes all five).

import { serviceAreasOf } from '../templates/kit/content.js';

export const FOOTER_TYPES = ['brand', 'links', 'areas', 'contact', 'hours'];

export const FOOTER_LABELS = {
  brand: 'Logo & tagline',
  links: 'Explore links',
  areas: 'Areas served',
  contact: 'Get in touch',
  hours: 'Hours',
};

// What the template prints when a column has no title of its own (the
// brand column has none).
export const FOOTER_DEFAULT_TITLES = {
  links: 'Explore',
  areas: 'Service Areas',
  contact: 'Get In Touch',
  hours: 'Hours',
};

// The text fields of copy.footer: '' removes them (an empty button text
// means the default label, an empty link means the booking form).
const TEXT_FIELDS = ['ctaText', 'ctaUrl', 'bottomText'];

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// [{ type, title, show }] for every type: the saved ones in the owner's
// order, then any type the saved array leaves out, hidden.
export function footerColumns(footer) {
  if (!isObj(footer) || !Array.isArray(footer.columns)) {
    return FOOTER_TYPES.map((type) => ({ type, title: '', show: true }));
  }
  const seen = new Set();
  const out = [];
  for (const c of footer.columns) {
    if (!isObj(c) || !FOOTER_TYPES.includes(c.type) || seen.has(c.type)) continue;
    seen.add(c.type);
    // Titles are kept as typed (a trailing space mid-word must survive the
    // next render); the template trims them. A number reads as its text, as
    // in the kit.
    const title = typeof c.title === 'string' ? c.title : typeof c.title === 'number' ? String(c.title) : '';
    out.push({ type: c.type, title, show: c.show !== false });
  }
  for (const type of FOOTER_TYPES) if (!seen.has(type)) out.push({ type, title: '', show: false });
  return out;
}

// The design's own columns: default order, all shown, no custom titles.
export function isDefaultColumns(cols) {
  return Array.isArray(cols)
    && cols.length === FOOTER_TYPES.length
    && cols.every((c, i) => isObj(c) && c.type === FOOTER_TYPES[i] && c.show === true && !(typeof c.title === 'string' && c.title.trim()));
}

// Drops what equals the default (blank text, showCta true) so the saved
// object only holds the owner's choices; null when nothing is left.
function cleanFooter(footer) {
  const out = {};
  for (const [k, v] of Object.entries(footer)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'showCta' && v === true) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// copy.footer with these columns: the columns key is left out when they are
// the design's default, so "back to default" stores nothing. Other keys are
// kept.
export function withColumns(footer, cols) {
  const next = isObj(footer) ? { ...footer } : {};
  delete next.columns;
  if (Array.isArray(cols) && !isDefaultColumns(cols)) {
    next.columns = cols.map(({ type, title, show }) => ({ type, ...(title ? { title } : {}), show: show !== false }));
  }
  return cleanFooter(next);
}

// One column's switch or title. patch: { show?, title? }.
export function setColumn(footer, type, patch) {
  const p = isObj(patch) ? patch : {};
  const cols = footerColumns(footer).map((c) => {
    if (c.type !== type) return c;
    const next = { ...c };
    if ('show' in p) next.show = Boolean(p.show);
    if ('title' in p) next.title = typeof p.title === 'string' ? p.title : '';
    return next;
  });
  return withColumns(footer, cols);
}

// Moves the column at `from` to `to` (indexes into footerColumns(footer)).
export function moveColumn(footer, from, to) {
  const cols = footerColumns(footer);
  if (from === to || from < 0 || to < 0 || from >= cols.length || to >= cols.length) return withColumns(footer, cols);
  const next = [...cols];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return withColumns(footer, next);
}

// One of the button / bottom-line fields. showCta: only false is stored
// (absent means the button shows); text fields: '' removes the key.
export function setFooterField(footer, key, value) {
  const next = isObj(footer) ? { ...footer } : {};
  if (key === 'showCta') {
    if (value === false) next.showCta = false;
    else delete next.showCta;
  } else if (TEXT_FIELDS.includes(key)) {
    if (typeof value === 'string' && value !== '') next[key] = value;
    else delete next[key];
  }
  return cleanFooter(next);
}

// True when the shown Hours column comes right after the shown Get in touch
// column (hidden columns in between do not count): the template then prints
// the hours inside the contact column, as the design's own footer does.
export function hoursMerged(cols) {
  const shown = (Array.isArray(cols) ? cols : []).filter((c) => isObj(c) && c.show !== false);
  const i = shown.findIndex((c) => c.type === 'hours');
  return i > 0 && shown[i - 1].type === 'contact';
}

// The columns the template leaves out for lack of content, from what
// Business Info holds (the same facts MobileRedline's footer lists): areas
// (serviceAreasOf, which falls back to the city), contact (phone, email,
// social links, city / state) and hours. A Set of types.
export function emptyColumns(businessInfo) {
  const biz = isObj(businessInfo) ? businessInfo : {};
  const has = (v) => typeof v === 'string' && v.trim() !== '';
  const out = new Set();
  if (serviceAreasOf(biz).length === 0) out.add('areas');
  if (!['phone', 'email', 'instagram', 'facebook', 'tiktok', 'city', 'state'].some((k) => has(biz[k]))) out.add('contact');
  const h = biz.hours;
  const hours = has(h) || (isObj(h) && Object.values(h).some((v) => has(v)));
  if (!hours) out.add('hours');
  return out;
}
