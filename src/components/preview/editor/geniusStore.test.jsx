// Edit > Genius Store: the panel's three states, rendered on the server (no
// DOM, so its status call never runs): no saved site yet, the store off
// (what it is and how to start), and the store on (heading fields, the
// always-on disclosure, where sales and payouts live, and how to remove it).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../lib/supabase.js', () => ({ supabase: { auth: { getSession: async () => ({ data: {} }) } } }));

const { default: GeniusStorePanel } = await import('./GeniusStorePanel.jsx');
const { STORE_DEFAULTS } = await import('../templates/kit/store.js');

const SITE = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const panel = (copy, extra = {}) => renderToStaticMarkup(createElement(GeniusStorePanel, {
  copy, setCopy: () => {}, siteId: SITE, colors: { bg: '#101010', accent: '#e11d48' }, confirm: async () => true, ...extra,
}));

describe('GeniusStorePanel', () => {
  it('asks for a saved site first', () => {
    expect(panel({}, { siteId: null })).toContain('Save your site first.');
  });

  it('explains the store and offers to set it up while it is off', () => {
    const html = panel({});
    expect(html).toContain('Auto Care Genius ships to them');
    expect(html).toContain('Set up my store');
    expect(html).not.toContain('Remove the store');
  });

  it('treats a store with a bad slug as off', () => {
    expect(panel({ store: { slug: 'https://evil.example' } })).toContain('Set up my store');
  });

  it('edits the heading and points to sales and payouts while it is on', () => {
    const html = panel({ store: { slug: 'apex-detail', title: 'Our shop' } });
    expect(html).toContain('Your store is on your site.');
    expect(html).toContain('value="Our shop"');
    expect(html).toContain(`placeholder="${STORE_DEFAULTS.intro}"`);
    expect(html).toContain('That line always shows.');
    expect(html).toContain('https://storefronts.autocaregenius.com');
    expect(html).toContain('Remove the store from my site');
  });

  it('says when the section is switched off in Sections', () => {
    expect(panel({ store: { slug: 'apex-detail' }, hiddenSections: ['shop'] })).toContain('switched off in Sections');
  });
});
