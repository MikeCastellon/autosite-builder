import { createClient } from '@supabase/supabase-js';
import { computeSlots, normalizeGranularity, normalizeLeadHours } from './_lib/slot-math.js';
import { isEffectiveSchedulerActive, GATING_PROFILE_COLUMNS } from './_lib/subscription-gating.js';
import { resolveVariant } from './_lib/vehicle-pricing.js';
import { resolveShopTimeZone, shopNowWallMs } from './_lib/shop-time.js';

// Public widget endpoint — called from scheduler.js injected on every
// customer's published site (each on a different domain). Wide-open
// CORS by design; data exposed is just "is X minute slot free for site Y".
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=30',
};

const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noSlots = () => ({ statusCode: 200, headers: CORS, body: JSON.stringify({ slots: [] }) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { siteId, date, serviceId, vehicleTypeId } = event.queryStringParameters || {};
  if (!siteId || !date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing siteId or date' }) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid date (YYYY-MM-DD)' }) };
  }
  if (!UUID_RE.test(siteId)) return noSlots();

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, scheduler_enabled, scheduler_config')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || !site.scheduler_enabled) return noSlots();

  const { data: owner } = await supabase
    .from('profiles')
    .select(GATING_PROFILE_COLUMNS)
    .eq('id', site.user_id)
    .maybeSingle();
  if (!isEffectiveSchedulerActive(owner)) return noSlots();

  const cfg = site.scheduler_config || {};
  const leadMs = normalizeLeadHours(cfg.lead_time_hours) * 3600 * 1000;
  const granularityMin = normalizeGranularity(cfg.slot_granularity_minutes);

  const service = (cfg.services || []).find((s) => s.id === serviceId && s.enabled !== false)
    ?? (cfg.services || []).find((s) => s.enabled !== false)
    ?? null;
  const variant = resolveVariant(service, vehicleTypeId);
  // A not-offered service/vehicle combination has no bookable slots — agree
  // with create-booking's 400 instead of silently quoting 60-minute slots.
  if (service && vehicleTypeId && !variant) return noSlots();
  const durationMin = variant?.duration_minutes ?? 60;

  // Lead time counts from the shop's wall clock: slots are wall-clock times
  // written as UTC (see _lib/shop-time.js). create-booking checks the same.
  const earliest = shopNowWallMs(resolveShopTimeZone(cfg, site.business_info)) + leadMs;
  // A whole day before the lead-time boundary: nothing to compute or query.
  if (Date.parse(`${date}T23:59:59.999Z`) < earliest) return noSlots();

  const weekday = WEEKDAY_KEYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  const availability = (cfg.availability || {})[weekday] || [];

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const { data: confirmed } = await supabase
    .from('bookings')
    .select('preferred_at, service_id, duration_minutes')
    .eq('site_id', siteId)
    .eq('status', 'confirmed')
    .gte('preferred_at', dayStart)
    .lte('preferred_at', dayEnd);

  const confirmedBookings = (confirmed || []).map((b) => {
    const bookedSvc = (cfg.services || []).find((s) => s.id === b.service_id);
    return {
      start: b.preferred_at,
      durationMin: b.duration_minutes ?? bookedSvc?.duration_minutes ?? 60,
    };
  });

  let slots = computeSlots({
    dateISO: date,
    availability,
    serviceDurationMin: durationMin,
    granularityMin,
    confirmedBookings,
  });

  slots = slots.filter((iso) => Date.parse(iso) >= earliest);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots }) };
};
