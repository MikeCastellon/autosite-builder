// POST /.netlify/functions/admin-impersonate
//
// Generates a one-time Supabase magic link for the target user. Used by the
// admin "View as user" feature. The caller (admin) opens the returned link in
// an incognito window so their own admin session in the main browser stays
// intact — opening it in a normal tab would hijack the admin's session via
// localStorage broadcast.
//
// Security:
//   - Caller must present a valid Supabase JWT (Authorization: Bearer …)
//   - That user must have profiles.is_super_admin = true
//   - Service role key is used only server-side to talk to Supabase Auth
//     Admin API; never returned to the client
//   - The generated link expires per Supabase default (typically 24h, but
//     it's single-use — once consumed it can't be reused)
//   - Every successful invocation is logged to the function logs with both
//     admin and target user IDs for auditing
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const APP_URL = process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com';

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

  // Service role client — only used in this function; never exposed to the
  // browser. Required for both the JWT verification and the admin API call.
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // 1. Verify the caller's JWT and pull their user id
  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerErr || !callerData?.user?.id) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid auth token' }) };
  }
  const callerId = callerData.user.id;

  // 2. Confirm the caller is a super-admin
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, is_super_admin, email')
    .eq('id', callerId)
    .maybeSingle();
  if (profileErr || !callerProfile?.is_super_admin) {
    console.warn(`[admin-impersonate] non-admin ${callerId} attempted impersonation`);
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Super admin only' }) };
  }

  // 3. Look up the target user's email (need email — not id — for generateLink)
  const { data: targetProfile, error: targetErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('id', targetUserId)
    .maybeSingle();
  if (targetErr || !targetProfile?.email) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Target user not found' }) };
  }

  // 4. Generate the magic link via Supabase Auth Admin API
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetProfile.email,
    options: { redirectTo: APP_URL },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[admin-impersonate] generateLink failed', linkErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: linkErr?.message || 'Could not generate link' }) };
  }

  // Audit log — captured in Netlify function logs. Could promote to a real
  // audit table later if needed.
  console.log(
    `[admin-impersonate] admin=${callerProfile.email} (${callerId}) `
    + `→ target=${targetProfile.email} (${targetProfile.id})`
  );

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      action_link: linkData.properties.action_link,
      target_email: targetProfile.email,
    }),
  };
};
