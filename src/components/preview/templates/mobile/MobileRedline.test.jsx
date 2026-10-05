// mobile_redline specifics beyond the shared contract (templates.render.test.jsx):
// the optional data it reads (Google place badge, review sources, package
// includes / badges, section headings with an accent phrase, per-day hours
// with a text value, featured service, vehicle makes, service areas) must
// render only from owner data and never produce an invented claim.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './MobileRedline.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { normalizeCopy } from '../../../../lib/normalizeCopy.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { FIXTURES } from '../__fixtures__/businesses.js';
import { splitAccent, trailingWords, serviceAreasOf, formatTimeRange, phoneDisplay, serviceIncludes, bulletItems, trustItems, intentHref, bookingWorded, footerColumnsOf, FOOTER_COLUMN_TYPES } from '../kit/content.js';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { GoogleRatingBadge, googleRatingOf, googlePlaceUrl, googleBadgePlacements, StarRow, GOOGLE_STAR_GOLD } from '../kit/GoogleRatingBadge.jsx';
import { contrastRatio, isDark, hexToRgb, mix } from '../kit/theme.js';
import { vehicleMakesFor, findVehicleMake, VEHICLE_MAKES } from '../kit/vehicleMakes.js';

const Redline = mod.default;
const ID = 'mobile_redline';

// Same list as templates.render.test.jsx BANNED_CLAIMS (keep in sync).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[★☆⭐]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
const count = (html, needle) => html.split(needle).length - 1;
// The rendered elements without the template's <style> blocks (whose
// selectors name every class).
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

const PER_DAY = { Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '8am-4pm', Sun: 'By Appointment' };
const PLACE = { placeName: 'Redline Test Detailing', rating: 5, reviewCount: 137, url: 'https://maps.example.com/redline' };

// A mobile detailer with every optional field this template reads.
const RICH = {
  businessInfo: {
    businessName: 'Redline Test Detailing',
    businessType: 'mobile_detailing',
    phone: '(407) 555-0199',
    email: 'hello@example.com',
    city: 'Orlando',
    state: 'FL',
    instagram: '@redline.test',
    hours: PER_DAY,
    serviceAreas: ['Lake Nona', 'Kissimmee', 'Winter Park', 'Oviedo', 'Sanford'],
    insured: true,
    awards: [],
    services: [
      { name: 'Refresh Detail', price: '120', summary: 'Inside-and-out refresh', includes: ['Interior:', 'Vacuum', 'Windows', 'Exterior:', 'Foam Hand Wash'] },
      { name: 'Signature Detail', price: '$180', badge: 'Most Popular', includes: ['Interior:', { text: 'Leather Treatment', highlight: true }, { text: 'Heading Plus:', highlight: true }, 'Vacuum'] },
      { name: 'Premium Detail', price: '$260', description: 'Steam cleaning and shampoo.' },
      { name: 'Ceramic Coating', price: '$600' },
    ],
  },
  generatedCopy: {
    headline: "Orlando's Most Trusted Mobile Detail",
    subheadline: 'We come to you.',
    aboutText: 'We detail cars.',
    sectionTitles: {
      hero: { accent: 'trusted' },
      services: { eyebrow: 'Our Menu', accent: 'Detail Package' },
      testimonials: { title: 'What Drivers Say', accent: 'Drivers Say', intro: 'Straight from our customers.' },
    },
    testimonialPlaceholders: [
      { name: 'Ana P.', text: 'Great job on my SUV.', source: 'google', rating: 5 },
      { name: 'Ben Q.', text: 'On time and careful.' },
      { name: 'Cy R.', text: 'Would book again.', source: 'google' },
    ],
    ctaHeadline: 'Ready To Book?',
  },
  images: {},
  customColors: {},
  customFonts: {},
};

function render(fx, { biz = {}, copy = {}, images, editor = false } = {}) {
  const el = createElement(Redline, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, fx.customColors, fx.customFonts),
    images: images || fx.images || {},
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

// A --rl-* token from the root's inline style ('' when absent).
const token = (html, name) => (html.match(new RegExp(`${name}:([^;"]+)`)) || [])[1]?.trim() || '';
// rgba(...) / #hex -> #rrggbb composited over `under` (a hex).
const flatten = (color, under) => {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  const u = hexToRgb(under);
  const ch = (c, k) => Math.round(c * a + u[k] * (1 - a)).toString(16).padStart(2, '0');
  return `#${ch(r, 'r')}${ch(g, 'g')}${ch(b, 'b')}`;
};

const sectionOpen = (html, id) => html.match(new RegExp(`<[a-z]+\\b[^>]*data-section="${id}"[^>]*>`, 'i'))?.[0] || null;
// The HTML of one section: from its opening tag to the next section's.
function sectionHtml(html, id) {
  const start = html.indexOf(`data-section="${id}"`);
  if (start < 0) return '';
  const next = html.indexOf('data-section="', start + 20);
  return html.slice(start, next < 0 ? html.indexOf('<footer') : next);
}

describe('Google rating badge', () => {
  it('renders nowhere without a connected place, or with only a rating or only a count', () => {
    // (FIXTURES.features has a connected place, so it is not one of these.)
    for (const fx of Object.values(FIXTURES).filter((f) => !f.businessInfo.googlePlace)) expect(markup(render(fx))).not.toContain('acg-gbadge');
    expect(markup(render(RICH))).not.toContain('acg-gbadge');
    expect(markup(render(RICH, { biz: { googlePlace: { rating: 4.9 } } }))).not.toContain('acg-gbadge');
    expect(markup(render(RICH, { biz: { googlePlace: { reviewCount: 88 } } }))).not.toContain('acg-gbadge');
    expect(markup(render(RICH, { biz: { googlePlace: { rating: 0, reviewCount: 88 } } }))).not.toContain('acg-gbadge');
    expect(googleRatingOf(null)).toBeNull();
    expect(googleRatingOf({ rating: 6, reviewCount: 3 })).toBeNull();
  });

  it('shows rating, count and SVG stars in the hero and footer by default, linked to the place', () => {
    const html = render(RICH, { biz: { googlePlace: PLACE } });
    expect(count(markup(html), 'acg-gbadge-pill')).toBe(1);
    expect(count(markup(html), 'acg-gbadge-inline')).toBe(1);
    const hero = sectionHtml(html, 'hero');
    expect(hero).toContain('acg-gbadge-pill');
    const text = visibleText(hero);
    expect(text).toContain('Google');
    expect(text).toContain('5.0');
    expect(text).toContain('137 reviews');
    expect(hero).toMatch(/acg-gbadge-stars[^>]*>(<span[^>]*>)?<svg/);
    expect(decode(html)).toContain('href="https://maps.example.com/redline"');
    expect(visibleText(html)).toContain('5.0 · 137 Google reviews');
    expect(decode(html)).not.toMatch(BANNED_CLAIMS);
    expect(visibleText(html)).not.toMatch(BANNED_CLAIMS);
  });

  it('links a place id when there is no url, and honors copy.googleBadge placements', () => {
    expect(googlePlaceUrl({ placeId: 'ChIJ_test' })).toBe('https://www.google.com/maps/place/?q=place_id:ChIJ_test');
    expect(googlePlaceUrl({ url: 'javascript:alert(1)' })).toBeNull();
    const byId = render(RICH, { biz: { googlePlace: { placeId: 'ChIJ_test', rating: 4.8, reviewCount: 52 } } });
    expect(decode(byId)).toContain('href="https://www.google.com/maps/place/?q=place_id:ChIJ_test"');
    const footerOnly = markup(render(RICH, { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: ['footer'] } } }));
    expect(footerOnly).not.toContain('acg-gbadge-pill');
    expect(footerOnly).toContain('acg-gbadge-inline');
    expect(markup(render(RICH, { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: [] } } }))).not.toContain('acg-gbadge');
    expect(googleBadgePlacements(undefined, ['hero'])).toEqual(['hero']);
  });

  it('links to more reviews only with a place link and Google-marked quotes', () => {
    expect(visibleText(render(RICH))).not.toMatch(/Read More Reviews|See Our Google Reviews/);
    const allGoogle = { testimonialPlaceholders: RICH.generatedCopy.testimonialPlaceholders.map((q) => ({ ...q, source: 'google' })) };
    expect(visibleText(render(RICH, { biz: { googlePlace: { placeId: 'ChIJ_x' } }, copy: allGoogle }))).toContain('Read More Reviews');
    // A mix of Google and other quotes: the link doesn't imply all are Google's.
    const mixed = visibleText(render(RICH, { biz: { googlePlace: { placeId: 'ChIJ_x' } } }));
    expect(mixed).toContain('See Our Google Reviews');
    expect(mixed).not.toContain('Read More Reviews');
  });

  it('names the badge with its visible words first', () => {
    const pill = renderToStaticMarkup(createElement(GoogleRatingBadge, { place: PLACE }));
    expect(decode(pill)).toContain('aria-label="Google 5.0 · 137 reviews (rating out of 5, opens Google Maps)"');
    const inline = renderToStaticMarkup(createElement(GoogleRatingBadge, { place: { rating: 4.8, reviewCount: 52 }, variant: 'inline' }));
    expect(decode(inline)).toContain('aria-label="4.8 · 52 Google reviews (rating out of 5)"');
    expect(decode(pill + inline)).not.toMatch(BANNED_CLAIMS);
  });

  it('darkens the star gold on a light page pill so the stars stay visible', () => {
    const light = { bg: '#ffffff', text: '#111111', secondary: '#f3f4f6', accent: '#2563eb', muted: '#555555' };
    const rev = sectionHtml(render({ ...RICH, customColors: light }, { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: ['reviews'] } } }), 'testimonials');
    const fill = rev.match(/acg-gbadge-stars[^>]*>(?:<span[^>]*>)?<svg[^>]*><path d="[^"]*" fill="(#[0-9a-f]{6})"/)?.[1];
    expect(fill).toBeTruthy();
    expect(contrastRatio(fill, '#ffffff')).toBeGreaterThanOrEqual(3);
    // The hero pill sits on the page too when there is no hero photo; over
    // a photo (a dark scrim) it keeps Google's gold.
    const heroFill = (images) => sectionHtml(render({ ...RICH, customColors: light }, { biz: { googlePlace: PLACE }, images }), 'hero')
      .match(/acg-gbadge-stars[^>]*>(?:<span[^>]*>)?<svg[^>]*><path d="[^"]*" fill="(#[0-9a-f]{6})"/)?.[1];
    expect(contrastRatio(heroFill({}), '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(heroFill({ hero: 'https://example.com/h.jpg' })).toBe(GOOGLE_STAR_GOLD);
  });

  it('draws a 4.8 rating as four full stars and a partial one', () => {
    const html = renderToStaticMarkup(createElement(StarRow, { rating: 4.8, size: 16 }));
    expect(count(html, '<svg')).toBe(6);
    expect(html).toContain('clip-path:inset(0 20% 0 0)');
    expect(renderToStaticMarkup(createElement(StarRow, { rating: 5 }))).not.toContain('clip-path');
  });

  it('keeps the hero pill readable on a light palette with a hero photo', () => {
    const light = { bg: '#ffffff', text: '#111111', secondary: '#f3f4f6', accent: '#d62828', muted: '#555555' };
    const html = render({ ...RICH, customColors: light }, { biz: { googlePlace: PLACE }, images: { hero: 'https://example.com/hero.jpg' } });
    expect(html).toMatch(/\.rl-pill\{[^}]*background:var\(--rl-hero-glass\)/);
    const heroBg = token(html, '--rl-hero-bg');
    const glass = flatten(token(html, '--rl-hero-glass'), heroBg);
    expect(isDark(glass)).toBe(true);
    expect(contrastRatio(token(html, '--rl-hero-text'), glass)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token(html, '--rl-hero-muted'), glass)).toBeGreaterThanOrEqual(4.5);
    // The same pill in the reviews section sits on the (light) page.
    const rev = render({ ...RICH, customColors: light }, { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: ['reviews'] } } });
    expect(sectionHtml(rev, 'testimonials')).toContain('rl-pill rl-pill-page');
  });
});

describe('no invented claims from the template itself', () => {
  it.each(Object.keys(FIXTURES))('shared fixture %s, editor and published', (name) => {
    for (const editor of [false, true]) {
      const html = render(FIXTURES[name], { editor });
      expect(decode(html)).not.toMatch(BANNED_CLAIMS);
      expect(visibleText(html)).not.toMatch(BANNED_CLAIMS);
    }
  });

  it('adds no insurance, mobile or Google wording the owner did not give', () => {
    const shop = render(FIXTURES.full);
    const text = visibleText(shop);
    expect(text).not.toMatch(/insured|fully mobile|google review/i);
    expect(text).not.toContain('We Come to You');
    const notTrue = visibleText(render(RICH, { biz: { insured: 'yes' } }));
    expect(notTrue).not.toMatch(/insured/i);
    const rich = visibleText(render(RICH));
    expect(rich).toContain('Fully Insured');
    expect(rich).toContain('Orlando, FL · Fully Mobile · Insured');
  });

  it('shows About stats only from copy.aboutStats', () => {
    expect(markup(render(FIXTURES.full))).not.toContain('rl-stats');
    const html = render(FIXTURES.full, { copy: { aboutStats: [{ value: '12', label: 'Vans' }, { value: '', label: 'Empty' }] } });
    expect(html).toContain('--rl-n:1');
    expect(visibleText(html)).toContain('12 Vans');
    expect(visibleText(html)).not.toContain('Empty');
  });
});

describe('packages', () => {
  it('lists what is included with group headings and highlighted additions', () => {
    const html = render(RICH);
    const services = sectionHtml(html, 'services');
    expect(services).toContain('<details class="rl-inc" open="">');
    expect(services).toContain('<li class="rl-inc-h">Interior:</li>');
    expect(services).toContain('<li class="rl-inc-h">Exterior:</li>');
    expect(services).toMatch(/<span class="rl-inc-hl">Leather Treatment<\/span>/);
    // A heading is never highlighted, even when flagged.
    expect(services).toContain('<li class="rl-inc-h">Heading Plus:</li>');
    expect(services).toMatch(/<span>Vacuum<\/span>/);
    expect(serviceIncludes(['A:', { text: 'B', highlight: true }, { text: '' }, 7])).toEqual([
      { text: 'A:', heading: true, highlight: false },
      { text: 'B', heading: false, highlight: true },
    ]);
    // No includes and a plain description: no accordion.
    expect(markup(render(FIXTURES.full))).not.toContain('rl-inc');
    expect(bulletItems('• Vacuum\n• Windows\n• Tire shine')).toEqual(['Vacuum', 'Windows', 'Tire shine']);
    expect(bulletItems('Full exterior wash, interior vacuum.')).toBeNull();
  });

  it('marks only a package with an owner badge, verbatim, with the accent border', () => {
    const html = render(RICH);
    expect(count(html, 'rl-card rl-card-feat')).toBe(1);
    expect(html).toContain('<span class="rl-badge">Most Popular</span>');
    expect(markup(render(FIXTURES.full))).not.toContain('rl-card-feat');
    expect(visibleText(render(FIXTURES.full))).not.toMatch(/most popular/i);
  });

  it('shows the price card only for packages with a price', () => {
    // The sparse fixture's AI services have no prices: no card, and the hero
    // keeps its buttons.
    const sparse = sectionHtml(render(FIXTURES.sparse), 'hero');
    expect(sparse).not.toContain('rl-quote');
    expect(sparse).not.toContain('rl-has-card');
    expect(sparse).toContain('rl-hero-btns');
    const mixed = decode(sectionHtml(render(RICH, { biz: { services: [
      { name: 'Wash' }, { name: 'Detail', price: '$150' }, { name: 'Coat', price: '$500' },
    ] } }), 'hero'));
    expect(count(mixed, 'class="rl-sr rl-radio"')).toBe(2);
    expect(mixed).not.toContain('value="Wash"');
    // A text price stays on its package card, never "Your Price: Call".
    const text = decode(render(RICH, { biz: { services: [
      { name: 'Quote', price: 'Call for quote' }, { name: 'Detail', price: '$150' },
    ] } }));
    expect(count(sectionHtml(text, 'hero'), 'class="rl-sr rl-radio"')).toBe(1);
    expect(sectionHtml(text, 'hero')).not.toContain('value="Quote"');
    expect(visibleText(sectionHtml(text, 'services'))).toContain('Call for quote');
  });

  it('sizes each price-card step to its content under the copy, and keeps one height beside it', () => {
    const css = render(RICH).match(/<style>\s*(\.rl-root[\s\S]*?)<\/style>/)[1];
    // Shared-cell stacking (steps and every package's row) only from 900px.
    const wide = css.search(/@container \(min-width:900px\)\{\s*@supports selector\(:has\(\*\)\)\{/);
    expect(wide).toBeGreaterThan(0);
    expect(css.indexOf('.rl-s1,.rl-s2{grid-row:2;grid-column:1}')).toBeGreaterThan(wide);
    expect(css.indexOf('.rl-res-set>.rl-res{display:block;grid-area:1/1;visibility:hidden}')).toBeGreaterThan(wide);
    // The picked row inherits step 2's visibility: 'visible' would show it
    // through step 1.
    expect(css).toContain('.rl-res-set>.rl-pk-3{visibility:inherit}');
    expect(css).not.toMatch(/\.rl-res-set>[^{]*\{visibility:visible/);
    // Below that, step 1 leaves the layout when step 2 shows.
    expect(css).toContain('.rl-quote:has(.rl-go:checked) .rl-s1{display:none}');
    // "Get My Price" can't be reached by keyboard before a package is picked.
    expect(css).toContain('.rl-quote:not(:has(.rl-radio:checked)) .rl-go{visibility:hidden}');
    expect(count(sectionHtml(render(RICH), 'hero'), 'class="rl-res-set"')).toBe(1);
  });

  it('puts the first three packages in the price card, each with its own booking link', () => {
    const html = decode(render(RICH));
    const hero = sectionHtml(html, 'hero');
    expect(count(hero, 'class="rl-sr rl-radio"')).toBe(3);
    for (const n of ['Refresh Detail', 'Signature Detail', 'Premium Detail']) {
      expect(hero).toContain(`data-scheduler-service="${n}"`);
    }
    expect(hero).not.toContain('Ceramic Coating');
    expect(hero).toContain('<label for="rl-pkg-0" class="rl-opt">');
    expect(hero).toContain('$120');
    expect(hero).not.toMatch(/<form\b/);
  });
});

describe('reviews', () => {
  it('labels and links only testimonials marked as Google reviews; stars need a rating', () => {
    const html = render(RICH, { biz: { googlePlace: PLACE } });
    const reviews = sectionHtml(html, 'testimonials');
    expect(count(reviews, 'Google Review<')).toBe(2);
    expect(count(reviews, 'rl-rev-stars')).toBe(1);
    // The card stays a <figure>; only the label links to Google.
    expect(count(reviews, '<figure class="rl-rev"')).toBe(3);
    expect(count(reviews, '<a class="rl-rev-src" href="https://maps.example.com/redline"')).toBe(2);
    const plain = sectionHtml(render(FIXTURES.full), 'testimonials');
    expect(plain).not.toContain('Google Review');
    expect(plain).not.toContain('rl-rev-stars');
    expect(visibleText(plain)).toContain('What Our Customers Say');
  });

  it('never titles AI-written quotes as Google reviews, even with a connected place', () => {
    const html = render(FIXTURES.full, { biz: { googlePlace: { rating: 4.8, reviewCount: 52, placeId: 'ChIJ_x' } } });
    const reviews = sectionHtml(html, 'testimonials');
    expect(visibleText(reviews)).not.toMatch(/google review/i);
    expect(visibleText(reviews)).toContain('What Our Customers Say');
    expect(visibleText(reviews)).not.toContain('Read More Reviews');
    // The rating itself still shows through the badge.
    expect(markup(html)).toContain('acg-gbadge-pill');
    // Only when every quote shown is a Google review may the heading say so.
    const allGoogle = RICH.generatedCopy.testimonialPlaceholders.map((q) => ({ ...q, source: 'google' }));
    const google = render(RICH, { biz: { googlePlace: PLACE }, copy: { sectionTitles: {}, testimonialPlaceholders: allGoogle } });
    expect(visibleText(sectionHtml(google, 'testimonials'))).toContain('137 Google Reviews');
    const mixed = visibleText(sectionHtml(render(RICH, { biz: { googlePlace: PLACE }, copy: { sectionTitles: {} } }), 'testimonials'));
    expect(mixed).toContain('What Our Customers Say');
    expect(mixed).not.toContain('137 Google Reviews');
  });

  it('drops the carousel controls for a single quote, and for two or three on desktop', () => {
    const one = render(RICH, { copy: { testimonialPlaceholders: [{ name: 'Ana P.', text: 'Great job.' }] } });
    expect(sectionHtml(one, 'testimonials')).toContain('class="rl-track rl-one"');
    expect(sectionHtml(render(RICH), 'testimonials')).toContain('class="rl-track rl-n3"');
    const four = [...RICH.generatedCopy.testimonialPlaceholders, { name: 'Di S.', text: 'Spotless.' }];
    expect(sectionHtml(render(RICH, { copy: { testimonialPlaceholders: four } }), 'testimonials')).toContain('class="rl-track"');
  });
});

describe('section headings', () => {
  it('highlights the owner accent phrase, whole words and case-insensitive, keeping the headline intact', () => {
    const hero = decode(sectionHtml(render(RICH), 'hero'));
    expect(hero).toContain("Orlando's Most <span class=\"rl-em\">Trusted</span> Mobile Detail");
    const noAccent = decode(sectionHtml(render(RICH, { copy: { sectionTitles: { hero: { accent: 'Brand New' } } } }), 'hero'));
    expect(noAccent).toContain("Orlando's Most Trusted Mobile Detail");
    expect(noAccent).not.toMatch(/<h1[^>]*>.*rl-em/);
    const services = decode(sectionHtml(render(RICH), 'services'));
    expect(services).toContain('Our Menu');
    expect(services).toContain('Choose Your <span class="rl-em">Detail Package</span>');
    const reviews = decode(sectionHtml(render(RICH), 'testimonials'));
    expect(reviews).toContain('What <span class="rl-em">Drivers Say</span>');
    expect(reviews).toContain('Straight from our customers.');
    expect(splitAccent('Cards For Every Car', 'car')).toEqual({ before: 'Cards For Every ', match: 'Car', after: '' });
    expect(splitAccent('Scarlet', 'car')).toBeNull();
    expect(splitAccent('Orlando & Beyond', '& Beyond')).toEqual({ before: 'Orlando ', match: '& Beyond', after: '' });
    // Never cuts a possessive: "Orlando" is not a whole word in "Orlando's".
    expect(splitAccent("Orlando's Most Trusted", 'Orlando')).toBeNull();
    expect(splitAccent('Orlando’s Most Trusted', 'Orlando')).toBeNull();
    expect(splitAccent("Orlando's Most Trusted", "Orlando's")).toEqual({ before: '', match: "Orlando's", after: ' Most Trusted' });
    expect(trailingWords('Choose Your Detail Package')).toBe('Detail Package');
    expect(trailingWords('Services')).toBe('');
  });
});

describe('buttons', () => {
  const heroLinks = (html) => [...sectionHtml(html, 'hero').matchAll(/<a class="rl-btn[^"]*" href="([^"]*)"/g)].map((m) => m[1]);

  it('Button 2 calls the phone unless its URL or wording says otherwise; the template default opens the card', () => {
    expect(heroLinks(render(RICH, { copy: { ctaSecondary: 'Call Now' } }))[1]).toBe('tel:4075550199');
    expect(heroLinks(render(RICH, { copy: { ctaSecondary: 'Learn More' } }))[1]).toBe('tel:4075550199');
    expect(heroLinks(render(RICH, { copy: { ctaSecondary: '' } }))[1]).toBe('#quote');
    expect(heroLinks(render(RICH, { copy: { ctaSecondary: 'Get a Quote', ctaSecondaryUrl: '#quote' } }))[1]).toBe('#quote');
  });

  it("routes generated labels by what they say (normalizeCopy's defaults and AI wording)", () => {
    // Every generated site stores both labels.
    const gen = normalizeCopy({ headline: 'H' }, RICH.businessInfo);
    expect([gen.ctaPrimary, gen.ctaSecondary]).toEqual(['Contact Us', 'View Services']);
    expect(heroLinks(render(RICH, { copy: { ctaPrimary: gen.ctaPrimary, ctaSecondary: gen.ctaSecondary } }))).toEqual(['#contact', '#services']);
    const ai = (ctaPrimary, ctaSecondary) => heroLinks(render(RICH, { copy: { ctaPrimary, ctaSecondary } }));
    expect(ai('View Our Services', 'Get Your Free Quote')).toEqual(['#services', '#quote']);
    // Wording that names a block the page doesn't show keeps the default.
    expect(ai('See Our Work', 'Read Reviews')).toEqual(['#services', '#reviews']);
    // No price card: a quote label goes to the contact band.
    expect(heroLinks(render(RICH, { biz: { services: [{ name: 'Wash' }] }, copy: { ctaSecondary: 'Get a Quote' } }))[1]).toBe('#contact');
    // A booking label opens the booking widget too; a phone link gets the phone icon.
    const book = decode(sectionHtml(render(RICH, { copy: { ctaPrimary: 'Book Your Detail' } }), 'hero'));
    expect(book).toContain('<a class="rl-btn" href="#contact" data-scheduler-trigger="">');
    const call = sectionHtml(render(RICH, { copy: { ctaSecondary: 'Call Now' } }), 'hero');
    expect(call).toMatch(/<a class="rl-btn rl-btn-line" href="tel:4075550199"><svg[^>]*><path d="M13\.832/);
  });

  it('points the primary button only at a section that renders', () => {
    expect(heroLinks(render(RICH))[0]).toBe('#services');
    expect(heroLinks(render(RICH, { copy: { hiddenSections: ['services'] } }))[0]).toBe('#contact');
  });

  it("uses Button 2's URL for the CTA band's call button only when that button has its own text", () => {
    const band = (copy) => decode(sectionHtml(render(RICH, { copy }), 'cta'));
    expect(band({ ctaSecondaryUrl: '#gallery' })).toContain('<a class="rl-btn rl-btn-light" href="tel:4075550199"');
    expect(band({ ctaSecondaryUrl: '#gallery', ctaSecondaryText: 'See Our Work' })).toContain('<a class="rl-btn rl-btn-light" href="#gallery"');
  });
});

describe('long content', () => {
  it('steps the headline size down for long headlines', () => {
    expect(sectionHtml(render(RICH), 'hero')).toContain('<h1 class="rl-h1">');
    const long = 'We Bring The Detail Shop To Your Driveway Anywhere In Greater Orlando And Kissimmee';
    expect(sectionHtml(render(RICH, { copy: { headline: long } }), 'hero')).toContain('<h1 class="rl-h1 rl-h1-l">');
    expect(sectionHtml(render(RICH, { copy: { headline: `${long} With Ceramic Coating And Paint Correction` } }), 'hero')).toContain('<h1 class="rl-h1 rl-h1-xl">');
  });

  it('keeps a long business name out of the default About heading', () => {
    const long = visibleText(sectionHtml(render(RICH, { biz: { businessName: 'Precision Premium Auto Detailing Specialists of Northern Virginia' } }), 'about'));
    expect(long).toContain('Why Choose Us');
    expect(visibleText(sectionHtml(render(RICH), 'about'))).toContain('Why Redline Test Detailing Is The Right Choice For Your Car');
  });
});

describe('hours', () => {
  it('prints a per-day text value verbatim and never calls it closed', () => {
    const text = visibleText(render(RICH));
    expect(text).toContain('Sunday By Appointment');
    expect(text).toContain('Monday 8:00 AM – 6:00 PM');
    expect(text).toContain('Mon–Fri: 8:00 AM – 6:00 PM');
    expect(text).toContain('Sun: By Appointment');
    expect(text).not.toMatch(/\bclosed\b/i);
  });

  it('names a closed day only for the per-day shape', () => {
    const text = visibleText(render(RICH, { biz: { hours: { ...PER_DAY, Sun: '' } } }));
    expect(text).toContain('Sunday Closed');
    expect(text).toContain('Sun: Closed');
  });

  it('keeps free-text hours exactly as written, never expanded into days', () => {
    for (const hours of ['Mon-Fri 9am-5pm, Sat 10am-2pm', 'By appointment only']) {
      const text = visibleText(render(RICH, { biz: { hours } }));
      expect(text).toContain(hours);
      expect(text).not.toMatch(/\b(Monday|Tuesday|Saturday|closed)\b/i);
    }
    const legacy = visibleText(render(RICH, { biz: { hours: { 'Mon-Fri': '8am-6pm' } } }));
    expect(legacy).toContain('Mon-Fri 8am-6pm');
    expect(legacy).not.toMatch(/\b(Monday|closed)\b/i);
    expect(formatTimeRange('8:30am - 6pm')).toBe('8:30 AM – 6:00 PM');
    expect(formatTimeRange('By Appointment')).toBe('By Appointment');
  });
});

describe('sections', () => {
  it.each(mod.sections.map((s) => s.id))('hiding "%s" renders nothing for it', (id) => {
    const full = render(RICH, { biz: { awards: ['Best of Orlando 2025'] }, copy: { hiddenSections: [id] } });
    expect(sectionOpen(full, id)).toBeNull();
    const editor = render(RICH, { biz: { awards: ['Best of Orlando 2025'] }, copy: { hiddenSections: [id] }, editor: true });
    expect(sectionOpen(editor, id)).toBeNull();
  });

  it('drops menu links to hidden sections', () => {
    const html = render(RICH, { copy: { hiddenSections: ['services', 'featured'] } });
    const menu = html.slice(html.indexOf('acg-menu-panel'), html.indexOf('</details>'));
    expect(menu).not.toContain('#services');
    expect(menu).not.toContain('#featured');
    expect(menu).toContain('#locations');
  });

  it('shows the featured section only for a matching service or copy.featuredService', () => {
    expect(sectionOpen(render(FIXTURES.sparse), 'featured')).toBeNull();
    const editor = render(FIXTURES.sparse, { editor: true });
    expect(sectionOpen(editor, 'featured')).not.toBeNull();
    expect(sectionHtml(editor, 'featured')).toContain('data-acg-editor-only');
    const matched = sectionHtml(render(RICH), 'featured');
    expect(visibleText(matched)).toContain('Protect Your Vehicle With Ceramic Coating');
    expect(visibleText(matched)).not.toContain('Starting at');
    const own = render(FIXTURES.sparse, {
      copy: { featuredService: { serviceName: 'Paint Correction', priceFrom: '$450', bullets: ['Swirl removal'], buttonText: 'See Options', buttonUrl: 'https://example.com/pc' } },
    });
    const text = visibleText(sectionHtml(own, 'featured'));
    expect(text).toContain('Paint Correction');
    expect(text).toContain('Starting at $450');
    expect(text).toContain('Swirl removal');
    expect(decode(sectionHtml(own, 'featured'))).toContain('href="https://example.com/pc" data-scheduler-bound=""');
  });

  it('says what an AI-listed featured service is, and skips a band with nothing to say', () => {
    const ai = (items) => render(FIXTURES.sparse, { copy: { servicesSection: { items } } });
    const described = sectionHtml(ai([{ name: 'Wash', description: 'Hand wash.' }, { name: 'Ceramic Coating', description: 'Long-lasting protection.' }]), 'featured');
    expect(visibleText(described)).toContain('Long-lasting protection.');
    const bare = ai([{ name: 'Wash' }, { name: 'Ceramic Coating' }]);
    expect(sectionOpen(bare, 'featured')).toBeNull();
    expect(markup(bare)).not.toContain('href="#featured"');
    const editor = render(FIXTURES.sparse, { editor: true, copy: { servicesSection: { items: [{ name: 'Ceramic Coating' }] } } });
    expect(sectionHtml(editor, 'featured')).toContain('data-acg-editor-only');
    expect(visibleText(sectionHtml(editor, 'featured'))).toContain('Protect Your Vehicle With Ceramic Coating');
  });

  it('keeps the CTA band as #contact for the injected inquiry form', () => {
    expect(render(RICH)).toMatch(/<section data-section="cta" id="contact"/);
  });
});

describe('vehicle makes band', () => {
  it('writes each logo path once and reuses it in both marquee copies', () => {
    const html = sectionHtml(render(RICH), 'brands');
    expect(count(html, '<symbol ')).toBe(VEHICLE_MAKES.length);
    expect(count(html, '<use href="#rl-mk-')).toBe(VEHICLE_MAKES.length * 2);
    expect(count(html, 'aria-hidden="true" class="rl-mq-set"') + count(html, 'class="rl-mq-set" aria-hidden="true"')).toBe(1);
  });

  it('follows copy.vehicleMakes: known names get a logo, unknown ones text only', () => {
    const html = sectionHtml(render(RICH, { copy: { vehicleMakes: ['BMW', 'chevy', 'Rivian', 'bmw'] } }), 'brands');
    expect(count(html, '<symbol ')).toBe(2);
    // Three makes are repeated to fill the moving row; the repeats are marked
    // (hidden without motion, and from screen readers).
    expect(count(html, 'class="rl-mq-item"')).toBe(3 * 2);
    expect(count(html, 'class="rl-mq-item rl-mq-rep" aria-hidden="true"')).toBe(3 * 5);
    expect(visibleText(html)).toContain('Rivian');
    expect(html).toContain('<span class="rl-mq-t">Rivian</span>');
    expect(findVehicleMake('Mercedes')?.name).toBe('Mercedes-Benz');
    expect(vehicleMakesFor('').length).toBe(VEHICLE_MAKES.length);
  });
});

describe('service area', () => {
  it('lists owner areas, embeds a map of the city and colors the first four legend chips', () => {
    const html = decode(sectionHtml(render(RICH), 'locations'));
    expect(html).toContain('src="https://www.google.com/maps?q=Orlando%2C%20FL&z=10&output=embed"');
    expect(html).toContain('loading="lazy"');
    expect(html).toMatch(/<iframe title="Map of Orlando, FL"/);
    expect(count(html, 'var(--rl-legend-')).toBe(4);
    expect(count(html, 'class="rl-area"')).toBe(5);
    expect(visibleText(html)).toContain('Proudly Serving Orlando & Beyond');
  });

  it('keeps legend dots visible and distinct for a gray accent', () => {
    const html = render({ ...RICH, customColors: { bg: '#0b0b0b', accent: '#262626', text: '#f5f5f5', secondary: '#161616', muted: '#a3a3a3' } });
    const panel = token(html, '--rl-soft-bg');
    const dots = [1, 2, 3, 4].map((i) => token(html, `--rl-legend-${i}`));
    for (const d of dots) expect(contrastRatio(d, panel)).toBeGreaterThanOrEqual(3);
    expect(new Set(dots).size).toBe(4);
    expect(contrastRatio(token(html, '--rl-mark'), '#141414')).toBeGreaterThanOrEqual(3);
  });

  it('never invents areas', () => {
    expect(serviceAreasOf({})).toEqual([]);
    expect(serviceAreasOf({ city: 'Tucson' })).toEqual(['Tucson']);
    expect(serviceAreasOf({ city: 'Tucson', serviceArea: 'Pima County' })).toEqual(['Pima County']);
    expect(serviceAreasOf({ serviceArea: '30-mile radius from Miami' })).toEqual(['30-mile radius from Miami']);
    expect(serviceAreasOf({ serviceArea: 'Lake Nona, Kissimmee · Oviedo' })).toEqual(['Lake Nona', 'Kissimmee', 'Oviedo']);
    expect(phoneDisplay('(407) 555-0199')).toBe('407-555-0199');
    expect(phoneDisplay('+44 20 7946 0000')).toBe('+44 20 7946 0000');
  });
});

describe('hero chips from the Trust Bar', () => {
  it("shows the owner's items instead of the derived chips, minus old seeded samples", () => {
    const trustBar = [
      { emoji: 'icon:location', label: 'Orlando Metro', sub: '' },
      { emoji: '🚿', label: 'Waterless Wash', sub: '' },
      { emoji: '', label: 'Licensed', sub: 'Since 2018' },
      { emoji: '⭐', label: '4.9 Star Rating', sub: 'Customer Reviews' },
      { emoji: 'icon:shield', label: '', sub: 'no label' },
    ];
    const hero = sectionHtml(render(RICH, { copy: { trustBar } }), 'hero');
    const text = visibleText(hero);
    expect(text).toContain('Orlando Metro');
    expect(text).toContain('Waterless Wash');
    expect(text).toContain('Licensed · Since 2018');
    expect(text).not.toMatch(/4\.9 Star|We Come to You|Fully Insured/);
    expect(hero).toContain('<span class="rl-chip-emoji" aria-hidden="true">🚿</span>');
    expect(trustItems([{ label: 'Finance Available', sub: '0% for 12 months' }, { label: 'Warranty', sub: 'or we make it right' }]))
      .toEqual([{ emoji: '', label: 'Warranty', sub: '' }]);
    expect(trustItems('nope')).toEqual([]);
  });

  it('falls back to the derived facts without owner items', () => {
    for (const trustBar of [undefined, [], [{ label: '' }]]) {
      const text = visibleText(sectionHtml(render(RICH, { copy: { trustBar } }), 'hero'));
      expect(text).toContain('We Come to You');
      expect(text).toContain('Fully Insured');
    }
  });
});

describe('kit button intent', () => {
  it('maps a label to the target its words name, else the fallback', () => {
    const map = { tel: 'tel:1', quote: '#quote', contact: '#contact', services: '#services', gallery: null };
    expect(intentHref('Call Now', map, 'x')).toBe('tel:1');
    expect(intentHref('Get My Price', map, 'x')).toBe('#quote');
    expect(intentHref('Free Estimate', { ...map, quote: null }, 'x')).toBe('#contact');
    expect(intentHref('Schedule Service', map, 'x')).toBe('#contact');
    expect(intentHref('View Pricing', map, 'x')).toBe('#services');
    expect(intentHref('See Our Work', map, 'x')).toBe('x');
    expect(intentHref('', map, 'x')).toBe('x');
    expect(intentHref('Learn More', null, 'x')).toBe('x');
    expect(bookingWorded('Book Now')).toBe(true);
    expect(bookingWorded('View Services')).toBe(false);
  });
});

describe('robustness', () => {
  it('never links to a hidden contact band', () => {
    const html = markup(render(RICH, { copy: { hiddenSections: ['cta'] } }));
    expect(html).not.toContain('href="#contact"');
    expect(html).toContain('class="acg-actionbar-book" href="tel:4075550199"');
    const noPhone = markup(render(RICH, { biz: { phone: '' }, copy: { hiddenSections: ['cta'] } }));
    expect(noPhone).not.toContain('href="#contact"');
    expect(noPhone).toContain('class="acg-actionbar-book" href="mailto:hello@example.com"');
    expect(count(noPhone, 'href="mailto:hello@example.com" data-scheduler-trigger=""')).toBeGreaterThanOrEqual(4);
    const nothing = markup(render(RICH, { biz: { phone: '', email: '' }, copy: { hiddenSections: ['cta'] } }));
    expect(nothing).toContain('class="acg-actionbar-book" href="#top"');
    // With the band, booking links without a phone still land on it.
    expect(markup(render(RICH, { biz: { phone: '' } }))).toContain('class="acg-actionbar-book" href="#contact"');
  });

  it('sets text or long prices smaller and gives them their own line in the price card', () => {
    const html = render(RICH, { biz: { services: [
      { name: 'Full Interior & Exterior Signature', price: 'Starting at $1,299' },
      { name: 'Wash', price: '$150/$200/$250' },
      { name: 'Coat', price: '$1,250' },
      { name: 'Quote', price: 'Call for quote' },
      { name: 'Plain' },
    ] } });
    const hero = sectionHtml(html, 'hero');
    expect(count(hero, 'rl-opt-price rl-opt-price-t')).toBe(2);
    expect(count(hero, 'class="rl-opt rl-opt-l"')).toBe(2);
    expect(hero).toContain('<span class="rl-opt-price">$1,250</span>');
    const services = sectionHtml(html, 'services');
    expect(count(services, 'rl-card-price rl-price-t')).toBe(3);
    expect(services).toContain('<p class="rl-card-price">$1,250</p>');
    // No price, no price-aligning description height.
    expect(count(services, 'rl-card-np')).toBe(1);
  });

  it('keeps the hero buttons next to the price card when one points off the page', () => {
    expect(sectionHtml(render(RICH), 'hero')).toContain('class="rl-hero-btns"');
    expect(sectionHtml(render(RICH, { copy: { ctaPrimaryUrl: 'https://book.example.com' } }), 'hero')).toContain('class="rl-hero-btns rl-btns-keep"');
    expect(sectionHtml(render(RICH, { copy: { ctaPrimaryUrl: '#gallery' } }), 'hero')).toContain('class="rl-hero-btns"');
    expect(sectionOpen(render(RICH, { images: { hero: 'https://example.com/h.jpg' } }), 'hero')).toContain('rl-has-photo');
  });

  it('never offers a free quote the owner did not', () => {
    for (const businessType of ['tint_shop', 'something_else']) {
      const text = visibleText(sectionHtml(render(RICH, { biz: { businessType }, copy: { ctaHeadline: '' } }), 'cta'));
      expect(text).not.toMatch(/\bfree\b/i);
      expect(text).toContain('Book Your Appointment');
    }
  });

  it('wraps long business names on two lines instead of cutting them', () => {
    const nav = (businessName) => render(RICH, { biz: { businessName } }).match(/<span class="rl-word-1[^"]*">[^<]*<\/span>/)[0];
    expect(nav('Top Pick Mobile Detailing')).toBe('<span class="rl-word-1">Top Pick</span>');
    expect(nav('Sunshine State Auto Spa')).toBe('<span class="rl-word-1 rl-word-l">Sunshine State Auto Spa</span>');
  });

  it('labels controls with their visible words', () => {
    const html = decode(markup(render(RICH)));
    expect(html).toContain('id="rl-go" class="rl-sr rl-go" aria-label="Get my price"');
    expect(html).toContain('<a class="rl-call" href="tel:4075550199" aria-label="Call now, 407-555-0199">');
  });

  it('fills a letterboxed gallery tile from the same photo, lazily and hidden from assistive tech', () => {
    const imgs = { gallery0: 'https://example.com/a.jpg', gallery1: 'https://example.com/b.jpg' };
    const gal = sectionHtml(render(RICH, { images: imgs }), 'gallery');
    expect(count(gal, '<img class="rl-shot-bg" src="https://example.com/a.jpg" alt="" aria-hidden="true" loading="lazy"')).toBe(1);
    expect(count(gal, 'class="rl-shot-bg"')).toBe(2);
    expect(gal).not.toMatch(/--rl-g[nm]/);
    // A surface veil keeps thin strips beside portrait photos the tile color.
    const html = render(RICH, { images: imgs });
    expect(html).toContain('.rl-shot::before{content:&#x27;&#x27;;position:absolute;inset:0;z-index:-1;background:var(--rl-shot-veil)}'.replace(/&#x27;/g, "'"));
    expect(token(html, '--rl-shot-veil')).toMatch(/^linear-gradient\(90deg, #1a1818, rgba\(26, 24, 24, 0\.72\) 14%, .* #1a1818\)$/);
  });

  it('lets keyboard and touch users pause the makes band, and rings the carousel dots', () => {
    const html = render(RICH);
    expect(sectionOpen(html, 'brands')).toContain('tabindex="0"');
    expect(html).toContain('.rl-makes:focus-within .rl-mq-track{animation-play-state:paused}');
    expect(html).toContain('.rl-rev::scroll-marker:focus-visible{outline:2px solid var(--rl-focus)');
  });

  it('lines package prices up only where cards share a row', () => {
    const css = render(RICH).match(/<style>\s*(\.rl-root[\s\S]*?)<\/style>/)[1];
    expect(css).not.toMatch(/^\.rl-card-desc\{[^}]*min-height/m);
    expect(css).toContain('.rl-cards:not(.rl-cards-1) .rl-card:not(.rl-card-np) .rl-card-desc{min-height:112px}');
    expect(sectionHtml(render(RICH, { biz: { services: [{ name: 'Full Detail', price: '$200' }] } }), 'services')).toContain('class="rl-cards rl-cards-1"');
  });

  it('draws the menu icon as the lucide menu / x shapes in the text color', () => {
    const css = render(RICH).match(/<style>\s*(\.rl-root[\s\S]*?)<\/style>/)[1];
    expect(css).toMatch(/\.rl-nav \.acg-menu-bars\{width:20px;height:20px;background:currentColor;-webkit-mask:url\("data:image\/svg\+xml,/);
    expect(css).toContain(encodeURIComponent("d='M4 6h16M4 12h16M4 18h16'"));
    expect(css).toContain(encodeURIComponent("d='M18 6 6 18M6 6l12 12'"));
  });

  it('ships its stylesheet without comments', () => {
    const css = render(RICH).match(/<style>\s*(\.rl-root[\s\S]*?)<\/style>/)[1];
    expect(css).not.toContain('/*');
  });
});

describe('contrast beyond the solid token pairs', () => {
  const LIGHT_PALETTES = [
    { bg: '#f5f5f4', accent: '#2563eb', text: '#1c1917', secondary: '#ffffff', muted: '#78716c' },
    { bg: '#ffffff', accent: '#dc2626', text: '#111827', secondary: '#f3f4f6', muted: '#6b7280' },
    { bg: '#fafafa', accent: '#7c3aed', text: '#18181b', secondary: '#f4f4f5', muted: '#71717a' },
  ];

  it.each(LIGHT_PALETTES.map((c) => [c.bg, c]))('review cards and the price row stay readable (%s)', (_, colors) => {
    const html = render({ ...RICH, customColors: colors });
    for (const [fg, bg] of [['--rl-rev-text', '--rl-rev-bg'], ['--rl-rev-muted', '--rl-rev-bg'], ['--rl-row-text', '--rl-row-bg'], ['--rl-row-muted', '--rl-row-bg'], ['--rl-row-accent', '--rl-row-bg']]) {
      expect(contrastRatio(token(html, fg), token(html, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(markup(html)).not.toMatch(/--rl-tint/);
  });

  it.each([
    ['default', {}],
    ['light', { bg: '#f5f5f4', accent: '#2563eb', text: '#1c1917', secondary: '#ffffff', muted: '#78716c' }],
    ['navy low-contrast', { bg: '#0b1426', accent: '#1e3a8a', text: '#cbd5e1', secondary: '#14213d', muted: '#64748b' }],
  ])('repairs small hero and CTA text against the scrim with a photo showing through (%s)', (_, colors) => {
    const html = render({ ...RICH, customColors: colors }, { images: { hero: 'https://example.com/h.jpg', cta: 'https://example.com/c.jpg' } });
    const scrim = token(html, '--rl-hero-bg');
    const lit = mix(scrim, mix('#ffffff', '#000000', 0.5), 0.25);
    for (const t of ['--rl-hero-eyebrow', '--rl-hero-text', '--rl-hero-muted', '--rl-cta-text', '--rl-cta-muted']) {
      expect(contrastRatio(token(html, t), lit), t).toBeGreaterThanOrEqual(4.5);
    }
    // The large accent words (h1, CTA heading): 3:1 over the lit scrim.
    for (const t of ['--rl-hero-accent', '--rl-cta-accent']) {
      expect(contrastRatio(token(html, t), lit), t).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the CTA accent words readable over a photo on a near-gray dark palette', () => {
    const grayDark = { bg: '#0b0b0b', text: '#1c1c1c', accent: '#222222', secondary: '#101010', muted: '#161616' };
    const html = render({ ...RICH, customColors: grayDark }, { images: { cta: 'https://example.com/c.jpg' } });
    const lit = mix(token(html, '--rl-cta-bg'), mix('#ffffff', '#000000', 0.5), 0.25);
    expect(contrastRatio(token(html, '--rl-cta-accent'), lit)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(token(html, '--rl-cta-accent'), token(html, '--rl-cta-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('fades a light palette photo hero into the page under the price card on phones', () => {
    const light = { bg: '#ffffff', text: '#111111', secondary: '#f3f4f6', accent: '#d62828', muted: '#555555' };
    const html = render({ ...RICH, customColors: light }, { images: { hero: 'https://example.com/h.jpg' } });
    expect(token(html, '--rl-scrim-v-lite')).toMatch(/calc\(100% - 112px\), #ffffff\)$/);
    expect(html).toContain('.rl-lite .rl-scrim{background:var(--rl-scrim-v-lite)}');
    expect(token(render(RICH, { images: { hero: 'https://example.com/h.jpg' } }), '--rl-scrim-v-lite')).toBe('');
  });

  it('keeps the reference red for the desktop eyebrow on the default palette', () => {
    const html = render(RICH, { images: { hero: 'https://example.com/h.jpg' } });
    expect(token(html, '--rl-hero-eyebrow-lg')).toBe('#ee3533');
    expect(token(html, '--rl-ring')).toBe('0 0 0 0 transparent');
  });

  it('rings accent buttons that nearly match the page', () => {
    const html = render({ ...RICH, customColors: { bg: '#0b0b0b', accent: '#262626', text: '#f5f5f5', secondary: '#161616', muted: '#a3a3a3' } });
    expect(token(html, '--rl-ring')).toMatch(/^inset 0 0 0 1px #/);
  });
});

describe('vehicle make data', () => {
  it('stores coordinates at 0.1 (arc radii at 0.01) and stays compact', () => {
    const total = VEHICLE_MAKES.reduce((n, m) => n + m.d.length, 0);
    expect(total).toBeLessThan(75000);
    for (const m of VEHICLE_MAKES) {
      // Every number has at most two decimals (only arc radii use two).
      expect(m.d.match(/\d*\.\d{3,}/), m.id).toBeNull();
    }
  });
});

describe('hero card (copy.heroCard / copy.heroServices)', () => {
  const hero = (html) => decode(sectionHtml(html, 'hero'));
  const optNames = (html) => [...hero(html).matchAll(/<span class="rl-opt-name">([^<]*)<\/span>/g)].map((m) => m[1]);
  const radios = (html) => count(hero(html), 'class="rl-sr rl-radio"');
  const FIVE = [
    { name: 'One', price: '$10' }, { name: 'Two', price: '$20' }, { name: 'Three', price: '$30' },
    { name: 'Four', price: '$40' }, { name: 'Five', price: '$50' },
  ];

  it('renders the price card by default, exactly as heroCard "quote"', () => {
    for (const fx of [RICH, FIXTURES.full]) {
      const quote = render(fx, { copy: { heroCard: 'quote' } });
      expect(render(fx)).toBe(quote);
      expect(visibleText(render(fx))).toBe(visibleText(quote));
      // Unknown modes and an empty pick list are the default too.
      expect(render(fx, { copy: { heroCard: 'carousel', heroServices: [] } })).toBe(quote);
      expect(render(fx, { copy: { heroServices: null } })).toBe(quote);
      expect(sectionOpen(quote, 'hero')).toContain('rl-has-card');
    }
    // The first three priced packages, as before.
    expect(optNames(render(RICH))).toEqual(['Refresh Detail', 'Signature Detail', 'Premium Detail']);
    expect(optNames(render(FIXTURES.full))).toEqual(['Full Detail', 'Ceramic Coating', 'Paint Correction']);
  });

  it("offers the owner's picks in the owner's order, matched loosely by name", () => {
    expect(optNames(render(RICH, { copy: { heroServices: ['Premium Detail', 'Refresh Detail'] } }))).toEqual(['Premium Detail', 'Refresh Detail']);
    expect(optNames(render(RICH, { copy: { heroServices: ['premium-detail', 'REFRESH  DETAIL', 'Premium Detail'] } }))).toEqual(['Premium Detail', 'Refresh Detail']);
    // Names no package has any more are skipped; none left -> automatic.
    expect(optNames(render(RICH, { copy: { heroServices: ['Gone', 'Ceramic Coating'] } }))).toEqual(['Ceramic Coating']);
    expect(optNames(render(RICH, { copy: { heroServices: ['Gone', 'Also Gone', 7, null] } }))).toEqual(['Refresh Detail', 'Signature Detail', 'Premium Detail']);
    // At most four.
    const five = render(RICH, { biz: { services: FIVE }, copy: { heroServices: ['Five', 'Four', 'Three', 'Two', 'One'] } });
    expect(optNames(five)).toEqual(['Five', 'Four', 'Three', 'Two']);
    expect(optNames(render(RICH, { biz: { services: FIVE } }))).toEqual(['One', 'Two', 'Three']);
  });

  it('skips an unpriced pick in the price card and lists it without a price', () => {
    const services = [{ name: 'Wash' }, ...RICH.businessInfo.services];
    const quote = render(RICH, { biz: { services }, copy: { heroServices: ['Wash', 'Premium Detail'] } });
    expect(optNames(quote)).toEqual(['Premium Detail']);
    const listed = hero(render(RICH, { biz: { services }, copy: { heroCard: 'list', heroServices: ['Wash', 'Premium Detail'] } }));
    expect([...listed.matchAll(/<span class="rl-opt-name">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['Wash', 'Premium Detail']);
    expect(listed).toMatch(/<span class="rl-opt-name">Wash<\/span><\/span><\/li>/);
    expect(listed).toContain('<span class="rl-opt-price">$260</span>');
  });

  it('tells the editor when the picked services have no price, and shows no card', () => {
    const copy = { heroServices: ['Wash'] };
    const biz = { services: [{ name: 'Wash' }, { name: 'Detail', price: '$150' }] };
    const editor = hero(render(RICH, { biz, copy, editor: true }));
    expect(visibleText(editor)).toContain('Your price card needs services with a price (Edit > Services).');
    expect(editor).not.toContain('id="quote"');
    const published = render(RICH, { biz, copy });
    expect(hero(published)).not.toContain('id="quote"');
    expect(published).not.toContain('data-acg-editor-only');
    expect(sectionOpen(published, 'hero')).not.toContain('rl-has-card');
  });

  it('supports a fourth priced pick', () => {
    const html = render(RICH, { copy: { heroServices: ['Refresh Detail', 'Signature Detail', 'Premium Detail', 'Ceramic Coating'] } });
    const h = hero(html);
    expect(radios(html)).toBe(4);
    expect(h).toContain('id="rl-pkg-3"');
    expect(h).toContain('class="rl-res rl-pk-3"');
    expect(h).toContain('data-scheduler-service="Ceramic Coating"');
    expect(count(h, 'class="rl-q-book rl-pk-')).toBe(4);
    expect(h).toContain('d="M6 3h12l4 6-10 13L2 9Z"');
    const css = html.match(/<style>\s*(\.rl-root[\s\S]*?)<\/style>/)[1];
    expect(count(css, '#rl-pkg-3:checked')).toBe(3);
    expect(css).toContain('.rl-quote:has(#rl-pkg-3:checked) .rl-res-set>.rl-pk-3{visibility:inherit}');
  });

  it('lists packages without choices in "list" mode', () => {
    const html = render(RICH, { copy: { heroCard: 'list' } });
    const h = hero(html);
    expect(h).not.toMatch(/<input\b/);
    expect(h).not.toContain('Step 1 of 3');
    expect(count(h, 'id="quote"')).toBe(1);
    expect(h).toContain('class="rl-quote rl-hlist" id="quote"');
    expect(h).toContain('<h2 class="rl-q-h">Our Detail Packages</h2>');
    const text = visibleText(h);
    for (const s of ['Refresh Detail Inside-and-out refresh $120', 'Signature Detail $180', 'Premium Detail $260']) expect(text).toContain(s);
    expect(h).toContain('<a class="rl-hl-cta" href="#services">See All Packages');
    expect(h).not.toMatch(/<a class="rl-hl-cta"[^>]*data-scheduler-trigger/);
    expect(h).toContain('<a class="rl-q-call" href="tel:4075550199">');
    expect(sectionOpen(html, 'hero')).toContain('rl-has-card');
    expect(sectionOpen(html, 'hero')).not.toContain('rl-card-off');
    // The list offers no quote, so Button 2 calls by default; the owner's
    // "Get a Quote" wording still lands on the card.
    expect(h).toMatch(/<a class="rl-btn rl-btn-line" href="tel:4075550199">/);
    expect(hero(render(RICH, { copy: { heroCard: 'list', ctaSecondary: 'Get a Quote' } }))).toMatch(/<a class="rl-btn rl-btn-line" href="#quote"/);
    // Without the package cards the button books instead.
    const noCards = hero(render(RICH, { copy: { heroCard: 'list', hiddenSections: ['services'] } }));
    expect(noCards).toContain('<a class="rl-hl-cta" href="tel:4075550199" data-scheduler-trigger="">Book Now');
    expect(noCards).not.toContain('See All Packages');
    // Not a detailer: plain heading.
    expect(hero(render(RICH, { biz: { businessType: 'wheel_shop' }, copy: { heroCard: 'list' } }))).toContain('<h2 class="rl-q-h">Our Packages</h2>');
  });

  it('drops the card and widens the copy in "off" mode, keeping the hero buttons', () => {
    const html = render(RICH, { copy: { heroCard: 'off' } });
    const h = hero(html);
    expect(h).not.toContain('id="quote"');
    expect(h).not.toContain('rl-quote');
    expect(sectionOpen(html, 'hero')).toContain('rl-card-off');
    expect(sectionOpen(html, 'hero')).not.toContain('rl-has-card');
    expect(h).toContain('class="rl-hero-btns"');
    // No card: Button 2 calls instead of offering a quote.
    expect(h).toMatch(/<a class="rl-btn rl-btn-line" href="tel:4075550199">/);
    expect(visibleText(h)).toContain('Call 407-555-0199');
    expect(html).toContain('.rl-card-off .rl-hero-body{max-width:768px}');
  });

  it('publishes the list and off modes without editor markup or invented claims', () => {
    for (const fx of [RICH, FIXTURES.full, FIXTURES.sparse]) {
      for (const heroCard of ['list', 'off']) {
        const html = render(fx, { copy: { heroCard } });
        expect(html).not.toContain('data-acg-editor-only');
        expect(decode(html)).not.toMatch(BANNED_CLAIMS);
        expect(visibleText(html)).not.toMatch(BANNED_CLAIMS);
      }
    }
  });
});

describe('footer columns (copy.footer)', () => {
  const footerHtml = (html) => decode(html.slice(html.indexOf('<footer'), html.indexOf('</footer>') + 9));
  // Each cell is a bare <div> opening on its title or the brand block.
  const cells = (html) => [...footerHtml(html).matchAll(/<div><(?:h3 class="rl-foot-t">([^<]*)<\/h3>|div class="rl-foot-brand">)/g)].map((m) => m[1] ?? 'brand');
  const fn = (html) => Number(footerHtml(html).match(/--rl-fn:(\d+)/)?.[1] ?? 0);
  const cols = (...list) => ({ footer: { columns: list.map((c) => (typeof c === 'string' ? { type: c, show: true } : c)) } });

  it('reads the column list like the editor does', () => {
    const all = FOOTER_COLUMN_TYPES.map((type) => ({ type, title: '', show: true }));
    expect(FOOTER_COLUMN_TYPES).toEqual(['brand', 'links', 'areas', 'contact', 'hours']);
    for (const footer of [undefined, null, 'x', [], {}, { columns: 'brand' }, { ctaText: 'Hi' }]) expect(footerColumnsOf(footer)).toEqual(all);
    expect(footerColumnsOf({ columns: [
      { type: 'contact', title: ' Say Hi ' }, { type: 'nope' }, null, 'links', { type: 'contact', show: false },
      { type: 'brand', show: false }, { type: 'hours', show: 0 },
    ] })).toEqual([
      { type: 'contact', title: 'Say Hi', show: true },
      { type: 'brand', title: '', show: false },
      { type: 'hours', title: '', show: true },
      { type: 'links', title: '', show: false },
      { type: 'areas', title: '', show: false },
    ]);
    expect(footerColumnsOf({ columns: [] }).every((c) => !c.show)).toBe(true);
  });

  it("keeps the design's footer without copy.footer", () => {
    const html = render(RICH);
    expect(cells(html)).toEqual(['brand', 'Explore', 'Service Areas', 'Get In Touch']);
    expect(fn(html)).toBe(4);
    const foot = footerHtml(html);
    expect(count(foot, 'class="rl-foot-hours"')).toBe(1);
    expect(foot).toContain('<b>Hours</b>');
    expect(foot).toContain('<a class="rl-pillbtn" href="#contact" data-scheduler-trigger="">Request Appointment</a>');
    expect(foot).toContain('<div>Orlando, FL · Fully Mobile · Insured</div>');
    // The default column list (as the editor saves it) and empty values render the same.
    const defaults = cols('brand', 'links', 'areas', 'contact', 'hours');
    for (const fx of [RICH, FIXTURES.full, FIXTURES.sparse]) {
      const base = footerHtml(render(fx));
      expect(footerHtml(render(fx, { copy: defaults }))).toBe(base);
      expect(footerHtml(render(fx, { copy: { footer: { ...defaults.footer, showCta: true, ctaText: ' ', ctaUrl: '', bottomText: '' } } }))).toBe(base);
      expect(footerHtml(render(fx, { copy: { footer: null } }))).toBe(base);
    }
  });

  it("renders the owner's columns in the owner's order", () => {
    const html = render(RICH, { copy: cols('contact', 'brand', { type: 'links', show: false }, { type: 'areas', show: false }, { type: 'hours', show: false }) });
    expect(cells(html)).toEqual(['Get In Touch', 'brand']);
    expect(fn(html)).toBe(2);
    const foot = footerHtml(html);
    expect(foot).not.toContain('Service Areas');
    expect(foot).not.toContain('Explore');
    expect(foot).not.toContain('rl-foot-hours');
    expect(foot).not.toContain('Mon–Fri');
    // A missing type is hidden.
    expect(cells(render(RICH, { copy: cols('areas') }))).toEqual(['Service Areas']);
  });

  it('prints hours under the contact list only right after it, else as their own column', () => {
    const merged = render(RICH, { copy: cols('brand', 'contact', { type: 'links', show: false }, 'hours', 'areas') });
    expect(cells(merged)).toEqual(['brand', 'Get In Touch', 'Service Areas']);
    const contactCell = footerHtml(merged).split('<h3 class="rl-foot-t">Get In Touch</h3>')[1].split('<h3')[0];
    expect(count(contactCell, 'class="rl-foot-hours"')).toBe(1);
    const own = render(RICH, { copy: cols('hours', 'brand', 'links', 'areas', 'contact') });
    expect(cells(own)).toEqual(['Hours', 'brand', 'Explore', 'Service Areas', 'Get In Touch']);
    expect(fn(own)).toBe(5);
    expect(footerHtml(own)).not.toContain('rl-foot-hours');
    expect(visibleText(footerHtml(own))).toContain('Hours Mon–Fri: 8:00 AM – 6:00 PM');
    // No hours: no Hours column.
    expect(cells(render(RICH, { biz: { hours: null }, copy: cols('hours', 'brand') }))).toEqual(['brand']);
  });

  it('uses custom column titles', () => {
    const html = render(RICH, { copy: cols({ type: 'brand' }, { type: 'links', title: 'Menu' }, { type: 'areas', title: 'Where We Go' }, { type: 'contact', title: 'Call Us' }, { type: 'hours', title: 'Open' }) });
    expect(cells(html)).toEqual(['brand', 'Menu', 'Where We Go', 'Call Us']);
    expect(footerHtml(html)).toContain('<b>Open</b>');
    const own = render(RICH, { copy: cols('brand', { type: 'hours', title: 'When' }) });
    expect(cells(own)).toEqual(['brand', 'When']);
  });

  it("follows the owner's button and bottom line", () => {
    const off = footerHtml(render(RICH, { copy: { footer: { showCta: false } } }));
    // Only the Explore link (a section link) still says it.
    expect(count(off, 'Request Appointment')).toBe(1);
    expect(off).not.toContain('rl-pillbtn');
    const own = footerHtml(render(RICH, { copy: { footer: { ctaText: 'Text Us', ctaUrl: 'https://book.example.com/x' } } }));
    expect(own).toContain('<a class="rl-pillbtn" href="https://book.example.com/x" data-scheduler-bound="">Text Us</a>');
    expect(own).not.toMatch(/rl-pillbtn[^>]*data-scheduler-trigger/);
    // Its own link survives a hidden contact band; the default one doesn't.
    expect(footerHtml(render(RICH, { copy: { hiddenSections: ['cta'], footer: { ctaUrl: 'https://book.example.com/x' } } }))).toContain('href="https://book.example.com/x"');
    expect(footerHtml(render(RICH, { copy: { hiddenSections: ['cta'] } }))).not.toContain('rl-pillbtn');
    const label = footerHtml(render(RICH, { copy: { footer: { ctaText: 'Book A Detail' } } }));
    expect(label).toContain('<a class="rl-pillbtn" href="#contact" data-scheduler-trigger="">Book A Detail</a>');
    const bottom = footerHtml(render(RICH, { copy: { footer: { bottomText: 'Serving Central Florida' } } }));
    expect(bottom).toContain('<div>Serving Central Florida</div>');
    expect(bottom).not.toContain('Fully Mobile · Insured');
  });

  it('keeps the copyright the last <p>, no nav, and --rl-fn equal to the cells', () => {
    const variants = [
      {}, cols('contact', 'brand'), cols('hours', 'brand', 'links', 'areas', 'contact'),
      { footer: { bottomText: 'Hello', columns: [{ type: 'brand', title: 'x' }, { type: 'contact' }] } },
    ];
    for (const copy of variants) {
      const html = render(RICH, { copy: { ...copy, footerTagline: 'Detailing done right.' } });
      const foot = footerHtml(html);
      const ps = [...foot.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
      expect(ps.at(-1)[1]).toMatch(/^© <span data-acg-year="">\d{4}<\/span> Redline Test Detailing\. All rights reserved\.$/);
      expect(foot).not.toMatch(/<nav\b/);
      expect(fn(html)).toBe(cells(html).length);
      expect(sectionOpen(html, 'hero')).toBeTruthy();
      expect(html).toMatch(/<footer class="rl-foot" style="order:9999">/);
    }
  });

  it('leaves out a contact column with nothing in it', () => {
    const html = render(RICH, { biz: { phone: '', email: '', instagram: '', city: '', state: '', hours: null }, copy: { hiddenSections: ['cta'] } });
    expect(cells(html)).not.toContain('Get In Touch');
    expect(fn(html)).toBe(cells(html).length);
  });
});

describe('headings manifest', () => {
  it('names only this design\'s sections, the four heading fields and the owning copy keys', () => {
    const ids = mod.sections.map((s) => s.id);
    const OWNERS = ['headline', 'servicesSection.title', 'servicesSection.intro', 'ctaHeadline', 'ctaSubtext'];
    expect(mod.headingFields && typeof mod.headingFields).toBe('object');
    for (const [id, spec] of Object.entries(mod.headingFields)) {
      expect(ids).toContain(id);
      expect(spec.fields.length).toBeGreaterThan(0);
      for (const f of spec.fields) expect(['eyebrow', 'title', 'accent', 'intro']).toContain(f);
      if (spec.titleFrom) expect(OWNERS).toContain(spec.titleFrom);
      if (spec.introFrom) expect(OWNERS).toContain(spec.introFrom);
      for (const k of Object.keys(spec.placeholder || {})) expect(spec.fields).toContain(k);
      for (const v of Object.values(spec)) expect(typeof v).not.toBe('function');
    }
    expect(mod.headingFields.awards).toBeUndefined();
  });

  it('renders each listed field where the manifest says', () => {
    const sectionTitles = {};
    for (const [id, spec] of Object.entries(mod.headingFields)) {
      sectionTitles[id] = {};
      if (spec.fields.includes('eyebrow')) sectionTitles[id].eyebrow = `Eye ${id}`;
      if (spec.fields.includes('title') && !spec.titleFrom) sectionTitles[id].title = `Title ${id} Here`;
      if (spec.fields.includes('intro') && !spec.introFrom) sectionTitles[id].intro = `Intro ${id}.`;
    }
    const html = render(RICH, { images: { gallery0: 'https://example.com/g.jpg' }, copy: { sectionTitles, servicesSection: { title: 'Svc Owner Title', intro: 'Svc owner intro.' }, ctaHeadline: 'Cta Owner Title', ctaSubtext: 'Cta owner intro.' } });
    for (const [id, spec] of Object.entries(mod.headingFields)) {
      const text = visibleText(sectionHtml(html, id));
      if (sectionTitles[id].eyebrow) expect(text, id).toContain(`Eye ${id}`);
      if (sectionTitles[id].title) expect(text, id).toContain(`Title ${id} Here`);
      if (sectionTitles[id].intro) expect(text, id).toContain(`Intro ${id}.`);
    }
    const t = visibleText(html);
    for (const s of ['Svc Owner Title', 'Svc owner intro.', 'Cta Owner Title', 'Cta owner intro.']) expect(t).toContain(s);
  });
});

describe('editor photo placeholders', () => {
  const hint = (key) => PHOTO_HINTS[key];

  it('marks the featured photo, other package photos and the CTA background only in the editor', () => {
    const imaged = { services: RICH.businessInfo.services.map((s, i) => (i === 0 ? { ...s, image: 'https://example.com/p0.jpg' } : s)) };
    const editor = render(RICH, { biz: imaged, editor: true });
    const published = render(RICH, { biz: imaged });
    expect(visibleText(sectionHtml(editor, 'featured'))).toContain(hint('featured'));
    // The editor shows the site's one-column band, with the hint as a line.
    expect(sectionHtml(editor, 'featured')).toContain('rl-feat-grid rl-feat-solo');
    expect(sectionHtml(editor, 'featured')).not.toContain('rl-feat-photo');
    expect(count(visibleText(sectionHtml(editor, 'services')), hint('service'))).toBe(3);
    expect(visibleText(sectionHtml(editor, 'cta'))).toContain(hint('cta'));
    for (const key of ['featured', 'service', 'cta']) expect(visibleText(published)).not.toContain(hint(key));
    expect(published).not.toContain('data-acg-editor-only');
    expect(sectionHtml(published, 'featured')).toContain('rl-feat-grid rl-feat-solo');
    expect(count(sectionHtml(published, 'services'), 'class="rl-card-photo"')).toBe(1);
    // The other cards keep the photo's space on the site (rows stay level).
    expect(count(sectionHtml(published, 'services'), 'class="rl-card-photo rl-card-well" aria-hidden="true"')).toBe(3);
    expect(published).toContain('.rl-cards:not(.rl-cards-1) .rl-card-well{display:flex}');
    expect(count(sectionHtml(render(RICH), 'services'), 'rl-card-well')).toBe(0);
    // No package photo at all: no package placeholders.
    expect(visibleText(render(RICH, { editor: true }))).not.toContain(hint('service'));
    // With the photos in place, no hints.
    const full = render(RICH, { biz: imaged, editor: true, images: { featured: 'https://example.com/f.jpg', cta: 'https://example.com/c.jpg' } });
    expect(visibleText(full)).not.toContain(hint('featured'));
    expect(visibleText(full)).not.toContain(hint('cta'));
  });

  it('points the featured band hints at Edit > Featured Service', () => {
    const none = visibleText(sectionHtml(render(FIXTURES.sparse, { editor: true }), 'featured'));
    expect(none).toContain('Pick a service to feature in Edit > Featured Service.');
    const bare = render(FIXTURES.sparse, { editor: true, copy: { servicesSection: { items: [{ name: 'Ceramic Coating' }] } } });
    expect(visibleText(sectionHtml(bare, 'featured'))).toContain('This band shows on your site once it has a photo, a price or a list of benefits (Edit > Featured Service).');
  });
});

describe('by appointment', () => {
  it('prints a per-day "By appointment" in the design\'s title case, in rows and summary, never as closed', () => {
    for (const value of ['By appointment', 'by appointment only', 'BY APPOINTMENT.']) {
      const html = render(RICH, { biz: { hours: { ...PER_DAY, Sun: value } } });
      const text = visibleText(html);
      expect(decode(sectionHtml(html, 'locations'))).toContain('<dt>Sunday</dt><dd>By Appointment</dd>');
      expect(visibleText(footerOf(html))).toContain('Sun: By Appointment');
      expect(text).not.toMatch(/\bclosed\b/i);
    }
    // Other text still prints as written.
    expect(decode(sectionHtml(render(RICH, { biz: { hours: { ...PER_DAY, Sun: 'Appointments only, call ahead' } } }), 'locations'))).toContain('<dd>Appointments only, call ahead</dd>');
  });
});

function footerOf(html) {
  return html.slice(html.indexOf('<footer'), html.indexOf('</footer>') + 9);
}

describe('round r1 fixes', () => {
  const hero = (html) => decode(sectionHtml(html, 'hero'));
  const heroLinks2 = (html) => [...hero(html).matchAll(/<a class="rl-btn[^"]*" href="([^"]*)"/g)].map((m) => m[1]);

  it('shows a connected review widget only when the owner picks Google Reviews (copy.reviewMode)', () => {
    const quotesHtml = render(RICH, { copy: { googleWidgetKey: 'k-1' } });
    expect(markup(quotesHtml)).not.toContain('rl-rev-widget');
    expect(count(sectionHtml(quotesHtml, 'testimonials'), 'class="rl-rev"')).toBe(3);
    const widget = render(RICH, { copy: { googleWidgetKey: 'k-1', reviewMode: 'google' } });
    expect(markup(widget)).toContain('class="rl-rev-widget"');
    // The Headings tab's intro line shows over the widget too.
    expect(visibleText(sectionHtml(widget, 'testimonials'))).toContain('Straight from our customers.');
    // Picked but no key: the quotes stay.
    expect(markup(render(RICH, { copy: { reviewMode: 'google' } }))).not.toContain('rl-rev-widget');
  });

  it('renders every heading from headingDefaults (the Headings tab reads the same values)', () => {
    for (const fx of [RICH, FIXTURES.full, FIXTURES.sparse, FIXTURES.custom]) {
      const html = render(fx, { copy: { sectionTitles: null, servicesSection: { ...(fx.generatedCopy.servicesSection || {}), title: '' }, ctaHeadline: '' } });
      const d = mod.headingDefaults(normalizeBusinessInfo(fx.businessInfo), { ...fx.generatedCopy, sectionTitles: null, servicesSection: { ...(fx.generatedCopy.servicesSection || {}), title: '' }, ctaHeadline: '' });
      for (const id of ['about', 'gallery', 'services', 'testimonials', 'locations', 'cta']) {
        const sec = sectionHtml(html, id);
        if (!sec || !d[id].title) continue;
        expect(visibleText(sec), id).toContain(d[id].title);
        if (d[id].accent) expect(decode(sec), id).toContain(`<span class="rl-em">${d[id].accent}</span>`);
      }
      if (d.featured.title && sectionHtml(html, 'featured')) expect(visibleText(sectionHtml(html, 'featured'))).toContain(d.featured.title);
      if (sectionHtml(html, 'hero')) expect(visibleText(sectionHtml(html, 'hero'))).toContain(d.hero.eyebrow.trim());
    }
    // An owner title: the default accent goes, except the packages heading's
    // last two words.
    const d = mod.headingDefaults(normalizeBusinessInfo(RICH.businessInfo), { sectionTitles: { about: { title: 'Our Story' } }, servicesSection: { title: 'Pick Your Detail Today' } });
    expect(d.about).toEqual({ title: 'Why Redline Test Detailing Is The Right Choice For Your Car', accent: '' });
    expect(d.services.accent).toBe('Detail Today');
    expect(d.featured.title).toBe('Protect Your Vehicle With Ceramic Coating');
  });

  it('drops an owner in-page link whose block does not render, keeping the wording default', () => {
    // "#quote" from an old site, with no card on the page.
    const off = render(RICH, { copy: { heroCard: 'off', ctaSecondary: 'Get a Quote', ctaSecondaryUrl: '#quote' } });
    expect(heroLinks2(off)).not.toContain('#quote');
    expect(markup(off)).not.toContain('href="#quote"');
    // With the card it stays; other pages and present blocks stay too.
    expect(heroLinks2(render(RICH, { copy: { ctaSecondary: 'Get a Quote', ctaSecondaryUrl: '#quote' } }))[1]).toBe('#quote');
    expect(heroLinks2(render(RICH, { copy: { heroCard: 'off', ctaSecondaryUrl: '#reviews' } }))[1]).toBe('#reviews');
    expect(heroLinks2(render(RICH, { copy: { heroCard: 'off', ctaSecondaryUrl: 'https://book.example.com' } }))[1]).toBe('https://book.example.com');
  });

  it('lists the first three named packages in list mode when none has a price', () => {
    const biz = { services: [{ name: 'Wash' }, { name: 'Wax', price: 'Call' }, { name: 'Interior' }, { name: 'Engine' }] };
    const list = hero(render(RICH, { biz, copy: { heroCard: 'list' } }));
    expect([...list.matchAll(/<span class="rl-opt-name">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['Wash', 'Wax', 'Interior']);
    // The price card still needs a price: no card, and an editor hint.
    const quote = render(RICH, { biz, editor: true });
    expect(hero(quote)).not.toContain('id="quote"');
    expect(visibleText(hero(quote))).toContain('Your price card needs services with a price (Edit > Services).');
  });

  it('moves the footer rating to the bottom line when the logo column is hidden', () => {
    const cols = ['links', 'areas', 'contact', 'hours'].map((type) => ({ type, show: true }));
    const html = render(RICH, { biz: { googlePlace: PLACE }, copy: { footer: { columns: [{ type: 'brand', show: false }, ...cols] } } });
    const foot = footerOf(html);
    expect(foot).not.toContain('rl-foot-brand');
    expect(foot).toContain('<div class="rl-foot-bar-g">');
    expect(count(foot, 'acg-gbadge-inline')).toBe(1);
    // In its column otherwise; off with the footer placement off.
    expect(footerOf(render(RICH, { biz: { googlePlace: PLACE } }))).not.toContain('rl-foot-bar-g');
    expect(footerOf(render(RICH, { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: ['hero'] }, footer: { columns: [{ type: 'brand', show: false }, ...cols] } } }))).not.toContain('acg-gbadge');
  });

  it('gives a five-column footer three columns until 1280px, and breaks a long email after the @', () => {
    const five = render(RICH, { copy: { footer: { columns: ['brand', 'links', 'hours', 'areas', 'contact'].map((type) => ({ type, show: true })) } } });
    expect(footerOf(five)).toContain('class="rl-wrap rl-foot-grid rl-foot-5"');
    expect(five).toContain('.rl-foot-grid.rl-foot-5{grid-template-columns:repeat(3,minmax(0,1fr))}');
    expect(five).toMatch(/@container \(min-width:1280px\)\{\s*\.rl-foot-grid\.rl-foot-5\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}\s*\}/);
    expect(footerOf(render(RICH))).not.toContain('rl-foot-5');
    expect(footerOf(render(RICH))).toContain('hello@<wbr/>example.com');
    expect(footerOf(render(RICH))).toContain('href="mailto:hello@example.com"');
    expect(render(RICH)).not.toContain('word-break:break-all');
  });
});
