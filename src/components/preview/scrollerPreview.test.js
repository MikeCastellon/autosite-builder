// The scroller prev/next behavior, run twice over the same scenarios: the
// published page's SITE_SCROLL_JS (siteRuntime.js, compiled the way the page
// runs it) and its editor twin attachScrollers (scrollerPreview.js), so the
// preview and the live site can't drift apart.
import { describe, it, expect } from 'vitest';
import * as espree from 'espree';
import { SITE_SCROLL_JS } from '../../lib/siteRuntime.js';
import { attachScrollers, stepScroller } from './scrollerPreview.js';

// Just enough DOM: tag + attribute selectors (button[a]), closest(),
// getAttribute(), getElementById() and the scroll/offset metrics a browser
// reports. scrollLeft is a plain field (no clamping), so every assignment
// is checked exactly as the code computed it.
class El {
  constructor(tag, attrs = {}, parent = null) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.parentNode = parent;
    this.children = [];
    this.offsetLeft = 0;
    this.scrollLeft = 0;
    this.scrollWidth = 0;
    this.clientWidth = 0;
    if (parent) parent.children.push(this);
  }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  matches(sel) {
    const m = sel.match(/^([a-z]*)\[([\w-]+)\]$/);
    if (!m) throw new Error(`unexpected selector ${sel}`);
    return (!m[1] || this.tagName === m[1].toUpperCase()) && this.hasAttribute(m[2]);
  }
  closest(sel) {
    for (let n = this; n; n = n.parentNode) if (n.matches(sel)) return n;
    return null;
  }
}

function page() {
  const listeners = [];
  const ids = new Map();
  const document = {
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture: Boolean(capture) }),
    removeEventListener: (type, fn, capture) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === Boolean(capture));
      if (i >= 0) listeners.splice(i, 1);
    },
    getElementById: (id) => ids.get(id) || null,
  };
  const body = new El('main');
  // A row of `cards` cards `card` px wide with `gap` between them, in a
  // track `width` px wide whose padding puts the first card at `pad` (so
  // only the difference of two offsets is the pitch), plus its prev/next
  // buttons with an icon inside each.
  const scroller = (id, { cards = 5, card = 280, gap = 20, width = 800, pad = 24 } = {}) => {
    const section = new El('section', { 'data-section': 'testimonials' }, body);
    const track = new El('div', { id }, section);
    ids.set(id, track);
    for (let i = 0; i < cards; i++) new El('article', {}, track).offsetLeft = pad + i * (card + gap);
    track.clientWidth = width;
    track.scrollWidth = Math.max(width, pad * 2 + cards * card + (cards - 1) * gap);
    const button = (dir) => {
      const b = new El('button', { type: 'button', 'data-acg-scroll': dir, 'aria-controls': id, 'aria-label': dir }, section);
      return { button: b, icon: new El('svg', {}, b) };
    };
    return { track, prev: button('prev'), next: button('next') };
  };
  const fire = (target) => {
    for (const l of [...listeners]) if (l.type === 'click') l.fn({ target });
  };
  return { document, listeners, body, scroller, fire };
}

const IMPLEMENTATIONS = [
  ['published SITE_SCROLL_JS', (doc) => { new Function('document', SITE_SCROLL_JS)(doc); }],
  ['editor attachScrollers', (doc) => attachScrollers(doc)],
];

describe.each(IMPLEMENTATIONS)('%s', (_, attach) => {
  it('listens for clicks on the document only (delegation, no init)', () => {
    const p = page();
    attach(p.document);
    expect(p.listeners.map((l) => [l.type, l.capture])).toEqual([['click', false]]);
  });

  it('next steps one card pitch and wraps from the end back to the start', () => {
    const p = page();
    // 5 cards at a 300px pitch: 1,528px of row (24px padding each side) in
    // an 800px track, so the last position is 728 (not a multiple of the
    // pitch).
    const s = p.scroller('rev');
    attach(p.document);
    const seen = [];
    for (let i = 0; i < 5; i++) {
      p.fire(s.next.icon);
      seen.push(s.track.scrollLeft);
    }
    expect(seen).toEqual([300, 600, 728, 0, 300]);
    // A click on the button itself works the same as one on its icon.
    p.fire(s.next.button);
    expect(s.track.scrollLeft).toBe(600);
  });

  it('prev from the start goes to the end, then back one card at a time', () => {
    const p = page();
    const s = p.scroller('rev');
    attach(p.document);
    const seen = [];
    for (let i = 0; i < 5; i++) {
      p.fire(s.prev.icon);
      seen.push(s.track.scrollLeft);
    }
    // From the end (728) the nearest card is the one at 600, so back is 300.
    expect(seen).toEqual([728, 300, 0, 728, 300]);
  });

  it('steps from the nearest card mid-swipe, never wrapping from there', () => {
    const p = page();
    const s = p.scroller('rev');
    attach(p.document);
    for (const [from, dir, to] of [
      [420, 'next', 600], [470, 'next', 728], [726.5, 'next', 728],
      [470, 'prev', 300], [420, 'prev', 0], [140, 'prev', 0], [0.5, 'prev', 728],
      [727.5, 'next', 0],
    ]) {
      s.track.scrollLeft = from;
      p.fire(s[dir].icon);
      expect({ from, dir, to: s.track.scrollLeft }).toEqual({ from, dir, to });
    }
  });

  it('with one child, steps by the track width', () => {
    const p = page();
    const s = p.scroller('wide', { cards: 1, card: 2400, gap: 0, width: 800, pad: 0 });
    attach(p.document);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      p.fire(s.next.icon);
      seen.push(s.track.scrollLeft);
    }
    expect(seen).toEqual([800, 1600, 0]);
    p.fire(s.prev.icon);
    expect(s.track.scrollLeft).toBe(1600);
  });

  it('moves only the track its button controls', () => {
    const p = page();
    const a = p.scroller('a');
    const b = p.scroller('b');
    attach(p.document);
    p.fire(b.next.icon);
    expect([a.track.scrollLeft, b.track.scrollLeft]).toEqual([0, 300]);
    p.fire(a.prev.icon);
    expect([a.track.scrollLeft, b.track.scrollLeft]).toEqual([728, 300]);
  });

  it('ignores odd targets, clicks outside the buttons and ids that resolve to nothing', () => {
    const p = page();
    const s = p.scroller('rev');
    attach(p.document);
    s.track.scrollLeft = 300;
    const stray = (attrs, tag = 'button') => new El(tag, attrs, p.body);
    for (const target of [
      null, {}, { closest: null }, s.track, s.track.children[2], p.body,
      stray({ 'data-acg-scroll': 'next', 'aria-controls': 'missing' }),
      stray({ 'data-acg-scroll': 'next' }),
      stray({ 'data-acg-scroll': 'next', 'aria-controls': '' }),
      stray({ 'data-acg-scroll': 'first', 'aria-controls': 'rev' }),
      stray({ 'data-acg-scroll': '', 'aria-controls': 'rev' }),
      // The contract is a <button>: other elements are not buttons for it.
      stray({ 'data-acg-scroll': 'next', 'aria-controls': 'rev' }, 'div'),
    ]) {
      expect(() => p.fire(target)).not.toThrow();
    }
    expect(s.track.scrollLeft).toBe(300);
  });

  it('does nothing while the track does not overflow, is not laid out or has no pitch', () => {
    const p = page();
    // Fits: 2 cards in a wide track.
    const fits = p.scroller('fits', { cards: 2, width: 1200 });
    // Not laid out yet (display:none, or before layout): every metric is 0.
    const hidden = p.scroller('hidden');
    hidden.track.clientWidth = 0;
    hidden.track.scrollWidth = 0;
    for (const c of hidden.track.children) c.offsetLeft = 0;
    // Overflows, but its first two cards sit on top of each other.
    const stacked = p.scroller('stacked');
    for (const c of stacked.track.children) c.offsetLeft = 24;
    // A single child with no width.
    const empty = p.scroller('empty', { cards: 1, card: 0, width: 0, pad: 0 });
    attach(p.document);
    for (const s of [fits, hidden, stacked, empty]) {
      p.fire(s.next.icon);
      p.fire(s.prev.icon);
      expect(s.track.scrollLeft).toBe(0);
    }
    expect(fits.track.scrollWidth).toBe(fits.track.clientWidth);
  });
});

describe('SITE_SCROLL_JS', () => {
  it('parses as ES5 and stays under 1 KB', () => {
    expect(() => espree.parse(SITE_SCROLL_JS, { ecmaVersion: 5, sourceType: 'script' })).not.toThrow();
    expect(new TextEncoder().encode(SITE_SCROLL_JS).length).toBeLessThan(1024);
  });

  it('sets scrollLeft and never calls scrollBy / scrollTo, so the track\'s CSS scroll-behavior decides', () => {
    expect(SITE_SCROLL_JS).toContain('.scrollLeft=');
    expect(SITE_SCROLL_JS).not.toMatch(/scrollBy|scrollTo|behavior/);
  });
});

describe('attachScrollers', () => {
  it('stops listening once detached, and tolerates a missing document', () => {
    const p = page();
    const s = p.scroller('rev');
    const detach = attachScrollers(p.document);
    expect(p.listeners).toHaveLength(1);
    detach();
    expect(p.listeners).toHaveLength(0);
    p.fire(s.next.icon);
    expect(s.track.scrollLeft).toBe(0);
    expect(() => attachScrollers(null)()).not.toThrow();
    expect(() => attachScrollers({})()).not.toThrow();
    expect(() => stepScroller(null, 1)).not.toThrow();
    stepScroller(s.track, 0);
    expect(s.track.scrollLeft).toBe(0);
    stepScroller(s.track, 1);
    expect(s.track.scrollLeft).toBe(300);
  });
});
