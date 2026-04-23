import { normalizeDomain, isValidDomain } from './_shared/domainUtils.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

// Netlify-backed custom domains. Instead of Cloudflare for SaaS (which
// 522s when proxying to same-zone origins), we attach the customer's
// www.<domain> to the existing Netlify site as a domain alias. Netlify
// auto-provisions SSL and routes traffic to our edge function, which
// resolves the Host to the right slug and proxies to R2.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || 'b5123609-d632-43df-9ff1-db707714162b';
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

// Netlify's published DNS targets. Apex uses Netlify load balancer IP
// (works on every registrar including Squarespace — solves the apex-CNAME
// problem). www uses a CNAME to Netlify's apex load balancer.
const DNS_RECORDS = [
  { type: 'A',     host: '@',   value: '75.2.60.5' },
  { type: 'CNAME', host: 'www', value: 'apex-loadbalancer.netlify.com' },
];

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!NETLIFY_TOKEN) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'NETLIFY_ACCESS_TOKEN missing' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId, domain: rawDomain } = body;
  if (!siteId || !rawDomain) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId and domain required' }) };
  }

  const apex = normalizeDomain(rawDomain);
  if (!isValidDomain(apex)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid domain' }) };
  }
  const wwwHost = `www.${apex}`;

  try {
    await requireSiteOwner(event, siteId);

    const admin = supabaseAdmin();
    const { data: conflict } = await admin
      .from('sites').select('id').eq('custom_domain', apex).neq('id', siteId).maybeSingle();
    if (conflict) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Domain already connected to another site' }) };
    }

    // Fetch current Netlify site config to append alias atomically
    const siteRes = await fetch(`${NETLIFY_API}/sites/${NETLIFY_SITE_ID}`, {
      headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` },
    });
    if (!siteRes.ok) {
      const err = await siteRes.text();
      throw new Error(`Netlify site fetch failed: ${err}`);
    }
    const site = await siteRes.json();
    const aliases = new Set(site.domain_aliases || []);
    aliases.add(apex);
    aliases.add(wwwHost);

    const patchRes = await fetch(`${NETLIFY_API}/sites/${NETLIFY_SITE_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain_aliases: [...aliases] }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      throw new Error(`Netlify alias add failed: ${err}`);
    }

    await admin.from('sites').update({
      custom_domain: apex,
      custom_domain_status: 'pending_dns',
      custom_domain_connected_at: new Date().toISOString(),
      custom_domain_last_checked_at: new Date().toISOString(),
      // Legacy Cloudflare columns cleared — we don't use them anymore.
      custom_hostname_apex_id: null,
      custom_hostname_www_id: null,
    }).eq('id', siteId);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        cnameInstructions: DNS_RECORDS,
        liveUrl: `https://www.${apex}`,
        status: 'pending_dns',
      }),
    };
  } catch (err) {
    const status = err.status || 500;
    console.error('connect-domain error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
