// tests/functions/postmark-format.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatWhen, formatSupportWhen } from '../../netlify/functions/_lib/postmark.js';

// `netlify dev` runs in the laptop's zone; Lambda in UTC. Neither may move
// the times in the emails.
let savedTz;
beforeAll(() => { savedTz = process.env.TZ; process.env.TZ = 'Asia/Tokyo'; });
afterAll(() => { if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz; });

describe('booking email times', () => {
  it('show the slot the customer picked (shop wall-clock time stored as UTC)', () => {
    expect(formatWhen('2026-10-06T09:00:00.000Z')).toBe('Tue, Oct 6, 2026, 9:00 AM');
  });
});

describe('support call email times', () => {
  it('show Eastern time, as the "ET" label next to them says', () => {
    // 14:00 UTC in October is 10:00 AM EDT.
    expect(formatSupportWhen('2026-10-06T14:00:00.000Z')).toBe('Tue, Oct 6, 2026, 10:00 AM');
  });
});
