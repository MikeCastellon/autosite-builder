# Stripe Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Shopify subscription flow with Stripe Billing for all new Pro signups ($9.99/month, 30-day trial, 7-day grace on failed payments, Stripe-hosted Customer Portal), while grandfathering existing Shopify subscribers in place.

**Architecture:** The existing `profiles.subscription_status` / `subscription_ends_at` columns remain the single source of truth for `isEffectiveSchedulerActive()`. New Stripe-specific columns are added alongside the existing Shopify ones. A new Stripe webhook (`stripe-webhook`) writes into the same two status columns as the Shopify webhook — both providers coexist harmlessly. All upgrade CTAs (`startProUpgrade`) are re-pointed from `subscription-checkout-url` (Shopify) to `stripe-checkout-url`. The `past_due` banner in `SubscribeGate` links to a new `stripe-portal-url` endpoint instead of `account.shopify.com`. Shopify code stays fully intact until the last Shopify subscriber churns; it is not deleted in this plan.

**Tech Stack:** Supabase (Postgres + RLS), Netlify Functions (Node, Lambda-style), `stripe` Node SDK, React 19 for the unchanged `SubscribeGate` UI, vitest for unit tests on the webhook event handlers and the extended feature gate.

**Scope note:** This plan covers ONLY the $9.99/month platform subscription. Stripe Connect (for businesses taking deposits) and application-fee flows are out of scope — they are separate plans: `2026-04-24-stripe-connect-onboarding.md`, `2026-04-24-stripe-booking-deposits.md`, `2026-04-24-stripe-charge-customer.md`.

**Existing facts locked in (from master):**
- `profiles.subscription_status` CHECK: `('inactive','active','past_due','cancelled')` — Stripe statuses will be mapped to this set; no new CHECK values added.
- Gate truth: `isEffectiveSchedulerActive(profile)` returns true on `is_super_admin`, `scheduler_enabled`, `subscription_status='active'`, OR `subscription_status='cancelled' AND subscription_ends_at > now()`. Current gate does NOT grant access on `past_due`. This plan adds a 7-day grace period as a new branch in the gate.
- `subscription-gating.js` has a mirror at `src/lib/subscriptionGating.js` — both must be updated together (the existing file says "keep the two in sync").
- All Pro upgrade CTAs go through `src/lib/upgradeFlow.js → startProUpgrade()`.
- Paywall testing: `VITE_PAYWALL_ALLOWLIST_EMAILS` bypasses the admin/scheduler_enabled fast path so the paywall is visible to testers. Must continue to work.
- Netlify function pattern: each function creates its own Supabase admin client inline with `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- Auth pattern: `Authorization: Bearer <access_token>` from `supabase.auth.getSession()`, validated server-side via `supabase.auth.getUser(token)`.
- Tests live in `tests/functions/*.test.js` using vitest, importing directly from `netlify/functions/_lib/*.js`.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `db/migrations/20260424_stripe_subscriptions.sql` | Add Stripe columns to `profiles`; no CHECK changes |
| `netlify/functions/_lib/stripe.js` | Stripe SDK singleton (`getStripe()`) that throws if `STRIPE_SECRET_KEY` is missing |
| `netlify/functions/_lib/stripe-event-handlers.js` | Pure functions that take a Stripe event + admin Supabase client and update `profiles`. Unit-testable without hitting Stripe or the DB (DB client is injected) |
| `netlify/functions/_lib/stripe-status-map.js` | Pure function: `mapStripeStatus(subscription) → { subscription_status, subscription_ends_at, trial_ends_at }`. Unit-tested |
| `netlify/functions/stripe-checkout-url.js` | Auth'd GET endpoint returning a Stripe Checkout Session URL for the Pro monthly price |
| `netlify/functions/stripe-portal-url.js` | Auth'd GET endpoint returning a Stripe Customer Portal URL |
| `netlify/functions/stripe-webhook.js` | POST webhook handler: verifies signature, delegates to `stripe-event-handlers.js` |
| `tests/functions/stripe-status-map.test.js` | Unit tests for status mapping |
| `tests/functions/stripe-event-handlers.test.js` | Unit tests for each event handler with a fake Supabase client |
| `tests/functions/subscription-gating.test.js` | **EXTEND** — add cases for the new 7-day grace period on `past_due` |

### Modified files

| Path | Change |
|---|---|
| `netlify/functions/_lib/subscription-gating.js` | Add 7-day grace period branch: `past_due` AND `first_failed_payment_at` within last 7 days → true |
| `src/lib/subscriptionGating.js` | Mirror the same grace-period branch; update `shouldShowUpgradeCard` accordingly |
| `src/lib/upgradeFlow.js` | Point `startProUpgrade()` at `/.netlify/functions/stripe-checkout-url`; add new `startBillingPortal()` that points at `stripe-portal-url` |
| `src/components/dashboard/bookings-page/SubscribeGate.jsx` | Replace the `account.shopify.com` link in the past-due banner with a button that calls `startBillingPortal()` |
| `netlify.toml` | (If not already) allow `STRIPE_*` env vars through to functions — Netlify passes all env vars by default so this is usually a no-op; verify |
| `.env.example` | Add the four new Stripe env vars with placeholder values |

### Unchanged files (explicitly do NOT touch)

- `netlify/functions/shopify-subscription-webhook.js` — still receives webhooks for grandfathered subscribers
- `netlify/functions/subscription-checkout-url.js` — remains callable but no longer linked from any UI
- `netlify/functions/_lib/shopify-hmac.js` — still used by the Shopify webhook
- `db/migrations/20260422_shopify_subscriptions.sql` — applied history, do not modify

---

## Env Vars

Add to Netlify (both Production and Deploy Previews contexts) and to local `.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...                  # from `stripe listen` or dashboard endpoint
STRIPE_PRICE_ID_PRO_MONTHLY=price_1TPq6LAnU2S5w1v8sE4mw244
APP_URL=https://yourdomain.com                    # base URL for Checkout success/cancel redirects
```

For local dev: `stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook` prints the `whsec_` value.

---

## Task 1: Migration — Stripe columns on profiles

**Files:**
- Create: `db/migrations/20260424_stripe_subscriptions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Stripe subscription integration — columns added alongside Shopify columns
-- on profiles. The existing subscription_status + subscription_ends_at columns
-- remain the gate source of truth; both Shopify and Stripe webhooks write to
-- them. These new columns are Stripe-bookkeeping only.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_trial_ends_at timestamptz,
  add column if not exists stripe_first_failed_payment_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

commit;
```

- [ ] **Step 2: Apply in Supabase SQL editor**

Paste the file contents into the Supabase SQL editor for the project. Confirm the `profiles` row shape shows the five new columns. Do NOT run via any automated migration tool — this project applies SQL manually.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/20260424_stripe_subscriptions.sql
git commit -m "feat(stripe): add stripe columns to profiles

Adds stripe_customer_id, stripe_subscription_id, stripe_price_id,
stripe_trial_ends_at, stripe_first_failed_payment_at alongside the
existing Shopify columns. Both providers continue to write to the
canonical subscription_status / subscription_ends_at columns."
```

---

## Task 2: Install Stripe SDK

**Files:**
- Modify: `package.json`
- Modify: `netlify/functions/package.json`

- [ ] **Step 1: Install at project root for tests + dev tooling**

```bash
npm install --save stripe
```

- [ ] **Step 2: Install inside the functions bundle**

```bash
cd netlify/functions && npm install --save stripe && cd ../..
```

- [ ] **Step 3: Verify install**

Run: `node -e "console.log(require('stripe').VERSION || 'ok')"`
Expected: prints a version string or `ok`, no error.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json netlify/functions/package.json netlify/functions/package-lock.json
git commit -m "chore(stripe): install stripe node sdk"
```

---

## Task 3: Stripe SDK singleton

**Files:**
- Create: `netlify/functions/_lib/stripe.js`

- [ ] **Step 1: Write the singleton**

```javascript
import Stripe from 'stripe';

let _stripe;

export function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' });
  }
  return _stripe;
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_lib/stripe.js
git commit -m "feat(stripe): sdk singleton"
```

---

## Task 4: Status mapping (pure, unit-tested)

**Files:**
- Create: `netlify/functions/_lib/stripe-status-map.js`
- Create: `tests/functions/stripe-status-map.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/functions/stripe-status-map.test.js
import { describe, it, expect } from 'vitest';
import { mapStripeStatus } from '../../netlify/functions/_lib/stripe-status-map.js';

// Helper: fake a Stripe.Subscription shape with only the fields we read.
function sub({ status, current_period_end, trial_end, cancel_at_period_end = false }) {
  return { status, current_period_end, trial_end, cancel_at_period_end };
}

describe('mapStripeStatus', () => {
  it('trialing → active, trial_ends_at populated', () => {
    const trialEnd = Math.floor(Date.parse('2026-05-24T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'trialing', trial_end: trialEnd, current_period_end: trialEnd }));
    expect(r.subscription_status).toBe('active');
    expect(r.stripe_trial_ends_at.toISOString()).toBe('2026-05-24T00:00:00.000Z');
    expect(r.subscription_ends_at).toBeNull();
  });

  it('active (not cancelling) → active, no end date', () => {
    const periodEnd = Math.floor(Date.parse('2026-05-24T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'active', current_period_end: periodEnd }));
    expect(r.subscription_status).toBe('active');
    expect(r.subscription_ends_at).toBeNull();
    expect(r.stripe_trial_ends_at).toBeNull();
  });

  it('active + cancel_at_period_end → cancelled with end date', () => {
    const periodEnd = Math.floor(Date.parse('2026-06-01T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'active', current_period_end: periodEnd, cancel_at_period_end: true }));
    expect(r.subscription_status).toBe('cancelled');
    expect(r.subscription_ends_at.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('past_due → past_due', () => {
    const r = mapStripeStatus(sub({ status: 'past_due', current_period_end: 1 }));
    expect(r.subscription_status).toBe('past_due');
  });

  it('canceled (ended) → cancelled, ends_at = period_end', () => {
    const periodEnd = Math.floor(Date.parse('2026-04-01T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'canceled', current_period_end: periodEnd }));
    expect(r.subscription_status).toBe('cancelled');
    expect(r.subscription_ends_at.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('incomplete / incomplete_expired / unpaid → inactive', () => {
    for (const status of ['incomplete', 'incomplete_expired', 'unpaid']) {
      const r = mapStripeStatus(sub({ status, current_period_end: 1 }));
      expect(r.subscription_status).toBe('inactive');
    }
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npx vitest run tests/functions/stripe-status-map.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper**

```javascript
// netlify/functions/_lib/stripe-status-map.js
// Pure mapping: Stripe subscription object → canonical columns.
// Does NOT touch the database.
//
// Output shape matches the `profiles` columns exactly:
//   subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled'
//   subscription_ends_at: Date | null           — when access lapses
//   stripe_trial_ends_at: Date | null           — display only
export function mapStripeStatus(subscription) {
  const { status, current_period_end, trial_end, cancel_at_period_end } = subscription;

  const periodEnd = current_period_end ? new Date(current_period_end * 1000) : null;
  const trialEnd = trial_end ? new Date(trial_end * 1000) : null;

  // Trial: grant access, record trial-end for UI
  if (status === 'trialing') {
    return {
      subscription_status: 'active',
      subscription_ends_at: null,
      stripe_trial_ends_at: trialEnd,
    };
  }

  // Active + user clicked Cancel in portal: flips cancel_at_period_end.
  // Keep access through period_end, then it naturally ends.
  if (status === 'active') {
    if (cancel_at_period_end) {
      return {
        subscription_status: 'cancelled',
        subscription_ends_at: periodEnd,
        stripe_trial_ends_at: null,
      };
    }
    return {
      subscription_status: 'active',
      subscription_ends_at: null,
      stripe_trial_ends_at: null,
    };
  }

  if (status === 'past_due') {
    return {
      subscription_status: 'past_due',
      subscription_ends_at: null,
      stripe_trial_ends_at: null,
    };
  }

  if (status === 'canceled') {
    return {
      subscription_status: 'cancelled',
      subscription_ends_at: periodEnd,
      stripe_trial_ends_at: null,
    };
  }

  // incomplete, incomplete_expired, unpaid, paused, etc.
  return {
    subscription_status: 'inactive',
    subscription_ends_at: null,
    stripe_trial_ends_at: null,
  };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/functions/stripe-status-map.test.js`
Expected: PASS — all 6 test cases.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/stripe-status-map.js tests/functions/stripe-status-map.test.js
git commit -m "feat(stripe): status mapping + tests"
```

---

## Task 5: Event handlers (pure, DB-injected)

**Files:**
- Create: `netlify/functions/_lib/stripe-event-handlers.js`
- Create: `tests/functions/stripe-event-handlers.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
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
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npx vitest run tests/functions/stripe-event-handlers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handlers**

```javascript
// netlify/functions/_lib/stripe-event-handlers.js
import { mapStripeStatus } from './stripe-status-map.js';

// Core writer: given a subscription object + target profile, push canonical
// columns. Callers must resolve the profile id themselves (either from
// client_reference_id on the checkout session, or by customer lookup).
function subscriptionToProfilePatch(subscription) {
  const mapped = mapStripeStatus(subscription);
  const priceId = subscription?.items?.data?.[0]?.price?.id || null;
  return {
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_status: mapped.subscription_status,
    subscription_ends_at: mapped.subscription_ends_at,
    stripe_trial_ends_at: mapped.stripe_trial_ends_at,
    // New subscription → clear any stale failed-payment timestamp.
    stripe_first_failed_payment_at: null,
    subscription_updated_at: new Date(),
  };
}

// checkout.session.completed: new signup. client_reference_id is the user uuid
// (set in stripe-checkout-url.js). Fetch the full subscription, then write.
export async function handleCheckoutCompleted(event, { stripe, db }) {
  const session = event.data.object;
  const userId = session.client_reference_id;
  if (!userId || !session.subscription) return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const patch = subscriptionToProfilePatch(subscription);
  const { error } = await db.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// customer.subscription.{created,updated,deleted}: status changes over time.
// Profile is located by stripe_customer_id (already written during checkout).
export async function handleSubscriptionUpserted(event, { db }) {
  const subscription = event.data.object;
  if (!subscription.customer) return;

  const { data: profile, error: lookupErr } = await db
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!profile) return; // orphan event, nothing to do

  const patch = subscriptionToProfilePatch(subscription);
  // Do NOT clear first_failed_payment_at here — only succeeded/failed invoice events touch that.
  delete patch.stripe_first_failed_payment_at;

  const { error } = await db.from('profiles').update(patch).eq('id', profile.id);
  if (error) throw error;
}

// invoice.payment_failed: start the 7-day grace-period clock.
// Use .is('stripe_first_failed_payment_at', null) so we only set it ONCE per failure run;
// successive failures within the same dunning cycle do not reset the clock.
export async function handleInvoicePaymentFailed(event, { db }) {
  const invoice = event.data.object;
  if (!invoice.customer) return;
  const { error } = await db
    .from('profiles')
    .update({ stripe_first_failed_payment_at: new Date() })
    .eq('stripe_customer_id', invoice.customer)
    .is('stripe_first_failed_payment_at', null);
  if (error) throw error;
}

// invoice.payment_succeeded: dunning recovered, clear the grace-period clock.
export async function handleInvoicePaymentSucceeded(event, { db }) {
  const invoice = event.data.object;
  if (!invoice.customer) return;
  const { error } = await db
    .from('profiles')
    .update({ stripe_first_failed_payment_at: null })
    .eq('stripe_customer_id', invoice.customer);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/functions/stripe-event-handlers.test.js`
Expected: PASS — all 4 describes green.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/stripe-event-handlers.js tests/functions/stripe-event-handlers.test.js
git commit -m "feat(stripe): event handlers with injected db/stripe clients

Pure-ish handlers that delegate state mapping to stripe-status-map and
take the Supabase + Stripe clients as params so they can be unit-tested
without network or DB."
```

---

## Task 6: Webhook endpoint

**Files:**
- Create: `netlify/functions/stripe-webhook.js`

- [ ] **Step 1: Write the webhook handler**

```javascript
// netlify/functions/stripe-webhook.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpserted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from './_lib/stripe-event-handlers.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
  'Content-Type': 'application/json',
};
const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!signature) return fail(400, { error: 'Missing Stripe-Signature' });

  // Stripe signature verification requires the raw body exactly as sent.
  // Netlify passes base64-encoded bodies for binary content types; Stripe
  // sends JSON so event.body is already a string, but handle both forms.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  const stripe = getStripe();

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[stripe-webhook] signature verification failed:', err.message);
    return fail(400, { error: 'Invalid signature' });
  }

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent, { stripe, db });
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpserted(stripeEvent, { db });
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripeEvent, { db });
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(stripeEvent, { db });
        break;
      default:
        // No-op for events we don't subscribe to — return 200 to stop retries.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler error [${stripeEvent.type}]:`, err);
    return fail(500, { error: 'Handler failed' });
  }

  return ok({ received: true });
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/stripe-webhook.js
git commit -m "feat(stripe): webhook endpoint

POST /.netlify/functions/stripe-webhook. Verifies Stripe signature,
dispatches to typed handlers. Handles checkout.session.completed,
customer.subscription.{created,updated,deleted},
invoice.payment_{failed,succeeded}."
```

---

## Task 7: Checkout session endpoint

**Files:**
- Create: `netlify/functions/stripe-checkout-url.js`

- [ ] **Step 1: Write the endpoint**

```javascript
// netlify/functions/stripe-checkout-url.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  const appUrl = process.env.APP_URL;
  if (!priceId || !appUrl) return fail(500, { error: 'Stripe env not configured' });

  const stripe = getStripe();

  // Reuse an existing Stripe customer if we've seen this user before.
  const { data: profile } = await db
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || profile?.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: { supabase_user_id: user.id },
    },
    payment_method_collection: 'always',
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard?stripe_success=1`,
    cancel_url: `${appUrl}/dashboard?stripe_cancelled=1`,
  });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ url: session.url }),
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/stripe-checkout-url.js
git commit -m "feat(stripe): checkout session endpoint

GET /.netlify/functions/stripe-checkout-url. Authenticated; creates or
reuses a Stripe customer tied to the supabase user, returns a hosted
Checkout session URL with a 30-day trial and promo codes enabled."
```

---

## Task 8: Customer portal endpoint

**Files:**
- Create: `netlify/functions/stripe-portal-url.js`

- [ ] **Step 1: Write the endpoint**

```javascript
// netlify/functions/stripe-portal-url.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  const { data: profile } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) return fail(404, { error: 'No billing account' });

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.APP_URL}/dashboard`,
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: session.url }) };
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/stripe-portal-url.js
git commit -m "feat(stripe): customer portal endpoint

GET /.netlify/functions/stripe-portal-url. Authenticated; returns a
Stripe Customer Portal URL for the caller's billing account."
```

---

## Task 9: Extend feature gate for 7-day grace period

**Files:**
- Modify: `netlify/functions/_lib/subscription-gating.js`
- Modify: `src/lib/subscriptionGating.js`
- Modify: `tests/functions/subscription-gating.test.js`

- [ ] **Step 1: Read the existing test file**

Run: `cat tests/functions/subscription-gating.test.js`
Note the existing describes; the new cases will be appended as a new describe block.

- [ ] **Step 2: Write failing tests for grace period**

Append to `tests/functions/subscription-gating.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { isEffectiveSchedulerActive } from '../../netlify/functions/_lib/subscription-gating.js';

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

describe('isEffectiveSchedulerActive — past_due grace period', () => {
  it('past_due within 7 days of first failure → true', () => {
    const profile = {
      subscription_status: 'past_due',
      stripe_first_failed_payment_at: new Date(Date.now() - (GRACE_MS - 3600_000)).toISOString(),
    };
    expect(isEffectiveSchedulerActive(profile)).toBe(true);
  });

  it('past_due past 7 days → false', () => {
    const profile = {
      subscription_status: 'past_due',
      stripe_first_failed_payment_at: new Date(Date.now() - (GRACE_MS + 3600_000)).toISOString(),
    };
    expect(isEffectiveSchedulerActive(profile)).toBe(false);
  });

  it('past_due with no failure timestamp → true (webhook not yet caught up)', () => {
    const profile = { subscription_status: 'past_due', stripe_first_failed_payment_at: null };
    expect(isEffectiveSchedulerActive(profile)).toBe(true);
  });
});
```

Run: `npx vitest run tests/functions/subscription-gating.test.js`
Expected: the three new tests FAIL.

- [ ] **Step 3: Update `netlify/functions/_lib/subscription-gating.js`**

Replace the whole file with:

```javascript
// Single source of truth for "does this profile have scheduler access right now".
// Mirrored in src/lib/subscriptionGating.js — keep the two in sync.
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isEffectiveSchedulerActive(profile) {
  if (!profile) return false;
  if (profile.is_super_admin) return true;
  if (profile.scheduler_enabled) return true;
  if (profile.subscription_status === 'active') return true;
  if (
    profile.subscription_status === 'cancelled' &&
    profile.subscription_ends_at &&
    Date.parse(profile.subscription_ends_at) > Date.now()
  ) {
    return true;
  }
  // 7-day grace period on failed payments (Stripe only — Shopify path keeps
  // status='past_due' without a failure timestamp and still grants access
  // until the webhook flips it to 'cancelled').
  if (profile.subscription_status === 'past_due') {
    if (!profile.stripe_first_failed_payment_at) return true;
    const firstFailureMs = Date.parse(profile.stripe_first_failed_payment_at);
    if (Number.isFinite(firstFailureMs) && Date.now() - firstFailureMs < GRACE_MS) return true;
    return false;
  }
  return false;
}
```

- [ ] **Step 4: Mirror in `src/lib/subscriptionGating.js`**

Replace the `isEffectiveSchedulerActive` function with the same implementation. Leave `isPaywallTestUser`, `canSeeBookingsNav`, and `shouldShowUpgradeCard` alone — they still work because the definition of "has sub access" hasn't fundamentally changed.

Also update `shouldShowUpgradeCard` so that past_due-within-grace counts as "has access":

```javascript
export function shouldShowUpgradeCard(profile) {
  if (!profile) return false;
  const hasSubAccess =
    profile.subscription_status === 'active' ||
    (profile.subscription_status === 'cancelled' &&
     profile.subscription_ends_at &&
     Date.parse(profile.subscription_ends_at) > Date.now()) ||
    (profile.subscription_status === 'past_due' &&
     (!profile.stripe_first_failed_payment_at ||
      Date.now() - Date.parse(profile.stripe_first_failed_payment_at) < 7 * 24 * 60 * 60 * 1000));
  if (isPaywallTestUser(profile.email)) {
    return !hasSubAccess;
  }
  return !isEffectiveSchedulerActive(profile);
}
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run tests/functions/subscription-gating.test.js`
Expected: all existing tests still pass, plus the 3 new grace-period cases.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/subscription-gating.js src/lib/subscriptionGating.js tests/functions/subscription-gating.test.js
git commit -m "feat(stripe): 7-day grace period on past_due

isEffectiveSchedulerActive now grants access when status=past_due and
stripe_first_failed_payment_at is null OR within the last 7 days.
Mirrors the change in src/lib/subscriptionGating.js and updates
shouldShowUpgradeCard accordingly."
```

---

## Task 10: Point upgrade CTAs at Stripe

**Files:**
- Modify: `src/lib/upgradeFlow.js`
- Modify: `src/components/dashboard/bookings-page/SubscribeGate.jsx`

- [ ] **Step 1: Replace `upgradeFlow.js`**

```javascript
// src/lib/upgradeFlow.js
import { supabase } from './supabase.js';

// Opens the Stripe Checkout Session for the Pro monthly subscription.
// Used by every "Upgrade to Pro" CTA across the app.
export async function startProUpgrade() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to upgrade.');

  const res = await fetch('/.netlify/functions/stripe-checkout-url', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not start checkout — please try again.');
  }
  window.open(body.url, '_blank', 'noopener');
}

// Opens the Stripe Customer Portal for the signed-in user. Used by the
// "Manage Billing" button and the past-due banner's "Update payment method"
// link.
export async function startBillingPortal() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetch('/.netlify/functions/stripe-portal-url', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not open billing portal — please try again.');
  }
  window.open(body.url, '_blank', 'noopener');
}
```

- [ ] **Step 2: Update `SubscribeGate.jsx` past-due banner**

In `src/components/dashboard/bookings-page/SubscribeGate.jsx`, replace the `<a href="https://account.shopify.com">` block with a `<button>` that calls `startBillingPortal()`:

Add import at top:
```jsx
import { startBillingPortal } from '../../../lib/upgradeFlow.js';
```

Replace this block:
```jsx
<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
  Your subscription has a payment issue.{' '}
  <a className="font-semibold underline hover:no-underline" href="https://account.shopify.com" target="_blank" rel="noreferrer">
    Update your payment method →
  </a>
</div>
```

With:
```jsx
<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
  Your subscription has a payment issue.{' '}
  <button
    type="button"
    className="font-semibold underline hover:no-underline"
    onClick={() => startBillingPortal().catch((e) => alert(e.message))}
  >
    Update your payment method →
  </button>
</div>
```

- [ ] **Step 3: Smoke-check in dev**

Run: `npm run dev` (or `netlify dev` if Netlify Functions are required locally).
In the UI, navigate to Bookings as a non-Pro user. Click the upgrade CTA — confirm the browser opens a Stripe Checkout page (not Shopify). Close it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/upgradeFlow.js src/components/dashboard/bookings-page/SubscribeGate.jsx
git commit -m "feat(stripe): route upgrade + portal CTAs through Stripe

startProUpgrade now hits stripe-checkout-url. New startBillingPortal
powers the past-due banner and any future Manage Billing button."
```

---

## Task 11: Stripe Dashboard configuration

**Files:** none (external config)

- [ ] **Step 1: Create the $9.99/mo Price**

In the Stripe dashboard (test mode first):
1. Products → Add product
2. Name: `Genius Websites Pro — Monthly`
3. Pricing: `$9.99 USD`, recurring, monthly
4. Copy the `price_...` ID into `STRIPE_PRICE_ID_PRO_MONTHLY` env var (Netlify + local `.env`).

- [ ] **Step 2: Configure the Customer Portal**

Settings → Billing → Customer portal:
- Enable: Update payment method, View invoice history, Cancel subscriptions
- Disable: Switch plans, Pause subscriptions, Update quantities
- Cancellation mode: Cancel at end of billing period
- Click **Save** (portal 404s without this)

- [ ] **Step 3: Create the webhook endpoint**

Developers → Webhooks → Add endpoint:
- URL: `https://<your-netlify-domain>/.netlify/functions/stripe-webhook`
- Listen to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Netlify.

For local dev:
```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```
Copy the printed `whsec_...` into your local `.env`.

- [ ] **Step 4: Enable Smart Retries + customer emails**

Settings → Billing → Subscriptions and emails:
- Enable Smart Retries
- Enable customer emails: failed payments, upcoming renewals, trial ending

- [ ] **Step 5: Update `.env.example`**

```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO_MONTHLY=price_xxx
APP_URL=http://localhost:8888
```

- [ ] **Step 6: Commit**

```bash
git add .env.example
git commit -m "docs(stripe): add env var examples for subscription billing"
```

---

## Task 12: End-to-end test in sandbox

**Files:** none (manual test)

- [ ] **Step 1: Set up a test user**

Create a fresh test account in the app. Verify the profile has no `stripe_*` columns populated in Supabase.

- [ ] **Step 2: Happy-path signup**

1. Click the upgrade CTA.
2. Complete Stripe Checkout with card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
3. Return to app.

Verify in Supabase:
- `profiles.stripe_customer_id` populated
- `profiles.stripe_subscription_id` populated
- `profiles.subscription_status` = `active`
- `profiles.stripe_trial_ends_at` is ~30 days out

Verify in UI: Bookings tab no longer paywalled.

- [ ] **Step 3: Trial → paid conversion (test clock)**

In Stripe: Customers → test customer → Test clock → Advance by 31 days.

Verify: `invoice.payment_succeeded` fires. `profiles.stripe_trial_ends_at` still set (historical). Status stays `active`.

- [ ] **Step 4: Failed payment → grace period**

Update the card in the Customer Portal to `4000 0000 0000 0341` (attaches OK, fails on charge). Advance the test clock past the next renewal.

Verify:
- `invoice.payment_failed` fires
- `profiles.subscription_status` = `past_due`
- `profiles.stripe_first_failed_payment_at` set to ~now
- Bookings still accessible
- Past-due banner visible on the paywall test account

Then in Supabase SQL editor, run:
```sql
update profiles
set stripe_first_failed_payment_at = now() - interval '8 days'
where id = '<test user id>';
```

Reload Bookings. Expect: access revoked, upgrade card visible.

- [ ] **Step 5: Cancellation**

Restore the card, then in the Customer Portal click Cancel. Verify `customer.subscription.updated` arrives with `cancel_at_period_end=true`, and profile shows `subscription_status='cancelled'`, `subscription_ends_at` = the current period end. Access remains until that date, then `customer.subscription.deleted` revokes.

- [ ] **Step 6: Regression — Shopify sub still works**

Pick a pre-existing Shopify subscriber (or construct one in Supabase directly with `subscription_status='active'` and null Stripe columns). Confirm Bookings is accessible for that profile. Confirm the Shopify webhook log still shows 200 responses for any events received during the test window.

- [ ] **Step 7: Commit smoke doc**

Create `docs/superpowers/smoke-tests/stripe-subscriptions.md` with a condensed version of scenarios 1–5 so future deploys can be verified quickly.

```bash
git add docs/superpowers/smoke-tests/stripe-subscriptions.md
git commit -m "docs(stripe): smoke test checklist"
```

---

## Task 13: Go-live checklist (manual — no code)

- [ ] All vitest tests pass: `npx vitest run`
- [ ] Sandbox scenarios 1–5 above pass on a Netlify deploy preview
- [ ] Stripe dashboard: live-mode Product + Price created; `STRIPE_PRICE_ID_PRO_MONTHLY` updated in Netlify production env
- [ ] Stripe dashboard: live-mode Customer Portal configured AND saved (re-do Task 11 step 2 in live mode)
- [ ] Stripe dashboard: live-mode webhook endpoint created; signing secret written to Netlify production `STRIPE_WEBHOOK_SECRET`
- [ ] Live mode: `STRIPE_SECRET_KEY` updated in Netlify production env
- [ ] Smart Retries + customer emails enabled in live mode
- [ ] Business Settings completed in live mode (public-facing info on Checkout + emails)
- [ ] Shopify webhook still live and receiving 200 — do NOT disable until the last Shopify subscriber churns
- [ ] Paywall allowlist (`VITE_PAYWALL_ALLOWLIST_EMAILS`) verified to still force the gate for testers under the new flow

---

## Follow-up plans (out of scope here)

Once this plan lands and Task 12 passes in sandbox, the remaining Stripe work is split into three independent plans:

1. `2026-04-24-stripe-connect-onboarding.md` — Express Connect onboarding for Pro users (adds `profiles.stripe_connect_account_id`, `profiles.stripe_connect_charges_enabled`, onboarding link endpoint, account.updated webhook handling).
2. `2026-04-24-stripe-booking-deposits.md` — depends on (1); adds `deposit_percentage` to scheduler config, generates a Stripe Checkout Session on the connected account for each booking, $2 flat application fee.
3. `2026-04-24-stripe-charge-customer.md` — depends on (1); "Charge customer $X" button in the dashboard generating Stripe Payment Links on the connected account.

In-person Tap-to-Pay is handled zero-engineering by directing businesses to the free Stripe Dashboard mobile app, which supports Tap-to-Pay on their Express account natively.
