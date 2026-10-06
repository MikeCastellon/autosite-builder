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
import { isEffectiveSchedulerActive, GATING_PROFILE_COLUMNS } from './_lib/subscription-gating.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { computeTotalCents } from './_lib/deposit-math.js';
import {
  resolveVariant,
  addonPriceForVehicle,
  vehicleSizeFromTypeName,
  enabledVehicleTypes,
} from './_lib/vehicle-pricing.js';

// bookings.preferred_at is the shop's wall-clock time written as UTC
// (slot-math.js, src/lib/bookings.js). The Book Customer dialog before that
// fix sent the browser's reading of the typed time as preferred_at instead
// (new Date(local).toISOString(), a real instant). Both look the same once
// stored, so a row from the old dialog would show hours late and block the
// wrong widget slot, and nothing could find it afterwards.
// So the current dialog sends the wall-clock time as shop_preferred_at, which
// is what is stored. A request without it comes from a dashboard tab loaded
// before the deploy (nothing reloads it) and is refused: the old dialog
// shows body.error under its form.
// The current dialog still sends the browser's reading as preferred_at,
// ignored here. It is for a rollback: the previous deploy's function stores
// preferred_at as sent and expects that reading, so a tab still running the
// current dialog after a rollback books the right time there too.
const STALE_DASHBOARD_ERROR =
  'The dashboard was updated. Please reload the page, then create this booking again (it was not saved).';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same caps as the public form (booking-validation.js FIELD_LIMITS).
const TEXT_LIMITS = {
  customer_name: 100, customer_email: 254, customer_phone: 40,
  vehicle_make: 60, vehicle_model: 60, notes: 2000,
};

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const CORS = jsonHeaders(event.headers);
  const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
  const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
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
    shop_preferred_at,       // ISO string, shop wall-clock time as UTC: stored
    preferred_at,            // the browser's reading (see above): not stored
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_size,
    vehicle_type_id,
    service_id,
    service_name,
    addon_ids,
    notes,
    send_email = true,
  } = payload;

  if (!siteId || !customer_name || !(shop_preferred_at || preferred_at)) {
    return fail(400, { error: 'Missing required fields: siteId, customer_name, preferred_at' });
  }
  if (typeof shop_preferred_at !== 'string' || !shop_preferred_at) {
    return fail(409, { error: STALE_DASHBOARD_ERROR, code: 'reload_required' });
  }
  if (Number.isNaN(Date.parse(shop_preferred_at))) {
    return fail(400, { error: 'Pick a valid date and time.' });
  }
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const v = payload[key];
    if (v == null || v === '') continue;
    if (typeof v !== 'string') return fail(400, { error: `Invalid ${key}` });
    if (v.length > max) return fail(400, { error: `${key.replace(/_/g, ' ')} is too long (${max} characters at most).` });
  }
  if (customer_email && !EMAIL_RE.test(customer_email)) {
    return fail(400, { error: 'Enter a valid email address, or leave it empty.' });
  }
  // bookings.vehicle_year is NOT NULL: a blank year used to fail the insert
  // with a bare "Failed to create booking".
  const year = Number(vehicle_year);
  if (vehicle_year == null || vehicle_year === '' || !Number.isInteger(year) || year < 1900 || year > 2100) {
    return fail(400, { error: "Enter the vehicle's year (1900 to 2100)." });
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
    .select(`email, ${GATING_PROFILE_COLUMNS}`)
    .eq('id', user.id)
    .maybeSingle();
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });

  // Resolve service + vehicle type so totals stay honest even when an owner
  // books on a customer's behalf. Owner path is lenient: a vehicle type the
  // service is disabled for still books at the base price (owner knows best),
  // and unknown/not-offered add-ons are skipped rather than rejected.
  const services = (site.scheduler_config?.services) || [];
  const chosenService = service_id ? services.find((s) => s.id === service_id) : null;
  const vehicleTypesCfg = enabledVehicleTypes(site.scheduler_config?.vehicle_types);
  const chosenVehicleType = vehicle_type_id
    ? vehicleTypesCfg.find((t) => t.id === vehicle_type_id) || null
    : null;
  const variant = chosenService
    ? (resolveVariant(chosenService, chosenVehicleType?.id) || resolveVariant(chosenService, null))
    : null;

  const requestedAddonIds = [...new Set(Array.isArray(addon_ids) ? addon_ids : [])];
  let resolvedAddons = [];
  if (requestedAddonIds.length > 0 && chosenService && Array.isArray(chosenService.addons)) {
    for (const id of requestedAddonIds) {
      const match = chosenService.addons.find((a) => a.id === id && a.enabled !== false);
      if (!match) continue;
      const addonPrice = addonPriceForVehicle(match, chosenVehicleType?.id);
      if (addonPrice == null) continue;
      resolvedAddons.push({ id: match.id, name: match.name, price_cents: addonPrice });
    }
  }
  const servicePriceCentsValue = variant ? variant.price_cents : null;
  const totalCents = computeTotalCents(servicePriceCentsValue, resolvedAddons);

  const { data: inserted, error: insErr } = await supabase
    .from('bookings')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      status: 'confirmed',
      customer_name,
      customer_email: customer_email || '',
      customer_phone: customer_phone || '',
      preferred_at: shop_preferred_at,
      vehicle_make: vehicle_make || '',
      vehicle_model: vehicle_model || '',
      vehicle_year: year,
      vehicle_size: chosenVehicleType ? vehicleSizeFromTypeName(chosenVehicleType.name) : (vehicle_size || 'other'),
      service_address: null,
      notes: notes || null,
      referral_source: 'owner-dashboard',
      service_id: chosenService?.id || service_id || null,
      service_name: chosenService?.name || service_name || null,
      vehicle_type_id: chosenVehicleType?.id || null,
      vehicle_type_name: chosenVehicleType?.name || null,
      duration_minutes: variant?.duration_minutes ?? null,
      service_price_cents: servicePriceCentsValue,
      addons: resolvedAddons.length > 0 ? resolvedAddons : null,
      total_cents: totalCents,
    })
    .select()
    .single();

  if (insErr) {
    console.error('owner-create-booking insert error:', insErr);
    return fail(500, { error: 'Failed to create booking' });
  }

  if (send_email && customer_email) {
    try {
      // Already confirmed: the email says "you're booked", not "we'll confirm".
      await bookingReceivedToCustomer({ booking: inserted, site, isSimple: false, confirmed: true });
    } catch (err) {
      console.error('owner-create-booking customer email failed:', err);
      // non-fatal: booking is saved
    }
  }

  return ok({ ok: true, bookingId: inserted.id, booking: inserted });
};
