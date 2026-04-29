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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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

  // Fetch + validate
  const { data: handoff, error: fetchErr } = await supabaseAdmin
    .from('impersonation_handoffs')
    .select('id, target_user_id, access_token, refresh_token, expires_at, consumed_at')
    .eq('id', handoffId)
    .maybeSingle();
  if (fetchErr || !handoff) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Handoff not found' }) };
  }
  if (handoff.consumed_at) {
    return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Handoff already used' }) };
  }
  if (new Date(handoff.expires_at) < new Date()) {
    return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Handoff expired' }) };
  }

  // Mark consumed BEFORE returning so a parallel claim can't double-use it.
  // Use a conditional update on consumed_at = null to atomically claim it.
  const { data: updated, error: claimErr } = await supabaseAdmin
    .from('impersonation_handoffs')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', handoffId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (claimErr || !updated) {
    return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Handoff already used' }) };
  }

  // Look up target email (cosmetic — used for the banner label)
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', handoff.target_user_id)
    .maybeSingle();

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      access_token: handoff.access_token,
      refresh_token: handoff.refresh_token,
      target_email: targetProfile?.email || '',
      target_name: [targetProfile?.first_name, targetProfile?.last_name].filter(Boolean).join(' ').trim() || '',
    }),
  };
};
