import { describe, it, expect } from 'vitest';
import { validateInquiryPayload } from '../../netlify/functions/_lib/inquiry-validation.js';

const base = {
  siteId: '00000000-0000-0000-0000-000000000001',
  name: 'Alex',
  email: 'a@x.com',
  phone: '555-1234',
  message: 'Do you offer mobile service?',
};

describe('validateInquiryPayload', () => {
  it('accepts a fully valid payload', () => {
    expect(validateInquiryPayload(base).ok).toBe(true);
  });

  it('accepts a payload with no phone (phone optional)', () => {
    const { phone, ...rest } = base;
    expect(validateInquiryPayload(rest).ok).toBe(true);
  });

  it('rejects a non-object payload', () => {
    expect(validateInquiryPayload(null).ok).toBe(false);
  });

  it('rejects missing name', () => {
    const { name, ...rest } = base;
    const r = validateInquiryPayload(rest);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/name/);
  });

  it('rejects missing message', () => {
    const { message, ...rest } = base;
    const r = validateInquiryPayload(rest);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/message/);
  });

  it('rejects invalid email', () => {
    const r = validateInquiryPayload({ ...base, email: 'not-email' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/email/i);
  });

  it('rejects non-uuid siteId', () => {
    const r = validateInquiryPayload({ ...base, siteId: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/siteId/);
  });

  it('rejects an over-length message', () => {
    const r = validateInquiryPayload({ ...base, message: 'x'.repeat(5001) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/message/);
  });

  it('rejects an over-length name', () => {
    const r = validateInquiryPayload({ ...base, name: 'x'.repeat(201) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/name/);
  });

  it('treats a non-empty honeypot as invalid (silent reject)', () => {
    const r = validateInquiryPayload({ ...base, website: 'http://spam.com' });
    expect(r.ok).toBe(false);
    expect(r.honeypot).toBe(true);
  });
});
