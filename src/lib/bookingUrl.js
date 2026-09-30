// Canonical public booking URL for a site. Booking-only sites use the root;
// website sites use the /book path.
//
// A custom domain is used only once it serves HTTPS (custom_domain_status
// 'active_ssl'; before that it is 'pending_dns' or 'active_dns', DNS right
// but no certificate yet, so the link would show a browser warning). The
// domain is served on its www host: connect-domain, domain-sweep and the
// Custom domain panel all send visitors to https://www.<domain>, and the
// bare domain only works if the owner set up a forward at their registrar.
// Otherwise the published subdomain.
export function bookingShareUrl(site) {
  if (!site) return '';
  const active = site.custom_domain && site.custom_domain_status === 'active_ssl';
  const base = active ? `https://www.${site.custom_domain}` : site.published_url;
  if (!base) return '';
  return site.site_type === 'booking_only' ? base : `${base}/book`;
}
