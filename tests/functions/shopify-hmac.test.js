import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyShopifyHmac } from '../../netlify/functions/_lib/shopify-hmac.js';

const secret = 'test-secret-123';
const payload = '{"id":12345,"test":true}';

function sign(body, key) {
  return crypto.createHmac('sha256', key).update(body, 'utf8').digest('base64');
}

describe('verifyShopifyHmac', () => {
  it('returns true for a correctly signed payload', () => {
    const hmac = sign(payload, secret);
    expect(verifyShopifyHmac(payload, hmac, secret)).toBe(true);
  });

  it('returns false when secret is wrong', () => {
    const hmac = sign(payload, secret);
    expect(verifyShopifyHmac(payload, hmac, 'different-secret')).toBe(false);
  });

  it('returns false when signature is missing', () => {
    expect(verifyShopifyHmac(payload, undefined, secret)).toBe(false);
    expect(verifyShopifyHmac(payload, '', secret)).toBe(false);
    expect(verifyShopifyHmac(payload, null, secret)).toBe(false);
  });

  it('returns false when body is tampered', () => {
    const hmac = sign(payload, secret);
    expect(verifyShopifyHmac(payload + 'x', hmac, secret)).toBe(false);
  });

  it('returns false when secret is empty', () => {
    expect(verifyShopifyHmac(payload, 'whatever', '')).toBe(false);
    expect(verifyShopifyHmac(payload, 'whatever', undefined)).toBe(false);
  });

  it('uses constant-time comparison (no exceptions on length mismatch)', () => {
    expect(() => verifyShopifyHmac(payload, 'short', secret)).not.toThrow();
    expect(verifyShopifyHmac(payload, 'short', secret)).toBe(false);
  });
});
