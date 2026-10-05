// The Design Studio's Google profile picker: query building, reading pasted
// Google links, result marking, the levers.googlePlace shape, and a static
// render of the field (no network: nothing here calls the search).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  suggestedQuery, parseGoogleLink, isLinkLike, searchPlan, linkMatch, rankResults, toLeverPlace, placeFromSearch, placeSummary, answerMatch,
} from './googlePlaceField.js';
import GooglePlaceField from './GooglePlaceField.jsx';
import { mapPlaceResult } from '../../../lib/googlePlaces.js';
import { sanitizeLevers } from '../../../lib/designLevers.js';
import { googleRatingOf } from '../../preview/templates/kit/GoogleRatingBadge.jsx';

const PID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const BUSINESS = { businessName: 'Top Choice Mobile Detailing', city: 'Orlando', state: 'FL' };
// Mapped search results (searchPlaces output).
const TOP = mapPlaceResult({ place_id: PID, name: 'Top Choice Mobile Detailing', address: 'Orlando, FL, USA', rating: 4.9, review_count: 141 });
const OTHER = mapPlaceResult({ place_id: 'ChIJother_place_id_000', name: 'Top Choice Auto Spa', address: 'Tampa, FL, USA', rating: 4.6, review_count: 58 });
const BRANCH = mapPlaceResult({ place_id: 'ChIJbranch_place_id_00', name: 'Top Choice Mobile Detailing', address: 'Kissimmee, FL, USA' });

describe('suggestedQuery', () => {
  it('is the business name and city', () => {
    expect(suggestedQuery(BUSINESS)).toBe('Top Choice Mobile Detailing Orlando');
    expect(suggestedQuery({ businessName: '  Gloss   Co ', city: ' Tampa ' })).toBe('Gloss Co Tampa');
  });

  it('uses the state without a city, and never repeats a place already in the name', () => {
    expect(suggestedQuery({ businessName: 'Gloss Co', state: 'FL' })).toBe('Gloss Co FL');
    expect(suggestedQuery({ businessName: 'Orlando Gloss', city: 'orlando' })).toBe('Orlando Gloss');
    expect(suggestedQuery({ businessName: 'Gloss Co' })).toBe('Gloss Co');
  });

  it('is empty without a name', () => {
    expect(suggestedQuery({ city: 'Orlando' })).toBe('');
    expect(suggestedQuery()).toBe('');
    expect(suggestedQuery({ businessName: 42 })).toBe('');
  });
});

describe('parseGoogleLink', () => {
  it('reads the name and the place id from a full Maps link', () => {
    const url = `https://www.google.com/maps/place/Top+Choice+Mobile+Detailing/@28.53,-81.37,17z/data=!3m1!4b1!4m6!3m5!1s0x88e77b:0x1234!8m2!3d28.5!4d-81.3!16s%2Fg%2F11abc!19s${PID}?entry=ttu`;
    expect(parseGoogleLink(url)).toEqual({ href: url, google: true, short: false, placeId: PID, name: 'Top Choice Mobile Detailing', cid: '' });
    expect(parseGoogleLink('https://www.google.com/maps/place/Caf%C3%A9+%26+Shine/@1,2,3z').name).toBe('Café & Shine');
  });

  it('reads place ids from every link kind that carries one', () => {
    const id = (url) => parseGoogleLink(url).placeId;
    expect(id(`https://www.google.com/maps/place/?q=place_id:${PID}`)).toBe(PID);
    expect(id(`https://www.google.com/maps/search/?api=1&query=Top+Choice&query_place_id=${PID}`)).toBe(PID);
    expect(id(`https://search.google.com/local/writereview?placeid=${PID}`)).toBe(PID);
    expect(id(`https://search.google.com/local/reviews?placeid=${PID}`)).toBe(PID);
    // A hex feature id is no place id.
    expect(id('https://www.google.com/maps/place/X/data=!1s0x88e77b:0x1234')).toBe('');
  });

  it('reads search words, but not a place id or a dropped pin, as the name', () => {
    expect(parseGoogleLink('https://www.google.com/search?q=top+choice+detailing+orlando&oq=top').name).toBe('top choice detailing orlando');
    expect(parseGoogleLink('https://maps.google.com/maps?q=Top+Choice').name).toBe('Top Choice');
    expect(parseGoogleLink(`https://www.google.com/maps/search/?api=1&query=Top+Choice&query_place_id=${PID}`).name).toBe('Top Choice');
    expect(parseGoogleLink('https://www.google.com/maps/search/top+choice+detailing/@28.5,-81.3,12z').name).toBe('top choice detailing');
    expect(parseGoogleLink(`https://www.google.com/maps/place/?q=place_id:${PID}`).name).toBe('');
    expect(parseGoogleLink('https://www.google.com/maps/place/28.5383,-81.3792/@28.5,-81.3,17z').name).toBe('');
  });

  it('keeps a numeric cid, which the search cannot use', () => {
    expect(parseGoogleLink('https://maps.google.com/?cid=1234567890123456789')).toMatchObject({ google: true, cid: '1234567890123456789', name: '', placeId: '' });
    expect(parseGoogleLink('https://www.google.com/search?q=Top+Choice&ludocid=987654321').cid).toBe('987654321');
  });

  it('flags share links that only redirect', () => {
    for (const url of ['https://maps.app.goo.gl/AbCdEf123', 'https://goo.gl/maps/xyz', 'https://g.page/topchoice?share', 'https://g.co/kgs/abc', 'maps.app.goo.gl/AbCd']) {
      expect(parseGoogleLink(url)).toMatchObject({ google: true, short: true, name: '', placeId: '' });
    }
  });

  it('works on other Google domains and without a scheme', () => {
    expect(parseGoogleLink('https://www.google.co.uk/maps/place/Shine+Ltd/@51,0,17z').name).toBe('Shine Ltd');
    expect(parseGoogleLink('https://www.google.com.au/maps/place/Shine/@1,2,3z').google).toBe(true);
    expect(parseGoogleLink('google.com/maps/place/Shine/@1,2,3z')).toMatchObject({ href: 'https://google.com/maps/place/Shine/@1,2,3z', name: 'Shine' });
  });

  it('reads nothing from other sites, words, or unsafe links', () => {
    expect(parseGoogleLink('https://topchoicedetail.com/maps/place/Top+Choice/')).toMatchObject({ href: 'https://topchoicedetail.com/maps/place/Top+Choice/', google: false, name: '' });
    expect(parseGoogleLink('https://notgoogle.com.evil.io/maps/place/X').google).toBe(false);
    expect(parseGoogleLink('Top Choice Mobile Detailing').href).toBe('');
    expect(parseGoogleLink('javascript:alert(1)').href).toBe('');
    expect(parseGoogleLink(null).href).toBe('');
  });
});

describe('isLinkLike', () => {
  it('is a link when it starts like one or sits on a Google host', () => {
    expect(isLinkLike('https://example.com/x')).toBe(true);
    expect(isLinkLike('www.example.com')).toBe(true);
    expect(isLinkLike('maps.app.goo.gl/AbCd')).toBe(true);
    expect(isLinkLike('google.com/maps/place/X')).toBe(true);
  });

  it('is words otherwise', () => {
    expect(isLinkLike('Top Choice Orlando')).toBe(false);
    expect(isLinkLike('St.Pete')).toBe(false);
    expect(isLinkLike('Orlando')).toBe(false);
    expect(isLinkLike('')).toBe(false);
    expect(isLinkLike(undefined)).toBe(false);
  });
});

describe('searchPlan', () => {
  it('searches typed words as typed', () => {
    expect(searchPlan('  Top Choice   Kissimmee ', BUSINESS)).toEqual({ query: 'Top Choice Kissimmee', linkPlaceId: '', linkName: '', note: '' });
  });

  it("searches a link's listing name with the city and marks its place id", () => {
    const url = `https://www.google.com/maps/place/Top+Choice+Detail/@28.5,-81.3,17z/data=!19s${PID}`;
    expect(searchPlan(url, BUSINESS)).toEqual({ query: 'Top Choice Detail Orlando', linkPlaceId: PID, linkName: 'Top Choice Detail', note: '' });
  });

  it('falls back to the business name and city, and says why', () => {
    const idOnly = searchPlan(`https://search.google.com/local/writereview?placeid=${PID}`, BUSINESS);
    expect(idOnly).toMatchObject({ query: 'Top Choice Mobile Detailing Orlando', linkPlaceId: PID });
    expect(idOnly.note).toMatch(/Google ID but no name\. Searching the business name instead\. The listing it points to is marked\./);
    expect(searchPlan('https://maps.app.goo.gl/AbCd', BUSINESS).note).toMatch(/^Short share links/);
    expect(searchPlan('https://maps.google.com/?cid=1234567890', BUSINESS).note).toMatch(/internal listing number/);
    expect(searchPlan('https://topchoicedetail.com', BUSINESS).note).toBe("That isn't a Google link. Searching the business name instead.");
    expect(searchPlan('https://www.google.com/maps', BUSINESS).note).toBe("Couldn't read a business name from this link. Searching the business name instead.");
  });

  it('has nothing to search without a name anywhere', () => {
    const plan = searchPlan('https://maps.app.goo.gl/AbCd', {});
    expect(plan.query).toBe('');
    expect(plan.note).toMatch(/Search by name instead\.$/);
  });
});

describe('linkMatch / rankResults', () => {
  it("marks the link's own listing by id", () => {
    const plan = { linkPlaceId: PID, linkName: 'Top Choice Mobile Detailing' };
    expect(linkMatch(TOP, plan)).toBe('id');
    // With an id, a same-name branch is not a match.
    expect(linkMatch(BRANCH, plan)).toBe('');
    expect(rankResults([OTHER, BRANCH, TOP], plan).map((r) => r.placeId)).toEqual([PID, OTHER.placeId, BRANCH.placeId]);
  });

  it('marks same-name results when the link has no id', () => {
    const plan = { linkPlaceId: '', linkName: 'top choice mobile detailing' };
    expect(linkMatch(TOP, plan)).toBe('name');
    expect(linkMatch(OTHER, plan)).toBe('');
    expect(rankResults([OTHER, TOP, BRANCH], plan).map((r) => r.placeId)).toEqual([PID, BRANCH.placeId, OTHER.placeId]);
    expect(linkMatch({ name: 'A & B Detail' }, { linkName: 'a and b detail' })).toBe('name');
  });

  it('keeps Google order without a link', () => {
    const plan = searchPlan('Top Choice', BUSINESS);
    expect(rankResults([OTHER, TOP], plan)).toEqual([OTHER, TOP]);
    expect(linkMatch(TOP, plan)).toBe('');
    expect(rankResults(null, plan)).toEqual([]);
  });
});

describe('levers.googlePlace', () => {
  it('is built from a search result, with the place-id link', () => {
    expect(placeFromSearch(TOP)).toEqual({
      placeId: PID,
      placeName: 'Top Choice Mobile Detailing',
      rating: 4.9,
      reviewCount: 141,
      url: `https://www.google.com/maps/place/?q=place_id:${PID}`,
    });
    expect(placeFromSearch(null)).toBe(null);
  });

  it('has no rating or count Google did not send', () => {
    expect(placeFromSearch(BRANCH)).toMatchObject({ rating: null, reviewCount: null });
    expect(toLeverPlace({ placeId: 'x1', placeName: 'A', rating: 0, reviewCount: 2.5 })).toMatchObject({ rating: null, reviewCount: null });
    expect(toLeverPlace({ placeId: 'x1', rating: '4.8' }).rating).toBe(null);
  });

  it('maps a refreshed snapshot back, dropping the snapshot-only keys', () => {
    const snapshot = { placeId: PID, placeName: 'Top Choice', rating: 5, reviewCount: 150, address: 'Orlando', fetchedAt: '2026-10-05T00:00:00.000Z', url: `https://www.google.com/maps/place/?q=place_id:${PID}` };
    expect(toLeverPlace(snapshot)).toEqual({ placeId: PID, placeName: 'Top Choice', rating: 5, reviewCount: 150, url: snapshot.url });
    expect(toLeverPlace({ placeName: 'No id' })).toBe(null);
    expect(toLeverPlace(null)).toBe(null);
  });

  it('keeps a stored url only when it is on Google', () => {
    const idLink = `https://www.google.com/maps/place/?q=place_id:${PID}`;
    expect(toLeverPlace({ placeId: PID, url: 'https://evil.example/x' }).url).toBe(idLink);
    expect(toLeverPlace({ placeId: PID, url: 'https://google.com.evil.io/maps' }).url).toBe(idLink);
    expect(toLeverPlace({ placeId: PID, url: 'http://www.google.com/maps/place/X' }).url).toBe(idLink);
    expect(toLeverPlace({ placeId: PID, url: 'https://www.google.co.uk/maps/place/X' }).url).toBe('https://www.google.co.uk/maps/place/X');
  });

  it('passes sanitizeLevers unchanged, and an unrated listing never shows a badge', () => {
    const place = placeFromSearch(TOP);
    expect(sanitizeLevers({ googlePlace: place }, 'mobile_chrome').googlePlace).toEqual(place);
    expect(googleRatingOf(sanitizeLevers({ googlePlace: placeFromSearch(BRANCH) }, 'mobile_chrome').googlePlace)).toBe(null);
  });
});

describe('placeSummary', () => {
  it('says the rating as the badge would show it', () => {
    expect(placeSummary(placeFromSearch(TOP))).toEqual({
      name: 'Top Choice Mobile Detailing',
      hasRating: true,
      ratingText: '4.9 · 141 Google reviews',
      href: `https://www.google.com/maps/place/?q=place_id:${PID}`,
    });
    const big = placeSummary({ placeId: 'x', placeName: 'Big', rating: 4.7, reviewCount: 1234 });
    expect(big.ratingText).toBe('4.7 · 1,234 Google reviews');
  });

  it('shows no rating without both numbers', () => {
    expect(placeSummary(placeFromSearch(BRANCH))).toMatchObject({ hasRating: false, ratingText: 'No Google rating yet' });
    expect(placeSummary({ placeId: 'x', rating: 4.5, reviewCount: 0 }).hasRating).toBe(false);
    expect(placeSummary(null)).toEqual({ name: 'Google listing', hasRating: false, ratingText: 'No Google rating yet', href: '' });
  });

  it('links only to Google, whatever url a stored value carries', () => {
    expect(placeSummary({ placeId: PID, url: 'https://evil.example/x' }).href).toBe(`https://www.google.com/maps/place/?q=place_id:${PID}`);
    expect(placeSummary({ url: 'https://evil.example/x' }).href).toBe('');
  });
});

describe('answerMatch', () => {
  const place = placeFromSearch(TOP);
  it("compares the answer's place id with the chosen listing", () => {
    expect(answerMatch(place, `https://search.google.com/local/writereview?placeid=${PID}`)).toBe('same');
    expect(answerMatch(place, 'https://www.google.com/maps/place/?q=place_id:ChIJsomeone_else_0000')).toBe('different');
  });

  it("can't say without an id on both sides", () => {
    expect(answerMatch(place, 'https://maps.app.goo.gl/AbCd')).toBe('');
    expect(answerMatch(place, 'Top Choice')).toBe('');
    expect(answerMatch(null, `https://search.google.com/local/writereview?placeid=${PID}`)).toBe('');
    expect(answerMatch(place, undefined)).toBe('');
  });
});

describe('GooglePlaceField', () => {
  const render = (props) => renderToStaticMarkup(createElement(GooglePlaceField, { onChange: () => {}, ...BUSINESS, ...props }));

  it('uses the shared place search, with no endpoint or key of its own', () => {
    const src = readFileSync(new URL('./GooglePlaceField.jsx', import.meta.url), 'utf8');
    const lib = readFileSync(new URL('./googlePlaceField.js', import.meta.url), 'utf8');
    expect(src).toMatch(/import \{ refreshPlace, searchPlaces \} from '\.\.\/\.\.\/\.\.\/lib\/googlePlaces\.js';/);
    for (const s of [src, lib]) {
      expect(s).not.toContain('places-search');
      expect(s).not.toMatch(/\bfetch\(/);
      expect(s).not.toMatch(/api[_-]?key/i);
    }
  });

  it('starts with the business name and city in the search box and their answer as a hint', () => {
    const html = render({ value: null, profileLink: 'https://maps.app.goo.gl/AbCd' });
    expect(html).toContain('value="Top Choice Mobile Detailing Orlando"');
    expect(html).toContain('Their answer:');
    expect(html).toContain('href="https://maps.app.goo.gl/AbCd"');
    expect(html).toContain('Search from their link');
    expect(html).not.toContain('Chosen listing');
    // Nothing to type a rating into.
    expect(html.match(/<input/g)).toHaveLength(1);
  });

  it("shows a plain-words answer as text, and says when there's none", () => {
    const words = render({ value: null, profileLink: 'Top Choice on Google' });
    expect(words).toContain('Top Choice on Google');
    expect(words).toContain('Search this');
    expect(words).not.toContain('href="https://Top');
    expect(render({ value: null })).toContain("didn&#x27;t give a Google profile link");
    expect(render({ value: null, profileLink: 'javascript:alert(1)' })).not.toContain('href="javascript');
  });

  it('shows the chosen listing with its rating, link and actions instead of the search', () => {
    const html = render({ value: placeFromSearch(TOP), profileLink: `https://search.google.com/local/writereview?placeid=${PID}` });
    expect(html).toContain('Chosen listing');
    expect(html).toContain('4.9 · 141 Google reviews');
    expect(html).toContain(`href="https://www.google.com/maps/place/?q=place_id:${PID}"`);
    for (const label of ['Refresh rating', 'Change listing', 'Clear']) expect(html).toContain(label);
    expect(html).toContain('Same listing as their link.');
    expect(html).not.toContain('Find the business on Google');
    expect(html).not.toContain('Search from their link');
  });

  it('warns about an unrated listing and a link to another listing', () => {
    const html = render({ value: placeFromSearch(BRANCH), profileLink: `https://www.google.com/maps/place/?q=place_id:${PID}` });
    expect(html).toContain('No Google rating yet');
    expect(html).toContain('No rating badge shows on the site');
    expect(html).toContain('Their link points to a different Google listing.');
  });

  it('locks every search button while disabled', () => {
    const html = render({ value: null, profileLink: 'https://maps.app.goo.gl/AbCd', disabled: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Search from their link<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Search<\/button>/);
  });

  it('treats a value without a place id as nothing chosen', () => {
    const html = render({ value: { placeName: 'Old', rating: 5, reviewCount: 9 } });
    expect(html).not.toContain('Chosen listing');
    expect(html).toContain('Find the business on Google');
  });
});
