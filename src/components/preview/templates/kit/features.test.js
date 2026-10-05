// kit/features.js: the pure logic behind the shared feature blocks, plus the
// opt-in parameters themes with live sites use (heroCardModeOf fallback,
// featuredServiceOf automatic, footerPlan specs, footerColumnsOf defaults,
// vehicleMakesFor defaults).
import { describe, it, expect } from 'vitest';
import {
  nameKey, HERO_CARD_MODES, heroCardModeOf, cardPriceLong, optPriceLong, heroOfferOf,
  featuredServiceOf, featuredHasBody, featuredTitleDefaults, makesEyebrowDefault, makesRepeats,
  reviewStars, footerPlan,
} from './features.js';
import { footerColumnsOf, FOOTER_COLUMN_TYPES } from './content.js';
import { vehicleMakesFor, VEHICLE_MAKES } from './vehicleMakes.js';
import { footerSpec as REDLINE_SPEC } from '../mobile/MobileRedline.jsx';

const svc = (name, price = '', extra = {}) => ({ name, price, summary: '', description: '', includes: [], ...extra });

describe('nameKey / heroCardModeOf / price length', () => {
  it('compares names loosely', () => {
    expect(nameKey('  Full-Detail Plus! ')).toBe('fulldetailplus');
    expect(nameKey(null)).toBe('');
    expect(nameKey(42)).toBe('42');
  });

  it('keeps a known mode and falls back otherwise', () => {
    expect(HERO_CARD_MODES).toEqual(['quote', 'list', 'off']);
    for (const m of HERO_CARD_MODES) expect(heroCardModeOf(m, 'off')).toBe(m);
    expect(heroCardModeOf(undefined)).toBe('quote');
    expect(heroCardModeOf('banner')).toBe('quote');
    expect(heroCardModeOf(undefined, 'off')).toBe('off');
    expect(heroCardModeOf(null, 'list')).toBe('list');
  });

  it('flags text and long prices', () => {
    expect(cardPriceLong('$120')).toBe(false);
    expect(cardPriceLong('Call for quote')).toBe(true);
    expect(cardPriceLong('$150/$200')).toBe(true);
    expect(cardPriceLong('Starting at $1,299')).toBe(true);
    expect(optPriceLong('$120')).toBe(false);
    expect(optPriceLong('$1,299.00')).toBe(true);
    expect(optPriceLong('from $90')).toBe(true);
  });
});

describe('heroOfferOf', () => {
  const services = [svc('Wash', '$40'), svc('Interior', 'Call'), svc('Full Detail', '$180'), svc('Ceramic', '$900'), svc('Paint Fix', '$300'), svc('', '$10')];

  it('auto-picks the first three named, priced packages', () => {
    const r = heroOfferOf({ services, mode: 'quote' });
    expect(r.picks.map((s) => s.name)).toEqual(['Wash', 'Full Detail', 'Ceramic']);
    expect(r.listPicks).toEqual([]);
    expect(r.hasCard).toBe(true);
    expect(r.mode).toBe('quote');
  });

  it('uses the owner picks by name, drops stale and repeated names, max 4', () => {
    const r = heroOfferOf({ services, heroServices: ['paint fix', 'Gone', 'ceramic', 'Ceramic', 'wash', 'full detail', 'Interior'], mode: 'quote' });
    expect(r.picks.map((s) => s.name)).toEqual(['Paint Fix', 'Ceramic', 'Wash', 'Full Detail']);
    // The list card takes the same picks, unpriced ones included.
    const l = heroOfferOf({ services, heroServices: ['Interior', 'Wash'], mode: 'list' });
    expect(l.listPicks.map((s) => s.name)).toEqual(['Interior', 'Wash']);
    expect(l.picks).toEqual([]);
  });

  it('the price card offers only priced picks', () => {
    const r = heroOfferOf({ services, heroServices: ['Interior'], mode: 'quote' });
    expect(r.picks).toEqual([]);
    expect(r.hasCard).toBe(false);
  });

  it('lists the first three named packages when none is priced (list mode only)', () => {
    const unpriced = [svc('A'), svc('B', 'Call'), svc(''), svc('C'), svc('D')];
    expect(heroOfferOf({ services: unpriced, mode: 'list' }).listPicks.map((s) => s.name)).toEqual(['A', 'B', 'C']);
    expect(heroOfferOf({ services: unpriced, mode: 'quote' }).hasCard).toBe(false);
  });

  it("'off' and junk input give no card", () => {
    expect(heroOfferOf({ services, mode: 'off' })).toEqual({ mode: 'off', picks: [], listPicks: [], hasCard: false });
    expect(heroOfferOf({ services: null, heroServices: 'x', mode: 'quote' }).hasCard).toBe(false);
    expect(heroOfferOf().hasCard).toBe(false);
  });
});

describe('featuredServiceOf', () => {
  const services = [
    svc('Wash', '$40', { summary: 'Quick wash' }),
    svc('Ceramic Coating', '$900', { description: 'Two-year coating.', includes: [{ text: 'Prep:', heading: true }, { text: 'Clay bar', heading: false }, { text: 'Coating', heading: false }] }),
  ];
  const defaults = { title: 'Protect Your Vehicle With Ceramic Coating', accent: 'Ceramic Coating' };

  it('automatic: the first ceramic / coating package without an owner choice', () => {
    const f = featuredServiceOf({ services, defaults });
    expect(f).toMatchObject({ name: 'Ceramic Coating', price: '$900', priceFrom: '', bullets: ['Clay bar', 'Coating'], intro: '', buttonText: 'Book Ceramic Coating', buttonUrl: '' });
    expect(f.title).toBe(defaults.title);
    expect(f.accent).toBe(defaults.accent);
  });

  it('opt-in (automatic: false): no owner choice, no band', () => {
    expect(featuredServiceOf({ services, defaults, automatic: false })).toBeNull();
    expect(featuredServiceOf({ featuredService: { serviceName: '  ' }, services, automatic: false })).toBeNull();
    expect(featuredServiceOf({ featuredService: { serviceName: 'wash' }, services, automatic: false }).name).toBe('wash');
  });

  it('no match and no ceramic package: null', () => {
    expect(featuredServiceOf({ services: [svc('Wash', '$40')] })).toBeNull();
  });

  it("the owner's bullets win over the package's includes; intro falls back to summary / description", () => {
    const own = featuredServiceOf({ featuredService: { serviceName: 'Ceramic Coating', bullets: [' Gloss ', '', 'Beading'], priceFrom: '$600', buttonText: 'Go', buttonUrl: ' /x ' }, services });
    expect(own).toMatchObject({ bullets: ['Gloss', 'Beading'], priceFrom: '$600', buttonText: 'Go', buttonUrl: '/x', intro: '' });
    const wash = featuredServiceOf({ featuredService: { serviceName: 'Wash' }, services });
    expect(wash).toMatchObject({ bullets: [], intro: 'Quick wash', price: '$40' });
    const desc = featuredServiceOf({ featuredService: { serviceName: 'Ceramic Coating', bullets: [] }, services: [svc('Ceramic Coating', '', { description: 'Two-year coating.' })] });
    expect(desc.intro).toBe('Two-year coating.');
    // A name no package has still features it (no price, no bullets).
    expect(featuredServiceOf({ featuredService: { serviceName: 'Paint Correction' }, services })).toMatchObject({ name: 'Paint Correction', price: '', bullets: [], intro: '' });
  });

  it('section headings override the defaults', () => {
    const f = featuredServiceOf({ services, defaults, sectionTitles: { featured: { eyebrow: 'Signature', title: 'Our Best Coat', accent: 'Best', intro: 'Hand applied.' } } });
    expect(f).toMatchObject({ eyebrow: 'Signature', title: 'Our Best Coat', accent: 'Best', intro: 'Hand applied.' });
  });

  it('featuredHasBody needs more than a heading and a button', () => {
    const bare = featuredServiceOf({ featuredService: { serviceName: 'Paint Correction' }, services });
    expect(featuredHasBody(null, 'x.jpg')).toBe(false);
    expect(featuredHasBody(bare, '')).toBe(false);
    expect(featuredHasBody(bare, 'x.jpg')).toBe(true);
    expect(featuredHasBody({ ...bare, priceFrom: '$1' }, '')).toBe(true);
    expect(featuredHasBody({ ...bare, bullets: ['a'] }, '')).toBe(true);
    expect(featuredHasBody({ ...bare, intro: 'a' }, '')).toBe(true);
  });

  it('featuredTitleDefaults words protective services differently', () => {
    expect(featuredTitleDefaults('', false)).toEqual({});
    expect(featuredTitleDefaults('Ceramic Coating', false)).toEqual({ title: 'Protect Your Vehicle With Ceramic Coating', accent: 'Ceramic Coating' });
    expect(featuredTitleDefaults('PPF', true)).toEqual({ title: 'Protect Your Vehicle With PPF', accent: '' });
    expect(featuredTitleDefaults('Headlight Restore', false)).toEqual({ title: 'Ask About Our Headlight Restore', accent: 'Headlight Restore' });
  });
});

describe('makes / review helpers', () => {
  it('makesEyebrowDefault by business kind', () => {
    expect(makesEyebrowDefault('mobile_detailing')).toBe('We Detail All Vehicle Makes & Models');
    expect(makesEyebrowDefault('car_wash')).toBe('We Detail All Vehicle Makes & Models');
    expect(makesEyebrowDefault('tint_shop')).toBe('All Makes & Models Welcome');
    expect(makesEyebrowDefault('')).toBe('All Makes & Models Welcome');
  });

  it('makesRepeats fills a marquee row', () => {
    expect(makesRepeats(30)).toBe(1);
    expect(makesRepeats(16)).toBe(1);
    expect(makesRepeats(5)).toBe(4);
    expect(makesRepeats(1)).toBe(16);
    expect(makesRepeats(0)).toBe(16);
    expect(makesRepeats(3, 6)).toBe(2);
  });

  it('reviewStars only for Google reviews with a 1-5 rating', () => {
    expect(reviewStars({ source: 'google', rating: 5 })).toBe(5);
    expect(reviewStars({ source: 'google', rating: '4' })).toBe(4);
    expect(reviewStars({ source: 'google', rating: 4.5 })).toBe(4.5);
    expect(reviewStars({ source: 'google' })).toBe(0);
    expect(reviewStars({ source: 'google', rating: 6 })).toBe(0);
    expect(reviewStars({ source: 'google', rating: 0 })).toBe(0);
    expect(reviewStars({ rating: 5 })).toBe(0);
    expect(reviewStars({ source: 'yelp', rating: 5 })).toBe(0);
    expect(reviewStars(null)).toBe(0);
  });
});

describe('footerColumnsOf defaults / vehicleMakesFor defaults', () => {
  const SPEC_COLS = [{ type: 'brand', show: true }, { type: 'services', show: true }, { type: 'contact', show: true }, { type: 'areas', show: false }, { type: 'hours', show: false }];

  it('without a defaults argument behaves as before', () => {
    expect(footerColumnsOf(null)).toEqual(FOOTER_COLUMN_TYPES.map((type) => ({ type, title: '', show: true })));
    expect(footerColumnsOf({ columns: [{ type: 'services' }, { type: 'hours', title: ' Open ' }] }).map((c) => [c.type, c.title, c.show])).toEqual([
      ['hours', 'Open', true], ['brand', '', false], ['links', '', false], ['areas', '', false], ['contact', '', false],
    ]);
  });

  it("a design's defaults: its columns and show flags, owner order, unknown types dropped", () => {
    expect(footerColumnsOf(null, SPEC_COLS)).toEqual(SPEC_COLS.map((d) => ({ type: d.type, title: '', show: d.show })));
    expect(footerColumnsOf({ columns: 'x' }, SPEC_COLS).map((c) => c.type)).toEqual(['brand', 'services', 'contact', 'areas', 'hours']);
    const own = footerColumnsOf({ columns: [{ type: 'hours' }, { type: 'links' }, { type: 'brand', show: false }, { type: 'hours', show: false }] }, SPEC_COLS);
    expect(own.map((c) => [c.type, c.show])).toEqual([['hours', true], ['brand', false], ['services', false], ['contact', false], ['areas', false]]);
  });

  it('vehicleMakesFor: [] defaults mean no band without an owner list', () => {
    expect(vehicleMakesFor(undefined)).toBe(VEHICLE_MAKES);
    expect(vehicleMakesFor(undefined, [])).toEqual([]);
    expect(vehicleMakesFor(' , ', [])).toEqual([]);
    expect(vehicleMakesFor('BMW, vw, Rivian', []).map((m) => [m.id, Boolean(m.d)])).toEqual([['bmw', true], ['volkswagen', true], ['rivian', false]]);
  });
});

describe('footerPlan', () => {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  // MobileRedline's footer logic before it moved to footerPlan, kept here as
  // the reference the Redline spec must reproduce.
  function oldRedline(value, f) {
    const footer = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    const footShown = footerColumnsOf(value).filter((c) => c.show);
    const hoursMerged = footShown.some((c, i) => c.type === 'contact' && footShown[i + 1]?.type === 'hours');
    const hoursTitle = footShown.find((c) => c.type === 'hours')?.title || 'Hours';
    const footCtaUrl = str(footer?.ctaUrl);
    const cta = footer?.showCta !== false && (footCtaUrl || f.rendCta)
      ? { href: footCtaUrl || '#contact', label: str(footer?.ctaText) || 'Request Appointment', books: !footCtaUrl }
      : null;
    const cells = footShown.filter((c) => {
      if (c.type === 'brand') return f.brand;
      if (c.type === 'links') return f.links;
      if (c.type === 'areas') return f.areas;
      if (c.type === 'contact') return f.contact || cta || (hoursMerged && f.hours);
      return !hoursMerged && f.hours;
    });
    const fallback = { links: 'Explore', areas: 'Service Areas', contact: 'Get In Touch', hours: 'Hours' };
    return { cells: cells.map((c) => ({ type: c.type, title: c.title || fallback[c.type] || '' })), hoursMerged, hoursTitle, cta, bottomText: str(footer?.bottomText) };
  }
  const planFor = (value, f, spec = REDLINE_SPEC) => footerPlan({
    footer: value,
    spec,
    ctaFallback: f.rendCta ? '#contact' : null,
    has: (type, { cta, hoursMerged }) => ({
      brand: f.brand, links: f.links, areas: f.areas,
      contact: f.contact || Boolean(cta) || (hoursMerged && f.hours),
      hours: !hoursMerged && f.hours,
    })[type],
  });

  const FOOTERS = [
    undefined, null, [], 'x', {},
    { showCta: false },
    { showCta: true, ctaText: ' Book ', ctaUrl: ' https://example.com/book ' },
    { ctaUrl: '/book', bottomText: ' Licensed ' },
    { columns: [{ type: 'contact', title: 'Reach Us' }, { type: 'hours' }, { type: 'brand', show: false }, { type: 'links' }, { type: 'areas' }], showCta: false, bottomText: 'Licensed and insured' },
    { columns: [{ type: 'brand' }, { type: 'links' }, { type: 'areas' }, { type: 'contact' }, { type: 'hours' }], showCta: true },
    { columns: [{ type: 'contact' }, { type: 'links', title: 'Pages' }, { type: 'hours', title: 'Open' }, { type: 'brand' }] },
    { columns: [{ type: 'hours', title: 'Open' }, { type: 'contact' }] },
    { columns: [{ type: 'services' }, { type: 'contact', show: false }, { type: 'hours' }] },
    { columns: 'nope', showCta: 'yes' },
  ];
  const FACTS = [];
  for (const brand of [true, false]) for (const contact of [true, false]) for (const hours of [true, false]) for (const rendCta of [true, false]) {
    FACTS.push({ brand, links: !brand, areas: brand, contact, hours, rendCta });
  }

  it('the Redline spec reproduces the old Redline footer for every saved shape', () => {
    let n = 0;
    for (const value of FOOTERS) for (const f of FACTS) {
      const plan = planFor(value, f);
      const old = oldRedline(value, f);
      expect({ cells: plan.cells, hoursMerged: plan.hoursMerged, hoursTitle: plan.hoursTitle, cta: plan.cta, bottomText: plan.bottomText }, JSON.stringify({ value, f })).toEqual(old);
      n++;
    }
    expect(n).toBe(FOOTERS.length * FACTS.length);
  });

  it('Redline defaults: four columns, hours under Get In Touch, the button on', () => {
    const plan = planFor(undefined, { brand: true, links: true, areas: true, contact: true, hours: true, rendCta: true });
    expect(plan.builder).toBe(false);
    expect(plan.cells).toEqual([
      { type: 'brand', title: '' }, { type: 'links', title: 'Explore' }, { type: 'areas', title: 'Service Areas' }, { type: 'contact', title: 'Get In Touch' },
    ]);
    expect(plan.hoursMerged).toBe(true);
    expect(plan.cta).toEqual({ href: '#contact', label: 'Request Appointment', books: true });
    expect(planFor({ columns: [] }, { brand: true, rendCta: true }).builder).toBe(true);
  });

  // An opt-in design: no footer button and no merged hours until the owner
  // asks, and a 'services' column only because its spec lists it.
  const OPT_IN = {
    columns: [{ type: 'brand', show: true }, { type: 'services', show: true }, { type: 'contact', show: true }, { type: 'hours', show: true }, { type: 'areas', show: false }],
    titles: { services: 'Services', contact: 'Contact', hours: 'Hours', areas: 'Areas' },
    mergeHours: false,
    cta: false,
    ctaLabel: 'Book Now',
  };
  const all = () => true;

  it('an opt-in spec shows no button until showCta is true', () => {
    const plain = footerPlan({ footer: undefined, spec: OPT_IN, has: all, ctaFallback: '#contact' });
    expect(plain.cta).toBeNull();
    expect(plain.hoursMerged).toBe(false);
    expect(plain.cells.map((c) => c.type)).toEqual(['brand', 'services', 'contact', 'hours']);
    expect(footerPlan({ footer: { showCta: false }, spec: OPT_IN, has: all, ctaFallback: '#contact' }).cta).toBeNull();
    expect(footerPlan({ footer: { showCta: true }, spec: OPT_IN, has: all, ctaFallback: '#contact' }).cta).toEqual({ href: '#contact', label: 'Book Now', books: true });
    expect(footerPlan({ footer: { showCta: true, ctaUrl: 'https://x.test', ctaText: 'Go' }, spec: OPT_IN, has: all, ctaFallback: null }).cta).toEqual({ href: 'https://x.test', label: 'Go', books: false });
    // Nowhere to go: no button even when asked for.
    expect(footerPlan({ footer: { showCta: true }, spec: OPT_IN, has: all, ctaFallback: null }).cta).toBeNull();
  });

  it('titles fall back to the spec titles; the owner order and hidden columns hold', () => {
    const plan = footerPlan({ footer: { columns: [{ type: 'contact' }, { type: 'hours' }, { type: 'services', title: 'What We Do' }, { type: 'links' }] }, spec: OPT_IN, has: all });
    expect(plan.cells).toEqual([{ type: 'contact', title: 'Contact' }, { type: 'hours', title: 'Hours' }, { type: 'services', title: 'What We Do' }]);
    expect(plan.hoursMerged).toBe(false);
    expect(plan.hoursTitle).toBe('Hours');
    // 'services' is not in the Redline spec, so it never renders there.
    expect(planFor({ columns: [{ type: 'services' }, { type: 'contact' }] }, { contact: true }).cells.map((c) => c.type)).toEqual(['contact']);
  });

  it('has() decides which columns have something to show', () => {
    const plan = footerPlan({ footer: null, spec: OPT_IN, has: (type, ctx) => type === 'contact' || (type === 'hours' && !ctx.hoursMerged) });
    expect(plan.cells.map((c) => c.type)).toEqual(['contact', 'hours']);
    expect(footerPlan({ footer: { bottomText: '  Hi ' }, spec: OPT_IN, has: all }).bottomText).toBe('Hi');
  });
});
