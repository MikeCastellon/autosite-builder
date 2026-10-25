// Pro trials (a free website's hand-over can include one, free-site-admin):
// which trial email an account is due. Pure, so the sweep's timing is
// testable. The account's Pro itself needs nothing from here: it ends with
// pro_trial_ends_at (isEffectiveSchedulerActive).
import { GATING_PROFILE_COLUMNS, isEffectiveSchedulerActive } from './subscription-gating.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// "Your trial ends soon" goes out this long before the end.
export const REMINDER_BEFORE_MS = 3 * DAY_MS;
// "Your trial has ended" only this soon after the end: a trial that ended
// long before the sweep saw it (the sweep was down, or the trial predates
// it) gets no late email.
export const ENDED_EMAIL_WITHIN_MS = 7 * DAY_MS;

// The profiles column that records each email, once per trial.
export const TRIAL_EMAIL_STAMPS = Object.freeze({
  ending: 'pro_trial_reminder_sent_at',
  ended: 'pro_trial_ended_sent_at',
});

// What trialEmailDue and the emails read from profiles.
export const TRIAL_PROFILE_COLUMNS =
  `id, email, first_name, business_name, ${GATING_PROFILE_COLUMNS}, pro_trial_reminder_sent_at, pro_trial_ended_sent_at`;

// 'ending', 'ended' or null. `profile` has TRIAL_PROFILE_COLUMNS.
export function trialEmailDue(profile, now = Date.now()) {
  const ends = Date.parse(profile?.pro_trial_ends_at || '');
  if (!Number.isFinite(ends) || !profile.email) return null;
  // Pro some other way (they upgraded, or were given Pro at no charge):
  // the trial ending changes nothing for them.
  if (isEffectiveSchedulerActive({ ...profile, pro_trial_ends_at: null })) return null;
  if (ends <= now) {
    return !profile.pro_trial_ended_sent_at && now - ends <= ENDED_EMAIL_WITHIN_MS ? 'ended' : null;
  }
  if (profile.pro_trial_reminder_sent_at || profile.pro_trial_ended_sent_at) return null;
  return ends - now <= REMINDER_BEFORE_MS ? 'ending' : null;
}
