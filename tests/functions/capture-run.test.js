// tests/functions/capture-run.test.js
//
// Screenshots of a reference address taken by our browser: the run record
// and its claim (_lib/capture-run.js), the capture itself (_lib/capture.js
// capturePage) driving a fake browser and page, and the background
// function (custom-site-capture-background) storing the parts as team
// reference screenshots on an in-memory database and bucket
// (tests/fixtures/heic/fakes.js). DNS is a fake too: nothing here reaches
// a database, a bucket, a browser or the network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeDb } from '../fixtures/heic/fakes.js';

const h = vi.hoisted(() => ({ db: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => { throw Object.assign(new Error('Not signed in'), { status: 401 }); },
}));

const {
  CAPTURE_MESSAGES, CAPTURE_USER_AGENT, PAGE_SCRIPTS, capturePage, jpegSize, planCaptureTiles,
} = await import('../../netlify/functions/_lib/capture.js');
const {
  CAPTURE_BACKGROUND_PATH, CAPTURE_RUN_LIVE_MS, CAPTURE_SIGNATURE_HEADER, captureNote, captureSignature, capturedAssetsFor, capturedUrlKey,
  claimCapture, invokeCaptureBackground, isCaptureLive, isSameCaptureClaim, releaseCapture, verifyCaptureSignature,
} = await import('../../netlify/functions/_lib/capture-run.js');
const { heicSignature } = await import('../../netlify/functions/_lib/heic-run.js');
const { REFERENCE_FULL } = await import('../../netlify/functions/_lib/reference-assets.js');
const {
  CHROMIUM_PACK_URL, browserEnv, handler, lambdaRuntimeHint, launchBrowser, partName, runCapture, safeChromiumArgs,
} = await import('../../netlify/functions/custom-site-capture-background.js');
const { checkReferenceChoice } = await import('../../src/lib/designSuggest.js');

const PID = '11111111-2222-4333-8444-555555555555';
const SECRET = 'test-service-role-key';
const STARTED = '2026-10-07T09:00:00.000Z';
const URL_ = 'https://www.shop.test/';
const PUBLIC_V4 = '93.184.215.14';

const uuid = (n) => `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}`;
const refPath = (n, ext = 'jpg') => `${PID}/reference/${uuid(n)}.${ext}`;
// The ids the run hands out, in order: the group first, then one per part.
function ids() {
  let n = 100;
  return () => `cccccccc-dddd-4eee-8fff-${String((n += 1)).padStart(12, '0')}`;
}
const newPath = (n) => `${PID}/reference/cccccccc-dddd-4eee-8fff-${String(n).padStart(12, '0')}.jpg`;
const GROUP = 'cccccccc-dddd-4eee-8fff-000000000101';

// A JPEG with nothing but its frame header: jpegSize reads the size.
function fakeJpeg(width, height) {
  const b = Buffer.alloc(23);
  b.writeUInt16BE(0xffd8, 0);
  b.writeUInt16BE(0xffc0, 2);
  b.writeUInt16BE(17, 4);
  b[6] = 8;
  b.writeUInt16BE(height, 7);
  b.writeUInt16BE(width, 9);
  b[11] = 3;
  b.writeUInt16BE(0xffd9, 21);
  return b;
}

// A resolver: shop names are public, "internal" ones private.
function lookup(host) {
  const table = {
    'www.shop.test': [PUBLIC_V4], 'shop.test': [PUBLIC_V4], 'cdn.shop.test': [PUBLIC_V4], 'other.test': [PUBLIC_V4],
    'internal.shop.test': ['10.0.0.8'], 'rebind.shop.test': ['127.0.0.1'],
  };
  const v = table[host];
  if (!v) return Promise.reject(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
  return Promise.resolve(v.map((address) => ({ address, family: 4 })));
}

// A puppeteer browser and page, as far as the capture uses them. `scene`:
//   height        what the page measures (default 5000)
//   redirects     where the main navigation is redirected, in order
//   subresources  what the page then requests
//   status, headers  the main document's answer
//   gotoError     what page.goto throws once the requests are through
//   launchError   what launching throws
// Each request goes through the page's interception handler; an aborted
// navigation fails page.goto the way Chromium does.
function fakeBrowser(scene = {}) {
  const log = { launches: [], screenshots: [], scrolls: [], requests: [], closed: 0, interception: false };
  const handlers = {};
  const mainFrame = { main: true };
  let current = 'about:blank';
  async function send(url, { navigation, redirectChain = [] }) {
    const result = await new Promise((resolve) => {
      const req = {
        url: () => url,
        isNavigationRequest: () => navigation,
        frame: () => mainFrame,
        redirectChain: () => redirectChain,
        continue: async () => resolve({ continued: true }),
        abort: async (code) => resolve({ aborted: true, code }),
      };
      if (!log.interception) resolve({ continued: true, unchecked: true });
      for (const fn of handlers.request || []) fn(req);
    });
    log.requests.push({ url, ...result });
    return result;
  }
  const page = {
    setUserAgent: async (ua) => { log.ua = ua; },
    setExtraHTTPHeaders: async (hd) => { log.extraHeaders = hd; },
    setViewport: async (v) => { log.viewport = v; },
    setBypassServiceWorker: async (v) => { log.bypassServiceWorker = v; },
    setRequestInterception: async (v) => { log.interception = v; },
    on: (event, fn) => { (handlers[event] ||= []).push(fn); },
    mainFrame: () => mainFrame,
    url: () => current,
    goto: async (url, opts) => {
      log.goto = { url, opts };
      const chain = [url, ...(scene.redirects || [])];
      for (let i = 0; i < chain.length; i += 1) {
        const r = await send(chain[i], { navigation: true, redirectChain: chain.slice(0, i) });
        if (r.aborted) throw new Error(`net::${r.code === 'namenotresolved' ? 'ERR_NAME_NOT_RESOLVED' : 'ERR_BLOCKED_BY_CLIENT'} at ${chain[i]}`);
      }
      for (const u of scene.subresources || []) await send(u, { navigation: false });
      if (scene.gotoError) throw scene.gotoError;
      current = chain[chain.length - 1];
      return { status: () => scene.status ?? 200, headers: () => scene.headers || {} };
    },
    waitForNetworkIdle: async (opts) => { log.idle = opts; },
    evaluate: async (fn, ...args) => {
      if (fn === PAGE_SCRIPTS.measure) return scene.height ?? 5000;
      if (fn === PAGE_SCRIPTS.readyState) return scene.readyState ?? 'loading';
      if (fn === PAGE_SCRIPTS.reveal || fn === PAGE_SCRIPTS.hideOverlays) {
        (log.scripts ||= []).push(fn === PAGE_SCRIPTS.reveal ? 'reveal' : 'hideOverlays');
        return 0;
      }
      if (fn === PAGE_SCRIPTS.scrollTo) {
        log.scrolls.push(args[0]);
        return args[0];
      }
      throw new Error('unexpected page script');
    },
    screenshot: async (opts) => {
      log.screenshots.push(opts);
      return new Uint8Array(fakeJpeg(opts.clip.width, opts.clip.height));
    },
  };
  const browser = {
    newPage: async () => page,
    close: async () => { log.closed += 1; },
    process: () => null,
  };
  const launch = async (opts) => {
    log.launches.push(opts);
    if (scene.launchError) throw scene.launchError;
    return browser;
  };
  return { launch, log };
}

const QUICK = { sleep: async () => {} };

// ─── The project ──────────────────────────────────────────────────────

const CUSTOMER_REF = { path: refPath(1), kind: 'reference', name: 'ref.jpg', size: 100, type: 'image/jpeg', note: 'love this one' };
const PHOTO = { path: `${PID}/photo/${uuid(2)}.jpg`, kind: 'photo', name: 'van.jpg', size: 100, type: 'image/jpeg' };
const UPLOADED = { path: refPath(3, 'png'), kind: 'reference', name: 'home.png', size: 100, type: 'image/png', note: `Screenshot of ${URL_}`, addedBy: 'admin' };
// An earlier capture of the same address (written without "www.": the
// same site to referenceUrlKey) and one of another site.
const OLD_GROUP = 'oldgroup-0000-4000-8000-000000000000';
const OLD = [1, 2].map((part) => ({
  path: refPath(10 + part), kind: 'reference', name: `shop.test (part ${part} of 2).jpg`, size: 50, type: 'image/jpeg',
  note: 'Screenshot of https://shop.test - old note', addedBy: 'admin', group: OLD_GROUP, part, captured: true,
}));
const OTHER = { path: refPath(20), kind: 'reference', name: 'other.test.jpg', size: 50, type: 'image/jpeg', note: `Screenshot of https://other.test/ - like ${URL_}`, addedBy: 'admin', group: 'othergroup-0000-4000-8000-000000000000', part: 1, captured: true };

const claim = (extra = {}) => ({ status: 'running', url: URL_, note: 'the hero and the services grid', startedAt: STARTED, finishedAt: null, parts: 0, error: null, ...extra });

// `capture: undefined` for a project without a capture record.
function project(opts = {}) {
  const { assets = [PHOTO, CUSTOMER_REF], design = {} } = opts;
  const capture = 'capture' in opts ? opts.capture : claim();
  return {
    id: PID,
    updated_at: '2026-10-07T08:00:00.000000+00:00',
    assets: structuredClone(assets),
    design: { templateId: 'mobile_chrome', brand: { status: 'ready' }, ...design, ...(capture === undefined ? {} : { capture }) },
  };
}
function db(opts = {}) {
  const p = project(opts);
  const files = {};
  for (const a of p.assets) files[a.path] = Buffer.from('x');
  return fakeDb({ projects: [p], files });
}
const row = (d) => d.state.projects[0];
const run = (d, browser, extra = {}) => runCapture({
  db: d, projectId: PID, startedAt: STARTED, actor: 'admin@acg.test', launch: browser.launch, lookup,
  captureOptions: QUICK, newId: ids(), now: () => '2026-10-07T09:00:42.000Z', ...extra,
});

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

// ─── Pure parts ───────────────────────────────────────────────────────

describe('planCaptureTiles', () => {
  it('cuts the page from the top in parts of 2400, the last as tall as what is left, four at most', () => {
    expect(planCaptureTiles(5000)).toEqual([{ part: 1, y: 0, height: 2400 }, { part: 2, y: 2400, height: 2400 }, { part: 3, y: 4800, height: 200 }]);
    expect(planCaptureTiles(900)).toEqual([{ part: 1, y: 0, height: 900 }]);
    expect(planCaptureTiles(2400)).toEqual([{ part: 1, y: 0, height: 2400 }]);
    expect(planCaptureTiles(2401).map((t) => t.height)).toEqual([2400, 1]);
    expect(planCaptureTiles(9600).map((t) => t.height)).toEqual([2400, 2400, 2400, 2400]);
    expect(planCaptureTiles(40000).map((t) => t.y)).toEqual([0, 2400, 4800, 7200]);
    expect(planCaptureTiles(0)).toEqual([{ part: 1, y: 0, height: 900 }]);
    expect(planCaptureTiles(NaN)).toEqual([{ part: 1, y: 0, height: 900 }]);
  });
});

describe('jpegSize', () => {
  it('reads a JPEG\'s size and refuses other bytes', () => {
    expect(jpegSize(fakeJpeg(1440, 200))).toEqual({ width: 1440, height: 200 });
    expect(jpegSize(Buffer.from('<html>'))).toBe(null);
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBe(null);
    expect(jpegSize(null)).toBe(null);
  });
});

describe('captureNote / capturedUrlKey / partName', () => {
  it('writes the address whole, as a word of its own, and keys a capture by its first word only', () => {
    expect(captureNote(URL_, '')).toBe(`Screenshot of ${URL_}`);
    expect(captureNote(URL_, '  the   hero\n')).toBe(`Screenshot of ${URL_} - the hero`);
    expect(captureNote(URL_, 'x'.repeat(400))).toBe(`Screenshot of ${URL_} - ${'x'.repeat(300)}`);
    expect(capturedUrlKey(OLD[0])).toBe('shop.test');
    expect(capturedUrlKey(OTHER)).toBe('other.test');
    expect(capturedUrlKey(UPLOADED)).toBe(''); // the admin's own upload
    expect(capturedUrlKey({ ...OLD[0], addedBy: undefined })).toBe('');
    expect(capturedAssetsFor([PHOTO, ...OLD, OTHER, UPLOADED], URL_)).toEqual(OLD);
    expect(partName(URL_, 2, 3)).toBe('shop.test (part 2 of 3).jpg');
    expect(partName('https://shop.test/a', 1, 1)).toBe('shop.test.jpg');
  });
});

describe('isCaptureLive / isSameCaptureClaim', () => {
  it('is live while running and under 10 minutes old', () => {
    const t = Date.parse(STARTED);
    expect(isCaptureLive(claim(), t + 1000)).toBe(true);
    expect(isCaptureLive(claim(), t + CAPTURE_RUN_LIVE_MS - 1)).toBe(true);
    expect(isCaptureLive(claim(), t + CAPTURE_RUN_LIVE_MS)).toBe(false);
    expect(isCaptureLive(claim({ status: 'ready' }), t)).toBe(false);
    expect(isCaptureLive(null)).toBe(false);
    expect(isSameCaptureClaim(claim(), '2026-10-07T09:00:00+00:00')).toBe(true);
    expect(isSameCaptureClaim(claim(), '2026-10-07T09:00:01.000Z')).toBe(false);
    expect(isSameCaptureClaim(claim({ status: 'failed' }), STARTED)).toBe(false);
  });
});

// ─── Claiming and starting ────────────────────────────────────────────

describe('claimCapture / releaseCapture', () => {
  it('claims one capture at a time and keeps the rest of the design', async () => {
    const d = db({ capture: undefined });
    const nowMs = Date.parse(STARTED);
    const first = await claimCapture(d, PID, { url: URL_, note: ' the  hero ', nowMs });
    expect(first.claimed).toBe(true);
    expect(first.capture).toEqual({ status: 'running', url: URL_, note: 'the hero', startedAt: STARTED, finishedAt: null, parts: 0, error: null });
    expect(row(d).design).toMatchObject({ templateId: 'mobile_chrome', brand: { status: 'ready' }, capture: first.capture });
    const second = await claimCapture(d, PID, { url: 'https://other.test/', nowMs: nowMs + 1000 });
    expect(second).toMatchObject({ claimed: false, reason: 'live', capture: first.capture });
    // Stale: another may start.
    const third = await claimCapture(d, PID, { url: 'https://other.test/', nowMs: nowMs + CAPTURE_RUN_LIVE_MS });
    expect(third.claimed).toBe(true);
    expect(third.capture.note).toBeUndefined();
    expect(await claimCapture(d, '99999999-2222-4333-8444-555555555555', { url: URL_ })).toEqual({ claimed: false, capture: null, project: null, reason: 'not_found' });
  });

  it('refuses when the team\'s screenshots fill the project, counting this address\'s earlier capture as room', async () => {
    const team = (n) => Array.from({ length: n }, (_, i) => ({ ...UPLOADED, path: refPath(200 + i, 'png') }));
    expect((await claimCapture(db({ capture: undefined, assets: team(30) }), PID, { url: URL_ })).reason).toBe('full');
    // Customer uploads don't count.
    expect((await claimCapture(db({ capture: undefined, assets: [...team(29), CUSTOMER_REF] }), PID, { url: URL_ })).claimed).toBe(true);
    expect((await claimCapture(db({ capture: undefined, assets: [...team(28), ...OLD] }), PID, { url: URL_ })).claimed).toBe(true);
  });

  it('gives up a claim only while it is still that claim', async () => {
    const d = db();
    expect(await releaseCapture(d, PID, '2026-10-07T09:00:05.000Z', 'nope')).toBe(false);
    expect(row(d).design.capture.status).toBe('running');
    expect(await releaseCapture(d, PID, STARTED, 'the background function answered 500', Date.parse(STARTED) + 2000)).toBe(true);
    expect(row(d).design.capture).toMatchObject({ status: 'failed', error: 'the background function answered 500', finishedAt: '2026-10-07T09:00:02.000Z' });
  });
});

describe('captureSignature / invokeCaptureBackground', () => {
  it('signs the claim with a key of its own: a HEIC run\'s signature never starts a capture', () => {
    const payload = { id: PID, startedAt: STARTED, actor: 'admin@acg.test' };
    const sig = captureSignature(payload, SECRET);
    expect(verifyCaptureSignature(payload, sig, SECRET)).toBe(true);
    expect(verifyCaptureSignature({ ...payload, startedAt: '2026-10-07T09:00:01.000Z' }, sig, SECRET)).toBe(false);
    expect(verifyCaptureSignature({ ...payload, actor: 'x' }, sig, SECRET)).toBe(false);
    expect(verifyCaptureSignature(payload, heicSignature(payload, SECRET), SECRET)).toBe(false);
    expect(verifyCaptureSignature(payload, sig, 'another-key')).toBe(false);
    expect(verifyCaptureSignature(payload, '', SECRET)).toBe(false);
    expect(captureSignature(payload, '')).toBe('');
  });

  it('starts the background function on the deploy that took the request', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await invokeCaptureBackground({ rawUrl: 'https://deploy-preview-9--acg.netlify.app/.netlify/functions/custom-site-admin' }, { id: PID, startedAt: STARTED, actor: 'admin@acg.test' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://deploy-preview-9--acg.netlify.app${CAPTURE_BACKGROUND_PATH}`);
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ id: PID, startedAt: STARTED, actor: 'admin@acg.test' });
    expect(verifyCaptureSignature(sent, init.headers[CAPTURE_SIGNATURE_HEADER])).toBe(true);
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500 }));
    await expect(invokeCaptureBackground({}, { id: PID, startedAt: STARTED })).rejects.toThrow('the background function answered 500');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(invokeCaptureBackground({}, { id: PID, startedAt: STARTED })).rejects.toThrow('no key');
  });
});

// ─── The capture on a fake browser ────────────────────────────────────

describe('capturePage', () => {
  it('loads the page as a desktop Chrome would, scrolls it, and shoots it from the top in 1440 x 2400 parts', async () => {
    const b = fakeBrowser({ height: 5000 });
    const out = await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK });
    expect(out.parts.map(({ part, y, width, height }) => ({ part, y, width, height }))).toEqual([
      { part: 1, y: 0, width: 1440, height: 2400 }, { part: 2, y: 2400, width: 1440, height: 2400 }, { part: 3, y: 4800, width: 1440, height: 200 },
    ]);
    expect(b.log.screenshots).toEqual([0, 2400, 4800].map((y, i) => ({
      type: 'jpeg', quality: 80, captureBeyondViewport: true, clip: { x: 0, y, width: 1440, height: i < 2 ? 2400 : 200 },
    })));
    expect(b.log.viewport).toEqual({ width: 1440, height: 900, deviceScaleFactor: 1 });
    expect(b.log.ua).toBe(CAPTURE_USER_AGENT);
    expect(b.log.ua).toMatch(/Chrome\/143/);
    expect(b.log.ua).not.toMatch(/Headless/i);
    expect(b.log.bypassServiceWorker).toBe(true);
    expect(b.log.interception).toBe(true);
    expect(b.log.goto).toEqual({ url: URL_, opts: { waitUntil: 'load', timeout: 25000 } });
    expect(b.log.idle).toEqual({ idleTime: 500, timeout: 8000 });
    // Down a screen at a time, then back to the top.
    expect(b.log.scrolls).toEqual([900, 1800, 2700, 3600, 4500, 0]);
    // Every connection through the guard's proxy.
    expect(b.log.launches[0].args.find((a) => a.startsWith('--proxy-server='))).toMatch(/^--proxy-server=http:\/\/127\.0\.0\.1:\d+$/);
    expect(b.log.closed).toBe(1);
  });

  it('scrolls at most 9600 px and stops at four parts on a long page', async () => {
    const b = fakeBrowser({ height: 30000 });
    const out = await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK });
    expect(out.parts.map((p) => p.y)).toEqual([0, 2400, 4800, 7200]);
    expect(Math.max(...b.log.scrolls)).toBeLessThan(9600);
  });

  it('aborts every request the guard refuses: private hosts, other schemes; data: and public ones go through', async () => {
    const b = fakeBrowser({
      subresources: [
        'https://cdn.shop.test/hero.jpg', 'http://169.254.169.254/latest/meta-data/', 'http://internal.shop.test/x.png',
        'http://[::ffff:7f00:1]/', 'http://2130706433/', 'file:///etc/passwd', 'chrome://settings/', 'data:image/png;base64,AAAA',
        'blob:https://www.shop.test/1234', 'https://cdn.shop.test:6379/',
      ],
    });
    const out = await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK });
    expect(out.parts).toHaveLength(3);
    const verdict = Object.fromEntries(b.log.requests.map((r) => [r.url, r.continued ? 'ok' : r.code]));
    expect(verdict).toEqual({
      [URL_]: 'ok',
      'https://cdn.shop.test/hero.jpg': 'ok',
      'http://169.254.169.254/latest/meta-data/': 'blockedbyclient',
      'http://internal.shop.test/x.png': 'blockedbyclient',
      'http://[::ffff:7f00:1]/': 'blockedbyclient',
      'http://2130706433/': 'blockedbyclient',
      'file:///etc/passwd': 'blockedbyclient',
      'chrome://settings/': 'blockedbyclient',
      'data:image/png;base64,AAAA': 'ok',
      'blob:https://www.shop.test/1234': 'ok',
      'https://cdn.shop.test:6379/': 'blockedbyclient',
    });
    expect(out.refused.map((r) => r.code)).toEqual(['private', 'private', 'private', 'private', 'scheme', 'scheme', 'port']);
  });

  it('stops at a redirect to a private host (interception sees every hop)', async () => {
    for (const to of ['http://169.254.169.254/latest/meta-data/', 'http://internal.shop.test/admin', 'http://[::1]/', 'http://rebind.shop.test/']) {
      const b = fakeBrowser({ redirects: ['https://shop.test/', to] });
      const err = await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK }).catch((e) => e);
      expect(err.message, to).toBe(CAPTURE_MESSAGES.redirect_private);
      expect(b.log.requests.map((r) => r.continued ? 'ok' : r.code)).toEqual(['ok', 'ok', 'blockedbyclient']);
      expect(b.log.screenshots).toEqual([]);
      expect(b.log.closed).toBe(1);
    }
  });

  it('shows sections that wait to be scrolled to and hides consent and chat boxes before the shots', async () => {
    const b = fakeBrowser({ height: 2400 });
    await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK });
    expect(b.log.scripts).toEqual(['reveal', 'hideOverlays']);
  });

  it('shoots a page whose load event never comes once its document is parsed, but not one that never parsed', async () => {
    const timeout = Object.assign(new Error('Navigation timeout of 25000 ms exceeded'), { name: 'TimeoutError' });
    const slow = fakeBrowser({ height: 2400, gotoError: timeout, readyState: 'interactive' });
    const out = await capturePage({ url: URL_, launch: slow.launch, lookup, ...QUICK });
    expect(out.parts).toHaveLength(1);
    const stuck = fakeBrowser({ gotoError: timeout, readyState: 'loading' });
    const err = await capturePage({ url: URL_, launch: stuck.launch, lookup, ...QUICK }).catch((e) => e);
    expect(err.code).toBe('timeout');
    // Any other error still fails, parsed or not.
    const broken = fakeBrowser({ gotoError: new Error('net::ERR_CERT_DATE_INVALID at https://www.shop.test/'), readyState: 'complete' });
    expect((await capturePage({ url: URL_, launch: broken.launch, lookup, ...QUICK }).catch((e) => e)).code).toBe('certificate');
  });

  it('never starts the browser for an address the guard refuses', async () => {
    for (const [url, code] of [['http://10.0.0.1/', 'private'], ['https://nowhere.test/', 'not_found'], ['http://localhost/', 'private'], ['ftp://shop.test/', 'scheme']]) {
      const b = fakeBrowser();
      const err = await capturePage({ url, launch: b.launch, lookup, ...QUICK }).catch((e) => e);
      expect(err.code, url).toBe(code);
      expect(b.log.launches).toEqual([]);
    }
  });

  it('turns what went wrong into a short sentence for the admin, and always closes the browser', async () => {
    const timeout = Object.assign(new Error('Navigation timeout of 25000 ms exceeded'), { name: 'TimeoutError' });
    const cases = [
      [{ gotoError: timeout }, 'That site didn\'t load in 25 seconds'],
      [{ status: 403 }, 'That site blocked our browser'],
      [{ status: 429 }, 'That site blocked our browser'],
      [{ status: 503, headers: { 'cf-mitigated': 'challenge' } }, 'That site blocked our browser'],
      [{ status: 404 }, CAPTURE_MESSAGES.page_not_found],
      [{ status: 500 }, 'That site answered with an error (500). Try again later.'],
      [{ status: 502, headers: { 'x-acg-capture-proxy': 'unreachable' } }, CAPTURE_MESSAGES.unreachable],
      [{ gotoError: new Error('net::ERR_NAME_NOT_RESOLVED at https://www.shop.test/') }, CAPTURE_MESSAGES.not_found],
      [{ gotoError: new Error('net::ERR_CERT_DATE_INVALID at https://www.shop.test/') }, CAPTURE_MESSAGES.certificate],
      [{ gotoError: new Error('net::ERR_TUNNEL_CONNECTION_FAILED at https://www.shop.test/') }, CAPTURE_MESSAGES.unreachable],
      [{ gotoError: new Error('net::ERR_ABORTED at https://www.shop.test/file.zip') }, CAPTURE_MESSAGES.not_page],
      [{ gotoError: new Error('net::ERR_TOO_MANY_REDIRECTS') }, CAPTURE_MESSAGES.redirects],
      [{ gotoError: new Error('Protocol error: Target closed') }, CAPTURE_MESSAGES.failed],
    ];
    for (const [scene, message] of cases) {
      const b = fakeBrowser(scene);
      const err = await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK }).catch((e) => e);
      expect(err.message, JSON.stringify(scene)).toBe(message);
      expect(b.log.closed).toBe(1);
    }
    const b = fakeBrowser({ launchError: new Error('spawn ENOENT') });
    expect((await capturePage({ url: URL_, launch: b.launch, lookup, ...QUICK }).catch((e) => e)).message).toBe('Our browser couldn\'t start. Try again in a minute.');
  });

  it('gives a page that keeps the browser busy up, and closes the browser', async () => {
    const busy = fakeBrowser({ height: 5000 });
    // The page never settles: every wait in the scroll hangs.
    const err = await capturePage({ url: URL_, launch: busy.launch, lookup, sleep: () => new Promise(() => {}), budgetMs: 30 }).catch((e) => e);
    expect(err.message).toBe(CAPTURE_MESSAGES.too_slow);
    expect(busy.log.screenshots).toEqual([]);
    expect(busy.log.closed).toBe(1);
  });

  it('says the browser didn\'t start when the time runs out before it did, and closes it once it does', async () => {
    let started = null;
    const slow = fakeBrowser();
    const launch = (opts) => new Promise((resolve) => { setTimeout(() => resolve(slow.launch(opts).then((br) => { started = br; return br; })), 40); });
    const err = await capturePage({ url: URL_, launch, lookup, ...QUICK, budgetMs: 10 }).catch((e) => e);
    // Our side (the download or the launch hung), not the site's.
    expect(err.message).toBe(CAPTURE_MESSAGES.browser);
    await new Promise((r) => { setTimeout(r, 80); });
    expect(started).not.toBe(null);
    expect(slow.log.closed).toBe(1);
  });
});

// ─── The run ──────────────────────────────────────────────────────────

describe('runCapture', () => {
  it('stores the parts as the team\'s reference screenshots and marks the run ready in the same write', async () => {
    const d = db();
    const b = fakeBrowser({ height: 5000 });
    const result = await run(d, b);
    expect(result).toEqual({ status: 200, ok: true, parts: 3, dropped: 0, replaced: 0, recorded: true });

    const note = 'Screenshot of https://www.shop.test/ - the hero and the services grid';
    const parts = [1, 2, 3].map((part) => ({
      path: newPath(101 + part), kind: 'reference', name: `shop.test (part ${part} of 3).jpg`, size: 23, type: 'image/jpeg',
      note, addedBy: 'admin', group: GROUP, part, captured: true,
    }));
    expect(row(d).assets).toEqual([PHOTO, CUSTOMER_REF, ...parts]);
    expect(d.state.uploads.map((u) => [u.bucket, u.path, u.opts])).toEqual(parts.map((p) => ['custom-site-assets', p.path, { contentType: 'image/jpeg', upsert: false }]));
    expect(jpegSize(d.state.files[parts[2].path])).toEqual({ width: 1440, height: 200 });
    expect(row(d).design).toEqual({
      templateId: 'mobile_chrome', brand: { status: 'ready' },
      capture: { ...claim(), attempted: true, status: 'ready', finishedAt: '2026-10-07T09:00:42.000Z', parts: 3, error: null },
    });
    expect(d.state.events.map((e) => [e.type, e.data, e.actor])).toEqual([
      ['reference_captured', { url: URL_, parts: 3, replaced: 0 }, 'admin@acg.test'],
    ]);
    expect(d.state.removed).toEqual([]);
    expect(b.log.closed).toBe(1);

    // "Match its layout" on the address finds them, top first, exactly
    // as it finds a screenshot the admin uploaded.
    const choice = checkReferenceChoice({ mode: 'match', source: { kind: 'url', url: 'https://shop.test' } }, row(d));
    expect(choice.error).toBe('');
    expect(choice.shots.map((s) => s.path)).toEqual(parts.map((p) => p.path));
  });

  it('replaces an earlier capture of the same address once the new parts are in, and keeps everything else', async () => {
    const d = db({
      assets: [PHOTO, OLD[0], CUSTOMER_REF, OLD[1], UPLOADED, OTHER],
      design: { reference: { mode: 'match', source: { kind: 'asset', path: OLD[1].path } } },
    });
    const b = fakeBrowser({ height: 2500 });
    const result = await run(d, b);
    expect(result).toMatchObject({ ok: true, parts: 2, replaced: 2 });
    const fresh = row(d).assets.filter((a) => a.group === GROUP);
    expect(fresh.map((a) => [a.part, a.name])).toEqual([[1, 'shop.test (part 1 of 2).jpg'], [2, 'shop.test (part 2 of 2).jpg']]);
    // In the earlier capture's place; the admin's own upload of the same
    // address and the other site's capture stay.
    expect(row(d).assets.map((a) => a.path)).toEqual([PHOTO.path, fresh[0].path, fresh[1].path, CUSTOMER_REF.path, UPLOADED.path, OTHER.path]);
    // The picked reference follows to the new part in its place.
    expect(row(d).design.reference).toEqual({ mode: 'match', source: { kind: 'asset', path: fresh[1].path } });
    // New files first, the old ones deleted after the list stopped
    // pointing at them.
    const ops = d.state.calls.filter(([op]) => op === 'upload' || op === 'remove');
    expect(ops).toEqual([['upload', fresh[0].path], ['upload', fresh[1].path], ['remove', OLD[0].path], ['remove', OLD[1].path]]);
    expect(d.state.files[OLD[0].path]).toBeUndefined();
    expect(d.state.files[UPLOADED.path]).toBeDefined();
    expect(d.state.events.map((e) => [e.type, e.data])).toEqual([['reference_captured', { url: URL_, parts: 2, replaced: 2 }]]);
  });

  it('keeps the team\'s limit: stores the top parts that fit, and refuses when none does', async () => {
    const team = (n) => Array.from({ length: n }, (_, i) => ({ ...UPLOADED, path: refPath(200 + i, 'png') }));
    // Room for one: the top of the page is kept, the other parts removed.
    const d = db({ assets: team(29) });
    const result = await run(d, fakeBrowser({ height: 5000 }));
    expect(result).toMatchObject({ ok: true, parts: 1 });
    expect(row(d).assets).toHaveLength(30);
    expect(d.state.uploads).toHaveLength(3);
    const top = row(d).assets.at(-1);
    expect(top).toMatchObject({ path: d.state.uploads[0].path, part: 1, captured: true });
    expect(d.state.removed.map((r) => r.path)).toEqual(d.state.uploads.slice(1).map((u) => u.path));
    expect(row(d).design.capture).toMatchObject({ status: 'ready', parts: 1 });

    // No room left by the time the parts are saved (the team filled the
    // project during the capture): refused, and nothing it uploaded stays.
    const full = db({ assets: team(30) });
    const refused = await run(full, fakeBrowser({ height: 5000 }));
    expect(refused).toMatchObject({ ok: false, code: 'full', error: REFERENCE_FULL });
    expect(row(full).assets).toHaveLength(30);
    expect(full.state.removed.map((r) => r.path)).toEqual(full.state.uploads.map((u) => u.path));
    expect(row(full).design.capture).toMatchObject({ status: 'failed', error: REFERENCE_FULL, parts: 0, finishedAt: '2026-10-07T09:00:42.000Z' });
    expect(full.state.events.map((e) => e.type)).toEqual(['reference_capture_failed']);

    // An earlier capture of the address makes room as it goes.
    const d2 = db({ assets: [...team(27), ...OLD] });
    expect((await run(d2, fakeBrowser({ height: 5000 }))).parts).toBe(3);
    expect(row(d2).assets).toHaveLength(30);
  });

  it('lands its write when the customer\'s autosave got there first (re-reads, keeps their change)', async () => {
    const d = db();
    const added = { path: `${PID}/photo/${uuid(77)}.jpg`, kind: 'photo', name: 'new.jpg', size: 9, type: 'image/jpeg' };
    let calls = 0;
    d.state.onUpload = () => {
      calls += 1;
      if (calls === 3) {
        d.state.beforeUpdate = (r) => {
          r.assets = [...r.assets, added];
          r.updated_at = '2026-10-07T09:00:30.000000+00:00';
        };
      }
    };
    expect((await run(d, fakeBrowser({ height: 5000 }))).ok).toBe(true);
    expect(row(d).assets.map((a) => a.path)).toContain(added.path);
    expect(row(d).assets.filter((a) => a.captured)).toHaveLength(3);
  });

  it('records a failure for the admin and removes nothing it didn\'t upload', async () => {
    const d = db({ assets: [PHOTO, ...OLD] });
    const result = await run(d, fakeBrowser({ status: 403 }));
    expect(result).toEqual({ status: 200, ok: false, code: 'blocked', error: 'That site blocked our browser' });
    expect(row(d).design.capture).toEqual({ ...claim(), attempted: true, status: 'failed', finishedAt: '2026-10-07T09:00:42.000Z', parts: 0, error: 'That site blocked our browser' });
    expect(row(d).assets).toEqual([PHOTO, ...OLD]);
    expect(d.state.uploads).toEqual([]);
    expect(d.state.removed).toEqual([]);
    expect(d.state.events.map((e) => [e.type, e.data])).toEqual([['reference_capture_failed', { url: URL_, error: 'That site blocked our browser', code: 'blocked' }]]);
  });

  it('gives up on a storage call that never answers, and still records the failure', async () => {
    // An upload that hangs: the run stops waiting, removes what it
    // uploaded (that removal hangs too) and says so on the record.
    const d = db();
    let n = 0;
    const store = d.storage.from;
    d.storage.from = (bucket) => {
      const api = store(bucket);
      return {
        ...api,
        upload: (...a) => { n += 1; return n === 2 ? new Promise(() => {}) : api.upload(...a); },
        remove: () => new Promise(() => {}),
      };
    };
    const result = await run(d, fakeBrowser({ height: 5000 }), { storageTimeoutMs: 20 });
    expect(result).toMatchObject({ ok: false, code: 'store', error: 'The screenshots could not be stored. Try again.' });
    expect(row(d).design.capture).toMatchObject({ status: 'failed', error: 'The screenshots could not be stored. Try again.' });
    expect(row(d).assets).toEqual([PHOTO, CUSTOMER_REF]);
    expect(d.state.events.map((e) => e.type)).toEqual(['reference_capture_failed']);
  });

  it('removes the parts it uploaded when one upload fails', async () => {
    const d = db();
    let n = 0;
    d.state.uploadError = () => { n += 1; return n === 2; };
    const result = await run(d, fakeBrowser({ height: 5000 }));
    expect(result).toMatchObject({ ok: false, code: 'store', error: 'The screenshots could not be stored. Try again.' });
    expect(d.state.removed.map((r) => r.path)).toEqual([newPath(102), newPath(103)]);
    expect(row(d).assets).toEqual([PHOTO, CUSTOMER_REF]);
    expect(row(d).design.capture.status).toBe('failed');
  });

  it('checks the claimed address again before the browser starts', async () => {
    const d = db({ capture: claim({ url: 'http://internal.shop.test/' }) });
    const b = fakeBrowser();
    expect(await run(d, b)).toMatchObject({ ok: false, code: 'private' });
    expect(b.log.launches).toEqual([]);
    expect(row(d).design.capture).toMatchObject({ status: 'failed', error: CAPTURE_MESSAGES.private });
  });

  it('runs a claim once: a retried start finds it attempted', async () => {
    const d = db();
    const b = fakeBrowser({ height: 900 });
    expect((await run(d, b)).ok).toBe(true);
    // The same claim again (the record says ready now): no match.
    expect((await run(d, b)).status).toBe(409);
    const d2 = db({ capture: claim({ attempted: true }) });
    const b2 = fakeBrowser();
    expect(await run(d2, b2)).toEqual({ status: 200, error: 'This capture was already attempted' });
    expect(b2.log.launches).toEqual([]);
    expect(b.log.launches).toHaveLength(1);
  });

  it('runs only the claim it was given', async () => {
    const b = fakeBrowser();
    expect((await run(db(), b, { startedAt: '2026-10-07T09:00:01.000Z' })).status).toBe(409);
    expect((await run(db({ capture: claim({ status: 'ready' }) }), b)).status).toBe(409);
    expect((await run(db({ capture: undefined }), b)).status).toBe(409);
    expect((await run(db(), b, { projectId: '99999999-2222-4333-8444-555555555555' })).status).toBe(404);
    expect((await run(db(), b, { projectId: '' })).status).toBe(404);
    expect(b.log.launches).toEqual([]);
  });

  it('leaves a newer claim\'s record alone (the screenshots still land)', async () => {
    const d = db();
    const b = fakeBrowser({ height: 900 });
    const newer = claim({ startedAt: '2026-10-07T09:20:00.000Z', url: 'https://other.test/' });
    const orig = b.launch;
    const launch = async (opts) => {
      row(d).design.capture = newer;
      return orig(opts);
    };
    const result = await run(d, { launch });
    expect(result).toMatchObject({ ok: true, parts: 1, recorded: false });
    expect(row(d).design.capture).toEqual(newer);
    expect(row(d).assets.filter((a) => a.captured)).toHaveLength(1);
  });
});

// ─── Starting the browser ─────────────────────────────────────────────

describe('launchBrowser', () => {
  // chromium-min's own list, as it hands it over.
  const CHROMIUM_ARGS = [
    '--single-process', '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process', '--enable-features=SharedArrayBuffer',
    '--disable-web-security', '--allow-running-insecure-content', '--no-sandbox', "--headless='shell'",
  ];
  function packages() {
    const seen = { launch: null, packUrl: null };
    class Chromium {
      static graphicsMode = true;
      static set setGraphicsMode(v) { Chromium.graphicsMode = v; }
      static get args() { return CHROMIUM_ARGS; }
      static async executablePath(input) { seen.packUrl = input; return '/tmp/chromium'; }
    }
    const puppeteer = { launch: async (opts) => { seen.launch = opts; return { fake: true }; } };
    return { seen, Chromium, modules: { puppeteer: async () => ({ default: puppeteer }), chromium: async () => ({ default: Chromium }) } };
  }

  it('starts chromium-min\'s Chromium without its unsafe flags, with downloads denied', async () => {
    const { seen, Chromium, modules } = packages();
    expect(await launchBrowser({ args: ['--proxy-server=http://127.0.0.1:9'], modules })).toEqual({ fake: true });
    expect(seen.packUrl).toBe(CHROMIUM_PACK_URL);
    expect(CHROMIUM_PACK_URL).toBe('https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar');
    expect(Chromium.graphicsMode).toBe(false);
    expect(seen.launch).toMatchObject({
      executablePath: '/tmp/chromium',
      headless: 'shell',
      // No --disable-web-security, --allow-running-insecure-content or
      // SharedArrayBuffer for every page.
      args: ['--single-process', '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process', '--no-sandbox', "--headless='shell'", '--proxy-server=http://127.0.0.1:9'],
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      downloadBehavior: { policy: 'deny' },
      acceptInsecureCerts: false,
    });
  });

  it('clears a half-unpacked browser and starts once more when the first start fails', async () => {
    const { seen, modules } = packages();
    let starts = 0;
    const puppeteer = { launch: async (opts) => { starts += 1; seen.launch = opts; if (starts === 1) throw new Error('spawn /tmp/chromium ENOEXEC'); return { fake: true }; } };
    const cleared = [];
    const out = await launchBrowser({ modules: { ...modules, puppeteer: async () => ({ default: puppeteer }) }, clear: async () => { cleared.push(starts); } });
    expect(out).toEqual({ fake: true });
    expect(starts).toBe(2);
    expect(cleared).toEqual([1]);
    // A browser given by path is never cleared or retried.
    let tries = 0;
    const failing = { launch: async () => { tries += 1; throw new Error('no'); } };
    await expect(launchBrowser({ executablePath: '/usr/bin/chrome', modules: { ...modules, puppeteer: async () => ({ default: failing }) }, clear: async () => { cleared.push('x'); } })).rejects.toThrow('no');
    expect(tries).toBe(1);
    expect(cleared).toEqual([1]);
  });

  it('names the Node runtime for chromium-min on a Lambda that doesn\'t', () => {
    const linux = process.platform === 'linux';
    expect(lambdaRuntimeHint({}, '20.18.0')).toBe(null);
    expect(lambdaRuntimeHint({ LAMBDA_TASK_ROOT: '/var/task', AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs20.x' }, '20.18.0')).toBe(null);
    expect(lambdaRuntimeHint({ LAMBDA_TASK_ROOT: '/var/task', AWS_LAMBDA_JS_RUNTIME: 'nodejs22.x' }, '22.1.0')).toBe(null);
    expect(lambdaRuntimeHint({ LAMBDA_TASK_ROOT: '/var/task' }, '20.18.0')).toBe(linux ? 'nodejs20.x' : null);
  });

  it('keeps the other features chromium-min turns on', () => {
    expect(safeChromiumArgs(['--enable-features=Foo,SharedArrayBuffer,Bar', '--disable-web-security=1', '--x'])).toEqual(['--enable-features=Foo,Bar', '--x']);
    expect(safeChromiumArgs(null)).toEqual([]);
  });

  it('hands the browser an environment without the functions\' secrets', async () => {
    const secrets = {
      SUPABASE_SERVICE_ROLE_KEY: 's1', STRIPE_SECRET_KEY: 's2', STRIPE_WEBHOOK_SECRET: 's3', POSTMARK_SERVER_TOKEN: 's4', ANTHROPIC_API_KEY: 's5',
      CLOUDFLARE_API_TOKEN: 's6', ZOOM_CLIENT_SECRET: 's7', AWS_SECRET_ACCESS_KEY: 's8', AWS_SESSION_TOKEN: 's9', AWS_LAMBDA_RUNTIME_API: '127.0.0.1:9001',
      NETLIFY_BLOBS_CONTEXT: 's10', VITE_SUPABASE_ANON_KEY: 's11',
    };
    const needed = { LD_LIBRARY_PATH: '/tmp/al2023/lib', FONTCONFIG_PATH: '/tmp/fonts', HOME: '/tmp', TZ: ':UTC' };
    for (const [k, v] of Object.entries({ ...secrets, ...needed })) vi.stubEnv(k, v);
    const { seen, modules } = packages();
    await launchBrowser({ modules });
    for (const k of Object.keys(secrets)) expect(seen.launch.env, k).not.toHaveProperty(k);
    expect(seen.launch.env).toMatchObject(needed);
    expect(browserEnv({ PATH: '/usr/bin', MAIN_APP_URL: 'https://x.test', DOMAIN_SWEEP_TOKEN: 't', SHOPIFY_WEBHOOK_SECRET: 'w', DATABASE_URL: 'postgres://u:p@h/db' }))
      .toEqual({ PATH: '/usr/bin', MAIN_APP_URL: 'https://x.test' });
  });

  it('downloads the pack from CHROMIUM_PACK_URL when set, and uses a given browser as it is', async () => {
    vi.stubEnv('CHROMIUM_PACK_URL', 'https://files.acg.test/chromium-pack.tar');
    const a = packages();
    await launchBrowser({ modules: a.modules });
    expect(a.seen.packUrl).toBe('https://files.acg.test/chromium-pack.tar');
    const b = packages();
    await launchBrowser({ executablePath: '/usr/bin/chrome', args: ['--x'], modules: b.modules });
    expect(b.seen.packUrl).toBe(null);
    expect(b.seen.launch).toMatchObject({ executablePath: '/usr/bin/chrome', headless: true, args: ['--x'] });
  });
});

// ─── The HTTP wrapper ─────────────────────────────────────────────────

describe('custom-site-capture-background handler', () => {
  const post = (body, signature) => ({
    httpMethod: 'POST',
    headers: signature === undefined ? {} : { [CAPTURE_SIGNATURE_HEADER]: signature },
    body: JSON.stringify(body),
  });
  const payload = { id: PID, startedAt: STARTED, actor: 'admin@acg.test' };

  it('takes only POSTs signed with the server\'s key for this function', async () => {
    h.db = db();
    expect((await handler({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
    expect((await handler({ httpMethod: 'POST', headers: {}, body: '{' })).statusCode).toBe(400);
    expect((await handler(post(payload))).statusCode).toBe(401);
    expect((await handler(post(payload, 'forged'))).statusCode).toBe(401);
    expect((await handler(post(payload, heicSignature(payload, SECRET)))).statusCode).toBe(401);
    expect((await handler(post({ ...payload, startedAt: '2026-10-07T09:00:01.000Z' }, captureSignature(payload, SECRET)))).statusCode).toBe(401);
    expect(row(h.db).design.capture.attempted).toBeUndefined();
  });

  it('answers 200 once started, whatever the outcome, so Netlify never retries it', async () => {
    // The claimed address is refused before any browser starts.
    h.db = db({ capture: claim({ url: 'http://10.0.0.1/' }) });
    expect((await handler(post(payload, captureSignature(payload, SECRET)))).statusCode).toBe(200);
    expect(row(h.db).design.capture).toMatchObject({ status: 'failed', attempted: true, error: CAPTURE_MESSAGES.private });
    // Retried: attempted already.
    expect((await handler(post(payload, captureSignature(payload, SECRET)))).statusCode).toBe(200);
    // No such claim, and a database that throws.
    h.db = db({ capture: undefined });
    expect((await handler(post(payload, captureSignature(payload, SECRET)))).statusCode).toBe(200);
    h.db = { from: () => { throw new Error('down'); } };
    expect((await handler(post(payload, captureSignature(payload, SECRET)))).statusCode).toBe(200);
  });
});
