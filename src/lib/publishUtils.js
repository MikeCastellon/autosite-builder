/**
 * Generate a URL-safe slug from a business name.
 * Result is used as the subdomain: slug.yourdomain.com
 */
export function generateSlug(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[''']/g, '')          // strip apostrophes
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '')       // trim leading/trailing dashes
    .slice(0, 40);                  // max 40 chars for readability
}

/**
 * Append a short unique suffix to guarantee uniqueness.
 * Used for the Netlify internal site name (must be globally unique).
 * siteId is the Supabase row UUID.
 */
export function netlifyName(slug, siteId) {
  const suffix = siteId.replace(/-/g, '').slice(0, 6);
  return `${slug}-${suffix}`;
}
