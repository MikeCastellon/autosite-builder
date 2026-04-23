import { createClient } from '@supabase/supabase-js';
import { validateBookingPayload } from './_lib/booking-validation.js';
import { newBookingToOwner, bookingReceivedToCustomer } from './_lib/postmark.js';
import { computeSlots } from './_lib/slot-math.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];

const rateBuckets = new Map();
function rateLimited(ip, siteId) {
  const key = `${ip}:${siteId}`;
  const now = Date.now();
  const arr = rateBuckets.get(key) || [];
  const recent = arr.filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 5) return true;
  recent.push(now);
  rateBuckets.set(key, recent);
  return false;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const v = validateBookingPayload(payload);
  if (v.honeypot) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  if (!v.ok) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: v.error }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip, payload.siteId)) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, scheduler_enabled, scheduler_config, slug, published_url, generated_content')
    .eq('id', payload.siteId)
    .maybeSingle();
  if (!site || !site.scheduler_enabled) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Bookings not available for this site' }) };
  }

  const { data: owner } = await supabase
    .from('profiles').select('email, scheduler_enabled').eq('id', site.user_id).maybeSingle();
  if (!owner?.scheduler_enabled) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Bookings not available for this site' }) };
  }

  const cfg = site.scheduler_config || {};
  const services = cfg.services || [];
  const enabledServices = services.filter((s) => s.enabled !== false);

  let chosenService = null;
  if (enabledServices.length > 1) {
    if (!payload.service_id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'service_id required' }) };
    }
    chosenService = enabledServices.find((s) => s.id === payload.service_id);
    if (!chosenService) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown or disabled service' }) };
    }
  } else if (enabledServices.length === 1) {
    chosenService = enabledServices[0];
  }

  const when = new Date(payload.preferred_at);
  const isSimple = cfg.booking_mode === 'simple' || payload.is_simple_request === true;

  // Simple mode: no calendar, preferred_at is a placeholder — skip all
  // slot / lead-time / availability validation. The owner will follow up
  // manually with the preferred_time_text the customer included.
  if (!isSimple) {
    const dateISO = when.toISOString().slice(0, 10);
    const weekday = WEEKDAY_KEYS[when.getUTCDay()];
    const availability = (cfg.availability || {})[weekday] || [];

    const leadMs = (cfg.lead_time_hours ?? 24) * 3600 * 1000;
    if (when.getTime() < Date.now() + leadMs) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Too close to now; please pick a later time.' }) };
    }

    const granularityMin = cfg.slot_granularity_minutes ?? 30;
    const durationMin = chosenService?.duration_minutes ?? 60;

    const { data: confirmed } = await supabase
      .from('bookings')
      .select('preferred_at, service_id')
      .eq('site_id', site.id)
      .eq('status', 'confirmed')
      .gte('preferred_at', `${dateISO}T00:00:00.000Z`)
      .lte('preferred_at', `${dateISO}T23:59:59.999Z`);

    const confirmedBookings = (confirmed || []).map((b) => {
      const s = services.find((sv) => sv.id === b.service_id);
      return { start: b.preferred_at, durationMin: s?.duration_minutes ?? 60 };
    });

    const validSlots = computeSlots({
      dateISO,
      availability,
      serviceDurationMin: durationMin,
      granularityMin,
      confirmedBookings,
    });

    if (!validSlots.includes(when.toISOString())) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'That time is no longer available. Please pick another.' }) };
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('bookings')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      status: 'pending',
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      preferred_at: payload.preferred_at,
      vehicle_make: payload.vehicle_make,
      vehicle_model: payload.vehicle_model,
      vehicle_year: payload.vehicle_year,
      vehicle_size: payload.vehicle_size,
      service_address: payload.service_address || null,
      notes: payload.notes || null,
      referral_source: payload.referral_source || null,
      service_id: chosenService?.id || null,
      service_name: chosenService?.name || null,
    })
    .select()
    .single();

  if (insErr) {
    console.error('create-booking insert error:', insErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create booking' }) };
  }

  newBookingToOwner({ booking: inserted, site, ownerEmail: owner.email })
    .catch((err) => console.error('owner email failed:', err));
  bookingReceivedToCustomer({ booking: inserted, site, isSimple })
    .catch((err) => console.error('customer email failed:', err));

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, bookingId: inserted.id }) };
};
