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
import { LucideIcon, LUCIDE } from './icons.jsx';

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
  title: 'Cars, Trucks, Boats and More',
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
    expect(VT_ICONS).toEqual([
      'car', 'sedan', 'coupe', 'sports', 'luxury', 'ev', 'convertible', 'classic',
      'suv', 'truck', 'van', 'boat', 'rv', 'motorcycle', 'fleet',
    ]);
    expect(vehicleTypesOf({ items: [{ name: 'Boats', icon: 'rv' }] }).items[0].icon).toBe('rv');
    expect(vehicleTypesOf({ items: [{ name: 'Boats', icon: 'helicopter' }] }).items[0].icon).toBe('boat');
    expect(vehicleTypesOf({ items: [{ name: 'Daily drivers', icon: 3 }] }).items[0].icon).toBe('car');
    const cases = {
      Cars: 'car', 'Exotics & classics': 'sports', 'SUVs & Crossovers': 'suv', Jeeps: 'suv', 'Trucks & SUVs': 'truck', 'Lifted pickups': 'truck',
      'Vans & Sprinters': 'van', Minivans: 'van', 'Boats & Jet Skis': 'boat', Yachts: 'boat', 'RVs': 'rv', Motorhomes: 'rv', 'Campers and trailers': 'rv',
      Motorcycles: 'motorcycle', 'Bikes': 'motorcycle', Fleet: 'fleet', 'Commercial vans': 'fleet', 'Company cars': 'fleet', '': 'car', 'Advanced care': 'car',
    };
    for (const [name, icon] of Object.entries(cases)) expect(vehicleIconFor(name), name).toBe(icon);
    for (const v of [undefined, null, 5, {}]) expect(vehicleIconFor(v)).toBe('car');
  });

  it('names the kinds of car by their own words; the vehicle words still win', () => {
    const cases = {
      Sedans: 'sedan', 'Coupés': 'coupe', Supercars: 'sports', 'Luxury sedans': 'luxury', Teslas: 'ev', Roadsters: 'convertible',
      'Muscle cars': 'classic', 'Electric trucks': 'truck', 'Luxury SUVs': 'suv', 'Company EVs': 'fleet', 'Daily drivers': 'car',
      // The rest of each word list, and the order among the kinds of car.
      Coupes: 'coupe', 'COUPÉ': 'coupe', 'Coupon deals': 'car', 'Saloons & four-doors': 'sedan', '4-door sedans': 'sedan',
      'Sports cars': 'sports', Exotics: 'sports', 'Race cars': 'sports', 'Performance cars': 'sports', 'Sport utility vehicles': 'car',
      'High-end cars': 'luxury', Limousines: 'luxury', 'Plug-in hybrids': 'ev', 'Electric cars': 'ev', 'Vintage cars': 'classic',
      'Hot rods': 'classic', 'Classic convertibles': 'classic', Cabriolets: 'convertible', 'Drop-tops': 'convertible',
      'Electric sports cars': 'ev', 'Luxury convertibles': 'luxury',
    };
    for (const [name, icon] of Object.entries(cases)) expect(vehicleIconFor(name), name).toBe(icon);
  });

  it('keeps a saved icon over the words its name now matches', () => {
    for (const icon of ['car', 'suv', 'fleet']) {
      expect(vehicleTypesOf({ items: [{ name: 'Sedans', icon }] }).items[0].icon).toBe(icon);
      expect(vehicleTypesOf({ items: [{ name: 'Exotics & classics', icon }] }, { editor: true }).items[0].icon).toBe(icon);
    }
  });

  // The words before the kinds of car came in (vehicleTypes.js ICON_WORDS as
  // it was): a name saved without an icon of its own that drew anything but
  // the car must draw the same icon now, since the page picks it again on
  // every publish.
  const OLD_ICON_WORDS = [
    ['fleet', /\b(fleets?|commercial|company|business)\b/i],
    ['boat', /\b(boats?|yachts?|marine|pontoons?|jet ?skis?|watercraft|vessels?)\b/i],
    ['rv', /\b(rvs?|motor ?homes?|campers?|caravans?|trailers?|coaches)\b/i],
    ['motorcycle', /\b(motorcycles?|motorbikes?|bikes?|scooters?)\b/i],
    ['truck', /\b(trucks?|pick-?ups?)\b/i],
    ['van', /\b(vans?|minivans?|sprinters?)\b/i],
    ['suv', /\b(suvs?|crossovers?|4x4s?|jeeps?)\b/i],
  ];
  const oldIconFor = (name) => (OLD_ICON_WORDS.find(([, re]) => re.test(name)) || ['car'])[0];

  it('moves a name off the plain car only: every other icon a name drew stays', () => {
    const vehicles = ['Fleets', 'Commercial', 'Company', 'Business', 'Boats', 'Yachts', 'Marine', 'Pontoons', 'Jet skis', 'Watercraft', 'Vessels',
      'RVs', 'Motorhomes', 'Campers', 'Caravans', 'Trailers', 'Coaches', 'Motorcycles', 'Motorbikes', 'Bikes', 'Scooters', 'Trucks', 'Pickups',
      'Pick-ups', 'Vans', 'Minivans', 'Sprinters', 'SUVs', 'Crossovers', '4x4s', 'Jeeps', 'Cars', 'Daily drivers'];
    const kinds = ['Sedans', 'Saloons', 'Four-door', '4-door', 'Coupes', 'Coupés', 'Sports', 'Sport', 'Sports cars', 'Exotic', 'Supercars', 'Hypercars',
      'Race', 'Track', 'Performance', 'Luxury', 'Luxe', 'Premium', 'High-end', 'Executive', 'Limo', 'Limousines', 'EV', 'EVs', 'Electric', 'Hybrid',
      'Plug-in', 'Tesla', 'Classic', 'Vintage', 'Antique', 'Collector', 'Hot rod', 'Muscle car', 'Old-timer', 'Convertibles', 'Cabriolet', 'Cabrio',
      'Roadster', 'Drop-top', 'Soft-top'];
    const corpus = [
      ...vehicles, ...kinds,
      ...kinds.flatMap((k) => vehicles.flatMap((v) => [`${k} ${v}`, `${v} & ${k}`, `${k.toLowerCase()} ${v.toLowerCase()}`])),
      ...Object.values(VT_ICON_LABELS),
    ];
    let kept = 0;
    let moved = 0;
    for (const name of corpus) {
      const before = oldIconFor(name);
      if (before !== 'car') {
        expect(vehicleIconFor(name), name).toBe(before);
        kept++;
      } else if (vehicleIconFor(name) !== 'car') moved++;
    }
    // The corpus reaches both sides: names that keep a vehicle icon and
    // names that leave the car for a kind of car.
    expect(kept).toBeGreaterThan(2000);
    expect(moved).toBeGreaterThan(100);
  });

  it('draws every icon as a decorative lucide-style svg; an unknown name draws the car', () => {
    expect(Object.keys(VT_ICON_PATHS)).toEqual([...VT_ICONS]);
    expect(Object.keys(VT_ICON_LABELS)).toEqual([...VT_ICONS]);
    expect(VT_ICON_LABELS).toMatchObject({
      sedan: 'Sedan', coupe: 'Coupe', sports: 'Sports car', luxury: 'Luxury car', ev: 'Electric (EV)', convertible: 'Convertible', classic: 'Classic car',
    });
    const svg = renderToStaticMarkup(<VehicleTypeIcon name="boat" />);
    expect(svg).toMatch(/^<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">/);
    expect(renderToStaticMarkup(<VehicleTypeIcon name="nope" size={16} stroke={2} />)).toBe(renderToStaticMarkup(<LucideIcon name="car" />));
    // Fifteen different drawings, stroke only.
    const drawn = VT_ICONS.map((name) => renderToStaticMarkup(<VehicleTypeIcon name={name} />));
    expect(new Set(drawn).size).toBe(15);
    for (const s of drawn) expect(s).not.toMatch(/fill="(?!none)|style=|#[0-9a-f]{3}/i);
    // The road vehicles stand on the same two wheels (the boat floats, the
    // motorcycle has its own).
    for (const name of VT_ICONS.filter((n) => !['boat', 'motorcycle', 'fleet'].includes(n))) {
      expect(renderToStaticMarkup(<VehicleTypeIcon name={name} />), name).toContain('<circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>');
    }
  });

  // The first eight drawings as origin/master rendered them before the kinds
  // of car came in (renderToStaticMarkup(<VehicleTypeIcon name={id} />), the
  // svg tag aside): live pages show them, so they never change.
  const FROZEN = {
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>',
    suv: '<path d="M19 17h2a1 1 0 0 0 1-1v-3.4a2 2 0 0 0-1.6-2L17 10l-2.4-4a2 2 0 0 0-1.7-1H4a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1h2"></path><path d="M2 10h15"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>',
    truck: '<path d="M5 17H3a1 1 0 0 1-1-1v-4h10V7a1 1 0 0 1 1-1h3.5l2.8 4 1.9.4a1.2 1.2 0 0 1 .8 1.1V16a1 1 0 0 1-1 1h-2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>',
    van: '<path d="M5 17H3a1 1 0 0 1-1-1V6.5A1.5 1.5 0 0 1 3.5 5h11.6a1.5 1.5 0 0 1 1.2.6l5.4 6.8a1.5 1.5 0 0 1 .3.9V16a1 1 0 0 1-1 1h-2"></path><path d="M11 5v12"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>',
    boat: '<path d="M2 12h20l-2.7 4.5a2 2 0 0 1-1.7 1H5.2a2 2 0 0 1-1.8-1.1z"></path><path d="M6 12V9a1 1 0 0 1 1-1h5.5l3 4"></path><path d="M2 21c1.2 0 1.8-.8 3.3-.8s2.1.8 3.3.8 1.8-.8 3.4-.8 2.1.8 3.3.8 1.8-.8 3.3-.8 2.1.8 3.4.8"></path>',
    rv: '<path d="M5 17H3a1 1 0 0 1-1-1V4.5A1.5 1.5 0 0 1 3.5 3h15A1.5 1.5 0 0 1 20 4.5V7a1 1 0 0 1-1 1h-1.6l2.8 3.8 1.1.3a1 1 0 0 1 .7 1V16a1 1 0 0 1-1 1h-2"></path><rect x="5" y="6.5" width="5" height="3.5" rx="1"></rect><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>',
    motorcycle: '<circle cx="5" cy="16" r="3"></circle><circle cx="19" cy="16" r="3"></circle><path d="m19 16-3.4-8.5h-2.3"></path><path d="M5 16h4l1.5-3"></path><path d="M3.6 13a1 1 0 0 1 .9-1.5h5l1.7-1.8a2 2 0 0 1 1.4-.6h3.7"></path><path d="M10.5 13h3.5l1.8 3H10z"></path>',
    fleet: '<path d="M6 10.2c0-.3.1-.7.2-1l1.1-2.3c.2-.4.7-.7 1.1-.7H14c.5 0 1 .2 1.4.6.7.7 1.8 1.8 1.8 1.8s2.2.5 3.6.9c.7.2 1.2.8 1.2 1.5v2.4c0 .4-.3.8-.8.8h-1.6a1.6 1.6 0 0 0-3.1-.55"></path><path d="M15.6 18.8h1.6c.48 0 .8-.32.8-.8v-2.4c0-.72-.56-1.36-1.2-1.52C15.36 13.68 13.2 13.2 13.2 13.2s-1.04-1.12-1.76-1.84c-.4-.32-.88-.56-1.44-.56H4.4c-.48 0-.88.32-1.12.72l-1.12 2.32A2.96 2.96 0 0 0 2 14.8V18c0 .48.32.8.8.8h1.6"></path><circle cx="6" cy="18.8" r="1.6"></circle><path d="M7.6 18.8h4.8"></path><circle cx="14" cy="18.8" r="1.6"></circle>',
  };

  it('never redraws an icon a page may already show', () => {
    const open = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
    for (const [name, inner] of Object.entries(FROZEN)) {
      expect(renderToStaticMarkup(<VehicleTypeIcon name={name} />), name).toBe(`${open}${inner}</svg>`);
    }
    // The car is lucide's own (kit/blocks.golden.json pins that drawing).
    expect(VT_ICON_PATHS.car).toBe(LUCIDE.car);
    // The old ids keep their order in the picker; the kinds of car slot in
    // after the car.
    expect(VT_ICONS.filter((id) => id in FROZEN)).toEqual(Object.keys(FROZEN));
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
    expect(html).toContain('<div class="xx-wrap"><div class="xx-vt-head" data-acg-reveal=""><p class="xx-vt-eyebrow">Vehicles We Work On</p><h2 id="xx-vt-h" class="xx-vt-title">Cars, Trucks, Boats and More</h2><p class="xx-vt-intro">Whatever you drive, wherever it is parked.</p></div>');
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
