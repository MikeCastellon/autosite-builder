import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_FILTERS, ACCOUNT_FILTER_IDS, BILLING_KEYS, PAST_DUE_GRACE_DAYS, PRO_MONTHLY_PRICE_CENTS,
  accountFilterForKey, billingStatusOf, computeAdminStats, isAccountFilter, matchesAccountFilter,
} from './adminStats.js';
import { ALL_STAGES, STAGE_IDS } from './customSiteForm.js';

// Noon UTC, so the dates in "Access ends <date>" are the same calendar day
// in every US (and most other) time zones the suite may run in.
const NOW = new Date('2026-10-05T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(NOW.getTime() + days * DAY).toISOString();
const ago = (days) => at(-days);

// A listAllUsers() row: profile columns + sites + the derived counts.
function user(id, profile = {}, sites = []) {
  const rows = sites.map((s, i) => ({ id: `${id}-s${i}`, user_id: id, business_info: {}, ...s }));
  return {
    id,
    email: `${id}@example.com`,
    created_at: ago(400),
    ...profile,
    sites: rows,
    siteCount: rows.length,
    publishedSiteCount: rows.filter((s) => s.published_url).length,
    firstPublishedUrl: rows.find((s) => s.published_url)?.published_url || null,
    firstSiteName: null,
    adminNotes: '',
    adminTags: [],
  };
}

const keyOf = (profile) => billingStatusOf(profile, NOW).key;

describe('constants', () => {
  it('prices Pro at $19.99 and mirrors the 7-day past-due grace', () => {
    expect(PRO_MONTHLY_PRICE_CENTS).toBe(1999);
    expect(PAST_DUE_GRACE_DAYS).toBe(7);
  });

  it('lists every billing key once', () => {
    expect(BILLING_KEYS).toEqual(['paying', 'trial', 'manual', 'comped', 'past_due', 'past_due_lapsed', 'cancelled_grace', 'cancelled', 'free', 'admin']);
  });
});

describe('billingStatusOf', () => {
  it('admin beats everything', () => {
    for (const extra of [
      {},
      { scheduler_enabled: true },
      { subscription_status: 'active', stripe_subscription_id: 'sub_1' },
      { subscription_status: 'past_due', stripe_first_failed_payment_at: ago(30) },
      { subscription_status: 'cancelled', subscription_ends_at: ago(30) },
    ]) {
      const s = billingStatusOf({ is_super_admin: true, ...extra }, NOW);
      expect(s.key).toBe('admin');
      expect(s.label).toBe('Admin');
      expect(s.source).toBeNull();
      expect(s.hasAccess).toBe(true);
    }
  });

  it('comped beats past_due, cancelled and free, but not active', () => {
    expect(keyOf({ scheduler_enabled: true })).toBe('comped');
    expect(keyOf({ scheduler_enabled: true, subscription_status: 'inactive' })).toBe('comped');
    expect(keyOf({ scheduler_enabled: true, subscription_status: 'past_due', stripe_first_failed_payment_at: ago(30) })).toBe('comped');
    expect(keyOf({ scheduler_enabled: true, subscription_status: 'cancelled', subscription_ends_at: ago(3) })).toBe('comped');
    expect(keyOf({ scheduler_enabled: true, subscription_status: 'cancelled', subscription_ends_at: at(3) })).toBe('comped');
    // A comp on top of a real subscription: the subscription is what bills.
    expect(keyOf({ scheduler_enabled: true, subscription_status: 'active', stripe_subscription_id: 'sub_1' })).toBe('paying');

    const s = billingStatusOf({ scheduler_enabled: true, subscription_status: 'cancelled', stripe_subscription_id: 'sub_1' }, NOW);
    expect(s).toMatchObject({ key: 'comped', label: 'Comped Pro', source: null, hasAccess: true, renewsAt: null });
  });

  it('active with a future trial end is a trial, billed where its subscription is', () => {
    const s = billingStatusOf({
      subscription_status: 'active',
      stripe_subscription_id: 'sub_1',
      stripe_trial_ends_at: at(5),
      subscription_current_period_end: at(5),
    }, NOW);
    expect(s).toEqual({ key: 'trial', label: 'Trial', source: 'stripe', hasAccess: true, renewsAt: at(5), endsAt: null });
  });

  it('a trial that ended (or ends right now) is paying', () => {
    const base = { subscription_status: 'active', stripe_subscription_id: 'sub_1' };
    expect(keyOf({ ...base, stripe_trial_ends_at: ago(1) })).toBe('paying');
    expect(keyOf({ ...base, stripe_trial_ends_at: NOW.toISOString() })).toBe('paying');
    expect(keyOf({ ...base, stripe_trial_ends_at: 'not a date' })).toBe('paying');
  });

  it('active with a Stripe subscription is paying via Stripe', () => {
    const s = billingStatusOf({
      subscription_status: 'active', stripe_subscription_id: 'sub_1', subscription_current_period_end: at(20), subscription_ends_at: null,
    }, NOW);
    expect(s).toEqual({ key: 'paying', label: 'Paying', source: 'stripe', hasAccess: true, renewsAt: at(20), endsAt: null });
  });

  it('active with a Shopify subscription or customer id is paying via Shopify', () => {
    expect(billingStatusOf({ subscription_status: 'active', shopify_subscription_id: 'gid://1' }, NOW))
      .toMatchObject({ key: 'paying', source: 'shopify', hasAccess: true });
    expect(billingStatusOf({ subscription_status: 'active', shopify_customer_id: '42' }, NOW))
      .toMatchObject({ key: 'paying', source: 'shopify' });
  });

  it('Stripe wins when a profile has both billing records', () => {
    expect(billingStatusOf({ subscription_status: 'active', stripe_subscription_id: 'sub_1', shopify_customer_id: '42' }, NOW).source)
      .toBe('stripe');
  });

  it('active with no billing record is manual', () => {
    const s = billingStatusOf({ subscription_status: 'active', subscription_current_period_end: at(9) }, NOW);
    expect(s).toEqual({ key: 'manual', label: 'Pro (manual)', source: null, hasAccess: true, renewsAt: at(9), endsAt: null });
  });

  it('past_due keeps access for 7 days from the first failure', () => {
    const pd = (failed) => billingStatusOf({ subscription_status: 'past_due', stripe_subscription_id: 'sub_1', stripe_first_failed_payment_at: failed }, NOW);
    expect(pd(null)).toMatchObject({ key: 'past_due', label: 'Past due', hasAccess: true, source: 'stripe', renewsAt: null });
    expect(pd(ago(0))).toMatchObject({ key: 'past_due', hasAccess: true });
    expect(pd(ago(6)).key).toBe('past_due');
    expect(pd(new Date(NOW.getTime() - 7 * DAY + 1).toISOString()).key).toBe('past_due');
    // The gate's check is strictly "less than 7 days".
    expect(pd(ago(7))).toMatchObject({ key: 'past_due_lapsed', label: 'Past due (lapsed)', hasAccess: false, source: 'stripe' });
    expect(pd(ago(8)).key).toBe('past_due_lapsed');
    expect(pd('garbage').key).toBe('past_due_lapsed');
  });

  it('Shopify past_due (no failure timestamp) is still in grace', () => {
    expect(billingStatusOf({ subscription_status: 'past_due', shopify_customer_id: '42' }, NOW))
      .toMatchObject({ key: 'past_due', source: 'shopify', hasAccess: true });
  });

  it('cancelled keeps access until subscription_ends_at', () => {
    const c = (endsAt) => billingStatusOf({ subscription_status: 'cancelled', stripe_subscription_id: 'sub_1', subscription_ends_at: endsAt }, NOW);
    expect(c(at(4))).toEqual({ key: 'cancelled_grace', label: 'Cancelling', source: 'stripe', hasAccess: true, renewsAt: null, endsAt: at(4) });
    expect(c(ago(4))).toEqual({ key: 'cancelled', label: 'Cancelled', source: 'stripe', hasAccess: false, renewsAt: null, endsAt: ago(4) });
    expect(c(NOW.toISOString()).key).toBe('cancelled');
    expect(c(null)).toMatchObject({ key: 'cancelled', endsAt: null });
  });

  it('anything else is free', () => {
    for (const p of [null, undefined, {}, { subscription_status: 'inactive' }, { subscription_status: null, stripe_subscription_id: 'sub_old' }]) {
      expect(billingStatusOf(p, NOW)).toEqual({ key: 'free', label: 'Free', source: null, hasAccess: false, renewsAt: null, endsAt: null });
    }
  });

  it('defaults now to the current time', () => {
    expect(billingStatusOf({ subscription_status: 'cancelled', subscription_ends_at: '2999-01-01T00:00:00Z' }).key).toBe('cancelled_grace');
    expect(billingStatusOf({ subscription_status: 'cancelled', subscription_ends_at: '2000-01-01T00:00:00Z' }).key).toBe('cancelled');
  });

  it('every key has its label and hasAccess mirrors the scheduler gate', () => {
    const cases = {
      admin: [{ is_super_admin: true }, 'Admin', true],
      comped: [{ scheduler_enabled: true }, 'Comped Pro', true],
      trial: [{ subscription_status: 'active', stripe_trial_ends_at: at(1) }, 'Trial', true],
      paying: [{ subscription_status: 'active', stripe_subscription_id: 's' }, 'Paying', true],
      manual: [{ subscription_status: 'active' }, 'Pro (manual)', true],
      past_due: [{ subscription_status: 'past_due' }, 'Past due', true],
      past_due_lapsed: [{ subscription_status: 'past_due', stripe_first_failed_payment_at: ago(10) }, 'Past due (lapsed)', false],
      cancelled_grace: [{ subscription_status: 'cancelled', subscription_ends_at: at(1) }, 'Cancelling', true],
      cancelled: [{ subscription_status: 'cancelled' }, 'Cancelled', false],
      free: [{}, 'Free', false],
    };
    expect(Object.keys(cases).sort()).toEqual([...BILLING_KEYS].sort());
    for (const [key, [profile, label, access]] of Object.entries(cases)) {
      expect(billingStatusOf(profile, NOW)).toMatchObject({ key, label, hasAccess: access });
    }
  });

  it('renewsAt only for paying, trial and manual; endsAt always passes through', () => {
    const period = { subscription_current_period_end: at(10), subscription_ends_at: at(10) };
    expect(billingStatusOf({ ...period, subscription_status: 'past_due' }, NOW)).toMatchObject({ renewsAt: null, endsAt: at(10) });
    expect(billingStatusOf({ ...period, subscription_status: 'cancelled' }, NOW)).toMatchObject({ renewsAt: null, endsAt: at(10) });
    expect(billingStatusOf({ ...period, scheduler_enabled: true }, NOW)).toMatchObject({ renewsAt: null });
    expect(billingStatusOf({ ...period, subscription_status: 'active' }, NOW)).toMatchObject({ key: 'manual', renewsAt: at(10) });
  });
});

describe('account filters', () => {
  it('keeps the ids the dashboard links to, in chip order', () => {
    expect(ACCOUNT_FILTER_IDS).toEqual(['all', 'paying', 'manual', 'trial', 'comped', 'past_due', 'cancelled', 'free', 'live', 'connect', 'admins']);
    expect(ACCOUNT_FILTERS.map((f) => f.label)).toEqual(['All', 'Paying', 'Pro (manual)', 'Trial', 'Comped', 'Past due', 'Cancelled', 'Free', 'Live website', 'Stripe Connect', 'Admins']);
    expect(isAccountFilter('paying')).toBe(true);
    for (const bad of ['pro', 'has_site', 'stripe', '', null, undefined, 'toString']) expect(isAccountFilter(bad)).toBe(false);
  });

  it('puts every billing key under exactly one billing chip', () => {
    for (const key of BILLING_KEYS) {
      const chips = ACCOUNT_FILTERS.filter((f) => f.keys?.includes(key));
      expect(chips).toHaveLength(1);
      expect(accountFilterForKey(key)).toBe(chips[0].id);
    }
    expect(accountFilterForKey('paying')).toBe('paying');
    // Not paying: nothing bills a manual Pro, so it has its own chip and the
    // Paying chip shows the same count as the dashboard's Paying card.
    expect(accountFilterForKey('manual')).toBe('manual');
    expect(accountFilterForKey('past_due_lapsed')).toBe('past_due');
    expect(accountFilterForKey('cancelled_grace')).toBe('cancelled');
    expect(accountFilterForKey('admin')).toBe('admins');
    expect(accountFilterForKey('nope')).toBe('all');
  });

  it('matches users by billing status, live site and Stripe Connect', () => {
    const payingLive = user('a', { subscription_status: 'active', stripe_subscription_id: 's' }, [{ published_url: 'https://a.example' }]);
    const manual = user('b', { subscription_status: 'active' });
    const lapsed = user('c', { subscription_status: 'past_due', stripe_first_failed_payment_at: ago(9) });
    const grace = user('d', { subscription_status: 'cancelled', subscription_ends_at: at(2) });
    const adminLive = user('e', { is_super_admin: true, stripe_connect_charges_enabled: true }, [{ published_url: 'https://e.example' }]);
    const free = user('f');
    const all = [payingLive, manual, lapsed, grace, adminLive, free];
    const ids = (filterId) => all.filter((u) => matchesAccountFilter(filterId, u, billingStatusOf(u, NOW))).map((u) => u.id);

    expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(ids('paying')).toEqual(['a']);
    expect(ids('manual')).toEqual(['b']);
    expect(ids('past_due')).toEqual(['c']);
    expect(ids('cancelled')).toEqual(['d']);
    expect(ids('free')).toEqual(['f']);
    expect(ids('trial')).toEqual([]);
    // An admin's demo site is not a customer's live site.
    expect(ids('live')).toEqual(['a']);
    expect(ids('connect')).toEqual(['e']);
    expect(ids('admins')).toEqual(['e']);
    expect(ids('unknown')).toEqual(ids('all'));
    // The status argument is optional.
    expect(matchesAccountFilter('manual', manual)).toBe(true);
    expect(matchesAccountFilter('paying', manual)).toBe(false);
  });
});

describe('computeAdminStats', () => {
  // The admin has demo sites, a lapsed card and a fresh signup date: none of
  // it may reach a customer number.
  const admin = user('admin', {
    is_super_admin: true, created_at: ago(0.5),
    subscription_status: 'past_due', stripe_subscription_id: 'sub_admin', stripe_first_failed_payment_at: ago(30),
  }, [
    { published_url: 'https://demo1.example', published_at: ago(1), custom_domain: 'demo1.com', custom_domain_status: 'active_ssl', site_type: 'website' },
    { published_url: 'https://demo2.example', published_at: ago(1), site_type: 'booking_only' },
    { published_url: 'https://demo3.example', published_at: ago(2), custom_domain: 'demo3.com', custom_domain_status: 'pending' },
  ]);
  const payStripe1 = user('payStripe1', {
    first_name: 'Ana', last_name: 'Diaz', created_at: ago(3),
    subscription_status: 'active', stripe_subscription_id: 'sub_1', subscription_current_period_end: at(20),
  }, [{ published_url: 'https://a.example', published_at: ago(5), created_at: ago(5), custom_domain: 'a.com', custom_domain_status: 'active_ssl', site_type: 'website' }]);
  const payStripe2 = user('payStripe2', {
    created_at: ago(40), subscription_status: 'active', stripe_subscription_id: 'sub_2', subscription_current_period_end: at(5),
  }, [{ published_url: 'https://b.example', published_at: ago(1), created_at: ago(40), site_type: 'website' }]);
  const payShopify = user('payShopify', {
    created_at: ago(100), subscription_status: 'active', shopify_customer_id: '42', subscription_current_period_end: at(10),
  }, [{ published_url: 'https://c.example', published_at: ago(29), created_at: ago(29), site_type: 'website' }]);
  const trialU = user('trialU', {
    created_at: ago(6), subscription_status: 'active', stripe_subscription_id: 'sub_t', stripe_trial_ends_at: at(3), subscription_current_period_end: at(3),
  }, [{ published_url: 'https://t.example', published_at: null, custom_domain: 't.com', custom_domain_status: null }]);
  const manualU = user('manualU', { business_name: 'Manual Motors', created_at: ago(8), subscription_status: 'active' });
  const compedU = user('compedU', { created_at: ago(200), scheduler_enabled: true });
  const pastDueU = user('pastDueU', {
    created_at: ago(20), subscription_status: 'past_due', stripe_subscription_id: 'sub_p', stripe_first_failed_payment_at: ago(2),
  });
  const lapsedU = user('lapsedU', {
    first_name: 'Lee', created_at: ago(31), subscription_status: 'past_due', stripe_subscription_id: 'sub_l', stripe_first_failed_payment_at: ago(10),
  });
  const graceU = user('graceU', {
    created_at: ago(29), subscription_status: 'cancelled', stripe_subscription_id: 'sub_g', subscription_ends_at: at(6),
  });
  const cancelledU = user('cancelledU', {
    created_at: ago(300), subscription_status: 'cancelled', stripe_subscription_id: 'sub_c', subscription_ends_at: ago(6),
  });
  const freeU1 = user('freeU1', { created_at: ago(1) });
  const freeU2 = user('freeU2', { created_at: ago(7) }, [
    { published_url: null, site_type: 'booking_only', custom_domain: 'd.com', custom_domain_status: 'pending' },
  ]);
  // Published 2 days ago, then unpublished: published_at stays behind.
  const unpublishedU = user('unpublishedU', { created_at: ago(15) }, [{ published_url: null, published_at: ago(2), site_type: 'website' }]);

  // Not in signup order, to prove the lists sort for themselves. manualU
  // comes before pastDueU: both have no billing date, so they keep this order.
  const USERS = [
    cancelledU, payShopify, admin, graceU, freeU2, manualU, payStripe2, pastDueU, lapsedU, trialU, payStripe1, compedU, freeU1, unpublishedU,
  ];

  const PROJECTS = [
    { id: 'p1', stage: 'new', business_name: 'One' },
    { id: 'p2', stage: 'invited', business_name: 'Two' },
    { id: 'p3', stage: 'form_received', business_name: 'Rivera Auto' },
    { id: 'p4', stage: 'form_received', business_name: '', client_name: 'Sam Lee' },
    { id: 'p5', stage: 'designing', business_name: 'Five', paid_at: ago(3) },
    { id: 'p6', stage: 'live', business_name: 'Six', paid_at: ago(30), handed_over_at: ago(2) },
    { id: 'p7', stage: 'live', client_first_name: 'Ana', client_last_name: 'Ruiz', client_email: 'ana@example.com' },
    { id: 'p8', stage: 'on_hold', business_name: 'Eight' },
    { id: 'p9', stage: 'archived', business_name: 'Nine', paid_at: ago(90) },
    { id: 'p10', stage: 'revisions', business_name: 'Ten' },
  ];

  const stats = computeAdminStats({ users: USERS, projects: PROJECTS, bookings: [], now: NOW });

  it('counts accounts without the admin', () => {
    expect(stats.accounts).toEqual({
      customers: 13,
      admins: 1,
      // 7 days back is inclusive (freeU2 joined exactly 7 days ago).
      signups7: 4,
      signups30: 8,
      withoutSite: 7,
      withLiveSite: 4,
    });
  });

  it('breaks billing down by key, with no admin bucket', () => {
    expect(stats.billing.byKey).toEqual({
      paying: 3, trial: 1, manual: 1, comped: 1, past_due: 1, past_due_lapsed: 1, cancelled_grace: 1, cancelled: 1, free: 3,
    });
    expect(Object.keys(stats.billing.byKey)).toEqual(BILLING_KEYS.filter((k) => k !== 'admin'));
    expect(stats.billing).toMatchObject({
      paying: 3,
      payingStripe: 2,
      payingShopify: 1,
      estMrrCents: 3 * 1999,
      withAccess: 8,
      conversionPct: 23, // 3 / 13 = 23.08%
    });
  });

  it('estimates MRR from paying subscriptions only', () => {
    const notBilling = [
      user('t', { subscription_status: 'active', stripe_trial_ends_at: at(4), stripe_subscription_id: 's' }),
      user('m', { subscription_status: 'active' }),
      user('c', { scheduler_enabled: true }),
      user('g', { subscription_status: 'cancelled', subscription_ends_at: at(4), stripe_subscription_id: 's' }),
      user('pd', { subscription_status: 'past_due', stripe_subscription_id: 's' }),
    ];
    expect(computeAdminStats({ users: notBilling, now: NOW }).billing.estMrrCents).toBe(0);
    const two = [...notBilling, user('p1', { subscription_status: 'active', stripe_subscription_id: 's' }), user('p2', { subscription_status: 'active', shopify_customer_id: '9' })];
    expect(computeAdminStats({ users: two, now: NOW }).billing.estMrrCents).toBe(3998);
  });

  it('rounds the conversion rate and is 0 without customers', () => {
    const paying = (id) => user(id, { subscription_status: 'active', stripe_subscription_id: 's' });
    expect(computeAdminStats({ users: [paying('a'), user('b'), user('c')], now: NOW }).billing.conversionPct).toBe(33);
    expect(computeAdminStats({ users: [paying('a'), paying('b'), user('c')], now: NOW }).billing.conversionPct).toBe(67);
    expect(computeAdminStats({ users: [paying('a'), user('b')], now: NOW }).billing.conversionPct).toBe(50);
    const onlyAdmins = computeAdminStats({ users: [admin], now: NOW });
    expect(onlyAdmins.accounts).toMatchObject({ customers: 0, admins: 1 });
    expect(onlyAdmins.billing).toMatchObject({ paying: 0, estMrrCents: 0, withAccess: 0, conversionPct: 0 });
    expect(onlyAdmins.sites.total).toBe(0);
  });

  it('counts customer sites only', () => {
    expect(stats.sites).toEqual({
      total: 6,
      published: 4,
      // Created in the last 30 days and live: a (5 days) and c (29 days). b
      // was republished yesterday but created 40 days ago, t has no date,
      // the unpublished one is down.
      newLiveLast30: 2,
      bookingOnly: 1,
      customDomainsLive: 1,
      customDomainsPending: 2,
    });
  });

  it('counts a live booking-only page apart from live websites', () => {
    const bookingOnly = user('bk', {}, [{ published_url: 'https://book.example', site_type: 'booking_only', created_at: ago(1) }]);
    const site = user('web', {}, [{ published_url: 'https://web.example', site_type: 'website', created_at: ago(1) }]);
    const out = computeAdminStats({ users: [bookingOnly, site], now: NOW });
    expect(out.sites.published).toBe(1);
    expect(out.sites.newLiveLast30).toBe(1);
    expect(out.sites.bookingOnly).toBe(1);
    expect(out.accounts.withLiveSite).toBe(1);
    expect(matchesAccountFilter('live', bookingOnly)).toBe(false);
    expect(matchesAccountFilter('live', site)).toBe(true);
  });

  it('never counts a site owned by an admin id, wherever it is listed', () => {
    const stray = user('cust', {}, [{ published_url: 'https://x.example', published_at: ago(1) }]);
    stray.sites[0].user_id = 'admin';
    const out = computeAdminStats({ users: [admin, stray], now: NOW });
    expect(out.sites.total).toBe(0);
    expect(out.sites.published).toBe(0);
  });

  it('summarises custom website projects by stage', () => {
    expect(stats.customSites).toEqual({
      total: 10,
      active: 6,
      byStage: {
        new: 1, invited: 1, form_started: 0, form_received: 2, designing: 1, in_review: 0, revisions: 1, live: 2, on_hold: 1, archived: 1,
      },
      live: 2,
      onHold: 1,
      archived: 1,
      paid: 3,
      unpaidLive: 1,
      handedOver: 1,
      waiting: 2,
    });
    expect(Object.keys(stats.customSites.byStage)).toEqual(STAGE_IDS);
    expect(STAGE_IDS).toEqual(ALL_STAGES.map((s) => s.id));
  });

  it('has no custom website stats when the projects could not be loaded', () => {
    expect(computeAdminStats({ users: USERS, projects: null, now: NOW }).customSites).toBeNull();
    expect(computeAdminStats({ users: USERS, now: NOW }).customSites).toBeNull();
    const empty = computeAdminStats({ users: USERS, projects: [], now: NOW }).customSites;
    expect(empty).toMatchObject({ total: 0, active: 0, live: 0, paid: 0, waiting: 0 });
    expect(Object.values(empty.byStage).every((n) => n === 0)).toBe(true);
  });

  it('ignores stages it does not know', () => {
    const out = computeAdminStats({ projects: [{ id: 'x', stage: 'toString' }, { id: 'y', stage: 'live', paid_at: ago(1) }], now: NOW }).customSites;
    expect(out.byStage.toString).toBe(Object.prototype.toString);
    expect(out.byStage.live).toBe(1);
    expect(Object.keys(out.byStage)).toEqual(STAGE_IDS);
  });

  it('counts the last 30 days of customer bookings only', () => {
    expect(computeAdminStats({ users: USERS, bookings: null, now: NOW }).bookings).toBeNull();
    expect(computeAdminStats({ users: USERS, now: NOW }).bookings).toBeNull();
    expect(stats.bookings).toEqual({ last30: 0 });
    const bookings = [
      { owner_user_id: 'payStripe1', created_at: ago(1) },
      { owner_user_id: 'payStripe1', created_at: ago(29) },
      { owner_user_id: 'admin', created_at: ago(1) },
      { owner_user_id: 'admin', created_at: ago(2) },
      { owner_user_id: 'admin', created_at: ago(3) },
      { owner_user_id: 'ghost', created_at: ago(1) },
      { owner_user_id: 'freeU1', created_at: ago(31) },
      { owner_user_id: 'freeU1' },
      null,
    ];
    expect(computeAdminStats({ users: USERS, bookings, now: NOW }).bookings).toEqual({ last30: 3 });
  });

  it('lists who pays: paying first, then by next bill or end date', () => {
    const rows = stats.lists.paying;
    expect(rows.map((r) => r.user.id)).toEqual([
      'payStripe2', 'payShopify', 'payStripe1', // paying, soonest bill first
      'trialU', 'graceU', // then the rest by date
      'manualU', 'pastDueU', // no date: last, in list order
    ]);
    expect(rows[0].status).toEqual(billingStatusOf(payStripe2, NOW));
    expect(rows.map((r) => r.status.key)).toEqual(['paying', 'paying', 'paying', 'trial', 'cancelled_grace', 'manual', 'past_due']);
    expect(rows.some((r) => r.user.id === 'admin')).toBe(false);
  });

  it('lists what needs attention: billing first, then projects', () => {
    const items = stats.lists.attention;
    expect(items.map((i) => [i.kind, i.id, i.tone])).toEqual([
      ['billing', 'lapsedU', 'red'],
      ['billing', 'pastDueU', 'amber'],
      ['billing', 'graceU', 'amber'],
      ['billing', 'manualU', 'amber'],
      ['project', 'p3', 'amber'],
      ['project', 'p4', 'amber'],
      ['project', 'p7', 'red'],
    ]);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.lapsedU).toMatchObject({ title: 'Lee', detail: 'Payment failed, Pro access has ended', user: lapsedU });
    // Failed 2 days ago: the 7-day grace runs out in 5 days.
    expect(byId.pastDueU).toMatchObject({ title: 'pastDueU@example.com', detail: 'Payment failed, access ends Oct 10, 26' });
    expect(byId.graceU.detail).toBe('Access ends Oct 11, 26');
    expect(byId.manualU).toMatchObject({ title: 'Manual Motors', detail: 'Active with no Stripe or Shopify subscription' });
    expect(byId.p3).toMatchObject({ title: 'Rivera Auto', detail: 'Form received, ready to design', project: PROJECTS[2] });
    expect(byId.p4.title).toBe('Sam Lee');
    expect(byId.p7).toMatchObject({ title: 'Ana Ruiz', detail: 'Live but not marked paid' });
    for (const i of items) {
      if (i.kind === 'billing') expect(i.project).toBeUndefined();
      else expect(i.user).toBeUndefined();
    }
    // The admin's lapsed card is not a customer problem.
    expect(items.some((i) => i.id === 'admin')).toBe(false);
  });

  it('says a Shopify past-due customer still has access', () => {
    const shop = user('shop', { subscription_status: 'past_due', shopify_customer_id: '7' });
    expect(computeAdminStats({ users: [shop], now: NOW }).lists.attention).toEqual([
      { kind: 'billing', id: 'shop', title: 'shop@example.com', detail: 'Payment failed, still has access', user: shop, tone: 'amber' },
    ]);
  });

  it('has no project items when the projects could not be loaded', () => {
    const items = computeAdminStats({ users: USERS, projects: null, now: NOW }).lists.attention;
    expect(items.every((i) => i.kind === 'billing')).toBe(true);
  });

  it('lists the 6 newest customer sign-ups, newest first', () => {
    expect(stats.lists.recentSignups.map((u) => u.id)).toEqual(['freeU1', 'payStripe1', 'trialU', 'freeU2', 'manualU', 'unpublishedU']);
    expect(stats.lists.recentSignups[0]).toBe(freeU1);
  });

  it('copes with nothing at all', () => {
    const out = computeAdminStats();
    expect(out.accounts).toEqual({ customers: 0, admins: 0, signups7: 0, signups30: 0, withoutSite: 0, withLiveSite: 0 });
    expect(out.billing).toMatchObject({ paying: 0, estMrrCents: 0, conversionPct: 0 });
    expect(out.customSites).toBeNull();
    expect(out.bookings).toBeNull();
    expect(out.lists).toEqual({ paying: [], attention: [], recentSignups: [] });
    expect(computeAdminStats({ users: null, now: NOW }).accounts.customers).toBe(0);
  });
});
