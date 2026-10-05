// Each theme-ready template's orderable sections, so the custom-site Design
// step can offer section order and show/hide without loading every template
// module in the admin's browser. A mirror of the modules' own `sections`
// (and `addedSections` / `headingFields`) exports: templateSections.test.js
// fails when a template changes and this file doesn't.
export const TEMPLATE_SECTIONS = Object.freeze({
  detailing_sporty: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: [],
    headingFields: null,
  },
  mechanic_industrial: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: [],
    headingFields: null,
  },
  mechanic_garage: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: [],
    headingFields: null,
  },
  mobile_chrome: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: [],
    headingFields: null,
  },
  tint_elite: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'brands', label: 'Film Brands' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: [],
    headingFields: null,
  },
  tint_obsidian: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'shadeGuide', label: 'Shade Guide' }, { id: 'services', label: 'Services' }, { id: 'brands', label: 'Film Brands' }, { id: 'process', label: 'Process Steps' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: [],
    headingFields: null,
  },
  mobile_sudsy: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'services', label: 'Services' }, { id: 'process', label: 'How It Works' }, { id: 'whyUs', label: 'Why Choose Us' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: [],
    headingFields: null,
  },
  wheel_apex: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'trustBar', label: 'Trust Bar' }, { id: 'ticker', label: 'Scrolling Ticker' }, { id: 'products', label: 'Products' }, { id: 'brands', label: 'Brands' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: [],
    headingFields: null,
  },
  mechanic_ironclad: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'ticker', label: 'Service Ticker' }, { id: 'ctaBand', label: 'CTA Banner' }, { id: 'about', label: 'About / Shop' }, { id: 'services', label: 'Services' }, { id: 'gallery', label: 'Gallery' }, { id: 'whyUs', label: 'Why Choose Us' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact & Hours' }],
    added: [],
    headingFields: null,
  },
  carwash_bubble: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'services', label: 'Packages' }, { id: 'process', label: 'How It Works' }, { id: 'about', label: 'About & Features' }, { id: 'gallery', label: 'Gallery' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: [],
    headingFields: null,
  },
  mobile_redline: {
    sections: [{ id: 'hero', label: 'Hero & Quote' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'brands', label: 'Vehicle Makes' }, { id: 'services', label: 'Packages' }, { id: 'featured', label: 'Featured Service' }, { id: 'testimonials', label: 'Reviews' }, { id: 'awards', label: 'Awards' }, { id: 'locations', label: 'Service Area & Hours' }, { id: 'cta', label: 'Contact / CTA' }],
    added: [],
    headingFields: ['hero', 'about', 'gallery', 'brands', 'services', 'featured', 'testimonials', 'locations', 'cta'],
  },
});

// The section ids a template orders (its own list plus any added later), or
// [] for a template that isn't theme-ready (no section controls).
export function sectionIdsFor(templateId) {
  const t = TEMPLATE_SECTIONS[templateId];
  return t ? [...t.sections.map((s) => s.id), ...t.added] : [];
}

export function sectionLabel(templateId, id) {
  return TEMPLATE_SECTIONS[templateId]?.sections.find((s) => s.id === id)?.label || id;
}
