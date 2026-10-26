// tests/functions/admin-user-update.test.js
//
// Admin user drawer > Account > Edit: admin-user-update corrects a
// customer's name / email / phone / business name, in auth.users and the
// profile, and fixes the hand-over rows that held the old values.
// Supabase is an in-memory fake.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const { handler } = await import('../../netlify/functions/admin-user-update.js');

const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const DEREK = {
  id: 'derek-1', email: 'derekfernande2023@gmail.com', first_name: 'Derek', last_name: 'Fernande',
  phone: '9392997779', business_name: 'Prime Auto Care', is_super_admin: false, stripe_customer_id: null,
};
const OTHER = { id: 'other-1', email: 'taken@shop.test', first_name: 'Ann', is_super_admin: false };

function freeRow(extra = {}) {
  return {
    id: 'free-1', customer_user_id: 'derek-1', client_first_name: 'Derek', client_last_name: 'Fernande',
    client_email: 'derekfernande2023@gmail.com', client_phone: '9392997779', business_name: 'Prime Auto Care',
    handed_over_at: '2026-10-25T21:11:18Z', ...extra,
  };
}

function fakeDb({ profiles = [ADMIN, DEREK, OTHER], free = [freeRow()], custom = [], authError = null, profileError = null } = {}) {
  const state = {
    profiles: profiles.map((p) => structuredClone(p)),
    free_site_handovers: free.map((r) => structuredClone(r)),
    custom_site_projects: custom.map((r) => structuredClone(r)),
    authUpdates: [],
  };
  function run(q) {
    const rows = state[q.table];
    if (!rows) throw new Error(`unexpected table ${q.table}`);
    const op = (n) => q.ops.find((o) => o[0] === n);
    const match = (r) => q.ops.filter((o) => o[0] === 'eq').every(([, c, v]) => r[c] === v);
    const single = op('single') || op('maybeSingle');
    const hits = rows.filter(match);
    if (op('update')) {
      if (q.table === 'profiles' && profileError) return { data: null, error: { message: profileError } };
      hits.forEach((r) => Object.assign(r, structuredClone(op('update')[1])));
    }
    const copy = (r) => (r ? structuredClone(r) : null);
    return single ? { data: copy(hits[0]), error: null } : { data: hits.map(copy), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'update', 'eq', 'limit']) {
      api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  const auth = {
    admin: {
      updateUserById: async (id, attrs) => {
        if (authError) return { data: null, error: { message: authError } };
        state.authUpdates.push({ id, ...attrs });
        return { data: { user: { id } }, error: null };
      },
    },
  };
  return { from, auth, state };
}

const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);
const profile = (id) => h.db.state.profiles.find((p) => p.id === id);

beforeEach(() => {
  h.user = { id: 'admin-1', email: 'admin@acg.test' };
  h.db = fakeDb();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('admin-user-update access', () => {
  it('is for super admins only', async () => {
    h.user = { id: 'other-1', email: 'taken@shop.test' };
    expect((await handler(post({ userId: 'derek-1', lastName: 'X' }))).statusCode).toBe(403);
    h.user = null;
    expect((await handler(post({ userId: 'derek-1', lastName: 'X' }))).statusCode).toBe(401);
    expect(profile('derek-1').last_name).toBe('Fernande');
  });

  it('needs a known user', async () => {
    expect((await handler(post({ lastName: 'X' }))).statusCode).toBe(400);
    expect((await handler(post({ userId: 'nobody', lastName: 'X' }))).statusCode).toBe(404);
  });
});

describe('admin-user-update names', () => {
  it('fixes the name on the profile, the sign-up metadata and the hand-over row', async () => {
    const res = await handler(post({ userId: 'derek-1', firstName: 'Derek', lastName: 'Fernandez' }));
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body.changed).toEqual(['last_name']);
    expect(body.profile).toMatchObject({ id: 'derek-1', first_name: 'Derek', last_name: 'Fernandez' });
    expect(body.profile.is_super_admin).toBeUndefined();
    expect(profile('derek-1').last_name).toBe('Fernandez');
    expect(h.db.state.authUpdates).toEqual([{ id: 'derek-1', user_metadata: { first_name: 'Derek', last_name: 'Fernandez' } }]);
    expect(h.db.state.free_site_handovers[0].client_last_name).toBe('Fernandez');
    // The email did not change, so there is nothing to send again.
    expect(body.handovers).toEqual([]);
  });

  it('writes nothing when nothing changed', async () => {
    const res = await handler(post({ userId: 'derek-1', firstName: 'Derek', email: 'DerekFernande2023@gmail.com' }));
    expect(json(res).changed).toEqual([]);
    expect(h.db.state.authUpdates).toEqual([]);
  });

  it('may rename an admin account', async () => {
    const res = await handler(post({ userId: 'admin-1', firstName: 'Mike' }));
    expect(res.statusCode).toBe(200);
    expect(profile('admin-1').first_name).toBe('Mike');
  });
});

describe('admin-user-update email', () => {
  it('changes the sign-in email, the profile and the hand-over rows, and lists the rows to email again', async () => {
    h.db = fakeDb({
      custom: [
        freeRow({ id: 'custom-1' }),
        // Not handed over yet: fixed, but there is no access email to resend.
        freeRow({ id: 'custom-2', handed_over_at: null }),
        // The team typed a different address on purpose: it stays.
        freeRow({ id: 'custom-3', client_email: 'office@prime.test' }),
      ],
    });
    const res = await handler(post({ userId: 'derek-1', lastName: 'Fernandez', email: 'DerekFernandez2023@gmail.com' }));
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body.profile.email).toBe('derekfernandez2023@gmail.com');
    expect(h.db.state.authUpdates).toEqual([{
      id: 'derek-1', email: 'derekfernandez2023@gmail.com', email_confirm: true,
      user_metadata: { first_name: 'Derek', last_name: 'Fernandez' },
    }]);
    expect(profile('derek-1').email).toBe('derekfernandez2023@gmail.com');
    expect(h.db.state.free_site_handovers[0].client_email).toBe('derekfernandez2023@gmail.com');
    const custom = Object.fromEntries(h.db.state.custom_site_projects.map((r) => [r.id, r.client_email]));
    expect(custom).toEqual({
      'custom-1': 'derekfernandez2023@gmail.com',
      'custom-2': 'derekfernandez2023@gmail.com',
      'custom-3': 'office@prime.test',
    });
    expect(body.handovers).toEqual([{ kind: 'free', id: 'free-1' }, { kind: 'custom', id: 'custom-1' }]);
    expect(body.stripeCustomer).toBe(false);
  });

  it('refuses an email another account uses', async () => {
    const res = await handler(post({ userId: 'derek-1', email: 'taken@shop.test' }));
    expect(res.statusCode).toBe(409);
    expect(h.db.state.authUpdates).toEqual([]);
    expect(profile('derek-1').email).toBe('derekfernande2023@gmail.com');
  });

  it('refuses when auth says the email is taken (no profile for it)', async () => {
    h.db = fakeDb({ authError: 'A user with this email address has already been registered' });
    const res = await handler(post({ userId: 'derek-1', email: 'ghost@shop.test' }));
    expect(res.statusCode).toBe(409);
    expect(profile('derek-1').email).toBe('derekfernande2023@gmail.com');
  });

  it('refuses an invalid email', async () => {
    const res = await handler(post({ userId: 'derek-1', email: 'derek@' }));
    expect(res.statusCode).toBe(400);
    expect(h.db.state.authUpdates).toEqual([]);
  });

  it('never changes an admin account\'s email', async () => {
    const res = await handler(post({ userId: 'admin-1', email: 'new-admin@acg.test' }));
    expect(res.statusCode).toBe(403);
    expect(h.db.state.authUpdates).toEqual([]);
    expect(profile('admin-1').email).toBe('admin@acg.test');
  });

  it('says when Stripe keeps the old email', async () => {
    h.db = fakeDb({ profiles: [ADMIN, { ...DEREK, stripe_customer_id: 'cus_123' }, OTHER] });
    const res = await handler(post({ userId: 'derek-1', email: 'derekfernandez2023@gmail.com' }));
    expect(json(res).stripeCustomer).toBe(true);
  });

  it('asks to save again when the profile write fails after the sign-in email changed', async () => {
    h.db = fakeDb({ profileError: 'boom' });
    const res = await handler(post({ userId: 'derek-1', email: 'derekfernandez2023@gmail.com' }));
    expect(res.statusCode).toBe(500);
    expect(json(res).error).toMatch(/Save again/);
    expect(h.db.state.free_site_handovers[0].client_email).toBe('derekfernande2023@gmail.com');
  });
});
