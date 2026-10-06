import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateBookingPayload } from './_lib/booking-validation.js';
import { newBookingToOwner, bookingReceivedToCustomer } from './_lib/postmark.js';
import { computeSlots, normalizeGranularity, normalizeLeadHours } from './_lib/slot-math.js';
import { isEffectiveSchedulerActive, GATING_PROFILE_COLUMNS } from './_lib/subscription-gating.js';
import { resolveShopTimeZone, shopNowWallMs } from './_lib/shop-time.js';
import { REQUESTED_TIME_PREFIX, requestedTimeText as requestedTimeFromNotes } from './_lib/booking-request.js';
import { getStripe } from './_lib/stripe.js';
import {
  computeDepositCents,
  computeTotalCents,
} from './_lib/deposit-math.js';
import {
  resolveVariant,
  addonPriceForVehicle,
  vehicleSizeFromTypeName,
  enabledVehicleTypes,
} from './_lib/vehicle-pricing.js';
import { checkAndRecordRateLimit, clientIp } from './_shared/rateLimit.js';
import { PUBLIC_CORS, PUBLIC_CORS_JSON } from './_shared/cors.js';

// Public widget endpoint — called from scheduler.js injected on every
// customer's published site. Uses wide-open CORS by design (each
// customer has their own domain). Rate limit + honeypot + validation
// are the actual guards.
const CORS = PUBLIC_CORS_JSON;

const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
const HOUR_MS = 3600 * 1000;

// Every request also emails the address it typed, so the limits cover the
// sender (per site and across all sites) and the recipient.
const LIMIT_PER_IP_PER_SITE = 5;
const LIMIT_PER_IP = 20;
const LIMIT_PER_EMAIL = 5;

const STALE_FORM_ERROR = 'This booking form was just updated. Please reload the page and try again.';

const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

function emailKey(email) {
  return createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

// Where Stripe sends the customer after the deposit page: back to the
// shop's own page, whose scheduler.js shows the outcome (acg_deposit).
// The app's /booking-confirmed pages are only the fallback for a site with
// no public address.
function depositReturnBase(site) {
  const custom = site.custom_domain && site.custom_domain_status === 'active_ssl'
    ? `https://www.${site.custom_domain}`
    : null;
  const base = custom || site.published_url;
  return typeof base === 'string' && /^https:\/\//.test(base) ? base.replace(/\/+$/, '') : null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: PUBLIC_CORS };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const v = validateBookingPayload(payload);
  if (v.honeypot) return reply(200, { ok: true });
  if (!v.ok) return reply(400, { error: v.error });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Postgres-backed rate limits (Security Audit H2 / CC-5), keyed by the IP
  // Netlify saw (clientIp: X-Forwarded-For alone could be made up per request).
  const ip = clientIp(event);
  const limits = [
    { ip, kind: `create-booking:${payload.siteId}`, limit: LIMIT_PER_IP_PER_SITE },
    { ip, kind: 'create-booking-ip', limit: LIMIT_PER_IP },
    { ip: emailKey(payload.customer_email), kind: 'create-booking-email', limit: LIMIT_PER_EMAIL },
  ];
  for (const l of limits) {
    const { limited } = await checkAndRecordRateLimit({ db: supabase, windowMs: HOUR_MS, ...l });
    if (limited) return reply(429, { error: 'Too many requests. Please try again later.' });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, site_type, business_info, scheduler_enabled, scheduler_config, slug, published_url, custom_domain, custom_domain_status, generated_content')
    .eq('id', payload.siteId)
    .maybeSingle();
  if (!site || !site.scheduler_enabled) {
    return reply(403, { error: 'Bookings not available for this site' });
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select(`email, ${GATING_PROFILE_COLUMNS}, stripe_connect_account_id, stripe_connect_charges_enabled`)
    .eq('id', site.user_id)
    .maybeSingle();
  if (!isEffectiveSchedulerActive(owner)) {
    return reply(403, { error: 'Bookings not available for this site' });
  }

  const cfg = site.scheduler_config || {};

  // The owner's saved mode decides which checks apply, never the request:
  // `is_simple_request` once skipped the slot, lead-time and opening-hours
  // checks for any site. It now only tells a request form apart, and one
  // left open while the owner switched to the calendar must reload.
  const isRequestMode = cfg.booking_mode === 'simple';
  if (payload.is_simple_request === true && !isRequestMode) {
    return reply(409, { error: STALE_FORM_ERROR, code: 'reload_required' });
  }
  const isTimeRequest = isRequestMode && payload.is_simple_request === true;

  const services = cfg.services || [];
  const enabledServices = services.filter((s) => s.enabled !== false);

  let chosenService = null;
  if (enabledServices.length > 1) {
    if (!payload.service_id) {
      return reply(400, { error: 'Please pick a service.' });
    }
    chosenService = enabledServices.find((s) => s.id === payload.service_id);
    if (!chosenService) {
      return reply(400, { error: 'That service is no longer offered. Please reload the page and pick another.' });
    }
  } else if (enabledServices.length === 1) {
    chosenService = enabledServices[0];
  }

  // Per-vehicle pricing (Feature 2). vehicle_type_id is optional so cached
  // legacy widgets keep working; when present it must match an enabled type.
  const vehicleTypesCfg = enabledVehicleTypes(cfg.vehicle_types);
  let chosenVehicleType = null;
  if (payload.vehicle_type_id) {
    chosenVehicleType = vehicleTypesCfg.find((t) => t.id === payload.vehicle_type_id) || null;
    if (!chosenVehicleType) {
      return reply(400, { error: 'Unknown vehicle type' });
    }
  }
  const variant = chosenService ? resolveVariant(chosenService, chosenVehicleType?.id) : null;
  if (chosenService && chosenVehicleType && !variant) {
    return reply(400, { error: 'That service is not offered for the selected vehicle type' });
  }

  // Resolve + validate add-ons. The widget sends `addon_ids: [...]`.
  // We snapshot full add-on rows onto the booking so subsequent edits to
  // the owner's menu don't rewrite history. Unknown / disabled IDs are
  // rejected — the user wants the price to be accurate.
  const requestedAddonIds = [...new Set(Array.isArray(payload.addon_ids) ? payload.addon_ids : [])];
  let resolvedAddons = [];
  if (requestedAddonIds.length > 0) {
    if (!chosenService) {
      return reply(400, { error: 'add-ons require a service' });
    }
    const available = Array.isArray(chosenService.addons) ? chosenService.addons : [];
    for (const id of requestedAddonIds) {
      const match = available.find((a) => a.id === id && a.enabled !== false);
      if (!match) {
        return reply(400, { error: 'Unknown or disabled add-on' });
      }
      const addonPrice = addonPriceForVehicle(match, chosenVehicleType?.id);
      if (addonPrice == null) {
        return reply(400, { error: 'That add-on is not offered for the selected vehicle type' });
      }
      resolvedAddons.push({ id: match.id, name: match.name, price_cents: addonPrice });
    }
  }

  const servicePriceCentsValue = variant ? variant.price_cents : null;
  const bookedDurationMin = variant?.duration_minutes ?? null;
  const totalCents = computeTotalCents(servicePriceCentsValue, resolvedAddons);

  const shopNow = shopNowWallMs(resolveShopTimeZone(cfg, site.business_info));
  let preferredAt = payload.preferred_at;
  let notes = payload.notes || null;
  let requestedTimeText = null;

  if (isTimeRequest) {
    // Request form: no calendar. The customer's own words lead the notes
    // (the current form sends them apart; one loaded before this deploy
    // already put them there).
    requestedTimeText = (payload.preferred_time_text || '').trim() || null;
    if (requestedTimeText) {
      notes = REQUESTED_TIME_PREFIX + requestedTimeText + (notes ? `\n\n${notes}` : '');
    } else {
      requestedTimeText = requestedTimeFromNotes(notes);
    }
    if (!requestedTimeText) {
      return reply(400, { error: "Please tell us when you'd like to come in." });
    }
    // preferred_at is only a placeholder that keeps the request on the
    // owner's upcoming list for a week; the owner sets the real time when
    // confirming. Set here, never taken from the request.
    preferredAt = new Date(Math.floor((shopNow + 7 * 24 * HOUR_MS) / HOUR_MS) * HOUR_MS).toISOString();
  } else {
    const when = new Date(payload.preferred_at);
    const dateISO = when.toISOString().slice(0, 10);
    const weekday = WEEKDAY_KEYS[when.getUTCDay()];
    const availability = (cfg.availability || {})[weekday] || [];

    // Lead time from the shop's wall clock, like scheduler-slots.
    const leadMs = normalizeLeadHours(cfg.lead_time_hours) * HOUR_MS;
    if (when.getTime() < shopNow + leadMs) {
      return reply(400, { error: 'Too close to now; please pick a later time.' });
    }

    const granularityMin = normalizeGranularity(cfg.slot_granularity_minutes);
    const durationMin = bookedDurationMin ?? 60;

    const { data: confirmed } = await supabase
      .from('bookings')
      .select('preferred_at, service_id, duration_minutes')
      .eq('site_id', site.id)
      .eq('status', 'confirmed')
      .gte('preferred_at', `${dateISO}T00:00:00.000Z`)
      .lte('preferred_at', `${dateISO}T23:59:59.999Z`);

    const confirmedBookings = (confirmed || []).map((b) => {
      const s = services.find((sv) => sv.id === b.service_id);
      return { start: b.preferred_at, durationMin: b.duration_minutes ?? s?.duration_minutes ?? 60 };
    });

    const validSlots = computeSlots({
      dateISO,
      availability,
      serviceDurationMin: durationMin,
      granularityMin,
      confirmedBookings,
    });

    if (!validSlots.includes(when.toISOString())) {
      return reply(409, { error: 'That time is no longer available. Please pick another.' });
    }
    preferredAt = when.toISOString();
  }

  const { data: inserted, error: insErr } = await supabase
    .from('bookings')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      status: 'pending',
      customer_name: payload.customer_name.trim(),
      customer_email: payload.customer_email.trim(),
      customer_phone: payload.customer_phone.trim(),
      preferred_at: preferredAt,
      vehicle_make: payload.vehicle_make.trim(),
      vehicle_model: payload.vehicle_model.trim(),
      vehicle_year: Number(payload.vehicle_year),
      vehicle_size: chosenVehicleType ? vehicleSizeFromTypeName(chosenVehicleType.name) : payload.vehicle_size,
      service_address: payload.service_address || null,
      notes,
      referral_source: payload.referral_source || null,
      service_id: chosenService?.id || null,
      service_name: chosenService?.name || null,
      vehicle_type_id: chosenVehicleType?.id || null,
      vehicle_type_name: chosenVehicleType?.name || null,
      duration_minutes: chosenService ? bookedDurationMin : null,
      service_price_cents: servicePriceCentsValue,
      addons: resolvedAddons.length > 0 ? resolvedAddons : null,
      total_cents: totalCents,
    })
    .select()
    .single();

  if (insErr) {
    console.error('create-booking insert error:', insErr);
    return reply(500, { error: 'Failed to create booking' });
  }

  // Compute deposit if configured. Failures here are non-fatal — the booking
  // still exists; we just don't take a deposit. Deposit basis is the full
  // total (service + add-ons), so what the customer pays upfront matches
  // what they saw in the booking summary.
  let checkoutUrl = null;
  let depositRequiredCents = null;
  try {
    const pct = Number(cfg.deposit_percentage) || 0;
    depositRequiredCents = computeDepositCents(totalCents, pct);

    const connectReady = owner.stripe_connect_account_id && owner.stripe_connect_charges_enabled === true;

    if (depositRequiredCents && connectReady) {
      const stripe = getStripe();
      const returnBase = depositReturnBase(site);
      const appUrl = (process.env.MAIN_APP_URL || process.env.APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/+$/, '');
      const successUrl = returnBase
        ? `${returnBase}/?acg_deposit=paid`
        : `${appUrl}/booking-confirmed?booking=${inserted.id}`;
      const cancelUrl = returnBase
        ? `${returnBase}/?acg_deposit=cancelled`
        : `${appUrl}/booking-cancelled?booking=${inserted.id}`;
      const addonSummary = resolvedAddons.length > 0
        ? ` + ${resolvedAddons.length} add-on${resolvedAddons.length === 1 ? '' : 's'}`
        : '';

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: inserted.id,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: depositRequiredCents,
            product_data: {
              name: `Deposit — ${chosenService.name}${addonSummary}`,
              description: `Deposit toward your booking with ${site.business_info?.businessName || 'us'}.`,
            },
          },
          quantity: 1,
        }],
        payment_intent_data: {
          application_fee_amount: 200,            // $2 platform fee, in cents
          metadata: { booking_id: inserted.id },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: inserted.customer_email,
        metadata: { booking_id: inserted.id, site_id: site.id },
      }, {
        stripeAccount: owner.stripe_connect_account_id,
      });

      // The webhook matches the payment to this booking by the session id
      // stored here. If it can't be stored, don't send the customer to pay:
      // the payment could never be credited to the booking.
      const { error: depErr } = await supabase.from('bookings').update({
        deposit_required_cents: depositRequiredCents,
        deposit_status: 'pending',
        deposit_checkout_session_id: checkoutSession.id,
        deposit_application_fee_cents: 200,
      }).eq('id', inserted.id);
      if (depErr) {
        console.error('create-booking: could not record the deposit session, booking continues without a deposit:', depErr);
      } else {
        checkoutUrl = checkoutSession.url;
      }
    }
  } catch (err) {
    console.error('create-booking: deposit checkout creation failed:', err);
    // Booking proceeds without a deposit; do not return an error to the customer.
  }

  await Promise.allSettled([
    newBookingToOwner({ booking: inserted, site, ownerEmail: owner.email, requestedTimeText })
      .catch((err) => console.error('owner email failed:', err)),
    bookingReceivedToCustomer({ booking: inserted, site, isSimple: !!requestedTimeText })
      .catch((err) => console.error('customer email failed:', err)),
  ]);

  return reply(200, { ok: true, bookingId: inserted.id, checkout_url: checkoutUrl });
};
