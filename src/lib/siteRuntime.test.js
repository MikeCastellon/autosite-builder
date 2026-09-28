import { describe, it, expect } from 'vitest';
import { SITE_RUNTIME_JS, SITE_BASE_CSS } from './siteRuntime.js';

// Just enough DOM to run the runtime in node: elements with attributes,
// classList, closest() and a flat querySelectorAll over known selectors.
function makeEl(tag, attrs = {}, parent = null) {
  const el = {
    tagName: tag.toUpperCase(),
    attrs: { ...attrs },
    parent,
    classes: new Set(),
    textContent: '',
    classList: { add: (c) => el.classes.add(c) },
    setAttribute: (k, v) => { el.attrs[k] = v; },
    removeAttribute: (k) => { delete el.attrs[k]; },
    hasAttribute: (k) => k in el.attrs,
    matches: (sel) => {
      if (sel === 'a') return el.tagName === 'A';
      if (sel === 'details.acg-menu') return el.tagName === 'DETAILS' && el.attrs.class === 'acg-menu';
      return false;
    },
    closest: (sel) => {
      for (let n = el; n; n = n.parent) if (n.matches(sel)) return n;
      return null;
    },
  };
  return el;
}

// Stand-in for the browser's IntersectionObserver: validates options the
// way the real constructor does (it throws RangeError on bad ones) and
// exposes the callback so tests can report intersections.
class FakeIO {
  constructor(cb, opts = {}) {
    const t = [].concat(opts.threshold ?? 0);
    if (t.some((x) => typeof x !== 'number' || !(x >= 0 && x <= 1))) throw new RangeError('threshold must be in [0, 1]');
    const margin = String(opts.rootMargin ?? '0px').trim().split(/\s+/);
    if (margin.length > 4 || margin.some((m) => !/^-?\d+(\.\d+)?(px|%)$/.test(m))) throw new SyntaxError('bad rootMargin');
    this.cb = cb;
    this.observed = [];
    this.unobserved = [];
    FakeIO.last = this;
  }
  observe(el) { this.observed.push(el); }
  unobserve(el) { this.unobserved.push(el); }
  fire(entries) { this.cb(entries, this); }
}

function run({ io = false, scrollY = 0, readyState = 'complete', failSelector = null } = {}) {
  const listeners = {};
  const winListeners = {};
  const html = makeEl('html', {});
  html.className = '';
  const reveal = makeEl('div', { 'data-acg-reveal': '' });
  const reveal2 = makeEl('div', { 'data-acg-reveal': 'fade' });
  const year = makeEl('span', { 'data-acg-year': '' });
  const menu = makeEl('details', { class: 'acg-menu', open: '' });
  const link = makeEl('a', { href: '#about' }, menu);
  const outside = makeEl('p', {});
  const all = [reveal, reveal2, year, menu, link, outside];

  const document = {
    documentElement: html,
    readyState,
    querySelectorAll: (q) => {
      if (q === failSelector) throw new Error(`boom: ${q}`);
      if (q === '[data-acg-reveal]') return all.filter((e) => 'data-acg-reveal' in e.attrs);
      if (q === '[data-acg-year]') return all.filter((e) => 'data-acg-year' in e.attrs);
      if (q === 'details.acg-menu[open]') return all.filter((e) => e.matches('details.acg-menu') && 'open' in e.attrs);
      throw new Error(`unexpected selector ${q}`);
    },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const window = {
    scrollY,
    addEventListener: (type, fn, opts) => { winListeners[type] = { fn, opts }; },
  };
  FakeIO.last = null;
  let IntersectionObserver;
  if (io === true) IntersectionObserver = FakeIO;
  else if (typeof io === 'function') IntersectionObserver = io;
  if (IntersectionObserver) window.IntersectionObserver = IntersectionObserver;
  new Function('document', 'window', 'IntersectionObserver', SITE_RUNTIME_JS)(document, window, IntersectionObserver);
  return { html, reveal, reveal2, year, menu, link, outside, listeners, winListeners, window, document };
}

// The class SITE_BASE_CSS reveals with, so the runtime and CSS can't drift.
const REVEAL_CLASS = SITE_BASE_CSS.match(/\[data-acg-reveal\]\.([\w-]+)\s*\{[^}]*opacity:\s*1/)[1];
const hasJs = (html) => /(^|\s)acg-js(\s|$)/.test(html.className);

describe('SITE_RUNTIME_JS', () => {
  it('stays under 2 KB', () => {
    expect(new TextEncoder().encode(SITE_RUNTIME_JS).length).toBeLessThan(2048);
  });

  it('marks html.acg-js and sets the year', () => {
    const { html, year } = run();
    expect(hasJs(html)).toBe(true);
    expect(year.textContent).toBe(String(new Date().getFullYear()));
  });

  it('reveals everything when IntersectionObserver is missing', () => {
    const { reveal, reveal2 } = run({ io: false });
    expect(reveal.classes.has(REVEAL_CLASS)).toBe(true);
    expect(reveal2.classes.has(REVEAL_CLASS)).toBe(true);
  });

  it('observes reveal targets with options a real IntersectionObserver accepts', () => {
    const { reveal, reveal2 } = run({ io: true });
    expect(FakeIO.last).not.toBeNull();
    expect(FakeIO.last.observed).toEqual([reveal, reveal2]);
    expect(reveal.classes.has(REVEAL_CLASS)).toBe(false);
  });

  it('adds the reveal class only once a target intersects, then stops watching it', () => {
    const { reveal, reveal2 } = run({ io: true });
    FakeIO.last.fire([{ isIntersecting: false, target: reveal }, { isIntersecting: true, target: reveal2 }]);
    expect(reveal.classes.has(REVEAL_CLASS)).toBe(false);
    expect(reveal2.classes.has(REVEAL_CLASS)).toBe(true);
    expect(FakeIO.last.unobserved).toEqual([reveal2]);
    FakeIO.last.fire([{ isIntersecting: true, target: reveal }]);
    expect(reveal.classes.has(REVEAL_CLASS)).toBe(true);
  });

  it('shows every reveal target when the IntersectionObserver constructor throws', () => {
    const Throwing = class { constructor() { throw new RangeError('nope'); } };
    const { html, reveal, reveal2, year } = run({ io: Throwing });
    expect(reveal.classes.has(REVEAL_CLASS)).toBe(true);
    expect(reveal2.classes.has(REVEAL_CLASS)).toBe(true);
    expect(hasJs(html)).toBe(true);
    expect(year.textContent).toBe(String(new Date().getFullYear()));
  });

  it('drops acg-js (so nothing stays hidden) when init fails', () => {
    const { html } = run({ io: true, failSelector: '[data-acg-year]' });
    expect(hasJs(html)).toBe(false);
  });

  it('starts at readyState interactive, before DOMContentLoaded (deferred scripts)', () => {
    const r = run({ io: true, readyState: 'loading' });
    expect(hasJs(r.html)).toBe(true);
    expect(FakeIO.last).toBeNull();
    r.listeners.readystatechange();
    expect(FakeIO.last).toBeNull();
    r.document.readyState = 'interactive';
    r.listeners.readystatechange();
    const io = FakeIO.last;
    expect(io.observed).toEqual([r.reveal, r.reveal2]);
    r.listeners.DOMContentLoaded();
    r.document.readyState = 'complete';
    r.listeners.readystatechange();
    expect(FakeIO.last).toBe(io);
    expect(io.observed).toHaveLength(2);
  });

  it('toggles html[data-acg-scrolled] past 20px with a passive listener', () => {
    const { html, winListeners, window } = run({ scrollY: 0 });
    expect(winListeners.scroll.opts).toEqual({ passive: true });
    expect('data-acg-scrolled' in html.attrs).toBe(false);
    window.scrollY = 120;
    winListeners.scroll.fn();
    expect('data-acg-scrolled' in html.attrs).toBe(true);
    window.scrollY = 5;
    winListeners.scroll.fn();
    expect('data-acg-scrolled' in html.attrs).toBe(false);
  });

  it('closes an open menu on link click, outside click and Escape', () => {
    let r = run();
    r.listeners.click({ target: r.link });
    expect('open' in r.menu.attrs).toBe(false);

    r = run();
    r.listeners.click({ target: r.outside });
    expect('open' in r.menu.attrs).toBe(false);

    r = run();
    r.listeners.keydown({ key: 'Escape' });
    expect('open' in r.menu.attrs).toBe(false);
  });
});

describe('SITE_BASE_CSS', () => {
  it('only hides reveal targets on screens, when JS ran and motion is allowed', () => {
    const block = SITE_BASE_CSS.match(/@media screen and \(prefers-reduced-motion: no-preference\) \{([\s\S]*)\}\s*$/);
    expect(block).not.toBeNull();
    const outside = SITE_BASE_CSS.replace(block[0], '');
    expect(outside).not.toMatch(/opacity|scroll-behavior/);
    for (const rule of block[1].match(/[^{}]+\{[^}]*opacity:\s*0/g) || []) {
      expect(rule).toContain('html.acg-js');
    }
  });
});
