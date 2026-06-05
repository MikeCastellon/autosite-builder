import { supabase } from './supabase.js';

export async function listInquiriesForOwner({ userId, statusIn, search }) {
  let q = supabase
    .from('inquiries')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });

  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listAllInquiries({ statusIn, search, ownerUserId } = {}) {
  let q = supabase.from('inquiries').select('*').order('created_at', { ascending: false });
  if (ownerUserId) q = q.eq('owner_user_id', ownerUserId);
  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateInquiryStatus(id, status) {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveInquiryOwnerNotes(id, owner_notes) {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ owner_notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
