import { deleteCustomHostname } from './_shared/cloudflare.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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

    const deletions = [];
    if (site.custom_hostname_apex_id) deletions.push(deleteCustomHostname(site.custom_hostname_apex_id).catch((e) => console.error(e)));
    if (site.custom_hostname_www_id)  deletions.push(deleteCustomHostname(site.custom_hostname_www_id).catch((e) => console.error(e)));
    await Promise.all(deletions);

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
