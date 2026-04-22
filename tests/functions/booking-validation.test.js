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

  it('rejects missing required fields', () => {
    const { customer_name, ...rest } = base;
    const result = validateBookingPayload(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/customer_name/);
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

  it('treats non-empty honeypot as invalid (silent reject)', () => {
    const result = validateBookingPayload({ ...base, website: 'http://spam.com' });
    expect(result.ok).toBe(false);
    expect(result.honeypot).toBe(true);
  });
});
