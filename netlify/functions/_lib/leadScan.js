// The Leads scan: every detailer, tint shop, wheel shop, mechanic and car
// wash in one area, from Google Places, written to sales_prospects.
//
// Ported from Genius Routes (netlify/functions/_lib/prospectScan.js), which
// scans a fixed list of Florida towns for chemical buyers. Here an admin
// names the area (a city, a zip, a state) and a radius each time, and the
// question is a different one: does this shop have a website, and do they
// already have an account with us.
//
// Everything that talks to the outside world (db, fetchImpl) is passed in,
// so the whole scan runs in a test against fakes.
import {
  LEAD_CATEGORIES, MAX_SCAN_REQUESTS, depthFor,
} from '../../../src/lib/leadCategories.js';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export const KM_PER_MILE = 1.609344;
const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

export function rectAround(lat, lng, km) {
  const dLat = km / KM_PER_DEG_LAT;
  const dLng = km / kmPerDegLng(lat);
  return {
    low: { latitude: lat - dLat, longitude: lng - dLng },
    high: { latitude: lat + dLat, longitude: lng + dLng },
  };
}

/** A rectangle's four quarters: how a full search is asked again, smaller. */
export function quarters(rect) {
  const midLat = (rect.low.latitude + rect.high.latitude) / 2;
  const midLng = (rect.low.longitude + rect.high.longitude) / 2;
  const { low, high } = rect;
  return [
    { low, high: { latitude: midLat, longitude: midLng } },
    { low: { latitude: low.latitude, longitude: midLng }, high: { latitude: midLat, longitude: high.longitude } },
    { low: { latitude: midLat, longitude: low.longitude }, high: { latitude: high.latitude, longitude: midLng } },
    { low: { latitude: midLat, longitude: midLng }, high },
  ];
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------------------------------------------------------------------------
// What a place is
// ---------------------------------------------------------------------------

const RX = {
  tint: /\b(tint|tints|tinting|ppf|paint protection|ceramic|coatings?|wraps?|xpel|suntek|llumar|window film)\b/i,
  wheel: /\b(wheels?|rims?|alloys?)\b/i,
  detailing: /\b(detail|detailing|detailers?|details|auto spa|car spa)\b/i,
  mobile: /\bmobile\b/i,
  carWash: /\b(car ?wash|carwash|auto wash|express wash|hand wash|wash club)\b/i,
};

const REPAIR_TYPES = ['car_repair', 'tire_shop', 'oil_change_station', 'auto_body_shop'];

function component(place, type, which = 'longText') {
  const c = (place.addressComponents || []).find((a) => (a.types || []).includes(type));
  return c ? c[which] : null;
}

/**
 * Which of the builder's business types a place is. The query that found it
 * is only the fallback: "auto repair" turns up tint shops, Google tags most
 * detailers `car_wash`, so the name and the types decide first.
 *
 * A detailer with no street address on Google is a service-area business:
 * it comes to you, so it is mobile whatever its name says.
 */
export function classify(place, queryCategory) {
  const name = place.displayName?.text || '';
  const types = place.types || [];
  const has = (list) => list.some((t) => types.includes(t));

  if (RX.tint.test(name)) return 'tint_shop';
  if (RX.detailing.test(name)) {
    return RX.mobile.test(name) || !component(place, 'street_number') ? 'mobile_detailing' : 'detailing_shop';
  }
  if (RX.wheel.test(name) && !/\balignment\b/i.test(name)) return 'wheel_shop';
  if (RX.carWash.test(name)) return 'car_wash';
  // Tagged car_wash with nothing in the name to say so: a detailing search
  // that found it knows better than the tag.
  if (types.includes('car_wash')) {
    return queryCategory === 'mobile_detailing' || queryCategory === 'detailing_shop' ? queryCategory : 'car_wash';
  }
  if (has(REPAIR_TYPES)) {
    return ['tint_shop', 'wheel_shop'].includes(queryCategory) ? queryCategory : 'mechanic_shop';
  }
  return queryCategory;
}

// Hosts that carry thousands of unrelated businesses' pages: a shop whose
// "website" is one of these has a page, not a site.
const SOCIAL_HOSTS = [
  'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'linktr.ee', 'linkin.bio', 'tiktok.com',
  'yelp.com', 'google.com', 'goo.gl', 'g.page', 'business.site', 'x.com', 'twitter.com',
  'youtube.com', 'nextdoor.com', 'yellowpages.com', 'mapquest.com', 'booksy.com', 'vagaro.com',
  'setmore.com', 'square.com', 'squareup.com', 'urable.com', 'thumbtack.com', 'angi.com',
];
// Site builders: a real site, but one we can usually beat.
const BUILDER_HOSTS = [
  'wixsite.com', 'wix.com', 'squarespace.com', 'godaddysites.com', 'weebly.com', 'square.site',
  'wordpress.com', 'carrd.co', 'webflow.io', 'jimdosite.com', 'site123.me', 'mystrikingly.com',
  'strikingly.com', 'duda.co', 'myshopify.com', 'ueniweb.com', 'ueni.com', 'hibu.com',
];

function hostOf(url) {
  try {
    const s = String(url).trim();
    return new URL(s.includes('://') ? s : `http://${s}`).hostname.toLowerCase().replace(/^www\d?\./, '');
  } catch {
    return null;
  }
}

const onHost = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`));

/** none / social / builder / own: what Google lists as the shop's website. */
export function websiteKind(url) {
  if (!url || !String(url).trim()) return 'none';
  const host = hostOf(url);
  if (!host) return 'none';
  if (onHost(host, SOCIAL_HOSTS)) return 'social';
  if (onHost(host, BUILDER_HOSTS)) return 'builder';
  return 'own';
}

/** A Places result, as a sales_prospects row (minus status, which admins own). */
export function toRow(place, category) {
  const number = component(place, 'street_number');
  const route = component(place, 'route', 'shortText');
  const street = [number, route].filter(Boolean).join(' ') || null;
  const county = (component(place, 'administrative_area_level_2') || '')
    .replace(/\s+County$/i, '')
    .trim() || null;
  const website = place.websiteUri || null;
  return {
    place_id: place.id,
    name: (place.displayName?.text || '').trim(),
    category,
    google_type: place.primaryTypeDisplayName?.text || null,
    address: street,
    city: component(place, 'locality') || component(place, 'sublocality') || component(place, 'neighborhood'),
    county,
    state: component(place, 'administrative_area_level_1', 'shortText'),
    zip: component(place, 'postal_code'),
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    phone: place.nationalPhoneNumber || null,
    website,
    website_kind: websiteKind(website),
    rating: place.rating ?? null,
    rating_count: place.userRatingCount ?? null,
  };
}

// Places that turn up in these searches but will never buy a website from
// us: a "car wash" search returns every gas station with a wash bay, "auto
// repair" returns dealerships and parts stores, and the long tail lets in
// restaurants and banks. A place whose *primary* type is one of these is
// dropped. (List from Genius Routes, plus the car trade we don't sell to.)
const NOT_A_BUYER = new Set([
  'car_dealer', 'truck_dealer', 'motorcycle_dealer', 'boat_dealer', 'rv_dealer', 'auto_parts_store',
  'car_rental', 'gas_station', 'truck_stop', 'convenience_store', 'grocery_store', 'supermarket',
  'department_store', 'discount_store', 'warehouse_store', 'shopping_mall', 'market',
  'general_store', 'flea_market', 'thrift_store',
  'drugstore', 'pharmacy', 'shipping_service', 'post_office', 'library',
  'home_improvement_store', 'hardware_store', 'building_materials_store', 'garden_center',
  'clothing_store', 'sporting_goods_store', 'home_goods_store', 'furniture_store',
  'book_store', 'gift_shop', 'toy_store', 'jewelry_store', 'shoe_store', 'pet_store',
  'florist', 'liquor_store', 'cosmetics_store', 'candy_store',
  'restaurant', 'cafe', 'coffee_shop', 'tea_house', 'bakery', 'donut_shop', 'ice_cream_shop',
  'sandwich_shop', 'deli', 'food', 'meal_takeaway', 'bar', 'wine_bar', 'pub',
  'bank', 'atm', 'finance', 'insurance_agency', 'real_estate_agency',
  'local_government_office', 'city_hall', 'courthouse',
  'bus_stop', 'transit_station', 'parking', 'parking_lot', 'parking_garage',
  'electric_vehicle_charging_station',
  'hotel', 'lodging', 'storage', 'apartment_complex', 'rv_park', 'mobile_home_park',
  'tourist_attraction', 'museum', 'school', 'primary_school', 'secondary_school',
  'educational_institution', 'sports_complex', 'bowling_alley', 'event_venue',
  'travel_agency', 'employment_agency', 'marketing_consultant', 'dentist',
]);

/** In the US, still trading, and something that could buy a website. */
export function keepPlace(place, row) {
  if (!row.name || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return false;
  if (component(place, 'country', 'shortText') !== 'US' || !row.state) return false;
  const t = place.primaryType || '';
  if (NOT_A_BUYER.has(t) || /_restaurant$|_house$/.test(t)) return false;
  return place.businessStatus !== 'CLOSED_PERMANENTLY';
}

// ---------------------------------------------------------------------------
// Is it already ours
// ---------------------------------------------------------------------------

const NAME_NOISE = new Set(['llc', 'inc', 'corp', 'corporation', 'co', 'company', 'the', 'of', 'and', 'ltd', 'pa']);

export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !NAME_NOISE.has(w))
    .join(' ');
}

/** "AutoGee LLC" and "Auto Gee llc" → "autogee": spacing and legal form aside. */
export function compactName(s) {
  return normName(s).replace(/ /g, '');
}

/** The last ten digits, or null when there aren't ten. */
export function normPhone(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : null;
}

const normCity = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/^saint/, 'st');

// The trade and the legal form: words that tell one shop from another not at
// all. A name made only of these ("Mobile Detailing", "Auto Repair LLC") is
// a description, and dozens of unrelated shops share it.
const TRADE_WORDS = new Set([
  'car', 'cars', 'auto', 'autos', 'automotive', 'mobile', 'detail', 'detailing', 'details', 'detailer', 'detailers',
  'wash', 'carwash', 'washing', 'hand', 'express', 'spa', 'tint', 'tinting', 'tints', 'window', 'windows', 'film',
  'ceramic', 'coating', 'coatings', 'ppf', 'wrap', 'wraps', 'paint', 'protection', 'wheel', 'wheels', 'rim', 'rims',
  'tire', 'tires', 'repair', 'repairs', 'mechanic', 'mechanics', 'service', 'services', 'shop', 'center', 'centre',
  'garage', 'care', 'clean', 'cleaning', 'pro', 'pros', 'professional', 'premium', 'quality', 'best', 'custom',
  'customs', 'solutions', 'body', 'collision', 'and', 'the', 'of', 'llc', 'inc', 'co', 'company', 'corp', 'by',
]);

/**
 * True when the name has at least one word that only this business would
 * use. Read through normName, so legal forms ("Ltd", "Corporation") never
 * count; initials do: "J&M" and "T J" join into "jm" and "tj", and "OG
 * Detailing" is as much a name as "Gloss Boss Detailing".
 */
export function hasDistinctiveWord(name) {
  return normName(name)
    .replace(/\b([a-z0-9]) (?=[a-z0-9]\b)/g, '$1')
    .split(' ')
    .some((w) => w.length >= 2 && !TRADE_WORDS.has(w));
}
const normState = (s) => String(s || '').trim().toUpperCase();

/**
 * "Is this place one of our open Pipeline leads". A shared phone is enough; a
 * shared name also needs the same zip, city, or to be standing within 200 m —
 * there is more than one "Elite Auto Spa".
 */
export function buildLeadMatcher(leads) {
  const byPhone = new Map();
  const byName = new Map();
  for (const l of leads) {
    const p = normPhone(l.phone);
    if (p && !byPhone.has(p)) byPhone.set(p, l);
    const n = normName(l.company_name);
    if (n.length < 4) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(l);
  }
  return (row) => {
    const p = normPhone(row.phone);
    if (p && byPhone.has(p)) return byPhone.get(p);
    if (!hasDistinctiveWord(row.name)) return null;
    for (const l of byName.get(normName(row.name)) || []) {
      if (l.zip && row.zip && String(l.zip).slice(0, 5) === String(row.zip).slice(0, 5)) return l;
      if (l.city && row.city && normCity(l.city) === normCity(row.city)) return l;
      if (Number.isFinite(l.lat) && Number.isFinite(l.lng) && haversineKm(l, row) <= 0.2) return l;
    }
    return null;
  };
}

/**
 * "Does this shop already have an account with us". Sure matches only — a
 * wrong one hides a lead from New — in order of certainty:
 *   the site was set up from this exact Google listing (googlePlace.placeId),
 *   the same phone number,
 *   the same name in the same town (or the same state, when the account
 *   never gave a town and the name is long enough to be nobody else's).
 * `accounts`: [{ userId, placeId, phones: [], name, city, state }]
 * Returns (row, notUserIds) => { userId, reason } | null.
 */
export function buildAccountMatcher(accounts) {
  const byPlace = new Map();
  const byPhone = new Map();
  const byName = new Map();
  for (const a of accounts) {
    if (a.placeId && !byPlace.has(a.placeId)) byPlace.set(a.placeId, a);
    for (const ph of a.phones || []) {
      const p = normPhone(ph);
      if (p && !byPhone.has(p)) byPhone.set(p, a);
    }
    const n = compactName(a.name);
    if (n.length < 5) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(a);
  }
  return (row, notUserIds = []) => {
    const ok = (a) => a && !notUserIds.includes(a.userId);
    const place = byPlace.get(row.place_id);
    if (ok(place)) return { userId: place.userId, reason: 'set up from this Google listing' };
    const p = normPhone(row.phone);
    const phone = p ? byPhone.get(p) : null;
    if (ok(phone)) return { userId: phone.userId, reason: 'same phone number' };
    // A name that is only the trade ("Mobile Detailing") matches nobody: the
    // Genius Routes matcher learned that from 74 unrelated "Car Wash" listings.
    if (!hasDistinctiveWord(row.name)) return null;
    for (const a of byName.get(compactName(row.name)) || []) {
      if (!ok(a)) continue;
      if (a.city && row.city && normCity(a.city) === normCity(row.city)) {
        return { userId: a.userId, reason: `same name in ${row.city}` };
      }
      if (!a.city && a.state && normState(a.state) === normState(row.state) && compactName(row.name).length >= 8) {
        return { userId: a.userId, reason: `same name in ${row.state}` };
      }
    }
    return null;
  };
}

/**
 * The ids of auth users who confirmed their email, or null when they can't
 * be listed (no service role, an API error). Since the signup names change
 * (20261005_profile_names_from_signup.sql) a profile carries the phone and
 * business typed on the signup form before the email is confirmed, and
 * whoever typed them may not own the inbox; an abandoned signup is a warm
 * lead, not a customer.
 */
export async function confirmedUserIds(db) {
  const list = db.auth?.admin?.listUsers;
  if (typeof list !== 'function') return null;
  const ids = new Set();
  try {
    for (let page = 1; page <= 50; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return null;
      const users = data?.users || [];
      for (const u of users) if (u.email_confirmed_at || u.confirmed_at) ids.add(u.id);
      if (users.length < 1000) return ids;
    }
  } catch {
    return null;
  }
  return ids;
}

/**
 * Every builder account a shop could already be: its sites (the business
 * info the wizard saved, with the Google listing it was set up from) and its
 * profile. Sites owned by an admin are left out: admins build demo and
 * custom sites for businesses that haven't bought anything yet. Unconfirmed
 * signups are left out too (confirmedUserIds); when confirmation can't be
 * checked, a profile without a site is left out rather than guessed at.
 */
export async function loadAccounts(db) {
  const profiles = await selectAll(db, 'profiles', 'id, phone, business_name, is_super_admin');
  const admins = new Set(profiles.filter((p) => p.is_super_admin).map((p) => p.id));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const confirmed = await confirmedUserIds(db);
  const counts = (id) => (confirmed ? confirmed.has(id) : null);
  const sites = await selectAll(db, 'sites', 'id, user_id, business_info');
  const accounts = [];
  for (const s of sites) {
    if (!s.user_id || admins.has(s.user_id) || counts(s.user_id) === false) continue;
    const bi = s.business_info || {};
    accounts.push({
      userId: s.user_id,
      placeId: bi.googlePlace?.placeId || null,
      phones: [bi.phone, byId.get(s.user_id)?.phone],
      name: bi.businessName || byId.get(s.user_id)?.business_name || '',
      city: bi.city || '',
      state: bi.state || '',
    });
  }
  for (const p of profiles) {
    if (admins.has(p.id) || counts(p.id) !== true) continue;
    accounts.push({ userId: p.id, placeId: null, phones: [p.phone], name: p.business_name || '', city: '', state: '' });
  }
  return accounts;
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

const FIELDS = [
  'places.id', 'places.displayName', 'places.addressComponents', 'places.location',
  'places.types', 'places.primaryType', 'places.primaryTypeDisplayName', 'places.businessStatus',
  'places.nationalPhoneNumber', 'places.websiteUri', 'places.rating', 'places.userRatingCount',
  'nextPageToken',
].join(',');

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

export class PlacesFatalError extends Error {}

/**
 * A key problem stops everything: no search after it can succeed. Google
 * answers a disabled API or a restricted key with 401/403, but a key that
 * doesn't exist (or was deleted) with a 400 INVALID_ARGUMENT, "API key not
 * valid"; read as an ordinary bad request, that one was skipped search by
 * search until the scan ran out of searches.
 */
export function isKeyError(status, text) {
  return status === 401 || status === 403
    || (status === 400 && /API key not valid|API_KEY_INVALID/i.test(String(text || '')));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => sleep(Math.min(30000, 2000 * 2 ** attempt));

/**
 * One page of a Text Search. Retries a rate limit, a server error and a
 * dropped connection; a key problem stops the scan.
 */
export async function searchPage({ fetchImpl, apiKey, query, rect, pageToken }) {
  const body = { textQuery: query, pageSize: 20, locationRestriction: { rectangle: rect } };
  if (pageToken) body.pageToken = pageToken;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let res;
    try {
      res = await fetchImpl(SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
        body: JSON.stringify(body),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // A reset socket or a truncated body. Without this one blip dropped a
      // whole search and every quarter-search under it.
      if (attempt === 5) throw e;
      await backoff(attempt);
      continue;
    }
    const text = await res.text().catch(() => '');
    if (res.status === 429 || res.status >= 500) { await backoff(attempt); continue; }
    if (isKeyError(res.status, text)) {
      throw new PlacesFatalError(`Google Places refused the key (${res.status}): ${text.slice(0, 200)}`);
    }
    // A page token Google isn't ready to honour yet reads as a bad argument.
    if (res.status === 400 && pageToken && attempt < 2) { await sleep(1500); continue; }
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 200)}`);
  }
  throw new Error('Google Places kept rate-limiting');
}

/**
 * What the admin typed ("Kissimmee, FL", "34744", "Ocala") as a point and a
 * label, from one Text Search. Done when the scan is claimed, so a typo is
 * an error on the spot rather than a failed background run.
 * Returns { label, lat, lng } or null when Google doesn't know the place.
 */
export async function resolveArea({ fetchImpl, apiKey, text }) {
  const res = await fetchImpl(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: text, pageSize: 1, regionCode: 'US' }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (isKeyError(res.status, detail)) {
      throw new PlacesFatalError(`Google Places refused the key (${res.status}): ${detail.slice(0, 200)}`);
    }
    throw new Error(`Google Places ${res.status}: ${detail.slice(0, 200)}`);
  }
  const place = (await res.json()).places?.[0];
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label: place.formattedAddress || place.displayName?.text || text, lat, lng };
}

/**
 * Spaces calls out so they never start closer than `ms` apart, however many
 * workers are waiting. Google's default Text Search quota is 600 a minute.
 */
export function pacer(ms) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + ms;
    if (at > now) await sleep(at - now);
  };
}

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i];
      i += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** PostgREST hands back at most 1,000 rows a request. */
async function selectAll(db, table, cols, build = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(db.from(table).select(cols)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

// ---------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------

/**
 * Search one area and write what it finds. Returns what it did.
 *
 * maxRequests is a hard ceiling on paid Places calls: a bug in the splitting
 * could otherwise spend real money. deadlineMs is the same idea for time: a
 * Netlify background function is killed at 15 minutes, and a scan killed
 * before it writes has paid for nothing. Either way the scan stops searching,
 * sets `capped`, and writes what it has.
 *
 * Searches run breadth-first: every type once, then the quarter splits of
 * the ones that came back full, then theirs. So a ceiling trims the deepest
 * digging, not whole types at the end of the list.
 */
export async function runScan({
  db, apiKey, fetchImpl = fetch, log = () => {},
  center, radiusMi, categories, areaLabel = null, scanId = null,
  maxRequests = MAX_SCAN_REQUESTS, deadlineMs = null, concurrency = 4, paceMs = 110,
  categoryList = LEAD_CATEGORIES,
}) {
  if (!apiKey) throw new Error('No Google Places key');
  const deadline = deadlineMs ? Date.now() + deadlineMs : Infinity;
  const stats = {
    requests: 0, answered: 0, found: 0, kept: 0, written: 0, added: 0, matched: 0, piped: 0, skipped: 0,
    capped: false, timedOut: false,
  };
  let skipError = null;
  const pace = pacer(paceMs);

  // 1. The searches.
  const rect = rectAround(center.lat, center.lng, radiusMi * KM_PER_MILE);
  const jobs = [];
  for (const cat of categoryList) {
    if (!categories.includes(cat.key)) continue;
    for (const query of cat.queries) jobs.push({ cat, query, rect, depth: depthFor(cat, radiusMi) });
  }
  log(`${jobs.length} searches around ${areaLabel || `${center.lat},${center.lng}`} (${radiusMi} mi)`);

  const places = new Map(); // place_id -> row
  let fatal = null;

  /** One search, every page. True when Google ran out of pages before places. */
  async function run(job) {
    if (fatal) return false;
    let token = null;
    let got = 0;
    for (let page = 0; page < 3; page += 1) {
      if (stats.requests >= maxRequests) { stats.capped = true; return false; }
      if (Date.now() >= deadline) { stats.capped = true; stats.timedOut = true; return false; }
      stats.requests += 1;
      let data;
      try {
        await pace();
        data = await searchPage({ fetchImpl, apiKey, query: job.query, rect: job.rect, pageToken: token });
      } catch (e) {
        if (e instanceof PlacesFatalError) fatal = e;
        else { stats.skipped += 1; skipError = e.message; log(`skip "${job.query}": ${e.message}`); }
        return false;
      }
      stats.answered += 1;
      for (const place of data.places || []) {
        got += 1;
        stats.found += 1;
        if (places.has(place.id)) continue;
        const row = toRow(place, classify(place, job.cat.key));
        if (keepPlace(place, row)) places.set(place.id, row);
      }
      token = data.nextPageToken;
      if (!token) break;
    }
    // Every page full means Google stopped, not the businesses: it never
    // offers a fourth.
    return got >= 60;
  }

  for (let level = jobs; level.length && !fatal;) {
    const deeper = [];
    await pool(level, concurrency, async (job) => {
      if (await run(job) && job.depth > 0) {
        for (const r of quarters(job.rect)) deeper.push({ ...job, rect: r, depth: job.depth - 1 });
      }
    });
    level = deeper;
  }
  if (fatal) throw fatal;
  // Every search failed (quota used up, Google down): "0 businesses found"
  // would read as an empty area. Fail the scan and say why instead.
  if (stats.skipped > 0 && stats.answered === 0) {
    throw new Error(`Google Maps refused all ${stats.skipped} searches: ${String(skipError || '').slice(0, 300)}`);
  }
  stats.kept = places.size;
  log(`${stats.requests} Places calls, ${stats.kept} businesses kept`);

  // 2. Write. Upsert on place_id carries only what Google said (plus where and
  // when we saw it), so an admin's verdict (piped, not a fit) and an account
  // match survive every rescan.
  const now = new Date().toISOString();
  const rows = [...places.values()].map((row) => ({ ...row, area: areaLabel, scan_id: scanId, last_seen_at: now }));
  const before = await db.from('sales_prospects').select('id', { count: 'exact', head: true });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('sales_prospects').upsert(rows.slice(i, i + 500), { onConflict: 'place_id' });
    if (error) throw new Error(`sales_prospects upsert: ${error.message}`);
    stats.written += Math.min(500, rows.length - i);
  }
  const after = await db.from('sales_prospects').select('id', { count: 'exact', head: true });
  stats.added = Math.max(0, (after.count || 0) - (before.count || 0));

  // 3. A business somebody already put in the Pipeline by hand shows as In
  // Pipeline, not New. Guarded on the row still being untouched: an admin may
  // have decided on it since the read, and theirs is the decision that stands.
  const leads = await selectAll(db, 'sales_leads', 'id, company_name, phone, city, zip, lat, lng, owner_id',
    (q) => q.is('archived_at', null));
  const isLead = buildLeadMatcher(leads);
  const fresh = await selectAll(db, 'sales_prospects', 'id, name, phone, city, zip, lat, lng',
    (q) => q.eq('status', 'new').is('lead_id', null));
  for (const p of fresh) {
    const l = isLead(p);
    if (!l) continue;
    const { data } = await db.from('sales_prospects')
      .update({ status: 'piped', lead_id: l.id, status_by: l.owner_id ?? null, status_at: now })
      .eq('id', p.id).eq('status', 'new').is('lead_id', null)
      .select('id');
    if (!data?.length) continue;
    stats.piped += 1;
    // The thread written on the Leads tab goes onto the lead, as Add to
    // Pipeline does; notes added from now on are copied by the database.
    const { data: notes } = await db.from('sales_prospect_notes')
      .select('author_id, body, created_at').eq('prospect_id', p.id);
    if (notes?.length) {
      const { error } = await db.from('sales_lead_notes').insert(notes.map((n) => ({
        lead_id: l.id, author_id: n.author_id, body: String(n.body).slice(0, 4000), created_at: n.created_at,
      })));
      if (error) log(`notes for ${p.id} not copied: ${error.message}`);
    }
  }

  // 4. Already has an account? Checked over every unmatched business, not
  // just this scan's: a shop found last month may have signed up since.
  const isAccount = buildAccountMatcher(await loadAccounts(db));
  const unmatched = await selectAll(db, 'sales_prospects', 'id, place_id, name, phone, city, state, not_user_ids',
    (q) => q.is('match_user_id', null));
  for (const p of unmatched) {
    const m = isAccount(p, p.not_user_ids || []);
    if (!m) continue;
    const { data } = await db.from('sales_prospects')
      .update({ match_user_id: m.userId, match_reason: m.reason })
      .eq('id', p.id).is('match_user_id', null)
      .select('id');
    if (data?.length) stats.matched += 1;
  }

  log(`written ${stats.written} (${stats.added} new), ${stats.matched} have an account, ${stats.piped} already in the Pipeline`);
  return stats;
}

// ---------------------------------------------------------------------------
// Scan bookkeeping
// ---------------------------------------------------------------------------

const TABLE = 'sales_prospect_scans';

/** An unfinished scan older than this is taken to have died (Netlify stops at 15 min). */
export const STALE_SCAN_MS = 20 * 60 * 1000;
/** A claim nobody started within this long was dropped by the browser. */
export const UNSTARTED_SCAN_MS = 2 * 60 * 1000;

export class ScanRunningError extends Error {}

/**
 * Close scans that can't still be running, or they would block every scan
 * after them (the one-running index allows a single unfinished row).
 */
export async function closeDeadScans(db, now = Date.now()) {
  const at = new Date(now).toISOString();
  await db.from(TABLE)
    .update({ finished_at: at, error: 'Never finished: the function stopped.' })
    .is('finished_at', null)
    .lt('started_at', new Date(now - STALE_SCAN_MS).toISOString());
  await db.from(TABLE)
    .update({ finished_at: at, error: 'Never started.' })
    .is('finished_at', null)
    .is('run_started_at', null)
    .lt('started_at', new Date(now - UNSTARTED_SCAN_MS).toISOString());
}

/**
 * Claim a scan: one row, unfinished. The database refuses a second
 * unfinished row however close together two presses land.
 */
export async function claimScan(db, { areaQuery, area, radiusMi, categories, requestedBy }) {
  await closeDeadScans(db);
  const { data, error } = await db.from(TABLE).insert({
    area_query: areaQuery,
    area_label: area.label,
    center_lat: area.lat,
    center_lng: area.lng,
    radius_mi: radiusMi,
    categories,
    requested_by: requestedBy,
  }).select('*').single();
  if (error?.code === '23505') throw new ScanRunningError('A scan is already running');
  if (error) throw new Error(`${TABLE}: ${error.message}`);
  return data;
}

/**
 * Run a claimed scan, once: run_started_at is set by the first caller only,
 * so a retried request can't start a second paid run. The row then gets the
 * counts, or the error, so the page can say what happened.
 * Returns { status, stats? }.
 */
export async function runClaimedScan({ db, scanId, ...opts }) {
  const { data: taken } = await db.from(TABLE)
    .update({ run_started_at: new Date().toISOString() })
    .eq('id', scanId).is('finished_at', null).is('run_started_at', null)
    .select('*');
  const scan = taken?.[0];
  if (!scan) return { status: 409 };
  try {
    const stats = await runScan({
      db,
      ...opts,
      center: { lat: Number(scan.center_lat), lng: Number(scan.center_lng) },
      radiusMi: Number(scan.radius_mi),
      categories: scan.categories || [],
      areaLabel: `${scan.area_label} · ${Number(scan.radius_mi)} mi`,
      scanId: scan.id,
    });
    await db.from(TABLE).update({
      finished_at: new Date().toISOString(),
      requests: stats.requests,
      found: stats.kept,
      added: stats.added,
      matched: stats.matched,
      capped: stats.capped,
      skipped: stats.skipped,
    }).eq('id', scan.id);
    return { status: 200, stats };
  } catch (e) {
    await db.from(TABLE).update({
      finished_at: new Date().toISOString(),
      error: String(e?.message || e).slice(0, 500),
    }).eq('id', scan.id);
    return { status: 500, error: e?.message };
  }
}
