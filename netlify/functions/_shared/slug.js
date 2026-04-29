// Slug shape validator. Slugs are used as a hostname label
// (`<slug>.autocaregeniushub.com`) and as the first path segment of an R2
// object key (`<slug>/index.html`). Both contexts demand the conservative
// DNS-label charset: lowercase a-z, 0-9, hyphens, length 1..63.
//
// Used by:
//   - publish-site.js to reject slugs that could break out of R2 keys or
//     hijack a different customer's slug
//   - serve-custom-domain edge function to reject slugs read from Supabase
//     before constructing the upstream proxy URL (defense in depth)
const SLUG_RE = /^[a-z0-9-]{1,63}$/;

export function isValidSlug(slug) {
  if (typeof slug !== 'string') return false;
  if (slug.length === 0 || slug.length > 63) return false;
  return SLUG_RE.test(slug);
}
