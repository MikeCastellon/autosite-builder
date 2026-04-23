import { supabaseAdmin } from './_shared/auth.js';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET = 'autosite-published';

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || 'b5123609-d632-43df-9ff1-db707714162b';
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: '{"error":"Invalid JSON"}' }; }

  const { slug, siteId } = body;
  if (!slug) return { statusCode: 400, headers: CORS, body: '{"error":"Missing slug"}' };

  try {
    // Delete R2 object
    const r2Key = `${slug}/index.html`;
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(r2Key)}`;
    await fetch(r2Url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    });

    // Remove this site's Netlify domain aliases so traffic for the
    // customer's custom domain stops returning our content.
    if (siteId) {
      const admin = supabaseAdmin();
      const { data: site } = await admin.from('sites').select('custom_domain').eq('id', siteId).maybeSingle();
      if (site?.custom_domain && NETLIFY_TOKEN) {
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
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
