import { createClient } from '@supabase/supabase-js';
import { applyAction, ALLOWED_ACTIONS } from './_lib/booking-state.js';
import { statusUpdateToCustomer } from './_lib/postmark.js';

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
  if (!auth?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) };
  }
  const accessToken = auth.slice(7);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { bookingId, action, reason, owner_notes } = body;
  if (!bookingId || !ALLOWED_ACTIONS.includes(action)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  // Verify token and identify the caller
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(accessToken);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Fetch booking + site + owner
  const { data: booking } = await authClient
    .from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Booking not found' }) };
  }

  const { data: callerProfile } = await authClient
    .from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  const isOwner = booking.owner_user_id === user.id;
  const isAdmin = !!callerProfile?.is_super_admin;
  if (!isOwner && !isAdmin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const transition = applyAction(booking.status, action, { reason });
  if (!transition.ok) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: transition.error }) };
  }

  const patch = { status: transition.status, updated_at: new Date().toISOString() };
  if (action === 'decline') patch.declined_reason = reason;
  if (owner_notes !== undefined) patch.owner_notes = owner_notes;

  const { data: updated, error: upErr } = await authClient
    .from('bookings').update(patch).eq('id', bookingId).select().single();
  if (upErr) {
    console.error('update-booking update error:', upErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Update failed' }) };
  }

  // Customer email on confirm/decline/cancel
  if (['confirm', 'decline', 'cancel'].includes(action)) {
    const { data: site } = await authClient
      .from('sites').select('id, business_info, slug, published_url, generated_content').eq('id', updated.site_id).maybeSingle();
    const emailStatus = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[action];
    // Await the send so Netlify doesn't terminate the function before
    // Postmark completes the request.
    await statusUpdateToCustomer({ booking: updated, site, status: emailStatus, reason })
      .catch((err) => console.error('customer email failed:', err));
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, booking: updated }) };
};
