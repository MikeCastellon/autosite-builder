// src/lib/createCharge.js
import { supabase } from './supabase.js';

/**
 * Creates an in-person charge and returns { charge_id, checkout_url }.
 * @param {{ amount_cents: number, service_name?: string, customer_name?: string, customer_phone?: string, site_id?: string }} opts
 */
export async function createCharge(opts) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetch('/.netlify/functions/create-charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body; // { charge_id, checkout_url }
}
