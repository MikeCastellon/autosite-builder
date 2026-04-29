// netlify/functions/stripe-portal-url.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const json = jsonHeaders(event.headers);
  const fail = (status, body) => ({ statusCode: status, headers: json, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'GET') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  const { data: profile } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) return fail(404, { error: 'No billing account' });

  const stripe = getStripe();

  // Defense in depth (Security Audit H5): re-verify that the Stripe
  // customer we're about to issue a portal session for actually belongs
  // to this signed-in user. The stripe_customer_id in profiles is set
  // by webhooks; if a webhook bug or manual SQL fix ever flipped a row
  // to the wrong customer, the portal would let the wrong user manage
  // the subscription. The customer's metadata.supabase_user_id is the
  // orthogonal source-of-truth, written at customer creation in
  // stripe-checkout-url.js.
  let customer;
  try {
    customer = await stripe.customers.retrieve(profile.stripe_customer_id);
  } catch (err) {
    console.error('[stripe-portal-url] customer retrieve failed', err?.message || err);
    return fail(500, { error: 'Could not load billing account.' });
  }
  if (customer?.deleted) {
    return fail(404, { error: 'Billing account no longer exists.' });
  }
  const linkedUid = customer?.metadata?.supabase_user_id;
  if (linkedUid && linkedUid !== user.id) {
    console.error(
      `[stripe-portal-url] customer/user mismatch: profile.stripe_customer_id=${profile.stripe_customer_id} ` +
      `customer.metadata.supabase_user_id=${linkedUid} caller=${user.id}`,
    );
    return fail(403, { error: 'Billing account does not belong to this user.' });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.APP_URL}/dashboard`,
  });

  return { statusCode: 200, headers: json, body: JSON.stringify({ url: session.url }) };
};
