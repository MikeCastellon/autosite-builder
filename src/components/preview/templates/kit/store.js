// The Genius Store (copy.store): the owner's own Genius Storefronts embed, a
// shop of Auto Care Genius products that pays the owner commission on every
// sale it sends. Spec: docs/superpowers/specs/2026-10-19-genius-store-design.md.
//
// copy.store = { slug, title?, intro? }. The editor's Genius Store tab writes
// it after Genius Storefronts made the storefront (netlify/functions/
// genius-store.js); everything else about the store lives there. Pure, no
// browser globals: templates and exportHtml both import it.

// The only place a store iframe may point. The slug is the one thing taken
// from copy, and storeOf checks it against Storefronts' own CHECK, so a
// hand-edited copy can never frame another site.
export const STORE_ORIGIN = 'https://storefronts.autocaregenius.com';

// storefronts.slug CHECK in Genius Storefronts (0002_storefronts.sql).
const SLUG = /^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$/;

// The heading while the owner has written none. No claims about the owner
// (that they use or stock these): only what is true of every store.
export const STORE_DEFAULTS = {
  eyebrow: 'Shop online',
  title: 'Shop car care products',
  intro: 'Order professional car care products online, shipped to your door by Auto Care Genius.',
};

// What the Sections list says while the section is on but there is no store.
export const STORE_HINTS = {
  empty: 'Not on your page yet: turn on your store in Genius Store.',
};

// The iframe's height until the store reports its own (SITE_STORE_JS on the
// published page, storePreview.js in the editor).
export const STORE_FRAME_HEIGHT = 900;

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** True for a slug Genius Storefronts could have made. */
export const isStoreSlug = (slug) => typeof slug === 'string' && SLUG.test(slug);

/**
 * The store to render, or null: no copy.store, or a slug that is not one.
 * { slug, src, eyebrow, title, intro } with the defaults filled in.
 */
export function storeOf(store) {
  if (!store || typeof store !== 'object') return null;
  const slug = typeof store.slug === 'string' ? store.slug.trim() : '';
  if (!isStoreSlug(slug)) return null;
  return {
    slug,
    src: `${STORE_ORIGIN}/e/${slug}`,
    eyebrow: STORE_DEFAULTS.eyebrow,
    title: text(store.title, 120) || STORE_DEFAULTS.title,
    intro: text(store.intro, 400) || STORE_DEFAULTS.intro,
  };
}

/**
 * The affiliate disclosure under the store, always shown: the partner terms
 * require it, and the FTC wants it next to the links.
 */
export function storeDisclosure(businessName) {
  const name = text(businessName, 120);
  return name
    ? `${name} earns a commission on purchases made through this store.`
    : 'We earn a commission on purchases made through this store.';
}
