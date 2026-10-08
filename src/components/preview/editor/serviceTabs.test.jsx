// Services tab > tabs: the switch saves { enabled: true } (+ all) or
// nothing, the summary says which tabs the page shows (or why none) with
// the kit's own reading (kit/serviceTabs.js), the Category field suggests the
// categories already in use, and the controls render on the server.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SERVICE_CATEGORY_MAX, SERVICE_TABS_HINTS, serviceTabsOf } from '../templates/kit/serviceTabs.js';
import { CATEGORY_MAX, tabsState, tabsValue, tabsSummary, categoryNames } from './serviceTabsEdit.js';
import { ServiceTabsSwitch, ServiceCategoryField } from './ServiceTabsPanel.jsx';

const SERVICES = [
  { name: 'Auto Detailing', category: 'Cars' },
  { name: 'Boat Detailing', category: 'Boats & RVs' },
  { name: 'RV Detailing', category: ' boats & rvs ' },
  { name: 'Pressure Washing', category: 'Pressure Washing' },
  { name: 'Hand Wax' },
];
const noop = () => {};
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe('serviceTabsEdit', () => {
  it('the switch: off saves nothing, on saves { enabled: true } and the All tab', () => {
    expect(CATEGORY_MAX).toBe(SERVICE_CATEGORY_MAX);
    for (const v of [undefined, null, true, {}, { enabled: 'yes' }, { all: true }]) expect(tabsState({ serviceTabs: v })).toEqual({ enabled: false, all: false });
    expect(tabsState({ serviceTabs: { enabled: true, all: true } })).toEqual({ enabled: true, all: true });
    expect(tabsValue({ enabled: false, all: true })).toBeNull();
    expect(tabsValue({ enabled: true })).toEqual({ enabled: true });
    expect(tabsValue({ enabled: true, all: true })).toEqual({ enabled: true, all: true });
    // What the page reads from it.
    expect(serviceTabsOf(SERVICES, tabsValue({ enabled: true, all: true })).all).toBe(true);
    expect(serviceTabsOf(SERVICES, tabsValue({ enabled: false }))).toBeNull();
  });

  it('suggests the categories in use, as first written', () => {
    expect(categoryNames(SERVICES)).toEqual(['Cars', 'Boats & RVs', 'Pressure Washing']);
    expect(categoryNames(['Wash', { name: 'Wax' }])).toEqual([]);
    expect(categoryNames(null)).toEqual([]);
  });

  it('says which tabs the page shows, or why none', () => {
    expect(tabsSummary(SERVICES, null)).toEqual({ status: 'off', text: '', tone: null });
    expect(tabsSummary(SERVICES, { enabled: true })).toEqual({
      status: 'on', tone: 'ok', text: 'Tabs on your site: Cars, Boats & RVs, Pressure Washing, Other. Services without a category share the Other tab.',
    });
    expect(tabsSummary(SERVICES.slice(0, 4), { enabled: true, all: true }).text).toBe('Tabs on your site: All, Cars, Boats & RVs, Pressure Washing.');
    expect(tabsSummary([{ name: 'A', category: 'Cars' }, 'B'], { enabled: true })).toEqual({ status: 'few', text: SERVICE_TABS_HINTS.few, tone: 'warn' });
    const nine = Array.from({ length: 9 }, (_, i) => ({ name: `S${i}`, category: `Kind ${i}` }));
    expect(tabsSummary(nine, { enabled: true })).toEqual({ status: 'many', text: SERVICE_TABS_HINTS.many, tone: 'warn' });
  });
});

describe('ServiceTabsSwitch / ServiceCategoryField', () => {
  const sw = (copy) => decode(renderToStaticMarkup(createElement(ServiceTabsSwitch, { copy, setCopy: noop, services: SERVICES })));

  it('off: the switch and what it does; on: the All tab switch and the tabs the page shows', () => {
    const off = sw({});
    expect(off).toContain('Show services in tabs');
    expect(off).toMatch(/role="switch" aria-checked="false" aria-label="Show services in tabs"/);
    expect(off).not.toContain('"All" tab');
    const on = sw({ serviceTabs: { enabled: true } });
    expect(on).toMatch(/role="switch" aria-checked="true" aria-label="Show services in tabs"/);
    expect(on).toContain('Add an "All" tab first');
    expect(on).toContain('Tabs on your site: Cars, Boats & RVs, Pressure Washing, Other.');
  });

  it('the Category field: limited, suggesting the other categories', () => {
    const html = decode(renderToStaticMarkup(createElement(ServiceCategoryField, { value: 'Cars', onChange: noop, services: SERVICES, index: 0 })));
    expect(html).toContain('<label for="svc-category-0"');
    expect(html).toMatch(new RegExp(`maxlength="${SERVICE_CATEGORY_MAX}"`, 'i'));
    expect(html).toContain('list="svc-category-0-options"');
    expect(html).toContain('value="Cars"');
    expect(html).toContain('<datalist id="svc-category-0-options"><option value="Boats & RVs"></option><option value="Pressure Washing"></option></datalist>');
  });
});
