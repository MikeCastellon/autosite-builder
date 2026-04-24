// netlify/functions/stripe-portal-url.js
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
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
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.APP_URL}/dashboard`,
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: session.url }) };
};
