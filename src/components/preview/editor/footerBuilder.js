// Data helpers for the footer builder (FooterBuilderPanel.jsx): the footer's
// columns in the owner's order and the cleaned copy.footer a change writes.
// Pure, so the tests run them without a DOM.
//
// copy.footer = { columns?: [{ type, title?, show? }], showCta?, ctaText?,
// ctaUrl?, bottomText? } | null. Absent (or no columns array) is the design's
// own footer: the template's footerSpec columns (useTemplateInfo), in their
// order and with their show flags and default titles. Without a spec,
// DEFAULT_SPEC: Redline's footer (all five columns, hours merged under Get
// In Touch, the button on). The reading rules here must stay the same as the
// template kit's (footerColumnsOf / footerPlan in kit/features.js), which
// renders what this panel lists: the spec's types in the owner's order, the
// first entry of a type wins, show !== false, and a type missing from a saved
// array is hidden (the panel always writes every type).

import { serviceAreasOf } from '../templates/kit/content.js';
import { serviceList } from './serviceRefs.js';

export const FOOTER_TYPES = ['brand', 'links', 'areas', 'contact', 'hours'];

export const FOOTER_LABELS = {
  brand: 'Logo & tagline',
  links: 'Explore links',
  services: 'Services list',
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

// The footer a template declares (its footerSpec export, see kit/features.js
// footerPlan): { columns: [{ type, show }], titles, mergeHours, cta,
// ctaLabel, notes? }. DEFAULT_SPEC is Redline's, for callers without one.
export const DEFAULT_SPEC = {
  columns: FOOTER_TYPES.map((type) => ({ type, show: true })),
  titles: FOOTER_DEFAULT_TITLES,
  mergeHours: true,
  cta: true,
  ctaLabel: 'Request Appointment',
};

// A usable spec: the template's when it lists columns, else DEFAULT_SPEC.
export function footerSpecOf(spec) {
  if (!isObj(spec) || !Array.isArray(spec.columns)) return DEFAULT_SPEC;
  const seen = new Set();
  const columns = spec.columns.filter((c) => isObj(c) && typeof c.type === 'string' && FOOTER_LABELS[c.type] && !seen.has(c.type) && seen.add(c.type));
  return {
    ...spec,
    columns,
    titles: isObj(spec.titles) ? spec.titles : {},
    notes: isObj(spec.notes) ? spec.notes : {},
  };
}

// [{ type, title, show }] for every type of the spec: the saved ones in the
// owner's order, then any type the saved array leaves out, hidden.
export function footerColumns(footer, spec) {
  const sp = footerSpecOf(spec);
  const types = sp.columns.map((c) => c.type);
  if (!isObj(footer) || !Array.isArray(footer.columns)) {
    return sp.columns.map((c) => ({ type: c.type, title: '', show: c.show !== false }));
  }
  const seen = new Set();
  const out = [];
  for (const c of footer.columns) {
    if (!isObj(c) || !types.includes(c.type) || seen.has(c.type)) continue;
    seen.add(c.type);
    // Titles are kept as typed (a trailing space mid-word must survive the
    // next render); the template trims them. A number reads as its text, as
    // in the kit.
    const title = typeof c.title === 'string' ? c.title : typeof c.title === 'number' ? String(c.title) : '';
    out.push({ type: c.type, title, show: c.show !== false });
  }
  for (const type of types) if (!seen.has(type)) out.push({ type, title: '', show: false });
  return out;
}

// The design's own columns: the spec's order and show flags, no custom
// titles.
export function isDefaultColumns(cols, spec) {
  const def = footerSpecOf(spec).columns;
  return Array.isArray(cols)
    && cols.length === def.length
    && cols.every((c, i) => isObj(c) && c.type === def[i].type && c.show === (def[i].show !== false) && !(typeof c.title === 'string' && c.title.trim()));
}

// Whether the footer button shows while the owner saved no choice.
const ctaDefault = (spec) => footerSpecOf(spec).cta === true;

// Drops what equals the default (blank text, a showCta equal to the
// design's) so the saved object only holds the owner's choices; null when
// nothing is left.
function cleanFooter(footer, spec) {
  const out = {};
  for (const [k, v] of Object.entries(footer)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'showCta' && v === ctaDefault(spec)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// copy.footer with these columns: the columns key is left out when they are
// the design's default, so "back to default" stores nothing. Other keys are
// kept.
export function withColumns(footer, cols, spec) {
  const next = isObj(footer) ? { ...footer } : {};
  delete next.columns;
  if (Array.isArray(cols) && !isDefaultColumns(cols, spec)) {
    next.columns = cols.map(({ type, title, show }) => ({ type, ...(title ? { title } : {}), show: show !== false }));
  }
  return cleanFooter(next, spec);
}

// One column's switch or title. patch: { show?, title? }.
export function setColumn(footer, type, patch, spec) {
  const p = isObj(patch) ? patch : {};
  const cols = footerColumns(footer, spec).map((c) => {
    if (c.type !== type) return c;
    const next = { ...c };
    if ('show' in p) next.show = Boolean(p.show);
    if ('title' in p) next.title = typeof p.title === 'string' ? p.title : '';
    return next;
  });
  return withColumns(footer, cols, spec);
}

// Moves the column at `from` to `to` (indexes into footerColumns(footer, spec)).
export function moveColumn(footer, from, to, spec) {
  const cols = footerColumns(footer, spec);
  if (from === to || from < 0 || to < 0 || from >= cols.length || to >= cols.length) return withColumns(footer, cols, spec);
  const next = [...cols];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return withColumns(footer, next, spec);
}

// One of the button / bottom-line fields. showCta: stored only when it
// differs from the design's default (spec.cta; Redline shows the button, so
// only false is stored there); text fields: '' removes the key.
export function setFooterField(footer, key, value, spec) {
  const next = isObj(footer) ? { ...footer } : {};
  if (key === 'showCta') {
    if (typeof value === 'boolean' && value !== ctaDefault(spec)) next.showCta = value;
    else delete next.showCta;
  } else if (TEXT_FIELDS.includes(key)) {
    if (typeof value === 'string' && value !== '') next[key] = value;
    else delete next[key];
  }
  return cleanFooter(next, spec);
}

// Whether the footer button shows: the owner's saved choice, else the
// design's default.
export function footerShowsCta(footer, spec) {
  return typeof footer?.showCta === 'boolean' ? footer.showCta : ctaDefault(spec);
}

// True when the shown Hours column comes right after the shown Get in touch
// column (hidden columns in between do not count) in a design that merges
// them (spec.mergeHours): the template then prints the hours inside the
// contact column, as Redline's own footer does.
export function hoursMerged(cols, spec) {
  if (footerSpecOf(spec).mergeHours !== true) return false;
  const shown = (Array.isArray(cols) ? cols : []).filter((c) => isObj(c) && c.show !== false);
  const i = shown.findIndex((c) => c.type === 'hours');
  return i > 0 && shown[i - 1].type === 'contact';
}

// The contact column's facts in Redline's footer; a footerSpec lists its
// own (spec.contactFields), and with spec.socialWhenBrandOff the social
// links join them while the logo column is off.
const DEFAULT_CONTACT_FIELDS = ['phone', 'email', 'instagram', 'facebook', 'tiktok', 'city', 'state'];
const SOCIAL_FIELDS = ['instagram', 'facebook', 'tiktok'];

// The columns the template leaves out for lack of content, from what
// Business Info holds (the same facts the template's footer lists): areas
// (serviceAreasOf, which falls back to the city), contact (the spec's
// contactFields), hours and, where the spec has one, the services list
// (named services while the Services section shows). `cols`: the panel's
// columns (footerColumns), for where the social links sit. A Set of types.
export function emptyColumns(businessInfo, spec = null, { copy = null, cols = null } = {}) {
  const biz = isObj(businessInfo) ? businessInfo : {};
  const sp = footerSpecOf(spec);
  const has = (v) => typeof v === 'string' && v.trim() !== '';
  const out = new Set();
  if (serviceAreasOf(biz).length === 0) out.add('areas');
  const brandOff = Array.isArray(cols) && !cols.some((c) => isObj(c) && c.type === 'brand' && c.show !== false);
  const contactFields = [
    ...(Array.isArray(sp.contactFields) ? sp.contactFields : DEFAULT_CONTACT_FIELDS),
    ...(sp.socialWhenBrandOff === true && brandOff ? SOCIAL_FIELDS : []),
  ];
  if (!contactFields.some((k) => has(biz[k]))) out.add('contact');
  if (sp.columns.some((c) => c.type === 'services')) {
    const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('services');
    if (hidden || serviceList(biz, copy).length === 0) out.add('services');
  }
  const h = biz.hours;
  const hours = has(h) || (isObj(h) && Object.values(h).some((v) => has(v)));
  if (!hours) out.add('hours');
  return out;
}
