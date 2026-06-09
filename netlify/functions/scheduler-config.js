import { createClient } from '@supabase/supabase-js';
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';
import { buildSchedulerPayload } from './_lib/scheduler-payload.js';

// Public widget endpoint — called from scheduler.js injected on every
// customer's published site. Wide-open CORS by design.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  // Owner settings (theme, logo, services, availability) should reach
  // the customer-facing modal the moment they save — no republish, no
  // wait. Using no-cache + must-revalidate so every modal open hits the
  // DB directly. The endpoint is a single indexed lookup, cost is fine.
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
};

function disabled() {
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ enabled: false }) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const siteId = event.queryStringParameters?.siteId;
  if (!siteId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing siteId' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, generated_content, template_id, site_type, scheduler_enabled, scheduler_config')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || !site.scheduler_enabled) return disabled();

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!isEffectiveSchedulerActive(profile)) return disabled();

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify(buildSchedulerPayload(site)),
  };
};
