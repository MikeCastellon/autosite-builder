// tests/functions/custom-site-launch.test.js
//
// Custom website projects: the Launch card's save (custom-site-admin
// launch-save), which merges the card's change into design.launch and must
// keep every other design key. Supabase is an in-memory fake whose updates
// move updated_at like the table's trigger.
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
  return {
    ...real,
    customSiteWelcome: vi.fn(async () => ({})),
    customSiteDraft: vi.fn(async () => ({})),
    customSiteLive: vi.fn(async () => ({})),
    customSiteHandover: vi.fn(async () => ({})),
  };
});

const { handler: adminHandler } = await import('../../netlify/functions/custom-site-admin.js');
const { describeLaunchEvent } = await import('../../src/lib/customSiteLaunch.js');

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const EARLIER = '2026-10-01T12:00:00.000Z';

// Everything else the design holds: launch-save must leave it as it was.
const DESIGN = {
  businessInfo: { businessName: 'Gloss Boss', city: 'Austin', services: [{ name: 'Wash', price: '$40', description: '' }] },
  templateId: 'mobile_chrome',
  customColors: { accent: '#cc0000' },
  images: { logo: 'https://x.supabase.co/storage/v1/object/public/site-images/s/logo.jpg' },
  siteId: '22222222-3333-4444-8555-666666666666',
  levers: { fonts: { heading: 'Oswald' } },
};

function fakeDb({ projects = [], profiles = [ADMIN] } = {}) {
  const state = { projects, profiles, events: [], writes: 0, beforeUpdate: null };
  let clock = 0;
  const tableOf = (t) => ({ custom_site_projects: 'projects', custom_site_project_events: 'events', profiles: 'profiles' })[t];

  function run(q) {
    const key = tableOf(q.table);
    const eqs = q.ops.filter((o) => o[0] === 'eq');
    const match = (r) => eqs.every(([, c, v]) => r[c] === v);
    const op = (n) => q.ops.find((o) => o[0] === n);
    const single = op('single') || op('maybeSingle');
    if (op('insert')) {
      const row = { ...op('insert')[1], created_at: new Date().toISOString() };
      state[key].push(row);
      return { data: structuredClone(row), error: null };
    }
    if (op('update')) {
      // A concurrent write landing between this request's read and write.
      if (key === 'projects' && state.beforeUpdate) { const f = state.beforeUpdate; state.beforeUpdate = null; f(state); }
      const hits = state[key].filter(match);
      hits.forEach((r) => {
        Object.assign(r, structuredClone(op('update')[1]));
        // The trigger: every write moves updated_at.
        if (key === 'projects') { clock += 1; r.updated_at = `2026-10-05T12:00:${String(clock).padStart(2, '0')}.000000+00:00`; }
      });
      if (key === 'projects') state.writes += 1;
      if (single) return { data: hits[0] ? structuredClone(hits[0]) : null, error: null };
      return { error: null };
    }
    const hits = state[key].filter(match);
    return single ? { data: hits[0] ? structuredClone(hits[0]) : null, error: null } : { data: hits.map((r) => structuredClone(r)), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
      api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  return { from, state };
}

function project(extra = {}) {
  return {
    id: PROJECT_ID, token: 'tok_abcdefghijklmnopqrstuv', stage: 'in_review', client_first_name: 'Dana', client_email: 'dana@gloss.test',
    design: structuredClone(DESIGN), design_status: 'ready', updated_at: '2026-10-05T11:00:00.000000+00:00', ...extra,
  };
}

const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);
const save = (launch, id = PROJECT_ID) => adminHandler(post({ action: 'launch-save', id, launch }));
const stored = () => h.db.state.projects[0];

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 'admin-1' };
});

describe('custom-site-admin launch-save', () => {
  it('ticks an item with the server\'s date, keeps the rest of the design and logs it', async () => {
    h.db = fakeDb({ projects: [project()] });
    const before = Date.now();
    const res = await save({ checked: { domain: true } });
    expect(res.statusCode).toBe(200);
    const { design } = stored();
    const { launch, ...rest } = design;
    expect(rest).toEqual(DESIGN);
    expect(launch).toEqual({ checked: { domain: expect.any(String) }, round: 0, roundsIncluded: 3, notes: '' });
    expect(Date.parse(launch.checked.domain)).toBeGreaterThanOrEqual(before - 1000);
    expect(h.db.state.events).toEqual([expect.objectContaining({ project_id: PROJECT_ID, type: 'launch', data: { checked: ['domain'] }, actor: 'admin@acg.test' })]);
    // The saved project comes back like every other action's: link, no token.
    const { project: p } = json(res);
    expect(p.design.launch.checked.domain).toBe(launch.checked.domain);
    expect(p.formUrl).toMatch(/\/custom-site\?t=tok_/);
    expect(p.token).toBeUndefined();
  });

  it('keeps the first date of an item ticked again, unticks, and counts rounds', async () => {
    h.db = fakeDb({ projects: [project({ design: { ...structuredClone(DESIGN), launch: { checked: { domain: EARLIER, seo: EARLIER }, round: 3, roundsIncluded: 3 } } })] });
    await save({ checked: { domain: true, seo: false }, round: 4 });
    expect(stored().design.launch).toEqual({ checked: { domain: EARLIER }, round: 4, roundsIncluded: 3, notes: '' });
    const { data } = h.db.state.events[0];
    expect(data).toEqual({ unchecked: ['seo'], round: { from: 3, to: 4, of: 3 } });
    expect(describeLaunchEvent(data)).toBe('Launch list: unticked "SEO title/description checked"; revision round 4 of 3 (over the included rounds)');
  });

  it('saves notes without an activity entry, and writes nothing when nothing changed', async () => {
    h.db = fakeDb({ projects: [project()] });
    await save({ notes: '  Waiting on their domain login  ' });
    expect(stored().design.launch.notes).toBe('Waiting on their domain login');
    expect(h.db.state.events).toEqual([]);
    expect(h.db.state.writes).toBe(1);

    const res = await save({ notes: 'Waiting on their domain login', checked: { mobile: false }, round: -1 });
    expect(res.statusCode).toBe(200);
    expect(h.db.state.writes).toBe(1);
    expect(json(res).project.design.launch.notes).toBe('Waiting on their domain login');
  });

  it('works on a project whose design is still empty', async () => {
    h.db = fakeDb({ projects: [project({ design: {} })] });
    await save({ roundsIncluded: 5, round: 1 });
    expect(stored().design).toEqual({ launch: { checked: {}, round: 1, roundsIncluded: 5, notes: '' } });
    expect(h.db.state.events[0].data).toEqual({ roundsIncluded: { from: 3, to: 5 }, round: { from: 0, to: 1, of: 5 } });
  });

  it('never undoes a design save that lands between its read and its write', async () => {
    h.db = fakeDb({ projects: [project()] });
    h.db.state.beforeUpdate = (state) => {
      Object.assign(state.projects[0], { design: { ...state.projects[0].design, templateId: 'detailing_sporty' }, updated_at: '2026-10-05T11:30:00.000000+00:00' });
    };
    const res = await save({ checked: { mobile: true } });
    expect(res.statusCode).toBe(200);
    expect(stored().design.templateId).toBe('detailing_sporty');
    expect(stored().design.launch.checked.mobile).toEqual(expect.any(String));
    expect(h.db.state.events).toHaveLength(1);
  });

  it('gives up with 409 after 3 lost races, writing and logging nothing', async () => {
    h.db = fakeDb({ projects: [project()] });
    let n = 0;
    // Another save lands before every one of this request's writes.
    const bump = (state) => {
      n += 1;
      state.projects[0].updated_at = `2026-10-05T11:3${n}:00.000000+00:00`;
      state.beforeUpdate = bump;
    };
    h.db.state.beforeUpdate = bump;
    const res = await save({ checked: { mobile: true } });
    expect(res.statusCode).toBe(409);
    expect(n).toBe(3);
    expect(stored().design.launch).toBeUndefined();
    expect(h.db.state.events).toEqual([]);
  });

  it('cleans what the card sends', async () => {
    h.db = fakeDb({ projects: [project()] });
    await save({ checked: { domain: 'yes', made_up: true, mobile: true }, round: 99, roundsIncluded: 'lots', notes: 5, extra: 'x' });
    expect(stored().design.launch).toEqual({ checked: { mobile: expect.any(String) }, round: 20, roundsIncluded: 3, notes: '' });
  });

  it('answers 400 without a launch object and 404 for an unknown project', async () => {
    h.db = fakeDb({ projects: [project()] });
    expect((await adminHandler(post({ action: 'launch-save', id: PROJECT_ID }))).statusCode).toBe(400);
    expect((await adminHandler(post({ action: 'launch-save', id: PROJECT_ID, launch: [1] }))).statusCode).toBe(400);
    expect((await save({ round: 1 }, '99999999-2222-4333-8444-555555555555')).statusCode).toBe(404);
    expect(h.db.state.writes).toBe(0);
  });

  it('is for super admins only', async () => {
    h.db = fakeDb({ projects: [project()], profiles: [{ ...ADMIN, is_super_admin: false }] });
    expect((await save({ round: 1 })).statusCode).toBe(403);
    h.user = null;
    expect((await save({ round: 1 })).statusCode).toBe(401);
    expect(h.db.state.writes).toBe(0);
    expect(stored().design.launch).toBeUndefined();
  });
});
