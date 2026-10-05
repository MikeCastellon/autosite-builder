// The shared feature blocks: with ns="rl" each renders exactly the markup
// MobileRedline puts on the page (Redline is built from them), with another
// namespace every class / id / radio name moves to it, and each CSS
// generator follows the theme contract (no comments, no hard-coded colors,
// hover and motion inside their media queries, container breakpoints, every
// class and variable in the block's namespace).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LucideIcon, LUCIDE, HERO_PICK_ICONS } from './icons.jsx';
import { Accented } from './Accented.jsx';
import { HeroOffer, heroOfferCss, heroOfferLockCss, HERO_OFFER_LABELS } from './HeroOffer.jsx';
import { PackageBadge, PackagePhoto, PackageIncludes, packageDetailsCss } from './PackageDetails.jsx';
import { FeaturedBand, featuredBandCss } from './FeaturedBand.jsx';
import { MakesBand, makesBandCss } from './MakesBand.jsx';
import { EditorModeProvider } from './EditorMode.jsx';
import { heroOfferOf, makesEyebrowDefault } from './features.js';
import { telHref, phoneDisplay, businessKindOf, serviceIncludes } from './content.js';
import { vehicleMakesFor } from './vehicleMakes.js';
import Redline from '../mobile/MobileRedline.jsx';
import { FIXTURES } from '../__fixtures__/businesses.js';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import GOLDEN from './blocks.golden.json';

const ID = 'mobile_redline';
const html = (el) => renderToStaticMarkup(el);
const inEditor = (el) => html(createElement(EditorModeProvider, null, el));
const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

// MobileRedline rendered the way the publish path (and, with editor, the
// preview) renders it.
function redline(fx, editor = false) {
  const el = createElement(Redline, {
    businessInfo: normalizeBusinessInfo(fx.businessInfo),
    generatedCopy: fx.generatedCopy,
    templateMeta: buildTemplateMeta(ID, fx.customColors, fx.customFonts),
    images: fx.images || {},
  });
  return editor ? inEditor(el) : html(el);
}

// The hero card's input as MobileRedline builds it (name / price / summary of
// the owner's packages, else the AI list).
function heroInput(fx) {
  const biz = normalizeBusinessInfo(fx.businessInfo);
  const copy = fx.generatedCopy || {};
  const ai = (copy.servicesSection?.items || []).map((s) => (typeof s === 'string' ? { name: s } : s || {}));
  const src = (biz.packages || []).length > 0 ? biz.packages : ai;
  const services = src.map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), summary: txt(s.summary) }))
    .filter((s) => s.name || s.price);
  const tel = telHref(txt(biz.phone));
  const isDetail = /detail/.test(businessKindOf(biz.businessType));
  return {
    services, tel, phoneLabel: phoneDisplay(txt(biz.phone)), kind: businessKindOf(biz.businessType),
    labels: {
      sub1: isDetail ? 'Choose the detail package that fits your ride.' : 'Choose the package that fits your ride.',
      listTitle: isDetail ? 'Our Detail Packages' : 'Our Packages',
    },
  };
}

describe('icons / Accented', () => {
  it('LucideIcon draws a decorative lucide svg', () => {
    expect(html(<LucideIcon name="check" />)).toBe('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"></path></svg>');
    expect(html(<LucideIcon name="car" size={40} stroke={1.5} className="x-well" />)).toMatch(/^<svg class="x-well" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"/);
    for (const n of HERO_PICK_ICONS) expect(LUCIDE[n]).toBeTruthy();
  });

  it('Accented wraps the accent phrase, or returns the plain title', () => {
    expect(html(<h2><Accented title="Choose Your Package" accent="your package" className="ds-em" /></h2>)).toBe('<h2>Choose <span class="ds-em">Your Package</span></h2>');
    expect(html(<h2><Accented title="Choose Your Package" accent="Package" as="em" /></h2>)).toBe('<h2>Choose Your <em>Package</em></h2>');
    expect(html(<h2><Accented title="Choose Your Package" accent="Cards" className="x" /></h2>)).toBe('<h2>Choose Your Package</h2>');
    expect(html(<h2><Accented title="Choose Your Package" /></h2>)).toBe('<h2>Choose Your Package</h2>');
  });
});

describe('ns="rl" renders exactly what MobileRedline shows', () => {
  const fx = FIXTURES.full;
  const inp = heroInput(fx);

  it.each([false, true])('the price card (FIXTURES.full, editor=%s)', (editor) => {
    const { picks } = heroOfferOf({ services: inp.services, heroServices: fx.generatedCopy.heroServices, mode: 'quote' });
    expect(picks.length).toBeGreaterThan(0);
    const card = html(<HeroOffer ns="rl" mode="quote" picks={picks} bookHref={inp.tel} tel={inp.tel} phoneLabel={inp.phoneLabel} labels={inp.labels} />);
    expect(card.startsWith('<div class="rl-quote" id="quote">')).toBe(true);
    expect(redline(fx, editor)).toContain(`<div class="rl-quote-slot">${card}</div>`);
  });

  it('the list card, linking to the packages', () => {
    const list = { ...fx, generatedCopy: { ...fx.generatedCopy, heroCard: 'list' } };
    const { listPicks } = heroOfferOf({ services: inp.services, mode: 'list' });
    const card = html(<HeroOffer ns="rl" mode="list" picks={listPicks} bookHref={inp.tel} tel={inp.tel} phoneLabel={inp.phoneLabel} listCta={{ href: '#services', label: 'See All Packages' }} labels={inp.labels} />);
    expect(card).toContain('class="rl-quote rl-hlist"');
    expect(redline(list)).toContain(`<div class="rl-quote-slot">${card}</div>`);
  });

  it('the list card that books when the packages are hidden', () => {
    const list = { ...fx, generatedCopy: { ...fx.generatedCopy, heroCard: 'list', hiddenSections: ['services'] } };
    const { listPicks } = heroOfferOf({ services: inp.services, mode: 'list' });
    const card = html(<HeroOffer ns="rl" mode="list" picks={listPicks} bookHref={inp.tel} tel={inp.tel} phoneLabel={inp.phoneLabel} listCta={{ href: inp.tel, label: 'Book Now', books: true }} labels={inp.labels} />);
    expect(card).toContain(`<a class="rl-hl-cta" href="${inp.tel}" data-scheduler-trigger="">Book Now`);
    expect(redline(list)).toContain(card);
  });

  it('the makes band', () => {
    const band = html(<MakesBand ns="rl" eyebrow={makesEyebrowDefault(inp.kind)} makes={vehicleMakesFor(fx.generatedCopy.vehicleMakes)} />);
    expect(redline(fx)).toContain(`aria-label="Vehicle makes" tabindex="0" style="order:3">${band}</section>`);
    const own = { ...fx, generatedCopy: { ...fx.generatedCopy, vehicleMakes: 'BMW, Rivian' } };
    const short = html(<MakesBand ns="rl" eyebrow={makesEyebrowDefault(inp.kind)} makes={vehicleMakesFor('BMW, Rivian')} />);
    expect(short).toContain('rl-mq-rep');
    expect(redline(own)).toContain(short);
  });

  // A small business with every package detail and a featured band.
  const PKG = {
    businessInfo: {
      businessName: 'Kit Test Detailing',
      businessType: 'mobile_detailing',
      phone: '(407) 555-0100',
      city: 'Orlando',
      services: [
        { name: 'Refresh', price: '$120', image: 'https://example.com/refresh.jpg', includes: ['Interior:', 'Vacuum', { text: 'Leather care', highlight: true }] },
        { name: 'Signature', price: '$180', badge: 'Most Popular', summary: 'Our most booked' },
      ],
    },
    generatedCopy: { headline: 'Kit test', featuredService: { serviceName: 'Signature', priceFrom: '$450', bullets: ['Deep gloss', 'Easier washing'] } },
    images: { featured: 'https://example.com/featured.jpg' },
    customColors: {},
    customFonts: {},
  };
  const tel = telHref(PKG.businessInfo.phone);

  it.each([false, true])('package badge, photo, well and includes (editor=%s)', (editor) => {
    const page = redline(PKG, editor);
    const render = editor ? inEditor : html;
    expect(page).toContain(html(<PackageBadge ns="rl" text="Most Popular" />));
    expect(page).toContain(render(<PackagePhoto ns="rl" src="https://example.com/refresh.jpg" alt="Refresh" anyPhoto editor={editor} />));
    const empty = render(<PackagePhoto ns="rl" src="" alt="Signature" anyPhoto editor={editor} />);
    expect(empty).toContain(editor ? 'data-acg-editor-only' : 'rl-card-well');
    expect(page).toContain(empty);
    expect(page).toContain(html(<PackageIncludes ns="rl" items={serviceIncludes(PKG.businessInfo.services[0].includes)} />));
    expect(html(<PackagePhoto ns="rl" src="" alt="x" anyPhoto={false} editor={editor} />)).toBe('');
  });

  it('the featured band', () => {
    const band = html(
      <FeaturedBand
        ns="rl"
        image={PKG.images.featured}
        alt="Signature by Kit Test Detailing"
        heading={<h2 className="rl-h2 rl-feat-h"><Accented title="Ask About Our Signature" accent="Signature" className="rl-em" /></h2>}
        priceFrom="$450"
        price="$180"
        bullets={['Deep gloss', 'Easier washing']}
        button={<a className="rl-btn" href={tel} data-scheduler-trigger="" data-scheduler-service="Signature">Book Signature<LucideIcon name="arrowRight" /></a>}
      />,
    );
    expect(band.startsWith('<div class="rl-in rl-feat-grid rl-duo"><div class="rl-feat-photo">')).toBe(true);
    expect(band).toContain('Starting at <strong>$450</strong>');
    expect(redline(PKG)).toContain(band);
  });
});

// Frozen reference: what MobileRedline rendered for GOLDEN_INPUT before its
// feature markup moved into these blocks (commit 02b47c8, blocks.golden.json).
// Redline now renders through the blocks, so the tests above cannot catch a
// block change that also changes Redline's page; these can.
const GOLDEN_INPUT = {
  services: [
    { name: 'Refresh', price: '$120', summary: 'Inside and out', image: 'https://example.com/refresh.jpg', includes: ['Interior:', 'Vacuum', { text: 'Leather care', highlight: true }] },
    { name: 'Signature', price: 'From $180', summary: '', badge: 'Most Popular' },
  ],
  tel: 'tel:4075550100',
  phoneLabel: '407-555-0100',
  labels: { sub1: 'Choose the detail package that fits your ride.', listTitle: 'Our Detail Packages' },
};

describe('ns="rl" still renders the frozen Redline markup', () => {
  const g = GOLDEN_INPUT;
  const { picks } = heroOfferOf({ services: g.services, mode: 'quote' });
  const { listPicks } = heroOfferOf({ services: g.services, mode: 'list' });

  it('golden file sanity', () => {
    expect(GOLDEN._about).toMatch(/02b47c8/);
    expect(picks.map((s) => s.name)).toEqual(['Refresh', 'Signature']);
  });

  it('HeroOffer (price card and list card)', () => {
    expect(html(<HeroOffer ns="rl" mode="quote" picks={picks} bookHref={g.tel} tel={g.tel} phoneLabel={g.phoneLabel} labels={g.labels} />)).toBe(GOLDEN.quote);
    expect(html(<HeroOffer ns="rl" mode="list" picks={listPicks} bookHref={g.tel} tel={g.tel} phoneLabel={g.phoneLabel} listCta={{ href: '#services', label: 'See All Packages' }} labels={g.labels} />)).toBe(GOLDEN.list);
  });

  it('MakesBand', () => {
    expect(html(<MakesBand ns="rl" eyebrow={makesEyebrowDefault('mobile_detailing')} makes={vehicleMakesFor('Audi, Rivian')} />)).toBe(GOLDEN.makes);
  });

  it('PackageBadge / PackagePhoto / PackageIncludes', () => {
    expect(html(<PackageBadge ns="rl" text="Most Popular" />)).toBe(GOLDEN.badge);
    expect(html(<PackagePhoto ns="rl" src={g.services[0].image} alt="Refresh" anyPhoto editor={false} />)).toBe(GOLDEN.photo);
    expect(html(<PackagePhoto ns="rl" src="" alt="Signature" anyPhoto editor={false} />)).toBe(GOLDEN.well);
    expect(inEditor(<PackagePhoto ns="rl" src="" alt="Signature" anyPhoto editor />)).toBe(GOLDEN.slot);
    expect(html(<PackageIncludes ns="rl" items={serviceIncludes(g.services[0].includes)} />)).toBe(GOLDEN.includes);
  });

  it('FeaturedBand', () => {
    expect(html(
      <FeaturedBand
        ns="rl"
        image="https://example.com/featured.jpg"
        alt="Signature by Kit Test Detailing"
        heading={<h2 className="rl-h2 rl-feat-h"><Accented title="Ask About Our Signature" accent="Signature" className="rl-em" /></h2>}
        priceFrom="$450"
        price="From $180"
        bullets={['Deep gloss']}
        button={<a className="rl-btn" href={g.tel} data-scheduler-trigger="" data-scheduler-service="Signature">Book Signature<LucideIcon name="arrowRight" /></a>}
      />,
    )).toBe(GOLDEN.featured);
  });
});

describe('another namespace', () => {
  const picks = [{ name: 'Wash', price: '$40', summary: 'Quick' }, { name: 'Detail', price: 'Starting at $1,299', summary: '' }];

  it('HeroOffer moves every class, id and radio name to ns', () => {
    const q = html(<HeroOffer ns="xx-hq" mode="quote" picks={picks} bookHref="#contact" tel="tel:+15550001111" phoneLabel="555-000-1111" labels={{ q1: 'Pick One', book: 'Reserve' }} />);
    expect(q).not.toMatch(/rl-/);
    for (const s of ['id="quote"', 'name="xx-hq-pkg"', 'id="xx-hq-pkg-0"', 'for="xx-hq-pkg-1"', 'id="xx-hq-go"', 'for="xx-hq-go"', 'class="xx-hq-sr xx-hq-radio"', 'xx-hq-opt-price xx-hq-opt-price-t', 'class="xx-hq-res xx-hq-pk-1"', '>Pick One</h2>', '>Reserve<', 'data-scheduler-service="Detail"', 'class="xx-hq-q-call" href="tel:+15550001111"']) {
      expect(q).toContain(s);
    }
    for (const [k, v] of Object.entries(HERO_OFFER_LABELS)) if (!['q1', 'book', 'listTitle'].includes(k)) expect(q).toContain(k === 'your' ? `${v} <span>` : v);
    const l = html(<HeroOffer ns="xx-hq" mode="list" picks={picks} listCta={{ href: '#services', label: 'All' }} />);
    expect(l).not.toMatch(/rl-|xx-hq-q-call/);
    expect(l).toContain('class="xx-hq-quote xx-hq-hlist" id="quote"');
    expect(l).toContain('<a class="xx-hq-hl-cta" href="#services">All');
  });

  it('HeroOffer renders nothing without a mode or picks', () => {
    expect(html(<HeroOffer ns="xx-hq" mode="off" picks={picks} />)).toBe('');
    expect(html(<HeroOffer ns="xx-hq" mode="quote" picks={[]} />)).toBe('');
    expect(html(<HeroOffer ns="xx-hq" mode="list" />)).toBe('');
  });

  it('the other blocks too', () => {
    const out = [
      html(<PackageBadge ns="xx-pk" text="New" />),
      html(<PackagePhoto ns="xx-pk" src="" alt="" anyPhoto editor={false} />),
      html(<PackageIncludes ns="xx-pk" items={serviceIncludes(['Inside:', { text: 'Vacuum', highlight: true }])} label="Included" />),
      html(<FeaturedBand ns="xx-ft" intro="Hand applied." priceFrom="Call for quote" bullets={['a']} />),
      html(<MakesBand ns="xx-mk" eyebrow="Makes" makes={vehicleMakesFor('BMW, Rivian')} />),
    ].join('');
    expect(out).not.toMatch(/rl-/);
    for (const s of ['class="xx-pk-badge"', 'xx-pk-card-photo xx-pk-card-well', 'class="xx-pk-inc"', '>Included<', 'class="xx-pk-chev"', 'class="xx-pk-inc-h"', 'class="xx-pk-inc-hl"',
      'class="xx-ft-in xx-ft-feat-grid xx-ft-feat-solo"', '<p class="xx-ft-feat-price"><strong>Call for quote</strong></p>', 'class="xx-ft-feat-list"',
      'id="xx-mk-mk-bmw"', 'href="#xx-mk-mk-bmw"', 'class="xx-mk-mq-t">Rivian', 'xx-mk-mq-item xx-mk-mq-rep']) {
      expect(out).toContain(s);
    }
    expect(html(<FeaturedBand ns="xx-ft" price="$90" />)).toContain('<p class="xx-ft-feat-price"><strong>$90</strong></p>');
  });
});

// A tiny CSS reader: every rule with its selector and the at-rules around it.
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

describe.each([
  ['heroOfferCss', 'xx-hq', heroOfferCss],
  ['heroOfferCss (stackFrom 1024)', 'xx-hq', (ns) => heroOfferCss(ns, { stackFrom: 1024 })],
  ['heroOfferCss (scoped lock)', 'xx-hq', (ns) => heroOfferCss(ns, { stackFrom: 900, scope: `.${ns}-grid,.${ns}-split` })],
  ['heroOfferLockCss', 'xx-hq', (ns) => heroOfferLockCss(ns, { from: 781, scope: `.${ns}-pair` })],
  ['packageDetailsCss', 'xx-pk', packageDetailsCss],
  ['featuredBandCss', 'xx-ft', featuredBandCss],
  ['makesBandCss', 'xx-mk', makesBandCss],
])('%s hygiene', (_, ns, gen) => {
  const css = gen(ns);
  const rules = cssRules(css);

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
      if (r.at.some((a) => a.startsWith('@keyframes'))) continue;
      for (const m of r.selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) expect(m[1].startsWith(`${ns}-`), `${r.selector}`).toBe(true);
    }
    for (const m of css.matchAll(/var\(--([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`), m[0]).toBe(true);
    for (const m of css.matchAll(/@keyframes ([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`)).toBe(true);
  });
});

it('heroOfferCss stacks the card from the given width', () => {
  expect(heroOfferCss('xx-hq')).toContain('@container (min-width:900px){\n@supports');
  expect(heroOfferCss('xx-hq', { stackFrom: 1024 })).toContain('@container (min-width:1024px){\n@supports');
  // stackFrom 0: no lock at all.
  expect(heroOfferCss('xx-hq', { stackFrom: 0 })).not.toContain('grid-area:1/1');
  // The lock alone is the same block heroOfferCss carries.
  expect(heroOfferCss('xx-hq', { stackFrom: 1024 })).toContain(heroOfferLockCss('xx-hq', { from: 1024 }));
});

it('heroOfferCss scopes the lock to the layouts the theme names', () => {
  const lock = heroOfferLockCss('xx-hq', { from: 900, scope: '.xx-hq-grid, .xx-hq-split' });
  const rules = cssRules(lock);
  expect(rules.length).toBe(7);
  for (const r of rules) {
    for (const sel of r.selector.split(',')) expect(sel.trim(), sel).toMatch(/^\.xx-hq-(grid|split) \.xx-hq-/);
  }
  // Both scopes get every selector of the unscoped lock.
  const plain = cssRules(heroOfferLockCss('xx-hq', { from: 900 }));
  rules.forEach((r, i) => expect(r.selector.split(',').length).toBe(plain[i].selector.split(',').length * 2));
  expect(heroOfferCss('xx-hq', { stackFrom: 900, scope: '.xx-hq-grid, .xx-hq-split' })).toContain(lock);
});
