// Edit > Featured Service: copy.featuredService = { serviceName, priceFrom,
// bullets, buttonText, buttonUrl } (each optional; the band's heading lives
// in copy.sectionTitles.featured). Pure helpers for FeaturedServicePanel;
// the matching rule is MobileRedline's.
import { nameKey } from './serviceRefs.js';

export const MAX_BULLETS = 8;

const FIELDS = ['serviceName', 'priceFrom', 'buttonText', 'buttonUrl', 'bullets'];

const featuredObj = (copy) => {
  const fs = copy?.featuredService;
  return fs && typeof fs === 'object' && !Array.isArray(fs) ? fs : {};
};

// Which service the band features: { name, service, automatic }.
// With a saved serviceName: that name and its service (null when no
// service carries it: the band then features the name on its own).
// Without one: the first ceramic / coating service, or nothing.
export function featuredMatch(copy, services) {
  const list = Array.isArray(services) ? services : [];
  const own = typeof featuredObj(copy).serviceName === 'string' ? featuredObj(copy).serviceName.trim() : '';
  if (own) {
    return { name: own, service: list.find((s) => nameKey(s?.name) === nameKey(own)) || null, automatic: false };
  }
  const service = list.find((s) => /ceramic|coating/i.test(String(s?.name ?? ''))) || null;
  return { name: service ? service.name : '', service, automatic: true };
}

const isEmpty = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

// The next copy.featuredService after one field changes, stored cleaned:
// an empty value removes its key (empty strings and empty lists left over
// from older saves go too), and nothing left means null. Benefit rows stay
// as typed, empty ones included, so a row the owner just added does not
// vanish; the template skips empty rows.
export function setFeaturedField(copy, key, value) {
  const next = { ...featuredObj(copy) };
  if (FIELDS.includes(key)) {
    if (key === 'bullets') {
      if (Array.isArray(value) && value.length) next.bullets = value.map((b) => (typeof b === 'string' ? b : String(b ?? '')));
      else delete next.bullets;
    } else if (isEmpty(value)) {
      delete next[key];
    } else {
      next[key] = String(value);
    }
  }
  for (const k of Object.keys(next)) if (isEmpty(next[k])) delete next[k];
  return Object.keys(next).length ? next : null;
}

// The settings that describe one particular service (all but its name and
// the button link): what the panel lists when the owner picks another
// service, with the band's heading from Edit > Headings (sectionTitles
// .featured title, label or intro) and the band's photo (images.featured:
// a coating photo left on a detailing band is the most visible leftover).
// [{ key, label }] in the panel's order.
export function leftoverFields(copy, images) {
  const fs = featuredObj(copy);
  const out = [];
  if (!isEmpty(fs.priceFrom)) out.push({ key: 'priceFrom', label: 'Starting price' });
  if (Array.isArray(fs.bullets) && fs.bullets.some((b) => !isEmpty(b))) out.push({ key: 'bullets', label: 'Benefits' });
  if (!isEmpty(fs.buttonText)) out.push({ key: 'buttonText', label: 'Button text' });
  const h = copy?.sectionTitles?.featured;
  if (h && typeof h === 'object' && ['title', 'eyebrow', 'intro'].some((k) => !isEmpty(h[k]))) {
    out.push({ key: 'heading', label: 'Heading (Edit > Headings)' });
  }
  if (!isEmpty(images?.featured)) out.push({ key: 'photo', label: 'Featured Photo' });
  return out;
}

// The leftovers clearLeftovers removes (all but the heading and the photo,
// which live outside copy.featuredService).
export const COPY_LEFTOVERS = ['priceFrom', 'bullets', 'buttonText'];

// copy.featuredService without those settings (one write; the name and the
// link stay), cleaned like setFeaturedField.
export function clearLeftovers(copy) {
  let next = copy;
  for (const key of COPY_LEFTOVERS) {
    next = { ...(next || {}), featuredService: setFeaturedField(next, key, null) };
  }
  return next.featuredService;
}
