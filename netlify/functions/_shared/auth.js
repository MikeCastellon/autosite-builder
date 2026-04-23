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
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const token = auth.slice(7);

  const anon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    const err = new Error('Invalid token');
    err.status = 401;
    throw err;
  }

  const admin = supabaseAdmin();
  const { data: site, error: siteErr } = await admin
    .from('sites').select('*').eq('id', siteId).maybeSingle();
  if (siteErr || !site) {
    const err = new Error('Site not found');
    err.status = 404;
    throw err;
  }
  if (site.user_id !== userData.user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return { user: userData.user, site };
}
