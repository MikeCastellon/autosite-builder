// netlify/functions/_lib/stripe-status-map.js
// Pure mapping: Stripe subscription object → canonical columns.
// Does NOT touch the database.
//
// Output shape matches the `profiles` columns exactly:
//   subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled'
//   subscription_ends_at: Date | null           — when access lapses
//   stripe_trial_ends_at: Date | null           — display only
export function mapStripeStatus(subscription) {
  const { status, current_period_end, trial_end, cancel_at_period_end } = subscription;

  const periodEnd = current_period_end ? new Date(current_period_end * 1000) : null;
  const trialEnd = trial_end ? new Date(trial_end * 1000) : null;

  // Trial: grant access, record trial-end for UI
  if (status === 'trialing') {
    return {
      subscription_status: 'active',
      subscription_ends_at: null,
      stripe_trial_ends_at: trialEnd,
    };
  }

  // Active + user clicked Cancel in portal: flips cancel_at_period_end.
  // Keep access through period_end, then it naturally ends.
  if (status === 'active') {
    if (cancel_at_period_end) {
      return {
        subscription_status: 'cancelled',
        subscription_ends_at: periodEnd,
        stripe_trial_ends_at: null,
      };
    }
    return {
      subscription_status: 'active',
      subscription_ends_at: null,
      stripe_trial_ends_at: null,
    };
  }

  if (status === 'past_due') {
    return {
      subscription_status: 'past_due',
      subscription_ends_at: null,
      stripe_trial_ends_at: null,
    };
  }

  if (status === 'canceled') {
    return {
      subscription_status: 'cancelled',
      subscription_ends_at: periodEnd,
      stripe_trial_ends_at: null,
    };
  }

  // incomplete, incomplete_expired, unpaid, paused, etc.
  return {
    subscription_status: 'inactive',
    subscription_ends_at: null,
    stripe_trial_ends_at: null,
  };
}
