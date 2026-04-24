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
