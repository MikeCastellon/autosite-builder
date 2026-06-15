import { describe, it, expect } from 'vitest';
import { rangeToDates } from './overview.js';

describe('rangeToDates', () => {
  const now = new Date('2026-06-30T00:00:00.000Z');
  it('30 days → since 30d back, prev window another 30d back', () => {
    const { since, prevSince } = rangeToDates(30, now);
    expect(since).toBe('2026-05-31T00:00:00.000Z');
    expect(prevSince).toBe('2026-05-01T00:00:00.000Z');
  });
  it('7 days', () => {
    expect(rangeToDates(7, now).since).toBe('2026-06-23T00:00:00.000Z');
  });
  it("'all' → epoch for both bounds", () => {
    const r = rangeToDates('all', now);
    expect(r.since).toBe('1970-01-01T00:00:00.000Z');
    expect(r.prevSince).toBe('1970-01-01T00:00:00.000Z');
  });
});
