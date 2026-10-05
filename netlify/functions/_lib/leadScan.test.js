// Admin > Leads scan (leadScan.js): what a Google place becomes, who it
// already is, and a whole scan against a fake database and a fake Google.
import { describe, it, expect } from 'vitest';
import {
  ScanRunningError, buildAccountMatcher, buildLeadMatcher, claimScan, classify, closeDeadScans,
  compactName, confirmedUserIds, hasDistinctiveWord, isKeyError, keepPlace, loadAccounts, normPhone, quarters, rectAround, runClaimedScan, runScan, toRow, websiteKind,
} from './leadScan.js';

function place({
  id = 'p1', name = 'Shiny Auto Detailing', types = ['car_wash'], primaryType = 'car_wash',
  street = '1402', city = 'Kissimmee', state = 'FL', country = 'US', phone = '(407) 555-0100',
  website = null, lat = 28.3, lng = -81.4, status = 'OPERATIONAL',
} = {}) {
  return {
    id,
    displayName: { text: name },
    types,
    primaryType,
    primaryTypeDisplayName: { text: 'Car Detailing Service' },
    businessStatus: status,
    nationalPhoneNumber: phone,
    websiteUri: website,
    rating: 4.6,
    userRatingCount: 212,
    location: { latitude: lat, longitude: lng },
    addressComponents: [
      ...(street ? [{ longText: street, shortText: street, types: ['street_number'] }] : []),
      ...(street ? [{ longText: 'East Vine Street', shortText: 'E Vine St', types: ['route'] }] : []),
      { longText: city, shortText: city, types: ['locality', 'political'] },
      { longText: 'Osceola County', shortText: 'Osceola County', types: ['administrative_area_level_2', 'political'] },
      { longText: 'Florida', shortText: state, types: ['administrative_area_level_1', 'political'] },
      { longText: country === 'US' ? 'United States' : 'Canada', shortText: country, types: ['country', 'political'] },
      { longText: '34744', shortText: '34744', types: ['postal_code'] },
    ],
  };
}

describe('classify', () => {
  it('lets the name decide over the query that found it', () => {
    expect(classify(place({ name: 'Elite Window Tint', types: ['car_repair'] }), 'mechanic_shop')).toBe('tint_shop');
    expect(classify(place({ name: 'Ceramic Pros Orlando', types: ['car_wash'] }), 'car_wash')).toBe('tint_shop');
    expect(classify(place({ name: 'J&M Auto Detailing', types: ['car_wash'] }), 'car_wash')).toBe('detailing_shop');
    expect(classify(place({ name: 'Rim Doctor', types: ['car_repair'] }), 'mechanic_shop')).toBe('wheel_shop');
    expect(classify(place({ name: 'Bubbles Car Wash', types: ['car_wash'] }), 'detailing_shop')).toBe('car_wash');
    // Google tags detailers car_wash; with nothing in the name, the search that found it decides.
    expect(classify(place({ name: 'Gloss Boss', types: ['car_wash'] }), 'detailing_shop')).toBe('detailing_shop');
    expect(classify(place({ name: 'Gloss Boss', types: ['car_wash'] }), 'car_wash')).toBe('car_wash');
  });

  it('calls a detailer mobile by name, or when Google has no street for it', () => {
    expect(classify(place({ name: 'Mobile Detail Pros' }), 'detailing_shop')).toBe('mobile_detailing');
    expect(classify(place({ name: 'Gloss Boss Detailing', street: null }), 'detailing_shop')).toBe('mobile_detailing');
    expect(classify(place({ name: 'Gloss Boss Detailing' }), 'mobile_detailing')).toBe('detailing_shop');
  });

  it('puts mechanics found by any search with the mechanics, but not alignment shops with wheels', () => {
    expect(classify(place({ name: 'Joe Garage', types: ['car_repair'] }), 'car_wash')).toBe('mechanic_shop');
    expect(classify(place({ name: 'Wheel Alignment Center', types: ['car_repair'] }), 'wheel_shop')).toBe('wheel_shop');
    expect(classify(place({ name: 'Wheel Alignment Center', types: ['car_repair'] }), 'mechanic_shop')).toBe('mechanic_shop');
  });
});

describe('websiteKind', () => {
  it('sorts a website into none / social / builder / own', () => {
    expect(websiteKind(null)).toBe('none');
    expect(websiteKind('  ')).toBe('none');
    expect(websiteKind('https://www.facebook.com/shinyautodetail')).toBe('social');
    expect(websiteKind('https://m.facebook.com/x')).toBe('social');
    expect(websiteKind('instagram.com/shiny')).toBe('social');
    expect(websiteKind('https://shiny-auto.business.site/')).toBe('social');
    expect(websiteKind('https://shinyauto.wixsite.com/home')).toBe('builder');
    expect(websiteKind('https://shiny.godaddysites.com')).toBe('builder');
    expect(websiteKind('https://www.shinyautodetail.com/')).toBe('own');
  });
});

describe('toRow / keepPlace', () => {
  it('reads the street, city, county and website out of the place', () => {
    const row = toRow(place({ website: 'https://facebook.com/shiny' }), 'detailing_shop');
    expect(row).toMatchObject({
      place_id: 'p1', name: 'Shiny Auto Detailing', category: 'detailing_shop', address: '1402 E Vine St',
      city: 'Kissimmee', county: 'Osceola', state: 'FL', zip: '34744', phone: '(407) 555-0100',
      website: 'https://facebook.com/shiny', website_kind: 'social', rating: 4.6, rating_count: 212,
    });
  });

  it('keeps US shops that are trading, and drops the rest', () => {
    const keep = (p) => keepPlace(p, toRow(p, 'car_wash'));
    expect(keep(place())).toBe(true);
    expect(keep(place({ country: 'CA' }))).toBe(false);
    expect(keep(place({ status: 'CLOSED_PERMANENTLY' }))).toBe(false);
    for (const primaryType of ['gas_station', 'car_dealer', 'auto_parts_store', 'fast_food_restaurant', 'bank']) {
      expect(keep(place({ primaryType }))).toBe(false);
    }
  });
});

describe('who we already know', () => {
  it('normalizes phones and names', () => {
    expect(normPhone('+1 (407) 555-0100')).toBe('4075550100');
    expect(normPhone('555-0100')).toBeNull();
    expect(compactName('The Shine & Co., LLC')).toBe('shine');
    expect(compactName('Auto Gee llc')).toBe(compactName('AutoGee LLC'));
  });

  it('matches an account by Google listing, then phone, then name in the same town', () => {
    const match = buildAccountMatcher([
      { userId: 'u1', placeId: 'gp-1', phones: [], name: 'Different Name', city: '', state: '' },
      { userId: 'u2', placeId: null, phones: ['407.555.0199'], name: '', city: '', state: '' },
      { userId: 'u3', placeId: null, phones: [], name: 'Elite Auto Spa', city: 'Orlando', state: 'FL' },
      { userId: 'u4', placeId: null, phones: [], name: 'Gleaming Mobile Detailing', city: '', state: 'FL' },
    ]);
    expect(match({ place_id: 'gp-1', name: 'X' })).toMatchObject({ userId: 'u1', reason: 'set up from this Google listing' });
    expect(match({ place_id: 'z', name: 'X', phone: '(407) 555-0199' })).toMatchObject({ userId: 'u2', reason: 'same phone number' });
    expect(match({ place_id: 'z', name: 'Elite Auto Spa LLC', city: 'Orlando' })?.userId).toBe('u3');
    expect(match({ place_id: 'z', name: 'Elite Auto Spa', city: 'Tampa' })).toBeNull();
    // No town on the account: the state, for a name long enough to be nobody else's.
    expect(match({ place_id: 'z', name: 'Gleaming Mobile Detailing', city: 'Ocala', state: 'FL' })?.userId).toBe('u4');
  });

  it('never matches on a name that is only the trade', () => {
    expect(hasDistinctiveWord('Mobile Detailing LLC')).toBe(false);
    expect(hasDistinctiveWord('Auto Repair & Tire Center')).toBe(false);
    expect(hasDistinctiveWord('Gloss Boss Detailing')).toBe(true);
    // Legal forms aren't a name; initials are.
    expect(hasDistinctiveWord('Mobile Detailing Ltd')).toBe(false);
    expect(hasDistinctiveWord('Car Wash Corporation')).toBe(false);
    for (const n of ['OG Detailing', 'AP Detailing', 'J&M Auto Spa', "TJ's Detailing", 'A1 Auto Spa']) {
      expect(hasDistinctiveWord(n)).toBe(true);
    }
    const og = buildAccountMatcher([{ userId: 'u9', placeId: null, phones: ['4075550000'], name: 'OG Detailing', city: 'Kissimmee', state: 'FL' }]);
    expect(og({ place_id: 'z', name: 'OG Detailing', city: 'Kissimmee', phone: '(407) 555-1111' })?.userId).toBe('u9');
    expect(buildLeadMatcher([{ id: 'l9', company_name: 'J&M Auto Spa', city: 'Orlando' }])({ name: 'J&M Auto Spa', city: 'Orlando' })?.id).toBe('l9');
    const account = buildAccountMatcher([{ userId: 'u1', placeId: null, phones: [], name: 'Mobile Detailing', city: '', state: 'FL' }]);
    expect(account({ place_id: 'z', name: 'Mobile Detailing', city: 'Ocala', state: 'FL' })).toBeNull();
    const lead = buildLeadMatcher([{ id: 'l1', company_name: 'Car Wash', city: 'Orlando' }]);
    expect(lead({ name: 'Car Wash', city: 'Orlando' })).toBeNull();
  });

  it('never re-pairs a business with an account an admin said it isn\'t', () => {
    const match = buildAccountMatcher([{ userId: 'u1', placeId: 'gp-1', phones: ['4075550100'], name: '', city: '', state: '' }]);
    expect(match({ place_id: 'gp-1', phone: '407-555-0100', name: 'X' }, ['u1'])).toBeNull();
  });

  it('matches an open lead on phone, or on name in the same city', () => {
    const match = buildLeadMatcher([
      { id: 'l1', company_name: 'Tint Masters', phone: '407-555-0177' },
      { id: 'l2', company_name: 'Wheel Fix', city: 'Orlando' },
    ]);
    expect(match({ name: 'Tint Masters Kissimmee', phone: '(407) 555-0177' })?.id).toBe('l1');
    expect(match({ name: 'Wheel Fix LLC', city: 'Orlando' })?.id).toBe('l2');
    expect(match({ name: 'Wheel Fix', city: 'Tampa' })).toBeNull();
  });
});

describe('search squares', () => {
  it('quarters a rectangle into four that tile it', () => {
    const r = rectAround(28.3, -81.4, 8);
    const q = quarters(r);
    expect(q).toHaveLength(4);
    expect(q[0].low).toEqual(r.low);
    expect(q[3].high).toEqual(r.high);
  });
});

// ─── A whole scan ─────────────────────────────────────────────────────

function fakeDb(seed) {
  const tables = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  const log = { updates: [], upserts: [] };

  function from(table) {
    const rows = () => tables[table] || (tables[table] = []);
    const st = { filters: [], op: 'select', payload: null, head: false };
    const match = () => rows().filter((r) => st.filters.every((f) => f(r)));
    const settle = () => {
      if (st.op === 'update') {
        const hit = match();
        hit.forEach((r) => Object.assign(r, st.payload));
        log.updates.push({ table, payload: st.payload, n: hit.length });
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (st.head) return { count: rows().length, error: null };
      return { data: match().map((r) => ({ ...r })), error: null };
    };
    const b = {
      select(_c, opts) { if (opts?.head) st.head = true; return b; },
      eq(c, v) { st.filters.push((r) => r[c] === v); return b; },
      is(c, v) { st.filters.push((r) => (r[c] ?? null) === v); return b; },
      lt(c, v) { st.filters.push((r) => r[c] != null && r[c] < v); return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      insert(r) {
        // Mirrors sales_prospect_scans_one_running: one unfinished scan at a time.
        if (table === 'sales_prospect_scans' && rows().some((x) => !x.finished_at)) {
          return { select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'duplicate key' } }) }) };
        }
        if (Array.isArray(r)) {
          rows().push(...r.map((x) => ({ ...x })));
          return { then: (res) => Promise.resolve({ error: null }).then(res) };
        }
        const row = { id: `scan-${rows().length + 1}`, started_at: new Date().toISOString(), run_started_at: null, finished_at: null, ...r };
        rows().push(row);
        return { select: () => ({ single: async () => ({ data: { ...row }, error: null }) }) };
      },
      async upsert(list) {
        for (const r of list) {
          const found = rows().find((x) => x.place_id === r.place_id);
          if (found) Object.assign(found, r);
          else rows().push({ id: `pr-${rows().length + 1}`, status: 'new', lead_id: null, match_user_id: null, not_user_ids: [], ...r });
        }
        log.upserts.push(...list);
        return { error: null };
      },
      range(a, z) { return Promise.resolve({ data: match().slice(a, z + 1).map((r) => ({ ...r })), error: null }); },
      then(res, rej) { return Promise.resolve(settle()).then(res, rej); },
    };
    return b;
  }
  return { from, tables, log };
}

/** Google, answering every search with the same places. */
function fakeFetch(places) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return { ok: true, json: async () => ({ places }) };
  };
  return { impl, calls };
}

/** Google, with more places than it will list: every search fills three pages. */
function fullFetch() {
  const calls = [];
  let n = 0;
  const impl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const page = body.pageToken ? Number(body.pageToken) : 0;
    const places = Array.from({ length: 20 }, () => { n += 1; return place({ id: `g${n}`, name: `Detail Shop ${n}` }); });
    return { ok: true, json: async () => ({ places, ...(page < 2 ? { nextPageToken: String(page + 1) } : {}) }) };
  };
  return { impl, calls };
}

const EMPTY = { profiles: [], sites: [], sales_leads: [], sales_prospects: [], sales_prospect_scans: [] };
const CENTER = { lat: 28.29, lng: -81.41 };

describe('runScan', () => {
  it('searches, keeps the shops, flags accounts and Pipeline leads, and upserts', async () => {
    const db = fakeDb({
      ...EMPTY,
      profiles: [
        { id: 'owner-1', phone: null, business_name: null, is_super_admin: false },
        { id: 'admin-1', phone: null, business_name: null, is_super_admin: true },
      ],
      sites: [
        { id: 's1', user_id: 'owner-1', business_info: { businessName: 'Shiny Auto Detailing', phone: '407-555-0100', city: 'Kissimmee', state: 'FL' } },
        // An admin's demo site for a shop that hasn't bought: not an account.
        { id: 's2', user_id: 'admin-1', business_info: { businessName: 'Gloss Garage', googlePlace: { placeId: 'c' } } },
      ],
      sales_leads: [{ id: 'l1', company_name: 'Tint Masters', city: 'Kissimmee', archived_at: null, owner_id: 'admin-1' }],
    });
    const { impl, calls } = fakeFetch([
      place({ id: 'a', name: 'Shiny Auto Detailing', phone: '(407) 555-0100' }),
      place({ id: 'b', name: 'Tint Masters', phone: '(407) 555-0199' }),
      place({ id: 'c', name: 'Gloss Garage Detailing', phone: null }),
      place({ id: 'd', name: 'Speedway', primaryType: 'gas_station', phone: null }),
    ]);

    const stats = await runScan({
      db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 5,
      categories: ['detailing_shop'], areaLabel: 'Kissimmee, FL · 5 mi', scanId: 'scan-1',
    });

    // One Places call: a single page came back short of 20.
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ textQuery: 'auto detailing', pageSize: 20 });
    expect(stats).toMatchObject({ requests: 1, kept: 3, added: 3, matched: 1, piped: 1, capped: false });

    const byPlace = Object.fromEntries(db.tables.sales_prospects.map((p) => [p.place_id, p]));
    expect(Object.keys(byPlace).sort()).toEqual(['a', 'b', 'c']);
    expect(byPlace.a).toMatchObject({ match_user_id: 'owner-1', match_reason: 'same phone number', area: 'Kissimmee, FL · 5 mi', scan_id: 'scan-1' });
    // Credited to the lead's owner, so they get "open lead" on it.
    expect(byPlace.b).toMatchObject({ status: 'piped', lead_id: 'l1', status_by: 'admin-1' });
    expect(byPlace.c.match_user_id).toBeNull();
  });

  it('brings the notes along when it links a business to a lead someone entered by hand', async () => {
    const db = fakeDb({
      ...EMPTY,
      sales_leads: [{ id: 'l1', company_name: 'Tint Masters', city: 'Kissimmee', archived_at: null, owner_id: 'admin-1' }],
      sales_prospects: [{ id: 'x', place_id: 'b', name: 'Tint Masters', city: 'Kissimmee', status: 'new', lead_id: null, match_user_id: null, not_user_ids: [] }],
      sales_prospect_notes: [{ id: 'n1', prospect_id: 'x', author_id: 'admin-2', body: 'Owner Mike, after 3pm', created_at: '2026-10-01T10:00:00Z' }],
    });
    const { impl } = fakeFetch([place({ id: 'b', name: 'Tint Masters', phone: null })]);
    await runScan({ db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 5, categories: ['tint_shop'] });
    expect(db.tables.sales_prospects[0]).toMatchObject({ status: 'piped', lead_id: 'l1' });
    expect(db.tables.sales_lead_notes).toEqual([
      { lead_id: 'l1', author_id: 'admin-2', body: 'Owner Mike, after 3pm', created_at: '2026-10-01T10:00:00Z' },
    ]);
  });

  it('fails the scan, rather than reporting an empty area, when every search failed', async () => {
    const db = fakeDb(EMPTY);
    const impl = async () => ({ ok: false, status: 400, text: async () => 'Request contains an invalid argument.' });
    await expect(runScan({ db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 5, categories: ['car_wash'] }))
      .rejects.toThrow(/refused all 1 searches/);
    expect(db.tables.sales_prospects).toHaveLength(0);
  });

  it('never sends an admin\'s verdict or a match back through the upsert', async () => {
    const db = fakeDb({
      ...EMPTY,
      sales_prospects: [{ id: 'x', place_id: 'a', name: 'Shiny', status: 'dismissed', lead_id: null, match_user_id: null, not_user_ids: [] }],
    });
    const { impl } = fakeFetch([place({ id: 'a' })]);
    await runScan({ db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 5, categories: ['detailing_shop'] });
    for (const row of db.log.upserts) {
      for (const k of ['status', 'lead_id', 'dismiss_reason', 'status_note', 'match_user_id', 'not_user_ids']) {
        expect(row).not.toHaveProperty(k);
      }
    }
    expect(db.tables.sales_prospects[0].status).toBe('dismissed');
  });

  it('asks a full search again in quarters, as deep as the type and radius allow', async () => {
    const db = fakeDb(EMPTY);
    const { impl, calls } = fullFetch();
    // mobile_detailing digs one level: 3 pages, then 4 quarters × 3 pages.
    const stats = await runScan({
      db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 10, categories: ['mobile_detailing'],
    });
    expect(calls).toHaveLength(15);
    expect(stats.requests).toBe(15);
    expect(stats.capped).toBe(false);
  });

  it('stops at the request ceiling, says so, and still writes what it found', async () => {
    const db = fakeDb(EMPTY);
    const { impl, calls } = fullFetch();
    const stats = await runScan({
      db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 10, categories: ['mobile_detailing'], maxRequests: 5,
    });
    expect(calls).toHaveLength(5);
    expect(stats).toMatchObject({ requests: 5, capped: true });
    expect(db.tables.sales_prospects.length).toBe(100);
  });

  it('stops a refused key outright instead of skipping searches', async () => {
    const db = fakeDb(EMPTY);
    const impl = async () => ({ ok: false, status: 403, text: async () => 'API not enabled' });
    await expect(runScan({ db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 5, categories: ['car_wash'] }))
      .rejects.toThrow(/refused the key/);
  });

  it('treats Google\'s 400 "API key not valid" as a refused key too', async () => {
    const db = fakeDb(EMPTY);
    let calls = 0;
    const impl = async () => {
      calls += 1;
      return { ok: false, status: 400, text: async () => '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}' };
    };
    await expect(runScan({ db, apiKey: 'k', fetchImpl: impl, paceMs: 0, center: CENTER, radiusMi: 5, categories: ['tint_shop'] }))
      .rejects.toThrow(/refused the key/);
    // Stopped, rather than trying the other two tint searches.
    expect(calls).toBeLessThanOrEqual(3);
    expect(isKeyError(400, 'Request contains an invalid argument.')).toBe(false);
  });
});

describe('which accounts count', () => {
  const PROFILES = [
    { id: 'confirmed', phone: '407-555-0100', business_name: 'Gloss Boss', is_super_admin: false },
    { id: 'unconfirmed', phone: '407-555-0199', business_name: 'Shine Kings', is_super_admin: false },
    { id: 'admin', phone: '407-555-0111', business_name: 'Demo', is_super_admin: true },
  ];
  const withAuth = (db, users, error = null) => Object.assign(db, {
    auth: { admin: { listUsers: async () => ({ data: { users }, error }) } },
  });

  it('leaves out admins and signups that never confirmed their email', async () => {
    const db = withAuth(fakeDb({ ...EMPTY, profiles: PROFILES }), [
      { id: 'confirmed', email_confirmed_at: '2026-10-01T00:00:00Z' },
      { id: 'unconfirmed', email_confirmed_at: null },
      { id: 'admin', email_confirmed_at: '2026-10-01T00:00:00Z' },
    ]);
    expect([...(await confirmedUserIds(db))].sort()).toEqual(['admin', 'confirmed']);
    expect((await loadAccounts(db)).map((a) => a.userId)).toEqual(['confirmed']);
  });

  it('leaves out profiles without a site when confirmation can\'t be checked', async () => {
    const db = fakeDb({
      ...EMPTY,
      profiles: PROFILES,
      sites: [{ id: 's1', user_id: 'unconfirmed', business_info: { businessName: 'Shine Kings' } }],
    });
    expect(await confirmedUserIds(db)).toBeNull();
    // The site still counts (signing up for real is how a site gets made); the bare profiles don't.
    expect((await loadAccounts(db)).map((a) => a.userId)).toEqual(['unconfirmed']);
    expect(await confirmedUserIds(withAuth(fakeDb(EMPTY), [], { message: 'nope' }))).toBeNull();
  });
});

describe('scan bookkeeping', () => {
  const AREA = { label: 'Kissimmee, FL, USA', lat: 28.29, lng: -81.41 };

  it('claims one scan at a time', async () => {
    const db = fakeDb(EMPTY);
    const scan = await claimScan(db, { areaQuery: 'Kissimmee', area: AREA, radiusMi: 10, categories: ['car_wash'], requestedBy: 'admin-1' });
    expect(scan).toMatchObject({ area_label: 'Kissimmee, FL, USA', center_lat: 28.29, radius_mi: 10, requested_by: 'admin-1' });
    await expect(claimScan(db, { areaQuery: 'Ocala', area: AREA, radiusMi: 10, categories: ['car_wash'], requestedBy: 'admin-1' }))
      .rejects.toBeInstanceOf(ScanRunningError);
  });

  it('closes a scan a killed function left, and a claim nobody started', async () => {
    const old = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const db = fakeDb({
      ...EMPTY,
      sales_prospect_scans: [
        { id: 'dead', started_at: old, run_started_at: old, finished_at: null },
        { id: 'dropped', started_at: recent, run_started_at: null, finished_at: null },
      ],
    });
    await closeDeadScans(db);
    const byId = Object.fromEntries(db.tables.sales_prospect_scans.map((s) => [s.id, s]));
    expect(byId.dead.error).toMatch(/Never finished/);
    expect(byId.dropped.error).toMatch(/Never started/);
  });

  it('runs a claimed scan once and writes its counts', async () => {
    const db = fakeDb(EMPTY);
    const scan = await claimScan(db, { areaQuery: 'Kissimmee', area: AREA, radiusMi: 5, categories: ['car_wash'], requestedBy: 'admin-1' });
    const { impl } = fakeFetch([place({ id: 'a', name: 'Bubbles Car Wash' })]);
    const first = await runClaimedScan({ db, scanId: scan.id, apiKey: 'k', fetchImpl: impl, paceMs: 0 });
    expect(first.status).toBe(200);
    const row = db.tables.sales_prospect_scans[0];
    expect(row).toMatchObject({ requests: 1, found: 1, added: 1, capped: false });
    expect(row.finished_at).toBeTruthy();
    expect(db.tables.sales_prospects[0].area).toBe('Kissimmee, FL, USA · 5 mi');

    const again = await runClaimedScan({ db, scanId: scan.id, apiKey: 'k', fetchImpl: impl, paceMs: 0 });
    expect(again.status).toBe(409);
  });

  it('writes the error when the scan fails', async () => {
    const db = fakeDb(EMPTY);
    const scan = await claimScan(db, { areaQuery: 'Kissimmee', area: AREA, radiusMi: 5, categories: ['car_wash'], requestedBy: 'admin-1' });
    const impl = async () => ({ ok: false, status: 403, text: async () => 'nope' });
    const res = await runClaimedScan({ db, scanId: scan.id, apiKey: 'k', fetchImpl: impl, paceMs: 0 });
    expect(res.status).toBe(500);
    expect(db.tables.sales_prospect_scans[0].error).toMatch(/refused the key/);
  });
});
