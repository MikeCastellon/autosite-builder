// Render gate for every site template (npm run theme:check).
// 1. Every registered template renders without throwing, in the editor
//    (inside <EditorModeProvider>) and as published (no provider), for the
//    sparse / full / custom fixtures.
// 2. Theme-ready modules (export const themeReady = true, see CLAUDE.md)
//    must also honor the contract: no editor-only UI or invented claims
//    (stats, stars, closed days) on the published page, owner colors and
//    fonts applied (CSS variables resolved), readable token contrast,
//    sections declared, tagged, hideable and ordered, container root with
//    the phone menu and action bar, no reveal on the hero, no empty awards
//    section, and a module source free of hooks, browser globals and
//    hard-coded colors. __fixtures__/KitSampleTemplate.jsx always runs
//    through these checks so they are exercised before any real template is
//    converted.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TEMPLATE_COMPONENT_MAP, TEMPLATES } from '../../../data/templates.js';
import { buildTemplateMeta } from '../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../lib/normalizeBusinessInfo.js';
import { catalogFamily, familiesFromStack } from '../../../lib/fontCatalog.js';
import { EditorModeProvider } from './kit/EditorMode.jsx';
import { hexToRgb, contrastRatio } from './kit/theme.js';
import { PHOTO_HINTS } from './kit/PhotoSlot.jsx';
import { FIXTURES, CUSTOM_COLORS, CUSTOM_FONTS } from './__fixtures__/businesses.js';
import * as kitSample from './__fixtures__/KitSampleTemplate.jsx';

// Section ids saved sites may already hold in copy.sectionOrder /
// copy.hiddenSections: ContentEditor's TOGGLEABLE list for the template
// (or _default) plus the ids its legacy buildSectionOrder call used
// (snapshot 2026-09-28). A converted template's `sections` must only use
// these, so no saved order or hidden flag is orphaned by a rename.
const DEFAULT_IDS = ['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta', 'awards'];
const SAVED_SECTION_IDS = {
  detailing_sporty: DEFAULT_IDS,
  detailing_coastal: DEFAULT_IDS,
  detailing_autosync_dark: DEFAULT_IDS,
  detailing_autosync_white: DEFAULT_IDS,
  mobile_bold: DEFAULT_IDS,
  mobile_modern: DEFAULT_IDS,
  mobile_rugged: DEFAULT_IDS,
  mobile_chrome: DEFAULT_IDS,
  mechanic_industrial: DEFAULT_IDS,
  mechanic_garage: DEFAULT_IDS,
  mechanic_friendly: [...DEFAULT_IDS, 'whyUs'],
  tint_sleek: [...DEFAULT_IDS, 'brands'],
  wheel_edge: ['hero', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  wheel_clean: ['hero', 'statsBar', 'awards', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  tint_dark: ['hero', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  tint_elite: ['hero', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  mechanic_ironclad: ['hero', 'ticker', 'ctaBand', 'about', 'services', 'gallery', 'whyUs', 'testimonials', 'cta'],
  tint_obsidian: ['hero', 'shadeGuide', 'services', 'brands', 'process', 'about', 'gallery', 'testimonials', 'cta'],
  mobile_sudsy: ['hero', 'services', 'process', 'whyUs', 'about', 'gallery', 'testimonials', 'cta'],
  wheel_apex: ['hero', 'trustBar', 'ticker', 'products', 'brands', 'about', 'gallery', 'testimonials', 'cta'],
  carwash_bubble: ['hero', 'services', 'process', 'about', 'gallery', 'testimonials', 'cta'],
  __kit_sample__: DEFAULT_IDS,
};

// Claims a template must never make up. Owner data may contain facts
// (awards, "ASE Certified"), so only template-invented patterns are listed;
// the fixtures are checked to be free of them.
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[\u2605\u2606\u2B50]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDITOR_TEXT = new RegExp(
  ['Images tab', 'Upload a photo', 'Edit >', 'Edit panel', ...Object.values(PHOTO_HINTS)].map(escapeRe).join('|'),
  'i',
);

// Free-text hours saved before the per-day editor (2026-05-04). None of
// them says a day is closed, so no template may print "Closed" for them.
const LEGACY_HOURS = [
  'Mon-Fri: 8am-6pm',
  'Mon-Fri 9am-5pm, Sat 10am-2pm',
  'Tues-Sat 8am-5pm',
  'Mon–Fri 8am–6pm · Sat 9am–4pm',
  'By appointment only',
  { 'Mon-Fri': '8am-6pm' },
];

// Deliberately unreadable owner palette: every text role near its
// background. deriveTheme must repair it, and templates must use its tokens.
const LOW_CONTRAST_COLORS = { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' };

// Fonts a published page may use without loading them from Google.
const SYSTEM_FONTS = new Set([
  'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue',
  'helvetica', 'arial', 'georgia', 'times new roman', 'times', 'courier new', 'courier',
  'menlo', 'monaco', 'consolas', 'sf mono', 'ui-monospace', 'ui-sans-serif', 'ui-serif',
  'apple color emoji', 'segoe ui emoji', 'noto color emoji', 'inherit',
]);

const TEMPLATE_IDS = Object.keys(TEMPLATE_COMPONENT_MAP);

// Module sources, for the static checks: registry import paths are
// relative to src/data/templates.js.
const REGISTRY_URL = new URL('../../../data/templates.js', import.meta.url);
const REGISTRY_SRC = readFileSync(REGISTRY_URL, 'utf8');
function sourceOf(id) {
  const m = REGISTRY_SRC.match(new RegExp(`\\b${id}:\\s*\\(\\)\\s*=>\\s*import\\('([^']+)'\\)`));
  return m ? readFileSync(new URL(m[1], REGISTRY_URL), 'utf8') : null;
}

const registered = await Promise.all(
  TEMPLATE_IDS.map(async (id) => ({
    id,
    mod: await TEMPLATE_COMPONENT_MAP[id](),
    meta: (fx) => buildTemplateMeta(id, fx.customColors, fx.customFonts),
    source: () => sourceOf(id),
  })),
);

const sampleEntry = {
  id: '__kit_sample__',
  mod: kitSample,
  // SAMPLE_META stands in for registry data (the palette), not template code.
  source: () => readFileSync(new URL('./__fixtures__/KitSampleTemplate.jsx', import.meta.url), 'utf8')
    .replace(/export const SAMPLE_META = \{[\s\S]*?\n\};/, ''),
  meta: (fx) => ({
    ...kitSample.SAMPLE_META,
    colors: { ...kitSample.SAMPLE_META.colors, ...fx.customColors },
    font: fx.customFonts?.font ?? kitSample.SAMPLE_META.font,
    bodyFont: fx.customFonts?.bodyFont ?? kitSample.SAMPLE_META.bodyFont,
  }),
};

const themeReady = [...registered.filter((e) => e.mod.themeReady === true), sampleEntry];

function render(entry, fixture, { editor = false, copy } = {}) {
  const el = createElement(entry.mod.default, {
    businessInfo: normalizeBusinessInfo(fixture.businessInfo),
    generatedCopy: copy || fixture.generatedCopy,
    templateMeta: entry.meta(fixture),
    images: fixture.images || {},
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

// React escapes quotes inside attributes; undo that so CSS reads naturally.
const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
// What a visitor reads: no <style>/<script> bodies, no tags, entities undone.
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');

// Minimal tree over renderToStaticMarkup output (well formed, attributes
// always double-quoted with < > " ' & escaped), enough for structure checks.
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function parseHtml(html) {
  const top = { tag: '#document', open: '', children: [], parent: null };
  let cur = top;
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const [open, closing, rawTag, , selfClosing] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      let n = cur;
      while (n.parent && n.tag !== tag) n = n.parent;
      if (n.parent) cur = n.parent;
      continue;
    }
    const node = { tag, open, children: [], parent: cur };
    cur.children.push(node);
    if (tag === 'style' || tag === 'script') {
      const end = html.indexOf(`</${tag}>`, re.lastIndex);
      re.lastIndex = end < 0 ? html.length : end + tag.length + 3;
    } else if (!selfClosing && !VOID_TAGS.has(tag)) {
      cur = node;
    }
  }
  return top;
}
function* walk(node) {
  for (const c of node.children) {
    yield c;
    yield* walk(c);
  }
}
const findNode = (node, pred) => {
  for (const n of walk(node)) if (pred(n)) return n;
  return null;
};
const attrOf = (node, name) => {
  const m = node.open.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const hasAttr = (node, name) => new RegExp(`\\s${name}(=|\\s|/?>)`).test(node.open);
const hasClass = (node, c) => (attrOf(node, 'class') || '').split(/\s+/).includes(c);
const styleOf = (node) => decode(attrOf(node, 'style') || '').replace(/\s*([:;,])\s*/g, '$1');
const rootOf = (html) => parseHtml(html).children.find((n) => n.tag !== 'style');

// Custom properties declared anywhere in the page (inline styles and
// <style> blocks), so font-family: var(--x) can be checked like a stack.
function customProps(html) {
  const props = new Map();
  for (const m of html.matchAll(/(--[\w-]+)\s*:\s*([^;"}]+)/g)) {
    if (!props.has(m[1])) props.set(m[1], new Set());
    props.get(m[1]).add(m[2].trim());
  }
  return props;
}
function resolveStacks(stack, props, seen = []) {
  const m = stack.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/);
  if (!m) return [stack];
  const [, name, fallback] = m;
  if (seen.includes(name)) return [];
  const values = props.get(name);
  if (values && values.size) return [...values].flatMap((v) => resolveStacks(v, props, [...seen, name]));
  return fallback ? resolveStacks(fallback, props, seen) : [`<undefined ${name}>`];
}

// Opaque solid colors only: gradients and translucent overlays can't be
// judged without knowing what is behind them.
function solid(value) {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) || /^rgb\(/i.test(value)) return value;
  const a = value.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/i);
  return a && Number(a[1]) >= 1 ? value : null;
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function colorPattern(hex) {
  const { r, g, b } = hexToRgb(hex);
  return new RegExp(`${hex}|rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*[,)]`, 'i');
}

function openTag(html, id) {
  const m = html.match(new RegExp(`<[a-z][a-z0-9]*\\b[^>]*\\bdata-section="${id}"[^>]*>`, 'i'));
  return m ? m[0] : null;
}

const cases = [];
for (const entry of registered) {
  for (const fixtureName of Object.keys(FIXTURES)) {
    for (const mode of ['editor', 'publish']) cases.push([entry.id, fixtureName, mode, entry]);
  }
}

describe('every registered template renders', () => {
  it('has a component for every registry entry', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  it.each(cases)('%s / %s / %s', (id, fixtureName, mode, entry) => {
    const fixture = FIXTURES[fixtureName];
    const html = decode(render(entry, fixture, { editor: mode === 'editor' }));
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toContain(fixture.generatedCopy.headline.split(' ')[0]);
  });
});

describe.each(themeReady.map((e) => [e.id, e]))('theme-ready contract: %s', (id, entry) => {
  const { mod } = entry;
  const ids = (mod.sections || []).map((s) => s.id);

  it('declares sections, extraFonts and loadable fonts', () => {
    expect(Array.isArray(mod.sections) && mod.sections.length > 0).toBe(true);
    for (const s of mod.sections) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.label).toBe('string');
    }
    expect(new Set(ids).size).toBe(ids.length);
    for (const sid of ids) expect(SAVED_SECTION_IDS[id]).toContain(sid);

    expect(Array.isArray(mod.extraFonts)).toBe(true);
    const meta = entry.meta(FIXTURES.full);
    for (const stack of [meta.font, meta.bodyFont, ...mod.extraFonts]) {
      expect(catalogFamily(familiesFromStack(stack)[0]), `font not in FONT_CATALOG: ${stack}`).not.toBeNull();
    }
  });

  it.each(Object.keys(FIXTURES))('publishes no editor UI or invented claims (%s)', (fixtureName) => {
    const html = render(entry, FIXTURES[fixtureName]);
    const text = visibleText(html);
    expect(html).not.toContain('data-acg-editor-only');
    expect(text).not.toMatch(EDITOR_TEXT);
    expect(decode(html)).not.toMatch(EDITOR_TEXT);
    expect(text).not.toMatch(BANNED_CLAIMS);
    expect(decode(html)).not.toMatch(BANNED_CLAIMS);
  });

  it.each(LEGACY_HOURS.map((h) => [JSON.stringify(h), h]))('never invents closed days from free-text hours %s', (_, hours) => {
    const fixture = { ...FIXTURES.full, businessInfo: { ...FIXTURES.full.businessInfo, hours } };
    expect(visibleText(render(entry, fixture))).not.toMatch(/\bclosed\b/i);
  });

  it.each(Object.keys(FIXTURES))('only uses fonts the published page loads (%s)', (fixtureName) => {
    const fixture = FIXTURES[fixtureName];
    const meta = entry.meta(fixture);
    const loaded = new Set(
      [meta.font, meta.bodyFont, ...mod.extraFonts]
        .flatMap((s) => familiesFromStack(s))
        .map(catalogFamily)
        .filter(Boolean),
    );
    const html = decode(render(entry, fixture));
    const props = customProps(html);
    const stacks = [...html.matchAll(/font-family\s*:\s*([^;"}]+)/gi)].flatMap((m) => resolveStacks(m[1], props));
    for (const stack of stacks) {
      expect(stack, 'font-family uses an undeclared custom property').not.toMatch(/^<undefined/);
      const primary = familiesFromStack(stack)[0];
      if (!primary) continue;
      const known = catalogFamily(primary);
      if (known) expect(loaded, `"${primary}" is used but not loaded`).toContain(known);
      else expect(SYSTEM_FONTS.has(primary.toLowerCase()), `unknown font "${primary}"`).toBe(true);
    }
  });

  it.each([
    ['default', FIXTURES.full],
    ['custom', FIXTURES.custom],
    ['low-contrast', { ...FIXTURES.full, customColors: LOW_CONTRAST_COLORS }],
  ])('exposes readable color tokens on the root (%s palette)', (_, fixture) => {
    // Convention (CLAUDE.md): --<p>-bg / -surface / -text / -muted on the
    // root; --<p>-<scope>-text|muted pairs with --<p>-<scope>-bg when that
    // exists, else with the page bg and surface; --<p>-on-accent with accent.
    const vars = {};
    for (const decl of styleOf(rootOf(render(entry, fixture))).split(';')) {
      const i = decl.indexOf(':');
      if (i > 0) vars[decl.slice(0, i)] = decl.slice(i + 1);
    }
    const p = Object.keys(vars).map((k) => k.match(/^--([a-z0-9]+)-bg$/)).find(Boolean)?.[1];
    expect(p, 'root needs --<prefix>-bg').toBeTruthy();
    for (const role of ['text', 'muted']) expect(vars[`--${p}-${role}`], `root needs --${p}-${role}`).toBeTruthy();
    const pairs = [];
    for (const [k, v] of Object.entries(vars)) {
      const m = k.match(new RegExp(`^--${p}-(?:(.+)-)?(text|muted)$`));
      if (!m || !solid(v)) continue;
      const scoped = m[1] && vars[`--${p}-${m[1]}-bg`] ? [`--${p}-${m[1]}-bg`] : [`--${p}-bg`, `--${p}-surface`];
      for (const bg of scoped) if (vars[bg] && solid(vars[bg])) pairs.push([k, bg]);
    }
    if (vars[`--${p}-on-accent`] && solid(vars[`--${p}-accent`] || '')) pairs.push([`--${p}-on-accent`, `--${p}-accent`]);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(vars[fg], vars[bg]), `${fg} ${vars[fg]} on ${bg} ${vars[bg]}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('applies the owner\'s custom colors and fonts', () => {
    const html = decode(render(entry, FIXTURES.custom));
    expect(html).toMatch(colorPattern(CUSTOM_COLORS.accent));
    expect(html).toMatch(colorPattern(CUSTOM_COLORS.bg));
    for (const stack of [CUSTOM_FONTS.font, CUSTOM_FONTS.bodyFont]) {
      expect(html).toContain(familiesFromStack(stack)[0]);
    }
  });

  it('tags every declared section in the default render', () => {
    const html = render(entry, FIXTURES.full);
    for (const sid of ids) expect(openTag(html, sid), `missing data-section="${sid}"`).not.toBeNull();
  });

  it.each(ids)('hiding "%s" removes it', (sid) => {
    const copy = { ...FIXTURES.full.generatedCopy, hiddenSections: [sid] };
    const html = render(entry, FIXTURES.full, { copy });
    expect(openTag(html, sid)).toBeNull();
    for (const other of ids.filter((x) => x !== sid)) expect(openTag(html, other)).not.toBeNull();
  });

  it('orders sections by the saved sectionOrder', () => {
    const reversed = [...ids].reverse();
    const copy = { ...FIXTURES.full.generatedCopy, sectionOrder: reversed };
    const html = decode(render(entry, FIXTURES.full, { copy }));
    reversed.forEach((sid, index) => {
      const tag = openTag(html, sid);
      const m = tag && tag.match(/[";]\s*order\s*:\s*(-?\d+)/);
      expect(m, `data-section="${sid}" element needs an inline order`).not.toBeNull();
      expect(Number(m[1])).toBe(index);
    });
  });

  it('renders no awards badge or empty awards section when there are no awards', () => {
    expect(FIXTURES.sparse.businessInfo.awards).toEqual([]);
    const published = render(entry, FIXTURES.sparse);
    expect(published).not.toContain('data-acg-awards');
    if (ids.includes('awards')) expect(openTag(published, 'awards')).toBeNull();
    expect(render(entry, FIXTURES.sparse, { editor: true })).not.toContain('data-acg-awards');
  });

  it.each(['full', 'split'])('never puts data-acg-reveal on or inside the hero (%s layout)', (layout) => {
    const copy = { ...FIXTURES.full.generatedCopy, ...(layout === 'split' ? { heroLayout: 'split' } : {}) };
    const hero = findNode(parseHtml(render(entry, FIXTURES.full, { copy })), (n) => attrOf(n, 'data-section') === 'hero');
    expect(hero, 'no data-section="hero"').not.toBeNull();
    expect(hasAttr(hero, 'data-acg-reveal')).toBe(false);
    expect(findNode(hero, (n) => hasAttr(n, 'data-acg-reveal'))).toBeNull();
  });

  it.each(Object.keys(FIXTURES))('has a container root with nav, footer, phone menu and action bar (%s)', (fixtureName) => {
    const root = rootOf(render(entry, FIXTURES[fixtureName]));
    const style = styleOf(root);
    for (const decl of ['container-type:inline-size', 'display:flex', 'flex-direction:column']) expect(style).toContain(decl);
    expect(style).not.toMatch(/overflow(-x)?:hidden/);

    const menu = findNode(root, (n) => n.tag === 'details' && hasClass(n, 'acg-menu'));
    expect(menu, 'MobileMenu missing').not.toBeNull();
    let nav = menu;
    while (nav.parent !== root) {
      nav = nav.parent;
      // An unnamed @container rule matches the nearest container: none may
      // sit between the root and the menu.
      expect(styleOf(nav)).not.toContain('container-type');
    }
    expect(styleOf(nav), 'the nav holding MobileMenu needs order:-1').toMatch(/(^|;)order:-1(;|$)/);

    expect(root.children.some((n) => hasClass(n, 'acg-actionbar')), 'MobileActionBar must be a direct child of the root').toBe(true);
    const footer = root.children.find((n) => n.tag === 'footer');
    expect(footer, 'footer must be a direct child of the root').toBeTruthy();
    expect(styleOf(footer)).toMatch(/(^|;)order:9999(;|$)/);
  });

  it('module source has no hooks, browser globals or hard-coded colors', () => {
    const src = entry.source && entry.source();
    expect(src, 'module source not found').toBeTruthy();
    const code = stripComments(src);
    expect(code).not.toMatch(/\buse(State|Effect|LayoutEffect|Reducer|SyncExternalStore)\b/);
    expect(code).not.toMatch(/\b(window|document|localStorage|sessionStorage|navigator)\s*\./);
    // Theme colors come from deriveTheme(); only black/white and neutral
    // translucent overlays may be literal.
    const hexes = [...code.matchAll(/(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => !['#fff', '#ffffff', '#000', '#000000'].includes(h))).toEqual([]);
    for (const m of code.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)/gi)) {
      const [lit, r, g, b, a, pct] = m;
      const alphaValue = a === undefined ? 1 : Number(a) / (pct ? 100 : 1);
      expect(r === g && g === b && alphaValue < 1, `color literal ${lit}`).toBe(true);
    }
  });
});

describe('contract fixtures', () => {
  it('carry no banned claims or editor text themselves', () => {
    for (const f of Object.values(FIXTURES)) {
      const data = JSON.stringify([f.businessInfo, f.generatedCopy]);
      expect(data).not.toMatch(BANNED_CLAIMS);
      expect(data).not.toMatch(EDITOR_TEXT);
    }
  });
});

const chrome = registered.find((e) => e.id === 'mobile_chrome');
describe.runIf(chrome?.mod.themeReady)('mobile_chrome hours', () => {
  const withHours = (hours) => visibleText(render(chrome, { ...FIXTURES.sparse, businessInfo: { ...FIXTURES.sparse.businessInfo, hours } }));
  const WEEKDAYS = { Mon: '9am-5pm', Tue: '9am-5pm', Wed: '9am-5pm', Thu: '9am-5pm', Fri: '9am-5pm' };

  it('groups per-day editor hours and names closed days', () => {
    const text = withHours({ ...WEEKDAYS, Sat: '', Sun: '' });
    expect(text).toContain('Mon–Fri 9am – 5pm');
    expect(text).toContain('Sat–Sun Closed');
  });

  it('shows no hours when every day is closed', () => {
    const text = withHours({ ...WEEKDAYS, Mon: '', Tue: '', Wed: '', Thu: '', Fri: '', Sat: '', Sun: '' });
    expect(text).not.toMatch(/\bHours\b|Mon · Tue/);
  });

  it('keeps free-text hours exactly as the owner wrote them', () => {
    expect(withHours('Mon-Fri 9am-5pm, Sat 10am-2pm')).toContain('Mon-Fri 9am-5pm, Sat 10am-2pm');
    expect(withHours('Mon-Fri: 8am-6pm')).toContain('Mon-Fri: 8am-6pm');
  });
});
