import { getCustomHostname } from './_shared/cloudflare.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';
import { consolidateStatus } from './_shared/statusMachine.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const CACHE_TTL_MS = 2000;

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
    if (!site.custom_hostname_apex_id) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'disconnected', domain: null }) };
    }

    // 2-second cached read
    const lastChecked = site.custom_domain_last_checked_at ? new Date(site.custom_domain_last_checked_at).getTime() : 0;
    if (Date.now() - lastChecked < CACHE_TTL_MS && site.custom_domain_status) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        domain: site.custom_domain,
        status: site.custom_domain_status,
        cached: true,
      }) };
    }

    // Fresh check
    const [apex, www] = await Promise.all([
      getCustomHostname(site.custom_hostname_apex_id),
      getCustomHostname(site.custom_hostname_www_id),
    ]);

    const consolidated = consolidateStatus(apex, www);
    await supabaseAdmin().from('sites').update({
      custom_domain_status: consolidated.status,
      custom_domain_last_checked_at: new Date().toISOString(),
    }).eq('id', siteId);

    // Build CNAME instructions so the UI can always show what records to add,
    // not just on first connect.
    const FALLBACK = process.env.CUSTOM_DOMAIN_FALLBACK_ORIGIN;
    const cnameInstructions = [
      { type: 'CNAME', host: '@',   value: FALLBACK },
      { type: 'CNAME', host: 'www', value: FALLBACK },
    ];
    if (apex.ownership_verification) {
      cnameInstructions.push({
        type: apex.ownership_verification.type,
        host: apex.ownership_verification.name,
        value: apex.ownership_verification.value,
      });
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      domain: site.custom_domain,
      status: consolidated.status,
      message: consolidated.message,
      cnameInstructions,
      apex: { cloudflareStatus: apex.status, sslStatus: apex.ssl?.status },
      www:  { cloudflareStatus: www.status,  sslStatus: www.ssl?.status },
    }) };
  } catch (err) {
    const status = err.status || 500;
    console.error('domain-status error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
