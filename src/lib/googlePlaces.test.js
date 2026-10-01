// The shared Google place search: URL encoding, result mapping, snapshots and
// refresh. A fake fetch answers every request (no network).
import { describe, it, expect } from 'vitest';
import { PLACES_SEARCH_URL, placesSearchUrl, mapPlaceResult, searchPlaces, placeFromResult, refreshPlace } from './googlePlaces.js';

const NOW = new Date('2026-09-01T12:00:00.000Z');

// fetchImpl stand-in: answers(url) -> results array | Error (thrown) |
// { status } (non-ok response). Records every URL it was asked for.
function fakeFetch(answers) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const q = new URL(url).searchParams.get('q');
    const a = typeof answers === 'function' ? answers(q) : answers;
    if (a instanceof Error) throw a;
    if (a && !Array.isArray(a) && a.status) return { ok: false, status: a.status, json: async () => ({ error: 'x' }) };
    return { ok: true, status: 200, json: async () => ({ results: a || [] }) };
  };
  impl.calls = calls;
  return impl;
}

const TOP = { place_id: 'p-top', name: 'Top Choice Mobile Detailing', address: 'Orlando, FL, USA', rating: 4.9, review_count: 141 };
const OTHER = { place_id: 'p-other', name: 'Top Choice Auto Spa', address: 'Tampa, FL, USA', rating: 4.6, review_count: 58 };

describe('placesSearchUrl', () => {
  it('is the SocialFeeds endpoint the wizard has always called, encoded the same way', () => {
    expect(PLACES_SEARCH_URL).toBe('https://social-feeds-app.netlify.app/.netlify/functions/places-search');
    expect(placesSearchUrl('Top Choice & Co')).toBe(`${PLACES_SEARCH_URL}?q=Top%20Choice%20%26%20Co`);
    expect(placesSearchUrl('  Orlando  ')).toBe(`${PLACES_SEARCH_URL}?q=Orlando`);
    expect(placesSearchUrl(null)).toBe(`${PLACES_SEARCH_URL}?q=`);
  });
});

describe('mapPlaceResult', () => {
  it('needs a place id', () => {
    expect(mapPlaceResult({ name: 'No id' })).toBe(null);
    expect(mapPlaceResult({ place_id: '  ', name: 'Blank id' })).toBe(null);
    expect(mapPlaceResult({ place_id: 42 })).toBe(null);
    expect(mapPlaceResult(null)).toBe(null);
  });

  it('maps and cleans the fields', () => {
    expect(mapPlaceResult(TOP)).toEqual({ placeId: 'p-top', name: 'Top Choice Mobile Detailing', address: 'Orlando, FL, USA', rating: 4.9, reviewCount: 141 });
    expect(mapPlaceResult({ place_id: 'x', name: '  Shop  ' })).toEqual({ placeId: 'x', name: 'Shop', address: '', rating: null, reviewCount: null });
  });

  it('keeps only a real rating (0 < r <= 5) and a whole review count', () => {
    const m = (extra) => mapPlaceResult({ place_id: 'x', ...extra });
    expect(m({ rating: '4.8' }).rating).toBe(4.8);
    expect(m({ rating: 5 }).rating).toBe(5);
    expect(m({ rating: 0 }).rating).toBe(null);
    expect(m({ rating: 6 }).rating).toBe(null);
    expect(m({ rating: 'n/a' }).rating).toBe(null);
    expect(m({ review_count: '12' }).reviewCount).toBe(12);
    expect(m({ review_count: 0 }).reviewCount).toBe(0);
    expect(m({ review_count: 12.5 }).reviewCount).toBe(null);
    expect(m({ review_count: -1 }).reviewCount).toBe(null);
    expect(m({}).reviewCount).toBe(null);
  });
});

describe('searchPlaces', () => {
  it('asks nothing for under 3 characters', async () => {
    const f = fakeFetch([TOP]);
    expect(await searchPlaces('to', { fetchImpl: f })).toEqual([]);
    expect(await searchPlaces('   ab   ', { fetchImpl: f })).toEqual([]);
    expect(f.calls).toEqual([]);
  });

  it('maps the results and drops ones without a place id', async () => {
    const f = fakeFetch([TOP, { name: 'No id' }, OTHER]);
    const out = await searchPlaces('Top Choice', { fetchImpl: f });
    expect(out.map((r) => r.placeId)).toEqual(['p-top', 'p-other']);
    expect(f.calls).toEqual([`${PLACES_SEARCH_URL}?q=Top%20Choice`]);
  });

  it('throws when the search answers with an error', async () => {
    await expect(searchPlaces('Top Choice', { fetchImpl: fakeFetch({ status: 502 }) })).rejects.toThrow('Google search failed');
    await expect(searchPlaces('Top Choice', { fetchImpl: fakeFetch(new TypeError('offline')) })).rejects.toThrow('offline');
  });

  it('tolerates a body without results', async () => {
    const f = async () => ({ ok: true, json: async () => ({}) });
    expect(await searchPlaces('Top Choice', { fetchImpl: f })).toEqual([]);
  });
});

describe('placeFromResult', () => {
  it('is a dated snapshot without empty facts', () => {
    expect(placeFromResult(mapPlaceResult(TOP), NOW)).toEqual({
      placeId: 'p-top', placeName: 'Top Choice Mobile Detailing', rating: 4.9, reviewCount: 141, address: 'Orlando, FL, USA', fetchedAt: '2026-09-01T12:00:00.000Z',
    });
    const bare = placeFromResult(mapPlaceResult({ place_id: 'x', name: 'Shop' }), NOW);
    expect(bare).toEqual({ placeId: 'x', placeName: 'Shop', fetchedAt: '2026-09-01T12:00:00.000Z' });
    expect('rating' in bare || 'reviewCount' in bare || 'address' in bare).toBe(false);
  });
});

describe('refreshPlace', () => {
  const saved = { placeId: 'p-top', placeName: 'Top Choice Mobile Detailing', rating: 5, reviewCount: 137, url: 'https://maps.app.goo.gl/abc', fetchedAt: '2026-01-01T00:00:00.000Z' };

  it('updates rating, count and date from the first query, keeping the url', async () => {
    const f = fakeFetch([OTHER, TOP]);
    const r = await refreshPlace(saved, { city: 'Orlando', fetchImpl: f, now: NOW });
    expect(r.status).toBe('updated');
    expect(r.changed).toBe(true);
    expect(r.place).toEqual({ ...saved, rating: 4.9, reviewCount: 141, address: 'Orlando, FL, USA', fetchedAt: '2026-09-01T12:00:00.000Z' });
    expect(f.calls).toEqual([`${PLACES_SEARCH_URL}?q=Top%20Choice%20Mobile%20Detailing%20Orlando`]);
  });

  it('says unchanged when Google still has the same rating and count', async () => {
    const r = await refreshPlace({ ...saved, rating: 4.9, reviewCount: 141 }, { city: 'Orlando', fetchImpl: fakeFetch([TOP]), now: NOW });
    expect(r).toMatchObject({ status: 'updated', changed: false });
    expect(r.place.fetchedAt).toBe('2026-09-01T12:00:00.000Z');
  });

  it('falls back to the bare name', async () => {
    const f = fakeFetch((q) => (q.endsWith('Orlando') ? [OTHER] : [TOP]));
    const r = await refreshPlace(saved, { city: 'Orlando', fetchImpl: f, now: NOW });
    expect(r.status).toBe('updated');
    expect(f.calls.length).toBe(2);
    expect(f.calls[1]).toBe(`${PLACES_SEARCH_URL}?q=Top%20Choice%20Mobile%20Detailing`);
  });

  it('asks once when there is no city', async () => {
    const f = fakeFetch([]);
    expect(await refreshPlace(saved, { fetchImpl: f, now: NOW })).toEqual({ status: 'not_found' });
    expect(f.calls.length).toBe(1);
  });

  it('is not_found when no result has the place id', async () => {
    expect(await refreshPlace(saved, { city: 'Orlando', fetchImpl: fakeFetch([OTHER]), now: NOW })).toEqual({ status: 'not_found' });
  });

  it('is error when the search fails', async () => {
    expect(await refreshPlace(saved, { city: 'Orlando', fetchImpl: fakeFetch(new TypeError('offline')), now: NOW })).toEqual({ status: 'error' });
    expect(await refreshPlace(saved, { city: 'Orlando', fetchImpl: fakeFetch({ status: 500 }), now: NOW })).toEqual({ status: 'error' });
  });

  it('removes a rating and count Google no longer sends', async () => {
    const r = await refreshPlace(saved, { city: 'Orlando', fetchImpl: fakeFetch([{ place_id: 'p-top', name: 'Top Choice Mobile Detailing' }]), now: NOW });
    expect(r.status).toBe('updated');
    expect(r.changed).toBe(true);
    expect('rating' in r.place).toBe(false);
    expect('reviewCount' in r.place).toBe(false);
    expect(r.place.url).toBe(saved.url);
  });

  it('needs a place id', async () => {
    const f = fakeFetch([TOP]);
    expect(await refreshPlace(null, { fetchImpl: f })).toEqual({ status: 'no_place' });
    expect(await refreshPlace({ placeName: 'Top Choice Mobile Detailing', rating: 5 }, { fetchImpl: f })).toEqual({ status: 'no_place' });
    expect(f.calls).toEqual([]);
  });
});
