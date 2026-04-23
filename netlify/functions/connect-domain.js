import { normalizeDomain, isValidDomain } from './_shared/domainUtils.js';
import { createCustomHostname, listCustomHostnames, deleteCustomHostname } from './_shared/cloudflare.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

// Domain Connect is intentionally NOT used. Cloudflare for SaaS requires a
// per-hostname dynamic UUID in the verification TXT record, which static
// Domain Connect templates cannot inject. Squarespace + others reported
// "Domain connected!" while the actual verification never landed — more
// confusing than the 2-record manual paste, so we just do manual.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const FALLBACK = process.env.CUSTOM_DOMAIN_FALLBACK_ORIGIN;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
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
  const www = `www.${apex}`;

  try {
    // 1. Auth + site ownership
    await requireSiteOwner(event, siteId);

    // 2. Check for conflict: another site already owns this domain
    const admin = supabaseAdmin();
    const { data: conflict } = await admin
      .from('sites').select('id').eq('custom_domain', apex).neq('id', siteId).maybeSingle();
    if (conflict) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Domain already connected to another site' }) };
    }

    // 3. Create (or recover) Cloudflare hostname for www only.
    //    Apex CNAME is forbidden by the DNS spec on most registrars
    //    (Squarespace, GoDaddy, Namecheap reject it) — supporting it forces
    //    users into a domain-forwarding hop. Skipping it keeps setup to two
    //    DNS records, period. If the user wants bare-domain access too they
    //    can add a forward at their registrar themselves.
    const wwwHn = await createOrRecover(www);

    // 5. Persist to Supabase. We store the apex as the user-facing domain
    //    label but only the www hostname id in Cloudflare.
    await admin.from('sites').update({
      custom_domain: apex,
      custom_hostname_apex_id: null,
      custom_hostname_www_id: wwwHn.id,
      custom_domain_status: 'pending_dns',
      custom_domain_connected_at: new Date().toISOString(),
      custom_domain_last_checked_at: new Date().toISOString(),
    }).eq('id', siteId);

    // 6. Build CNAME instructions — just www + verification, no apex.
    const cnameInstructions = [
      { type: 'CNAME', host: 'www', value: FALLBACK },
    ];
    if (wwwHn.ownership_verification) {
      cnameInstructions.push({
        type: wwwHn.ownership_verification.type,
        host: wwwHn.ownership_verification.name,
        value: wwwHn.ownership_verification.value,
      });
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        cnameInstructions,
        hostnameIds: { www: wwwHn.id },
        liveUrl: `https://${www}`,
        status: 'pending_dns',
      }),
    };
  } catch (err) {
    const status = err.status || 500;
    console.error('connect-domain error:', err);
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

async function createOrRecover(hostname) {
  try {
    return await createCustomHostname(hostname);
  } catch (err) {
    // Handle orphan from prior failed delete: find existing, delete, retry once
    if (err.status === 409) {
      const existing = await listCustomHostnames({ hostname });
      if (existing?.length > 0) {
        await deleteCustomHostname(existing[0].id);
        return await createCustomHostname(hostname);
      }
    }
    throw err;
  }
}
