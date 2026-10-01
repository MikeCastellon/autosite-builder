// Sentinel tests: the Edit panel (ContentEditor.jsx) offers a control only
// where the template reads it, lists exactly the sections the template
// orders, and names tabs and fields the way template hints and PhotoSlot's
// PHOTO_HINTS do ("Edit > Hero > Hero Background"). They read the template
// sources, so a template that starts or stops reading a key fails here
// until editorCapabilities.js follows.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TEMPLATE_COMPONENT_MAP } from '../../data/templates.js';
import { manifestFromModule, legacySections, mergeSectionOrder, orderNeedsRepair } from '../../lib/sectionManifest.js';
import { PHOTO_HINTS } from './templates/kit/PhotoSlot.jsx';
import IconOrEmoji from './templates/IconOrEmoji.jsx';
import {
  CAPABILITY_KEYS,
  SOURCE_CAPABILITIES,
  GOOGLE_BADGE_DEFAULTS,
  TEMPLATE_READS,
  EDITOR_TABS,
  editorTabs,
  templateReads,
  shadeGuideState,
} from './editorCapabilities.js';
import { loadTemplateInfo } from './useTemplateInfo.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../data');
const registrySource = readFileSync(resolve(dataDir, 'templates.js'), 'utf8');
const TEMPLATE_FILES = {};
for (const m of registrySource.matchAll(/(\w+):\s*\(\)\s*=>\s*import\('([^']+)'\)/g)) {
  TEMPLATE_FILES[m[1]] = resolve(dataDir, m[2]);
}
const source = (id) => readFileSync(TEMPLATE_FILES[id], 'utf8');
// The editor's panels (editor/*.jsx and their helper modules) hold field
// labels and hints too, e.g. PHOTO_HINTS' Package Photo / Featured Photo /
// CTA Background.
const panelFiles = readdirSync(resolve(here, 'editor'))
  .filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f) && !f.startsWith('._'));
const panelSources = panelFiles.map((f) => ({ file: f, src: readFileSync(resolve(here, 'editor', f), 'utf8') }));
const editorSource = [readFileSync(resolve(here, 'ContentEditor.jsx'), 'utf8'), ...panelSources.map((p) => p.src)].join('\n');
const IDS = Object.keys(TEMPLATE_COMPONENT_MAP);

const readsKey = (src, key) => new RegExp(`\\b(?:copy|generatedCopy)\\??\\.${key}\\b`).test(src);

describe('template capability table', () => {
  it('covers every registered template', () => {
    expect(Object.keys(TEMPLATE_FILES).sort()).toEqual([...IDS].sort());
    expect(Object.keys(TEMPLATE_READS).sort()).toEqual([...IDS].sort());
  });

  for (const id of IDS) {
    it(`${id}: offers exactly the optional controls the template reads`, () => {
      const src = source(id);
      for (const [cap, keys] of Object.entries(CAPABILITY_KEYS)) {
        const hits = keys.map((k) => readsKey(src, k));
        const reads = hits.every(Boolean);
        // All keys behind one control are read together, or none are.
        expect(hits.some(Boolean) && !reads ? `${cap}: only some of ${keys.join(', ')}` : null).toBe(null);
        expect({ cap, reads: templateReads(id, cap) }).toEqual({ cap, reads });
      }
      for (const [cap, patterns] of Object.entries(SOURCE_CAPABILITIES)) {
        const hits = patterns.map((p) => new RegExp(p).test(src));
        const reads = hits.every(Boolean);
        expect(hits.some(Boolean) && !reads ? `${cap}: only some of ${patterns.join(', ')}` : null).toBe(null);
        expect({ cap, reads: templateReads(id, cap) }).toEqual({ cap, reads });
      }
    });
  }
});

describe('section manifests', () => {
  for (const id of IDS) {
    it(`${id}: lists the sections the template orders`, async () => {
      const mod = await TEMPLATE_COMPONENT_MAP[id]();
      const manifest = manifestFromModule(id, mod);
      if (mod.themeReady === true) {
        expect(manifest.themeReady).toBe(true);
        expect(manifest.sections).toEqual(mod.sections.map((s) => ({ id: s.id, label: s.label })));
      } else {
        // Legacy: the ids of the template's own buildSectionOrder call.
        const call = source(id).match(/buildSectionOrder\(\s*\w+\s*,\s*\[([^\]]*)\]/);
        expect(call).not.toBe(null);
        const ids = [...call[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
        expect(manifest.themeReady).toBe(false);
        expect(manifest.sections.map((s) => s.id)).toEqual(ids);
        expect(legacySections(id).map((s) => s.id)).toEqual(ids);
      }
      const info = await loadTemplateInfo(id);
      expect(info.sections).toEqual(manifest.sections);
      expect(info.themeReady).toBe(manifest.themeReady);
    });
  }

  it('a tour through every other template brings each owner order back exactly', async () => {
    const manifests = {};
    for (const id of IDS) manifests[id] = manifestFromModule(id, await TEMPLATE_COMPONENT_MAP[id]()).sections.map((s) => s.id);
    // What ContentEditor saves on arriving at a template (its repair effect).
    const arrive = (saved, def) => (orderNeedsRepair(saved, def) ? mergeSectionOrder(saved, def, { keepForeign: true }) : saved);
    for (const home of IDS) {
      const def = manifests[home];
      // An owner order that differs from the default: hero first, the
      // second section moved to the end.
      const owner = [def[0], ...def.slice(2), def[1]];
      let saved = owner;
      for (const other of IDS) {
        if (other === home) continue;
        saved = arrive(saved, manifests[other]);
        // Every section of the template on screen has a slot (no order 999).
        expect({ other, missing: manifests[other].filter((id) => !saved.includes(id)) }).toEqual({ other, missing: [] });
      }
      expect(mergeSectionOrder(saved, def)).toEqual(owner);
      // Once every template has been visited, switching saves nothing more.
      for (const other of IDS) expect(arrive(saved, manifests[other])).toBe(saved);
    }
  });

  it('headingFields name real sections, fields and owning copy keys', async () => {
    const FIELDS = ['eyebrow', 'title', 'accent', 'intro'];
    const OWNERS = ['headline', 'servicesSection.title', 'servicesSection.intro', 'ctaHeadline', 'ctaSubtext'];
    let seen = 0;
    for (const id of IDS) {
      const mod = await TEMPLATE_COMPONENT_MAP[id]();
      if (mod.themeReady !== true || !mod.headingFields) continue;
      seen += 1;
      const sectionIds = mod.sections.map((s) => s.id);
      for (const [sid, row] of Object.entries(mod.headingFields)) {
        expect({ id, sid, known: sectionIds.includes(sid) }).toEqual({ id, sid, known: true });
        expect(Array.isArray(row.fields) && row.fields.length > 0).toBe(true);
        expect({ id, sid, extra: row.fields.filter((f) => !FIELDS.includes(f)) }).toEqual({ id, sid, extra: [] });
        for (const from of [row.titleFrom, row.introFrom]) {
          if (from !== undefined) expect({ id, sid, from, ok: OWNERS.includes(from) }).toEqual({ id, sid, from, ok: true });
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
    const redline = await loadTemplateInfo('mobile_redline');
    expect(redline.headingFields && typeof redline.headingFields).toBe('object');
    expect((await loadTemplateInfo('mobile_sudsy')).headingFields).toBe(null);
  });

  it('loadTemplateInfo passes through a module\'s own panel defaults', async () => {
    const info = await loadTemplateInfo('mobile_sudsy');
    expect(typeof info.defaultHowSteps).toBe('function');
    expect(typeof info.defaultWhyCards).toBe('function');
    expect((await loadTemplateInfo('carwash_bubble')).defaultWhyCards).toBe(null);
    const missing = await loadTemplateInfo('no_such_template', {});
    expect(missing.themeReady).toBe(false);
    expect(missing.sections.length).toBeGreaterThan(0);
  });
});

describe('tab names match the hints that point at them', () => {
  const labels = EDITOR_TABS.map((t) => t.label).sort((a, b) => b.length - a.length);
  const hintTargets = (text) => {
    const out = [];
    for (const m of text.replace(/&gt;/g, '>').matchAll(/Edit > ([^'"`<\n]+)/g)) {
      const rest = m[1];
      const tab = labels.find((l) => rest.startsWith(l) && !/[A-Za-z]/.test(rest.charAt(l.length)));
      const after = tab ? rest.slice(tab.length) : '';
      const field = after.startsWith(' > ') ? (after.slice(3).match(/^[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*/) || [''])[0] : null;
      out.push({ hint: `Edit > ${rest.slice(0, 40)}`, tab, field });
    }
    return out;
  };

  it('PHOTO_HINTS name real tabs and field labels', () => {
    const targets = hintTargets(Object.values(PHOTO_HINTS).join('\n'));
    expect(targets.length).toBe(Object.keys(PHOTO_HINTS).length);
    for (const t of targets) {
      expect({ hint: t.hint, tab: t.tab || null }).not.toEqual({ hint: t.hint, tab: null });
      if (t.field) expect({ hint: t.hint, inEditor: editorSource.includes(t.field) }).toEqual({ hint: t.hint, inEditor: true });
    }
  });

  it('every "Edit > ..." hint in the editor panels names a tab and a field the editor has', () => {
    for (const { file, src } of panelSources) {
      for (const t of hintTargets(src)) {
        expect({ file, hint: t.hint, tab: t.tab || null }).not.toEqual({ file, hint: t.hint, tab: null });
        if (t.field) expect({ file, hint: t.hint, inEditor: editorSource.includes(t.field) }).toEqual({ file, hint: t.hint, inEditor: true });
      }
    }
  });

  for (const id of IDS) {
    it(`${id}: every "Edit > ..." hint names a tab this template has`, () => {
      const tabs = editorTabs(id, { canEditBusiness: true, canSwitchTemplate: true }).map((t) => t.label);
      for (const t of hintTargets(source(id))) {
        expect({ hint: t.hint, tab: t.tab && tabs.includes(t.tab) ? t.tab : null }).toEqual({ hint: t.hint, tab: t.tab });
        expect(t.tab).toBeTruthy();
        if (t.field) expect({ hint: t.hint, inEditor: editorSource.includes(t.field) }).toEqual({ hint: t.hint, inEditor: true });
      }
    });
  }
});

describe('editorTabs', () => {
  const ids = (templateId, opts) => editorTabs(templateId, opts).map((t) => t.id);

  it('adds template-specific tabs only where the template reads them', () => {
    expect(ids('detailing_sporty')).toEqual(['visibility', 'hero', 'services', 'about', 'gallery', 'testimonials', 'contact', 'colors', 'footer']);
    expect(ids('tint_obsidian')).toEqual(expect.arrayContaining(['howItWorks', 'filmBrands', 'shadeGuide']));
    expect(ids('tint_obsidian')).not.toContain('whyUs');
    expect(ids('wheel_apex')).toEqual(expect.arrayContaining(['products', 'brands', 'trustBar', 'ticker']));
    expect(ids('wheel_edge')).toContain('brands');
    expect(ids('wheel_edge')).not.toContain('products');
    expect(ids('mechanic_ironclad')).toContain('whyUs');
    expect(ids('mechanic_ironclad')).not.toContain('howItWorks');
  });

  it('gives mobile_redline its own tabs, and no Brands tab', () => {
    expect(ids('mobile_redline')).toEqual(expect.arrayContaining(['headings', 'featured', 'makes', 'google', 'trustBar']));
    expect(ids('mobile_redline')).not.toContain('brands');
  });

  it('shows Business Info and Template only with their callbacks', () => {
    expect(ids('mobile_chrome', { canEditBusiness: true, canSwitchTemplate: true }).slice(-2)).toEqual(['business', 'template']);
    expect(ids('mobile_chrome')).not.toContain('business');
  });

  it('gives unknown templates the common controls only', () => {
    expect(templateReads('nope', 'ctaPrimaryUrl')).toBe(true);
    expect(templateReads('nope', 'shadeGuide')).toBe(false);
  });
});

describe('Google badge defaults', () => {
  for (const id of IDS) {
    it(`${id}: GOOGLE_BADGE_DEFAULTS matches the template's googleBadgePlacements call`, () => {
      const m = source(id).match(/googleBadgePlacements\(\s*(?:copy|generatedCopy)\??\.googleBadge\s*,\s*\[([^\]]*)\]/);
      if (m) {
        const defaults = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
        expect({ id, defaults: GOOGLE_BADGE_DEFAULTS[id] }).toEqual({ id, defaults });
      } else {
        expect({ id, defaults: GOOGLE_BADGE_DEFAULTS[id] }).toEqual({ id, defaults: undefined });
      }
      if (templateReads(id, 'googleBadge')) expect({ id, has: Array.isArray(GOOGLE_BADGE_DEFAULTS[id]) }).toEqual({ id, has: true });
    });
  }
});

describe('icon picker', () => {
  it('every icon the editor offers renders as an SVG on the site', () => {
    const iconIds = [...editorSource.matchAll(/id: '(icon:[a-z]+)'/g)].map((m) => m[1]);
    expect(iconIds.length).toBeGreaterThan(10);
    for (const id of iconIds) {
      const html = renderToStaticMarkup(createElement(IconOrEmoji, { value: id }));
      expect({ id, svg: html.startsWith('<svg') }).toEqual({ id, svg: true });
    }
  });
});

describe('shadeGuideState (mirrors TintObsidian)', () => {
  it('shows starter shades only for a business that sells tint', () => {
    expect(shadeGuideState({}, { businessType: 'tint_shop' }).shown).toBe(true);
    expect(shadeGuideState({}, { businessType: 'mobile_detailing' }).shown).toBe(false);
    expect(shadeGuideState({}, { businessType: 'detailing_shop', services: [{ name: 'Window Tinting' }] }).shown).toBe(true);
    expect(shadeGuideState({}, { businessType: 'detailing_shop', filmBrands: ['XPEL'] }).shown).toBe(true);
    expect(shadeGuideState({}, { businessType: 'detailing_shop', packages: ['Tint'] }).shown).toBe(true);
  });

  it('honors the owner: own shades or the switch show it, off or hidden removes it', () => {
    const biz = { businessType: 'car_wash' };
    expect(shadeGuideState({ shadeGuide: [{ vlt: '20', name: 'Mine' }] }, biz).shown).toBe(true);
    expect(shadeGuideState({ shadeGuide: [{ vlt: '', name: '' }] }, biz).shown).toBe(false);
    expect(shadeGuideState({ showShadeGuide: true }, biz).shown).toBe(true);
    expect(shadeGuideState({ showShadeGuide: false }, { businessType: 'tint_shop' }).shown).toBe(false);
    const hidden = shadeGuideState({ hiddenSections: ['shadeGuide'] }, { businessType: 'tint_shop' });
    expect(hidden).toMatchObject({ shown: false, hiddenInSections: true, sellsTint: true });
  });
});
