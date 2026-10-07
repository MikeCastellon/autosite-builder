// tests/functions/capture-admin.test.js
//
// custom-site-admin `reference-capture`: the Design step's "Add" (a
// reference site by its address) and "Capture again" check the address,
// claim design.capture and start custom-site-capture-background; and
// design-save carries the record over like the other server-written design
// keys. Supabase and its storage are in-memory fakes
// (tests/fixtures/heic/fakes.js), DNS and fetch are stubbed: nothing here
// reaches a database, a resolver or the network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeDb } from '../fixtures/heic/fakes.js';

const h = vi.hoisted(() => ({ db: null, user: null, dns: {} }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

vi.mock('node:dns/promises', () => ({
  lookup: async (host) => {
    const v = h.dns[host];
    if (!v) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
    return v.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  },
}));

const { handler } = await import('../../netlify/functions/custom-site-admin.js');
const { CAPTURE_BACKGROUND_PATH, CAPTURE_RUN_LIVE_MS, CAPTURE_SIGNATURE_HEADER, verifyCaptureSignature } = await import('../../netlify/functions/_lib/capture-run.js');
const { CAPTURE_MESSAGES } = await import('../../netlify/functions/_lib/capture.js');
const { REFERENCE_FULL } = await import('../../netlify/functions/_lib/reference-assets.js');

const PID = '11111111-2222-4333-8444-555555555555';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const OWNER = { id: 'owner-1', email: 'owner@shop.test', is_super_admin: false };
const DNS = {
  'shop.test': ['93.184.215.14'],
  'www.shop.test': ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c'],
  'internal.shop.test': ['10.0.0.8'],
  'half.shop.test': ['93.184.215.14', '169.254.169.254'],
  'rebind.shop.test': ['127.0.0.1'],
};

function project({ capture, assets = [] } = {}) {
  return {
    id: PID,
    token: 'tok_aaaaaaaaaaaaaaaaaaaaaaaa',
    stage: 'designing',
    updated_at: '2026-10-07T08:00:00.000000+00:00',
    assets: structuredClone(assets),
    design: { templateId: 'mobile_chrome', ...(capture ? { capture } : {}) },
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
const capture = (url, note) => handler(post({ action: 'reference-capture', id: PID, url, ...(note === undefined ? {} : { note }) }));

let fetchMock;
beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  h.user = ADMIN;
  h.dns = DNS;
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

describe('custom-site-admin reference-capture', () => {
  it('claims a capture and starts the background function, signed, on the same deploy', async () => {
    const res = await capture('www.shop.test/services', '  the hero\nand the price grid ');
    expect(res.statusCode).toBe(200);
    const { capture: run } = json(res);
    expect(run).toMatchObject({
      status: 'running', url: 'https://www.shop.test/services', note: 'the hero and the price grid', finishedAt: null, parts: 0, error: null,
    });
    expect(Number.isFinite(Date.parse(run.startedAt))).toBe(true);
    expect(row().design.capture).toEqual(run);
    expect(row().design.templateId).toBe('mobile_chrome');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://deploy-preview-4--acg.netlify.app${CAPTURE_BACKGROUND_PATH}`);
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ id: PID, startedAt: run.startedAt, actor: 'admin@acg.test' });
    expect(verifyCaptureSignature(sent, init.headers[CAPTURE_SIGNATURE_HEADER])).toBe(true);
  });

  it('answers 409 with the live capture, and starts nothing', async () => {
    const live = { status: 'running', url: 'https://other.test/', startedAt: new Date(Date.now() - 60 * 1000).toISOString(), finishedAt: null, parts: 0, error: null };
    h.db = fakeDb({ projects: [project({ capture: live })], profiles: [ADMIN] });
    const res = await capture('https://shop.test/');
    expect(res.statusCode).toBe(409);
    expect(json(res)).toEqual({ error: 'A screenshot is already being taken for this project. Wait for it to finish.', capture: live });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(row().design.capture).toEqual(live);
  });

  it('captures again once the last one went stale, or finished', async () => {
    const stale = { status: 'running', url: 'https://shop.test/', startedAt: new Date(Date.now() - CAPTURE_RUN_LIVE_MS - 1000).toISOString(), attempted: true };
    h.db = fakeDb({ projects: [project({ capture: stale })], profiles: [ADMIN] });
    const res = await capture('https://shop.test/');
    expect(res.statusCode).toBe(200);
    expect(row().design.capture.attempted).toBeUndefined();
    const done = { status: 'ready', url: 'https://shop.test/', startedAt: '2026-10-07T08:00:00.000Z', finishedAt: '2026-10-07T08:01:00.000Z', parts: 3, error: null };
    h.db = fakeDb({ projects: [project({ capture: done })], profiles: [ADMIN] });
    expect((await capture('https://shop.test/')).statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers 400 for an address that isn\'t one, and claims nothing', async () => {
    for (const [url, error] of [
      ['', CAPTURE_MESSAGES.invalid],
      ['not a site', CAPTURE_MESSAGES.invalid],
      ['javascript:alert(1)', CAPTURE_MESSAGES.invalid],
      ['file:///etc/passwd', CAPTURE_MESSAGES.invalid],
      ['ftp://shop.test/', CAPTURE_MESSAGES.invalid],
      ['localhost', CAPTURE_MESSAGES.invalid],
      [`https://shop.test/${'a'.repeat(500)}`, CAPTURE_MESSAGES.too_long],
      ['https://admin:pw@shop.test/', CAPTURE_MESSAGES.credentials],
      ['https://shop.test:22/', CAPTURE_MESSAGES.port],
      ['https://nowhere.test/', CAPTURE_MESSAGES.not_found],
    ]) {
      const res = await capture(url);
      expect(res.statusCode, url).toBe(400);
      expect(json(res).error, url).toBe(error);
    }
    expect((await handler(post({ action: 'reference-capture', id: PID, url: 42 }))).statusCode).toBe(400);
    expect(row().design.capture).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 400 for a private address, however it is written or resolved', async () => {
    for (const url of [
      'http://10.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://127.0.0.1/', 'http://192.168.1.1:8080/', 'http://2130706433/',
      'http://0x7f.0.0.1/', 'http://127.1.2.3/', 'http://[::ffff:127.0.0.1]/', 'https://internal.shop.test/', 'https://half.shop.test/',
      'https://rebind.shop.test/', 'http://printer.local/', 'http://metadata.google.internal/', 'http://app.localhost/',
    ]) {
      const res = await capture(url);
      expect(res.statusCode, url).toBe(400);
      expect([CAPTURE_MESSAGES.private, CAPTURE_MESSAGES.invalid, CAPTURE_MESSAGES.not_found], url).toContain(json(res).error);
    }
    // The plain private forms say why.
    for (const url of ['http://10.0.0.1/', 'http://169.254.169.254/', 'http://0x7f.0.0.1/', 'http://2130706433/', 'https://internal.shop.test/', 'https://half.shop.test/', 'http://printer.local/']) {
      expect(json(await capture(url)), url).toEqual({ error: CAPTURE_MESSAGES.private, code: 'private' });
    }
    expect(row().design.capture).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 400 when the team\'s screenshots already fill the project', async () => {
    const team = Array.from({ length: 30 }, (_, i) => ({
      path: `${PID}/reference/aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}.png`, kind: 'reference', name: 's.png', size: 1, type: 'image/png', addedBy: 'admin',
    }));
    h.db = fakeDb({ projects: [project({ assets: team })], profiles: [ADMIN] });
    const res = await capture('https://shop.test/');
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe(REFERENCE_FULL);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 404 for no such project', async () => {
    const res = await handler(post({ action: 'reference-capture', id: '99999999-2222-4333-8444-555555555555', url: 'https://shop.test/' }));
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives the claim up at once when the background function can\'t be started', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500 }));
    const res = await capture('https://shop.test/');
    expect(res.statusCode).toBe(502);
    expect(json(res).error).toBe('Couldn\'t start the capture: the background function answered 500');
    expect(row().design.capture).toMatchObject({ status: 'failed', error: json(res).error });
    expect(h.db.state.events.map((e) => [e.type, e.data.url, e.actor])).toEqual([['reference_capture_failed', 'https://shop.test/', 'admin@acg.test']]);
    fetchMock.mockImplementation(async () => ({ ok: true, status: 202 }));
    expect((await capture('https://shop.test/')).statusCode).toBe(200);
  });

  it('is for super admins only', async () => {
    h.user = null;
    expect((await capture('https://shop.test/')).statusCode).toBe(401);
    h.user = OWNER;
    expect((await capture('https://shop.test/')).statusCode).toBe(403);
    expect(row().design.capture).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('custom-site-admin design-save', () => {
  it('carries design.capture over: only the capture writes it', async () => {
    const done = { status: 'ready', url: 'https://shop.test/', startedAt: '2026-10-07T08:00:00.000Z', finishedAt: '2026-10-07T08:01:00.000Z', parts: 2, error: null };
    h.db = fakeDb({ projects: [project({ capture: done })], profiles: [ADMIN] });
    // A page that sends a capture of its own changes nothing.
    const res = await handler(post({ action: 'design-save', id: PID, design: { templateId: 'mobile_sudsy', capture: { status: 'running' } } }));
    expect(res.statusCode).toBe(200);
    expect(row().design.capture).toEqual(done);
    expect(row().design.templateId).toBe('mobile_sudsy');
  });

  it('keeps the sites the team added when a save sends no list (a tab from before the list existed)', async () => {
    const sites = [{ url: 'https://shop.test/', note: 'the hero', addedAt: '2026-10-07T08:00:00.000Z' }];
    h.db = fakeDb({ projects: [{ ...project(), design: { templateId: 'mobile_chrome', referenceSites: sites } }], profiles: [ADMIN] });
    expect((await handler(post({ action: 'design-save', id: PID, design: { templateId: 'mobile_sudsy' } }))).statusCode).toBe(200);
    expect(row().design.referenceSites).toEqual(sites);
    expect(row().design.templateId).toBe('mobile_sudsy');
    // A page that sends the list owns it, an empty one too (the last site removed).
    expect((await handler(post({ action: 'design-save', id: PID, design: { templateId: 'mobile_sudsy', referenceSites: [] } }))).statusCode).toBe(200);
    expect(row().design.referenceSites).toEqual([]);
  });
});
