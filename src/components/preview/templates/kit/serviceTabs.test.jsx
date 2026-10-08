// The service tabs (kit/serviceTabs.js + kit/ServiceTabs.jsx): grouping by
// category (both service shapes, loose matching, first-seen order, the
// "Other" group), the opt-in switch and its limits, the tabs' markup (the
// radios first, then the bar of labels, then one panel per group, in order)
// and, through a small CSS matcher run over that markup, what a page shows
// with no script at all: the checked radio's panel and only it, its tab
// marked, a focused radio's tab ringed, "All" showing every group. Then
// serviceTabsCss's theme-contract hygiene, as blocks.test.jsx checks the
// other blocks.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceTabs, ServiceTabsBar, ServiceTabsPanels, serviceTabsCss, serviceTabLabel, SERVICE_TABS_LABELS } from './ServiceTabs.jsx';
import {
  SERVICE_TABS_MAX_GROUPS, SERVICE_CATEGORY_MAX, SERVICE_TABS_HINTS,
  serviceCategoryOf, categoryKey, serviceGroups, serviceTabsWanted, serviceTabsStatus, serviceTabsOf,
} from './serviceTabs.js';
import { EditorModeProvider } from './EditorMode.jsx';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';

const ON = { enabled: true };
// Walt's-style services: two kinds in mixed order and spelling, one plain
// string (no category).
const SVC = [
  { name: 'Exterior Wash', price: '$60', category: 'Cars' },
  { name: 'Interior Detailing', price: '$120', category: 'Cars' },
  { name: 'Boat Wash & Wax', price: '$15/ft', category: 'Boats' },
  { name: 'RV Wash', category: 'RVs' },
  { name: 'Hull Oxidation Removal', category: ' boats ' },
  { name: 'Driveway Cleaning', category: 'Pressure Washing' },
  { name: 'House Wash', category: 'pressure-washing' },
  'Hand Wax',
];
const html = (el, editor = false) => renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
// The template's cards for a group, as a render prop would draw them.
const cards = (g) => <ul className="xx-st-cards">{g.items.map(({ service, index }) => <li key={index} className="xx-st-card">{typeof service === 'string' ? service : service.name}</li>)}</ul>;
const tabsHtml = (tabs, props = {}) => html(<ServiceTabs ns="xx-st" tabs={tabs} {...props}>{cards}</ServiceTabs>);

// ---- A small reader for renderToStaticMarkup output: { tag, attrs, children, parent }.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function parseHtml(markup) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  for (const m of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g)) {
    if (m[5] !== undefined) { cur.children.push({ text: m[5], parent: cur }); continue; }
    if (m[1]) { cur = cur.parent; continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? '';
    const el = { tag: m[2].toLowerCase(), attrs, children: [], parent: cur };
    cur.children.push(el);
    if (!m[4] && !VOID.has(el.tag)) cur = el;
  }
  return root;
}
const kids = (el) => el.children.filter((c) => c.tag);
const classes = (el) => (el.attrs.class || '').split(' ').filter(Boolean);
// Text as a reader sees it (React escapes &, <, >, " and ' in text).
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const text = (el) => el.children.map((c) => (c.tag ? text(c) : decode(c.text))).join('');
function all(el, pred, out = []) {
  for (const c of kids(el)) { if (pred(c)) out.push(c); all(c, pred, out); }
  return out;
}
const byClass = (root, c) => all(root, (el) => classes(el).includes(c));

// ---- A small CSS matcher for the selectors serviceTabsCss writes: compounds
// of tag, #id, .class, :checked, :focus-visible, :not(x), :has(>x), joined
// by '>', '~', '+' or a space. state = { checked: radio id, focus: radio id }.
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
function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(buf); buf = ''; } else buf += ch;
  }
  out.push(buf);
  return out.map((x) => x.trim()).filter(Boolean);
}
function parseCompound(s) {
  const c = { tag: null, ids: [], classes: [], pseudos: [] };
  let i = 0;
  const ident = () => {
    const m = /^-?[_a-zA-Z][\w-]*/.exec(s.slice(i));
    if (!m) throw new Error(`cannot read "${s}"`);
    i += m[0].length;
    return m[0];
  };
  if (/[a-z]/i.test(s[0])) c.tag = ident().toLowerCase();
  while (i < s.length) {
    const ch = s[i++];
    if (ch === '#') c.ids.push(ident());
    else if (ch === '.') c.classes.push(ident());
    else if (ch === ':') {
      const name = ident();
      if (s[i] === '(') {
        let d = 0;
        let j = i;
        for (; j < s.length; j++) { if (s[j] === '(') d++; if (s[j] === ')' && --d === 0) break; }
        c.pseudos.push({ name, arg: s.slice(i + 1, j) });
        i = j + 1;
      } else c.pseudos.push({ name });
    } else throw new Error(`cannot read "${s}"`);
  }
  return c;
}
function parseSelector(sel) {
  const parts = [];
  let depth = 0;
  let buf = '';
  const flush = () => { if (buf) { parts.push(parseCompound(buf)); buf = ''; } };
  for (const ch of sel.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && '>~+ '.includes(ch)) {
      flush();
      const last = parts[parts.length - 1];
      if (ch === ' ') { if (last && typeof last !== 'string') parts.push(' '); }
      else if (last === ' ') parts[parts.length - 1] = ch;
      else parts.push(ch);
      continue;
    }
    buf += ch;
  }
  flush();
  return parts;
}
function matchCompound(el, c, state) {
  if (c.tag && el.tag !== c.tag) return false;
  if (c.ids.some((id) => el.attrs.id !== id)) return false;
  if (c.classes.some((k) => !classes(el).includes(k))) return false;
  return c.pseudos.every((ps) => {
    if (ps.name === 'checked') return el.tag === 'input' && state.checked === el.attrs.id;
    if (ps.name === 'focus-visible') return state.focus === el.attrs.id;
    if (ps.name === 'not') return !matches(el, ps.arg, state);
    if (ps.name === 'has') {
      const arg = ps.arg.trim();
      return arg.startsWith('>') ? kids(el).some((k) => matches(k, arg.slice(1), state)) : all(el, (d) => matches(d, arg, state)).length > 0;
    }
    throw new Error(`no matcher for :${ps.name}`);
  });
}
function matchParts(el, parts, i, state) {
  if (!el || !el.tag || el.tag === '#root' || !matchCompound(el, parts[i], state)) return false;
  if (i === 0) return true;
  const comb = parts[i - 1];
  const sibs = kids(el.parent);
  const before = sibs.slice(0, sibs.indexOf(el));
  if (comb === '>') return matchParts(el.parent, parts, i - 2, state);
  if (comb === '+') return matchParts(before[before.length - 1], parts, i - 2, state);
  if (comb === '~') return before.some((s) => matchParts(s, parts, i - 2, state));
  for (let a = el.parent; a && a.tag !== '#root'; a = a.parent) if (matchParts(a, parts, i - 2, state)) return true;
  return false;
}
function matches(el, selector, state) {
  return splitTop(selector, ',').some((sel) => { const parts = parseSelector(sel); return matchParts(el, parts, parts.length - 1, state); });
}
function specificity(sel) {
  const s = [0, 0, 0];
  for (const c of parseSelector(sel)) {
    if (typeof c === 'string') continue;
    s[0] += c.ids.length;
    s[1] += c.classes.length;
    s[2] += c.tag ? 1 : 0;
    for (const ps of c.pseudos) {
      if (ps.name === 'not' || ps.name === 'has') {
        const inner = splitTop(ps.arg.replace(/^\s*>/, ''), ',').map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
        for (let k = 0; k < 3; k++) s[k] += inner[k];
      } else s[1] += 1;
    }
  }
  return s;
}
// The value `prop` gets on `el` from the rules that apply without a viewport
// (top level and @supports selector(:has(*)), which current browsers pass).
function computed(rules, el, prop, state) {
  let best = null;
  rules.forEach((r, order) => {
    if (!r.at.every((a) => a.startsWith('@supports'))) return;
    const decl = r.body.split(';').map((d) => d.split(':')).find(([k]) => k.trim() === prop);
    if (!decl) return;
    for (const sel of splitTop(r.selector, ',')) {
      const parts = parseSelector(sel);
      if (!matchParts(el, parts, parts.length - 1, state)) continue;
      const sp = specificity(sel);
      const better = !best || sp[0] - best.sp[0] || sp[1] - best.sp[1] || sp[2] - best.sp[2] || order - best.order;
      if (better === true || better > 0) best = { sp, order, value: decl.slice(1).join(':').trim() };
    }
  });
  return best?.value;
}

describe('serviceCategoryOf / categoryKey', () => {
  it('reads a category only from a service object, on one line, at most 30 characters', () => {
    expect(SERVICE_CATEGORY_MAX).toBe(30);
    expect(serviceCategoryOf('Hand Wax')).toBe('');
    for (const v of [null, undefined, 42, true, [], [{ category: 'Cars' }]]) expect(serviceCategoryOf(v)).toBe('');
    expect(serviceCategoryOf({ name: 'x' })).toBe('');
    for (const c of [null, {}, ['Cars'], true]) expect(serviceCategoryOf({ category: c })).toBe('');
    expect(serviceCategoryOf({ category: '  Pressure \n Washing ' })).toBe('Pressure Washing');
    expect(serviceCategoryOf({ category: 2024 })).toBe('2024');
    const long = serviceCategoryOf({ category: 'Motorcycles, Scooters and Other Two Wheelers' });
    expect(long).toBe('Motorcycles, Scooters and');
    expect(long.length).toBeLessThanOrEqual(30);
  });

  it('compares categories loosely: case, spaces and punctuation ignored, any script', () => {
    expect(categoryKey('RVs')).toBe(categoryKey("rv's"));
    expect(categoryKey(' RVs ')).toBe('rvs');
    expect(categoryKey('Pressure Washing')).toBe(categoryKey('pressure-washing'));
    expect(categoryKey('Lavado de Autos')).toBe('lavadodeautos');
    expect(categoryKey('Детейлинг')).toBe('детейлинг');
    for (const v of ['', '—', ' - ', null, undefined]) expect(categoryKey(v)).toBe('');
  });
});

describe('serviceGroups', () => {
  it('groups in first-seen order, labelled as first written, the uncategorized last', () => {
    const { groups, categories } = serviceGroups(SVC);
    expect(categories).toBe(4);
    expect(groups.map((g) => [g.label, g.other, g.items.map((it) => it.index)])).toEqual([
      ['Cars', false, [0, 1]],
      ['Boats', false, [2, 4]],
      ['RVs', false, [3]],
      ['Pressure Washing', false, [5, 6]],
      ['', true, [7]],
    ]);
    // The template's own items, untouched (same references).
    expect(groups[1].items[1].service).toBe(SVC[4]);
    expect(groups[4].items[0].service).toBe('Hand Wax');
    // Every service exactly once.
    expect(groups.flatMap((g) => g.items.map((it) => it.index)).sort((a, b) => a - b)).toEqual(SVC.map((_, i) => i));
  });

  it('tolerates anything that is not a list', () => {
    for (const v of [undefined, null, 'Wash, Wax', {}, 7]) expect(serviceGroups(v)).toEqual({ groups: [], categories: 0 });
  });
});

describe('serviceTabsOf / serviceTabsStatus', () => {
  it('is off (null) unless copy.serviceTabs is { enabled: true }', () => {
    for (const v of [undefined, null, true, 'yes', 1, [], {}, { enabled: 'true' }, { enabled: 1 }, { all: true }, [{ enabled: true }]]) {
      expect(serviceTabsWanted(v)).toBe(false);
      expect(serviceTabsOf(SVC, v)).toBeNull();
      expect(serviceTabsStatus(SVC, v)).toBe('off');
    }
    expect(serviceTabsWanted(ON)).toBe(true);
  });

  it('needs two categories or more ("few" otherwise, so the template renders as before)', () => {
    const one = [{ name: 'A', category: 'Cars' }, { name: 'B', category: 'cars' }, 'C', { name: 'D' }];
    for (const list of [[], ['Wash', 'Wax'], [{ name: 'A' }, { name: 'B' }], one]) {
      expect(serviceTabsOf(list, ON)).toBeNull();
      expect(serviceTabsStatus(list, ON)).toBe('few');
    }
    expect(SERVICE_TABS_HINTS.few).toContain('Edit > Services');
  });

  it('with two categories or more: one tab per group, the first picked', () => {
    const tabs = serviceTabsOf(SVC, ON);
    expect(serviceTabsStatus(SVC, ON)).toBe('on');
    expect(tabs.all).toBe(false);
    expect(tabs.groups.map((g) => [g.index, g.label, g.other])).toEqual([
      [0, 'Cars', false], [1, 'Boats', false], [2, 'RVs', false], [3, 'Pressure Washing', false], [4, '', true],
    ]);
    expect(tabs.signature).toBe('cars|boats|rvs|pressurewashing|+other');
    const withAll = serviceTabsOf(SVC, { enabled: true, all: true });
    expect(withAll.all).toBe(true);
    expect(withAll.signature).toBe('+all|cars|boats|rvs|pressurewashing|+other');
    // "Other" only when a service has no category.
    expect(serviceTabsOf(SVC.slice(0, 7), ON).groups.some((g) => g.other)).toBe(false);
    // A renamed category is a new signature (the editor re-picks the first tab).
    expect(serviceTabsOf([{ category: 'Cars' }, { category: 'Trucks' }], ON).signature).not.toBe(serviceTabsOf([{ category: 'Cars' }, { category: 'Boats' }], ON).signature);
  });

  it(`holds at most ${SERVICE_TABS_MAX_GROUPS} tabs ("Other" counts); more show untabbed`, () => {
    expect(SERVICE_TABS_MAX_GROUPS).toBe(8);
    const cats = (n) => Array.from({ length: n }, (_, i) => ({ name: `S${i}`, category: `Kind ${String.fromCharCode(65 + i)}` }));
    expect(serviceTabsOf(cats(8), ON).groups).toHaveLength(8);
    expect(serviceTabsOf([...cats(7), 'Plain'], ON).groups).toHaveLength(8);
    for (const list of [cats(9), [...cats(8), 'Plain']]) {
      expect(serviceTabsOf(list, ON)).toBeNull();
      expect(serviceTabsStatus(list, ON)).toBe('many');
    }
    expect(SERVICE_TABS_HINTS.many).toContain(`up to ${SERVICE_TABS_MAX_GROUPS}`);
  });

  it('works on businessInfo as templates get it (normalizeBusinessInfo): objects keep their category', () => {
    const biz = normalizeBusinessInfo({ services: [{ name: 'Wash', price: '60', category: 'Cars' }, { name: 'Boat Wax', price: 150, category: 'Boats' }] });
    expect(biz.services[0]).toEqual({ name: 'Wash', price: '$60', category: 'Cars' });
    // Object services are mirrored to packages, which most templates render.
    const tabs = serviceTabsOf(biz.packages, ON);
    expect(tabs.groups.map((g) => g.label)).toEqual(['Cars', 'Boats']);
    // Services typed as one string are a list of strings: no categories, no tabs.
    expect(serviceTabsStatus(normalizeBusinessInfo({ services: 'Wash, Wax · Interior' }).services, ON)).toBe('few');
  });
});

describe('ServiceTabs markup', () => {
  const tabs = serviceTabsOf(SVC, ON);

  it('renders nothing without tabs', () => {
    for (const C of [ServiceTabs, ServiceTabsBar, ServiceTabsPanels]) expect(html(<C ns="xx-st" tabs={null}>{cards}</C>)).toBe('');
  });

  it('radios first, then the bar, then the panels: siblings in one wrapper', () => {
    const root = parseHtml(tabsHtml(tabs));
    const [wrap] = kids(root);
    expect(wrap.tag).toBe('div');
    expect(wrap.attrs).toEqual({ class: 'xx-st-tabs', role: 'group', 'aria-label': SERVICE_TABS_LABELS.group });
    expect(kids(wrap).map((k) => (k.tag === 'input' ? `radio#${k.attrs.id}` : `${k.tag}.${k.attrs.class}`))).toEqual([
      'radio#xx-st-t0', 'radio#xx-st-t1', 'radio#xx-st-t2', 'radio#xx-st-t3', 'radio#xx-st-t4', 'div.xx-st-bar', 'div.xx-st-panels',
    ]);
  });

  it('the radios: one name, focusable, the first group checked, each controlling its panel', () => {
    const radios = all(parseHtml(tabsHtml(tabs)), (el) => el.tag === 'input');
    expect(radios).toHaveLength(5);
    radios.forEach((r, i) => {
      expect(r.attrs.type).toBe('radio');
      expect(r.attrs.name).toBe('xx-st-tab');
      expect(r.attrs.class).toBe('xx-st-sr xx-st-radio');
      expect(r.attrs['aria-controls']).toBe(`xx-st-p${i}`);
      for (const a of ['tabindex', 'disabled', 'hidden', 'aria-hidden']) expect(r.attrs[a], a).toBeUndefined();
      expect('checked' in r.attrs).toBe(i === 0);
    });
  });

  it('the bar: a <label for> per radio, in the same order, named by the categories', () => {
    const root = parseHtml(tabsHtml(tabs));
    const labels = kids(byClass(root, 'xx-st-bar')[0]);
    expect(labels.map((l) => [l.tag, l.attrs.for, l.attrs.id, l.attrs.class, text(l)])).toEqual([
      ['label', 'xx-st-t0', 'xx-st-l0', 'xx-st-tab xx-st-tab-0', 'Cars'],
      ['label', 'xx-st-t1', 'xx-st-l1', 'xx-st-tab xx-st-tab-1', 'Boats'],
      ['label', 'xx-st-t2', 'xx-st-l2', 'xx-st-tab xx-st-tab-2', 'RVs'],
      ['label', 'xx-st-t3', 'xx-st-l3', 'xx-st-tab xx-st-tab-3', 'Pressure Washing'],
      ['label', 'xx-st-t4', 'xx-st-l4', 'xx-st-tab xx-st-tab-4', 'Other'],
    ]);
  });

  it('the panels: one per group, in order, labelled by their tab, holding the template\'s cards', () => {
    const seen = [];
    const out = html(<ServiceTabs ns="xx-st" tabs={tabs}>{(g) => { seen.push(g.index); return cards(g); }}</ServiceTabs>);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    const panels = kids(byClass(parseHtml(out), 'xx-st-panels')[0]);
    expect(panels.map((p) => [p.attrs.id, p.attrs.class, p.attrs.role, p.attrs['aria-labelledby']])).toEqual(
      [0, 1, 2, 3, 4].map((i) => [`xx-st-p${i}`, `xx-st-panel xx-st-p${i}`, 'group', `xx-st-l${i}`]),
    );
    expect(panels.map((p) => kids(p)[0]).map((h) => [h.attrs.class, h.attrs['aria-hidden'], text(h)])).toEqual(
      ['Cars', 'Boats', 'RVs', 'Pressure Washing', 'Other'].map((t) => ['xx-st-panel-h', 'true', t]),
    );
    expect(panels.map((p) => byClass(p, 'xx-st-card').map(text))).toEqual([
      ['Exterior Wash', 'Interior Detailing'], ['Boat Wash & Wax', 'Hull Oxidation Removal'], ['RV Wash'], ['Driveway Cleaning', 'House Wash'], ['Hand Wax'],
    ]);
    // Each service once on the page.
    for (const s of SVC) expect(out.split(`>${(typeof s === 'string' ? s : s.name).replace(/&/g, '&amp;')}<`).length - 1).toBe(1);
  });

  it('"All" comes first, checked, and controls every panel', () => {
    const root = parseHtml(tabsHtml(serviceTabsOf(SVC, { enabled: true, all: true })));
    const radios = all(root, (el) => el.tag === 'input');
    expect(radios.map((r) => [r.attrs.id, 'checked' in r.attrs])).toEqual([
      ['xx-st-all', true], ['xx-st-t0', false], ['xx-st-t1', false], ['xx-st-t2', false], ['xx-st-t3', false], ['xx-st-t4', false],
    ]);
    expect(radios[0].attrs['aria-controls']).toBe('xx-st-p0 xx-st-p1 xx-st-p2 xx-st-p3 xx-st-p4');
    const first = kids(byClass(root, 'xx-st-bar')[0])[0];
    expect([first.attrs.for, first.attrs.class, text(first)]).toEqual(['xx-st-all', 'xx-st-tab xx-st-tab-all', 'All']);
  });

  it('takes the theme\'s labels and class; the same markup in the editor', () => {
    const out = tabsHtml(serviceTabsOf(SVC, { enabled: true, all: true }), { className: 'xx-wide', labels: { all: 'Everything', other: 'More Services', group: '' } });
    expect(out).toMatch(/^<div class="xx-st-tabs xx-wide" role="group">/);
    expect(out).toContain('>Everything</label>');
    expect(out).toContain('>More Services</label>');
    expect(out).toContain('<p class="xx-st-panel-h" aria-hidden="true">More Services</p>');
    expect(serviceTabLabel(tabs.groups[4])).toBe('Other');
    expect(serviceTabLabel(tabs.groups[4], { other: 'Más' })).toBe('Más');
    expect(serviceTabLabel(tabs.groups[0], { other: 'Más' })).toBe('Cars');
    const el = <ServiceTabs ns="xx-st" tabs={tabs}>{cards}</ServiceTabs>;
    expect(html(el, true)).toBe(html(el));
  });

  it('the bar and the panels can sit in the template\'s own parent', () => {
    const own = html(<div className="xx-st-tabs"><ServiceTabsBar ns="xx-st" tabs={tabs} /><ServiceTabsPanels ns="xx-st" tabs={tabs}>{cards}</ServiceTabsPanels></div>);
    expect(own.replace(/^<div class="xx-st-tabs">/, '')).toBe(tabsHtml(tabs).replace(/^<div[^>]*>/, ''));
    // Children that are not a function fill nothing (one node cannot sit in every panel).
    expect(html(<ServiceTabsPanels ns="xx-st" tabs={tabs}><b>x</b></ServiceTabsPanels>)).not.toContain('<b>');
  });

  it('keeps every class and id in its namespace', () => {
    const out = tabsHtml(serviceTabsOf(SVC, { enabled: true, all: true }));
    for (const m of out.matchAll(/\b(?:class|id|for|name|aria-controls|aria-labelledby)="([^"]+)"/g)) {
      for (const c of m[1].split(' ')) expect(c.startsWith('xx-st-'), c).toBe(true);
    }
  });
});

describe('what the page shows with no script (serviceTabsCss over the markup)', () => {
  const css = serviceTabsCss('xx-st');
  const rules = cssRules(css);
  const page = (list, opts = ON) => {
    const root = parseHtml(tabsHtml(serviceTabsOf(list, opts)));
    return {
      root,
      radios: all(root, (el) => el.tag === 'input'),
      tabs: kids(byClass(root, 'xx-st-bar')[0]),
      panels: kids(byClass(root, 'xx-st-panels')[0]),
    };
  };
  const shown = (p, state) => p.panels.map((el) => computed(rules, el, 'display', state) === 'block');
  const picked = (p, state) => p.tabs.map((el) => computed(rules, el, 'background', state) === 'var(--xx-st-pick-bg)');

  it('opens on the group the markup checks: its panel only, its tab marked', () => {
    const p = page(SVC);
    const state = { checked: p.radios.find((r) => 'checked' in r.attrs).attrs.id };
    expect(shown(p, state)).toEqual([true, false, false, false, false]);
    expect(picked(p, state)).toEqual([true, false, false, false, false]);
    // Unpicked tabs keep their own fill; panel headings stay hidden.
    expect(computed(rules, p.tabs[1], 'background', state)).toBe('var(--xx-st-tab-bg,transparent)');
    expect(p.panels.map((el) => computed(rules, kids(el)[0], 'display', state))).toEqual(Array(5).fill('none'));
  });

  it('picking another tab (a click on its label, or an arrow key) shows that group instead', () => {
    const p = page(SVC);
    p.radios.forEach((r, k) => {
      const state = { checked: r.attrs.id };
      expect(shown(p, state)).toEqual(p.panels.map((_, i) => i === k));
      expect(picked(p, state)).toEqual(p.tabs.map((_, i) => i === k));
    });
  });

  it('rings the tab of the focused radio, and only it', () => {
    const p = page(SVC);
    const state = { checked: 'xx-st-t0', focus: 'xx-st-t2' };
    expect(p.tabs.map((el) => computed(rules, el, 'outline', state))).toEqual([undefined, undefined, '2px solid var(--xx-st-focus)', undefined, undefined]);
    // The radios stay focusable: clipped, never display:none or hidden.
    const sr = computed(rules, p.radios[0], 'clip', state);
    expect(sr).toBe('rect(0,0,0,0)');
    expect(computed(rules, p.radios[0], 'display', state)).toBeUndefined();
    expect(computed(rules, p.radios[0], 'visibility', state)).toBeUndefined();
  });

  it('"All" shows every group with its heading', () => {
    const p = page(SVC, { enabled: true, all: true });
    const state = { checked: 'xx-st-all' };
    expect(shown(p, state)).toEqual([true, true, true, true, true]);
    expect(picked(p, state)).toEqual([true, false, false, false, false, false]);
    expect(p.panels.map((el) => computed(rules, kids(el)[0], 'display', state))).toEqual(Array(5).fill('block'));
    expect(computed(rules, p.panels[1], 'margin-top', state)).toBe('clamp(40px,5cqi,64px)');
    // Picking a group from "All" narrows it to that group.
    expect(shown(p, { checked: 'xx-st-t3' })).toEqual([false, false, false, true, false]);
  });

  it('with no radio checked at all (where :has() works) every group shows rather than none', () => {
    const p = page(SVC);
    expect(shown(p, { checked: null })).toEqual([true, true, true, true, true]);
    expect(p.panels.map((el) => computed(rules, kids(el)[0], 'display', { checked: null }))).toEqual(Array(5).fill('block'));
  });

  it(`has a rule for every one of the ${SERVICE_TABS_MAX_GROUPS} tabs a row can hold`, () => {
    const list = Array.from({ length: SERVICE_TABS_MAX_GROUPS }, (_, i) => ({ name: `S${i}`, category: `Kind ${i}` }));
    const p = page(list, { enabled: true, all: true });
    expect(p.panels).toHaveLength(SERVICE_TABS_MAX_GROUPS);
    for (let k = 0; k < SERVICE_TABS_MAX_GROUPS; k++) {
      expect(shown(p, { checked: `xx-st-t${k}` })).toEqual(p.panels.map((_, i) => i === k));
      expect(picked(p, { checked: `xx-st-t${k}` })).toEqual(p.tabs.map((_, i) => i === k + 1));
    }
  });
});

describe('serviceTabsCss hygiene', () => {
  const ns = 'xx-st';
  const css = serviceTabsCss(ns);
  const rules = cssRules(css);

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

  it(`names every class, id, variable and keyframes in the ${ns}- namespace`, () => {
    for (const r of rules) {
      if (r.at.some((a) => a.startsWith('@keyframes'))) continue;
      for (const m of r.selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) expect(m[1].startsWith(`${ns}-`), r.selector).toBe(true);
    }
    for (const m of css.matchAll(/var\(--([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`), m[0]).toBe(true);
    for (const m of css.matchAll(/@keyframes ([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`)).toBe(true);
  });

  it('tabs are 44px touch targets and fonts come from the theme', () => {
    const tab = rules.find((r) => r.selector === `.${ns}-tab` && r.at.length === 0).body;
    expect(tab).toContain('min-height:44px');
    expect(tab).toContain(`font-family:var(--${ns}-font,inherit)`);
    expect(tab).toContain(`text-transform:var(--${ns}-case,none)`);
    expect(rules.find((r) => r.selector === `.${ns}-panel-h`).body).toContain(`font-family:var(--${ns}-head,inherit)`);
  });
});
