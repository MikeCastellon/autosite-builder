// netlify/functions/create-charge.js
// Creates an in-person charge: inserts a charges row then creates a
// Stripe Checkout session on the owner's connected account.
import { createClient } from '@supabase/supabase-js';
import { getStripe } from './_lib/stripe.js';
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { servicePriceCents, computeTotalCents } from './_lib/deposit-math.js';

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const CORS = jsonHeaders(event.headers);
  const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });
  const ok   = (body)         => ({ statusCode: 200,    headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  const { data: profile } = await db
    .from('profiles')
    .select('id, stripe_connect_account_id, stripe_connect_charges_enabled, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return fail(404, { error: 'Profile not found' });
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });
  if (!profile.stripe_connect_account_id || !profile.stripe_connect_charges_enabled) {
    return fail(403, { error: 'Stripe account not connected or not ready' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return fail(400, { error: 'Invalid JSON' }); }

  const {
    amount_cents,
    service_name,
    customer_name,
    customer_phone,
    site_id,
    service_id,
    addon_ids,
  } = payload;

  // Add-on path: when the client picks a service + add-ons, we resolve them
  // server-side against the site's scheduler_config so prices can't be
  // tampered with. The client-supplied amount_cents is ignored in this case.
  let resolvedService = null;
  let resolvedAddons = [];
  let finalServiceName = service_name || null;
  let finalAmountCents = null;
  const requestedAddonIds = Array.isArray(addon_ids) ? addon_ids : [];

  if (service_id && site_id) {
    const { data: site } = await db
      .from('sites')
      .select('id, user_id, scheduler_config')
      .eq('id', site_id)
      .maybeSingle();
    if (!site) return fail(404, { error: 'Site not found' });
    if (site.user_id !== user.id) return fail(403, { error: 'Forbidden' });

    const services = (site.scheduler_config?.services) || [];
    resolvedService = services.find((s) => s.id === service_id) || null;
    if (!resolvedService) return fail(400, { error: 'Unknown service' });

    const available = Array.isArray(resolvedService.addons) ? resolvedService.addons : [];
    for (const id of requestedAddonIds) {
      const match = available.find((a) => a.id === id && a.enabled !== false);
      if (!match) return fail(400, { error: 'Unknown or disabled add-on' });
      resolvedAddons.push({
        id: match.id,
        name: match.name,
        price_cents: typeof match.price_cents === 'number' && match.price_cents > 0 ? match.price_cents : 0,
      });
    }

    const basePriceCents = servicePriceCents(resolvedService);
    if (basePriceCents == null) return fail(400, { error: 'Service has no chargeable price' });
    finalAmountCents = computeTotalCents(basePriceCents, resolvedAddons);
    finalServiceName = resolvedAddons.length > 0
      ? `${resolvedService.name} + ${resolvedAddons.length} add-on${resolvedAddons.length === 1 ? '' : 's'}`
      : resolvedService.name;
  } else {
    // Legacy path: client-supplied amount + free-text service name (custom
    // amount, or service picked without an id like the old flow).
    if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 50) {
      return fail(400, { error: 'amount_cents must be a number >= 50' });
    }
    finalAmountCents = amount_cents;
  }

  if (!finalAmountCents || finalAmountCents < 50) {
    return fail(400, { error: 'Total must be at least $0.50' });
  }

  // Insert the charge row first so we have an id for client_reference_id
  const { data: charge, error: insertErr } = await db.from('charges').insert({
    owner_user_id: user.id,
    site_id: site_id || null,
    customer_name: customer_name || null,
    customer_phone: customer_phone || null,
    service_name: finalServiceName,
    amount_cents: finalAmountCents,
    status: 'pending',
  }).select().single();

  if (insertErr) {
    console.error('[create-charge] insert error:', insertErr);
    return fail(500, { error: 'Failed to create charge record' });
  }

  const appUrl = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');

  // Build itemized line items so the Stripe Checkout receipt shows the
  // service + each add-on on its own row. Falls back to a single row for
  // the legacy custom-amount path.
  const lineItems = resolvedService
    ? [
        {
          price_data: {
            currency: 'usd',
            unit_amount: servicePriceCents(resolvedService),
            product_data: { name: resolvedService.name },
          },
          quantity: 1,
        },
        ...resolvedAddons.map((a) => ({
          price_data: {
            currency: 'usd',
            unit_amount: a.price_cents,
            product_data: { name: a.name },
          },
          quantity: 1,
        })),
      ]
    : [
        {
          price_data: {
            currency: 'usd',
            unit_amount: finalAmountCents,
            product_data: { name: finalServiceName || 'Service Payment' },
          },
          quantity: 1,
        },
      ];

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: charge.id,
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: 200,
        metadata: { charge_id: charge.id, type: 'charge' },
      },
      metadata: { type: 'charge', charge_id: charge.id },
      success_url: `${appUrl}?charge_success=1`,
      cancel_url:  `${appUrl}?charge_cancel=1`,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    }, {
      stripeAccount: profile.stripe_connect_account_id,
    });

    await db.from('charges').update({
      stripe_checkout_session_id: session.id,
    }).eq('id', charge.id);

    return ok({ charge_id: charge.id, checkout_url: session.url });
  } catch (err) {
    console.error('[create-charge] Stripe error:', err?.message || err);
    // Clean up the pending row so it doesn't litter the charges list
    await db.from('charges').delete().eq('id', charge.id);
    return fail(502, { error: err?.message || 'Failed to create payment link' });
  }
};
