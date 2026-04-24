import { supabase } from './supabase.js';

// Per-customer metadata (notes + tags). Keyed by the dedup identity_key
// from src/lib/customerIdentity.js so it survives the customer rebooking
// under a slightly different name/punctuation. RLS guarantees the caller
// can only see their own rows.

export async function getCustomerMetadata({ ownerUserId, identityKey }) {
  if (!ownerUserId || !identityKey) return null;
  const { data, error } = await supabase
    .from('customer_metadata')
    .select('id, owner_user_id, identity_key, notes, tags, created_at, updated_at')
    .eq('owner_user_id', ownerUserId)
    .eq('identity_key', identityKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Bulk fetch for the list page so we can show tag chips on each row without
// N+1 round trips. Returns a Map keyed by identity_key for quick lookup.
export async function listCustomerMetadata({ ownerUserId }) {
  if (!ownerUserId) return new Map();
  const { data, error } = await supabase
    .from('customer_metadata')
    .select('identity_key, notes, tags')
    .eq('owner_user_id', ownerUserId);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) map.set(row.identity_key, row);
  return map;
}

// Upsert notes + tags for a customer. Tags is an array of short strings; we
// trim + dedupe + drop empties before saving so the UI can be permissive.
export async function saveCustomerMetadata({ ownerUserId, identityKey, notes, tags }) {
  if (!ownerUserId || !identityKey) throw new Error('Missing identity');
  const cleanTags = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))]
    : [];
  const { data, error } = await supabase
    .from('customer_metadata')
    .upsert({
      owner_user_id: ownerUserId,
      identity_key: identityKey,
      notes: notes ?? null,
      tags: cleanTags,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_user_id,identity_key' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Send a free-form email to a customer via the Postmark-backed Netlify
// function. Branded shell + ReplyTo set to the owner's email so customer
// replies route back to the owner, not the no-reply From address.
export async function sendCustomerEmail({ siteId, toEmail, subject, body }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch('/.netlify/functions/send-customer-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ siteId, toEmail, subject, body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Email failed');
  return json;
}
