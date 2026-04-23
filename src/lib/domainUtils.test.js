import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './domainUtils.js';

describe('normalizeDomain', () => {
  it('strips protocol, path, trailing slash, and www', () => {
    expect(normalizeDomain('https://www.MyBusiness.com/')).toBe('mybusiness.com');
    expect(normalizeDomain('http://mybusiness.com/foo/bar')).toBe('mybusiness.com');
  });

  it('lowercases the result', () => {
    expect(normalizeDomain('MyBusiness.COM')).toBe('mybusiness.com');
  });

  it('strips leading www.', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  it('handles bare apex input', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain(null)).toBe('');
    expect(normalizeDomain(undefined)).toBe('');
  });
});
