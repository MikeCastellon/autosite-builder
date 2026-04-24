// tests/functions/stripe-event-handlers.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpserted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from '../../netlify/functions/_lib/stripe-event-handlers.js';

// Fake Stripe client: just enough to answer the one call each handler makes.
function fakeStripe({ subscription }) {
  return {
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(subscription),
    },
  };
}

// Fake Supabase admin client: records every update/upsert.
function fakeSupabase() {
  const calls = [];
  const builder = {
    update: (data) => ({ eq: (col, val) => { calls.push({ op: 'update', data, col, val }); return { error: null }; } }),
  };
  return {
    from: (table) => ({ ...builder, _table: table }),
    _calls: calls,
  };
}

describe('handleCheckoutCompleted', () => {
  it('fetches subscription, upserts profile via supabase_user_id metadata', async () => {
    const now = Math.floor(Date.now() / 1000);
    const subscription = {
      id: 'sub_123',
      customer: 'cus_abc',
      status: 'trialing',
      current_period_end: now + 86400 * 30,
      trial_end: now + 86400 * 30,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_test' } }] },
    };
    const event = {
      type: 'checkout.session.completed',
      data: { object: {
        client_reference_id: 'user-uuid-1',
        subscription: 'sub_123',
        customer: 'cus_abc',
      }},
    };
    const stripe = fakeStripe({ subscription });
    const db = fakeSupabase();

    await handleCheckoutCompleted(event, { stripe, db });

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    expect(db._calls).toHaveLength(1);
    const [call] = db._calls;
    expect(call.op).toBe('update');
    expect(call.col).toBe('id');
    expect(call.val).toBe('user-uuid-1');
    expect(call.data.stripe_customer_id).toBe('cus_abc');
    expect(call.data.stripe_subscription_id).toBe('sub_123');
    expect(call.data.stripe_price_id).toBe('price_test');
    expect(call.data.subscription_status).toBe('active'); // trialing → active
    expect(call.data.stripe_trial_ends_at).toBeInstanceOf(Date);
    expect(call.data.stripe_first_failed_payment_at).toBeNull();
  });

  it('ignores event missing client_reference_id', async () => {
    const event = { type: 'checkout.session.completed', data: { object: { subscription: 'sub_x' } } };
    const db = fakeSupabase();
    await handleCheckoutCompleted(event, { stripe: fakeStripe({ subscription: {} }), db });
    expect(db._calls).toHaveLength(0);
  });
});

describe('handleSubscriptionUpserted', () => {
  it('looks up profile by stripe_customer_id and updates status', async () => {
    const now = Math.floor(Date.now() / 1000);
    const subscription = {
      id: 'sub_123',
      customer: 'cus_abc',
      status: 'active',
      current_period_end: now + 86400,
      trial_end: null,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_test' } }] },
    };
    const event = { type: 'customer.subscription.updated', data: { object: subscription } };

    // Augment fakeSupabase with select().eq().maybeSingle() so the handler can look up profile.id by customer_id.
    const db = {
      from: (table) => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'user-uuid-1' }, error: null }) }) }),
        update: (data) => ({ eq: (col, val) => { db._calls.push({ op: 'update', data, col, val }); return { error: null }; } }),
      }),
      _calls: [],
    };

    await handleSubscriptionUpserted(event, { db });

    expect(db._calls).toHaveLength(1);
    expect(db._calls[0].data.subscription_status).toBe('active');
    expect(db._calls[0].val).toBe('user-uuid-1');
  });
});

describe('handleInvoicePaymentFailed', () => {
  it('sets stripe_first_failed_payment_at when null', async () => {
    const event = { type: 'invoice.payment_failed', data: { object: { subscription: 'sub_123', customer: 'cus_abc' } } };
    const db = {
      _calls: [],
      from: () => ({ update: (data) => ({ eq: () => ({ is: (col, val) => { db._calls.push({ op: 'update', data, whereIsCol: col, whereIsVal: val }); return { error: null }; } }) }) }),
    };
    await handleInvoicePaymentFailed(event, { db });
    expect(db._calls).toHaveLength(1);
    expect(db._calls[0].data.stripe_first_failed_payment_at).toBeInstanceOf(Date);
    expect(db._calls[0].whereIsCol).toBe('stripe_first_failed_payment_at');
    expect(db._calls[0].whereIsVal).toBeNull();
  });
});

describe('handleInvoicePaymentSucceeded', () => {
  it('clears stripe_first_failed_payment_at', async () => {
    const event = { type: 'invoice.payment_succeeded', data: { object: { subscription: 'sub_123', customer: 'cus_abc' } } };
    const db = {
      _calls: [],
      from: () => ({ update: (data) => ({ eq: (col, val) => { db._calls.push({ op: 'update', data, col, val }); return { error: null }; } }) }),
    };
    await handleInvoicePaymentSucceeded(event, { db });
    expect(db._calls).toHaveLength(1);
    expect(db._calls[0].data.stripe_first_failed_payment_at).toBeNull();
  });
});
