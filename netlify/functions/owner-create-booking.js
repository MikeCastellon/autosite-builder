// netlify/functions/owner-create-booking.js
// Owner override path: skip ALL public-booking validation (availability,
// lead time, slot granularity, rate limits). Create the booking row with
// status='confirmed' directly. Optionally send the standard customer
// confirmation email.
//
// Auth: Bearer <access_token> — must be an authenticated Pro owner; we
// reject if the caller doesn't own the target site.
import { createClient } from '@supabase/supabase-js';
import { bookingReceivedToCustomer } from './_lib/postmark.js';
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return fail(400, { error: 'Invalid JSON' }); }

  const {
    siteId,
    customer_name,
    customer_email,
    customer_phone,
    preferred_at,            // ISO string
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_size,
    service_id,
    service_name,
    notes,
    send_email = true,
  } = payload;

  if (!siteId || !customer_name || !preferred_at) {
    return fail(400, { error: 'Missing required fields: siteId, customer_name, preferred_at' });
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  // Verify caller owns the site AND has Pro access.
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, scheduler_config, published_url')
    .eq('id', siteId)
    .maybeSingle();
  if (!site) return fail(404, { error: 'Site not found' });
  if (site.user_id !== user.id) return fail(403, { error: 'Forbidden' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });

  const { data: inserted, error: insErr } = await supabase
    .from('bookings')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      status: 'confirmed',
      customer_name,
      customer_email: customer_email || '',
      customer_phone: customer_phone || '',
      preferred_at,
      vehicle_make: vehicle_make || '',
      vehicle_model: vehicle_model || '',
      vehicle_year: vehicle_year ? Number(vehicle_year) : null,
      vehicle_size: vehicle_size || 'other',
      service_address: null,
      notes: notes || null,
      referral_source: 'owner-dashboard',
      service_id: service_id || null,
      service_name: service_name || null,
    })
    .select()
    .single();

  if (insErr) {
    console.error('owner-create-booking insert error:', insErr);
    return fail(500, { error: 'Failed to create booking' });
  }

  if (send_email && customer_email) {
    try {
      await bookingReceivedToCustomer({ booking: inserted, site, isSimple: false });
    } catch (err) {
      console.error('owner-create-booking customer email failed:', err);
      // non-fatal: booking is saved
    }
  }

  return ok({ ok: true, bookingId: inserted.id, booking: inserted });
};
