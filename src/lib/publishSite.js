import { generateSlug } from './publishUtils.js';
import { exportHtmlString } from './exportHtml.js';
import { supabase } from './supabase.js';
import { buildBookingPageHtml } from './bookingPageHtml.js';
import { publishesAsPro } from './freeSiteHandover.js';

/**
 * Publish a site by uploading HTML to Cloudflare R2.
 * The Worker at *.autocaregeniushub.com serves it automatically.
 */
export async function publishSite({ siteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, isPro = false }) {
  // Only a preference: publish-site keeps a site's existing slug and picks
  // a free variant if another business already has this one.
  const slug = generateSlug(businessInfo.businessName);
  // A free website built in a team member's account publishes on the free
  // plan it is going to (freeSiteHandover.js).
  const pro = publishesAsPro(businessInfo, isPro);
  const htmlContent = await exportHtmlString(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || [], siteId, pro);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to publish.');

  // Publish the standalone /book page in the same request whenever the
  // site takes bookings — otherwise the shared booking link has no page
  // behind it and falls through to the website.
  let bookingPageHtml;
  const { data: siteRow } = await supabase
    .from('sites').select('scheduler_enabled').eq('id', siteId).single();
  if (siteRow?.scheduler_enabled) {
    bookingPageHtml = buildBookingPageHtml({ siteId, businessName: businessInfo.businessName });
  }

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookingPageHtml ? { siteId, htmlContent, slug, bookingPageHtml } : { siteId, htmlContent, slug }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }

  return res.json();
}

/**
 * Publish a standalone booking page.
 * - Booking-only account (asSubpath=false): the booking shell IS the root index.html.
 * - Website account (asSubpath=true): writes only `${slug}/book/index.html`,
 *   leaving the existing homepage untouched.
 */
export async function publishBookingPage({ siteId, businessName, slug, asSubpath = false }) {
  const shell = buildBookingPageHtml({ siteId, businessName });

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to publish.');

  const payload = asSubpath
    ? { siteId, slug, bookingPageHtml: shell }
    : { siteId, htmlContent: shell, slug };

  const res = await fetch('/.netlify/functions/publish-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Publish failed');
  }
  return res.json(); // { publishedUrl, bookingUrl, slug }
}
