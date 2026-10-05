// Admin > Leads: lists, chains, website filters, sorts and the scan estimate.
import { describe, it, expect } from 'vitest';
import {
  areaOptions, brandKey, bucketCounts, bucketOf, chainCounts, chainSize, filterProspects, isScanRunning,
  mapsUrl, siteHref, sortProspects,
} from './prospectFilters.js';
import { MAX_SCAN_REQUESTS, estimateScan } from './leadCategories.js';

const p = (over) => ({
  id: 'p', name: 'Shop', category: 'detailing_shop', website_kind: 'none', status: 'new',
  match_user_id: null, rating: null, rating_count: 0, ...over,
});

describe('lists', () => {
  it('puts an account match first, whatever its status', () => {
    expect(bucketOf(p({ match_user_id: 'u1', status: 'piped' }))).toBe('account');
    expect(bucketOf(p({ status: 'piped' }))).toBe('piped');
    expect(bucketOf(p({ status: 'dismissed' }))).toBe('dismissed');
    expect(bucketOf(p())).toBe('new');
    expect(bucketCounts([p(), p({ status: 'piped' }), p({ match_user_id: 'u' })])).toEqual({ new: 1, piped: 1, account: 1, dismissed: 0 });
  });
});

describe('chains', () => {
  it('counts brands with three or more locations, but not names that are just the trade', () => {
    const rows = [
      p({ name: 'Tint World - Kissimmee' }), p({ name: 'Tint World | Orlando' }), p({ name: 'Tint World' }),
      p({ name: 'Car Wash' }), p({ name: 'Car Wash' }), p({ name: 'Car Wash' }),
      p({ name: 'Gloss Boss' }),
    ];
    expect(brandKey('Tint World - Kissimmee')).toBe('tint world');
    const counts = chainCounts(rows);
    expect(chainSize(rows[0], counts)).toBe(3);
    expect(chainSize(rows[3], counts)).toBe(0);
    expect(chainSize(rows[6], counts)).toBe(0);
  });
});

describe('filterProspects / sortProspects', () => {
  const rows = [
    p({ id: 'a', name: 'Alpha Detail', website_kind: 'none', rating: 4.9, rating_count: 3, area: 'Kissimmee · 10 mi', city: 'Kissimmee' }),
    p({ id: 'b', name: 'Bravo Tint', category: 'tint_shop', website_kind: 'social', rating: 4.5, rating_count: 120, area: 'Ocala · 10 mi' }),
    p({ id: 'c', name: 'Charlie Wash', category: 'car_wash', website_kind: 'own', rating: 4.7, rating_count: 40, area: 'Kissimmee · 10 mi', chain: 4 }),
  ];

  it('filters by website, type, area, chains and search', () => {
    const ids = (opts) => filterProspects(rows, opts).map((r) => r.id);
    expect(ids({ website: 'needs' })).toEqual(['a', 'b']);
    expect(ids({ website: 'own' })).toEqual(['c']);
    expect(ids({ category: 'tint_shop' })).toEqual(['b']);
    expect(ids({ area: 'Kissimmee · 10 mi' })).toEqual(['a', 'c']);
    expect(ids({ hideChains: true })).toEqual(['a', 'b']);
    expect(ids({ search: 'kissim' })).toEqual(['a']);
  });

  it('sorts by reviews, by rating (five reviews to rank), and by name', () => {
    expect(sortProspects(rows, 'reviews').map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(sortProspects(rows, 'rating').map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(sortProspects(rows, 'name').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('lists the scanned areas, newest first', () => {
    expect(areaOptions([
      p({ area: 'Ocala · 10 mi', last_seen_at: '2026-10-01T00:00:00Z' }),
      p({ area: 'Kissimmee · 10 mi', last_seen_at: '2026-10-04T00:00:00Z' }),
      p({ area: null }),
    ])).toEqual(['Kissimmee · 10 mi', 'Ocala · 10 mi']);
  });
});

describe('scans', () => {
  it('treats an unfinished scan as running for 20 minutes only', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    const running = { run_started_at: '2026-10-05T11:30:01Z', finished_at: null };
    expect(isScanRunning({ ...running, started_at: '2026-10-05T11:55:00Z' }, now)).toBe(true);
    expect(isScanRunning({ ...running, started_at: '2026-10-05T11:30:00Z' }, now)).toBe(false);
    expect(isScanRunning({ started_at: '2026-10-05T11:55:00Z', finished_at: '2026-10-05T11:58:00Z' }, now)).toBe(false);
    expect(isScanRunning(null, now)).toBe(false);
    // A claim the background function never took is dead after 2 minutes, as on the server.
    expect(isScanRunning({ started_at: '2026-10-05T11:59:00Z', run_started_at: null, finished_at: null }, now)).toBe(true);
    expect(isScanRunning({ started_at: '2026-10-05T11:57:00Z', run_started_at: null, finished_at: null }, now)).toBe(false);
    expect(isScanRunning({ started_at: '2026-10-05T11:57:00Z', run_started_at: '2026-10-05T11:57:01Z', finished_at: null }, now)).toBe(true);
  });

  it('estimates the least and the most a scan can spend, capped', () => {
    // Car washes: 1 query, splits once at 10 mi → 1..15 lookups.
    expect(estimateScan({ radiusMi: 10, categories: ['car_wash'] })).toMatchObject({ minRequests: 1, maxRequests: 15 });
    // Detailing shops dig two levels only from 25 mi out → 3 × (1 + 4 + 16).
    expect(estimateScan({ radiusMi: 25, categories: ['detailing_shop'] }).maxRequests).toBe(63);
    expect(estimateScan({ radiusMi: 50 }).maxRequests).toBeLessThanOrEqual(MAX_SCAN_REQUESTS);
    expect(estimateScan({ radiusMi: 10, categories: [] }).minRequests).toBe(0);
  });
});

describe('links', () => {
  it('opens Google Maps on the place itself, and makes websites clickable', () => {
    const u = new URL(mapsUrl(p({ name: 'Shop', city: 'Ocala', place_id: 'gp1' })));
    expect(u.searchParams.get('query_place_id')).toBe('gp1');
    expect(siteHref('example.com')).toBe('https://example.com');
    expect(siteHref('http://x.com')).toBe('http://x.com');
    expect(siteHref('')).toBeNull();
  });
});
