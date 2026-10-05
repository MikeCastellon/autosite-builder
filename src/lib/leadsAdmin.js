// Browser side of the Leads scan (netlify/functions/leads-admin.js and
// leads-scan-background.js). Same shape as customSiteAdmin/startDesignRun in
// customSites.js: claim with one call, then start the background run.
import { supabase } from './supabase.js';

async function token() {
  const { data } = await supabase.auth.getSession();
  const t = data?.session?.access_token;
  if (!t) throw new Error('Not signed in');
  return t;
}

export async function leadsAdmin(action, payload = {}) {
  const auth = await token();
  let res;
  try {
    res = await fetch('/.netlify/functions/leads-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw Object.assign(new Error('Can\'t reach the server. Check your connection and try again.'), { offline: true });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

// A background function answers 202 before it has done anything; the Leads
// tab learns how the scan went by polling its row.
export async function startLeadScan(scanId) {
  const auth = await token();
  let res;
  try {
    res = await fetch('/.netlify/functions/leads-scan-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ scanId }),
    });
  } catch {
    throw new Error('Can\'t reach the server. Check your connection and try again.');
  }
  if (!res.ok && res.status !== 202) throw new Error(`Could not start (${res.status})`);
}
