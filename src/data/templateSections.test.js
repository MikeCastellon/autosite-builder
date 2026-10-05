import { describe, it, expect } from 'vitest';
import { TEMPLATES, TEMPLATE_COMPONENT_MAP } from './templates.js';
import { TEMPLATE_SECTIONS, sectionIdsFor } from './templateSections.js';

// The mirror must match what each template module exports, or the Design
// step offers section ids a template doesn't render (or misses new ones).
describe('TEMPLATE_SECTIONS', () => {
  it('lists exactly the theme-ready templates, with their sections, added ids and heading fields', async () => {
    const live = {};
    for (const id of Object.keys(TEMPLATES)) {
      const load = TEMPLATE_COMPONENT_MAP[id];
      if (typeof load !== 'function') continue;
      const m = await load();
      if (!m.themeReady) continue;
      live[id] = {
        sections: m.sections.map((s) => ({ id: s.id, label: s.label })),
        added: m.addedSections || [],
        headingFields: m.headingFields ? Object.keys(m.headingFields) : null,
      };
    }
    expect(Object.keys(TEMPLATE_SECTIONS).sort()).toEqual(Object.keys(live).sort());
    for (const [id, t] of Object.entries(live)) {
      expect(TEMPLATE_SECTIONS[id], id).toEqual(t);
    }
  });

  it('sectionIdsFor gives [] for a template without section controls', () => {
    expect(sectionIdsFor('detailing_coastal')).toEqual([]);
    expect(sectionIdsFor('detailing_sporty')).toContain('hero');
  });
});
