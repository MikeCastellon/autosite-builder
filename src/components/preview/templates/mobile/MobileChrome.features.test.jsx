// mobile_chrome's owner-editable features (the kit feature blocks) beyond the
// shared contract (templates.render.test.jsx). Live sites use this design, so
// every feature is opt-in:
//   - a site with none of the new keys renders no feature markup, CSS or root
//     variable, and its original sections keep their old order values (the
//     byte-for-byte comparison with the renders from before the features
//     lives in the rollout tooling, outside the repo);
//   - with the owner's data each feature renders in this design's markup,
//     from that data only (no invented ratings, areas or claims).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './MobileChrome.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { contrastRatio, deriveTheme, heroScrimBase, mix } from '../kit/theme.js';
import { FIXTURES, FIXTURE_IMAGES, CUSTOM_COLORS } from '../__fixtures__/businesses.js';

const Chrome = mod.default;
const ID = 'mobile_chrome';
const LEGACY_IDS = ['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta', 'awards'];

// Same list as templates.render.test.jsx BANNED_CLAIMS (keep in sync).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[★☆⭐]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDITOR_TEXT = new RegExp(['Images tab', 'Upload a photo', 'Edit >', 'Edit panel', ...Object.values(PHOTO_HINTS)].map(escapeRe).join('|'), 'i');

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
const count = (html, needle) => html.split(needle).length - 1;
// The rendered elements without the template's <style> block (whose
// selectors name every class).
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const styleBlock = (html) => (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const openTag = (html, id) => html.match(new RegExp(`<[a-z]+\\b[^>]*data-section="${id}"[^>]*>`, 'i'))?.[0] || null;
const orderOf = (html, id) => Number((decode(openTag(html, id) || '').match(/[";]\s*order\s*:\s*(-?\d+)/) || [])[1]);
// The HTML of one section: from its opening tag to the next section's.
function sectionHtml(html, id) {
  const start = html.indexOf(`data-section="${id}"`);
  if (start < 0) return '';
  const next = html.indexOf('data-section="', start + 20);
  return html.slice(start, next < 0 ? html.indexOf('<footer') : next);
}
const footerHtml = (html) => html.slice(html.indexOf('<footer'), html.indexOf('</footer>') + 9);
// A root CSS variable ('' when absent).
const token = (html, name) => (decode(html).match(new RegExp(`${name}:([^;"]+)`)) || [])[1]?.trim() || '';

const PLACE = { placeId: 'ChIJchrome-features-test', placeName: 'Chrome Test Detailing', rating: 4.8, reviewCount: 52, url: 'https://maps.example.com/chrome' };
const PER_DAY = { Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '9am-2pm', Sun: '' };

// An existing site: a filled-in Pro site saved before the features existed
// (packages, per-day hours, a free-text service area, the Google place the
// wizard stores since March), with none of the new keys.
const LEGACY = {
  businessInfo: {
    businessName: 'Chrome Test Detailing',
    businessType: 'mobile_detailing',
    phone: '(407) 555-0123',
    email: 'hello@example.com',
    city: 'Orlando',
    state: 'FL',
    serviceArea: 'Orlando, Kissimmee, Lake Nona',
    hours: PER_DAY,
    googlePlace: PLACE,
    instagram: '@chrome.test',
    awards: ['Best of Orlando 2025'],
    services: [
      { name: 'Refresh Detail', price: '$120', description: 'Foam hand wash, wheels and a vacuum.' },
      { name: 'Signature Detail', price: '$180', description: 'Everything in Refresh plus leather care.' },
      { name: 'Ceramic Coating', price: '$600', description: 'Multi-year paint protection.' },
    ],
  },
  generatedCopy: {
    headline: 'Orlando Mobile Detailing Done Right',
    subheadline: 'We come to you.',
    aboutText: 'We detail cars across Orlando.',
    servicesSection: { title: 'Our Services' },
    testimonialPlaceholders: [
      { name: 'Ana P.', text: 'Great job on my SUV.' },
      { name: 'Ben Q.', text: 'On time and careful.', vehicle: 'Tesla Model Y' },
    ],
    ctaHeadline: 'Ready To Book?',
    footerTagline: 'Mobile detailing across Orlando.',
  },
  images: { ...FIXTURE_IMAGES },
  customColors: {},
  customFonts: {},
};

// The same business with every feature switched on.
const FEATURES = {
  ...LEGACY,
  businessInfo: {
    ...LEGACY.businessInfo,
    serviceAreas: ['Lake Nona', 'Kissimmee', 'Winter Park'],
    insured: true,
    services: [
      { name: 'Refresh Detail', price: '$120', summary: 'Inside-and-out refresh', description: 'Foam hand wash, wheels and a vacuum.', includes: ['Interior:', 'Vacuum', 'Windows', 'Exterior:', 'Foam Hand Wash'], image: FIXTURE_IMAGES.gallery0 },
      { name: 'Signature Detail', price: '$180', summary: 'Full detail + wax', badge: 'Most Popular', includes: ['Vacuum', { text: 'Leather Treatment', highlight: true }] },
      { name: 'Ceramic Coating', price: '$600', description: 'Multi-year paint protection.' },
    ],
  },
  generatedCopy: {
    ...LEGACY.generatedCopy,
    heroCard: 'quote',
    heroServices: ['Signature Detail', 'Refresh Detail'],
    googleBadge: { placements: ['hero', 'nav', 'about', 'reviews', 'footer'] },
    footer: {
      columns: [{ type: 'brand', show: true }, { type: 'contact' }, { type: 'hours' }, { type: 'links', title: 'More' }, { type: 'areas' }],
      showCta: true,
      ctaText: 'Book a Visit',
      bottomText: 'Licensed and insured',
    },
    sectionTitles: {
      hero: { eyebrow: 'Orlando Mobile Detailing', accent: 'Done Right' },
      services: { eyebrow: 'Our Menu', accent: 'Services', intro: 'Every package by hand.' },
      featured: { eyebrow: 'Signature Service' },
      brands: { eyebrow: 'Every make welcome' },
      about: { title: 'Why Drivers Choose Us', accent: 'Choose Us' },
      testimonials: { intro: 'Straight from our customers.' },
      cta: { eyebrow: 'Book', accent: 'Book' },
    },
    featuredService: { serviceName: 'Ceramic Coating', priceFrom: '$450', bullets: ['Deep gloss', 'Easier washing'] },
    vehicleMakes: ['BMW', 'Porsche', 'Rivian'],
    testimonialPlaceholders: [
      { name: 'Ana P.', text: 'Great job on my SUV.', source: 'google', rating: 5 },
      { name: 'Ben Q.', text: 'On time and careful.', vehicle: 'Tesla Model Y', rating: 5 },
    ],
  },
  images: { ...FIXTURE_IMAGES, featured: FIXTURE_IMAGES.gallery1, cta: FIXTURE_IMAGES.gallery2 },
};

function render(fx, { biz = {}, copy = {}, images, colors, editor = false } = {}) {
  const el = createElement(Chrome, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, colors || fx.customColors, fx.customFonts),
    images: images || fx.images || {},
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

// Feature markup, CSS and root variables a site without the new keys must
// never get.
const NEW_MARKUP = [
  'mc-hq-', 'mc-pk-', 'mc-ft-', 'mc-mk-', 'mc-gpill', 'acg-gbadge', 'mc-ctaph', 'mc-rev-', 'mc-fb', 'mc-foot-note',
  'mc-foot-cta', 'mc-hero-g', 'mc-nav-g', 'mc-about-g', 'mc-h1-em', 'mc-hero-offer', 'mc-card-feat', 'mc-card-ph',
  'data-section="brands"', 'data-section="featured"', 'id="quote"', 'id="makes"', 'id="featured"', '--mc-fcols',
];
const NEW_TEXT = /Fully insured|Areas we serve|Google Review|Google reviews|Insurance/;

describe('existing sites (none of the new keys) render nothing new', () => {
  // FIXTURES.features sets every new key up, so it is not an existing site.
  const sites = { sparse: FIXTURES.sparse, full: FIXTURES.full, custom: FIXTURES.custom, legacy: LEGACY };
  for (const [name, fx] of Object.entries(sites)) {
    for (const editor of [false, true]) {
      it(`${name} (${editor ? 'editor' : 'published'})`, () => {
        const html = render(fx, { editor });
        for (const m of NEW_MARKUP) expect({ m, found: html.includes(m) }).toEqual({ m, found: false });
        expect(visibleText(html)).not.toMatch(NEW_TEXT);
        expect(token(html, '--mc-hq-card-bg')).toBe('');
        expect(token(html, '--mc-ctaph-bg')).toBe('');
      });
    }
  }

  it('keeps every original section at its old order value', () => {
    for (const fx of [FIXTURES.full, FIXTURES.custom, LEGACY]) {
      const html = render(fx);
      const old = buildSectionOrder(fx.generatedCopy, LEGACY_IDS);
      for (const id of LEGACY_IDS) {
        if (openTag(html, id)) expect({ id, order: orderOf(html, id) }).toEqual({ id, order: old(id) });
      }
    }
  });

  it('a connected Google place alone shows no rating anywhere', () => {
    expect(LEGACY.businessInfo.googlePlace).toBeTruthy();
    expect(render(LEGACY)).not.toContain('acg-gbadge');
    expect(render(LEGACY, { copy: { googleBadge: { placements: [] } } })).not.toContain('acg-gbadge');
  });

  it('a free-text service area, or insured that is not an explicit yes, adds nothing', () => {
    for (const insured of ['yes', 1, 'true', false]) {
      expect(visibleText(render(LEGACY, { biz: { insured } }))).not.toMatch(/Fully insured|Insurance/);
    }
    expect(visibleText(render(LEGACY))).not.toContain('Areas we serve');
    expect(visibleText(render(LEGACY, { biz: { serviceAreas: [] } }))).not.toContain('Areas we serve');
  });

  it('an absent, unknown or "off" hero card keeps the hero as it was', () => {
    const before = render(LEGACY);
    for (const heroCard of [undefined, 'off', 'big', null]) {
      expect(render(LEGACY, { copy: { heroCard, heroServices: ['Refresh Detail'] } })).toBe(before);
    }
  });

  it('a featured service without a chosen name, or an empty makes list, adds no band', () => {
    const before = render(LEGACY);
    expect(render(LEGACY, { copy: { featuredService: { priceFrom: '$450' } } })).toBe(before);
    expect(render(LEGACY, { copy: { featuredService: { serviceName: '  ' } } })).toBe(before);
    expect(render(LEGACY, { copy: { vehicleMakes: [] } })).toBe(before);
    expect(render(LEGACY, { copy: { vehicleMakes: '' } })).toBe(before);
    expect(render(LEGACY, { copy: { sectionTitles: {} } })).toBe(before);
  });
});

describe('hero services card', () => {
  it('shows the price card with the owner\'s picks, in their order', () => {
    const html = render(FEATURES);
    const hero = sectionHtml(html, 'hero');
    expect(openTag(html, 'hero')).toContain('mc-hero-offer');
    expect(hero).toContain('mc-hq-grid');
    expect(count(markup(html), 'id="quote"')).toBe(1);
    expect(hero.indexOf('Signature Detail')).toBeLessThan(hero.indexOf('Refresh Detail'));
    expect(hero).toContain('id="mc-hq-pkg-0"');
    expect(hero).toContain('id="mc-hq-pkg-1"');
    expect(hero).not.toContain('id="mc-hq-pkg-2"');
    expect(hero).toContain('data-scheduler-service="Signature Detail"');
    expect(hero).toContain('href="tel:4075550123"');
    expect(visibleText(hero)).toContain('Which Service Do You Need?');
    expect(styleBlock(html)).toContain('.mc-hq-quote{');
    expect(styleBlock(html)).toContain('.mc-hq-slot{');
    expect(token(html, '--mc-hq-card-bg')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('without picks offers the first three priced services', () => {
    const hero = sectionHtml(render(FEATURES, { copy: { heroServices: undefined } }), 'hero');
    for (const n of ['Refresh Detail', 'Signature Detail', 'Ceramic Coating']) expect(hero).toContain(n);
  });

  it('list mode shows a plain list that links to the services', () => {
    const html = render(FEATURES, { copy: { heroCard: 'list' } });
    const hero = sectionHtml(html, 'hero');
    expect(hero).toContain('mc-hq-hlist');
    expect(hero).not.toContain('mc-hq-radio');
    expect(visibleText(hero)).toContain('Our Services');
    expect(decode(hero)).toMatch(/class="mc-hq-hl-cta" href="#services">View All Services/);
  });

  it('never shows "Your Price" without a price; the editor says why', () => {
    const services = FEATURES.businessInfo.services.map((s) => ({ ...s, price: 'Call for quote' }));
    const published = render(FEATURES, { biz: { services } });
    expect(markup(published)).not.toContain('id="quote"');
    expect(markup(published)).not.toContain('mc-hero-offer');
    expect(styleBlock(published)).not.toContain('.mc-hq-opts{');
    expect(published).not.toContain('needs services with a price');
    const editor = render(FEATURES, { biz: { services }, editor: true });
    expect(visibleText(editor)).toContain('Your price card needs services with a price (Edit > Services).');
    // The list card shows unpriced services as they are.
    expect(render(FEATURES, { biz: { services }, copy: { heroCard: 'list' } })).toContain('mc-hq-hlist');
  });

  it('sits over the photo column of the split hero (a row of its own when narrow), and goes with the hero', () => {
    const split = render(FEATURES, { copy: { heroLayout: 'split' } });
    // After the photo, as the split's own grid item: CSS places it over the
    // photo column from 1024px, under the hero below that and right after
    // the copy on phones, so the hero never grows by the card's height.
    expect(split).toContain('class="mc-split mc-split-offer"');
    expect(split).toMatch(/<div class="mc-split-text">((?!mc-hq-slot)[\s\S])*<div class="mc-split-photo">[\s\S]*?<div class="mc-hq-slot">/);
    expect(styleBlock(split)).toContain('.mc-split-offer>.mc-hq-slot{grid-column:2;grid-row:1;');
    expect(render(FEATURES, { copy: { heroLayout: 'split', heroCard: 'off' } })).toContain('class="mc-split"');
    // Its block CSS and root colors go with it (FEATURE_CSS stays for the
    // other features on this page).
    const hidden = render(FEATURES, { copy: { hiddenSections: ['hero'] } });
    expect(markup(hidden)).not.toContain('mc-hq-');
    expect(styleBlock(hidden)).not.toContain('.mc-hq-opts{');
    expect(token(hidden, '--mc-hq-card-bg')).toBe('');
  });
});

describe('Google rating badge', () => {
  it('shows only where the owner switched it on', () => {
    const html = render(FEATURES);
    expect(sectionHtml(html, 'hero')).toContain('mc-hero-g');
    expect(html.slice(0, html.indexOf('</nav>'))).toContain('mc-nav-g');
    // Its own slot between the name and the links, shown only while the
    // slot fits it (the name never shrinks for it); a longer review count
    // waits for more room.
    expect(markup(html)).toMatch(/<a class="mc-brand"[\s\S]*?<\/a><div class="mc-nav-gslot"><span class="mc-nav-g">[\s\S]*?<\/span><\/div><div class="mc-links">/);
    const css = styleBlock(html);
    expect(css).toContain('.mc-brand:has(+.mc-nav-gslot){flex-grow:0}');
    expect(css).toContain('@container (max-width:1100px){.mc-nav-gslot{display:none}}');
    expect(css).toContain('@container (min-width:192px){.mc-nav-g{display:inline-flex}}');
    expect(styleBlock(render(FEATURES, { biz: { googlePlace: { ...PLACE, reviewCount: 1234 } } }))).toContain('@container (min-width:210px){.mc-nav-g{');
    expect(styleBlock(render(FEATURES, { copy: { googleBadge: { placements: ['hero'] } } }))).not.toContain('{.mc-nav-g{display:inline-flex}}');
    expect(css).toContain('@supports not (container-type:inline-size){.mc-nav-gslot{display:none}}');
    expect(sectionHtml(html, 'about')).toContain('mc-about-g');
    expect(sectionHtml(html, 'testimonials')).toContain('mc-rev-g');
    expect(footerHtml(html)).toContain('mc-foot-g');
    expect(count(markup(html), 'acg-gbadge-pill')).toBe(3);
    expect(count(markup(html), 'acg-gbadge-inline')).toBe(2);
    expect(visibleText(html)).toContain('4.8 · 52 Google reviews');
    expect(decode(html)).toContain('href="https://maps.example.com/chrome"');

    const some = render(FEATURES, { copy: { googleBadge: { placements: ['about'] } } });
    expect(count(markup(some), 'acg-gbadge-pill') + count(markup(some), 'acg-gbadge-inline')).toBe(1);
    expect(sectionHtml(some, 'about')).toContain('acg-gbadge-pill');
  });

  it('never shows without a rating and a review count', () => {
    for (const googlePlace of [null, { rating: 4.9 }, { reviewCount: 30 }, { rating: 0, reviewCount: 30 }]) {
      expect(markup(render(FEATURES, { biz: { googlePlace } }))).not.toContain('acg-gbadge');
    }
  });

  it('moves the footer rating to the bottom line when the logo column is off', () => {
    const footer = { columns: [{ type: 'brand', show: false }, { type: 'links' }, { type: 'contact' }] };
    const foot = footerHtml(render(FEATURES, { copy: { footer } }));
    expect(foot).not.toContain('mc-foot-brand');
    expect(foot).toMatch(/<div class="mc-foot-note"><a class="acg-gbadge acg-gbadge-inline/);
  });

  it('keeps the review stars visible on a light page (3:1)', () => {
    const html = decode(render(FEATURES, { colors: { bg: '#ffffff', text: '#111111', accent: '#94a3b8' } }));
    const about = sectionHtml(html, 'about');
    const fill = (about.match(/acg-gbadge-stars[\s\S]*?fill="(#[0-9a-f]{6})"/) || [])[1];
    expect(fill).toBeTruthy();
    expect(contrastRatio(fill, '#ffffff')).toBeGreaterThanOrEqual(3);
  });
});

describe('footer builder', () => {
  it('without copy.footer keeps the design\'s logo / Explore / Contact columns and no button', () => {
    const foot = footerHtml(render(LEGACY));
    expect(visibleText(foot)).toMatch(/Explore .* Contact/);
    expect(foot).not.toMatch(/Service Areas|Hours/);
    expect(foot).not.toContain('mc-btn');
  });

  it('renders the owner\'s columns, titles, button and bottom line', () => {
    const html = render(FEATURES);
    const foot = footerHtml(html);
    const heads = [...foot.matchAll(/<p class="mc-foot-h">([^<]+)<\/p>/g)].map((m) => m[1]);
    expect(heads).toEqual(['Contact', 'Hours', 'More', 'Service Areas']);
    expect(foot.indexOf('mc-foot-brand')).toBeLessThan(foot.indexOf('mc-foot-h'));
    expect(decode(foot)).toContain('--mc-fcols:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)');
    expect(foot).toMatch(/<a class="mc-btn mc-btn-chrome mc-btn-sm mc-foot-cta" href="#contact" data-scheduler-trigger="">Book a Visit<\/a>/);
    expect(visibleText(foot)).toContain('Mon–Fri 8am – 6pm');
    expect(visibleText(foot)).toContain('Sun Closed');
    expect(visibleText(foot)).toContain('Winter Park');
    // The copyright stays the footer's last <p> (exportHtml's owner link).
    const lastP = foot.lastIndexOf('<p>');
    expect(foot.slice(lastP)).toMatch(/^<p>© /);
    expect(foot).toContain('<div class="mc-foot-note">Licensed and insured</div>');
  });

  it('the button follows the owner\'s link, and switches off', () => {
    const own = footerHtml(render(FEATURES, { copy: { footer: { ...FEATURES.generatedCopy.footer, ctaUrl: 'https://book.example.com' } } }));
    expect(own).toMatch(/class="mc-btn mc-btn-chrome mc-btn-sm mc-foot-cta" href="https:\/\/book.example.com" data-scheduler-bound="">Book a Visit/);
    expect(own).not.toContain('data-scheduler-trigger');
    // A "Book" label with the owner's link: scheduler.js leaves it alone.
    const featured = render(FEATURES, { copy: { featuredService: { ...FEATURES.generatedCopy.featuredService, buttonUrl: 'https://example.com/ceramic' } } });
    expect(featured).toMatch(/href="https:\/\/example.com\/ceramic" data-scheduler-bound="">Book /);
    expect(render(FEATURES)).not.toContain('data-scheduler-bound');
    const off = footerHtml(render(FEATURES, { copy: { footer: { ...FEATURES.generatedCopy.footer, showCta: false } } }));
    expect(off).not.toContain('mc-foot-cta');
    const def = footerHtml(render(FEATURES, { copy: { footer: { columns: [{ type: 'contact' }] } } }));
    expect(def).not.toContain('mc-foot-cta');
  });

  it('leaves out hidden and empty columns', () => {
    // (A type the owner's list leaves out is hidden, like contact here.)
    const footer = { columns: [{ type: 'brand' }, { type: 'links', show: false }, { type: 'areas' }, { type: 'hours' }] };
    const foot = footerHtml(render(FEATURES, {
      copy: { footer },
      biz: { serviceAreas: [], serviceArea: '', city: '', hours: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '', Sat: '', Sun: '' } },
    }));
    expect(foot).not.toMatch(/Explore|Service Areas|Hours|Contact/);
    expect(foot).toContain('mc-foot-brand');
  });
});

describe('package details', () => {
  it('shows the owner\'s badge, photo and included items', () => {
    const html = render(FEATURES);
    const svc = sectionHtml(html, 'services');
    expect(count(svc, 'mc-card-feat')).toBe(1);
    expect(svc).toContain('<span class="mc-pk-badge">Most Popular</span>');
    expect(count(svc, 'class="mc-pk-inc"')).toBe(2);
    expect(svc).toContain('<li class="mc-pk-inc-h">Interior:</li>');
    expect(svc).toMatch(/<span class="mc-pk-inc-hl">Leather Treatment<\/span>/);
    expect(visibleText(svc)).toContain("What's Included");
    expect(count(svc, 'mc-card-ph')).toBe(3);
    // The cards without a photo get a quiet well on the site, an upload slot
    // in the editor.
    expect(count(svc, 'mc-pk-card-well')).toBe(2);
    const editor = sectionHtml(render(FEATURES, { editor: true }), 'services');
    expect(editor).not.toContain('mc-pk-card-well');
    expect(visibleText(editor)).toContain(PHOTO_HINTS.service);
    expect(styleBlock(html)).toContain('.mc-pk-inc{');
  });

  it('never turns a description into an included list', () => {
    const services = [{ name: 'Wash', price: '$40', description: '• Foam bath\n• Tire shine\n• Windows' }];
    const html = render(LEGACY, { biz: { services } });
    expect(html).not.toContain('mc-pk-');
  });
});

describe('section headings', () => {
  it('uses the owner\'s eyebrows, titles, highlighted words and intros', () => {
    const html = render(FEATURES);
    const hero = sectionHtml(html, 'hero');
    expect(hero).toContain('<p class="mc-eyebrow">Orlando Mobile Detailing</p>');
    expect(hero).toContain('<h1 class="mc-h1"><span>Orlando Mobile Detailing </span><span class="mc-h1-em">Done Right</span></h1>');
    const svc = sectionHtml(html, 'services');
    expect(svc).toContain('<p class="mc-eyebrow">Our Menu</p>');
    expect(svc).toMatch(/Our <span class="mc-chrome-text">Services<\/span>/);
    expect(svc).toContain('<p class="mc-intro">Every package by hand.</p>');
    expect(sectionHtml(html, 'about')).toMatch(/Why Drivers <span class="mc-chrome-text">Choose Us<\/span>/);
    const rev = sectionHtml(html, 'testimonials');
    expect(rev).toContain('class="mc-head"');
    expect(rev).toContain('<p class="mc-intro">Straight from our customers.</p>');
    expect(sectionHtml(html, 'cta')).toMatch(/Ready To <span class="mc-chrome-text">Book<\/span>\?/);
    expect(sectionHtml(html, 'brands')).toContain('Every make welcome');
  });

  it('a highlight that is not whole words of the title leaves it plain', () => {
    const html = render(LEGACY, { copy: { sectionTitles: { hero: { accent: 'Rig' }, about: { accent: 'Chro' } } } });
    expect(sectionHtml(html, 'hero')).toContain('<h1 class="mc-h1"><span>Orlando Mobile Detailing Done Right</span></h1>');
    expect(sectionHtml(html, 'about')).not.toContain('mc-chrome-text');
  });

  it('exports headingFields for its own sections and the defaults it renders', () => {
    const ids = mod.sections.map((s) => s.id);
    for (const sid of Object.keys(mod.headingFields)) expect(ids).toContain(sid);
    const d = mod.headingDefaults(normalizeBusinessInfo(LEGACY.businessInfo), LEGACY.generatedCopy);
    const html = render(LEGACY);
    expect(visibleText(sectionHtml(html, 'about'))).toContain(d.about.title);
    expect(visibleText(sectionHtml(html, 'gallery'))).toContain(d.gallery.title);
    expect(visibleText(sectionHtml(html, 'testimonials'))).toContain(d.testimonials.title);
    expect(visibleText(sectionHtml(html, 'hero'))).toContain(d.hero.eyebrow);
    expect(mod.headingDefaults({}, { featuredService: { serviceName: 'Ceramic Coating' } }).featured)
      .toMatchObject({ title: 'Protect Your Vehicle With Ceramic Coating', accent: 'Ceramic Coating' });
  });
});

describe('featured service band', () => {
  it('features the owner\'s chosen service after the services', () => {
    const html = render(FEATURES);
    const band = sectionHtml(html, 'featured');
    expect(openTag(html, 'featured')).toContain('class="mc-section mc-alt mc-ft-band"');
    expect(html.indexOf('data-section="featured"')).toBeGreaterThan(html.indexOf('data-section="services"'));
    expect(band).toContain('<p class="mc-eyebrow">Signature Service</p>');
    expect(band).toMatch(/Protect Your Vehicle With <span class="mc-chrome-text">Ceramic Coating<\/span>/);
    expect(visibleText(band)).toContain('Starting at $450');
    expect(visibleText(band)).toContain('Deep gloss');
    expect(band).toContain('mc-ft-feat-photo');
    expect(band).toMatch(/class="mc-btn mc-btn-chrome" href="tel:4075550123" data-scheduler-trigger="" data-scheduler-service="Ceramic Coating">Book Ceramic Coating/);
    expect(styleBlock(html)).toContain('.mc-ft-feat-grid{');
  });

  it('picks nothing on its own: no chosen name, no band (even with a ceramic service)', () => {
    const html = render(FEATURES, { copy: { featuredService: undefined } });
    expect(html).not.toContain('data-section="featured"');
    expect(markup(html)).not.toContain('mc-ft-');
    expect(styleBlock(html)).not.toContain('.mc-ft-feat-grid{');
  });

  it('a band with nothing but a heading shows only in the editor, with a hint', () => {
    const copy = { featuredService: { serviceName: 'Nonexistent Service' } };
    const images = { ...FEATURES.images, featured: undefined };
    expect(render(FEATURES, { copy, images })).not.toContain('data-section="featured"');
    const editor = render(FEATURES, { copy, images, editor: true });
    expect(visibleText(sectionHtml(editor, 'featured'))).toContain('This band shows on your site once it has a photo');
  });

  it('a chosen service without own bullets lists its included items', () => {
    const band = sectionHtml(render(FEATURES, { copy: { featuredService: { serviceName: 'Refresh Detail' } } }), 'featured');
    expect(visibleText(band)).toMatch(/Vacuum Windows Foam Hand Wash/);
    expect(visibleText(band)).not.toContain('Interior:');
    expect(visibleText(band)).toContain('$120');
  });
});

describe('vehicle makes band', () => {
  it('shows the makes the owner picked, right after the stats bar', () => {
    const html = render(FEATURES);
    const band = sectionHtml(html, 'brands');
    expect(openTag(html, 'brands')).toMatch(/id="makes" class="mc-mk-makes" aria-label="Vehicle makes" tabindex="0"/);
    expect(html.indexOf('data-section="brands"')).toBeGreaterThan(html.indexOf('data-section="statsBar"'));
    expect(html.indexOf('data-section="brands"')).toBeLessThan(html.indexOf('data-section="services"'));
    for (const id of ['bmw', 'porsche']) expect(band).toContain(`id="mc-mk-mk-${id}"`);
    // A make without a logo shows as its name.
    expect(band).toContain('<span class="mc-mk-mq-t">Rivian</span>');
    expect(band).not.toContain('mc-mk-mk-tesla');
    expect(styleBlock(html)).toContain('@keyframes mc-mk-scroll');
  });

  it('defaults its line to the business kind and hides with the section', () => {
    const band = sectionHtml(render(FEATURES, { copy: { sectionTitles: {} } }), 'brands');
    expect(visibleText(band)).toContain('We Detail All Vehicle Makes & Models');
    const hidden = render(FEATURES, { copy: { hiddenSections: ['brands'] } });
    expect(markup(hidden)).not.toContain('mc-mk-');
    expect(styleBlock(hidden)).not.toContain('@keyframes mc-mk-scroll');
  });
});

describe('service areas, insured, review labels, contact photo', () => {
  it('lists the owner\'s own areas and says insured only when it is', () => {
    const html = render(FEATURES);
    const contact = sectionHtml(html, 'cta');
    // The free-text service area joins the areas row (one pin row, not two).
    expect(visibleText(contact)).toContain('Areas we serve Orlando, Kissimmee, Lake Nona Lake Nona Kissimmee Winter Park');
    expect(visibleText(contact)).not.toContain('Service area');
    expect(visibleText(contact)).toContain('Insurance Fully insured');
    expect(visibleText(sectionHtml(html, 'hero'))).toContain('Fully insured');
  });

  it('labels and stars only the quotes marked as Google reviews', () => {
    const html = render(FEATURES);
    const rev = sectionHtml(html, 'testimonials');
    expect(count(rev, 'mc-rev-src')).toBe(1);
    expect(count(rev, 'class="mc-rev-stars"')).toBe(1);
    // A new tab, and it says so to screen readers.
    expect(rev).toMatch(/<a class="mc-rev-src" href="https:\/\/maps.example.com\/chrome" target="_blank" rel="noopener noreferrer">Google Review<span class="mc-sr"> \(opens Google Maps\)<\/span><\/a>/);
    expect(visibleText(rev)).toContain('See Our Google Reviews');
    const all = render(FEATURES, { copy: { testimonialPlaceholders: FEATURES.generatedCopy.testimonialPlaceholders.map((q) => ({ ...q, source: 'google' })) } });
    expect(visibleText(sectionHtml(all, 'testimonials'))).toContain('Read More Reviews');
    const noPlace = sectionHtml(render(FEATURES, { biz: { googlePlace: null } }), 'testimonials');
    expect(noPlace).toContain('<span class="mc-rev-src">Google Review</span>');
    expect(noPlace).not.toContain('mc-rev-more');
  });

  it('puts the owner\'s photo behind the contact section with readable copy', () => {
    for (const colors of [{}, CUSTOM_COLORS, { bg: '#ffffff', text: '#111111', accent: '#2563eb' }]) {
      const html = render(FEATURES, { colors });
      expect(openTag(html, 'cta')).toContain('mc-section mc-contact mc-ctaph');
      expect(sectionHtml(html, 'cta')).toContain('class="mc-ctaph-photo"');
      const bg = token(html, '--mc-ctaph-bg');
      expect(contrastRatio(token(html, '--mc-ctaph-text'), bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(token(html, '--mc-ctaph-muted'), bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(render(FEATURES, { images: { ...FEATURES.images, cta: undefined } })).not.toContain('class="mc-ctaph');
  });
});

describe('colors, claims and order with every feature on', () => {
  it('repairs the hero card colors on any palette', () => {
    const palettes = [{}, CUSTOM_COLORS, { bg: '#ffffff', text: '#777777', accent: '#ffe066', muted: '#bbbbbb' }, { bg: '#f6f7f9', accent: '#3b5bdb', text: '#14161a', secondary: '#ffffff' }];
    for (const colors of palettes) {
      const html = render(FEATURES, { colors });
      for (const part of ['card', 'opt', 'row']) {
        const bg = token(html, `--mc-hq-${part}-bg`);
        for (const role of ['text', 'muted']) {
          expect({ part, role, ok: contrastRatio(token(html, `--mc-hq-${part}-${role}`), bg) >= 4.5 }).toEqual({ part, role, ok: true });
        }
      }
      expect(contrastRatio(token(html, '--mc-hq-card-accent'), token(html, '--mc-hq-card-bg'))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('publishes no editor text or invented claims', () => {
    for (const fx of [FEATURES, { ...FEATURES, generatedCopy: { ...FEATURES.generatedCopy, heroCard: 'list' } }]) {
      const html = render(fx);
      expect(html).not.toContain('data-acg-editor-only');
      expect(visibleText(html)).not.toMatch(EDITOR_TEXT);
      expect(decode(html)).not.toMatch(BANNED_CLAIMS);
    }
  });

  it('orders the added sections after their predecessor until the owner places them', () => {
    const html = render(FEATURES);
    expect(orderOf(html, 'brands')).toBe(orderOf(html, 'statsBar'));
    expect(orderOf(html, 'featured')).toBe(orderOf(html, 'services'));
    // A saved order from before the features: old values kept, ties follow.
    const saved = ['hero', 'about', 'services', 'testimonials', 'gallery', 'cta', 'statsBar', 'awards'];
    const legacy = render(FEATURES, { copy: { sectionOrder: saved } });
    for (const id of saved) expect(orderOf(legacy, id)).toBe(saved.indexOf(id));
    expect(orderOf(legacy, 'brands')).toBe(saved.indexOf('statsBar'));
    expect(orderOf(legacy, 'featured')).toBe(saved.indexOf('services'));
    // Placed by the owner: their slot wins.
    const placed = ['hero', 'featured', 'brands', ...LEGACY_IDS.slice(1)];
    const own = render(FEATURES, { copy: { sectionOrder: placed } });
    expect(orderOf(own, 'featured')).toBe(1);
    expect(orderOf(own, 'brands')).toBe(2);
    expect(orderOf(own, 'services')).toBe(placed.indexOf('services'));
  });

  it('exports addedSections and a footerSpec the editor can read', () => {
    const ids = mod.sections.map((s) => s.id);
    expect(mod.addedSections).toEqual(['brands', 'featured', 'beforeAfter']);
    for (const id of mod.addedSections) expect(ids).toContain(id);
    expect(ids.filter((id) => !mod.addedSections.includes(id))).toEqual(LEGACY_IDS);
    const spec = mod.footerSpec;
    expect(spec.columns.map((c) => c.type)).toEqual(['brand', 'links', 'areas', 'contact', 'hours']);
    expect(spec.columns.filter((c) => c.show).map((c) => c.type)).toEqual(['brand', 'links', 'contact']);
    for (const c of spec.columns.filter((x) => x.type !== 'brand')) expect(typeof spec.titles[c.type]).toBe('string');
    expect(spec).toMatchObject({ mergeHours: false, cta: false, ctaLabel: 'Book Now' });
  });
});

describe('round-1 fixes', () => {
  it('gives the contact photo its own scrim, with copy readable over a bright photo and a visible highlight', () => {
    for (const colors of [{}, CUSTOM_COLORS, { bg: '#ffffff', text: '#111111', accent: '#2563eb' }]) {
      const html = render(FEATURES, { colors });
      const t = deriveTheme(buildTemplateMeta(ID, colors, FEATURES.customFonts).colors);
      const base = heroScrimBase(t.bg, t.isDark);
      expect(token(html, '--mc-ctaph-scrim')).toMatch(/^linear-gradient\(90deg/);
      // At least 80% scrim where the copy sits: a near-white photo pixel
      // shows through at most a fifth.
      const bright = mix(base, '#f2f2f2', 0.2);
      expect(contrastRatio(token(html, '--mc-ctaph-text'), bright)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(token(html, '--mc-ctaph-muted'), bright)).toBeGreaterThanOrEqual(4.5);
    }
    const css = styleBlock(render(FEATURES));
    expect(css).toContain('.mc-ctaph-scrim{position:absolute;inset:0;z-index:-2;background:var(--mc-ctaph-scrim)}');
    expect(css).not.toContain('.mc-ctaph-scrim{background:var(--mc-scrim)}');
    expect(css).toMatch(/\.mc-ctaph \.mc-h2 \.mc-chrome-text\{[^}]*text-decoration:underline/);
  });

  it('moves the social icons to the contact column while the logo column is off', () => {
    const biz = { instagram: '@chrometest' };
    const off = footerHtml(render(FEATURES, { biz, copy: { footer: { columns: [{ type: 'brand', show: false }, { type: 'contact' }] } } }));
    expect(off).toContain('class="mc-social"');
    expect(off).toContain('instagram.com/chrometest');
    const alone = footerHtml(render(FEATURES, { biz: { ...biz, phone: '', email: '', city: '', state: '' }, copy: { footer: { columns: [{ type: 'brand', show: false }, { type: 'contact' }] } } }));
    expect(alone).toContain('class="mc-social"');
    expect(count(footerHtml(render(FEATURES, { biz })), 'class="mc-social"')).toBe(1);
  });

  it('breaks a long footer email before its @ in the owner\'s footer only', () => {
    const biz = { email: 'topchoicedetailingfl@example.com' };
    expect(footerHtml(render(FEATURES, { biz }))).toContain('topchoicedetailingfl<wbr/>@example.com');
    expect(footerHtml(render(LEGACY, { biz }))).not.toContain('<wbr');
  });

  it('shows the Reviews heading badge with the Google reviews widget, and names the section by its heading', () => {
    const widget = render(FEATURES, { copy: { googleWidgetKey: 'w-1' } });
    expect(sectionHtml(widget, 'testimonials')).toContain('class="mc-rev-g"');
    const titled = render(FEATURES, { copy: { googleWidgetKey: 'w-1', sectionTitles: { testimonials: { title: 'Our Reviews' } } } });
    expect(openTag(titled, 'testimonials')).toContain('aria-label="Our Reviews"');
  });

  it('styles the card\'s Back and Call buttons like the design\'s own, and keeps the featured band on the page grid', () => {
    const css = styleBlock(render(FEATURES));
    expect(css).toContain('.mc-hq-back,.mc-hq-q-call{font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}');
    expect(css).toContain('.mc-ft-feat-solo{margin-left:0}');
    expect(css).toMatch(/@container \(max-width:600px\)\{[^@]*\.mc-ft-band>\.mc-rings\{top:0;right:-60cqi;width:120cqi\}/);
  });
});
