import { describe, it, expect } from 'vitest';
import { formatPhone } from './formatPhone.js';

describe('formatPhone', () => {
  it('returns empty for empty / null / undefined', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
  });

  it('partial digits get partial mask', () => {
    expect(formatPhone('5')).toBe('(5');
    expect(formatPhone('555')).toBe('(555');
    expect(formatPhone('5551')).toBe('(555) 1');
    expect(formatPhone('555123')).toBe('(555) 123');
  });

  it('full ten-digit number formats correctly', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
  });

  it('strips non-digit characters', () => {
    expect(formatPhone('555-123-4567')).toBe('(555) 123-4567');
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567');
    expect(formatPhone('+1 555.123.4567')).toBe('(555) 123-4567');
  });

  it('caps at 10 digits', () => {
    expect(formatPhone('55512345678901234')).toBe('(555) 123-4567');
  });
});
