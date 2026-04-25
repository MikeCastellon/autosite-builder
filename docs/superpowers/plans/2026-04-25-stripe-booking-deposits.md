# Stripe Booking Deposits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a customer books a service on a Pro business's site, automatically collect a deposit through Stripe Checkout on the business's connected Stripe account. The platform takes a flat $2 application fee per deposit. Owners configure a single global deposit percentage in their booking settings; deposits are skipped silently for any booking where the service has no parseable price OR the business hasn't completed Connect onboarding.

**Architecture:** A new `deposit_percentage` field on `scheduler_config` (0–100, default 0). Services keep their existing free-text `price` field — a small parser extracts the leading numeric value to compute deposit cents. When `create-booking` runs, after the booking row is inserted, if (a) deposit % > 0, (b) service price parses, AND (c) owner has `stripe_connect_charges_enabled=true`, the function creates a Stripe Checkout Session on the connected account (`Stripe-Account` header) with `mode: 'payment'`, `application_fee_amount: 200`, and `client_reference_id: <booking.id>`. The session URL is returned to the public scheduler widget, which redirects the customer to pay. A new webhook branch (`checkout.session.completed` with `mode === 'payment'`) flips the booking to `deposit_status='paid'`. Booking lifecycle (pending → confirmed → completed) is unchanged; deposit status is a parallel column owners can see in the dashboard.

**Tech Stack:** Supabase (Postgres + RLS), Netlify Functions (Node), `stripe` SDK + `Stripe-Account` header for connected-account calls, vitest for unit tests on the deposit math + webhook handler.

**Depends on:** Plan A (subscription gating + `getStripe()` singleton + `stripe-webhook` function) and Plan B (Connect onboarding — `stripe_connect_account_id`, `stripe_connect_charges_enabled` columns).

**Out of scope (future plans):**
- Manual refunds — covered later (refund button on BookingDetailDrawer).
- Charge-customer Payment Links (Plan C — separate flow).
- Per-service deposit overrides — global percentage only for v1.
- Migration of existing service `price` strings to a numeric `price_cents` column — we parse on the fly. Owners with un-parseable prices (e.g., "Call for quote") just won't take deposits on those services. Plan E future.

**Existing facts locked in:**
- `bookings` table exists with status pipeline (pending/confirmed/declined/cancelled/completed) — see `db/migrations/20260422_scheduler_mvp.sql`.
- `scheduler_config` is jsonb on `sites`; loaded/saved via `src/lib/schedulerConfig.js`. Services are entries with shape `{id, name, duration_minutes, price, description, enabled}`.
- `create-booking.js` (Netlify function) inserts the booking, sends owner + customer emails via Postmark, returns `{ ok: true, bookingId }`. We extend its return shape with optional `checkout_url`.
- Public scheduler widget at `public/scheduler.js` POSTs to `create-booking` and shows a confirmation card on success.
- Existing webhook (`stripe-webhook.js`) already handles `checkout.session.completed` for Plan A subscription signups. The new payment-mode branch must coexist via `event.data.object.mode` discrimination.
- The Connect-events Stripe webhook (created in Plan B) is `we_1TPtTEAnU2S5w1v8arrHPj8V` — we extend its enabled_events to include `checkout.session.completed`.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `db/migrations/20260425_booking_deposits.sql` | Adds deposit_* columns to `bookings`. RLS for the new columns inherits the existing booking policies (anon insert, owner select/update). |
| `netlify/functions/_lib/deposit-math.js` | Pure: `parsePriceToCents(priceStr)`, `computeDepositCents(priceCents, percentage)`. Unit-tested. |
| `netlify/functions/_lib/booking-deposit-handler.js` | Pure: `handleBookingCheckoutCompleted(event, { db })` — flips booking row when a payment-mode checkout session completes. Unit-tested. |
| `tests/functions/deposit-math.test.js` | Tests parsing edge cases + deposit math. |
| `tests/functions/booking-deposit-handler.test.js` | Tests for the webhook handler (paid, missing client_reference_id, idempotency). |

### Modified files

| Path | Change |
|---|---|
| `netlify/functions/create-booking.js` | After insert, attempt to create a Checkout Session on the connected account. If created, return `checkout_url` in the response. Always still create the booking row (deposit failure = booking still works without deposit). |
| `netlify/functions/stripe-webhook.js` | In the existing `case 'checkout.session.completed'` branch, route by `event.data.object.mode`: `subscription` → existing `handleCheckoutCompleted`; `payment` → new `handleBookingCheckoutCompleted`. |
| `src/components/dashboard/booking-settings/GeneralTab.jsx` | Add a `Deposit %` numeric input (0–100). Saves to `scheduler_config.deposit_percentage`. |
| `src/lib/schedulerConfig.js` | Default `defaultSchedulerConfig()` returns `deposit_percentage: 0`. |
| `public/scheduler.js` | After successful POST, if response includes `checkout_url`, `window.location.href = url` instead of rendering the confirmation card. The Stripe-hosted checkout page handles the rest; on success Stripe redirects back to a `/booking-confirmed` URL. |
| `src/components/dashboard/bookings/BookingsList.jsx` | Show a small deposit pill on each row (`Deposit pending` / `Deposit paid` / nothing if not required). |
| `src/components/dashboard/bookings/BookingDetailDrawer.jsx` | Show deposit status + amount + paid timestamp in the detail view. |

### Stripe webhook config (external, via API)

- Add `checkout.session.completed` to the Connect webhook's `enabled_events` (`we_1TPtTEAnU2S5w1v8arrHPj8V`).

---

## Task 1: Migration — deposit columns on bookings

**Files:**
- Create: `db/migrations/20260425_booking_deposits.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Booking deposits — Stripe Checkout on connected accounts.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.bookings
  add column if not exists deposit_required_cents int,
  add column if not exists deposit_paid_cents int,
  add column if not exists deposit_status text not null default 'not_required',
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_checkout_session_id text,
  add column if not exists deposit_payment_intent_id text,
  add column if not exists deposit_application_fee_cents int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_deposit_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_deposit_status_check
      check (deposit_status in ('not_required','pending','paid','refunded','failed'));
  end if;
end $$;

create index if not exists bookings_deposit_session_idx
  on public.bookings (deposit_checkout_session_id)
  where deposit_checkout_session_id is not null;

commit;
```

- [ ] **Step 2: Apply** (controller will apply via Supabase MCP).

- [ ] **Step 3: Commit**

```bash
git add db/migrations/20260425_booking_deposits.sql
git commit -m "feat(deposits): add deposit columns to bookings"
```

---

## Task 2: Deposit math helpers + tests

**Files:**
- Create: `netlify/functions/_lib/deposit-math.js`
- Create: `tests/functions/deposit-math.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/functions/deposit-math.test.js
import { describe, it, expect } from 'vitest';
import { parsePriceToCents, computeDepositCents } from '../../netlify/functions/_lib/deposit-math.js';

describe('parsePriceToCents', () => {
  it('plain integer string', () => { expect(parsePriceToCents('99')).toBe(9900); });
  it('with $ prefix', () => { expect(parsePriceToCents('$99')).toBe(9900); });
  it('with decimals', () => { expect(parsePriceToCents('99.50')).toBe(9950); });
  it('with $ and decimals', () => { expect(parsePriceToCents('$199.99')).toBe(19999); });
  it('with whitespace', () => { expect(parsePriceToCents('  $250 ')).toBe(25000); });
  it('with thousands separator', () => { expect(parsePriceToCents('$1,299.00')).toBe(129900); });
  it('returns null for non-numeric', () => { expect(parsePriceToCents('Call for quote')).toBeNull(); });
  it('returns null for empty', () => { expect(parsePriceToCents('')).toBeNull(); });
  it('returns null for null/undefined', () => {
    expect(parsePriceToCents(null)).toBeNull();
    expect(parsePriceToCents(undefined)).toBeNull();
  });
  it('returns null for zero (deposits on free services make no sense)', () => {
    expect(parsePriceToCents('0')).toBeNull();
    expect(parsePriceToCents('$0.00')).toBeNull();
  });
  it('numeric input passes through', () => { expect(parsePriceToCents(99)).toBe(9900); });
});

describe('computeDepositCents', () => {
  it('25% of $99 = $24.75 = 2475', () => { expect(computeDepositCents(9900, 25)).toBe(2475); });
  it('50% of $200 = $100 = 10000', () => { expect(computeDepositCents(20000, 50)).toBe(10000); });
  it('100% = full price', () => { expect(computeDepositCents(9900, 100)).toBe(9900); });
  it('0% = null (no deposit)', () => { expect(computeDepositCents(9900, 0)).toBeNull(); });
  it('null priceCents → null', () => { expect(computeDepositCents(null, 25)).toBeNull(); });
  it('null percentage → null', () => { expect(computeDepositCents(9900, null)).toBeNull(); });
  it('negative percentage → null', () => { expect(computeDepositCents(9900, -10)).toBeNull(); });
  it('over 100 percentage → null', () => { expect(computeDepositCents(9900, 150)).toBeNull(); });
  it('rounds to nearest cent (banker rounding not required)', () => {
    expect(computeDepositCents(333, 33)).toBe(110); // 333 * 0.33 = 109.89 → 110
  });
  it('Stripe minimum check: deposits below 50¢ → null', () => {
    expect(computeDepositCents(100, 25)).toBeNull(); // 25¢ — below Stripe's $0.50 minimum
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npx vitest run tests/functions/deposit-math.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// netlify/functions/_lib/deposit-math.js
// Pure helpers — no I/O, no env access.
//
// Service prices in scheduler_config are free-text strings ("$99", "199.99",
// "1,299", "Call for quote"). For deposits we need cents. We parse leading
// numeric content and ignore everything else. If we can't extract a positive
// number, we return null and the booking proceeds without a deposit.

const STRIPE_MIN_CENTS = 50; // Stripe's USD minimum charge.

export function parsePriceToCents(input) {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? Math.round(input * 100) : null;
  }
  if (typeof input !== 'string') return null;
  // Strip currency symbol, whitespace, thousands separators.
  const cleaned = input.replace(/[\s$,]/g, '');
  // Match a leading number (with optional decimal).
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return null;
  const dollars = parseInt(match[1], 10);
  const fractional = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const cents = dollars * 100 + fractional;
  return cents > 0 ? cents : null;
}

export function computeDepositCents(priceCents, percentage) {
  if (priceCents == null || percentage == null) return null;
  if (typeof percentage !== 'number' || !Number.isFinite(percentage)) return null;
  if (percentage <= 0 || percentage > 100) return null;
  if (priceCents <= 0) return null;
  const cents = Math.round((priceCents * percentage) / 100);
  if (cents < STRIPE_MIN_CENTS) return null;
  return cents;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/functions/deposit-math.test.js`
Expected: PASS — 21/21.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/deposit-math.js tests/functions/deposit-math.test.js
git commit -m "feat(deposits): price parsing + deposit math + tests"
```

---

## Task 3: Booking deposit webhook handler + tests

**Files:**
- Create: `netlify/functions/_lib/booking-deposit-handler.js`
- Create: `tests/functions/booking-deposit-handler.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
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
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npx vitest run tests/functions/booking-deposit-handler.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handler**

```javascript
// netlify/functions/_lib/booking-deposit-handler.js
// Receives checkout.session.completed events with mode='payment' from
// connected Stripe accounts. The session was created by create-booking
// with client_reference_id = booking.id. Flip the row to paid.
//
// Idempotent: a duplicate event re-writes the same data; no harm done.
export async function handleBookingCheckoutCompleted(event, { db }) {
  const session = event.data.object;
  if (session?.mode !== 'payment') return;
  const bookingId = session.client_reference_id;
  if (!bookingId) return;

  await db.from('bookings').update({
    deposit_status: 'paid',
    deposit_paid_cents: session.amount_total ?? null,
    deposit_paid_at: new Date(),
    deposit_payment_intent_id: session.payment_intent ?? null,
  }).eq('id', bookingId);
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/functions/booking-deposit-handler.test.js`
Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/booking-deposit-handler.js tests/functions/booking-deposit-handler.test.js
git commit -m "feat(deposits): webhook handler for checkout.session.completed (payment mode)"
```

---

## Task 4: Route checkout.session.completed by mode

**Files:**
- Modify: `netlify/functions/stripe-webhook.js`

- [ ] **Step 1: Update the import + switch case**

Add the import at the top, alongside the existing handler imports:

```javascript
import { handleBookingCheckoutCompleted } from './_lib/booking-deposit-handler.js';
```

Replace the existing `case 'checkout.session.completed':` block with:

```javascript
case 'checkout.session.completed': {
  const mode = stripeEvent.data.object?.mode;
  if (mode === 'subscription') {
    await handleCheckoutCompleted(stripeEvent, { stripe, db });
  } else if (mode === 'payment') {
    await handleBookingCheckoutCompleted(stripeEvent, { db });
  } else {
    console.warn('[stripe-webhook] checkout.session.completed with unknown mode:', mode);
  }
  break;
}
```

- [ ] **Step 2: Run full vitest suite**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/stripe-webhook.js
git commit -m "feat(deposits): route checkout.session.completed by mode

subscription mode → existing Plan A handler (sub signup)
payment mode → new Plan D handler (booking deposit)
unknown mode → log + drop (safe default)"
```

---

## Task 5: Subscribe Connect webhook to checkout.session.completed

**Files:** none (Stripe API call by controller)

- [ ] **Step 1: Update the Connect webhook endpoint via API**

The controller will run:
```bash
curl -u "$STRIPE_KEY:" -X POST https://api.stripe.com/v1/webhook_endpoints/we_1TPtTEAnU2S5w1v8arrHPj8V \
  -d "enabled_events[]=account.updated" \
  -d "enabled_events[]=checkout.session.completed"
```

- [ ] **Step 2: Verify**

Response should show both events in `enabled_events`.

- [ ] **Step 3: No commit needed** — Stripe API state, not code.

---

## Task 6: Add deposit_percentage to scheduler config defaults

**Files:**
- Modify: `src/lib/schedulerConfig.js`

- [ ] **Step 1: Edit `defaultSchedulerConfig()`**

In `src/lib/schedulerConfig.js`, find `defaultSchedulerConfig` and add `deposit_percentage: 0` next to `lead_time_hours`:

```javascript
export function defaultSchedulerConfig() {
  return {
    welcome_text: "Tell us about your car and we'll be in touch.",
    button_label: 'Book Now',
    lead_time_hours: 24,
    slot_granularity_minutes: 30,
    deposit_percentage: 0,
    cta_selector: '',
    cancellation_policy: '',
    services: [],
    availability: {
      mon: [...DEFAULT_HOURS], tue: [...DEFAULT_HOURS], wed: [...DEFAULT_HOURS],
      thu: [...DEFAULT_HOURS], fri: [...DEFAULT_HOURS], sat: [], sun: [],
    },
  };
}
```

(Existing sites that don't have the key fall back to 0 anyway when the create-booking function reads `cfg.deposit_percentage ?? 0`.)

- [ ] **Step 2: Commit**

```bash
git add src/lib/schedulerConfig.js
git commit -m "feat(deposits): add deposit_percentage to default scheduler config"
```

---

## Task 7: Deposit % field in GeneralTab booking settings

**Files:**
- Modify: `src/components/dashboard/booking-settings/GeneralTab.jsx`

- [ ] **Step 1: Read the file**

Run: `head -200 src/components/dashboard/booking-settings/GeneralTab.jsx`

Look at how `lead` (lead_time_hours) is wired up — same pattern as the new field. Specifically:
- A `useState` initialized from `config?.lead_time_hours ?? 24`.
- A `useEffect` that re-syncs when `config` changes.
- An `<input type="number">` rendered in the form.
- A save call that passes `{ lead_time_hours: Number(lead) }` to `saveSchedulerConfig`.

- [ ] **Step 2: Add a `deposit_percentage` state + sync effect**

Add next to the existing `lead` state:

```javascript
const [depositPct, setDepositPct] = useState(String(config?.deposit_percentage ?? 0));
```

Add to the `useEffect` that resyncs from config:

```javascript
setDepositPct(String(config?.deposit_percentage ?? 0));
```

- [ ] **Step 3: Add the input in the form**

In the JSX, just below the lead-time input, add:

```jsx
<div>
  <label htmlFor="deposit-pct" className="block text-sm font-medium text-[#1a1a1a] mb-1">Deposit %</label>
  <p className="text-xs text-[#888] mb-2">Charge a deposit when customers book. Set to 0 to disable. Requires a connected Stripe account; deposits are skipped on services without a numeric price.</p>
  <input
    id="deposit-pct"
    type="number"
    min="0"
    max="100"
    step="1"
    value={depositPct}
    onChange={(e) => setDepositPct(e.target.value)}
    className="w-32 px-3 py-2 border border-black/10 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
  />
</div>
```

(Use the exact same wrapping `<div>` / label / input markup style the lead-time input uses — copy that pattern. The above is illustrative; match the existing markup of GeneralTab so it visually fits.)

- [ ] **Step 4: Include in the save handler**

In the `save()` (or equivalent) function in GeneralTab that calls `saveSchedulerConfig(siteId, {...})`, add `deposit_percentage: clampedDepositPct` to the object:

```javascript
const clampedDepositPct = Math.max(0, Math.min(100, Number(depositPct) || 0));
const updated = await saveSchedulerConfig(siteId, {
  // ...existing fields...
  deposit_percentage: clampedDepositPct,
});
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/booking-settings/GeneralTab.jsx
git commit -m "feat(deposits): deposit percentage input in booking settings"
```

---

## Task 8: create-booking creates Checkout Session

**Files:**
- Modify: `netlify/functions/create-booking.js`

- [ ] **Step 1: Add imports**

At the top of `netlify/functions/create-booking.js`, alongside the existing imports:

```javascript
import { getStripe } from './_lib/stripe.js';
import { parsePriceToCents, computeDepositCents } from './_lib/deposit-math.js';
```

- [ ] **Step 2: Update the profile select to fetch Connect fields**

Find the line `const { data: owner } = await supabase.from('profiles').select(...)`. Replace its select with:

```javascript
const { data: owner } = await supabase
  .from('profiles')
  .select('email, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at, stripe_connect_account_id, stripe_connect_charges_enabled')
  .eq('id', site.user_id)
  .maybeSingle();
```

- [ ] **Step 3: After the booking insert, attempt the Checkout Session**

Replace the existing return statement and email block. The new flow:

1. Insert booking (existing code).
2. Compute deposit. If valid AND owner is Connect-ready, create Checkout Session on the connected account, write `deposit_required_cents` + `deposit_status='pending'` + `deposit_checkout_session_id` back to the booking row.
3. Send the existing emails.
4. Return `{ ok: true, bookingId, checkout_url }` (with `checkout_url` only present when a session was created).

The full replacement block, starting just AFTER the `if (insErr)` early-return:

```javascript
  // Compute deposit if configured. Failures here are non-fatal — the booking
  // still exists; we just don't take a deposit.
  let checkoutUrl = null;
  let depositRequiredCents = null;
  try {
    const pct = Number(cfg.deposit_percentage) || 0;
    const priceCents = chosenService ? parsePriceToCents(chosenService.price) : null;
    depositRequiredCents = computeDepositCents(priceCents, pct);

    const connectReady = owner.stripe_connect_account_id && owner.stripe_connect_charges_enabled === true;

    if (depositRequiredCents && connectReady) {
      const stripe = getStripe();
      const successBase = `${process.env.APP_URL || ''}/booking-confirmed`;
      const cancelBase  = `${process.env.APP_URL || ''}/booking-cancelled`;

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: inserted.id,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: depositRequiredCents,
            product_data: {
              name: `Deposit — ${chosenService.name}`,
              description: `Deposit toward your booking with ${site.business_info?.businessName || 'us'}.`,
            },
          },
          quantity: 1,
        }],
        payment_intent_data: {
          application_fee_amount: 200,            // $2 platform fee, in cents
          metadata: { booking_id: inserted.id },
        },
        success_url: `${successBase}?booking=${inserted.id}`,
        cancel_url:  `${cancelBase}?booking=${inserted.id}`,
        customer_email: payload.customer_email,
        metadata: { booking_id: inserted.id, site_id: site.id },
      }, {
        stripeAccount: owner.stripe_connect_account_id,
      });

      await supabase.from('bookings').update({
        deposit_required_cents: depositRequiredCents,
        deposit_status: 'pending',
        deposit_checkout_session_id: checkoutSession.id,
        deposit_application_fee_cents: 200,
      }).eq('id', inserted.id);

      checkoutUrl = checkoutSession.url;
    }
  } catch (err) {
    console.error('create-booking: deposit checkout creation failed:', err);
    // Booking proceeds without a deposit; do not return an error to the customer.
  }

  // Existing emails block — unchanged.
  await Promise.allSettled([
    newBookingToOwner({ booking: inserted, site, ownerEmail: owner.email })
      .catch((err) => console.error('owner email failed:', err)),
    bookingReceivedToCustomer({ booking: inserted, site, isSimple })
      .catch((err) => console.error('customer email failed:', err)),
  ]);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, bookingId: inserted.id, checkout_url: checkoutUrl }),
  };
};
```

- [ ] **Step 4: Verify by running existing booking tests still pass**

Run: `npx vitest run tests/functions/booking-state.test.js tests/functions/booking-validation.test.js`
Expected: all green (we didn't change the validation/state machine).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/create-booking.js
git commit -m "feat(deposits): create-booking spawns Stripe Checkout for deposits

When deposit_percentage > 0, the service has a parseable price, and the
business has stripe_connect_charges_enabled=true, create a Checkout
Session on the connected account with a \$2 application fee. Save the
session id on the booking row and return the checkout URL to the client.
Failures during deposit creation never block booking creation."
```

---

## Task 9: Public scheduler redirects to Checkout when present

**Files:**
- Modify: `public/scheduler.js`

- [ ] **Step 1: Find the success handler in `public/scheduler.js`**

Look for where the response from `create-booking` is handled. There will be code like `if (json.ok) { ... show confirmation ... }`. (Search for `ok` near a `fetch` call.)

- [ ] **Step 2: Add the redirect**

Just before the existing confirmation render (when `json.ok` is true), insert:

```javascript
if (json && json.checkout_url) {
  window.location.href = json.checkout_url;
  return;
}
```

So the customer is redirected to Stripe Checkout when a deposit URL was returned. Otherwise the existing confirmation card renders unchanged.

- [ ] **Step 3: Manual sanity check**

There's no automated test for `public/scheduler.js` (it's a vanilla JS embed). Verify by reading the diff and confirming the redirect happens BEFORE the confirmation render branch.

- [ ] **Step 4: Commit**

```bash
git add public/scheduler.js
git commit -m "feat(deposits): scheduler widget redirects to Checkout when deposit required"
```

---

## Task 10: BookingsList — show deposit pill

**Files:**
- Modify: `src/components/dashboard/bookings/BookingsList.jsx`

- [ ] **Step 1: Read the existing list row markup**

Run: `head -120 src/components/dashboard/bookings/BookingsList.jsx`. Find where each booking row's metadata is rendered (status pill, customer name, etc.).

- [ ] **Step 2: Add a deposit pill helper at the top of the file**

Above the default export, add:

```jsx
function depositPill(booking) {
  const status = booking?.deposit_status;
  if (!status || status === 'not_required') return null;
  const label =
    status === 'paid'    ? 'Deposit paid' :
    status === 'pending' ? 'Deposit pending' :
    status === 'refunded'? 'Deposit refunded' :
    status === 'failed'  ? 'Deposit failed' : null;
  if (!label) return null;
  const cls =
    status === 'paid'    ? 'bg-[#e8f5ec] text-[#0a8f3d]' :
    status === 'pending' ? 'bg-[#fff7e6] text-[#b37400]' :
    status === 'refunded'? 'bg-[#eef0f3] text-[#4a4a4a]' :
                            'bg-[#fff5f5] text-[#cc0000]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Render the pill in each row**

Next to the existing status pill in the row, add `{depositPill(booking)}`.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/bookings/BookingsList.jsx
git commit -m "feat(deposits): show deposit-status pill on bookings list rows"
```

---

## Task 11: BookingDetailDrawer — show deposit summary

**Files:**
- Modify: `src/components/dashboard/bookings/BookingDetailDrawer.jsx`

- [ ] **Step 1: Read the file**

Run: `cat src/components/dashboard/bookings/BookingDetailDrawer.jsx`. Find the section that lists booking facts (customer, service, scheduled time, etc.).

- [ ] **Step 2: Add deposit summary row**

Below the existing service/price row, add a deposit summary block:

```jsx
{booking?.deposit_status && booking.deposit_status !== 'not_required' && (
  <div className="border-t border-black/[0.07] pt-4 mt-4">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Deposit</h3>
    <dl className="text-sm space-y-1">
      <div className="flex justify-between">
        <dt className="text-[#888]">Status</dt>
        <dd className="font-semibold text-[#1a1a1a]">
          {booking.deposit_status === 'paid' && 'Paid'}
          {booking.deposit_status === 'pending' && 'Pending'}
          {booking.deposit_status === 'refunded' && 'Refunded'}
          {booking.deposit_status === 'failed' && 'Failed'}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-[#888]">Required</dt>
        <dd className="font-mono">{booking.deposit_required_cents != null ? `$${(booking.deposit_required_cents / 100).toFixed(2)}` : '—'}</dd>
      </div>
      {booking.deposit_paid_cents != null && (
        <div className="flex justify-between">
          <dt className="text-[#888]">Paid</dt>
          <dd className="font-mono">${(booking.deposit_paid_cents / 100).toFixed(2)}</dd>
        </div>
      )}
      {booking.deposit_paid_at && (
        <div className="flex justify-between">
          <dt className="text-[#888]">Paid at</dt>
          <dd>{new Date(booking.deposit_paid_at).toLocaleString()}</dd>
        </div>
      )}
    </dl>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/bookings/BookingDetailDrawer.jsx
git commit -m "feat(deposits): deposit summary block in booking detail drawer"
```

---

## Task 12: End-to-end manual test

**Files:** none (manual)

Prereqs (already done):
- Plan A complete; Pro subscription active for the test owner.
- Plan B complete; owner's Connect account has `charges_enabled=true`.
- Branch deployed at `https://claude-brave-fermi-5c8e30--autosite-builder.netlify.app`.

- [ ] **Step 1: Configure deposit %**

Sign in as a Pro owner. Booking Settings → General → set **Deposit %** to e.g. `25`. Save.

- [ ] **Step 2: Verify a service has a numeric price**

Booking Settings → Services → ensure at least one service has a price like `99`, `$199`, or `199.99`. (Services with prices like "Call for quote" simply skip the deposit silently.)

- [ ] **Step 3: Submit a public booking**

Open the published site (or the scheduler iframe demo) → click Book Now → choose the priced service → enter customer details using a test card email like `you+test@yourdomain.com` → submit.

Expect: redirect to Stripe Checkout (URL on `checkout.stripe.com/c/pay/...`).

- [ ] **Step 4: Pay with test card**

Use `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

Expect: redirect to `${APP_URL}/booking-confirmed?booking=<id>`. (This URL doesn't render anything yet; that's a follow-up. The success itself proves the flow.)

- [ ] **Step 5: Verify DB**

```sql
select id, customer_name, status, deposit_status, deposit_required_cents, deposit_paid_cents, deposit_paid_at
from bookings order by created_at desc limit 3;
```

Latest row should show: `deposit_status='paid'`, `deposit_paid_cents` ≈ 25% of service price.

- [ ] **Step 6: Verify Stripe**

Stripe dashboard → Payments → confirm the charge appears on the **connected account's** view (use account switcher) with a $2 application fee transferred to the platform.

- [ ] **Step 7: Owner UI check**

Sign in as owner → Bookings page → confirm the new booking shows a green "Deposit paid" pill in the list and a Deposit summary block in the detail drawer.

- [ ] **Step 8: Cancel-path test**

Submit another booking, get to Stripe Checkout, click the back arrow / cancel.
Expect: customer lands on `${APP_URL}/booking-cancelled?booking=<id>`.
DB row should remain `deposit_status='pending'` and the booking is still recorded — owner can decide whether to honor it.

- [ ] **Step 9: No-deposit fallback**

Set deposit_percentage back to 0 (or pick a service with non-numeric price). Submit a booking.
Expect: no Checkout redirect, normal confirmation card shows, DB row has `deposit_status='not_required'`.

- [ ] **Step 10: Smoke doc**

```bash
mkdir -p docs/superpowers/smoke-tests
cat > docs/superpowers/smoke-tests/booking-deposits.md <<'EOF'
# Booking deposits — smoke test

1. Owner sets deposit_percentage = 25 in Booking Settings.
2. Owner has a service with numeric price (e.g. $99).
3. Customer books that service via the public widget.
4. Customer is redirected to Stripe Checkout, pays with 4242…4242.
5. Stripe redirects to /booking-confirmed?booking=<id>.
6. Owner sees `Deposit paid` pill on the booking row.
7. DB row: deposit_status='paid', deposit_paid_cents=2475, deposit_payment_intent_id populated.
8. Stripe dashboard shows a charge on the connected account with a $2 application fee on the platform.
EOF
git add docs/superpowers/smoke-tests/booking-deposits.md
git commit -m "docs(deposits): smoke test checklist"
```

---

## Task 13: Go-live checklist (manual)

- [ ] All vitest tests pass: `npx vitest run`
- [ ] Sandbox E2E (Task 12) passes on the branch deploy
- [ ] Live-mode Connect webhook (when created at go-live) includes both `account.updated` AND `checkout.session.completed`
- [ ] Live-mode Netlify env: `STRIPE_SECRET_KEY` (live), `STRIPE_PRICE_ID_PRO_MONTHLY` (live), `VITE_STRIPE_PUBLISHABLE_KEY` (live), both webhook secrets — verify nothing is still on test keys
- [ ] Merge branch to master
