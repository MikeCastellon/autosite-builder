import { createClient } from '@supabase/supabase-js';
import { computeSlots } from './_lib/slot-math.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=30',
};

const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { siteId, date, serviceId } = event.queryStringParameters || {};
  if (!siteId || !date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing siteId or date' }) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid date (YYYY-MM-DD)' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, scheduler_enabled, scheduler_config')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || !site.scheduler_enabled) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots: [] }) };
  }

  const { data: owner } = await supabase
    .from('profiles').select('scheduler_enabled').eq('id', site.user_id).maybeSingle();
  if (!owner?.scheduler_enabled) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots: [] }) };
  }

  const cfg = site.scheduler_config || {};
  const leadMs = (cfg.lead_time_hours ?? 24) * 3600 * 1000;
  const granularityMin = cfg.slot_granularity_minutes ?? 30;

  const service = (cfg.services || []).find((s) => s.id === serviceId && s.enabled !== false);
  const durationMin = service?.duration_minutes
    ?? (cfg.services || []).find((s) => s.enabled !== false)?.duration_minutes
    ?? 60;

  const weekday = WEEKDAY_KEYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  const availability = (cfg.availability || {})[weekday] || [];

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const { data: confirmed } = await supabase
    .from('bookings')
    .select('preferred_at, service_id')
    .eq('site_id', siteId)
    .eq('status', 'confirmed')
    .gte('preferred_at', dayStart)
    .lte('preferred_at', dayEnd);

  const confirmedBookings = (confirmed || []).map((b) => {
    const bookedSvc = (cfg.services || []).find((s) => s.id === b.service_id);
    return {
      start: b.preferred_at,
      durationMin: bookedSvc?.duration_minutes ?? 60,
    };
  });

  let slots = computeSlots({
    dateISO: date,
    availability,
    serviceDurationMin: durationMin,
    granularityMin,
    confirmedBookings,
  });

  const earliest = Date.now() + leadMs;
  slots = slots.filter((iso) => Date.parse(iso) >= earliest);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots }) };
};
