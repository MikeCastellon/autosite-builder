import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
};

const TEMPLATE_FALLBACK_COLORS = { default: '#1a1a1a' };

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
    .select('id, user_id, business_info, generated_content, template_id, scheduler_enabled, scheduler_config')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || !site.scheduler_enabled) return disabled();

  const { data: profile } = await supabase
    .from('profiles')
    .select('scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!profile?.scheduler_enabled) return disabled();

  const businessName = site.business_info?.businessName || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor =
    customColors.primary ||
    customColors.accent ||
    TEMPLATE_FALLBACK_COLORS[site.template_id] ||
    TEMPLATE_FALLBACK_COLORS.default;

  const cfg = site.scheduler_config || {};
  const enabledServices = (cfg.services || []).filter((s) => s.enabled !== false);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      enabled: true,
      businessName,
      brandColor,
      welcome_text: cfg.welcome_text || "Tell us about your car and we'll be in touch.",
      button_label: cfg.button_label || 'Book Now',
      lead_time_hours: cfg.lead_time_hours ?? 24,
      slot_granularity_minutes: cfg.slot_granularity_minutes ?? 30,
      cta_selector: cfg.cta_selector || '',
      services: enabledServices.map((s) => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price ?? '',
        description: s.description ?? '',
      })),
      availability: cfg.availability || {},
    }),
  };
};
