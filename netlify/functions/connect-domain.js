import { normalizeDomain, isValidDomain } from './_shared/domainUtils.js';
import { createCustomHostname, listCustomHostnames, deleteCustomHostname } from './_shared/cloudflare.js';
import { discoverDomainConnect, buildApplyUrl } from './_shared/domainConnect.js';
import { signState } from './_shared/stateSig.js';
import { requireSiteOwner, supabaseAdmin } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const FALLBACK = process.env.CUSTOM_DOMAIN_FALLBACK_ORIGIN;
const APP_URL = process.env.APP_URL;

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

    // 4. Domain Connect discovery (fire and forget result if fails)
    const provider = await discoverDomainConnect(apex).catch(() => null);

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

    // 7. Construct Domain Connect apply URL if supported
    let applyUrl = null;
    let detectedProvider = null;
    if (provider) {
      const state = await signState({ siteId }, 600);
      applyUrl = buildApplyUrl({
        urlSyncUX: provider.urlSyncUX,
        providerId: 'autocaregeniushub.com',
        serviceId: 'customdomain',
        domain: apex,
        redirectUri: `${APP_URL}/domain-connected`,
        state,
      });
      detectedProvider = provider.providerName;
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        applyUrl,
        detectedProvider,
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
