import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || 'b5123609-d632-43df-9ff1-db707714162b';
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

const DNS_RECORDS = [
  { type: 'A',     host: '@',   value: '75.2.60.5' },
  { type: 'CNAME', host: 'www', value: 'apex-loadbalancer.netlify.com' },
];

const CACHE_TTL_MS = 5000;

// Resolves the site's connection status by:
//   1. Asking Netlify whether the domain alias has a provisioned SSL cert.
//   2. If yes -> active_ssl. If still pending -> pending_dns or verifying.
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const siteId = event.queryStringParameters?.siteId;
  if (!siteId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId required' }) };
  }

  try {
    const { site } = await requireSiteOwner(event, siteId);
    if (!site.custom_domain) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'disconnected', domain: null }) };
    }

    // Short DB-backed cache so 3s polling doesn't hammer Netlify's API.
    const lastChecked = site.custom_domain_last_checked_at ? new Date(site.custom_domain_last_checked_at).getTime() : 0;
    if (Date.now() - lastChecked < CACHE_TTL_MS && site.custom_domain_status) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        domain: site.custom_domain,
        liveUrl: `https://www.${site.custom_domain}`,
        status: site.custom_domain_status,
        cnameInstructions: DNS_RECORDS,
        cached: true,
      }) };
    }

    // Ask Netlify for the alias's SSL state.
    let status = 'pending_dns';
    if (NETLIFY_TOKEN) {
      try {
        const res = await fetch(`${NETLIFY_API}/sites/${NETLIFY_SITE_ID}`, {
          headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` },
        });
        if (res.ok) {
          const netlifySite = await res.json();
          const aliases = netlifySite.domain_aliases || [];
          const apex = site.custom_domain;
          const wwwHost = `www.${apex}`;
          const attached = aliases.includes(apex) || aliases.includes(wwwHost);
          if (!attached) {
            status = 'pending_dns'; // alias was removed somehow; re-add on reconnect
          } else {
            // SSL state is reported via ssl_url + ssl on the site, but a more
            // reliable per-domain check is to probe the alias directly.
            try {
              const probe = await fetch(`https://www.${apex}`, { method: 'HEAD', redirect: 'manual' });
              status = probe.status < 500 ? 'active_ssl' : 'verifying';
            } catch {
              status = 'verifying';
            }
          }
        }
      } catch (e) {
        console.error('domain-status Netlify fetch failed', e);
      }
    }

    await supabaseAdmin().from('sites').update({
      custom_domain_status: status,
      custom_domain_last_checked_at: new Date().toISOString(),
    }).eq('id', siteId);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      domain: site.custom_domain,
      liveUrl: `https://www.${site.custom_domain}`,
      status,
      cnameInstructions: DNS_RECORDS,
    }) };
  } catch (err) {
    const status = err.status || 500;
    console.error('domain-status error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
