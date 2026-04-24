// netlify/functions/_lib/stripe-event-handlers.js
import { mapStripeStatus } from './stripe-status-map.js';

// Core writer: given a subscription object + target profile, push canonical
// columns. Callers must resolve the profile id themselves (either from
// client_reference_id on the checkout session, or by customer lookup).
function subscriptionToProfilePatch(subscription) {
  const mapped = mapStripeStatus(subscription);
  const priceId = subscription?.items?.data?.[0]?.price?.id || null;
  return {
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_status: mapped.subscription_status,
    subscription_ends_at: mapped.subscription_ends_at,
    stripe_trial_ends_at: mapped.stripe_trial_ends_at,
    // New subscription → clear any stale failed-payment timestamp.
    stripe_first_failed_payment_at: null,
    subscription_updated_at: new Date(),
  };
}

// checkout.session.completed: new signup. client_reference_id is the user uuid
// (set in stripe-checkout-url.js). Fetch the full subscription, then write.
export async function handleCheckoutCompleted(event, { stripe, db }) {
  const session = event.data.object;
  const userId = session.client_reference_id;
  if (!userId || !session.subscription) return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const patch = subscriptionToProfilePatch(subscription);
  const { error } = await db.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// customer.subscription.{created,updated,deleted}: status changes over time.
// Profile is located by stripe_customer_id (already written during checkout).
export async function handleSubscriptionUpserted(event, { db }) {
  const subscription = event.data.object;
  if (!subscription.customer) return;

  const { data: profile, error: lookupErr } = await db
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!profile) return; // orphan event, nothing to do

  const patch = subscriptionToProfilePatch(subscription);
  // Do NOT clear first_failed_payment_at here — only succeeded/failed invoice events touch that.
  delete patch.stripe_first_failed_payment_at;

  const { error } = await db.from('profiles').update(patch).eq('id', profile.id);
  if (error) throw error;
}

// invoice.payment_failed: start the 7-day grace-period clock.
// Use .is('stripe_first_failed_payment_at', null) so we only set it ONCE per failure run;
// successive failures within the same dunning cycle do not reset the clock.
export async function handleInvoicePaymentFailed(event, { db }) {
  const invoice = event.data.object;
  if (!invoice.customer) return;
  const { error } = await db
    .from('profiles')
    .update({ stripe_first_failed_payment_at: new Date() })
    .eq('stripe_customer_id', invoice.customer)
    .is('stripe_first_failed_payment_at', null);
  if (error) throw error;
}

// invoice.payment_succeeded: dunning recovered, clear the grace-period clock.
export async function handleInvoicePaymentSucceeded(event, { db }) {
  const invoice = event.data.object;
  if (!invoice.customer) return;
  const { error } = await db
    .from('profiles')
    .update({ stripe_first_failed_payment_at: null })
    .eq('stripe_customer_id', invoice.customer);
  if (error) throw error;
}
