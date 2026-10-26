// tests/functions/pro-trial-sweep.test.js
//
// Pro trial emails (a free website's hand-over can include Pro free for 30
// days): which email a trial is due (_lib/pro-trial.js), the hourly sweep
// that claims and sends each once, and the emails' wording. Supabase is an
// in-memory fake; Postmark is mocked.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ fail: null }));

vi.mock('../../netlify/functions/_lib/postmark.js', async (importOriginal) => {
  const real = await importOriginal();
  const send = (kind) => vi.fn(async (message) => {
    if (h.fail) throw h.fail;
    return { kind, message };
  });
  return { ...real, proTrialEnding: send('ending'), proTrialEnded: send('ended') };
});

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { trialEmailDue, REMINDER_BEFORE_MS, ENDED_EMAIL_WITHIN_MS } = await import('../../netlify/functions/_lib/pro-trial.js');
const { sweepProTrials, UPGRADE_URL } = await import('../../netlify/functions/pro-trial-sweep.js');

const NOW = Date.parse('2026-11-21T15:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();

function trialUser(id, endsAt, extra = {}) {
  return {
    id, email: `${id}@shop.test`, first_name: 'Dana', business_name: 'Gloss Boss',
    is_super_admin: false, scheduler_enabled: false, subscription_status: null, subscription_ends_at: null,
    stripe_first_failed_payment_at: null, pro_trial_ends_at: iso(endsAt),
    pro_trial_reminder_sent_at: null, pro_trial_ended_sent_at: null, ...extra,
  };
}

// Just enough of the PostgREST builder for the sweep: select with
// gte/lte/order/limit, update with eq/is/select. afterRead(state) runs once
// the sweep has read the trials (another run acting meanwhile).
function fakeDb(profiles, { afterRead } = {}) {
  const state = { profiles: structuredClone(profiles), updates: [] };
  const from = (table) => {
    if (table !== 'profiles') throw new Error(`unexpected table ${table}`);
    const q = { ops: [] };
    const api = {};
    for (const n of ['select', 'update', 'eq', 'is', 'gte', 'lte', 'order', 'limit']) {
      api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    }
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  function run(q) {
    const t = (v) => (v ? Date.parse(v) : NaN);
    const match = (r) => q.ops.every(([kind, c, v]) => {
      if (kind === 'eq') return r[c] === v;
      if (kind === 'is') return (r[c] ?? null) === v;
      if (kind === 'gte') return t(r[c]) >= t(v);
      if (kind === 'lte') return t(r[c]) <= t(v);
      return true;
    });
    const hits = state.profiles.filter(match);
    const update = q.ops.find((o) => o[0] === 'update');
    if (update) {
      hits.forEach((r) => Object.assign(r, update[1]));
      state.updates.push({ patch: update[1], ids: hits.map((r) => r.id) });
      return { data: hits.map((r) => ({ id: r.id })), error: null };
    }
    const data = structuredClone(hits);
    afterRead?.(state);
    return { data, error: null };
  }
  return { from, state };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.fail = null;
});

describe('trialEmailDue', () => {
  it('"ends soon" within 3 days of the end, "ended" for a week after', () => {
    expect(REMINDER_BEFORE_MS).toBe(3 * DAY);
    expect(ENDED_EMAIL_WITHIN_MS).toBe(7 * DAY);
    expect(trialEmailDue(trialUser('a', NOW + 10 * DAY), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW + 3 * DAY + HOUR), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW + 3 * DAY), NOW)).toBe('ending');
    expect(trialEmailDue(trialUser('a', NOW + HOUR), NOW)).toBe('ending');
    expect(trialEmailDue(trialUser('a', NOW), NOW)).toBe('ended');
    expect(trialEmailDue(trialUser('a', NOW - 6 * DAY), NOW)).toBe('ended');
    expect(trialEmailDue(trialUser('a', NOW - 8 * DAY), NOW)).toBeNull();
  });

  it('each email once per trial, and no "ends soon" after it ended', () => {
    expect(trialEmailDue(trialUser('a', NOW + DAY, { pro_trial_reminder_sent_at: iso(NOW - DAY) }), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW - DAY, { pro_trial_reminder_sent_at: iso(NOW - 3 * DAY) }), NOW)).toBe('ended');
    expect(trialEmailDue(trialUser('a', NOW - DAY, { pro_trial_ended_sent_at: iso(NOW - DAY) }), NOW)).toBeNull();
  });

  it('nothing for an account that has Pro some other way, or no address', () => {
    expect(trialEmailDue(trialUser('a', NOW + DAY, { subscription_status: 'active' }), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW - DAY, { subscription_status: 'active' }), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW - DAY, { scheduler_enabled: true }), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW - DAY, { is_super_admin: true }), NOW)).toBeNull();
    expect(trialEmailDue(trialUser('a', NOW - DAY, { email: null }), NOW)).toBeNull();
    expect(trialEmailDue({ email: 'x@shop.test', pro_trial_ends_at: null }, NOW)).toBeNull();
  });
});

describe('sweepProTrials', () => {
  it('sends each due email once, stamps it, and leaves the rest alone', async () => {
    const db = fakeDb([
      trialUser('soon', NOW + 2 * DAY),
      trialUser('ended', NOW - HOUR),
      trialUser('later', NOW + 20 * DAY),
      trialUser('payer', NOW + DAY, { subscription_status: 'active' }),
      trialUser('old', NOW - 30 * DAY),
    ]);
    const result = await sweepProTrials(db, NOW);
    expect(result).toEqual({ sent: [{ id: 'soon', kind: 'ending' }, { id: 'ended', kind: 'ended' }], failed: [] });
    expect(postmark.proTrialEnding).toHaveBeenCalledWith({
      to: 'soon@shop.test', firstName: 'Dana', businessName: 'Gloss Boss', endsAt: iso(NOW + 2 * DAY), upgradeUrl: UPGRADE_URL,
    });
    expect(postmark.proTrialEnded).toHaveBeenCalledWith(expect.objectContaining({ to: 'ended@shop.test' }));
    const byId = Object.fromEntries(db.state.profiles.map((p) => [p.id, p]));
    expect(byId.soon.pro_trial_reminder_sent_at).toBe(iso(NOW));
    expect(byId.ended.pro_trial_ended_sent_at).toBe(iso(NOW));
    expect(byId.later.pro_trial_reminder_sent_at).toBeNull();
    expect(byId.payer.pro_trial_reminder_sent_at).toBeNull();

    // The next run sends nothing again.
    vi.clearAllMocks();
    expect(await sweepProTrials(db, NOW + HOUR)).toEqual({ sent: [], failed: [] });
    expect(postmark.proTrialEnding).not.toHaveBeenCalled();
    expect(postmark.proTrialEnded).not.toHaveBeenCalled();
  });

  it('a failed send gives the claim back for the next run; a refused address does not', async () => {
    const db = fakeDb([trialUser('soon', NOW + 2 * DAY)]);
    h.fail = Object.assign(new Error('Postmark is down'), { code: 500 });
    expect((await sweepProTrials(db, NOW)).failed).toEqual([{ id: 'soon', kind: 'ending', error: 'Postmark is down' }]);
    expect(db.state.profiles[0].pro_trial_reminder_sent_at).toBeNull();

    h.fail = null;
    expect((await sweepProTrials(db, NOW + HOUR)).sent).toEqual([{ id: 'soon', kind: 'ending' }]);

    const bounced = fakeDb([trialUser('gone', NOW - HOUR)]);
    h.fail = Object.assign(new Error('Inactive recipient'), { code: 406 });
    await sweepProTrials(bounced, NOW);
    expect(bounced.state.profiles[0].pro_trial_ended_sent_at).toBe(iso(NOW));
  });

  it('skips an email another run already claimed, or a trial changed meanwhile', async () => {
    const claimed = fakeDb([trialUser('soon', NOW + 2 * DAY)], {
      afterRead: (state) => { state.profiles[0].pro_trial_reminder_sent_at = iso(NOW - HOUR); },
    });
    expect(await sweepProTrials(claimed, NOW)).toEqual({ sent: [], failed: [] });

    const regiven = fakeDb([trialUser('soon', NOW + 2 * DAY)], {
      afterRead: (state) => { state.profiles[0].pro_trial_ends_at = iso(NOW + 30 * DAY); },
    });
    expect(await sweepProTrials(regiven, NOW)).toEqual({ sent: [], failed: [] });
    expect(regiven.state.profiles[0].pro_trial_reminder_sent_at).toBeNull();
    expect(postmark.proTrialEnding).not.toHaveBeenCalled();
  });
});

describe('trial emails', () => {
  it('"ends soon" names the day, what stops, and links to the upgrade', () => {
    const m = postmark.proTrialEndingEmail({ firstName: 'Dana', businessName: 'Gloss Boss', endsAt: '2026-11-24T18:00:00Z', upgradeUrl: 'https://app.test/?upgrade=pro' });
    expect(m.subject).toBe('Your Pro trial ends Tuesday, November 24');
    expect(m.text).toContain('Online booking on your website switches off.');
    expect(m.text).toContain('Your website stays live on the free plan.');
    expect(m.html).toContain('href="https://app.test/?upgrade=pro"');
    expect(m.html).toContain('Keep Pro');
  });

  it('"has ended" says the site is still live and how to turn Pro back on', () => {
    const m = postmark.proTrialEndedEmail({ firstName: 'Dana', businessName: 'Gloss <Boss>', upgradeUrl: 'https://app.test/?upgrade=pro' });
    expect(m.subject).toBe('Your Pro trial has ended');
    expect(m.text).toContain('The Gloss <Boss> website is still live on the free plan.');
    expect(m.html).toContain('Gloss &lt;Boss&gt;');
    expect(m.html).toContain('Upgrade to Pro');
  });
});
