// Pure helpers for the Google Rating panel (GoogleRatingPanel.jsx) and the
// per-review "From Google" fields (TestimonialSourceFields.jsx).
//
// The rating and review count are never typed by the owner: they are read
// from businessInfo.googlePlace with the same googleRatingOf the templates'
// badge uses, so the panel says exactly what the published page will show.
import { googleRatingOf } from '../templates/kit/GoogleRatingBadge.jsx';

// Where a template can show the badge (copy.googleBadge.placements), in the
// canonical order the panel writes them.
export const BADGE_SPOTS = [
  { id: 'hero', label: 'Top of the page (hero)' },
  { id: 'nav', label: 'Menu bar' },
  { id: 'about', label: 'About section' },
  { id: 'reviews', label: 'Reviews heading' },
  { id: 'footer', label: 'Footer' },
];
const SPOT_IDS = BADGE_SPOTS.map((s) => s.id);

// The spots the badge shows in now: the owner's saved list ([] = nowhere),
// or the template's defaults while copy.googleBadge is unset.
export function effectivePlacements(copy, defaults = ['hero', 'footer']) {
  const list = copy?.googleBadge?.placements;
  return Array.isArray(list) ? list.filter((id) => SPOT_IDS.includes(id)) : defaults;
}

// The copy.googleBadge to write after one switch: the first change copies
// the defaults, so turning one spot off keeps the others where they were.
export function togglePlacement(copy, defaults, id, on) {
  const set = new Set(effectivePlacements(copy, defaults));
  if (on) set.add(id); else set.delete(id);
  const current = copy?.googleBadge && typeof copy.googleBadge === 'object' && !Array.isArray(copy.googleBadge) ? copy.googleBadge : {};
  return { ...current, placements: SPOT_IDS.filter((s) => set.has(s)) };
}

// 'Sep 1, 2026' for an ISO date, '' when missing or unreadable.
function formatAsOf(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// What the panel shows about the connected place.
//   connected  a place is saved (a wizard snapshot may lack the id)
//   hasRating  the badge can render (rating AND review count, as the kit requires)
//   legacy     no fetch date: the wizard's snapshot from before dates were kept
export function placeStatus(place) {
  const g = googleRatingOf(place);
  const asOf = formatAsOf(place?.fetchedAt);
  return {
    connected: Boolean(place?.placeId || place?.placeName),
    hasRating: g != null,
    ratingText: g?.ratingText || '',
    countText: g?.countText || '',
    name: str(place?.placeName),
    address: str(place?.address),
    asOf,
    legacy: !asOf,
  };
}

// '4.9 · 141 reviews' for a search result (mapped shape), or 'No rating yet'
// when Google sent no rating or no count (the badge needs both).
export function resultRatingText(result) {
  const g = googleRatingOf({ rating: result?.rating, reviewCount: result?.reviewCount });
  return g ? `${g.ratingText} · ${g.countText} reviews` : 'No rating yet';
}

const ratingLine = (place) => {
  const g = googleRatingOf(place);
  return g ? `${g.ratingText} · ${g.countText}` : '';
};

// The line shown after "Refresh rating": { tone, text } (tone as fields.jsx Help).
export function refreshMessage(result, before) {
  const status = result?.status;
  if (status === 'updated') {
    const now = ratingLine(result.place);
    if (!now) return { tone: 'warn', text: 'Google has no rating for this listing right now, so the badge is hidden.' };
    if (!result.changed) return { tone: 'ok', text: `Up to date: ${now} Google reviews.` };
    const was = ratingLine(before);
    return { tone: 'ok', text: was ? `Updated: ${now} Google reviews (was ${was}).` : `Updated: ${now} Google reviews.` };
  }
  if (status === 'not_found') {
    return { tone: 'warn', text: "We couldn't find this listing in Google's results just now. Your saved rating is unchanged." };
  }
  if (status === 'no_place') {
    // A snapshot without a place id cannot be matched in the search.
    return { tone: 'warn', text: 'This listing was saved without its Google ID, so it can\'t be refreshed. Use Change listing to pick it again.' };
  }
  return { tone: 'error', text: "Couldn't reach Google search. Try again in a minute." };
}

// testimonialPlaceholders[i] patches. Turning "From Google" off clears the
// stars too: stars without the Google source would be an unsourced rating.
export function sourcePatch(on) {
  return on ? { source: 'google' } : { source: null, rating: null };
}

// 1-5 whole stars; above 5 is 5, anything unreadable or below 1 is no stars.
export function ratingPatch(n) {
  const v = typeof n === 'number' || (typeof n === 'string' && n.trim()) ? Math.round(Number(n)) : NaN;
  if (!Number.isFinite(v) || v < 1) return { rating: null };
  return { rating: Math.min(5, v) };
}

// Google facts the owner typed by hand: About stats ("5.0 / Google Rating",
// "137+ / 5-Star Reviews") and the Reviews heading ("137+ Five-Star Google
// Reviews"). They never follow the connected listing, so next to the real
// badge they go out of date. [{ where, text }] for the panels' warning.
const GOOGLE_WORDS = /\b(google|reviews?|stars?|ratings?|rated)\b|[★⭐]/i;
export function typedGoogleFacts(copy) {
  const out = [];
  const stats = Array.isArray(copy?.aboutStats) ? copy.aboutStats : [];
  for (const st of stats) {
    const text = [st?.value, st?.label].filter((v) => typeof v === 'string' && v.trim()).join(' ').trim();
    if (text && GOOGLE_WORDS.test(text)) out.push({ where: 'About stats', text });
  }
  const heading = copy?.sectionTitles?.testimonials?.title;
  if (typeof heading === 'string' && /\d/.test(heading) && GOOGLE_WORDS.test(heading)) {
    out.push({ where: 'Reviews heading', text: heading.trim() });
  }
  return out;
}
