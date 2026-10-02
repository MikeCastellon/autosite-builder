// Section manifests: which sections the editor's Sections tab lists for a
// template (ContentEditor.jsx), and how a saved order is fitted to them.
//
// A theme-ready template module exports `sections` ([{ id, label }] in its
// default top-to-bottom order); that export is the manifest. Older templates
// (all hidden from the picker, still used by a few saved sites) don't, so
// their ids are copied here from each file's own buildSectionOrder() call:
// the editor then only offers sections the template really orders and hides.
// Saved sites keep these ids in copy.sectionOrder / copy.hiddenSections, so
// an id is never renamed.

export const SECTION_LABELS = {
  hero: 'Hero',
  statsBar: 'Stats Bar',
  services: 'Services',
  about: 'About',
  gallery: 'Gallery',
  testimonials: 'Reviews',
  cta: 'Contact / CTA',
  awards: 'Awards',
  brands: 'Brands',
  whyUs: 'Why Choose Us',
};

const STD = ['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta'];
const LEGACY_SECTION_IDS = {
  detailing_coastal: STD,
  detailing_autosync_dark: STD,
  detailing_autosync_white: ['hero', 'services', 'about', 'gallery', 'testimonials', 'cta'],
  mobile_bold: ['hero', 'services', 'about', 'gallery', 'testimonials', 'cta'],
  mobile_modern: STD,
  mobile_rugged: STD,
  wheel_edge: ['hero', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  wheel_clean: ['hero', 'awards', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  tint_dark: ['hero', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  tint_sleek: ['hero', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  mechanic_friendly: ['hero', 'whyUs', 'services', 'about', 'gallery', 'testimonials', 'cta'],
};
const LEGACY_LABELS = {
  tint_dark: { brands: 'Film Brands' },
  tint_sleek: { brands: 'Film Brands' },
};

export function legacySections(templateId) {
  const ids = LEGACY_SECTION_IDS[templateId] || STD;
  const labels = LEGACY_LABELS[templateId] || {};
  return ids.map((id) => ({ id, label: labels[id] || SECTION_LABELS[id] || id }));
}

// { themeReady, sections } for a loaded template module (or null when it
// failed to load). Only a theme-ready module's own list is trusted.
export function manifestFromModule(templateId, mod) {
  const own = mod && mod.themeReady === true && Array.isArray(mod.sections)
    ? mod.sections.filter((s) => s && typeof s.id === 'string' && s.id)
    : [];
  if (own.length > 0) {
    return {
      themeReady: true,
      sections: own.map((s) => ({ id: s.id, label: s.label || SECTION_LABELS[s.id] || s.id })),
    };
  }
  return { themeReady: false, sections: legacySections(templateId) };
}

// The saved order fitted to a template's default ids: each id missing from
// the save (say, after a template switch) takes its default slot, right
// after the section that precedes it in the default order (first when
// nothing does). Without this, buildSectionOrder gives missing ids 999 and
// they pile up above the footer (audit 4.2). No saved order means the
// default order.
//
// Ids the template doesn't have are dropped from the result (the Sections
// list), unless `keepForeign` is set: then they stay where they are. That is
// the form to save, because copy.sectionOrder is shared by every template:
// buildSectionOrder ignores ids a template lacks, and keeping them means an
// owner who tries another design and switches back gets their order back
// exactly. Both forms list this template's ids in the same order.
export function mergeSectionOrder(savedOrder, defaultIds, { keepForeign = false } = {}) {
  const ids = [...new Set((defaultIds || []).filter((id) => typeof id === 'string' && id))];
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return ids;
  const known = new Set(ids);
  const out = [];
  for (const id of savedOrder) {
    if (typeof id !== 'string' || !id || out.includes(id)) continue;
    if (keepForeign || known.has(id)) out.push(id);
  }
  ids.forEach((id, i) => {
    if (out.includes(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(ids[j]);
      if (k >= 0) { at = k + 1; break; }
    }
    out.splice(at, 0, id);
  });
  return out;
}

// True when a saved order leaves out one of the template's sections, i.e.
// the live render would push that section to the end (order 999).
export function orderNeedsRepair(savedOrder, defaultIds) {
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return false;
  return (defaultIds || []).some((id) => !savedOrder.includes(id));
}

export function sameOrder(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((id, i) => id === b[i]);
}

// The order to save after the owner reorders the Sections list: `visibleIds`
// (this template's ids, in their new order) fill the slots this template's
// ids hold in `savedOrder`, one by one, and every other template's id keeps
// its position. Pass the keepForeign form of the saved order, so each
// visible id has a slot; any without one go last. Without foreign ids this
// is just `visibleIds`.
export function placeSectionOrder(savedOrder, visibleIds) {
  const next = Array.isArray(visibleIds) ? visibleIds : [];
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return [...next];
  const visible = new Set(next);
  const out = [];
  let k = 0;
  for (const id of savedOrder) {
    if (!visible.has(id)) out.push(id);
    else if (k < next.length) out.push(next[k++]);
  }
  return out.concat(next.slice(k));
}

// Moves the id at `from` to index `to` (drag and drop, or the up/down
// buttons). Out-of-range moves return the list unchanged.
export function moveSection(ids, from, to) {
  if (!Array.isArray(ids) || from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
