// Scheduled hourly (netlify.toml). Emails customers whose Pro trial (from a
// free website's hand-over, free-site-admin) ends in the next few days, and
// again once it has ended. The trial itself needs no switching off: Pro
// ends with profiles.pro_trial_ends_at.
//
// Netlify runs it on its schedule on the published deploy only, and it has
// no public URL there. Each email is claimed by stamping its profiles
// column before it is sent, so a second run (or an overlapping one) never
// sends it again; a failed send gives the claim back for the next run.
import { supabaseAdmin } from './_shared/auth.js';
import {
  ENDED_EMAIL_WITHIN_MS, REMINDER_BEFORE_MS, TRIAL_EMAIL_STAMPS, TRIAL_PROFILE_COLUMNS, trialEmailDue,
} from './_lib/pro-trial.js';
import { proTrialEnded, proTrialEnding } from './_lib/postmark.js';

const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
// Opens the upgrade box once they're signed in (ProTrialBanner).
export const UPGRADE_URL = `${APP_URL}/?upgrade=pro`;

// Scheduled functions get 30 seconds; the rest go out next hour.
const MAX_PER_RUN = 25;

// Postmark refuses these for good (300 invalid address, 406 inactive
// recipient): keep the stamp so the sweep stops retrying.
const PERMANENT_POSTMARK_CODES = new Set([300, 406]);

export async function sweepProTrials(db, now = Date.now()) {
  const { data, error } = await db.from('profiles')
    .select(TRIAL_PROFILE_COLUMNS)
    .gte('pro_trial_ends_at', new Date(now - ENDED_EMAIL_WITHIN_MS).toISOString())
    .lte('pro_trial_ends_at', new Date(now + REMINDER_BEFORE_MS).toISOString())
    .order('pro_trial_ends_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(`Could not read trials: ${error.message}`);

  const due = (data || [])
    .map((profile) => ({ profile, kind: trialEmailDue(profile, now) }))
    .filter((d) => d.kind)
    .slice(0, MAX_PER_RUN);

  const result = { sent: [], failed: [] };
  for (const { profile, kind } of due) {
    const stamp = TRIAL_EMAIL_STAMPS[kind];
    const at = new Date(now).toISOString();
    // Same trial only: a new trial given meanwhile has its own end date.
    const { data: claimed, error: claimError } = await db.from('profiles')
      .update({ [stamp]: at })
      .eq('id', profile.id)
      .is(stamp, null)
      .eq('pro_trial_ends_at', profile.pro_trial_ends_at)
      .select('id');
    if (claimError) {
      result.failed.push({ id: profile.id, kind, error: claimError.message });
      continue;
    }
    if (!claimed?.length) continue;
    try {
      const send = kind === 'ending' ? proTrialEnding : proTrialEnded;
      await send({
        to: profile.email,
        firstName: profile.first_name,
        businessName: profile.business_name,
        endsAt: profile.pro_trial_ends_at,
        upgradeUrl: UPGRADE_URL,
      });
      result.sent.push({ id: profile.id, kind });
    } catch (e) {
      if (!PERMANENT_POSTMARK_CODES.has(Number(e?.code))) {
        const { error: releaseError } = await db.from('profiles').update({ [stamp]: null }).eq('id', profile.id).eq(stamp, at);
        if (releaseError) console.error(`[pro-trial-sweep] claim not released for ${profile.id}:`, releaseError.message);
      }
      result.failed.push({ id: profile.id, kind, error: e?.message || 'Email failed to send' });
    }
  }
  return result;
}

export const handler = async () => {
  try {
    const { sent, failed } = await sweepProTrials(supabaseAdmin());
    for (const f of failed) console.error(`[pro-trial-sweep] ${f.kind} email for ${f.id} not sent: ${f.error}`);
    console.log(`[pro-trial-sweep] sent=${sent.length} failed=${failed.length}`);
    return { statusCode: 200, body: JSON.stringify({ sent: sent.length, failed: failed.length }) };
  } catch (e) {
    console.error('[pro-trial-sweep] failed:', e?.message || e);
    return { statusCode: 500, body: 'sweep failed' };
  }
};
