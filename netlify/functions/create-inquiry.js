import { createClient } from '@supabase/supabase-js';
import { validateInquiryPayload } from './_lib/inquiry-validation.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { PUBLIC_CORS, PUBLIC_CORS_JSON } from './_shared/cors.js';

// Public widget endpoint — called from contact-form.js injected on every
// customer's published site. Wide-open CORS by design (each customer has
// their own domain). Rate limit + honeypot + validation are the guards.
// Free for all sites: no subscription/scheduler gate, and no email is sent.
const CORS = PUBLIC_CORS_JSON;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: PUBLIC_CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const v = validateInquiryPayload(payload);
  if (v.honeypot) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  if (!v.ok) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: v.error }) };

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Postgres-backed rate limit: 5 inquiries per IP+site per hour. Fail-open.
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { limited } = await checkAndRecordRateLimit({
    db: supabase,
    ip,
    kind: `create-inquiry:${payload.siteId}`,
    windowMs: 60 * 60 * 1000,
    limit: 5,
  });
  if (limited) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, published_url')
    .eq('id', payload.siteId)
    .maybeSingle();
  // Only published sites accept inquiries. The contact widget is only injected
  // into published HTML; treat unpublished/unknown sites the same (404) so we
  // don't leak which site UUIDs exist.
  if (!site || !site.published_url) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  const { error: insErr } = await supabase
    .from('inquiries')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      message: payload.message,
    });

  if (insErr) {
    console.error('create-inquiry insert error:', insErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to submit inquiry' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
