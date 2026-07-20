// netlify/functions/_lib/vehicle-pricing.js
// Pure helpers for per-vehicle service pricing. No I/O, no env access.
//
// A service may carry `variants` keyed by vehicle-type id:
//   variants: { vt_abc: { enabled, price_cents, duration_minutes } }
// Services without variants (legacy) price every vehicle from the base
// price_cents / duration_minutes fields. variants[id].enabled === false
// means "this service is not offered for that vehicle".
//
// Add-ons may carry `prices` keyed by vehicle-type id; null / absent key
// means "not offered for that vehicle". Add-ons without a `prices` map
// (legacy) are offered to every vehicle at price_cents.

import { randomUUID } from 'node:crypto';
import { servicePriceCents } from './deposit-math.js';

export const DEFAULT_VEHICLE_TYPE_NAMES = [
  'Sedan', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Motorcycle', 'Other',
];

export function newVehicleTypeId() {
  return 'vt_' + randomUUID().replace(/-/g, '').slice(0, 12);
}

export function defaultVehicleTypes() {
  return DEFAULT_VEHICLE_TYPE_NAMES.map((name) => ({
    id: newVehicleTypeId(), name, enabled: true,
  }));
}

export function normalizeVehicleTypes(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t) => t && typeof t.id === 'string' && t.id.trim() !== '' && typeof t.name === 'string' && t.name.trim() !== '')
    .map((t) => ({ id: t.id, name: t.name.trim(), enabled: t.enabled !== false }));
}

export function enabledVehicleTypes(input) {
  return normalizeVehicleTypes(input).filter((t) => t.enabled);
}

// { price_cents, duration_minutes } the given vehicle books this service at,
// or null when the service is not offered for that vehicle.
export function resolveVariant(service, vehicleTypeId) {
  if (!service) return null;
  const base = {
    price_cents: servicePriceCents(service),
    duration_minutes:
      typeof service.duration_minutes === 'number' && service.duration_minutes > 0
        ? service.duration_minutes
        : 60,
  };
  if (!vehicleTypeId || !service.variants || typeof service.variants !== 'object') return base;
  const v = service.variants[vehicleTypeId];
  if (!v) return base;
  if (v.enabled === false) return null;
  return {
    price_cents:
      typeof v.price_cents === 'number' && v.price_cents > 0 ? v.price_cents : base.price_cents,
    duration_minutes:
      typeof v.duration_minutes === 'number' && v.duration_minutes > 0
        ? v.duration_minutes
        : base.duration_minutes,
  };
}

// Cents (>= 0) when the add-on is offered for that vehicle, else null.
export function addonPriceForVehicle(addon, vehicleTypeId) {
  if (!addon) return null;
  const legacy = typeof addon.price_cents === 'number' && addon.price_cents > 0 ? addon.price_cents : 0;
  if (!vehicleTypeId || !addon.prices || typeof addon.prices !== 'object') return legacy;
  const p = addon.prices[vehicleTypeId];
  if (p == null) return null;
  return typeof p === 'number' && p > 0 ? p : 0;
}

// bookings.vehicle_size is NOT NULL with a check constraint
// (sedan|suv|truck|van|other) — derive the closest bucket from the name.
export function vehicleSizeFromTypeName(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('sedan') || n.includes('coupe')) return 'sedan';
  if (n.includes('suv') || n.includes('crossover')) return 'suv';
  if (n.includes('truck')) return 'truck';
  if (n.includes('van')) return 'van';
  return 'other';
}

// Lowest/highest price across enabled vehicle types ("from $X" support).
// Returns null when no combination has a numeric price.
export function priceRangeCents(service, vehicleTypes) {
  const types = enabledVehicleTypes(vehicleTypes);
  if (types.length === 0) {
    const v = resolveVariant(service, null);
    return v && v.price_cents != null ? { min: v.price_cents, max: v.price_cents } : null;
  }
  let min = null;
  let max = null;
  for (const t of types) {
    const v = resolveVariant(service, t.id);
    if (!v || v.price_cents == null) continue;
    if (min == null || v.price_cents < min) min = v.price_cents;
    if (max == null || v.price_cents > max) max = v.price_cents;
  }
  return min == null ? null : { min, max };
}
