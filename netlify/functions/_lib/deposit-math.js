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

export function computeDepositCents(priceCents, percentage) {
  if (priceCents == null || percentage == null) return null;
  if (typeof percentage !== 'number' || !Number.isFinite(percentage)) return null;
  if (percentage <= 0 || percentage > 100) return null;
  if (priceCents <= 0) return null;
  const cents = Math.round((priceCents * percentage) / 100);
  if (cents < STRIPE_MIN_CENTS) return null;
  return cents;
}
