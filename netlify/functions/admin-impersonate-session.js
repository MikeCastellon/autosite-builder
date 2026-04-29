// POST /.netlify/functions/admin-impersonate-session
//
// Server-side flow that produces a short-lived handoff_id for the new
// "View as user" impersonation feature (no magic link in incognito).
// Requires super-admin JWT.
//
// What it does:
//   1. Validate caller is super-admin.
//   2. Look up target user's email.
//   3. Use Supabase Admin API generateLink → get hashed_token for that user.
//   4. Call verifyOtp server-side with the hashed_token → get a real
//      access_token + refresh_token for the target user.
//   5. Store those tokens in impersonation_handoffs with a 60-second TTL.
//   6. Return handoff_id (a uuid) — the caller opens a new tab to
//      /?impersonate=<handoff_id>, which then claims the tokens via
//      impersonate-claim.js and sets a tab-isolated session.
//
// Why two-step instead of returning tokens directly: avoids putting auth
// tokens into the URL bar of the new tab, where they'd be in browser history.
// The handoff_id in the URL is harmless on its own — it's single-use, expires
// in 60 seconds, and is consumed by the claim endpoint immediately on tab load.
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing auth token' }) };
  }
  const accessToken = auth.slice('Bearer '.length).trim();

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const targetUserId = String(payload.target_user_id || '').trim();
  if (!targetUserId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'target_user_id required' }) };
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Verify caller
  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerErr || !callerData?.user?.id) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid auth token' }) };
  }
  const callerId = callerData.user.id;

  // Confirm super-admin
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, is_super_admin, email')
    .eq('id', callerId)
    .maybeSingle();
  if (!callerProfile?.is_super_admin) {
    console.warn(`[admin-impersonate-session] non-admin ${callerId} attempted impersonation`);
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Super admin only' }) };
  }

  // Look up target email
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!targetProfile?.email) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Target user not found' }) };
  }

  // Step 1: generate magic link → returns hashed_token
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetProfile.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[admin-impersonate-session] generateLink failed', linkErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: linkErr?.message || 'Could not generate link' }) };
  }

  // Step 2: server-side verifyOtp consumes the magic link and yields a real
  // session. We use the SAME admin client because verifyOtp is called with
  // the hashed_token directly — no email/OTP roundtrip.
  const { data: sessionData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !sessionData?.session?.access_token) {
    console.error('[admin-impersonate-session] verifyOtp failed', verifyErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: verifyErr?.message || 'Could not mint session' }) };
  }

  // Step 3: store the tokens in a short-lived handoff record
  const expiresAt = new Date(Date.now() + 60_000).toISOString(); // 60s TTL
  const { data: handoff, error: insertErr } = await supabaseAdmin
    .from('impersonation_handoffs')
    .insert({
      target_user_id: targetProfile.id,
      admin_user_id: callerId,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (insertErr || !handoff?.id) {
    console.error('[admin-impersonate-session] handoff insert failed', insertErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not save handoff' }) };
  }

  // Audit
  console.log(
    `[admin-impersonate-session] admin=${callerProfile.email} (${callerId}) `
    + `→ target=${targetProfile.email} (${targetProfile.id}) handoff=${handoff.id}`
  );

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      handoff_id: handoff.id,
      target_email: targetProfile.email,
    }),
  };
};
