import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || 'b5123609-d632-43df-9ff1-db707714162b';
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId } = body;
  if (!siteId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId required' }) };
  }

  try {
    const { site } = await requireSiteOwner(event, siteId);

    // Remove the alias from the Netlify site if it still has a domain.
    if (site.custom_domain && NETLIFY_TOKEN) {
      const apex = site.custom_domain;
      const wwwHost = `www.${apex}`;
      try {
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
      } catch (e) {
        console.error('disconnect: Netlify alias removal failed', e);
      }
    }

    await supabaseAdmin().from('sites').update({
      custom_domain: null,
      custom_hostname_apex_id: null,
      custom_hostname_www_id: null,
      custom_domain_status: 'disconnected',
      custom_domain_connected_at: null,
      custom_domain_last_checked_at: null,
    }).eq('id', siteId);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ disconnected: true }) };
  } catch (err) {
    const status = err.status || 500;
    console.error('disconnect-domain error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
