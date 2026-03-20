import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE = process.env.CLOUDFLARE_ZONE_ID;
const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || 'yourdomain.com';

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

  // --- Auth ---
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authErr } = await supabase.auth.admin.getUser(token);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid session' }) };
  }

  // --- Parse body ---
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { siteId, htmlContent, slug, netlifyName, customDomain } = body;
  if (!siteId || !htmlContent || !slug || !netlifyName) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Verify site belongs to this user
  const { data: siteRow, error: siteErr } = await supabase
    .from('sites').select('id, netlify_site_id').eq('id', siteId).eq('user_id', user.id).single();
  if (siteErr || !siteRow) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  try {
    // --- Step 1: Create or reuse Netlify site ---
    let netlifySiteId = siteRow.netlify_site_id;
    let netlifySiteName;

    if (!netlifySiteId) {
      const createRes = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: netlifyName }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(`Netlify site creation failed: ${err.message || createRes.status}`);
      }
      const site = await createRes.json();
      netlifySiteId = site.id;
      netlifySiteName = site.name;
    } else {
      const siteRes = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}`, {
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` },
      });
      const site = await siteRes.json();
      netlifySiteName = site.name;
    }

    // --- Step 2: Deploy HTML via file-digest method ---
    const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
    const sha1 = crypto.createHash('sha1').update(htmlBuffer).digest('hex');

    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}/deploys`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { '/index.html': sha1 } }),
    });
    if (!deployRes.ok) throw new Error(`Netlify deploy init failed: ${deployRes.status}`);
    const deploy = await deployRes.json();

    // Upload the HTML file only if Netlify requires it (cache miss)
    if (deploy.required?.includes('/index.html')) {
      const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
        body: htmlBuffer,
      });
      if (!uploadRes.ok) throw new Error(`Netlify file upload failed: ${uploadRes.status}`);
    }

    // --- Step 3: Create Cloudflare CNAME (skip if already exists) ---
    const cnameTarget = `${netlifySiteName}.netlify.app`;
    const cfListRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?type=CNAME&name=${slug}.${PUBLISH_DOMAIN}`,
      { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } }
    );
    const cfList = await cfListRes.json();
    const existingRecord = cfList.result?.[0];

    if (!existingRecord) {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CNAME',
          name: slug,
          content: cnameTarget,
          proxied: false,
          ttl: 1,
        }),
      });
      if (!cfRes.ok) {
        const cfErr = await cfRes.json();
        console.error('Cloudflare DNS error:', cfErr);
        // Non-fatal: site is still accessible at netlify URL
      }
    }

    const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;
    const netlifyUrl = `https://${cnameTarget}`;

    // --- Step 4: Optional custom domain ---
    let cnameInstructions = null;
    if (customDomain) {
      const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_domain: customDomain }),
      });
      if (patchRes.ok) {
        cnameInstructions = {
          type: 'CNAME',
          name: customDomain.startsWith('www.') ? 'www' : '@',
          value: cnameTarget,
        };
      }
    }

    // --- Step 5: Update Supabase ---
    await supabase.from('sites').update({
      slug,
      published_url: publishedUrl,
      netlify_site_id: netlifySiteId,
      netlify_site_name: netlifySiteName,
      custom_domain: customDomain || null,
    }).eq('id', siteId);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ publishedUrl, netlifyUrl, cnameInstructions }),
    };

  } catch (err) {
    console.error('publish-site error:', err);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: err.message || 'Publish failed' }) };
  }
};
