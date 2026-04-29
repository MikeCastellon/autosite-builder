// Tests for the CORS allowlist helper. Replaces the previous wildcard '*'
// origin used by every Netlify function — see Security Audit H6.
import { describe, it, expect } from 'vitest';
import { corsHeaders, isAllowedOrigin } from './cors.js';

const ALLOWED_ENV = {
  CORS_ALLOWED_ORIGINS:
    'https://sitebuilder.autocaregenius.com,https://autosite-builder.netlify.app',
};

describe('isAllowedOrigin', () => {
  it('returns true for an exact-match origin from the env list', () => {
    expect(
      isAllowedOrigin('https://sitebuilder.autocaregenius.com', ALLOWED_ENV),
    ).toBe(true);
  });

  it('returns true for a deploy-preview subdomain on autosite-builder.netlify.app', () => {
    expect(
      isAllowedOrigin(
        'https://deploy-preview-42--autosite-builder.netlify.app',
        ALLOWED_ENV,
      ),
    ).toBe(true);
  });

  it('returns false for an arbitrary external origin', () => {
    expect(isAllowedOrigin('https://evil.example.com', ALLOWED_ENV)).toBe(
      false,
    );
  });

  it('returns false for missing origin header', () => {
    expect(isAllowedOrigin(undefined, ALLOWED_ENV)).toBe(false);
    expect(isAllowedOrigin('', ALLOWED_ENV)).toBe(false);
  });

  it('returns false when origin only matches a substring (no partial)', () => {
    expect(
      isAllowedOrigin(
        'https://sitebuilder.autocaregenius.com.evil.com',
        ALLOWED_ENV,
      ),
    ).toBe(false);
  });
});

describe('corsHeaders', () => {
  it('echoes an allowed origin in Access-Control-Allow-Origin', () => {
    const headers = corsHeaders(
      { origin: 'https://sitebuilder.autocaregenius.com' },
      ALLOWED_ENV,
    );
    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://sitebuilder.autocaregenius.com',
    );
    expect(headers.Vary).toBe('Origin');
  });

  it('omits Allow-Origin entirely when the request origin is disallowed', () => {
    const headers = corsHeaders(
      { origin: 'https://evil.example.com' },
      ALLOWED_ENV,
    );
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('always includes Allow-Methods and Allow-Headers', () => {
    const headers = corsHeaders(
      { origin: 'https://sitebuilder.autocaregenius.com' },
      ALLOWED_ENV,
    );
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Headers']).toMatch(/Authorization/i);
  });

  it('reads origin from event headers regardless of casing', () => {
    const headers = corsHeaders(
      { Origin: 'https://sitebuilder.autocaregenius.com' },
      ALLOWED_ENV,
    );
    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://sitebuilder.autocaregenius.com',
    );
  });
});
