// Canonical public booking URL for a site. Booking-only sites use the root;
// website sites use the /book path, with #book on it.
//
// Why the hash: a website only has a /book page once it was published with
// bookings on, or once Booking Settings published it (SchedulerSettings).
// Without one, /book serves the homepage, whose scheduler.js opens the
// booking form for '#book'. On a real /book page the hash does nothing:
// scheduler.js shows the full-page booking view (data-full-page) first and
// never reads it. Homepages published before scheduler.js was added to every
// page still need the /book page itself (Booking Settings offers it).
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
  return site.site_type === 'booking_only' ? base : `${base}/book#book`;
}
