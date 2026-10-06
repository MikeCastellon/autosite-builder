import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The supabase fake records which tables the all-shops directory reads.
const fromCalls = [];
const tableRows = {};
vi.mock('../../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => ({
      select: async (cols) => {
        fromCalls.push({ table, cols });
        return tableRows[table] || { data: [], error: null };
      },
    }),
  },
  isImpersonationTab: false,
}));
vi.mock('../../../lib/inquiries.js', () => ({
  listInquiriesForOwner: vi.fn(async () => [{ id: 'own' }]),
  listAllInquiries: vi.fn(async () => [{ id: 'all' }]),
  updateInquiryStatus: vi.fn(),
  saveInquiryOwnerNotes: vi.fn(),
}));

const inquiriesLib = await import('../../../lib/inquiries.js');
const { loadInquiries } = await import('./InquiriesView.jsx');
const { default: InquiriesList, shopLines } = await import('./InquiriesList.jsx');
const { default: InquiryDetailDrawer } = await import('./InquiryDetailDrawer.jsx');
const { default: AdminAllInquiriesTab, buildShopLookup, loadShopDirectory } = await import('../../admin/AdminAllInquiriesTab.jsx');

const INQ = {
  id: 'i1', site_id: 'site-a', owner_user_id: 'owner-1', name: 'Dana Cruz', email: 'dana@example.com',
  phone: '', message: 'Do you do ceramic coating?', status: 'new', owner_notes: 'called back', created_at: '2026-10-04T15:00:00Z',
};
const PROFILES = [
  { id: 'owner-1', business_name: 'Signup Name LLC', first_name: 'Rico', last_name: 'Alvarez', email: 'rico@shop.test', is_super_admin: false },
  { id: 'admin-1', business_name: null, first_name: '', last_name: '', email: 'dev@agency.test', is_super_admin: true },
];
const SITES = [
  { id: 'site-a', user_id: 'owner-1', business_info: { businessName: 'Rico\'s Mobile Detail' }, published_url: 'https://ricos.autocaregeniushub.com' },
  { id: 'site-demo', user_id: 'admin-1', business_info: { businessName: '  ' }, published_url: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  fromCalls.length = 0;
  for (const k of Object.keys(tableRows)) delete tableRows[k];
});

describe('loadInquiries (who a view lists)', () => {
  it('owner mode lists only that owner, never every shop', async () => {
    expect(await loadInquiries({ userId: 'u1' })).toEqual([{ id: 'own' }]);
    expect(inquiriesLib.listInquiriesForOwner).toHaveBeenCalledWith({ userId: 'u1' });
    expect(inquiriesLib.listAllInquiries).not.toHaveBeenCalled();
  });

  it('owner mode without a user lists nothing instead of everything', async () => {
    expect(await loadInquiries({ userId: undefined })).toEqual([]);
    expect(inquiriesLib.listInquiriesForOwner).not.toHaveBeenCalled();
    expect(inquiriesLib.listAllInquiries).not.toHaveBeenCalled();
  });

  it('allShops mode lists every shop', async () => {
    expect(await loadInquiries({ allShops: true })).toEqual([{ id: 'all' }]);
    expect(inquiriesLib.listAllInquiries).toHaveBeenCalled();
    expect(inquiriesLib.listInquiriesForOwner).not.toHaveBeenCalled();
  });
});

describe('customer Inquiries page', () => {
  it('has no super-admin path (the old one listed every shop under "your site")', () => {
    const src = readFileSync(fileURLToPath(new URL('../inquiries-page/InquiriesPage.jsx', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/is_super_admin|isAdmin|allShops/);
    expect(src).toMatch(/<InquiriesView userId=\{userId\} \/>/);
  });
});

describe('buildShopLookup', () => {
  const shopFor = buildShopLookup({ profiles: PROFILES, sites: SITES });

  it('names the site\'s business first, then the owner', () => {
    expect(shopFor(INQ)).toEqual({
      business: 'Rico\'s Mobile Detail',
      ownerName: 'Rico Alvarez',
      ownerEmail: 'rico@shop.test',
      owner: 'Rico Alvarez',
      siteUrl: 'https://ricos.autocaregeniushub.com',
      ownerIsAdmin: false,
    });
  });

  it('falls back to the profile business name, then the owner email', () => {
    expect(shopFor({ ...INQ, site_id: 'gone' }).business).toBe('Signup Name LLC');
    const demo = shopFor({ ...INQ, site_id: 'site-demo', owner_user_id: 'admin-1' });
    expect(demo).toMatchObject({ business: null, ownerName: null, owner: 'dev@agency.test', siteUrl: null, ownerIsAdmin: true });
    expect(shopLines(demo)).toEqual({ title: 'dev@agency.test', sub: null });
  });

  it('says "Unknown shop" when neither the site nor the owner loaded', () => {
    const none = buildShopLookup()({ ...INQ });
    expect(none).toMatchObject({ business: null, owner: null, ownerIsAdmin: false });
    expect(shopLines(none)).toEqual({ title: 'Unknown shop', sub: null });
  });
});

describe('loadShopDirectory', () => {
  it('reads profiles and sites once each, with only the columns the Shop line needs', async () => {
    tableRows.profiles = { data: PROFILES, error: null };
    tableRows.sites = { data: SITES, error: null };
    expect(await loadShopDirectory()).toEqual({ profiles: PROFILES, sites: SITES });
    expect(fromCalls).toEqual([
      { table: 'profiles', cols: 'id, business_name, first_name, last_name, email, is_super_admin' },
      { table: 'sites', cols: 'id, user_id, business_info, published_url' },
    ]);
  });

  it('throws when either read fails (the tab then lists inquiries without names)', async () => {
    tableRows.sites = { data: null, error: new Error('permission denied') };
    await expect(loadShopDirectory()).rejects.toThrow('permission denied');
  });
});

describe('InquiriesList', () => {
  it('owner view has no Shop column', () => {
    const html = renderToStaticMarkup(createElement(InquiriesList, { inquiries: [INQ], onSelect: () => {} }));
    expect(html).not.toContain('>Shop<');
    expect(html).toContain('Dana Cruz');
    expect(html).toContain('Search name or email');
  });

  it('all-shops view shows which business each inquiry belongs to', () => {
    const shopFor = buildShopLookup({ profiles: PROFILES, sites: SITES });
    const demoInq = { ...INQ, id: 'i2', site_id: 'site-demo', owner_user_id: 'admin-1' };
    const html = renderToStaticMarkup(createElement(InquiriesList, { inquiries: [INQ, demoInq], onSelect: () => {}, shopFor }));
    expect(html).toContain('>Shop<');
    expect(html).toContain('Rico&#x27;s Mobile Detail');
    expect(html).toContain('Rico Alvarez');
    expect(html).toContain('dev@agency.test');
    expect(html.match(/>ADMIN</g)).toHaveLength(1);
    expect(html).toContain('Search name, email or shop');
  });
});

describe('InquiryDetailDrawer', () => {
  it('owner view can change the status and edit notes', () => {
    const html = renderToStaticMarkup(createElement(InquiryDetailDrawer, { inquiry: INQ, onClose: () => {} }));
    expect(html).toContain('Mark read');
    expect(html).toContain('Archive');
    expect(html).not.toMatch(/<textarea[^>]*readonly/i);
    expect(html).not.toContain('>Shop<');
  });

  it('read-only (Admin > All inquiries): no status buttons, notes locked, shop named', () => {
    const shop = buildShopLookup({ profiles: PROFILES, sites: SITES })(INQ);
    const html = renderToStaticMarkup(createElement(InquiryDetailDrawer, { inquiry: INQ, onClose: () => {}, readOnly: true, shop }));
    expect(html).not.toContain('Mark read');
    expect(html).not.toContain('Archive');
    expect(html).toMatch(/<textarea[^>]*readonly/i);
    expect(html).toContain('called back');
    expect(html).toContain('>Shop<');
    expect(html).toContain('Rico Alvarez · rico@shop.test');
    expect(html).toContain('href="https://ricos.autocaregeniushub.com"');
    expect(html).toContain('ricos.autocaregeniushub.com</a>');
    expect(html).toContain('Read-only');
  });
});

describe('AdminAllInquiriesTab', () => {
  it('shows a loading state until the shop names arrive (no "Unknown shop" flash)', () => {
    const html = renderToStaticMarkup(createElement(AdminAllInquiriesTab));
    expect(html).toContain('Loading…');
    expect(html).not.toContain('Unknown shop');
    expect(html).toContain('every shop');
  });
});
