// POST /.netlify/functions/impersonate-claim
//
// Anonymous endpoint — the handoff_id IS the bearer token. Single-use,
// expires in 60 seconds (set when the admin-impersonate-session function
// created the row).
//
// Returns the access_token + refresh_token + target_email so the
// impersonation tab can call supabase.auth.setSession() against its own
// sessionStorage-backed client.
import { createClient } from '@supabase/supabase-js';

// The tokens are needed for exactly one response. Blank them as the handoff
// is claimed (or found expired) so the table never keeps a usable session at
// rest. '' rather than null: both columns are NOT NULL in the live schema.
export const SCRUBBED_TOKENS = { access_token: '', refresh_token: '' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Claim a handoff with the service-role client `db`. Returns
// { status, body } for the handler to send. Exported for tests.
export async function claimHandoff(db, handoffId, now = new Date()) {
  // Fetch + validate
  const { data: handoff, error: fetchErr } = await db
    .from('impersonation_handoffs')
    .select('id, target_user_id, access_token, refresh_token, expires_at, consumed_at')
    .eq('id', handoffId)
    .maybeSingle();
  if (fetchErr || !handoff) {
    return { status: 404, body: { error: 'Handoff not found' } };
  }
  if (handoff.consumed_at || !handoff.access_token || !handoff.refresh_token) {
    return { status: 410, body: { error: 'Handoff already used' } };
  }
  if (new Date(handoff.expires_at) < now) {
    // Best effort: an unclaimed, expired handoff still holds live tokens.
    try {
      await db
        .from('impersonation_handoffs')
        .update(SCRUBBED_TOKENS)
        .eq('id', handoffId)
        .is('consumed_at', null);
    } catch { /* the 410 stands either way */ }
    return { status: 410, body: { error: 'Handoff expired' } };
  }

  // Mark consumed BEFORE returning so a parallel claim can't double-use it.
  // Use a conditional update on consumed_at = null to atomically claim it,
  // blanking the stored tokens in the same write (we already hold them).
  const { data: updated, error: claimErr } = await db
    .from('impersonation_handoffs')
    .update({ consumed_at: now.toISOString(), ...SCRUBBED_TOKENS })
    .eq('id', handoffId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (claimErr || !updated) {
    return { status: 410, body: { error: 'Handoff already used' } };
  }

  // Look up target email (cosmetic — used for the banner label)
  const { data: targetProfile } = await db
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', handoff.target_user_id)
    .maybeSingle();

  return {
    status: 200,
    body: {
      ok: true,
      access_token: handoff.access_token,
      refresh_token: handoff.refresh_token,
      target_email: targetProfile?.email || '',
      target_name: [targetProfile?.first_name, targetProfile?.last_name].filter(Boolean).join(' ').trim() || '',
    },
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const handoffId = String(payload.handoff_id || '').trim();
  if (!handoffId || !/^[0-9a-f-]{36}$/i.test(handoffId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid handoff_id' }) };
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { status, body } = await claimHandoff(supabaseAdmin, handoffId);
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
};
