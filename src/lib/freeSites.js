// Browser side of Admin > Free websites: the free-site-admin calls (signed-in
// super admin). The pure parts live in freeSiteHandover.js.
import { supabase } from './supabase.js';

const ADMIN_FN = '/.netlify/functions/free-site-admin';

export async function freeSiteAdmin(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  let res;
  try {
    res = await fetch(ADMIN_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw Object.assign(new Error('Can\'t reach the server. Check your connection and try again.'), { offline: true });
  }
  let body = {};
  try { body = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status, data: body });
  }
  return body;
}
