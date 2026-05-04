import { createClient } from '@supabase/supabase-js';
import { bookingReminderToCustomer } from './_lib/postmark.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

// Owner-triggered booking reminder, sent via Postmark using the same
// branded shell as the rest of the booking emails. Caller must be the
// booking's owner (or super_admin) — same auth pattern as update-booking.
const MAX_CUSTOM_MSG = 1_000;

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const CORS = jsonHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
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

  const { bookingId, customMessage } = body;
  if (!bookingId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'bookingId is required' }) };
  }
  const customMsg = String(customMessage || '').trim().slice(0, MAX_CUSTOM_MSG);

  const admin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const { data: booking, error: bookingErr } = await admin
    .from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (bookingErr) {
    console.error('[send-booking-reminder] booking fetch error:', bookingErr.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not load booking' }) };
  }
  if (!booking) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Booking not found' }) };
  }
  if (!booking.customer_email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Booking has no customer email' }) };
  }

  const { data: callerProfile } = await admin
    .from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  const isOwner = booking.owner_user_id === user.id;
  const isAdmin = !!callerProfile?.is_super_admin;
  if (!isOwner && !isAdmin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Load the site so the email footer has business name / address / phone /
  // hours. site_id may be null on some legacy bookings — fall back gracefully.
  let site = null;
  if (booking.site_id) {
    const { data: siteRow } = await admin
      .from('sites')
      .select('id, business_info, slug, published_url, generated_content')
      .eq('id', booking.site_id)
      .maybeSingle();
    site = siteRow || null;
  }

  try {
    const res = await bookingReminderToCustomer({
      booking,
      site,
      customMessage: customMsg || undefined,
    });
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, messageId: res?.MessageID || null }),
    };
  } catch (err) {
    console.error('[send-booking-reminder] postmark failed:', err?.message || err);
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: 'Reminder failed to send. Please try again.' }),
    };
  }
};
