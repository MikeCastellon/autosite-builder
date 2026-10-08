// "Features on this site" in the Design step (Reference sites): for each
// feature our capture found in a reference site's code (referenceOutline.js
// FEATURE_IDS), a plain-English label, and whether our product already does
// it for the template the setup is on. Every claim below was checked against
// the templates' code, and referenceFeatures.test.js checks the ones that
// rest on a template's source; when unsure the answer is 'missing', never a
// promise the site can't keep.
//
// Admin page only: it reads src/data/templates.js (the registry, with the
// templates' lazy imports), which the functions must not bundle. The match
// prompt names the features by id (designSuggest.js).
import { FEATURE_IDS } from './referenceOutline.js';
import { FONT_CATALOG } from './fontCatalog.js';
import { isCatalogFamily } from './designLevers.js';
import { TEMPLATES } from '../data/templates.js';
import { TEMPLATE_SECTIONS, sectionIdsFor, sectionLabel } from '../data/templateSections.js';
import { templateReads } from '../components/preview/editorCapabilities.js';

export const FEATURE_LABELS = Object.freeze({
  'sticky-header': 'Header that stays on top while scrolling',
  'hero-video': 'Video behind the hero',
  'hero-slider': 'Hero slideshow',
  carousel: 'Carousel (a row that slides sideways)',
  gallery: 'Photo gallery',
  'before-after': 'Before / after photo slider',
  reviews: 'Customer reviews',
  'reviews-widget': 'Reviews widget (a Google reviews feed)',
  faq: 'FAQ (questions that open and close)',
  tabs: 'Tabs',
  pricing: 'Prices or packages',
  'booking-widget': 'Online booking widget',
  'quote-form': 'Quote request form',
  'contact-form': 'Contact form',
  map: 'Map',
  video: 'Video',
  'instagram-feed': 'Instagram feed',
  chat: 'Chat widget',
  stats: 'Numbers band (stats)',
  newsletter: 'Newsletter sign-up',
  'service-area': 'Service area',
});

export const SUPPORT_STATUSES = Object.freeze(['have', 'other-template', 'covered', 'missing']);

const MISSING = 'not in our templates yet';
// The stats claim, whichever template has it: a band shows only what the
// owner gave (CLAUDE.md "No invented facts").
const OWN_NUMBERS = 'with only numbers they give (none made up)';

// Templates whose gallery turns into a sideways swipe row (scroll-snap,
// no auto-play) once it has more photos than its grid holds: 4 for most,
// 5 for Raw Garage and Obsidian Studio, 7 for Ironclad. Bright & Bubbly
// wraps its photos instead. Redline (hidden) slides its reviews.
const SWIPE_GALLERY = Object.freeze([
  'detailing_sporty', 'mechanic_industrial', 'mechanic_garage', 'mobile_chrome', 'tint_elite', 'tint_obsidian',
  'wheel_apex', 'mechanic_ironclad', 'carwash_bubble',
]);
const SLIDING_REVIEWS = Object.freeze(['mobile_redline']);

const has = (templateId, ids) => sectionIdsFor(templateId).some((id) => ids.includes(id));
// templateReads for a registered template only ('constructor' and friends
// are not templates).
const reads = (templateId, key) => typeof templateId === 'string'
  && Object.prototype.hasOwnProperty.call(TEMPLATES, templateId) && templateReads(templateId, key);

// How each feature is covered:
//   sections  template section ids that do it: 'have' on a template with
//             one, else 'other-template' naming visible ones that have it
//   templates the same by template id, for a feature that isn't a section
//   have      (templateId) => the 'have' line
//   other     extra words after the template names
//   covered   (templateId) => the line, for a product feature that does it
//             whatever the template
// Neither: 'missing'.
const SUPPORT = {
  // Every theme-ready template's nav is position: sticky at the top.
  'sticky-header': { covered: () => 'every template we offer keeps its nav on top as the page scrolls' },
  gallery: { sections: ['gallery'], have: (t) => `its ${sectionLabel(t, 'gallery')} section` },
  // The Before & After section (Bold & Sporty first): pairs of their own
  // photos the Design step picks. However the template lays a pair out, the
  // line names our section, not the reference's widget (a slider or not).
  'before-after': {
    sections: ['beforeAfter'],
    have: (t) => `its ${sectionLabel(t, 'beforeAfter')} section, with pairs of their own photos`,
  },
  carousel: {
    templates: [...SWIPE_GALLERY, ...SLIDING_REVIEWS],
    have: (t) => (SLIDING_REVIEWS.includes(t) ? 'its reviews slide sideways' : 'its gallery becomes a sideways swipe row once it has enough photos'),
  },
  reviews: { sections: ['testimonials'], have: (t) => `its ${sectionLabel(t, 'testimonials')} section` },
  // Every template has a Reviews section for the owner's own reviews; the
  // Google rating badge (their real rating) is where a template reads
  // copy.googleBadge.
  'reviews-widget': {
    covered: (t) => {
      if (reads(t, 'googleBadge')) return 'our Reviews section and the Google rating badge (their real rating)';
      const badge = namesFor((id) => reads(id, 'googleBadge'), t);
      return badge ? `our Reviews section; the Google rating badge is ${badge}` : 'our Reviews section';
    },
  },
  // Service (or product) cards print the price the owner entered, if any.
  pricing: {
    sections: ['services', 'products'],
    have: (t) => `its ${sectionLabel(t, has(t, ['services']) ? 'services' : 'products')} section shows the prices they enter`,
  },
  // public/scheduler.js, on every published site: once the owner turns
  // booking on, it adds a Book button and opens from the page's Book links.
  'booking-widget': { covered: () => 'our booking widget, once booking is on (the Book buttons open it)' },
  // public/contact-form.js goes into the contact section of every published
  // site (exportHtml.js). Templates that read copy.heroCard also offer the
  // hero price card (pick a package, see its price, book).
  'quote-form': {
    covered: (t) => (reads(t, 'heroServices')
      ? 'our contact form, the hero price card, and the booking widget once booking is on'
      : 'our contact form, and the booking widget once booking is on'),
  },
  'contact-form': { covered: () => 'our contact form, added to the contact section of every published site' },
  // Redline's Service Area section embeds a Google map of the city or area.
  map: { sections: ['locations'], have: (t) => `its ${sectionLabel(t, 'locations')} section shows a Google map` },
  stats: { sections: ['statsBar'], have: () => `its stats bar, ${OWN_NUMBERS}`, other: OWN_NUMBERS },
  // Every template shows the Service area field (Business details).
  'service-area': { covered: () => 'the Service area field (Business details) shows on every template' },
};

const label = (id) => TEMPLATES[id]?.label || id;

// The visible theme-ready templates that pass `test`, other than
// `except`, in the registry's order (TEMPLATE_SECTIONS).
function visibleWith(test, except) {
  return Object.keys(TEMPLATE_SECTIONS).filter((id) => id !== except && TEMPLATES[id] && !TEMPLATES[id].hidden && test(id));
}

// "in Bold & Sporty", "in Bold & Sporty and Industrial", "in Bold &
// Sporty, Industrial and 3 more": at most two names.
function namesFor(test, except) {
  const ids = visibleWith(test, except);
  if (!ids.length) return '';
  const [a, b] = ids.map(label);
  if (ids.length === 1) return `in ${a}`;
  if (ids.length === 2) return `in ${a} and ${b}`;
  return `in ${a}, ${b} and ${ids.length - 2} more`;
}

// Whether our product does `featureId` for `templateId` (the setup's
// template): { status: 'have' | 'other-template' | 'covered' | 'missing',
// text } where text is a short line for after the feature's label.
export function featureSupport(featureId, templateId) {
  const s = Object.prototype.hasOwnProperty.call(SUPPORT, featureId) ? SUPPORT[featureId] : null;
  if (!s) return { status: 'missing', text: MISSING };
  if (s.covered) return { status: 'covered', text: s.covered(templateId) };
  const test = s.sections ? (id) => has(id, s.sections) : (id) => s.templates.includes(id);
  if (typeof templateId === 'string' && test(templateId)) return { status: 'have', text: s.have(templateId) };
  const names = namesFor(test, templateId);
  if (names) return { status: 'other-template', text: s.other ? `${names}, ${s.other}` : names };
  return { status: 'missing', text: MISSING };
}

// The features in an outline (sanitized: { id, provider }) with their
// label and support, in the outline's order.
export function featureRows(features, templateId) {
  return (Array.isArray(features) ? features : [])
    .filter((f) => f && FEATURE_IDS.includes(f.id))
    .map((f) => ({ id: f.id, provider: typeof f.provider === 'string' ? f.provider : '', label: FEATURE_LABELS[f.id], ...featureSupport(f.id, templateId) }));
}

// ─── The outline as the Design step says it ──────────────────────────

// The catalog's spelling of a family our server measured (case aside), or
// '' when FONT_CATALOG doesn't have it.
export function catalogFamilyOf(family) {
  const name = typeof family === 'string' ? family.trim() : '';
  if (!name) return '';
  if (isCatalogFamily(name)) return name;
  const lower = name.toLowerCase();
  return Object.keys(FONT_CATALOG).find((f) => f.toLowerCase() === lower) || '';
}

// "Oswald 700 / Inter 400 (both in our catalog)": the heading and body
// fonts, each marked when our catalog doesn't have it (a match then picks
// the closest one it has). '' without either.
export function outlineFontsText(outline) {
  const fonts = ['heading', 'body'].map((slot) => outline?.fonts?.[slot])
    .filter((f) => f && typeof f.family === 'string' && f.family.trim());
  if (!fonts.length) return '';
  const named = fonts.map((f) => {
    const known = catalogFamilyOf(f.family);
    const weight = Number.isFinite(f.weight) && f.weight > 0 ? ` ${Math.round(f.weight)}` : '';
    return { text: `${known || f.family.trim()}${weight}`, known: !!known };
  });
  if (named.every((f) => f.known)) return `${named.map((f) => f.text).join(' / ')} (${named.length > 1 ? 'both in our catalog' : 'in our catalog'})`;
  return named.map((f) => `${f.text} (${f.known ? 'in our catalog' : 'not in our catalog'})`).join(' / ');
}

const KIND_LABELS = Object.freeze({
  header: 'Header', hero: 'Hero', services: 'Services', pricing: 'Pricing', gallery: 'Gallery', reviews: 'Reviews', faq: 'FAQ',
  about: 'About', process: 'Process', stats: 'Stats', contact: 'Contact', booking: 'Booking', cta: 'Call to action', footer: 'Footer',
  other: 'Other',
});
export const SECTION_KIND_LABELS = KIND_LABELS;

// "Hero → Services (3 cards) → Reviews (carousel) → FAQ → Footer": the
// page's sections top to bottom. The header is its nav, not a section of
// the page, so it is left out.
export function outlineSectionsText(outline) {
  return (Array.isArray(outline?.sections) ? outline.sections : [])
    .filter((s) => s && s.kind !== 'header' && Object.prototype.hasOwnProperty.call(KIND_LABELS, s.kind))
    .map((s) => {
      const cards = Number.isInteger(s.cards) && s.cards > 0 ? s.cards : 0;
      const how = s.layout === 'carousel' ? 'carousel' : cards ? `${cards} ${cards === 1 ? 'card' : 'cards'}` : s.layout === 'split' ? 'split' : '';
      return `${KIND_LABELS[s.kind]}${how ? ` (${how})` : ''}`;
    })
    .join(' → ');
}
