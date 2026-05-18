// src/lib/createCharge.js
import { supabase } from './supabase.js';

/**
 * Creates an in-person charge and returns { charge_id, checkout_url }.
 *
 * Two modes:
 *   - service_id + addon_ids: server resolves prices from scheduler_config,
 *     amount_cents is ignored (server computes the total)
 *   - amount_cents + service_name: legacy custom-amount path
 *
 * @param {{ amount_cents?: number, service_name?: string, customer_name?: string, customer_phone?: string, site_id?: string, service_id?: string, addon_ids?: string[] }} opts
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
