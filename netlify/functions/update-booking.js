import { createClient } from '@supabase/supabase-js';
import { applyAction, ALLOWED_ACTIONS } from './_lib/booking-state.js';
import { statusUpdateToCustomer } from './_lib/postmark.js';
import { requestedTimeText } from './_lib/booking-request.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

const MAX_REASON = 1000;
const MAX_OWNER_NOTES = 5000;
// "2026-10-06T09:00" (seconds optional) from the dashboard's time picker:
// the shop's wall-clock time, stored as UTC like every preferred_at.
const WALL_TIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function wallTimeToIso(value) {
  const m = WALL_TIME_RE.exec(String(value || ''));
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4] || '00'}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const minutesOf = (b) => (typeof b.duration_minutes === 'number' && b.duration_minutes > 0 ? b.duration_minutes : 60);

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const CORS = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return reply(401, { error: 'Missing token' });
  const accessToken = auth.slice(7);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  // shop_preferred_at: the appointment time the owner set while confirming
  // (wall clock, like owner-create-booking). A stray preferred_at from an
  // older dashboard is ignored, as it always was.
  const { bookingId, action, reason, owner_notes, shop_preferred_at, force } = body;
  if (!bookingId || typeof bookingId !== 'string' || !ALLOWED_ACTIONS.includes(action)) {
    return reply(400, { error: 'Invalid request' });
  }
  if (reason != null && (typeof reason !== 'string' || reason.length > MAX_REASON)) {
    return reply(400, { error: `The reason can be ${MAX_REASON} characters at most.` });
  }
  if (owner_notes != null && (typeof owner_notes !== 'string' || owner_notes.length > MAX_OWNER_NOTES)) {
    return reply(400, { error: `Notes can be ${MAX_OWNER_NOTES} characters at most.` });
  }

  // Verify token and identify the caller
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(accessToken);
  if (authErr || !user) return reply(401, { error: 'Invalid token' });

  // Fetch booking + site + owner
  const { data: booking } = await authClient
    .from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) return reply(404, { error: 'Booking not found' });

  const { data: callerProfile } = await authClient
    .from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  const isOwner = booking.owner_user_id === user.id;
  const isAdmin = !!callerProfile?.is_super_admin;
  if (!isOwner && !isAdmin) return reply(403, { error: 'Forbidden' });

  const transition = applyAction(booking.status, action, { reason });
  if (!transition.ok) return reply(400, { error: transition.error });

  const patch = { status: transition.status, updated_at: new Date().toISOString() };
  if (action === 'decline') patch.declined_reason = reason;
  if (owner_notes !== undefined) patch.owner_notes = owner_notes;

  if (action === 'confirm') {
    // A request-form booking (booking_mode 'simple') holds a placeholder
    // time: confirming it as-is would email the customer a time they never
    // asked for. The owner picks the real one.
    let newTime = null;
    if (shop_preferred_at != null && shop_preferred_at !== '') {
      newTime = wallTimeToIso(shop_preferred_at);
      if (!newTime) return reply(400, { error: 'Invalid appointment time' });
    } else if (requestedTimeText(booking.notes)) {
      return reply(400, {
        error: 'Set the appointment time before confirming: this customer asked for a time in their own words. (Reload the page if you see no time picker.)',
        code: 'time_required',
      });
    }
    if (newTime) patch.preferred_at = newTime;

    // Never double-book silently: a confirmed booking blocks its slot in the
    // widget, so confirming an overlapping one needs the owner's say-so.
    if (!force) {
      const start = Date.parse(newTime || booking.preferred_at);
      const end = start + minutesOf(booking) * 60 * 1000;
      const dayStart = new Date(start - 24 * 3600 * 1000).toISOString();
      const dayEnd = new Date(end).toISOString();
      const { data: others } = await authClient
        .from('bookings')
        .select('id, customer_name, preferred_at, duration_minutes')
        .eq('site_id', booking.site_id)
        .eq('status', 'confirmed')
        .gte('preferred_at', dayStart)
        .lte('preferred_at', dayEnd);
      const clashes = (others || []).filter((o) => {
        if (o.id === booking.id) return false;
        const os = Date.parse(o.preferred_at);
        return os < end && start < os + minutesOf(o) * 60 * 1000;
      });
      if (clashes.length > 0) {
        return reply(409, {
          error: 'This overlaps a booking you already confirmed. Reload the page to confirm it anyway.',
          code: 'overlap',
          conflicts: clashes.map((o) => ({ id: o.id, customer_name: o.customer_name, preferred_at: o.preferred_at })),
        });
      }
    }
  }

  // Only from the status we read: two clicks (or two people) can't both
  // apply a transition, and the second gets told instead of overwriting.
  const { data: updated, error: upErr } = await authClient
    .from('bookings').update(patch).eq('id', bookingId).eq('status', booking.status).select().maybeSingle();
  if (upErr) {
    console.error('update-booking update error:', upErr);
    return reply(500, { error: 'Update failed' });
  }
  if (!updated) {
    return reply(409, { error: 'This booking was just changed. Reload to see its current status.', code: 'stale' });
  }

  // Customer email on confirm/decline/cancel
  if (['confirm', 'decline', 'cancel'].includes(action)) {
    const { data: site } = await authClient
      .from('sites').select('id, business_info, slug, published_url, generated_content').eq('id', updated.site_id).maybeSingle();
    const emailStatus = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[action];
    // A request that was never confirmed still holds the placeholder time:
    // the email names what the customer asked for instead.
    const requestedTime = action !== 'confirm' && booking.status === 'pending'
      ? requestedTimeText(booking.notes)
      : null;
    // Await the send so Netlify doesn't terminate the function before
    // Postmark completes the request.
    await statusUpdateToCustomer({ booking: updated, site, status: emailStatus, reason, requestedTime })
      .catch((err) => console.error('customer email failed:', err));
  }

  return reply(200, { ok: true, booking: updated });
};
