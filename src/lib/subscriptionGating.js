// Client mirror of netlify/functions/_lib/subscription-gating.js — keep in sync.
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

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
// Pro (no subscription, no Pro at no charge), else null: the app offers
// the upgrade to these accounts while the trial runs.
export function proTrialEndsAt(profile) {
  if (!trialRunning(profile)) return null;
  if (isEffectiveSchedulerActive({ ...profile, pro_trial_ends_at: null })) return null;
  return new Date(Date.parse(profile.pro_trial_ends_at));
}

// Stripe Checkout takes a trial end only 48 hours or more ahead; the extra
// hour covers clock drift between us and Stripe.
export const CHECKOUT_TRIAL_MIN_MS = 49 * 60 * 60 * 1000;

// Subscribing during a Pro trial: when the first charge will be (the
// trial's end; stripe-checkout-url sets it), so the free days left aren't lost. null when it should be
// now: no trial, Pro some other way, or too close to the end for Stripe.
export function checkoutTrialEnd(profile) {
  const ends = proTrialEndsAt(profile);
  return ends && ends.getTime() - Date.now() >= CHECKOUT_TRIAL_MIN_MS ? ends : null;
}

// Paywall testing allowlist — emails in VITE_PAYWALL_ALLOWLIST_EMAILS see the
// upgrade gate on Bookings even if they're admins or have scheduler_enabled.
// Lets us QA the Subscribe flow on production without exposing the paywall
// to anyone else. Leave env var empty to disable entirely.
export function isPaywallTestUser(email) {
  if (!email) return false;
  const raw = import.meta.env?.VITE_PAYWALL_ALLOWLIST_EMAILS || '';
  if (!raw) return false;
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(email).toLowerCase());
}

// Bookings nav link is visible to every signed-in user. The page itself is
// paywalled by SubscribeGate, so non-Pro users still hit the upgrade flow when
// they click through — they just see the link as a teaser.
export function canSeeBookingsNav(profile) {
  return !!profile;
}

// Dashboard-level gate check: should the upgrade card be shown INSTEAD of
// the Schedule/Settings tabs?
//   - Allowlisted test users: card unless they have an active subscription
//     (or cancelled w/ grace). Bypasses admin + scheduler_enabled for this
//     email only, so the paywall flow is testable on a live account.
//   - Everyone else: card only when they don't effectively have access.
//     In practice combined with `canSeeBookingsNav`, non-test non-qualifying
//     users never reach this page.
export function shouldShowUpgradeCard(profile) {
  if (!profile) return false;
  const hasSubAccess =
    profile.subscription_status === 'active' ||
    (profile.subscription_status === 'cancelled' &&
     profile.subscription_ends_at &&
     Date.parse(profile.subscription_ends_at) > Date.now()) ||
    (profile.subscription_status === 'past_due' &&
     (!profile.stripe_first_failed_payment_at ||
      Date.now() - Date.parse(profile.stripe_first_failed_payment_at) < 7 * 24 * 60 * 60 * 1000));
  if (isPaywallTestUser(profile.email)) {
    return !hasSubAccess;
  }
  return !isEffectiveSchedulerActive(profile);
}
