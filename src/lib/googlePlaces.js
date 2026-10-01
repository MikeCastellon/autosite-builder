// Google place lookup shared by the wizard (StepBusinessInfo) and the
// editor's Google Rating panel.
//
// businessInfo.googlePlace is the only source of the rating and review count
// a template may show (kit/GoogleRatingBadge.jsx), so it is written only from
// what this search returned: the owner picks a result (placeFromResult) or
// refreshes the one they picked (refreshPlace). Nothing here invents or keeps
// a rating Google did not send.
//
// Everything is pure apart from the fetch, which tests replace (fetchImpl).

// The SocialFeeds public places search the wizard has always used (read-only GET).
// Hard-coded on purpose: VITE_SOCIALFEEDS_URL would move the wizard to another
// endpoint, and this repo's own function of the same name returns no ratings.
export const PLACES_SEARCH_URL = 'https://social-feeds-app.netlify.app/.netlify/functions/places-search';

// Same encoding the wizard has always sent (trimmed first).
export function placesSearchUrl(query) {
  return `${PLACES_SEARCH_URL}?q=${encodeURIComponent(String(query ?? '').trim())}`;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

const toNumber = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) return Number(v.trim().replace(/,/g, ''));
  return NaN;
};

// A Google rating is 1.0-5.0; anything else (0, 6, 'n/a') is no rating.
function ratingOf(v) {
  const n = toNumber(v);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

// A review count is a whole number >= 0; anything else is no count.
function countOf(v) {
  const n = toNumber(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// One search result (place_id, name, address, rating, review_count) in the
// shape the app uses, or null when it has no place id (it could never be
// matched again on refresh).
export function mapPlaceResult(r) {
  if (!r || typeof r !== 'object') return null;
  const placeId = str(r.place_id);
  if (!placeId) return null;
  return {
    placeId,
    name: str(r.name),
    address: str(r.address),
    rating: ratingOf(r.rating),
    reviewCount: countOf(r.review_count),
  };
}

// Mapped results for a query. Under 3 characters there is nothing worth
// asking Google, so no request is made. A failed request throws.
export async function searchPlaces(query, { fetchImpl = globalThis.fetch } = {}) {
  const q = String(query ?? '').trim();
  if (q.length < 3) return [];
  const res = await fetchImpl(placesSearchUrl(q));
  if (!res || !res.ok) throw new Error('Google search failed');
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];
  return results.map(mapPlaceResult).filter(Boolean);
}

// The businessInfo.googlePlace snapshot for a picked (mapped) result.
// rating / reviewCount / address are left out when Google sent none, so no
// empty value can look like a fact; fetchedAt dates the snapshot ("as of").
export function placeFromResult(result, now = new Date()) {
  const place = { placeId: result.placeId, placeName: result.name };
  if (result.rating != null) place.rating = result.rating;
  if (result.reviewCount != null) place.reviewCount = result.reviewCount;
  if (result.address) place.address = result.address;
  place.fetchedAt = now.toISOString();
  return place;
}

// Re-reads the connected place's rating and review count. The search has no
// lookup by id, so it searches by name (with the city first, which ranks the
// owner's own listing higher, then the bare name) and keeps only the result
// with the same place id.
//   { status: 'updated', changed, place }  place = the new snapshot
//   { status: 'not_found' }                 no result with that id
//   { status: 'error' }                     the search failed
//   { status: 'no_place' }                  nothing (or no id) to refresh
export async function refreshPlace(place, { city = '', fetchImpl, now = new Date() } = {}) {
  if (!place?.placeId) return { status: 'no_place' };
  const name = str(place.placeName);
  const queries = name
    ? [...new Set([`${name} ${str(city)}`.trim(), name])].filter((q) => q.length >= 3)
    : [];
  try {
    for (const q of queries) {
      const results = await searchPlaces(q, { fetchImpl });
      const hit = results.find((r) => r.placeId === place.placeId);
      if (!hit) continue;
      // Keeps every other key (the owner's url link among them).
      const next = { ...place, placeName: hit.name || place.placeName, fetchedAt: now.toISOString() };
      const address = hit.address || str(place.address);
      if (address) next.address = address;
      // Real data only: what Google sends now replaces the old snapshot,
      // and a rating or count Google no longer sends is removed, not kept.
      if (hit.rating != null) next.rating = hit.rating; else delete next.rating;
      if (hit.reviewCount != null) next.reviewCount = hit.reviewCount; else delete next.reviewCount;
      const changed = ratingOf(place.rating) !== (hit.rating ?? null) || countOf(place.reviewCount) !== (hit.reviewCount ?? null);
      return { status: 'updated', changed, place: next };
    }
    return { status: 'not_found' };
  } catch {
    return { status: 'error' };
  }
}
