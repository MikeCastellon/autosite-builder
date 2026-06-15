// Canonical public booking URL for a site. Prefers an active custom domain,
// else the published subdomain. Booking-only sites use the root; website
// sites use the /book path.
export function bookingShareUrl(site) {
  if (!site) return '';
  const active = site.custom_domain && (site.custom_domain_status === 'active_ssl' || site.custom_domain_status === 'active_dns');
  const base = active ? `https://${site.custom_domain}` : site.published_url;
  if (!base) return '';
  return site.site_type === 'booking_only' ? base : `${base}/book`;
}
