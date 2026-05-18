// src/data/sectionCatalog.js
// Registry of all section types the wizard catalog and SectionRenderer know about.
// Each entry: { type, label, description, group, multi, locked, supportedTemplates }
// - multi: true if a page can have multiple instances of this type (e.g. mediaText).
// - locked: 'top' | 'bottom' if the section is required at a fixed position.
// - supportedTemplates: if present, restricts the catalog to listing this section
//   only when the current template id is in the array. Absent = supported everywhere.

export const SECTION_CATALOG = [
  // ─── Essentials ─────────────────────────────────────────────────
  { type: 'hero',         label: 'Hero',            description: 'Main headline + image',          group: 'essentials', locked: 'top' },
  { type: 'services',     label: 'Services',        description: 'Service cards',                  group: 'essentials' },
  { type: 'about',        label: 'About',           description: 'Story + trust paragraph',        group: 'essentials' },
  { type: 'gallery',      label: 'Gallery',         description: 'Photo grid',                     group: 'essentials' },
  { type: 'testimonials', label: 'Reviews',         description: 'Customer testimonials',          group: 'essentials' },
  { type: 'cta',          label: 'Contact / CTA',   description: 'Hours, phone, address, button',  group: 'essentials', locked: 'bottom' },

  // ─── Content (universal as of this update) ──────────────────────
  { type: 'process',      label: 'How It Works',    description: 'Numbered steps',                 group: 'content' },
  { type: 'faq',          label: 'FAQ',             description: 'Common questions + answers',     group: 'content' },
  { type: 'beforeAfter',  label: 'Before & After',  description: 'Transformation photo pairs',     group: 'content' },
  { type: 'mediaText',    label: 'Media + Text',    description: 'Image/video beside custom copy', group: 'content', multi: true },

  // ─── Template-specific (kept scoped to templates that already render them) ───
  { type: 'statsBar',     label: 'Stats Bar',       description: 'Big numbers row',                group: 'template',
    supportedTemplates: ['detailing_sporty','wheel_edge','wheel_clean','tint_obsidian','tint_dark','tint_elite','tint_sleek','mobile_bold','mobile_modern','mobile_rugged','mobile_chrome','mobile_sudsy'] },
  { type: 'whyUs',        label: 'Why Us',          description: 'Trust callouts',                 group: 'template',
    supportedTemplates: ['mechanic_ironclad','mobile_sudsy','carwash_bubble'] },
  { type: 'awards',       label: 'Awards',          description: 'Awards row',                     group: 'template',
    supportedTemplates: ['wheel_clean'] },
  { type: 'trustBar',     label: 'Trust Bar',       description: 'Trust badges row',               group: 'template',
    supportedTemplates: ['wheel_apex'] },
  { type: 'ticker',       label: 'Ticker',          description: 'Scrolling service ticker',       group: 'template',
    supportedTemplates: ['wheel_apex','mechanic_ironclad'] },
  { type: 'ctaBand',      label: 'CTA Banner',      description: 'Slim full-width call-out',       group: 'template',
    supportedTemplates: ['mechanic_ironclad'] },
  { type: 'brands',       label: 'Brands',          description: 'Brand logos row',                group: 'template',
    supportedTemplates: ['wheel_edge','wheel_clean','wheel_apex','tint_dark','tint_elite','tint_obsidian','tint_sleek'] },
  { type: 'products',     label: 'Products',        description: 'Product highlight grid',         group: 'template',
    supportedTemplates: ['wheel_apex'] },
  { type: 'shadeGuide',   label: 'Shade Guide',     description: 'Window tint shades',             group: 'template',
    supportedTemplates: ['tint_obsidian'] },
  { type: 'filmBrands',   label: 'Film Brands',     description: 'Film brand logos',               group: 'template',
    supportedTemplates: ['tint_dark','tint_elite','tint_obsidian','tint_sleek'] },
];

export const SECTION_GROUPS = {
  essentials: 'Essentials',
  content: 'Content',
  template: 'Template-specific',
};

// Per-template default composition used to populate the new wizard step's
// initial state. Sourced from the existing TOGGLEABLE registry in
// ContentEditor.jsx so behaviour matches what users see today, with the four
// new universal sections (faq, beforeAfter, mediaText, process) added only
// where a template would naturally have a "process" block today. For new
// templates, the _default key applies.
export const TEMPLATE_DEFAULT_SECTIONS = {
  _default:           ['hero','statsBar','services','about','gallery','testimonials','cta'],
  mechanic_ironclad:  ['hero','ticker','ctaBand','about','services','gallery','whyUs','testimonials','cta'],
  wheel_apex:         ['hero','trustBar','ticker','products','brands','about','gallery','testimonials','cta'],
  wheel_edge:         ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  wheel_clean:        ['hero','statsBar','awards','services','brands','about','gallery','testimonials','cta'],
  tint_obsidian:      ['hero','shadeGuide','services','brands','process','about','gallery','testimonials','cta'],
  tint_elite:         ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  tint_dark:          ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  tint_sleek:         ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  mobile_sudsy:       ['hero','services','process','whyUs','about','gallery','testimonials','cta'],
  carwash_bubble:     ['hero','services','process','about','whyUs','gallery','testimonials','cta'],
};

export function getCatalogEntry(type) {
  return SECTION_CATALOG.find(c => c.type === type);
}

export function getCatalogForTemplate(templateId) {
  return SECTION_CATALOG.filter(c =>
    !c.supportedTemplates || c.supportedTemplates.includes(templateId)
  );
}

export function getDefaultSectionTypesForTemplate(templateId) {
  return TEMPLATE_DEFAULT_SECTIONS[templateId] || TEMPLATE_DEFAULT_SECTIONS._default;
}
