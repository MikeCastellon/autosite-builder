import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';
import { resolvePublishSlug } from './_shared/slugClaim.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { backupLivePages, uploadSitePages, setPublishedAt } from './_shared/r2.js';
import { isUpgradedSite } from '../../src/lib/siteUpgrade.js';

const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || 'autocaregeniushub.com';

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const json = jsonHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: json, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // `slug` is only the client's preference for a first publish; the
  // server decides the slug actually written to (see slugClaim.js).
  const { siteId, htmlContent, slug: requestedSlug, bookingPageHtml } = body;
  if (!siteId || (!htmlContent && !bookingPageHtml)) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Missing required fields (siteId, and htmlContent or bookingPageHtml)' }) };
  }

  let site;
  try {
    ({ site } = await requireSiteOwner(event, siteId));
  } catch (err) {
    return { statusCode: err.status || 500, headers: json, body: JSON.stringify({ error: err.message }) };
  }

  const supabase = supabaseAdmin();

  // Never write under a slug another site holds: that overwrites their
  // live page. Reuses the stored slug, or claims a free one on first publish.
  const claim = await resolvePublishSlug(supabase, site, requestedSlug);
  if (!claim.slug) {
    return { statusCode: claim.status, headers: json, body: JSON.stringify({ error: claim.error }) };
  }
  const { slug } = claim;

  // Only a homepage write changes a website's design: a /book-only refresh
  // (Booking Settings) and a booking-only account's shell never do.
  const writesWebsiteHome = !!htmlContent && site.site_type !== 'booking_only';

  // An owner's first publish on the new designs replaces a live page in
  // the old design: save it first (same backups as Admin > Site upgrades),
  // so an admin can put it back. Later publishes are already on the new
  // designs and are not backed up. A failed backup never stops the
  // owner's publish.
  if (writesWebsiteHome && site.published_url && !isUpgradedSite(site)) {
    try {
      const backup = await backupLivePages({ slug, siteId: site.id, reason: 'owner' });
      if (backup.backupId) console.log(`[publish-site] site=${site.id} slug=${slug} backup=${backup.backupId} files=${backup.files.join(',')}`);
    } catch (e) {
      console.error(`[publish-site] backup before the first new-design publish failed for site ${site.id}:`, e?.message || e);
    }
  }

  try {
    // Homepage, then the /book page (same keys and content type as ever;
    // shared with admin-site-upgrade).
    await uploadSitePages(slug, { htmlContent, bookingPageHtml });

    const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;
    const bookingUrl = bookingPageHtml ? `${publishedUrl}/book` : publishedUrl;

    await supabase.from('sites').update({
      published_url: publishedUrl,
    }).eq('id', siteId);
    // published_at drives the dashboard's "New design live" badge and the
    // admin upgrade's "already done" list, so only a website homepage write
    // sets it. A separate update: a failure here (or a missing column) must
    // not fail a publish that is already live.
    if (writesWebsiteHome) await setPublishedAt(supabase, siteId);

    return {
      statusCode: 200,
      headers: json,
      body: JSON.stringify({ publishedUrl, bookingUrl, slug }),
    };

  } catch (err) {
    console.error('publish-site error:', err);
    return {
      statusCode: 500,
      headers: json,
      body: JSON.stringify({ error: err.message || 'Publish failed' }),
    };
  }
};
