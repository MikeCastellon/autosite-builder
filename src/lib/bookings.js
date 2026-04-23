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
