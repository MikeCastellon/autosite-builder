// mobile_sudsy and the kit's feature blocks (CLAUDE.md "Feature blocks"):
// the hero services card, Google rating badge, footer builder, package
// details, headings, featured-service band, vehicle-makes band, service areas
// / insured and Google review labels. This design has live sites, so every
// feature is opt-in: it renders only from data the owner saved, in this
// design's look, and a site without the new keys renders exactly as before
// (the rollout's byte-for-byte check against the pre-change renders lives
// outside the repo; these tests pin the parts that matter).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './MobileSudsy.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { FIXTURES, FIXTURE_IMAGES, CUSTOM_COLORS } from '../__fixtures__/businesses.js';
import { contrastRatio, ensureContrast, mix, rgbToHex } from '../kit/theme.js';
import { GOOGLE_STAR_GOLD } from '../kit/GoogleRatingBadge.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';

const Sudsy = mod.default;
const ID = 'mobile_sudsy';
const SOURCE = readFileSync(new URL('./MobileSudsy.jsx', import.meta.url), 'utf8');

// Same list as templates.render.test.jsx BANNED_CLAIMS (keep in sync).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[★☆⭐]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');
const LOW_CONTRAST_COLORS = { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' };

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
// The rendered elements without the <style> blocks (whose selectors name
// every class), and the template's own style string.
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const styleOf = (html) => html.match(/<div id="top" class="ss-root"[^>]*><style>([\s\S]*?)<\/style>/)[1];
const rootVars = (html) => {
  const style = decode(html.match(/<div id="top" class="ss-root" style="([^"]*)"/)[1]);
  const out = {};
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
  }
  return out;
};
const openTag = (html, id) => (html.match(new RegExp(`<[a-z]+\\b[^>]*\\bdata-section="${id}"[^>]*>`)) || [null])[0];
const orderOf = (html, id) => Number(openTag(html, id).match(/order:\s*(-?\d+)/)[1]);
const sectionHtml = (html, id) => {
  const start = html.indexOf(openTag(html, id));
  const end = html.indexOf('</section>', start);
  return html.slice(start, end);
};

function render(fx, { editor = false, copy, biz, images, colors } = {}) {
  const el = createElement(Sudsy, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, colors || fx.customColors || {}, fx.customFonts || {}),
    images: images || fx.images || {},
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

// A saved site from before the features: a mobile detailer with packages,
// free-text service area, per-day hours and AI testimonials, no new keys.
const PER_DAY = { Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '8am-4pm', Sun: '' };
const LEGACY = {
  businessInfo: {
    businessName: 'Bubble Test Detailing',
    businessType: 'mobile_detailing',
    phone: '(407) 555-0123',
    email: 'hi@example.com',
    city: 'Orlando',
    state: 'FL',
    serviceArea: 'Orlando, Kissimmee, Lake Nona',
    hours: PER_DAY,
    awards: [],
    packages: [
      { name: 'Refresh Detail', price: '$120', description: 'Vacuum, windows and a foam hand wash.' },
      { name: 'Ceramic Coating', price: '$600', description: 'Long-lasting protection.' },
    ],
  },
  generatedCopy: {
    headline: 'Clean Cars, Happy Drivers',
    subheadline: 'We come to you.',
    aboutText: 'We wash cars.',
    servicesSection: { title: 'Our Packages', intro: '  Pick the one that fits.  ' },
    testimonialPlaceholders: [{ name: 'Ana P.', text: 'Great job.' }, { name: 'Ben Q.', text: 'On time.', role: 'Tesla owner' }],
  },
  images: { about: FIXTURE_IMAGES.about },
};
const PLACE = { placeId: 'ChIJsudsy-test', placeName: 'Bubble Test Detailing', rating: 4.8, reviewCount: 52, url: 'https://maps.example.com/sudsy' };
const LEGACY_GPLACE = { ...LEGACY, businessInfo: { ...LEGACY.businessInfo, googlePlace: PLACE } };

// Every feature on (the replica's shape): all five badge spots, an owner
// footer, headings, package details, a featured service, makes, areas.
const PKGS = [
  { name: 'Refresh Detail', price: '$120', description: 'A quick inside-and-out refresh.', summary: 'Essential refresh', includes: ['Interior:', 'Vacuum', 'Windows', 'Exterior:', 'Foam Hand Wash'], image: FIXTURE_IMAGES.gallery0 },
  { name: 'Signature Detail', price: '$180', description: 'Our most popular detail.', summary: 'Full detail + wax', badge: 'Most Popular', includes: ['Interior:', 'Vacuum', { text: 'Leather Treatment', highlight: true }] },
  { name: 'Premium Detail', price: '$260', description: 'Steam cleaning and shampoo.', summary: 'Deep clean' },
  { name: 'Ceramic Coating', price: 'Call for quote' },
];
const RICH = {
  businessInfo: {
    ...LEGACY.businessInfo,
    serviceArea: 'Orlando and nearby',
    serviceAreas: ['Lake Nona', 'Kissimmee', 'Winter Park'],
    insured: true,
    googlePlace: PLACE,
    services: PKGS,
    packages: PKGS,
  },
  generatedCopy: {
    ...LEGACY.generatedCopy,
    headline: "Orlando's Most Trusted Mobile Detail",
    servicesSection: { title: 'Choose Your Detail Package', intro: 'Pick one.' },
    heroCard: 'quote',
    heroServices: ['Premium Detail', 'Refresh Detail'],
    googleBadge: { placements: ['hero', 'nav', 'about', 'reviews', 'footer'] },
    footer: {
      columns: [{ type: 'brand' }, { type: 'contact', title: 'Reach Us' }, { type: 'hours' }, { type: 'links' }, { type: 'areas' }, { type: 'services', show: false }],
      showCta: true,
      ctaText: 'Book a Visit',
      bottomText: 'Licensed and insured',
    },
    sectionTitles: {
      hero: { eyebrow: 'Mobile detailing in Orlando', accent: 'Most Trusted' },
      services: { eyebrow: 'Service Menu', accent: 'Detail Package' },
      brands: { eyebrow: 'Every make welcome' },
      featured: { eyebrow: 'Signature Service' },
      process: { intro: 'Booking takes a minute.' },
      cta: { accent: 'Book?' },
    },
    featuredService: { serviceName: 'Ceramic Coating', priceFrom: '$450', bullets: ['Deep gloss', 'Easier washing'] },
    vehicleMakes: ['BMW', 'Porsche', 'Rivian', 'Batmobile'],
    testimonialPlaceholders: [
      { name: 'Ana P.', text: 'Great job on my SUV.', source: 'google', rating: 5 },
      { name: 'Ben Q.', text: 'On time and careful.', role: 'Tesla owner' },
      { name: 'Cy R.', text: 'Would book again.', source: 'google' },
    ],
    ctaHeadline: 'Ready To Book?',
  },
  images: { ...FIXTURE_IMAGES, featured: FIXTURE_IMAGES.about, cta: FIXTURE_IMAGES.gallery2 },
};

// Markers only the feature blocks produce.
const NEW_MARKUP = /data-section="(brands|featured)"|class="[^"]*\b(ss-(hq|pk|ft|mk)-[\w-]+|ss-gpill|ss-ctaph|ss-fb|ss-rev-src|ss-rev-stars|ss-foot-note|ss-foot-cta|acg-gbadge[\w-]*|ss-card-feat|ss-card-ph)\b|id="quote"|--ss-ctaph-/;
const NEW_CSS = /\.ss-(hq|pk|ft|mk)-|\.ss-gpill|\.ss-ctaph|\.ss-fb\b|\.ss-rev-stars/;

const OLD_SITES = {
  sparse: FIXTURES.sparse,
  full: FIXTURES.full,
  custom: FIXTURES.custom,
  legacy: LEGACY,
  legacy_gplace: LEGACY_GPLACE,
};

describe('mobile_sudsy: a site without the new keys renders as before', () => {
  const cases = Object.keys(OLD_SITES).flatMap((name) => [[name, 'published'], [name, 'editor']]);

  it.each(cases)('%s (%s): no feature markup, CSS or root variables', (name, mode) => {
    const html = decode(render(OLD_SITES[name], { editor: mode === 'editor' }));
    expect(markup(html)).not.toMatch(NEW_MARKUP);
    expect(styleOf(html)).not.toMatch(NEW_CSS);
    expect(Object.keys(rootVars(html)).filter((k) => /ctaph/.test(k))).toEqual([]);
    const text = visibleText(html);
    for (const s of ['Fully insured', 'We cover!', 'Google review', 'Read more reviews', 'Pick your package!']) expect(text).not.toContain(s);
  });

  it('keeps the cartoon car in a photo-less hero (no services card by default)', () => {
    for (const editor of [false, true]) {
      const html = render(LEGACY, { editor, images: {} });
      expect(html).toContain('class="ss-art"');
      expect(html).not.toContain('ss-hq-slot');
    }
  });

  it('features no service on its own: a saved Ceramic Coating package makes no band', () => {
    for (const editor of [false, true]) {
      expect(openTag(render(LEGACY, { editor }), 'featured')).toBeNull();
      expect(openTag(render(FIXTURES.full, { editor }), 'featured')).toBeNull();
    }
  });

  it('shows no Google badge from a connected place alone', () => {
    for (const editor of [false, true]) {
      const html = render(LEGACY_GPLACE, { editor });
      expect(html).not.toContain('acg-gbadge');
      expect(visibleText(html)).not.toMatch(/Google/);
    }
  });

  it('ignores empty or unknown values of the new keys', () => {
    const copy = { footer: null, sectionTitles: {}, googleBadge: { placements: [] }, heroCard: 'bogus', vehicleMakes: [], featuredService: { serviceName: '  ' } };
    for (const editor of [false, true]) {
      const before = render(LEGACY_GPLACE, { editor });
      expect(render(LEGACY_GPLACE, { editor, copy, biz: { insured: false } })).toBe(before);
    }
  });

  // The design's headings, captured from the pre-change module: the shared
  // Accented helper must give exactly the same markup for the defaults.
  const H2 = {
    cleaning: {
      services: '<h2 id="ss-services-h" class="ss-h2">We clean <em>everything.</em></h2>',
      process: '<h2 id="ss-how-h" class="ss-h2">How it <em>works</em> <span aria-hidden="true">🤔</span></h2>',
      whyUs: '<h2 id="ss-why-h" class="ss-h2">We’re kinda <em>obsessed</em> with clean cars.</h2>',
      gallery: '<h2 id="ss-gallery-h" class="ss-h2">Fresh out of the <em>suds.</em></h2>',
      testimonials: '<h2 id="ss-reviews-h" class="ss-h2">They used to have <em>dirty cars</em> too.</h2>',
      cta: '<h2 id="ss-contact-h" class="ss-h2">Ready for the cleanest car of your life?</h2>',
    },
    other: {
      services: '<h2 id="ss-services-h" class="ss-h2">What we <em>do best.</em></h2>',
      process: '<h2 id="ss-how-h" class="ss-h2">How it <em>works</em> <span aria-hidden="true">🤔</span></h2>',
      whyUs: '<h2 id="ss-why-h" class="ss-h2">Why folks <em>choose us.</em></h2>',
      gallery: '<h2 id="ss-gallery-h" class="ss-h2">Our latest <em>work.</em></h2>',
      testimonials: '<h2 id="ss-reviews-h" class="ss-h2">Word on the <em>street.</em></h2>',
      cta: '<h2 id="ss-contact-h" class="ss-h2">Get a Free Quote</h2>',
    },
  };
  it.each([['detailing_shop', 'cleaning'], ['mobile_detailing', 'cleaning'], ['', 'cleaning'], ['tint_shop', 'other']])(
    'renders the design\'s default headings unchanged (%s)',
    (businessType, kind) => {
      const copy = { servicesSection: { ...FIXTURES.full.generatedCopy.servicesSection, title: '' } };
      const html = render(FIXTURES.full, { biz: { businessType }, copy });
      for (const [id, h2] of Object.entries(H2[kind])) expect({ id, has: html.includes(h2) }).toEqual({ id, has: true });
      expect(html).toContain('<h2 id="ss-about-h" class="ss-h2">AutoSite Demo Shop</h2>');
    },
  );

  it('keeps an owner services heading and the raw intro as plain text', () => {
    const html = render(LEGACY);
    expect(html).toContain('<h2 id="ss-services-h" class="ss-h2">Our Packages</h2>');
    expect(html).toContain('<p class="ss-sub">  Pick the one that fits.  </p>');
    expect(html).toContain('<h1 class="ss-h1">Clean Cars, Happy <span class="ss-hl">Drivers</span></h1>');
  });

  it('gives the older sections their old order values; added ids tie with their predecessor', () => {
    const legacyIds = mod.sections.map((s) => s.id).filter((id) => !mod.addedSections.includes(id));
    for (const fx of [FIXTURES.full, FIXTURES.custom, { ...LEGACY, generatedCopy: { ...LEGACY.generatedCopy, sectionOrder: ['about', 'hero', 'services'] } }]) {
      const html = render({ ...fx, generatedCopy: { ...fx.generatedCopy, vehicleMakes: ['BMW'], featuredService: { serviceName: 'Full Detail', priceFrom: '$99' } } });
      const legacyOrder = buildSectionOrder(fx.generatedCopy, legacyIds);
      for (const id of legacyIds) if (openTag(html, id)) expect({ id, order: orderOf(html, id) }).toEqual({ id, order: legacyOrder(id) });
      if (openTag(html, 'brands') && openTag(html, 'hero')) expect(orderOf(html, 'brands')).toBe(orderOf(html, 'hero'));
      if (openTag(html, 'featured') && openTag(html, 'services')) expect(orderOf(html, 'featured')).toBe(orderOf(html, 'services'));
    }
  });
});

describe('mobile_sudsy: features from owner data', () => {
  const pub = render(RICH);
  const edit = render(RICH, { editor: true });

  it('publishes no editor text or invented claims', () => {
    expect(pub).not.toContain('data-acg-editor-only');
    expect(visibleText(pub)).not.toMatch(BANNED_CLAIMS);
    expect(decode(pub)).not.toMatch(/Edit >|Edit &gt;/);
    for (const hint of Object.values(PHOTO_HINTS)) expect(decode(pub)).not.toContain(hint);
  });

  it('appends each block\'s CSS only while it renders', () => {
    const css = styleOf(pub);
    for (const ns of ['ss-hq', 'ss-pk', 'ss-ft', 'ss-mk']) expect(css).toContain(`.${ns}-`);
    expect(css).toContain('.ss-gpill');
    const onlyMakes = styleOf(render(LEGACY, { copy: { vehicleMakes: ['BMW'] } }));
    expect(onlyMakes).toContain('.ss-mk-mq');
    expect(onlyMakes).not.toMatch(/\.ss-hq-steps\{|\.ss-pk-inc-h\{|\.ss-ft-feat-grid\{/);
  });

  describe('hero services card', () => {
    it('shows the owner\'s picks, in order, in the photo hero grid', () => {
      const hero = pub.slice(pub.indexOf('data-section="hero"'), pub.indexOf('data-section="brands"'));
      expect(hero).toContain('class="ss-wrap ss-hq-grid"');
      expect(hero).toContain('id="quote"');
      const names = [...hero.matchAll(/class="ss-hq-opt-name">([^<]+)</g)].map((m) => m[1]);
      expect(names).toEqual(['Premium Detail', 'Refresh Detail']);
      expect(hero).toContain('Pick your package!');
      expect(hero).toContain('Show My Price!');
      expect(hero).toContain('data-scheduler-service="Premium Detail"');
    });

    it('takes the car art\'s place without a hero photo, and sits under the copy in the split hero', () => {
      const noPhoto = render(RICH, { images: {} });
      expect(noPhoto).toContain('class="ss-hq-slot"');
      expect(noPhoto).not.toContain('class="ss-art"');
      const split = render(RICH, { copy: { heroLayout: 'split' } });
      // Its own grid item after the photo: over the photo column from
      // 900px, under the hero below that, right after the copy when stacked.
      expect(split).toContain('class="ss-split ss-split-offer"');
      expect(split).toMatch(/<div class="ss-split-text">((?!ss-hq-slot)[\s\S])*<div class="ss-split-photo">[\s\S]*?class="ss-hq-slot"/);
    });

    it('lists packages in list mode and shows nothing when off', () => {
      const list = render(RICH, { copy: { heroCard: 'list', heroServices: undefined } });
      expect(list).toContain('class="ss-hq-quote ss-hq-hlist"');
      expect(list).toContain('See all services');
      const off = render(RICH, { copy: { heroCard: 'off' } });
      expect(off).not.toContain('id="quote"');
      expect(styleOf(off)).not.toContain('.ss-hq-steps{');
    });

    it('needs a priced package for the price card; the editor says why', () => {
      const copy = { heroServices: ['Ceramic Coating'] };
      const services = PKGS.map((s) => ({ ...s, price: '' }));
      const p = render(RICH, { copy, biz: { services, packages: services } });
      const e = render(RICH, { copy, biz: { services, packages: services }, editor: true });
      expect(p).not.toContain('id="quote"');
      expect(e).not.toContain('id="quote"');
      expect(decode(e)).toContain('Your price card needs services with a price (Edit &gt; Services).');
      expect(p).not.toContain('Your price card needs');
    });
  });

  describe('Google rating badge', () => {
    it('shows in each spot the owner switched on', () => {
      for (const cls of ['ss-hero-g', 'ss-nav-g', 'ss-about-g', 'ss-rev-g', 'ss-foot-g']) expect(pub).toContain(`class="${cls}"`);
      expect(pub.match(/class="acg-gbadge acg-gbadge-pill ss-gpill"/g)).toHaveLength(3);
      expect(decode(pub)).toContain('href="https://maps.example.com/sudsy"');
    });

    it('shows only where switched on, and nowhere without a rating', () => {
      const html = render(RICH, { copy: { googleBadge: { placements: ['about'] } } });
      expect(html).toContain('class="ss-about-g"');
      for (const cls of ['ss-hero-g', 'ss-nav-g', 'ss-rev-g', 'ss-foot-g']) expect(html).not.toContain(`class="${cls}"`);
      expect(markup(render(RICH, { biz: { googlePlace: { placeId: 'x', rating: 4.8 } } }))).not.toContain('acg-gbadge');
    });

    it('moves the footer rating to the bottom line when the brand column is off', () => {
      const footer = { columns: [{ type: 'brand', show: false }, { type: 'links' }] };
      const html = render(RICH, { copy: { footer, googleBadge: { placements: ['footer'] } } });
      expect(html).not.toContain('class="ss-foot-about"');
      expect(html).toMatch(/<div class="ss-foot-bottom"><p>©[\s\S]*?<\/p><a class="acg-gbadge acg-gbadge-inline/);
    });
  });

  describe('footer builder', () => {
    const foot = pub.slice(pub.indexOf('<footer'));

    it('renders the owner\'s columns, order and titles, with the button and bottom line', () => {
      const titles = [...foot.matchAll(/<p class="ss-foot-h">([^<]+)<\/p>/g)].map((m) => decode(m[1]));
      expect(titles).toEqual(['Reach Us', 'Hours', 'Explore', 'Service Areas']);
      expect(foot).toContain('class="ss-foot-about"');
      expect(foot).toContain('class="ss-foot-grid ss-fb"');
      expect(foot).toContain('--ss-fcols:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)');
      expect(foot).toMatch(/<a class="ss-btn ss-btn-primary ss-foot-cta" href="#contact" data-scheduler-trigger="">Book a Visit<\/a>/);
      expect(foot).toContain('<li>Mon–Fri 8am – 6pm</li>');
      expect(foot).toContain('<li>Winter Park</li>');
      // The copyright stays the footer's last <p> (exportHtml appends the
      // owner link to it); the owner's bottom line is a <div>.
      expect(foot).toMatch(/All rights reserved\.<\/p><div class="ss-foot-note">Licensed and insured<\/div><a class="ss-top"/);
    });

    it('keeps the design\'s footer without copy.footer: brand, Explore, Services, Say Hi! and no button', () => {
      const html = render(LEGACY);
      const titles = [...html.matchAll(/<p class="ss-foot-h">([^<]+)<\/p>/g)].map((m) => m[1]);
      expect(titles).toEqual(['Explore', 'Services', 'Say Hi!']);
      expect(html).not.toContain('ss-foot-cta');
    });

    it('shows the Services column only when the design or the owner shows it', () => {
      const titles = (footer) => [...render(LEGACY, { copy: { footer } }).matchAll(/<p class="ss-foot-h">([^<]+)<\/p>/g)].map((m) => m[1]);
      expect(titles({})).toEqual(['Explore', 'Services', 'Say Hi!']);
      expect(titles({ columns: [{ type: 'services', show: false }, { type: 'links' }, { type: 'contact' }] })).toEqual(['Explore', 'Say Hi!']);
      // A column list without it: the type is appended, hidden.
      expect(titles({ columns: [{ type: 'contact' }, { type: 'links' }] })).toEqual(['Say Hi!', 'Explore']);
      expect(titles({ columns: [{ type: 'services', title: 'What We Do' }] })).toEqual(['What We Do']);
      // Hidden from the page, it has nothing to link to.
      expect(render(LEGACY, { copy: { hiddenSections: ['services'] } })).not.toContain('<p class="ss-foot-h">Services</p>');
    });

    it('links the button to the owner\'s URL without the booking widget', () => {
      const html = render(RICH, { copy: { footer: { showCta: true, ctaUrl: 'https://example.com/book' } } });
      // data-scheduler-bound: scheduler.js would bind it for its "Book" label.
      expect(html).toContain('<a class="ss-btn ss-btn-primary ss-foot-cta" href="https://example.com/book" data-scheduler-bound="">Book Now!</a>');
      expect(render(RICH)).not.toContain('data-scheduler-bound');
    });
  });

  describe('package details', () => {
    it('adds the badge, photo and what\'s-included list the owner set', () => {
      const svc = sectionHtml(pub, 'services');
      expect(svc).toContain('<span class="ss-pk-badge">Most Popular</span>');
      expect(svc).toMatch(/class="acg-svc-card ss-card ss-card-feat ss-card-ph"/);
      expect(svc).toContain('<details class="ss-pk-inc" open="">');
      expect(svc).toContain('What&#x27;s included');
      expect(svc).toContain('<li class="ss-pk-inc-h">Interior:</li>');
      expect(svc).toContain('<span class="ss-pk-inc-hl">Leather Treatment</span>');
      expect(svc.match(/class="ss-pk-card-photo"/g)).toHaveLength(1);
      // Cards without a photo keep the space: a well on the site, the
      // upload slot in the editor.
      expect(svc.match(/class="ss-pk-card-photo ss-pk-card-well"/g)).toHaveLength(3);
      expect(decode(sectionHtml(edit, 'services')).replace(/&gt;/g, '>')).toContain(PHOTO_HINTS.service);
    });

    it('never turns description bullets into an included list', () => {
      const services = [{ name: 'Wash', price: '$20', description: '• Foam\n• Rinse\n• Dry' }];
      const html = render(LEGACY, { biz: { packages: services, services } });
      expect(html).not.toContain('ss-pk-inc');
    });
  });

  describe('headings', () => {
    it('uses the owner\'s labels, titles and highlighted words', () => {
      const html = decode(pub);
      expect(html).toContain('<h1 class="ss-h1">Orlando\'s <span class="ss-hl">Most Trusted</span> Mobile Detail</h1>');
      expect(html).toContain('Mobile detailing in Orlando</p>');
      expect(html).toContain('<h2 id="ss-services-h" class="ss-h2">Choose Your <em>Detail Package</em></h2>');
      expect(html).toMatch(/<\/span>Service Menu<\/p>/);
      expect(html).toContain('<p class="ss-sub">Booking takes a minute.</p>');
      expect(html).toContain('<h2 id="ss-contact-h" class="ss-h2">Ready To <em>Book?</em></h2>');
      expect(styleOf(pub)).toContain('.ss-cta .ss-h2 em{color:inherit;text-decoration:underline');
    });

    it('falls back to the design\'s last word when the hero accent does not match', () => {
      const html = decode(render(RICH, { copy: { sectionTitles: { hero: { accent: 'Nowhere' } } } }));
      expect(html).toContain('<h1 class="ss-h1">Orlando\'s Most Trusted Mobile <span class="ss-hl">Detail</span></h1>');
    });

    it('exports headingFields for real sections and defaults that match the page', () => {
      const ids = mod.sections.map((s) => s.id);
      for (const sid of Object.keys(mod.headingFields)) expect(ids).toContain(sid);
      const d = mod.headingDefaults(normalizeBusinessInfo(FIXTURES.full.businessInfo), FIXTURES.full.generatedCopy);
      expect(d.services).toEqual({ eyebrow: 'Our Services', title: 'We clean everything.', accent: 'everything.' });
      expect(d.process).toEqual({ eyebrow: 'Super Simple', title: 'How it works', accent: 'works' });
      expect(d.brands.eyebrow).toBe('We Detail All Vehicle Makes & Models');
      expect(d.featured).toEqual({});
      expect(d.hero.accent).toBe('Studio');
      const f = mod.headingDefaults(RICH.businessInfo, RICH.generatedCopy).featured;
      expect(f).toEqual({ title: 'Protect Your Vehicle With Ceramic Coating', accent: 'Ceramic Coating' });
    });
  });

  describe('featured service band', () => {
    it('features the owner\'s pick right after the services', () => {
      const band = sectionHtml(pub, 'featured');
      expect(pub.indexOf(openTag(pub, 'featured'))).toBeGreaterThan(pub.indexOf(openTag(pub, 'services')));
      expect(orderOf(pub, 'featured')).toBe(orderOf(pub, 'services'));
      expect(decode(band)).toContain('<h2 id="ss-featured-h" class="ss-h2">Protect Your Vehicle With <em>Ceramic Coating</em></h2>');
      expect(band).toContain('Signature Service');
      expect(band).toMatch(/Starting at <strong>\$450<\/strong>/);
      expect(band).toContain('Easier washing');
      expect(band).toContain('data-scheduler-service="Ceramic Coating"');
      expect(band).toContain('class="ss-ft-in ss-ft-feat-grid ss-ft-duo"');
    });

    it('skips a band with only a heading on the site, and explains it in the editor', () => {
      const copy = { featuredService: { serviceName: 'Premium Detail' }, sectionTitles: {} };
      const services = PKGS.map((s) => ({ ...s, price: '', summary: '', description: '' }));
      const opts = { copy, biz: { services, packages: services }, images: {} };
      expect(openTag(render(RICH, opts), 'featured')).toBeNull();
      const e = decode(render(RICH, { ...opts, editor: true }));
      expect(openTag(e, 'featured')).not.toBeNull();
      expect(e).toContain('This band shows on your site once it has a photo, a price or a list of benefits (Edit &gt; Featured Service).');
    });

    it('follows the owner\'s button URL and the hidden-sections switch', () => {
      const html = render(RICH, { copy: { featuredService: { ...RICH.generatedCopy.featuredService, buttonUrl: 'https://example.com/c', buttonText: 'Learn more' } } });
      expect(sectionHtml(html, 'featured')).toContain('<a class="ss-btn ss-btn-primary" href="https://example.com/c" data-scheduler-bound="">Learn more</a>');
      expect(openTag(render(RICH, { copy: { hiddenSections: ['featured'] } }), 'featured')).toBeNull();
    });
  });

  describe('vehicle makes band', () => {
    it('shows the owner\'s makes right after the hero', () => {
      const band = pub.slice(pub.indexOf(openTag(pub, 'brands')), pub.indexOf('</section>', pub.indexOf(openTag(pub, 'brands'))));
      expect(openTag(pub, 'brands')).toContain('class="ss-mk-makes"');
      expect(orderOf(pub, 'brands')).toBe(orderOf(pub, 'hero'));
      expect(pub.indexOf(openTag(pub, 'brands'))).toBeLessThan(pub.indexOf(openTag(pub, 'services')));
      expect(band).toContain('Every make welcome');
      for (const id of ['bmw', 'porsche']) {
        expect(band).toContain(`<symbol id="ss-mk-mk-${id}"`);
        expect(band).toContain(`<use href="#ss-mk-mk-${id}">`);
      }
      // A make without a logo shows as its name.
      for (const n of ['Rivian', 'Batmobile']) expect(band).toContain(`<span class="ss-mk-mq-t">${n}</span>`);
      expect(openTag(render(RICH, { copy: { hiddenSections: ['brands'] } }), 'brands')).toBeNull();
    });

    it('uses the design\'s line for the business kind', () => {
      expect(render(LEGACY, { copy: { vehicleMakes: 'BMW' } })).toContain('We Detail All Vehicle Makes &amp; Models');
      expect(render(LEGACY, { copy: { vehicleMakes: 'BMW' }, biz: { businessType: 'tint_shop' } })).toContain('All Makes &amp; Models Welcome');
    });
  });

  describe('service areas and insured', () => {
    it('lists the owner\'s areas as chips and says insured only when switched on', () => {
      const text = visibleText(pub);
      expect(text).toContain('We cover! Lake Nona Kissimmee Winter Park');
      expect(pub.match(/Fully insured/g)).toHaveLength(2);
      expect(render(RICH, { biz: { insured: 'yes' } })).not.toContain('Fully insured');
    });

    it('never splits the free-text service area into chips', () => {
      expect(render(LEGACY)).not.toContain('We cover!');
    });
  });

  describe('reviews', () => {
    const rev = sectionHtml(pub, 'testimonials');

    it('labels and stars only the quotes marked as Google reviews', () => {
      expect(rev.match(/>Google review</g)).toHaveLength(2);
      expect(rev.match(/class="ss-rev-stars"/g)).toHaveLength(1);
      expect(rev).toContain('Tesla owner');
      expect(rev).toContain('<a class="ss-rev-src" href="https://maps.example.com/sudsy" target="_blank" rel="noopener noreferrer">Google review<span class="ss-sr"> (opens Google Maps)</span></a>');
      expect(rev).toContain('See our Google reviews');
    });

    it('says "Read more reviews" when every quote is a Google review, and links nothing without a place', () => {
      const all = RICH.generatedCopy.testimonialPlaceholders.map((q) => ({ ...q, source: 'google' }));
      expect(render(RICH, { copy: { testimonialPlaceholders: all } })).toContain('Read more reviews');
      const noPlace = render(RICH, { biz: { googlePlace: undefined } });
      expect(noPlace).toContain('<span class="ss-rev-src">Google review</span>');
      expect(markup(noPlace)).not.toContain('ss-rev-more');
    });
  });

  describe('contact band photo', () => {
    it('lays the photo under a scrim', () => {
      const cta = sectionHtml(pub, 'cta');
      expect(openTag(pub, 'cta')).toContain('class="ss-section ss-band ss-cta ss-ctaph"');
      expect(cta).toContain('<div class="ss-ctaph-photo" aria-hidden="true"><img');
      expect(cta).toContain('<div class="ss-ctaph-scrim" aria-hidden="true">');
    });

    it.each([
      ['default', {}],
      ['custom', CUSTOM_COLORS],
      ['low-contrast', LOW_CONTRAST_COLORS],
      ['blue', { accent: '#2563eb' }],
      ['green', { accent: '#16a34a' }],
      ['dark page', { bg: '#0b0b0f', text: '#f5f5f5', accent: '#e11d48' }],
    ])('keeps its type readable over a white or a black photo pixel (%s palette)', (_, colors) => {
      const vars = rootVars(render(RICH, { colors }));
      // The scrim over the lightest and the darkest pixel that can show
      // through it, and over the band color while the photo loads.
      const m = vars['--ss-ctaph-scrim'].match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);
      expect(Number(m[4])).toBe(0.88);
      const scrim = rgbToHex(+m[1], +m[2], +m[3]);
      const bgs = [vars['--ss-ctaph-bg'], scrim, ...['#ffffff', '#000000', vars['--ss-cta-bg']].map((px) => mix(scrim, px, 0.12))];
      for (const k of ['--ss-ctaph-text', '--ss-ctaph-muted']) {
        for (const bg of bgs) expect(contrastRatio(vars[k], bg), `${k} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it('orders an added section by its saved slot', () => {
    const sectionOrder = ['hero', 'services', 'process', 'whyUs', 'about', 'gallery', 'featured', 'testimonials', 'brands', 'cta'];
    const html = render(RICH, { copy: { sectionOrder } });
    expect(orderOf(html, 'featured')).toBe(6);
    expect(orderOf(html, 'brands')).toBe(8);
    expect(orderOf(html, 'services')).toBe(1);
  });
});

describe('mobile_sudsy: module exports and capability hooks', () => {
  it('declares the added sections and the footer spec', () => {
    const ids = mod.sections.map((s) => s.id);
    expect(ids).toEqual(['hero', 'brands', 'services', 'featured', 'process', 'whyUs', 'about', 'gallery', 'beforeAfter', 'testimonials', 'cta']);
    expect(mod.addedSections).toEqual(['brands', 'featured', 'beforeAfter']);
    const types = mod.footerSpec.columns.map((c) => c.type);
    expect(types).toEqual(['brand', 'links', 'services', 'areas', 'contact', 'hours']);
    for (const t of types.filter((x) => x !== 'brand')) expect(typeof mod.footerSpec.titles[t]).toBe('string');
    expect(mod.footerSpec).toMatchObject({ mergeHours: false, cta: false, ctaLabel: 'Book Now!' });
  });

  it('names the opt-in defaults literally (editorCapabilities.js reads them from the source)', () => {
    expect(SOURCE).toMatch(/heroCardModeOf\(copy\.heroCard, 'off'\)/);
    expect(SOURCE).toMatch(/googleBadgePlacements\(copy\.googleBadge, \[\]\)/);
    expect(SOURCE).toMatch(/featuredServiceOf\(\{[\s\S]*?automatic: false/);
    expect(SOURCE).toMatch(/vehicleMakesFor\(copy\.vehicleMakes, \[\]\)/);
    for (const re of [/\bcopy\.heroServices\b/, /\bcopy\.footer\b/, /\bcopy\.sectionTitles\b/, /\bserviceIncludes\(/, /\bserviceAreasOf\(/, /\bbiz\.insured\b/, /\bimages\.cta\b/, /\.source === 'google'/]) {
      expect(SOURCE).toMatch(re);
    }
  });
});

describe('mobile_sudsy: round-1 fixes', () => {
  it('locks the card height only where the card sits beside the copy', () => {
    const css = styleOf(render(RICH));
    // Photo hero and split hero from 900px, cartoon hero from 781px.
    expect(css).toContain('@container (min-width:900px){\n@supports selector(:has(*)){\n.ss-hq-grid .ss-hq-quote,.ss-split-offer .ss-hq-quote{display:grid');
    expect(css).toContain('@container (min-width:781px){\n@supports selector(:has(*)){\n.ss-hero-grid .ss-hq-quote{display:grid');
    expect(css).not.toMatch(/@container \(min-width:781px\)\{\n@supports selector\(:has\(\*\)\)\{\n\.ss-hq-quote\{/);
  });

  it('marks highlighted included items, keeps a moved brand column out of a full row and the nav badge on wide screens', () => {
    const css = styleOf(render(RICH));
    expect(css).toMatch(/\.ss-pk-inc-hl\{[^}]*background:var\(--ss-accent-pale\)/);
    expect(css).toContain('@container (max-width:900px){.ss-fb .ss-foot-about:not(:first-child){grid-column:auto}}');
    expect(css).toContain('@container (max-width:1280px){.ss-nav-gslot{display:none}}');
    expect(css).toContain('.ss-hq-step-l{font-weight:800;letter-spacing:.1em;text-transform:uppercase}');
  });

  it('moves the social icons to the Say Hi! column while the brand column is off', () => {
    const biz = { instagram: '@sudsytest' };
    const footer = { columns: [{ type: 'brand', show: false }, { type: 'contact' }, { type: 'links' }] };
    const html = render(RICH, { biz, copy: { footer } });
    const foot = html.slice(html.indexOf('<footer'));
    expect(foot).toContain('class="ss-social"');
    expect(foot).toContain('instagram.com/sudsytest');
    const on = render(RICH, { biz });
    expect(on.slice(on.indexOf('<footer')).split('class="ss-social"').length - 1).toBe(1);
    // The email may wrap before its @ in the owner's footer.
    expect(foot).toMatch(/<wbr\/>@/);
  });

  it('shows the Reviews heading badge with the Google reviews widget, and names the section by its heading', () => {
    const widget = render(RICH, { copy: { googleWidgetKey: 'w-1' } });
    expect(sectionHtml(widget, 'testimonials')).toContain('class="ss-rev-g"');
    const titled = render(RICH, { copy: { googleWidgetKey: 'w-1', sectionTitles: { testimonials: { title: 'Our Reviews' } } } });
    expect(openTag(titled, 'testimonials')).toContain('aria-label="Our Reviews"');
  });

  it("colors a Google review's stars in Google gold, darkened for its card", () => {
    const rev = sectionHtml(render(RICH), 'testimonials');
    const stars = rev.slice(rev.indexOf('class="ss-rev-stars"'));
    const fill = (stars.match(/<path [^>]*fill="([^"]+)"/) || [])[1];
    expect(fill).toMatch(/^#[0-9a-f]{6}$/i);
    // Gold itself, or gold darkened only as far as its card needs (3:1).
    expect(contrastRatio(fill, GOOGLE_STAR_GOLD)).toBeLessThan(contrastRatio('#000000', GOOGLE_STAR_GOLD));
    expect(ensureContrast(GOOGLE_STAR_GOLD, '#ffffff', 3)).toMatch(/^#/);
  });
});

describe('menu-bar rating gives way to the business name', () => {
  it('sits in its own slot between the name and the links, shown only while the slot fits it', () => {
    const html = render(RICH);
    const nav = markup(html).slice(0, markup(html).indexOf('</nav>'));
    expect(nav).toMatch(/<a class="ss-brand"[\s\S]*?<\/a><div class="ss-nav-gslot"><span class="ss-nav-g">[\s\S]*?<\/span><\/div><div class="ss-links">/);
    const css = styleOf(html);
    expect(css).toContain('.ss-nav-gslot{flex:1 1 0;min-width:0;margin-left:-20px;display:flex;justify-content:flex-end;container-type:inline-size}');
    expect(css).toContain('.ss-brand:has(+.ss-nav-gslot){flex-grow:0}');
    expect(css).toMatch(/\.ss-nav-g\{display:none;/);
    // A typical badge plus its gap; a longer review count needs more room.
    expect(css).toContain('@container (min-width:200px){.ss-nav-g{display:inline-flex}}');
    const big = styleOf(render(RICH, { biz: { googlePlace: { ...PLACE, reviewCount: 1234 } } }));
    expect(big).toContain('@container (min-width:221px){.ss-nav-g{display:inline-flex}}');
    // Without the menu-bar spot: no slot, no query.
    const off = render(RICH, { copy: { googleBadge: { placements: ['hero'] } } });
    expect(markup(off)).not.toContain('ss-nav-gslot');
    expect(styleOf(off)).not.toContain('{.ss-nav-g{display:inline-flex}}');
    expect(css).toContain('@supports not (container-type:inline-size){.ss-nav-gslot{display:none}}');
  });
});
