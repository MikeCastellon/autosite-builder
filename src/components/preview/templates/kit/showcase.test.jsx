// The Detail Showcase band (kit/showcase.js + kit/Showcase.jsx): which cards
// show (the published page: items with a title and a photo; the editor:
// every item), the limits saved text is cut to, the band's markup (its
// built-in or the theme's heading, the staggered list of lazy photo cards
// with alt text) and its editor-only states, and showcaseCss's theme-contract
// hygiene (the same checks blocks.test.jsx runs on the other blocks).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShowcaseBand, showcaseCss } from './Showcase.jsx';
import {
  SHOWCASE_SECTION, SHOWCASE_MAX_ITEMS, SHOWCASE_LIMITS, SHOWCASE_DEFAULTS, SHOWCASE_HINTS, SHOWCASE_IMAGE_KEY,
  showcaseKey, showcaseItemHint, showcaseCount, showcaseItems, clipText,
} from './showcase.js';
import { EditorModeProvider } from './EditorMode.jsx';

const IMG = (...idx) => Object.assign({}, ...idx.map((i) => ({ [showcaseKey(i)]: `https://img.test/s${i}.jpg` })));
const band = (props, editor = false) => {
  const el = createElement(ShowcaseBand, { ns: 'xx-sc', order: 7, ...props, editor });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
};
const count = (s, needle) => s.split(needle).length - 1;
// Text as a reader sees it (React escapes > and & in text).
const decode = (html) => html.replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
const sectionTag = (html) => (html.match(/^<section\b[^>]*>/) || [''])[0];
const visibleText = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Walt's-style sample: four services, two with captions.
const WALTS = {
  items: [
    { title: 'Exterior Wash', caption: 'Hand wash, wheels and tires, streak-free glass.' },
    { title: 'Interior Detailing' },
    { title: 'Hand Wax', caption: 'Applied and buffed by hand.' },
    { title: 'Headlight Restoration' },
  ],
};

describe('showcaseItems / showcaseCount', () => {
  it('is off (null) unless copy.showcase is an object', () => {
    for (const v of [undefined, null, '', 'yes', 42, true, [], [{ title: 'x' }]]) {
      expect(showcaseItems(v, IMG(0))).toBeNull();
      expect(showcaseItems(v, IMG(0), { editor: true })).toBeNull();
    }
    expect(showcaseItems({}, {})).toEqual({ title: '', intro: '', items: [], complete: 0 });
    expect(showcaseItems({ items: 'nope' }, null)).toEqual({ title: '', intro: '', items: [], complete: 0 });
  });

  it('publishes items with a title and a photo only; the editor gets every item, flagged', () => {
    const sc = { title: '  Every Detail  ', intro: ' Up close. ', items: [{ title: ' Wash ', caption: ' Foam ' }, { title: 'Wax' }, { caption: 'No title' }, 'junk-free string'] };
    const images = IMG(0, 2, 3);
    const pub = showcaseItems(sc, images);
    expect(pub.title).toBe('Every Detail');
    expect(pub.intro).toBe('Up close.');
    expect(pub.complete).toBe(2);
    expect(pub.items).toEqual([
      { index: 0, title: 'Wash', caption: 'Foam', photo: 'https://img.test/s0.jpg', complete: true },
      // A bare string entry is the item's title.
      { index: 3, title: 'junk-free string', caption: '', photo: 'https://img.test/s3.jpg', complete: true },
    ]);
    const ed = showcaseItems(sc, images, { editor: true });
    expect(ed.items.map((it) => [it.index, it.complete, it.title, Boolean(it.photo)])).toEqual([
      [0, true, 'Wash', true], [1, false, 'Wax', false], [2, false, '', true], [3, true, 'junk-free string', true],
    ]);
    expect(ed.complete).toBe(2);
  });

  it('treats anything but a non-empty string as no photo', () => {
    for (const v of ['', '  ', null, undefined, true, 7, { url: 'x' }]) {
      expect(showcaseItems({ items: [{ title: 'Wash' }] }, { [showcaseKey(0)]: v }).items).toEqual([]);
    }
  });

  it('counts items entries and photos in later slots, at most SHOWCASE_MAX_ITEMS', () => {
    expect(SHOWCASE_MAX_ITEMS).toBe(6);
    expect(showcaseCount({ items: [{}, {}] }, {})).toBe(2);
    // A photo without an items entry (uploaded before the title) still counts.
    expect(showcaseCount({ items: [] }, IMG(3))).toBe(4);
    expect(showcaseCount({ items: Array.from({ length: 9 }, () => ({ title: 'x' })) }, {})).toBe(6);
    expect(showcaseCount({}, { showcase6: 'https://img.test/x.jpg', showcase9: 'https://img.test/y.jpg' })).toBe(0);
    expect(showcaseCount(null, IMG(1))).toBe(2);
    const seven = { items: Array.from({ length: 7 }, (_, i) => ({ title: `T${i}` })) };
    expect(showcaseItems(seven, IMG(0, 1, 2, 3, 4, 5, 6)).items.map((it) => it.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('cuts saved text to the limits, at a word, on one line', () => {
    expect(SHOWCASE_LIMITS).toEqual({ title: 80, intro: 200, itemTitle: 60, caption: 140 });
    const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
    const sc = showcaseItems({ title: words(30), intro: words(60), items: [{ title: words(20), caption: words(40) }] }, IMG(0));
    for (const [text, max] of [[sc.title, 80], [sc.intro, 200], [sc.items[0].title, 60], [sc.items[0].caption, 140]]) {
      expect(text.length).toBeLessThanOrEqual(max);
      expect(text.length).toBeGreaterThan(max / 2);
      // Whole words only: what is left is a prefix of the source, ending at a word.
      expect(text).toMatch(/word\d+$/);
    }
    expect(clipText('Line one\nline\ttwo\u2028three', 80)).toBe('Line one line two three');
    // No space in the second half: a hard cut, never an ellipsis.
    expect(clipText('x'.repeat(70), 60)).toBe('x'.repeat(60));
    expect(clipText('Wax, polish, buffing, sealing', 22)).toBe('Wax, polish, buffing');
    expect(clipText(null, 10)).toBe('');
    expect(clipText(2024, 10)).toBe('2024');
  });

  it('names the section, image keys, hints and the design defaults', () => {
    expect(SHOWCASE_SECTION).toEqual({ id: 'showcase', label: 'Detail Showcase' });
    expect([showcaseKey(0), showcaseKey(5)]).toEqual(['showcase0', 'showcase5']);
    for (const k of ['showcase0', 'showcase5']) expect(SHOWCASE_IMAGE_KEY.test(k)).toBe(true);
    for (const k of ['showcase6', 'Showcase1', 'gallery0', 'showcase', 'xshowcase1', 'showcase10']) expect(SHOWCASE_IMAGE_KEY.test(k)).toBe(false);
    expect(SHOWCASE_DEFAULTS).toEqual({ eyebrow: 'The finishing touch', title: 'Every Detail Matters', intro: '' });
    expect(showcaseItemHint('photo', 1)).toBe('Add a photo: Edit > Detail Showcase (item 2)');
    expect(showcaseItemHint('title', 0)).toBe('Add a title: Edit > Detail Showcase (item 1)');
    expect(SHOWCASE_HINTS.empty).toContain('Edit > Detail Showcase');
  });
});

describe('ShowcaseBand', () => {
  it('renders nothing while the band is off, or published without a complete item', () => {
    for (const editor of [false, true]) expect(band({ showcase: null, images: IMG(0) }, editor)).toBe('');
    expect(band({ showcase: { items: [{ title: 'Wash' }] }, images: {} })).toBe('');
    expect(band({ showcase: { items: [{ caption: 'No title' }] }, images: IMG(0) })).toBe('');
    expect(band({ showcase: {}, images: {} })).toBe('');
  });

  it('published: the section, the built-in heading and one lazy photo card per complete item', () => {
    const html = band({ showcase: WALTS, images: IMG(0, 1, 2, 3), className: 'xx-section', wrapClassName: 'xx-wrap' });
    expect(sectionTag(html)).toBe('<section data-section="showcase" id="showcase" class="xx-sc-band xx-section" aria-labelledby="showcase-h" style="order:7">');
    expect(html).toContain('<div class="xx-wrap"><div class="xx-sc-head" data-acg-reveal=""><p class="xx-sc-eyebrow">The finishing touch</p><h2 id="showcase-h" class="xx-sc-title">Every Detail Matters</h2></div><ul class="xx-sc-grid">');
    expect(count(html, '<li class="xx-sc-item" data-acg-reveal=""')).toBe(4);
    // The right-hand column's cards follow their neighbours in.
    expect(html.match(/--acg-delay:\d+ms/g)).toEqual(['--acg-delay:0ms', '--acg-delay:120ms', '--acg-delay:0ms', '--acg-delay:120ms']);
    expect(html).toMatch(/<figure class="xx-sc-card"><div class="xx-sc-photo"><img src="https:\/\/img.test\/s0.jpg" alt="Exterior Wash" loading="lazy" decoding="async"[^>]*\/><\/div><figcaption class="xx-sc-body"><span class="xx-sc-num" aria-hidden="true">01<\/span><div class="xx-sc-text"><h3 class="xx-sc-name">Exterior Wash<\/h3><p class="xx-sc-cap">Hand wash, wheels and tires, streak-free glass.<\/p><\/div><\/figcaption><\/figure>/);
    expect(html).toContain('alt="Headlight Restoration" loading="lazy"');
    expect(html).toContain('<h3 class="xx-sc-name">Interior Detailing</h3></div>');
    expect(html).toContain('>04</span>');
    expect(count(html, 'loading="lazy"')).toBe(4);
    expect(html).not.toMatch(/data-acg-editor-only|Edit &gt;|Edit >|xx-sc-intro|xx-sc-solo/);
    // Nothing on the page but the owner's words and the design's heading.
    expect(visibleText(html)).toBe('The finishing touch Every Detail Matters 01 Exterior Wash Hand wash, wheels and tires, streak-free glass. 02 Interior Detailing 03 Hand Wax Applied and buffed by hand. 04 Headlight Restoration');
  });

  it('numbers the cards it shows, so a skipped item leaves no gap', () => {
    const html = band({ showcase: WALTS, images: IMG(0, 2, 3) });
    expect(html).not.toContain('Interior Detailing');
    expect(html.match(/xx-sc-num" aria-hidden="true">(\d+)</g).map((m) => m.slice(-3, -1))).toEqual(['01', '02', '03']);
  });

  it('prints the owner\'s heading and intro over the theme\'s defaults over the design\'s', () => {
    const own = band({ showcase: { ...WALTS, title: 'Every Detail Makes A Difference', intro: 'A closer look.' }, images: IMG(0), defaults: { eyebrow: 'Our craft', title: 'Theme title', intro: 'Theme intro' } });
    expect(own).toContain('<p class="xx-sc-eyebrow">Our craft</p><h2 id="showcase-h" class="xx-sc-title">Every Detail Makes A Difference</h2><p class="xx-sc-intro">A closer look.</p>');
    const theme = band({ showcase: WALTS, images: IMG(0), defaults: { eyebrow: '', title: 'Theme title', intro: 'Theme intro' } });
    expect(theme).toContain('<div class="xx-sc-head" data-acg-reveal=""><h2 id="showcase-h" class="xx-sc-title">Theme title</h2><p class="xx-sc-intro">Theme intro</p></div>');
    // Never an empty heading: a blank default falls back to the design's.
    expect(band({ showcase: WALTS, images: IMG(0), defaults: { title: '' } })).toContain('class="xx-sc-title">Every Detail Matters</h2>');
  });

  it('takes the theme\'s own heading, label and section id', () => {
    const html = band({ showcase: WALTS, images: IMG(0, 1), id: 'details', labelledBy: 'xx-h', heading: <h2 id="xx-h">Our Details</h2> });
    expect(sectionTag(html)).toBe('<section data-section="showcase" id="details" class="xx-sc-band" aria-labelledby="xx-h" style="order:7">');
    expect(html).toContain('<h2 id="xx-h">Our Details</h2><ul class="xx-sc-grid">');
    expect(html).not.toContain('xx-sc-head');
    // heading={null}: no heading at all, and no label pointing at one.
    const bare = band({ showcase: WALTS, images: IMG(0), heading: null });
    expect(sectionTag(bare)).not.toContain('aria-labelledby');
    expect(bare).toMatch(/style="order:7"><div><ul class="xx-sc-grid xx-sc-solo">/);
  });

  it('a lone card gets the solo class (one wide card instead of half a row)', () => {
    expect(band({ showcase: WALTS, images: IMG(2) })).toContain('<ul class="xx-sc-grid xx-sc-solo">');
    expect(band({ showcase: WALTS, images: IMG(1, 2) })).toContain('<ul class="xx-sc-grid">');
  });

  it('the editor shows every item and says what each one still needs', () => {
    const sc = { items: [{ title: 'Exterior Wash' }, { title: 'Interior Detailing' }, { caption: 'Glass that disappears' }] };
    const html = band({ showcase: sc, images: IMG(0, 2) }, true);
    // One item is complete, so the band publishes: only the others are editor-only.
    expect(sectionTag(html)).not.toContain('data-acg-editor-only');
    expect(count(html, 'data-acg-editor-only=""')).toBe(3); // two items + the photo placeholder
    const items = html.split('<li ').slice(1);
    expect(items[0]).toMatch(/^class="xx-sc-item" data-acg-reveal="" style="--acg-delay:0ms">/);
    // Incomplete items are also xx-sc-todo (the theme can drop its frame
    // decorations there, as with Before & After's todo pairs).
    expect(items[1]).toMatch(/^class="xx-sc-item xx-sc-todo" data-acg-reveal="" style="--acg-delay:120ms" data-acg-editor-only="">/);
    expect(decode(items[1])).toContain(showcaseItemHint('photo', 1));
    expect(items[1]).toContain('<h3 class="xx-sc-name">Interior Detailing</h3>');
    expect(items[2]).toMatch(/^class="xx-sc-item xx-sc-todo" /);
    expect(items[2]).toContain('src="https://img.test/s2.jpg" alt=""');
    expect(decode(items[2])).toContain(`<p class="xx-sc-hint">${showcaseItemHint('title', 2)}</p>`);
    expect(items[2]).toContain('<p class="xx-sc-cap">Glass that disappears</p>');
    // The same data published: the one complete card, nothing editor-only.
    const pub = band({ showcase: sc, images: IMG(0, 2) });
    expect(count(pub, '<li ')).toBe(1);
    expect(pub).not.toMatch(/Interior Detailing|Glass that disappears|data-acg-editor-only|Edit &gt;|Edit >|xx-sc-todo|xx-sc-hint/);
  });

  it('with no complete item the editor shows the whole band as editor-only', () => {
    const half = band({ showcase: { items: [{ title: 'Hand Wax' }] }, images: {} }, true);
    expect(sectionTag(half)).toContain('data-acg-editor-only=""');
    expect(decode(half)).toContain(showcaseItemHint('photo', 0));
    // No item at all: the heading and a placeholder naming where to add them.
    const empty = band({ showcase: {}, images: {} }, true);
    expect(sectionTag(empty)).toContain('data-acg-editor-only=""');
    expect(empty).toContain('Every Detail Matters</h2>');
    expect(empty).not.toContain('xx-sc-grid');
    expect(decode(empty)).toMatch(new RegExp(`<div data-acg-editor-only="" style="[^"]*"><svg[^]*<span[^>]*>${SHOWCASE_HINTS.empty}</span></div></div></section>$`));
    // The theme's own hints replace the placeholder (false / null: none).
    const own = band({ showcase: {}, images: {}, hints: <p className="hint">Add photos</p> }, true);
    expect(own).toContain('<p class="hint">Add photos</p></div></section>');
    expect(own).not.toContain(SHOWCASE_HINTS.empty.slice(0, 20));
    expect(band({ showcase: {}, images: {}, hints: false }, true)).not.toContain('data-acg-editor-only="" style=');
  });

  it('keeps every class in its namespace', () => {
    const html = band({ showcase: WALTS, images: IMG(0, 1, 2) }) + band({ showcase: WALTS, images: IMG(0, 3) }, true);
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(' ')) expect(c.startsWith('xx-sc-'), c).toBe(true);
    }
  });
});

// A tiny CSS reader (as in blocks.test.jsx): every rule with its selector
// and the at-rules around it.
function cssRules(css) {
  const out = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') {
      if (stack.length === 0) throw new Error('unbalanced }');
      const prelude = stack.pop();
      if (buf.trim()) out.push({ selector: prelude, body: buf.trim(), at: [...stack] });
      buf = '';
    } else buf += ch;
  }
  if (stack.length) throw new Error('unbalanced {');
  return out;
}

describe('showcaseCss', () => {
  const ns = 'xx-sc';
  const css = showcaseCss(ns);
  const rules = cssRules(css);
  const rule = (sel, at = []) => rules.find((r) => r.selector === sel && r.at.join('|') === at.join('|'))?.body || '';
  const WIDE = ['@container (min-width:601px)'];

  it('is non-empty, balanced and free of comments', () => {
    expect(rules.length).toBeGreaterThan(5);
    expect(css).not.toContain('/*');
  });

  it('has no hard-coded colors but black / white and neutral translucent overlays', () => {
    const hexes = [...css.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => !['#fff', '#ffffff', '#000', '#000000'].includes(h))).toEqual([]);
    for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi)) {
      expect(m[1] === m[2] && m[2] === m[3] && m[4] !== undefined && Number(m[4]) < 1, m[0]).toBe(true);
    }
    expect(css).not.toMatch(/\b(hsl|oklch|lab)\(/i);
  });

  it('keeps hover in (hover:hover) and motion in prefers-reduced-motion', () => {
    for (const r of rules) {
      if (r.selector.includes(':hover')) expect(r.at, r.selector).toContain('@media (hover:hover)');
      if (/(^|;)\s*(transition|animation)\s*:/.test(r.body)) expect(r.at, r.selector).toContain('@media (prefers-reduced-motion:no-preference)');
    }
  });

  it('uses container breakpoints only', () => {
    expect(css).not.toMatch(/@media\s*\([^)]*width/);
    for (const r of rules) for (const at of r.at) expect(at).toMatch(/^@(container \(min-width:\d+px\)|media \(hover:hover\)|media \(prefers-reduced-motion:no-preference\)|supports selector\(:has\(\*\)\)|keyframes [\w-]+)$/);
  });

  it(`names every class, id and variable in the ${ns}- namespace`, () => {
    for (const r of rules) {
      for (const m of r.selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) expect(m[1].startsWith(`${ns}-`), r.selector).toBe(true);
    }
    for (const m of css.matchAll(/var\(--([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`), m[0]).toBe(true);
  });

  it('one column on phones; from 601px two columns with the right one set lower', () => {
    expect(rule(`.${ns}-grid`)).toContain('grid-template-columns:minmax(0,1fr)');
    expect(rule(`.${ns}-grid`)).toContain('list-style:none');
    expect(rule(`.${ns}-grid`, WIDE)).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    // A margin (layout), not a transform the reveal runtime would override.
    expect(rule(`.${ns}-item:nth-child(even)`, WIDE)).toBe(`margin-top:var(--${ns}-stagger,clamp(56px,8cqi,120px))`);
    expect(css).not.toMatch(/\btransform:\s*translate|\btranslate:/);
    expect(rule(`.${ns}-grid.${ns}-solo`, WIDE)).toBe('grid-template-columns:minmax(0,1fr)');
  });

  it('sizes the photos by aspect ratio from the theme, with phone and wide defaults', () => {
    expect(rule(`.${ns}-photo`)).toContain(`aspect-ratio:var(--${ns}-ratio,4 / 3)`);
    expect(rule(`.${ns}-photo`, WIDE)).toBe(`aspect-ratio:var(--${ns}-ratio-wide,4 / 5)`);
    expect(rule(`.${ns}-solo .${ns}-photo`, WIDE)).toBe(`aspect-ratio:var(--${ns}-ratio-solo,16 / 9)`);
    // Heading font, weight and case come from the theme (template font variables).
    expect(rule(`.${ns}-title`)).toContain(`font-family:var(--${ns}-head,inherit)`);
    expect(rule(`.${ns}-name`)).toContain(`text-transform:var(--${ns}-case,none)`);
  });
});
