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
//   - Every successful invocation is recorded in `admin_impersonations`
//     with admin id, target id, free-form reason, IP, and user-agent
//     before the magic link is generated. This is the auditable trail —
//     console.log is no longer the source of truth (Security Audit H1).
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

const APP_URL = process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com';

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const json = jsonHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: json, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { statusCode: 401, headers: json, body: JSON.stringify({ error: 'Missing auth token' }) };
  }
  const accessToken = auth.slice('Bearer '.length).trim();

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const targetUserId = String(payload.target_user_id || '').trim();
  if (!targetUserId) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'target_user_id required' }) };
  }

  // The reason is part of the audit row. Don't allow blank or trivially
  // short reasons — accountability hinges on an admin having to write
  // down *why* before they get the link.
  const reason = String(payload.reason || '').trim();
  if (reason.length < 4) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Reason required (min 4 chars)' }) };
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerErr || !callerData?.user?.id) {
    return { statusCode: 401, headers: json, body: JSON.stringify({ error: 'Invalid auth token' }) };
  }
  const callerId = callerData.user.id;

  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, is_super_admin, email')
    .eq('id', callerId)
    .maybeSingle();
  if (profileErr || !callerProfile?.is_super_admin) {
    console.warn(`[admin-impersonate] non-admin ${callerId} attempted impersonation`);
    return { statusCode: 403, headers: json, body: JSON.stringify({ error: 'Super admin only' }) };
  }

  const { data: targetProfile, error: targetErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('id', targetUserId)
    .maybeSingle();
  if (targetErr || !targetProfile?.email) {
    return { statusCode: 404, headers: json, body: JSON.stringify({ error: 'Target user not found' }) };
  }

  // Audit log — INSERT before generating the link. If the link generation
  // fails afterwards, the audit row remains, which is correct: we want
  // visibility into attempted impersonations too.
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || null;
  const userAgent = event.headers['user-agent'] || event.headers['User-Agent'] || null;
  const { error: auditErr } = await supabaseAdmin
    .from('admin_impersonations')
    .insert({
      admin_user_id: callerId,
      admin_email: callerProfile.email,
      target_user_id: targetProfile.id,
      target_email: targetProfile.email,
      reason,
      ip,
      user_agent: userAgent,
    });
  if (auditErr) {
    // Fail closed: if the audit can't be written, do not generate the
    // magic link. Compliance is the whole point of this gate.
    console.error('[admin-impersonate] audit insert failed', auditErr);
    return { statusCode: 500, headers: json, body: JSON.stringify({ error: 'Could not write audit log; impersonation aborted.' }) };
  }

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetProfile.email,
    options: { redirectTo: APP_URL },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[admin-impersonate] generateLink failed', linkErr);
    return { statusCode: 500, headers: json, body: JSON.stringify({ error: linkErr?.message || 'Could not generate link' }) };
  }

  return {
    statusCode: 200,
    headers: json,
    body: JSON.stringify({
      ok: true,
      action_link: linkData.properties.action_link,
      target_email: targetProfile.email,
    }),
  };
};
