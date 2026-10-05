// tests/functions/booking-time-basis.test.js
//
// bookings.preferred_at is the shop's wall-clock time written as UTC. The
// Book Customer dialog used to send a real instant as preferred_at instead,
// and a dashboard tab loaded before that fix keeps the old dialog until it is
// reloaded. Its rows look exactly like new ones, so owner-create-booking
// stores only shop_preferred_at (the wall-clock time the current dialog
// sends) and refuses a request without it (409, with a message the old
// dialog shows). The current dialog still sends the old reading as
// preferred_at, for the previous deploy's function after a rollback; it is
// never stored here. Writers whose time format never changed (the public
// widget and the status actions) keep accepting requests without it, so
// cached widget copies and old tabs still work there.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));

// The functions resolve supabase-js from netlify/functions/node_modules.
vi.mock('../../netlify/functions/node_modules/@supabase/supabase-js/dist/index.mjs', () => ({
  createClient: () => h.db,
}));

vi.mock('../../netlify/functions/_lib/postmark.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    bookingReceivedToCustomer: vi.fn(async () => ({ MessageID: 'm1' })),
    newBookingToOwner: vi.fn(async () => ({ MessageID: 'm2' })),
    statusUpdateToCustomer: vi.fn(async () => ({ MessageID: 'm3' })),
  };
});

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { handler: ownerCreate } = await import('../../netlify/functions/owner-create-booking.js');
const { handler: updateBooking } = await import('../../netlify/functions/update-booking.js');
const { handler: createBooking } = await import('../../netlify/functions/create-booking.js');

const SITE_ID = '6c79cf20-0000-4000-8000-000000000001';
const OWNER_ID = 'owner-1';

// ─── Fake Supabase ────────────────────────────────────────────────────
// Understands the query chains these three functions use.
function fakeDb({ sites = [], profiles = [], bookings = [] } = {}) {
  const state = { sites, profiles, bookings, inserts: [], updates: [] };

  function run(q) {
    const eqs = q.ops.filter((o) => o[0] === 'eq');
    const match = (row) => eqs.every(([, c, v]) => row[c] === v);
    const insert = q.ops.find((o) => o[0] === 'insert');
    const update = q.ops.find((o) => o[0] === 'update');
    const single = q.ops.some((o) => o[0] === 'single' || o[0] === 'maybeSingle');

    if (q.table === 'request_log') return insert ? { error: null } : { count: 0, error: null };
    const rows = state[q.table];
    if (insert) {
      const row = { id: `${q.table}-new`, ...insert[1] };
      rows.push(row);
      state.inserts.push({ table: q.table, row: insert[1] });
      return { data: structuredClone(row), error: null };
    }
    if (update) {
      const hit = rows.filter(match);
      hit.forEach((row) => Object.assign(row, update[1]));
      state.updates.push({ table: q.table, patch: update[1] });
      return { data: single ? structuredClone(hit[0] || null) : structuredClone(hit), error: null };
    }
    const found = rows.filter(match);
    return { data: single ? structuredClone(found[0] || null) : structuredClone(found), error: null };
  }

  function from(table) {
    const q = { table, ops: [] };
    const b = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'order', 'insert', 'update', 'single', 'maybeSingle']) {
      b[m] = (...args) => { q.ops.push([m, ...args]); return b; };
    }
    b.then = (resolve, reject) => Promise.resolve().then(() => run(q)).then(resolve, reject);
    return b;
  }

  return {
    state,
    from,
    auth: {
      getUser: async (token) => (token === 'owner-token'
        ? { data: { user: { id: OWNER_ID } }, error: null }
        : { data: { user: null }, error: { message: 'bad token' } }),
    },
  };
}

const SITE = {
  id: SITE_ID,
  user_id: OWNER_ID,
  slug: 'og-detailing',
  business_info: { businessName: 'OG Detailing' },
  scheduler_enabled: true,
  scheduler_config: {
    services: [{ id: 'svc-1', name: 'Full detail', price: '$150', duration_minutes: 60 }],
    availability: { sat: [{ start: '07:00', end: '19:00' }] },
    slot_granularity_minutes: 30,
    lead_time_hours: 24,
  },
};
const PROFILE = { id: OWNER_ID, email: 'owner@example.com', subscription_status: 'active' };

function post(body, { token = 'owner-token' } = {}) {
  return {
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${token}`, origin: 'https://app.autocaregenius.com' },
    body: JSON.stringify(body),
  };
}
const bodyOf = (res) => JSON.parse(res.body);

// What master's BookCustomerModal sends (3e72d7d): the typed time read in
// the browser's zone as preferred_at, and nothing else.
function oldDialogBody(overrides = {}) {
  return {
    siteId: SITE_ID,
    customer_name: 'Dana Smith',
    customer_email: 'dana@example.com',
    customer_phone: '555-0100',
    preferred_at: '2026-10-17T14:00:00.000Z', // 10:00 typed in New York
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    vehicle_year: 2020,
    vehicle_size: 'sedan',
    vehicle_type_id: null,
    service_id: 'svc-1',
    service_name: 'Full detail',
    notes: '',
    send_email: true,
    ...overrides,
  };
}
// What the current dialog sends for the same 10:00 typed in New York: the
// wall-clock time as shop_preferred_at, and the old reading as preferred_at.
const newDialogBody = (overrides = {}) => oldDialogBody({ shop_preferred_at: '2026-10-17T10:00:00.000Z', ...overrides });

beforeEach(() => {
  h.db = fakeDb({ sites: [structuredClone(SITE)], profiles: [{ ...PROFILE }] });
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('owner-create-booking: shop_preferred_at', () => {
  it("stores the current dialog's wall-clock time (shop_preferred_at), never its preferred_at", async () => {
    const res = await ownerCreate(post(newDialogBody()));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).ok).toBe(true);
    expect(h.db.state.inserts).toHaveLength(1);
    const row = h.db.state.inserts[0].row;
    expect(row.preferred_at).toBe('2026-10-17T10:00:00.000Z');
    expect(row.status).toBe('confirmed');
    expect(row.referral_source).toBe('owner-dashboard');
    // A request field, not a column.
    expect(row).not.toHaveProperty('shop_preferred_at');
    expect(bodyOf(res).booking.preferred_at).toBe('2026-10-17T10:00:00.000Z');
    expect(postmark.bookingReceivedToCustomer).toHaveBeenCalledTimes(1);
  });

  it('does not need preferred_at from the current dialog (it is only for a rolled-back function)', async () => {
    const res = await ownerCreate(post(newDialogBody({ preferred_at: undefined })));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.inserts[0].row.preferred_at).toBe('2026-10-17T10:00:00.000Z');
  });

  it('refuses the old dialog (no shop_preferred_at) with 409 and a reload message, before touching anything', async () => {
    const res = await ownerCreate(post(oldDialogBody()));
    expect(res.statusCode).toBe(409);
    const body = bodyOf(res);
    // Master's dialog throws new Error(body.error) and shows it under the form.
    expect(body.error).toBe(
      'The dashboard was updated. Please reload the page, then create this booking again (it was not saved).',
    );
    expect(body.code).toBe('reload_required');
    expect(h.db.state.inserts).toHaveLength(0);
    expect(postmark.bookingReceivedToCustomer).not.toHaveBeenCalled();
  });

  it('refuses a shop_preferred_at that is not a non-empty string', async () => {
    for (const shop_preferred_at of ['', null, true, 0, 1760695200000, {}, ['2026-10-17T10:00:00.000Z']]) {
      const res = await ownerCreate(post(newDialogBody({ shop_preferred_at })));
      expect(res.statusCode, JSON.stringify(shop_preferred_at)).toBe(409);
    }
    // The pre-fix marker alone is not enough either.
    expect((await ownerCreate(post(oldDialogBody({ time_basis: 'shop' })))).statusCode).toBe(409);
    expect(h.db.state.inserts).toHaveLength(0);
  });

  it('keeps its earlier checks: missing fields 400, bad token 401, another owner 403', async () => {
    expect((await ownerCreate(post(oldDialogBody({ preferred_at: '' })))).statusCode).toBe(400);
    expect((await ownerCreate(post(newDialogBody({ preferred_at: '', shop_preferred_at: '' })))).statusCode).toBe(400);
    expect((await ownerCreate(post(newDialogBody({ customer_name: '' })))).statusCode).toBe(400);
    expect((await ownerCreate(post(newDialogBody(), { token: 'nope' }))).statusCode).toBe(401);
    h.db.state.sites[0].user_id = 'someone-else';
    expect((await ownerCreate(post(newDialogBody()))).statusCode).toBe(403);
    expect(h.db.state.inserts).toHaveLength(0);
  });
});

describe('writers whose time format did not change still accept requests without shop_preferred_at', () => {
  it('update-booking: status actions from any dashboard tab work, and never write preferred_at', async () => {
    h.db.state.bookings.push({
      id: 'b1', site_id: SITE_ID, owner_user_id: OWNER_ID, status: 'pending',
      preferred_at: '2026-10-17T10:00:00.000Z', customer_email: 'dana@example.com',
    });
    // Master's updateBooking body: { bookingId, action, reason, owner_notes }.
    // A stray preferred_at is ignored, as before.
    const res = await updateBooking(post({ bookingId: 'b1', action: 'confirm', preferred_at: '2026-10-17T14:00:00.000Z' }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.bookings[0].status).toBe('confirmed');
    expect(h.db.state.bookings[0].preferred_at).toBe('2026-10-17T10:00:00.000Z');
    expect(h.db.state.updates.map((u) => Object.keys(u.patch).sort())).toEqual([['status', 'updated_at']]);
  });

  it('create-booking: the public widget (live and cached copies) books a slot without shop_preferred_at', async () => {
    // public/scheduler.js submit(): preferred_at is the slot's wall-clock ISO.
    const res = await createBooking(post({
      siteId: SITE_ID,
      customer_name: 'Lee Park',
      customer_email: 'lee@example.com',
      customer_phone: '555-0101',
      preferred_at: '2030-06-01T08:30:00.000Z', // a Saturday, inside 07:00-19:00
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      vehicle_year: 2021,
      vehicle_size: 'truck',
      service_id: 'svc-1',
      addon_ids: [],
    }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.inserts.filter((i) => i.table === 'bookings').map((i) => i.row.preferred_at))
      .toEqual(['2030-06-01T08:30:00.000Z']);
  });

  it('create-booking: the simple-mode request form still books without shop_preferred_at', async () => {
    const res = await createBooking(post({
      siteId: SITE_ID,
      customer_name: 'Lee Park',
      customer_email: 'lee@example.com',
      customer_phone: '555-0101',
      preferred_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      vehicle_make: 'Ford',
      vehicle_model: 'F-150',
      vehicle_year: 2021,
      vehicle_size: 'truck',
      notes: 'Preferred time: Saturday morning',
      service_id: 'svc-1',
      is_simple_request: true,
    }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.inserts.filter((i) => i.table === 'bookings')).toHaveLength(1);
  });
});
