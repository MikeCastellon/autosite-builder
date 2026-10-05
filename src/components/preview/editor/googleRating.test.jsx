// Google Rating panel + per-review "From Google" fields: the pure helpers,
// the server-rendered panels (node, no DOM), and a guard that the wizard
// uses the shared place search.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGE_SPOTS, effectivePlacements, togglePlacement, placeStatus, refreshMessage, resultRatingText, sourcePatch, ratingPatch, typedGoogleFacts } from './googleRating.js';
import GoogleRatingPanel, { TypedRatingNote } from './GoogleRatingPanel.jsx';
import TestimonialSourceFields, { ReviewSourcesIntro } from './TestimonialSourceFields.jsx';

const here = dirname(fileURLToPath(import.meta.url));
const html = (type, props) => renderToStaticMarkup(createElement(type, props));
const noop = () => {};

// Like the replica site's snapshot, with the id the wizard stores.
const PLACE = {
  placeId: 'p-top',
  placeName: 'Top Choice Mobile Detailing',
  rating: 5,
  reviewCount: 137,
  url: 'https://maps.app.goo.gl/abc',
  address: 'Orlando, FL, USA',
  fetchedAt: '2026-09-01T12:00:00.000Z',
};

// [label, checked] for every switch in the markup, in order.
const switches = (markup) => [...markup.matchAll(/role="switch" aria-checked="(true|false)" aria-label="([^"]+)"/g)].map((m) => [m[2], m[1] === 'true']);

describe('badge placements', () => {
  it('uses the defaults until the owner saves a list', () => {
    expect(effectivePlacements({}, ['hero', 'footer'])).toEqual(['hero', 'footer']);
    expect(effectivePlacements(null)).toEqual(['hero', 'footer']);
    expect(effectivePlacements({ googleBadge: null }, ['nav'])).toEqual(['nav']);
    expect(effectivePlacements({ googleBadge: { placements: ['about'] } }, ['hero'])).toEqual(['about']);
    expect(effectivePlacements({ googleBadge: { placements: [] } }, ['hero'])).toEqual([]);
  });

  it('drops unknown spots', () => {
    expect(effectivePlacements({ googleBadge: { placements: ['hero', 'sidebar', 7, 'footer'] } })).toEqual(['hero', 'footer']);
  });

  it('toggles in the canonical order', () => {
    expect(togglePlacement({}, ['hero', 'footer'], 'nav', true)).toEqual({ placements: ['hero', 'nav', 'footer'] });
    expect(togglePlacement({}, ['hero', 'footer'], 'hero', false)).toEqual({ placements: ['footer'] });
    expect(togglePlacement({ googleBadge: { placements: ['footer', 'about'] } }, ['hero'], 'hero', true)).toEqual({ placements: ['hero', 'about', 'footer'] });
    expect(togglePlacement({ googleBadge: { placements: ['footer'] } }, ['hero'], 'footer', false)).toEqual({ placements: [] });
    expect(togglePlacement({ googleBadge: { placements: [] } }, ['hero'], 'reviews', true)).toEqual({ placements: ['reviews'] });
    expect(BADGE_SPOTS.map((s) => s.id)).toEqual(['hero', 'nav', 'about', 'reviews', 'footer']);
  });
});

describe('placeStatus', () => {
  it('reads the snapshot the way the badge does', () => {
    expect(placeStatus(PLACE)).toEqual({
      connected: true, hasRating: true, ratingText: '5.0', countText: '137', name: 'Top Choice Mobile Detailing', address: 'Orlando, FL, USA', asOf: 'Sep 1, 2026', legacy: false,
    });
  });

  it('marks wizard snapshots without a date as legacy', () => {
    const { fetchedAt, ...old } = PLACE;
    expect(placeStatus(old)).toMatchObject({ connected: true, asOf: '', legacy: true });
  });

  it('has no rating without a review count, and nothing without a place', () => {
    expect(placeStatus({ ...PLACE, reviewCount: undefined })).toMatchObject({ connected: true, hasRating: false, ratingText: '', countText: '' });
    expect(placeStatus(null)).toMatchObject({ connected: false, hasRating: false });
    expect(placeStatus({ placeName: 'Shop' }).connected).toBe(true);
  });

  it('prints a search result rating only with both numbers', () => {
    expect(resultRatingText({ rating: 4.9, reviewCount: 141 })).toBe('4.9 · 141 reviews');
    expect(resultRatingText({ rating: 4.9, reviewCount: null })).toBe('No rating yet');
    expect(resultRatingText({})).toBe('No rating yet');
  });
});

describe('refreshMessage', () => {
  it('says what changed', () => {
    expect(refreshMessage({ status: 'updated', changed: true, place: { ...PLACE, rating: 4.9, reviewCount: 141 } }, PLACE))
      .toEqual({ tone: 'ok', text: 'Updated: 4.9 · 141 Google reviews (was 5.0 · 137).' });
    expect(refreshMessage({ status: 'updated', changed: true, place: PLACE }, { placeId: 'p-top' }))
      .toEqual({ tone: 'ok', text: 'Updated: 5.0 · 137 Google reviews.' });
  });

  it('says up to date', () => {
    expect(refreshMessage({ status: 'updated', changed: false, place: PLACE }, PLACE)).toEqual({ tone: 'ok', text: 'Up to date: 5.0 · 137 Google reviews.' });
  });

  it('warns when Google has no rating any more', () => {
    expect(refreshMessage({ status: 'updated', changed: true, place: { placeId: 'p-top', placeName: 'x' } }, PLACE))
      .toEqual({ tone: 'warn', text: 'Google has no rating for this listing right now, so the badge is hidden.' });
  });

  it('covers not found, no id and errors', () => {
    expect(refreshMessage({ status: 'not_found' }, PLACE)).toEqual({ tone: 'warn', text: "We couldn't find this listing in Google's results just now. Your saved rating is unchanged." });
    expect(refreshMessage({ status: 'error' }, PLACE)).toEqual({ tone: 'error', text: "Couldn't reach Google search. Try again in a minute." });
    expect(refreshMessage({ status: 'no_place' }, PLACE).tone).toBe('warn');
    expect(refreshMessage(undefined, PLACE).tone).toBe('error');
  });
});

describe('review patches', () => {
  it('source on / off (off clears the stars too)', () => {
    expect(sourcePatch(true)).toEqual({ source: 'google' });
    expect(sourcePatch(false)).toEqual({ source: null, rating: null });
  });

  it('stars are whole numbers 1-5', () => {
    expect(ratingPatch(4)).toEqual({ rating: 4 });
    expect(ratingPatch('3')).toEqual({ rating: 3 });
    expect(ratingPatch(4.6)).toEqual({ rating: 5 });
    expect(ratingPatch(9)).toEqual({ rating: 5 });
    expect(ratingPatch(0)).toEqual({ rating: null });
    expect(ratingPatch(-2)).toEqual({ rating: null });
    expect(ratingPatch('x')).toEqual({ rating: null });
    expect(ratingPatch(null)).toEqual({ rating: null });
    expect(ratingPatch(undefined)).toEqual({ rating: null });
  });
});

describe('GoogleRatingPanel', () => {
  const panel = (props) => html(GoogleRatingPanel, { businessInfo: { city: 'Orlando', googlePlace: PLACE }, setBiz: noop, copy: {}, setCopy: noop, defaultPlacements: ['hero', 'footer'], ...props });
  const outputs = [];
  const render = (props) => { const out = panel(props); outputs.push(out); return out; };

  it('shows the connected listing, its rating and the default spots', () => {
    const out = render();
    expect(out).toContain('Top Choice Mobile Detailing');
    expect(out).toContain('Orlando, FL, USA');
    expect(out).toContain('5.0 · 137 Google reviews');
    expect(out).toContain('Rating as of Sep 1, 2026');
    expect(out).toContain('Refresh rating');
    expect(out).toContain('Change listing');
    expect(out).toContain('Disconnect');
    expect(switches(out)).toEqual([
      ['Top of the page (hero)', true],
      ['Menu bar', false],
      ['About section', false],
      ['Reviews heading', false],
      ['Footer', true],
    ]);
    expect(out).not.toContain('Use the design&#x27;s default spots');
    expect(out).not.toContain('Search Google for your business');
    expect(out).toContain('Edit &gt; Reviews');
  });

  it('follows the saved spots and offers the defaults back', () => {
    const out = render({ copy: { googleBadge: { placements: ['nav'] } } });
    expect(switches(out).filter(([, on]) => on).map(([label]) => label)).toEqual(['Menu bar']);
    expect(out).toContain('Use the design&#x27;s default spots');
  });

  it('only offers the spots a template supports', () => {
    const out = render({ supportedPlacements: ['hero', 'footer'] });
    expect(switches(out).map(([label]) => label)).toEqual(['Top of the page (hero)', 'Footer']);
  });

  it('says when a wizard snapshot has no date', () => {
    const { fetchedAt, ...old } = PLACE;
    expect(render({ businessInfo: { googlePlace: old } })).toContain('Saved when you set up your site');
  });

  it('shows the search and no switches without a place', () => {
    const out = render({ businessInfo: { city: 'Orlando' } });
    expect(out).toContain('aria-label="Search Google for your business"');
    expect(out).toContain('placeholder="Business name and city"');
    expect(out).toContain('Find your business on Google');
    expect(switches(out)).toEqual([]);
    expect(out).not.toContain('Refresh rating');
  });

  it('warns instead of offering spots when the listing has no rating', () => {
    const out = render({ businessInfo: { googlePlace: { placeId: 'p-x', placeName: 'New Shop', fetchedAt: PLACE.fetchedAt } } });
    expect(out).toContain('No Google rating yet');
    expect(out).toContain('Checked on Google Sep 1, 2026');
    expect(out).toContain('This listing has no Google rating yet, so no badge shows on your site.');
    expect(switches(out)).toEqual([]);
  });

  it('is read-only without business edit rights', () => {
    const out = render({ canEditBusiness: false });
    expect(out).not.toContain('Search Google for your business');
    expect(out).not.toContain('Refresh rating');
    expect(out).not.toContain('Disconnect');
    expect(switches(out).length).toBe(5);
    expect(out).toContain('Open this site from your dashboard to connect or refresh a listing.');
    const none = render({ canEditBusiness: false, businessInfo: {} });
    expect(none).toContain('No Google listing connected');
    expect(none).not.toContain('Search Google for your business');
  });

  it('never types a rating: no number inputs, no star glyphs, no claims', () => {
    render({ copy: { googleBadge: { placements: [] } } });
    for (const out of outputs) {
      expect(out).not.toMatch(/[★☆⭐]/);
      expect(out).not.toMatch(/Verified|Top Rated/i);
      expect(out).not.toMatch(/type="number"/);
      expect(out).not.toMatch(/aria-label="[^"]*(rating|review count)[^"]*"[^>]*type="text"|type="text"[^>]*aria-label="[^"]*(rating|review count)/i);
    }
  });
});

describe('TestimonialSourceFields', () => {
  const fields = (props) => html(TestimonialSourceFields, { testimonial: { text: 'Great job', name: 'Ana' }, onPatch: noop, googlePlace: PLACE, ...props });

  it('renders nothing without a listing on an unmarked review', () => {
    expect(fields({ googlePlace: null })).toBe('');
    expect(fields({ googlePlace: { placeName: 'Shop' } })).toBe('');
  });

  it('offers the switch with its warning when a listing is connected', () => {
    const out = fields();
    expect(switches(out)).toEqual([['From Google', false]]);
    expect(out).toContain('Never for the sample reviews written for you.');
    expect(out).not.toContain('role="radio"');
  });

  it('shows 5 star choices once marked', () => {
    const out = fields({ testimonial: { text: 'x', source: 'google', rating: 4 } });
    expect(switches(out)).toEqual([['From Google', true]]);
    const radios = [...out.matchAll(/role="radio" aria-checked="(true|false)" aria-label="([^"]+)"/g)].map((m) => [m[2], m[1] === 'true']);
    expect(radios).toEqual([['1 star', false], ['2 stars', false], ['3 stars', false], ['4 stars', true], ['5 stars', false]]);
    expect(out).not.toMatch(/[★☆⭐]/);
    expect(out).not.toContain('No stars show until you do');
  });

  it('asks for the stars when none are picked', () => {
    expect(fields({ testimonial: { source: 'google' } })).toContain('Pick the stars the customer gave. No stars show until you do.');
  });

  it('warns on a marked review without a listing (so it can be un-marked)', () => {
    const out = fields({ googlePlace: null, testimonial: { source: 'google', rating: 5 } });
    expect(switches(out)).toEqual([['From Google', true]]);
    expect(out).toContain('No Google listing connected (Edit &gt; Google Rating), so this review won&#x27;t link to Google.');
  });
});

describe('round r1: review intro, short query, listing link', () => {
  it('states the From Google rule once, and short on each review', () => {
    expect(html(ReviewSourcesIntro, { googlePlace: PLACE })).toContain('From Google (on each review): Only for a review a customer posted on your Google listing');
    expect(html(ReviewSourcesIntro, { googlePlace: null })).toContain('connect your Google listing in Edit &gt; Google Rating.');
    const out = html(TestimonialSourceFields, { testimonial: { text: 'x' }, onPatch: noop, googlePlace: PLACE, compact: true });
    expect(out).toContain('Only reviews copied from your Google listing.');
    expect(out).not.toContain('Never for the sample reviews');
  });

  it('says where the footer rating goes with the logo column off', () => {
    const copy = { footer: { columns: [{ type: 'brand', show: false }, { type: 'links', show: true }] } };
    const out = html(GoogleRatingPanel, { businessInfo: { googlePlace: PLACE }, setBiz: noop, copy, setCopy: noop, defaultPlacements: ['hero', 'footer'] });
    expect(out).toContain('so the rating shows in the footer&#x27;s bottom line.');
    expect(html(GoogleRatingPanel, { businessInfo: { googlePlace: PLACE }, setBiz: noop, copy: {}, setCopy: noop, defaultPlacements: ['hero', 'footer'] })).not.toContain('bottom line');
  });

  it('links the connected listing on Google', () => {
    const out = html(GoogleRatingPanel, { businessInfo: { googlePlace: PLACE }, setBiz: noop, copy: {}, setCopy: noop });
    expect(out).toContain('href="https://maps.app.goo.gl/abc"');
    expect(out).toContain('View on Google');
  });
});

describe('typed Google facts', () => {
  it('finds Google numbers typed into About stats and the Reviews heading', () => {
    const copy = {
      aboutStats: [{ value: '10+', label: 'Years' }, { value: '137+', label: '5-Star Reviews' }, { value: '5.0', label: 'Google Rating' }],
      sectionTitles: { testimonials: { title: '137+ Five-Star Google Reviews' } },
    };
    expect(typedGoogleFacts(copy)).toEqual([
      { where: 'About stats', text: '137+ 5-Star Reviews' },
      { where: 'About stats', text: '5.0 Google Rating' },
      { where: 'Reviews heading', text: '137+ Five-Star Google Reviews' },
    ]);
    // A heading without a number makes no claim to go stale.
    expect(typedGoogleFacts({ sectionTitles: { testimonials: { title: 'Google Reviews' } } })).toEqual([]);
    expect(typedGoogleFacts({})).toEqual([]);
  });

  it('warns under the stats, naming them, else points at the Google Rating tab', () => {
    const warn = html(TypedRatingNote, { copy: { aboutStats: [{ value: '5.0', label: 'Google Rating' }] } });
    expect(warn).toContain('Typed Google numbers go out of date (About stats: &quot;5.0 Google Rating&quot;)');
    expect(warn).toContain('text-amber-700');
    expect(html(TypedRatingNote, { copy: {} })).toContain('For your Google rating use Edit &gt; Google Rating');
  });
});

describe('wizard', () => {
  it('uses the shared place search', () => {
    const src = readFileSync(resolve(here, '../../wizard/StepBusinessInfo.jsx'), 'utf8');
    expect(src).toMatch(/import \{ searchPlaces, placeFromResult \} from '\.\.\/\.\.\/lib\/googlePlaces\.js';/);
    expect(src).not.toContain('places-search');
    expect(src).toContain('placeFromResult(place)');
  });
});

// Themes whose badge is opt-in (GOOGLE_BADGE_DEFAULTS []): every switch
// starts off, and the reset turns the badge off rather than "back on".
describe('GoogleRatingPanel on a design without default spots', () => {
  const panel = (props) => html(GoogleRatingPanel, { businessInfo: { googlePlace: PLACE }, setBiz: noop, copy: {}, setCopy: noop, defaultPlacements: [], ...props });

  it('starts with every switch off and says how to turn one on', () => {
    const out = panel();
    expect(out).not.toMatch(/role="switch"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="switch"/);
    expect(out).toContain('Switch on where your badge shows: your design shows it nowhere until you do.');
    expect(out).not.toContain('default spots');
    expect(out).not.toContain('switched off everywhere');
  });

  it('offers to turn it off everywhere once a spot is on', () => {
    const out = panel({ copy: { googleBadge: { placements: ['nav'] } } });
    expect(out).toContain('Turn the badge off everywhere');
    expect(out).not.toContain('Use the design');
    const off = panel({ copy: { googleBadge: { placements: [] } } });
    expect(off).not.toContain('Turn the badge off everywhere');
    expect(off).toContain('The badge is switched off everywhere.');
  });

  it("reads the footer's columns with the design's footerSpec", () => {
    const spec = { columns: [{ type: 'brand', show: true }, { type: 'services', show: true }], titles: { services: 'Services' }, mergeHours: false, cta: false, ctaLabel: 'Book' };
    const copy = { googleBadge: { placements: ['footer'] }, footer: { columns: [{ type: 'services' }, { type: 'brand', show: false }] } };
    expect(panel({ copy, footerSpec: spec })).toContain('so the rating shows in the footer&#x27;s bottom line.');
    const shown = { googleBadge: { placements: ['footer'] }, footer: { columns: [{ type: 'services' }, { type: 'brand' }] } };
    expect(panel({ copy: shown, footerSpec: spec })).not.toContain('bottom line');
  });
});

describe('GoogleRatingPanel: the Menu bar spot', () => {
  it('says the menu bar badge shows on wide screens only', () => {
    const panel = (copy) => html(GoogleRatingPanel, { businessInfo: { googlePlace: PLACE }, setBiz: noop, copy, setCopy: noop, defaultPlacements: [] });
    expect(panel({ googleBadge: { placements: ['nav'] } })).toContain('Shows on wide screens only');
    expect(panel({ googleBadge: { placements: ['hero'] } })).not.toContain('Shows on wide screens only');
  });
});
