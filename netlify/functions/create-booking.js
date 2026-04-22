import { createClient } from '@supabase/supabase-js';
import { validateBookingPayload } from './_lib/booking-validation.js';
import { newBookingToOwner } from './_lib/postmark.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Cheap in-memory rate limit: 5 submissions per IP per hour per site.
// Resets when the Lambda instance recycles — that's fine for MVP.
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
  if (v.honeypot) {
    // Silent success so bots don't get signal.
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }
  if (!v.ok) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: v.error }) };
  }

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip, payload.siteId)) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Re-check that the site exists and owner has scheduler enabled.
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info')
    .eq('id', payload.siteId)
    .maybeSingle();

  if (!site) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select('email, scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!owner?.scheduler_enabled) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Bookings not available for this site' }) };
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
    })
    .select()
    .single();

  if (insErr) {
    console.error('create-booking insert error:', insErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create booking' }) };
  }

  // Fire-and-forget email. Don't block the response on mail delivery.
  newBookingToOwner({ booking: inserted, site, ownerEmail: owner.email })
    .catch((err) => console.error('owner email failed:', err));

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, bookingId: inserted.id }) };
};
