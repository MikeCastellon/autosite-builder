// The Before & After slider behavior, run twice over the same scenarios:
// the published page's SITE_BA_JS (siteRuntime.js, compiled the way the page
// runs it) and its editor twin attachBeforeAfter (beforeAfterPreview.js), so
// the preview and the live site can't drift apart.
import { describe, it, expect } from 'vitest';
import * as espree from 'espree';
import { SITE_BA_JS } from '../../lib/siteRuntime.js';
import { attachBeforeAfter, stepBeforeAfter } from './beforeAfterPreview.js';

// Just enough DOM: attribute selectors ([a], [a],[b]), closest(),
// querySelector() over children, style.setProperty, scroll metrics.
class El {
  constructor(attrs = {}, parent = null) {
    this.attrs = { ...attrs };
    this.parentNode = parent;
    this.children = [];
    this.text = '';
    this.scrollLeft = 0;
    this.clientWidth = 0;
    const props = {};
    this.style = { props, setProperty: (k, v) => { props[k] = v; } };
    if (parent) parent.children.push(this);
  }
  hasAttribute(k) { return k in this.attrs; }
  get textContent() { return this.text; }
  set textContent(v) { this.text = String(v); }
  matches(sel) {
    return sel.split(',').some((s) => {
      const m = s.trim().match(/^\[([\w-]+)\]$/);
      if (!m) throw new Error(`unexpected selector ${sel}`);
      return this.hasAttribute(m[1]);
    });
  }
  closest(sel) {
    for (let n = this; n; n = n.parentNode) if (n.matches(sel)) return n;
    return null;
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (c.matches(sel)) return c;
      const found = c.querySelector(sel);
      if (found) return found;
    }
    return null;
  }
}

// A slider of `pairs` slides, 800px wide, as kit/BeforeAfter.jsx builds it.
function page(pairs = 3) {
  const listeners = [];
  const document = {
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture: Boolean(capture) }),
    removeEventListener: (type, fn, capture) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === Boolean(capture));
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  const section = new El({ 'data-section': 'beforeAfter' });
  const slider = new El({ 'data-acg-ba-slider': '' }, section);
  const track = new El({ 'data-acg-ba-track': '' }, slider);
  track.clientWidth = 800;
  const figures = [];
  const ranges = [];
  for (let i = 0; i < pairs; i++) {
    const slide = new El({ role: 'group' }, track);
    const fig = new El({ 'data-acg-ba': '' }, slide);
    const frame = new El({}, fig);
    figures.push(fig);
    ranges.push(new El({ 'data-acg-ba-range': '' }, frame));
  }
  const nav = new El({}, slider);
  const prev = new El({ 'data-acg-ba-prev': '' }, nav);
  const prevIcon = new El({}, prev);
  const counter = new El({ 'data-acg-ba-count': '' }, nav);
  counter.text = `01 / 0${pairs}`;
  const next = new El({ 'data-acg-ba-next': '' }, nav);
  const nextIcon = new El({}, next);
  const fire = (type, target) => {
    for (const l of [...listeners]) if (l.type === type) l.fn({ target });
  };
  return { document, listeners, track, figures, ranges, prevIcon, nextIcon, counter, fire, other: new El({}, section) };
}

const IMPLEMENTATIONS = [
  ['published SITE_BA_JS', (doc) => { new Function('document', SITE_BA_JS)(doc); }],
  ['editor attachBeforeAfter', (doc) => attachBeforeAfter(doc)],
];

describe.each(IMPLEMENTATIONS)('%s', (_, attach) => {
  it('listens on the document: input, click and scroll (captured, scroll does not bubble)', () => {
    const p = page();
    attach(p.document);
    expect(p.listeners.map((l) => [l.type, l.capture])).toEqual([['input', false], ['click', false], ['scroll', true]]);
  });

  it('moves the divider of the slider\'s own figure as its range moves', () => {
    const p = page();
    attach(p.document);
    p.ranges[1].value = '20';
    p.fire('input', p.ranges[1]);
    expect(p.figures[1].style.props).toEqual({ '--acg-ba': '20%' });
    expect(p.figures[0].style.props).toEqual({});
    p.ranges[1].value = '100';
    p.fire('input', p.ranges[1]);
    expect(p.figures[1].style.props['--acg-ba']).toBe('100%');
    // Other inputs and odd targets are ignored.
    p.fire('input', p.other);
    p.fire('input', null);
    p.fire('input', {});
    expect(p.figures[0].style.props).toEqual({});
  });

  it('steps the track one slide on and back, wrapping round at the ends', () => {
    const p = page(3);
    attach(p.document);
    p.fire('click', p.nextIcon);
    expect(p.track.scrollLeft).toBe(800);
    p.fire('click', p.nextIcon);
    expect(p.track.scrollLeft).toBe(1600);
    p.fire('click', p.nextIcon);
    expect(p.track.scrollLeft).toBe(0);
    p.fire('click', p.prevIcon);
    expect(p.track.scrollLeft).toBe(1600);
    p.fire('click', p.prevIcon);
    expect(p.track.scrollLeft).toBe(800);
    // Mid-swipe, a step goes from the nearest slide.
    p.track.scrollLeft = 1150;
    p.fire('click', p.nextIcon);
    expect(p.track.scrollLeft).toBe(1600);
    p.track.scrollLeft = 1250;
    p.fire('click', p.nextIcon);
    expect(p.track.scrollLeft).toBe(0);
    p.fire('click', p.other);
    p.fire('click', null);
    expect(p.track.scrollLeft).toBe(0);
  });

  it('keeps the counter on the slide in view as the track scrolls', () => {
    const p = page(3);
    attach(p.document);
    for (const [x, text] of [[800, '02 / 03'], [1600, '03 / 03'], [1210, '03 / 03'], [390, '01 / 03'], [0, '01 / 03']]) {
      p.track.scrollLeft = x;
      p.fire('scroll', p.track);
      expect({ x, text: p.counter.text }).toEqual({ x, text });
    }
    // The page's own scroll (target: document) and other scrollers are ignored.
    p.counter.text = 'kept';
    p.fire('scroll', p.document);
    p.fire('scroll', p.other);
    expect(p.counter.text).toBe('kept');
  });

  it('does nothing while the track has no width (not laid out yet)', () => {
    const p = page(2);
    attach(p.document);
    p.track.clientWidth = 0;
    p.fire('click', p.nextIcon);
    p.fire('scroll', p.track);
    expect(p.track.scrollLeft).toBe(0);
    expect(p.counter.text).toBe('01 / 02');
  });
});

describe('SITE_BA_JS', () => {
  it('parses as ES5 and stays small', () => {
    expect(() => espree.parse(SITE_BA_JS, { ecmaVersion: 5, sourceType: 'script' })).not.toThrow();
    expect(new TextEncoder().encode(SITE_BA_JS).length).toBeLessThan(1024);
  });
});

describe('attachBeforeAfter', () => {
  it('stops listening once detached, and tolerates a missing document', () => {
    const p = page();
    const detach = attachBeforeAfter(p.document);
    expect(p.listeners).toHaveLength(3);
    detach();
    expect(p.listeners).toHaveLength(0);
    expect(() => attachBeforeAfter(null)()).not.toThrow();
    expect(() => stepBeforeAfter(null, 1)).not.toThrow();
  });
});
