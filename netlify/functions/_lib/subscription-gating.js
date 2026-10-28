// Single source of truth for "does this profile have scheduler access right now".
// Mirrored in src/lib/subscriptionGating.js — keep the two in sync.
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// Every profiles column isEffectiveSchedulerActive reads. Select exactly
// these: a missing stripe_first_failed_payment_at reads as "Shopify, no
// failure clock", which keeps a Stripe owner Pro forever after the grace
// period ends. scheduler-config and scheduler-slots once left it out, so the
// widget offered slots that create-booking (which had it) then refused.
export const GATING_PROFILE_COLUMNS =
  'is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at, pro_trial_ends_at';

export function isEffectiveSchedulerActive(profile) {
  if (!profile) return false;
  if (profile.is_super_admin) return true;
  if (profile.scheduler_enabled) return true;
  if (profile.subscription_status === 'active') return true;
  // A Pro trial (a free website's hand-over can include one): Pro until it
  // ends, then the free plan again.
  if (trialRunning(profile)) return true;
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

function trialRunning(profile) {
  const ends = profile?.pro_trial_ends_at ? Date.parse(profile.pro_trial_ends_at) : NaN;
  return Number.isFinite(ends) && ends > Date.now();
}

// The end of a running Pro trial when the trial is the only thing giving
// Pro (no subscription, no Pro at no charge), else null: the upgrade
// offer and the trial emails are for these accounts only.
export function proTrialEndsAt(profile) {
  if (!trialRunning(profile)) return null;
  if (isEffectiveSchedulerActive({ ...profile, pro_trial_ends_at: null })) return null;
  return new Date(Date.parse(profile.pro_trial_ends_at));
}

// Stripe Checkout takes a trial end only 48 hours or more ahead; the extra
// hour covers clock drift between us and Stripe.
export const CHECKOUT_TRIAL_MIN_MS = 49 * 60 * 60 * 1000;

// Subscribing during a Pro trial: when the first charge should be (the
// trial's end), so the free days left aren't lost. null when it should be
// now: no trial, Pro some other way, or too close to the end for Stripe.
export function checkoutTrialEnd(profile) {
  const ends = proTrialEndsAt(profile);
  return ends && ends.getTime() - Date.now() >= CHECKOUT_TRIAL_MIN_MS ? ends : null;
}
