# Charge Customer — Design Spec

**Date:** 2026-04-28  
**Status:** Approved

---

## Overview

An in-person payment flow for service business owners. The owner opens a "Charge" modal from anywhere in the dashboard, selects a service or enters a custom amount, and gets a Stripe Checkout URL presented as a QR code and an SMS link. The customer scans or taps the link and pays with Apple Pay, Google Pay, or a card. The owner sees the payment land in real time. Every charge is recorded in a new `charges` table and is visible in a Charges history page and on individual customer profiles.

---

## Entry Points

The "Charge $" button appears in three places, only when the owner's Stripe Connect account is fully connected (`stripe_connect_charges_enabled = true`):

1. **AppHeader nav** — a red "Charge $" button always visible across all dashboard pages
2. **CustomerDetailPage** — a "Charge this customer" button at the top of the customer view; pre-fills customer name and phone in the modal
3. **PaymentsConnectPage** — a "Charge a Customer" card below the connected status card

If Stripe is not connected, the button is hidden entirely.

---

## The Charge Modal (`ChargeModal.jsx`)

A three-step modal.

### Step 1 — Build the charge
- Toggle: **"Pick a service"** vs **"Custom amount"**
- Service picker: list of enabled services aggregated across all of the owner's published sites (deduplicated by name), sourced from `scheduler_config.services`. If the owner has only one published site this is straightforward; if they have multiple, all services are merged into one flat list. Selecting one sets the amount.
- Custom amount: a plain dollar input (e.g. `$0.00`)
- **Customer name** — optional text field
- **Customer phone** — optional, used for SMS texting
- CTA: "Create Payment Link →" — disabled until a non-zero amount is set
- On submit: calls `/.netlify/functions/create-charge`, shows loading spinner

### Step 2 — Payment link ready
- **QR code** rendered from the Stripe Checkout URL using `qrcode.react`
- **"Text to customer"** button — opens native SMS via `sms:+1XXXXXXXXXX?body=Hi [name], here's your payment link: [url]`. Only shown if a phone number was entered.
- **"Copy link"** button — copies URL to clipboard with a brief "Copied!" confirmation
- **Status indicator** — polls the `charges` table every 3 seconds for up to 2 minutes: "Waiting for payment…"
- Owner can close the modal at any time without cancelling — charge is still valid and the link still works

### Step 3 — Paid ✓
- Green success state: "Payment received — $X.XX"
- Shows customer name and service/amount
- "Done" closes the modal
- Triggered when polling detects `status = 'paid'`

---

## Backend

### New Supabase table: `charges`

```sql
CREATE TABLE charges (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id               UUID REFERENCES profiles(id) NOT NULL,
  site_id                     UUID REFERENCES sites(id),
  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  customer_name               TEXT,
  customer_phone              TEXT,
  service_name                TEXT,
  amount_cents                INTEGER NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | expired
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: owners can only read/write their own charges
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_charges" ON charges
  USING (owner_user_id = auth.uid());
```

### New Netlify function: `create-charge.js`

- **Auth:** Bearer token required
- **Gate:** `isEffectiveSchedulerActive` + `stripe_connect_charges_enabled = true`
- **Flow:**
  1. Insert row into `charges` with `status = 'pending'`
  2. Create Stripe Checkout session on connected account:
     - `mode: 'payment'`
     - `client_reference_id: charge.id`
     - `metadata: { type: 'charge', charge_id: charge.id }`
     - `payment_intent_data: { application_fee_amount: 200, metadata: { charge_id: charge.id, type: 'charge' } }`
     - `success_url: https://sitebuilder.autocaregenius.com?charge_success=1`
     - `cancel_url: https://sitebuilder.autocaregenius.com?charge_cancel=1`
     - (The owner watches the modal for payment confirmation — these URLs are for the customer's browser after they pay/cancel. They land on the main app homepage, which is fine.)
     - `stripeAccount: owner.stripe_connect_account_id`
  3. Update `charges` row with `stripe_checkout_session_id`
  4. Return `{ checkout_url, charge_id }`

### Webhook update: `stripe-webhook.js` + new `stripe-charge-handler.js`

Currently `checkout.session.completed` (mode=payment) routes entirely to `handleBookingCheckoutCompleted`. Updated routing:

```js
case 'checkout.session.completed': {
  if (mode === 'subscription') {
    await handleCheckoutCompleted(...)
  } else if (mode === 'payment') {
    if (stripeEvent.data.object.metadata?.type === 'charge') {
      await handleChargeCompleted(stripeEvent, { db });
    } else {
      await handleBookingCheckoutCompleted(stripeEvent, { db });
    }
  }
}
```

New `_lib/stripe-charge-handler.js`:
- Reads `client_reference_id` (= charge ID)
- Updates `charges` row: `status = 'paid'`, `paid_at = now()`, `stripe_payment_intent_id = session.payment_intent`, `amount_cents = session.amount_total`

**Platform fee:** $2.00 flat (`application_fee_amount: 200`), same as booking deposits.

---

## Charges History

### New `ChargesPage.jsx`

- Added to AppHeader nav between Customers and Payments
- Flat list of all charges for the logged-in owner, sorted newest first
- Columns: customer name, service/amount, status badge, date, phone
- Status badges: yellow "Awaiting payment" / green "Paid" / gray "Expired"
- Empty state: "No charges yet. Use the Charge button to take your first payment."

### CustomerDetailPage integration

- New "Charges" section at the bottom of the customer detail view
- Matches charges by `customer_phone` (normalized — strip non-digits for matching)
- Same columns as ChargesPage
- Empty state includes a "Charge this customer →" button that opens the modal pre-filled

---

## New lib: `src/lib/createCharge.js`

Thin wrapper calling `/.netlify/functions/create-charge` with the auth token. Mirrors the pattern of `stripeConnect.js`.

---

## Files to Create or Modify

| File | Change |
|------|--------|
| `netlify/functions/create-charge.js` | New — creates charge row + Stripe Checkout session |
| `netlify/functions/_lib/stripe-charge-handler.js` | New — handles `checkout.session.completed` for charges |
| `netlify/functions/stripe-webhook.js` | Update routing to dispatch to charge handler |
| `src/lib/createCharge.js` | New — authenticated fetch wrapper |
| `src/components/dashboard/charges/ChargeModal.jsx` | New — 3-step modal |
| `src/components/dashboard/charges/ChargesPage.jsx` | New — charges history list |
| `src/components/ui/AppHeader.jsx` | Add Charge button + Charges nav link |
| `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx` | Add charge CTA card |
| `src/components/dashboard/customers-page/CustomerDetailPage.jsx` | Add charge button + charges section |
| `src/App.jsx` | Add `charges` view + wire up navigation |
| Supabase migration | Create `charges` table with RLS |

---

## Error Handling

- If `create-charge` fails (Stripe error, network), show inline error in modal Step 1 — don't dismiss the modal
- If polling times out (2 minutes) without a payment, show "Link still active — you can close this and check Charges later"
- Stripe Checkout sessions expire after 24 hours — a background job or manual expiry check is out of scope; status stays `pending` until a future sweep

---

## Out of Scope

- Refunds (handle via Stripe dashboard directly)
- Recurring / invoice-style charges
- Charge expiry sweep (mark pending → expired after 24hrs)
- Email receipt (Stripe sends one automatically)
