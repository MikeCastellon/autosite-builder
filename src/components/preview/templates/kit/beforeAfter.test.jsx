// The Before & After band (kit/beforeAfter.js + kit/BeforeAfter.jsx): which
// pairs show (the published page: complete pairs only; the editor: every
// pair), the band's markup (the comparison figure with its range input,
// tags, alt text and lazy photos; arrows and counter from two pairs on) and
// its editor-only states. beforeAfterCss's shared hygiene checks are in
// blocks.test.jsx.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeforeAfterBand, beforeAfterCss, BA_LABELS } from './BeforeAfter.jsx';
import {
  BA_MAX_PAIRS, BA_DEFAULTS, BA_IMAGE_KEY, baBeforeKey, baAfterKey, baCounter, beforeAfterCount, beforeAfterPairs,
} from './beforeAfter.js';
import { EditorModeProvider } from './EditorMode.jsx';
import { PHOTO_HINTS } from './PhotoSlot.jsx';

const PAIR = (i) => ({ [baBeforeKey(i)]: `https://img.test/b${i}.jpg`, [baAfterKey(i)]: `https://img.test/a${i}.jpg` });
const band = (props, editor = false) => {
  const el = createElement(BeforeAfterBand, { ns: 'xx-ba', order: 5, ...props, editor });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
};
const count = (s, needle) => s.split(needle).length - 1;
// Hints as a reader sees them (React escapes > and & in text).
const decode = (html) => html.replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const sectionTag = (html) => (html.match(/^<section\b[^>]*>/) || [''])[0];

describe('beforeAfterPairs / beforeAfterCount', () => {
  it('is off (null) unless copy.beforeAfter is an object', () => {
    for (const v of [undefined, null, '', 'yes', 42, true, [], [{ caption: 'x' }]]) {
      expect(beforeAfterPairs(v, PAIR(0))).toBeNull();
      expect(beforeAfterPairs(v, PAIR(0), { editor: true })).toBeNull();
    }
    expect(beforeAfterPairs({}, {})).toEqual({ title: '', intro: '', pairs: [], complete: 0 });
    expect(beforeAfterPairs({ pairs: 'nope' }, null)).toEqual({ title: '', intro: '', pairs: [], complete: 0 });
  });

  it('publishes complete pairs only; the editor gets every pair, flagged', () => {
    const ba = { title: '  Fresh  ', intro: ' Slide it. ', pairs: [{ caption: ' Sedan ' }, { caption: 'Truck' }, 'junk'] };
    const images = { ...PAIR(0), [baBeforeKey(1)]: 'https://img.test/b1.jpg', ...PAIR(2) };
    const pub = beforeAfterPairs(ba, images);
    expect(pub.title).toBe('Fresh');
    expect(pub.intro).toBe('Slide it.');
    expect(pub.complete).toBe(2);
    expect(pub.pairs).toEqual([
      { index: 0, before: 'https://img.test/b0.jpg', after: 'https://img.test/a0.jpg', caption: 'Sedan', complete: true },
      { index: 2, before: 'https://img.test/b2.jpg', after: 'https://img.test/a2.jpg', caption: '', complete: true },
    ]);
    const ed = beforeAfterPairs(ba, images, { editor: true });
    expect(ed.pairs.map((p) => [p.index, p.complete, p.caption])).toEqual([[0, true, 'Sedan'], [1, false, 'Truck'], [2, true, '']]);
    expect(ed.complete).toBe(2);
  });

  it('treats anything but a non-empty string as no photo', () => {
    for (const v of ['', '  ', null, undefined, true, 7, { url: 'x' }]) {
      const pub = beforeAfterPairs({ pairs: [{}] }, { [baBeforeKey(0)]: 'https://img.test/b.jpg', [baAfterKey(0)]: v });
      expect(pub.pairs).toEqual([]);
    }
  });

  it('counts pairs entries and photos in later slots, at most BA_MAX_PAIRS', () => {
    expect(BA_MAX_PAIRS).toBe(6);
    expect(beforeAfterCount({ pairs: [{}, {}] }, {})).toBe(2);
    // A photo without a pairs entry (the run writes images first) still counts.
    expect(beforeAfterCount({ pairs: [] }, { [baAfterKey(3)]: 'https://img.test/a3.jpg' })).toBe(4);
    expect(beforeAfterCount({ pairs: Array.from({ length: 9 }, () => ({})) }, {})).toBe(6);
    expect(beforeAfterCount({}, { baBefore6: 'https://img.test/x.jpg', baAfter9: 'https://img.test/y.jpg' })).toBe(0);
    expect(beforeAfterCount(null, PAIR(1))).toBe(2);
    const seven = {};
    for (let i = 0; i < 7; i++) Object.assign(seven, PAIR(i));
    expect(beforeAfterPairs({ pairs: [] }, seven).pairs.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('names image keys, the counter and the design defaults', () => {
    expect([baBeforeKey(0), baAfterKey(5)]).toEqual(['baBefore0', 'baAfter5']);
    for (const k of ['baBefore0', 'baAfter5']) expect(BA_IMAGE_KEY.test(k)).toBe(true);
    for (const k of ['baBefore6', 'baafter1', 'gallery0', 'baBefore', 'xbaBefore1']) expect(BA_IMAGE_KEY.test(k)).toBe(false);
    expect([baCounter(1), baCounter(6), baCounter(12)]).toEqual(['01', '06', '12']);
    expect(BA_DEFAULTS).toEqual({ eyebrow: 'Before & After', title: 'See the Difference', intro: 'Drag the slider to compare.' });
  });
});

describe('BeforeAfterBand', () => {
  it('renders nothing while the band is off, or published without a complete pair', () => {
    for (const editor of [false, true]) expect(band({ beforeAfter: null, images: PAIR(0) }, editor)).toBe('');
    expect(band({ beforeAfter: { pairs: [{}] }, images: { [baBeforeKey(0)]: 'https://img.test/b0.jpg' } })).toBe('');
    expect(band({ beforeAfter: {}, images: {} })).toBe('');
  });

  it('a complete pair: the comparison figure, published', () => {
    const html = band({
      beforeAfter: { pairs: [{ caption: 'Black sedan, paint correction' }] },
      images: PAIR(0),
      className: 'xx-section',
      wrapClassName: 'xx-wrap',
      labelledBy: 'xx-ba-h',
      heading: <h2 id="xx-ba-h">Heading</h2>,
    });
    expect(sectionTag(html)).toBe('<section data-section="beforeAfter" id="before-after" class="xx-ba-band xx-section" aria-labelledby="xx-ba-h" style="order:5">');
    expect(html).toContain('<div class="xx-wrap"><h2 id="xx-ba-h">Heading</h2><div class="xx-ba-slider" data-acg-ba-slider="" data-acg-reveal=""><div class="xx-ba-track" data-acg-ba-track="">');
    expect(html).toContain('<div class="xx-ba-slide" role="group" aria-label="Before and after 1 of 1"><figure class="xx-ba-pair" data-acg-ba="" style="--acg-ba:50%"><div class="xx-ba-frame">');
    // Before under, after over it in the clipped pane; both lazy, alt with the caption.
    expect(html).toMatch(/<div class="xx-ba-frame"><img src="https:\/\/img.test\/b0.jpg" alt="Before: Black sedan, paint correction" loading="lazy" decoding="async"[^>]*\/><div class="xx-ba-after"><img src="https:\/\/img.test\/a0.jpg" alt="After: Black sedan, paint correction" loading="lazy"/);
    expect(html).toContain('<span class="xx-ba-tag xx-ba-tag-before" aria-hidden="true">Before</span><span class="xx-ba-tag xx-ba-tag-after" aria-hidden="true">After</span>');
    const range = html.match(/<input[^>]*>/)[0];
    for (const a of ['class="xx-ba-range"', 'type="range"', 'min="0"', 'max="100"', 'value="50"', 'data-acg-ba-range=""', 'aria-label="Compare before and after"']) expect(range).toContain(a);
    // The handle comes after the input (its :focus-visible rings the knob).
    expect(html.indexOf('class="xx-ba-line"')).toBeGreaterThan(html.indexOf('data-acg-ba-range'));
    expect(html).toContain('<span class="xx-ba-line" aria-hidden="true"><span class="xx-ba-knob"><svg');
    expect(html).toContain('<figcaption class="xx-ba-cap">Black sedan, paint correction</figcaption>');
    // One pair: no arrows, no counter.
    expect(html).not.toMatch(/data-acg-ba-(prev|next|count)|xx-ba-nav/);
    expect(html).not.toContain('data-acg-editor-only');
  });

  it('two pairs or more: prev / next and an "01 / 02" counter, slides labelled', () => {
    const html = band({ beforeAfter: { pairs: [{}, {}, { caption: 'Hidden: no photos' }] }, images: { ...PAIR(0), ...PAIR(1) } });
    expect(count(html, 'data-acg-ba=""')).toBe(2);
    expect(html).toContain('aria-label="Before and after 2 of 2"');
    expect(html).not.toContain('Hidden: no photos');
    expect(html).toMatch(/<div class="xx-ba-nav"><button type="button" class="xx-ba-btn" data-acg-ba-prev="" aria-label="Previous before and after"><svg[^]*?<\/button><p class="xx-ba-count" data-acg-ba-count="" aria-hidden="true">01 \/ 02<\/p><button type="button" class="xx-ba-btn" data-acg-ba-next="" aria-label="Next before and after"><svg/);
    // Alt text without a caption is the side alone.
    expect(html).toContain('alt="Before" loading="lazy"');
    expect(html).toContain('alt="After" loading="lazy"');
  });

  it('the editor shows an incomplete pair as two slots naming where to add each photo', () => {
    const images = { ...PAIR(0), [baAfterKey(1)]: 'https://img.test/a1.jpg' };
    const html = band({ beforeAfter: { pairs: [{}, { caption: 'Truck' }] }, images }, true);
    // The band itself publishes (pair 1 is complete): only the todo figure is editor-only.
    expect(sectionTag(html)).not.toContain('data-acg-editor-only');
    const todo = html.slice(html.indexOf('<figure class="xx-ba-pair xx-ba-todo" data-acg-editor-only="">'));
    expect(todo).not.toBe(html);
    expect(decode(todo)).toContain(`${PHOTO_HINTS.baBefore} (pair 2)`);
    expect(todo).toContain('src="https://img.test/a1.jpg" alt="After: Truck"');
    expect(todo).not.toContain('data-acg-ba-range');
    expect(html).toContain('01 / 02');
    // The same data published: one pair, so no arrows.
    const pub = band({ beforeAfter: { pairs: [{}, { caption: 'Truck' }] }, images });
    expect(count(pub, 'data-acg-ba=""')).toBe(1);
    expect(pub).not.toMatch(/data-acg-ba-count|Truck|data-acg-editor-only|Edit &gt;|Edit >/);
  });

  it('with no complete pair the editor shows the whole band as editor-only', () => {
    const empty = band({ beforeAfter: { pairs: [] }, images: {}, heading: <h2>H</h2>, hints: <p className="hint">Add photos</p> }, true);
    expect(sectionTag(empty)).toContain('data-acg-editor-only=""');
    expect(empty).toContain('<h2>H</h2><p class="hint">Add photos</p>');
    expect(empty).not.toContain('xx-ba-slider');
    const half = band({ beforeAfter: { pairs: [{}] }, images: { [baBeforeKey(0)]: 'https://img.test/b0.jpg' } }, true);
    expect(sectionTag(half)).toContain('data-acg-editor-only=""');
    expect(decode(half)).toContain(`${PHOTO_HINTS.baAfter} (pair 1)`);
  });

  it('takes the theme\'s labels and section id, and keeps every class in its namespace', () => {
    const html = band({ beforeAfter: { pairs: [] }, images: { ...PAIR(0), ...PAIR(1) }, id: 'results', labels: { before: 'Avant', after: 'Après' } });
    expect(sectionTag(html)).toContain('id="results"');
    expect(html).toContain('>Avant</span>');
    expect(html).toContain('alt="Après"');
    expect(html).toContain(`aria-label="${BA_LABELS.range}"`);
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(' ')) expect(c.startsWith('xx-ba-'), c).toBe(true);
    }
  });
});

describe('beforeAfterCss', () => {
  const css = beforeAfterCss('xx-ba');

  it('clips the after photo and places the divider from --acg-ba (50% without the runtime)', () => {
    expect(css).toContain('.xx-ba-after{position:absolute;inset:0;-webkit-clip-path:inset(0 0 0 var(--acg-ba,50%));clip-path:inset(0 0 0 var(--acg-ba,50%))}');
    expect(css).toMatch(/\.xx-ba-line\{[^}]*left:var\(--acg-ba,50%\)/);
  });

  it('keeps the range thumb on the divider: the input spills half a thumb past each side', () => {
    const range = css.match(/\.xx-ba-range\{([^}]*)\}/)[1];
    const thumb = css.match(/\.xx-ba-range::-webkit-slider-thumb\{([^}]*)\}/)[1];
    const spill = Number(range.match(/left:-(\d+)px/)[1]);
    expect(range).toContain(`width:calc(100% + ${spill * 2}px)`);
    expect(thumb).toContain(`width:${spill * 2}px`);
    expect(css).toContain(`.xx-ba-range::-moz-range-thumb{width:${spill * 2}px`);
  });

  it('lets touch swipe the photos (only the handle drags) and hover devices drag anywhere', () => {
    expect(css).toMatch(/\.xx-ba-range\{[^}]*pointer-events:none;touch-action:pan-y\}/);
    expect(css).toMatch(/\.xx-ba-range::-webkit-slider-thumb\{[^}]*pointer-events:auto/);
    expect(css).toMatch(/@media \(hover:hover\)\{\n\.xx-ba-range\{pointer-events:auto\}/);
    expect(css).toContain('.xx-ba-range:focus-visible~.xx-ba-line .xx-ba-knob{outline:3px solid var(--xx-ba-focus);outline-offset:3px}');
  });

  it('snaps one pair per slide and scrolls smoothly only where motion is allowed', () => {
    expect(css).toMatch(/\.xx-ba-track\{[^}]*scroll-snap-type:x mandatory/);
    expect(css).toMatch(/\.xx-ba-slide\{flex:0 0 100%;[^}]*scroll-snap-align:start/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{\n\.xx-ba-track\{scroll-behavior:smooth\}/);
  });
});
