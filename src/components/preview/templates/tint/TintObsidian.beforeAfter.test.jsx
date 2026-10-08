// tint_obsidian's Before & After band (kit BeforeAfter.jsx: copy.beforeAfter
// + images baBefore<i> / baAfter<i>, ns ob-ba). Opt-in:
// TintObsidian.golden.test.jsx freezes the page of a site without
// copy.beforeAfter, and here odd values of the key (or the photos alone)
// change nothing either. With it, the band adds only its own section and
// CSS, right after the gallery, colored with token pairs the theme already
// repairs (checked here at 4.5:1 on the default, custom and low-contrast
// palettes).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './TintObsidian.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { contrastRatio } from '../kit/theme.js';
import { BA_DEFAULTS, baBeforeKey, baAfterKey } from '../kit/beforeAfter.js';
import { FIXTURES, FIXTURE_IMAGES, CUSTOM_COLORS } from '../__fixtures__/businesses.js';

const Template = mod.default;
const ID = 'tint_obsidian';
const NS = 'ob-ba';
const FULL = FIXTURES.full;
const LOW_CONTRAST_COLORS = { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' };
const PALETTES = [['default', {}], ['custom', CUSTOM_COLORS], ['low-contrast', LOW_CONTRAST_COLORS]];

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const styleText = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
const count = (html, needle) => html.split(needle).length - 1;

function render(fx, { editor = false, biz, copy, images } = {}) {
  const el = createElement(Template, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, fx.customColors, fx.customFonts),
    images: { ...(fx.images || {}), ...images },
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}
const sectionTag = (html, id) => {
  const m = html.match(new RegExp(`<[a-z]+\\b[^>]*\\bdata-section="${id}"[^>]*>`));
  return m ? { tag: m[0], at: m.index, order: Number((m[0].match(/order:(-?\d+)/) || [])[1]) } : null;
};
const band = (html) => {
  const s = sectionTag(html, 'beforeAfter');
  return s ? html.slice(s.at, html.indexOf('</section>', s.at)) : '';
};
const rootStyle = (html) => html.match(/^<div[^>]*\bstyle="([^"]*)"/)[1];
// The root's custom properties, { '--ob-bg': '#050507', ... }.
const rootVars = (html) => Object.fromEntries(decode(rootStyle(html)).split(';')
  .map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)])
  .filter(([k]) => k.startsWith('--')));

// n complete pairs (the fixture's own photos), and the copy that turns the band on.
const photos = (n) => Object.assign({}, ...Array.from({ length: n }, (_, i) => ({
  [baBeforeKey(i)]: FIXTURE_IMAGES[`gallery${i % 4}`],
  [baAfterKey(i)]: FIXTURE_IMAGES[`gallery${(i + 1) % 4}`],
})));
const on = (n, extra = {}) => ({ copy: { beforeAfter: { pairs: Array.from({ length: n }, () => ({})), ...extra } }, images: photos(n) });
const KIT_CSS = `.${NS}-track{`;
const THEME_CSS = `.${NS}-band{--${NS}-text:`;
const LEGACY_IDS = mod.sections.map((s) => s.id).filter((id) => !mod.addedSections.includes(id));

describe('tint_obsidian before & after: sites without it do not change', () => {
  it('lists the band as an added section, right after the gallery', () => {
    expect(mod.addedSections).toEqual(['beforeAfter']);
    const ids = mod.sections.map((s) => s.id);
    expect(ids.indexOf('beforeAfter')).toBe(ids.indexOf('gallery') + 1);
    expect(mod.sections.find((s) => s.id === 'beforeAfter').label).toBe('Before & After');
    expect(LEGACY_IDS).toEqual(['hero', 'shadeGuide', 'services', 'brands', 'process', 'about', 'gallery', 'testimonials', 'cta']);
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a string', 'yes'],
    ['a number', 42],
    ['true', true],
    ['an array', [{ caption: 'Sedan' }]],
  ])('copy.beforeAfter %s, with or without the photos, renders like the full fixture', (_, value) => {
    for (const editor of [false, true]) {
      const plain = render(FULL, { editor });
      expect(render(FULL, { editor, copy: { beforeAfter: value } })).toBe(plain);
      expect(render(FULL, { editor, copy: { beforeAfter: value }, images: photos(2) })).toBe(plain);
    }
  });

  it('publishes nothing new until a pair has both photos', () => {
    const half = { copy: { beforeAfter: { title: 'Ours', pairs: [{ caption: 'Sedan' }] } }, images: { [baBeforeKey(0)]: FIXTURE_IMAGES.gallery0 } };
    expect(render(FULL, half)).toBe(render(FULL));
    expect(render(FULL, { copy: { beforeAfter: {} } })).toBe(render(FULL));
    // The editor shows it, so the owner sees what to add.
    expect(render(FULL, { ...half, editor: true })).toContain('data-section="beforeAfter"');
  });

  it.each(['sparse', 'full', 'custom'])('adds no band or band CSS to the %s fixture', (name) => {
    for (const editor of [false, true]) {
      const html = render(FIXTURES[name], { editor });
      expect(html).not.toMatch(new RegExp(`data-section="beforeAfter"|${NS}-|data-acg-ba`));
    }
  });
});

describe('tint_obsidian before & after: the band', () => {
  it('sits right after the gallery on its order value, before the reviews, on the deep tone', () => {
    const html = render(FULL, on(2));
    const [gallery, ba, reviews] = ['gallery', 'beforeAfter', 'testimonials'].map((id) => sectionTag(html, id));
    expect(ba.tag).toBe(`<section data-section="beforeAfter" id="before-after" class="${NS}-band ob-section ob-deep" aria-labelledby="ob-ba-h" style="order:${gallery.order}">`);
    expect(gallery.tag).toMatch(/class="ob-section"/);
    expect(reviews.tag).toMatch(/class="ob-section ob-panel"/);
    expect(ba.at).toBeGreaterThan(gallery.at);
    expect(ba.at).toBeLessThan(reviews.at);
    // Without a gallery it keeps the gallery's slot.
    const noGallery = render(FULL, { ...on(1), copy: { ...on(1).copy, hiddenSections: ['gallery'] } });
    expect(sectionTag(noGallery, 'beforeAfter').order).toBe(buildSectionOrder({}, LEGACY_IDS)('gallery'));
  });

  it('adds the kit CSS and its own only while it renders', () => {
    const css = styleText(render(FULL, on(1)));
    expect(css).toContain(KIT_CSS);
    expect(css).toContain(THEME_CSS);
    expect(css.indexOf(THEME_CSS)).toBeGreaterThan(css.indexOf(KIT_CSS));
    const off = styleText(render(FULL));
    expect(off).not.toContain(KIT_CSS);
    expect(off).not.toContain(THEME_CSS);
    // The template's <style> is unchanged: the band's CSS is appended to it.
    const first = (html) => html.match(/<style>([\s\S]*?)<\/style>/)[1];
    expect(first(render(FULL, on(1))).startsWith(first(render(FULL)))).toBe(true);
    expect(css).not.toContain('data-acg-editor-only');
  });

  it('lights the last word of the design\'s heading; the owner\'s prints as typed', () => {
    const plain = band(markup(render(FULL, on(1))));
    expect(plain).toMatch(new RegExp(`<div class="ob-head" data-acg-reveal=""><div><p class="ob-tag">Before &amp; After</p><h2 id="ob-ba-h" class="ob-h2" style="--ob-fit:[\\d.]+">See the <span class="ob-v">Difference</span></h2></div><p class="ob-body">${BA_DEFAULTS.intro}</p></div>`));
    expect(visibleText(plain)).toContain(BA_DEFAULTS.title);
    const own = on(1, { title: 'Same glass, new tint.', intro: 'One afternoon apart.' });
    const html = band(markup(render(FULL, own)));
    expect(html).toMatch(/<h2 id="ob-ba-h" class="ob-h2" style="--ob-fit:[\d.]+">Same glass, new tint.<\/h2>/);
    expect(html).toContain('<p class="ob-body">One afternoon apart.</p>');
    expect(html).not.toContain('ob-v');
  });

  it('two pairs: two comparisons, arrows and the counter; one pair: no arrows', () => {
    const one = band(markup(render(FULL, on(1))));
    expect(count(one, 'data-acg-ba=""')).toBe(1);
    expect(one).toContain('style="--acg-ba:50%"');
    expect(one).toContain('data-acg-ba-range=""');
    expect(one).not.toMatch(/data-acg-ba-(prev|next|count)/);
    const two = band(markup(render(FULL, on(2))));
    expect(count(two, 'data-acg-ba=""')).toBe(2);
    expect(two).toContain('data-acg-ba-slider=""');
    expect(two).toContain('data-acg-ba-track=""');
    expect(two).toContain('data-acg-ba-prev=""');
    expect(two).toContain('data-acg-ba-next=""');
    expect(two).toContain('data-acg-ba-count="" aria-hidden="true">01 / 02</p>');
    // Photos load lazily (the band is never the hero) and say which side they are.
    expect(count(two, 'loading="lazy"')).toBe(4);
    expect(count(two, 'alt="Before"')).toBe(2);
    expect(count(two, 'alt="After"')).toBe(2);
    for (const k of Object.keys(photos(2))) expect(two).toContain(`src="${photos(2)[k]}"`);
  });

  it('publishes complete pairs only; the editor shows the rest with where to add their photos', () => {
    const copy = { beforeAfter: { pairs: [{ caption: 'Coupe, 20% all round' }, { caption: 'Sedan' }, { caption: 'Truck' }, { caption: 'Van' }] } };
    const images = { ...photos(2), [baAfterKey(3)]: FIXTURE_IMAGES.gallery3 };
    const pub = band(markup(render(FULL, { copy, images })));
    expect(count(pub, 'data-acg-ba=""')).toBe(2);
    expect(visibleText(pub)).toMatch(/Coupe, 20% all round[\s\S]*Sedan/);
    expect(visibleText(pub)).not.toMatch(/Truck|Van/);
    expect(pub).toContain('01 / 02');
    expect(pub).not.toContain('data-acg-editor-only');
    const ed = decode(band(markup(render(FULL, { copy, images, editor: true }))));
    expect(ed).toContain('01 / 04');
    expect(count(ed, 'data-acg-ba=""')).toBe(2);
    expect(count(ed, `${NS}-todo`)).toBe(2);
    const hints = ed.replace(/&gt;/g, '>');
    expect(hints).toContain(`${PHOTO_HINTS.baBefore} (pair 3)`);
    expect(hints).toContain(`${PHOTO_HINTS.baAfter} (pair 3)`);
    expect(hints).toContain(`${PHOTO_HINTS.baBefore} (pair 4)`);
    expect(hints).not.toContain(`${PHOTO_HINTS.baAfter} (pair 4)`);
  });

  it('in the editor, a band with no complete pair is editor-only and says what to add', () => {
    const html = render(FULL, { copy: { beforeAfter: { pairs: [] } }, editor: true });
    expect(sectionTag(html, 'beforeAfter').tag).toContain('data-acg-editor-only=""');
    expect(visibleText(band(html))).toContain('Add a before and an after photo in Edit > Before & After.');
    expect(render(FULL, { copy: { beforeAfter: { pairs: [] } } })).toBe(render(FULL));
  });

  it('hides with the Sections list, and a saved slot wins', () => {
    expect(render(FULL, { ...on(1), copy: { ...on(1).copy, hiddenSections: ['beforeAfter'] } })).toBe(render(FULL));
    const saved = render(FULL, { ...on(1), copy: { ...on(1).copy, sectionOrder: ['beforeAfter', 'hero', 'shadeGuide', 'services', 'brands', 'process', 'about', 'gallery'] } });
    expect(sectionTag(saved, 'beforeAfter').order).toBe(0);
  });

  it('keeps every older section on its old order value', () => {
    for (const saved of [{}, { sectionOrder: ['hero', 'about', 'services', 'testimonials', 'gallery', 'cta'] }]) {
      const copy = { ...FULL.generatedCopy, ...on(2).copy, ...saved };
      const html = render(FULL, { copy, images: photos(2) });
      const old = buildSectionOrder(copy, LEGACY_IDS);
      for (const id of LEGACY_IDS) {
        const s = sectionTag(html, id);
        if (s) expect({ id, order: s.order }).toEqual({ id, order: old(id) });
      }
      expect(sectionTag(html, 'beforeAfter').order).not.toBe(999);
    }
  });

  it('colors only with tokens the theme repairs, and adds no root variables', () => {
    for (const [, customColors] of PALETTES) {
      const fx = { ...FULL, customColors };
      expect(rootStyle(render(fx, on(2)))).toBe(rootStyle(render(fx)));
    }
    const css = styleText(render(FULL, on(1)));
    const theme = css.slice(css.indexOf(THEME_CSS));
    for (const m of theme.matchAll(new RegExp(`--${NS}-[\\w-]+:([^;}]+)`, 'g'))) {
      expect(m[1], m[0]).toMatch(/^(var\(--ob-[\w-]+\)|\d+(px|%))$/);
    }
    expect(theme).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i);
  });

  // Each text / handle color of the band over what it sits on, resolved
  // through the --ob-ba-* aliases to the root's repaired tokens. Gradients
  // (the button gradient) count stop by stop; the section is the deep tone.
  it.each(PALETTES)('reads at 4.5:1 on the %s palette', (_, customColors) => {
    const html = render({ ...FULL, customColors }, on(2));
    const root = rootVars(html);
    const css = styleText(html);
    const local = Object.fromEntries([...css.slice(css.indexOf(THEME_CSS)).matchAll(new RegExp(`(--${NS}-[\\w-]+):([^;}]+)`, 'g'))].map((m) => [m[1], m[2]]));
    const resolve = (v) => {
      const m = String(v).match(/^var\((--[\w-]+)\)$/);
      return m ? resolve(local[m[1]] ?? root[m[1]]) : v;
    };
    const stops = (v) => resolve(v).match(/#[0-9a-f]{6}\b/gi) || [];
    const pairs = [
      ['Before tag', `var(--${NS}-tag-text)`, `var(--${NS}-tag-bg)`],
      ['After tag', `var(--${NS}-tag2-text)`, `var(--${NS}-tag2-bg)`],
      ['handle', `var(--${NS}-knob-text)`, `var(--${NS}-knob-bg)`],
      ['caption', `var(--${NS}-muted)`, 'var(--ob-deep)'],
      ['arrows', `var(--${NS}-text)`, 'var(--ob-deep)'],
      ['counter', 'var(--ob-accent-text)', 'var(--ob-deep)'],
    ];
    for (const [what, fg, bg] of pairs) {
      const [ink] = stops(fg);
      expect(stops(bg).length, `${what}: ${bg}`).toBeGreaterThan(0);
      for (const b of stops(bg)) expect(contrastRatio(ink, b), `${what}: ${ink} on ${b}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toMatch(new RegExp(`\\.${NS}-count\\{[^}]*color:var\\(--ob-accent-text\\)`));
  });

  it('publishes no editor UI or invented claims, in any palette', () => {
    for (const [, customColors] of PALETTES) {
      const html = render({ ...FULL, customColors }, on(3, { title: 'See It' }));
      expect(html).not.toContain('data-acg-editor-only');
      expect(visibleText(html)).not.toMatch(/Edit >|Add the (before|after) photo/);
      expect(visibleText(band(html))).not.toMatch(/\d+\s*(%|\+)|guarantee|best|top[- ]rated|verified/i);
    }
  });

  it('counts at most six pairs', () => {
    const html = band(markup(render(FULL, on(8))));
    expect(count(html, 'data-acg-ba=""')).toBe(6);
    expect(html).toContain('01 / 06');
  });
});
