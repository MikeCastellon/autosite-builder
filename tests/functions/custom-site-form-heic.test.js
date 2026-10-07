// tests/functions/custom-site-form-heic.test.js
//
// iPhone photos (HEIC) on the customer's form (custom-site-form): a save or
// submit that stores one starts the background run that converts them to
// JPEG, as the customer, one run at a time and never in a loop on files
// that already failed; a failure there never fails the save. A page opened
// before the conversion still lists the HEIC path: its saves keep the
// converted JPEG in that place (mergeFormAssets) and never bring the HEIC
// back. The form shows a note on a HEIC file instead of a thumbnail.
//
// _lib/heic-run.js is the real module (its own tests cover the claim and
// the conversion) with claimHeicRun spied on and invokeHeicBackground
// mocked: nothing is fetched. The claim and the release of a refused start
// run against Supabase, an in-memory fake whose projects move updated_at
// on every write, like the table's trigger.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

vi.mock('../../netlify/functions/_lib/heic-run.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, claimHeicRun: vi.fn(), invokeHeicBackground: vi.fn() };
});

const heicRun = await import('../../netlify/functions/_lib/heic-run.js');
const realHeicRun = await vi.importActual('../../netlify/functions/_lib/heic-run.js');
const { handler } = await import('../../netlify/functions/custom-site-form.js');
const { default: IntakeField } = await import('../../src/components/customSite/IntakeFields.jsx');
const { FORM_FIELDS } = await import('../../src/lib/customSiteForm.js');

const PID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'tok_abcdefghijklmnopqrstuv';
const path = (kind, n, ext = 'png') => `${PID}/${kind}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;

const LOGO = { path: path('logo', 1), kind: 'logo', name: 'logo.png', size: 100, type: 'image/png' };
const HEIC = { path: path('photo', 2, 'heic'), kind: 'photo', name: 'IMG_0002.HEIC', size: 2400000, type: 'image/heic' };
const HEIC_2 = { path: path('photo', 3, 'heic'), kind: 'photo', name: 'IMG_0003.HEIC', size: 2500000, type: 'image/heic' };
// heic-run's in-place replacement of HEIC.
const JPEG = {
  path: path('photo', 4, 'jpg'), kind: 'photo', name: 'IMG_0002.jpg', size: 800000, type: 'image/jpeg', convertedFrom: HEIC.path,
};
const PHOTO = { path: path('photo', 5, 'jpg'), kind: 'photo', name: 'shop.jpg', size: 100, type: 'image/jpeg' };

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();

function project(extra = {}) {
  return {
    id: PID, token: TOKEN, stage: 'form_started', client_first_name: 'Dana', client_name: 'Dana Gloss',
    client_email: 'dana@gloss.test', client_phone: null, business_name: 'Gloss Boss', created_by: 'admin-1',
    form: { contactName: 'Dana' }, assets: [LOGO].map((a) => structuredClone(a)),
    design: { templateId: 'mobile_sudsy', kit: { words: { status: 'ready' } } },
    form_started_at: '2026-10-01T00:00:00Z', form_saved_at: null, form_submitted_at: null,
    updated_at: '2026-10-06T08:00:00.000Z', ...extra,
  };
}

// `state.beforeUpdate` runs just before the next project update, to stand
// in for another write (the conversion run) landing between the form's
// read and its write.
function fakeDb({ projects = [project()], profiles = [{ id: 'admin-1', email: 'admin@acg.test' }] } = {}) {
  const state = {
    projects, profiles, events: [], updates: 0, clock: 0, runReads: 0, runReadError: null, beforeUpdate: null,
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
        state.beforeUpdate = null;
        hook(state.projects[0]);
      }
      if (key === 'projects') state.updates += 1;
      const hits = rows.filter(match);
      hits.forEach((r) => Object.assign(r, structuredClone(op('update')[1]), key === 'projects' ? { updated_at: state.tick() } : {}));
      if (single) return { data: hits[0] ? { id: hits[0].id } : null, error: null };
      return op('select') ? { data: hits.map((r) => ({ id: r.id })), error: null } : { error: null };
    }
    let hits = rows.filter(match).map((r) => structuredClone(r));
    // PostgREST's JSON path select: just the run record.
    if (op('select')?.[1] === 'heic:design->heic') {
      state.runReads += 1;
      if (state.runReadError) return { data: null, error: { message: state.runReadError } };
      hits = hits.map((r) => ({ heic: r.design?.heic ?? null }));
    }
    return single ? { data: hits[0] || null, error: null } : { data: hits, error: null };
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
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}?token=s` })), error: null }),
    }),
  };
  return { from, storage, state };
}

const post = (body) => ({ httpMethod: 'POST', headers: {}, rawUrl: 'https://deploy.test/.netlify/functions/custom-site-form', body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);
const FORM = { contactName: 'Dana', contactEmail: 'dana@gloss.test', businessName: 'Gloss Boss' };
const save = (assets, action = 'save') => handler(post({ action, t: TOKEN, form: FORM, assets }));
const row = () => h.db.state.projects[0];
const stored = () => row().assets;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CUSTOM_SITES_EMAIL;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  heicRun.claimHeicRun.mockImplementation(realHeicRun.claimHeicRun);
  // Netlify took the run (it answers a background function with 202).
  heicRun.invokeHeicBackground.mockImplementation(async () => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('a save that stores an iPhone photo starts the conversion', () => {
  it('claims a run as the customer and starts the background function with its startedAt', async () => {
    h.db = fakeDb();
    const res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(stored()).toEqual([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
    expect(heicRun.claimHeicRun).toHaveBeenCalledWith(h.db, PID, { by: 'customer', nowMs: expect.any(Number) });
    const { run } = await heicRun.claimHeicRun.mock.results[0].value;
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
    const [event, payload] = heicRun.invokeHeicBackground.mock.calls[0];
    expect(event.rawUrl).toBe('https://deploy.test/.netlify/functions/custom-site-form');
    expect(payload).toEqual({ id: PID, startedAt: run.startedAt });
    // The claim kept the rest of the design.
    expect(row().design).toMatchObject({
      templateId: 'mobile_sudsy', kit: { words: { status: 'ready' } }, heic: { status: 'running', by: 'customer', total: 1, startedAt: run.startedAt },
    });
  });

  it('submit starts it too, and still emails the team', async () => {
    h.db = fakeDb();
    const postmark = await import('../../netlify/functions/_lib/postmark.js');
    const res = await save([LOGO, HEIC], 'submit');
    expect(res.statusCode).toBe(200);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
    expect(postmark.customSiteFormToAdmin).toHaveBeenCalledTimes(1);
  });

  it('finds a HEIC an earlier save stored', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO, HEIC] })] });
    await save([LOGO, HEIC]);
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
  });

  it('a save without HEIC files reads nothing more and starts nothing', async () => {
    h.db = fakeDb();
    const res = await save([LOGO, PHOTO]);
    expect(res.statusCode).toBe(200);
    expect(h.db.state.runReads).toBe(0);
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();
    expect(heicRun.invokeHeicBackground).not.toHaveBeenCalled();
  });

  it('never logs heic_started itself (the background run does)', async () => {
    h.db = fakeDb();
    await save([LOGO, HEIC]);
    expect(h.db.state.events.map((e) => e.type)).not.toContain('heic_started');
  });
});

describe('one run at a time, and no loop on files that failed', () => {
  it('leaves a live run alone: no claim, the save still lands', async () => {
    h.db = fakeDb({ projects: [project({ design: { heic: { status: 'running', startedAt: minutesAgo(3), by: 'admin' } } })] });
    const res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(stored()).toEqual([LOGO, HEIC]);
    expect(h.db.state.runReads).toBe(1);
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();
    expect(heicRun.invokeHeicBackground).not.toHaveBeenCalled();
  });

  it('takes over a run that died (running, started over 15 minutes ago)', async () => {
    h.db = fakeDb({ projects: [project({ design: { heic: { status: 'running', startedAt: minutesAgo(20), by: 'admin' } } })] });
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
  });

  it('doesn\'t retry files the last run already failed on; a new HEIC starts a run', async () => {
    const last = {
      status: 'ready', startedAt: minutesAgo(10), finishedAt: minutesAgo(9), converted: 3, by: 'customer',
      failed: [{ path: HEIC.path, name: HEIC.name, reason: 'Not a HEIC image' }],
    };
    h.db = fakeDb({ projects: [project({ assets: [LOGO, HEIC], design: { heic: last } })] });
    await save([LOGO, HEIC]);
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();

    await save([LOGO, HEIC, HEIC_2]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
  });

  it('a run that stopped early with files left goes on at the next save', async () => {
    const last = { status: 'ready', startedAt: minutesAgo(14), finishedAt: minutesAgo(2), converted: 30, failed: [], by: 'admin' };
    h.db = fakeDb({ projects: [project({ assets: [LOGO, HEIC], design: { heic: last } })] });
    await save([LOGO, HEIC]);
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
  });

  it('waits 30 minutes after a run that broke as a whole', async () => {
    const broke = (m) => ({ status: 'failed', startedAt: minutesAgo(m + 1), finishedAt: minutesAgo(m), converted: 0, failed: [], by: 'customer' });
    h.db = fakeDb({ projects: [project({ design: { heic: broke(5) } })] });
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();

    h.db = fakeDb({ projects: [project({ design: { heic: broke(31) } })] });
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
  });

  it('a full failure list (files past it aren\'t listed) waits 30 minutes like a run that broke', async () => {
    const full = (m) => ({
      status: 'ready', startedAt: minutesAgo(m + 10), finishedAt: minutesAgo(m), converted: 0, by: 'customer',
      failed: Array.from({ length: heicRun.HEIC_FAILED_MAX }, (_, i) => ({ path: path('photo', 100 + i, 'heic'), name: `IMG_${i}.HEIC`, reason: 'x' })),
    });
    // HEIC (not in the list) failed too, past the cap.
    h.db = fakeDb({ projects: [project({ assets: [LOGO, HEIC], design: { heic: full(5) } })] });
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();

    h.db = fakeDb({ projects: [project({ assets: [LOGO, HEIC], design: { heic: full(31) } })] });
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
  });

  it('two saves in a row start one run (the claim makes the second see it live)', async () => {
    h.db = fakeDb();
    await save([LOGO, HEIC]);
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
    expect(heicRun.invokeHeicBackground).toHaveBeenCalledTimes(1);
  });

  it('a claim the shared module refuses starts nothing', async () => {
    h.db = fakeDb();
    heicRun.claimHeicRun.mockResolvedValueOnce({ claimed: false, run: null, project: null });
    const res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(heicRun.invokeHeicBackground).not.toHaveBeenCalled();
  });
});

describe('a conversion that can\'t start never fails the save', () => {
  it('the run-record read failing', async () => {
    h.db = fakeDb();
    h.db.state.runReadError = 'boom';
    const res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(json(res).ok).toBe(true);
    expect(stored()).toEqual([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();
  });

  it('the claim throwing', async () => {
    h.db = fakeDb();
    heicRun.claimHeicRun.mockRejectedValueOnce(new Error('The project kept changing while saving. Try again.'));
    const res = await save([LOGO, HEIC], 'submit');
    expect(res.statusCode).toBe(200);
    expect(row().form_submitted_at).toBeTruthy();
    expect(heicRun.invokeHeicBackground).not.toHaveBeenCalled();
  });

  it('the background function not answering: the claim is marked failed and logged, the rest of design kept', async () => {
    h.db = fakeDb();
    heicRun.invokeHeicBackground.mockRejectedValueOnce(new Error('the background function answered 500'));
    const res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(stored()).toEqual([LOGO, HEIC]);
    expect(row().design.heic).toMatchObject({
      status: 'failed', by: 'customer', error: 'Couldn\'t start the conversion: the background function answered 500',
    });
    expect(Number.isFinite(Date.parse(row().design.heic.finishedAt))).toBe(true);
    expect(row().design.kit).toEqual({ words: { status: 'ready' } });
    const failed = h.db.state.events.filter((e) => e.type === 'heic_failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ actor: 'system', data: { by: 'customer', error: expect.stringContaining('answered 500') } });
    // And the next save doesn't hammer it.
    await save([LOGO, HEIC]);
    expect(heicRun.claimHeicRun).toHaveBeenCalledTimes(1);
  });

  // The save waits 4 s at most for the start (HEIC_START_WAIT_MS). Only the
  // timers are fake: the database fake answers in microtasks.
  async function saveWithFakeTimers(assets, run) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let res = null;
      save(assets).then((r) => { res = r; });
      await run(() => res);
      return res;
    } finally {
      vi.useRealTimers();
    }
  }

  it('a start that hangs doesn\'t hold the save: it answers after 4 s and leaves the claim as it is', async () => {
    h.db = fakeDb();
    heicRun.invokeHeicBackground.mockImplementationOnce(() => new Promise(() => {}));
    const res = await saveWithFakeTimers([LOGO, HEIC], async (current) => {
      await vi.advanceTimersByTimeAsync(3900);
      expect(current()).toBe(null);
      await vi.advanceTimersByTimeAsync(200);
      expect(current()?.statusCode).toBe(200);
    });
    expect(json(res).ok).toBe(true);
    expect(stored()).toEqual([LOGO, HEIC]);
    // Maybe it started: the claim stays running (it goes stale in 15
    // minutes if it never arrived), and nothing is logged as failed.
    expect(row().design.heic).toMatchObject({ status: 'running', by: 'customer' });
    expect(h.db.state.events.filter((e) => e.type === 'heic_failed')).toHaveLength(0);
  });

  // (Whether the late rejection is handled can't be seen from here: the
  // mock's spy puts its own handler on the promise. settlesWithin's race
  // handles it.)
  it('a start that fails after the wait is dropped: the claim stays, nothing is logged', async () => {
    h.db = fakeDb();
    heicRun.invokeHeicBackground.mockImplementationOnce(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('the background function answered 502')), 9000);
    }));
    const res = await saveWithFakeTimers([LOGO, HEIC], async (current) => {
      await vi.advanceTimersByTimeAsync(4100);
      expect(current()?.statusCode).toBe(200);
      // The late rejection lands after the save answered.
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(res.statusCode).toBe(200);
    expect(row().design.heic).toMatchObject({ status: 'running', by: 'customer' });
    expect(h.db.state.events.filter((e) => e.type === 'heic_failed')).toHaveLength(0);
  });

  it('a start answered within the wait waits for nothing more', async () => {
    h.db = fakeDb();
    heicRun.invokeHeicBackground.mockImplementationOnce(() => new Promise((resolve) => { setTimeout(resolve, 300); }));
    await saveWithFakeTimers([LOGO, HEIC], async (current) => {
      await vi.advanceTimersByTimeAsync(300);
      expect(current()?.statusCode).toBe(200);
      // The wait's own timer was cleared.
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('leaves a newer claim alone when marking a failed start', async () => {
    h.db = fakeDb();
    heicRun.invokeHeicBackground.mockImplementationOnce(async () => {
      // The admin's button claimed again in between (a stale claim taken over).
      row().design = { ...row().design, heic: { status: 'running', startedAt: '2026-10-07T12:00:00.000Z', by: 'admin' } };
      throw new Error('network error');
    });
    await save([LOGO, HEIC]);
    expect(row().design.heic).toEqual({ status: 'running', startedAt: '2026-10-07T12:00:00.000Z', by: 'admin' });
    expect(h.db.state.events.filter((e) => e.type === 'heic_failed')).toHaveLength(0);
  });
});

describe('an open page never brings a converted HEIC back', () => {
  it('a save listing the HEIC keeps the JPEG in its place, with the customer\'s note', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO, JPEG, PHOTO] })] });
    const res = await save([LOGO, { ...HEIC, note: 'the black truck' }, PHOTO]);
    expect(res.statusCode).toBe(200);
    expect(stored()).toEqual([LOGO, { ...JPEG, note: 'the black truck' }, PHOTO]);
    // Nothing HEIC is left, so no run starts.
    expect(heicRun.claimHeicRun).not.toHaveBeenCalled();
  });

  it('the conversion landing between the form\'s read and write: the retry maps the HEIC onto the JPEG', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO, HEIC, PHOTO] })] });
    h.db.state.beforeUpdate = (r) => {
      r.assets = r.assets.map((a) => (a.path === HEIC.path ? structuredClone(JPEG) : a));
      r.updated_at = 'moved-by-conversion';
    };
    const res = await save([PHOTO, HEIC, LOGO]);
    expect(res.statusCode).toBe(200);
    expect(h.db.state.updates).toBe(2);
    expect(stored()).toEqual([PHOTO, JPEG, LOGO]);
    expect(stored().some((a) => a.path === HEIC.path)).toBe(false);
  });

  it('GET hands the reloaded page the JPEG', async () => {
    h.db = fakeDb({ projects: [project({ assets: [LOGO, JPEG] })] });
    const res = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: TOKEN } });
    expect(json(res).project.assets.map((a) => [a.path, a.name])).toEqual([[LOGO.path, LOGO.name], [JPEG.path, JPEG.name]]);
  });
});

describe('the form shows a note on a HEIC file instead of a thumbnail', () => {
  const NOTE = 'iPhone photo: we&#x27;ll convert it to JPEG so it works on the web.';
  const fieldFor = (kind) => FORM_FIELDS.find((f) => f.type === 'files' && f.kind === kind);
  const render = (field, assets) => renderToStaticMarkup(createElement(IntakeField, {
    field,
    files: { assets, uploads: [], onAdd() {}, onRemove() {}, onNote() {}, onDismiss() {} },
  }));
  const withUrl = (a) => ({ ...a, url: `https://files.test/${a.path}` });

  it('photo tiles: the note and no <img> for HEIC, a thumbnail for the JPEG', () => {
    const html = render(fieldFor('photo'), [withUrl(HEIC), withUrl(PHOTO)]);
    expect(html).toContain(NOTE);
    expect(html.split(NOTE)).toHaveLength(2);
    expect(html).not.toContain(`src="https://files.test/${HEIC.path}"`);
    expect(html).toContain(`src="https://files.test/${PHOTO.path}"`);
  });

  it('.heif counts, and a converted JPEG gets its thumbnail and no note', () => {
    expect(render(fieldFor('logo'), [{ ...LOGO, path: path('logo', 7, 'heif'), name: 'mark.HEIF' }])).toContain(NOTE);
    const html = render(fieldFor('photo'), [withUrl(JPEG)]);
    expect(html).not.toContain(NOTE);
    expect(html).toContain(`src="https://files.test/${JPEG.path}"`);
  });

  it('inspiration rows (small thumbnail, note box) show it once, beside the name', () => {
    const ref = { ...HEIC, path: path('reference', 8, 'heic'), kind: 'reference', note: 'love it' };
    const html = render(fieldFor('reference'), [withUrl(ref)]);
    expect(html.split(NOTE)).toHaveLength(2);
    expect(html.indexOf(NOTE)).toBeGreaterThan(html.indexOf(ref.name));
    expect(html.indexOf(NOTE)).toBeLessThan(html.indexOf('<textarea'));
  });
});
