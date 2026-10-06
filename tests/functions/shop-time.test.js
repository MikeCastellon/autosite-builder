// tests/functions/shop-time.test.js
import { describe, it, expect } from 'vitest';
import {
  resolveShopTimeZone, shopNowWallMs, shopTodayISO, isValidTimeZone, DEFAULT_SHOP_TIME_ZONE,
} from '../../netlify/functions/_lib/shop-time.js';
import { computeSlots, normalizeGranularity, normalizeLeadHours, isOpenWindow } from '../../netlify/functions/_lib/slot-math.js';

describe('resolveShopTimeZone', () => {
  it('uses the zone Booking Settings saved', () => {
    expect(resolveShopTimeZone({ timezone: 'America/Chicago' }, { state: 'FL' })).toBe('America/Chicago');
  });

  it('falls back to the business state (code or name), then Eastern', () => {
    expect(resolveShopTimeZone({}, { state: 'PR' })).toBe('America/Puerto_Rico');
    expect(resolveShopTimeZone({}, { state: 'Florida' })).toBe('America/New_York');
    expect(resolveShopTimeZone({}, { state: 'ca' })).toBe('America/Los_Angeles');
    expect(resolveShopTimeZone({ timezone: 'Not/AZone' }, { state: 'TX' })).toBe('America/Chicago');
    expect(resolveShopTimeZone(null, null)).toBe(DEFAULT_SHOP_TIME_ZONE);
    expect(resolveShopTimeZone({}, { state: 'Atlantis' })).toBe(DEFAULT_SHOP_TIME_ZONE);
  });

  it('rejects junk zone names', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone('x'.repeat(65))).toBe(false);
  });
});

describe("shopNowWallMs: the shop's clock written as UTC", () => {
  it('summer: Florida and Puerto Rico are both UTC-4', () => {
    const now = Date.parse('2026-10-06T13:00:00.000Z');
    expect(new Date(shopNowWallMs('America/New_York', now)).toISOString()).toBe('2026-10-06T09:00:00.000Z');
    expect(new Date(shopNowWallMs('America/Puerto_Rico', now)).toISOString()).toBe('2026-10-06T09:00:00.000Z');
  });

  it('winter: Florida moves to UTC-5, Puerto Rico stays at UTC-4', () => {
    const now = Date.parse('2026-01-15T14:00:00.000Z');
    expect(new Date(shopNowWallMs('America/New_York', now)).toISOString()).toBe('2026-01-15T09:00:00.000Z');
    expect(new Date(shopNowWallMs('America/Puerto_Rico', now)).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('midnight reads as hour 0 of the new day', () => {
    const now = Date.parse('2026-10-07T04:00:30.000Z'); // 00:00:30 EDT
    expect(new Date(shopNowWallMs('America/New_York', now)).toISOString()).toBe('2026-10-07T00:00:30.000Z');
  });

  it("today is the shop's date (UTC is already tomorrow on a US evening)", () => {
    const now = Date.parse('2026-10-06T02:00:00.000Z'); // Oct 5, 10 PM in Florida
    expect(shopTodayISO('America/New_York', now)).toBe('2026-10-05');
  });

  it('an unknown zone reads as the default instead of throwing', () => {
    const now = Date.parse('2026-10-06T13:00:00.000Z');
    expect(shopNowWallMs('Nope/Nope', now)).toBe(shopNowWallMs(DEFAULT_SHOP_TIME_ZONE, now));
  });
});

describe('slot-math guards against owner-written junk', () => {
  it('a step of 0 or less used to loop forever; it now falls back to 30 minutes', () => {
    for (const step of [0, -15, 'abc', null, undefined, 2]) {
      const slots = computeSlots({
        dateISO: '2026-10-08',
        availability: [{ start: '09:00', end: '11:00' }],
        serviceDurationMin: 60,
        granularityMin: step,
        confirmedBookings: [],
      });
      expect(slots, String(step)).toEqual([
        '2026-10-08T09:00:00.000Z', '2026-10-08T09:30:00.000Z', '2026-10-08T10:00:00.000Z',
      ]);
    }
    expect(normalizeGranularity(15)).toBe(15);
    expect(normalizeGranularity(1000)).toBe(240);
  });

  it('skips malformed and backwards windows, accepts single-digit hours', () => {
    const slots = computeSlots({
      dateISO: '2026-10-08',
      availability: [{ start: '17:00', end: '09:00' }, { start: 'noon', end: '13:00' }, null, { start: '9:00', end: '10:00' }],
      serviceDurationMin: 60,
      granularityMin: 30,
      confirmedBookings: [],
    });
    expect(slots).toEqual(['2026-10-08T09:00:00.000Z']);
    expect(isOpenWindow({ start: '09:00', end: '17:00' })).toBe(true);
    expect(isOpenWindow({ start: '17:00', end: '09:00' })).toBe(false);
    expect(isOpenWindow({ start: '', end: '' })).toBe(false);
  });

  it('lead time: missing or junk is 24, negative is not allowed', () => {
    expect(normalizeLeadHours(undefined)).toBe(24);
    expect(normalizeLeadHours('')).toBe(24);
    expect(normalizeLeadHours(-5)).toBe(24);
    expect(normalizeLeadHours(0)).toBe(0);
    expect(normalizeLeadHours('2')).toBe(2);
  });
});
