import { describe, it, expect } from 'vitest';
import { validateBookingPayload } from '../../netlify/functions/_lib/booking-validation.js';

const base = {
  siteId: '00000000-0000-0000-0000-000000000001',
  customer_name: 'Alex',
  customer_email: 'a@x.com',
  customer_phone: '555-1234',
  preferred_at: '2030-06-01T10:00:00Z',
  vehicle_make: 'Honda',
  vehicle_model: 'Civic',
  vehicle_year: 2020,
  vehicle_size: 'sedan',
};

describe('validateBookingPayload', () => {
  it('accepts a fully valid payload', () => {
    const result = validateBookingPayload(base);
    expect(result.ok).toBe(true);
  });

  it('rejects missing required fields, in words the customer understands', () => {
    const { customer_name, ...rest } = base;
    const result = validateBookingPayload(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Please enter your name.');
    // Blank (spaces only) counts as missing.
    expect(validateBookingPayload({ ...base, customer_phone: '   ' }).error).toBe('Please enter your phone number.');
  });

  it('rejects invalid email', () => {
    const result = validateBookingPayload({ ...base, customer_email: 'not-email' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects past dates', () => {
    const result = validateBookingPayload({ ...base, preferred_at: '2000-01-01T00:00:00Z' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it('rejects invalid vehicle_size', () => {
    const result = validateBookingPayload({ ...base, vehicle_size: 'sportscar' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/vehicle_size/);
  });

  it('rejects non-uuid siteId', () => {
    const result = validateBookingPayload({ ...base, siteId: 'nope' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/siteId/);
  });

  it('accepts optional fields when present', () => {
    const result = validateBookingPayload({
      ...base,
      service_address: '123 Main',
      notes: 'big truck',
      referral_source: 'Google',
    });
    expect(result.ok).toBe(true);
  });

  it('caps every text field (a script could otherwise store and email megabytes)', () => {
    expect(validateBookingPayload({ ...base, customer_name: 'x'.repeat(100) }).ok).toBe(true);
    const long = validateBookingPayload({ ...base, customer_name: 'x'.repeat(101) });
    expect(long.ok).toBe(false);
    expect(long.error).toMatch(/Name is too long/);
    expect(validateBookingPayload({ ...base, notes: 'x'.repeat(2001) }).ok).toBe(false);
    expect(validateBookingPayload({ ...base, preferred_time_text: 'x'.repeat(201) }).ok).toBe(false);
  });

  it('refuses non-string text fields (an object would be stored as its JSON)', () => {
    expect(validateBookingPayload({ ...base, customer_name: { a: 1 } }).ok).toBe(false);
    expect(validateBookingPayload({ ...base, notes: ['x'] }).ok).toBe(false);
    expect(validateBookingPayload({ ...base, preferred_at: 1893456000000 }).ok).toBe(false);
  });

  it('checks addon_ids is a short list of ids', () => {
    expect(validateBookingPayload({ ...base, addon_ids: ['add_1', 'add_2'] }).ok).toBe(true);
    expect(validateBookingPayload({ ...base, addon_ids: 'add_1' }).ok).toBe(false);
    expect(validateBookingPayload({ ...base, addon_ids: [{}] }).ok).toBe(false);
    expect(validateBookingPayload({ ...base, addon_ids: Array.from({ length: 26 }, (_, i) => `a${i}`) }).ok).toBe(false);
  });

  it('allows a shop wall-clock time that reads a few hours behind the real UTC instant', () => {
    // 9 AM at a UTC-5 shop is stored as T09:00Z, which is 5 hours before the
    // real instant (T14:00Z). create-booking checks the shop's lead time.
    const wall = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    expect(validateBookingPayload({ ...base, preferred_at: wall }).ok).toBe(true);
    const longAgo = new Date(Date.now() - 15 * 3600 * 1000).toISOString();
    expect(validateBookingPayload({ ...base, preferred_at: longAgo }).ok).toBe(false);
  });

  it('treats non-empty honeypot as invalid (silent reject)', () => {
    const result = validateBookingPayload({ ...base, website: 'http://spam.com' });
    expect(result.ok).toBe(false);
    expect(result.honeypot).toBe(true);
  });
});
