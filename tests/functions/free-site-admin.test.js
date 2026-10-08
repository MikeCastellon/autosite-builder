// tests/functions/free-site-admin.test.js
//
// Free websites (Admin > Free websites): free-site-admin, the site link by
// the builder's marker, the hand-over (shared with custom websites) and its
// email. Supabase is an in-memory fake.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

vi.mock('../../netlify/functions/_lib/postmark.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, freeSiteHandover: vi.fn(async () => ({})) };
});

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { handler } = await import('../../netlify/functions/free-site-admin.js');

const ROW_ID = '33333333-4444-4555-8666-777777777777';
const SITE_ID = '44444444-5555-4666-8777-888888888888';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true, scheduler_enabled: true };
const STAFF = { id: 'staff-1', email: 'staff@acg.test', is_super_admin: true };
const OWNER = { id: 'owner-1', email: 'owner@shop.test', is_super_admin: false, scheduler_enabled: false };

function fakeDb({ rows = [], profiles = [ADMIN, STAFF, OWNER], sites = [], bookings = [], widgets = [], authUsers = [] } = {}) {
  const state = {
    free_site_handovers: rows, profiles, sites, bookings, inquiries: [], charges: [], widget_configs: widgets,
    authUsers, created: [], links: [], updatedUsers: [],
  };
  // 'business_info->>freeSiteId' reads into the JSON column, like PostgREST.
  const read = (row, col) => {
    const [base, key] = col.split('->>');
    return key ? row[base]?.[key] : row[base];
  };

  function run(q) {
    const rowsOf = state[q.table];
    if (!rowsOf) throw new Error(`unexpected table ${q.table}`);
    const op = (n) => q.ops.find((o) => o[0] === n);
    const filters = q.ops.filter((o) => ['eq', 'in', 'is'].includes(o[0]));
    const match = (r) => filters.every(([kind, c, v]) => {
      const value = read(r, c);
      if (kind === 'eq') return value === v;
      if (kind === 'in') return v.includes(value);
      return (value ?? null) === v;
    });
    const single = op('single') || op('maybeSingle');
    const copy = (r) => (r ? structuredClone(r) : null);
    if (op('insert')) {
      const row = {
        id: ROW_ID, note: '', site_id: null, handed_over_at: null, handed_over_by: null, customer_user_id: null,
        comp_pro: false, email_sent_at: null, email_error: null, created_at: '2026-10-08T10:00:00Z', updated_at: '2026-10-08T10:00:00Z',
        ...op('insert')[1],
      };
      rowsOf.push(row);
      return { data: copy(row), error: null };
    }
    if (op('delete')) { state[q.table] = rowsOf.filter((r) => !match(r)); return { error: null }; }
    const hits = rowsOf.filter(match);
    if (op('update')) {
      hits.forEach((r) => Object.assign(r, structuredClone(op('update')[1])));
      if (single) return { data: copy(hits[0]), error: null };
      return op('select') ? { data: hits.map((r) => ({ id: r.id })), error: null } : { error: null };
    }
    return single ? { data: copy(hits[0]), error: null } : { data: hits.map(copy), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'order', 'limit']) {
      api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  const auth = {
    admin: {
      createUser: async ({ email, user_metadata }) => {
        const id = `user-${state.authUsers.length + 1}`;
        state.authUsers.push({ id, email, email_confirmed_at: '2026-10-08T00:00:00Z' });
        state.created.push({ email, user_metadata });
        state.profiles.push({ id, email, first_name: user_metadata?.first_name || null, last_name: user_metadata?.last_name || null, scheduler_enabled: false });
        return { data: { user: { id, email } }, error: null };
      },
      generateLink: async ({ type, email, options }) => {
        state.links.push({ type, email, redirectTo: options?.redirectTo });
        return { data: { properties: { action_link: `https://auth.test/verify?type=${type}&email=${email}` } }, error: null };
      },
      getUserById: async (id) => ({ data: { user: state.authUsers.find((u) => u.id === id) || null }, error: null }),
      updateUserById: async (id, attrs) => {
        state.updatedUsers.push({ id, ...attrs });
        const u = state.authUsers.find((x) => x.id === id);
        if (u && attrs.email_confirm) u.email_confirmed_at = new Date().toISOString();
        return { data: { user: u }, error: null };
      },
    },
  };
  return { from, auth, state };
}

const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);

function row(extra = {}) {
  return {
    id: ROW_ID, client_first_name: 'Dana', client_last_name: 'Ruiz', client_email: 'dana@gloss.test',
    client_phone: '555-0100', business_name: 'Gloss Boss', note: '', site_id: null, created_by: 'admin-1',
    handed_over_at: null, handed_over_by: null, customer_user_id: null, comp_pro: false,
    email_sent_at: null, email_error: null, created_at: '2026-10-08T10:00:00Z', updated_at: '2026-10-08T10:00:00Z', ...extra,
  };
}

function site(extra = {}) {
  return {
    id: SITE_ID, user_id: 'admin-1', site_type: 'website', template_id: 'detailing_sporty', published_url: 'https://gloss-boss.test',
    updated_at: '2026-10-08T11:00:00Z', business_info: { businessName: 'Gloss Boss', freeSiteId: ROW_ID },
    generated_content: {}, widget_config_ids: [], ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 'admin-1', email: 'admin@acg.test' };
});

describe('free-site-admin access', () => {
  it('is for super admins only', async () => {
    h.db = fakeDb();
    h.user = { id: 'owner-1', email: 'owner@shop.test' };
    expect((await handler(post({ action: 'list' }))).statusCode).toBe(403);
    h.user = null;
    expect((await handler(post({ action: 'list' }))).statusCode).toBe(401);
  });
});

describe('free-site-admin create / list', () => {
  it('needs a first name and a valid email, and records who added the customer', async () => {
    h.db = fakeDb();
    expect((await handler(post({ action: 'create', firstName: 'Dana', email: 'nope' }))).statusCode).toBe(400);
    expect((await handler(post({ action: 'create', email: 'dana@gloss.test' }))).statusCode).toBe(400);
    const res = await handler(post({ action: 'create', firstName: ' Dana ', lastName: 'Ruiz', email: 'Dana@Gloss.TEST', businessName: 'Gloss Boss' }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.free_site_handovers[0]).toEqual(expect.objectContaining({
      client_first_name: 'Dana', client_last_name: 'Ruiz', client_email: 'dana@gloss.test', business_name: 'Gloss Boss', created_by: 'admin-1', site_id: null,
    }));
    expect(json(res).handover).toEqual(expect.objectContaining({ site: null, createdByEmail: 'admin@acg.test' }));
  });

  it('takes a site the admin already built and marks it for the row', async () => {
    h.db = fakeDb({ sites: [site({ business_info: { businessName: 'Gloss Boss' } })] });
    const res = await handler(post({ action: 'create', firstName: 'Dana', email: 'dana@gloss.test', siteId: SITE_ID }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.free_site_handovers[0].site_id).toBe(SITE_ID);
    expect(h.db.state.sites[0].business_info).toEqual({ businessName: 'Gloss Boss', freeSiteId: ROW_ID });
    expect(json(res).handover.site).toEqual(expect.objectContaining({ id: SITE_ID, ownerEmail: 'admin@acg.test', publishedUrl: 'https://gloss-boss.test' }));
  });

  it('never takes a customer\'s site, a custom website\'s site or a booking page', async () => {
    h.db = fakeDb({ sites: [site({ user_id: 'owner-1' })] });
    expect((await handler(post({ action: 'create', firstName: 'Dana', email: 'dana@gloss.test', siteId: SITE_ID }))).statusCode).toBe(409);
    h.db = fakeDb({ sites: [site({ business_info: { customProjectId: 'p1' } })] });
    expect((await handler(post({ action: 'create', firstName: 'Dana', email: 'dana@gloss.test', siteId: SITE_ID }))).statusCode).toBe(400);
    h.db = fakeDb({ sites: [site({ site_type: 'booking_only' })] });
    expect((await handler(post({ action: 'create', firstName: 'Dana', email: 'dana@gloss.test', siteId: SITE_ID }))).statusCode).toBe(400);
    expect(h.db.state.free_site_handovers).toEqual([]);
  });

  it('links the site the builder saved with the row\'s marker, only from a team account', async () => {
    h.db = fakeDb({ rows: [row()], sites: [site({ user_id: 'staff-1' })] });
    const res = json(await handler(post({ action: 'list' })));
    expect(h.db.state.free_site_handovers[0].site_id).toBe(SITE_ID);
    expect(res.handovers[0].site).toEqual(expect.objectContaining({ id: SITE_ID, ownerEmail: 'staff@acg.test', ownerIsAdmin: true }));

    h.db = fakeDb({ rows: [row()], sites: [site({ user_id: 'owner-1' })] });
    await handler(post({ action: 'list' }));
    expect(h.db.state.free_site_handovers[0].site_id).toBeNull();
  });

  it('offers the admin\'s own websites no row holds', async () => {
    const mine = (id, extra) => site({ id, business_info: { businessName: id }, ...extra });
    h.db = fakeDb({
      rows: [row({ site_id: 'held' })],
      sites: [
        mine('held'), mine('free-one'), mine('booking', { site_type: 'booking_only' }),
        mine('custom', { business_info: { customProjectId: 'p1' } }), mine('staffs', { user_id: 'staff-1' }),
      ],
    });
    const { mySites } = json(await handler(post({ action: 'list' })));
    expect(mySites.map((s) => s.id)).toEqual(['free-one']);
  });

  it('edits details before the hand-over only', async () => {
    h.db = fakeDb({ rows: [row()] });
    const res = await handler(post({ action: 'update', id: ROW_ID, email: 'dana@new.test' }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.free_site_handovers[0]).toEqual(expect.objectContaining({ client_email: 'dana@new.test', client_first_name: 'Dana' }));
    h.db = fakeDb({ rows: [row({ handed_over_at: '2026-10-08T12:00:00Z' })] });
    expect((await handler(post({ action: 'update', id: ROW_ID, email: 'x@y.test' }))).statusCode).toBe(400);
  });
});

describe('free-site-admin hand-over', () => {
  const builderWidgets = [
    { id: 'w-admin', user_id: 'admin-1', type: 'google-reviews', widget_key: 'gr-admin' },
  ];

  it('creates the customer\'s account on the free plan, moves the site and takes the builder\'s widgets off', async () => {
    h.db = fakeDb({
      rows: [row({ site_id: SITE_ID })],
      sites: [site({ generated_content: { heroTitle: 'Shine', googleWidgetKey: 'gr-admin', instagramWidgetKey: 'ig-other' }, widget_config_ids: ['w-admin', 'w-other'] })],
      bookings: [{ id: 'b1', site_id: SITE_ID, owner_user_id: 'admin-1' }],
      widgets: builderWidgets,
    });
    const check = json(await handler(post({ action: 'handover-check', id: ROW_ID })));
    expect(check.account).toBeNull();

    const res = await handler(post({ action: 'handover', id: ROW_ID, sendEmail: true }));
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body).toEqual(expect.objectContaining({ newAccount: true, widgetsRemoved: 2, emailError: null }));
    const { state } = h.db;
    const profile = state.profiles.find((p) => p.email === 'dana@gloss.test');
    expect(profile).toEqual(expect.objectContaining({ first_name: 'Dana', business_name: 'Gloss Boss', phone: '555-0100', scheduler_enabled: false }));
    const moved = state.sites[0];
    expect(moved.user_id).toBe(profile.id);
    expect(moved.business_info).toEqual({ businessName: 'Gloss Boss' });
    expect(moved.generated_content).toEqual({ heroTitle: 'Shine', instagramWidgetKey: 'ig-other' });
    expect(moved.widget_config_ids).toEqual(['w-other']);
    expect(state.bookings[0].owner_user_id).toBe(profile.id);
    expect(state.free_site_handovers[0]).toEqual(expect.objectContaining({
      handed_over_at: expect.any(String), handed_over_by: 'admin-1', customer_user_id: profile.id, comp_pro: false,
      email_sent_at: expect.any(String), email_error: null,
    }));
    expect(state.links).toEqual([{ type: 'recovery', email: 'dana@gloss.test', redirectTo: 'https://sitebuilder.autocaregenius.com' }]);
    expect(postmark.freeSiteHandover).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dana@gloss.test', replyTo: 'admin@acg.test', newAccount: true, pro: false,
      actionUrl: expect.stringContaining('type=recovery'), siteUrl: 'https://gloss-boss.test', businessName: 'Gloss Boss',
    }));
    expect(body.handover.site).toEqual(expect.objectContaining({ ownerEmail: 'dana@gloss.test', ownerIsAdmin: false }));
  });

  it('gives Pro when asked, and tells the email so', async () => {
    h.db = fakeDb({ rows: [row({ site_id: SITE_ID })], sites: [site()] });
    await handler(post({ action: 'handover', id: ROW_ID, compPro: true }));
    expect(h.db.state.profiles.find((p) => p.email === 'dana@gloss.test').scheduler_enabled).toBe(true);
    expect(h.db.state.free_site_handovers[0].comp_pro).toBe(true);
    expect(postmark.freeSiteHandover).toHaveBeenCalledWith(expect.objectContaining({ pro: true }));
  });

  it('an existing account keeps its details and gets a sign-in link', async () => {
    const dana = { id: 'dana-1', email: 'dana@gloss.test', first_name: 'Dee', scheduler_enabled: false };
    h.db = fakeDb({
      rows: [row({ site_id: SITE_ID })], sites: [site()], profiles: [ADMIN, dana],
      authUsers: [{ id: 'dana-1', email: 'dana@gloss.test', email_confirmed_at: '2026-09-01T00:00:00Z' }],
    });
    const res = json(await handler(post({ action: 'handover', id: ROW_ID })));
    expect(res.newAccount).toBe(false);
    expect(h.db.state.created).toEqual([]);
    expect(h.db.state.profiles[1]).toEqual(dana);
    expect(h.db.state.sites[0].user_id).toBe('dana-1');
    expect(postmark.freeSiteHandover).toHaveBeenCalledWith(expect.objectContaining({ newAccount: false, actionUrl: 'https://sitebuilder.autocaregenius.com' }));
  });

  it('picks up the builder\'s site by its marker at hand-over', async () => {
    h.db = fakeDb({ rows: [row()], sites: [site()] });
    expect((await handler(post({ action: 'handover', id: ROW_ID, sendEmail: false }))).statusCode).toBe(200);
    expect(h.db.state.free_site_handovers[0].site_id).toBe(SITE_ID);
    expect(postmark.freeSiteHandover).not.toHaveBeenCalled();
  });

  it('needs a site, refuses a second hand-over and admin accounts', async () => {
    h.db = fakeDb({ rows: [row()] });
    expect((await handler(post({ action: 'handover', id: ROW_ID }))).statusCode).toBe(400);

    h.db = fakeDb({ rows: [row({ site_id: SITE_ID, handed_over_at: '2026-10-08T12:00:00Z' })], sites: [site()] });
    expect((await handler(post({ action: 'handover', id: ROW_ID }))).statusCode).toBe(409);

    h.db = fakeDb({
      rows: [row({ site_id: SITE_ID, client_email: 'staff@acg.test' })], sites: [site()],
      authUsers: [{ id: 'staff-1', email: 'staff@acg.test', email_confirmed_at: '2026-01-01T00:00:00Z' }],
    });
    const res = await handler(post({ action: 'handover', id: ROW_ID }));
    expect(res.statusCode).toBe(409);
    expect(h.db.state.sites[0].user_id).toBe('admin-1');
    expect(h.db.state.free_site_handovers[0].handed_over_at).toBeNull();
  });

  it('never moves a site that is already in a customer\'s account', async () => {
    h.db = fakeDb({ rows: [row({ site_id: SITE_ID })], sites: [site({ user_id: 'owner-1' })] });
    expect((await handler(post({ action: 'handover', id: ROW_ID }))).statusCode).toBe(409);
    expect(h.db.state.sites[0].user_id).toBe('owner-1');
  });

  it('records a failed email, and resends with a sign-in link once they have signed in', async () => {
    h.db = fakeDb({ rows: [row({ site_id: SITE_ID })], sites: [site()] });
    postmark.freeSiteHandover.mockRejectedValueOnce(new Error('Postmark down'));
    const res = json(await handler(post({ action: 'handover', id: ROW_ID })));
    expect(res.emailError).toBe('Postmark down');
    expect(h.db.state.free_site_handovers[0].email_error).toBe('Postmark down');

    const user = h.db.state.authUsers[0];
    user.last_sign_in_at = '2026-10-08T13:00:00Z';
    const again = await handler(post({ action: 'handover-email', id: ROW_ID }));
    expect(again.statusCode).toBe(200);
    expect(postmark.freeSiteHandover).toHaveBeenLastCalledWith(expect.objectContaining({ newAccount: false, actionUrl: 'https://sitebuilder.autocaregenius.com' }));
    expect(h.db.state.free_site_handovers[0].email_error).toBeNull();
  });

  it('removing a row before the hand-over gives the site back to its builder', async () => {
    h.db = fakeDb({ rows: [row({ site_id: SITE_ID })], sites: [site()] });
    expect((await handler(post({ action: 'delete', id: ROW_ID }))).statusCode).toBe(200);
    expect(h.db.state.free_site_handovers).toEqual([]);
    expect(h.db.state.sites[0]).toEqual(expect.objectContaining({ user_id: 'admin-1', business_info: { businessName: 'Gloss Boss' } }));
  });
});

describe('free website hand-over email', () => {
  it('uses the free-plan tips, or the Pro ones when Pro came with it', () => {
    const base = { firstName: 'Dana', businessName: 'Gloss Boss', siteUrl: 'https://gloss.test', actionUrl: 'https://auth.test/x', newAccount: true, email: 'dana@gloss.test' };
    const free = postmark.freeSiteHandoverEmail(base);
    expect(free.subject).toBe('The Gloss Boss website is in your account');
    expect(free.html).toContain('Genius Websites');
    expect(free.html).not.toContain('Custom Websites');
    expect(free.text).toContain('then press Publish');
    expect(free.text).not.toContain('Stripe');
    expect(postmark.freeSiteHandoverEmail({ ...base, pro: true }).text).toContain('Stripe');
    // The custom website email is unchanged.
    expect(postmark.customSiteHandoverEmail(base).html).toContain('Custom Websites');
  });
});
