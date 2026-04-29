// tests/functions/booking-deposit-handler.test.js
import { describe, it, expect } from 'vitest';
import { handleBookingCheckoutCompleted } from '../../netlify/functions/_lib/booking-deposit-handler.js';

// Fake Supabase client supporting:
//   .from(table).select(cols).eq(col,val).maybeSingle() → returns booking
//   .from(table).update(data).eq(col,val).eq(col,val)   → records update
function fakeDb({ booking }) {
  const calls = [];
  return {
    _calls: calls,
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: booking, error: null }),
        }),
      }),
      update: (data) => {
        const eqs = [];
        const builder = {
          eq: (col, val) => {
            eqs.push({ col, val });
            // Allow chaining a second .eq() — at the end of the chain we
            // record the call. We detect the end by counting: the handler
            // does .eq('id', X).eq('deposit_status', 'pending').
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

describe('handleBookingCheckoutCompleted', () => {
  it('flips booking to paid when amount_total >= deposit_required_cents and status is pending', async () => {
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
    const db = fakeDb({ booking: { deposit_required_cents: 2475, deposit_status: 'pending' } });
    await handleBookingCheckoutCompleted(event, { db });

    expect(db._calls).toHaveLength(1);
    const [call] = db._calls;
    expect(call.table).toBe('bookings');
    expect(call.data.deposit_status).toBe('paid');
    expect(call.data.deposit_paid_cents).toBe(2475);
    expect(call.data.deposit_payment_intent_id).toBe('pi_abc');
    expect(call.data.deposit_paid_at).toBeInstanceOf(Date);
    // The eq chain must include id AND deposit_status='pending' for
    // idempotency — replays after refund must not double-flip to paid.
    expect(call.eqs).toContainEqual({ col: 'id', val: 'booking-uuid-1' });
    expect(call.eqs).toContainEqual({ col: 'deposit_status', val: 'pending' });
  });

  it('ignores sessions missing client_reference_id', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', amount_total: 1000 } },
    };
    const db = fakeDb({ booking: null });
    await handleBookingCheckoutCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });

  it('ignores subscription-mode sessions', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', client_reference_id: 'user-uuid', amount_total: 999 } },
    };
    const db = fakeDb({ booking: null });
    await handleBookingCheckoutCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });

  it('rejects underpayment (amount_total < deposit_required_cents) — does not flip to paid', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'payment',
        client_reference_id: 'booking-uuid-1',
        amount_total: 100, // way less than required
        payment_intent: 'pi_under',
        id: 'cs_under',
      }},
    };
    const db = fakeDb({ booking: { deposit_required_cents: 2475, deposit_status: 'pending' } });
    await handleBookingCheckoutCompleted(event, { db });
    // Booking should NOT be flipped — guard against stale checkout URLs
    // or tampered amounts (Security Audit H7).
    expect(db._calls).toHaveLength(0);
  });

  it('skips the update when the booking row does not exist', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'payment',
        client_reference_id: 'unknown-booking',
        amount_total: 2475,
        id: 'cs_x',
      }},
    };
    const db = fakeDb({ booking: null });
    await handleBookingCheckoutCompleted(event, { db });
    expect(db._calls).toHaveLength(0);
  });

  it('still updates when deposit_required_cents is null (legacy / no-deposit-required bookings)', async () => {
    // Older bookings created before deposits existed could plausibly
    // arrive here via a manual checkout. We don't gate on amount when
    // there's no required amount stored.
    const event = {
      type: 'checkout.session.completed',
      data: { object: {
        mode: 'payment',
        client_reference_id: 'booking-uuid-legacy',
        amount_total: 500,
        payment_intent: 'pi_legacy',
        id: 'cs_legacy',
      }},
    };
    const db = fakeDb({ booking: { deposit_required_cents: null, deposit_status: 'pending' } });
    await handleBookingCheckoutCompleted(event, { db });
    expect(db._calls).toHaveLength(1);
    expect(db._calls[0].data.deposit_status).toBe('paid');
  });
});
