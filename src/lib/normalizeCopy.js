// Generated copy is written by Claude, so its shape is not guaranteed: a
// missing `servicesSection` or a string where an array belongs white-screens
// the editor on every reopen (audit ai-3). The current generator returns
// schema-checked JSON (structured outputs), but the legacy route, older
// deploys and hand-edited answers do not, so normalizeCopy() still guarantees
// the keys templates and the editor read, with string/array types, and fills
// a missing key with a default built only from what the owner entered (no
// invented facts). It is pure and idempotent, and every key it does not know
// about (googleWidgetKey, sectionOrder, heroLayout, ...) passes through
// untouched.
//
// Used by netlify/functions/_lib/copyGeneration.js (background job),
// netlify/functions/generate-website.js (legacy route) and
// src/lib/generateWebsite.js when the copy arrives in the browser.

// Short service phrase per business type, for the default subheadline/title.
const TYPE_PHRASES = {
  detailing_shop: 'Auto detailing',
  mobile_detailing: 'Mobile detailing',
  wheel_shop: 'Wheels & tires',
  tint_shop: 'Window tint & paint protection',
  mechanic_shop: 'Auto repair',
  car_wash: 'Car wash',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Strings stay exactly as written; a number becomes its string; anything else
// (object, array, null) becomes '' so templates never call .split() on it.
function asText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function textOr(value, fallback) {
  const text = asText(value);
  return text.trim() ? text : fallback;
}

function serviceNames(businessInfo) {
  const raw = businessInfo?.services;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[·,;|]+/) : [];
  return list
    .map((s) => (isPlainObject(s) ? asText(s.name) : asText(s)).trim())
    .filter(Boolean);
}

function normalizeServiceItem(item) {
  if (typeof item === 'string') return item.trim() ? { name: item, description: '' } : null;
  if (!isPlainObject(item)) return null;
  const name = asText(item.name);
  if (!name.trim()) return null; // a nameless card renders as an empty box
  return { ...item, name, description: asText(item.description) };
}

function normalizeTestimonial(entry) {
  if (typeof entry === 'string') return entry.trim() ? { text: entry, name: '' } : null;
  if (!isPlainObject(entry)) return null;
  const text = asText(entry.text);
  if (!text.trim()) return null;
  return { ...entry, text, name: asText(entry.name) };
}

function normalizeKeywords(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return list.map((k) => asText(k).trim()).filter(Boolean);
}

/**
 * @param {object} copy          Parsed generator output or stored copy (anything is accepted).
 * @param {object} businessInfo  The wizard's business info; only used for defaults.
 * @returns {object} copy with headline, subheadline, aboutText, servicesSection.{intro,items[]},
 *   ctaPrimary, ctaSecondary, ctaHeadline, ctaSubtext, testimonialPlaceholders[], metaTitle,
 *   metaDescription, keywords[], footerTagline guaranteed.
 */
export function normalizeCopy(copy, businessInfo) {
  const src = isPlainObject(copy) ? copy : {};
  const biz = isPlainObject(businessInfo) ? businessInfo : {};

  const name = asText(biz.businessName).trim();
  const city = asText(biz.city).trim();
  const place = [city, asText(biz.state).trim()].filter(Boolean).join(', ');
  const typePhrase = TYPE_PHRASES[biz.businessType] || '';
  const services = serviceNames(biz);

  const section = isPlainObject(src.servicesSection) ? src.servicesSection : {};
  // Only a missing/invalid list is rebuilt from the owner's services; an
  // explicit empty list stays empty (templates then use the owner's packages).
  const items = Array.isArray(section.items)
    ? section.items.map(normalizeServiceItem).filter(Boolean)
    : services.map((serviceName) => ({ name: serviceName, description: '' }));

  const testimonials = Array.isArray(src.testimonialPlaceholders)
    ? src.testimonialPlaceholders.map(normalizeTestimonial).filter(Boolean)
    : []; // never invent testimonials to fill a gap

  const headlineDefault = name && city ? `${name} in ${city}` : name || typePhrase;
  const subheadlineDefault = typePhrase && place
    ? `${typePhrase} in ${place}`
    : place ? `Serving ${place}` : '';
  const titleDefault = name
    ? `${name} | ${typePhrase || 'Auto Service'}${place ? ` in ${place}` : ''}`
    : '';
  const descriptionDefault = name
    ? services.length
      ? `${name} offers ${services.slice(0, 3).join(', ')}${place ? ` in ${place}` : ''}.`
      : `${name}${typePhrase ? `: ${typePhrase.toLowerCase()}` : ''}${place ? ` in ${place}` : ''}.`
    : '';
  const serviceArea = asText(biz.serviceArea).trim() || place;

  return {
    ...src,
    headline: textOr(src.headline, headlineDefault),
    subheadline: textOr(src.subheadline, subheadlineDefault),
    // Long-form copy defaults to empty: templates hide the block or use their
    // own fallback, rather than showing filler we made up.
    aboutText: asText(src.aboutText),
    servicesSection: { ...section, intro: asText(section.intro), items },
    ctaPrimary: textOr(src.ctaPrimary, 'Contact Us'),
    ctaSecondary: textOr(src.ctaSecondary, 'View Services'),
    // The contact band's heading and lead. Empty means "use the template's
    // own fallback" (every template reads them as `text || fallback`), so a
    // missing key is never filled with a guess here.
    ctaHeadline: asText(src.ctaHeadline),
    ctaSubtext: asText(src.ctaSubtext),
    testimonialPlaceholders: testimonials,
    metaTitle: textOr(src.metaTitle, titleDefault),
    metaDescription: textOr(src.metaDescription, descriptionDefault),
    keywords: normalizeKeywords(src.keywords),
    footerTagline: textOr(src.footerTagline, serviceArea ? `Serving ${serviceArea}` : ''),
  };
}

// Why a generator response could not be turned into copy. `code` lets the
// function pick a status: 'max_tokens' is not worth retrying (the same input
// truncates again), the others may succeed on a second try.
export class CopyResponseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CopyResponseError';
    this.code = code;
  }
}

/**
 * Reads the JSON object out of a Messages API response. Reads text blocks by
 * type (never content[0], which is a thinking block on models that think),
 * refuses truncated output, and tolerates markdown fences or prose around the
 * object.
 *
 * With refusal fallbacks, a stream that is declined part-way keeps the
 * partial text, then a `fallback` block, then the fallback model's
 * continuation of that text. So the joined text blocks are tried first, then
 * the text after the last fallback block, then the first text block alone.
 */
export function parseCopyMessage(message) {
  if (message?.stop_reason === 'max_tokens') {
    throw new CopyResponseError('max_tokens', 'Generated copy was cut off (max_tokens).');
  }
  if (message?.stop_reason === 'refusal') {
    throw new CopyResponseError('refusal', 'The model declined to write this copy.');
  }
  const content = Array.isArray(message?.content) ? message.content : [];
  const isText = (b) => b?.type === 'text' && typeof b.text === 'string';
  const texts = content.filter(isText).map((b) => b.text);
  if (texts.length === 0) throw new CopyResponseError('no_text', 'The model returned no text.');

  let lastFallback = -1;
  content.forEach((b, i) => { if (b?.type === 'fallback') lastFallback = i; });
  const afterFallback = content.slice(lastFallback + 1).filter(isText).map((b) => b.text).join('');

  const candidates = [texts.join(''), afterFallback, texts[0]];
  let lastError;
  for (const candidate of new Set(candidates)) {
    if (!candidate) continue;
    try {
      return parseCopyText(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new CopyResponseError('bad_json', 'The model did not return a JSON object.');
}

export function parseCopyText(text) {
  const raw = String(text ?? '').trim();
  const candidates = [raw, raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')];
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isPlainObject(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  throw new CopyResponseError('bad_json', 'The model did not return a JSON object.');
}
