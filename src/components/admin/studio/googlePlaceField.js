// Pure helpers for the Design Studio's Google profile picker
// (GooglePlaceField.jsx), which fills design.levers.googlePlace:
// { placeId, placeName, rating, reviewCount, url } (sanitizeLevers in
// lib/designLevers.js).
//
// The picker uses the same place search as the wizard and the editor's
// Google Rating tab (lib/googlePlaces.js), so there is no new key or
// function. The rating and review count only ever come from a search result
// the admin confirmed: the customer's answer and a pasted link only decide
// WHAT to search for and which result to mark, never what the site says.
import { placeFromResult } from '../../../lib/googlePlaces.js';
import { safeHref } from '../../../lib/customSiteForm.js';
import { googlePlaceUrl, googleRatingOf } from '../../preview/templates/kit/GoogleRatingBadge.jsx';

const str = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// "Top Choice Mobile Detailing Orlando": the business name and city, the
// query refreshPlace also tries first (the city ranks the business's own
// listing above same-name ones elsewhere). The state stands in for a
// missing city; a place already in the name isn't repeated.
export function suggestedQuery({ businessName, city, state } = {}) {
  const name = str(businessName);
  if (!name) return '';
  const where = str(city) || str(state);
  if (!where || name.toLowerCase().includes(where.toLowerCase())) return name;
  return `${name} ${where}`;
}

// Share links that only redirect (maps.app.goo.gl, g.page, …). The browser
// can't follow them for us (the redirect is cross-origin), so they carry
// nothing we can read.
const SHORT_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.page|g\.co|share\.google)$/;
// google.com, google.ca, google.co.uk, google.com.au, maps.google.com, …
const GOOGLE_HOST = /(^|\.)google\.(com|[a-z]{2}|com?\.[a-z]{2})$/;
// A Places API place id ("ChIJ…"). Hex feature ids ("0x88e7…:0x…") and
// numeric cids are other ids the search can't use.
const PLACE_ID = /^[A-Za-z0-9_-]{16,}$/;
// A dropped pin ("28.5383,-81.3792" or 28°32'18"N …) is no business name.
const COORDS = /^[\d\s.,+\-°'"NSEW]+$/;

function decodePart(s) {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s.replace(/\+/g, ' ');
  }
}

function nameOrEmpty(v) {
  const s = str(v).slice(0, 120);
  return s && !COORDS.test(s) ? s : '';
}

// What a pasted or answered link says about a Google listing:
//   { href, google, short, placeId, name, cid }
// href  the safe http(s) form, '' when the text is no link at all
// name  the listing name or search words in it (/maps/place/<name>/, ?q=, ?query=)
// placeId  a Google place id (?placeid=, ?query_place_id=, q=place_id:…,
//       or !19s… in a Maps link's data part)
// cid   Google's numeric listing id (?cid=, ?ludocid=); the search can't use it
// short a share link that only redirects (see SHORT_HOSTS)
export function parseGoogleLink(input) {
  const out = { href: '', google: false, short: false, placeId: '', name: '', cid: '' };
  const raw = str(input);
  const href = raw ? safeHref(raw) : null;
  if (!href) return out;
  out.href = href;
  const u = new URL(href);
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (SHORT_HOSTS.test(host)) return { ...out, google: true, short: true };
  if (!GOOGLE_HOST.test(host)) return out;
  out.google = true;

  const p = u.searchParams;
  const q = p.get('q') || '';
  const placeIdQ = /^place_id:(.+)$/i.exec(q);
  const dataId = /!19s([A-Za-z0-9_-]+)/.exec(`${u.pathname}${u.search}`);
  out.placeId = [p.get('placeid'), p.get('place_id'), p.get('query_place_id'), placeIdQ?.[1], dataId?.[1]]
    .map(str)
    .find((v) => PLACE_ID.test(v)) || '';
  const cid = str(p.get('cid') || p.get('ludocid'));
  if (/^\d{5,25}$/.test(cid)) out.cid = cid;

  const path = /\/maps\/(?:place|search)\/([^/@]+)/i.exec(u.pathname);
  out.name = nameOrEmpty(path ? decodePart(path[1]) : '') || nameOrEmpty(placeIdQ ? '' : q) || nameOrEmpty(p.get('query'));
  return out;
}

// Text that should be read as a link rather than searched for as words:
// one token that safeHref turns into an http(s) address and that starts
// like one (https://, //, www.) or is on a Google host. "St.Pete" is a word.
export function isLinkLike(text) {
  const s = str(text);
  const href = s && !/\s/.test(s) ? safeHref(s) : null;
  if (!href) return false;
  if (/^((https?:)?\/\/|www\.)/i.test(s)) return true;
  const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
  return SHORT_HOSTS.test(host) || GOOGLE_HOST.test(host);
}

// Why a link didn't give us a name to search for ('' when it did).
function linkNote(link, fellBack) {
  const instead = fellBack ? ' Searching the business name instead.' : ' Search by name instead.';
  if (link.name) return '';
  if (link.short) return `Short share links (maps.app.goo.gl, g.page) can't be read from here. Open it to see the listing's name, or paste the long link from the address bar.${instead}`;
  if (!link.google) return `That isn't a Google link.${instead}`;
  if (link.placeId) return `This link has the listing's Google ID but no name.${instead} The listing it points to is marked.`;
  if (link.cid) return `This link only has Google's internal listing number, which the search can't use.${instead}`;
  return `Couldn't read a business name from this link.${instead}`;
}

// What to send to the search for what the admin typed or pasted (or the
// customer's answer). Words are searched as typed. A link is read instead:
// its listing name (with the city), else the business name and city; its
// place id marks the result it points to.
//   { query, linkPlaceId, linkName, note }
export function searchPlan(text, business = {}) {
  const raw = str(text);
  if (!isLinkLike(raw)) return { query: raw, linkPlaceId: '', linkName: '', note: '' };
  const link = parseGoogleLink(raw);
  const fallback = suggestedQuery(business);
  const query = link.name ? suggestedQuery({ businessName: link.name, city: business.city, state: business.state }) : fallback;
  return { query, linkPlaceId: link.placeId, linkName: link.name, note: linkNote(link, !!fallback) };
}

// "top choice & co." and "Top Choice and Co" are the same name.
function nameKey(v) {
  return str(v).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
}

// How a (mapped) search result relates to the link the search came from:
// 'id' = the very listing the link points to; 'name' = same name as the
// listing in a link without an id (a chain's other branch has it too);
// '' = neither.
export function linkMatch(result, plan) {
  if (!result || !plan) return '';
  if (plan.linkPlaceId) return result.placeId === plan.linkPlaceId ? 'id' : '';
  const key = nameKey(plan.linkName);
  return key && nameKey(result.name) === key ? 'name' : '';
}

// The results with the link's own listing first, then same-name ones, the
// rest in Google's order.
export function rankResults(results, plan) {
  const rank = { id: 0, name: 1, '': 2 };
  return (Array.isArray(results) ? results : [])
    .map((r, i) => ({ r, i, m: rank[linkMatch(r, plan)] }))
    .sort((a, b) => a.m - b.m || a.i - b.i)
    .map((x) => x.r);
}

const ratingOrNull = (v) => (typeof v === 'number' && v > 0 && v <= 5 ? v : null);
const countOrNull = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

// A stored url only while it is an https link on a Google host, else ''
// (googlePlaceUrl then builds the place-id link). sanitizeLevers keeps any
// https url, so a tampered design or a model's guess could otherwise turn
// "View on Google" (and the badge's link, after a refresh) into another site.
function googleUrl(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!/^https:\/\//i.test(s)) return '';
  try {
    return GOOGLE_HOST.test(new URL(s).hostname.toLowerCase().replace(/^www\./, '')) ? s : '';
  } catch {
    return '';
  }
}

// The listing's Google Maps link: its own Google url, else the place-id link.
function placeHref(place) {
  return place && typeof place === 'object' ? googlePlaceUrl({ placeId: place.placeId, url: googleUrl(place.url) }) || '' : '';
}

// The levers.googlePlace for a place snapshot (lib/googlePlaces.js
// placeFromResult / refreshPlace), or null without a place id. A rating or
// count Google didn't send is null, never a default. url is the place's
// https link on Google Maps (placeHref: the snapshot's own Google link, else
// the place-id link), the same link the badge would build.
export function toLeverPlace(place) {
  const placeId = str(place?.placeId);
  if (!placeId) return null;
  return {
    placeId,
    placeName: str(place.placeName),
    rating: ratingOrNull(place.rating),
    reviewCount: countOrNull(place.reviewCount),
    url: placeHref({ placeId, url: place.url }),
  };
}

// The levers.googlePlace for a mapped search result (searchPlaces).
export function placeFromSearch(result) {
  return result?.placeId ? toLeverPlace(placeFromResult(result)) : null;
}

// What the field shows about a place (lever shape or snapshot).
//   ratingText  '4.9 · 141 Google reviews', or 'No Google rating yet' when
//               the badge couldn't show (it needs a rating AND a count >= 1)
export function placeSummary(place) {
  const g = googleRatingOf(place);
  return {
    name: str(place?.placeName) || 'Google listing',
    hasRating: g != null,
    ratingText: g ? `${g.ratingText} · ${g.countText} Google reviews` : 'No Google rating yet',
    href: placeHref(place),
  };
}

// Is the chosen listing the one the customer's answer points to?
// 'same' / 'different', or '' when the answer can't say (only a link with
// a place id can).
export function answerMatch(place, answer) {
  const id = isLinkLike(answer) ? parseGoogleLink(answer).placeId : '';
  if (!id || !place?.placeId) return '';
  return id === place.placeId ? 'same' : 'different';
}
