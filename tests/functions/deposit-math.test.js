// tests/functions/deposit-math.test.js
import { describe, it, expect } from 'vitest';
import {
  parsePriceToCents,
  computeDepositCents,
  servicePriceCents,
  sumAddonsCents,
  computeTotalCents,
} from '../../netlify/functions/_lib/deposit-math.js';

describe('parsePriceToCents', () => {
  it('plain integer string', () => { expect(parsePriceToCents('99')).toBe(9900); });
  it('with $ prefix', () => { expect(parsePriceToCents('$99')).toBe(9900); });
  it('with decimals', () => { expect(parsePriceToCents('99.50')).toBe(9950); });
  it('with $ and decimals', () => { expect(parsePriceToCents('$199.99')).toBe(19999); });
  it('with whitespace', () => { expect(parsePriceToCents('  $250 ')).toBe(25000); });
  it('with thousands separator', () => { expect(parsePriceToCents('$1,299.00')).toBe(129900); });
  it('returns null for non-numeric', () => { expect(parsePriceToCents('Call for quote')).toBeNull(); });
  it('returns null for empty', () => { expect(parsePriceToCents('')).toBeNull(); });
  it('returns null for null/undefined', () => {
    expect(parsePriceToCents(null)).toBeNull();
    expect(parsePriceToCents(undefined)).toBeNull();
  });
  it('returns null for zero (deposits on free services make no sense)', () => {
    expect(parsePriceToCents('0')).toBeNull();
    expect(parsePriceToCents('$0.00')).toBeNull();
  });
  it('numeric input passes through', () => { expect(parsePriceToCents(99)).toBe(9900); });
});

describe('computeDepositCents', () => {
  it('25% of $99 = $24.75 = 2475', () => { expect(computeDepositCents(9900, 25)).toBe(2475); });
  it('50% of $200 = $100 = 10000', () => { expect(computeDepositCents(20000, 50)).toBe(10000); });
  it('100% = full price', () => { expect(computeDepositCents(9900, 100)).toBe(9900); });
  it('0% = null (no deposit)', () => { expect(computeDepositCents(9900, 0)).toBeNull(); });
  it('null priceCents → null', () => { expect(computeDepositCents(null, 25)).toBeNull(); });
  it('null percentage → null', () => { expect(computeDepositCents(9900, null)).toBeNull(); });
  it('negative percentage → null', () => { expect(computeDepositCents(9900, -10)).toBeNull(); });
  it('over 100 percentage → null', () => { expect(computeDepositCents(9900, 150)).toBeNull(); });
  it('rounds to nearest cent (banker rounding not required)', () => {
    expect(computeDepositCents(333, 33)).toBe(110); // 333 * 0.33 = 109.89 → 110
  });
  it('Stripe minimum check: deposits below 50¢ → null', () => {
    expect(computeDepositCents(100, 25)).toBeNull(); // 25¢ — below Stripe's $0.50 minimum
  });
});

describe('servicePriceCents', () => {
  it('prefers numeric price_cents', () => {
    expect(servicePriceCents({ price_cents: 14900, price: '$1,000,000' })).toBe(14900);
  });
  it('falls back to legacy free-text price', () => {
    expect(servicePriceCents({ price: '$149' })).toBe(14900);
  });
  it('null when neither parseable', () => {
    expect(servicePriceCents({ price: 'Call for quote' })).toBeNull();
    expect(servicePriceCents({})).toBeNull();
    expect(servicePriceCents(null)).toBeNull();
  });
  it('ignores zero / negative price_cents', () => {
    expect(servicePriceCents({ price_cents: 0, price: '$50' })).toBe(5000);
    expect(servicePriceCents({ price_cents: -10, price: '$50' })).toBe(5000);
  });
});

describe('sumAddonsCents', () => {
  it('empty list returns 0', () => {
    expect(sumAddonsCents([])).toBe(0);
    expect(sumAddonsCents(null)).toBe(0);
    expect(sumAddonsCents(undefined)).toBe(0);
  });
  it('sums valid price_cents', () => {
    expect(sumAddonsCents([{ price_cents: 2500 }, { price_cents: 3500 }])).toBe(6000);
  });
  it('ignores items without numeric price_cents', () => {
    expect(sumAddonsCents([{ price_cents: 2500 }, { price_cents: 'oops' }, {}])).toBe(2500);
  });
  it('ignores zero/negative entries (defensive)', () => {
    expect(sumAddonsCents([{ price_cents: 2500 }, { price_cents: 0 }, { price_cents: -100 }])).toBe(2500);
  });
});

describe('computeTotalCents', () => {
  it('service + no add-ons', () => {
    expect(computeTotalCents(14900, [])).toBe(14900);
    expect(computeTotalCents(14900, null)).toBe(14900);
  });
  it('service + add-ons', () => {
    expect(computeTotalCents(14900, [{ price_cents: 2500 }, { price_cents: 3500 }])).toBe(20900);
  });
  it('null service price → null total', () => {
    expect(computeTotalCents(null, [{ price_cents: 2500 }])).toBeNull();
  });
  it('zero/negative service price → null', () => {
    expect(computeTotalCents(0, [{ price_cents: 2500 }])).toBeNull();
  });
});
