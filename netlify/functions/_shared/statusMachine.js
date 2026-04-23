const DNS_ERROR_STATES = new Set(['blocked', 'moved', 'deleted']);
const SSL_ERROR_STATES = new Set(['timing_out', 'deleted']);

export function consolidateStatus(apex, www) {
  const apexDns = apex?.status;
  const wwwDns  = www?.status;
  const apexSsl = apex?.ssl?.status;
  const wwwSsl  = www?.ssl?.status;

  if (DNS_ERROR_STATES.has(apexDns) || DNS_ERROR_STATES.has(wwwDns)) {
    return { status: 'error_dns', message: 'DNS validation failed. Check your CNAME records.' };
  }
  if (SSL_ERROR_STATES.has(apexSsl) || SSL_ERROR_STATES.has(wwwSsl)) {
    return { status: 'error_ssl', message: 'SSL certificate issuance failed. Try reconnecting.' };
  }
  if (apexDns !== 'active' || wwwDns !== 'active') {
    return { status: 'pending_dns', message: 'Waiting for DNS to propagate (usually 1–5 minutes).' };
  }
  if (apexSsl !== 'active' || wwwSsl !== 'active') {
    return { status: 'active_dns', message: 'DNS verified. SSL certificate issuing (usually under 5 minutes).' };
  }
  return { status: 'active_ssl', message: 'Your site is live on your custom domain!' };
}
