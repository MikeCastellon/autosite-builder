import { requireUser } from '../_shared/auth.js';

// The custom website functions are for super admins only. Returns the user
// and `actor` (their email, for the activity log), or throws with .status.
export async function requireSuperAdmin(event, db) {
  const user = await requireUser(event);
  const { data: profile } = await db.from('profiles').select('email, is_super_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_super_admin) {
    const err = new Error('Admins only');
    err.status = 403;
    throw err;
  }
  return { user, actor: profile.email || user.email || 'admin' };
}
