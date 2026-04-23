import { describe, it, expect } from 'vitest';
import { normalizeDomain, isValidDomain } from './domainUtils.js';

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

describe('isValidDomain', () => {
  it('accepts valid apex domains', () => {
    expect(isValidDomain('example.com')).toBe(true);
    expect(isValidDomain('my-business.co.uk')).toBe(true);
    expect(isValidDomain('a.io')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('not a domain')).toBe(false);
    expect(isValidDomain('http://example.com')).toBe(false);
    expect(isValidDomain('example')).toBe(false);
    expect(isValidDomain('.com')).toBe(false);
    expect(isValidDomain('example.')).toBe(false);
    expect(isValidDomain('-example.com')).toBe(false);
  });

  it('rejects localhost, IPs, reserved', () => {
    expect(isValidDomain('localhost')).toBe(false);
    expect(isValidDomain('127.0.0.1')).toBe(false);
    expect(isValidDomain('192.168.1.1')).toBe(false);
    expect(isValidDomain('example.local')).toBe(false);
  });

  it('rejects strings with uppercase (must be pre-normalized)', () => {
    expect(isValidDomain('Example.com')).toBe(false);
  });
});
