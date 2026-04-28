# Charge Customer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let business owners charge customers in-person via a QR code / SMS payment link backed by their Stripe Express connected account.

**Architecture:** A new `create-charge` Netlify function creates a Stripe Checkout session on the connected account and inserts a row into a new `charges` Supabase table. A `ChargeModal` React component polls the `charges` table for payment confirmation and shows a QR code + SMS link. Completed charges appear in a new `ChargesPage` and on `CustomerDetailPage`. The existing `stripe-webhook.js` is updated to route charge completions to a new `handleChargeCompleted` handler.

**Tech Stack:** React 19, Tailwind CSS, Supabase (RLS), Netlify Functions, Stripe Connect, `qrcode.react`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `netlify/functions/create-charge.js` | Create | Auth-gated function: insert charge row + create Stripe Checkout session |
| `netlify/functions/_lib/stripe-charge-handler.js` | Create | Handle `checkout.session.completed` with `metadata.type === 'charge'` |
| `netlify/functions/stripe-webhook.js` | Modify | Route charge vs booking deposit in `checkout.session.completed` |
| `src/lib/createCharge.js` | Create | Authenticated fetch wrapper calling `create-charge` |
| `src/components/dashboard/charges/ChargeModal.jsx` | Create | 3-step modal: build charge → QR+SMS → paid confirmation |
| `src/components/dashboard/charges/ChargesPage.jsx` | Create | Full-page charges history list |
| `src/components/ui/AppHeader.jsx` | Modify | Add `onOpenCharges` prop, Charges nav item, Charge $ button |
| `src/components/dashboard/customers-page/CustomerDetailPage.jsx` | Modify | Add ChargeModal trigger + charges history section |
| `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx` | Modify | Add "Charge a Customer" card when fully connected |
| `src/App.jsx` | Modify | Add `charges` view, wire `onOpenCharges` everywhere |

---

## Task 1: Install qrcode.react

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd "C:/Users/mikec/Website Creator"
npm install qrcode.react
```

Expected output: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Verify it imported correctly**

Create a quick smoke test — just confirm the import resolves:

```bash
node -e "import('qrcode.react').then(() => console.log('ok')).catch(e => console.error(e))"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add qrcode.react for in-person charge QR codes"
```

---

## Task 2: Supabase migration — `charges` table

**Files:**
- Supabase SQL migration (run via Supabase MCP `apply_migration` or the Supabase dashboard SQL editor)

- [ ] **Step 1: Run the migration**

Execute this SQL against the `ktnouhjikmlxlbxcxyif` project:

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
  status                      TEXT NOT NULL DEFAULT 'pending',
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

-- Owners can read and write their own charges
CREATE POLICY "owner_charges_select" ON charges
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "owner_charges_insert" ON charges
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "owner_charges_update" ON charges
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Index for fetching charges by owner
CREATE INDEX charges_owner_user_id_idx ON charges (owner_user_id, created_at DESC);

-- Index for matching charges to a customer by phone
CREATE INDEX charges_customer_phone_idx ON charges (owner_user_id, customer_phone);
```

- [ ] **Step 2: Verify the table exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'charges' AND table_schema = 'public'
ORDER BY ordinal_position;
```

Expected: 12 rows listing id, owner_user_id, site_id, stripe_checkout_session_id, stripe_payment_intent_id, customer_name, customer_phone, service_name, amount_cents, status, paid_at, created_at.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "db: add charges table with RLS"
```

---

## Task 3: `netlify/functions/_lib/stripe-charge-handler.js`

**Files:**
- Create: `netlify/functions/_lib/stripe-charge-handler.js`

- [ ] **Step 1: Create the file**

```js
// netlify/functions/_lib/stripe-charge-handler.js
// Handles checkout.session.completed events where metadata.type === 'charge'.
// Flips the charges row from pending → paid.
export async function handleChargeCompleted(event, { db }) {
  const session = event.data.object;
  if (session?.mode !== 'payment') return;

  const chargeId = session.client_reference_id;
  if (!chargeId) return;

  await db.from('charges').update({
    status: 'paid',
    paid_at: new Date(),
    stripe_payment_intent_id: session.payment_intent ?? null,
    amount_cents: session.amount_total ?? null,
  }).eq('id', chargeId);
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_lib/stripe-charge-handler.js
git commit -m "feat: add stripe charge completed webhook handler"
```

---

## Task 4: Update `netlify/functions/stripe-webhook.js`

**Files:**
- Modify: `netlify/functions/stripe-webhook.js`

- [ ] **Step 1: Add the import**

At the top of `netlify/functions/stripe-webhook.js`, after the existing imports, add:

```js
import { handleChargeCompleted } from './_lib/stripe-charge-handler.js';
```

So the imports block looks like:

```js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpserted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
} from './_lib/stripe-event-handlers.js';
import { handleAccountUpdated } from './_lib/stripe-connect-handler.js';
import { handleBookingCheckoutCompleted } from './_lib/booking-deposit-handler.js';
import { handleChargeCompleted } from './_lib/stripe-charge-handler.js';
```

- [ ] **Step 2: Update the routing for `checkout.session.completed`**

Find this block in the `switch` statement:

```js
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

Replace with:

```js
case 'checkout.session.completed': {
  const mode = stripeEvent.data.object?.mode;
  if (mode === 'subscription') {
    await handleCheckoutCompleted(stripeEvent, { stripe, db });
  } else if (mode === 'payment') {
    const type = stripeEvent.data.object?.metadata?.type;
    if (type === 'charge') {
      await handleChargeCompleted(stripeEvent, { db });
    } else {
      await handleBookingCheckoutCompleted(stripeEvent, { db });
    }
  } else {
    console.warn('[stripe-webhook] checkout.session.completed with unknown mode:', mode);
  }
  break;
}
```

- [ ] **Step 3: Verify the file looks correct**

The full switch statement should now have 7 cases: `checkout.session.completed` (with nested charge/booking routing), `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`, `account.updated`, `default`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/stripe-webhook.js netlify/functions/_lib/stripe-charge-handler.js
git commit -m "feat: route charge checkout events to charge handler"
```

---

## Task 5: `netlify/functions/create-charge.js`

**Files:**
- Create: `netlify/functions/create-charge.js`

- [ ] **Step 1: Create the file**

```js
// netlify/functions/create-charge.js
// Creates an in-person charge: inserts a charges row then creates a
// Stripe Checkout session on the owner's connected account.
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
const ok   = (body)         => ({ statusCode: 200,    headers: CORS, body: JSON.stringify(body) });

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
    .select('id, stripe_connect_account_id, stripe_connect_charges_enabled, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return fail(404, { error: 'Profile not found' });
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });
  if (!profile.stripe_connect_account_id || !profile.stripe_connect_charges_enabled) {
    return fail(403, { error: 'Stripe account not connected or not ready' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return fail(400, { error: 'Invalid JSON' }); }

  const { amount_cents, service_name, customer_name, customer_phone, site_id } = payload;

  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 50) {
    return fail(400, { error: 'amount_cents must be a number >= 50' });
  }

  // Insert the charge row first so we have an id for client_reference_id
  const { data: charge, error: insertErr } = await db.from('charges').insert({
    owner_user_id: user.id,
    site_id: site_id || null,
    customer_name: customer_name || null,
    customer_phone: customer_phone || null,
    service_name: service_name || null,
    amount_cents,
    status: 'pending',
  }).select().single();

  if (insertErr) {
    console.error('[create-charge] insert error:', insertErr);
    return fail(500, { error: 'Failed to create charge record' });
  }

  const appUrl = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: charge.id,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amount_cents,
          product_data: {
            name: service_name || 'Service Payment',
          },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: 200,
        metadata: { charge_id: charge.id, type: 'charge' },
      },
      metadata: { type: 'charge', charge_id: charge.id },
      success_url: `${appUrl}?charge_success=1`,
      cancel_url:  `${appUrl}?charge_cancel=1`,
      customer_email: undefined,  // owner fills this optionally — Stripe will ask customer
      expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    }, {
      stripeAccount: profile.stripe_connect_account_id,
    });

    await db.from('charges').update({
      stripe_checkout_session_id: session.id,
    }).eq('id', charge.id);

    return ok({ charge_id: charge.id, checkout_url: session.url });
  } catch (err) {
    console.error('[create-charge] Stripe error:', err?.message || err);
    // Clean up the pending row so it doesn't litter the charges list
    await db.from('charges').delete().eq('id', charge.id);
    return fail(502, { error: err?.message || 'Failed to create payment link' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/create-charge.js
git commit -m "feat: add create-charge netlify function"
```

---

## Task 6: `src/lib/createCharge.js`

**Files:**
- Create: `src/lib/createCharge.js`

- [ ] **Step 1: Create the file**

```js
// src/lib/createCharge.js
import { supabase } from './supabase.js';

/**
 * Creates an in-person charge and returns { charge_id, checkout_url }.
 * @param {{ amount_cents: number, service_name?: string, customer_name?: string, customer_phone?: string, site_id?: string }} opts
 */
export async function createCharge(opts) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetch('/.netlify/functions/create-charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body; // { charge_id, checkout_url }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/createCharge.js
git commit -m "feat: add createCharge frontend lib"
```

---

## Task 7: `src/components/dashboard/charges/ChargeModal.jsx`

**Files:**
- Create: `src/components/dashboard/charges/ChargeModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/dashboard/charges/ChargeModal.jsx
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../../lib/supabase.js';
import { createCharge } from '../../../lib/createCharge.js';

// parsePriceToCents: strips $, commas, whitespace and converts to integer cents.
function parsePriceToCents(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[\s$,]/g, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return null;
  const dollars = parseInt(match[1], 10);
  const fractional = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const cents = dollars * 100 + fractional;
  return cents >= 50 ? cents : null;
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ChargeModal({
  profile,        // owner profile — needs stripe_connect_charges_enabled, stripe_connect_account_id
  services,       // [{ id, name, price, enabled }] — from site scheduler_config
  prefillName,    // optional: customer name pre-filled (from CustomerDetailPage)
  prefillPhone,   // optional: customer phone pre-filled
  siteId,         // optional: site_id to associate charge with
  onClose,
}) {
  const [step, setStep] = useState(1); // 1 = build, 2 = QR, 3 = paid

  // Step 1 state
  const [mode, setMode] = useState('service'); // 'service' | 'custom'
  const [selectedService, setSelectedService] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customerName, setCustomerName] = useState(prefillName || '');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Step 2 state
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [chargeId, setChargeId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const enabledServices = (services || []).filter((s) => s.enabled !== false);

  // Compute amount in cents for whatever is selected
  const amountCents = mode === 'service'
    ? (selectedService ? parsePriceToCents(selectedService.price) : null)
    : parsePriceToCents(customAmount);

  const canSubmit = !!amountCents && amountCents >= 50;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    try {
      const { charge_id, checkout_url } = await createCharge({
        amount_cents: amountCents,
        service_name: mode === 'service' ? selectedService?.name : null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        site_id: siteId || null,
      });
      setChargeId(charge_id);
      setCheckoutUrl(checkout_url);
      setStep(2);
      startPolling(charge_id);
    } catch (e) {
      setErr(e.message || 'Failed to create payment link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startPolling(id) {
    let attempts = 0;
    const MAX = 40; // 40 × 3s = 2 minutes
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX) {
        clearInterval(pollRef.current);
        return;
      }
      const { data } = await supabase
        .from('charges')
        .select('status')
        .eq('id', id)
        .single();
      if (data?.status === 'paid') {
        clearInterval(pollRef.current);
        setStep(3);
      }
    }, 3000);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  function handleCopyLink() {
    navigator.clipboard.writeText(checkoutUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleTextCustomer() {
    const phone = customerPhone.trim().replace(/\D/g, '');
    const name = customerName.trim();
    const body = encodeURIComponent(
      `Hi${name ? ` ${name}` : ''}! Here's your payment link: ${checkoutUrl}`
    );
    window.location.href = phone ? `sms:+1${phone}?body=${body}` : `sms:?body=${body}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[0.07]">
          <div>
            <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[2px]">
              {step === 1 ? 'New Charge' : step === 2 ? 'Payment Link Ready' : 'Payment Received'}
            </p>
            <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight mt-0.5">
              {step === 1 ? 'Charge Customer' : step === 2 ? 'Share with Customer' : 'All Done!'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] transition-colors text-[#888]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('service')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    mode === 'service'
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                      : 'bg-white text-[#555] border-black/[0.12] hover:bg-black/[0.03]'
                  }`}
                >
                  Pick a service
                </button>
                <button
                  onClick={() => setMode('custom')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    mode === 'custom'
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                      : 'bg-white text-[#555] border-black/[0.12] hover:bg-black/[0.03]'
                  }`}
                >
                  Custom amount
                </button>
              </div>

              {/* Service picker */}
              {mode === 'service' && (
                <div className="space-y-2">
                  {enabledServices.length === 0 && (
                    <p className="text-sm text-[#888] text-center py-4">No services configured. Use custom amount.</p>
                  )}
                  {enabledServices.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => setSelectedService(svc)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                        selectedService?.id === svc.id
                          ? 'border-[#cc0000] bg-[#cc0000]/[0.04]'
                          : 'border-black/[0.09] hover:border-black/[0.2] bg-white'
                      }`}
                    >
                      <span className="text-sm font-semibold text-[#1a1a1a]">{svc.name}</span>
                      <span className="text-sm font-bold text-[#1a1a1a]">{svc.price}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom amount */}
              {mode === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                    Amount
                  </label>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="$0.00"
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-lg font-bold focus:outline-none focus:border-[#cc0000] transition-colors"
                  />
                </div>
              )}

              {/* Customer name */}
              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  Customer name <span className="text-[#aaa] normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-sm focus:outline-none focus:border-[#cc0000] transition-colors"
                />
              </div>

              {/* Customer phone */}
              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  Phone number <span className="text-[#aaa] normal-case font-normal">(for texting the link)</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-sm focus:outline-none focus:border-[#cc0000] transition-colors"
                />
              </div>

              {err && <p className="text-sm text-[#cc0000]">{err}</p>}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="w-full py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-40 text-white font-bold text-sm transition-colors"
              >
                {loading ? 'Creating link…' : `Create Payment Link${amountCents ? ` — ${formatCents(amountCents)}` : ''} →`}
              </button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="p-3 bg-white border border-black/[0.09] rounded-2xl inline-block">
                  <QRCodeSVG value={checkoutUrl} size={200} />
                </div>
              </div>

              <p className="text-sm text-[#555]">
                Customer scans the QR code or tap the link below to pay with Apple Pay, Google Pay, or card.
              </p>

              <div className="flex flex-col gap-2">
                {customerPhone && (
                  <button
                    onClick={handleTextCustomer}
                    className="w-full py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Text to customer
                  </button>
                )}

                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 rounded-xl bg-white border border-black/[0.12] hover:bg-[#faf9f7] text-[#1a1a1a] font-semibold text-sm transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy payment link'}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[#888] text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for payment…
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-[#e8f5ec] flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a8f3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-black text-[#1a1a1a] tracking-tight">
                  Payment received — {formatCents(amountCents)}
                </p>
                {customerName && (
                  <p className="text-sm text-[#555] mt-1">{customerName}</p>
                )}
                {(selectedService?.name || null) && (
                  <p className="text-sm text-[#888]">{selectedService.name}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-bold text-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/charges/ChargeModal.jsx
git commit -m "feat: add ChargeModal component"
```

---

## Task 8: `src/components/dashboard/charges/ChargesPage.jsx`

**Files:**
- Create: `src/components/dashboard/charges/ChargesPage.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/dashboard/charges/ChargesPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import ChargeModal from './ChargeModal.jsx';

function formatCents(cents) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-800">
        Paid
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
      Awaiting payment
    </span>
  );
}

export default function ChargesPage({
  userId,
  profile,
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
    active: 'charges',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onOpenCharges: () => {},  // no-op — we're already here
    onSignOut,
  };

  const [charges, setCharges] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fullyConnected = profile?.stripe_connect_account_id && profile?.stripe_connect_charges_enabled;

  async function fetchCharges() {
    const { data } = await supabase
      .from('charges')
      .select('*')
      .order('created_at', { ascending: false });
    setCharges(data || []);
  }

  async function fetchSites() {
    const { data } = await supabase
      .from('sites')
      .select('id, scheduler_config')
      .eq('user_id', userId)
      .not('published_url', 'is', null);
    setSites(data || []);
  }

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchCharges(), fetchSites()]).finally(() => setLoading(false));
  }, [userId]);

  // Aggregate all enabled services from published sites, deduplicate by name
  const services = [];
  const seenNames = new Set();
  for (const site of sites) {
    for (const svc of (site.scheduler_config?.services || [])) {
      if (svc.enabled !== false && !seenNames.has(svc.name)) {
        seenNames.add(svc.name);
        services.push(svc);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={profile}
        heading="Charges is a Pro feature"
        subheading="Connect your Stripe account and upgrade to Pro to charge customers in person."
      >
        <main className="max-w-7xl mx-auto px-3 py-10">
          <div className="mb-6 mt-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">Charges</h1>
              <p className="text-sm text-[#888] mt-1">In-person payments collected from customers.</p>
            </div>
            {fullyConnected && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#cc0000] hover:bg-[#a80000] text-white font-bold text-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Charge $
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
            </div>
          ) : charges.length === 0 ? (
            <div className="rounded-xl border border-black/[0.07] bg-white p-10 text-center">
              <p className="text-[#888] text-sm mb-4">No charges yet.</p>
              {fullyConnected && (
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#cc0000] hover:bg-[#a80000] text-white font-bold text-sm transition-colors"
                >
                  Charge a customer →
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-black/[0.07] bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.07] bg-[#faf9f7]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Service / Amount</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge, i) => (
                    <tr key={charge.id} className={i < charges.length - 1 ? 'border-b border-black/[0.05]' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1a1a1a]">{charge.customer_name || <span className="text-[#aaa]">—</span>}</p>
                        {charge.customer_phone && <p className="text-[11px] text-[#888]">{charge.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1a1a1a]">{formatCents(charge.amount_cents)}</p>
                        {charge.service_name && <p className="text-[11px] text-[#888]">{charge.service_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={charge.status} />
                      </td>
                      <td className="px-4 py-3 text-[#888] hidden sm:table-cell">
                        {formatDate(charge.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </SubscribeGate>

      {showModal && (
        <ChargeModal
          profile={profile}
          services={services}
          siteId={sites[0]?.id || null}
          onClose={() => { setShowModal(false); fetchCharges(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/charges/ChargesPage.jsx
git commit -m "feat: add ChargesPage component"
```

---

## Task 9: Update `src/components/ui/AppHeader.jsx`

**Files:**
- Modify: `src/components/ui/AppHeader.jsx`

- [ ] **Step 1: Add `onOpenCharges` to the props list**

Find the props destructuring (line 9–20):

```js
export default function AppHeader({
  active,
  userEmail,
  profile,
  onMySites,
  onOpenBookings,
  onOpenCustomers,
  onOpenPaymentsConnect,
  onOpenAdmin,
  onOpenProfile,
  onSignOut,
}) {
```

Replace with:

```js
export default function AppHeader({
  active,
  userEmail,
  profile,
  onMySites,
  onOpenBookings,
  onOpenCustomers,
  onOpenCharges,
  onOpenPaymentsConnect,
  onOpenAdmin,
  onOpenProfile,
  onSignOut,
}) {
```

- [ ] **Step 2: Add Charges to the navItems array and Charge $ button**

Find the `navItems` array (around line 28):

```js
  const navItems = [
    onMySites && { id: 'sites', label: 'Dashboard', onClick: onMySites },
    showBookingsNav && onOpenBookings && { id: 'bookings', label: 'Bookings', onClick: onOpenBookings },
    showBookingsNav && onOpenCustomers && { id: 'customers', label: 'Customers', onClick: onOpenCustomers },
    onOpenPaymentsConnect && { id: 'payments-connect', label: 'Payments', onClick: onOpenPaymentsConnect },
    isAdmin && onOpenAdmin && { id: 'admin', label: 'Admin', onClick: onOpenAdmin },
  ].filter(Boolean);
```

Replace with:

```js
  const isConnected = !!profile?.stripe_connect_charges_enabled;

  const navItems = [
    onMySites && { id: 'sites', label: 'Dashboard', onClick: onMySites },
    showBookingsNav && onOpenBookings && { id: 'bookings', label: 'Bookings', onClick: onOpenBookings },
    showBookingsNav && onOpenCustomers && { id: 'customers', label: 'Customers', onClick: onOpenCustomers },
    showBookingsNav && onOpenCharges && { id: 'charges', label: 'Charges', onClick: onOpenCharges },
    onOpenPaymentsConnect && { id: 'payments-connect', label: 'Payments', onClick: onOpenPaymentsConnect },
    isAdmin && onOpenAdmin && { id: 'admin', label: 'Admin', onClick: onOpenAdmin },
  ].filter(Boolean);
```

- [ ] **Step 3: Add the Charge $ button to the desktop right side**

Find the desktop right section (the `<div className="hidden md:flex items-center">` block around line 68). Add the Charge button before the avatar dropdown:

```jsx
        <div className="hidden md:flex items-center gap-3">
          {isConnected && onOpenCharges && (
            <button
              onClick={onOpenCharges}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[13px] font-bold transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Charge $
            </button>
          )}
          {userEmail && (
```

Close the outer `</div>` at the end of this section properly.

- [ ] **Step 4: Add Charge $ to mobile menu**

In the mobile menu `<nav>` (around line 137), after the existing navItems.map block and before the Profile button, add:

```jsx
            {isConnected && onOpenCharges && (
              <button
                onClick={() => { setMobileOpen(false); onOpenCharges(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-bold text-white bg-[#cc0000] hover:bg-[#a80000] transition-colors"
              >
                Charge $
              </button>
            )}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/AppHeader.jsx
git commit -m "feat: add Charges nav item and Charge $ button to AppHeader"
```

---

## Task 10: Update `CustomerDetailPage.jsx`

**Files:**
- Modify: `src/components/dashboard/customers-page/CustomerDetailPage.jsx`

- [ ] **Step 1: Add import at the top of the file**

After the existing imports (around line 12), add:

```js
import ChargeModal from '../charges/ChargeModal.jsx';
```

- [ ] **Step 2: Add `onOpenCharges` to props and headerProps**

In the `CustomerDetailPage` function signature (line 34), add `onOpenCharges` to the destructured props:

```js
export default function CustomerDetailPage({
  userId,
  userEmail,
  profile,
  identityKey,
  onExit,
  onBackToCustomers,
  onOpenBookings,
  onOpenAdmin,
  onOpenProfile,
  onOpenPaymentsConnect,
  onOpenCharges,
  onSignOut,
}) {
```

And add it to `headerProps` (around line 47):

```js
  const headerProps = {
    active: 'customers',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers: onBackToCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onOpenCharges,
    onSignOut,
  };
```

- [ ] **Step 3: Add charge modal state and charges data**

After the existing state declarations (around line 78), add:

```js
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [charges, setCharges] = useState([]);
  const [sites, setSites] = useState([]);
```

- [ ] **Step 4: Fetch charges and sites in the load effect**

Find the `useEffect` that fetches bookings and other data. Add charges and sites fetching. Look for the async load function and add:

```js
  // Fetch charges matching this customer's phone
  useEffect(() => {
    if (!userId) return;
    async function loadChargesAndSites() {
      const [chargesRes, sitesRes] = await Promise.all([
        supabase.from('charges').select('*').order('created_at', { ascending: false }),
        supabase.from('sites').select('id, scheduler_config').eq('user_id', userId).not('published_url', 'is', null),
      ]);
      setSites(sitesRes.data || []);
      setCharges(chargesRes.data || []);
    }
    loadChargesAndSites();
  }, [userId]);
```

- [ ] **Step 5: Compute customer's charges and services**

After the sites/charges state, add computed values (place these just before the `return` statement):

```js
  // Charges for this customer — match by phone (strip non-digits)
  const customerPhoneDigits = (meta?.phone || '').replace(/\D/g, '');
  const customerCharges = customerPhoneDigits
    ? charges.filter((c) => c.customer_phone?.replace(/\D/g, '') === customerPhoneDigits)
    : [];

  // Aggregate services from published sites
  const services = [];
  const seenSvcNames = new Set();
  for (const site of sites) {
    for (const svc of (site.scheduler_config?.services || [])) {
      if (svc.enabled !== false && !seenSvcNames.has(svc.name)) {
        seenSvcNames.add(svc.name);
        services.push(svc);
      }
    }
  }

  const fullyConnected = profile?.stripe_connect_account_id && profile?.stripe_connect_charges_enabled;
```

- [ ] **Step 6: Add Charge button next to existing action buttons**

Find where the "Book appointment" and "Send email" buttons are rendered. Add a Charge button next to them:

```jsx
              {fullyConnected && (
                <button
                  onClick={() => setShowChargeModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-sm font-semibold transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Charge $
                </button>
              )}
```

- [ ] **Step 7: Add charges history section near the bottom of the page**

Find where bookings are listed and add a Charges section below them:

```jsx
          {/* Charges history */}
          <div className="rounded-xl border border-black/[0.07] bg-white overflow-hidden shadow-sm mt-6">
            <div className="px-5 py-4 border-b border-black/[0.07]">
              <h2 className="font-bold text-[#1a1a1a] text-[15px]">Charges</h2>
            </div>
            {customerCharges.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#888]">
                No charges for this customer yet.
                {fullyConnected && (
                  <button
                    onClick={() => setShowChargeModal(true)}
                    className="block mx-auto mt-3 text-[#cc0000] font-semibold hover:underline text-sm"
                  >
                    Charge this customer →
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.07] bg-[#faf9f7]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Service</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customerCharges.map((charge, i) => (
                    <tr key={charge.id} className={i < customerCharges.length - 1 ? 'border-b border-black/[0.05]' : ''}>
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">
                        {charge.amount_cents != null ? `$${(charge.amount_cents / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#555]">{charge.service_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          charge.status === 'paid' ? 'bg-green-100 text-green-800' :
                          charge.status === 'expired' ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {charge.status === 'paid' ? 'Paid' : charge.status === 'expired' ? 'Expired' : 'Awaiting'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#888] hidden sm:table-cell">
                        {charge.created_at ? new Date(charge.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
```

- [ ] **Step 8: Add ChargeModal at bottom of return**

Just before the final closing `</div>` of the component's return, add:

```jsx
      {showChargeModal && (
        <ChargeModal
          profile={profile}
          services={services}
          prefillName={meta?.name || ''}
          prefillPhone={meta?.phone || ''}
          siteId={sites[0]?.id || null}
          onClose={() => {
            setShowChargeModal(false);
            // Refresh charges
            supabase.from('charges').select('*').order('created_at', { ascending: false })
              .then(({ data }) => setCharges(data || []));
          }}
        />
      )}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/customers-page/CustomerDetailPage.jsx
git commit -m "feat: add charge button and charges history to CustomerDetailPage"
```

---

## Task 11: Update `PaymentsConnectPage.jsx`

**Files:**
- Modify: `src/components/dashboard/payments-connect/PaymentsConnectPage.jsx`

- [ ] **Step 1: Add `onOpenCharges` to props**

Add `onOpenCharges` to the destructured props (after `onOpenPaymentsConnect`):

```js
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
  onOpenCharges,
  onSignOut,
}) {
```

And pass it through `headerProps`:

```js
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
    onOpenCharges,
    onSignOut,
  };
```

- [ ] **Step 2: Add "Charge a Customer" card in the fully-connected state**

Inside the `fullyConnected` branch (after the Stripe Dashboard link card, around line 137), add:

```jsx
            {/* Charge a customer */}
            <div className="rounded-xl border border-black/[0.07] bg-white p-6 shadow-sm mt-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#fef0f0] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#1a1a1a] text-[15px]">Charge a customer</p>
                  <p className="text-xs text-[#888]">Generate a payment link or QR code on the spot.</p>
                </div>
              </div>
              <button
                onClick={onOpenCharges}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-sm font-semibold transition-colors"
              >
                Charge $ →
              </button>
            </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/payments-connect/PaymentsConnectPage.jsx
git commit -m "feat: add charge CTA to PaymentsConnectPage"
```

---

## Task 12: Update `src/App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the import**

At the top of `src/App.jsx`, after the `PaymentsConnectPage` import, add:

```js
import ChargesPage from './components/dashboard/charges/ChargesPage.jsx';
```

- [ ] **Step 2: Add `charges` to the view union comment and add `goCharges` callback**

Find the view state declaration (around line 45):

```js
  const [view, setView] = useState('dashboard'); // 'wizard' | 'dashboard' | ... | 'payments-connect'
```

Update the comment:

```js
  const [view, setView] = useState('dashboard'); // 'wizard' | 'dashboard' | 'admin' | 'bookings-page' | 'customers' | 'customer-detail' | 'booking-settings' | 'profile' | 'payments-connect' | 'charges'
```

After the existing `goPaymentsConnect` callback (around line 252), add:

```js
  const goCharges = useCallback(() => { setView('charges'); }, []);
  const onOpenChargesProp = PAYMENTS_TAB_ENABLED ? goCharges : undefined;
```

- [ ] **Step 3: Add the `charges` view render block**

After the `payments-connect` view block (around line 519), add:

```jsx
  if (view === 'charges') {
    return (
      <>
        <ChargesPage
          userId={session?.user?.id}
          profile={profile}
          userEmail={session?.user?.email}
          onExit={() => setView('dashboard')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenCustomers={() => setView('customers')}
          onOpenCharges={() => {}}
          onOpenAdmin={() => setView('admin')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={onOpenPaymentsConnectProp}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }
```

- [ ] **Step 4: Wire `onOpenCharges` into every existing view**

For each of the following view blocks, add `onOpenCharges={onOpenChargesProp}` to the component props:

- `BookingsPage` (around line 394)
- `CustomersPage` (around line 413)
- `CustomerDetailPage` (around line 433) — also add the callback that clears `selectedCustomerKey`:
  ```js
  onOpenCharges={PAYMENTS_TAB_ENABLED ? () => { setSelectedCustomerKey(null); setView('charges'); } : undefined}
  ```
- `BookingSettingsPage` (around line 454)
- `AdminPage` (around line 472)
- `ProfilePage` (around line 488)
- `PaymentsConnectPage` (around line 504) — add `onOpenCharges={onOpenChargesProp}`
- `DashboardPage` (the dashboard render at the bottom) — add `onOpenCharges={onOpenChargesProp}`

Also find every `AppHeader` usage inside these pages and confirm `onOpenCharges` flows through their `headerProps`.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add charges view and wire onOpenCharges throughout App"
```

---

## Task 13: Smoke test end-to-end

- [ ] **Step 1: Run the dev server**

```bash
cd "C:/Users/mikec/Website Creator"
npm run dev
```

Expected: Vite starts on `http://localhost:5173`, no console errors.

- [ ] **Step 2: Verify AppHeader shows Charges nav + Charge $ button**

Log in as `mike.castellon5@gmail.com`. Confirm:
- "Charges" nav item appears between Customers and Payments
- A red "Charge $" button appears on the right side of the header

- [ ] **Step 3: Open the Charge modal and build a charge**

Click "Charge $" → modal opens. Select "Full Detail" from the service picker → customer name "Test Customer" → phone "5550001234" → click "Create Payment Link →". Expected: QR code appears in Step 2.

- [ ] **Step 4: Verify the charge row in Supabase**

```sql
SELECT id, status, amount_cents, customer_name, stripe_checkout_session_id
FROM charges
ORDER BY created_at DESC
LIMIT 1;
```

Expected: One row with `status = 'pending'`, `amount_cents = 14900`, `stripe_checkout_session_id` starting with `cs_live_`.

- [ ] **Step 5: Complete the payment**

Open the checkout URL in a browser, pay with a real card. Confirm the modal flips to Step 3 (green checkmark, "Payment received — $149.00") within 3–6 seconds.

- [ ] **Step 6: Verify the charges row updated**

```sql
SELECT status, paid_at FROM charges ORDER BY created_at DESC LIMIT 1;
```

Expected: `status = 'paid'`, `paid_at` is populated.

- [ ] **Step 7: Check ChargesPage**

Navigate to Charges in the nav — confirm the charge appears in the list with a green "Paid" badge.

- [ ] **Step 8: Build and deploy**

```bash
npm run build
git add -A
git commit -m "feat: charge customer — QR/SMS payment link flow"
git push origin master
```

Expected: build succeeds with no errors, Netlify deploys.
