// Tests for slug shape validation. Used by publish-site to reject
// path-traversal / host-breakout slugs and by the serve-custom-domain
// edge function as defense-in-depth on data read from Supabase.
import { describe, it, expect } from 'vitest';
import { isValidSlug } from './slug.js';

describe('isValidSlug', () => {
  it('accepts canonical hyphenated lowercase slugs', () => {
    expect(isValidSlug('acme-detailing')).toBe(true);
    expect(isValidSlug('shop-123')).toBe(true);
    expect(isValidSlug('a')).toBe(true);
  });

  it('rejects empty / null / non-string input', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug(null)).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug(42)).toBe(false);
  });

  it('rejects path traversal / slashes / dots / spaces', () => {
    expect(isValidSlug('foo/bar')).toBe(false);
    expect(isValidSlug('..')).toBe(false);
    expect(isValidSlug('foo..bar')).toBe(false);
    expect(isValidSlug('foo bar')).toBe(false);
    expect(isValidSlug('foo.bar')).toBe(false);
    expect(isValidSlug('foo\\bar')).toBe(false);
  });

  it('rejects uppercase, special chars, CRLF', () => {
    expect(isValidSlug('Foo-Bar')).toBe(false);
    expect(isValidSlug('foo_bar')).toBe(false);
    expect(isValidSlug('foo%2fbar')).toBe(false);
    expect(isValidSlug('foo\nbar')).toBe(false);
    expect(isValidSlug('foo\rbar')).toBe(false);
  });

  it('caps at 63 chars (DNS label limit)', () => {
    expect(isValidSlug('a'.repeat(63))).toBe(true);
    expect(isValidSlug('a'.repeat(64))).toBe(false);
  });
});
