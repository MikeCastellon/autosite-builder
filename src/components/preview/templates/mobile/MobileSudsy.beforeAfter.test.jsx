// mobile_sudsy's Before & After band (kit BeforeAfter.jsx: copy.beforeAfter
// + images baBefore<i> / baAfter<i>). Opt-in like every feature of this
// live design: MobileSudsy.golden.test.jsx freezes the page of a site
// without copy.beforeAfter, and here odd values of the key (or the photos
// alone) change nothing either. With it, the band adds only its own
// section and CSS, right after the gallery.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './MobileSudsy.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { BA_DEFAULTS, baBeforeKey, baAfterKey } from '../kit/beforeAfter.js';
import { FIXTURES, FIXTURE_IMAGES, CUSTOM_COLORS } from '../__fixtures__/businesses.js';

const Sudsy = mod.default;
const ID = 'mobile_sudsy';
const FULL = FIXTURES.full;
const LEGACY_IDS = ['hero', 'services', 'process', 'whyUs', 'about', 'gallery', 'testimonials', 'cta'];
const LOW_CONTRAST_COLORS = { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' };
const DARK_COLORS = { bg: '#0f172a', accent: '#38bdf8', text: '#f8fafc', secondary: '#1e293b', muted: '#94a3b8' };

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
// The template's own style block (the first one; ServiceCardCss and the
// kit's menu / action bar bring their own).
const ownStyle = (html) => html.match(/<style>([\s\S]*?)<\/style>/)[1];
const count = (html, needle) => html.split(needle).length - 1;

function render(fx, { editor = false, biz, copy, images, colors } = {}) {
  const el = createElement(Sudsy, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, colors || fx.customColors, fx.customFonts),
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

// n complete pairs (the fixture's own photos), and the copy that turns the band on.
const photos = (n) => Object.assign({}, ...Array.from({ length: n }, (_, i) => ({
  [baBeforeKey(i)]: FIXTURE_IMAGES[`gallery${i % 4}`],
  [baAfterKey(i)]: FIXTURE_IMAGES[`gallery${(i + 1) % 4}`],
})));
const on = (n, extra = {}) => ({ copy: { beforeAfter: { pairs: Array.from({ length: n }, () => ({})), ...extra } }, images: photos(n) });
const KIT_CSS = '.ss-ba-track{';
const THEME_CSS = '.ss-ba-band{--ss-ba-text:';

describe('mobile_sudsy before & after: sites without it do not change', () => {
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
      expect(html).not.toMatch(/data-section="beforeAfter"|ss-ba-|data-acg-ba/);
    }
  });
});

describe('mobile_sudsy before & after: the band', () => {
  it('sits right after the gallery on its order value, before the reviews', () => {
    const html = render(FULL, on(2));
    const [gallery, ba, reviews] = ['gallery', 'beforeAfter', 'testimonials'].map((id) => sectionTag(html, id));
    expect(ba.tag).toBe(`<section data-section="beforeAfter" id="before-after" class="ss-ba-band ss-section" aria-labelledby="ss-ba-h" style="order:${gallery.order}">`);
    expect(ba.at).toBeGreaterThan(gallery.at);
    expect(ba.at).toBeLessThan(reviews.at);
    // Without a gallery it keeps the gallery's slot.
    const noGallery = render(FULL, { ...on(1), copy: { ...on(1).copy, hiddenSections: ['gallery'] } });
    expect(sectionTag(noGallery, 'beforeAfter').order).toBe(buildSectionOrder({}, LEGACY_IDS)('gallery'));
  });

  it('adds the kit CSS and its own only while it renders, at the end of the style string, never FEATURE_CSS', () => {
    const css = ownStyle(render(FULL, on(1)));
    expect(css).toContain(KIT_CSS);
    expect(css).toContain(THEME_CSS);
    expect(css.indexOf(THEME_CSS)).toBeGreaterThan(css.indexOf(KIT_CSS));
    expect(css).not.toContain('.ss-gpill{');
    const off = ownStyle(render(FULL));
    expect(off).not.toContain(KIT_CSS);
    expect(off).not.toContain(THEME_CSS);
    // The template's <style> is unchanged: the band's CSS is appended to it,
    // also next to the other features' CSS.
    expect(css.startsWith(off)).toBe(true);
    const feat = FIXTURES.features;
    const featOn = ownStyle(render(feat));
    const featOff = ownStyle(render(feat, { copy: { beforeAfter: undefined } }));
    expect(featOn.length).toBeGreaterThan(featOff.length);
    expect(featOn.startsWith(featOff)).toBe(true);
    expect(featOff).toContain('.ss-gpill{');
  });

  it('shows the design\'s tag, heading (its highlighted word) and intro, else the owner\'s', () => {
    const plain = band(markup(render(FULL, on(1))));
    expect(plain).toContain(`<div class="ss-head" data-acg-reveal=""><p class="ss-tag ss-tag-l"><span class="ss-emo" aria-hidden="true">✨</span>${BA_DEFAULTS.eyebrow.replace('&', '&amp;')}</p>`);
    expect(plain).toContain('<h2 id="ss-ba-h" class="ss-h2">See the <em>Difference</em></h2>');
    expect(plain).toContain(`<p class="ss-sub">${BA_DEFAULTS.intro}</p>`);
    const own = on(1, { title: 'Fresh Off The Line', intro: 'Same car, one day apart.' });
    own.copy.sectionTitles = { beforeAfter: { eyebrow: 'Results', accent: 'The Line', title: 'Ignored', intro: 'Ignored too' } };
    const html = band(markup(render(FULL, own)));
    expect(html).toContain('<span class="ss-emo" aria-hidden="true">✨</span>Results</p>');
    expect(html).toContain('<h2 id="ss-ba-h" class="ss-h2">Fresh Off <em>The Line</em></h2>');
    expect(html).toContain('<p class="ss-sub">Same car, one day apart.</p>');
    expect(html).not.toContain('Ignored');
    // The owner's own heading gets no highlight of the design's.
    expect(band(markup(render(FULL, on(1, { title: 'Spot The Difference' }))))).toContain('<h2 id="ss-ba-h" class="ss-h2">Spot The Difference</h2>');
    // A Headings-tab title / intro (sectionTitles) shows while the band's own are empty.
    const st = on(1);
    st.copy.sectionTitles = { beforeAfter: { title: 'From The Headings Tab', intro: 'Intro from Headings.' } };
    expect(band(markup(render(FULL, st)))).toMatch(/>From The Headings Tab<\/h2><p class="ss-sub">Intro from Headings.<\/p>/);
    // headingDefaults (the Headings tab's placeholders) say what the band shows.
    expect(mod.headingDefaults(normalizeBusinessInfo(FULL.businessInfo), FULL.generatedCopy).beforeAfter)
      .toEqual({ eyebrow: BA_DEFAULTS.eyebrow, title: BA_DEFAULTS.title, accent: 'Difference' });
    expect(mod.headingFields.beforeAfter).toEqual({ fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'beforeAfter.title', introFrom: 'beforeAfter.intro', placeholder: { intro: BA_DEFAULTS.intro } });
  });

  it('one pair: the comparison without arrows; two: arrows and the counter', () => {
    const one = band(markup(render(FULL, on(1))));
    expect(count(one, 'data-acg-ba=""')).toBe(1);
    expect(one).toContain('style="--acg-ba:50%"');
    expect(one).toContain('data-acg-ba-range=""');
    expect(one).not.toMatch(/data-acg-ba-(prev|next|count)/);
    const two = band(markup(render(FULL, on(2))));
    expect(count(two, 'data-acg-ba=""')).toBe(2);
    expect(two).toContain('data-acg-ba-prev=""');
    expect(two).toContain('data-acg-ba-next=""');
    expect(two).toContain('data-acg-ba-count="" aria-hidden="true">01 / 02</p>');
    // Photos load lazily (the band is never the hero) and say which side they are.
    expect(count(two, 'loading="lazy"')).toBe(4);
    expect(count(two, 'alt="Before"')).toBe(2);
    expect(count(two, 'alt="After"')).toBe(2);
  });

  it('two pairs, one complete: published shows the complete one only; the editor shows both, with where to add the missing photo', () => {
    const copy = { beforeAfter: { pairs: [{ caption: 'Black sedan' }, { caption: 'White truck' }] } };
    const images = { ...photos(1), [baBeforeKey(1)]: FIXTURE_IMAGES.gallery2 };
    const pub = band(markup(render(FULL, { copy, images })));
    expect(count(pub, 'data-acg-ba=""')).toBe(1);
    expect(visibleText(pub)).toContain('Black sedan');
    expect(visibleText(pub)).not.toContain('White truck');
    expect(pub).not.toMatch(/data-acg-ba-count|data-acg-editor-only|ss-ba-todo/);
    const ed = decode(band(markup(render(FULL, { copy, images, editor: true })))).replace(/&gt;/g, '>');
    expect(ed).toContain('01 / 02');
    expect(count(ed, 'data-acg-ba=""')).toBe(1);
    expect(count(ed, 'class="ss-ba-pair ss-ba-todo" data-acg-editor-only=""')).toBe(1);
    expect(ed).toContain(`${PHOTO_HINTS.baAfter} (pair 2)`);
    expect(ed).not.toContain(`${PHOTO_HINTS.baBefore} (pair 2)`);
    expect(visibleText(ed)).toContain('White truck');
  });

  it('publishes complete pairs only; the editor shows the rest with where to add their photos', () => {
    const copy = { beforeAfter: { pairs: [{ caption: 'Sedan' }, { caption: 'Truck' }, { caption: 'Van' }] } };
    const images = { ...photos(1), [baAfterKey(2)]: FIXTURE_IMAGES.gallery3 };
    const pub = band(markup(render(FULL, { copy, images })));
    expect(visibleText(pub)).toContain('Sedan');
    expect(visibleText(pub)).not.toMatch(/Truck|Van/);
    expect(pub).not.toContain('data-acg-ba-count');
    const ed = decode(band(markup(render(FULL, { copy, images, editor: true })))).replace(/&gt;/g, '>');
    expect(ed).toContain('01 / 03');
    expect(count(ed, 'ss-ba-todo')).toBe(2);
    expect(ed).toContain(`${PHOTO_HINTS.baBefore} (pair 2)`);
    expect(ed).toContain(`${PHOTO_HINTS.baAfter} (pair 2)`);
    expect(ed).toContain(`${PHOTO_HINTS.baBefore} (pair 3)`);
  });

  it('in the editor, a band with no complete pair is editor-only and says what to add', () => {
    const html = render(FULL, { copy: { beforeAfter: { pairs: [] } }, editor: true });
    expect(sectionTag(html, 'beforeAfter').tag).toContain('data-acg-editor-only=""');
    expect(visibleText(band(html))).toContain('Add a before and an after photo in Edit > Before & After.');
    expect(band(html)).toContain('class="ss-hint" data-acg-editor-only=""');
  });

  it('hides with the Sections list, and a saved slot wins', () => {
    expect(render(FULL, { ...on(1), copy: { ...on(1).copy, hiddenSections: ['beforeAfter'] } })).toBe(render(FULL));
    const saved = render(FULL, { ...on(1), copy: { ...on(1).copy, sectionOrder: ['beforeAfter', 'hero', 'services', 'process', 'about', 'gallery'] } });
    expect(sectionTag(saved, 'beforeAfter').order).toBe(0);
  });

  it('keeps every older section on its old order value', () => {
    const legacyIds = mod.sections.map((s) => s.id).filter((id) => !mod.addedSections.includes(id));
    expect(legacyIds).toEqual(LEGACY_IDS);
    for (const saved of [{}, { sectionOrder: ['hero', 'about', 'services', 'testimonials', 'gallery', 'cta'] }]) {
      const copy = { ...FULL.generatedCopy, ...on(2).copy, ...saved };
      const html = render(FULL, { copy, images: photos(2) });
      const old = buildSectionOrder(copy, legacyIds);
      for (const id of legacyIds) {
        const s = sectionTag(html, id);
        if (s) expect({ id, order: s.order }).toEqual({ id, order: old(id) });
      }
      expect(sectionTag(html, 'beforeAfter').order).not.toBe(999);
    }
  });

  it('colors only with tokens the theme repairs, and adds no root variables', () => {
    for (const colors of [{}, CUSTOM_COLORS, LOW_CONTRAST_COLORS, DARK_COLORS]) {
      expect(rootStyle(render(FULL, { ...on(2), colors }))).toBe(rootStyle(render(FULL, { colors })));
    }
    const css = ownStyle(render(FULL, on(1)));
    const theme = css.slice(css.indexOf(THEME_CSS));
    for (const m of theme.matchAll(/--ss-ba-[\w-]+:([^;}]+)/g)) {
      expect(m[1], m[0]).toMatch(/^(var\(--ss-[\w-]+\)|\d+px)$/);
    }
    expect(theme.replace(/var\(--[\w-]+\)/g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('publishes no editor UI or invented claims, in any palette', () => {
    for (const colors of [{}, CUSTOM_COLORS, LOW_CONTRAST_COLORS]) {
      const html = render(FULL, { ...on(3, { title: 'See It' }), colors });
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
