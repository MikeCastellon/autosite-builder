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

// Subdomains of the publish domain that are ours, never a customer's.
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'book', 'booking', 'dashboard',
  'sitebuilder', 'support', 'help', 'status', 'cdn', 'assets', 'static',
]);

export function isReservedSlug(slug) {
  return RESERVED_SLUGS.has(slug);
}

// Slugs to try, in order, for a site's first publish: the requested slug,
// then `-2`, `-3`, … The base is trimmed so every candidate stays within
// the 63-char DNS label limit.
export function slugCandidates(base, max = 20) {
  const out = [];
  for (let i = 1; i <= max; i++) {
    const suffix = i === 1 ? '' : `-${i}`;
    const trimmed = base.slice(0, 63 - suffix.length).replace(/-+$/, '');
    out.push(`${trimmed}${suffix}`);
  }
  return out;
}
