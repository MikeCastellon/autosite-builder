import { createClient } from '@supabase/supabase-js';
import { ownerToCustomerMessage } from './_lib/postmark.js';

// Owner-initiated free-form email to a customer, sent through the same
// Postmark + branded shell that the automated booking emails use. Caller
// must own the site referenced by siteId — used both for ownership check
// and to populate the business-info block in the email footer.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const MAX_SUBJECT = 200;
const MAX_BODY = 10_000;

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) };
  }
  const accessToken = auth.slice(7);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId, toEmail, subject, body: messageBody } = body;
  if (!siteId || !isValidEmail(toEmail)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'siteId and a valid toEmail are required' }) };
  }
  const subj = String(subject || '').trim().slice(0, MAX_SUBJECT);
  const msg  = String(messageBody || '').trim().slice(0, MAX_BODY);
  if (!subj)  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Subject is required' }) };
  if (!msg)   return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Message body is required' }) };

  const admin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Verify the JWT and identify the caller.
  const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Load the site, verify ownership (super_admin can email on behalf of any
  // owner — same pattern as update-booking).
  const { data: site, error: siteErr } = await admin
    .from('sites')
    .select('id, user_id, business_info, slug, published_url, generated_content')
    .eq('id', siteId)
    .maybeSingle();
  if (siteErr) {
    console.error('[send-customer-email] site fetch error:', siteErr.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not load site' }) };
  }
  if (!site) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  const { data: callerProfile } = await admin
    .from('profiles').select('email, is_super_admin').eq('id', user.id).maybeSingle();
  const isOwner = site.user_id === user.id;
  const isAdmin = !!callerProfile?.is_super_admin;
  if (!isOwner && !isAdmin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Reply-to: prefer the site's configured business email, fall back to the
  // owner's account email so customer replies always land somewhere reachable.
  let ownerEmail = site?.business_info?.email || null;
  if (!ownerEmail) {
    if (isOwner) {
      ownerEmail = user.email || callerProfile?.email || null;
    } else {
      // Admin sending on behalf — use the site owner's account email.
      const { data: ownerProfile } = await admin
        .from('profiles').select('email').eq('id', site.user_id).maybeSingle();
      ownerEmail = ownerProfile?.email || null;
    }
  }

  try {
    const res = await ownerToCustomerMessage({
      toEmail: toEmail.trim(),
      subject: subj,
      body: msg,
      site,
      replyTo: ownerEmail,
    });
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, messageId: res?.MessageID || null }),
    };
  } catch (err) {
    console.error('[send-customer-email] postmark failed:', err?.message || err);
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: 'Email failed to send. Please try again.' }),
    };
  }
};
