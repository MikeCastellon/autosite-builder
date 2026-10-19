import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminShell, { AccountMenuPanel } from './AdminShell.jsx';
import { ADMIN_GROUPS } from '../../lib/adminWorkspace.js';

const noop = () => {};

function render(props = {}, children = createElement('p', { id: 'page-body' }, 'Section body here')) {
  return renderToStaticMarkup(createElement(AdminShell, {
    section: 'pipeline',
    onSection: noop,
    onSwitchToBusiness: noop,
    onOpenProfile: noop,
    onSignOut: noop,
    userEmail: 'owner@example.com',
    profile: { is_super_admin: true },
    ...props,
  }, children));
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// The two group-tab rows: the one in the bar (lg and up) and the scrolling
// row under it (below lg). Only one shows at any width.
function navs(html) {
  return [...html.matchAll(/<nav aria-label="(Admin|Admin sections)"[^>]*>([\s\S]*?)<\/nav>/g)].map((m) => ({ label: m[1], html: m[2] }));
}

// The current group's sub-tab row, or null.
function subNav(html) {
  const m = [...html.matchAll(/<nav aria-label="(\w+) sections"[^>]*>([\s\S]*?)<\/nav>/g)].find((x) => x[1] !== 'Admin');
  return m ? { label: m[1], html: m[2] } : null;
}

function currentTabs(navHtml) {
  return [...navHtml.matchAll(/<button[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
}

describe('AdminShell', () => {
  it('has the Genius header lockup: logo back to HQ, the Websites wordmark and an Admin pill', () => {
    const header = render().match(/<header[^>]*>([\s\S]*?)<\/header>/)[1];
    expect(header).toContain('href="https://hq.autocaregenius.com"');
    expect(header).toContain('aria-label="Back to Genius HQ"');
    expect(header).toContain('v11_1.svg');
    expect(text(header)).toContain('Genius Websites');
    expect(text(header)).toMatch(/\bAdmin\b/);
  });

  it('shows one tab per group, in order, in both rows', () => {
    const rows = navs(render());
    expect(rows.map((r) => r.label)).toEqual(['Admin', 'Admin sections']);
    for (const row of rows) expect(text(row.html).trim()).toBe('Dashboard Websites Customers Sales Activity');
    expect(ADMIN_GROUPS.map((g) => g.label)).toEqual(['Dashboard', 'Websites', 'Customers', 'Sales', 'Activity']);
  });

  it('marks the current section\'s group in each row and the section in the sub-tabs', () => {
    const html = render({ section: 'pipeline' });
    for (const row of navs(html)) expect(currentTabs(row.html)).toEqual(['Sales']);
    expect(currentTabs(subNav(html).html)).toEqual(['Pipeline']);
    expect(html.match(/aria-current=/g)).toHaveLength(3);
  });

  it('shows the current group\'s sections as sub-tabs, and none for a one-section group', () => {
    const cases = {
      'free-sites': ['Websites', 'Custom Free Upgrades', 'Free'],
      'site-upgrades': ['Websites', 'Custom Free Upgrades', 'Upgrades'],
      leads: ['Sales', 'Leads Pipeline', 'Leads'],
      inquiries: ['Activity', 'Bookings Inquiries', 'Inquiries'],
    };
    for (const [section, [label, tabs, on]] of Object.entries(cases)) {
      const sub = subNav(render({ section }));
      expect(sub.label).toBe(label);
      expect(text(sub.html).trim()).toBe(tabs);
      expect(currentTabs(sub.html)).toEqual([on]);
    }
    for (const section of ['dashboard', 'accounts']) expect(subNav(render({ section }))).toBeNull();
  });

  it('marks the Dashboard for an unknown or missing section, as AdminPage shows it', () => {
    for (const section of ['nope', undefined, '1']) {
      const html = render({ section });
      for (const row of navs(html)) expect(currentTabs(row.html)).toEqual(['Dashboard']);
      expect(subNav(html)).toBeNull();
    }
  });

  it('puts the tabs in the bar from lg and on a scrolling row below it', () => {
    const html = render();
    expect(html).toMatch(/<nav aria-label="Admin" class="hidden lg:block[^"]*overflow-x-auto/);
    expect(html).toMatch(/<nav aria-label="Admin sections" class="lg:hidden[^"]*overflow-x-auto/);
  });

  it('offers the way back to the business next to the account menu', () => {
    const html = render();
    expect(html).toContain('aria-label="Switch to my business"');
    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(render({ onSwitchToBusiness: undefined })).not.toContain('Switch to my business');
  });

  it('shows the profile photo, else the email initial, in the avatar', () => {
    const withPhoto = render({ profile: { is_super_admin: true, photo_url: 'https://cdn.example.com/me.jpg' } });
    expect(withPhoto).toContain('src="https://cdn.example.com/me.jpg"');
    const avatar = render({ userEmail: 'zed@example.com' }).match(/aria-label="Account menu"[^>]*>([\s\S]*?)<\/button>/)[1];
    expect(avatar).toBe('Z');
  });

  it('renders the section body under the header', () => {
    const html = render();
    expect(html).toContain('<p id="page-body">Section body here</p>');
    expect(html.indexOf('page-body')).toBeGreaterThan(html.indexOf('</header>'));
  });

  it('is not the customer header', () => {
    const body = text(render());
    expect(body).not.toMatch(/Need assistance/i);
    for (const label of ['Overview', 'Sites', 'Charges', 'Payments']) expect(body).not.toMatch(new RegExp(`\\b${label}\\b`));
  });
});

describe('AccountMenuPanel', () => {
  const panel = (props = {}) => renderToStaticMarkup(createElement(AccountMenuPanel, {
    userEmail: 'owner@example.com',
    onPick: noop,
    onSwitchToBusiness: noop,
    onOpenProfile: noop,
    onSignOut: noop,
    ...props,
  }));

  it('shows who is signed in and the actions', () => {
    const body = text(panel());
    expect(body).toContain('owner@example.com');
    expect(body).toContain('Super admin');
    expect(body).toContain('Switch to my business');
    expect(body).toContain('Profile');
    expect(body).toContain('Sign out');
    expect(panel().match(/role="menuitem"/g)).toHaveLength(3);
  });

  it('leaves out the actions it has no handler for', () => {
    const body = text(panel({ onSwitchToBusiness: undefined, onOpenProfile: undefined, onSignOut: undefined }));
    expect(body).not.toContain('Switch to my business');
    expect(body).not.toContain('Profile');
    expect(body).not.toContain('Sign out');
  });
});
