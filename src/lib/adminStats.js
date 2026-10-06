// Numbers for the Admin workspace: who pays, how the customer base and the
// custom website builds are doing, and what needs a look today.
//
// Pure: the Admin Dashboard and the Customers tab hand it rows they loaded
// (listAllUsers, customSiteAdmin('list'), last-30-day bookings) and render
// what comes back. `now` is injectable so tests pin the date windows.
import { ALL_STAGES } from './customSiteForm.js';

// The DB stores no amount: Pro is $19.99/month in the UI copy
// (UpgradeProPanel.jsx / UpgradeFunnel.jsx).
export const PRO_MONTHLY_PRICE_CENTS = 1999;

// Mirrors isEffectiveSchedulerActive in subscriptionGating.js: a failed
// Stripe payment keeps Pro for 7 days from the first failure.
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = PAST_DUE_GRACE_DAYS * DAY_MS;

export const BILLING_KEYS = ['paying', 'trial', 'manual', 'comped', 'past_due', 'past_due_lapsed', 'cancelled_grace', 'cancelled', 'free', 'admin'];

const LABELS = {
  admin: 'Admin',
  comped: 'Comped Pro',
  trial: 'Trial',
  paying: 'Paying',
  manual: 'Pro (manual)',
  past_due: 'Past due',
  past_due_lapsed: 'Past due (lapsed)',
  cancelled_grace: 'Cancelling',
  cancelled: 'Cancelled',
  free: 'Free',
};

// Keys that come from a real subscription, so the row names where it is
// billed. Admin, comped and free accounts have nothing billing them, and
// 'manual' is by definition active without a billing record.
const SOURCED_KEYS = new Set(['trial', 'paying', 'past_due', 'past_due_lapsed', 'cancelled_grace', 'cancelled']);
const RENEWING_KEYS = new Set(['paying', 'trial', 'manual']);
const ACCESS_KEYS = new Set(['admin', 'comped', 'trial', 'paying', 'manual', 'past_due', 'cancelled_grace']);

// Date.parse that never throws and treats empty values as unknown (NaN).
function ms(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : Date.parse(value);
}

// Same style as the admin tables (formatShortDate in billingUi.jsx); the
// viewer's own time zone, since "access ends" means their calendar day.
function shortDate(iso) {
  const t = ms(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// Stripe first: a customer who moved from Shopify to Stripe keeps the old
// shopify_customer_id, and the Stripe subscription is the one that bills.
function sourceOf(profile) {
  if (profile?.stripe_subscription_id) return 'stripe';
  if (profile?.shopify_subscription_id || profile?.shopify_customer_id) return 'shopify';
  return null;
}

function keyOf(profile, nowMs) {
  if (profile?.is_super_admin) return 'admin';
  const status = profile?.subscription_status;
  // Pro granted by hand (sites.scheduler_enabled mirrored on the profile),
  // with no subscription paying for it.
  if (profile?.scheduler_enabled && status !== 'active') return 'comped';
  if (status === 'active') {
    if (ms(profile.stripe_trial_ends_at) > nowMs) return 'trial';
    return sourceOf(profile) ? 'paying' : 'manual';
  }
  if (status === 'past_due') {
    // Shopify keeps past_due without a failure timestamp and still grants
    // access, so a missing timestamp is "in grace", as in the gate. An
    // unreadable one is not (the gate's Number.isFinite check).
    if (!profile.stripe_first_failed_payment_at) return 'past_due';
    const failed = ms(profile.stripe_first_failed_payment_at);
    return Number.isFinite(failed) && nowMs - failed < GRACE_MS ? 'past_due' : 'past_due_lapsed';
  }
  if (status === 'cancelled') {
    return ms(profile.subscription_ends_at) > nowMs ? 'cancelled_grace' : 'cancelled';
  }
  return 'free';
}

// Billing status of one profile. First match wins: admin, comped, then the
// subscription status (active -> trial / paying / manual, past_due -> in or
// out of the grace window, cancelled -> before or after the end date), else
// free. `hasAccess` mirrors isEffectiveSchedulerActive.
export function billingStatusOf(profile, now = new Date()) {
  const key = keyOf(profile, ms(now));
  return {
    key,
    label: LABELS[key],
    source: SOURCED_KEYS.has(key) ? sourceOf(profile) : null,
    hasAccess: ACCESS_KEYS.has(key),
    renewsAt: RENEWING_KEYS.has(key) ? (profile?.subscription_current_period_end || null) : null,
    endsAt: profile?.subscription_ends_at || null,
  };
}

// ─── Customers tab filters ────────────────────────────────────────────

// The chips on Admin > Customers. The ids travel as onOpenAccounts(filterId)
// from the dashboard and as AdminAccountsTab's initialFilter: never rename.
// `keys` = the billing keys a chip shows; null = not a billing chip.
export const ACCOUNT_FILTERS = [
  { id: 'all',       label: 'All',            keys: null },
  { id: 'paying',    label: 'Paying',         keys: ['paying'] },
  // Active with no Stripe or Shopify subscription: not counted as paying
  // (nothing bills them), so it gets its own chip.
  { id: 'manual',    label: 'Pro (manual)',   keys: ['manual'] },
  { id: 'trial',     label: 'Trial',          keys: ['trial'] },
  { id: 'comped',    label: 'Comped',         keys: ['comped'] },
  { id: 'past_due',  label: 'Past due',       keys: ['past_due', 'past_due_lapsed'] },
  { id: 'cancelled', label: 'Cancelled',      keys: ['cancelled', 'cancelled_grace'] },
  { id: 'free',      label: 'Free',           keys: ['free'] },
  { id: 'live',      label: 'Live website',   keys: null },
  { id: 'connect',   label: 'Stripe Connect', keys: null },
  { id: 'admins',    label: 'Admins',         keys: ['admin'] },
];
export const ACCOUNT_FILTER_IDS = ACCOUNT_FILTERS.map((f) => f.id);

export function isAccountFilter(id) {
  return ACCOUNT_FILTER_IDS.includes(id);
}

// A published website. Booking-only pages are published too, but they are
// not websites and are counted on their own.
export function isLiveWebsite(site) {
  return !!site?.published_url && site.site_type !== 'booking_only';
}

export function hasLiveWebsite(user) {
  return (user?.sites || []).some(isLiveWebsite);
}

// Does this user belong under that chip? `status` = billingStatusOf(user),
// passed in so a list computes it once per row. Unknown ids match all.
export function matchesAccountFilter(filterId, user, status = billingStatusOf(user)) {
  switch (filterId) {
    case 'live': return hasLiveWebsite(user) && status.key !== 'admin';
    case 'connect': return !!user?.stripe_connect_charges_enabled;
    default: {
      const keys = ACCOUNT_FILTERS.find((f) => f.id === filterId)?.keys;
      return keys ? keys.includes(status.key) : true;
    }
  }
}

// The chip that lists a billing key (dashboard plan breakdown -> Customers).
export function accountFilterForKey(key) {
  return ACCOUNT_FILTERS.find((f) => f.keys?.includes(key))?.id || 'all';
}

// ─── Dashboard numbers ────────────────────────────────────────────────

const PAYING_LIST_KEYS = new Set(['paying', 'trial', 'manual', 'past_due', 'cancelled_grace']);
const CLOSED_STAGES = new Set(['live', 'on_hold', 'archived']);
const RECENT_SIGNUPS = 6;

function personName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return name || user?.business_name || user?.firstSiteName || user?.email || 'Unnamed account';
}

function projectName(p) {
  const client = [p?.client_first_name, p?.client_last_name].filter(Boolean).join(' ').trim();
  return p?.business_name || p?.client_name || client || p?.client_email || 'Unnamed project';
}

function count(list, fn) {
  let n = 0;
  for (const x of list) if (fn(x)) n += 1;
  return n;
}

// Everything the Admin Dashboard shows. Admin accounts and the sites they
// own are left out of every customer number: on the live data 61 of 112
// sites belong to admins (demos, tests, replicas), which would swamp the
// real picture.
export function computeAdminStats({ users = [], projects = null, bookings = null, now = new Date() } = {}) {
  const nowMs = ms(now);
  const within = (iso, days) => {
    const t = ms(iso);
    return Number.isFinite(t) && t >= nowMs - days * DAY_MS;
  };

  const all = Array.isArray(users) ? users.filter(Boolean) : [];
  const rows = all.map((user) => ({ user, status: billingStatusOf(user, now) }));
  const customerRows = rows.filter((r) => r.status.key !== 'admin');
  const customers = customerRows.map((r) => r.user);
  const adminIds = new Set(rows.filter((r) => r.status.key === 'admin').map((r) => r.user.id));
  const customerIds = new Set(customers.map((u) => u.id));

  // ── Accounts
  const siteCountOf = (u) => u.siteCount ?? (u.sites || []).length;
  const accounts = {
    customers: customers.length,
    admins: adminIds.size,
    signups7: count(customers, (u) => within(u.created_at, 7)),
    signups30: count(customers, (u) => within(u.created_at, 30)),
    withoutSite: count(customers, (u) => siteCountOf(u) === 0),
    withLiveSite: count(customers, hasLiveWebsite),
  };

  // ── Billing
  const byKey = {};
  for (const key of BILLING_KEYS) if (key !== 'admin') byKey[key] = 0;
  for (const { status } of customerRows) byKey[status.key] += 1;
  const paying = byKey.paying;
  const billing = {
    byKey,
    paying,
    payingStripe: count(customerRows, (r) => r.status.key === 'paying' && r.status.source === 'stripe'),
    payingShopify: count(customerRows, (r) => r.status.key === 'paying' && r.status.source === 'shopify'),
    // Only subscriptions that bill: a trial, a comp or a manual Pro brings in nothing.
    estMrrCents: paying * PRO_MONTHLY_PRICE_CENTS,
    withAccess: count(customerRows, (r) => r.status.hasAccess),
    conversionPct: customers.length ? Math.round((paying / customers.length) * 100) : 0,
  };

  // ── Sites (only customers' own; the user_id check is a second guard)
  const sites = customers.flatMap((u) => u.sites || []).filter((s) => s && !adminIds.has(s.user_id));
  const siteStats = {
    total: sites.length,
    published: count(sites, isLiveWebsite),
    // Live websites created in the last 30 days. Not published_at: that is
    // the LAST publish (every republish and Site upgrade re-stamps it) and
    // only exists since 2026-10-04.
    newLiveLast30: count(sites, (s) => isLiveWebsite(s) && within(s.created_at, 30)),
    bookingOnly: count(sites, (s) => s.site_type === 'booking_only'),
    customDomainsLive: count(sites, (s) => s.custom_domain_status === 'active_ssl'),
    customDomainsPending: count(sites, (s) => !!s.custom_domain && s.custom_domain_status !== 'active_ssl'),
  };

  // ── Custom websites (null: the admin function could not be reached)
  let customSites = null;
  const projectList = Array.isArray(projects) ? projects.filter(Boolean) : null;
  if (projectList) {
    const byStage = {};
    for (const s of ALL_STAGES) byStage[s.id] = 0;
    // Own keys only: `in` would also match 'toString' and friends.
    for (const p of projectList) if (Object.hasOwn(byStage, p.stage)) byStage[p.stage] += 1;
    customSites = {
      total: projectList.length,
      active: count(projectList, (p) => !CLOSED_STAGES.has(p.stage)),
      byStage,
      live: byStage.live,
      onHold: byStage.on_hold,
      archived: byStage.archived,
      paid: count(projectList, (p) => !!p.paid_at),
      unpaidLive: count(projectList, (p) => p.stage === 'live' && !p.paid_at),
      handedOver: count(projectList, (p) => !!p.handed_over_at),
      waiting: byStage.form_received,
    };
  }

  // ── Bookings. The caller asks for 30 days; rows older than that are
  // dropped here too so the number always means what its name says.
  let bookingStats = null;
  if (Array.isArray(bookings)) {
    bookingStats = {
      last30: count(bookings, (b) => {
        if (!b || !customerIds.has(b.owner_user_id)) return false;
        const t = ms(b.created_at);
        return !Number.isFinite(t) || t >= nowMs - 30 * DAY_MS;
      }),
    };
  }

  // ── Lists
  const dateOf = (status) => ms(status.renewsAt || status.endsAt);
  const payingList = customerRows
    .filter((r) => PAYING_LIST_KEYS.has(r.status.key))
    .sort((a, b) => {
      const rank = (r) => (r.status.key === 'paying' ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const da = dateOf(a.status);
      const db = dateOf(b.status);
      // Soonest first; rows with no date go to the end of their group.
      if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
      if (Number.isFinite(da)) return -1;
      if (Number.isFinite(db)) return 1;
      return 0;
    });

  const attention = [];
  const billingItem = (r, tone, detail) => attention.push({
    kind: 'billing', id: r.user.id, title: personName(r.user), detail, user: r.user, tone,
  });
  for (const r of customerRows) {
    if (r.status.key === 'past_due_lapsed') billingItem(r, 'red', 'Payment failed, Pro access has ended');
  }
  for (const r of customerRows) {
    if (r.status.key !== 'past_due') continue;
    const failed = ms(r.user.stripe_first_failed_payment_at);
    billingItem(r, 'amber', Number.isFinite(failed)
      ? `Payment failed, access ends ${shortDate(failed + GRACE_MS)}`
      : 'Payment failed, still has access');
  }
  for (const r of customerRows) {
    if (r.status.key === 'cancelled_grace') billingItem(r, 'amber', `Access ends ${shortDate(r.status.endsAt)}`);
  }
  for (const r of customerRows) {
    if (r.status.key === 'manual') billingItem(r, 'amber', 'Active with no Stripe or Shopify subscription');
  }
  const projectItem = (p, tone, detail) => attention.push({
    kind: 'project', id: p.id, title: projectName(p), detail, project: p, tone,
  });
  for (const p of projectList || []) {
    if (p.stage === 'form_received') projectItem(p, 'amber', 'Form received, ready to design');
  }
  for (const p of projectList || []) {
    if (p.stage === 'live' && !p.paid_at) projectItem(p, 'red', 'Live but not marked paid');
  }

  const recentSignups = [...customers]
    .sort((a, b) => (ms(b.created_at) || 0) - (ms(a.created_at) || 0))
    .slice(0, RECENT_SIGNUPS);

  return {
    accounts,
    billing,
    sites: siteStats,
    customSites,
    bookings: bookingStats,
    lists: { paying: payingList, attention, recentSignups },
  };
}
