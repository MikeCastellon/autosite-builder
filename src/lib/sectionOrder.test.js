import { describe, it, expect } from 'vitest';
import { buildSectionOrder, buildSectionOrderAdded, repairSectionOrder } from './sectionOrder.js';
import { mergeSectionOrder } from './sectionManifest.js';

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

describe('repairSectionOrder', () => {
  // What the editor saved before the template added ids: the old ids
  // fitted with mergeSectionOrder, other templates' ids kept.
  const before = (saved) => mergeSectionOrder(saved, LEGACY, { keepForeign: true });
  // Visible order: ids sorted by order value, ties in DOM (IDS) order.
  const visible = (order) => IDS.map((id, i) => ({ id, i, o: order(id) })).sort((a, b) => a.o - b.o || a.i - b.i).map((x) => x.id);

  it('leaves a saved order alone when only added ids are missing, or nothing is saved', () => {
    expect(repairSectionOrder(['cta', 'hero', 'about', 'services', 'gallery'], IDS, ADDED)).toBeNull();
    expect(repairSectionOrder(undefined, IDS, ADDED)).toBeNull();
    expect(repairSectionOrder([], IDS, ADDED)).toBeNull();
  });

  it('slots in a missing old id only, so every old id keeps the value it had before', () => {
    for (const saved of [
      ['hero', 'about', 'services', 'cta'],
      ['about', 'hero'],
      ['hero', 'process', 'about', 'gallery', 'cta'],
    ]) {
      const repaired = repairSectionOrder(saved, IDS, ADDED);
      expect(repaired, JSON.stringify(saved)).toEqual(before(saved));
      expect(repaired.some((id) => ADDED.includes(id))).toBe(false);
      const after = buildSectionOrderAdded({ sectionOrder: repaired }, IDS, ADDED);
      const old = buildSectionOrder({ sectionOrder: before(saved) }, LEGACY);
      expect(LEGACY.map(after)).toEqual(LEGACY.map(old));
    }
  });

  it('keeps an added id another design saved where it was (a template switch)', () => {
    // A design that has 'featured' saved it last; this one lacks 'gallery'.
    const saved = ['hero', 'about', 'brands', 'services', 'cta', 'featured'];
    const repaired = repairSectionOrder(saved, IDS, ADDED);
    expect(repaired).toEqual(['hero', 'about', 'brands', 'services', 'gallery', 'cta', 'featured']);
    const after = buildSectionOrderAdded({ sectionOrder: repaired }, IDS, ADDED);
    const old = buildSectionOrder({ sectionOrder: before(saved) }, LEGACY);
    expect(LEGACY.map(after)).toEqual(LEGACY.map(old));
    // The old sections show in the order they did before; the bands sit
    // in their saved slots.
    expect(visible(after).filter((id) => LEGACY.includes(id))).toEqual(['hero', 'about', 'services', 'gallery', 'cta']);
    expect(visible(after)).toEqual(['hero', 'about', 'brands', 'services', 'gallery', 'cta', 'featured']);
  });

  it('without added ids it is the plain repair', () => {
    expect(repairSectionOrder(['about', 'hero'], LEGACY, undefined)).toEqual(before(['about', 'hero']));
    expect(repairSectionOrder(LEGACY, LEGACY, [])).toBeNull();
  });
});
