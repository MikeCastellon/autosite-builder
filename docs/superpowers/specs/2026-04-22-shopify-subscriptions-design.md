# Shopify Subscriptions — Scheduler Paywall Design

**Date:** 2026-04-22
**Status:** Approved, ready for implementation plan
**Builds on:** [2026-04-22-scheduler-mvp-design.md](2026-04-22-scheduler-mvp-design.md), [2026-04-22-scheduler-v2-design.md](2026-04-22-scheduler-v2-design.md)

## Summary

Gate the scheduler feature behind a $9.99/month Shopify subscription purchased through Shopify's native Subscriptions app. Super admins continue to bypass the gate. Customers subscribe via a Shopify cart permalink, Shopify creates the customer + subscription contract, and a webhook flips our Supabase flag. Cancellation / renewal failure webhooks flip it back.

## Goals

- Monetize the scheduler without building our own billing infrastructure.
- Reuse existing Shopify store (`714f13-92.myshopify.com`) + credentials already present in the org's other projects.
- Keep the dev/admin-override path untouched — super admins don't see paywalls.
- No new SaaS dependencies; all billing, payment methods, cancellation flow live in Shopify.

## Non-goals

- Stripe direct integration.
- Trial period (enable later on the Shopify selling plan without code changes).
- Proration / upgrade/downgrade tiers (single monthly plan only).
- Per-site gating (subscription is account-wide).
- In-app invoice / receipt UI (Shopify customer portal handles it).
- Automatic grace period on `past_due` (immediate disable; can tune later).

## Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Subscription app | Shopify native "Subscriptions" app |
| 2 | Billing cadence | Monthly, day-1 billing, no trial |
| 3 | Price | $9.99/mo (product configured in Shopify; price lives there, not in code) |
| 4 | Gating scope | Account-wide (one subscription per Supabase user) |
| 5 | Identity mapping | `supabase_user_id` embedded as order `note_attribute`; fallback to email match |
| 6 | Super admin bypass | Keep existing — admins never see paywall |
| 7 | Checkout UX | Redirect to Shopify cart permalink (opens Shopify-hosted checkout) |
| 8 | Webhooks | `orders/paid`, `subscription_contracts/update`, `subscription_contracts/cancel` |
| 9 | HMAC verification | Required on all webhooks using `SHOPIFY_WEBHOOK_SECRET` |
| 10 | Past-due behavior | Disable immediately on past_due/cancel; re-activate on next successful payment |

## Data model changes

Single migration adding five columns to `profiles`:

```sql
alter table public.profiles
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists shopify_customer_id text,
  add column if not exists shopify_subscription_id text,
  add column if not exists subscription_updated_at timestamptz;

-- Normalize status values via a CHECK constraint
alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('inactive','active','past_due','cancelled'));

create index if not exists profiles_shopify_customer_id_idx
  on public.profiles (shopify_customer_id)
  where shopify_customer_id is not null;
```

No data backfill needed. Existing `scheduler_enabled` column on `profiles` is **kept and still respected** — super-admin flag + direct DB toggles still work for testing/comp'd accounts. Effective gating becomes:

```
effective_scheduler = is_super_admin
                      OR scheduler_enabled
                      OR subscription_status = 'active'
```

Call this `isEffectiveSchedulerActive(profile)` in both server and client.

## Customer-facing flow

### Happy path (new user)

1. User signs in → Dashboard → clicks **Bookings** top-nav → lands on BookingsPage.
2. `SubscribeGate` checks `isEffectiveSchedulerActive(profile)`.
3. If inactive → page renders an **Upgrade card** instead of tabs:
   ```
   [Heading] Enable bookings for your site
   [Copy]    Customers can request appointments right from your site. $9.99/month.
   [Button]  Subscribe through Shopify →
   ```
4. Click **Subscribe** → opens a new tab to:
   ```
   https://{SHOPIFY_STORE_DOMAIN}/cart/{VARIANT_ID}:1
     ?selling_plan={SELLING_PLAN_ID}
     &checkout[email]={profile.email}
     &attributes[supabase_user_id]={profile.id}
   ```
5. Shopify renders their branded checkout. Email is pre-filled. Customer completes payment.
6. Shopify fires `orders/paid` webhook → our function validates HMAC, pulls `note_attributes[supabase_user_id]`, flips `profiles.subscription_status='active'`, stores customer + subscription ids.
7. User returns to our app (or refreshes) → `SubscribeGate` sees `active` → renders Bookings tabs normally.

### Renewal

- Shopify charges monthly, fires `subscription_contracts/update` with `status: active` → we no-op (already active).

### Payment failure

- Shopify fires `subscription_contracts/update` with `status: past_due` → we set `subscription_status='past_due'`. BookingsPage shows a notice "Your subscription has a payment issue — [Update payment method →]" linking to the Shopify customer portal.
- On successful retry, Shopify sends `status: active` again → we flip back.

### Cancellation

- Customer cancels in Shopify customer portal → Shopify fires `subscription_contracts/cancel` → we set `subscription_status='cancelled'`, `subscription_ends_at` = contract's end date.
- Bookings stays active until `subscription_ends_at` (read-only check in the gate). After that, the upgrade card reappears.

### Re-subscribe after cancellation

- User clicks Subscribe again → fresh checkout → new `orders/paid` → set `subscription_status='active'` with new `shopify_subscription_id`. Same row, same user, just updated.

## Components

### Backend

**`netlify/functions/shopify-subscription-webhook.js`** — single endpoint handling all three topics. Dispatches by `X-Shopify-Topic` header. Uses service-role Supabase client. Returns 200 for valid, 401 for bad HMAC, 200 (log only) for unmappable orders (no supabase_user_id + no email match).

**`netlify/functions/_lib/shopify-hmac.js`** — pure function `verifyShopifyHmac(rawBody, hmacHeader, secret) => boolean`. Uses `crypto.timingSafeEqual` against a base64 HMAC-SHA256. Testable without any Shopify side.

**`netlify/functions/_lib/subscription-gating.js`** — `isEffectiveSchedulerActive({ is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at })` — single source of truth for the gating rule. Imported by `scheduler-config.js`.

### Frontend

**`src/lib/subscriptionGating.js`** — client mirror of the gating rule (same function name, duplicated with a one-line comment "keep in sync with netlify/functions/_lib/subscription-gating.js"). React components import this.

**`src/components/dashboard/bookings-page/SubscribeGate.jsx`** — renders either the children (active) or the upgrade card (inactive). Builds the Shopify cart permalink from three env-sourced values read via a new `/.netlify/functions/subscription-checkout-url?user_id=X` endpoint (so the product/plan IDs stay server-side). Also renders the past_due notice variant.

**`netlify/functions/subscription-checkout-url.js`** — returns `{ url }` for a given user_id. Reads `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_SCHEDULER_VARIANT_ID`, `SHOPIFY_SCHEDULER_SELLING_PLAN_ID` from env, validates the user is authenticated (via Bearer token), composes the permalink, returns it.

### Dashboard integration

**`BookingsPage.jsx`** — wrap current contents in `<SubscribeGate profile={profile}>`. When `is_super_admin=true`, the gate always passes. Schedule and Settings tabs render as today inside the gate.

**`scheduler-config.js`** — change the gating check. Instead of `profile?.scheduler_enabled`, call `isEffectiveSchedulerActive(profile)`. Same for the booking widget script behavior on public sites — site-level `scheduler_enabled` still required; owner-level check becomes the new function.

## Shopify setup (one-time, manual)

Steps the owner performs in the Shopify admin UI:

1. **Install** the "Shopify Subscriptions" app from the Shopify App Store (free).
2. **Create product** "Scheduler — Monthly" with a single variant. Set the price to $9.99.
3. **Create a selling plan** on that product: "$9.99 every 1 month", auto-renew, no trial.
4. **Note** the `variant_id` (numeric) and `selling_plan_id` (numeric) — give me these values.
5. **Register webhooks** pointed at `https://sitebuilder.autocaregenius.com/.netlify/functions/shopify-subscription-webhook` for topics:
   - `orders/paid`
   - `subscription_contracts/update`
   - `subscription_contracts/cancel`

We can script the webhook registration as a one-time Netlify function (admin API call) to avoid manual UI clicks — `netlify/functions/setup-shopify-webhooks.js` — admin-only, invoked once.

## Environment variables (copy from acg-pr-dashboard → autosite-builder)

- `SHOPIFY_STORE_DOMAIN` — `714f13-92.myshopify.com`
- `SHOPIFY_ADMIN_API_TOKEN` — admin API token (used for webhook registration + customer lookups)
- `SHOPIFY_WEBHOOK_SECRET` — HMAC secret
- `SHOPIFY_API_VERSION` — `2026-04`

New vars (to add after Shopify setup):
- `SHOPIFY_SCHEDULER_VARIANT_ID`
- `SHOPIFY_SCHEDULER_SELLING_PLAN_ID`

All scoped to functions + runtime + builds.

## Error handling

| Scenario | Behavior |
|---|---|
| Webhook HMAC mismatch | 401, no DB update, logged with topic + order id (if parseable) |
| Webhook arrives before user exists | 200 response (don't make Shopify retry). Log with `supabase_user_id` or email. Manual reconciliation if it happens (shouldn't — user must be signed in to click Subscribe). |
| Webhook missing `supabase_user_id` attribute | Fallback: match `shopify_customer.email` against `profiles.email`. If match, update. If not, log and 200. |
| Duplicate webhook (Shopify retries) | Idempotent — we upsert by user_id. Same status twice is a no-op. |
| `past_due` → user tries to use Bookings | Gate shows past-due notice with link to `https://{store}.myshopify.com/account` |
| Subscribe-while-active (already subscribed) | Gate never renders the Subscribe button when status is active. Nothing to do. |
| User deletes their Shopify customer somehow | `subscription_contracts/cancel` will fire. We handle it normally. |
| Network error from `subscription-checkout-url` endpoint | Subscribe button shows "Try again" error. No local cache — always fresh URL. |

## Testing plan

### Automated
- **Vitest** for `shopify-hmac.js`: signs a known payload with a known secret, verifies match + mismatch cases, rejects missing header.
- **Vitest** for `subscription-gating.js`: matrix of inputs (is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at) → expected boolean.

### Manual
- Create real `$0.01` test product/plan in Shopify for cheap end-to-end.
- Subscribe as test account → verify webhook → verify `subscription_status='active'` → verify Bookings unlocks.
- Cancel in Shopify customer portal → verify webhook → verify Bookings re-gates after `subscription_ends_at` passes (or immediately if cancelled with immediate effect).
- Force payment failure (test card that declines) → verify `past_due` banner.

## Build order

1. Migration — add columns + CHECK + index to `profiles`.
2. `shopify-hmac.js` helper (TDD, pure function).
3. `subscription-gating.js` on both server and client (same function, duplicated, both with tests in the server version).
4. `shopify-subscription-webhook.js` — HMAC verify, topic dispatch, upsert logic.
5. `scheduler-config.js` — swap gating check to `isEffectiveSchedulerActive`.
6. `subscription-checkout-url.js` — auth'd endpoint, composes permalink.
7. `SubscribeGate.jsx` + `BookingsPage.jsx` integration.
8. `setup-shopify-webhooks.js` one-shot function + invoke it once to register webhooks.
9. Copy env vars to autosite-builder Netlify; add the two new variant/plan ids after user sets up Shopify product.
10. Smoke test doc update.

## What's out of scope / later

- Annual subscription option (would be a second selling plan — trivial addition).
- Multi-site gating (sub-accounts paying for sub-sites).
- Proration on plan change.
- Team seats.
- Custom billing for comp'd enterprise accounts (super-admin toggle already covers this).
- Admin UI showing subscription status next to each account in the admin accounts tab (nice-to-have, add later).
