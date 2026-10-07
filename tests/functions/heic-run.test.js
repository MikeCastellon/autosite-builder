// tests/functions/heic-run.test.js
//
// iPhone photos (HEIC) to JPEG: which uploads need it and how a run is
// claimed and started (_lib/heic-run.js), and the run itself
// (custom-site-heic-background) converting the real HEIC fixture on an
// in-memory database and bucket (tests/fixtures/heic/fakes.js). Nothing
// here reaches a database, a bucket or the network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SAMPLE_HEIC, fakeDb } from '../fixtures/heic/fakes.js';

const h = vi.hoisted(() => ({ db: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => { throw Object.assign(new Error('Not signed in'), { status: 401 }); },
}));

const {
  HEIC_BACKGROUND_PATH, HEIC_RUN_LIVE_MS, HEIC_SIGNATURE_HEADER, claimHeicRun, heicAssetsOf, heicSignature,
  invokeHeicBackground, isHeicAsset, isHeicRunLive, isSameHeicClaim, releaseHeicRun, verifyHeicSignature,
} = await import('../../netlify/functions/_lib/heic-run.js');
const { handler, jpegName, runHeic } = await import('../../netlify/functions/custom-site-heic-background.js');

const PID = '11111111-2222-4333-8444-555555555555';
const SECRET = 'test-service-role-key';
const STARTED = '2026-10-07T09:00:00.000Z';
const NOW_MS = Date.parse(STARTED) + 30 * 1000;

const uuid = (n) => `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}`;
const upload = (kind, n, ext) => `${PID}/${kind}/${uuid(n)}.${ext}`;
const isJpeg = (buf) => !!buf && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

// The ids the run gives its JPEGs, in order.
function ids() {
  let n = 100;
  return () => `cccccccc-dddd-4eee-8fff-${String((n += 1)).padStart(12, '0')}`;
}

// The customer's list: a JPEG, two iPhone photos (one with a note), a HEIF
// logo, and the team's reference screenshot.
const JPG = { path: upload('photo', 1, 'jpg'), kind: 'photo', name: 'Truck.jpg', size: 2000, type: 'image/jpeg' };
const HEIC_A = { path: upload('photo', 2, 'heic'), kind: 'photo', name: 'IMG_0412.HEIC', size: SAMPLE_HEIC.length, type: 'image/heic', note: 'Ceramic coat, front' };
const HEIC_B = { path: upload('photo', 3, 'heic'), kind: 'photo', name: 'IMG_0413.heic', size: SAMPLE_HEIC.length, type: '' };
const LOGO = { path: upload('logo', 4, 'heif'), kind: 'logo', name: 'logo.heif', size: SAMPLE_HEIC.length, type: 'image/heif' };
const TEAM = { path: upload('reference', 5, 'png'), kind: 'reference', name: 'Shot.png', size: 900, type: 'image/png', addedBy: 'admin', group: 'g1', part: 1 };

// Everything else the design holds: a run must leave it as it was.
const OTHER_DESIGN = {
  templateId: 'mobile_chrome',
  brand: { status: 'ready', startedAt: '2026-10-01T00:00:00.000Z' },
  kit: { words: { status: 'ready', startedAt: '2026-10-02T00:00:00.000Z' } },
};

function project({ assets = [JPG, HEIC_A, HEIC_B, LOGO, TEAM], heic, design = {} } = {}) {
  return {
    id: PID,
    updated_at: '2026-10-07T08:00:00.000000+00:00',
    assets: structuredClone(assets),
    design: { ...structuredClone(OTHER_DESIGN), ...design, ...(heic === undefined ? {} : { heic }) },
  };
}
const claim = (extra = {}) => ({ status: 'running', startedAt: STARTED, finishedAt: null, converted: 0, failed: [], total: 3, by: 'admin', ...extra });

function storedFiles(assets) {
  const files = {};
  for (const a of assets) files[a.path] = /\.hei[cf]$/.test(a.path) ? SAMPLE_HEIC : Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  return files;
}
function db(opts = {}) {
  const p = project(opts);
  return fakeDb({ projects: [p], files: storedFiles(p.assets) });
}
const row = (d) => d.state.projects[0];
const run = (d, extra = {}) => runHeic({ db: d, projectId: PID, startedAt: STARTED, newId: ids(), nowMs: () => NOW_MS, now: () => '2026-10-07T09:00:42.000Z', ...extra });

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SECRET);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  h.db = null;
});

// ─── Which uploads ────────────────────────────────────────────────────

describe('isHeicAsset / heicAssetsOf', () => {
  it('finds HEIC/HEIF uploads by type, name or path', () => {
    expect(isHeicAsset(HEIC_A)).toBe(true);
    expect(isHeicAsset(HEIC_B)).toBe(true);
    expect(isHeicAsset(LOGO)).toBe(true);
    expect(isHeicAsset({ path: upload('brand', 9, 'bin'), kind: 'brand', name: 'scan', type: 'IMAGE/HEIF' })).toBe(true);
    expect(isHeicAsset({ path: upload('photo', 9, 'heic'), kind: 'photo', name: '', type: '' })).toBe(true);
    expect(isHeicAsset({ path: upload('reference', 9, 'jpg'), kind: 'reference', name: 'IMG_1.HEIF' })).toBe(true);
    expect(isHeicAsset({ path: upload('photo', 9, 'heic'), kind: 'photo', type: 'image/heic-sequence' })).toBe(true);
  });

  it('leaves out other files, other kinds and what is converted already', () => {
    expect(isHeicAsset(JPG)).toBe(false);
    expect(isHeicAsset(TEAM)).toBe(false);
    expect(isHeicAsset({ ...HEIC_A, kind: 'kit' })).toBe(false);
    expect(isHeicAsset({ ...HEIC_A, path: '' })).toBe(false);
    expect(isHeicAsset({ path: upload('photo', 9, 'jpg'), kind: 'photo', name: 'IMG_0412.jpg', type: 'image/jpeg', convertedFrom: HEIC_A.path })).toBe(false);
    // Even one still named .heic, once it records what it was converted from.
    expect(isHeicAsset({ ...HEIC_A, convertedFrom: upload('photo', 8, 'heic') })).toBe(false);
    expect(isHeicAsset(null)).toBe(false);
    expect(isHeicAsset('x.heic')).toBe(false);
  });

  it('keeps the list order', () => {
    expect(heicAssetsOf([JPG, HEIC_A, TEAM, HEIC_B, LOGO]).map((a) => a.path)).toEqual([HEIC_A.path, HEIC_B.path, LOGO.path]);
    expect(heicAssetsOf(null)).toEqual([]);
    expect(heicAssetsOf([null, 3, JPG])).toEqual([]);
  });
});

// ─── The run record ───────────────────────────────────────────────────

describe('isHeicRunLive / isSameHeicClaim', () => {
  it('is live while running and under 15 minutes old', () => {
    const t = Date.parse(STARTED);
    expect(isHeicRunLive(claim(), t + 60 * 1000)).toBe(true);
    expect(isHeicRunLive(claim(), t + HEIC_RUN_LIVE_MS - 1)).toBe(true);
    expect(isHeicRunLive(claim(), t + HEIC_RUN_LIVE_MS)).toBe(false);
    expect(isHeicRunLive({ ...claim(), status: 'ready' }, t + 1000)).toBe(false);
    expect(isHeicRunLive({ ...claim(), status: 'failed' }, t + 1000)).toBe(false);
    expect(isHeicRunLive({ ...claim(), startedAt: 'yesterday' }, t + 1000)).toBe(false);
    expect(isHeicRunLive(null)).toBe(false);
    // Postgres hands times back as '+00:00'.
    expect(isHeicRunLive({ ...claim(), startedAt: '2026-10-07T09:00:00+00:00' }, t + 1000)).toBe(true);
    // Default clock: a claim made now.
    expect(isHeicRunLive({ ...claim(), startedAt: new Date().toISOString() })).toBe(true);
  });

  it('compares claims as instants', () => {
    expect(isSameHeicClaim(claim(), STARTED)).toBe(true);
    expect(isSameHeicClaim(claim(), '2026-10-07T09:00:00+00:00')).toBe(true);
    expect(isSameHeicClaim(claim(), '2026-10-07T09:00:00.001Z')).toBe(false);
    expect(isSameHeicClaim({ ...claim(), status: 'ready' }, STARTED)).toBe(false);
    expect(isSameHeicClaim(claim(), undefined)).toBe(false);
    expect(isSameHeicClaim(null, STARTED)).toBe(false);
  });
});

describe('claimHeicRun', () => {
  it('claims a run on design.heic and keeps the rest of the design', async () => {
    const d = db();
    const res = await claimHeicRun(d, PID, { by: 'admin', nowMs: NOW_MS });
    expect(res.claimed).toBe(true);
    expect(res.project.id).toBe(PID);
    expect(res.run).toEqual({
      status: 'running', startedAt: new Date(NOW_MS).toISOString(), finishedAt: null, converted: 0, failed: [], total: 3, by: 'admin',
    });
    expect(row(d).design.heic).toEqual(res.run);
    const { heic, ...rest } = row(d).design;
    expect(rest).toEqual(OTHER_DESIGN);
    // The uploads aren't touched by a claim.
    expect(row(d).assets).toEqual(project().assets);
  });

  it('claims as the customer', async () => {
    const d = db();
    const res = await claimHeicRun(d, PID, { by: 'customer', nowMs: NOW_MS });
    expect(res.run.by).toBe('customer');
    // Anything else counts as the admin.
    const d2 = db();
    expect((await claimHeicRun(d2, PID, { by: 'someone', nowMs: NOW_MS })).run.by).toBe('admin');
  });

  it('refuses while a run is live, and writes nothing', async () => {
    const live = claim({ startedAt: new Date(NOW_MS - 5 * 60 * 1000).toISOString() });
    const d = db({ heic: live });
    const res = await claimHeicRun(d, PID, { by: 'admin', nowMs: NOW_MS });
    expect(res).toMatchObject({ claimed: false, reason: 'live', run: live });
    expect(d.state.ops.filter(([, k]) => k === 'update')).toEqual([]);
  });

  it('claims again once the last run finished or went stale', async () => {
    const stale = claim({ startedAt: new Date(NOW_MS - 16 * 60 * 1000).toISOString(), attempted: true });
    const d = db({ heic: stale });
    expect((await claimHeicRun(d, PID, { nowMs: NOW_MS })).claimed).toBe(true);
    const done = { ...claim(), status: 'ready', finishedAt: STARTED, converted: 1 };
    const d2 = db({ heic: done });
    const res = await claimHeicRun(d2, PID, { nowMs: NOW_MS });
    expect(res.claimed).toBe(true);
    expect(row(d2).design.heic.converted).toBe(0);
  });

  it('refuses when there is nothing to convert', async () => {
    const d = db({ assets: [JPG, TEAM] });
    const res = await claimHeicRun(d, PID, { nowMs: NOW_MS });
    expect(res).toMatchObject({ claimed: false, reason: 'nothing', run: null });
    expect(row(d).design.heic).toBeUndefined();
  });

  it('answers not_found for no such project', async () => {
    const d = db();
    expect(await claimHeicRun(d, 'nope', { nowMs: NOW_MS })).toEqual({ claimed: false, run: null, project: null, reason: 'not_found' });
    expect(await claimHeicRun(d, '', { nowMs: NOW_MS })).toEqual({ claimed: false, run: null, project: null, reason: 'not_found' });
  });

  it('checks again when the row changed under it: two claims at once start one run', async () => {
    const d = db();
    // Another save claims first, between this claim's read and its write.
    d.state.beforeUpdate = (r) => {
      r.design = { ...r.design, heic: claim({ startedAt: new Date(NOW_MS - 1000).toISOString(), by: 'customer' }) };
      r.updated_at = d.state.tick();
    };
    const res = await claimHeicRun(d, PID, { by: 'admin', nowMs: NOW_MS });
    expect(res).toMatchObject({ claimed: false, reason: 'live' });
    expect(row(d).design.heic.by).toBe('customer');
  });

  it('keeps a write that landed in between', async () => {
    const d = db();
    d.state.beforeUpdate = (r) => {
      r.design = { ...r.design, templateId: 'detailing_sporty' };
      r.updated_at = d.state.tick();
    };
    const res = await claimHeicRun(d, PID, { nowMs: NOW_MS });
    expect(res.claimed).toBe(true);
    expect(row(d).design.templateId).toBe('detailing_sporty');
    expect(row(d).design.heic.status).toBe('running');
  });
});

describe('releaseHeicRun', () => {
  it('marks the claim failed, only while it is that claim', async () => {
    const d = db({ heic: claim() });
    expect(await releaseHeicRun(d, PID, '2026-10-07T09:00:00.500Z', 'nope', NOW_MS)).toBe(false);
    expect(row(d).design.heic.status).toBe('running');
    expect(await releaseHeicRun(d, PID, STARTED, 'Couldn\'t start: 502', NOW_MS)).toBe(true);
    expect(row(d).design.heic).toMatchObject({ status: 'failed', error: 'Couldn\'t start: 502', finishedAt: new Date(NOW_MS).toISOString(), total: 3 });
  });
});

// ─── Starting the background function ─────────────────────────────────

describe('heicSignature', () => {
  it('signs the claim and the actor with the server key', () => {
    const payload = { id: PID, startedAt: STARTED, actor: 'admin@acg.test' };
    const sig = heicSignature(payload);
    expect(sig).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyHeicSignature(payload, sig)).toBe(true);
    expect(verifyHeicSignature({ ...payload, id: uuid(9) }, sig)).toBe(false);
    expect(verifyHeicSignature({ ...payload, startedAt: '2026-10-07T09:00:01.000Z' }, sig)).toBe(false);
    expect(verifyHeicSignature({ ...payload, actor: 'customer' }, sig)).toBe(false);
    expect(verifyHeicSignature(payload, sig, 'another-key')).toBe(false);
    expect(verifyHeicSignature(payload, sig.slice(1))).toBe(false);
    expect(verifyHeicSignature(payload, undefined)).toBe(false);
  });

  it('signs nothing without a key, and accepts nothing', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(heicSignature({ id: PID, startedAt: STARTED })).toBe('');
    expect(verifyHeicSignature({ id: PID, startedAt: STARTED }, '')).toBe(false);
  });
});

describe('invokeHeicBackground', () => {
  const event = { rawUrl: 'https://deploy-preview-9--acg.netlify.app/.netlify/functions/custom-site-form', headers: { authorization: 'Bearer secret-token' } };

  it('posts the signed claim to the same deploy\'s background function', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await invokeHeicBackground(event, { id: PID, startedAt: STARTED });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://deploy-preview-9--acg.netlify.app${HEIC_BACKGROUND_PATH}`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ id: PID, startedAt: STARTED });
    expect(verifyHeicSignature({ id: PID, startedAt: STARTED }, init.headers[HEIC_SIGNATURE_HEADER])).toBe(true);
    // The caller's sign-in stays where it was.
    expect(JSON.stringify(init.headers)).not.toContain('secret-token');
    expect(init.signal).toBeDefined();
  });

  it('carries the actor when given', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await invokeHeicBackground(event, { id: PID, startedAt: STARTED, actor: 'admin@acg.test' });
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ id: PID, startedAt: STARTED, actor: 'admin@acg.test' });
    expect(verifyHeicSignature(JSON.parse(init.body), init.headers[HEIC_SIGNATURE_HEADER])).toBe(true);
  });

  it('falls back to the site URL without rawUrl', async () => {
    vi.stubEnv('URL', 'https://sitebuilder.example.test/');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await invokeHeicBackground({ headers: {} }, { id: PID, startedAt: STARTED });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://sitebuilder.example.test${HEIC_BACKGROUND_PATH}`);
  });

  it('throws when it wasn\'t accepted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(invokeHeicBackground(event, { id: PID, startedAt: STARTED })).rejects.toThrow('the background function answered 500');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(invokeHeicBackground(event, { id: PID, startedAt: STARTED })).rejects.toThrow('fetch failed');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(invokeHeicBackground(event, { id: PID, startedAt: STARTED })).rejects.toThrow(/no key/);
  });
});

// ─── The run ──────────────────────────────────────────────────────────

describe('jpegName', () => {
  it('swaps the extension for .jpg', () => {
    expect(jpegName('IMG_0412.HEIC')).toBe('IMG_0412.jpg');
    expect(jpegName('my car.heif')).toBe('my car.jpg');
    expect(jpegName('scan')).toBe('scan.jpg');
    expect(jpegName('', 'logo')).toBe('logo.jpg');
    expect(jpegName(undefined)).toBe('photo.jpg');
  });
});

describe('runHeic', () => {
  it('converts every HEIC upload in place, keeping order, note and the team\'s files', async () => {
    const d = db({ heic: claim() });
    const res = await run(d, { actor: 'admin@acg.test' });
    expect(res).toMatchObject({ status: 200, converted: 3, failed: 0, left: 0 });

    const assets = row(d).assets;
    expect(assets).toHaveLength(5);
    expect(assets[0]).toEqual(JPG);
    expect(assets[4]).toEqual(TEAM);
    const jpgPath = (n) => `${PID}/${n}/cccccccc-dddd-4eee-8fff-`;
    expect(assets[1]).toEqual({
      path: `${jpgPath('photo')}000000000101.jpg`, kind: 'photo', name: 'IMG_0412.jpg', size: assets[1].size, type: 'image/jpeg',
      note: 'Ceramic coat, front', convertedFrom: HEIC_A.path,
    });
    expect(assets[2]).toMatchObject({ path: `${jpgPath('photo')}000000000102.jpg`, name: 'IMG_0413.jpg', type: 'image/jpeg', convertedFrom: HEIC_B.path });
    expect(assets[3]).toMatchObject({ path: `${jpgPath('logo')}000000000103.jpg`, kind: 'logo', name: 'logo.jpg', type: 'image/jpeg', convertedFrom: LOGO.path });
    expect(heicAssetsOf(assets)).toEqual([]);

    // The JPEGs are in the bucket, as JPEGs, and the original HEICs stay.
    for (const a of assets.slice(1, 4)) {
      const up = d.state.uploads.find((u) => u.path === a.path);
      expect(up.opts).toEqual({ contentType: 'image/jpeg', upsert: false });
      expect(up.bucket).toBe('custom-site-assets');
      expect(isJpeg(d.state.files[a.path])).toBe(true);
      expect(a.size).toBe(d.state.files[a.path].length);
      expect(d.state.files[a.convertedFrom]).toBeDefined();
    }
    expect(d.state.removed).toEqual([]);
    expect(d.state.files[JPG.path]).toBeDefined();
    expect(d.state.files[TEAM.path]).toBeDefined();

    // The record, and the rest of the design as it was.
    const { heic, ...rest } = row(d).design;
    expect(rest).toEqual(OTHER_DESIGN);
    expect(heic).toEqual({
      status: 'ready', startedAt: STARTED, finishedAt: '2026-10-07T09:00:42.000Z', converted: 3, failed: [], total: 3, by: 'admin', attempted: true,
    });
    expect(d.state.events.map((e) => [e.type, e.data, e.actor])).toEqual([
      ['heic_started', { files: 3, by: 'admin' }, 'admin@acg.test'],
      ['heic_ready', { converted: 3, failed: 0, left: 0, by: 'admin' }, 'admin@acg.test'],
    ]);
  });

  it('keeps every original HEIC in the bucket, out of the list, named by its JPEG', async () => {
    const d = db({ heic: claim() });
    await run(d);
    const assets = row(d).assets;
    for (const a of [HEIC_A, HEIC_B, LOGO]) {
      expect(assets.some((x) => x.path === a.path)).toBe(false);
      const jpeg = assets.find((x) => x.convertedFrom === a.path);
      expect(isJpeg(d.state.files[jpeg.path])).toBe(true);
      expect(d.state.files[a.path]).toEqual(SAMPLE_HEIC);
    }
    expect(d.state.removed).toEqual([]);
    // For each file: download, then upload. The original is never removed.
    const order = d.state.calls.filter(([, p]) => p.includes(uuid(2)) || p.endsWith('000000000101.jpg')).map(([op]) => op);
    expect(order).toEqual(['download', 'upload']);
  });

  it('shows progress on the record as it goes', async () => {
    const d = db({ heic: claim() });
    const progress = [];
    // At each JPEG upload, the record counts the files before it.
    d.state.onUpload = () => progress.push(row(d).design.heic.converted);
    await run(d);
    expect(progress).toEqual([0, 1, 2]);
    expect(row(d).design.heic.converted).toBe(3);
  });

  it('records a file that fails and goes on with the rest', async () => {
    const big = { path: upload('photo', 6, 'heic'), kind: 'photo', name: 'Huge.heic', size: 31 * 1024 * 1024, type: 'image/heic' };
    const missing = { path: upload('photo', 7, 'heic'), kind: 'photo', name: 'Gone.heic', size: 700, type: 'image/heic' };
    const d = db({ heic: claim(), assets: [HEIC_A, big, missing, HEIC_B, LOGO] });
    // Not a HEIC after all (a PNG renamed), and an object that isn't there.
    d.state.files[HEIC_B.path] = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.alloc(40)]);
    delete d.state.files[missing.path];
    const res = await run(d);
    expect(res).toMatchObject({ status: 200, converted: 2, failed: 3 });

    const heic = row(d).design.heic;
    expect(heic.status).toBe('ready');
    expect(heic.converted).toBe(2);
    expect(heic.failed).toEqual([
      { path: big.path, name: 'Huge.heic', reason: 'Too large to convert (over 30 MB)' },
      { path: missing.path, name: 'Gone.heic', reason: 'Could not be downloaded' },
      { path: HEIC_B.path, name: 'IMG_0413.heic', reason: 'Could not be converted: Not a HEIC/HEIF image' },
    ]);
    // The failed files stay as they were, in the list and in the bucket.
    const assets = row(d).assets;
    expect(assets.map((a) => a.convertedFrom || a.path)).toEqual([HEIC_A.path, big.path, missing.path, HEIC_B.path, LOGO.path]);
    expect(assets[1]).toEqual(big);
    expect(assets[3]).toEqual(HEIC_B);
    expect(d.state.files[HEIC_B.path]).toBeDefined();
    expect(d.state.removed).toEqual([]);
    // The big one was never downloaded.
    expect(d.state.calls.filter(([op, p]) => op === 'download' && p === big.path)).toEqual([]);
    expect(d.state.events.at(-1)).toMatchObject({ type: 'heic_ready', data: { converted: 2, failed: 3, left: 0, by: 'admin' } });
  });

  it('gives up on a file whose download never answers and goes on with the rest', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const d = db({ heic: claim(), assets: [HEIC_A, HEIC_B] });
      // The first file's download hangs; the second one answers.
      const fromBucket = d.storage.from.bind(d.storage);
      d.storage.from = (bucket) => {
        const api = fromBucket(bucket);
        return { ...api, download: (p) => (p === HEIC_A.path ? new Promise(() => {}) : api.download(p)) };
      };
      const pending = run(d);
      await vi.advanceTimersByTimeAsync(91 * 1000);
      const res = await pending;
      expect(res).toMatchObject({ status: 200, converted: 1, failed: 1 });
      expect(row(d).design.heic.failed).toEqual([{ path: HEIC_A.path, name: HEIC_A.name, reason: 'Could not be downloaded' }]);
      expect(row(d).assets[0]).toEqual(HEIC_A);
      expect(row(d).assets[1].convertedFrom).toBe(HEIC_B.path);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records a JPEG that could not be stored and keeps the HEIC', async () => {
    const d = db({ heic: claim(), assets: [HEIC_A, HEIC_B] });
    d.state.uploadError = (p) => p.endsWith('000000000101.jpg');
    const res = await run(d);
    expect(res).toMatchObject({ converted: 1, failed: 1 });
    expect(row(d).design.heic.failed).toEqual([{ path: HEIC_A.path, name: 'IMG_0412.HEIC', reason: 'The JPEG could not be stored' }]);
    expect(row(d).assets[0]).toEqual(HEIC_A);
    expect(d.state.files[HEIC_A.path]).toBeDefined();
  });

  it('gives up a file whose list write keeps losing, and removes its JPEG', async () => {
    const d = db({ heic: claim(), assets: [HEIC_A] });
    // Someone else writes the row before every one of this run's writes.
    const origFrom = d.from;
    let racing = false;
    d.from = (table) => {
      const q = origFrom(table);
      const update = q.update;
      q.update = (patch) => {
        if (racing && table === 'custom_site_projects' && patch.assets) row(d).updated_at = d.state.tick();
        return update(patch);
      };
      return q;
    };
    racing = true;
    const res = await run(d);
    expect(res).toMatchObject({ converted: 0, failed: 1 });
    expect(row(d).design.heic.failed[0].reason).toMatch(/kept changing/);
    expect(row(d).assets).toEqual([HEIC_A]);
    // The JPEG nothing points at went; the HEIC stayed.
    expect(Object.keys(d.state.files).filter((p) => p.endsWith('.jpg'))).toEqual([]);
    expect(d.state.files[HEIC_A.path]).toBeDefined();
  });

  // The swap's write answers with a database error. `landed`: it was
  // applied all the same (the answer got lost). `checkFails`: the read that
  // checks the list fails too.
  function failSwapWrite(d, { landed, checkFails = false }) {
    const orig = d.from;
    let armed = true;
    d.from = (table) => {
      const q = orig(table);
      if (table !== 'custom_site_projects') return q;
      let swap = false;
      let check = false;
      const { update, select, maybeSingle } = q;
      q.update = (patch) => { if (armed && patch.assets) swap = true; return update(patch); };
      q.select = (cols, ...rest) => { if (cols === 'assets') check = true; return select(cols, ...rest); };
      q.maybeSingle = async () => {
        if (swap) {
          armed = false;
          if (landed) await maybeSingle();
          return { data: null, error: { message: 'connection reset' } };
        }
        if (check && checkFails) return { data: null, error: { message: 'down' } };
        return maybeSingle();
      };
      return q;
    };
  }
  const JPEG_101 = `${PID}/photo/cccccccc-dddd-4eee-8fff-000000000101.jpg`;

  it('counts a swap the database reported as failed but applied, and keeps its JPEG', async () => {
    const d = db({ heic: claim({ total: 1 }), assets: [HEIC_A] });
    failSwapWrite(d, { landed: true });
    const res = await run(d);
    expect(res).toMatchObject({ status: 200, converted: 1, failed: 0 });
    expect(row(d).assets[0]).toMatchObject({ path: JPEG_101, convertedFrom: HEIC_A.path });
    // The list points at the JPEG: it stays, and so does the original.
    expect(isJpeg(d.state.files[JPEG_101])).toBe(true);
    expect(d.state.files[HEIC_A.path]).toBeDefined();
  });

  it('removes the JPEG of a swap that failed and didn\'t land, and keeps the HEIC', async () => {
    const d = db({ heic: claim({ total: 1 }), assets: [HEIC_A] });
    failSwapWrite(d, { landed: false });
    const res = await run(d);
    expect(res).toMatchObject({ status: 200, converted: 0, failed: 1 });
    expect(row(d).design.heic.failed).toEqual([{ path: HEIC_A.path, name: 'IMG_0412.HEIC', reason: 'The JPEG could not be saved to the project' }]);
    expect(row(d).assets).toEqual([HEIC_A]);
    expect(d.state.files[JPEG_101]).toBeUndefined();
    expect(d.state.files[HEIC_A.path]).toBeDefined();
  });

  it('keeps both files when a failed swap can\'t be checked', async () => {
    const d = db({ heic: claim({ total: 1 }), assets: [HEIC_A] });
    failSwapWrite(d, { landed: false, checkFails: true });
    const res = await run(d);
    expect(res).toMatchObject({ converted: 0, failed: 1 });
    expect(row(d).assets).toEqual([HEIC_A]);
    // Nothing removed: an extra JPEG costs a little storage until the
    // project goes; removing one the list points at would lose the photo.
    expect(d.state.removed).toEqual([]);
    expect(d.state.files[JPEG_101]).toBeDefined();
    expect(d.state.files[HEIC_A.path]).toBeDefined();
  });

  it('keeps the first 50 failures on the record and counts them all', async () => {
    const big = Array.from({ length: 52 }, (_, i) => ({
      path: upload('photo', 200 + i, 'heic'), kind: 'photo', name: `Big${i}.heic`, size: 40 * 1024 * 1024, type: 'image/heic',
    }));
    const d = db({ heic: claim({ total: 52 }), assets: big });
    const res = await run(d);
    expect(res).toMatchObject({ status: 200, converted: 0, failed: 52, left: 0 });
    expect(row(d).design.heic.failed).toHaveLength(50);
    expect(row(d).design.heic.failed[49].name).toBe('Big49.heic');
    expect(d.state.events.at(-1)).toMatchObject({ type: 'heic_ready', data: { failed: 52 } });
    expect(d.state.calls.filter(([op]) => op === 'download')).toEqual([]);
  });

  it('keeps a customer upload and a note saved while it converts (concurrent write)', async () => {
    const d = db({ heic: claim(), assets: [JPG, HEIC_A] });
    const added = { path: upload('photo', 8, 'jpg'), kind: 'photo', name: 'New.jpg', size: 10, type: 'image/jpeg' };
    // The customer's autosave lands between the swap's read and its write.
    d.state.beforeUpdate = null;
    let armed = true;
    const origDownload = d.storage.from;
    d.storage.from = (bucket) => {
      const api = origDownload(bucket);
      const up = api.upload;
      api.upload = async (...a) => {
        const out = await up(...a);
        if (armed) {
          armed = false;
          d.state.beforeUpdate = (r) => {
            r.assets = [...r.assets, added];
            r.assets[1] = { ...r.assets[1], note: 'Ceramic coat, front and sides' };
            r.updated_at = d.state.tick();
          };
        }
        return out;
      };
      return api;
    };
    const res = await run(d);
    expect(res).toMatchObject({ converted: 1, failed: 0 });
    const assets = row(d).assets;
    expect(assets).toHaveLength(3);
    expect(assets[0]).toEqual(JPG);
    expect(assets[1]).toMatchObject({ name: 'IMG_0412.jpg', type: 'image/jpeg', convertedFrom: HEIC_A.path, note: 'Ceramic coat, front and sides' });
    expect(assets[2]).toEqual(added);
  });

  it('skips a file the customer removed while it converted, and removes the unused JPEG', async () => {
    const d = db({ heic: claim(), assets: [HEIC_A, HEIC_B] });
    let armed = true;
    const orig = d.storage.from;
    d.storage.from = (bucket) => {
      const api = orig(bucket);
      const up = api.upload;
      api.upload = async (...a) => {
        const out = await up(...a);
        if (armed) {
          armed = false;
          d.state.beforeUpdate = (r) => {
            r.assets = r.assets.filter((x) => x.path !== HEIC_A.path);
            r.updated_at = d.state.tick();
          };
        }
        return out;
      };
      return api;
    };
    const res = await run(d);
    expect(res).toMatchObject({ converted: 1, failed: 0 });
    expect(row(d).assets).toHaveLength(1);
    expect(row(d).assets[0]).toMatchObject({ convertedFrom: HEIC_B.path });
    expect(d.state.files[`${PID}/photo/cccccccc-dddd-4eee-8fff-000000000101.jpg`]).toBeUndefined();
    // A removed upload stays in storage until the project goes, as always.
    expect(d.state.files[HEIC_A.path]).toBeDefined();
  });

  it('picks up a HEIC the customer added while it ran', async () => {
    const d = db({ heic: claim({ total: 1 }), assets: [HEIC_A] });
    const late = { path: upload('photo', 9, 'heic'), kind: 'photo', name: 'Late.HEIC', size: SAMPLE_HEIC.length, type: 'image/heic' };
    d.state.onUpload = (p) => {
      if (!p.endsWith('000000000101.jpg')) return;
      row(d).assets.push(late);
      d.state.files[late.path] = SAMPLE_HEIC;
    };
    const res = await run(d);
    expect(res).toMatchObject({ converted: 2 });
    expect(row(d).assets.map((a) => a.convertedFrom)).toEqual([HEIC_A.path, late.path]);
  });

  it('a second run finds nothing to convert', async () => {
    const d = db({ heic: claim() });
    await run(d);
    const after = structuredClone(row(d).assets);
    // The button again: nothing to claim.
    expect(await claimHeicRun(d, PID, { nowMs: NOW_MS + 60 * 1000 })).toMatchObject({ claimed: false, reason: 'nothing' });
    // Even a run on a claim made by hand converts nothing.
    const later = '2026-10-07T09:05:00.000Z';
    row(d).design.heic = { ...claim(), startedAt: later };
    const uploads = d.state.uploads.length;
    const removed = d.state.removed.length;
    const res = await runHeic({ db: d, projectId: PID, startedAt: later, newId: ids(), nowMs: () => Date.parse(later) + 1000 });
    expect(res).toMatchObject({ status: 200, converted: 0, failed: 0 });
    expect(row(d).assets).toEqual(after);
    expect(d.state.uploads).toHaveLength(uploads);
    expect(d.state.removed).toHaveLength(removed);
  });

  it('runs a claim once: a retried request converts nothing', async () => {
    const d = db({ heic: claim(), assets: [HEIC_A] });
    // A crash after the claim was marked: the retry stops at the mark.
    row(d).design.heic.attempted = true;
    const res = await run(d);
    expect(res).toMatchObject({ status: 200, error: 'This run was already attempted' });
    expect(d.state.uploads).toEqual([]);
    expect(row(d).design.heic.status).toBe('running');
    // A finished claim isn't run either.
    const d2 = db({ heic: claim(), assets: [HEIC_A] });
    await run(d2);
    const uploads = d2.state.uploads.length;
    expect(await run(d2)).toMatchObject({ status: 409 });
    expect(d2.state.uploads).toHaveLength(uploads);
  });

  it('runs only the claim it is given', async () => {
    const d = db({ heic: claim() });
    expect(await runHeic({ db: d, projectId: PID, startedAt: '2026-10-07T08:59:00.000Z' })).toMatchObject({ status: 409 });
    expect(await runHeic({ db: d, projectId: uuid(77), startedAt: STARTED })).toMatchObject({ status: 404 });
    expect(await runHeic({ db: d, projectId: undefined, startedAt: STARTED })).toMatchObject({ status: 404 });
    expect(d.state.uploads).toEqual([]);
    expect(row(d).design.heic).toEqual(claim());
  });

  it('stops at its time limit with a note, leaving the rest for another run', async () => {
    const d = db({ heic: claim() });
    let clock = NOW_MS;
    // Each file takes six minutes: the third would start past twelve.
    const res = await run(d, { nowMs: () => clock, convert: async (buf) => { clock += 6 * 60 * 1000; return { jpeg: Buffer.from([0xff, 0xd8, 0xff, buf.length & 255]) }; } });
    expect(res).toMatchObject({ status: 200, converted: 2, left: 1 });
    const heic = row(d).design.heic;
    expect(heic.status).toBe('ready');
    expect(heic.note).toBe('Stopped at the time limit with 1 file left to convert. Run it again to finish.');
    expect(heicAssetsOf(row(d).assets).map((a) => a.path)).toEqual([LOGO.path]);
  });

  it('takes a JPEG that only has a HEIC name without converting it', async () => {
    const d = db({ heic: claim(), assets: [HEIC_A] });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 9, 9, 9, 9]);
    d.state.files[HEIC_A.path] = jpeg;
    const convert = vi.fn();
    const res = await run(d, { convert });
    expect(res).toMatchObject({ converted: 1 });
    expect(convert).not.toHaveBeenCalled();
    const a = row(d).assets[0];
    expect(d.state.files[a.path]).toEqual(jpeg);
    expect(a).toMatchObject({ name: 'IMG_0412.jpg', size: jpeg.length, type: 'image/jpeg' });
  });

  it('moves the Design step\'s reference pick along with its file', async () => {
    const ref = { path: upload('reference', 6, 'heic'), kind: 'reference', name: 'Their site.HEIC', size: SAMPLE_HEIC.length, type: 'image/heic' };
    const reference = { mode: 'inspire', source: { kind: 'asset', path: ref.path }, replica: { status: 'none', requestedAt: '', templateId: '', note: '' } };
    const d = db({ heic: claim(), assets: [ref], design: { reference } });
    await run(d);
    const a = row(d).assets[0];
    expect(a.convertedFrom).toBe(ref.path);
    expect(row(d).design.reference).toEqual({ ...reference, source: { kind: 'asset', path: a.path } });
  });

  it('names the customer in its events for a customer run', async () => {
    const d = db({ heic: claim({ by: 'customer' }), assets: [HEIC_A] });
    await run(d);
    expect(d.state.events.map((e) => [e.type, e.actor])).toEqual([['heic_started', 'customer'], ['heic_ready', 'customer']]);
  });

  it('fails as a whole when the project goes away mid-run', async () => {
    const d = db({ heic: claim(), assets: [HEIC_A, HEIC_B] });
    d.state.onDownload = (p) => {
      // The project is deleted after the first file, while the second one
      // downloads.
      if (p !== HEIC_B.path) return;
      d.state.onDownload = null;
      d.state.projects.length = 0;
    };
    const res = await run(d);
    expect(res.status).toBe(500);
    expect(res.error).toBe('The project was deleted');
    expect(d.state.events.at(-1)).toMatchObject({ type: 'heic_failed', data: { error: 'The project was deleted', converted: 1 } });
  });
});

describe('custom-site-heic-background handler', () => {
  const post = (body, signature) => ({
    httpMethod: 'POST',
    headers: signature === undefined ? {} : { [HEIC_SIGNATURE_HEADER]: signature },
    body: JSON.stringify(body),
  });

  it('runs a signed claim', async () => {
    // A claim made just now: the handler runs on the real clock, and a run
    // stops taking files 12 minutes after its claim.
    const startedAt = new Date(Date.now() - 1000).toISOString();
    h.db = db({ heic: claim({ startedAt }), assets: [HEIC_A] });
    const body = { id: PID, startedAt };
    const res = await handler(post(body, heicSignature(body)));
    expect(res.statusCode).toBe(200);
    expect(row(h.db).design.heic).toMatchObject({ status: 'ready', converted: 1 });
    expect(isJpeg(h.db.state.files[row(h.db).assets[0].path])).toBe(true);
  });

  it('refuses an unsigned or tampered request before touching anything', async () => {
    h.db = db({ heic: claim(), assets: [HEIC_A] });
    const body = { id: PID, startedAt: STARTED };
    expect((await handler(post(body))).statusCode).toBe(401);
    expect((await handler(post(body, 'not-a-signature'))).statusCode).toBe(401);
    expect((await handler(post({ ...body, actor: 'admin@acg.test' }, heicSignature(body)))).statusCode).toBe(401);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await handler(post(body, ''))).statusCode).toBe(401);
    expect(h.db.state.ops).toEqual([]);
    expect(h.db.state.calls).toEqual([]);
  });

  it('answers 200 once a run started, even when it failed', async () => {
    h.db = db({ heic: claim(), assets: [HEIC_A] });
    // Every read after the start fails: the run breaks as a whole.
    let reads = 0;
    const orig = h.db.from;
    h.db.from = (table) => {
      const q = orig(table);
      if (table === 'custom_site_projects') {
        const ms = q.maybeSingle;
        q.maybeSingle = () => { reads += 1; return reads > 3 ? Promise.resolve({ data: null, error: { message: 'down' } }) : ms(); };
      }
      return q;
    };
    const body = { id: PID, startedAt: STARTED };
    expect((await handler(post(body, heicSignature(body)))).statusCode).toBe(200);
    expect(h.db.state.events.map((e) => e.type)).toContain('heic_failed');
  });

  it('answers 409 for a claim that isn\'t there, and rejects other methods and bad JSON', async () => {
    h.db = db({ heic: claim(), assets: [HEIC_A] });
    const body = { id: PID, startedAt: '2026-10-07T08:00:00.000Z' };
    expect((await handler(post(body, heicSignature(body)))).statusCode).toBe(409);
    expect((await handler({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
    expect((await handler({ httpMethod: 'POST', headers: {}, body: '{nope' })).statusCode).toBe(400);
    expect((await handler({ httpMethod: 'POST', headers: {}, body: '[]' })).statusCode).toBe(400);
  });
});
