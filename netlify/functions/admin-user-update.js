// POST /.netlify/functions/admin-user-update
//
// Admin user drawer > Account > Edit. Super admins only. Corrects a
// customer's name, email, phone or business name, e.g. a name or email
// mistyped when the team handed a free website over.
//   body  { userId, firstName?, lastName?, email?, phone?, businessName? }
//         only the fields sent change
//   reply { profile, changed, handovers: [{ kind: 'free'|'custom', id }], stripeCustomer }
//
// The email is the sign-in address, so it changes in auth.users too, as
// confirmed (the admin vouches for it, as the hand-over does when it creates
// the account). Browsers can't write another user's profiles.email
// (profiles_guard_owner_columns), so this runs with the service role.
// Free-website and custom-website rows tied to the account take the new
// values where they held the old ones; `handovers` lists the handed-over
// rows whose email changed, so the drawer can send the access email again
// (free-site-admin / custom-site-admin handover-email).
// stripeCustomer: Stripe keeps its own copy of the email for receipts.
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { accountChanges, handoverRowPatch } from '../../src/lib/adminUserEdit.js';

const PROFILE_FIELDS = 'id, email, first_name, last_name, phone, business_name, is_super_admin, stripe_customer_id';
const ROW_FIELDS = 'id, client_first_name, client_last_name, client_email, client_phone, business_name, handed_over_at';
const HANDOVER_TABLES = [
  { table: 'free_site_handovers', kind: 'free' },
  { table: 'custom_site_projects', kind: 'custom' },
];

function forDrawer(p) {
  return { id: p.id, email: p.email, first_name: p.first_name, last_name: p.last_name, phone: p.phone, business_name: p.business_name };
}

export const handler = async (event) => {
  const CORS = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(event.headers) };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const db = supabaseAdmin();
  let actor;
  try {
    ({ actor } = await requireSuperAdmin(event, db));
  } catch (e) {
    return reply(e.status || 401, { error: e.message || 'Not signed in' });
  }

  try {
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) return reply(400, { error: 'userId is required' });
    const { data: before, error: loadError } = await db.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle();
    if (loadError) throw loadError;
    if (!before) return reply(404, { error: 'User not found' });

    const { changes, error: invalid } = accountChanges(body, before);
    if (invalid) return reply(400, { error: invalid });
    const changed = Object.keys(changes);
    if (!changed.length) return reply(200, { profile: forDrawer(before), changed, handovers: [], stripeCustomer: false });

    // Auth first: a taken email is the likeliest failure, and nothing is
    // written yet when it fails. A retry after a later failure is safe
    // (setting the same email again is a no-op).
    const authPatch = {};
    if (changes.email) {
      // An admin's sign-in is theirs to change, from account settings.
      if (before.is_super_admin) return reply(403, { error: 'Admin accounts change their email in account settings' });
      const { data: taken } = await db.from('profiles').select('id').eq('email', changes.email).limit(1);
      if (taken?.some((p) => p.id !== userId)) return reply(409, { error: 'Another account already uses that email' });
      Object.assign(authPatch, { email: changes.email, email_confirm: true });
    }
    // The sign-up names live in user_metadata too (merged, not replaced),
    // and some admin tools fall back to them.
    if ('first_name' in changes || 'last_name' in changes) {
      authPatch.user_metadata = {
        first_name: ('first_name' in changes ? changes.first_name : before.first_name) || '',
        last_name: ('last_name' in changes ? changes.last_name : before.last_name) || '',
      };
    }
    if (Object.keys(authPatch).length) {
      const { error } = await db.auth.admin.updateUserById(userId, authPatch);
      if (error) {
        if (changes.email && /already|registered|exists/i.test(error.message || '')) {
          return reply(409, { error: 'Another account already uses that email' });
        }
        console.error('[admin-user-update] auth update failed:', error.message);
        return reply(500, { error: 'Could not update the sign-in details' });
      }
    }

    const { data: after, error: saveError } = await db.from('profiles').update(changes).eq('id', userId).select(PROFILE_FIELDS).single();
    if (saveError || !after) {
      console.error('[admin-user-update] profile update failed:', saveError?.message);
      return reply(500, { error: changes.email ? 'The sign-in email changed but the profile didn\'t. Save again.' : 'Could not save' });
    }

    const handovers = [];
    for (const { table, kind } of HANDOVER_TABLES) {
      const { data: rows, error } = await db.from(table).select(ROW_FIELDS).eq('customer_user_id', userId);
      if (error) { console.error(`[admin-user-update] ${table} not read:`, error.message); continue; }
      for (const row of rows || []) {
        const patch = handoverRowPatch(row, before, changes);
        if (!Object.keys(patch).length) continue;
        const { error: rowError } = await db.from(table).update(patch).eq('id', row.id);
        if (rowError) { console.error(`[admin-user-update] ${table} ${row.id} not updated:`, rowError.message); continue; }
        if (patch.client_email && row.handed_over_at) handovers.push({ kind, id: row.id });
      }
    }

    // There is no audit table for this; the function log keeps who changed what.
    console.log(`[admin-user-update] ${actor} changed ${changed.join(', ')} for ${userId}`
      + (changes.email ? ` (email ${before.email} -> ${changes.email})` : ''));
    return reply(200, {
      profile: forDrawer(after),
      changed,
      handovers,
      stripeCustomer: !!(changes.email && before.stripe_customer_id),
    });
  } catch (e) {
    console.error('[admin-user-update] failed:', e?.message || e);
    return reply(500, { error: 'Something went wrong' });
  }
};
