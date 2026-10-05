import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DESIGN_LOOKS, applyLook, lookById, lookIdFor, looksFor } from './designLooks.js';
import { TEMPLATES, TEMPLATE_COMPONENT_MAP } from './templates.js';
import { TEMPLATE_SECTIONS, sectionIdsFor } from './templateSections.js';
import { ABOUT_LAYOUTS, ALWAYS_SHOWN, COLOR_ROLES, HERO_LAYOUTS, emptyLevers, leverPatch, sanitizeLevers } from '../lib/designLevers.js';
import { FONT_CATALOG } from '../lib/fontCatalog.js';
import { buildTemplateMeta } from '../lib/siteRender.js';
import { normalizeBusinessInfo } from '../lib/normalizeBusinessInfo.js';
import { contrastRatio, deriveTheme, hexToRgb, isDark } from '../components/preview/templates/kit/theme.js';
import { FIXTURES } from '../components/preview/templates/__fixtures__/businesses.js';
import { EditorModeProvider } from '../components/preview/templates/kit/EditorMode.jsx';

const TEMPLATE_IDS = Object.keys(TEMPLATE_SECTIONS);
const cases = DESIGN_LOOKS.map((l) => [l.id, l]);

describe('the looks library', () => {
  it('has unique ids built from the template and a slug', () => {
    const ids = DESIGN_LOOKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of DESIGN_LOOKS) expect(l.id.startsWith(`${l.templateId}-`), l.id).toBe(true);
  });

  it('offers 2-3 looks for every theme-ready template and none for others', () => {
    for (const id of TEMPLATE_IDS) {
      expect(looksFor(id).length, id).toBeGreaterThanOrEqual(2);
      expect(looksFor(id).length, id).toBeLessThanOrEqual(3);
    }
    for (const l of DESIGN_LOOKS) expect(TEMPLATE_IDS).toContain(l.templateId);
    expect(looksFor('detailing_coastal')).toEqual([]);
    expect(looksFor('nope')).toEqual([]);
  });

  it('marks looks customOnly exactly for templates hidden from the public picker', () => {
    for (const l of DESIGN_LOOKS) expect(l.customOnly, l.id).toBe(TEMPLATES[l.templateId].hidden === true);
    expect(looksFor('mobile_redline').every((l) => l.customOnly)).toBe(true);
  });

  it('has a name, mood words, a note and a correct dark flag on every look', () => {
    for (const l of DESIGN_LOOKS) {
      expect(l.name.trim().length, l.id).toBeGreaterThan(0);
      expect(l.mood.length, l.id).toBeGreaterThanOrEqual(2);
      for (const w of l.mood) expect(w, l.id).toMatch(/^[a-z][a-z-]*$/);
      expect(l.note.length, l.id).toBeGreaterThan(20);
      expect(l.dark, l.id).toBe(isDark(l.levers.palette.bg));
    }
    for (const id of TEMPLATE_IDS) {
      const names = looksFor(id).map((l) => l.name);
      expect(new Set(names).size, id).toBe(names.length);
    }
  });

  it('is frozen, so editor state cannot mutate a preset', () => {
    const l = DESIGN_LOOKS[0];
    expect(Object.isFrozen(DESIGN_LOOKS)).toBe(true);
    expect(Object.isFrozen(l.levers.palette)).toBe(true);
    expect(Object.isFrozen(l.levers.sections.order)).toBe(true);
  });
});

describe.each(cases)('look %s', (_, look) => {
  const { templateId, levers } = look;
  const ids = sectionIdsFor(templateId);

  it('sanitizes to itself (nothing dropped)', () => {
    expect(sanitizeLevers(levers, templateId)).toEqual({ ...emptyLevers(), ...levers });
    expect(Object.keys(levers).sort()).toEqual(['aboutLayout', 'fonts', 'heroLayout', 'palette', 'sections']);
    expect(Object.keys(levers.palette).sort()).toEqual([...COLOR_ROLES].sort());
  });

  it('orders every one of the template\'s real section ids, hero first and contact last', () => {
    expect([...levers.sections.order].sort()).toEqual([...ids].sort());
    expect(levers.sections.order[0]).toBe('hero');
    // Only the awards strip may follow the contact section (where the
    // templates themselves put it).
    const afterCta = levers.sections.order.slice(levers.sections.order.indexOf('cta') + 1);
    expect(afterCta.filter((id) => id !== 'awards')).toEqual([]);
    for (const id of levers.sections.hidden) {
      expect(ids).toContain(id);
      expect(ALWAYS_SHOWN).not.toContain(id);
    }
  });

  it('uses catalog fonts, with a text face for the body', () => {
    expect(FONT_CATALOG[levers.fonts.heading], levers.fonts.heading).toBeTruthy();
    expect(FONT_CATALOG[levers.fonts.body], levers.fonts.body).toBeTruthy();
    expect(['sans', 'serif']).toContain(FONT_CATALOG[levers.fonts.body].category);
  });

  it('uses layouts the template has', () => {
    if (templateId === 'mobile_redline') expect(levers.heroLayout).toBe('');
    else expect(HERO_LAYOUTS).toContain(levers.heroLayout);
    expect(ABOUT_LAYOUTS).toContain(levers.aboutLayout);
  });

  it('passes the contract\'s 4.5:1 pairs after deriveTheme without needing repair', () => {
    const p = levers.palette;
    const t = deriveTheme(p);
    // Unrepaired: the card shows exactly the colors the site paints.
    expect(t.text).toBe(p.text);
    expect(t.textMuted).toBe(p.muted);
    expect(t.surface).toBe(p.secondary);
    for (const [fg, bg, label] of [
      [t.text, t.bg, 'text on bg'],
      [t.textMuted, t.bg, 'muted on bg'],
      [t.text, t.surface, 'text on surface'],
      [t.textMuted, t.surface, 'muted on surface'],
      [t.onAccent, t.accent, 'onAccent on accent'],
      [t.accentText, t.bg, 'accent text on bg'],
    ]) {
      expect(contrastRatio(fg, bg), `${label}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // Buttons and highlights stand off the page and the cards (WCAG 3:1
    // for interface elements).
    expect(contrastRatio(t.accent, t.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.accent, t.surface)).toBeGreaterThanOrEqual(3);
  });

  it('is genuinely different from the template\'s own default', () => {
    const base = TEMPLATES[templateId];
    expect(levers.palette.bg).not.toBe(base.colors.bg.toLowerCase());
    expect(levers.palette.accent).not.toBe(base.colors.accent.toLowerCase());
    const fonts = [levers.fonts.heading, levers.fonts.body];
    expect(fonts, 'a look changes the type').not.toEqual([base.font, base.bodyFont].map((s) => /'([^']+)'/.exec(s)[1]));
  });
});

describe.each(TEMPLATE_IDS)('looks for %s', (templateId) => {
  const looks = looksFor(templateId);
  const base = TEMPLATES[templateId];

  it('include one on the other side of light / dark from the default', () => {
    expect(looks.some((l) => l.dark !== isDark(base.colors.bg)), templateId).toBe(true);
  });

  it('differ from each other in palette, type and layout', () => {
    const key = (fn) => new Set(looks.map(fn)).size;
    expect(key((l) => l.levers.palette.bg)).toBe(looks.length);
    expect(key((l) => l.levers.fonts.heading)).toBe(looks.length);
    expect(key((l) => l.levers.sections.order.join())).toBe(looks.length);
  });
});

describe('applyLook / lookIdFor', () => {
  const look = lookById('mechanic_garage-hot-rod');
  const business = {
    aboutStats: [{ value: '30', label: 'Years' }],
    facts: { warranty: '12 months / 12,000 miles' },
    googlePlace: { placeId: 'abc', placeName: 'Shop', rating: 4.8, reviewCount: 120, url: '' },
  };

  it('finds looks by id', () => {
    expect(look.templateId).toBe('mechanic_garage');
    expect(lookById('nope')).toBeNull();
    expect(lookById(undefined)).toBeNull();
  });

  it('sets the look\'s style and keeps the business content', () => {
    const before = sanitizeLevers({ ...business, palette: { accent: '#123456' }, heroLayout: 'split' }, 'mechanic_garage');
    const after = applyLook(before, look);
    expect(after.palette).toEqual(look.levers.palette);
    expect(after.fonts).toEqual(look.levers.fonts);
    expect(after.sections).toEqual(look.levers.sections);
    expect(after.heroLayout).toBe(look.levers.heroLayout);
    expect(after.aboutStats).toEqual(before.aboutStats);
    expect(after.facts).toEqual(before.facts);
    expect(after.googlePlace).toEqual(before.googlePlace);
    // Fresh, mutable copies: editor state never holds the frozen preset.
    expect(after.sections.order).not.toBe(look.levers.sections.order);
    after.sections.order.push('x');
    expect(look.levers.sections.order).not.toContain('x');
  });

  it('accepts an id, empty levers, and ignores unknown looks', () => {
    expect(applyLook(undefined, look.id)).toEqual({ ...emptyLevers(), ...look.levers });
    const levers = sanitizeLevers(business, 'mechanic_garage');
    expect(applyLook(levers, 'nope')).toEqual(levers);
    expect(applyLook(levers, { ...look, id: 'forged' })).toEqual(levers);
  });

  it('names the applied look until a lever is changed by hand', () => {
    const applied = applyLook(sanitizeLevers(business, 'mechanic_garage'), look);
    expect(lookIdFor(applied, 'mechanic_garage')).toBe(look.id);
    expect(lookIdFor({ ...applied, palette: { ...applied.palette, accent: '#000000' } }, 'mechanic_garage')).toBe('');
    expect(lookIdFor({ ...applied, aboutLayout: 'stats' }, 'mechanic_garage')).toBe('');
    expect(lookIdFor(applied, 'tint_elite')).toBe('');
    expect(lookIdFor(emptyLevers(), 'mechanic_garage')).toBe('');
  });
});

// The looks on the real templates: the same root-token contrast check
// theme:check runs (templates.render.test.jsx), plus colors, fonts and
// sections actually reaching the published markup.
const modules = Object.fromEntries(await Promise.all(TEMPLATE_IDS.map(async (id) => [id, await TEMPLATE_COMPONENT_MAP[id]()])));
const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// Published by default (no provider), like exportHtml; `editor` wraps it the
// way WebsitePreview does.
function renderLook(look, fx = FIXTURES.full, editor = false) {
  const patch = leverPatch(look.levers, look.templateId);
  const site = createElement(modules[look.templateId].default, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...patch.info }),
    generatedCopy: { ...fx.generatedCopy, ...patch.copy },
    templateMeta: buildTemplateMeta(look.templateId, patch.colors, patch.fonts),
    images: fx.images || {},
  });
  return decode(renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, site) : site));
}

// The root element's inline custom properties (the first tag that isn't a
// <style>).
function rootVars(html) {
  const tag = html.replace(/^(\s*<style\b[^>]*>[\s\S]*?<\/style>)*\s*/i, '').match(/^<[a-z][a-z0-9]*\b[^>]*>/i)?.[0] || '';
  const style = /\bstyle="([^"]*)"/.exec(tag)?.[1] || '';
  const vars = {};
  for (const decl of style.replace(/\s*([:;,])\s*/g, '$1').split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) vars[decl.slice(0, i)] = decl.slice(i + 1);
  }
  return vars;
}

function solid(value) {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) || /^rgb\(/i.test(value)) return value;
  const a = value.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/i);
  return a && Number(a[1]) >= 1 ? value : null;
}

function colorPattern(hex) {
  const { r, g, b } = hexToRgb(hex);
  return new RegExp(`${hex}|rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*[,)]`, 'i');
}

describe.each(cases)('look %s on its template', (_, look) => {
  const html = renderLook(look);
  const { levers } = look;

  it('keeps every root color token pair readable', () => {
    const vars = rootVars(html);
    const p = Object.keys(vars).map((k) => k.match(/^--([a-z0-9]+)-bg$/)).find(Boolean)?.[1];
    expect(p, 'root needs --<prefix>-bg').toBeTruthy();
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

  it('paints the look\'s colors and fonts', () => {
    expect(html).toMatch(colorPattern(levers.palette.bg));
    expect(html).toMatch(colorPattern(levers.palette.accent));
    expect(html).toContain(`'${levers.fonts.heading}'`);
    expect(html).toContain(`'${levers.fonts.body}'`);
  });

  it('renders the sections in the look\'s order and drops the hidden ones', () => {
    for (const id of levers.sections.hidden) expect(html).not.toContain(`data-section="${id}"`);
    const orderOf = {};
    for (const m of html.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bdata-section="([\w-]+)"[^>]*>/gi)) {
      const n = /\border:\s*(-?\d+)/.exec(m[0]);
      if (n && !(m[1] in orderOf)) orderOf[m[1]] = Number(n[1]);
    }
    const shown = levers.sections.order.filter((id) => id in orderOf);
    expect(shown.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < shown.length; i++) {
      expect(orderOf[shown[i]], `${shown[i - 1]} before ${shown[i]}`).toBeGreaterThan(orderOf[shown[i - 1]]);
    }
  });

  // A look may pick the stats About layout, but stats are owner facts and a
  // new custom site has none (neither fixture does): the published page must
  // fall back to the photo with no hint and nothing made up. The editor
  // render proves the hint exists, so the published check isn't vacuous.
  it('publishes no editor hint when the stats layout has no stats yet', () => {
    const hint = 'Add your stats in';
    for (const fx of [FIXTURES.full, FIXTURES.sparse]) {
      expect(fx.generatedCopy?.aboutStats ?? []).toEqual([]);
      const published = renderLook(look, fx);
      expect(published).not.toContain('data-acg-editor-only');
      expect(published).not.toContain(hint);
    }
    if (levers.aboutLayout === 'stats' && look.templateId !== 'mobile_redline') {
      expect(renderLook(look, FIXTURES.sparse, true)).toContain(hint);
    }
  });
});
