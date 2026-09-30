// src/lib/createCharge.js
import { supabase } from './supabase.js';
import { resolveVariant, addonPriceForVehicle, savedVehicleTypes } from './schedulerConfig.js';

/**
 * Creates an in-person charge and returns { charge_id, checkout_url, amount_cents }.
 *
 * Two modes:
 *   - service_id (+ vehicle_type_id, addon_ids): the server prices it from
 *     scheduler_config for that vehicle (charge-pricing.js); amount_cents
 *     is ignored
 *   - amount_cents + service_name: legacy custom-amount path
 *
 * @param {{ amount_cents?: number, service_name?: string, customer_name?: string, customer_phone?: string, site_id?: string, service_id?: string, vehicle_type_id?: string, addon_ids?: string[] }} opts
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
  return body; // { charge_id, checkout_url, amount_cents }
}

// ─── Services the owner can charge for ──────────────────────────────────
//
// One list for every "Charge" entry point (Charges page, customer profile).
// Each service keeps its id and carries the site it belongs to (_site_id)
// and that site's vehicle types (_vehicle_types), because the server prices
// a charge from that site's config for the customer's vehicle.

// sites: rows of { id, scheduler_config }, most recently updated first, so
// the site the owner is actively configuring wins the per-name dedupe
// (an owner can offer the same service name on several sites).
export function chargeableServices(sites) {
  const out = [];
  const seen = new Set();
  for (const site of sites || []) {
    const cfg = site?.scheduler_config || {};
    const types = savedVehicleTypes(cfg.vehicle_types);
    for (const svc of Array.isArray(cfg.services) ? cfg.services : []) {
      if (!svc || svc.enabled === false || !svc.id || !svc.name || seen.has(svc.name)) continue;
      seen.add(svc.name);
      out.push({ ...svc, _site_id: site.id, _vehicle_types: types });
    }
  }
  return out;
}

export async function loadChargeableServices(userId) {
  const { data, error } = await supabase
    .from('sites')
    .select('id, scheduler_config, updated_at')
    .eq('user_id', userId)
    .not('published_url', 'is', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const sites = data || [];
  return { sites, services: chargeableServices(sites) };
}

// Vehicle types (of the service's own site) the service is offered for.
// Empty for a service priced the same for every vehicle (saved before
// per-vehicle pricing, so it has no variants): no need to ask.
export function chargeVehicleOptions(service) {
  if (!service || !service.variants || typeof service.variants !== 'object') return [];
  return (service._vehicle_types || []).filter((t) => resolveVariant(service, t.id));
}

// What the dashboard shows before the server prices the charge; it mirrors
// netlify/functions/_lib/charge-pricing.js for a chosen vehicle. Returns
// { baseCents, addons: [{ ...addon, price_cents }], totalCents } or null
// while the vehicle type still has to be picked or the price is unknown.
// Add-ons not offered for the vehicle are left out.
export function chargeQuote(service, vehicleTypeId, addonIds) {
  if (!service) return null;
  const needsVehicle = chargeVehicleOptions(service).length > 0;
  if (needsVehicle && !vehicleTypeId) return null;
  const typeId = needsVehicle ? vehicleTypeId : null;
  const variant = resolveVariant(service, typeId);
  if (!variant || variant.price_cents == null) return null;
  const chosen = new Set(addonIds || []);
  const addons = [];
  for (const a of Array.isArray(service.addons) ? service.addons : []) {
    if (!a || a.enabled === false || !chosen.has(a.id)) continue;
    const price = addonPriceForVehicle(a, typeId);
    if (price == null) continue;
    addons.push({ ...a, price_cents: price });
  }
  return {
    baseCents: variant.price_cents,
    addons,
    totalCents: variant.price_cents + addons.reduce((sum, a) => sum + a.price_cents, 0),
  };
}
