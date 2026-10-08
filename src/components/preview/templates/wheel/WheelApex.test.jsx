// wheel_apex (Forge Studio) photo slots, beyond the shared contract in
// templates.render.test.jsx. Owner feedback: Hero Layout "Full Background"
// did nothing without a hero photo (it fell back to the split layout), and
// a drawn alloy wheel stood in for every missing photo and trust-bar icon.
// Now Full Background always renders the full-width hero (a plain band
// until there is a photo), an empty photo slot is blank on the published
// page and an upload placeholder in the editor, and a trust item without
// an icon shows none.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WheelApex from './WheelApex.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { contrastRatio } from '../kit/theme.js';
import { full, FIXTURE_IMAGES, CUSTOM_COLORS } from '../__fixtures__/businesses.js';

const ID = 'wheel_apex';
const HERO = FIXTURE_IMAGES.hero;
const NO_HERO = { ...FIXTURE_IMAGES, hero: undefined };
const PRODUCT_PHOTO = 'https://example.com/forged-wheel.jpg';
// The arrow is the only icon the hero draws (on its second button).
const ARROW = 'M5 12h14M13 6l6 6-6 6';

function render({ copy = {}, images = FIXTURE_IMAGES, colors = {}, editor = false } = {}) {
  const el = createElement(WheelApex, {
    businessInfo: normalizeBusinessInfo(full.businessInfo),
    generatedCopy: { ...full.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, colors, {}),
    images,
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<');
// The rendered elements without the <style> block (whose selectors name
// every class).
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const cssOf = (html) => (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const heroOf = (html) => (html.match(/<header data-section="hero"[\s\S]*?<\/header>/) || [])[0] || '';
const heroClass = (html) => (heroOf(html).match(/^<header data-section="hero" class="([^"]*)"/) || [])[1];
const svgs = (html) => html.match(/<svg\b[\s\S]*?<\/svg>/g) || [];
const count = (html, needle) => html.split(needle).length - 1;
// What sits inside the first element with this class (no nested <div>s in
// the slots checked here).
const inner = (html, cls, from = 0) => {
  const m = html.slice(from).match(new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`));
  return m ? m[1] : null;
};
const rootVars = (html) => {
  const style = decode((html.match(/<div id="top" class="wa-root" style="([^"]*)"/) || [])[1] || '');
  return Object.fromEntries(style.split(';').map((d) => d.split(/:(.*)/s).map((x) => x.trim())).filter(([k]) => k));
};

// Nothing of the old stand-in wheel may remain, in markup or CSS.
function expectNoRim(html) {
  expect(html).not.toMatch(/wa-rim|rimstage|wa-prod-rim|wa-hero-rim/);
  expect(html).not.toContain('viewBox="-100 -100 200 200"');
}
function expectNothingEditorOnly(html) {
  expect(html).not.toContain('data-acg-editor-only');
  expect(decode(markup(html))).not.toMatch(/Edit >|Add a (hero|product) photo/);
}

describe('wheel_apex hero layouts', () => {
  it('defaults to Full Background over the hero photo', () => {
    for (const editor of [false, true]) {
      const html = render({ editor });
      const hero = heroOf(html);
      expect(heroClass(html)).toBe('wa-hero wa-hero-photo');
      expect(hero).toContain(`<img src="${HERO.replace(/&/g, '&amp;')}"`);
      expect(hero).toContain('<div class="wa-hero-scrim"></div>');
      expect(hero).not.toContain('data-acg-editor-only');
      expectNoRim(html);
    }
    expect(heroClass(render({ copy: { heroLayout: 'full' } }))).toBe('wa-hero wa-hero-photo');
  });

  it('renders Full Background without a photo as a plain band, blank when published', () => {
    const html = render({ images: NO_HERO });
    const hero = heroOf(html);
    expect(heroClass(html)).toBe('wa-hero wa-hero-photo wa-hero-plain');
    expect(hero).not.toContain('wa-hero-split');
    expect(hero).not.toContain('wa-stage');
    expect(hero).not.toContain('<img');
    expect(hero).not.toContain('wa-hero-scrim');
    expect(hero).toContain('<div class="wa-hero-bg"></div>');
    // No drawn wheel, crosshair or dashed circle: the only svg is the
    // button arrow.
    for (const svg of svgs(hero)) expect(svg).toContain(ARROW);
    expectNoRim(html);
    expectNothingEditorOnly(html);
    expect(cssOf(html)).toContain('.wa-hero-plain{background:var(--wa-hero-plain-bg);color:var(--wa-hero-plain-text)}');
  });

  it('shows the upload placeholder over the plain band in the editor only, once', () => {
    const html = render({ images: NO_HERO, editor: true });
    const hero = heroOf(html);
    expect(heroClass(html)).toBe('wa-hero wa-hero-photo wa-hero-plain');
    const bg = hero.match(/<div class="wa-hero-bg">([\s\S]*?)<\/div><\/div>/);
    expect(bg, 'placeholder inside the hero background layer').not.toBeNull();
    expect(bg[1]).toContain('data-acg-editor-only');
    expect(bg[1]).toContain(PHOTO_HINTS.hero.replace(/>/g, '&gt;'));
    // The placeholder replaced the old hint under the buttons.
    expect(count(decode(html), PHOTO_HINTS.hero)).toBe(1);
    expect(hero).not.toContain('wa-hero-scrim');
    expectNoRim(html);
  });

  it('keeps the split layout over the hero photo', () => {
    for (const editor of [false, true]) {
      const html = render({ copy: { heroLayout: 'split' }, editor });
      expect(heroClass(html)).toBe('wa-hero wa-hero-split');
      const media = inner(heroOf(html), 'wa-stage-media');
      expect(media).toMatch(/^<img src="data:image\/svg\+xml/);
      expect(heroOf(html)).not.toContain('data-acg-editor-only');
      expectNoRim(html);
    }
  });

  it('leaves the split media column blank without a photo (placeholder in the editor)', () => {
    const published = render({ copy: { heroLayout: 'split' }, images: NO_HERO });
    expect(heroClass(published)).toBe('wa-hero wa-hero-split');
    expect(heroOf(published)).toContain('<div class="wa-stage-media"></div>');
    for (const svg of svgs(heroOf(published))) expect(svg).toContain(ARROW);
    expectNoRim(published);
    expectNothingEditorOnly(published);

    const editor = render({ copy: { heroLayout: 'split' }, images: NO_HERO, editor: true });
    const slot = heroOf(editor).match(/<div class="wa-stage-media">(<div data-acg-editor-only=""[\s\S]*?<\/span><\/div>)<\/div>/);
    expect(slot, 'editor placeholder fills the media column').not.toBeNull();
    expect(slot[1]).toContain(PHOTO_HINTS.hero.replace(/>/g, '&gt;'));
    expect(count(decode(editor), PHOTO_HINTS.hero)).toBe(1);
    expectNoRim(editor);
  });

  it.each([
    ['default', {}],
    ['custom', CUSTOM_COLORS],
    ['low-contrast', { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' }],
    ['mid-gray ink', { bg: '#ffffff', text: '#8a8a8a', muted: '#9a9a9a' }],
    ['light on dark', { bg: '#2a2a2a', text: '#bcbcbc', secondary: '#333333' }],
    ['mid-tone page', { bg: '#7f8c8d', text: '#ffffff', accent: '#e67e22' }],
  ])('repairs the plain hero text to 4.5:1 on its band (%s palette)', (_, colors) => {
    const vars = rootVars(render({ images: NO_HERO, colors }));
    const bg = vars['--wa-hero-plain-bg'];
    expect(bg).toMatch(/^#[0-9a-f]{6}$/);
    for (const fg of ['--wa-hero-plain-text', '--wa-hero-plain-muted']) {
      expect(contrastRatio(vars[fg], bg), `${fg} ${vars[fg]} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('wheel_apex product photos', () => {
  const products = [
    { name: 'Forged Monoblock', price: '$2,400', image: PRODUCT_PHOTO },
    { name: 'Flow Formed', price: '$1,100', badge: 'New' },
  ];

  it('publishes a blank media block for a product without a photo', () => {
    const html = render({ copy: { products } });
    const page = markup(html);
    expect(count(page, 'class="wa-card-media"')).toBe(2);
    const first = page.indexOf('class="wa-card-media"');
    const second = page.indexOf('class="wa-card-media"', first + 1);
    expect(inner(page, 'wa-card-media', first - 12)).toMatch(/^<img src="https:\/\/example\.com\/forged-wheel\.jpg"/);
    // Only the owner's badge; no image, wheel, "Image" box or hint.
    expect(inner(page, 'wa-card-media', second - 12)).toBe('<span class="wa-badge">New</span>');
    expectNoRim(html);
    expectNothingEditorOnly(html);
  });

  it('shows the product upload placeholder in the editor', () => {
    const html = render({ copy: { products }, editor: true });
    const page = markup(html);
    const second = page.indexOf('class="wa-card-media"', page.indexOf('class="wa-card-media"') + 1);
    const media = page.slice(second).match(/^class="wa-card-media">([\s\S]*?<\/span><\/div>)<\/div>/);
    expect(media).not.toBeNull();
    expect(media[1]).toContain('data-acg-editor-only');
    expect(media[1]).toContain(PHOTO_HINTS.product.replace(/>/g, '&gt;'));
    expectNoRim(html);
  });
});

describe('wheel_apex trust bar', () => {
  const trustBar = [
    { label: 'Mobile fitting', sub: 'We come to you' },
    { label: 'Hub-centric rings', sub: 'Included', emoji: '' },
    { label: 'Insured', sub: 'Fully covered', emoji: '🛡️' },
  ];
  const items = (html) => markup(html).match(/<li class="wa-trust-item"[\s\S]*?<\/li>/g) || [];

  it.each([['published', false], ['editor', true]])('draws no icon for an owner item without one (%s)', (_, editor) => {
    const html = render({ copy: { trustBar }, editor });
    const [noIcon, emptyEmoji, withEmoji] = items(html);
    for (const li of [noIcon, emptyEmoji]) {
      expect(li).not.toContain('wa-ticon');
      expect(li).not.toContain('<svg');
    }
    expect(withEmoji).toContain('<span class="wa-ticon" aria-hidden="true"><span style="font-size:16px">🛡️</span></span>');
    expectNoRim(html);
    if (!editor) expectNothingEditorOnly(html);
  });

  it('keeps the icons of the facts it builds itself', () => {
    const html = render();
    const built = items(html);
    expect(built.length).toBeGreaterThanOrEqual(2);
    for (const li of built) expect(li).toMatch(/<span class="wa-ticon" aria-hidden="true"><svg /);
  });
});
