// tests/functions/impersonate-claim.test.js
import { describe, it, expect } from 'vitest';
import { claimHandoff, SCRUBBED_TOKENS } from '../../netlify/functions/impersonate-claim.js';
import { scrubExpiredHandoffs } from '../../netlify/functions/admin-impersonate-session.js';

const NOW = new Date('2026-09-28T12:00:00.000Z');
const HANDOFF_ID = '11111111-2222-3333-4444-555555555555';

// Fake service-role client. `rows` backs the handoff/profile lookups; every
// update is recorded with its filters. The claim update matches only while
// consumed_at is still null, like the real conditional update.
function fakeDb({ handoff, profile = null }) {
  const updates = [];
  const db = {
    updates,
    from(table) {
      const q = { table, op: 'select', values: null, filters: {} };
      const run = () => {
        if (q.op === 'update') {
          updates.push({ table, values: q.values, filters: { ...q.filters } });
          const matches = handoff && handoff.consumed_at == null && q.filters.consumed_at === null;
          if (matches) Object.assign(handoff, q.values);
          return { data: matches ? { id: handoff.id } : null, error: null };
        }
        if (table === 'profiles') return { data: profile, error: null };
        return { data: handoff ? { ...handoff } : null, error: null };
      };
      const b = {
        select() { return b; },
        update(v) { q.op = 'update'; q.values = v; return b; },
        eq(col, val) { q.filters[col] = val; return b; },
        is(col, val) { q.filters[col] = val; return b; },
        maybeSingle() { return Promise.resolve(run()); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return b;
    },
  };
  return db;
}

function pendingHandoff(overrides = {}) {
  return {
    id: HANDOFF_ID,
    target_user_id: 'user-1',
    access_token: 'at-123',
    refresh_token: 'rt-456',
    expires_at: '2026-09-28T12:00:30.000Z',
    consumed_at: null,
    ...overrides,
  };
}

describe('claimHandoff', () => {
  it('returns the tokens once and blanks them in the claiming update', async () => {
    const handoff = pendingHandoff();
    const db = fakeDb({ handoff, profile: { email: 'owner@shop.com', first_name: 'Ana', last_name: 'Ruiz' } });
    const { status, body } = await claimHandoff(db, HANDOFF_ID, NOW);

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, access_token: 'at-123', refresh_token: 'rt-456', target_email: 'owner@shop.com', target_name: 'Ana Ruiz' });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].values).toEqual({ consumed_at: NOW.toISOString(), ...SCRUBBED_TOKENS });
    expect(db.updates[0].filters).toEqual({ id: HANDOFF_ID, consumed_at: null });
    // Nothing usable left at rest.
    expect(handoff.access_token).toBe('');
    expect(handoff.refresh_token).toBe('');
  });

  it('refuses a second claim', async () => {
    const handoff = pendingHandoff();
    const db = fakeDb({ handoff });
    await claimHandoff(db, HANDOFF_ID, NOW);
    const again = await claimHandoff(db, HANDOFF_ID, NOW);
    expect(again.status).toBe(410);
    expect(again.body.access_token).toBeUndefined();
  });

  it('scrubs an expired, unclaimed handoff and returns 410', async () => {
    const handoff = pendingHandoff({ expires_at: '2026-09-28T11:59:00.000Z' });
    const db = fakeDb({ handoff });
    const { status, body } = await claimHandoff(db, HANDOFF_ID, NOW);
    expect(status).toBe(410);
    expect(body.error).toBe('Handoff expired');
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].values).toEqual(SCRUBBED_TOKENS);
    expect(handoff.access_token).toBe('');
    expect(handoff.consumed_at).toBeNull();
  });

  it('treats a row with blank tokens as used', async () => {
    const db = fakeDb({ handoff: pendingHandoff(SCRUBBED_TOKENS) });
    const { status } = await claimHandoff(db, HANDOFF_ID, NOW);
    expect(status).toBe(410);
    expect(db.updates).toHaveLength(0);
  });

  it('404s an unknown handoff', async () => {
    const { status } = await claimHandoff(fakeDb({ handoff: null }), HANDOFF_ID, NOW);
    expect(status).toBe(404);
  });
});

describe('scrubExpiredHandoffs', () => {
  function sweepDb(result = { error: null }) {
    const calls = [];
    const db = {
      from(table) {
        const call = { table, values: null, filters: [] };
        calls.push(call);
        const b = {
          update(v) { call.values = v; return b; },
          lt(col, val) { call.filters.push(['lt', col, val]); return b; },
          neq(col, val) { call.filters.push(['neq', col, val]); return b; },
          then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
        };
        return b;
      },
    };
    return { db, calls };
  }

  it('blanks the tokens of every handoff past its expiry that still holds one', async () => {
    const { db, calls } = sweepDb();
    await scrubExpiredHandoffs(db, NOW);
    expect(calls).toEqual([{
      table: 'impersonation_handoffs',
      values: SCRUBBED_TOKENS,
      filters: [['lt', 'expires_at', NOW.toISOString()], ['neq', 'access_token', '']],
    }]);
  });

  it('never throws, so a failed sweep cannot block a new session', async () => {
    const { db } = sweepDb({ error: { message: 'boom' } });
    await expect(scrubExpiredHandoffs(db, NOW)).resolves.toBeUndefined();
    const broken = { from() { throw new Error('down'); } };
    await expect(scrubExpiredHandoffs(broken, NOW)).resolves.toBeUndefined();
  });
});
