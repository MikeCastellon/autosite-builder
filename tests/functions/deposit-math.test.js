// tests/functions/deposit-math.test.js
import { describe, it, expect } from 'vitest';
import { parsePriceToCents, computeDepositCents } from '../../netlify/functions/_lib/deposit-math.js';

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
