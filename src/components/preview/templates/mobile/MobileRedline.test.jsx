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
import { splitAccent, trailingWords, serviceAreasOf, formatTimeRange, phoneDisplay, serviceIncludes, bulletItems, trustItems, intentHref, bookingWorded } from '../kit/content.js';
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
    for (const fx of Object.values(FIXTURES)) expect(markup(render(fx))).not.toContain('acg-gbadge');
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
    expect(sparse).not.toContain('rl-has-quote');
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
    expect(css).toContain('.rl-res-set>.rl-pk-2{visibility:inherit}');
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
    expect(decode(sectionHtml(own, 'featured'))).toContain('href="https://example.com/pc"');
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
