// tests/functions/booking-deposit-handler.test.js
import { describe, it, expect } from 'vitest';
import { handleBookingCheckoutCompleted } from '../../netlify/functions/_lib/booking-deposit-handler.js';

function fakeDb() {
  const calls = [];
  return {
    _calls: calls,
    from: (table) => ({
      update: (data) => ({
        eq: (col, val) => { calls.push({ table, op: 'update', data, col, val }); return Promise.resolve({ error: null }); },
      }),
    }),
  };
}

describe('handleBookingCheckoutCompleted', () => {
  it('flips booking to paid using client_reference_id', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'payment',
        client_reference_id: 'booking-uuid-1',
        amount_total: 2475,
        payment_intent: 'pi_abc',
        id: 'cs_abc',
      }},
    };
    const db = fakeDb();
    await handleBookingCheckoutCompleted(event, { db });

    expect(db._calls).toHaveLength(1);
    const [call] = db._calls;
    expect(call.table).toBe('bookings');
    expect(call.col).toBe('id');
    expect(call.val).toBe('booking-uuid-1');
    expect(call.data.deposit_status).toBe('paid');
    expect(call.data.deposit_paid_cents).toBe(2475);
    expect(call.data.deposit_payment_intent_id).toBe('pi_abc');
    expect(call.data.deposit_paid_at).toBeInstanceOf(Date);
  });

  it('ignores sessions missing client_reference_id', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', amount_total: 1000 } },
    };
    const db = fakeDb();
    await handleBookingCheckoutCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });

  it('ignores subscription-mode sessions (defensive — caller should route, but this stays safe)', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', client_reference_id: 'user-uuid', amount_total: 999 } },
    };
    const db = fakeDb();
    await handleBookingCheckoutCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });
});
