// Client mirror of netlify/functions/_lib/subscription-gating.js — keep in sync.
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
  return false;
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
     Date.parse(profile.subscription_ends_at) > Date.now());
  if (isPaywallTestUser(profile.email)) {
    return !hasSubAccess;
  }
  return !isEffectiveSchedulerActive(profile);
}
