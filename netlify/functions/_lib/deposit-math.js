// netlify/functions/_lib/deposit-math.js
// Pure helpers — no I/O, no env access.
//
// Service prices in scheduler_config are free-text strings ("$99", "199.99",
// "1,299", "Call for quote"). For deposits we need cents. We parse leading
// numeric content and ignore everything else. If we can't extract a positive
// number, we return null and the booking proceeds without a deposit.

const STRIPE_MIN_CENTS = 50; // Stripe's USD minimum charge.

export function parsePriceToCents(input) {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? Math.round(input * 100) : null;
  }
  if (typeof input !== 'string') return null;
  // Strip currency symbol, whitespace, thousands separators.
  const cleaned = input.replace(/[\s$,]/g, '');
  // Match a leading number (with optional decimal).
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return null;
  const dollars = parseInt(match[1], 10);
  const fractional = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const cents = dollars * 100 + fractional;
  return cents > 0 ? cents : null;
}

// Service `price_cents` is the source of truth; legacy services only have
// the free-text `price` field. This helper returns whichever is available.
// Returns null if neither is parseable (e.g. "Call for quote").
export function servicePriceCents(service) {
  if (!service) return null;
  if (typeof service.price_cents === 'number' && service.price_cents > 0) {
    return service.price_cents;
  }
  return parsePriceToCents(service.price);
}

// Sum the price_cents of a list of add-on snapshots (or live add-on records).
// Returns 0 if list is empty/missing — never null, because zero add-ons is a
// valid total contribution.
export function sumAddonsCents(addons) {
  if (!Array.isArray(addons)) return 0;
  let total = 0;
  for (const a of addons) {
    if (a && typeof a.price_cents === 'number' && a.price_cents > 0) {
      total += a.price_cents;
    }
  }
  return total;
}

// The total a customer commits to: service base + every selected add-on.
// If the service has no numeric price, the total is also null — we can't
// quote a partial total when we don't know the base.
export function computeTotalCents(servicePriceCentsValue, addons) {
  if (servicePriceCentsValue == null) return null;
  if (servicePriceCentsValue <= 0) return null;
  return servicePriceCentsValue + sumAddonsCents(addons);
}

export function computeDepositCents(priceCents, percentage) {
  if (priceCents == null || percentage == null) return null;
  if (typeof percentage !== 'number' || !Number.isFinite(percentage)) return null;
  if (percentage <= 0 || percentage > 100) return null;
  if (priceCents <= 0) return null;
  const cents = Math.round((priceCents * percentage) / 100);
  if (cents < STRIPE_MIN_CENTS) return null;
  return cents;
}
