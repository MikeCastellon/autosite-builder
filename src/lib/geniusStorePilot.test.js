import { describe, it, expect } from 'vitest';
import { geniusStoreAllowed, GENIUS_STORE_OPEN, GENIUS_STORE_PILOT } from './geniusStorePilot.js';

describe('geniusStoreAllowed', () => {
  it('is still a pilot: closed to everyone but the listed accounts', () => {
    expect(GENIUS_STORE_OPEN).toBe(false);
    expect(GENIUS_STORE_PILOT).toEqual(['dev@639hz.com']);
  });

  it('lets in the pilot accounts however the email is typed, and no one else', () => {
    expect(geniusStoreAllowed(' Dev@639hz.com ')).toBe(true);
    expect(geniusStoreAllowed('owner@shop.com')).toBe(false);
    expect(geniusStoreAllowed('')).toBe(false);
    expect(geniusStoreAllowed(undefined)).toBe(false);
  });
});
