// tests/functions/stripe-checkout-url.test.js
//
// The Pro upgrade checkout. A customer on a Pro trial (a free website's
// hand-over) who subscribes early is first charged when the trial ends;
// everyone else is charged at checkout. Stripe and Supabase are fakes.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ profile: null, sessions: [], blocking: null }));

// The function resolves supabase-js from netlify/functions' own node_modules.
vi.mock('../../netlify/functions/node_modules/@supabase/supabase-js/dist/index.mjs', () => ({
  createClient: () => ({
    auth: { getUser: async (token) => ({ data: { user: token === 'good' ? { id: 'user-1', email: 'dana@shop.test' } : null }, error: null }) },
    from: () => {
      const api = {
        select: () => api, eq: () => api, update: () => api,
        maybeSingle: async () => ({ data: h.profile, error: null }),
        then: (res) => Promise.resolve({ error: null }).then(res),
      };
      return api;
    },
  }),
}));

vi.mock('../../netlify/functions/_lib/stripe.js', () => ({
  getStripe: () => ({
    customers: { create: async () => ({ id: 'cus_new' }) },
    checkout: { sessions: { create: async (params) => { h.sessions.push(params); return { url: 'https://checkout.stripe.test/s' }; } } },
  }),
}));

vi.mock('../../netlify/functions/_lib/subscription-guard.js', () => ({
  findBlockingSubscription: async () => h.blocking,
}));

const { handler } = await import('../../netlify/functions/stripe-checkout-url.js');

const DAY = 24 * 3600 * 1000;
const get = () => handler({ httpMethod: 'GET', headers: { authorization: 'Bearer good' } });

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_pro';
  process.env.APP_URL = 'https://app.test';
  h.sessions = [];
  h.blocking = null;
});

describe('stripe-checkout-url', () => {
  it('charges at checkout without a trial', async () => {
    h.profile = { stripe_customer_id: 'cus_1', email: 'dana@shop.test', subscription_status: null, pro_trial_ends_at: null };
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(h.sessions[0].subscription_data).toEqual({ metadata: { supabase_user_id: 'user-1' } });
  });

  it('on a Pro trial, the first charge is when the trial ends', async () => {
    const ends = new Date(Date.now() + 12 * DAY);
    h.profile = { stripe_customer_id: 'cus_1', email: 'dana@shop.test', subscription_status: null, pro_trial_ends_at: ends.toISOString() };
    await get();
    expect(h.sessions[0].subscription_data).toEqual({
      metadata: { supabase_user_id: 'user-1' },
      trial_end: Math.floor(ends.getTime() / 1000),
    });
    expect(h.sessions[0].payment_method_collection).toBe('always');
  });

  it('in the trial\'s last two days (too close for Stripe), it charges at checkout', async () => {
    h.profile = { stripe_customer_id: 'cus_1', email: 'dana@shop.test', subscription_status: null, pro_trial_ends_at: new Date(Date.now() + DAY).toISOString() };
    await get();
    expect(h.sessions[0].subscription_data.trial_end).toBeUndefined();
  });

  it('still refuses a second subscription', async () => {
    h.profile = { stripe_customer_id: 'cus_1', email: 'dana@shop.test', pro_trial_ends_at: new Date(Date.now() + 12 * DAY).toISOString() };
    h.blocking = { id: 'sub_live' };
    const body = JSON.parse((await get()).body);
    expect(body.alreadySubscribed).toBe(true);
    expect(h.sessions).toEqual([]);
  });
});
