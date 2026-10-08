// Each theme-ready template's orderable sections, so the custom-site Design
// step can offer section order and show/hide without loading every template
// module in the admin's browser. A mirror of the modules' own `sections`
// (and `addedSections` / `headingFields`) exports: templateSections.test.js
// fails when a template changes and this file doesn't.
export const TEMPLATE_SECTIONS = Object.freeze({
  detailing_sporty: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'brands', label: 'Vehicle Makes' }, { id: 'services', label: 'Services' }, { id: 'featured', label: 'Featured Service' }, { id: 'vehicleTypes', label: 'Vehicle Types' }, { id: 'process', label: 'How It Works' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'showcase', label: 'Detail Showcase' }, { id: 'comparison', label: 'Comparison' }, { id: 'testimonials', label: 'Reviews' }, { id: 'faq', label: 'FAQ' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: ['brands', 'featured', 'beforeAfter', 'vehicleTypes', 'process', 'showcase', 'comparison', 'faq'],
    headingFields: ['hero', 'brands', 'services', 'featured', 'vehicleTypes', 'process', 'about', 'gallery', 'beforeAfter', 'showcase', 'comparison', 'testimonials', 'faq', 'cta'],
  },
  mechanic_industrial: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  mechanic_garage: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  mobile_chrome: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'brands', label: 'Vehicle Makes' }, { id: 'services', label: 'Services' }, { id: 'featured', label: 'Featured Service' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }, { id: 'awards', label: 'Awards' }],
    added: ['brands', 'featured', 'beforeAfter'],
    headingFields: ['hero', 'brands', 'services', 'featured', 'about', 'gallery', 'beforeAfter', 'testimonials', 'cta'],
  },
  tint_elite: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'statsBar', label: 'Stats Bar' }, { id: 'services', label: 'Services' }, { id: 'brands', label: 'Film Brands' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  tint_obsidian: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'shadeGuide', label: 'Shade Guide' }, { id: 'services', label: 'Services' }, { id: 'brands', label: 'Film Brands' }, { id: 'process', label: 'Process Steps' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  mobile_sudsy: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'brands', label: 'Vehicle Makes' }, { id: 'services', label: 'Services' }, { id: 'featured', label: 'Featured Service' }, { id: 'process', label: 'How It Works' }, { id: 'whyUs', label: 'Why Choose Us' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: ['brands', 'featured', 'beforeAfter'],
    headingFields: ['hero', 'brands', 'services', 'featured', 'process', 'whyUs', 'about', 'gallery', 'beforeAfter', 'testimonials', 'cta'],
  },
  wheel_apex: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'trustBar', label: 'Trust Bar' }, { id: 'ticker', label: 'Scrolling Ticker' }, { id: 'products', label: 'Products' }, { id: 'brands', label: 'Brands' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  mechanic_ironclad: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'ticker', label: 'Service Ticker' }, { id: 'ctaBand', label: 'CTA Banner' }, { id: 'about', label: 'About / Shop' }, { id: 'services', label: 'Services' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'whyUs', label: 'Why Choose Us' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact & Hours' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  carwash_bubble: {
    sections: [{ id: 'hero', label: 'Hero' }, { id: 'services', label: 'Packages' }, { id: 'process', label: 'How It Works' }, { id: 'about', label: 'About & Features' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'testimonials', label: 'Reviews' }, { id: 'cta', label: 'Contact / CTA' }],
    added: ['beforeAfter'],
    headingFields: null,
  },
  mobile_redline: {
    sections: [{ id: 'hero', label: 'Hero & Quote' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'beforeAfter', label: 'Before & After' }, { id: 'brands', label: 'Vehicle Makes' }, { id: 'services', label: 'Packages' }, { id: 'featured', label: 'Featured Service' }, { id: 'testimonials', label: 'Reviews' }, { id: 'awards', label: 'Awards' }, { id: 'locations', label: 'Service Area & Hours' }, { id: 'cta', label: 'Contact / CTA' }],
    added: ['beforeAfter'],
    headingFields: ['hero', 'about', 'gallery', 'beforeAfter', 'brands', 'services', 'featured', 'testimonials', 'locations', 'cta'],
  },
});

// The section ids a template orders, in its default order, or [] for a
// template that isn't theme-ready (no section controls). Added ids are
// normally in `sections` already (at their default spot); the set keeps a
// template that lists one only in `added` from counting it twice.
// One template's entry, or null. Own keys only: 'constructor' and friends
// are not templates.
export function templateSectionsFor(templateId) {
  return own(templateId);
}

function own(templateId) {
  return typeof templateId === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATE_SECTIONS, templateId)
    ? TEMPLATE_SECTIONS[templateId] : null;
}

export function sectionIdsFor(templateId) {
  const t = own(templateId);
  return t ? [...new Set([...t.sections.map((s) => s.id), ...t.added])] : [];
}

export function sectionLabel(templateId, id) {
  return own(templateId)?.sections.find((s) => s.id === id)?.label || id;
}
