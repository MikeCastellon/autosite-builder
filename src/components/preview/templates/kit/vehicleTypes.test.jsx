// The Vehicle Types band (kit/vehicleTypes.js + kit/VehicleTypes.jsx): which
// items show (the published page: named items only; the editor: every
// item), the limits, the icons, the heading, the band's markup and
// accessibility, its editor-only states, and vehicleTypesCss's hygiene (the
// same checks blocks.test.jsx runs on the other blocks' CSS).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VehicleTypesBand, VehicleTypeIcon, VT_ICON_PATHS, vehicleTypesCss } from './VehicleTypes.jsx';
import {
  VT_LIMITS, VT_SECTION, VT_TAB, VT_DEFAULTS, VT_HINTS, VT_ICONS, VT_ICON_LABELS, vehicleIconFor, vehicleTypesOf, vehicleTypesHeading,
} from './vehicleTypes.js';
import { EditorModeProvider } from './EditorMode.jsx';
import { LucideIcon } from './icons.jsx';

const band = (props, editor = false) => {
  const el = createElement(VehicleTypesBand, { ns: 'xx-vt', order: 5, ...props, editor });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
};
const count = (s, needle) => s.split(needle).length - 1;
// Text as a reader sees it (React escapes > & ' " in text and attributes).
const decode = (html) => html.replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const sectionTag = (html) => (html.match(/^<section\b[^>]*>/) || [''])[0];
const visibleText = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const chars = (s) => Array.from(s).length;
// Claims no block may make up (templates.render.test.jsx BANNED_CLAIMS).
const BANNED = /Verified (Customer|Review|Buyer)|Real Reviews|5\.0 (Google )?Rating|Open Now|[★☆⭐]|100% Satisf|Satisfaction Guarantee|Top[- ]Rated|(5|Five)[- ]Star|Certified|Guarantee/i;

const SIX = {
  title: 'For the Everyday Drive. And the Weekend Escape.',
  intro: 'Whatever you drive, wherever it is parked.',
  items: [
    { name: 'Cars', desc: 'Sedans, coupes and daily drivers.', icon: 'car' },
    { name: 'SUVs', icon: 'suv' },
    { name: 'Trucks', desc: 'Beds and wheel wells too.', icon: 'truck' },
    { name: 'Boats', icon: 'boat' },
    { name: 'RVs', icon: 'rv' },
    { name: 'Fleet', desc: 'Company vehicles on a schedule.', icon: 'fleet' },
  ],
};

describe('vehicleTypesOf', () => {
  it('is off (null) unless copy.vehicleTypes is an object', () => {
    for (const v of [undefined, null, '', 'yes', 42, true, [], [{ name: 'Cars' }]]) {
      expect(vehicleTypesOf(v)).toBeNull();
      expect(vehicleTypesOf(v, { editor: true })).toBeNull();
    }
    expect(vehicleTypesOf({})).toEqual({ title: '', intro: '', items: [], named: 0 });
    expect(vehicleTypesOf({ items: 'nope', title: 7 }, { editor: true })).toEqual({ title: '7', intro: '', items: [], named: 0 });
  });

  it('publishes named items only; the editor gets every item, flagged', () => {
    const vt = { title: '  Rides  ', intro: ' We detail them all. ', items: [{ name: ' Cars ', desc: ' Daily drivers ' }, { desc: 'Pontoons', icon: 'boat' }, 'Trucks', 42, null, { name: '   ' }] };
    const pub = vehicleTypesOf(vt);
    expect(pub.title).toBe('Rides');
    expect(pub.intro).toBe('We detail them all.');
    expect(pub.named).toBe(2);
    expect(pub.items).toEqual([
      { index: 0, name: 'Cars', desc: 'Daily drivers', icon: 'car', named: true },
      // A plain string entry is a name.
      { index: 2, name: 'Trucks', desc: '', icon: 'truck', named: true },
    ]);
    const ed = vehicleTypesOf(vt, { editor: true });
    expect(ed.items.map((it) => [it.index, it.named, it.name, it.icon])).toEqual([
      [0, true, 'Cars', 'car'], [1, false, '', 'boat'], [2, true, 'Trucks', 'truck'], [3, false, '', 'car'], [4, false, '', 'car'], [5, false, '', 'car'],
    ]);
    expect(ed.named).toBe(2);
  });

  it('folds any whitespace (a pasted line break included) into one space', () => {
    const { items } = vehicleTypesOf({ items: [{ name: 'Classic\n\n  cars', desc: 'Line one\r\nline\ttwo' }] });
    expect(items[0]).toMatchObject({ name: 'Classic cars', desc: 'Line one line two' });
  });

  it('counts the first VT_LIMITS.items entries only, in the editor too', () => {
    expect(VT_LIMITS).toEqual({ title: 80, intro: 200, name: 40, desc: 140, items: 8 });
    const ten = { items: Array.from({ length: 10 }, (_, i) => ({ name: `Kind ${i}` })) };
    expect(vehicleTypesOf(ten).items.map((it) => it.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(vehicleTypesOf(ten, { editor: true }).items).toHaveLength(8);
    // An unnamed entry inside the eight never pulls in the ninth.
    const gap = { items: [{}, ...ten.items] };
    expect(vehicleTypesOf(gap).items.map((it) => it.name)).toEqual(['Kind 0', 'Kind 1', 'Kind 2', 'Kind 3', 'Kind 4', 'Kind 5', 'Kind 6']);
  });

  it('clips text past its limit at a word, with an ellipsis; text at the limit is kept', () => {
    const long = (n) => 'Sedans coupes wagons and convertibles '.repeat(12).trim().slice(0, n);
    const vt = { title: long(120), intro: long(260), items: [{ name: long(60), desc: long(200) }] };
    const { title, intro, items: [it] } = vehicleTypesOf(vt);
    for (const [text, max] of [[title, 80], [intro, 200], [it.name, 40], [it.desc, 140]]) {
      expect(chars(text)).toBeLessThanOrEqual(max);
      expect(text.endsWith('…')).toBe(true);
      // Cut at a word: what is left is a run of whole words from the source.
      expect(long(260).startsWith(text.slice(0, -1))).toBe(true);
      expect(/[\s,]…$/.test(text)).toBe(false);
    }
    expect(it.name).toBe('Sedans coupes wagons and convertibles…');
    const exact = 'x'.repeat(40);
    expect(vehicleTypesOf({ items: [{ name: exact }] }).items[0].name).toBe(exact);
    expect(vehicleTypesOf({ items: [{ name: `${exact}y` }] }).items[0].name).toBe(`${'x'.repeat(39)}…`);
  });

  it('never splits an emoji when it clips', () => {
    const { items: [it] } = vehicleTypesOf({ items: [{ name: '🚗'.repeat(45) }] });
    expect(chars(it.name)).toBe(40);
    expect(it.name).toBe(`${'🚗'.repeat(39)}…`);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(it.name)).toBe(false);
  });
});

describe('icons', () => {
  it('takes the owner\'s pick, else what the name suggests, else the car', () => {
    expect(VT_ICONS).toEqual(['car', 'suv', 'truck', 'van', 'boat', 'rv', 'motorcycle', 'fleet']);
    expect(vehicleTypesOf({ items: [{ name: 'Boats', icon: 'rv' }] }).items[0].icon).toBe('rv');
    expect(vehicleTypesOf({ items: [{ name: 'Boats', icon: 'helicopter' }] }).items[0].icon).toBe('boat');
    expect(vehicleTypesOf({ items: [{ name: 'Daily drivers', icon: 3 }] }).items[0].icon).toBe('car');
    const cases = {
      Cars: 'car', 'Exotics & classics': 'car', 'SUVs & Crossovers': 'suv', Jeeps: 'suv', 'Trucks & SUVs': 'truck', 'Lifted pickups': 'truck',
      'Vans & Sprinters': 'van', Minivans: 'van', 'Boats & Jet Skis': 'boat', Yachts: 'boat', 'RVs': 'rv', Motorhomes: 'rv', 'Campers and trailers': 'rv',
      Motorcycles: 'motorcycle', 'Bikes': 'motorcycle', Fleet: 'fleet', 'Commercial vans': 'fleet', 'Company cars': 'fleet', '': 'car', 'Advanced care': 'car',
    };
    for (const [name, icon] of Object.entries(cases)) expect(vehicleIconFor(name), name).toBe(icon);
    for (const v of [undefined, null, 5, {}]) expect(vehicleIconFor(v)).toBe('car');
  });

  it('draws every icon as a decorative lucide-style svg; an unknown name draws the car', () => {
    expect(Object.keys(VT_ICON_PATHS)).toEqual([...VT_ICONS]);
    expect(Object.keys(VT_ICON_LABELS)).toEqual([...VT_ICONS]);
    const svg = renderToStaticMarkup(<VehicleTypeIcon name="boat" />);
    expect(svg).toMatch(/^<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">/);
    expect(renderToStaticMarkup(<VehicleTypeIcon name="nope" size={16} stroke={2} />)).toBe(renderToStaticMarkup(<LucideIcon name="car" />));
    // Eight different drawings.
    const drawn = VT_ICONS.map((name) => renderToStaticMarkup(<VehicleTypeIcon name={name} />));
    expect(new Set(drawn).size).toBe(8);
    for (const s of drawn) expect(s).not.toMatch(/fill="(?!none)|style=|#[0-9a-f]{3}/i);
  });
});

describe('vehicleTypesHeading', () => {
  it('the owner\'s title / intro, else Edit > Headings, else the design\'s own', () => {
    expect(vehicleTypesHeading({}, undefined)).toEqual({ eyebrow: VT_DEFAULTS.eyebrow, title: VT_DEFAULTS.title, accent: '', intro: '' });
    const st = { vehicleTypes: { eyebrow: 'What we wash', title: 'Our Rides', accent: 'Rides', intro: 'All of them.' } };
    expect(vehicleTypesHeading({}, st)).toEqual({ eyebrow: 'What we wash', title: 'Our Rides', accent: 'Rides', intro: 'All of them.' });
    expect(vehicleTypesHeading({ title: 'Own title', intro: 'Own intro' }, st)).toEqual({ eyebrow: 'What we wash', title: 'Own title', accent: 'Rides', intro: 'Own intro' });
    // Tolerates junk.
    expect(vehicleTypesHeading('x', 'y', 'z')).toEqual(vehicleTypesHeading({}, undefined));
  });

  it('merges the theme\'s defaults; \'\' there leaves a part out', () => {
    expect(vehicleTypesHeading({}, {}, { title: 'Rides We Detail', accent: 'Detail' })).toEqual({ eyebrow: VT_DEFAULTS.eyebrow, title: 'Rides We Detail', accent: 'Detail', intro: '' });
    expect(vehicleTypesHeading({}, {}, { eyebrow: '' }).eyebrow).toBe('');
  });

  it('names the section, tab, defaults and hints', () => {
    expect(VT_SECTION).toBe('vehicleTypes');
    expect(VT_TAB).toBe('Vehicle Types');
    expect(VT_DEFAULTS).toEqual({ eyebrow: 'Vehicles We Work On', title: 'Every Kind of Ride' });
    for (const h of Object.values(VT_HINTS)) expect(h).toContain('Edit > Vehicle Types');
    for (const d of Object.values(VT_DEFAULTS)) expect(d).not.toMatch(BANNED);
  });
});

describe('VehicleTypesBand', () => {
  it('renders nothing while the band is off, or published without a named item', () => {
    for (const editor of [false, true]) expect(band({ vehicleTypes: null }, editor)).toBe('');
    expect(band({ vehicleTypes: {} })).toBe('');
    expect(band({ vehicleTypes: { items: [{ desc: 'No name yet' }, '  '] } })).toBe('');
  });

  it('published: the section, the design heading and one card per named item', () => {
    const html = band({ vehicleTypes: SIX, className: 'xx-section', wrapClassName: 'xx-wrap' });
    expect(sectionTag(html)).toBe('<section data-section="vehicleTypes" id="vehicle-types" class="xx-vt-band xx-section" aria-labelledby="xx-vt-h" style="order:5">');
    expect(html).toContain('<div class="xx-wrap"><div class="xx-vt-head" data-acg-reveal=""><p class="xx-vt-eyebrow">Vehicles We Work On</p><h2 id="xx-vt-h" class="xx-vt-title">For the Everyday Drive. And the Weekend Escape.</h2><p class="xx-vt-intro">Whatever you drive, wherever it is parked.</p></div>');
    expect(html).toContain('<ul class="xx-vt-grid" role="list">');
    expect(count(html, '<li class="xx-vt-card"')).toBe(6);
    // Card markup: icon, name, optional line.
    expect(html).toMatch(/<li class="xx-vt-card" data-acg-reveal="fade" style="--acg-delay:0ms"><span class="xx-vt-icon"><svg [^>]*aria-hidden="true" focusable="false">[^]*?<\/svg><\/span><div class="xx-vt-body"><h3 class="xx-vt-name">Cars<\/h3><p class="xx-vt-desc">Sedans, coupes and daily drivers.<\/p><\/div><\/li>/);
    expect(html).toContain('<h3 class="xx-vt-name">SUVs</h3></div></li>');
    // Rows fade in a row at a time.
    expect([...html.matchAll(/--acg-delay:(\d+)ms/g)].map((m) => m[1])).toEqual(['0', '90', '180', '0', '90', '180']);
    expect(html).not.toMatch(/data-acg-editor-only|xx-vt-todo|xx-vt-hint|xx-vt-n4/);
    expect(visibleText(html)).not.toMatch(/Edit >|Edit panel/);
    expect(visibleText(html)).not.toMatch(BANNED);
  });

  it('is one <h2> over <h3> names, a real list, decorative icons', () => {
    const html = band({ vehicleTypes: SIX });
    expect(count(html, '<h2')).toBe(1);
    expect(count(html, '<h3')).toBe(6);
    expect(count(html, '<svg')).toBe(6);
    expect(count(html, 'aria-hidden="true" focusable="false"')).toBe(6);
    expect(html).toContain('role="list"');
    // The card's words are the owner's: nothing but names and lines.
    expect(visibleText(html)).toBe(`${VT_DEFAULTS.eyebrow} ${SIX.title} ${SIX.intro} Cars Sedans, coupes and daily drivers. SUVs Trucks Beds and wheel wells too. Boats RVs Fleet Company vehicles on a schedule.`);
  });

  it('four items make a 2 x 2 block (the n4 class); other counts do not', () => {
    const four = { items: SIX.items.slice(0, 4) };
    expect(band({ vehicleTypes: four })).toContain('<ul class="xx-vt-grid xx-vt-n4" role="list">');
    for (const n of [1, 2, 3, 5, 6]) expect(band({ vehicleTypes: { items: SIX.items.slice(0, n) } })).not.toContain('xx-vt-n4');
  });

  it('the editor shows an unnamed item as an editor-only card naming the tab', () => {
    const vt = { items: [{ name: 'Cars' }, { desc: 'Pontoons and bass boats', icon: 'boat' }] };
    const html = band({ vehicleTypes: vt }, true);
    // The band itself publishes (Cars is named): only the todo card is editor-only.
    expect(sectionTag(html)).not.toContain('data-acg-editor-only');
    const todo = html.slice(html.indexOf('<li class="xx-vt-card xx-vt-todo" data-acg-editor-only="">'));
    expect(todo).not.toBe(html);
    expect(decode(todo)).toContain(`<p class="xx-vt-name">${VT_HINTS.noName}</p><p class="xx-vt-desc">Pontoons and bass boats</p>`);
    expect(todo).not.toContain('<h3');
    // The same data published: one card, no hint.
    const pub = band({ vehicleTypes: vt });
    expect(count(pub, '<li ')).toBe(1);
    expect(pub).not.toMatch(/data-acg-editor-only|Pontoons|Edit &gt;|Edit >/);
  });

  it('with no named item the editor shows the whole band as editor-only, with the hint while it is empty', () => {
    const empty = band({ vehicleTypes: { items: [] } }, true);
    expect(sectionTag(empty)).toContain('data-acg-editor-only=""');
    expect(empty).toContain(`<h2 id="xx-vt-h" class="xx-vt-title">${VT_DEFAULTS.title}</h2>`);
    expect(decode(empty)).toContain(`<p class="xx-vt-hint" data-acg-editor-only="">${VT_HINTS.empty}</p>`);
    expect(empty).not.toContain('<ul');
    const unnamed = band({ vehicleTypes: { items: [{ desc: 'x' }] } }, true);
    expect(sectionTag(unnamed)).toContain('data-acg-editor-only=""');
    expect(unnamed).not.toContain('xx-vt-hint');
    expect(unnamed).toContain('xx-vt-todo');
  });

  it('takes the theme\'s heading, hints, labels, section id and the Edit > Headings words', () => {
    const own = band({
      vehicleTypes: { items: [] }, id: 'rides', labelledBy: 'th-h',
      heading: <h2 id="th-h">Theme heading</h2>, hints: <p className="th-hint">Theme hint</p>,
    }, true);
    expect(sectionTag(own)).toContain('id="rides"');
    expect(sectionTag(own)).toContain('aria-labelledby="th-h"');
    expect(own).toContain('<h2 id="th-h">Theme heading</h2><p class="th-hint">Theme hint</p>');
    expect(own).not.toMatch(/xx-vt-(head|hint)/);
    // heading={null}: no heading at all (and no dangling aria-labelledby).
    const bare = band({ vehicleTypes: SIX, heading: null });
    expect(sectionTag(bare)).not.toContain('aria-labelledby');
    expect(bare).not.toContain('<h2');
    // labels replace the hints' words.
    expect(band({ vehicleTypes: { items: [{}] }, labels: { noName: 'Sin nombre' } }, true)).toContain('<p class="xx-vt-name">Sin nombre</p>');
    // Edit > Headings: eyebrow and highlighted words from copy.sectionTitles.
    const st = band({ vehicleTypes: { items: SIX.items }, sectionTitles: { vehicleTypes: { eyebrow: 'Rides', title: 'Every Kind of Ride', accent: 'Ride' } } });
    expect(st).toContain('<p class="xx-vt-eyebrow">Rides</p><h2 id="xx-vt-h" class="xx-vt-title">Every Kind of <span class="xx-vt-em">Ride</span></h2>');
  });

  it('keeps every class it renders in its namespace', () => {
    const html = band({ vehicleTypes: { items: [...SIX.items.slice(0, 3), {}] } }, true);
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(' ')) expect(c.startsWith('xx-vt-'), c).toBe(true);
    }
    for (const m of html.matchAll(/\bid="([^"]+)"/g)) expect(['vehicle-types', 'xx-vt-h']).toContain(m[1]);
  });
});

// A tiny CSS reader: every rule with its selector and the at-rules around it
// (blocks.test.jsx's).
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

describe('vehicleTypesCss', () => {
  const ns = 'xx-vt';
  const css = vehicleTypesCss(ns);
  const rules = cssRules(css);
  const rule = (sel, at = []) => rules.find((r) => r.selector === sel && r.at.join('|') === at.join('|'));

  it('is non-empty, balanced and free of comments and Redline names', () => {
    expect(rules.length).toBeGreaterThan(5);
    expect(css).not.toContain('/*');
    expect(css).not.toMatch(/\brl-|--rl-/);
  });

  it('has no hard-coded colors but black / white and neutral translucent overlays', () => {
    const hexes = [...css.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => !['#fff', '#ffffff', '#000', '#000000'].includes(h))).toEqual([]);
    for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi)) {
      expect(m[1] === m[2] && m[2] === m[3] && m[4] !== undefined && Number(m[4]) < 1, m[0]).toBe(true);
    }
    expect(css).not.toMatch(/\b(hsl|oklch|lab)\(/i);
  });

  it('has no hover state and no motion of its own (the page runtime fades the cards in)', () => {
    expect(css).not.toMatch(/:hover|transition|animation|@keyframes/);
  });

  it('uses container breakpoints only', () => {
    expect(css).not.toMatch(/@media/);
    for (const r of rules) for (const at of r.at) expect(at).toMatch(/^@container \(min-width:\d+px\)$/);
  });

  it(`names every class and variable in the ${ns}- namespace`, () => {
    for (const r of rules) {
      for (const m of r.selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) expect(m[1].startsWith(`${ns}-`), r.selector).toBe(true);
    }
    for (const m of css.matchAll(/var\(--([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`), m[0]).toBe(true);
  });

  it('lays out one card a row, two from 601px, three from 960px (four as 2 x 2)', () => {
    expect(rule(`.${ns}-grid`).body).toContain('grid-template-columns:minmax(0,1fr)');
    expect(rule(`.${ns}-grid`, ['@container (min-width:601px)']).body).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(rule(`.${ns}-grid`, ['@container (min-width:960px)']).body).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(rule(`.${ns}-grid.${ns}-n4`, ['@container (min-width:960px)']).body).toBe('grid-template-columns:repeat(2,minmax(0,1fr))');
    // A phone card puts the icon beside the words; wider ones stack them.
    expect(rule(`.${ns}-card`).body).toMatch(/display:flex;align-items:flex-start/);
    expect(rule(`.${ns}-card`, ['@container (min-width:601px)']).body).toContain('flex-direction:column');
  });

  it('reads its colors from block variables, card text paired with the card', () => {
    expect(rule(`.${ns}-card`).body).toContain(`background:var(--${ns}-card-bg);color:var(--${ns}-card-text,var(--${ns}-text))`);
    expect(rule(`.${ns}-desc`).body).toContain(`color:var(--${ns}-card-muted,var(--${ns}-muted))`);
    expect(rule(`.${ns}-icon`).body).toContain(`background:var(--${ns}-icon-bg);color:var(--${ns}-icon)`);
    expect(rule(`.${ns}-title`).body).toContain(`font-family:var(--${ns}-head-font,inherit)`);
  });
});
