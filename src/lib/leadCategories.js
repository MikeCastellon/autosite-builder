// Who might buy a website from us, as Google Maps searches.
//
// Shared by Admin > Leads (labels, filters, map colours, the cost estimate)
// and the scanner that fills it (netlify/functions/_lib/leadScan.js), so a
// type can't exist on one side and not the other. Keys are the builder's own
// business types (src/data/businessTypes.js), so a lead carries straight
// into a site or a custom website project.
//
// `depth` is how hard the scanner digs where a search comes back full. Google
// returns at most 60 places per search (3 pages of 20); a full answer is
// split into quarters and asked again, up to `depth` times. Mechanics and
// detailers are dense enough to need it; wheel shops never fill a page.

export const LEAD_CATEGORIES = [
  {
    key: 'detailing_shop',
    label: 'Detailing shops',
    queries: ['auto detailing'],
    depth: 2,
    color: '#16a34a',
  },
  {
    key: 'mobile_detailing',
    label: 'Mobile detailing',
    queries: ['mobile detailing'],
    depth: 1,
    color: '#0d9488',
  },
  {
    key: 'tint_shop',
    label: 'Tint, PPF & wraps',
    queries: ['window tinting', 'paint protection film ceramic coating', 'vehicle wraps'],
    depth: 1,
    color: '#7c3aed',
  },
  {
    key: 'wheel_shop',
    label: 'Wheel shops',
    queries: ['wheel repair', 'custom wheels and rims'],
    depth: 0,
    color: '#ea580c',
  },
  {
    key: 'mechanic_shop',
    label: 'Mechanics',
    queries: ['auto repair'],
    depth: 1,
    color: '#78716c',
  },
  {
    key: 'car_wash',
    label: 'Car washes',
    queries: ['car wash'],
    depth: 1,
    color: '#0891b2',
  },
];

export const CATEGORY_KEYS = LEAD_CATEGORIES.map((c) => c.key);

const LABELS = Object.fromEntries(LEAD_CATEGORIES.map((c) => [c.key, c.label]));
const COLORS = Object.fromEntries(LEAD_CATEGORIES.map((c) => [c.key, c.color]));

/** A key we don't know (an old scan, a renamed type) still reads. */
export function categoryLabel(key) {
  return LABELS[key] || 'Other';
}

export function categoryColor(key) {
  return COLORS[key] || '#888888';
}

export const RADIUS_OPTIONS = [5, 10, 25, 50];

/**
 * How deep a search may split. A 5-mile square that comes back full is a
 * dense town worth one more look; a 50-mile one is a whole metro and gets two.
 * Never deeper than the type itself allows.
 */
export function depthFor(category, radiusMi) {
  return Math.min(category.depth || 0, radiusMi >= 25 ? 2 : 1);
}

/** Hard ceiling on paid Places calls per scan, enforced by the scanner. */
export const MAX_SCAN_REQUESTS = 600;

/**
 * Text Search with phone, website and rating fields bills at Google's
 * Enterprise rate: $35 per 1,000 calls before the monthly free allowance.
 */
export const COST_PER_REQUEST = 0.035;

/**
 * What a scan could cost, before anyone presses Start: the least it can
 * spend (every search once, every page) and the most (every split taken, up
 * to the ceiling).
 */
export function estimateScan({ radiusMi = 10, categories = CATEGORY_KEYS } = {}) {
  let min = 0;
  let max = 0;
  for (const cat of LEAD_CATEGORIES) {
    if (!categories.includes(cat.key)) continue;
    const depth = depthFor(cat, radiusMi);
    for (let q = 0; q < cat.queries.length; q += 1) {
      min += 1;
      // 3 pages per search; each level of splitting asks four times as many.
      let searches = 0;
      for (let d = 0; d <= depth; d += 1) searches += 4 ** d;
      max += 3 * searches;
    }
  }
  max = Math.min(max, MAX_SCAN_REQUESTS);
  return {
    minRequests: min,
    maxRequests: max,
    minCost: min * COST_PER_REQUEST,
    maxCost: max * COST_PER_REQUEST,
  };
}
