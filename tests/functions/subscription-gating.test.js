import { describe, it, expect } from 'vitest';
import { GATING_PROFILE_COLUMNS, isEffectiveSchedulerActive, proTrialEndsAt } from '../../netlify/functions/_lib/subscription-gating.js';

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

describe('Pro trials (a free website hand-over)', () => {
  it('a running trial is Pro; an ended or unreadable one is not', () => {
    expect(isEffectiveSchedulerActive({ subscription_status: 'inactive', pro_trial_ends_at: FUTURE })).toBe(true);
    expect(isEffectiveSchedulerActive({ subscription_status: 'inactive', pro_trial_ends_at: PAST })).toBe(false);
    expect(isEffectiveSchedulerActive({ pro_trial_ends_at: 'not a date' })).toBe(false);
    expect(isEffectiveSchedulerActive({ pro_trial_ends_at: null })).toBe(false);
  });

  it('the booking functions read the trial with the other plan columns', () => {
    expect(GATING_PROFILE_COLUMNS.split(', ')).toContain('pro_trial_ends_at');
  });

  it('proTrialEndsAt only while the trial is the one thing giving Pro', () => {
    expect(proTrialEndsAt({ pro_trial_ends_at: FUTURE })?.toISOString()).toBe(FUTURE);
    expect(proTrialEndsAt({ pro_trial_ends_at: PAST })).toBeNull();
    expect(proTrialEndsAt({ pro_trial_ends_at: FUTURE, subscription_status: 'active' })).toBeNull();
    expect(proTrialEndsAt({ pro_trial_ends_at: FUTURE, scheduler_enabled: true })).toBeNull();
    expect(proTrialEndsAt({ pro_trial_ends_at: FUTURE, is_super_admin: true })).toBeNull();
    expect(proTrialEndsAt(null)).toBeNull();
  });

  it('the app mirror agrees', async () => {
    const client = await import('../../src/lib/subscriptionGating.js');
    for (const p of [
      { pro_trial_ends_at: FUTURE }, { pro_trial_ends_at: PAST }, { pro_trial_ends_at: FUTURE, subscription_status: 'active' },
      { pro_trial_ends_at: FUTURE, scheduler_enabled: true }, {},
    ]) {
      expect(client.isEffectiveSchedulerActive(p)).toBe(isEffectiveSchedulerActive(p));
      expect(client.proTrialEndsAt(p)?.toISOString() ?? null).toBe(proTrialEndsAt(p)?.toISOString() ?? null);
    }
  });
});
