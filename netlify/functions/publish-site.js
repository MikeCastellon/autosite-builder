import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';
import { isValidSlug } from './_shared/slug.js';
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

  const { siteId, htmlContent, slug, bookingPageHtml } = body;
  if (!siteId || !slug || (!htmlContent && !bookingPageHtml)) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Missing required fields (siteId, slug, and htmlContent or bookingPageHtml)' }) };
  }

  // Slug shape — used as a hostname label and as part of the R2 object
  // key. Reject anything that could break out of either context.
  if (!isValidSlug(slug)) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Invalid slug' }) };
  }

  let site;
  try {
    ({ site } = await requireSiteOwner(event, siteId));
  } catch (err) {
    return { statusCode: err.status || 500, headers: json, body: JSON.stringify({ error: err.message }) };
  }

  // Defense in depth: the slug going into R2 must match the site's
  // existing slug (or be allowed as a first publish). Refuse to publish
  // an arbitrary slug overriding another site's content.
  if (site.slug && site.slug !== slug) {
    return { statusCode: 409, headers: json, body: JSON.stringify({ error: 'This site is already published under a different slug. Use the existing slug.' }) };
  }

  const supabase = supabaseAdmin();

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
      slug,
      published_url: publishedUrl,
    }).eq('id', siteId);

    return {
      statusCode: 200,
      headers: json,
      body: JSON.stringify({ publishedUrl, bookingUrl }),
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
