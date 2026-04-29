// Postgres-backed rate limiter. Replaces in-memory Map state in
// create-booking.js and support-book.js — see Security Audit H2 / CC-5.
// Per-instance Map state was useless against parallel requests because
// Netlify spins multiple containers; a single attacker could trivially
// exceed the cap by fanning out.
import { describe, it, expect } from 'vitest';
import { checkAndRecordRateLimit } from './rateLimit.js';

function fakeDb(initialCount) {
  const calls = { selects: 0, inserts: 0, lastInsert: null };
  return {
    _calls: calls,
    from(table) {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: async () => {
                calls.selects++;
                return { count: initialCount, error: null };
              },
            }),
          }),
        }),
        insert: async (row) => {
          calls.inserts++;
          calls.lastInsert = { table, row };
          return { error: null };
        },
      };
    },
  };
}

describe('checkAndRecordRateLimit', () => {
  it('returns { limited: false } and inserts a row when under the limit', async () => {
    const db = fakeDb(2);
    const result = await checkAndRecordRateLimit({
      db,
      ip: '1.2.3.4',
      kind: 'create-booking',
      windowMs: 60 * 60 * 1000,
      limit: 5,
    });
    expect(result.limited).toBe(false);
    expect(db._calls.selects).toBe(1);
    expect(db._calls.inserts).toBe(1);
    expect(db._calls.lastInsert.table).toBe('request_log');
    expect(db._calls.lastInsert.row.ip).toBe('1.2.3.4');
    expect(db._calls.lastInsert.row.kind).toBe('create-booking');
  });

  it('returns { limited: true } and does NOT insert when at/over the limit', async () => {
    const db = fakeDb(5);
    const result = await checkAndRecordRateLimit({
      db,
      ip: '1.2.3.4',
      kind: 'create-booking',
      windowMs: 60 * 60 * 1000,
      limit: 5,
    });
    expect(result.limited).toBe(true);
    expect(db._calls.inserts).toBe(0);
  });

  it('treats missing IP as its own bucket (does not throw)', async () => {
    const db = fakeDb(0);
    const result = await checkAndRecordRateLimit({
      db,
      ip: undefined,
      kind: 'support-book',
      windowMs: 60 * 60 * 1000,
      limit: 3,
    });
    expect(result.limited).toBe(false);
    expect(db._calls.lastInsert.row.ip).toBe('unknown');
  });

  it('fail-open: if the DB query errors, allow the request through', async () => {
    const erroringDb = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({ count: null, error: { message: 'pg down' } }),
              }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      },
    };
    const result = await checkAndRecordRateLimit({
      db: erroringDb,
      ip: '1.2.3.4',
      kind: 'create-booking',
      windowMs: 60 * 60 * 1000,
      limit: 5,
    });
    // Fail-open is the right default: a DB outage should not lock
    // legitimate users out. Operators see the error in logs.
    expect(result.limited).toBe(false);
  });
});
