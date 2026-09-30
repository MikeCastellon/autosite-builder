// netlify/functions/_lib/charge-pricing.js
// Pure pricing for in-person charges (create-charge.js). No I/O.
//
// A service's base price_cents only mirrors its FIRST vehicle type's price
// (ServicesTab writes it that way for old widgets), and an add-on's base
// price_cents mirrors its first vehicle price too. Charging from those
// billed every vehicle the first vehicle's price. The amount comes from the
// vehicle-type variant instead, exactly as create-booking prices a booking
// (vehicle-pricing.js).
//
// The dashboard shows the same numbers with the mirrors in
// src/lib/schedulerConfig.js (resolveVariant, addonPriceForVehicle); only
// this function decides what the customer is charged.

import { enabledVehicleTypes, resolveVariant, addonPriceForVehicle } from './vehicle-pricing.js';
import { computeTotalCents } from './deposit-math.js';

const fail = (error) => ({ ok: false, status: 400, error });

// The service + add-on prices for one vehicle type (null = no vehicle).
function priceFor(service, addons, typeId) {
  const variant = resolveVariant(service, typeId);
  if (!variant) return fail('This service is not offered for that vehicle type.');
  const resolved = [];
  for (const a of addons) {
    const price = addonPriceForVehicle(a, typeId);
    if (price == null) return fail(`${a.name} is not offered for that vehicle type.`);
    resolved.push({ id: a.id, name: a.name, price_cents: price });
  }
  return {
    ok: true,
    basePriceCents: variant.price_cents,
    addons: resolved,
    totalCents: computeTotalCents(variant.price_cents, resolved),
  };
}

const sameQuote = (a, b) =>
  a.ok && b.ok && a.totalCents === b.totalCents && a.basePriceCents === b.basePriceCents
  && a.addons.every((x, i) => x.price_cents === b.addons[i].price_cents);

// Returns { ok: true, vehicleType, basePriceCents, addons, totalCents,
// serviceName } or { ok: false, status, error }.
//
// Without a vehicle type the service is charged only when every vehicle it
// is offered for costs the same (or the site has no vehicle types): a
// dashboard tab opened before this change sends no vehicle type, and it
// must not fall back to the first vehicle's price.
export function quoteCharge({ service, vehicleTypes, vehicleTypeId, addonIds }) {
  if (!service || service.enabled === false) return fail('Unknown service');

  const addons = [];
  for (const id of new Set(Array.isArray(addonIds) ? addonIds : [])) {
    const match = (Array.isArray(service.addons) ? service.addons : [])
      .find((a) => a && a.id === id && a.enabled !== false);
    if (!match) return fail('Unknown or disabled add-on');
    addons.push(match);
  }

  const types = enabledVehicleTypes(vehicleTypes);
  let vehicleType = null;
  let quote;
  if (vehicleTypeId) {
    vehicleType = types.find((t) => t.id === vehicleTypeId) || null;
    if (!vehicleType) return fail('Unknown vehicle type');
    quote = priceFor(service, addons, vehicleType.id);
  } else {
    const offered = types.filter((t) => resolveVariant(service, t.id));
    if (offered.length === 0) {
      quote = priceFor(service, addons, null);
    } else {
      const quotes = offered.map((t) => priceFor(service, addons, t.id));
      if (quotes.every((q) => !q.ok)) return quotes[0];
      if (!quotes.every((q) => sameQuote(q, quotes[0]))) {
        return fail('Pick the vehicle type: this service is priced per vehicle.');
      }
      quote = quotes[0];
    }
  }
  if (!quote.ok) return quote;
  if (quote.totalCents == null) return fail('Service has no chargeable price');

  const base = vehicleType ? `${service.name} (${vehicleType.name})` : service.name;
  const n = quote.addons.length;
  return {
    ...quote,
    vehicleType,
    lineName: base,
    serviceName: n > 0 ? `${base} + ${n} add-on${n === 1 ? '' : 's'}` : base,
  };
}
