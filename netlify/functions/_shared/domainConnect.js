import dns from 'node:dns/promises';

/**
 * Looks up _domainconnect.<domain> TXT record to find registrar's Domain Connect API base,
 * then fetches provider settings.
 * Returns null if domain does not support Domain Connect.
 *
 * @param {string} domain - apex domain, e.g. "mybusiness.com"
 * @param {object} [opts] - { resolveTxt } for dependency injection in tests
 */
export async function discoverDomainConnect(domain, opts = {}) {
  const resolveTxt = opts.resolveTxt || dns.resolveTxt;
  let apiBase;
  try {
    const records = await resolveTxt(`_domainconnect.${domain}`);
    apiBase = records[0]?.[0];
    if (!apiBase) return null;
  } catch {
    return null;
  }

  const settingsUrl = `https://${apiBase.replace(/^https?:\/\//, '')}/v2/${domain}/settings`;
  try {
    const res = await fetch(settingsUrl);
    if (!res.ok) return null;
    const settings = await res.json();
    if (!settings.urlSyncUX) return null;
    return {
      urlSyncUX: settings.urlSyncUX,
      providerId: settings.providerId,
      providerName: settings.providerName || settings.providerId,
    };
  } catch {
    return null;
  }
}

/**
 * Constructs the full sync apply URL a user is redirected to.
 */
export function buildApplyUrl({ urlSyncUX, providerId, serviceId, domain, redirectUri, state }) {
  const base = urlSyncUX.replace(/\/$/, '');
  const path = `/v2/domainTemplates/providers/${providerId}/services/${serviceId}/apply`;
  const params = new URLSearchParams({
    domain,
    redirect_uri: redirectUri,
    state,
  });
  return `${base}${path}?${params.toString()}`;
}
