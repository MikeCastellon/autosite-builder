import { describe, it, expect } from 'vitest';
import { isEffectiveSchedulerActive } from '../../netlify/functions/_lib/subscription-gating.js';

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

describe('isEffectiveSchedulerActive', () => {
  it('returns false for fully inactive profile', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'inactive', subscription_ends_at: null,
    })).toBe(false);
  });

  it('returns true when is_super_admin', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: true, scheduler_enabled: false,
      subscription_status: 'inactive', subscription_ends_at: null,
    })).toBe(true);
  });

  it('returns true when scheduler_enabled direct toggle is on', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: true,
      subscription_status: 'inactive', subscription_ends_at: null,
    })).toBe(true);
  });

  it('returns true when subscription is active', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'active', subscription_ends_at: null,
    })).toBe(true);
  });

  it('returns true for cancelled within grace period', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'cancelled', subscription_ends_at: FUTURE,
    })).toBe(true);
  });

  it('returns false for cancelled past the end date', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'cancelled', subscription_ends_at: PAST,
    })).toBe(false);
  });

  it('returns true for past_due when no stripe failure timestamp (Shopify / webhook lag)', () => {
    expect(isEffectiveSchedulerActive({
      is_super_admin: false, scheduler_enabled: false,
      subscription_status: 'past_due', subscription_ends_at: FUTURE,
    })).toBe(true);
  });

  it('handles null/undefined profile defensively', () => {
    expect(isEffectiveSchedulerActive(null)).toBe(false);
    expect(isEffectiveSchedulerActive(undefined)).toBe(false);
    expect(isEffectiveSchedulerActive({})).toBe(false);
  });
});

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

describe('isEffectiveSchedulerActive — past_due grace period', () => {
  it('past_due within 7 days of first failure → true', () => {
    const profile = {
      subscription_status: 'past_due',
      stripe_first_failed_payment_at: new Date(Date.now() - (GRACE_MS - 3600_000)).toISOString(),
    };
    expect(isEffectiveSchedulerActive(profile)).toBe(true);
  });

  it('past_due past 7 days → false', () => {
    const profile = {
      subscription_status: 'past_due',
      stripe_first_failed_payment_at: new Date(Date.now() - (GRACE_MS + 3600_000)).toISOString(),
    };
    expect(isEffectiveSchedulerActive(profile)).toBe(false);
  });

  it('past_due with no failure timestamp → true (webhook not yet caught up)', () => {
    const profile = { subscription_status: 'past_due', stripe_first_failed_payment_at: null };
    expect(isEffectiveSchedulerActive(profile)).toBe(true);
  });
});
