// Pure logic behind the Design Studio's option controls (PaletteField,
// FontField, SectionsField, LayoutField and FactsField in this folder).
// Each control is controlled over one part of the levers shape
// (src/lib/designLevers.js): it gets that part as `value` and hands the
// next one to `onChange`. The rules (what can be hidden, what a reset
// means, what reads well, how a typed list splits) live here so they are
// tested without a DOM and the components stay thin.
//
// Nothing here mutates its input. What the controls produce still goes
// through sanitizeLevers() before it is previewed or saved, so these
// helpers keep the shape tidy; they are not the safety net.
import { ALWAYS_SHOWN, COLOR_ROLES, FACT_LISTS, FACT_TEXTS, fullSectionOrder, leverPatch } from '../../../lib/designLevers.js';
import { sectionIdsFor, sectionLabel } from '../../../data/templateSections.js';
import { brandAccent } from '../../../lib/customSiteDesign.js';
import { buildFontHref, catalogFamily, familyFromStack } from '../../../lib/fontCatalog.js';
import { allFontFamilies } from '../../../data/fontPairings.js';
import { contrastRatio, deriveTheme, luminance } from '../../preview/templates/kit/theme.js';

// ─── Shared look ─────────────────────────────────────────────────────
// The setup page's classes (CustomSiteDesign.jsx), so the studio's
// controls sit in it without looking bolted on.

export const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 disabled:hover:border-black/[0.12] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
export const BTN_SMALL = 'inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-40 disabled:hover:border-black/[0.12] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
export const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.12] text-sm bg-white focus:outline-none focus:border-[#cc0000]';
export const LABEL = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1';
export const HINT = 'block mt-1 text-[11px] text-ink-tertiary';

// ─── Palette ─────────────────────────────────────────────────────────

// Same order as COLOR_ROLES (the test pins it).
export const PALETTE_ROLES = Object.freeze([
  { role: 'bg', label: 'Background', hint: 'The page behind everything.' },
  { role: 'secondary', label: 'Surface / Secondary', hint: 'Cards, bands and alternating sections.' },
  { role: 'text', label: 'Text', hint: 'Headings and paragraphs.' },
  { role: 'muted', label: 'Muted text', hint: 'Captions, labels and small print.' },
  { role: 'accent', label: 'Accent', hint: 'Buttons, links and highlights.' },
]);

const HEX6 = /^[0-9a-f]{6}$/;
const HEX3 = /^[0-9a-f]{3}$/;

// A typed hex as '#rrggbb', or '' while it isn't a color yet ('#ab',
// 'blue'). Takes 'ABC', '#abc' and 'aabbcc' too: people paste all three.
export function normalizeHex(input) {
  const s = String(input ?? '').trim().replace(/^#/, '').toLowerCase();
  if (HEX6.test(s)) return `#${s}`;
  if (HEX3.test(s)) return `#${s.split('').map((ch) => ch + ch).join('')}`;
  return '';
}

// The five colors the page starts from: the admin's picks over the
// template's own. A role neither sets (a template without `muted`) gets
// what deriveTheme() paints in its place, so the swatches and the
// readability check show what the page shows.
export function effectivePalette(palette, defaults) {
  const out = {};
  for (const role of COLOR_ROLES) out[role] = normalizeHex(palette?.[role]) || normalizeHex(defaults?.[role]);
  const t = deriveTheme(out);
  const derived = { bg: t.bg, secondary: t.surface, text: t.text, muted: t.textMuted, accent: t.accent };
  for (const role of COLOR_ROLES) if (!out[role]) out[role] = derived[role];
  return out;
}

// levers.palette with one role picked. '' (or null) clears the role back
// to the template's color; text that isn't a color yet changes nothing.
export function setPaletteRole(palette, role, hex) {
  const next = { ...(palette || {}) };
  if (!COLOR_ROLES.includes(role)) return next;
  if (hex === '' || hex == null) {
    delete next[role];
    return next;
  }
  const v = normalizeHex(hex);
  if (v) next[role] = v;
  return next;
}

export function resetPaletteRole(palette, role) {
  return setPaletteRole(palette, role, '');
}

// Has the admin picked any color? (An empty palette keeps the template's.)
export function hasPalettePicks(palette) {
  return COLOR_ROLES.some((role) => !!normalizeHex(palette?.[role]));
}

// The customer's brand color as the accent on the page's background (the
// picked one, else the template's): brandAccent() nudges it just enough
// to stand off the page and skips neutral colors. '' when none of their
// colors works as a highlight there.
export function brandAccentFor(palette, defaults, brandHexes) {
  return brandAccent(effectivePalette(palette, defaults).bg, brandHexes).accent || '';
}

// WCAG AA for text, and 3:1 for buttons and highlights against the page
// (the bar brandAccent() uses).
export const TEXT_MIN = 4.5;
export const UI_MIN = 3;

// Does this template repair low-contrast text on its own? The theme-ready
// templates (the ones TEMPLATE_SECTIONS lists) paint through deriveTheme();
// the older ones paint templateMeta.colors exactly as picked, with button
// text colors of their own, so nothing there gets fixed for the admin.
export function repairsContrast(templateId) {
  return sectionIdsFor(templateId).length > 0;
}

// The color pairs worth checking, as picked and as the site will paint
// them. deriveTheme() repairs text colors that fall short (it nudges them
// toward white or black, against the background and the surface), so on
// a template that `repairs` (repairsContrast) a pick that fails can still
// read fine on the page: that is 'adjusted', and `shown` says what the
// site uses instead. Fills (background, surface, accent) are never
// changed, so a button label that can't read on the accent, or an accent
// that melts into the page, is 'fail'. Without repairs, `shown` is the
// pick itself and a pair either passes or fails; the button-text row is
// then a best case (white or dark, whichever reads), because older
// templates fix their own button text color.
//   [{ id, label, fg, bg, ratio, min, status: 'pass'|'adjusted'|'fail',
//      shown: { fg, bg, ratio } }]
export function readabilityRows(palette, defaults, { repairs = true } = {}) {
  const c = effectivePalette(palette, defaults);
  const t = repairs
    ? deriveTheme(c)
    : { bg: c.bg, surface: c.secondary, text: c.text, textMuted: c.muted, accent: c.accent, onAccent: deriveTheme(c).onAccent };
  const row = (id, label, fg, bg, shownFg, shownBg, min) => {
    const ratio = contrastRatio(fg, bg);
    const shownRatio = contrastRatio(shownFg, shownBg);
    const status = ratio >= min ? 'pass' : shownRatio >= min ? 'adjusted' : 'fail';
    return { id, label, fg, bg, ratio, min, status, shown: { fg: shownFg, bg: shownBg, ratio: shownRatio } };
  };
  return [
    row('text', 'Text on background', c.text, c.bg, t.text, t.bg, TEXT_MIN),
    row('muted', 'Muted text on background', c.muted, c.bg, t.textMuted, t.bg, TEXT_MIN),
    row('surface', 'Text on surface', c.text, c.secondary, t.text, t.surface, TEXT_MIN),
    row('onAccent', 'Button text on accent', t.onAccent, c.accent, t.onAccent, t.accent, TEXT_MIN),
    row('accent', 'Accent against background', c.accent, c.bg, c.accent, c.bg, UI_MIN),
  ];
}

// "4.4:1". Rounded down, so a pair just under the bar never reads as
// "4.5:1" next to a warning.
export function ratioLabel(ratio) {
  return `${(Math.floor((Number(ratio) || 0) * 10) / 10).toFixed(1)}:1`;
}

const FAIL_ADVICE = {
  text: 'Pick a text color further from the background.',
  muted: 'Pick a muted color further from the background.',
  surface: 'Text can\'t read on both the background and this surface: bring the surface closer to the background.',
  onAccent: 'Neither white nor dark text reads on this accent: make the accent darker or lighter.',
  accent: 'Buttons and highlights blend into the page: pick an accent further from the background.',
};

// One line for a readability row, in plain words.
export function readabilityNote(row) {
  if (row.status === 'pass') return `Reads well (${ratioLabel(row.ratio)}).`;
  if (row.status === 'adjusted') {
    const way = luminance(row.shown.fg) > luminance(row.fg) ? 'lightens' : 'darkens';
    return `Low contrast as picked (${ratioLabel(row.ratio)}): the site ${way} it to ${row.shown.fg} (${ratioLabel(row.shown.ratio)}).`;
  }
  return `${ratioLabel(row.ratio)}, needs ${row.min}:1. ${FAIL_ADVICE[row.id] || ''}`.trim();
}

// ─── Fonts ───────────────────────────────────────────────────────────

// A family name or CSS stack ("'Inter', sans-serif") as its catalog
// family, or ''. Template metadata stores stacks; levers store families.
export function toFamily(value) {
  return catalogFamily(familyFromStack(value) || '') || '';
}

// levers.fonts with one slot ('heading' | 'body') set. '' clears it back
// to the template's font; a family outside FONT_CATALOG clears it too,
// because it would silently fall back on the published page.
export function setFontSlot(fonts, slot, family) {
  const next = { ...(fonts || {}) };
  if (slot !== 'heading' && slot !== 'body') return next;
  const f = toFamily(family);
  if (f) next[slot] = f;
  else delete next[slot];
  return next;
}

// levers.fonts for a pairing from src/data/fontPairings.js.
export function applyPairing(pairing) {
  return setFontSlot(setFontSlot({}, 'heading', pairing?.heading), 'body', pairing?.body);
}

// The picker's option groups for one slot: every catalog family for
// headings, text faces only for the body (allFontFamilies). A current
// family the list leaves out (a display face the suggestion put in the
// body) is kept as a "Current" group so the select can still show it.
export function fontOptionGroups(slot, current) {
  const groups = allFontFamilies(slot === 'body' ? { role: 'body' } : {});
  const family = toFamily(current);
  if (family && !groups.some((g) => g.families.some((f) => f.family === family))) {
    return [{ id: 'current', label: 'Current', families: [{ family }] }, ...groups];
  }
  return groups;
}

// One Google Fonts stylesheet URL per catalog family, deduped, so each
// family loads once however often the picker re-renders.
export function fontLinkHrefs(families) {
  const out = [];
  for (const value of Array.isArray(families) ? families : []) {
    const family = toFamily(value);
    const href = family ? buildFontHref([family]) : null;
    if (href && !out.includes(href)) out.push(href);
  }
  return out;
}

// ─── Sections ────────────────────────────────────────────────────────

// Does this template have section controls? (Only theme-ready ones do.)
export function sectionsSupported(templateId) {
  return sectionIdsFor(templateId).length > 0;
}

// The order the controls show: the chosen order completed with the
// template's remaining ids, else the template's own order.
export function currentSectionOrder(sections, templateId) {
  const full = fullSectionOrder(sections?.order, templateId);
  return full.length ? full : sectionIdsFor(templateId);
}

// levers.sections kept tidy: an order identical to the template's is
// stored as [] (no lever set), and hidden keeps only this template's ids
// that may be hidden (never ALWAYS_SHOWN).
function tidySections(order, hidden, templateId) {
  const ids = sectionIdsFor(templateId);
  const full = fullSectionOrder(order, templateId);
  const same = full.length === ids.length && full.every((id, i) => id === ids[i]);
  const keep = (Array.isArray(hidden) ? hidden : []).filter((id) => ids.includes(id) && !ALWAYS_SHOWN.includes(id));
  return { order: same ? [] : full, hidden: [...new Set(keep)] };
}

// One row per section, top to bottom:
//   { id, label, index, hidden, locked (can't be hidden), first, last }
export function sectionRows(sections, templateId) {
  const order = currentSectionOrder(sections, templateId);
  const hidden = new Set(Array.isArray(sections?.hidden) ? sections.hidden : []);
  return order.map((id, index) => {
    const locked = ALWAYS_SHOWN.includes(id);
    return {
      id,
      label: sectionLabel(templateId, id),
      index,
      hidden: !locked && hidden.has(id),
      locked,
      first: index === 0,
      last: index === order.length - 1,
    };
  });
}

// Moves one section `delta` places (-1 up, +1 down). Past either end it
// stays put.
export function moveSection(sections, templateId, id, delta) {
  const order = currentSectionOrder(sections, templateId);
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length || to === from) return tidySections(sections?.order, sections?.hidden, templateId);
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return tidySections(next, sections?.hidden, templateId);
}

// Shows a hidden section or hides a shown one. The hero and the contact
// section (ALWAYS_SHOWN) can't be hidden.
export function toggleSectionHidden(sections, templateId, id) {
  const hidden = Array.isArray(sections?.hidden) ? sections.hidden : [];
  const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
  return tidySections(sections?.order, next, templateId);
}

// Back to the template's own order; what is hidden stays hidden.
export function resetSectionOrder(sections, templateId) {
  return tidySections([], sections?.hidden, templateId);
}

// ─── Layout ──────────────────────────────────────────────────────────

export const MAX_STATS = 3;
// sanitizeLevers() caps a stat at these lengths.
export const STAT_LIMITS = Object.freeze({ value: 20, label: 40 });

// Which layout levers reach this template: asked of leverPatch() itself,
// so the controls offer exactly what the site will use (Redline has no
// full/split hero; only theme-ready templates switch layouts; aboutStats
// goes where the template reads it).
export function layoutOptions(templateId) {
  const probe = leverPatch({ heroLayout: 'split', aboutLayout: 'stats', aboutStats: [{ value: '1', label: 'x' }] }, templateId).copy;
  return { hero: 'heroLayout' in probe, about: 'aboutLayout' in probe, stats: 'aboutStats' in probe };
}

// The layout slice of levers, with every key present.
export function layoutPart(levers) {
  return {
    heroLayout: typeof levers?.heroLayout === 'string' ? levers.heroLayout : '',
    aboutLayout: typeof levers?.aboutLayout === 'string' ? levers.aboutLayout : '',
    aboutStats: Array.isArray(levers?.aboutStats) ? levers.aboutStats : [],
  };
}

// Stat rows keep what is typed (spaces and all) so the inputs behave;
// sanitizeLevers() trims them and drops half-filled rows.
export function setStat(stats, index, patch) {
  const list = Array.isArray(stats) ? stats : [];
  return list.map((s, i) => (i === index ? {
    value: String(patch?.value ?? s?.value ?? '').slice(0, STAT_LIMITS.value),
    label: String(patch?.label ?? s?.label ?? '').slice(0, STAT_LIMITS.label),
  } : s));
}

export function addStat(stats) {
  const list = Array.isArray(stats) ? stats : [];
  return list.length >= MAX_STATS ? list : [...list, { value: '', label: '' }];
}

export function removeStat(stats, index) {
  return (Array.isArray(stats) ? stats : []).filter((_, i) => i !== index);
}

// Rows with a number but no label (or the other way round): the site
// leaves those out, so the field says so.
export function incompleteStats(stats) {
  const out = [];
  (Array.isArray(stats) ? stats : []).forEach((s, i) => {
    const v = String(s?.value ?? '').trim();
    const l = String(s?.label ?? '').trim();
    if (!!v !== !!l) out.push(i);
  });
  return out;
}

// ─── Facts ───────────────────────────────────────────────────────────

// Same keys and order as FACT_TEXTS / FACT_LISTS (the test pins it).
export const FACT_TEXT_FIELDS = Object.freeze([
  { key: 'tagline', label: 'Tagline', hint: 'Their own slogan, word for word.' },
  { key: 'yearsInBusiness', label: 'Years in business', hint: 'Just the number, e.g. "12". Only what they told you.' },
  { key: 'warranty', label: 'Warranty', hint: 'Their warranty in their words. Leave empty if they never mentioned one.' },
]);

export const FACT_LIST_FIELDS = Object.freeze([
  { key: 'awards', label: 'Awards', hint: 'Awards they actually won.' },
  { key: 'certifications', label: 'Certifications', hint: 'Certifications they hold (installer programs, ASE...).' },
  { key: 'paymentMethods', label: 'Payment methods', hint: 'How customers can pay.' },
  { key: 'serviceAreas', label: 'Service areas', hint: 'Cities or neighborhoods they cover.' },
]);

// The same separators and per-item clean-up as sanitizeLevers() (the
// test checks they agree), so what the field counts is what gets saved.
const LIST_SPLIT = /[\n,;\u00b7|]+/;
const ITEM_MAX = 80;

function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Every distinct item in a typed list ("A, B" or one per line), uncapped.
export function splitFactList(text) {
  const items = Array.isArray(text) ? text : typeof text === 'string' ? text.split(LIST_SPLIT) : [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const s = oneLine(item, ITEM_MAX);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

// The items levers.facts[key] keeps: the first FACT_LISTS[key] of them.
export function parseFactList(text, key) {
  return splitFactList(text).slice(0, FACT_LISTS[key] || 0);
}

export function formatFactList(list) {
  return (Array.isArray(list) ? list : []).join('\n');
}

export function sameList(a, b) {
  const x = Array.isArray(a) ? a : [];
  const y = Array.isArray(b) ? b : [];
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

// levers.facts with one text fact set. Kept as typed (capped) so the
// input behaves; empty or blank removes the fact.
export function setFactText(facts, key, text) {
  const next = { ...(facts || {}) };
  if (!(key in FACT_TEXTS)) return next;
  const s = typeof text === 'string' ? text.slice(0, FACT_TEXTS[key]) : '';
  if (s.trim()) next[key] = s;
  else delete next[key];
  return next;
}

// A warning for a text fact the templates would garble, or ''. Older
// templates print years in business as "12+" and work out "since 2014"
// with parseInt(), so "Since 2009" or "12+" would show as "Since 2009+"
// or "Since NaN" there (the owner's own form takes a number too).
export function factTextWarning(key, text) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (key === 'yearsInBusiness' && s && !/^\d{1,3}$/.test(s)) {
    return 'Enter just the number of years: some templates add "years" or "+" themselves, or work out a "since" year from it.';
  }
  return '';
}

// levers.facts with one list fact set; an empty list removes it.
export function setFactList(facts, key, items) {
  const next = { ...(facts || {}) };
  if (!(key in FACT_LISTS)) return next;
  const list = parseFactList(items, key);
  if (list.length) next[key] = list;
  else delete next[key];
  return next;
}

// facts.insured as the field's choice: 'yes' | 'no' | '' (not said).
export function insuredChoice(facts) {
  if (facts?.insured === true) return 'yes';
  if (facts?.insured === false) return 'no';
  return '';
}

export function setInsured(facts, choice) {
  const next = { ...(facts || {}) };
  if (choice === 'yes') next.insured = true;
  else if (choice === 'no') next.insured = false;
  else delete next.insured;
  return next;
}
