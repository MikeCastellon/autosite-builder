import { describe, it, expect } from 'vitest';
import { buildSectionOrder, buildSectionOrderAdded } from './sectionOrder.js';

// A theme that added 'brands' (after hero) and 'featured' (after services)
// once sites were already saved with it.
const LEGACY = ['hero', 'about', 'services', 'gallery', 'cta'];
const IDS = ['hero', 'brands', 'about', 'services', 'featured', 'gallery', 'cta'];
const ADDED = ['brands', 'featured'];

describe('buildSectionOrder', () => {
  it('uses the default order without a saved one, the saved index (999 if absent) with one', () => {
    const def = buildSectionOrder({}, LEGACY);
    expect(LEGACY.map(def)).toEqual([0, 1, 2, 3, 4]);
    const saved = buildSectionOrder({ sectionOrder: ['about', 'hero'] }, LEGACY);
    expect(['hero', 'about', 'cta'].map(saved)).toEqual([1, 0, 999]);
  });
});

describe('buildSectionOrderAdded', () => {
  const copies = [
    {},
    { sectionOrder: [] },
    { sectionOrder: ['hero', 'services', 'about', 'cta', 'gallery'] },
    { sectionOrder: ['about', 'hero'] },
    { sectionOrder: ['featured', 'hero', 'brands', 'about', 'services', 'gallery', 'cta'] },
  ];

  it('gives the legacy ids exactly their old values', () => {
    for (const copy of copies) {
      const before = buildSectionOrder(copy, LEGACY);
      const after = buildSectionOrderAdded(copy, IDS, ADDED);
      expect(LEGACY.map(after), JSON.stringify(copy)).toEqual(LEGACY.map(before));
    }
  });

  it('without a saved order an added id ties with its predecessor', () => {
    const order = buildSectionOrderAdded({}, IDS, ADDED);
    expect(order('brands')).toBe(order('hero'));
    expect(order('featured')).toBe(order('services'));
    expect(IDS.map(order)).toEqual([0, 0, 1, 2, 2, 3, 4]);
  });

  it("an added id the owner placed gets its saved slot", () => {
    const order = buildSectionOrderAdded(copies[4], IDS, ADDED);
    expect(order('featured')).toBe(0);
    expect(order('brands')).toBe(2);
    expect(order('hero')).toBe(1);
  });

  it("a saved order without the added id: the nearest saved predecessor's index", () => {
    const order = buildSectionOrderAdded(copies[2], IDS, ADDED);
    expect(order('brands')).toBe(0); // hero is saved at 0
    expect(order('featured')).toBe(1); // services is saved at 1
    const partial = buildSectionOrderAdded(copies[3], IDS, ADDED);
    expect(partial('brands')).toBe(1); // hero at 1
    // services is not in the saved order (999, the end of the page): the
    // walk goes on to about, saved at 0.
    expect(partial('services')).toBe(999);
    expect(partial('featured')).toBe(0);
  });

  it('skips an old id the saved order lacks (a section hidden before it was saved)', () => {
    // The custom fixture's shape: statsBar hidden, so not in sectionOrder.
    const ids = ['hero', 'statsBar', 'brands', 'services', 'featured', 'about', 'cta'];
    const copy = { sectionOrder: ['hero', 'about', 'services', 'cta'], hiddenSections: ['statsBar'] };
    const order = buildSectionOrderAdded(copy, ids, ADDED);
    expect(order('statsBar')).toBe(999);
    expect(order('brands')).toBe(0); // with hero, not after the contact section
    expect(order('featured')).toBe(2); // with services
    // Nothing saved before it: 0.
    const first = buildSectionOrderAdded({ sectionOrder: ['about'] }, ['statsBar', 'brands', 'about'], ['brands']);
    expect(first('brands')).toBe(0);
  });

  it('walks back past added ids without a slot; with no predecessor, 0', () => {
    const ids = ['makes', 'hero', 'brands', 'featured', 'about'];
    const order = buildSectionOrderAdded({ sectionOrder: ['about', 'hero'] }, ids, ['makes', 'brands', 'featured']);
    expect(order('makes')).toBe(0);
    expect(order('featured')).toBe(order('hero'));
    expect(order('featured')).toBe(1);
    const placed = buildSectionOrderAdded({ sectionOrder: ['about', 'brands', 'hero'] }, ids, ['makes', 'brands', 'featured']);
    expect(placed('featured')).toBe(1); // brands is saved at 1
  });

  it('with no added ids it is buildSectionOrder', () => {
    for (const copy of copies) {
      const a = buildSectionOrderAdded(copy, LEGACY, undefined);
      const b = buildSectionOrder(copy, LEGACY);
      expect(LEGACY.map(a)).toEqual(LEGACY.map(b));
    }
  });
});
