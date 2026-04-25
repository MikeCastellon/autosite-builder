import { supabase } from './supabase.js';
import { identityKey } from './customerIdentity.js';

// Columns we ever return/accept. Kept in one place so Supabase queries,
// the edit form, and the merged-list code can't drift apart.
const COLS = 'id, owner_user_id, identity_key, name, email, phone, vehicle_make, vehicle_model, vehicle_year, vehicle_size, notes, tags, created_at, updated_at';

export async function listManualCustomers({ ownerUserId }) {
  if (!ownerUserId) return [];
  const { data, error } = await supabase
    .from('customer_profiles')
    .select(COLS)
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCustomerProfileByIdentityKey({ ownerUserId, key }) {
  if (!ownerUserId || !key) return null;
  const { data, error } = await supabase
    .from('customer_profiles')
    .select(COLS)
    .eq('owner_user_id', ownerUserId)
    .eq('identity_key', key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Trim strings + compute identity_key so the caller doesn't have to.
// Returns the inserted row. Throws on duplicate identity (caller can catch
// to prompt "This customer already exists — open instead?").
export async function createManualCustomer({
  ownerUserId,
  name,
  email,
  phone,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  vehicleSize,
  notes,
  tags,
}) {
  if (!ownerUserId) throw new Error('Missing owner');
  const cleanedName  = (name  || '').trim();
  const cleanedEmail = (email || '').trim().toLowerCase();
  const cleanedPhone = (phone || '').trim();
  if (!cleanedName && !cleanedEmail && !cleanedPhone) {
    throw new Error('At least one of name, email, or phone is required.');
  }
  const key = identityKey({ customer_email: cleanedEmail, customer_phone: cleanedPhone, customer_name: cleanedName });
  const cleanedTags = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))]
    : [];

  const payload = {
    owner_user_id: ownerUserId,
    identity_key: key,
    name: cleanedName || null,
    email: cleanedEmail || null,
    phone: cleanedPhone || null,
    vehicle_make: (vehicleMake || '').trim() || null,
    vehicle_model: (vehicleModel || '').trim() || null,
    vehicle_year: vehicleYear ? Number(vehicleYear) : null,
    vehicle_size: vehicleSize || null,
    notes: (notes || '').trim() || null,
    tags: cleanedTags,
  };

  const { data, error } = await supabase
    .from('customer_profiles')
    .insert(payload)
    .select(COLS)
    .single();
  if (error) {
    // PG code 23505 = unique_violation → surface a friendlier message.
    if (error.code === '23505') {
      const err = new Error('A customer with this email / phone / name already exists.');
      err.code = 'duplicate';
      throw err;
    }
    throw error;
  }
  return data;
}

export async function updateManualCustomer({ id, patch }) {
  if (!id) throw new Error('Missing id');
  const { data, error } = await supabase
    .from('customer_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}
