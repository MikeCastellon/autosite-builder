import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The page's data sources and the drawer's hooks. Static rendering never
// runs effects, so none of these is called; the mocks keep the imports
// away from the network and the auth client.
vi.mock('../../lib/supabase.js', () => ({ supabase: {}, isImpersonationTab: false }));
vi.mock('../../lib/adminUsers.js', () => ({
  listAllUsers: vi.fn(async () => []),
  listAllAdminTags: vi.fn(async () => []),
  getUserActivityCounts: vi.fn(async () => ({})),
  saveAdminUserMetadata: vi.fn(async () => ({})),
}));
vi.mock('../../lib/customSites.js', () => ({ customSiteAdmin: vi.fn(async () => ({ projects: [] })) }));
vi.mock('../ui/AlertProvider.jsx', () => ({ useAlert: () => ({ toast: () => {}, confirm: async () => true }) }));
vi.mock('../../lib/AuthContext.jsx', () => ({ useAuth: () => ({ profile: { id: 'admin-1', is_super_admin: true } }) }));

const { default: AdminDashboard, DashboardView, PLAN_CHIPS } = await import('./AdminDashboard.jsx');
const { computeAdminStats, BILLING_KEYS } = await import('../../lib/adminStats.js');
const { listAllUsers } = await import('../../lib/adminUsers.js');
const { customSiteAdmin } = await import('../../lib/customSites.js');

// Visible text with tags stripped and entities decoded, so assertions read
// like the page ("Who's paying", not "Who&#x27;s paying").
function plain(html) {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const render = (props) => renderToStaticMarkup(createElement(DashboardView, props));

// Midday UTC so the short dates are the same day in any test time zone.
const ana = {
  id: 'u-ana', first_name: 'Ana', last_name: 'Rivera', email: 'ana@shine.test', business_name: 'Shine Mobile Detail',
  firstPublishedUrl: 'https://www.shine-mobile.autocaregeniushub.com/', siteCount: 1, publishedSiteCount: 1,
  created_at: '2026-09-01T12:00:00Z',
};
const ben = {
  id: 'u-ben', email: 'ben@tint.test', firstSiteName: "Ben's Tint", firstPublishedUrl: null, siteCount: 1, publishedSiteCount: 0,
  created_at: '2026-10-03T12:00:00Z',
};
const cam = {
  id: 'u-cam', first_name: 'Cam', last_name: 'Ortiz', email: 'cam@wash.test', siteCount: 0, publishedSiteCount: 0,
  created_at: '2026-10-04T12:00:00Z',
};

const status = (key, label, extra = {}) => ({ key, label, source: null, hasAccess: true, renewsAt: null, endsAt: null, ...extra });
const anaStatus = status('paying', 'Paying', { source: 'stripe', renewsAt: '2026-10-20T12:00:00Z' });
const benStatus = status('cancelled_grace', 'Cancelling', { source: 'shopify', endsAt: '2026-10-12T12:00:00Z' });

const stats = {
  accounts: { customers: 10, admins: 3, signups7: 2, signups30: 4, withoutSite: 3, withLiveSite: 5 },
  billing: {
    byKey: { paying: 2, trial: 0, manual: 1, comped: 1, past_due: 1, past_due_lapsed: 0, cancelled_grace: 1, cancelled: 2, free: 2 },
    paying: 2, payingStripe: 1, payingShopify: 1, estMrrCents: 3998, withAccess: 6, conversionPct: 20,
  },
  sites: { total: 9, published: 6, newLiveLast30: 2, bookingOnly: 1, customDomainsLive: 2, customDomainsPending: 1 },
  customSites: {
    total: 7, active: 4,
    byStage: { new: 1, invited: 0, form_started: 1, form_received: 1, designing: 1, in_review: 0, revisions: 0, live: 2, on_hold: 1, archived: 0 },
    live: 2, onHold: 1, archived: 0, paid: 3, unpaidLive: 1, handedOver: 1, waiting: 1,
  },
  bookings: { last30: 37 },
  lists: {
    paying: [{ user: ana, status: anaStatus }, { user: ben, status: benStatus }],
    attention: [
      { kind: 'billing', id: 'u-ben', title: "Ben's Tint", detail: 'Access ends Oct 12, 26', user: ben, tone: 'amber' },
      { kind: 'project', id: 'p-1', title: 'Rivera Auto Care', detail: 'Live but not marked paid', project: { id: 'p-1' }, tone: 'red' },
    ],
    recentSignups: [cam, ben, ana],
  },
};

const noop = () => {};
const handlers = { onSection: noop, onOpenAccounts: noop, onOpenProject: noop, onOpenUser: noop };

describe('DashboardView', () => {
  it('renders every card with the numbers it was given', () => {
    const html = render({ stats, now: new Date('2026-10-05T18:00:00Z'), ...handlers, onOpenDemo: noop });
    const text = plain(html);

    for (const heading of ["Who's paying", 'Plan breakdown', 'Needs attention', 'Custom websites', 'Quick actions', 'Recent sign-ups', 'Activity']) {
      expect(text).toContain(heading);
    }

    // KPI row
    expect(text).toContain('Paying customers 2 est. $39.98/mo at $19.99');
    expect(text).toContain('Custom websites in progress 4 2 live · 3 paid');
    expect(text).toContain('Live customer websites 6 5 owners · 2 new in 30 days');
    expect(text).toContain('New customers (30 days) 4 2 this week · 10 total');

    // Who's paying: name with business, badge, billing source, next date, live host
    expect(text).toContain('Ana Rivera Shine Mobile Detail Paying Stripe Oct 20, 26 shine-mobile.autocaregeniushub.com');
    expect(text).toContain("ben@tint.test Ben's Tint Cancelling Shopify Ends Oct 12, 26 —");
    expect(html).toContain('href="https://www.shine-mobile.autocaregeniushub.com/"');
    expect(html).toContain('target="_blank"');
    // Phones scroll the table inside its card instead of the page.
    expect(html).toMatch(/class="overflow-x-auto"><table class="[^"]*min-w-\[/);

    // Plan breakdown: every billing key but admin, with its count
    expect(text).toContain('Paying 2 Trial 0 Pro (manual) 1 Comped Pro 1 Past due 1 Past due (lapsed) 0 Cancelling 1 Cancelled 2 Free 2');

    // Needs attention
    expect(text).toContain("Ben's Tint Access ends Oct 12, 26");
    expect(text).toContain('Urgent: Rivera Auto Care Live but not marked paid');
    expect(html).toContain('bg-[#cc0000]');
    expect(html).toContain('bg-amber-500');

    // Custom websites: one row per main stage, then the footer
    expect(text).toContain('Not sent 1 Form sent 0 Filling out form 1 Form received 1 Designing 1 Draft with customer 0 Revisions 0 Live 2');
    expect(text).toContain('3 paid · 1 handed over · 1 on hold');
    expect(text).not.toContain('Custom website stats unavailable');

    // Quick actions
    expect(text).toContain('Add a custom website customer');
    expect(text).toContain('Open editor demo');
    expect(text).toContain('Site upgrades');

    // Recent sign-ups: live host, draft, no site; badge from billingStatusOf
    expect(text).toContain('Cam Ortiz No site yet Free Joined Oct 4, 26');
    expect(text).toContain('ben@tint.test Draft, not published');
    expect(text).toContain('Ana Rivera shine-mobile.autocaregeniushub.com');

    // Activity
    expect(text).toContain('Bookings, last 30 days 37');
    expect(text).toContain('New live websites, last 30 days 2');
    expect(text).toContain('Custom domains 2 live · 1 pending');
    expect(text).toContain('Booking-only pages 1');
    expect(text).toContain('Conversion 20% of customers pay');
    expect(text).toContain('Signed up, no site yet 3');
  });

  it('shows "—" for the sources that did not load, never a made-up number', () => {
    const text = plain(render({ stats: { ...stats, customSites: null, bookings: null }, ...handlers }));
    expect(text).toContain('Custom websites in progress — Stats unavailable');
    expect(text).toContain('Custom website stats unavailable');
    expect(text).not.toContain('handed over');
    expect(text).toContain('Bookings, last 30 days —');
    expect(text).toContain("Bookings couldn't load.");
    // The rest of the page still renders from the user list.
    expect(text).toContain('Paying customers 2');
    expect(text).toContain('Ana Rivera');
  });

  it('hides "Open editor demo" without a handler', () => {
    const text = plain(render({ stats, ...handlers }));
    expect(text).not.toContain('Open editor demo');
    expect(text).toContain('Add a custom website customer');
  });

  it('has empty states for a brand-new platform', () => {
    const empty = {
      accounts: { customers: 0, admins: 1, signups7: 0, signups30: 0, withoutSite: 0, withLiveSite: 0 },
      billing: {
        byKey: Object.fromEntries(BILLING_KEYS.filter((k) => k !== 'admin').map((k) => [k, 0])),
        paying: 0, payingStripe: 0, payingShopify: 0, estMrrCents: 0, withAccess: 0, conversionPct: 0,
      },
      sites: { total: 0, published: 0, newLiveLast30: 0, bookingOnly: 0, customDomainsLive: 0, customDomainsPending: 0 },
      customSites: null,
      bookings: null,
      lists: { paying: [], attention: [], recentSignups: [] },
    };
    const html = render({ stats: empty, ...handlers });
    const text = plain(html);
    expect(text).toContain('No paying customers yet.');
    expect(text).toContain('Nothing needs attention.');
    expect(text).toContain('No sign-ups yet.');
    expect(text).toContain('Paying customers 0 est. $0/mo at $19.99');
    expect(text).toContain('Live customer websites 0 0 owners · 0 new in 30 days');
    // No customers means no conversion rate, not "0%".
    expect(text).toContain('Conversion —');
    expect(html).not.toContain('<table');
  });

  it('collapses a long paying list behind "Show all"', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      user: { ...ana, id: `u-${i}`, first_name: `Owner${i}`, last_name: '' },
      status: anaStatus,
    }));
    const text = plain(render({ stats: { ...stats, lists: { ...stats.lists, paying: many } }, ...handlers }));
    expect(text).toContain('Owner7');
    expect(text).not.toContain('Owner8');
    expect(text).toContain('Show all 11');
  });

  it('renders straight from computeAdminStats output', () => {
    const now = new Date('2026-10-05T18:00:00Z');
    const users = [
      {
        ...ana, subscription_status: 'active', stripe_subscription_id: 'sub_1', subscription_current_period_end: '2026-10-20T12:00:00Z',
        sites: [{ id: 's1', user_id: 'u-ana', published_url: ana.firstPublishedUrl, published_at: '2026-09-28T12:00:00Z' }],
      },
      { ...cam, subscription_status: 'active', sites: [] }, // Pro with no billing record
      { id: 'admin-1', email: 'me@genius.test', is_super_admin: true, created_at: '2026-10-05T12:00:00Z', sites: [], siteCount: 0 },
    ];
    const projects = [{ id: 'p-9', business_name: 'Quick Lube', stage: 'form_received', paid_at: null }];
    const computed = computeAdminStats({ users, projects, bookings: [{ owner_user_id: 'u-ana', created_at: '2026-10-01T12:00:00Z' }], now });
    const text = plain(render({ stats: computed, now, ...handlers }));
    expect(text).toContain('Paying customers 1 est. $19.99/mo at $19.99');
    expect(text).toContain('Cam Ortiz Active with no Stripe or Shopify subscription');
    expect(text).toContain('Quick Lube Form received, ready to design');
    // Recent sign-ups are bare users: the badge comes from billingStatusOf.
    expect(text).toContain('Cam Ortiz No site yet Pro (manual)');
    // The admin account is not a customer.
    expect(text).not.toContain('me@genius.test');
    expect(text).toContain('Bookings, last 30 days 1');
  });
});

describe('PLAN_CHIPS', () => {
  it('covers every customer billing key and opens the matching Customers chip', () => {
    expect(PLAN_CHIPS.map((c) => c.key)).toEqual(BILLING_KEYS.filter((k) => k !== 'admin'));
    expect(Object.fromEntries(PLAN_CHIPS.map((c) => [c.key, c.filter]))).toEqual({
      paying: 'paying',
      manual: 'manual',
      trial: 'trial',
      comped: 'comped',
      past_due: 'past_due',
      past_due_lapsed: 'past_due',
      cancelled_grace: 'cancelled',
      cancelled: 'cancelled',
      free: 'free',
    });
  });
});

describe('AdminDashboard', () => {
  it('starts in the loading state with a Refresh button', () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, { onSection: noop, onOpenAccounts: noop }));
    const text = plain(html);
    expect(text).toContain('Loading…');
    expect(text).toContain('Refresh');
    expect(html).toContain('animate-pulse');
    expect(text).not.toContain("Who's paying");
    // Loading starts in an effect, which a static render never runs.
    expect(listAllUsers).not.toHaveBeenCalled();
    expect(customSiteAdmin).not.toHaveBeenCalled();
  });
});
