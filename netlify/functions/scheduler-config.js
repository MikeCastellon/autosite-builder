import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
};

// Minimal fallback color map so scheduler.js can brand the button even before
// we thread through full template lookup. Expand as templates are added.
const TEMPLATE_FALLBACK_COLORS = {
  default: '#1a1a1a',
};

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
    .select('id, user_id, business_info, generated_content, template_id')
    .eq('id', siteId)
    .maybeSingle();

  if (!site) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ enabled: false }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  const enabled = !!profile?.scheduler_enabled;
  if (!enabled) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ enabled: false }) };
  }

  const businessName = site.business_info?.businessName || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor =
    customColors.primary ||
    customColors.accent ||
    TEMPLATE_FALLBACK_COLORS[site.template_id] ||
    TEMPLATE_FALLBACK_COLORS.default;

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ enabled: true, businessName, brandColor }),
  };
};
