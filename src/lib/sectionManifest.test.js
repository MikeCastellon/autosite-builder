import { describe, it, expect } from 'vitest';
import {
  mergeSectionOrder,
  orderNeedsRepair,
  sameOrder,
  moveSection,
  placeSectionOrder,
  manifestFromModule,
  legacySections,
} from './sectionManifest.js';
import { buildSectionOrder } from './sectionOrder.js';

const SPORTY = ['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta', 'awards'];
const IRONCLAD = ['hero', 'ticker', 'ctaBand', 'about', 'services', 'gallery', 'whyUs', 'testimonials', 'cta'];

describe('mergeSectionOrder', () => {
  it('returns the default order when nothing is saved', () => {
    expect(mergeSectionOrder(undefined, SPORTY)).toEqual(SPORTY);
    expect(mergeSectionOrder(null, SPORTY)).toEqual(SPORTY);
    expect(mergeSectionOrder([], SPORTY)).toEqual(SPORTY);
  });

  it('keeps a complete saved order as is', () => {
    const saved = ['hero', 'about', 'services', 'statsBar', 'gallery', 'cta', 'testimonials', 'awards'];
    expect(mergeSectionOrder(saved, SPORTY)).toEqual(saved);
  });

  it('drops ids the template does not have and duplicates', () => {
    const saved = ['hero', 'ticker', 'statsBar', 'services', 'services', 'about', 'gallery', 'testimonials', 'cta', 'awards', 'bogus'];
    expect(mergeSectionOrder(saved, SPORTY)).toEqual(SPORTY);
  });

  it('puts ids missing from the save in their default slot after a template switch', () => {
    // Saved under Ironclad (owner moved about above services), now on Sporty.
    const merged = mergeSectionOrder(IRONCLAD, SPORTY);
    expect(merged).toEqual(['hero', 'statsBar', 'about', 'services', 'gallery', 'testimonials', 'cta', 'awards']);
    // Nothing is left for buildSectionOrder to send to 999.
    const order = buildSectionOrder({ sectionOrder: merged }, SPORTY);
    expect(SPORTY.map(order).every((n) => n >= 0 && n < SPORTY.length)).toBe(true);
  });

  it('keeps the owner order of known ids and chains several missing ones', () => {
    const def = ['hero', 'a', 'b', 'c', 'd', 'e'];
    expect(mergeSectionOrder(['e', 'hero', 'c'], def)).toEqual(['e', 'hero', 'a', 'b', 'c', 'd']);
  });

  it('puts a missing first section first', () => {
    expect(mergeSectionOrder(['services', 'hero2'], ['hero', 'services', 'cta'])).toEqual(['hero', 'services', 'cta']);
  });

  it('falls back to the default order when the save has only foreign ids', () => {
    expect(mergeSectionOrder(['x', 'y'], SPORTY)).toEqual(SPORTY);
  });

  it('never mutates its inputs', () => {
    const saved = ['hero', 'about'];
    const def = ['hero', 'services', 'about'];
    mergeSectionOrder(saved, def);
    mergeSectionOrder(saved, def, { keepForeign: true });
    expect(saved).toEqual(['hero', 'about']);
    expect(def).toEqual(['hero', 'services', 'about']);
  });
});

describe('mergeSectionOrder keepForeign (the form the editor saves)', () => {
  const OWNER_SPORTY = ['hero', 'gallery', 'statsBar', 'services', 'about', 'testimonials', 'cta', 'awards'];

  it('slots missing ids in and leaves every other id where it is', () => {
    expect(mergeSectionOrder(OWNER_SPORTY, IRONCLAD, { keepForeign: true })).toEqual(
      ['hero', 'ticker', 'ctaBand', 'gallery', 'whyUs', 'statsBar', 'services', 'about', 'testimonials', 'cta', 'awards']);
  });

  it('lists the template\'s own ids exactly as the plain form does', () => {
    const saved = ['cta', 'hero', 'x', 'gallery', 'about', 'y'];
    for (const def of [SPORTY, IRONCLAD, ['hero', 'services', 'cta']]) {
      const kept = mergeSectionOrder(saved, def, { keepForeign: true });
      expect(kept.filter((id) => def.includes(id))).toEqual(mergeSectionOrder(saved, def));
      expect(kept.filter((id) => !def.includes(id))).toEqual(saved.filter((id) => !def.includes(id)));
    }
  });

  it('still drops duplicates and non-string ids', () => {
    expect(mergeSectionOrder(['hero', 'x', 'x', null, 7, '', 'hero', 'cta'], ['hero', 'cta'], { keepForeign: true }))
      .toEqual(['hero', 'x', 'cta']);
  });

  it('switching to another template and back restores the owner order exactly', () => {
    // The editor saves the fitted order when the new template is missing
    // ids; the owner then switches back to Sporty.
    const onIronclad = mergeSectionOrder(OWNER_SPORTY, IRONCLAD, { keepForeign: true });
    expect(orderNeedsRepair(onIronclad, IRONCLAD)).toBe(false);
    expect(orderNeedsRepair(onIronclad, SPORTY)).toBe(false);
    expect(mergeSectionOrder(onIronclad, SPORTY)).toEqual(OWNER_SPORTY);
    // The live render agrees: Sporty's sections in the owner's order.
    const order = buildSectionOrder({ sectionOrder: onIronclad }, SPORTY);
    expect([...SPORTY].sort((a, b) => order(a) - order(b))).toEqual(OWNER_SPORTY);
    expect(SPORTY.every((id) => order(id) !== 999)).toBe(true);
  });
});

describe('placeSectionOrder', () => {
  it('is the visible order when nothing foreign is saved', () => {
    expect(placeSectionOrder(null, ['b', 'a'])).toEqual(['b', 'a']);
    expect(placeSectionOrder(['a', 'b'], ['b', 'a'])).toEqual(['b', 'a']);
  });

  it('refills this template\'s slots and keeps other ids at their positions', () => {
    const saved = ['hero', 'ticker', 'about', 'awards', 'services', 'cta'];
    expect(placeSectionOrder(saved, ['hero', 'services', 'about', 'cta']))
      .toEqual(['hero', 'ticker', 'services', 'awards', 'about', 'cta']);
  });

  it('puts visible ids without a slot last', () => {
    expect(placeSectionOrder(['hero', 'x'], ['cta', 'hero'])).toEqual(['cta', 'x', 'hero']);
  });

  it('a move on another template leaves the ids it lacks in place', () => {
    const OWNER_SPORTY = ['hero', 'gallery', 'statsBar', 'services', 'about', 'testimonials', 'cta', 'awards'];
    const saved = mergeSectionOrder(OWNER_SPORTY, IRONCLAD, { keepForeign: true });
    const visible = mergeSectionOrder(saved, IRONCLAD);
    // Owner drags Ironclad's CTA to just under the hero.
    const moved = moveSection(visible, visible.indexOf('cta'), 1);
    const next = placeSectionOrder(saved, moved);
    expect(mergeSectionOrder(next, IRONCLAD)).toEqual(moved);
    // Sporty-only sections kept their slots in the saved order.
    expect(next.indexOf('statsBar')).toBe(saved.indexOf('statsBar'));
    expect(next.indexOf('awards')).toBe(saved.indexOf('awards'));
    expect(next.length).toBe(saved.length);
  });
});

describe('orderNeedsRepair', () => {
  it('is false without a saved order', () => {
    expect(orderNeedsRepair(undefined, SPORTY)).toBe(false);
    expect(orderNeedsRepair([], SPORTY)).toBe(false);
  });
  it('is true when a template section is missing from the save', () => {
    expect(orderNeedsRepair(IRONCLAD, SPORTY)).toBe(true);
    expect(orderNeedsRepair(['hero', 'services'], ['hero', 'services', 'cta'])).toBe(true);
  });
  it('is false when only foreign ids are extra', () => {
    expect(orderNeedsRepair([...SPORTY, 'ticker'], SPORTY)).toBe(false);
  });
});

describe('sameOrder / moveSection', () => {
  it('compares orders element by element', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], null)).toBe(false);
  });
  it('moves one id and returns a new list', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(moveSection(ids, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveSection(ids, 3, 2)).toEqual(['a', 'b', 'd', 'c']);
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ignores out-of-range moves', () => {
    const ids = ['a', 'b'];
    expect(moveSection(ids, 0, -1)).toBe(ids);
    expect(moveSection(ids, 1, 2)).toBe(ids);
    expect(moveSection(ids, 1, 1)).toBe(ids);
  });
});

describe('manifestFromModule', () => {
  it('uses a theme-ready module\'s sections', () => {
    const mod = { themeReady: true, sections: [{ id: 'hero', label: 'Hero' }, { id: 'services', label: 'Packages' }, { id: 'cta' }] };
    expect(manifestFromModule('x', mod)).toEqual({
      themeReady: true,
      sections: [{ id: 'hero', label: 'Hero' }, { id: 'services', label: 'Packages' }, { id: 'cta', label: 'Contact / CTA' }],
    });
  });
  it('falls back to the legacy list for other modules and failed loads', () => {
    expect(manifestFromModule('wheel_clean', { sections: [{ id: 'nope' }] })).toEqual({ themeReady: false, sections: legacySections('wheel_clean') });
    expect(manifestFromModule('tint_dark', null).sections.find((s) => s.id === 'brands').label).toBe('Film Brands');
    expect(manifestFromModule('unknown_template', null).sections.map((s) => s.id))
      .toEqual(['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta']);
  });
});
