import { describe, it, expect } from 'vitest';
// espree (ES5 parse check below) is not in package.json: this resolves to
// the copy eslint ^9 brings in (hoisted, 10.x in package-lock.json). If an
// eslint change moves or drops it, this import fails with "Cannot find
// package 'espree'"; add "espree": "^10.4.0" to devDependencies then (an
// npm install on the Windows machine, never in this repo).
import * as espree from 'espree';
import { SITE_RUNTIME_JS, SITE_BASE_CSS, CQ_REWRITE_FN, SITE_CQ_FALLBACK_JS } from './siteRuntime.js';

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

// The shipped source text, compiled the way the page runs it.
const rewrite = new Function(`return (${CQ_REWRITE_FN});`)();

describe('CQ_REWRITE_FN (container queries -> viewport media queries)', () => {
  const cq = (css) => rewrite(css, true, false);
  const clip = (css) => rewrite(css, false, true);

  it('turns @container rules into @media rules, with or without a space or name', () => {
    expect(cq('@container (max-width:600px){.a{b:c}}')).toBe('@media (max-width:600px){.a{b:c}}');
    expect(cq('@container(max-width:600px){.a{b:c}}')).toBe('@media (max-width:600px){.a{b:c}}');
    expect(cq('@container (max-width: 600px) {.a{b:c}}')).toBe('@media (max-width: 600px){.a{b:c}}');
    expect(cq('@container card (min-width: 400px) {x{y:z}}')).toBe('@media (min-width: 400px){x{y:z}}');
    expect(cq('@CONTAINER (min-width:1px){}')).toBe('@media (min-width:1px){}');
  });

  it('rewrites every rule in a sheet, nested ones included', () => {
    const css = '.a{b:c}@container (max-width:900px){.a{d:e}}\n@container (min-width:901px){@supports selector(:has(*)){.a{f:g}}}@media (hover:hover){@container (max-width:600px){.a:hover{h:i}}}';
    expect(cq(css)).toBe('.a{b:c}@media (max-width:900px){.a{d:e}}\n@media (min-width:901px){@supports selector(:has(*)){.a{f:g}}}@media (hover:hover){@media (max-width:600px){.a:hover{h:i}}}');
  });

  it('keeps and-conditions and nested parentheses intact', () => {
    expect(cq('@container sidebar (min-width: 400px) and (max-width: 800px) {x{y:z}}'))
      .toBe('@media (min-width: 400px) and (max-width: 800px){x{y:z}}');
    expect(cq('@container (min-width: calc(600px + 2em)) and (orientation: portrait){}'))
      .toBe('@media (min-width: calc(600px + 2em)) and (orientation: portrait){}');
  });

  it('spells "or" and "not" the way pre-Media-Queries-4 engines read them', () => {
    expect(cq('@container (max-width:400px) or (min-width:900px){}')).toBe('@media (max-width:400px), (min-width:900px){}');
    expect(cq('@container not (max-width:600px){}')).toBe('@media not all and (max-width:600px){}');
    expect(cq('@container card not (max-width:600px){}')).toBe('@media not all and (max-width:600px){}');
  });

  it('maps container size features to viewport ones and leaves style() queries alone', () => {
    expect(cq('@container (min-inline-size: 400px) and (max-block-size: 90px){}'))
      .toBe('@media (min-width: 400px) and (max-height: 90px){}');
    expect(cq('@container style(--dark: 1){.a{b:c}}')).toBe('@container style(--dark: 1){.a{b:c}}');
    expect(cq('@container card scroll-state(stuck: top){}')).toBe('@container card scroll-state(stuck: top){}');
  });

  it('turns container units after a number into viewport units', () => {
    expect(cq('.a{padding:clamp(20px,5cqi,48px) .5cqw -2.5cqh 10CQB;margin:3cqmin 4cqmax 1e1cqi}'))
      .toBe('.a{padding:clamp(20px,5vw,48px) .5vw -2.5vh 10vh;margin:3vmin 4vmax 1e1vw}');
    expect(cq('.a{padding-left:max(var(--g),calc((100cqi - 1280px) / 2 + var(--g)))}'))
      .toBe('.a{padding-left:max(var(--g),calc((100vw - 1280px) / 2 + var(--g)))}');
    // Inline style attributes too (custom properties keep their value as written).
    expect(cq("--mc-gutter:clamp(20px, 5cqi, 48px);font-family:'Inter', sans-serif")).toBe("--mc-gutter:clamp(20px, 5vw, 48px);font-family:'Inter', sans-serif");
  });

  it('never touches identifiers, escaped selectors, strings, comments or url()', () => {
    const untouched = [
      '.a5cqi{x:y}', '.x-5cqw{x:y}', '#b5cqh{x:y}', '--k-5cqi:1px', '.w-\\[5cqi\\]{x:y}',
      'a{content:"5cqi @container (x){"}', "b{content:'5cqw'}", 'c{background:url(a-5cqi.png)}',
      'd{background:url("x 5cqi)")}', '/* 5cqi @container (max-width:1px){ */',
      '@container-styled x{}', '@containers (x){}', 'e{text-overflow:clip}',
    ];
    for (const css of untouched) expect(rewrite(css, true, true), css).toBe(css);
    expect(cq('.w-\\[5cqi\\]{width:5cqi}')).toBe('.w-\\[5cqi\\]{width:5vw}');
    expect(cq('a{content:"@container (max-width:1px){"}/* 5cqi */b{w:5cqi}')).toBe('a{content:"@container (max-width:1px){"}/* 5cqi */b{w:5vw}');
  });

  it('turns two-axis overflow:clip into hidden only when asked', () => {
    expect(clip('.a{overflow:clip}.b{overflow: clip !important}.c{overflow:clip;color:red}'))
      .toBe('.a{overflow:hidden}.b{overflow: hidden !important}.c{overflow:hidden;color:red}');
    // One axis hidden would make the other axis a scroller; two values stay as written.
    for (const css of ['.c{overflow-x:clip}', '.d{overflow-y:clip}', '.e{overflow:clip visible}', '.f{text-overflow:clip}']) expect(clip(css)).toBe(css);
    expect(cq('.a{overflow:clip}')).toBe('.a{overflow:clip}');
  });

  it('is a no-op with nothing to do, and idempotent', () => {
    const css = '@container (max-width:600px){.a{padding:5cqi;overflow:clip}}';
    expect(rewrite(css, false, false)).toBe(css);
    const once = rewrite(css, true, true);
    expect(once).toBe('@media (max-width:600px){.a{padding:5vw;overflow:hidden}}');
    expect(rewrite(once, true, true)).toBe(once);
  });
});

// A DOM just big enough for the fallback: a tree with parentNode /
// nextSibling, style text and style attributes, getElementsByTagName and the
// one attribute selector it queries. writes counts DOM writes.
class El {
  constructor(tag, attrs = {}, text = '') {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.childNodes = [];
    this.parentNode = null;
    this.text = text;
    this.writes = 0;
  }
  get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] || null : null; }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() { return this.text; }
  set textContent(v) { this.text = String(v); this.writes++; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); this.writes++; }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  all() { return this.childNodes.flatMap((c) => [c, ...c.all()]); }
  getElementsByTagName(t) { return this.all().filter((n) => n.tagName === t.toUpperCase()); }
  querySelectorAll(q) {
    if (q !== '[style*="cq"],[style*="clip"]') throw new Error(`unexpected selector ${q}`);
    return this.all().filter((n) => /cq|clip/.test(n.attrs.style || ''));
  }
}

// Records mutations like a MutationObserver; tick() is a microtask checkpoint.
class FakeMO {
  constructor(cb) { this.cb = cb; this.queue = []; this.disconnected = false; FakeMO.last = this; }
  observe(target, opts) { this.target = target; this.opts = opts; }
  takeRecords() { const q = this.queue; this.queue = []; return q; }
  disconnect() { this.disconnected = true; }
}

const TEMPLATE_CSS = '.xx-nav{display:flex}@container (max-width:600px){.xx-links{display:none}}.xx-hero{padding:8cqi 0;overflow:clip}';
const ROOT_STYLE = '--xx-gutter:clamp(20px, 5cqi, 48px);container-type:inline-size;overflow-x:clip';

function fallback({ supports = () => true, css = true, mo = true, readyState = 'loading', before = null } = {}) {
  const listeners = {};
  const html = new El('html');
  const head = html.appendChild(new El('head'));
  if (before) before(html);
  const document = {
    documentElement: html,
    head,
    readyState,
    createElement: (t) => new El(t),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    getElementsByTagName: (t) => html.getElementsByTagName(t),
    querySelectorAll: (q) => html.querySelectorAll(q),
  };
  const calls = [];
  const window = {};
  if (css) window.CSS = { supports: (...a) => { calls.push(a); return supports(...a); } };
  FakeMO.last = null;
  if (mo) window.MutationObserver = FakeMO;
  new Function('document', 'window', SITE_CQ_FALLBACK_JS)(document, window);
  const observer = FakeMO.last;
  // The parser inserting a node: queue a record, the way the observer sees it.
  const insert = (parent, node, { record = true } = {}) => {
    parent.appendChild(node);
    if (record && observer && !observer.disconnected) observer.queue.push({ addedNodes: [node] });
    return node;
  };
  const tick = () => { if (observer && !observer.disconnected) observer.cb(observer.takeRecords()); };
  const finish = (state = 'interactive') => { document.readyState = state; if (listeners.readystatechange) listeners.readystatechange(); };
  return { html, head, document, listeners, calls, observer, insert, tick, finish };
}

// Parses <body><div root style><style>TEMPLATE_CSS</style><nav/></div></body>
// in two parser chunks, like a browser that yields after the <style> text.
function parsePage(f, opts) {
  const body = f.insert(f.html, new El('body'), opts);
  const root = f.insert(body, new El('div', { style: ROOT_STYLE }), opts);
  const sheet = f.insert(root, new El('style', {}, TEMPLATE_CSS), opts);
  f.tick();
  const textWhileOpen = sheet.text;
  f.insert(root, new El('nav'), opts);
  f.tick();
  return { body, root, sheet, textWhileOpen };
}

describe('SITE_CQ_FALLBACK_JS', () => {
  const noCq = (p) => p !== 'container-type';

  it('parses as ES5, like the runtime (old browsers must run it)', () => {
    for (const src of [SITE_CQ_FALLBACK_JS, SITE_RUNTIME_JS]) {
      expect(() => espree.parse(src, { ecmaVersion: 5, sourceType: 'script' })).not.toThrow();
    }
  });

  it('stays under 3 KB', () => {
    expect(new TextEncoder().encode(SITE_CQ_FALLBACK_JS).length).toBeLessThan(3072);
  });

  it('does nothing where container queries and overflow:clip work', () => {
    const f = fallback();
    expect(f.calls).toEqual([['container-type', 'inline-size'], ['overflow-x', 'clip']]);
    expect(f.observer).toBeNull();
    expect(f.listeners).toEqual({});
    expect(f.head.childNodes).toEqual([]);
    const { root, sheet } = parsePage(f);
    f.finish();
    expect(sheet.text).toBe(TEMPLATE_CSS);
    expect(root.attrs.style).toBe(ROOT_STYLE);
    expect(sheet.writes + root.writes).toBe(0);
  });

  it('rewrites a <style> once the parser has closed it, and style attributes as they arrive', () => {
    // Chrome 90-104 / Firefox 81-109: overflow:clip works, container queries don't.
    const f = fallback({ supports: noCq });
    expect(f.observer.target).toBe(f.html);
    expect(f.observer.opts).toEqual({ childList: true, subtree: true });
    const { root, sheet, textWhileOpen } = parsePage(f);
    expect(textWhileOpen).toBe(TEMPLATE_CSS);
    expect(sheet.text).toBe('.xx-nav{display:flex}@media (max-width:600px){.xx-links{display:none}}.xx-hero{padding:8vw 0;overflow:clip}');
    expect(sheet.writes).toBe(1);
    expect(root.attrs.style).toBe('--xx-gutter:clamp(20px, 5vw, 48px);container-type:inline-size;overflow-x:clip');
    // overflow:clip works here: no viewport clipping added.
    expect(f.head.childNodes).toEqual([]);
    f.finish();
    expect(f.observer.disconnected).toBe(true);
    expect(sheet.writes).toBe(1);
  });

  it('without overflow:clip, clips sideways at <body> only and turns overflow:clip into hidden', () => {
    // No CSS.supports at all (Safari 15 has it, but says no to both).
    const f = fallback({ css: false });
    expect(f.head.childNodes.map((n) => [n.tagName, n.text])).toEqual([['STYLE', 'body{overflow-x:hidden}']]);
    const { root, sheet } = parsePage(f);
    expect(sheet.text).toBe('.xx-nav{display:flex}@media (max-width:600px){.xx-links{display:none}}.xx-hero{padding:8vw 0;overflow:hidden}');
    // The root keeps overflow-x:clip: hidden there would break the sticky nav and action bar.
    expect(root.attrs.style).toBe('--xx-gutter:clamp(20px, 5vw, 48px);container-type:inline-size;overflow-x:clip');
    f.finish();
    expect(f.head.childNodes[0].text).toBe('body{overflow-x:hidden}');
  });

  it('sweeps whatever the observer missed at readyState interactive, then stops', () => {
    const f = fallback({ supports: noCq });
    const { root, sheet } = parsePage(f, { record: false });
    expect(sheet.text).toBe(TEMPLATE_CSS);
    f.finish('loading');
    expect(sheet.text).toBe(TEMPLATE_CSS);
    f.finish('interactive');
    expect(sheet.text).toContain('@media (max-width:600px)');
    expect(root.attrs.style).toContain('5vw');
    expect(f.observer.disconnected).toBe(true);
    f.listeners.DOMContentLoaded();
    expect(sheet.writes).toBe(1);
  });

  it('works without MutationObserver, and when started after parsing', () => {
    let f = fallback({ supports: noCq, mo: false });
    const page = parsePage(f);
    expect(page.sheet.text).toBe(TEMPLATE_CSS);
    f.finish();
    expect(page.sheet.text).toContain('@media (max-width:600px)');

    let sheet = null;
    f = fallback({
      supports: noCq,
      readyState: 'complete',
      before: (html) => { sheet = html.appendChild(new El('body')).appendChild(new El('style', {}, TEMPLATE_CSS)); },
    });
    expect(sheet.text).toContain('@media (max-width:600px)');
    expect(f.observer.disconnected).toBe(true);
  });

  it('fails open', () => {
    // CSS.supports throwing: leave the page alone.
    let f = fallback({ supports: () => { throw new Error('nope'); } });
    expect(f.observer).toBeNull();
    expect(f.head.childNodes).toEqual([]);

    // One element failing leaves that element as parsed and the rest rewritten.
    f = fallback({ supports: noCq });
    const body = f.insert(f.html, new El('body'));
    const bad = f.insert(body, new El('style', {}, TEMPLATE_CSS));
    Object.defineProperty(bad, 'textContent', { get: () => TEMPLATE_CSS, set: () => { throw new Error('read-only'); } });
    const badAttr = f.insert(body, new El('div', { style: ROOT_STYLE }));
    badAttr.getAttribute = () => { throw new Error('boom'); };
    const good = f.insert(body, new El('style', {}, TEMPLATE_CSS));
    f.insert(body, new El('footer'));
    expect(() => { f.tick(); f.finish(); }).not.toThrow();
    expect(good.text).toContain('@media (max-width:600px)');
    expect(badAttr.attrs.style).toBe(ROOT_STYLE);
  });
});
