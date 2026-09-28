import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';
import { resolvePublishSlug } from './_shared/slugClaim.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET = 'autosite-published';
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

  try {
    if (htmlContent) {
      const r2Key = `${slug}/index.html`;
      const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(r2Key)}`;

      const uploadRes = await fetch(r2Url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CF_TOKEN}`,
          'Content-Type': 'text/html; charset=utf-8',
        },
        body: htmlContent,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`R2 upload failed (${uploadRes.status}): ${errText}`);
      }
    }

    if (bookingPageHtml) {
      const bookingKey = `${slug}/book/index.html`;
      const bookingR2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(bookingKey)}`;
      const bookingRes = await fetch(bookingR2Url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'text/html; charset=utf-8' },
        body: bookingPageHtml,
      });
      if (!bookingRes.ok) {
        const t = await bookingRes.text();
        throw new Error(`R2 booking-page upload failed (${bookingRes.status}): ${t}`);
      }
    }

    const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;
    const bookingUrl = bookingPageHtml ? `${publishedUrl}/book` : publishedUrl;

    await supabase.from('sites').update({
      published_url: publishedUrl,
    }).eq('id', siteId);

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
