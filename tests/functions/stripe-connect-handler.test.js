// tests/functions/stripe-connect-handler.test.js
import { describe, it, expect } from 'vitest';
import { handleAccountUpdated } from '../../netlify/functions/_lib/stripe-connect-handler.js';

// Fake Supabase: records every .update(...).eq(...) call. The fallback
// lookup (.select().eq().maybeSingle()) returns a configurable match —
// pass `{ matchAccountId: 'acct_found' }` to make it match only that id,
// or omit for the default "always finds user-uuid-1".
function fakeDb({ matchAccountId = null } = {}) {
  const calls = [];
  return {
    _calls: calls,
    from: (table) => ({
      _table: table,
      update: (data) => ({
        eq: (col, val) => { calls.push({ table, op: 'update', data, col, val }); return Promise.resolve({ error: null }); },
      }),
      select: () => ({
        eq: (_col, val) => ({
          maybeSingle: () => Promise.resolve({
            data: matchAccountId == null || val === matchAccountId ? { id: 'user-uuid-1' } : null,
            error: null,
          }),
        }),
      }),
    }),
  };
}

describe('handleAccountUpdated', () => {
  it('looks up profile by metadata.supabase_user_id and syncs capability flags', async () => {
    const event = {
      type: 'account.updated',
      data: { object: {
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        metadata: { supabase_user_id: 'user-uuid-1' },
      }},
    };
    const db = fakeDb();
    await handleAccountUpdated(event, { db });

    expect(db._calls).toHaveLength(1);
    const [call] = db._calls;
    expect(call.table).toBe('profiles');
    expect(call.col).toBe('id');
    expect(call.val).toBe('user-uuid-1');
    expect(call.data.stripe_connect_account_id).toBe('acct_123');
    expect(call.data.stripe_connect_charges_enabled).toBe(true);
    expect(call.data.stripe_connect_payouts_enabled).toBe(true);
    expect(call.data.stripe_connect_details_submitted).toBe(true);
    expect(call.data.stripe_connect_updated_at).toBeInstanceOf(Date);
  });

  it('partial capabilities: only charges enabled', async () => {
    const event = {
      type: 'account.updated',
      data: { object: {
        id: 'acct_456',
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: false,
        metadata: { supabase_user_id: 'user-uuid-2' },
      }},
    };
    const db = fakeDb();
    await handleAccountUpdated(event, { db });

    expect(db._calls[0].data.stripe_connect_charges_enabled).toBe(true);
    expect(db._calls[0].data.stripe_connect_payouts_enabled).toBe(false);
    expect(db._calls[0].data.stripe_connect_details_submitted).toBe(false);
  });

  it('ignores events missing metadata when no local row matches the account id', async () => {
    const event = {
      type: 'account.updated',
      data: { object: { id: 'acct_orphan', charges_enabled: true, metadata: {} } },
    };
    // Only acct_found matches; acct_orphan returns null from the lookup.
    const db = fakeDb({ matchAccountId: 'acct_found' });
    await handleAccountUpdated(event, { db });
    expect(db._calls).toHaveLength(0);
  });

  it('falls back to lookup by account_id when metadata missing but account exists locally', async () => {
    const event = {
      type: 'account.updated',
      data: { object: {
        id: 'acct_found',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        metadata: {}, // no supabase_user_id
      }},
    };
    const db = fakeDb({ matchAccountId: 'acct_found' });
    await handleAccountUpdated(event, { db });

    expect(db._calls).toHaveLength(1);
    expect(db._calls[0].val).toBe('user-uuid-1');
    expect(db._calls[0].data.stripe_connect_charges_enabled).toBe(true);
  });
});
