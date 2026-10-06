import { describe, it, expect } from 'vitest';
import { parkEditorState, demoEditorState, stateAfterDemo, PARKED_EDITOR_KEYS, DEMO_BACK_LABELS } from './demoPreview.js';

const REAL = {
  siteId: 'site-1',
  selectedTemplate: 'tint_elite',
  generatedCopy: { heroTitle: 'Real' },
  editedCopy: { heroTitle: 'Real, edited' },
  images: { hero: 'https://x/hero.jpg' },
  customColors: { accent: '#123456' },
  customFonts: { heading: 'Inter' },
  editingExistingSite: true,
  step: 5,
};
const DEMO_COPY = { heroTitle: 'Miami Demo' };

describe('demoEditorState', () => {
  it('has no site to save to and none of the real content', () => {
    const s = demoEditorState('detailing_sporty', DEMO_COPY);
    expect(s.siteId).toBeNull();
    expect(s).toMatchObject({ selectedTemplate: 'detailing_sporty', images: {}, customColors: {}, customFonts: {}, editingExistingSite: false, step: 5 });
    expect(s.generatedCopy).toBe(DEMO_COPY);
    expect(s.editedCopy).toEqual(DEMO_COPY);
    expect(s.editedCopy).not.toBe(DEMO_COPY); // edits never mutate the shared demo data
  });

  it('replaces every parked slot', () => {
    expect(Object.keys(demoEditorState('x', DEMO_COPY)).sort()).toEqual([...PARKED_EDITOR_KEYS].sort());
  });
});

describe('parkEditorState / stateAfterDemo', () => {
  it('round-trips the real site, images included, back to the editor', () => {
    const parked = parkEditorState(REAL, 'editor');
    const { state, view } = stateAfterDemo(parked, 'detailing_sporty');
    expect(state).toEqual(REAL);
    expect(view).toBeNull();
  });

  it('returns to the Admin workspace when opened from there, with the real site parked', () => {
    const { state, view } = stateAfterDemo(parkEditorState(REAL, 'admin'), 'detailing_sporty');
    expect(view).toBe('admin');
    expect(state).toEqual(REAL);
    expect(DEMO_BACK_LABELS.admin).toBe('Back to Admin');
  });

  it('template picker: keeps the chosen template, or selects the previewed one when none was chosen', () => {
    const picker = { ...REAL, siteId: null, generatedCopy: null, editedCopy: null, images: {}, editingExistingSite: false, step: 3 };
    expect(stateAfterDemo(parkEditorState(picker, 'templates'), 'carwash_bubble').state.selectedTemplate).toBe('tint_elite');
    const none = { ...picker, selectedTemplate: null };
    const { state, view } = stateAfterDemo(parkEditorState(none, 'templates'), 'carwash_bubble');
    expect(state.selectedTemplate).toBe('carwash_bubble');
    expect(state.step).toBe(3);
    expect(view).toBeNull();
  });

  it('without a parked state, drops the demo content and has no site', () => {
    const { state, view } = stateAfterDemo(null, 'x');
    expect(state).toMatchObject({ siteId: null, generatedCopy: null, editedCopy: null, images: {}, step: 3 });
    expect(view).toBeNull();
  });

  it('labels Back for every entry point', () => {
    expect(Object.keys(DEMO_BACK_LABELS).sort()).toEqual(['admin', 'editor', 'templates']);
  });
});
