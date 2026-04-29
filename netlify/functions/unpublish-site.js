import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';
import { isValidSlug } from './_shared/slug.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET = 'autosite-published';

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || 'b5123609-d632-43df-9ff1-db707714162b';
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const json = jsonHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: json, body: '{"error":"Method not allowed"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: json, body: '{"error":"Invalid JSON"}' }; }

  const { siteId } = body;
  if (!siteId) return { statusCode: 400, headers: json, body: '{"error":"Missing siteId"}' };

  let site;
  try {
    ({ site } = await requireSiteOwner(event, siteId));
  } catch (err) {
    return { statusCode: err.status || 500, headers: json, body: JSON.stringify({ error: err.message }) };
  }

  // Use the site's stored slug — never a slug supplied by the caller.
  // This prevents a malicious or buggy client from deleting content under
  // a slug they do not own.
  const slug = site.slug;
  if (!isValidSlug(slug)) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Site has no valid slug to unpublish' }) };
  }

  try {
    const r2Key = `${slug}/index.html`;
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(r2Key)}`;
    await fetch(r2Url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    });

    // Remove this site's Netlify domain aliases so traffic for the
    // customer's custom domain stops returning our content.
    if (site.custom_domain && NETLIFY_TOKEN) {
      try {
        const apex = site.custom_domain;
        const wwwHost = `www.${apex}`;
        const siteRes = await fetch(`${NETLIFY_API}/sites/${NETLIFY_SITE_ID}`, {
          headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` },
        });
        if (siteRes.ok) {
          const netlifySite = await siteRes.json();
          const remaining = (netlifySite.domain_aliases || []).filter(
            (d) => d !== apex && d !== wwwHost
          );
          await fetch(`${NETLIFY_API}/sites/${NETLIFY_SITE_ID}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain_aliases: remaining }),
          });
        }
      } catch (e) { console.error('unpublish: Netlify alias removal failed', e); }
    }

    // Also clear the published_url from the site row so the dashboard
    // reflects the unpublished state immediately.
    const admin = supabaseAdmin();
    await admin.from('sites').update({ published_url: null }).eq('id', siteId);

    return { statusCode: 200, headers: json, body: JSON.stringify({ deleted: true }) };
  } catch (err) {
    return { statusCode: 500, headers: json, body: JSON.stringify({ error: err.message }) };
  }
};
