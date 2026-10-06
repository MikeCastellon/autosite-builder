import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The tab and the drawer load users and activity in effects, which a static
// render never runs: the client, toasts and auth only need to exist.
vi.mock('../../lib/supabase.js', () => ({ supabase: {}, isImpersonationTab: false }));
vi.mock('../ui/AlertProvider.jsx', () => ({ useAlert: () => ({ toast: () => {}, confirm: async () => true }) }));
vi.mock('../../lib/AuthContext.jsx', () => ({ useAuth: () => ({ profile: { id: 'admin-1' } }) }));

const { BillingBadge, formatMoney, formatShortDate } = await import('./billingUi.jsx');
const { BILLING_KEYS, billingStatusOf } = await import('../../lib/adminStats.js');
const { default: AdminAccountsTab } = await import('./AdminAccountsTab.jsx');
const { default: AdminUserDrawer } = await import('./AdminUserDrawer.jsx');

const html = (el) => renderToStaticMarkup(el);

describe('BillingBadge', () => {
  const classes = {
    paying: 'bg-[#cc0000] text-white',
    trial: 'bg-[#cc0000]/15 text-[#cc0000]',
    manual: 'bg-[#cc0000]/15 text-[#cc0000]',
    comped: 'bg-[#1a1a1a]/[0.08] text-[#1a1a1a]',
    past_due: 'bg-amber-100 text-amber-800',
    past_due_lapsed: 'bg-red-100 text-red-800',
    cancelled_grace: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-gray-200 text-gray-700',
    free: 'bg-gray-100 text-gray-600',
    admin: 'bg-[#1a1a1a] text-white',
  };

  it('has one colour per billing key and shows the label', () => {
    expect(Object.keys(classes).sort()).toEqual([...BILLING_KEYS].sort());
    for (const key of BILLING_KEYS) {
      const out = html(createElement(BillingBadge, { status: { key, label: `L-${key}` } }));
      expect(out).toContain(classes[key]);
      expect(out).toContain(`>L-${key}</span>`);
      expect(out).toContain('rounded-full text-[10px] font-bold whitespace-nowrap');
    }
  });

  it('renders a real status', () => {
    const out = html(createElement(BillingBadge, { status: billingStatusOf({ subscription_status: 'active', stripe_subscription_id: 's' }) }));
    expect(out).toContain('>Paying</span>');
  });

  it('falls back to the free colours and a dash without a status', () => {
    expect(html(createElement(BillingBadge, {}))).toContain('bg-gray-100 text-gray-600');
    expect(html(createElement(BillingBadge, {}))).toContain('>—</span>');
    expect(html(createElement(BillingBadge, { status: { key: 'nope', label: 'X' } }))).toContain('bg-gray-100 text-gray-600');
  });
});

describe('formatMoney', () => {
  it('shows cents, or whole dollars without them', () => {
    expect(formatMoney(3998)).toBe('$39.98');
    expect(formatMoney(1999)).toBe('$19.99');
    expect(formatMoney(4000)).toBe('$40');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(5)).toBe('$0.05');
    expect(formatMoney(199900)).toBe('$1,999');
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoney(-1999)).toBe('-$19.99');
  });

  it('never prints a number it does not have', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity]) expect(formatMoney(v)).toBe('—');
  });
});

describe('formatShortDate', () => {
  it('matches the admin table style', () => {
    expect(formatShortDate('2026-10-05T12:00:00Z')).toBe('Oct 5, 26');
    expect(formatShortDate('2026-01-15T12:00:00Z')).toBe('Jan 15, 26');
  });

  it('shows a dash for nothing or nonsense', () => {
    for (const v of [null, undefined, '', 'not a date']) expect(formatShortDate(v)).toBe('—');
  });
});

describe('AdminAccountsTab chips', () => {
  // Before the users load every count is 0: only All and the chip in use show.
  const chips = (props) => [...html(createElement(AdminAccountsTab, props)).matchAll(/<button type="button"[^>]*>([^<]+) <span/g)].map((m) => m[1]);

  it('starts on the chip a link asked for', () => {
    expect(chips({ initialFilter: 'paying' })).toEqual(['All', 'Paying']);
    expect(chips({ initialFilter: 'admins' })).toEqual(['All', 'Admins']);
    const out = html(createElement(AdminAccountsTab, { initialFilter: 'paying' }));
    expect(out).toMatch(/bg-\[#1a1a1a\] text-white border-\[#1a1a1a\]">Paying/);
  });

  it('falls back to All for a missing or unknown filter', () => {
    expect(chips({})).toEqual(['All']);
    expect(chips({ initialFilter: 'pro' })).toEqual(['All']);
    expect(chips({ initialFilter: 'toString' })).toEqual(['All']);
    expect(chips()).toEqual(['All']);
  });
});

describe('AdminUserDrawer billing', () => {
  const base = { id: 'u1', email: 'u1@example.com', sites: [], siteCount: 0, adminNotes: '', adminTags: [] };
  const render = (profile) => html(createElement(AdminUserDrawer, { user: { ...base, ...profile }, allTags: [], onClose: () => {} }));
  const billingRow = (out) => out.match(/>Billing<\/p><p[^>]*>(.*?)<\/p>/)?.[1];

  it('shows the billing badge and where the subscription is billed', () => {
    const stripe = render({ subscription_status: 'active', stripe_subscription_id: 'sub_1' });
    expect(stripe).toContain('>Paying</span>');
    expect(billingRow(stripe)).toBe('Stripe');
    expect(billingRow(render({ subscription_status: 'active', shopify_customer_id: '42' }))).toBe('Shopify');
  });

  it('shows a dash when nothing bills the account', () => {
    const manual = render({ subscription_status: 'active' });
    expect(manual).toContain('>Pro (manual)</span>');
    expect(billingRow(manual)).toContain('—');
    expect(billingRow(render({ scheduler_enabled: true, stripe_subscription_id: 'sub_old' }))).toContain('—');
    expect(render({})).toContain('>Free</span>');
  });
});
