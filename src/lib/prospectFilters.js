// The Leads tab's arithmetic: which list a business belongs on, chains, and
// the filters and sorts over all of it. Pure, so the tab stays a layout and
// this stays testable. Ported from Genius Routes (src/lib/prospectFilters.js),
// minus distance-to-route (we have no routes) plus the website question
// (the whole reason a shop is a lead for us).

// ─── Lists ────────────────────────────────────────────────────────────

/**
 * Which list a business belongs on. An account match wins over everything:
 * a shop that already has an account with us is never a cold lead, whatever
 * its status says.
 */
export function bucketOf(p) {
  if (p.match_user_id) return 'account';
  if (p.status === 'piped') return 'piped';
  if (p.status === 'dismissed') return 'dismissed';
  return 'new';
}

export const BUCKETS = [
  { id: 'new', label: 'New' },
  { id: 'piped', label: 'In Pipeline' },
  { id: 'account', label: 'Have an account' },
  { id: 'dismissed', label: 'Not a fit' },
];

export function bucketCounts(rows) {
  const counts = { new: 0, piped: 0, account: 0, dismissed: 0 };
  for (const p of rows) counts[bucketOf(p)] += 1;
  return counts;
}

// "Other" is added by the dialog, which then insists on a note.
export const DISMISS_REASONS = [
  'Closed or gone',
  'Chain, head office handles it',
  'Already has a good website',
  'Duplicate listing',
];

// ─── Websites ─────────────────────────────────────────────────────────

export const WEBSITE_KINDS = {
  none: { label: 'No website', short: 'No site', tone: 'hot' },
  social: { label: 'Social page only', short: 'Social only', tone: 'warm' },
  builder: { label: 'Site-builder page', short: 'Site builder', tone: 'mild' },
  own: { label: 'Own site', short: 'Has a site', tone: 'cold' },
};

export const WEBSITE_FILTERS = [
  { key: '', label: 'Any website' },
  { key: 'needs', label: 'No real website', hint: 'No site, or only a social page' },
  { key: 'none', label: 'No website' },
  { key: 'social', label: 'Social page only' },
  { key: 'builder', label: 'Site-builder page' },
  { key: 'own', label: 'Own site' },
];

function websiteMatches(kind, filter) {
  if (!filter) return true;
  if (filter === 'needs') return kind === 'none' || kind === 'social';
  return kind === filter;
}

// ─── Chains ───────────────────────────────────────────────────────────

/** "Tint World - Kissimmee" and "Tint World" are one brand. */
export function brandKey(name) {
  return String(name || '')
    .split(/\s[-|–—]\s|\s@\s|#/)[0]
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(llc|inc|corp|co|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Brands with CHAIN_MIN or more locations on the list. A franchise gets its
 * website from head office, so an admin can hide them and see who can say
 * yes on the spot.
 */
export const CHAIN_MIN = 3;

// Names that are just the trade, not a brand: dozens of unrelated shops are
// called "Car Wash" on Google, and hiding them as a chain would hide exactly
// the independents the toggle is for.
const GENERIC_NAME = /^(?:(?:hand|express|mobile|auto|the|a|best|quick)\s+)*(?:car ?wash|body shop|tire shop|tires|auto repair|auto body|auto shop|auto detailing|car detailing|detailing|mobile detailing|window tint(?:ing)?|wheel repair|mechanic)$/;

export function isGenericBrand(key) {
  return String(key || '').length < 3 || GENERIC_NAME.test(key);
}

export function chainCounts(prospects) {
  const counts = new Map();
  for (const p of prospects) {
    const k = brandKey(p.name);
    if (isGenericBrand(k)) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

export function chainSize(p, counts) {
  const n = counts.get(brandKey(p.name)) || 0;
  return n >= CHAIN_MIN ? n : 0;
}

// ─── Filter and sort ──────────────────────────────────────────────────

export const SORTS = [
  { key: 'reviews', label: 'Most reviews', hint: 'Busiest shops first' },
  { key: 'rating', label: 'Best rated' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'newest', label: 'Newest found' },
];

/**
 * Everything but the list tab, so the tab counts come from the same result
 * the list is cut from.
 */
export function filterProspects(rows, {
  search = '', category = '', website = '', area = '', hideChains = false, chains = null,
} = {}) {
  const q = search.trim().toLowerCase();
  const out = [];
  for (const p of rows) {
    if (category && p.category !== category) continue;
    if (!websiteMatches(p.website_kind || 'none', website)) continue;
    if (area && p.area !== area) continue;
    // p.chain is worked out once per load by the tab; `chains` is the fallback.
    if (hideChains && (p.chain ?? (chains ? chainSize(p, chains) : 0))) continue;
    if (q) {
      const hay = `${p.name} ${p.address || ''} ${p.city || ''} ${p.county || ''} ${p.zip || ''} ${p.google_type || ''} ${p.phone || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(p);
  }
  return out;
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name));

export function sortProspects(rows, sort = 'reviews') {
  const list = [...rows];
  if (sort === 'name') return list.sort(byName);
  if (sort === 'newest') {
    return list.sort((a, b) => Date.parse(b.first_seen_at || 0) - Date.parse(a.first_seen_at || 0) || byName(a, b));
  }
  if (sort === 'rating') {
    // A single five-star review isn't "best rated". Five or more to rank.
    const score = (p) => ((p.rating_count || 0) >= 5 ? Number(p.rating) || 0 : 0);
    return list.sort((a, b) => score(b) - score(a) || (b.rating_count || 0) - (a.rating_count || 0) || byName(a, b));
  }
  return list.sort((a, b) => (b.rating_count || 0) - (a.rating_count || 0) || byName(a, b));
}

/** The areas past scans covered, newest first, for the Area filter. */
export function areaOptions(prospects) {
  const latest = new Map();
  for (const p of prospects) {
    if (!p.area) continue;
    const at = Date.parse(p.last_seen_at || 0) || 0;
    if (!latest.has(p.area) || at > latest.get(p.area)) latest.set(p.area, at);
  }
  return [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([area]) => area);
}

// ─── Scans ────────────────────────────────────────────────────────────

/** The limits the server uses (STALE_SCAN_MS, UNSTARTED_SCAN_MS) to call an unfinished scan dead. */
const SCAN_STALE_MS = 20 * 60 * 1000;
const SCAN_UNSTARTED_MS = 2 * 60 * 1000;

/**
 * A scan that never wrote finished_at is only "running" for 20 minutes:
 * Netlify kills the function at 15, and a dead row must not keep the tab
 * polling and saying "running" forever. A claim the background function
 * never took (run_started_at still empty) is dead after 2 minutes, the same
 * as leads-admin treats it, so the Scan button comes back.
 */
export function isScanRunning(scan, now = Date.now()) {
  if (!scan || scan.finished_at) return false;
  const age = now - Date.parse(scan.started_at);
  if (!scan.run_started_at && age >= SCAN_UNSTARTED_MS) return false;
  return age < SCAN_STALE_MS;
}

/** Google Maps, opened on the business itself rather than a search near it. */
export function mapsUrl(p) {
  const u = new URL('https://www.google.com/maps/search/');
  u.searchParams.set('api', '1');
  u.searchParams.set('query', [p.name, p.address, p.city, p.state].filter(Boolean).join(', '));
  if (p.place_id) u.searchParams.set('query_place_id', p.place_id);
  return u.toString();
}

/** A website as a link, whatever Google stored ("example.com" or a full URL). */
export function siteHref(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
