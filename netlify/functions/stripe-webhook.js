// netlify/functions/stripe-webhook.js
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

  // We have two webhook endpoints in Stripe pointing at the same URL:
  //   - the platform endpoint (subscriptions, invoices, etc.) using STRIPE_WEBHOOK_SECRET
  //   - the Connect endpoint (account.updated for connected accounts) using STRIPE_CONNECT_WEBHOOK_SECRET
  // Each delivery is signed with its endpoint's own secret, so we try both
  // and accept whichever validates. This is Stripe's documented pattern when
  // a single function handles platform + Connect events.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter(Boolean);

  let stripeEvent;
  let lastErr;
  for (const secret of secrets) {
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, secret);
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!stripeEvent) {
    console.warn('[stripe-webhook] signature verification failed against all secrets:', lastErr?.message);
    return fail(400, { error: 'Invalid signature' });
  }

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (stripeEvent.type) {
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
      case 'account.updated':
        await handleAccountUpdated(stripeEvent, { db });
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
