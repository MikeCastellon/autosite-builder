import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminShell, { AccountMenuPanel } from './AdminShell.jsx';
import { ADMIN_SECTIONS } from '../../lib/adminWorkspace.js';

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

// The two tab rows: the one in the bar (xl and up) and the scrolling row
// under it (below xl). Only one shows at any width.
function navs(html) {
  return [...html.matchAll(/<nav aria-label="(Admin|Admin sections)"[^>]*>([\s\S]*?)<\/nav>/g)].map((m) => ({ label: m[1], html: m[2] }));
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

  it('lists every section as a flat row of tabs, in order, in both rows', () => {
    const rows = navs(render());
    expect(rows.map((r) => r.label)).toEqual(['Admin', 'Admin sections']);
    const labels = ADMIN_SECTIONS.map((s) => s.label).join(' ');
    for (const row of rows) expect(text(row.html).trim()).toBe(labels);
  });

  it('marks exactly the current section in each row', () => {
    for (const row of navs(render({ section: 'pipeline' }))) {
      expect(currentTabs(row.html)).toEqual(['Pipeline']);
    }
    expect(render().match(/aria-current=/g)).toHaveLength(2);
  });

  it('marks the Dashboard for an unknown or missing section, as AdminPage shows it', () => {
    for (const section of ['nope', undefined, '1']) {
      for (const row of navs(render({ section }))) expect(currentTabs(row.html)).toEqual(['Dashboard']);
    }
  });

  it('puts the tabs in the bar from xl and on a scrolling row below it', () => {
    const html = render();
    expect(html).toMatch(/<nav aria-label="Admin" class="hidden xl:block[^"]*overflow-x-auto/);
    expect(html).toMatch(/<nav aria-label="Admin sections" class="xl:hidden[^"]*overflow-x-auto/);
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
