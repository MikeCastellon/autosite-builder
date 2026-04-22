const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const TOPICS = [
  'orders/paid',
  'subscription_contracts/update',
  'subscription_contracts/cancel',
];

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const setupKey = event.queryStringParameters?.setup_key;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || setupKey !== secret) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';
  const callback = `${process.env.MAIN_APP_URL}/.netlify/functions/shopify-subscription-webhook`;

  if (!domain || !adminToken) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_TOKEN' }) };
  }

  async function shopifyApi(path, init = {}) {
    const res = await fetch(`https://${domain}/admin/api/${apiVersion}${path}`, {
      ...init,
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!res.ok) throw Object.assign(new Error(`Shopify API ${path} -> ${res.status}`), { body });
    return body;
  }

  const results = [];

  const existing = (await shopifyApi('/webhooks.json'))?.webhooks || [];

  for (const topic of TOPICS) {
    const already = existing.find((w) => w.topic === topic && w.address === callback);
    if (already) {
      results.push({ topic, status: 'exists', id: already.id });
      continue;
    }

    try {
      const created = await shopifyApi('/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({ webhook: { topic, address: callback, format: 'json' } }),
      });
      results.push({ topic, status: 'created', id: created?.webhook?.id });
    } catch (err) {
      results.push({ topic, status: 'error', error: err?.message, body: err?.body });
    }
  }

  const after = (await shopifyApi('/webhooks.json'))?.webhooks || [];
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ callback, results, webhooks: after.map((w) => ({ id: w.id, topic: w.topic, address: w.address })) }, null, 2),
  };
};
