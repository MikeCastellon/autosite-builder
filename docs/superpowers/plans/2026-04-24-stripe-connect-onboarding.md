# Stripe Connect Express Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every Pro subscriber connect a Stripe Connect Express account to their Genius Websites profile through a branded, in-dashboard onboarding experience powered by Stripe Connect Embedded Components. Once connected, their Stripe account id + capability flags are synced to `profiles` so downstream plans (bookings deposits, charge-customer Payment Links) can create charges on their behalf.

**Architecture:** The onboarding UI lives INSIDE our dashboard — not on `connect.stripe.com`. Server creates a Stripe Connect Express account (controller API) the first time a user visits `/dashboard/payments`, and generates a short-lived AccountSession client_secret per load. The React page renders `<ConnectAccountOnboarding />` from `@stripe/react-connect-js`, styled to the ProHub brand via the Connect `appearance` variables. A new `account.updated` branch in the existing `stripe-webhook` function syncs `charges_enabled`, `payouts_enabled`, and `details_submitted` to `profiles`. Access is gated by the existing `SubscribeGate` (Pro only). No payment processing happens in this plan — this plan ONLY gets accounts onboarded.

**Tech Stack:** Supabase (Postgres + RLS), Netlify Functions (Node), `stripe` Node SDK (already installed in Plan A), `@stripe/connect-js` + `@stripe/react-connect-js` (new), React 19, Tailwind, vitest for unit tests on the new webhook branch and design-token accessors.

**Depends on:** Plan A (Stripe Subscriptions) — uses the existing `getStripe()` singleton, `stripe-webhook` function, and Pro gating (`isEffectiveSchedulerActive`). Profile rows must have `subscription_status='active'` or be a super admin to access the Connect flow.

**Out of scope (handled in later plans):**
- Creating Checkout Sessions or PaymentIntents on connected accounts (Plan D: Booking deposits, Plan C: Charge-customer Payment Links).
- The $2 application fee — configured per-charge in Plans C/D, not at onboarding time.
- Tap-to-Pay / Terminal — businesses use the Stripe Dashboard mobile app (zero engineering).

**Existing facts locked in (from master + Plan A):**
- `profiles` already has `stripe_customer_id`, `stripe_subscription_id` (Plan A added).
- Tailwind config is bare (`theme: { extend: {} }`). Global CLAUDE.md REQUIRES a design token file before any new UI work — this plan establishes one.
- Font in use: `Outfit` (imported in `src/index.css`). Ad-hoc brand red: `#cc0000`. Ink: `#1a1a1a`. Sharp corners (`rounded-none` or very small radius). These become the "ProHub v1" tokens.
- Routing pattern: `src/App.jsx` uses a `view` state variable (`'dashboard' | 'bookings-page' | ...`), NOT react-router. All page components receive nav callbacks (`onOpenBookings`, `onOpenCustomers`, etc.) from App. Add a new view `'payments-connect'` the same way.
- `AppHeader` takes an `active` prop and nav callbacks — it's the single source for the nav bar across all dashboard pages.
- `SubscribeGate.jsx` wraps page children with the paywall. It's pattern-matched for new Pro-only pages.
- `stripe-webhook.js` already dispatches on `event.type` — add a new `case 'account.updated'` branch.
- Netlify function style: each function creates its own Supabase admin client inline; authenticates callers via `Authorization: Bearer <access_token>` from the Supabase session.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/design-tokens.js` | ProHub v1 brand tokens — colors, font families, radius, shadows, transitions. Single source for tokens. Mirrored in `tailwind.config.js`. |
| `tailwind.config.js` (modify) | Extend theme with brand tokens so `bg-brand-red`, `text-ink`, `font-outfit`, `rounded-token-sm`, etc. work. |
| `db/migrations/20260424_stripe_connect.sql` | Adds Connect columns to `profiles`: `stripe_connect_account_id`, `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`, `stripe_connect_details_submitted`, `stripe_connect_updated_at`. |
| `netlify/functions/connect-account-create.js` | Auth'd POST. Creates a Stripe Connect Express account if the caller's profile doesn't have one, saves `stripe_connect_account_id`, returns `{ account_id }`. Idempotent. |
| `netlify/functions/connect-account-session.js` | Auth'd POST. Creates a Stripe AccountSession for the caller's Connect account (account_onboarding component), returns `{ client_secret }`. |
| `netlify/functions/_lib/stripe-connect-handler.js` | Pure function `handleAccountUpdated(event, { db })` that syncs Connect capability columns to `profiles`. Unit-tested with a fake DB. |
| `tests/functions/stripe-connect-handler.test.js` | Tests: charges_enabled/payouts_enabled/details_submitted sync; metadata lookup by `supabase_user_id`. |
| `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx` | New dashboard page. Renders `<ConnectAccountOnboarding />` inside our shell. Uses `SubscribeGate` for Pro gating. |
| `src/components/dashboard/payments-connect/ConnectStatusBadge.jsx` | Small pill component showing "Not connected" / "Setup incomplete" / "Connected" based on flags. |
| `src/lib/stripeConnect.js` | Client helpers: `createConnectAccount()`, `fetchAccountSession()` — both wrap the new Netlify function calls with auth. |

### Modified files

| Path | Change |
|---|---|
| `netlify/functions/stripe-webhook.js` | Add `case 'account.updated'` that calls `handleAccountUpdated`. |
| `src/App.jsx` | Add `'payments-connect'` to `view` state; import and render `PaymentsConnectPage`; add `onOpenPaymentsConnect` callback threading to all pages. |
| `src/components/ui/AppHeader.jsx` | Add a "Payments" nav entry pointing at the new view. Accepts new `onOpenPaymentsConnect` prop + `active='payments-connect'`. |
| `src/components/dashboard/DashboardPage.jsx` | Accept + thread `onOpenPaymentsConnect` prop. |
| `src/components/dashboard/bookings-page/BookingsPage.jsx` | Accept + thread `onOpenPaymentsConnect` prop (headerProps). |
| `src/components/dashboard/customers-page/CustomersPage.jsx` | Accept + thread `onOpenPaymentsConnect` prop. (Also `CustomerDetailPage.jsx` if it renders AppHeader.) |
| `src/components/dashboard/booking-settings/BookingSettingsPage.jsx` | Accept + thread `onOpenPaymentsConnect` prop. |
| `src/components/profile/ProfilePage.jsx` | Accept + thread `onOpenPaymentsConnect` prop. |
| `src/components/admin/AdminPage.jsx` | Accept + thread `onOpenPaymentsConnect` prop (if it renders AppHeader). |
| `.env.example` | Add `VITE_STRIPE_PUBLISHABLE_KEY` placeholder. |

### Assets (user provides)

| Path | Responsibility |
|---|---|
| `public/logos/genius-websites.svg` (OR `.png`) | User-provided brand logo. Referenced by `AppHeader` already; this plan doesn't change how the logo is loaded — just confirms where it lives. If absent, the nav falls back to text-only. |

---

## Env Vars

**New** in Netlify (branch-deploy context for now; production at go-live) and `.env`:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...           # new — client loads Connect SDK with this
```

**Already present** from Plan A (no changes needed):
- `STRIPE_SECRET_KEY` — used by the new endpoints.
- `STRIPE_WEBHOOK_SECRET` — unchanged (same webhook endpoint, new branch).
- `APP_URL` — unchanged.

User action: grab `pk_test_...` from Stripe dashboard → Developers → API keys → Publishable key, paste into Netlify env.

---

## Task 1: ProHub design tokens

**Files:**
- Create: `src/design-tokens.js`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Write the token file**

```javascript
// src/design-tokens.js
// ProHub v1 — brand tokens for the Genius Websites app.
// Established 2026-04-24. Direction: bold red (#cc0000) on near-black
// ink (#1a1a1a) and warm neutral surface (#faf9f7). Outfit sans for
// everything. Sharp-to-barely-rounded corners. Subtle shadows, fast
// transitions. Mirror these values in tailwind.config.js.
export const tokens = {
  color: {
    brand: {
      red: '#cc0000',
      redHover: '#b30000',
      redFaint: '#fff5f5',
    },
    ink: {
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
      tertiary: '#888888',
    },
    surface: {
      primary: '#ffffff',
      secondary: '#faf9f7',
      tertiary: '#f4f3f0',
    },
    border: {
      soft: 'rgba(0,0,0,0.07)',
      default: 'rgba(0,0,0,0.12)',
      strong: 'rgba(0,0,0,0.25)',
    },
    status: {
      success: '#0a8f3d',
      successFaint: '#e8f5ec',
      warning: '#b37400',
      warningFaint: '#fff7e6',
      danger: '#cc0000',
      dangerFaint: '#fff5f5',
    },
  },
  font: {
    sans: "'Outfit', system-ui, -apple-system, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0,0,0,0.04)',
    md: '0 4px 12px -2px rgba(0,0,0,0.08)',
    lg: '0 12px 32px -4px rgba(0,0,0,0.12)',
  },
  transition: {
    fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '320ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  layout: {
    maxContent: '1280px',
    headerHeight: '64px',
  },
};

// Connect Embedded Components appearance config derived from the tokens.
// Passed to loadConnectAndInitialize({ appearance: connectAppearance }).
export const connectAppearance = {
  overlays: 'dialog',
  variables: {
    colorPrimary: tokens.color.brand.red,
    colorBackground: tokens.color.surface.primary,
    colorText: tokens.color.ink.primary,
    colorDanger: tokens.color.status.danger,
    fontFamily: tokens.font.sans,
    borderRadius: tokens.radius.sm,
    spacingUnit: '6px',
  },
};
```

- [ ] **Step 2: Extend `tailwind.config.js`**

Replace the whole file with:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'brand-red': '#cc0000',
        'brand-red-hover': '#b30000',
        'brand-red-faint': '#fff5f5',
        ink: {
          DEFAULT: '#1a1a1a',
          primary: '#1a1a1a',
          secondary: '#4a4a4a',
          tertiary: '#888888',
        },
        surface: {
          DEFAULT: '#ffffff',
          primary: '#ffffff',
          secondary: '#faf9f7',
          tertiary: '#f4f3f0',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'token-sm': '4px',
        'token-md': '8px',
        'token-lg': '12px',
        'token-xl': '16px',
      },
      boxShadow: {
        'token-sm': '0 1px 2px 0 rgba(0,0,0,0.04)',
        'token-md': '0 4px 12px -2px rgba(0,0,0,0.08)',
        'token-lg': '0 12px 32px -4px rgba(0,0,0,0.12)',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds. (Existing components still use ad-hoc colors like `bg-red-600` — those keep working; we're only *adding* utility classes, not removing anything.)

- [ ] **Step 4: Commit**

```bash
git add src/design-tokens.js tailwind.config.js
git commit -m "feat(brand): ProHub v1 design tokens

Establishes src/design-tokens.js as the single source of truth for
brand colors, typography, radius, shadows, and transitions. Extends
tailwind theme so utility classes like bg-brand-red / font-outfit /
rounded-token-sm work everywhere. Mirrors the Connect Embedded
Components appearance config so the onboarding UI picks up the same
look. Existing ad-hoc usages keep working untouched — migration to
tokens is opportunistic, not forced."
```

---

## Task 2: Migration — Connect columns on profiles

**Files:**
- Create: `db/migrations/20260424_stripe_connect.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Stripe Connect Express — add capability tracking columns on profiles.
-- The existing stripe_* columns (from 20260424_stripe_subscriptions) stay
-- untouched; these are the business-side account (not the platform sub).
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_charges_enabled boolean not null default false,
  add column if not exists stripe_connect_payouts_enabled boolean not null default false,
  add column if not exists stripe_connect_details_submitted boolean not null default false,
  add column if not exists stripe_connect_updated_at timestamptz;

create unique index if not exists profiles_stripe_connect_account_id_idx
  on public.profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

commit;
```

- [ ] **Step 2: Apply in Supabase SQL editor**

Paste the file contents into the Supabase SQL editor. Do NOT run automated migrations — this project applies SQL manually. Confirm the five new columns appear on `public.profiles` with defaults matching the SQL.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/20260424_stripe_connect.sql
git commit -m "feat(stripe-connect): add connect account columns to profiles"
```

---

## Task 3: Install Connect SDKs

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install at project root (client-side packages only; server uses the existing stripe SDK from Plan A)**

```bash
npm install --save @stripe/connect-js @stripe/react-connect-js
```

- [ ] **Step 2: Verify install**

Run: `node -e "console.log('connect-js:', !!require.resolve('@stripe/connect-js'), 'react-connect-js:', !!require.resolve('@stripe/react-connect-js'))"`
Expected: both `true`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(stripe-connect): install @stripe/connect-js + @stripe/react-connect-js"
```

---

## Task 4: Webhook handler for account.updated (pure, DB-injected)

**Files:**
- Create: `netlify/functions/_lib/stripe-connect-handler.js`
- Create: `tests/functions/stripe-connect-handler.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/functions/stripe-connect-handler.test.js
import { describe, it, expect } from 'vitest';
import { handleAccountUpdated } from '../../netlify/functions/_lib/stripe-connect-handler.js';

// Fake Supabase: records every .update(...).eq(...) call.
function fakeDb() {
  const calls = [];
  return {
    _calls: calls,
    from: (table) => ({
      _table: table,
      update: (data) => ({
        eq: (col, val) => { calls.push({ table, op: 'update', data, col, val }); return Promise.resolve({ error: null }); },
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 'user-uuid-1' }, error: null }),
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

  it('ignores events missing supabase_user_id metadata', async () => {
    const event = {
      type: 'account.updated',
      data: { object: { id: 'acct_orphan', charges_enabled: true, metadata: {} } },
    };
    const db = fakeDb();
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
    // fakeDb's .select().eq().maybeSingle() always returns user-uuid-1 — that
    // simulates a row with this stripe_connect_account_id being present.
    const db = fakeDb();
    await handleAccountUpdated(event, { db });

    expect(db._calls).toHaveLength(1);
    expect(db._calls[0].val).toBe('user-uuid-1');
    expect(db._calls[0].data.stripe_connect_charges_enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npx vitest run tests/functions/stripe-connect-handler.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handler**

```javascript
// netlify/functions/_lib/stripe-connect-handler.js
// Handles Stripe account.updated events for connected Express accounts.
// Writes charges_enabled / payouts_enabled / details_submitted back to the
// profile so feature-gates in the UI can flip once onboarding completes.
//
// Profile resolution order:
//   1. account.metadata.supabase_user_id — set at account create time.
//   2. Fallback: match on existing profiles.stripe_connect_account_id.
// If neither matches, the event is ignored (orphan / another platform).
export async function handleAccountUpdated(event, { db }) {
  const account = event.data.object;
  if (!account?.id) return;

  let profileId = account.metadata?.supabase_user_id || null;

  if (!profileId) {
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('stripe_connect_account_id', account.id)
      .maybeSingle();
    profileId = profile?.id || null;
  }

  if (!profileId) return;

  await db.from('profiles').update({
    stripe_connect_account_id: account.id,
    stripe_connect_charges_enabled: !!account.charges_enabled,
    stripe_connect_payouts_enabled: !!account.payouts_enabled,
    stripe_connect_details_submitted: !!account.details_submitted,
    stripe_connect_updated_at: new Date(),
  }).eq('id', profileId);
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/functions/stripe-connect-handler.test.js`
Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/stripe-connect-handler.js tests/functions/stripe-connect-handler.test.js
git commit -m "feat(stripe-connect): account.updated handler + tests"
```

---

## Task 5: Wire account.updated into the webhook

**Files:**
- Modify: `netlify/functions/stripe-webhook.js`

- [ ] **Step 1: Add the import and new case**

At the top of `netlify/functions/stripe-webhook.js`, next to the existing event-handler imports, add:

```javascript
import { handleAccountUpdated } from './_lib/stripe-connect-handler.js';
```

Then inside the `switch (stripeEvent.type)` block, next to the other `case` statements, add:

```javascript
case 'account.updated':
  await handleAccountUpdated(stripeEvent, { db });
  break;
```

- [ ] **Step 2: Update the Stripe webhook endpoint to listen for account.updated**

The webhook endpoint was created in Plan A Task 11 (`we_1TPrMUAnU2S5w1v8tuosBolL`). Extend its enabled_events list via the Stripe API:

```bash
curl -u "$STRIPE_SECRET_KEY:" -X POST https://api.stripe.com/v1/webhook_endpoints/we_1TPrMUAnU2S5w1v8tuosBolL \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_succeeded" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=account.updated"
```

Expected: returns the updated webhook endpoint with the new event in `enabled_events`.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/stripe-webhook.js
git commit -m "feat(stripe-connect): route account.updated through stripe-webhook"
```

---

## Task 6: connect-account-create endpoint

**Files:**
- Create: `netlify/functions/connect-account-create.js`

- [ ] **Step 1: Write the endpoint**

```javascript
// netlify/functions/connect-account-create.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });
const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  // Pro gate — reuse the same rule as the Bookings paywall.
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, stripe_connect_account_id, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return fail(404, { error: 'Profile not found' });
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });

  // Idempotent: if an account already exists, return it.
  if (profile.stripe_connect_account_id) {
    return ok({ account_id: profile.stripe_connect_account_id, existing: true });
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    controller: {
      fees: { payer: 'application' },
      losses: { payments: 'application' },
      stripe_dashboard: { type: 'express' },
      requirement_collection: 'stripe',
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    country: 'US',
    email: profile.email || user.email,
    metadata: { supabase_user_id: user.id },
  });

  await db.from('profiles').update({
    stripe_connect_account_id: account.id,
    stripe_connect_updated_at: new Date(),
  }).eq('id', user.id);

  return ok({ account_id: account.id, existing: false });
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/connect-account-create.js
git commit -m "feat(stripe-connect): connect-account-create endpoint

POST /.netlify/functions/connect-account-create. Pro-gated. Creates a
Stripe Connect Express account (controller API) with platform fees +
platform-held liability. Idempotent — returns the existing account id
if one is already attached to the profile."
```

---

## Task 7: connect-account-session endpoint

**Files:**
- Create: `netlify/functions/connect-account-session.js`

- [ ] **Step 1: Write the endpoint**

```javascript
// netlify/functions/connect-account-session.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });
const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  const { data: profile } = await db
    .from('profiles')
    .select('id, stripe_connect_account_id, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return fail(404, { error: 'Profile not found' });
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });
  if (!profile.stripe_connect_account_id) return fail(400, { error: 'Connect account not yet created' });

  const stripe = getStripe();
  const session = await stripe.accountSessions.create({
    account: profile.stripe_connect_account_id,
    components: {
      account_onboarding: {
        enabled: true,
        features: { external_account_collection: true },
      },
    },
  });

  return ok({ client_secret: session.client_secret });
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/connect-account-session.js
git commit -m "feat(stripe-connect): connect-account-session endpoint

POST /.netlify/functions/connect-account-session. Pro-gated. Returns
a short-lived AccountSession client_secret scoped to the caller's
Connect account and the account_onboarding component only."
```

---

## Task 8: Client helper module

**Files:**
- Create: `src/lib/stripeConnect.js`

- [ ] **Step 1: Write the helpers**

```javascript
// src/lib/stripeConnect.js
import { supabase } from './supabase.js';

async function authedFetch(path, opts = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetch(path, {
    method: opts.method || 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// Creates the Connect account if the profile doesn't have one yet.
// Idempotent — safe to call on every page load.
export async function createConnectAccount() {
  return authedFetch('/.netlify/functions/connect-account-create');
}

// Returns a fresh AccountSession client_secret for the embedded onboarding.
// Call this every time the onboarding UI needs to mount — client_secrets
// are short-lived.
export async function fetchAccountSession() {
  return authedFetch('/.netlify/functions/connect-account-session');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stripeConnect.js
git commit -m "feat(stripe-connect): client helpers for connect flow"
```

---

## Task 9: ConnectStatusBadge component

**Files:**
- Create: `src/components/dashboard/payments-connect/ConnectStatusBadge.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/components/dashboard/payments-connect/ConnectStatusBadge.jsx
// Small pill for "Not connected" / "Setup incomplete" / "Connected" shown in
// the dashboard card and payments page header.
export default function ConnectStatusBadge({ profile }) {
  const id = profile?.stripe_connect_account_id;
  const charges = !!profile?.stripe_connect_charges_enabled;
  const payouts = !!profile?.stripe_connect_payouts_enabled;
  const submitted = !!profile?.stripe_connect_details_submitted;

  if (!id) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-token-sm px-2 py-0.5 text-xs font-semibold bg-ink-tertiary/10 text-ink-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-tertiary" />
        Not connected
      </span>
    );
  }
  if (charges && payouts && submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-token-sm px-2 py-0.5 text-xs font-semibold bg-[#e8f5ec] text-[#0a8f3d]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0a8f3d]" />
        Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-token-sm px-2 py-0.5 text-xs font-semibold bg-[#fff7e6] text-[#b37400]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#b37400]" />
      Setup incomplete
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/payments-connect/ConnectStatusBadge.jsx
git commit -m "feat(stripe-connect): status badge component"
```

---

## Task 10: PaymentsConnectPage

**Files:**
- Create: `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/components/dashboard/payments-connect/PaymentsConnectPage.jsx
import { useEffect, useRef, useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectComponentsProvider, ConnectAccountOnboarding } from '@stripe/react-connect-js';
import { supabase } from '../../../lib/supabase.js';
import { createConnectAccount, fetchAccountSession } from '../../../lib/stripeConnect.js';
import { connectAppearance } from '../../../design-tokens.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import ConnectStatusBadge from './ConnectStatusBadge.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export default function PaymentsConnectPage({
  userId,
  profile: initialProfile,
  userEmail,
  onExit,
  onOpenBookings,
  onOpenCustomers,
  onOpenAdmin,
  onOpenProfile,
  onOpenPaymentsConnect,
  onSignOut,
}) {
  const headerProps = {
    active: 'payments-connect',
    userEmail,
    profile: initialProfile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect: () => {},
    onSignOut,
  };

  const [profile, setProfile] = useState(initialProfile);
  const [connectInstance, setConnectInstance] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [err, setErr] = useState(null);
  const initRef = useRef(false);

  // One-time: ensure an account exists, then load Connect and fetch a session.
  async function bootstrap() {
    if (initRef.current || bootstrapping) return;
    initRef.current = true;
    setBootstrapping(true);
    setErr(null);
    try {
      if (!PUBLISHABLE_KEY) throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is not set.');
      await createConnectAccount();
      const instance = loadConnectAndInitialize({
        publishableKey: PUBLISHABLE_KEY,
        fetchClientSecret: async () => {
          const { client_secret } = await fetchAccountSession();
          return client_secret;
        },
        appearance: connectAppearance,
      });
      setConnectInstance(instance);
    } catch (e) {
      setErr(e.message || 'Could not start onboarding.');
      initRef.current = false;
    } finally {
      setBootstrapping(false);
    }
  }

  // Refresh profile after the embedded component exits (capabilities may have flipped).
  async function refreshProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data);
  }

  // Poll profile on mount to pick up any webhook updates that happened since
  // the user last loaded the page.
  useEffect(() => {
    if (userId) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const accountId = profile?.stripe_connect_account_id;
  const charges = !!profile?.stripe_connect_charges_enabled;
  const payouts = !!profile?.stripe_connect_payouts_enabled;
  const fullyConnected = accountId && charges && payouts && profile?.stripe_connect_details_submitted;

  return (
    <div className="min-h-screen bg-surface-secondary font-outfit">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={initialProfile}
        heading="Payments is a Pro feature"
        subheading="Connect your Stripe account to take deposits, charge customers, and get paid out."
      >
        <main className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">Payments</h1>
              <p className="text-sm text-ink-secondary mt-1">Connect your Stripe account to accept deposits and charge customers directly from your phone.</p>
            </div>
            <ConnectStatusBadge profile={profile} />
          </div>

          {fullyConnected ? (
            <div className="rounded-token-md border border-black/[0.07] bg-surface-primary p-6 shadow-token-sm">
              <p className="text-sm text-ink-primary">Your Stripe account is connected and ready to take payments.</p>
              <p className="text-xs text-ink-tertiary mt-2">Account ID: <code className="font-mono">{accountId}</code></p>
              <p className="text-sm text-ink-secondary mt-4">Need to update bank info or view payouts? <a className="text-brand-red font-semibold underline hover:no-underline" href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">Open Stripe Dashboard →</a></p>
            </div>
          ) : connectInstance ? (
            <div className="rounded-token-md border border-black/[0.07] bg-surface-primary p-6 shadow-token-sm">
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <ConnectAccountOnboarding
                  onExit={() => { refreshProfile(); }}
                />
              </ConnectComponentsProvider>
            </div>
          ) : (
            <div className="rounded-token-md border border-black/[0.07] bg-surface-primary p-8 shadow-token-sm text-center">
              <p className="text-ink-secondary mb-4">You need a Stripe account to take payments. We'll create one for you and walk through the quick setup.</p>
              {err && <p className="text-sm text-brand-red mb-4">{err}</p>}
              <button
                type="button"
                onClick={bootstrap}
                disabled={bootstrapping}
                className="inline-flex items-center justify-center px-6 py-3 rounded-token-sm bg-brand-red hover:bg-brand-red-hover text-white font-semibold transition-colors disabled:opacity-50"
              >
                {bootstrapping ? 'Starting…' : 'Start Stripe setup'}
              </button>
            </div>
          )}
        </main>
      </SubscribeGate>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/payments-connect/PaymentsConnectPage.jsx
git commit -m "feat(stripe-connect): PaymentsConnectPage with embedded onboarding

Dashboard page at view='payments-connect' that renders
<ConnectAccountOnboarding /> inside our own chrome and branding via
the ProHub design tokens. Pro-gated. Creates the Connect account on
first click, generates fresh AccountSessions for each mount."
```

---

## Task 11: Add Payments nav entry in AppHeader

**Files:**
- Modify: `src/components/ui/AppHeader.jsx`

- [ ] **Step 1: Read the existing AppHeader to see its prop + link pattern**

Run: `cat src/components/ui/AppHeader.jsx | head -100` — understand how existing nav links (Bookings, Customers) are rendered and how `active` drives styling.

- [ ] **Step 2: Add the Payments link**

Add a new nav button next to the existing Bookings/Customers buttons, styled identically, with:
- `onClick={onOpenPaymentsConnect}`
- active styling triggered by `active === 'payments-connect'`
- Label: `Payments`
- Destructure `onOpenPaymentsConnect` from props at the top.

Because AppHeader already varies in structure across desktop/mobile menus, follow the exact pattern used by the existing Bookings link — duplicate it and change the handler + label + active key. Do not restructure AppHeader.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/AppHeader.jsx
git commit -m "feat(stripe-connect): add Payments nav entry in AppHeader"
```

---

## Task 12: Wire PaymentsConnectPage into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import the page**

At the top of `src/App.jsx`, after the other dashboard imports:

```javascript
import PaymentsConnectPage from './components/dashboard/payments-connect/PaymentsConnectPage.jsx';
```

- [ ] **Step 2: Extend the view state comment to include the new view**

Find the `const [view, setView] = useState('dashboard');` line and update its trailing comment to add `'payments-connect'` to the union.

- [ ] **Step 3: Add the nav handler**

Find where other handlers like `onOpenBookings` are threaded to pages. Add:

```javascript
const goPaymentsConnect = useCallback(() => { setView('payments-connect'); }, []);
```

- [ ] **Step 4: Render the new page**

Add a new conditional render branch next to the other page renders:

```jsx
{view === 'payments-connect' && (
  <PaymentsConnectPage
    userId={session.user.id}
    userEmail={session.user.email}
    profile={profile}
    onExit={() => setView('dashboard')}
    onOpenBookings={() => setView('bookings-page')}
    onOpenCustomers={() => setView('customers')}
    onOpenAdmin={() => setView('admin')}
    onOpenProfile={() => setView('profile')}
    onOpenPaymentsConnect={goPaymentsConnect}
    onSignOut={handleSignOut}
  />
)}
```

(Match the exact prop-threading style of existing page renders — copy the nearest one and swap the component + callback.)

- [ ] **Step 5: Thread `onOpenPaymentsConnect` into existing pages' AppHeader**

Every existing page that renders `AppHeader` receives nav callbacks from App and forwards them. Add `onOpenPaymentsConnect={goPaymentsConnect}` to the props list of EACH existing page render in App.jsx:
- DashboardPage
- BookingsPage
- CustomersPage
- CustomerDetailPage
- BookingSettingsPage
- ProfilePage
- AdminPage

Each page component must also accept and forward `onOpenPaymentsConnect` as a prop into its own `headerProps` object. Open each page file and:
1. Add `onOpenPaymentsConnect` to the destructured props.
2. Add `onOpenPaymentsConnect` to the `headerProps` object that feeds `<AppHeader {...headerProps} />`.

Do this for each of the 7 page components listed above. Do NOT modify their behavior — just prop-pass.

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | tail -15`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/dashboard/ src/components/admin/ src/components/profile/
git commit -m "feat(stripe-connect): wire PaymentsConnectPage into App routing

Adds 'payments-connect' view state + renders PaymentsConnectPage when
active. Threads onOpenPaymentsConnect through every page that uses
AppHeader so the nav works from anywhere in the dashboard."
```

---

## Task 13: Stripe dashboard — enable Connect + Embedded Components

**Files:** none (external config)

- [ ] **Step 1: Enable Connect on the platform**

In the Stripe dashboard (test mode first):
1. Go to Connect → Get started.
2. Accept platform terms.
3. Under "Accounts dashboard and onboarding" choose: **Stripe hosts accounts dashboard for your platform users**. (We're using Controller API with `stripe_dashboard.type=express`, so users get the Express dashboard when they log into stripe.com directly — but we're serving onboarding inside our app via Embedded Components.)

- [ ] **Step 2: Enable Embedded Components**

1. Dashboard → Connect → Settings → Embedded Components.
2. Under "Account onboarding", click **Enable**.
3. Set the allowed origins to include the branch deploy URL:
   `https://claude-brave-fermi-5c8e30--autosite-builder.netlify.app`
   And (for production later):
   `https://sitebuilder.autocaregenius.com`

- [ ] **Step 3: Get the publishable key**

1. Dashboard → Developers → API keys → copy the **Publishable key** (`pk_test_...`).
2. Paste into Netlify env var `VITE_STRIPE_PUBLISHABLE_KEY` on the branch-deploy context.

- [ ] **Step 4: Verify the test webhook now includes account.updated**

Already done in Task 5 Step 2 via API. In the dashboard (Developers → Webhooks → the endpoint) confirm `account.updated` appears in the subscribed events list.

- [ ] **Step 5: Update `.env.example`**

In `.env.example`, add below the existing Stripe block:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

- [ ] **Step 6: Commit**

```bash
git add .env.example
git commit -m "docs(stripe-connect): add VITE_STRIPE_PUBLISHABLE_KEY to env example"
```

---

## Task 14: End-to-end test in sandbox

**Files:** none (manual test)

- [ ] **Step 1: Deploy the branch**

Push the branch to origin. Netlify builds a branch deploy at the URL in Task 13 step 2. Wait for it to go live.

- [ ] **Step 2: Prereq — have a Pro test account**

Use the same test user from Plan A Task 12. That account should have `subscription_status='active'` from the Stripe subscription sandbox test. If not, complete Plan A Task 12 first.

- [ ] **Step 3: Happy path — start onboarding**

1. Sign in to the branch deploy.
2. Click **Payments** in the nav.
3. Click **Start Stripe setup**.
4. Expect: the Connect account is created (server call), then the embedded component renders inside our page.
5. Complete the test onboarding (Stripe prefills test data for `country=US` accounts in test mode):
   - Business details: any legit-looking test data.
   - SSN: `000-00-0000` (test-mode placeholder).
   - DOB: any past date where user is >= 18.
   - Bank: routing `110000000`, account `000123456789`.

- [ ] **Step 4: Verify state in DB**

After finishing the onboarding component:
- Supabase `profiles` row for this user should show:
  - `stripe_connect_account_id` populated (`acct_...`)
  - `stripe_connect_charges_enabled` = true
  - `stripe_connect_payouts_enabled` = true (may take a few seconds for Stripe to flip)
  - `stripe_connect_details_submitted` = true
  - `stripe_connect_updated_at` = recent

- [ ] **Step 5: Verify UI**

Reload the Payments page. Expect:
- Status badge shows "Connected" (green).
- The embedded onboarding is replaced with a "Connected" summary card showing the account id and a link to the Stripe dashboard.

- [ ] **Step 6: Verify gating — non-Pro user**

Create/use a non-Pro account. Navigate to `/dashboard` and click Payments in the nav. Expect the `SubscribeGate` paywall overlay instead of the onboarding UI.

- [ ] **Step 7: Commit smoke doc**

Create `docs/superpowers/smoke-tests/stripe-connect.md` with a condensed version of steps 3–6.

```bash
git add docs/superpowers/smoke-tests/stripe-connect.md
git commit -m "docs(stripe-connect): smoke test checklist"
```

---

## Task 15: Go-live checklist

- [ ] All vitest tests pass: `npx vitest run`
- [ ] Sandbox E2E (Task 14) passes on the branch deploy
- [ ] Stripe live-mode: Connect + Embedded Components enabled
- [ ] Stripe live-mode: allowed origins include `https://sitebuilder.autocaregenius.com`
- [ ] Netlify production env vars set: `VITE_STRIPE_PUBLISHABLE_KEY` (live `pk_live_...`)
- [ ] Stripe live webhook endpoint created + secret stored (`STRIPE_WEBHOOK_SECRET` for production), includes `account.updated` in events list
- [ ] Merge branch to master

---

## Follow-up plans (out of scope here)

- `2026-04-24-stripe-booking-deposits.md` — depends on this plan. Adds `deposit_percentage` to scheduler config, creates a Checkout Session on the connected account when a booking is made, $2 application fee via `application_fee_amount`.
- `2026-04-24-stripe-charge-customer.md` — depends on this plan. Dashboard action "Charge $X" that generates a Stripe Payment Link on the connected account.
