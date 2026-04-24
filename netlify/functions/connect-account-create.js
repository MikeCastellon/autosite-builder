// netlify/functions/connect-account-create.js
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
const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  // Pro gate — reuse the same rule as the Bookings paywall.
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, stripe_connect_account_id, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return fail(404, { error: 'Profile not found' });
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });

  // Idempotent: if an account already exists, return it.
  if (profile.stripe_connect_account_id) {
    return ok({ account_id: profile.stripe_connect_account_id, existing: true });
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    controller: {
      fees: { payer: 'application' },
      losses: { payments: 'application' },
      stripe_dashboard: { type: 'express' },
      requirement_collection: 'stripe',
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    country: 'US',
    email: profile.email || user.email,
    metadata: { supabase_user_id: user.id },
  });

  await db.from('profiles').update({
    stripe_connect_account_id: account.id,
    stripe_connect_updated_at: new Date(),
  }).eq('id', user.id);

  return ok({ account_id: account.id, existing: false });
};
