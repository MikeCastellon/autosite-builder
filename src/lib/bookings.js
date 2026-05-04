import { supabase } from './supabase.js';

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
  const when = new Date(booking?.preferred_at).toLocaleString('en-US', {
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
