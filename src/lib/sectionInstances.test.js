import { describe, it, expect } from 'vitest';
import {
  makeInstanceId,
  getDefaultSectionsForTemplate,
  hasInstance,
  getOrderForType,
  getOrderForId,
  addInstance,
  removeInstance,
  moveInstance,
  duplicateInstance,
} from './sectionInstances.js';

describe('makeInstanceId', () => {
  it('returns ids prefixed with inst_ of length 13', () => {
    const id = makeInstanceId();
    expect(id).toMatch(/^inst_[a-z0-9]{8}$/);
  });
  it('returns unique ids on repeated calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(makeInstanceId());
    expect(ids.size).toBe(100);
  });
});

describe('getDefaultSectionsForTemplate', () => {
  it('returns the template-specific default with locked flags on hero/cta', () => {
    const out = getDefaultSectionsForTemplate('detailing_sporty');
    expect(out[0]).toMatchObject({ type: 'hero', locked: 'top' });
    expect(out[out.length - 1]).toMatchObject({ type: 'cta', locked: 'bottom' });
    expect(out.every(s => s.id.startsWith('inst_'))).toBe(true);
  });

  it('falls back to _default for unknown templates', () => {
    const out = getDefaultSectionsForTemplate('does_not_exist');
    expect(out.map(s => s.type)).toEqual(
      ['hero','services','about','gallery','testimonials','cta']
    );
  });

  it('locks hero top and cta bottom even when sandwiched in the template default', () => {
    const out = getDefaultSectionsForTemplate('mechanic_ironclad');
    expect(out.find(s => s.type === 'hero').locked).toBe('top');
    expect(out.find(s => s.type === 'cta').locked).toBe('bottom');
    const locked = out.filter(s => s.locked);
    expect(locked).toHaveLength(2);
  });
});

describe('hasInstance / getOrderForType / getOrderForId', () => {
  const sections = [
    { id: 'a', type: 'hero',       locked: 'top' },
    { id: 'b', type: 'services' },
    { id: 'c', type: 'mediaText' },
    { id: 'd', type: 'mediaText' },
    { id: 'e', type: 'cta',        locked: 'bottom' },
  ];

  it('hasInstance true when any instance of that type exists', () => {
    expect(hasInstance(sections, 'hero')).toBe(true);
    expect(hasInstance(sections, 'mediaText')).toBe(true);
    expect(hasInstance(sections, 'about')).toBe(false);
  });

  it('getOrderForType returns the index of the FIRST instance, or -1', () => {
    expect(getOrderForType(sections, 'hero')).toBe(0);
    expect(getOrderForType(sections, 'mediaText')).toBe(2);
    expect(getOrderForType(sections, 'about')).toBe(-1);
  });

  it('getOrderForId returns the exact instance index', () => {
    expect(getOrderForId(sections, 'c')).toBe(2);
    expect(getOrderForId(sections, 'd')).toBe(3);
    expect(getOrderForId(sections, 'zzz')).toBe(-1);
  });
});

describe('addInstance', () => {
  it('appends a new instance above the bottom-locked section', () => {
    const sections = [
      { id: 'a', type: 'hero', locked: 'top' },
      { id: 'b', type: 'cta',  locked: 'bottom' },
    ];
    const out = addInstance(sections, 'faq');
    expect(out).toHaveLength(3);
    expect(out[1].type).toBe('faq');
    expect(out[2].type).toBe('cta');
    expect(out[1].id).toMatch(/^inst_/);
  });

  it('appends at the very end when no bottom-locked section exists', () => {
    const sections = [{ id: 'a', type: 'hero', locked: 'top' }];
    const out = addInstance(sections, 'faq');
    expect(out[out.length - 1].type).toBe('faq');
  });
});

describe('removeInstance', () => {
  it('removes by id', () => {
    const sections = [
      { id: 'a', type: 'hero', locked: 'top' },
      { id: 'b', type: 'about' },
      { id: 'c', type: 'cta',  locked: 'bottom' },
    ];
    expect(removeInstance(sections, 'b').map(s => s.id)).toEqual(['a','c']);
  });

  it('refuses to remove a locked instance', () => {
    const sections = [
      { id: 'a', type: 'hero', locked: 'top' },
      { id: 'c', type: 'cta',  locked: 'bottom' },
    ];
    expect(removeInstance(sections, 'a')).toBe(sections);
    expect(removeInstance(sections, 'c')).toBe(sections);
  });
});

describe('moveInstance', () => {
  const sections = [
    { id: 'a', type: 'hero',  locked: 'top' },
    { id: 'b', type: 'about' },
    { id: 'c', type: 'gallery' },
    { id: 'd', type: 'cta',   locked: 'bottom' },
  ];

  it('reorders by moving id to target index, clamped between locked ends', () => {
    const out = moveInstance(sections, 'c', 1);
    expect(out.map(s => s.id)).toEqual(['a','c','b','d']);
  });

  it('refuses to move locked top out of position 0', () => {
    expect(moveInstance(sections, 'a', 2)).toBe(sections);
  });

  it('refuses to move locked bottom off the end', () => {
    expect(moveInstance(sections, 'd', 1)).toBe(sections);
  });

  it('refuses to move any instance into position 0 (reserved for top-lock)', () => {
    expect(moveInstance(sections, 'b', 0)).toBe(sections);
  });

  it('refuses to move any instance into the last position (reserved for bottom-lock)', () => {
    expect(moveInstance(sections, 'b', sections.length - 1)).toBe(sections);
  });

  it('clamps targetIdx > sections.length - 1 so moved item never lands past the bottom-lock', () => {
    const out = moveInstance(sections, 'b', 99);
    // 'b' should land just above 'd' (the bottom-locked cta), i.e. at index 2.
    expect(out.map(s => s.id)).toEqual(['a','c','b','d']);
  });

  it('returns same reference for a no-op move (targetIdx === fromIdx)', () => {
    const out = moveInstance(sections, 'b', 1);
    expect(out).toBe(sections);
  });
});

describe('duplicateInstance', () => {
  it('inserts a new instance of the same type directly below the source', () => {
    const sections = [
      { id: 'a', type: 'hero', locked: 'top' },
      { id: 'b', type: 'mediaText' },
      { id: 'c', type: 'cta',  locked: 'bottom' },
    ];
    const out = duplicateInstance(sections, 'b');
    expect(out).toHaveLength(4);
    expect(out[1].id).toBe('b');
    expect(out[2].type).toBe('mediaText');
    expect(out[2].id).not.toBe('b');
    expect(out[3].id).toBe('c');
  });

  it('refuses to duplicate non-multi types', () => {
    const sections = [
      { id: 'a', type: 'hero',  locked: 'top' },
      { id: 'b', type: 'about' },
      { id: 'c', type: 'cta',   locked: 'bottom' },
    ];
    expect(duplicateInstance(sections, 'b')).toBe(sections);
  });
});
