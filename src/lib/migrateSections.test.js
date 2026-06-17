import { describe, it, expect } from 'vitest';
import { migrateSections, needsMigration } from './migrateSections.js';

describe('needsMigration', () => {
  it('true when sections array is missing', () => {
    expect(needsMigration({ hiddenSections: [], sectionOrder: [] })).toBe(true);
    expect(needsMigration({})).toBe(true);
  });
  it('false when sections array is already present', () => {
    expect(needsMigration({ sections: [{ id: 'a', type: 'hero' }] })).toBe(false);
  });
});

describe('migrateSections', () => {
  it('returns input unchanged if already migrated', () => {
    const copy = { sections: [{ id: 'a', type: 'hero', locked: 'top' }] };
    expect(migrateSections(copy, 'detailing_sporty')).toBe(copy);
  });

  it('builds sections list from template default when sectionOrder is empty', () => {
    const copy = { hiddenSections: [], sectionOrder: [] };
    const out = migrateSections(copy, 'detailing_sporty');
    expect(out.sections.map(s => s.type)).toEqual(
      ['hero','statsBar','services','about','gallery','testimonials','cta']
    );
    expect(out.sections[0].locked).toBe('top');
    expect(out.sections[out.sections.length - 1].locked).toBe('bottom');
  });

  it('respects saved sectionOrder and filters hiddenSections', () => {
    const copy = {
      hiddenSections: ['gallery'],
      sectionOrder: ['hero','services','about','gallery','testimonials','cta'],
    };
    const out = migrateSections(copy, 'detailing_sporty');
    expect(out.sections.map(s => s.type)).toEqual(
      ['hero','services','about','testimonials','cta']
    );
  });

  it('re-adds hero at top if user had it hidden (hero is always locked-top)', () => {
    const copy = {
      hiddenSections: ['hero'],
      sectionOrder: ['services','about','cta'],
    };
    const out = migrateSections(copy, 'detailing_sporty');
    expect(out.sections[0].type).toBe('hero');
    expect(out.sections[0].locked).toBe('top');
  });

  it('re-adds cta at bottom if user had it hidden (cta is always locked-bottom)', () => {
    const copy = {
      hiddenSections: ['cta'],
      sectionOrder: ['hero','services'],
    };
    const out = migrateSections(copy, 'detailing_sporty');
    expect(out.sections[out.sections.length - 1].type).toBe('cta');
    expect(out.sections[out.sections.length - 1].locked).toBe('bottom');
  });

  it('initializes empty sectionContent map when missing', () => {
    const out = migrateSections({ hiddenSections: [], sectionOrder: [] }, 'detailing_sporty');
    expect(out.sectionContent).toEqual({});
  });

  it('preserves an existing sectionContent map', () => {
    const copy = { hiddenSections: [], sectionOrder: ['hero','cta'], sectionContent: { 'inst_x': { foo: 'bar' } } };
    const out = migrateSections(copy, 'detailing_sporty');
    expect(out.sectionContent).toEqual({ 'inst_x': { foo: 'bar' } });
  });

  it('keeps original hiddenSections + sectionOrder on the object (safety net)', () => {
    const copy = { hiddenSections: ['gallery'], sectionOrder: ['hero','cta'] };
    const out = migrateSections(copy, 'detailing_sporty');
    expect(out.hiddenSections).toEqual(['gallery']);
    expect(out.sectionOrder).toEqual(['hero','cta']);
  });
});
