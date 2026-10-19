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
  HERO_CARD_DEFAULTS,
  FEATURED_AUTOMATIC,
  VEHICLE_MAKES_DEFAULT_ALL,
  HOW_STEPS_STARTERS,
  TEMPLATE_READS,
  TEMPLATE_HELP,
  EDITOR_TABS,
  editorTabs,
  templateReads,
  templateHelp,
  heroCardDefault,
  featuredAutomatic,
  vehicleMakesDefaultAll,
  howStepsStarters,
  shadeGuideState,
} from './editorCapabilities.js';
import { loadTemplateInfo } from './useTemplateInfo.js';
import { FAQ_TAB, FAQ_HINTS } from './templates/kit/faq.js';
import { HOW_TAB, HOW_HINTS } from './templates/kit/howItWorks.js';
import { VT_TAB, VT_HINTS } from './templates/kit/vehicleTypes.js';
import { CMP_TAB, CMP_HINTS } from './templates/kit/comparison.js';
import { SHOWCASE_SECTION, SHOWCASE_HINTS } from './templates/kit/showcase.js';
import { SERVICE_TABS_HINTS } from './templates/kit/serviceTabs.js';

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
    const OWNERS = [
      'headline', 'servicesSection.title', 'servicesSection.intro', 'ctaHeadline', 'ctaSubtext', 'beforeAfter.title', 'beforeAfter.intro',
      'vehicleTypes.title', 'vehicleTypes.intro', 'showcase.title', 'showcase.intro', 'comparison.title', 'comparison.intro', 'faq.title', 'faq.intro',
    ];
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
    expect((await loadTemplateInfo('carwash_bubble')).headingFields).toBe(null);
  });

  it('loadTemplateInfo passes through a module\'s own panel defaults', async () => {
    const info = await loadTemplateInfo('mobile_sudsy');
    expect(typeof info.defaultHowSteps).toBe('function');
    expect(typeof info.defaultWhyCards).toBe('function');
    expect((await loadTemplateInfo('mechanic_garage')).defaultWhyCards).toBe(null);
    expect(typeof (await loadTemplateInfo('carwash_bubble')).defaultWhyCards).toBe('function');
    const missing = await loadTemplateInfo('no_such_template', {});
    expect(missing.themeReady).toBe(false);
    expect(missing.sections.length).toBeGreaterThan(0);
    expect(missing.footerSpec).toBe(null);
    expect(missing.addedSections).toEqual([]);
    const sporty = await loadTemplateInfo('detailing_sporty');
    expect(sporty.addedSections).toEqual(['brands', 'featured', 'beforeAfter', 'vehicleTypes', 'process', 'showcase', 'comparison', 'faq']);
    expect(Array.isArray(sporty.footerSpec?.columns)).toBe(true);
    expect((await loadTemplateInfo('carwash_bubble')).footerSpec).toBe(null);
  });

  it('addedSections name sections the template declares', async () => {
    for (const id of IDS) {
      const mod = await TEMPLATE_COMPONENT_MAP[id]();
      if (mod.addedSections === undefined) continue;
      const sectionIds = (mod.sections || []).map((s) => s.id);
      expect(Array.isArray(mod.addedSections)).toBe(true);
      expect({ id, unknown: mod.addedSections.filter((a) => !sectionIds.includes(a)) }).toEqual({ id, unknown: [] });
    }
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

  // The kit's reference-site bands print their own editor hints (the empty
  // band, an item that still needs something): each names the tab that
  // edits it, which every template showing the band has.
  it('the kit bands\' hints name their tabs, and the templates showing a band have that tab', () => {
    const bands = [
      { cap: 'faq', tab: FAQ_TAB, hints: FAQ_HINTS },
      { cap: 'howSteps', tab: HOW_TAB, hints: HOW_HINTS },
      { cap: 'vehicleTypes', tab: VT_TAB, hints: VT_HINTS },
      { cap: 'comparison', tab: CMP_TAB, hints: CMP_HINTS },
      { cap: 'showcase', tab: SHOWCASE_SECTION.label, hints: SHOWCASE_HINTS },
      { cap: 'serviceTabs', tab: 'Services', hints: SERVICE_TABS_HINTS },
    ];
    for (const { cap, tab, hints } of bands) {
      for (const t of hintTargets(Object.values(hints).join('\n'))) expect({ cap, tab: t.tab }).toEqual({ cap, tab });
      const editorTab = EDITOR_TABS.find((x) => x.label === tab);
      expect({ cap, tab: editorTab?.label }).toEqual({ cap, tab });
      for (const id of IDS.filter((x) => templateReads(x, cap))) {
        expect({ id, cap, has: editorTabs(id).some((x) => x.label === tab) }).toEqual({ id, cap, has: true });
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
    expect(ids('detailing_sporty')).toEqual([
      'visibility', 'hero', 'headings', 'services', 'featured', 'vehicleTypes', 'howItWorks', 'makes', 'about', 'gallery', 'beforeAfter',
      'showcase', 'comparison', 'testimonials', 'google', 'faq', 'contact', 'colors', 'footer',
    ]);
    // The reference-site bands' tabs are Bold & Sporty's and Driveway's
    // alone for now.
    for (const id of IDS.filter((x) => x !== 'detailing_sporty' && x !== 'mobile_driveway')) {
      expect({ id, tabs: ids(id).filter((t) => ['vehicleTypes', 'showcase', 'comparison', 'faq'].includes(t)) }).toEqual({ id, tabs: [] });
    }
    expect(ids('mobile_driveway')).toEqual(expect.arrayContaining(['headings', 'vehicleTypes', 'howItWorks', 'beforeAfter', 'comparison', 'google', 'faq']));
    expect(ids('mobile_driveway')).not.toContain('showcase');
    expect(ids('mechanic_garage')).toEqual(['visibility', 'hero', 'services', 'about', 'gallery', 'beforeAfter', 'testimonials', 'contact', 'colors', 'footer']);
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

// The per-template feature defaults (what a feature does while the owner
// saved nothing) must be the template's own: each table entry is checked
// against the literal call in the template source, so the editor's panels
// (and a future per-theme admin panel seeded from these tables) describe
// exactly what the page renders.
describe('feature defaults match the template sources', () => {
  const FOOTER_COLUMN_TYPES = ['brand', 'links', 'services', 'areas', 'contact', 'hours'];

  it('every table names registered templates that read the feature', () => {
    for (const [table, cap] of [[HERO_CARD_DEFAULTS, 'heroServices'], [FEATURED_AUTOMATIC, 'featuredService'], [VEHICLE_MAKES_DEFAULT_ALL, 'vehicleMakes'], [GOOGLE_BADGE_DEFAULTS, 'googleBadge'], [HOW_STEPS_STARTERS, 'howSteps']]) {
      for (const id of Object.keys(table)) {
        expect({ id, cap, known: IDS.includes(id), reads: templateReads(id, cap) }).toEqual({ id, cap, known: true, reads: true });
      }
    }
  });

  for (const id of IDS) {
    it(`${id}: hero card, featured band, makes band and footer defaults`, async () => {
      const src = source(id);
      if (templateReads(id, 'heroServices')) {
        const m = src.match(/heroCardModeOf\(\s*(?:copy|generatedCopy)\??\.heroCard\s*,\s*'(quote|list|off)'\s*\)/);
        expect({ id, call: Boolean(m) }).toEqual({ id, call: true });
        expect({ id, mode: heroCardDefault(id) }).toEqual({ id, mode: m[1] });
        expect({ id, listed: HERO_CARD_DEFAULTS[id] }).toEqual({ id, listed: m[1] });
      }
      if (templateReads(id, 'featuredService')) {
        const m = src.match(/featuredServiceOf\(\{[\s\S]*?automatic:\s*(true|false)/);
        expect({ id, call: Boolean(m) }).toEqual({ id, call: true });
        expect({ id, automatic: featuredAutomatic(id) }).toEqual({ id, automatic: m[1] === 'true' });
        expect({ id, listed: FEATURED_AUTOMATIC[id] }).toEqual({ id, listed: m[1] === 'true' });
      }
      if (templateReads(id, 'vehicleMakes')) {
        const m = src.match(/vehicleMakesFor\(\s*(?:copy|generatedCopy)\??\.vehicleMakes\s*(,\s*\[\s*\])?\s*\)/);
        expect({ id, call: Boolean(m) }).toEqual({ id, call: true });
        expect({ id, all: vehicleMakesDefaultAll(id) }).toEqual({ id, all: !m[1] });
        expect({ id, listed: VEHICLE_MAKES_DEFAULT_ALL[id] }).toEqual({ id, listed: !m[1] });
      }
      if (templateReads(id, 'howSteps')) {
        // The kit band (no starter steps) is called literally on
        // copy.howSteps; every other reader shows its own starters.
        const kit = /howItWorksSteps\(\s*(?:copy|generatedCopy)\??\.howSteps\s*\)/.test(src);
        expect({ id, starters: howStepsStarters(id) }).toEqual({ id, starters: !kit });
        expect({ id, listed: HOW_STEPS_STARTERS[id] }).toEqual({ id, listed: !kit });
      }
      if (templateReads(id, 'serviceTabs')) {
        // The tabs group the template's own services by their category.
        expect({ id, call: /serviceTabsOf\(\s*\w+\s*,\s*(?:copy|generatedCopy)\??\.serviceTabs\s*\)/.test(src) }).toEqual({ id, call: true });
        expect({ id, category: /\.category\b/.test(src) }).toEqual({ id, category: true });
      }
      if (templateReads(id, 'footerBuilder')) {
        const { footerSpec: spec } = await TEMPLATE_COMPONENT_MAP[id]();
        expect({ id, spec: Boolean(spec) && typeof spec === 'object' }).toEqual({ id, spec: true });
        const types = (spec.columns || []).map((c) => c.type);
        expect(types.length).toBeGreaterThan(0);
        expect(new Set(types).size).toBe(types.length);
        expect({ id, unknown: types.filter((t) => !FOOTER_COLUMN_TYPES.includes(t)) }).toEqual({ id, unknown: [] });
        for (const c of spec.columns) expect(typeof c.show).toBe('boolean');
        expect({ id, untitled: types.filter((t) => t !== 'brand' && !(typeof spec.titles?.[t] === 'string' && spec.titles[t])) }).toEqual({ id, untitled: [] });
        expect(typeof spec.mergeHours).toBe('boolean');
        expect(typeof spec.cta).toBe('boolean');
        expect(typeof spec.ctaLabel === 'string' && spec.ctaLabel.length > 0).toBe(true);
        if (spec.notes !== undefined) {
          for (const [t, note] of Object.entries(spec.notes)) expect({ id, t, ok: types.includes(t) && typeof note === 'string' }).toEqual({ id, t, ok: true });
        }
        if (spec.contactFields !== undefined) {
          expect({ id, ok: Array.isArray(spec.contactFields) && spec.contactFields.length > 0 && spec.contactFields.every((k) => typeof k === 'string' && k) }).toEqual({ id, ok: true });
        }
        if (spec.socialWhenBrandOff !== undefined) expect(typeof spec.socialWhenBrandOff).toBe('boolean');
      }
    });
  }

  it('themes with live sites start every feature off', () => {
    for (const id of ['detailing_sporty', 'mobile_chrome', 'mobile_sudsy']) {
      expect({ id, hero: heroCardDefault(id), featured: featuredAutomatic(id), makes: vehicleMakesDefaultAll(id), badge: GOOGLE_BADGE_DEFAULTS[id] })
        .toEqual({ id, hero: 'off', featured: false, makes: false, badge: [] });
      expect(templateHelp(id, 'heroCardOff')).toBeTruthy();
      expect(templateHelp(id, 'empty:brands')).toBeTruthy();
    }
    expect(heroCardDefault('mobile_redline')).toBe('quote');
    expect(featuredAutomatic('mobile_redline')).toBe(true);
    expect(vehicleMakesDefaultAll('mobile_redline')).toBe(true);
    expect(templateHelp('mobile_redline', 'heroCardOff')).toBe(null);
    expect(Object.keys(TEMPLATE_HELP).every((id) => IDS.includes(id))).toBe(true);
  });
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
