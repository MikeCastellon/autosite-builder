import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) };
  }
  const token = auth.slice(7);

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const variantId = process.env.SHOPIFY_SCHEDULER_VARIANT_ID;
  const sellingPlanId = process.env.SHOPIFY_SCHEDULER_SELLING_PLAN_ID;

  if (!domain || !variantId || !sellingPlanId) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: 'Shopify env vars missing on server' }),
    };
  }

  const params = new URLSearchParams({
    selling_plan: sellingPlanId,
    'checkout[email]': user.email || '',
    'attributes[supabase_user_id]': user.id,
  });
  const url = `https://${domain}/cart/${variantId}:1?${params.toString()}`;

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ url }) };
};
