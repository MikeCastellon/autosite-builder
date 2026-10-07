// tests/functions/heic-admin.test.js
//
// custom-site-admin `heic-convert`: the project page's "Convert them to
// JPEG" claims a run and starts custom-site-heic-background; and
// design-save carries the run record over like the other server-written
// design keys. Supabase and its storage are in-memory fakes
// (tests/fixtures/heic/fakes.js) and fetch is stubbed: nothing here reaches
// a database or the network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeDb } from '../fixtures/heic/fakes.js';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const { handler } = await import('../../netlify/functions/custom-site-admin.js');
const { HEIC_BACKGROUND_PATH, HEIC_SIGNATURE_HEADER, verifyHeicSignature } = await import('../../netlify/functions/_lib/heic-run.js');

const PID = '11111111-2222-4333-8444-555555555555';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const OWNER = { id: 'owner-1', email: 'owner@shop.test', is_super_admin: false };
const HEIC = { path: `${PID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.heic`, kind: 'photo', name: 'IMG_0001.HEIC', size: 800, type: 'image/heic' };
const JPG = { path: `${PID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-000000000002.jpg`, kind: 'photo', name: 'Van.jpg', size: 900, type: 'image/jpeg' };

function project({ assets = [JPG, HEIC], heic } = {}) {
  return {
    id: PID,
    token: 'tok_aaaaaaaaaaaaaaaaaaaaaaaa',
    stage: 'designing',
    updated_at: '2026-10-07T08:00:00.000000+00:00',
    assets: structuredClone(assets),
    design: { templateId: 'mobile_chrome', ...(heic ? { heic } : {}) },
  };
}
const row = () => h.db.state.projects[0];
const post = (body) => ({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer admin-token' },
  rawUrl: 'https://deploy-preview-4--acg.netlify.app/.netlify/functions/custom-site-admin',
  body: JSON.stringify(body),
});
const json = (res) => JSON.parse(res.body);

let fetchMock;
beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  h.user = ADMIN;
  h.db = fakeDb({ projects: [project()], profiles: [ADMIN, OWNER] });
  fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('custom-site-admin heic-convert', () => {
  it('claims a run and starts the background function, signed, on the same deploy', async () => {
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(200);
    const { heic } = json(res);
    expect(heic).toMatchObject({ status: 'running', by: 'admin', converted: 0, failed: [], total: 1, finishedAt: null });
    expect(Number.isFinite(Date.parse(heic.startedAt))).toBe(true);
    expect(row().design.heic).toEqual(heic);
    expect(row().design.templateId).toBe('mobile_chrome');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://deploy-preview-4--acg.netlify.app${HEIC_BACKGROUND_PATH}`);
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ id: PID, startedAt: heic.startedAt, actor: 'admin@acg.test' });
    expect(verifyHeicSignature(sent, init.headers[HEIC_SIGNATURE_HEADER])).toBe(true);
  });

  it('answers 409 with the live run, and starts nothing', async () => {
    const live = { status: 'running', startedAt: new Date(Date.now() - 60 * 1000).toISOString(), converted: 2, failed: [], by: 'customer' };
    h.db = fakeDb({ projects: [project({ heic: live })], profiles: [ADMIN] });
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(409);
    expect(json(res)).toEqual({ error: 'The photos are already being converted', heic: live });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(row().design.heic).toEqual(live);
  });

  it('runs again once a run went stale', async () => {
    const stale = { status: 'running', startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), converted: 0, failed: [], by: 'admin', attempted: true };
    h.db = fakeDb({ projects: [project({ heic: stale })], profiles: [ADMIN] });
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(200);
    expect(row().design.heic.attempted).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers 400 "Nothing to convert" without HEIC uploads', async () => {
    const done = { status: 'ready', startedAt: '2026-10-07T08:00:00.000Z', finishedAt: '2026-10-07T08:01:00.000Z', converted: 1, failed: [], by: 'admin' };
    h.db = fakeDb({ projects: [project({ assets: [JPG], heic: done })], profiles: [ADMIN] });
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({ error: 'Nothing to convert', heic: done });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 404 for no such project', async () => {
    const res = await handler(post({ action: 'heic-convert', id: '99999999-2222-4333-8444-555555555555' }));
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives the claim up at once when the background function can\'t be started', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500 }));
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(502);
    expect(json(res).error).toBe('Couldn\'t start converting the photos: the background function answered 500');
    expect(row().design.heic).toMatchObject({ status: 'failed', error: json(res).error });
    expect(h.db.state.events.map((e) => [e.type, e.actor])).toEqual([['heic_failed', 'admin@acg.test']]);
    // So the button works again straight away.
    fetchMock.mockImplementation(async () => ({ ok: true, status: 202 }));
    expect((await handler(post({ action: 'heic-convert', id: PID }))).statusCode).toBe(200);
  });

  it('still answers 502 for a failed start when the claim can\'t be given up', async () => {
    // The start fails and the database goes down with it: the claim stays
    // (it goes stale on its own) and no failure is logged for a run whose
    // record still says running.
    let down = false;
    fetchMock.mockImplementation(async () => { down = true; return { ok: false, status: 503 }; });
    const orig = h.db.from;
    h.db.from = (table) => {
      const q = orig(table);
      if (table === 'custom_site_projects') {
        const ms = q.maybeSingle;
        q.maybeSingle = () => (down ? Promise.resolve({ data: null, error: { message: 'down' } }) : ms());
      }
      return q;
    };
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(502);
    expect(json(res).error).toBe('Couldn\'t start converting the photos: the background function answered 503');
    expect(row().design.heic.status).toBe('running');
    expect(h.db.state.events).toEqual([]);
  });

  it('is for super admins only', async () => {
    h.user = null;
    expect((await handler(post({ action: 'heic-convert', id: PID }))).statusCode).toBe(401);
    h.user = OWNER;
    const res = await handler(post({ action: 'heic-convert', id: PID }));
    expect(res.statusCode).toBe(403);
    expect(row().design.heic).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('custom-site-admin design-save', () => {
  it('carries design.heic over: only the run writes it', async () => {
    const done = { status: 'ready', startedAt: '2026-10-07T08:00:00.000Z', finishedAt: '2026-10-07T08:01:00.000Z', converted: 1, failed: [], by: 'admin' };
    h.db = fakeDb({ projects: [project({ heic: done })], profiles: [ADMIN] });
    // A page that sends a heic of its own changes nothing.
    const res = await handler(post({ action: 'design-save', id: PID, design: { templateId: 'mobile_sudsy', heic: { status: 'running' } } }));
    expect(res.statusCode).toBe(200);
    expect(row().design.heic).toEqual(done);
  });
});
