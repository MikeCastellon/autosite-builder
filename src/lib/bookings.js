import { supabase } from './supabase.js';

// ─── Appointment times ──────────────────────────────────────────────────
//
// bookings.preferred_at holds the shop's wall-clock time written as if it
// were UTC: a 9:00 availability window yields "…T09:00:00.000Z"
// (netlify/functions/_lib/slot-math.js), the booking widget shows slots with
// timeZone 'UTC', and no shop time zone is stored anywhere. So it must be
// read back in UTC too. Formatting it in the viewer's zone shifts every
// appointment by their UTC offset (9:00 AM shows as 5:00 AM in New York).
// Only preferred_at works this way: created_at, deposit_paid_at etc. are
// real instants and stay in the viewer's local time.
// Exception: rows with referral_source 'owner-dashboard' created before
// wallTimeToBookingIso shipped hold a real instant (the old BookCustomerModal
// sent new Date(local).toISOString()). They read hours late here and block
// the wrong widget slot until a one-time backfill turns them into wall time:
// (preferred_at at time zone '<owner zone>') at time zone 'UTC', for rows
// created before the deploy (created_at < deploy time), run right after it.
// Run before the deploy, the old dashboard would show them hours early.

// "Mon, Oct 6, 2026, 9:00 AM" by default; pass Intl options to narrow it.
export function formatBookingTime(iso, options) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    ...(options || {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: 'numeric', minute: '2-digit',
    }),
    timeZone: 'UTC',
  });
}

// "YYYY-MM-DD" of the appointment in shop time (calendar bucketing).
export function bookingDayKey(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// <input type="datetime-local"> value ("2026-10-06T09:00", seconds optional)
// -> the preferred_at to store. The owner types shop time, so it is kept as
// wall-clock time; new Date(value) would read it in the browser's zone.
export function wallTimeToBookingIso(value) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(value || ''));
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4] || '00'}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export async function listBookingsForOwner({ userId, statusIn, from, to, search }) {
  let q = supabase
    .from('bookings')
    .select('*')
    .eq('owner_user_id', userId)
    .order('preferred_at', { ascending: true });

  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (from) q = q.gte('preferred_at', from);
  if (to) q = q.lte('preferred_at', to);
  if (search) q = q.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listAllBookings({ statusIn, from, to, search, ownerUserId }) {
  let q = supabase.from('bookings').select('*').order('preferred_at', { ascending: true });
  if (ownerUserId) q = q.eq('owner_user_id', ownerUserId);
  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (from) q = q.gte('preferred_at', from);
  if (to) q = q.lte('preferred_at', to);
  if (search) q = q.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateBooking({ bookingId, action, reason, owner_notes }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch('/.netlify/functions/update-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bookingId, action, reason, owner_notes }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Update failed');
  return body.booking;
}

export async function sendBookingReminder({ bookingId, customMessage }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch('/.netlify/functions/send-booking-reminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bookingId, customMessage }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Reminder failed to send');
  return body;
}

// Build an SMS deep-link the device's native messaging app can open. Formats
// the destination number to E.164 so iOS/Android both parse it cleanly, then
// URL-encodes the body. The owner reviews and presses Send from their own
// number — no Twilio, no per-message cost.
export function buildSmsReminderHref({ phone, message }) {
  if (!phone) return null;
  // Strip everything except digits and a leading '+'.
  let digits = String(phone).replace(/[^\d+]/g, '');
  // Default to US +1 if no country code given (10-digit US numbers).
  if (!digits.startsWith('+')) {
    digits = digits.replace(/^1?/, '');  // strip a leading 1 if present
    if (digits.length === 10) digits = '+1' + digits;
    else digits = '+' + digits;
  }
  // iOS prefers '&body=' for the second param when no other params exist;
  // Android accepts '?body='. '?body=' works on both modern iOS (16+) and
  // Android, so use that for one-format simplicity.
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}

export function defaultReminderMessage(booking, site) {
  const first = String(booking?.customer_name || '').split(/\s+/)[0] || 'there';
  const bizName = site?.business_info?.businessName || 'us';
  const when = formatBookingTime(booking?.preferred_at, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
  return `Hi ${first}, friendly reminder: your appointment with ${bizName} is on ${when}. Reply to confirm or reschedule. Thanks!`;
}

export async function saveOwnerNotes(bookingId, owner_notes) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ owner_notes, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
