# Shopify Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the scheduler feature behind a $9.99/month Shopify subscription (Shopify's native Subscriptions app) with a cart-permalink checkout flow and webhook-driven status sync.

**Architecture:** Super admin and direct DB toggle continue to work; a new `subscription_status` column on `profiles` carries the paid-subscription state. The Bookings page renders either the current Schedule/Settings tabs (when access is effective) or a new Subscribe upgrade card. Clicking Subscribe opens a Shopify cart permalink tagged with `supabase_user_id`; Shopify handles checkout, customer creation, and recurring billing. Three webhook topics (`orders/paid`, `subscription_contracts/update`, `subscription_contracts/cancel`) POST to a single HMAC-verified Netlify function that upserts the user's subscription state in Supabase.

**Tech Stack:** Supabase (Postgres + RLS), Netlify Functions (Node, Lambda-style), Shopify Admin/Storefront APIs + Shopify Subscriptions native app, React 19 for the Bookings gate UI, vitest for HMAC + gating tests.

**Spec reference:** [docs/superpowers/specs/2026-04-22-shopify-subscriptions-design.md](../specs/2026-04-22-shopify-subscriptions-design.md)

**Captured IDs (already confirmed from Shopify):**
- `SHOPIFY_SCHEDULER_VARIANT_ID = 46224674816188`
- `SHOPIFY_SCHEDULER_SELLING_PLAN_ID = 1833992380`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `db/migrations/20260422_shopify_subscriptions.sql` | 5 new columns on `profiles` + CHECK + index |
| `netlify/functions/_lib/shopify-hmac.js` | Pure HMAC-SHA256 verifier for Shopify webhooks |
| `netlify/functions/_lib/subscription-gating.js` | Server-side `isEffectiveSchedulerActive(profile)` |
| `netlify/functions/shopify-subscription-webhook.js` | Webhook handler (3 topics) |
| `netlify/functions/subscription-checkout-url.js` | Auth'd endpoint returning a pre-built Shopify cart URL |
| `netlify/functions/setup-shopify-webhooks.js` | Admin-only one-shot to register webhooks via Shopify Admin API |
| `src/lib/subscriptionGating.js` | Client mirror of the gating rule |
| `src/components/dashboard/bookings-page/SubscribeGate.jsx` | Renders Upgrade card or children |
| `tests/functions/shopify-hmac.test.js` | Vitest for HMAC helper |
| `tests/functions/subscription-gating.test.js` | Vitest for gating matrix |

### Modified files

| Path | Change |
|---|---|
| `netlify/functions/scheduler-config.js` | Use `isEffectiveSchedulerActive` in place of raw `scheduler_enabled` |
| `src/lib/AuthContext.jsx` | Include subscription fields in the profile select |
| `src/components/dashboard/bookings-page/BookingsPage.jsx` | Wrap content in `<SubscribeGate profile={profile}>` |

---

## Environment setup notes (controller / user side)

These aren't tasks, but they need to happen for the feature to function end-to-end. Set these on the autosite-builder Netlify site (copy the first three from `acg-pr-dashboard` which already has them):

- `SHOPIFY_STORE_DOMAIN` = `714f13-92.myshopify.com`
- `SHOPIFY_ADMIN_API_TOKEN` = (existing value from acg-pr-dashboard)
- `SHOPIFY_WEBHOOK_SECRET` = (existing value from acg-pr-dashboard)
- `SHOPIFY_API_VERSION` = `2026-04`
- `SHOPIFY_SCHEDULER_VARIANT_ID` = `46224674816188`
- `SHOPIFY_SCHEDULER_SELLING_PLAN_ID` = `1833992380`

The controller handles this step via the Netlify MCP after Task 1 is done. Flagged as a deferred user action in Task 9.

---

## Task 1: Database migration

**Files:**
- Create: `db/migrations/20260422_shopify_subscriptions.sql`

- [ ] **Step 1: Create the directory if missing**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
mkdir -p db/migrations
```

- [ ] **Step 2: Write the migration SQL**

Create `db/migrations/20260422_shopify_subscriptions.sql` with EXACTLY:

```sql
-- Shopify subscription gating — add columns to profiles.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists shopify_customer_id text,
  add column if not exists shopify_subscription_id text,
  add column if not exists subscription_updated_at timestamptz;

-- Only add the check constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_subscription_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_subscription_status_check
      check (subscription_status in ('inactive','active','past_due','cancelled'));
  end if;
end $$;

create index if not exists profiles_shopify_customer_id_idx
  on public.profiles (shopify_customer_id)
  where shopify_customer_id is not null;

commit;
```

- [ ] **Step 3: Do NOT apply the migration directly**

The controller (parent agent) will apply this via the Supabase MCP with project_id `ktnouhjikmlxlbxcxyif`. Subagent: flag this as a deferred action in your report.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/20260422_shopify_subscriptions.sql
git commit -m "feat(db): add subscription columns to profiles"
```

---

## Task 2: Shopify HMAC helper (TDD)

**Files:**
- Create: `netlify/functions/_lib/shopify-hmac.js`
- Test: `tests/functions/shopify-hmac.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/shopify-hmac.test.js`:

```js
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyShopifyHmac } from '../../netlify/functions/_lib/shopify-hmac.js';

const secret = 'test-secret-123';
const payload = '{"id":12345,"test":true}';

function sign(body, key) {
  return crypto.createHmac('sha256', key).update(body, 'utf8').digest('base64');
}

describe('verifyShopifyHmac', () => {
  it('returns true for a correctly signed payload', () => {
    const hmac = sign(payload, secret);
    expect(verifyShopifyHmac(payload, hmac, secret)).toBe(true);
  });

  it('returns false when secret is wrong', () => {
    const hmac = sign(payload, secret);
    expect(verifyShopifyHmac(payload, hmac, 'different-secret')).toBe(false);
  });

  it('returns false when signature is missing', () => {
    expect(verifyShopifyHmac(payload, undefined, secret)).toBe(false);
    expect(verifyShopifyHmac(payload, '', secret)).toBe(false);
    expect(verifyShopifyHmac(payload, null, secret)).toBe(false);
  });

  it('returns false when body is tampered', () => {
    const hmac = sign(payload, secret);
    expect(verifyShopifyHmac(payload + 'x', hmac, secret)).toBe(false);
  });

  it('returns false when secret is empty', () => {
    expect(verifyShopifyHmac(payload, 'whatever', '')).toBe(false);
    expect(verifyShopifyHmac(payload, 'whatever', undefined)).toBe(false);
  });

  it('uses constant-time comparison (no exceptions on length mismatch)', () => {
    // timingSafeEqual throws on different buffer lengths if called raw;
    // our wrapper should not throw — it should just return false.
    expect(() => verifyShopifyHmac(payload, 'short', secret)).not.toThrow();
    expect(verifyShopifyHmac(payload, 'short', secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
npx vitest run tests/functions/shopify-hmac.test.js
```

Expected: fail — module not found.

- [ ] **Step 3: Implement**

Create `netlify/functions/_lib/shopify-hmac.js` with EXACTLY:

```js
import crypto from 'node:crypto';

export function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret) return false;
  if (typeof rawBody !== 'string') return false;

  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(String(hmacHeader));
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run tests/functions/shopify-hmac.test.js
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/shopify-hmac.js tests/functions/shopify-hmac.test.js
git commit -m "feat(shopify): HMAC verifier for webhook payloads"
```

---

## Task 3: Subscription gating helper (TDD) — server + client mirror

**Files:**
- Create: `netlify/functions/_lib/subscription-gating.js`
- Create: `src/lib/subscriptionGating.js`
- Test: `tests/functions/subscription-gating.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/subscription-gating.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { isEffectiveSchedulerActive } from '../../netlify/functions/_lib/subscription-gating.js';

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

describe('isEffectiveSchedulerActive', () => {
  it('returns false for fully inactive profile', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'inactive', subscription_ends_at: null,
    })).toBe(false);
  });

  it('returns true when is_super_admin', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: true, scheduler_enabled: false,
      subscription_status: 'inactive', subscription_ends_at: null,
    })).toBe(true);
  });

  it('returns true when scheduler_enabled direct toggle is on', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: true,
      subscription_status: 'inactive', subscription_ends_at: null,
    })).toBe(true);
  });

  it('returns true when subscription is active', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'active', subscription_ends_at: null,
    })).toBe(true);
  });

  it('returns true for cancelled within grace period', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'cancelled', subscription_ends_at: FUTURE,
    })).toBe(true);
  });

  it('returns false for cancelled past the end date', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'cancelled', subscription_ends_at: PAST,
    })).toBe(false);
  });

  it('returns false for past_due (no grace)', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'past_due', subscription_ends_at: FUTURE,
    })).toBe(false);
  });

  it('handles null/undefined profile defensively', () => {
    expect(isEffectiveSchedulerActive(null)).toBe(false);
    expect(isEffectiveSchedulerActive(undefined)).toBe(false);
    expect(isEffectiveSchedulerActive({})).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npx vitest run tests/functions/subscription-gating.test.js
```

Expected: fail — module not found.

- [ ] **Step 3: Implement server-side helper**

Create `netlify/functions/_lib/subscription-gating.js` with EXACTLY:

```js
// Single source of truth for "does this profile have scheduler access right now".
// Mirrored in src/lib/subscriptionGating.js — keep the two in sync.
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
  return false;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run tests/functions/subscription-gating.test.js
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Create the client mirror**

Create `src/lib/subscriptionGating.js` with EXACTLY the same logic (duplicated so Vite doesn't pull in netlify/functions code):

```js
// Client mirror of netlify/functions/_lib/subscription-gating.js — keep in sync.
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
  return false;
}
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/subscription-gating.js src/lib/subscriptionGating.js tests/functions/subscription-gating.test.js
git commit -m "feat(subscription): gating rule helper (server + client mirror, TDD)"
```

---

## Task 4: Shopify subscription webhook handler

**Files:**
- Create: `netlify/functions/shopify-subscription-webhook.js`

- [ ] **Step 1: Create the function**

Create `netlify/functions/shopify-subscription-webhook.js` with EXACTLY:

```js
import { createClient } from '@supabase/supabase-js';
import { verifyShopifyHmac } from './_lib/shopify-hmac.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Topic, X-Shopify-Hmac-Sha256',
  'Content-Type': 'application/json',
};

function ok(body) { return { statusCode: 200, headers: CORS, body: JSON.stringify(body) }; }
function fail(status, body) { return { statusCode: status, headers: CORS, body: JSON.stringify(body) }; }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const hmac = event.headers['x-shopify-hmac-sha256'] || event.headers['X-Shopify-Hmac-Sha256'];
  const topic = event.headers['x-shopify-topic'] || event.headers['X-Shopify-Topic'];

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!verifyShopifyHmac(rawBody, hmac, secret)) {
    console.warn('[shopify-webhook] HMAC verification failed', { topic });
    return fail(401, { error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody || '{}'); }
  catch { return fail(400, { error: 'Invalid JSON' }); }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (topic === 'orders/paid') {
      await handleOrderPaid(supabase, payload);
    } else if (topic === 'subscription_contracts/update') {
      await handleContractUpdate(supabase, payload);
    } else if (topic === 'subscription_contracts/cancel') {
      await handleContractCancel(supabase, payload);
    } else {
      console.warn('[shopify-webhook] unhandled topic:', topic);
    }
    return ok({ received: true });
  } catch (err) {
    console.error('[shopify-webhook] handler error', { topic, error: err?.message, stack: err?.stack });
    // Return 200 anyway so Shopify doesn't retry indefinitely on bugs in our code.
    return ok({ received: true, error: err?.message });
  }
};

function userIdFromAttrs(arr) {
  if (!Array.isArray(arr)) return null;
  const m = arr.find((a) => a && (a.name === 'supabase_user_id' || a.key === 'supabase_user_id'));
  return m ? (m.value || null) : null;
}

async function findProfile(supabase, { userId, email, customerId }) {
  if (userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) return data;
  }
  if (customerId) {
    const { data } = await supabase.from('profiles').select('*').eq('shopify_customer_id', String(customerId)).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function handleOrderPaid(supabase, order) {
  const targetVariantId = process.env.SHOPIFY_SCHEDULER_VARIANT_ID;
  const lineItems = order?.line_items || [];
  const relevant = lineItems.find((li) => String(li.variant_id) === String(targetVariantId));
  if (!relevant) {
    console.log('[shopify-webhook] orders/paid — no scheduler line item, skipping');
    return;
  }

  const userId = userIdFromAttrs(order.note_attributes);
  const email = (order.email || order?.customer?.email || '').toLowerCase() || null;
  const customerId = order?.customer?.id || null;

  const profile = await findProfile(supabase, { userId, email, customerId });
  if (!profile) {
    console.warn('[shopify-webhook] orders/paid — no matching profile', { userId, email, customerId });
    return;
  }

  // subscription_contracts[] is populated when using Shopify Subscriptions app
  const subscriptionContractId = (order.subscription_contracts || [])[0]?.id ?? null;

  await supabase.from('profiles').update({
    subscription_status: 'active',
    subscription_ends_at: null,
    shopify_customer_id: customerId ? String(customerId) : profile.shopify_customer_id,
    shopify_subscription_id: subscriptionContractId ? String(subscriptionContractId) : profile.shopify_subscription_id,
    subscription_updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  console.log('[shopify-webhook] activated', { profileId: profile.id, customerId, subscriptionContractId });
}

async function handleContractUpdate(supabase, payload) {
  // Shopify sends { admin_graphql_api_id, id, status, next_billing_date, ... }
  const status = String(payload.status || '').toLowerCase();
  const mapped = status === 'active' ? 'active' : (status === 'past_due' || status === 'failed') ? 'past_due' : null;
  if (!mapped) {
    console.log('[shopify-webhook] contract/update — unmapped status, skipping:', status);
    return;
  }

  const customerId = payload?.customer_id || payload?.customer?.id || null;
  const subscriptionId = payload?.id ? String(payload.id) : null;

  const profile = await findProfile(supabase, { customerId, userId: null, email: null });
  if (!profile) {
    console.warn('[shopify-webhook] contract/update — no matching profile', { customerId, subscriptionId });
    return;
  }

  await supabase.from('profiles').update({
    subscription_status: mapped,
    subscription_ends_at: null,
    shopify_subscription_id: subscriptionId || profile.shopify_subscription_id,
    subscription_updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  console.log('[shopify-webhook] contract/update applied', { profileId: profile.id, mapped });
}

async function handleContractCancel(supabase, payload) {
  const customerId = payload?.customer_id || payload?.customer?.id || null;
  const subscriptionId = payload?.id ? String(payload.id) : null;
  // Shopify provides either `next_billing_date` or `ends_at` depending on contract shape.
  const endsAt = payload?.next_billing_date || payload?.ends_at || new Date().toISOString();

  const profile = await findProfile(supabase, { customerId, userId: null, email: null });
  if (!profile) {
    console.warn('[shopify-webhook] contract/cancel — no matching profile', { customerId, subscriptionId });
    return;
  }

  await supabase.from('profiles').update({
    subscription_status: 'cancelled',
    subscription_ends_at: endsAt,
    shopify_subscription_id: subscriptionId || profile.shopify_subscription_id,
    subscription_updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  console.log('[shopify-webhook] contract/cancel applied', { profileId: profile.id, endsAt });
}
```

- [ ] **Step 2: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./shopify-subscription-webhook.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'handler' ]`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/shopify-subscription-webhook.js
git commit -m "feat(shopify): subscription webhook handler (3 topics, HMAC verified)"
```

---

## Task 5: Checkout URL endpoint

**Files:**
- Create: `netlify/functions/subscription-checkout-url.js`

- [ ] **Step 1: Create the function**

Create `netlify/functions/subscription-checkout-url.js` with EXACTLY:

```js
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) };
  }
  const token = auth.slice(7);

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const variantId = process.env.SHOPIFY_SCHEDULER_VARIANT_ID;
  const sellingPlanId = process.env.SHOPIFY_SCHEDULER_SELLING_PLAN_ID;

  if (!domain || !variantId || !sellingPlanId) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: 'Shopify env vars missing on server' }),
    };
  }

  const params = new URLSearchParams({
    selling_plan: sellingPlanId,
    'checkout[email]': user.email || '',
    'attributes[supabase_user_id]': user.id,
  });
  const url = `https://${domain}/cart/${variantId}:1?${params.toString()}`;

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ url }) };
};
```

- [ ] **Step 2: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./subscription-checkout-url.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'handler' ]`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/subscription-checkout-url.js
git commit -m "feat(shopify): auth'd checkout-URL endpoint"
```

---

## Task 6: One-shot webhook registration function

**Files:**
- Create: `netlify/functions/setup-shopify-webhooks.js`

- [ ] **Step 1: Create the function**

Create `netlify/functions/setup-shopify-webhooks.js` with EXACTLY:

```js
// One-shot admin-only function: registers the three Shopify webhooks we need.
// Invoke with: GET /.netlify/functions/setup-shopify-webhooks?setup_key=<SHOPIFY_WEBHOOK_SECRET>
// Returns the list of webhooks that exist after the call.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const TOPICS = [
  'orders/paid',
  'subscription_contracts/update',
  'subscription_contracts/cancel',
];

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const setupKey = event.queryStringParameters?.setup_key;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || setupKey !== secret) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';
  const callback = `${process.env.MAIN_APP_URL}/.netlify/functions/shopify-subscription-webhook`;

  if (!domain || !adminToken) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_TOKEN' }) };
  }

  async function shopifyApi(path, init = {}) {
    const res = await fetch(`https://${domain}/admin/api/${apiVersion}${path}`, {
      ...init,
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!res.ok) throw Object.assign(new Error(`Shopify API ${path} -> ${res.status}`), { body });
    return body;
  }

  const results = [];

  // List existing webhooks
  const existing = (await shopifyApi('/webhooks.json'))?.webhooks || [];

  for (const topic of TOPICS) {
    const already = existing.find((w) => w.topic === topic && w.address === callback);
    if (already) {
      results.push({ topic, status: 'exists', id: already.id });
      continue;
    }

    try {
      const created = await shopifyApi('/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({ webhook: { topic, address: callback, format: 'json' } }),
      });
      results.push({ topic, status: 'created', id: created?.webhook?.id });
    } catch (err) {
      results.push({ topic, status: 'error', error: err?.message, body: err?.body });
    }
  }

  const after = (await shopifyApi('/webhooks.json'))?.webhooks || [];
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ callback, results, webhooks: after.map((w) => ({ id: w.id, topic: w.topic, address: w.address })) }, null, 2),
  };
};
```

- [ ] **Step 2: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./setup-shopify-webhooks.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'handler' ]`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/setup-shopify-webhooks.js
git commit -m "feat(shopify): one-shot webhook registration function"
```

---

## Task 7: Update `scheduler-config` to use new gating rule

**Files:**
- Modify: `netlify/functions/scheduler-config.js`

- [ ] **Step 1: Read the current file**

Read `netlify/functions/scheduler-config.js` in full before editing.

- [ ] **Step 2: Apply two edits**

**Edit 1** — add import at the top (after existing imports):

Find:
```js
import { createClient } from '@supabase/supabase-js';
```

Add immediately after:
```js
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';
```

**Edit 2** — change the profile fetch + gating check. Find this block:

```js
  const { data: profile } = await supabase
    .from('profiles')
    .select('scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!profile?.scheduler_enabled) return disabled();
```

Replace with:
```js
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!isEffectiveSchedulerActive(profile)) return disabled();
```

- [ ] **Step 3: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./scheduler-config.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'handler' ]`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/scheduler-config.js
git commit -m "feat(scheduler-config): use isEffectiveSchedulerActive for gating"
```

---

## Task 8: Extend AuthContext to load subscription fields

**Files:**
- Modify: `src/lib/AuthContext.jsx`

- [ ] **Step 1: Read the current file**

Read `src/lib/AuthContext.jsx` in full before editing. Locate the `refreshProfile` function (around the bottom of the provider).

- [ ] **Step 2: Extend the profile select**

Find this block inside `refreshProfile`:

```jsx
  const { data } = await supabase
    .from('profiles')
    .select('id, email, is_super_admin, scheduler_enabled')
    .eq('id', session.user.id)
    .maybeSingle();
```

Replace with:

```jsx
  const { data } = await supabase
    .from('profiles')
    .select('id, email, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, shopify_customer_id')
    .eq('id', session.user.id)
    .maybeSingle();
```

- [ ] **Step 3: Build check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/AuthContext.jsx
git commit -m "feat(auth): include subscription fields in profile load"
```

---

## Task 9: SubscribeGate component + BookingsPage integration

**Files:**
- Create: `src/components/dashboard/bookings-page/SubscribeGate.jsx`
- Modify: `src/components/dashboard/bookings-page/BookingsPage.jsx`

- [ ] **Step 1: Create the gate component**

Create `src/components/dashboard/bookings-page/SubscribeGate.jsx` with EXACTLY:

```jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { isEffectiveSchedulerActive } from '../../../lib/subscriptionGating.js';

export default function SubscribeGate({ profile, children, onExit }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const active = isEffectiveSchedulerActive(profile);
  const pastDue = profile?.subscription_status === 'past_due';

  if (active) return children;

  async function subscribe() {
    setBusy(true); setErr(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/.netlify/functions/subscription-checkout-url', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || 'Could not build checkout URL');
      window.open(body.url, '_blank', 'noopener');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a]">Bookings</h1>
        {onExit && <button onClick={onExit} className="text-sm text-gray-500 hover:text-[#1a1a1a]">← Back</button>}
      </header>

      <main className="max-w-xl mx-auto px-6 py-12">
        {pastDue && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your subscription has a payment issue. <a className="font-semibold underline hover:no-underline" href="https://account.shopify.com" target="_blank" rel="noreferrer">Update your payment method →</a>
          </div>
        )}

        <div className="rounded-2xl border border-black/[0.07] bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-black text-[#1a1a1a] mb-2">Enable bookings for your site</h2>
          <p className="text-gray-600 mb-6">
            Customers can request appointments right from your website — calendar, services,
            availability, and confirmation emails. All managed from this dashboard.
          </p>
          <div className="text-4xl font-black text-[#1a1a1a] mb-1">$9.99<span className="text-lg text-gray-500 font-semibold">/month</span></div>
          <p className="text-xs text-gray-500 mb-6">Cancel anytime — manage in your Shopify account.</p>

          <button
            onClick={subscribe}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1a1a1a] text-white font-semibold hover:bg-[#cc0000] transition-colors disabled:opacity-50"
          >
            {busy ? 'Loading…' : 'Subscribe through Shopify →'}
          </button>

          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Wrap BookingsPage content**

Read `src/components/dashboard/bookings-page/BookingsPage.jsx`. Locate the component definition and its returned JSX.

Add an import at the top:
```jsx
import SubscribeGate from './SubscribeGate.jsx';
```

Accept the profile prop and wrap the returned JSX. The current signature looks like:
```jsx
export default function BookingsPage({ userId, onExit }) {
```

Change to:
```jsx
export default function BookingsPage({ userId, profile, onExit }) {
```

Wrap the entire returned tree. Find the final `return (` in the component and change it from:

```jsx
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      ...existing header + main...
    </div>
  );
```

To:

```jsx
  return (
    <SubscribeGate profile={profile} onExit={onExit}>
      <div className="min-h-screen bg-[#faf9f7]">
        ...existing header + main... (UNCHANGED)
      </div>
    </SubscribeGate>
  );
```

The `SubscribeGate` passes `onExit` through for the upgrade-card back button.

- [ ] **Step 3: Pass `profile` from `App.jsx`**

Read `src/App.jsx`. Find the `if (view === 'bookings-page')` branch:

```jsx
if (view === 'bookings-page') {
  return <BookingsPage userId={session?.user?.id} onExit={() => setView('dashboard')} />;
}
```

Change to:

```jsx
if (view === 'bookings-page') {
  return <BookingsPage userId={session?.user?.id} profile={profile} onExit={() => setView('dashboard')} />;
}
```

- [ ] **Step 4: Build check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/bookings-page/SubscribeGate.jsx \
        src/components/dashboard/bookings-page/BookingsPage.jsx \
        src/App.jsx
git commit -m "feat(bookings): SubscribeGate upgrade card wraps BookingsPage"
```

---

## Task 10: Smoke-test doc update

**Files:**
- Modify: `docs/superpowers/smoke-tests/scheduler.md`

- [ ] **Step 1: Append subscription-gating checklist**

Append the following block to the end of `docs/superpowers/smoke-tests/scheduler.md` (don't modify existing content):

```markdown

---

## Shopify Subscriptions gate

### Setup
- [ ] Migration `20260422_shopify_subscriptions.sql` applied.
- [ ] Netlify env vars set on autosite-builder: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_API_VERSION`, `SHOPIFY_SCHEDULER_VARIANT_ID=46224674816188`, `SHOPIFY_SCHEDULER_SELLING_PLAN_ID=1833992380`.
- [ ] Webhooks registered: invoke `GET /.netlify/functions/setup-shopify-webhooks?setup_key=<SHOPIFY_WEBHOOK_SECRET>` once and confirm JSON response lists all 3 topics bound to our URL.
- [ ] Verify in Shopify admin → Settings → Notifications → Webhooks that `orders/paid`, `subscription_contracts/update`, `subscription_contracts/cancel` all point to `https://sitebuilder.autocaregenius.com/.netlify/functions/shopify-subscription-webhook`.

### Happy path (new subscriber)
- [ ] Sign in as a non-admin test account with `scheduler_enabled=false` and `subscription_status='inactive'`.
- [ ] Navigate to Bookings → see the "Enable bookings for your site" upgrade card, NOT the Schedule/Settings tabs.
- [ ] Click "Subscribe through Shopify →" → new tab opens on Shopify checkout with email pre-filled.
- [ ] Complete checkout using a Shopify test card.
- [ ] Within a few seconds (webhook latency), refresh our Bookings page → Schedule/Settings tabs render.
- [ ] In Supabase, the user's row shows `subscription_status='active'`, `shopify_customer_id`, `shopify_subscription_id` populated.

### Super admin bypass
- [ ] Sign in as super admin → Bookings tab shows Schedule/Settings immediately, no gate, regardless of subscription_status.

### Cancellation
- [ ] Customer cancels in Shopify account → webhook fires → profile shows `subscription_status='cancelled'`, `subscription_ends_at` set.
- [ ] Bookings page still renders Schedule/Settings until `subscription_ends_at` passes.
- [ ] After `subscription_ends_at`, upgrade card returns on page reload.

### Past-due
- [ ] Force a failed charge in Shopify → `subscription_status='past_due'` → upgrade card shows with payment-issue banner at top.

### HMAC safety
- [ ] `curl -X POST .../shopify-subscription-webhook -d '{"x":1}'` (no HMAC header) returns 401.
- [ ] Bad HMAC returns 401.
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add docs/superpowers/smoke-tests/scheduler.md
git commit -m "docs: smoke-test checklist for Shopify subscription gate"
```

---

## Self-review

**1. Spec coverage:**
- Migration: ✅ Task 1
- HMAC helper: ✅ Task 2
- Gating rule (server + client): ✅ Task 3
- Webhook handler (3 topics, HMAC verify, user mapping): ✅ Task 4
- Checkout URL endpoint: ✅ Task 5
- Webhook registration: ✅ Task 6
- `scheduler-config` gating swap: ✅ Task 7
- AuthContext profile extension: ✅ Task 8
- `SubscribeGate` + `BookingsPage` integration: ✅ Task 9
- Smoke tests: ✅ Task 10
- Env vars (deferred to controller via Netlify MCP): flagged at the top of the plan; smoke test doc confirms they're set.

**2. Placeholder scan:** No TBDs, no "implement later," every code step shows full code.

**3. Type consistency:**
- `isEffectiveSchedulerActive(profile)` signature identical between Task 3 server file and Task 3 client file; used in Task 7 (server) and Task 9 (client).
- `verifyShopifyHmac(rawBody, hmacHeader, secret)` signature matches between Task 2 definition and Task 4 consumption.
- Subscription status string values `'inactive' | 'active' | 'past_due' | 'cancelled'` consistent between migration CHECK (Task 1), gating helper (Task 3), and webhook handler (Task 4).
- Env var names consistent: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_API_VERSION`, `SHOPIFY_SCHEDULER_VARIANT_ID`, `SHOPIFY_SCHEDULER_SELLING_PLAN_ID` — same in Tasks 4, 5, 6, 10.
- Webhook callback URL same in Task 6 and Task 10.
