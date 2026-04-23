import { deleteCustomHostname } from './_shared/cloudflare.js';
import { supabaseAdmin } from './_shared/auth.js';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET = 'autosite-published';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: '{"error":"Invalid JSON"}' }; }

  const { slug, siteId } = body;
  if (!slug) return { statusCode: 400, headers: CORS, body: '{"error":"Missing slug"}' };

  try {
    // Delete R2 object
    const r2Key = `${slug}/index.html`;
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(r2Key)}`;
    await fetch(r2Url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    });

    // Tear down custom hostnames if present
    if (siteId) {
      const admin = supabaseAdmin();
      const { data: site } = await admin.from('sites').select('custom_hostname_apex_id, custom_hostname_www_id').eq('id', siteId).maybeSingle();
      if (site) {
        const deletions = [];
        if (site.custom_hostname_apex_id) deletions.push(deleteCustomHostname(site.custom_hostname_apex_id).catch((e) => console.error(e)));
        if (site.custom_hostname_www_id)  deletions.push(deleteCustomHostname(site.custom_hostname_www_id).catch((e) => console.error(e)));
        await Promise.all(deletions);
      }
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
