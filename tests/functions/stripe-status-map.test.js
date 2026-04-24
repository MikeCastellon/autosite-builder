// tests/functions/stripe-status-map.test.js
import { describe, it, expect } from 'vitest';
import { mapStripeStatus } from '../../netlify/functions/_lib/stripe-status-map.js';

// Helper: fake a Stripe.Subscription shape with only the fields we read.
function sub({ status, current_period_end, trial_end, cancel_at_period_end = false }) {
  return { status, current_period_end, trial_end, cancel_at_period_end };
}

describe('mapStripeStatus', () => {
  it('trialing → active, trial_ends_at populated', () => {
    const trialEnd = Math.floor(Date.parse('2026-05-24T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'trialing', trial_end: trialEnd, current_period_end: trialEnd }));
    expect(r.subscription_status).toBe('active');
    expect(r.stripe_trial_ends_at.toISOString()).toBe('2026-05-24T00:00:00.000Z');
    expect(r.subscription_ends_at).toBeNull();
  });

  it('active (not cancelling) → active, no end date', () => {
    const periodEnd = Math.floor(Date.parse('2026-05-24T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'active', current_period_end: periodEnd }));
    expect(r.subscription_status).toBe('active');
    expect(r.subscription_ends_at).toBeNull();
    expect(r.stripe_trial_ends_at).toBeNull();
  });

  it('active + cancel_at_period_end → cancelled with end date', () => {
    const periodEnd = Math.floor(Date.parse('2026-06-01T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'active', current_period_end: periodEnd, cancel_at_period_end: true }));
    expect(r.subscription_status).toBe('cancelled');
    expect(r.subscription_ends_at.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('past_due → past_due', () => {
    const r = mapStripeStatus(sub({ status: 'past_due', current_period_end: 1 }));
    expect(r.subscription_status).toBe('past_due');
  });

  it('canceled (ended) → cancelled, ends_at = period_end', () => {
    const periodEnd = Math.floor(Date.parse('2026-04-01T00:00:00Z') / 1000);
    const r = mapStripeStatus(sub({ status: 'canceled', current_period_end: periodEnd }));
    expect(r.subscription_status).toBe('cancelled');
    expect(r.subscription_ends_at.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('incomplete / incomplete_expired / unpaid → inactive', () => {
    for (const status of ['incomplete', 'incomplete_expired', 'unpaid']) {
      const r = mapStripeStatus(sub({ status, current_period_end: 1 }));
      expect(r.subscription_status).toBe('inactive');
    }
  });
});
