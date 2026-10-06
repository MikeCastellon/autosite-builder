// tests/functions/custom-site-reference.test.js
//
// Reference screenshots the admin adds in the Design step ("Match its
// layout" only looks at screenshots, never at a live site):
// custom-site-admin `reference-upload-url` mints a signed upload into the
// project's private reference folder, `reference-add` records the landed
// file on project.assets. Supabase (tables and storage) is an in-memory
// fake.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const { handler } = await import('../../netlify/functions/custom-site-admin.js');
const { REFERENCE_SHOT_MAX_BYTES } = await import('../../src/lib/designSuggest.js');

const PID = '11111111-2222-4333-8444-555555555555';
const OTHER_PID = '99999999-2222-4333-8444-555555555555';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const BUCKET = 'custom-site-assets';
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const path = (kind, n, ext = 'png', pid = PID) => `${pid}/${kind}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;

const CUSTOMER_ASSETS = [
  { path: path('logo', 1), kind: 'logo', name: 'logo.png', size: 100, type: 'image/png' },
  { path: path('reference', 2, 'jpg'), kind: 'reference', name: 'ref.jpg', size: 100, type: 'image/jpeg', note: 'love the dark look' },
];

function project(extra = {}) {
  return {
    id: PID, token: 'tok_abcdefghijklmnopqrstuv', stage: 'designing', client_first_name: 'Dana', client_email: 'dana@gloss.test',
    business_name: 'Gloss Boss', form: { businessName: 'Gloss Boss' }, assets: CUSTOMER_ASSETS.map((a) => ({ ...a })),
    design: { templateId: 'mobile_chrome' }, updated_at: '2026-10-06T08:00:00.000Z', ...extra,
  };
}

// Projects carry updated_at, moved on every write as the table's trigger
// does; `state.beforeUpdate` runs once just before the next update, to
// stand in for the customer's autosave landing between a read and a write.
// Storage objects live in `state.objects` (path → metadata).
function fakeDb({ projects = [], profiles = [ADMIN], objects = {} } = {}) {
  const state = {
    projects, profiles, events: [], objects: { ...objects }, signed: [], removed: [], lists: [], updates: 0,
    clock: 0, beforeUpdate: null, failSign: false,
  };
  state.tick = () => new Date(Date.UTC(2026, 9, 6, 9, 0, 0, ++state.clock)).toISOString();
  const tableOf = { custom_site_projects: 'projects', custom_site_project_events: 'events', profiles: 'profiles' };
  function run(q) {
    const key = tableOf[q.table];
    if (!key) throw new Error(`unexpected table ${q.table}`);
    const rows = state[key];
    const match = (r) => q.ops.filter((o) => o[0] === 'eq').every(([, c, v]) => r[c] === v);
    const op = (n) => q.ops.find((o) => o[0] === n);
    if (op('insert')) {
      rows.push({ ...op('insert')[1], created_at: new Date().toISOString() });
      return { error: null };
    }
    const single = op('single') || op('maybeSingle');
    if (op('update')) {
      const hook = state.beforeUpdate;
      state.beforeUpdate = null;
      if (hook) hook();
      state.updates += 1;
      const hits = rows.filter(match);
      hits.forEach((r) => Object.assign(r, structuredClone(op('update')[1]), key === 'projects' ? { updated_at: state.tick() } : {}));
      return single ? { data: hits[0] ? structuredClone(hits[0]) : null, error: null } : { error: null };
    }
    const hits = rows.filter(match);
    return single ? { data: structuredClone(hits[0] || null), error: null } : { data: hits.map((r) => structuredClone(r)), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'eq', 'order', 'limit']) api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  const storage = {
    from: (bucket) => ({
      createSignedUploadUrl: async (p) => {
        state.signed.push({ bucket, path: p });
        if (state.failSign) return { data: null, error: { message: 'storage down' } };
        return { data: { path: p, token: `upload-token-${state.signed.length}`, signedUrl: `https://storage.test/object/upload/sign/${bucket}/${p}?token=t` }, error: null };
      },
      list: async (folder, opts = {}) => {
        state.lists.push({ bucket, folder, opts });
        const data = Object.entries(state.objects)
          .filter(([p]) => p.startsWith(`${folder}/`) && !p.slice(folder.length + 1).includes('/'))
          .map(([p, metadata]) => ({ name: p.slice(folder.length + 1), id: `obj-${p}`, metadata }))
          .filter((f) => !opts.search || f.name.includes(opts.search));
        return { data, error: null };
      },
      remove: async (paths) => {
        state.removed.push(...paths);
        for (const p of paths) delete state.objects[p];
        return { data: [], error: null };
      },
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}?token=s` })), error: null }),
    }),
  };
  return { from, storage, state };
}

const post = (body) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer admin-token' }, body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);
const uploadUrl = (extra = {}) => handler(post({ action: 'reference-upload-url', id: PID, fileName: 'home.png', size: 2_000_000, type: 'image/png', ...extra }));
const SHOT = path('reference', 30);
const add = (extra = {}) => handler(post({
  action: 'reference-add', id: PID, path: SHOT, name: 'Home page.png', size: 2_000_000, type: 'image/png',
  note: 'Screenshot of https://refshop.test/ - hero', ...extra,
}));

beforeEach(() => {
  h.user = { id: 'admin-1' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('reference-upload-url', () => {
  it('mints a signed upload into the project\'s reference folder', async () => {
    h.db = fakeDb({ projects: [project()] });
    const res = await uploadUrl();
    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body.path).toMatch(new RegExp(`^${PID}/reference/${UUID_RE}\\.png$`));
    expect(body).toEqual({ path: body.path, uploadToken: 'upload-token-1', signedUrl: expect.stringContaining(body.path), type: 'image/png' });
    expect(h.db.state.signed).toEqual([{ bucket: BUCKET, path: body.path }]);
    // A .jpeg is stored as .jpg; each upload gets its own name.
    const second = json(await uploadUrl({ fileName: 'Home.JPEG', type: 'image/jpeg' }));
    expect(second.path).toMatch(/\.jpg$/);
    expect(second.path).not.toBe(body.path);
    // Nothing is recorded until reference-add.
    expect(h.db.state.updates).toBe(0);
  });

  it('refuses other formats, empty or oversized files and a full project, minting nothing', async () => {
    h.db = fakeDb({ projects: [project()] });
    const refused = [
      { fileName: 'home.gif', type: 'image/gif' },
      { fileName: 'logo.svg', type: 'image/svg+xml' },
      { fileName: 'IMG_1.heic', type: 'image/heic' },
      { fileName: 'brief.pdf', type: 'application/pdf' },
      { fileName: 'home.png', type: 'image/jpeg' },
      { size: 0 },
      { size: 'lots' },
      { size: REFERENCE_SHOT_MAX_BYTES + 1 },
    ];
    for (const extra of refused) {
      const res = await uploadUrl(extra);
      expect(res.statusCode).toBe(400);
      expect(json(res).error).toBeTruthy();
    }
    expect((await uploadUrl({ size: REFERENCE_SHOT_MAX_BYTES })).statusCode).toBe(200);

    // The team's own 30 fill its room; the customer's 30 don't touch it
    // (their form counts only theirs, so each side has its own room).
    const full = Array.from({ length: 30 }, (_, i) => ({ path: path('reference', 100 + i), kind: 'reference', name: `r${i}.png`, size: 1, addedBy: 'admin' }));
    h.db = fakeDb({ projects: [project({ assets: full })] });
    const res = await uploadUrl();
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toMatch(/already added 30 reference screenshots/);
    expect(h.db.state.signed).toEqual([]);
    h.db = fakeDb({ projects: [project({ assets: full.map(({ addedBy, ...a }) => a) })] });
    expect((await uploadUrl()).statusCode).toBe(200);
  });

  it('answers 404 for an unknown project and 500 when storage won\'t sign', async () => {
    h.db = fakeDb({ projects: [project()] });
    expect((await uploadUrl({ id: OTHER_PID })).statusCode).toBe(404);
    h.db.state.failSign = true;
    const res = await uploadUrl();
    expect(res.statusCode).toBe(500);
    expect(json(res).error).toBe('Could not start the upload. Try again.');
  });
});

describe('reference-add', () => {
  it('records the landed screenshot as an admin reference image and keeps the customer\'s uploads', async () => {
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 1_234_567, mimetype: 'image/png' } } });
    const res = await add();
    expect(res.statusCode).toBe(200);
    const { project: saved, asset } = json(res);
    const stored = {
      path: SHOT, kind: 'reference', name: 'Home page.png', size: 1_234_567, type: 'image/png',
      note: 'Screenshot of https://refshop.test/ - hero', addedBy: 'admin',
    };
    expect(h.db.state.projects[0].assets).toEqual([...CUSTOMER_ASSETS, stored]);
    // The admin's view: no token, the form link instead; the new file with links to show it.
    expect(saved.token).toBeUndefined();
    expect(saved.formUrl).toMatch(/custom-site\?t=tok_/);
    expect(saved.assets).toEqual([...CUSTOMER_ASSETS, stored]);
    expect(asset).toEqual({ ...stored, url: `https://files.test/${SHOT}?token=s`, downloadUrl: `https://files.test/${SHOT}?token=s&download=Home%20page.png` });
    expect(h.db.state.lists).toEqual([{ bucket: BUCKET, folder: `${PID}/reference`, opts: expect.objectContaining({ search: SHOT.split('/').pop() }) }]);
    expect(h.db.state.events).toEqual([expect.objectContaining({
      project_id: PID, type: 'reference_added', actor: 'admin@acg.test', data: { name: 'Home page.png', path: SHOT },
    })]);
  });

  it('records the same file once', async () => {
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    expect((await add()).statusCode).toBe(200);
    const again = await add({ note: 'changed' });
    expect(again.statusCode).toBe(200);
    expect(h.db.state.projects[0].assets.filter((a) => a.path === SHOT)).toHaveLength(1);
    expect(json(again).asset.note).toBe('Screenshot of https://refshop.test/ - hero');
    expect(h.db.state.events).toHaveLength(1);
  });

  it('takes only screenshots in this project\'s reference folder that have landed', async () => {
    const otherShot = path('reference', 30, 'png', OTHER_PID);
    h.db = fakeDb({
      projects: [project()],
      objects: { [otherShot]: { size: 100 }, [path('photo', 31)]: { size: 100 }, [path('reference', 32, 'gif')]: { size: 100 } },
    });
    for (const p of [otherShot, path('photo', 31), path('reference', 32, 'gif'), `${PID}/reference/home.png`, `${PID}/reference/../photo/x.png`, '', null]) {
      const res = await add({ path: p });
      expect(res.statusCode).toBe(400);
      expect(json(res).error).toBe('That upload isn\'t a screenshot in this project\'s reference folder');
    }
    // A JPEG type for a .png path.
    h.db.state.objects[SHOT] = { size: 100 };
    expect((await add({ type: 'image/jpeg' })).statusCode).toBe(400);
    // Never uploaded.
    delete h.db.state.objects[SHOT];
    const missing = await add();
    expect(missing.statusCode).toBe(400);
    expect(json(missing).error).toBe('The screenshot didn\'t finish uploading. Try again.');
    expect(h.db.state.updates).toBe(0);
    expect(h.db.state.projects[0].assets).toEqual(CUSTOMER_ASSETS);
    expect(h.db.state.events).toEqual([]);
  });

  it('goes by the stored size: an oversized file is removed again', async () => {
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: REFERENCE_SHOT_MAX_BYTES + 1 } } });
    const res = await add({ size: 1000 });
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toMatch(/over 10 MB/);
    expect(h.db.state.removed).toEqual([SHOT]);
    expect(h.db.state.objects[SHOT]).toBeUndefined();
    expect(h.db.state.projects[0].assets).toEqual(CUSTOMER_ASSETS);
  });

  it('never removes or re-records a file the project already holds, such as the customer\'s own large upload', async () => {
    // The customer's form takes inspiration files up to 25 MB, in this same
    // folder: past the screenshot limit, so the size check must not reach it.
    const theirs = { path: path('reference', 41), kind: 'reference', name: 'their-site.png', size: 20_000_000, type: 'image/png' };
    h.db = fakeDb({ projects: [project({ assets: [...CUSTOMER_ASSETS, theirs] })], objects: { [theirs.path]: { size: 20_000_000 } } });
    const res = await add({ path: theirs.path, size: 1000 });
    expect(res.statusCode).toBe(200);
    expect(json(res).asset).toEqual(expect.objectContaining({ ...theirs, url: expect.any(String) }));
    expect(json(res).asset).not.toHaveProperty('addedBy');
    expect(h.db.state.removed).toEqual([]);
    expect(h.db.state.objects[theirs.path]).toEqual({ size: 20_000_000 });
    expect(h.db.state.lists).toEqual([]);
    expect(h.db.state.updates).toBe(0);
    expect(h.db.state.events).toEqual([]);
    expect(h.db.state.projects[0].assets).toEqual([...CUSTOMER_ASSETS, theirs]);
  });

  it('keeps a customer upload that lands between reading and writing', async () => {
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    const theirs = { path: path('photo', 40, 'jpg'), kind: 'photo', name: 'car.jpg', size: 100, type: 'image/jpeg' };
    h.db.state.beforeUpdate = () => {
      const row = h.db.state.projects[0];
      row.assets = [...row.assets, theirs];
      row.updated_at = h.db.state.tick();
    };
    const res = await add();
    expect(res.statusCode).toBe(200);
    expect(h.db.state.projects[0].assets.map((a) => a.path)).toEqual([...CUSTOMER_ASSETS.map((a) => a.path), theirs.path, SHOT]);
    expect(h.db.state.updates).toBe(2);
  });

  it('cleans the note and names an unnamed file', async () => {
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    await add({ name: '', note: `  Screenshot of https://refshop.test/\n\n- the hero ${'x'.repeat(600)}` });
    const saved = h.db.state.projects[0].assets.at(-1);
    expect(saved.name).toBe('screenshot.png');
    expect(saved.note.startsWith('Screenshot of https://refshop.test/ - the hero x')).toBe(true);
    expect(saved.note.length).toBeLessThanOrEqual(500);
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    await add({ note: '   ' });
    expect(h.db.state.projects[0].assets.at(-1)).not.toHaveProperty('note');
  });

  it('keeps a viewable extension on the name, so the screenshot can be matched', async () => {
    const { checkReferenceChoice } = await import('../../src/lib/designSuggest.js');
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    await add({ name: 'Home page' });
    const saved = h.db.state.projects[0].assets.at(-1);
    expect(saved.name).toBe('Home page.png');
    const check = checkReferenceChoice({ mode: 'match', source: { kind: 'asset', path: SHOT } }, h.db.state.projects[0]);
    expect(check.error).toBe('');
    expect(check.shots.map((a) => a.path)).toEqual([SHOT]);
    // A name that already ends in one stays as it is.
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    await add({ name: 'Top.JPEG.png' });
    expect(h.db.state.projects[0].assets.at(-1).name).toBe('Top.JPEG.png');
  });

  it('records a tile of a cut-up screenshot with its group and part, and a match sends the group top first', async () => {
    const { checkReferenceChoice } = await import('../../src/lib/designSuggest.js');
    const GROUP = 'rs-home-1a2b3c4d';
    const tiles = [3, 1, 2].map((part) => ({ part, path: path('reference', 50 + part) }));
    h.db = fakeDb({ projects: [project()], objects: Object.fromEntries(tiles.map((t) => [t.path, { size: 100 }])) });
    // Parallel uploads may land out of order.
    for (const t of tiles) {
      const res = await add({ path: t.path, name: `Home page (${t.part} of 3).png`, group: GROUP, part: t.part });
      expect(res.statusCode).toBe(200);
      expect(json(res).asset).toEqual(expect.objectContaining({ path: t.path, group: GROUP, part: t.part, addedBy: 'admin' }));
    }
    const saved = h.db.state.projects[0].assets.slice(CUSTOMER_ASSETS.length);
    expect(saved.map((a) => [a.group, a.part])).toEqual([[GROUP, 3], [GROUP, 1], [GROUP, 2]]);
    expect(h.db.state.events.map((e) => e.data)).toEqual(tiles.map((t) => ({
      name: `Home page (${t.part} of 3).png`, path: t.path, group: GROUP, part: t.part,
    })));
    // Whichever tile is picked, the match takes the whole screenshot in order.
    const check = checkReferenceChoice({ mode: 'match', source: { kind: 'asset', path: tiles[0].path } }, h.db.state.projects[0]);
    expect(check.error).toBe('');
    expect(check.shots.map((a) => a.part)).toEqual([1, 2, 3]);

    // A retried tile (a new upload, same group and part) is recorded once.
    const retry = path('reference', 60);
    h.db.state.objects[retry] = { size: 100 };
    const again = await add({ path: retry, group: GROUP, part: 2 });
    expect(again.statusCode).toBe(200);
    expect(json(again).asset.path).toBe(path('reference', 52));
    expect(h.db.state.projects[0].assets).toHaveLength(CUSTOMER_ASSETS.length + 3);
    expect(h.db.state.events).toHaveLength(3);
  });

  it('refuses a malformed group or part before recording anything', async () => {
    h.db = fakeDb({ projects: [project()], objects: { [SHOT]: { size: 100 } } });
    for (const extra of [
      { group: 'rs-home-1a2b3c4d' }, { part: 1 }, { group: 'rs-home-1a2b3c4d', part: 0 }, { group: 'rs-home-1a2b3c4d', part: 5 },
      { group: 'rs-home-1a2b3c4d', part: '2' }, { group: 'rs-home-1a2b3c4d', part: 1.5 }, { group: 'Home Page', part: 1 },
      { group: 'short', part: 1 }, { group: '../../photo-12345', part: 1 }, { group: { id: 'x' }, part: 1 },
    ]) {
      const res = await add(extra);
      expect(res.statusCode).toBe(400);
      expect(json(res).error).toMatch(/screenshot part isn't valid/);
    }
    expect(h.db.state.lists).toEqual([]);
    expect(h.db.state.updates).toBe(0);
    // Empty fields are a single screenshot.
    expect((await add({ group: null, part: null })).statusCode).toBe(200);
    const saved = h.db.state.projects[0].assets.at(-1);
    expect(saved).not.toHaveProperty('group');
    expect(saved).not.toHaveProperty('part');
  });

  it('refuses a project whose team screenshots are full, whatever the customer uploaded', async () => {
    const full = Array.from({ length: 30 }, (_, i) => ({ path: path('reference', 100 + i), kind: 'reference', name: `r${i}.png`, size: 1, addedBy: 'admin' }));
    h.db = fakeDb({ projects: [project({ assets: full })], objects: { [SHOT]: { size: 100 } } });
    const res = await add();
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toMatch(/already added 30 reference screenshots/);
    expect(h.db.state.updates).toBe(0);
    // 30 of the customer's own leave the team's room free.
    const theirs = full.map(({ addedBy, ...a }) => a);
    h.db = fakeDb({ projects: [project({ assets: theirs })], objects: { [SHOT]: { size: 100 } } });
    expect((await add()).statusCode).toBe(200);
    expect(h.db.state.projects[0].assets).toHaveLength(31);
  });
});

describe('reference uploads are for super admins only', () => {
  it('signs and records nothing for anyone else', async () => {
    h.db = fakeDb({ projects: [project()], profiles: [{ ...ADMIN, is_super_admin: false }], objects: { [SHOT]: { size: 100 } } });
    expect((await uploadUrl()).statusCode).toBe(403);
    expect((await add()).statusCode).toBe(403);
    h.user = null;
    expect((await uploadUrl()).statusCode).toBe(401);
    expect((await add()).statusCode).toBe(401);
    expect(h.db.state.signed).toEqual([]);
    expect(h.db.state.updates).toBe(0);
    expect(h.db.state.projects[0].assets).toEqual(CUSTOMER_ASSETS);
  });
});
