import { describe, it, expect, beforeEach } from 'vitest';
import { signState, verifyState } from './stateSig.js';

const SECRET = 'a'.repeat(64);

describe('stateSig', () => {
  beforeEach(() => {
    process.env.DOMAIN_CONNECT_STATE_SECRET = SECRET;
  });

  it('round-trips a payload', async () => {
    const token = await signState({ siteId: 'abc-123' }, 60);
    const result = await verifyState(token);
    expect(result.siteId).toBe('abc-123');
  });

  it('rejects a tampered token', async () => {
    const token = await signState({ siteId: 'abc-123' }, 60);
    const tampered = token.slice(0, -5) + 'XXXXX';
    await expect(verifyState(tampered)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signState({ siteId: 'abc-123' }, -1);
    await expect(verifyState(token)).rejects.toThrow(/expired/i);
  });

  it('rejects token signed with wrong secret', async () => {
    const token = await signState({ siteId: 'abc-123' }, 60);
    process.env.DOMAIN_CONNECT_STATE_SECRET = 'b'.repeat(64);
    await expect(verifyState(token)).rejects.toThrow();
  });
});
