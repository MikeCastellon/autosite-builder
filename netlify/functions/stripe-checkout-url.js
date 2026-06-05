// netlify/functions/stripe-checkout-url.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import { findBlockingSubscription } from './_lib/subscription-guard.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const CORS = jsonHeaders(event.headers);
  const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
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

  // Guard against duplicate subscriptions. Stripe does NOT dedupe — every
  // completed Checkout Session mints a new subscription, so a customer who
  // reaches checkout twice ends up billed twice in parallel. If this (existing)
  // customer already has a live subscription, don't create another checkout.
  if (customerId) {
    const existing = await findBlockingSubscription(stripe, customerId);
    if (existing) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          alreadySubscribed: true,
          error: 'You already have an active Genius Websites Pro subscription. Manage it from your account billing settings.',
        }),
      };
    }
  }

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
