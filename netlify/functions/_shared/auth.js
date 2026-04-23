import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Verify the request is authenticated and the user owns the site.
 * Returns { user, site } or throws an Error with .status code.
 */
export async function requireSiteOwner(event, siteId) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) {
    const err = new Error('Not signed in. Please sign in again.');
    err.status = 401;
    throw err;
  }
  const token = auth.slice(7);

  let user;
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error) {
      console.error('[auth] getUser returned error:', error.message, error.status);
      const err = new Error('Session expired. Please sign out and sign in again.');
      err.status = 401;
      throw err;
    }
    if (!data?.user) {
      const err = new Error('Session expired. Please sign out and sign in again.');
      err.status = 401;
      throw err;
    }
    user = data.user;
  } catch (e) {
    if (e.status) throw e;
    console.error('[auth] getUser threw:', e?.message || e);
    const err = new Error('Session expired. Please sign out and sign in again.');
    err.status = 401;
    throw err;
  }

  const admin = supabaseAdmin();
  const { data: site, error: siteErr } = await admin
    .from('sites').select('*').eq('id', siteId).maybeSingle();
  if (siteErr) {
    console.error('[auth] site fetch error:', siteErr.message);
    const err = new Error('Could not load site.');
    err.status = 500;
    throw err;
  }
  if (!site) {
    const err = new Error('Site not found');
    err.status = 404;
    throw err;
  }
  if (site.user_id !== user.id) {
    const err = new Error('You do not own this site.');
    err.status = 403;
    throw err;
  }
  return { user, site };
}
