// tests/functions/custom-site-form-assets.test.js
//
// The customer's form (custom-site-form) and the screenshots the team adds
// to the same project.assets list (custom-site-admin reference-add,
// addedBy: 'admin'). The team's files are the team's: the form never lists
// or counts them, and no save or submit can drop, change, remove or forge
// one, even when the team's write lands between the form's read and write.
// Supabase is an in-memory fake whose projects move updated_at on every
// write, like the table's trigger.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
}));

vi.mock('../../netlify/functions/_lib/postmark.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    customSiteFormToAdmin: vi.fn(async () => ({ MessageID: 'm1' })),
    customSiteReceivedToCustomer: vi.fn(async () => ({ MessageID: 'm2' })),
  };
});

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { handler } = await import('../../netlify/functions/custom-site-form.js');
const {
  ASSET_KINDS, customerAssets, describeEvent, isTeamAsset, mergeFormAssets,
} = await import('../../src/lib/customSiteForm.js');

const PID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'tok_abcdefghijklmnopqrstuv';
const path = (kind, n, ext = 'png') => `${PID}/${kind}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;

const LOGO = { path: path('logo', 1), kind: 'logo', name: 'logo.png', size: 100, type: 'image/png' };
const REF = { path: path('reference', 2, 'jpg'), kind: 'reference', name: 'ref.jpg', size: 100, type: 'image/jpeg', note: 'love the dark look' };
// Two tiles of one tall screenshot the team uploaded (shared contract:
// group + part).
const TEAM_1 = {
  path: path('reference', 30), kind: 'reference', name: 'home-1.png', size: 2000, type: 'image/png',
  note: 'Screenshot of https://reference-shop.test/', addedBy: 'admin', group: 'grp-12345678', part: 1,
};
const TEAM_2 = { ...TEAM_1, path: path('reference', 31), name: 'home-2.png', part: 2 };

function project(extra = {}) {
  return {
    id: PID, token: TOKEN, stage: 'form_started', client_first_name: 'Dana', client_name: 'Dana Gloss',
    client_email: 'dana@gloss.test', client_phone: null, business_name: 'Gloss Boss', created_by: 'admin-1',
    form: { contactName: 'Dana' }, assets: [LOGO, REF, TEAM_1].map((a) => structuredClone(a)),
    form_started_at: '2026-10-01T00:00:00Z', form_saved_at: null, form_submitted_at: null,
    updated_at: '2026-10-06T08:00:00.000Z', ...extra,
  };
}

// `state.beforeUpdate` runs just before the next project update (once,
// unless `state.everyUpdate`), to stand in for the team's write landing
// between the form's read and its write.
function fakeDb({ projects = [project()], profiles = [{ id: 'admin-1', email: 'admin@acg.test' }] } = {}) {
  const state = {
    projects, profiles, events: [], signedFor: [], updates: 0, clock: 0, beforeUpdate: null, everyUpdate: false,
  };
  state.tick = () => new Date(Date.UTC(2026, 9, 6, 9, 0, 0, ++state.clock)).toISOString();
  const tableOf = { custom_site_projects: 'projects', custom_site_project_events: 'events', profiles: 'profiles' };
  function run(q) {
    const op = (n) => q.ops.find((o) => o[0] === n);
    if (q.table === 'request_log') return op('insert') ? { error: null } : { count: 0, error: null };
    const key = tableOf[q.table];
    if (!key) throw new Error(`unexpected table ${q.table}`);
    const rows = state[key];
    const inOp = op('in');
    const match = (r) => q.ops.filter((o) => o[0] === 'eq').every(([, c, v]) => r[c] === v)
      && (!inOp || inOp[2].includes(r[inOp[1]]));
    const single = op('single') || op('maybeSingle');
    if (op('insert')) {
      rows.push(structuredClone(op('insert')[1]));
      return { error: null };
    }
    if (op('update')) {
      if (key === 'projects' && state.beforeUpdate) {
        const hook = state.beforeUpdate;
        if (!state.everyUpdate) state.beforeUpdate = null;
        hook(state.projects[0]);
      }
      if (key === 'projects') state.updates += 1;
      const hits = rows.filter(match);
      hits.forEach((r) => Object.assign(r, structuredClone(op('update')[1]), key === 'projects' ? { updated_at: state.tick() } : {}));
      if (single) return { data: hits[0] ? { id: hits[0].id } : null, error: null };
      return op('select') ? { data: hits.map((r) => ({ id: r.id })), error: null } : { error: null };
    }
    const hits = rows.filter(match);
    return single ? { data: structuredClone(hits[0] || null), error: null } : { data: hits.map((r) => structuredClone(r)), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'eq', 'in', 'gte', 'order', 'limit']) api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  const storage = {
    from: () => ({
      createSignedUploadUrl: async (p) => ({ data: { path: p, token: 'upload-token' }, error: null }),
      createSignedUrls: async (paths) => {
        state.signedFor.push(...paths);
        return { data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}?token=s` })), error: null };
      },
    }),
  };
  return { from, storage, state };
}

// The team's reference-add, landing on the stored row: appends and moves
// updated_at, as the trigger does.
const teamAdds = (asset) => (row) => {
  row.assets = [...row.assets, structuredClone(asset)];
  row.updated_at = `moved-by-team-${asset.path}`;
};

const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
const get = () => handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: TOKEN } });
const json = (res) => JSON.parse(res.body);
const FORM = { contactName: 'Dana', contactEmail: 'dana@gloss.test', businessName: 'Gloss Boss' };
const save = (assets, action = 'save') => handler(post({ action, t: TOKEN, form: FORM, assets }));
const stored = () => h.db.state.projects[0].assets;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CUSTOM_SITES_EMAIL;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the customer form never shows the team\'s screenshots', () => {
  it('GET lists only the customer\'s own files and signs no link for the team\'s', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO, TEAM_1, REF, TEAM_2] })] });
    const res = await get();
    expect(res.statusCode).toBe(200);
    const { assets } = json(res).project;
    expect(assets.map((a) => a.path)).toEqual([LOGO.path, REF.path]);
    expect(JSON.stringify(json(res))).not.toContain('addedBy');
    expect(JSON.stringify(json(res))).not.toContain(TEAM_1.path);
    expect(h.db.state.signedFor).toEqual([LOGO.path, REF.path]);
  });

  it('GET with only team files signs nothing', async () => {
    h.db = fakeDb({ projects: [project({ assets: [TEAM_1] })] });
    expect(json(await get()).project.assets).toEqual([]);
    expect(h.db.state.signedFor).toEqual([]);
  });
});

describe('the customer\'s upload count leaves the team\'s files out', () => {
  const refs = (n) => Array.from({ length: n }, (_, i) => ({ ...REF, path: path('reference', 100 + i, 'jpg') }));
  const uploadRef = () => handler(post({ action: 'upload-url', t: TOKEN, kind: 'reference', fileName: 'shot.png', size: 2000 }));

  it('still has room when the team\'s screenshots would fill the kind', async () => {
    const max = ASSET_KINDS.reference.max;
    const team = Array.from({ length: 5 }, (_, i) => ({ ...TEAM_1, path: path('reference', 200 + i) }));
    h.db = fakeDb({ projects: [project({ assets: [...refs(max - 1), ...team] })] });
    const res = await uploadRef();
    expect(res.statusCode).toBe(200);
    expect(json(res).path).toMatch(new RegExp(`^${PID}/reference/`));
  });

  it('is full once the customer\'s own files reach the limit', async () => {
    h.db = fakeDb({ projects: [project({ assets: [...refs(ASSET_KINDS.reference.max), TEAM_1] })] });
    expect((await uploadRef()).statusCode).toBe(400);
  });
});

describe('save and submit keep the team\'s files', () => {
  it('a save whose list omits the team\'s screenshot keeps it, exactly as stored', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO, REF, TEAM_1, TEAM_2] })] });
    const res = await save([LOGO]);
    expect(res.statusCode).toBe(200);
    // The customer removed their own REF; the team's tiles stay, group and
    // part included.
    expect(stored()).toEqual([LOGO, TEAM_1, TEAM_2]);
  });

  it('an empty list removes the customer\'s files only', async () => {
    h.db = fakeDb();
    await save([]);
    expect(stored()).toEqual([TEAM_1]);
  });

  it('a list naming a team path can neither change nor duplicate it', async () => {
    h.db = fakeDb();
    // A page loaded before the form hid them still holds the team entry;
    // a forged one rewrites its note, strips addedBy and changes its kind.
    const forged = { path: TEAM_1.path, kind: 'reference', name: 'mine.png', size: 1, note: 'mine now' };
    await save([LOGO, REF, forged, structuredClone(TEAM_1)]);
    expect(stored()).toEqual([LOGO, REF, TEAM_1]);
    expect(stored().filter((a) => a.path === TEAM_1.path)).toHaveLength(1);
  });

  it('a customer file claiming addedBy is never stored as the team\'s', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO] })] });
    const claim = { path: path('reference', 40), kind: 'reference', name: 'x.png', size: 5, addedBy: 'admin', group: 'grp-12345678', part: 1 };
    await save([LOGO, claim]);
    expect(stored()).toEqual([LOGO]);
    expect(stored().some(isTeamAsset)).toBe(false);
    // Nor does it show up as the team's file to the customer later.
    expect(json(await get()).project.assets.map((a) => a.path)).toEqual([LOGO.path]);
  });

  it('a team screenshot the team removed can\'t come back from a stale page', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO] })] });
    await save([LOGO, structuredClone(TEAM_1)]);
    expect(stored()).toEqual([LOGO]);
  });

  it('stale team entries don\'t use up the customer\'s room for their own files', async () => {
    const max = ASSET_KINDS.reference.max;
    const own = Array.from({ length: max }, (_, i) => ({ ...REF, path: path('reference', 300 + i, 'jpg') }));
    h.db = fakeDb({ projects: [project({ assets: [TEAM_1] })] });
    await save([structuredClone(TEAM_1), ...own]);
    expect(customerAssets(stored())).toHaveLength(max);
    expect(stored().filter(isTeamAsset)).toEqual([TEAM_1]);
  });

  it('a screenshot the team adds between the form\'s read and write is kept', async () => {
    h.db = fakeDb();
    h.db.state.beforeUpdate = teamAdds(TEAM_2);
    const res = await save([LOGO, REF]);
    expect(res.statusCode).toBe(200);
    // The first write missed (updated_at moved), the second re-merged.
    expect(h.db.state.updates).toBe(2);
    expect(stored()).toEqual([LOGO, REF, TEAM_1, TEAM_2]);
    expect(h.db.state.projects[0].form).toEqual(FORM);
  });

  it('gives up with a 409 and writes nothing when the row keeps changing', async () => {
    h.db = fakeDb();
    let n = 0;
    h.db.state.everyUpdate = true;
    h.db.state.beforeUpdate = (row) => { row.updated_at = `moved-${n += 1}`; };
    const res = await save([LOGO]);
    expect(res.statusCode).toBe(409);
    expect(json(res).error).toMatch(/try again/i);
    expect(h.db.state.updates).toBe(3);
    expect(stored()).toEqual([LOGO, REF, TEAM_1]);
    expect(h.db.state.projects[0].form_saved_at).toBeNull();
  });

  it('stops with the inactive-link 404 when the project is archived or its link reset mid-save', async () => {
    const changes = {
      archived: (row) => { row.stage = 'archived'; row.updated_at = 'moved-archived'; },
      'link reset': (row) => { row.token = 'tok_zyxwvutsrqponmlkjihgfe'; row.updated_at = 'moved-reset'; },
    };
    for (const change of Object.values(changes)) {
      h.db = fakeDb();
      h.db.state.beforeUpdate = change;
      const res = await save([LOGO]);
      expect(res.statusCode).toBe(404);
      expect(json(res).error).toMatch(/isn't active/);
      // The one write tried missed (updated_at moved), and none followed.
      expect(h.db.state.updates).toBe(1);
      expect(stored()).toEqual([LOGO, REF, TEAM_1]);
      expect(h.db.state.projects[0].form_saved_at).toBeNull();
      expect(h.db.state.events).toEqual([]);
    }
  });

  it('a customer file can\'t join a team screenshot\'s tile group', async () => {
    // group + part decide which tiles a layout match sends together
    // (designSuggest.js referenceShots): only reference-add may set them.
    h.db = fakeDb({ projects: [project({ assets: [TEAM_1] })] });
    const own = { path: path('reference', 41), kind: 'reference', name: 'mine.png', size: 5, type: 'image/png', group: TEAM_1.group, part: 2 };
    await save([own]);
    expect(stored()).toEqual([
      { path: own.path, kind: 'reference', name: 'mine.png', size: 5, type: 'image/png' },
      TEAM_1,
    ]);
  });

  it('a retried first save logs "started the form" once, from the row it wrote over', async () => {
    h.db = fakeDb({ projects: [project({ stage: 'invited', form_started_at: null })] });
    // Another tab's first save lands in between.
    h.db.state.beforeUpdate = (row) => { row.form_started_at = '2026-10-06T08:30:00Z'; row.updated_at = 'moved'; };
    await save([LOGO]);
    expect(h.db.state.events.filter((e) => e.type === 'form_started')).toHaveLength(0);
    expect(h.db.state.projects[0].form_started_at).toBe('2026-10-06T08:30:00Z');
  });

  it('submit keeps the team\'s files and emails the team the customer\'s own', async () => {
    h.db = fakeDb();
    const res = await save([LOGO, REF], 'submit');
    expect(res.statusCode).toBe(200);
    expect(stored()).toEqual([LOGO, REF, TEAM_1]);
    const { assets } = postmark.customSiteFormToAdmin.mock.calls[0][0];
    expect(assets.map((a) => a.path)).toEqual([LOGO.path, REF.path]);
    expect(h.db.state.projects[0].form_submitted_at).toBeTruthy();
  });
});

describe('mergeFormAssets / customerAssets', () => {
  it('puts the customer\'s sanitized list first, then the team\'s files as stored', () => {
    const sent = [{ ...LOGO, extra: 'dropped' }, { ...TEAM_1, note: 'edited' }];
    expect(mergeFormAssets([TEAM_1, LOGO], sent, PID)).toEqual([LOGO, TEAM_1]);
  });

  it('copes with missing lists', () => {
    expect(mergeFormAssets(null, undefined, PID)).toEqual([]);
    expect(mergeFormAssets([TEAM_1], null, PID)).toEqual([TEAM_1]);
    expect(customerAssets(null)).toEqual([]);
    expect(customerAssets([LOGO, TEAM_1, null])).toEqual([LOGO]);
  });
});

describe('describeEvent: reference screenshots and layout matches', () => {
  it('words the team\'s screenshot', () => {
    expect(describeEvent({ type: 'reference_added', data: { name: 'home.png' } })).toBe('Reference screenshot added: home.png');
    expect(describeEvent({ type: 'reference_added' })).toBe('Reference screenshot added');
  });

  it('words a match run apart from a suggestion', () => {
    expect(describeEvent({ type: 'design_suggest_started', data: { mode: 'match' } })).toBe('Asked Claude to match a reference site\'s layout');
    expect(describeEvent({ type: 'design_suggest_ready', data: { mode: 'match', templateId: 'mobile_sudsy' } })).toBe('Layout match ready');
    expect(describeEvent({ type: 'design_suggest_failed', data: { mode: 'match', error: 'timed out' } })).toBe('Layout match failed: timed out');
  });

  it('keeps the suggestion wording without a mode', () => {
    expect(describeEvent({ type: 'design_suggest_started' })).toBe('Asked Claude to suggest a design');
    expect(describeEvent({ type: 'design_suggest_ready', data: { templateId: 'mobile_sudsy' } })).toBe('Design suggestion ready');
    expect(describeEvent({ type: 'design_suggest_failed', data: { error: 'timed out' } })).toBe('Design suggestion failed: timed out');
    expect(describeEvent({ type: 'design_suggest_failed' })).toBe('Design suggestion failed');
  });
});
