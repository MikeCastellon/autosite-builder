import { createClient } from '@supabase/supabase-js';
import { verifyShopifyHmac } from './_lib/shopify-hmac.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Topic, X-Shopify-Hmac-Sha256',
  'Content-Type': 'application/json',
};

function ok(body) { return { statusCode: 200, headers: CORS, body: JSON.stringify(body) }; }
function fail(status, body) { return { statusCode: status, headers: CORS, body: JSON.stringify(body) }; }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const hmac = event.headers['x-shopify-hmac-sha256'] || event.headers['X-Shopify-Hmac-Sha256'];
  const topic = event.headers['x-shopify-topic'] || event.headers['X-Shopify-Topic'];

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!verifyShopifyHmac(rawBody, hmac, secret)) {
    console.warn('[shopify-webhook] HMAC verification failed', { topic });
    return fail(401, { error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody || '{}'); }
  catch { return fail(400, { error: 'Invalid JSON' }); }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (topic === 'orders/paid') {
      await handleOrderPaid(supabase, payload);
    } else if (topic === 'subscription_contracts/update') {
      await handleContractUpdate(supabase, payload);
    } else if (topic === 'subscription_contracts/cancel') {
      await handleContractCancel(supabase, payload);
    } else {
      console.warn('[shopify-webhook] unhandled topic:', topic);
    }
    return ok({ received: true });
  } catch (err) {
    console.error('[shopify-webhook] handler error', { topic, error: err?.message, stack: err?.stack });
    return ok({ received: true, error: err?.message });
  }
};

function userIdFromAttrs(arr) {
  if (!Array.isArray(arr)) return null;
  const m = arr.find((a) => a && (a.name === 'supabase_user_id' || a.key === 'supabase_user_id'));
  return m ? (m.value || null) : null;
}

async function findProfile(supabase, { userId, email, customerId }) {
  if (userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) return data;
  }
  if (customerId) {
    const { data } = await supabase.from('profiles').select('*').eq('shopify_customer_id', String(customerId)).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function handleOrderPaid(supabase, order) {
  const targetVariantId = process.env.SHOPIFY_SCHEDULER_VARIANT_ID;
  const lineItems = order?.line_items || [];
  const relevant = lineItems.find((li) => String(li.variant_id) === String(targetVariantId));
  if (!relevant) {
    console.log('[shopify-webhook] orders/paid — no scheduler line item, skipping');
    return;
  }

  const userId = userIdFromAttrs(order.note_attributes);
  const email = (order.email || order?.customer?.email || '').toLowerCase() || null;
  const customerId = order?.customer?.id || null;

  const profile = await findProfile(supabase, { userId, email, customerId });
  if (!profile) {
    console.warn('[shopify-webhook] orders/paid — no matching profile', { userId, email, customerId });
    return;
  }

  const subscriptionContractId = (order.subscription_contracts || [])[0]?.id ?? null;

  await supabase.from('profiles').update({
    subscription_status: 'active',
    subscription_ends_at: null,
    shopify_customer_id: customerId ? String(customerId) : profile.shopify_customer_id,
    shopify_subscription_id: subscriptionContractId ? String(subscriptionContractId) : profile.shopify_subscription_id,
    subscription_updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  console.log('[shopify-webhook] activated', { profileId: profile.id, customerId, subscriptionContractId });
}

async function handleContractUpdate(supabase, payload) {
  const status = String(payload.status || '').toLowerCase();
  const mapped = status === 'active' ? 'active' : (status === 'past_due' || status === 'failed') ? 'past_due' : null;
  if (!mapped) {
    console.log('[shopify-webhook] contract/update — unmapped status, skipping:', status);
    return;
  }

  const customerId = payload?.customer_id || payload?.customer?.id || null;
  const subscriptionId = payload?.id ? String(payload.id) : null;

  const profile = await findProfile(supabase, { customerId, userId: null, email: null });
  if (!profile) {
    console.warn('[shopify-webhook] contract/update — no matching profile', { customerId, subscriptionId });
    return;
  }

  await supabase.from('profiles').update({
    subscription_status: mapped,
    subscription_ends_at: null,
    shopify_subscription_id: subscriptionId || profile.shopify_subscription_id,
    subscription_updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  console.log('[shopify-webhook] contract/update applied', { profileId: profile.id, mapped });
}

async function handleContractCancel(supabase, payload) {
  const customerId = payload?.customer_id || payload?.customer?.id || null;
  const subscriptionId = payload?.id ? String(payload.id) : null;
  const endsAt = payload?.next_billing_date || payload?.ends_at || new Date().toISOString();

  const profile = await findProfile(supabase, { customerId, userId: null, email: null });
  if (!profile) {
    console.warn('[shopify-webhook] contract/cancel — no matching profile', { customerId, subscriptionId });
    return;
  }

  await supabase.from('profiles').update({
    subscription_status: 'cancelled',
    subscription_ends_at: endsAt,
    shopify_subscription_id: subscriptionId || profile.shopify_subscription_id,
    subscription_updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  console.log('[shopify-webhook] contract/cancel applied', { profileId: profile.id, endsAt });
}
