# Remove 30-Day Trial — Charge Immediately on Pro Upgrade

**Date:** 2026-05-19
**Status:** Approved, ready for implementation plan

## Summary

Stop offering a 30-day free trial on the Pro subscription. New users who upgrade are charged $19.99 on Checkout completion. Existing trialing subscriptions in Stripe are honored — they continue until their original trial end date, then convert to paid as normal.

## Motivation

Trial removed to charge customers immediately on upgrade. Trade-off accepted: signup-to-paid conversion may drop, but revenue per converted user starts on day 1 instead of day 31.

## Scope

### In scope

- Remove `trial_period_days: 30` from the Stripe Checkout session creation
- Update all user-facing copy referencing the trial (landing page, upgrade panel, upgrade funnel)

### Explicitly out of scope

- **No retroactive trial ending.** Stripe Checkout's `trial_period_days` only affects *new* subscriptions. Existing trials in Stripe continue uninterrupted.
- **No removal of `trialing` status handling.** `netlify/functions/_lib/stripe-status-map.js` still maps `trialing → active` so legacy trials keep working until they convert.
- **No removal of `stripe_trial_ends_at` column or admin display.** The column stays; `AdminUserDrawer.jsx` still shows "Trial ends" for users on a legacy trial. Both become inert ~30 days after deploy once the last legacy trial expires.
- **No changes to existing tests.** `tests/functions/stripe-status-map.test.js` and `tests/functions/stripe-event-handlers.test.js` cover the `trialing` code path, which we are keeping.

## Changes

### Backend — 1 line

**`netlify/functions/stripe-checkout-url.js`** (around line 50-53)

Remove the `trial_period_days: 30` line from the `subscription_data` object inside `stripe.checkout.sessions.create(...)`. The rest of `subscription_data` (the `metadata` field) stays.

Before:
```js
subscription_data: {
  trial_period_days: 30,
  metadata: { supabase_user_id: user.id },
},
```

After:
```js
subscription_data: {
  metadata: { supabase_user_id: user.id },
},
```

Stripe Checkout will then charge the payment method on session completion. `checkout.session.completed` webhooks fire as before; `handleCheckoutCompleted` writes the same canonical columns to `profiles` — the only difference is `mapStripeStatus()` sees `status: 'active'` immediately instead of `status: 'trialing'`.

### Frontend copy

#### `src/components/LandingPage.jsx`

| Line | Before | After |
|------|--------|-------|
| ~331 (pricing card badge) | `30 days free — no charge today` | `Cancel anytime — no contract` |
| ~367 (primary CTA button) | `⭐ Start 30-Day Free Trial` | `⭐ Upgrade to Pro — $19.99/month` |
| ~370 (subtext) | `Create your free account · then activate Pro inside the dashboard · cancel anytime.` | unchanged |

#### `src/components/ui/UpgradeProPanel.jsx`

| Line | Before | After |
|------|--------|-------|
| ~103 (CTA button) | `⭐ Start 30-Day Free Trial` | `⭐ Upgrade to Pro — $19.99/month` |
| ~106 (subtext) | `30 days free · then $19.99/month · Cancel anytime.` | `$19.99/month · Cancel anytime · No contract.` |

The loading state on the button (currently `Loading...` when `busy`) stays as-is.

#### `src/components/dashboard/UpgradeFunnel.jsx`

| Line | Before | After |
|------|--------|-------|
| ~30 (small inline button) | `Start Free Trial` | `Upgrade — $19.99/mo` |
| ~240 (funnel intro subtext) | `Scroll through the toolkit. Start free for 30 days — then $19.99/month. Cancel anytime.` | `Scroll through the toolkit. $19.99/month — cancel anytime.` |
| ~267 (closing CTA subtext) | `Try everything free for 30 days — then $19.99/month. Cancel anytime.` | `$19.99/month — cancel anytime, no contract.` |
| ~269 (reassurance micro-line) | `No charge today. No commitment.` | REMOVED (line above covers reassurance) |

**Spacing adjustment:** When line 269 is removed, the `<p>` at line ~267 must change `mb-2` → `mb-6` so the gap before the button matches the original visual rhythm.
| ~278 (closing CTA button) | `Start Free Trial` | `Upgrade to Pro — $19.99/month` |

## Data flow (unchanged)

New signup flow after this change:

1. User clicks `Upgrade to Pro — $19.99/month` → frontend calls `stripe-checkout-url.js`
2. Function creates Stripe Checkout session with the Pro monthly price, no trial
3. User enters payment in Stripe Checkout → completes → card is charged $19.99 immediately
4. Stripe fires `checkout.session.completed` → `handleCheckoutCompleted` looks up profile by `client_reference_id`, writes `subscription_status: 'active'` and other canonical columns
5. `stripe_trial_ends_at` is written as `null` (subscription's `trial_end` is null because there's no trial)

Existing trial-in-progress flow (no change):

1. Webhook fires `customer.subscription.updated` events as before
2. `mapStripeStatus()` sees `status: 'trialing'` and returns `subscription_status: 'active'`, `stripe_trial_ends_at: <date>`
3. When trial converts, Stripe fires `customer.subscription.updated` with `status: 'active'`; mapping flips `stripe_trial_ends_at: null`
4. Admin drawer's "Trial ends" field shows for the duration of the legacy trial, then disappears

## Testing strategy

Manual smoke test post-deploy:

1. As a non-Pro user, click `Upgrade to Pro — $19.99/month` on the landing page
2. Confirm Stripe Checkout loads with no trial copy visible
3. Use a Stripe test card → complete checkout
4. Confirm `profiles.subscription_status` flips to `active` and `stripe_trial_ends_at` is null

Existing tests remain green — we haven't removed any code paths they cover.

## Risks

- **Conversion drop.** Removing a free trial is a known funnel reducer. Watch signup → paid conversion for the first week post-deploy.
- **Existing-trial users.** Should see zero change. If any complaint surfaces ("I thought I had until June..."), check their `stripe_trial_ends_at` — it will still be set, and they will not be charged early.
- **Refund requests.** With charge-on-day-1, expect occasional "I didn't mean to subscribe" tickets. The `Cancel anytime` framing helps but doesn't eliminate. No money-back guarantee was added in this change (see brainstorming decision).

## Deployment

Standard direct-to-master push (per workflow preference). No DB migration, no Stripe config changes, no env var changes. The deploy itself is the rollout.
