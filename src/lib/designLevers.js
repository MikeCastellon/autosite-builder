// The Design Studio's settings for a custom website ("levers"): what the admin
// (or Opus's "Suggest a design") picks beyond the business facts. Stored in
// custom_site_projects.design.levers. leverPatch() turns them into the copy
// keys, business-info keys, colors and fonts the templates already read, and
// both the setup's live preview and the real run
// (custom-site-design-background) go through it, so the two cannot drift.
//
// Every lever is optional: an empty lever leaves the template's own default.
// Nothing here changes a template, so free sites and published sites are
// untouched; a lever only reaches a site when its custom project is written.
import { FONT_CATALOG } from './fontCatalog.js';
import { BODY_FONTS, HEADING_FONTS } from '../data/fontOptions.js';
import { templateReads } from '../components/preview/editorCapabilities.js';
import { sectionIdsFor, templateSectionsFor } from '../data/templateSections.js';

export const COLOR_ROLES = Object.freeze(['bg', 'secondary', 'text', 'muted', 'accent']);
export const HERO_LAYOUTS = Object.freeze(['full', 'split']);
export const ABOUT_LAYOUTS = Object.freeze(['image', 'stats']);
// Sections the page can't do without: the hero is the page's top, and the
// contact section holds the booking and contact targets.
export const ALWAYS_SHOWN = Object.freeze(['hero', 'cta']);
// Redline is the one theme-ready template without the full/split hero.
const NO_HERO_LAYOUT = new Set(['mobile_redline', 'mobile_driveway']);

export const FACT_LISTS = Object.freeze({ awards: 8, certifications: 8, paymentMethods: 10, serviceAreas: 20 });
export const FACT_TEXTS = Object.freeze({ tagline: 120, yearsInBusiness: 40, warranty: 200 });

const HEX = /^#[0-9a-f]{6}$/i;

export function emptyLevers() {
  return { palette: {}, fonts: {}, sections: { order: [], hidden: [] }, heroLayout: '', aboutLayout: '', aboutStats: [], facts: {}, googlePlace: null };
}

// A real FONT_CATALOG family (own key: 'constructor' and friends are not).
export function isCatalogFamily(family) {
  return typeof family === 'string' && Object.prototype.hasOwnProperty.call(FONT_CATALOG, family);
}

// The editor's own stack for a family, so its font dropdowns recognize a
// font the Studio picked (they compare the whole stack string).
const EDITOR_STACKS = new Map([...HEADING_FONTS, ...BODY_FONTS].map((o) => [/^'([^']+)'/.exec(o.family)?.[1], o.family]));

// "'Inter', sans-serif" for a catalog family, '' for anything else. Fonts
// outside FONT_CATALOG would silently fall back on the published page.
export function fontStack(family) {
  if (!isCatalogFamily(family)) return '';
  if (EDITOR_STACKS.has(family)) return EDITOR_STACKS.get(family);
  const f = FONT_CATALOG[family];
  const fallback = { serif: 'Georgia, serif', mono: 'monospace' }[f.category] || 'sans-serif';
  return `'${family}', ${fallback}`;
}

// The catalog family a stack starts with, or ''.
export function familyOf(stack) {
  const m = /^\s*'([^']+)'/.exec(typeof stack === 'string' ? stack : '');
  return m && isCatalogFamily(m[1]) ? m[1] : '';
}

// Owner-facing text on one line, capped.
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function textList(v, maxItems, maxLen = 80) {
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\n,;·|]+/) : [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const s = oneLine(item, maxLen);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length === maxItems) break;
  }
  return out;
}

// The published badge links to this, so only Google Maps / Search links.
function googleUrl(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  // google.com, google.<cc>, google.co.<cc> or google.com.<cc> only (not
  // google.evil.io).
  return /^https:\/\/(?:(?:www|maps)\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})\/[^\s"'<>]*$|^https:\/\/maps\.app\.goo\.gl\/[^\s"'<>]+$/i.test(s) ? s.slice(0, 500) : '';
}

// A number from a field that may be blank: blank, null or junk is missing.
function numberOrNull(v) {
  if (v == null || (typeof v === 'string' && !v.trim())) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// The full order a template should render: the chosen ids first (unknown and
// repeated ids dropped), then the template's other ids in its own order.
// Exception: a section the template added later (its `added` list, e.g.
// Sporty's 'brands' and 'featured') that wasn't chosen goes right after the
// section it follows by default, so an order written before it existed (a
// look, a saved suggestion) shows it where the template puts it, never
// below the contact section. [] when nothing was chosen.
export function fullSectionOrder(order, templateId) {
  const ids = sectionIdsFor(templateId);
  const added = templateSectionsFor(templateId)?.added || [];
  const out = [];
  for (const id of Array.isArray(order) ? order : []) {
    if (ids.includes(id) && !out.includes(id)) out.push(id);
  }
  if (!out.length) return [];
  for (const id of ids) if (!out.includes(id) && !added.includes(id)) out.push(id);
  ids.forEach((id, i) => {
    if (out.includes(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      const k = out.indexOf(ids[j]);
      if (k >= 0) { at = k + 1; break; }
    }
    out.splice(at, 0, id);
  });
  return out;
}

// Untrusted input (the admin's browser, or the model's suggestion) as clean
// levers for this template. Unknown keys are dropped.
export function sanitizeLevers(raw, templateId) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = emptyLevers();

  for (const role of COLOR_ROLES) {
    const v = r.palette?.[role];
    if (typeof v === 'string' && HEX.test(v.trim())) out.palette[role] = v.trim().toLowerCase();
  }
  for (const slot of ['heading', 'body']) {
    const v = r.fonts?.[slot];
    if (isCatalogFamily(v)) out.fonts[slot] = v;
  }

  const ids = sectionIdsFor(templateId);
  out.sections.order = fullSectionOrder(r.sections?.order, templateId);
  out.sections.hidden = [...new Set((Array.isArray(r.sections?.hidden) ? r.sections.hidden : [])
    .filter((id) => ids.includes(id) && !ALWAYS_SHOWN.includes(id)))];

  if (HERO_LAYOUTS.includes(r.heroLayout)) out.heroLayout = r.heroLayout;
  if (ABOUT_LAYOUTS.includes(r.aboutLayout)) out.aboutLayout = r.aboutLayout;
  out.aboutStats = (Array.isArray(r.aboutStats) ? r.aboutStats : [])
    .map((s) => ({ value: oneLine(s?.value, 20), label: oneLine(s?.label, 40) }))
    .filter((s) => s.value && s.label)
    .slice(0, 3);

  const facts = r.facts && typeof r.facts === 'object' ? r.facts : {};
  for (const [key, max] of Object.entries(FACT_TEXTS)) {
    const v = oneLine(typeof facts[key] === 'number' ? String(facts[key]) : facts[key], max);
    if (v) out.facts[key] = v;
  }
  for (const [key, max] of Object.entries(FACT_LISTS)) {
    const v = textList(facts[key], max);
    if (v.length) out.facts[key] = v;
  }
  if (typeof facts.insured === 'boolean') out.facts.insured = facts.insured;

  const p = r.googlePlace;
  if (p && typeof p === 'object' && oneLine(p.placeId, 200)) {
    const rating = numberOrNull(p.rating);
    const count = numberOrNull(p.reviewCount);
    out.googlePlace = {
      placeId: oneLine(p.placeId, 200),
      placeName: oneLine(p.placeName, 200),
      rating: rating != null && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
      reviewCount: count != null && Number.isInteger(count) && count >= 0 ? count : null,
      url: googleUrl(p.url),
    };
  }
  return out;
}

// What the levers put on the site, for one template: only the levers that
// are set, and only where the template reads them.
//   copy    generated_content keys (sectionOrder, hiddenSections, heroLayout,
//           aboutLayout, aboutStats)
//   info    business_info keys (facts, googlePlace)
//   colors  _customColors roles
//   fonts   _customFonts { font, bodyFont } as CSS stacks
export function leverPatch(levers, templateId) {
  const l = sanitizeLevers(levers, templateId);
  const themeReady = !!templateSectionsFor(templateId);
  const copy = {};
  if (l.sections.order.length) copy.sectionOrder = l.sections.order;
  if (l.sections.hidden.length) copy.hiddenSections = l.sections.hidden;
  if (l.heroLayout && themeReady && !NO_HERO_LAYOUT.has(templateId)) copy.heroLayout = l.heroLayout;
  if (l.aboutLayout && themeReady) copy.aboutLayout = l.aboutLayout;
  if (l.aboutStats.length && templateReads(templateId, 'aboutStats')) copy.aboutStats = l.aboutStats;

  const info = { ...l.facts };
  if (l.googlePlace) info.googlePlace = l.googlePlace;

  const fonts = {};
  if (l.fonts.heading) fonts.font = fontStack(l.fonts.heading);
  if (l.fonts.body) fonts.bodyFont = fontStack(l.fonts.body);

  return { copy, info, colors: { ...l.palette }, fonts };
}

// The Studio's settings in groups, and the site keys each one owns. A
// rewrite re-applies a group only when the setup changed it (the page sends
// those group names as design.leversChanged), and then the group is the
// whole truth for its keys: a value cleared in the Studio is removed from
// the site, and keys of untouched groups keep the editor's own values.
export const LEVER_GROUPS = Object.freeze(['palette', 'fonts', 'sections', 'layout', 'facts', 'googlePlace']);
export const GROUP_COPY_KEYS = Object.freeze({
  sections: ['sectionOrder', 'hiddenSections'],
  layout: ['heroLayout', 'aboutLayout', 'aboutStats'],
});
export const GROUP_INFO_KEYS = Object.freeze({
  facts: [...Object.keys(FACT_TEXTS), ...Object.keys(FACT_LISTS), 'insured'],
  googlePlace: ['googlePlace'],
});

// The slice of the levers one group covers (for comparing two settings).
export function leverGroup(levers, group) {
  const l = levers || {};
  switch (group) {
    case 'palette': return l.palette || {};
    case 'fonts': return l.fonts || {};
    case 'sections': return l.sections || {};
    case 'layout': return { heroLayout: l.heroLayout || '', aboutLayout: l.aboutLayout || '', aboutStats: l.aboutStats || [] };
    case 'facts': return l.facts || {};
    case 'googlePlace': return l.googlePlace || null;
    default: return null;
  }
}

// The groups that differ between two sanitized lever sets.
export function changedLeverGroups(a, b) {
  return LEVER_GROUPS.filter((g) => JSON.stringify(leverGroup(a, g)) !== JSON.stringify(leverGroup(b, g)));
}

// design.leversChanged as a list of groups: true (older saves) means all.
export function leverGroupsChanged(flag) {
  if (flag === true) return [...LEVER_GROUPS];
  return Array.isArray(flag) ? LEVER_GROUPS.filter((g) => flag.includes(g)) : [];
}

// Has any lever been set? (An all-empty levers object changes nothing.)
export function hasLevers(levers, templateId) {
  const p = leverPatch(levers, templateId);
  return [p.copy, p.info, p.colors, p.fonts].some((o) => Object.keys(o).length > 0);
}
