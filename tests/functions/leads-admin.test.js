// tests/functions/leads-admin.test.js
//
// Admin > Leads: claiming a scan (leads-admin) and running it
// (leads-scan-background). Supabase is an in-memory fake that understands
// the query chains these functions use; Google is a stubbed fetch.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const { handler } = await import('../../netlify/functions/leads-admin.js');
const { handler: backgroundHandler } = await import('../../netlify/functions/leads-scan-background.js');

const ADMIN = { id: 'admin-1', email: 'dev@example.com' };
const OWNER = { id: 'owner-1', email: 'owner@example.com' };

function fakeDb({ scans = [] } = {}) {
  const state = {
    profiles: [
      { id: ADMIN.id, email: ADMIN.email, is_super_admin: true },
      { id: OWNER.id, email: OWNER.email, is_super_admin: false },
    ],
    sales_prospect_scans: structuredClone(scans),
    sales_prospects: [],
    sales_leads: [],
    sites: [],
  };

  function from(table) {
    const q = { filters: [], op: 'select', payload: null, head: false, single: false };
    const rows = () => state[table] || (state[table] = []);
    const match = () => rows().filter((r) => q.filters.every((f) => f(r)));
    const run = () => {
      if (q.op === 'insert') {
        if (table === 'sales_prospect_scans' && rows().some((r) => !r.finished_at)) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        const row = { id: `scan-${rows().length + 1}`, started_at: new Date().toISOString(), run_started_at: null, finished_at: null, ...q.payload };
        rows().push(row);
        return { data: { ...row }, error: null };
      }
      if (q.op === 'update') {
        const hit = match();
        hit.forEach((r) => Object.assign(r, q.payload));
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (q.head) return { count: rows().length, error: null };
      const hits = match().map((r) => ({ ...r }));
      return q.single ? { data: hits[0] ?? null, error: null } : { data: hits, error: null };
    };
    const api = {
      select(_c, opts) { if (opts?.head) q.head = true; return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      async upsert(list) { for (const r of list) rows().push({ id: `pr-${rows().length + 1}`, status: 'new', ...r }); return { error: null }; },
      eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
      is(c, v) { q.filters.push((r) => (r[c] ?? null) === v); return api; },
      lt(c, v) { q.filters.push((r) => r[c] != null && r[c] < v); return api; },
      range(a, z) { return Promise.resolve({ data: match().slice(a, z + 1).map((r) => ({ ...r })), error: null }); },
      single() { q.single = true; return Promise.resolve(run()); },
      maybeSingle() { q.single = true; return Promise.resolve(run()); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return api;
  }
  return { from, state };
}

const post = (body) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) });
const bodyOf = (res) => JSON.parse(res.body);

/** Google: the area lookup answers with Kissimmee; searches with one car wash. */
function googleFetch({ areaPlaces, status = 200 } = {}) {
  return vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    if (status !== 200) return { ok: false, status, text: async () => 'API not enabled', json: async () => ({}) };
    if (body.pageSize === 1) {
      return {
        ok: true,
        json: async () => ({
          places: areaPlaces ?? [{ formattedAddress: 'Kissimmee, FL, USA', location: { latitude: 28.29, longitude: -81.41 } }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        places: [{
          id: 'gp-1',
          displayName: { text: 'Bubbles Car Wash' },
          types: ['car_wash'],
          primaryType: 'car_wash',
          businessStatus: 'OPERATIONAL',
          location: { latitude: 28.3, longitude: -81.4 },
          addressComponents: [
            { longText: 'Kissimmee', shortText: 'Kissimmee', types: ['locality'] },
            { longText: 'Florida', shortText: 'FL', types: ['administrative_area_level_1'] },
            { longText: 'United States', shortText: 'US', types: ['country'] },
          ],
        }],
      }),
    };
  });
}

beforeEach(() => {
  h.db = fakeDb();
  h.user = ADMIN;
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  vi.stubGlobal('fetch', googleFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLAIM = { action: 'scan-claim', area: 'Kissimmee, FL', radiusMi: 10, categories: ['car_wash', 'nope'] };

describe('leads-admin', () => {
  it('is for super admins only', async () => {
    h.user = OWNER;
    expect((await handler(post(CLAIM))).statusCode).toBe(403);
    h.user = null;
    expect((await handler(post(CLAIM))).statusCode).toBe(401);
  });

  it('claims a scan with the area resolved on Google Maps, keeping only known types', async () => {
    const res = await handler(post(CLAIM));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).scan).toMatchObject({
      area_query: 'Kissimmee, FL', area_label: 'Kissimmee, FL, USA', center_lat: 28.29, center_lng: -81.41,
      radius_mi: 10, categories: ['car_wash'], requested_by: ADMIN.id, finished_at: null,
    });
    // One lookup: the area. Nothing searched yet.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses a bad request before spending anything', async () => {
    expect((await handler(post({ ...CLAIM, area: ' ' }))).statusCode).toBe(400);
    expect((await handler(post({ ...CLAIM, radiusMi: 7 }))).statusCode).toBe(400);
    expect((await handler(post({ ...CLAIM, categories: ['nope'] }))).statusCode).toBe(400);
    expect((await handler(post({ action: 'nope' }))).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    delete process.env.GOOGLE_PLACES_API_KEY;
    expect((await handler(post(CLAIM))).statusCode).toBe(500);
  });

  it('says so when Google doesn\'t know the area, or refuses the key', async () => {
    vi.stubGlobal('fetch', googleFetch({ areaPlaces: [] }));
    const unknown = await handler(post(CLAIM));
    expect(unknown.statusCode).toBe(400);
    expect(bodyOf(unknown).error).toMatch(/doesn't know/);
    vi.stubGlobal('fetch', googleFetch({ status: 403 }));
    const refused = await handler(post(CLAIM));
    expect(refused.statusCode).toBe(502);
    expect(bodyOf(refused).error).toMatch(/Places API \(New\)/);
    // Google says a key that doesn't exist with a 400, not a 403.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, text: async () => 'API key not valid. Please pass a valid API key.' })));
    expect(bodyOf(await handler(post(CLAIM))).error).toMatch(/refused the Places key/);
    expect(h.db.state.sales_prospect_scans).toHaveLength(0);
  });

  it('allows one scan at a time', async () => {
    expect((await handler(post(CLAIM))).statusCode).toBe(200);
    const second = await handler(post(CLAIM));
    expect(second.statusCode).toBe(409);
  });

  it('releases a claim the browser couldn\'t start, and only that', async () => {
    const { scan } = bodyOf(await handler(post(CLAIM)));
    const res = await handler(post({ action: 'scan-release', scanId: scan.id, error: 'offline' }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.sales_prospect_scans[0]).toMatchObject({ error: "Couldn't start the scan: offline" });
    expect(h.db.state.sales_prospect_scans[0].finished_at).toBeTruthy();
  });
});

describe('leads-scan-background', () => {
  it('runs the claimed scan once, then refuses to run it again', async () => {
    const { scan } = bodyOf(await handler(post(CLAIM)));
    const res = await backgroundHandler(post({ scanId: scan.id }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.sales_prospects.map((p) => p.place_id)).toEqual(['gp-1']);
    expect(h.db.state.sales_prospect_scans[0]).toMatchObject({ found: 1, added: 1 });
    expect((await backgroundHandler(post({ scanId: scan.id }))).statusCode).toBe(409);
  });

  it('is for super admins only', async () => {
    const { scan } = bodyOf(await handler(post(CLAIM)));
    h.user = OWNER;
    expect((await backgroundHandler(post({ scanId: scan.id }))).statusCode).toBe(403);
    expect(h.db.state.sales_prospect_scans[0].run_started_at).toBeNull();
  });
});
