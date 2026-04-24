// Single source of truth for "does this profile have scheduler access right now".
// Mirrored in src/lib/subscriptionGating.js — keep the two in sync.
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isEffectiveSchedulerActive(profile) {
  if (!profile) return false;
  if (profile.is_super_admin) return true;
  if (profile.scheduler_enabled) return true;
  if (profile.subscription_status === 'active') return true;
  if (
    profile.subscription_status === 'cancelled' &&
    profile.subscription_ends_at &&
    Date.parse(profile.subscription_ends_at) > Date.now()
  ) {
    return true;
  }
  // 7-day grace period on failed payments (Stripe only — Shopify path keeps
  // status='past_due' without a failure timestamp and still grants access
  // until the webhook flips it to 'cancelled').
  if (profile.subscription_status === 'past_due') {
    if (!profile.stripe_first_failed_payment_at) return true;
    const firstFailureMs = Date.parse(profile.stripe_first_failed_payment_at);
    if (Number.isFinite(firstFailureMs) && Date.now() - firstFailureMs < GRACE_MS) return true;
    return false;
  }
  return false;
}
