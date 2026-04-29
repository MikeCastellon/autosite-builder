// POST /.netlify/functions/support-book
//
// Creates a platform-level support call:
//   1. Validates the requested slot is still in the open-slots list (server
//      checks freshness — UI list could be stale)
//   2. Calls Zoom API to create a unique meeting
//   3. Inserts a row in `support_bookings`
//   4. Sends Postmark emails to the customer + the support host with a
//      .ics calendar invite attached
//
// Rate-limited per IP — 3 bookings per hour is plenty for honest use and
// stops obvious spam without auth getting in the way.
import { createClient } from '@supabase/supabase-js';
import { listOpenSlots } from './_lib/support-slots.js';
import { createZoomMeeting } from './_lib/zoom.js';
import { supportBookingToCustomer, supportBookingToHost } from './_lib/postmark.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { PUBLIC_CORS, PUBLIC_CORS_JSON } from './_shared/cors.js';

// Public marketing-page endpoint — book a support call. Uses wide-open
// CORS so the marketing site (separate origin from the app) can call
// it. Rate limit + honeypot + slot freshness are the actual guards.
const CORS = PUBLIC_CORS_JSON;

const SUPPORT_HOST_EMAIL = process.env.SUPPORT_HOST_EMAIL || process.env.POSTMARK_FROM_EMAIL || 'support@example.com';
const SUPPORT_TIMEZONE = process.env.SUPPORT_TIMEZONE || 'America/New_York';

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: PUBLIC_CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // Honeypot — silently succeed so bots think they got through
  if (payload.website) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };

  const customerName = String(payload.customer_name || '').trim();
  const customerEmail = String(payload.customer_email || '').trim().toLowerCase();
  const customerPhone = String(payload.customer_phone || '').trim();
  const topic = String(payload.topic || '').trim();
  const startISO = String(payload.start || '').trim();

  if (!customerName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Name is required' }) };
  if (!isEmail(customerEmail)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Valid email is required' }) };
  if (!startISO || isNaN(new Date(startISO).getTime())) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid time slot' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Postgres-backed rate limit: 3 support bookings per IP per hour.
  // Replaces the in-memory Map which was bypassable. Done after input
  // validation so a malformed request doesn't burn a slot.
  // (Security Audit H2 / CC-5)
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { limited } = await checkAndRecordRateLimit({
    db: supabase,
    ip,
    kind: 'support-book',
    windowMs: 60 * 60 * 1000,
    limit: 3,
  });
  if (limited) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many bookings — try again in an hour' }) };
  }

  // Re-validate slot against current bookings — rejects double-bookings
  // even if the UI showed a stale slot list.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: existingErr } = await supabase
    .from('support_bookings')
    .select('scheduled_at, ends_at, status')
    .gte('scheduled_at', since)
    .neq('status', 'cancelled');
  if (existingErr) {
    console.error('[support-book] supabase load error', existingErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not load availability' }) };
  }
  const openSlots = listOpenSlots({ existingBookings: existing || [] });
  const requested = new Date(startISO).getTime();
  const matched = openSlots.find((s) => new Date(s.startISO).getTime() === requested);
  if (!matched) {
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'That slot is no longer available — please pick another' }) };
  }

  // Create the Zoom meeting
  let meeting;
  try {
    meeting = await createZoomMeeting({
      topic: `Genius Websites — ${customerName}`,
      startISO: matched.startISO,
      durationMin: Math.round((new Date(matched.endISO) - new Date(matched.startISO)) / 60000),
      timezone: SUPPORT_TIMEZONE,
      agenda: topic || 'General support',
    });
  } catch (e) {
    console.error('[support-book] zoom create failed', e);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Could not create the Zoom meeting. Please try again.' }) };
  }

  // Insert the booking
  const { data: insertRows, error: insertErr } = await supabase
    .from('support_bookings')
    .insert({
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      topic: topic || null,
      scheduled_at: matched.startISO,
      ends_at: matched.endISO,
      zoom_meeting_id: meeting.id,
      zoom_join_url: meeting.join_url,
      zoom_password: meeting.password || null,
      zoom_start_url: meeting.start_url,
      status: 'scheduled',
    })
    .select('*')
    .single();
  if (insertErr) {
    console.error('[support-book] supabase insert error', insertErr);
    // Don't try to clean up Zoom meeting here — we'd rather have an orphan
    // meeting than leave the user thinking they didn't book. They'll get
    // an error and we'll see it in logs.
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not save booking' }) };
  }

  // Send emails BEFORE returning. Netlify functions terminate when the
  // handler returns, so an unawaited promise here gets killed mid-flight
  // and the emails never actually go out. Use allSettled so a single
  // bounce (e.g. host's address rejecting) doesn't block the customer's
  // confirmation. The booking is already saved either way — the user
  // also sees the join URL inline below as a fallback.
  const emailResults = await Promise.allSettled([
    supportBookingToCustomer({ booking: insertRows }),
    supportBookingToHost({ booking: insertRows, hostEmail: SUPPORT_HOST_EMAIL }),
  ]);
  emailResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[support-book] email ${i} failed:`, r.reason?.message || r.reason);
    }
  });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      booking: {
        id: insertRows.id,
        scheduled_at: insertRows.scheduled_at,
        ends_at: insertRows.ends_at,
        zoom_join_url: insertRows.zoom_join_url,
        zoom_password: insertRows.zoom_password,
      },
    }),
  };
};
