import { describe, it, expect } from 'vitest';
import { rangeToDates, loadRecentBookings, loadOwnerSites, pickShareSite, overviewMode } from './overview.js';

describe('rangeToDates', () => {
  const now = new Date('2026-06-30T00:00:00.000Z');
  it('30 days → since 30d back, prev window another 30d back', () => {
    const { since, prevSince } = rangeToDates(30, now);
    expect(since).toBe('2026-05-31T00:00:00.000Z');
    expect(prevSince).toBe('2026-05-01T00:00:00.000Z');
  });
  it('7 days', () => {
    expect(rangeToDates(7, now).since).toBe('2026-06-23T00:00:00.000Z');
  });
  it("'all' → epoch for both bounds", () => {
    const r = rangeToDates('all', now);
    expect(r.since).toBe('1970-01-01T00:00:00.000Z');
    expect(r.prevSince).toBe('1970-01-01T00:00:00.000Z');
  });
});

// Chainable stand-in for supabase.from(table): records filters, resolves `result`.
function fakeClient(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, eq: [] };
      calls.push(call);
      const b = {
        select() { return b; },
        eq(col, val) { call.eq.push([col, val]); return b; },
        order() { return b; },
        limit() { return b; },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return b;
    },
  };
}

describe('owner-scoped Overview queries', () => {
  it('recent bookings filter by owner_user_id', async () => {
    const client = fakeClient({ data: [{ status: 'pending' }], error: null });
    const rows = await loadRecentBookings('owner-1', client);
    expect(rows).toEqual([{ status: 'pending' }]);
    expect(client.calls).toEqual([{ table: 'bookings', eq: [['owner_user_id', 'owner-1']] }]);
  });

  it('sites filter by user_id', async () => {
    const client = fakeClient({ data: null, error: null });
    expect(await loadOwnerSites('owner-1', client)).toEqual([]);
    expect(client.calls).toEqual([{ table: 'sites', eq: [['user_id', 'owner-1']] }]);
  });

  it('query errors are thrown, not turned into empty lists', async () => {
    const err = { message: 'network' };
    await expect(loadOwnerSites('owner-1', fakeClient({ data: null, error: err }))).rejects.toBe(err);
    await expect(loadRecentBookings('owner-1', fakeClient({ data: null, error: err }))).rejects.toBe(err);
  });
});

describe('overviewMode', () => {
  it('never shows onboarding while loading or after an error', () => {
    expect(overviewMode('loading', 0)).toBe('loading');
    expect(overviewMode('error', 0)).toBe('error');
  });
  it('onboarding only for a loaded, empty account', () => {
    expect(overviewMode('ready', 0)).toBe('onboarding');
    expect(overviewMode('ready', 2)).toBe('ready');
  });
});

describe('pickShareSite', () => {
  it('prefers the booking-only page, then a website with booking on', () => {
    const web = { site_type: 'website', scheduler_enabled: true };
    const booking = { site_type: 'booking_only', scheduler_enabled: false };
    expect(pickShareSite([web, booking])).toBe(booking);
    expect(pickShareSite([web])).toBe(web);
    expect(pickShareSite([{ site_type: 'website', scheduler_enabled: false }])).toBeNull();
    expect(pickShareSite(null)).toBeNull();
  });
});
