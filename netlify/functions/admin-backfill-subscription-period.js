// One-time backfill helper: for every profile with subscription_status='active'
// and a non-null stripe_subscription_id, fetch the latest from Stripe and
// write subscription_current_period_end. Safe to re-run.
//
// Auth: super-admin JWT required. Run from the browser console with:
//   fetch('/.netlify/functions/admin-backfill-subscription-period', {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token}` },
//   }).then(r => r.json()).then(console.log)
//
// Once everyone's been backfilled, this function can be deleted — going
// forward, the regular Stripe webhook keeps the column up to date.
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing auth token' }) };
  }
  const token = auth.slice('Bearer '.length).trim();

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Verify super admin
  const { data: caller } = await supabaseAdmin.auth.getUser(token);
  if (!caller?.user?.id) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid auth' }) };
  }
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (!callerProfile?.is_super_admin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Super admin only' }) };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, stripe_subscription_id')
    .eq('subscription_status', 'active')
    .not('stripe_subscription_id', 'is', null);
  if (error) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
  }

  const results = [];
  for (const p of (profiles || [])) {
    try {
      const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_current_period_end: periodEnd })
        .eq('id', p.id);
      results.push({ id: p.id, email: p.email, subscription_current_period_end: periodEnd, ok: true });
    } catch (e) {
      results.push({ id: p.id, email: p.email, ok: false, error: e.message });
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, processed: results.length, results }),
  };
};
