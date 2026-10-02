// Super-admin gate for admin functions: a signed-in user (requireUser)
// whose profiles.is_super_admin is true, read with the service-role client
// `db` (the same check admin-impersonate and custom-site-admin make).
// Returns { user, profile } or throws an Error with .status (401 / 403).
import { requireUser } from './auth.js';

export async function requireSuperAdmin(event, db, tag = 'admin') {
  const user = await requireUser(event);
  const { data: profile, error } = await db
    .from('profiles')
    .select('id, email, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !profile?.is_super_admin) {
    console.warn(`[${tag}] non-admin ${user.id} was refused`);
    const err = new Error('Super admin only');
    err.status = 403;
    throw err;
  }
  return { user, profile };
}
