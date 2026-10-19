// Genius Store in the business menu: which website the store is for, and the
// menu item that leads there.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../lib/supabase.js', () => ({ supabase: { auth: { getSession: async () => ({ data: {} }) } }, isImpersonationTab: false }));

const { pickStoreSite } = await import('./GeniusStorePage.jsx');
const { default: AppHeader } = await import('../../ui/AppHeader.jsx');
const { default: AlertProvider } = await import('../../ui/AlertProvider.jsx');

const site = (id, template_id, published_url = null) => ({ id, template_id, published_url });

describe('pickStoreSite', () => {
  it('prefers a live website whose design has the Shop section', () => {
    const sites = [site('a', 'carwash_bubble', 'https://a'), site('b', 'detailing_sporty'), site('c', 'mobile_driveway', 'https://c')];
    expect(pickStoreSite(sites).id).toBe('c');
  });

  it('falls back to any live website, then to any website', () => {
    expect(pickStoreSite([site('a', 'carwash_bubble'), site('b', 'wheel_apex', 'https://b')]).id).toBe('b');
    expect(pickStoreSite([site('a', 'carwash_bubble')]).id).toBe('a');
    expect(pickStoreSite([])).toBeNull();
    expect(pickStoreSite(null)).toBeNull();
  });
});

describe('Genius Store in the business menu', () => {
  const header = (extra) => renderToStaticMarkup(createElement(AlertProvider, null,
    createElement(AppHeader, { active: 'genius-store', userEmail: 'owner@shop.com', profile: {}, onMySites: () => {}, ...extra })));

  it('shows the Genius Store item when the app passes its handler', () => {
    expect(header({ onOpenGeniusStore: () => {} })).toContain('Genius Store');
    expect(header({})).not.toContain('Genius Store');
  });
});
