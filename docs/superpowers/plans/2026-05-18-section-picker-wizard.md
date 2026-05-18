# Choose Sections Wizard Step + Instance-Based Section Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Choose Sections" step to the website-creator wizard so users compose their page (with duplicates and four new section types — FAQ, Before & After, Media + Text, and universal Process) before AI generation, with all sections stored as an ordered list of instances.

**Architecture:** Replace today's singleton-id `hiddenSections` + `sectionOrder` arrays on `generatedCopy` with one `sections: [{id, type, locked?}, ...]` array. Add a `sectionContent[instanceId]` map for per-instance content (Media+Text bodies, FAQ items, etc.). Templates iterate the user's section list; existing inline sections render conditionally per type; new section types render via shared components dispatched from a `SectionRenderer`. The Netlify generation function receives the section list and returns instance-keyed copy. Existing sites auto-migrate on load.

**Tech Stack:** React 19, Vite, Vitest, Tailwind CSS, Supabase JS, Netlify Functions (Node), Anthropic SDK.

**Scope notes:** Spec at [docs/superpowers/specs/2026-05-18-section-picker-wizard-design.md](docs/superpowers/specs/2026-05-18-section-picker-wizard-design.md). All work stays on the worktree branch `claude/funny-margulis-bcc045`. Do NOT push to master without explicit user approval. The user override "test branch only" trumps the global "push directly to master" default for this project.

**Step numbering decision:** Use `step === 3.5` for the new Choose Sections step (consistent with existing `step === 5.5` for Social Feeds at [src/App.jsx:752](src/App.jsx:752)). Do NOT renumber 4/5/5.5/6/7 — keeping fractional steps is the established pattern.

---

## File Structure

**Create:**
- `src/data/sectionCatalog.js` — registry of section types (type, label, description, icon, multi, group, supportedTemplates)
- `src/lib/sectionInstances.js` — helpers for instance lists (makeInstanceId, getDefaultSectionsForTemplate, hasInstance, getOrderForType, getOrderForId, addInstance, removeInstance, moveInstance, duplicateInstance)
- `src/lib/sectionInstances.test.js`
- `src/lib/migrateSections.js` — old-format (hiddenSections + sectionOrder) → new instance list
- `src/lib/migrateSections.test.js`
- `src/components/wizard/StepChooseSections.jsx` — new wizard step shell
- `src/components/wizard/SectionCatalogPanel.jsx` — left panel: catalog
- `src/components/wizard/SectionCompositionPanel.jsx` — right panel: composition with drag-drop
- `src/components/preview/sections/SectionRenderer.jsx` — dispatcher
- `src/components/preview/sections/FAQSection.jsx`
- `src/components/preview/sections/BeforeAfterSection.jsx`
- `src/components/preview/sections/MediaTextSection.jsx`
- `src/components/preview/sections/ProcessSection.jsx`

**Modify:**
- `src/App.jsx` — new `selectedSections` state; step 3.5 transition; pass sections to generator; migrate on edit-existing
- `src/components/wizard/WizardShell.jsx:5` — STEP_LABELS adds "Sections"
- `src/components/wizard/StepTemplatePicker.jsx` — `onGenerate` prop becomes `onChooseSections`, advances to 3.5
- `src/components/preview/ContentEditor.jsx` — dynamic tab list per instance; rename "Sections" tab content to use instance model
- `src/lib/sectionOrder.js` — keep `buildSectionOrder` for legacy callers; the new helpers live in `sectionInstances.js`
- `src/lib/saveSite.js` — accept and persist `sections` + `sectionContent` (already passes generatedCopy through, so this is mostly verification)
- `netlify/functions/generate-website.js` — accept `sections` on input, build dynamic prompt schema, return `sectionContent` map
- All 23 template files in `src/components/preview/templates/**/*.jsx` — swap `hidden`/`getOrder` calls to instance-aware variants and append new-section map at end

---

## Phase 1 — Foundation libs (TDD, no UI changes)

### Task 1: Section catalog registry

**Files:**
- Create: `src/data/sectionCatalog.js`

- [ ] **Step 1: Write the catalog file**

```js
// src/data/sectionCatalog.js
// Registry of all section types the wizard catalog and SectionRenderer know about.
// Each entry: { type, label, description, group, multi, locked, supportedTemplates }
// - multi: true if a page can have multiple instances of this type (e.g. mediaText).
// - locked: 'top' | 'bottom' if the section is required at a fixed position.
// - supportedTemplates: if present, restricts the catalog to listing this section
//   only when the current template id is in the array. Absent = supported everywhere.

export const SECTION_CATALOG = [
  // ─── Essentials ─────────────────────────────────────────────────
  { type: 'hero',         label: 'Hero',            description: 'Main headline + image',          group: 'essentials', locked: 'top' },
  { type: 'services',     label: 'Services',        description: 'Service cards',                  group: 'essentials' },
  { type: 'about',        label: 'About',           description: 'Story + trust paragraph',        group: 'essentials' },
  { type: 'gallery',      label: 'Gallery',         description: 'Photo grid',                     group: 'essentials' },
  { type: 'testimonials', label: 'Reviews',         description: 'Customer testimonials',          group: 'essentials' },
  { type: 'cta',          label: 'Contact / CTA',   description: 'Hours, phone, address, button',  group: 'essentials', locked: 'bottom' },

  // ─── Content (universal as of this update) ──────────────────────
  { type: 'process',      label: 'How It Works',    description: 'Numbered steps',                 group: 'content' },
  { type: 'faq',          label: 'FAQ',             description: 'Common questions + answers',     group: 'content' },
  { type: 'beforeAfter',  label: 'Before & After',  description: 'Transformation photo pairs',     group: 'content' },
  { type: 'mediaText',    label: 'Media + Text',    description: 'Image/video beside custom copy', group: 'content', multi: true },

  // ─── Template-specific (kept scoped to templates that already render them) ───
  { type: 'statsBar',     label: 'Stats Bar',       description: 'Big numbers row',                group: 'template',
    supportedTemplates: ['detailing_sporty','wheel_edge','wheel_clean','tint_obsidian','tint_dark','tint_elite','tint_sleek','mobile_bold','mobile_modern','mobile_rugged','mobile_chrome','mobile_sudsy'] },
  { type: 'whyUs',        label: 'Why Us',          description: 'Trust callouts',                 group: 'template',
    supportedTemplates: ['mechanic_ironclad','mobile_sudsy','carwash_bubble'] },
  { type: 'awards',       label: 'Awards',          description: 'Awards row',                     group: 'template',
    supportedTemplates: ['wheel_clean'] },
  { type: 'trustBar',     label: 'Trust Bar',       description: 'Trust badges row',               group: 'template',
    supportedTemplates: ['wheel_apex'] },
  { type: 'ticker',       label: 'Ticker',          description: 'Scrolling service ticker',       group: 'template',
    supportedTemplates: ['wheel_apex','mechanic_ironclad'] },
  { type: 'ctaBand',      label: 'CTA Banner',      description: 'Slim full-width call-out',       group: 'template',
    supportedTemplates: ['mechanic_ironclad'] },
  { type: 'brands',       label: 'Brands',          description: 'Brand logos row',                group: 'template',
    supportedTemplates: ['wheel_edge','wheel_clean','wheel_apex','tint_dark','tint_elite','tint_obsidian','tint_sleek'] },
  { type: 'products',     label: 'Products',        description: 'Product highlight grid',         group: 'template',
    supportedTemplates: ['wheel_apex'] },
  { type: 'shadeGuide',   label: 'Shade Guide',     description: 'Window tint shades',             group: 'template',
    supportedTemplates: ['tint_obsidian'] },
  { type: 'filmBrands',   label: 'Film Brands',     description: 'Film brand logos',               group: 'template',
    supportedTemplates: ['tint_dark','tint_elite','tint_obsidian','tint_sleek'] },
];

export const SECTION_GROUPS = {
  essentials: 'Essentials',
  content: 'Content',
  template: 'Template-specific',
};

// Per-template default composition used to populate the new wizard step's
// initial state. Sourced from the existing TOGGLEABLE registry in
// ContentEditor.jsx so behaviour matches what users see today, with the four
// new universal sections (faq, beforeAfter, mediaText, process) added only
// where a template would naturally have a "process" block today. For new
// templates, the _default key applies.
export const TEMPLATE_DEFAULT_SECTIONS = {
  _default:           ['hero','statsBar','services','about','gallery','testimonials','cta'],
  mechanic_ironclad:  ['hero','ticker','ctaBand','about','services','gallery','whyUs','testimonials','cta'],
  wheel_apex:         ['hero','trustBar','ticker','products','brands','about','gallery','testimonials','cta'],
  wheel_edge:         ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  wheel_clean:        ['hero','statsBar','awards','services','brands','about','gallery','testimonials','cta'],
  tint_obsidian:      ['hero','shadeGuide','services','brands','process','about','gallery','testimonials','cta'],
  tint_elite:         ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  tint_dark:          ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  tint_sleek:         ['hero','statsBar','services','brands','about','gallery','testimonials','cta'],
  mobile_sudsy:       ['hero','services','process','whyUs','about','gallery','testimonials','cta'],
  carwash_bubble:     ['hero','services','process','about','whyUs','gallery','testimonials','cta'],
};

export function getCatalogEntry(type) {
  return SECTION_CATALOG.find(c => c.type === type);
}

export function getCatalogForTemplate(templateId) {
  return SECTION_CATALOG.filter(c =>
    !c.supportedTemplates || c.supportedTemplates.includes(templateId)
  );
}

export function getDefaultSectionTypesForTemplate(templateId) {
  return TEMPLATE_DEFAULT_SECTIONS[templateId] || TEMPLATE_DEFAULT_SECTIONS._default;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/sectionCatalog.js
git commit -m "feat(sections): add section catalog registry + per-template defaults"
```

---

### Task 2: Section instance helpers + tests

**Files:**
- Create: `src/lib/sectionInstances.js`
- Test:   `src/lib/sectionInstances.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/sectionInstances.test.js
import { describe, it, expect, vi } from 'vitest';
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
      ['hero','statsBar','services','about','gallery','testimonials','cta']
    );
  });

  it('locks hero top and cta bottom even when sandwiched in the template default', () => {
    const out = getDefaultSectionsForTemplate('mechanic_ironclad');
    expect(out.find(s => s.type === 'hero').locked).toBe('top');
    expect(out.find(s => s.type === 'cta').locked).toBe('bottom');
    // No other sections should be locked
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
    expect(removeInstance(sections, 'a')).toBe(sections); // unchanged reference
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/sectionInstances.test.js`
Expected: ALL tests FAIL with "Cannot find module './sectionInstances.js'" or similar.

- [ ] **Step 3: Implement sectionInstances.js**

```js
// src/lib/sectionInstances.js
import { getCatalogEntry, getDefaultSectionTypesForTemplate } from '../data/sectionCatalog.js';

export function makeInstanceId() {
  // 8 base36 chars give ~2.8e12 combos — collision-free within a single site
  return 'inst_' + Math.random().toString(36).slice(2, 10);
}

export function getDefaultSectionsForTemplate(templateId) {
  const types = getDefaultSectionTypesForTemplate(templateId);
  return types.map((type, i) => {
    const entry = getCatalogEntry(type);
    const locked = entry?.locked;
    return {
      id: makeInstanceId(),
      type,
      ...(locked ? { locked } : {}),
    };
  });
}

export function hasInstance(sections, type) {
  return Array.isArray(sections) && sections.some(s => s.type === type);
}

export function getOrderForType(sections, type) {
  if (!Array.isArray(sections)) return -1;
  return sections.findIndex(s => s.type === type);
}

export function getOrderForId(sections, id) {
  if (!Array.isArray(sections)) return -1;
  return sections.findIndex(s => s.id === id);
}

export function addInstance(sections, type) {
  const newInst = { id: makeInstanceId(), type };
  const bottomIdx = sections.findIndex(s => s.locked === 'bottom');
  if (bottomIdx === -1) return [...sections, newInst];
  return [...sections.slice(0, bottomIdx), newInst, ...sections.slice(bottomIdx)];
}

export function removeInstance(sections, id) {
  const target = sections.find(s => s.id === id);
  if (!target || target.locked) return sections;
  return sections.filter(s => s.id !== id);
}

export function moveInstance(sections, id, targetIdx) {
  const fromIdx = sections.findIndex(s => s.id === id);
  if (fromIdx === -1) return sections;

  const moving = sections[fromIdx];
  if (moving.locked) return sections; // locked sections can't be reordered

  // Reject any move into a locked slot.
  const topLocked = sections[0]?.locked === 'top';
  const bottomLocked = sections[sections.length - 1]?.locked === 'bottom';
  if (topLocked && targetIdx === 0) return sections;
  if (bottomLocked && targetIdx === sections.length - 1) return sections;

  const next = sections.slice();
  next.splice(fromIdx, 1);
  next.splice(targetIdx, 0, moving);
  return next;
}

export function duplicateInstance(sections, id) {
  const target = sections.find(s => s.id === id);
  if (!target) return sections;
  const entry = getCatalogEntry(target.type);
  if (!entry?.multi) return sections;
  const fromIdx = sections.indexOf(target);
  const copy = { id: makeInstanceId(), type: target.type };
  return [...sections.slice(0, fromIdx + 1), copy, ...sections.slice(fromIdx + 1)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/sectionInstances.test.js`
Expected: ALL tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sectionInstances.js src/lib/sectionInstances.test.js
git commit -m "feat(sections): add instance helpers (add/remove/move/duplicate) + tests"
```

---

### Task 3: Migration helper for existing sites

**Files:**
- Create: `src/lib/migrateSections.js`
- Test:   `src/lib/migrateSections.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/migrateSections.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/migrateSections.test.js`
Expected: ALL tests FAIL with "Cannot find module './migrateSections.js'".

- [ ] **Step 3: Implement migrateSections.js**

```js
// src/lib/migrateSections.js
import { makeInstanceId } from './sectionInstances.js';
import { getDefaultSectionTypesForTemplate, getCatalogEntry } from '../data/sectionCatalog.js';

export function needsMigration(copy) {
  return !Array.isArray(copy?.sections);
}

export function migrateSections(copy, templateId) {
  if (!needsMigration(copy)) return copy;

  const defaultIds = getDefaultSectionTypesForTemplate(templateId);
  const sourceOrder = (copy?.sectionOrder?.length ? copy.sectionOrder : defaultIds);
  const hidden = new Set(copy?.hiddenSections || []);

  // Build the visible types, preserving saved order.
  let types = sourceOrder.filter(t => !hidden.has(t));

  // Force locked-top type ('hero') to be present and first.
  const topType = defaultIds.find(t => getCatalogEntry(t)?.locked === 'top') || 'hero';
  types = [topType, ...types.filter(t => t !== topType)];

  // Force locked-bottom type ('cta') to be present and last.
  const bottomType = defaultIds.find(t => getCatalogEntry(t)?.locked === 'bottom') || 'cta';
  types = [...types.filter(t => t !== bottomType), bottomType];

  const sections = types.map(type => {
    const entry = getCatalogEntry(type);
    const locked = entry?.locked;
    return {
      id: makeInstanceId(),
      type,
      ...(locked ? { locked } : {}),
    };
  });

  return {
    ...copy,
    sections,
    sectionContent: copy?.sectionContent || {},
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/migrateSections.test.js`
Expected: ALL tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrateSections.js src/lib/migrateSections.test.js
git commit -m "feat(sections): migrate legacy hiddenSections+sectionOrder to instance list"
```

---

## Phase 2 — Shared section components

These four components are rendered by `SectionRenderer` and styled from `templateMeta` so they fit any template.

### Task 4: SectionRenderer dispatcher

**Files:**
- Create: `src/components/preview/sections/SectionRenderer.jsx`

- [ ] **Step 1: Write the dispatcher**

```jsx
// src/components/preview/sections/SectionRenderer.jsx
// Dispatches new-style section types to their shared component implementations.
// Existing singleton sections (hero/services/about/gallery/testimonials/cta/etc.)
// remain inline in each template file — this renderer is only for NEW universal
// types and per-instance multi types (mediaText).

import FAQSection from './FAQSection.jsx';
import BeforeAfterSection from './BeforeAfterSection.jsx';
import MediaTextSection from './MediaTextSection.jsx';
import ProcessSection from './ProcessSection.jsx';

const REGISTRY = {
  faq: FAQSection,
  beforeAfter: BeforeAfterSection,
  mediaText: MediaTextSection,
  process: ProcessSection,
};

export default function SectionRenderer({ instance, order, ...shared }) {
  const Comp = REGISTRY[instance.type];
  if (!Comp) return null;
  return (
    <div style={{ order }}>
      <Comp instance={instance} {...shared} />
    </div>
  );
}

export function isRendererManagedType(type) {
  return type in REGISTRY;
}
```

- [ ] **Step 2: Commit (component stubs come in next tasks)**

```bash
git add src/components/preview/sections/SectionRenderer.jsx
git commit -m "feat(sections): add SectionRenderer dispatcher for new universal types"
```

---

### Task 5: ProcessSection component

The existing inline "process" markup lives in MobileSudsy, CarwashBubble, and TintObsidian. This task creates a shared component that any template can render.

**Files:**
- Create: `src/components/preview/sections/ProcessSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/components/preview/sections/ProcessSection.jsx
// Renders a numbered "How It Works" steps block. Pulls copy from generatedCopy.process.
// Falls back to a generic 4-step placeholder if AI hasn't returned content yet.

export default function ProcessSection({ generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;

  const intro = generatedCopy?.process?.intro || 'How working with us looks.';
  const steps = generatedCopy?.process?.steps?.length
    ? generatedCopy.process.steps
    : [
      { title: 'Get in touch',  description: 'Tell us what you need.' },
      { title: 'We plan it',    description: 'You get a clear quote.' },
      { title: 'We do the work', description: 'On schedule, every time.' },
      { title: 'You enjoy it',  description: 'Driveaway ready.' },
    ];

  return (
    <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: font, color: c.text, fontWeight: 900,
          fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '0.75rem', textAlign: 'center',
        }}>How It Works</h2>
        <p style={{
          fontFamily: bodyFont, color: c.muted,
          fontSize: 'clamp(0.95rem,1.4cqi,1.05rem)', lineHeight: 1.6,
          textAlign: 'center', maxWidth: 640, margin: '0 auto 2.5rem',
        }}>{intro}</p>
        <div style={{
          display: 'grid', gap: '1.5rem',
          gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              background: c.secondary, padding: '1.5rem',
              borderTop: `3px solid ${c.accent}`,
            }}>
              <div style={{
                fontFamily: font, fontSize: '2rem', fontWeight: 900, color: c.accent,
                lineHeight: 1, marginBottom: '0.5rem',
              }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{
                fontFamily: font, fontSize: '1.05rem', fontWeight: 700,
                color: c.text, marginBottom: '0.4rem',
              }}>{step.title}</div>
              <div style={{
                fontFamily: bodyFont, fontSize: '0.9rem', color: c.muted, lineHeight: 1.55,
              }}>{step.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/preview/sections/ProcessSection.jsx
git commit -m "feat(sections): shared ProcessSection component"
```

---

### Task 6: FAQSection component

**Files:**
- Create: `src/components/preview/sections/FAQSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/components/preview/sections/FAQSection.jsx
// Renders an FAQ accordion. Per-instance content lives in
// generatedCopy.sectionContent[instance.id] = { items: [{q,a}, ...] }.
// Falls back to generic placeholder questions if AI hasn't returned content yet.

import { useState } from 'react';

export default function FAQSection({ instance, generatedCopy, templateMeta, businessInfo }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const content = generatedCopy?.sectionContent?.[instance.id] || {};
  const items = content.items?.length ? content.items : [
    { q: `What areas does ${businessInfo?.businessName || 'your shop'} serve?`,
      a: `We proudly serve ${businessInfo?.city || 'the local area'} and surrounding neighborhoods.` },
    { q: 'Do I need an appointment?',
      a: 'Appointments are recommended but we do take walk-ins when our schedule allows.' },
    { q: 'How long does a typical service take?',
      a: 'Most services are completed the same day. We will give you a clear ETA at drop-off.' },
    { q: 'What forms of payment do you accept?',
      a: 'We accept all major credit cards, debit, and cash.' },
  ];

  const [open, setOpen] = useState(0);

  return (
    <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: font, color: c.text, fontWeight: 900,
          fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '2rem', textAlign: 'center',
        }}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{
                background: c.secondary, border: `1px solid ${c.accent}22`,
              }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  style={{
                    width: '100%', padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: font, color: c.text, fontWeight: 700, textAlign: 'left',
                    fontSize: '1rem',
                  }}
                >
                  <span>{item.q}</span>
                  <span style={{
                    color: c.accent, fontSize: '1.25rem', flexShrink: 0,
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.18s',
                  }}>+</span>
                </button>
                {isOpen && (
                  <div style={{
                    padding: '0 1.25rem 1.25rem',
                    fontFamily: bodyFont, color: c.muted, lineHeight: 1.6,
                    fontSize: '0.95rem',
                  }}>{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/preview/sections/FAQSection.jsx
git commit -m "feat(sections): shared FAQSection component with per-instance content"
```

---

### Task 7: MediaTextSection component

**Files:**
- Create: `src/components/preview/sections/MediaTextSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/components/preview/sections/MediaTextSection.jsx
// Image-or-video block beside a heading + body + optional CTA.
// Per-instance content: generatedCopy.sectionContent[instance.id] =
//   { heading, body, image?, video?, ctaLabel?, ctaUrl?, alignment: 'left'|'right' }
// Per-instance image lookup in `images` map keyed by instance id:
//   images[`mediaText_${instance.id}`]

export default function MediaTextSection({ instance, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const content = generatedCopy?.sectionContent?.[instance.id] || {};
  const alignment = content.alignment === 'right' ? 'right' : 'left';
  const imageSrc = images[`mediaText_${instance.id}`] || content.image || null;

  const heading = content.heading || 'Tell your story';
  const body = content.body || 'Add custom copy here in the editor to highlight what makes you different.';

  const reverse = alignment === 'right';

  return (
    <section style={{
      background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'grid', gap: 'clamp(1.5rem,3cqi,3rem)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        direction: reverse ? 'rtl' : 'ltr',
      }}>
        <div style={{ direction: 'ltr', minHeight: 240 }}>
          {imageSrc
            ? <img src={imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 240 }} />
            : <div style={{
                width: '100%', minHeight: 240, background: c.secondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: bodyFont, color: c.muted, fontSize: '0.85rem',
              }}>Upload an image in the editor</div>
          }
        </div>
        <div style={{ direction: 'ltr', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{
            fontFamily: font, color: c.text, fontWeight: 900,
            fontSize: 'clamp(1.4rem,3cqi,2.25rem)', lineHeight: 1.1, marginBottom: '1rem',
          }}>{heading}</h2>
          <p style={{
            fontFamily: bodyFont, color: c.muted, lineHeight: 1.65,
            fontSize: 'clamp(0.95rem,1.4cqi,1.05rem)', marginBottom: content.ctaLabel ? '1.5rem' : 0,
          }}>{body}</p>
          {content.ctaLabel && (
            <a href={content.ctaUrl || '#contact'} style={{
              alignSelf: 'flex-start',
              background: c.accent, color: '#fff', padding: '12px 28px',
              fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>{content.ctaLabel}</a>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/preview/sections/MediaTextSection.jsx
git commit -m "feat(sections): shared MediaTextSection with per-instance heading/body/image"
```

---

### Task 8: BeforeAfterSection component

**Files:**
- Create: `src/components/preview/sections/BeforeAfterSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/components/preview/sections/BeforeAfterSection.jsx
// Grid of before/after image pairs. Per-instance content holds the list of
// pair refs; the actual images live in `images` keyed by `<instanceId>_pair<N>_before` / `_after`.

export default function BeforeAfterSection({ instance, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const content = generatedCopy?.sectionContent?.[instance.id] || {};
  const pairCount = content.pairCount || 3;
  const heading = content.heading || 'Before & After';
  const intro = content.intro || 'Real results from real customers.';

  // Resolve image keys
  const pairs = [];
  for (let i = 0; i < pairCount; i++) {
    const before = images[`${instance.id}_pair${i}_before`];
    const after = images[`${instance.id}_pair${i}_after`];
    pairs.push({ before, after });
  }
  const hasAnyImages = pairs.some(p => p.before || p.after);

  if (!hasAnyImages) {
    // Empty state — visible only in editor preview; rendered live so user can upload
    return (
      <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: font, color: c.text, fontWeight: 900, fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '0.5rem' }}>{heading}</h2>
          <p style={{ fontFamily: bodyFont, color: c.muted, fontSize: '0.95rem' }}>
            Upload before/after photos in the editor to populate this section.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ fontFamily: font, color: c.text, fontWeight: 900, fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '0.5rem', textAlign: 'center' }}>{heading}</h2>
        <p style={{ fontFamily: bodyFont, color: c.muted, fontSize: 'clamp(0.95rem,1.4cqi,1.05rem)', textAlign: 'center', marginBottom: '2.5rem', maxWidth: 640, marginInline: 'auto' }}>{intro}</p>
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {pairs.map((p, i) => (
            <div key={i} style={{ background: c.secondary, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: c.accent + '22' }}>
                <PairCell label="Before" src={p.before} c={c} bodyFont={bodyFont} />
                <PairCell label="After"  src={p.after}  c={c} bodyFont={bodyFont} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PairCell({ label, src, c, bodyFont }) {
  return (
    <div style={{ position: 'relative', minHeight: 200, background: c.bg }}>
      {src
        ? <img src={src} alt={label} style={{ width: '100%', height: '100%', minHeight: 200, objectFit: 'cover', display: 'block' }} />
        : <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontFamily: bodyFont, fontSize: '0.85rem' }}>{label}: upload photo</div>
      }
      <span style={{
        position: 'absolute', top: 8, left: 8,
        background: c.accent, color: '#fff', padding: '3px 10px',
        fontFamily: bodyFont, fontSize: '0.7rem', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/preview/sections/BeforeAfterSection.jsx
git commit -m "feat(sections): shared BeforeAfterSection with per-instance image pairs"
```

---

## Phase 3 — Wizard step (Choose Sections)

### Task 9: SectionCatalogPanel (left panel)

**Files:**
- Create: `src/components/wizard/SectionCatalogPanel.jsx`

- [ ] **Step 1: Write the catalog panel**

```jsx
// src/components/wizard/SectionCatalogPanel.jsx
// Left panel of the Choose Sections wizard step.
// Lists section types grouped by intent. Clicking a card calls onAdd(type).
// Cards for already-locked-singleton types (e.g. hero, cta) are dimmed and disabled.

import { SECTION_CATALOG, SECTION_GROUPS, getCatalogForTemplate } from '../../data/sectionCatalog.js';
import { hasInstance } from '../../lib/sectionInstances.js';

export default function SectionCatalogPanel({ templateId, sections, onAdd }) {
  const catalog = getCatalogForTemplate(templateId);
  const groups = {};
  for (const entry of catalog) {
    (groups[entry.group] ||= []).push(entry);
  }
  const groupOrder = ['essentials', 'content', 'template'];

  return (
    <aside className="w-80 shrink-0 border-r border-black/[0.07] bg-[#faf9f7] overflow-y-auto">
      <div className="px-4 py-4">
        <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-1">Add a section</p>
        <p className="text-[12px] text-[#888] mb-4">Click to add to the page on the right.</p>
        {groupOrder.map(g => {
          if (!groups[g]?.length) return null;
          return (
            <div key={g} className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888] mb-2">{SECTION_GROUPS[g]}</p>
              <div className="flex flex-col gap-1.5">
                {groups[g].map(entry => {
                  const alreadyHas = hasInstance(sections, entry.type);
                  const isSingleton = !entry.multi;
                  const isLocked = !!entry.locked;
                  const disabled = isLocked || (isSingleton && alreadyHas);
                  return (
                    <button
                      key={entry.type}
                      type="button"
                      onClick={() => !disabled && onAdd(entry.type)}
                      disabled={disabled}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-colors
                        ${disabled
                          ? 'border-black/[0.04] bg-white/40 text-[#bbb] cursor-not-allowed'
                          : 'border-black/[0.07] bg-white hover:border-[#cc0000]/30 hover:bg-white text-[#1a1a1a] cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold">{entry.label}</span>
                        {entry.multi && !isLocked && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#cc0000] bg-[#cc0000]/10 px-1.5 py-0.5 rounded">multi</span>
                        )}
                        {isLocked && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#888] bg-black/5 px-1.5 py-0.5 rounded">locked</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#888] mt-0.5 leading-snug">{entry.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/SectionCatalogPanel.jsx
git commit -m "feat(wizard): SectionCatalogPanel — left side of Choose Sections step"
```

---

### Task 10: SectionCompositionPanel (right panel with drag-and-drop)

**Files:**
- Create: `src/components/wizard/SectionCompositionPanel.jsx`

- [ ] **Step 1: Write the composition panel**

```jsx
// src/components/wizard/SectionCompositionPanel.jsx
// Right panel of the Choose Sections wizard step. Shows the ordered list of
// section instances. Each row: drag handle + label + (× and duplicate when applicable).
// Hero and Contact/CTA are locked at top/bottom respectively.

import { useState } from 'react';
import { getCatalogEntry } from '../../data/sectionCatalog.js';
import { removeInstance, moveInstance, duplicateInstance } from '../../lib/sectionInstances.js';

export default function SectionCompositionPanel({ sections, onChange }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver  = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop      = (idx) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const moving = sections[dragIdx];
    if (moving?.locked) { setDragIdx(null); setDragOverIdx(null); return; }
    onChange(moveInstance(sections, moving.id, idx));
    setDragIdx(null); setDragOverIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  return (
    <main className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6">
        <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-1">Your page</p>
        <p className="text-[12px] text-[#888] mb-5">Drag to reorder. Hero stays on top and the Contact/CTA at the bottom.</p>
        <div className="flex flex-col gap-1.5">
          {sections.map((inst, idx) => {
            const entry = getCatalogEntry(inst.type);
            const label = entry?.label || inst.type;
            const isLocked = !!inst.locked;
            const isDup = !!entry?.multi;
            return (
              <div
                key={inst.id}
                draggable={!isLocked}
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={onDragEnd}
                className="flex items-center gap-2.5 py-3 px-3 rounded-lg border border-black/[0.07] bg-white select-none"
                style={{
                  opacity: dragIdx === idx ? 0.35 : 1,
                  borderTop: dragOverIdx === idx && dragIdx !== idx ? '2px solid #cc0000' : '1px solid rgba(0,0,0,0.07)',
                  cursor: isLocked ? 'default' : 'grab',
                }}
              >
                <span className="text-[#bbb] text-[14px] leading-none shrink-0" title={isLocked ? 'Locked' : 'Drag to reorder'}>
                  {isLocked ? '🔒' : '⠿'}
                </span>
                <span className="flex-1 text-[13px] font-medium text-[#1a1a1a]">{label}</span>
                {isDup && !isLocked && (
                  <button
                    type="button"
                    onClick={() => onChange(duplicateInstance(sections, inst.id))}
                    className="text-[11px] font-medium text-[#555] hover:text-[#cc0000] px-2 py-1 rounded transition-colors"
                    title="Duplicate this section"
                  >
                    + Duplicate
                  </button>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => onChange(removeInstance(sections, inst.id))}
                    className="text-[#bbb] hover:text-[#cc0000] text-[18px] leading-none w-6 h-6 flex items-center justify-center transition-colors shrink-0"
                    title="Remove"
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/SectionCompositionPanel.jsx
git commit -m "feat(wizard): SectionCompositionPanel — drag-drop ordered instance list"
```

---

### Task 11: StepChooseSections shell

**Files:**
- Create: `src/components/wizard/StepChooseSections.jsx`

- [ ] **Step 1: Write the step shell**

```jsx
// src/components/wizard/StepChooseSections.jsx
// New wizard step between Template and Generating. Composes the catalog panel
// (left) and the composition panel (right) and exposes a single "Generate" CTA.

import SectionCatalogPanel from './SectionCatalogPanel.jsx';
import SectionCompositionPanel from './SectionCompositionPanel.jsx';
import { addInstance } from '../../lib/sectionInstances.js';

export default function StepChooseSections({ templateId, sections, onSectionsChange, onGenerate, error }) {
  const handleAdd = (type) => onSectionsChange(addInstance(sections, type));

  return (
    <div className="-mx-4 sm:-mx-8 -mt-10 flex flex-col h-[calc(100vh-200px)]">
      <div className="px-4 sm:px-8 pt-2 pb-5">
        <h1 className="text-[clamp(22px,3.5vw,28px)] font-[900] text-[#1a1a1a] mb-1 tracking-[-0.5px] leading-[1.1]">Choose your sections</h1>
        <p className="text-[#555] text-[14px]">Compose the structure of your page. AI will write copy for everything you include.</p>
      </div>

      {error && (
        <div className="mx-4 sm:mx-8 mb-3 p-3 bg-[#cc0000]/5 border border-[#cc0000]/20 rounded-lg text-[#cc0000] text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex min-h-0 border-t border-black/[0.07]">
        <SectionCatalogPanel templateId={templateId} sections={sections} onAdd={handleAdd} />
        <SectionCompositionPanel sections={sections} onChange={onSectionsChange} />
      </div>

      <div className="border-t border-black/[0.07] bg-white px-4 sm:px-8 py-4">
        <button
          onClick={onGenerate}
          className="w-full font-semibold py-3.5 px-6 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[15px] transition-colors"
        >
          Generate My Website
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/StepChooseSections.jsx
git commit -m "feat(wizard): StepChooseSections shell composing catalog + composition panels"
```

---

### Task 12: Wire StepChooseSections into App.jsx + WizardShell

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/wizard/WizardShell.jsx:5`

- [ ] **Step 1: Update WizardShell STEP_LABELS**

In [src/components/wizard/WizardShell.jsx:5](src/components/wizard/WizardShell.jsx:5), change:

```js
const STEP_LABELS = ['Business Type', 'Your Info', 'Template', 'Generating', 'Preview', 'Export'];
```

to:

```js
const STEP_LABELS = ['Business Type', 'Your Info', 'Template', 'Sections', 'Generating', 'Preview', 'Export'];
```

The ProgressBar component highlights `STEP_LABELS[step - 1]`. We use fractional `step === 3.5` for Choose Sections, which rounds down via `Math.floor(step - 1) = 2` ⇒ "Template" stays highlighted. To make the new step highlight correctly, also update the ProgressBar prop passed in:

Look at [src/components/wizard/WizardShell.jsx:132](src/components/wizard/WizardShell.jsx:132) and modify:

```jsx
<ProgressBar step={step} labels={STEP_LABELS} />
```

to:

```jsx
<ProgressBar step={step === 3.5 ? 4 : step > 3.5 ? step + 1 : step} labels={STEP_LABELS} />
```

This maps internal step states to the 1-based label index: 1→1 (Type), 2→2 (Info), 3→3 (Template), 3.5→4 (Sections), 4→5 (Generating), 5→6 (Preview), 5.5→6 (still Preview group), 6→7 (Export). The fractional 5.5 (Social Feeds) keeps the previous mapping by intent (it visually belongs with Preview).

- [ ] **Step 2: Add `selectedSections` state to App.jsx**

In [src/App.jsx](src/App.jsx), near the other useState calls around line 37-58, add:

```jsx
const [selectedSections, setSelectedSections] = useState(null); // null until step 3.5 is entered
```

- [ ] **Step 3: Import the new step + helpers in App.jsx**

At the top of [src/App.jsx](src/App.jsx), alongside the other wizard imports, add:

```jsx
import StepChooseSections from './components/wizard/StepChooseSections.jsx';
import { getDefaultSectionsForTemplate } from './lib/sectionInstances.js';
import { migrateSections } from './lib/migrateSections.js';
```

- [ ] **Step 4: Change template-pick handler to advance to step 3.5 and seed sections**

Find `handleGenerate` at [src/App.jsx:185](src/App.jsx:185):

```jsx
const handleGenerate = () => {
  setError(null);
  goTo(4);
};
```

Replace with two handlers:

```jsx
const handleChooseSections = () => {
  setError(null);
  // Only seed defaults the first time the user enters this step for a given
  // template. If they navigate back and forth, preserve their composition.
  setSelectedSections(prev => prev ?? getDefaultSectionsForTemplate(selectedTemplate));
  goTo(3.5);
};

const handleGenerate = () => {
  setError(null);
  goTo(4);
};
```

Also clear `selectedSections` when the user picks a different template, so switching templates re-seeds with that template's smart default. Find `handleTemplateSelect` at [src/App.jsx:179](src/App.jsx:179):

```jsx
const handleTemplateSelect = (templateId) => {
  setSelectedTemplate(templateId);
  setCustomColors({});
  setCustomFonts({});
};
```

Add one line:

```jsx
const handleTemplateSelect = (templateId) => {
  setSelectedTemplate(templateId);
  setCustomColors({});
  setCustomFonts({});
  setSelectedSections(null);  // re-seed on next Choose Sections entry
};
```

- [ ] **Step 5: Pass `sections` through to `generateWebsite`**

In `handleGenerate`, the existing flow advances to step 4 which renders `StepGenerating`. `StepGenerating` calls `generateWebsite(businessInfo, templateMeta)`. We need to include the selected sections list.

Update the call in [src/components/wizard/StepGenerating.jsx:42](src/components/wizard/StepGenerating.jsx:42) — find:

```jsx
const copy = await generateWebsite(businessInfo, templateMeta);
```

And change to:

```jsx
const copy = await generateWebsite({ ...businessInfo, sections }, templateMeta);
```

Then update `StepGenerating`'s prop list (line 16) to receive `sections`:

```jsx
export default function StepGenerating({ businessInfo, templateMeta, sections, onSuccess, onError }) {
```

Back in App.jsx, find where `<StepGenerating ... />` is rendered at [src/App.jsx:815](src/App.jsx:815) and add the prop:

```jsx
{step === 4 && (
  <StepGenerating
    businessInfo={businessInfo}
    templateMeta={templateMeta}
    sections={selectedSections}
    onSuccess={handleGenerateSuccess}
    onError={handleGenerateError}
  />
)}
```

- [ ] **Step 6: On generate success, attach `sections` to the saved copy**

Find `handleGenerateSuccess` at [src/App.jsx:190](src/App.jsx:190). After the `merged` object is built and before `setGeneratedCopy(merged);`, add:

```jsx
if (selectedSections) {
  merged.sections = selectedSections;
  merged.sectionContent = { ...(merged.sectionContent || {}), ...(copy.sectionContent || {}) };
}
```

(Generation might also have returned per-instance content keyed by id — preserve it.)

- [ ] **Step 7: Render the new step in App.jsx**

In the wizard render block at [src/App.jsx:790-826](src/App.jsx:790), inside the `<WizardShell>`, between `{step === 3 && (...)}` and `{step === 4 && (...)}`, insert:

```jsx
{step === 3.5 && (
  <StepChooseSections
    templateId={selectedTemplate}
    sections={selectedSections || []}
    onSectionsChange={setSelectedSections}
    onGenerate={handleGenerate}
    error={error}
  />
)}
```

Also update the `<StepTemplatePicker onGenerate={handleGenerate} ... />` to `onGenerate={handleChooseSections}`. Find at [src/App.jsx:808](src/App.jsx:808):

```jsx
onGenerate={handleGenerate}
```

Change to:

```jsx
onGenerate={handleChooseSections}
```

- [ ] **Step 8: Persist + restore `selectedSections` in the localStorage draft**

In `useEffect` at [src/App.jsx:87-106](src/App.jsx:87) (the autosave block), update the draft payload:

```jsx
localStorage.setItem(draftKey, JSON.stringify({
  businessType,
  businessInfo,
  selectedTemplate,
  selectedSections,
  step,
  savedAt: Date.now(),
}));
```

And in the restore `useEffect` at [src/App.jsx:68-83](src/App.jsx:68), add:

```jsx
if (draft?.selectedSections) setSelectedSections(draft.selectedSections);
```

Also extend the `draft.step` guard from `1..4` to allow 3.5:

```jsx
if (draft?.step && draft.step >= 1 && draft.step <= 4) setStep(draft.step);
```

becomes:

```jsx
if (draft?.step && draft.step >= 1 && draft.step < 5) setStep(draft.step);
```

- [ ] **Step 9: Migrate existing sites on `handleEditSite`**

Find `handleEditSite` at [src/App.jsx:367](src/App.jsx:367). After the `copy` variable is built (around line 398, just before `setGeneratedCopy(copy)`), add:

```jsx
const migrated = migrateSections(copy, site.template_id);
```

Then replace the subsequent `setGeneratedCopy(copy)` / `setEditedCopy(structuredClone(copy))` lines with:

```jsx
setGeneratedCopy(migrated);
setEditedCopy(structuredClone(migrated));
```

- [ ] **Step 10: Smoke test in the browser**

Run: `npm run dev`
Open the app, sign in, and:
- Start a new site, pick a template, you should land on "Choose Sections" (step 3.5) populated with that template's defaults.
- Hero is locked at top, Contact/CTA at bottom.
- Click "Media + Text" in the catalog — a new row appears above CTA.
- Click "+ Duplicate" on Media + Text — second instance appears.
- Drag to reorder a non-locked row.
- Click "Generate My Website" — generation proceeds and the preview renders (note: new section types will appear with placeholder copy until Task 14 wires the AI to return content).
- Open an existing site from the dashboard — the editor should open without crashes (the `sections` array is auto-migrated on load).

- [ ] **Step 11: Commit**

```bash
git add src/App.jsx src/components/wizard/WizardShell.jsx src/components/wizard/StepGenerating.jsx
git commit -m "feat(wizard): insert Choose Sections step at 3.5; seed defaults + draft persistence"
```

---

## Phase 4 — AI generation update

### Task 13: Dynamic prompt schema + sectionContent return

**Files:**
- Modify: `netlify/functions/generate-website.js`

- [ ] **Step 1: Read the current generator**

Open [netlify/functions/generate-website.js](netlify/functions/generate-website.js) and locate the SYSTEM_PROMPT/USER_PROMPT block and the JSON schema in the prompt (around lines 60-115 based on earlier exploration).

- [ ] **Step 2: Build the dynamic prompt + response schema based on `businessInfo.sections`**

Replace the static JSON schema block in the USER_PROMPT with a generator function. The key idea: only ask for the fields that correspond to sections present in `businessInfo.sections`. Per-instance sections get an entry under a `sectionContent` map keyed by instance id.

Concretely, near the top of the handler (after parsing `event.body` into `businessInfo` and `templateMeta`), add:

```js
const sections = Array.isArray(businessInfo.sections) ? businessInfo.sections : null;

// types present anywhere in the section list
const presentTypes = sections ? new Set(sections.map(s => s.type)) : null;
// instance ids per multi/new type that need per-instance content
const mediaTextInstances  = sections ? sections.filter(s => s.type === 'mediaText') : [];
const faqInstance         = sections ? sections.find(s => s.type === 'faq') : null;
const beforeAfterInstance = sections ? sections.find(s => s.type === 'beforeAfter') : null;
const wantsProcess        = presentTypes ? presentTypes.has('process') : false;

function include(type) {
  return !presentTypes || presentTypes.has(type);
}
```

Then build the schema dynamically by composing only the fields actually needed. Replace the hardcoded JSON schema block in USER_PROMPT with:

```js
const schemaParts = [];
if (include('hero')) {
  schemaParts.push(`"headline": "Main hero headline including ${businessInfo.city} (8-12 words, punchy, city-specific)"`);
  schemaParts.push(`"subheadline": "Supporting hero tagline (10-15 words, highlights key value)"`);
}
if (include('about')) {
  schemaParts.push(`"aboutText": "Full about section — 2-3 short paragraphs separated by newlines (~180 words). Mention ${businessInfo.city} 2-3 times."`);
}
if (include('services')) {
  schemaParts.push(`"servicesSection": { "intro": "1-2 sentences introducing services, referencing ${businessInfo.city} (20-30 words)", "items": [ { "name": "Exact service name from their list", "description": "2-3 sentence description (30-50 words)" } ] }`);
}
if (include('cta') || include('hero')) {
  schemaParts.push(`"ctaPrimary": "Primary CTA button text (3-5 words, action-oriented)"`);
  schemaParts.push(`"ctaSecondary": "Secondary CTA text (3-5 words)"`);
}
if (include('testimonials')) {
  schemaParts.push(`"testimonialPlaceholders": [ { "text": "Realistic customer testimonial mentioning the business (20-30 words)", "name": "First name + Last initial" }, { "text": "Second testimonial (different angle)", "name": "First name + Last initial" }, { "text": "Third testimonial", "name": "First name + Last initial" } ]`);
}
if (wantsProcess) {
  schemaParts.push(`"process": { "intro": "1-2 sentences about how the service flows (20-30 words)", "steps": [ { "title": "Step name (2-4 words)", "description": "Step description (15-25 words)" } ] }`);
}

// Per-instance content goes into sectionContent
const instanceParts = [];
if (faqInstance) {
  instanceParts.push(`"${faqInstance.id}": { "items": [ { "q": "Common customer question", "a": "Short helpful answer (1-2 sentences)" } ] }`);
}
for (const m of mediaTextInstances) {
  instanceParts.push(`"${m.id}": { "heading": "Short section heading (3-6 words)", "body": "On-topic paragraph for ${businessInfo.businessName} (40-70 words)", "alignment": "left" }`);
}
// beforeAfter doesn't need AI copy — images are user-uploaded
if (instanceParts.length) {
  schemaParts.push(`"sectionContent": { ${instanceParts.join(', ')} }`);
}

// SEO + meta (always)
schemaParts.push(`"metaDescription": "SEO meta description: business name + city + top 2 services (140-160 chars exactly)"`);
schemaParts.push(`"metaTitle": "${businessInfo.businessName} | Auto Service in ${businessInfo.city}, ${businessInfo.state}"`);
schemaParts.push(`"keywords": ["${businessInfo.city} auto detailing", "${businessInfo.city} car care", "auto service ${businessInfo.city} ${businessInfo.state}"]`);
schemaParts.push(`"footerTagline": "Proudly serving ${businessInfo.city} and surrounding areas — 4-7 word memorable line"`);
schemaParts.push(`"schemaType": "AutoRepair"`);

const jsonSchema = `{\n  ${schemaParts.join(',\n  ')}\n}`;
```

Then in `USER_PROMPT`, replace the literal JSON block (the `{ ... }` block listing all the fields) with `${jsonSchema}`. Keep the surrounding text ("Return ONLY this JSON structure (no markdown, no explanation):").

- [ ] **Step 3: Bump max_tokens to absorb new sections**

Find the Anthropic call (around line 114-119) and change:

```js
max_tokens: 2500,
```

to:

```js
max_tokens: 3500,
```

- [ ] **Step 4: Manual smoke test the generator**

Create a small temp script `tmp/test-gen.mjs` (do NOT commit) and run it against the deployed dev endpoint, OR test via the browser using the wizard:

Run: `npm run dev`
Sign in, go through the wizard with two Media + Text instances and an FAQ, hit Generate, and inspect the network call response in DevTools. Confirm:
- Top-level `aboutText`, `headline`, etc. are present.
- `sectionContent['<media+text instance id 1>']` has `{heading, body, alignment}`.
- `sectionContent['<faq instance id>']` has `{items: [...]}`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/generate-website.js
git commit -m "feat(generate): dynamic prompt schema based on selected sections; return sectionContent map"
```

---

## Phase 5 — Template integration

### Task 14: Template integration pattern (reference: DetailingSporty)

This task defines the per-template pattern. The next task applies it to all 22 other templates.

**Files:**
- Modify: `src/components/preview/templates/detailing/DetailingSporty.jsx`

- [ ] **Step 1: Read the current template to understand existing structure**

Read [src/components/preview/templates/detailing/DetailingSporty.jsx](src/components/preview/templates/detailing/DetailingSporty.jsx) (the template file). Note the existing `hidden` and `getOrder` helpers at lines 23-24.

- [ ] **Step 2: Swap the existing helpers for instance-aware versions**

At line 23-24, replace:

```jsx
const hidden = (id) => generatedCopy?.hiddenSections?.includes(id);
const getOrder = buildSectionOrder(generatedCopy, ['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta']);
```

With:

```jsx
const sectionsList = generatedCopy?.sections || [];
const present = (type) => sectionsList.some(s => s.type === type);
const orderFor = (type) => {
  const idx = sectionsList.findIndex(s => s.type === type);
  return idx >= 0 ? idx : 999;
};
```

- [ ] **Step 3: Replace all `!hidden('id')` with `present('id')` and `getOrder('id')` with `orderFor('id')`**

Use a single sed-like manual pass. There are ~7 occurrences each (one per section block). For DetailingSporty:
- `!hidden('hero')` → `present('hero')`
- `getOrder('hero')` → `orderFor('hero')`
- ...same for statsBar, services, about, gallery, testimonials, cta.

Keep the `order: 9999` on the footer.

- [ ] **Step 4: Remove the now-unused buildSectionOrder import**

At line 5:

```jsx
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
```

Remove this line (the helper is no longer used in this file).

- [ ] **Step 5: Add SectionRenderer import + map loop for new section types**

Add the import at the top of the file:

```jsx
import SectionRenderer, { isRendererManagedType } from '../../sections/SectionRenderer.jsx';
```

Then immediately before the `<footer>` JSX at the bottom of the template body, add:

```jsx
{sectionsList.map((inst, i) =>
  isRendererManagedType(inst.type)
    ? <SectionRenderer key={inst.id} instance={inst} order={i}
        generatedCopy={generatedCopy} templateMeta={templateMeta}
        businessInfo={businessInfo} images={images} />
    : null
)}
```

Because every section in the file uses CSS `order`, the new SectionRenderer rows slot into the correct visual position regardless of where they appear in JSX.

- [ ] **Step 6: Smoke test in browser**

Run: `npm run dev`
- Go through wizard, choose DetailingSporty, add an FAQ and a Media + Text in the new step, generate.
- The preview should show hero/services/about/gallery/testimonials/cta in their positions AND the FAQ + Media + Text in the slots you placed them.

- [ ] **Step 7: Commit**

```bash
git add src/components/preview/templates/detailing/DetailingSporty.jsx
git commit -m "refactor(template:DetailingSporty): adopt instance-based sections; render new types via SectionRenderer"
```

---

### Task 15: Apply pattern to all remaining 22 templates

The exact same 6-step transform from Task 14 applies to every other template. The set of section IDs to swap in each `present`/`orderFor` call depends on what each template renders today (look at its existing `buildSectionOrder` default list to know which types).

**Files (modify each):**
- `src/components/preview/templates/detailing/DetailingAutoSyncDark.jsx`
- `src/components/preview/templates/detailing/DetailingAutoSyncWhite.jsx`
- `src/components/preview/templates/detailing/DetailingCoastal.jsx`
- `src/components/preview/templates/detailing/DetailingMinimal.jsx`
- `src/components/preview/templates/detailing/DetailingPremium.jsx`
- `src/components/preview/templates/mechanic/MechanicFriendly.jsx`
- `src/components/preview/templates/mechanic/MechanicGarage.jsx`
- `src/components/preview/templates/mechanic/MechanicIndustrial.jsx`
- `src/components/preview/templates/mechanic/MechanicIronclad.jsx`
- `src/components/preview/templates/mobile/MobileBold.jsx`
- `src/components/preview/templates/mobile/MobileChrome.jsx`
- `src/components/preview/templates/mobile/MobileModern.jsx`
- `src/components/preview/templates/mobile/MobileRugged.jsx`
- `src/components/preview/templates/mobile/MobileSudsy.jsx`
- `src/components/preview/templates/tint/TintDark.jsx`
- `src/components/preview/templates/tint/TintElite.jsx`
- `src/components/preview/templates/tint/TintObsidian.jsx`
- `src/components/preview/templates/tint/TintSleek.jsx`
- `src/components/preview/templates/wheel/WheelApex.jsx`
- `src/components/preview/templates/wheel/WheelClean.jsx`
- `src/components/preview/templates/wheel/WheelEdge.jsx`
- `src/components/preview/templates/carwash/CarwashBubble.jsx`

- [ ] **Step 1: Per-template transform (apply to EACH of the 22 files above)**

For each file, perform these subtasks. Commit after each family (detailing, mechanic, mobile, tint, wheel, carwash) for safe iteration.

  - 1a. Replace the `hidden` + `getOrder` helpers (around top of component) with:
    ```jsx
    const sectionsList = generatedCopy?.sections || [];
    const present = (type) => sectionsList.some(s => s.type === type);
    const orderFor = (type) => {
      const idx = sectionsList.findIndex(s => s.type === type);
      return idx >= 0 ? idx : 999;
    };
    ```
  - 1b. Replace every `!hidden('X')` with `present('X')` in this file.
  - 1c. Replace every `getOrder('X')` with `orderFor('X')` in this file.
  - 1d. Remove the `import { buildSectionOrder } from '...sectionOrder.js'` line.
  - 1e. Add at top of file:
    ```jsx
    import SectionRenderer, { isRendererManagedType } from '../../sections/SectionRenderer.jsx';
    ```
    (Adjust the relative path: from `templates/<family>/` it is `../../sections/SectionRenderer.jsx`.)
  - 1f. Insert the SectionRenderer map block just before the `<footer>` element (or at the bottom of the template body if there's no footer in that file):
    ```jsx
    {sectionsList.map((inst, i) =>
      isRendererManagedType(inst.type)
        ? <SectionRenderer key={inst.id} instance={inst} order={i}
            generatedCopy={generatedCopy} templateMeta={templateMeta}
            businessInfo={businessInfo} images={images} />
        : null
    )}
    ```

- [ ] **Step 2: Smoke test after each family**

After each family is updated, run `npm run dev` and click through one template per family to confirm the page still renders.

- [ ] **Step 3: Commit per family**

```bash
git add src/components/preview/templates/detailing/*.jsx
git commit -m "refactor(template:detailing): adopt instance-based sections in remaining 5 templates"

git add src/components/preview/templates/mechanic/*.jsx
git commit -m "refactor(template:mechanic): adopt instance-based sections in 4 templates"

git add src/components/preview/templates/mobile/*.jsx
git commit -m "refactor(template:mobile): adopt instance-based sections in 5 templates"

git add src/components/preview/templates/tint/*.jsx
git commit -m "refactor(template:tint): adopt instance-based sections in 4 templates"

git add src/components/preview/templates/wheel/*.jsx
git commit -m "refactor(template:wheel): adopt instance-based sections in 3 templates"

git add src/components/preview/templates/carwash/*.jsx
git commit -m "refactor(template:carwash): adopt instance-based sections"
```

---

## Phase 6 — Editor updates

### Task 16: ContentEditor dynamic per-instance tab list

**Files:**
- Modify: `src/components/preview/ContentEditor.jsx`

- [ ] **Step 1: Build the tab list from `copy.sections` instead of hardcoded `TOGGLEABLE`**

Find the `TOGGLEABLE` registry at [src/components/preview/ContentEditor.jsx:430-534](src/components/preview/ContentEditor.jsx:430) — note the registry stays (still used as a label lookup), but the sidebar tab list now derives from `copy.sections`.

Locate the `sections` array that builds the navigation rail (around line 563-583). Replace the static section list construction with one that walks `copy.sections`:

```jsx
const instanceSections = (copy?.sections || []).map((inst, i) => {
  const entry = TOGGLEABLE._default.find(t => t.id === inst.type)
             || Object.values(TOGGLEABLE).flat().find(t => t.id === inst.type)
             || { id: inst.type, label: inst.type };
  // For multi instances, suffix with #N (1-based ordinal among same-type instances)
  const sameTypeBefore = (copy?.sections || []).slice(0, i).filter(s => s.type === inst.type).length;
  const ordinal = sameTypeBefore + 1;
  const isMulti = (copy?.sections || []).filter(s => s.type === inst.type).length > 1;
  return {
    id: `inst:${inst.id}`,
    instanceId: inst.id,
    type: inst.type,
    label: isMulti ? `${entry.label} #${ordinal}` : entry.label,
  };
});

const sections = [
  { id: 'visibility', label: 'Layout' },
  ...instanceSections,
  { id: 'colors', label: 'Colors & Fonts' },
  { id: 'footer', label: 'Footer' },
  ...(onBusinessInfoChange ? [{ id: 'business', label: 'Business Info' }] : []),
  ...(onSwitchTemplate ? [{ id: 'template', label: 'Template' }] : []),
];
```

- [ ] **Step 2: Update tab-content rendering to dispatch on instance id**

The existing `{activeSection === 'hero' && (...)}` blocks key off the section TYPE. With instances, we need to:
  - For unique-type tabs (e.g., the single hero instance), keep keying off type. Match using the instance's TYPE not the new `inst:<id>` id.
  - For multi-type tabs, content editing reads from / writes to `copy.sectionContent[<instanceId>]`.

Just below `const [activeSection, setActiveSection] = useState('visibility');` (line 400), compute the active instance:

```jsx
const activeInst = activeSection.startsWith('inst:')
  ? (copy?.sections || []).find(s => `inst:${s.id}` === activeSection)
  : null;
const activeType = activeInst?.type || activeSection;
```

Then wrap each existing `{activeSection === 'hero' && (...)}` block with `{activeType === 'hero' && (...)}` instead, and similarly for services, about, etc.

For the new shared section types (mediaText, faq, beforeAfter, process), add new editing panes. Insert after the `{activeType === 'contact' && (...)}` block:

```jsx
{activeType === 'mediaText' && activeInst && (
  <MediaTextEditor
    instanceId={activeInst.id}
    content={copy?.sectionContent?.[activeInst.id] || {}}
    setContent={(next) => setCopy(`sectionContent.${activeInst.id}`, next)}
    images={images}
    setImage={setImage}
  />
)}
{activeType === 'faq' && activeInst && (
  <FAQEditor
    instanceId={activeInst.id}
    content={copy?.sectionContent?.[activeInst.id] || { items: [] }}
    setContent={(next) => setCopy(`sectionContent.${activeInst.id}`, next)}
  />
)}
{activeType === 'beforeAfter' && activeInst && (
  <BeforeAfterEditor
    instanceId={activeInst.id}
    content={copy?.sectionContent?.[activeInst.id] || { pairCount: 3 }}
    setContent={(next) => setCopy(`sectionContent.${activeInst.id}`, next)}
    images={images}
    setImage={setImage}
  />
)}
{activeType === 'process' && (
  <ProcessEditor
    content={copy?.process || {}}
    setContent={(next) => setCopy('process', next)}
  />
)}
```

- [ ] **Step 3: Add the four small inline editor sub-components**

At the top of the same file (below imports), add:

```jsx
function MediaTextEditor({ instanceId, content, setContent, images, setImage }) {
  return (
    <>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Image</p>
      <ImageSlot label="Section Image" value={images?.[`mediaText_${instanceId}`]} onChange={(v) => setImage(`mediaText_${instanceId}`, v)} />
      <hr className="my-3 border-gray-100" />
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Heading</label>
      <input
        type="text"
        value={content.heading || ''}
        onChange={(e) => setContent({ ...content, heading: e.target.value })}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3"
        placeholder="Section heading"
      />
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Body</label>
      <textarea
        value={content.body || ''}
        onChange={(e) => setContent({ ...content, body: e.target.value })}
        rows={5}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3 leading-relaxed"
        placeholder="Custom paragraph"
      />
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Image Alignment</label>
      <div className="flex gap-2 mb-3">
        {['left', 'right'].map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setContent({ ...content, alignment: a })}
            className={`flex-1 py-2 text-[12px] font-medium rounded-lg border transition-colors ${
              (content.alignment || 'left') === a
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >Image {a}</button>
        ))}
      </div>
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Button Label (optional)</label>
      <input
        type="text"
        value={content.ctaLabel || ''}
        onChange={(e) => setContent({ ...content, ctaLabel: e.target.value })}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3"
      />
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Button URL (optional)</label>
      <input
        type="text"
        value={content.ctaUrl || ''}
        onChange={(e) => setContent({ ...content, ctaUrl: e.target.value })}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]"
        placeholder="#contact"
      />
    </>
  );
}

function FAQEditor({ instanceId, content, setContent }) {
  const items = content.items || [];
  const update = (i, key, value) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: value };
    setContent({ ...content, items: next });
  };
  const add = () => setContent({ ...content, items: [...items, { q: '', a: '' }] });
  const remove = (i) => setContent({ ...content, items: items.filter((_, idx) => idx !== i) });
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="mb-4 border-b border-gray-100 pb-3">
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Q #{i + 1}</label>
          <input value={item.q || ''} onChange={(e) => update(i, 'q', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-2" />
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">A</label>
          <textarea value={item.a || ''} onChange={(e) => update(i, 'a', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
          <button type="button" onClick={() => remove(i)} className="text-[11px] text-red-500 mt-1">Remove</button>
        </div>
      ))}
      <button type="button" onClick={add} className="w-full text-[12px] py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-500 hover:text-gray-700">+ Add question</button>
    </>
  );
}

function BeforeAfterEditor({ instanceId, content, setContent, images, setImage }) {
  const pairCount = content.pairCount || 3;
  return (
    <>
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Heading</label>
      <input value={content.heading || ''} onChange={(e) => setContent({ ...content, heading: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3" placeholder="Before & After" />
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Intro</label>
      <input value={content.intro || ''} onChange={(e) => setContent({ ...content, intro: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3" />
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Number of Pairs</label>
      <input type="number" min={1} max={8} value={pairCount} onChange={(e) => setContent({ ...content, pairCount: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3" />
      {Array.from({ length: pairCount }).map((_, i) => (
        <div key={i} className="mb-3 border-t border-gray-100 pt-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pair {i + 1}</p>
          <ImageSlot label="Before" value={images?.[`${instanceId}_pair${i}_before`]} onChange={(v) => setImage(`${instanceId}_pair${i}_before`, v)} />
          <ImageSlot label="After"  value={images?.[`${instanceId}_pair${i}_after`]}  onChange={(v) => setImage(`${instanceId}_pair${i}_after`,  v)} />
        </div>
      ))}
    </>
  );
}

function ProcessEditor({ content, setContent }) {
  const steps = content.steps || [];
  const updateStep = (i, key, value) => {
    const next = [...steps];
    next[i] = { ...next[i], [key]: value };
    setContent({ ...content, steps: next });
  };
  const addStep = () => setContent({ ...content, steps: [...steps, { title: '', description: '' }] });
  const removeStep = (i) => setContent({ ...content, steps: steps.filter((_, idx) => idx !== i) });
  return (
    <>
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Intro</label>
      <textarea value={content.intro || ''} onChange={(e) => setContent({ ...content, intro: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-3" />
      {steps.map((s, i) => (
        <div key={i} className="mb-3 border-b border-gray-100 pb-2">
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Step {i + 1} Title</label>
          <input value={s.title || ''} onChange={(e) => updateStep(i, 'title', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] mb-1" />
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</label>
          <textarea value={s.description || ''} onChange={(e) => updateStep(i, 'description', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
          <button type="button" onClick={() => removeStep(i)} className="text-[11px] text-red-500 mt-1">Remove</button>
        </div>
      ))}
      <button type="button" onClick={addStep} className="w-full text-[12px] py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-500 hover:text-gray-700">+ Add step</button>
    </>
  );
}
```

- [ ] **Step 4: Update the Layout (formerly "Sections") tab to use the instance model**

Find the `activeSection === 'visibility'` block at [src/components/preview/ContentEditor.jsx:661-702](src/components/preview/ContentEditor.jsx:661). Replace the body (the `orderedSections.map(...)` part and the drag handlers above it) with:

```jsx
{activeSection === 'visibility' && (
  <>
    <p className="text-[11px] text-gray-400 mb-4">Drag to reorder · click × to remove · use catalog buttons below to add.</p>
    {(copy?.sections || []).map((inst, idx) => {
      const entry = TOGGLEABLE._default.find(t => t.id === inst.type)
                 || Object.values(TOGGLEABLE).flat().find(t => t.id === inst.type)
                 || { id: inst.type, label: inst.type };
      const isLocked = !!inst.locked;
      const sameTypeBefore = (copy?.sections || []).slice(0, idx).filter(s => s.type === inst.type).length;
      const ordinal = sameTypeBefore + 1;
      const isMulti = (copy?.sections || []).filter(s => s.type === inst.type).length > 1;
      const label = isMulti ? `${entry.label} #${ordinal}` : entry.label;
      return (
        <div
          key={inst.id}
          draggable={!isLocked}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDropInstance(idx)}
          onDragEnd={handleDragEnd}
          className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 select-none"
          style={{
            opacity: dragIdx === idx ? 0.35 : 1,
            borderTop: dragOverIdx === idx && dragIdx !== idx ? '2px solid #3b82f6' : '2px solid transparent',
          }}
        >
          <span className="text-gray-300 shrink-0 text-[14px] leading-none">{isLocked ? '🔒' : '⠿'}</span>
          <span className="flex-1 text-[13px] font-medium text-gray-700">{label}</span>
          {!isLocked && (
            <button type="button" onClick={() => setCopy('sections', removeInstance(copy.sections, inst.id))} className="text-gray-300 hover:text-red-500 text-[18px] leading-none w-6 h-6 flex items-center justify-center">×</button>
          )}
        </div>
      );
    })}
    <div className="mt-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add a section</p>
      <div className="flex flex-wrap gap-1.5">
        {getCatalogForTemplate(templateId)
          .filter(c => !c.locked && (c.multi || !hasInstance(copy?.sections || [], c.type)))
          .map(c => (
            <button
              key={c.type}
              type="button"
              onClick={() => setCopy('sections', addInstance(copy?.sections || [], c.type))}
              className="text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg hover:border-gray-500 text-gray-700"
            >+ {c.label}</button>
          ))}
      </div>
    </div>
  </>
)}
```

Add the corresponding imports at the top of the file:

```jsx
import { addInstance, removeInstance, moveInstance, hasInstance } from '../../lib/sectionInstances.js';
import { getCatalogForTemplate } from '../../data/sectionCatalog.js';
```

Replace the existing `handleDrop` handler at line 552-560 with `handleDropInstance`:

```jsx
const handleDropInstance = (idx) => {
  if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
  const moving = (copy?.sections || [])[dragIdx];
  if (moving?.locked) { setDragIdx(null); setDragOverIdx(null); return; }
  setCopy('sections', moveInstance(copy.sections, moving.id, idx));
  setDragIdx(null);
  setDragOverIdx(null);
};
```

- [ ] **Step 5: Smoke test in browser**

Run: `npm run dev`
Open an existing site from the dashboard. Click Edit. Confirm:
- Sidebar shows one tab per instance (e.g., "Hero", "Services", "Media + Text #1", "Media + Text #2", etc.).
- Clicking a Media + Text tab opens the per-instance editor with heading/body/alignment fields.
- The Layout tab shows the new list (drag/remove) and add buttons.
- Layout changes persist (auto-save fires; reload the page and confirm the changes are still there).

- [ ] **Step 6: Commit**

```bash
git add src/components/preview/ContentEditor.jsx
git commit -m "feat(editor): per-instance tabs + Layout tab uses instance model with add/remove"
```

---

### Task 17: Update EditorTour selectors (verification only)

**Files:**
- Verify: `src/components/onboarding/EditorTour.jsx`

- [ ] **Step 1: Confirm the existing tour selector still works**

Open the editor with `localStorage.removeItem('editor_tour_done_v3')` and a fresh site. The tour step that targets `data-tour="tab-visibility"` should still highlight the (renamed) Layout tab. The selector hasn't changed — only the label has changed from "Sections" to "Layout".

If the tour copy mentions "Sections", update the copy. Otherwise no code change needed.

- [ ] **Step 2: (Conditional) Update tour copy if needed**

If the tour text says "the Sections tab", change to "the Layout tab" in [src/components/onboarding/EditorTour.jsx](src/components/onboarding/EditorTour.jsx).

- [ ] **Step 3: Commit (only if a change was made)**

```bash
git add src/components/onboarding/EditorTour.jsx
git commit -m "chore(tour): rename Sections → Layout in tour copy"
```

---

## Phase 7 — Final QA

### Task 18: Manual end-to-end smoke test

- [ ] **Step 1: New-site flow with mixed sections**

Run: `npm run dev`
- Sign in as a regular user.
- Go through wizard: business type → info → pick a template (e.g., DetailingSporty).
- On the new Choose Sections step, remove Gallery, add FAQ, add two Media + Text instances (drag one to the top of the body), add Before & After.
- Click Generate. Wait for completion.
- In the preview, confirm:
  - Hero shows generated headline.
  - Services and About render with AI copy.
  - First Media + Text appears in the position you placed it, with AI-generated heading + body.
  - Second Media + Text appears with its own AI-generated copy.
  - FAQ appears with 4-ish AI-generated questions.
  - Before & After appears (empty state — "Upload before/after photos" — until images are added).

- [ ] **Step 2: Editor multi-instance editing**

- Click Edit. Sidebar should show "Media + Text #1" and "Media + Text #2" as separate tabs.
- Edit #1's heading; confirm it changes in the preview without affecting #2.
- Edit #2's body; confirm it's independent.
- Drag #2 to a new position in the Layout tab — confirm preview reorders.

- [ ] **Step 3: Existing-site migration**

- From the dashboard, open an existing pre-update site (one that has `hiddenSections`/`sectionOrder` in DB).
- The editor should open with no crash. The sidebar should show one tab per visible section from the old config (gallery omitted if previously hidden, etc.).
- Make a small edit (toggle a section, edit a heading). Confirm auto-save fires (network panel: a `saveSite` POST). Reload the page. The new `sections` array should now be in the saved generatedCopy (verify by re-opening Edit; the Layout tab uses the new instance model).

- [ ] **Step 4: Refresh mid-wizard restores state**

- Start a new site. Get to the Choose Sections step and add an FAQ.
- Refresh the browser.
- After auth resolves, you should land back on the Choose Sections step with the FAQ still in your composition.

- [ ] **Step 5: All tests still pass**

Run: `npm test`
Expected: all tests pass (formatPhone, domainUtils, sectionInstances, migrateSections).

- [ ] **Step 6: Run lint and build**

Run: `npm run lint && npm run build`
Expected: no errors. Warnings about React 19 are fine.

- [ ] **Step 7: Push to the worktree branch (NOT master)**

Run: `git push -u origin claude/funny-margulis-bcc045`
Confirm with the user before merging to master.

---

## Self-review checklist

This is for me (the planning model) to validate against the spec before handing off.

**Spec coverage:**
- ✅ New "Choose Sections" wizard step → Tasks 9, 10, 11, 12
- ✅ Instance-based sections data model → Tasks 1, 2
- ✅ Migration of existing sites → Task 3, used in Task 12 step 9
- ✅ Hero locked top + CTA locked bottom → Tasks 1, 2 (catalog `locked`; helpers enforce in move/remove)
- ✅ Four new section types: FAQ, Before & After, Media + Text, universal Process → Tasks 5, 6, 7, 8
- ✅ All 25 (actually 23) templates render new sections → Tasks 14, 15
- ✅ Smart-default starting state per template → Task 1 `TEMPLATE_DEFAULT_SECTIONS`, used in Task 12 step 4
- ✅ Single AI call returns copy keyed by instance ID → Task 13
- ✅ Editor dynamic per-instance tabs → Task 16
- ✅ Test-branch only, no push to master → Stated in front matter and Task 18 step 7

**Placeholder scan:**
- All steps include actual code or commands.
- No "TBD", no "similar to above", no abstract "add error handling".

**Type consistency:**
- `instance` object shape is `{id, type, locked?}` — used uniformly across catalog, helpers, components, editor.
- `sectionContent[instanceId] = {...}` keyed the same way in the generator output, in the section components, and in the editor.
- `images[mediaText_<id>]` key pattern is consistent (MediaTextSection component, MediaTextEditor inputs).
- Function names: `hasInstance`, `getOrderForType`, `getOrderForId`, `addInstance`, `removeInstance`, `moveInstance`, `duplicateInstance`, `makeInstanceId`, `migrateSections`, `needsMigration` — all consistent across the plan.

---

## Out of scope (deferred to follow-up plans)

- Extracting hero/services/about/gallery/testimonials/cta into shared section components (the spec explicitly defers this — current templates keep their inline implementations).
- Removing the old `hiddenSections` + `sectionOrder` fields from generatedCopy after one release cycle (cleanup pass).
- Mobile tap-up/tap-down reorder arrows (drag-only ships first).
- Live preview of the page during the Choose Sections step.
- Removing `src/lib/sectionOrder.js` once no callers remain.
