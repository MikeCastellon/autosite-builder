// tests/functions/stripe-charge-handler.test.js
import { describe, it, expect } from 'vitest';
import { handleChargeCompleted } from '../../netlify/functions/_lib/stripe-charge-handler.js';

function fakeDb() {
  const calls = [];
  return {
    _calls: calls,
    from: (table) => ({
      update: (data) => {
        const eqs = [];
        const builder = {
          eq: (col, val) => {
            eqs.push({ col, val });
            // The new handler chains .eq('id', X).eq('status', 'pending')
            // for idempotency. Record once both eqs land.
            if (eqs.length >= 2) {
              calls.push({ table, op: 'update', data, eqs });
              return Promise.resolve({ error: null });
            }
            return builder;
          },
        };
        return builder;
      },
    }),
  };
}

describe('handleChargeCompleted', () => {
  it('flips charge to paid AND scopes the update to status=pending for idempotency', async () => {
    const event = {
      data: { object: {
        mode: 'payment',
        client_reference_id: 'charge-uuid-1',
        amount_total: 5000,
        payment_intent: 'pi_xyz',
        id: 'cs_xyz',
      }},
    };
    const db = fakeDb();
    await handleChargeCompleted(event, { db });

    expect(db._calls).toHaveLength(1);
    const [call] = db._calls;
    expect(call.table).toBe('charges');
    expect(call.data.status).toBe('paid');
    expect(call.data.amount_cents).toBe(5000);
    expect(call.data.stripe_payment_intent_id).toBe('pi_xyz');
    expect(call.data.paid_at).toBeInstanceOf(Date);
    // Critical for idempotency: webhook replays after refund must not
    // double-flip the row (Security Audit CC-4).
    expect(call.eqs).toContainEqual({ col: 'id', val: 'charge-uuid-1' });
    expect(call.eqs).toContainEqual({ col: 'status', val: 'pending' });
  });

  it('ignores subscription-mode sessions', async () => {
    const event = { data: { object: { mode: 'subscription', client_reference_id: 'x' } } };
    const db = fakeDb();
    await handleChargeCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });

  it('ignores sessions missing client_reference_id', async () => {
    const event = { data: { object: { mode: 'payment', amount_total: 100 } } };
    const db = fakeDb();
    await handleChargeCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });
});
