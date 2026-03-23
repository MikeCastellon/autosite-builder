import { createClient } from '@supabase/supabase-js';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET = 'autosite-published';
const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || 'autocaregeniushub.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const CORS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId, htmlContent, slug } = body;
  if (!siteId || !htmlContent || !slug) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields (siteId, htmlContent, slug)' }) };
  }

  try {
    // --- Step 1: Upload HTML to Cloudflare R2 ---
    const r2Key = `${slug}/index.html`;
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(r2Key)}`;

    const uploadRes = await fetch(r2Url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CF_TOKEN}`,
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: htmlContent,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`R2 upload failed (${uploadRes.status}): ${errText}`);
    }

    const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;

    // --- Step 2: Update Supabase ---
    const { data: siteRow } = await supabase
      .from('sites').select('id').eq('id', siteId).maybeSingle();

    if (siteRow) {
      await supabase.from('sites').update({
        slug,
        published_url: publishedUrl,
      }).eq('id', siteId);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ publishedUrl }),
    };

  } catch (err) {
    console.error('publish-site error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message || 'Publish failed' }),
    };
  }
};
