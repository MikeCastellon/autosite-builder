// "Exact replica" builder, step 1: capture a page for layout study
// (.claude/skills/replica-template/SKILL.md). Used for the customer's
// reference site and, in step 4, for our own render of the replica.
//
//   node scripts/replica/capture.mjs <https://url | page.html> --out <dir outside the repo> [flags]
//   node scripts/replica/capture.mjs --image desktop=<shot.png> [--image phone=<shot.png>] --out <dir>
//
// Flags:
//   --viewports desktop,phone   names from VIEWPORTS, or name:WIDTHxHEIGHT (default desktop,phone)
//   --offline                   fail every request off this machine at once (loopback still loads);
//                               the Tailwind CDN gets a local preflight stand-in
//   --timeout 30000             page load deadline (ms); after it the page renders with what it has
//   --font-timeout 4000         per remote font / font stylesheet (ms)
//   --asset-timeout 8000        per remote stylesheet / script (ms)
//   --max-height 16000          stop tiling after this many CSS px of page
//   --dpr 1                     device pixel ratio of the tiles
//   --hide "<css selector>"     hide overlays (cookie banners, chat bubbles) with display:none;
//                               never click "accept": hiding needs no consent
//   --no-text                   leave heading and button text out of the outline
//   --chrome <path>             Chrome/Chromium binary (else $CHROME_PATH, else the usual places)
//
// Writes, per viewport:
//   <out>/<viewport>/tile-000.png ...  viewport-sized tiles from the top down (manifest has each one's y)
//   <out>/<viewport>/outline.json       landmarks, sections, headings, type scale, buttons, cards,
//                                       spacing, fonts and color roles, read from computed styles
//   <out>/manifest.json                 what was captured, tile offsets, failed or substituted requests
//
// LAYOUT STUDY ONLY. A capture holds the reference business's words, photos
// and logo, so it stays outside the repo (an --out inside it is refused) and
// nothing in it goes into a template: only layout, structure, spacing, type
// feel and component style carry over. The customer's content, colors and
// logo go in.
//
// Why it is built this way (README.md has the background):
// - Plain Chrome DevTools Protocol over Node's own WebSocket: puppeteer is not
//   in node_modules and nothing may be installed.
// - --remote-debugging-port=0: Chrome picks a free port and writes it to
//   DevToolsActivePort, so parallel sessions never attach to each other's
//   browser (a fixed port did exactly that).
// - Remote fonts, stylesheets and scripts are fetched by Node with a deadline
//   and handed to Chrome through the Fetch domain. A font host that never
//   answered used to keep readyState at "loading" and hang
//   Page.captureScreenshot; now it fails after --font-timeout and the page
//   paints with fallback fonts. The manifest lists what failed.
// - Viewport tiles, never captureBeyondViewport: full-page clips hung too.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../..');

export const CAPTURE_FORMAT = 'acg-replica-capture/1';
export const OUTLINE_FORMAT = 'acg-replica-outline/1';
export const CAPTURE_NOTE = 'Layout study only. Never copy the reference\'s words, photos, logos, brand marks, '
  + 'brand name or color values into a template, and never commit this folder: the customer\'s own content, '
  + 'colors and logo go in.';

export const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ name: 'desktop', width: 1440, height: 900, mobile: false }),
  phone: Object.freeze({ name: 'phone', width: 390, height: 844, mobile: true }),
});

export const DEFAULTS = Object.freeze({
  timeoutMs: 30000,
  fontTimeoutMs: 4000,
  assetTimeoutMs: 8000,
  maxHeight: 16000,
  dpr: 1,
  settleMs: 250,
});

const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;
const HTML_EXT_RE = /\.html?$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Chrome ──────────────────────────────────────────────────────────

const CHROME_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

// The Chrome binary to drive: an explicit path (or $CHROME_PATH) when given,
// else the first install found. null when there is none.
export function findChrome({ explicit, env = process.env, platform = process.platform, exists = existsSync } = {}) {
  const chosen = explicit || env.CHROME_PATH;
  if (chosen) return exists(chosen) ? chosen : null;
  return (CHROME_PATHS[platform] || []).find((p) => exists(p)) || null;
}

// A tiny CDP client: one WebSocket to the browser, flattened sessions per tab.
class CdpClient {
  static async connect(url, timeoutMs = 10000) {
    const WS = globalThis.WebSocket || (await import('ws')).WebSocket;
    const ws = new WS(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome')), timeoutMs);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Could not connect to Chrome')); });
    });
    return new CdpClient(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Set();
    ws.addEventListener('message', (ev) => this.onMessage(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')));
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Chrome closed the connection')); }
      this.pending.clear();
    });
  }

  onMessage(text) {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.id) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result || {});
      return;
    }
    for (const h of this.handlers) {
      try { h(msg); } catch { /* one bad handler must not stop the others */ }
    }
  }

  send(method, params = {}, sessionId, timeoutMs = 30000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`${method} timed out after ${timeoutMs} ms`), { name: 'TimeoutError' }));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

// Starts a private headless Chrome (its own temporary profile) and connects.
// Returns { cdp, close, version }.
export async function launchChrome({ chromePath, startTimeoutMs = 20000 } = {}) {
  const bin = chromePath || findChrome();
  if (!bin) throw new Error('No Chrome found: pass --chrome <path> or set CHROME_PATH to a Chrome or Chromium binary');
  const profile = mkdtempSync(path.join(tmpdir(), 'replica-chrome-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    'about:blank',
  ];
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  let spawnError = null;
  proc.on('error', (e) => { spawnError = e; });

  const cleanup = () => {
    try { proc.kill('SIGKILL'); } catch { /* gone */ }
    rmSync(profile, { recursive: true, force: true });
  };

  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + startTimeoutMs;
  let wsUrl = null;
  while (!wsUrl && Date.now() < deadline && !spawnError && proc.exitCode === null) {
    try {
      const [port, wsPath] = readFileSync(portFile, 'utf8').split('\n').map((s) => s.trim());
      if (/^\d+$/.test(port) && wsPath?.startsWith('/devtools/')) wsUrl = `ws://127.0.0.1:${port}${wsPath}`;
    } catch { /* not written yet */ }
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) {
    cleanup();
    const why = spawnError?.message || stderr.trim().split('\n').slice(-3).join(' | ') || 'no DevTools port';
    throw new Error(`Chrome did not start (${why})`);
  }

  let cdp;
  try {
    cdp = await CdpClient.connect(wsUrl);
  } catch (e) {
    cleanup();
    throw e;
  }
  const { userAgent = '' } = await cdp.send('Browser.getVersion').catch(() => ({}));
  const version = (/Chrome\/([\d.]+)/.exec(userAgent) || [])[1] || '';

  const close = async () => {
    await cdp.send('Browser.close', {}, undefined, 3000).catch(() => {});
    cdp.close();
    const exited = proc.exitCode !== null || await Promise.race([
      new Promise((r) => proc.once('exit', () => r(true))),
      sleep(3000).then(() => false),
    ]);
    if (!exited) {
      try { proc.kill('SIGKILL'); } catch { /* gone */ }
    }
    rmSync(profile, { recursive: true, force: true });
  };
  return { cdp, close, version };
}

// A new tab with its own flattened session.
export async function openTab(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params, timeoutMs) => cdp.send(method, params, sessionId, timeoutMs);
  const on = (fn) => cdp.on((msg) => { if (msg.sessionId === sessionId) fn(msg); });
  const waitFor = (method, timeoutMs) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(Object.assign(new Error(`${method} not seen in ${timeoutMs} ms`), { name: 'TimeoutError' })); }, timeoutMs);
    const off = on((msg) => {
      if (msg.method !== method) return;
      clearTimeout(timer);
      off();
      resolve(msg.params || {});
    });
  });
  const close = () => cdp.send('Target.closeTarget', { targetId }, undefined, 5000).catch(() => {});
  return { targetId, sessionId, send, on, waitFor, close };
}

// Runs `fn` (a self-contained function) in the page with one JSON argument
// and returns its JSON result. Promises are awaited.
export async function evaluate(tab, fn, arg = null, timeoutMs = 20000) {
  const expression = `(${fn.toString()})(${JSON.stringify(arg)})`;
  const r = await tab.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(`Page script failed: ${d.exception?.description || d.text || 'unknown error'}`);
  }
  return r.result?.value;
}

// ─── Requests ────────────────────────────────────────────────────────

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const FONT_HOSTS = new Set([
  'fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'p.typekit.net', 'fonts.bunny.net',
  'use.fontawesome.com', 'kit.fontawesome.com', 'ka-f.fontawesome.com',
]);
const TAILWIND_CDN = 'cdn.tailwindcss.com';

// What happens to one request the page makes:
//   continue        Chrome loads it itself (pages, images, media, XHR): the
//                   page-load deadline bounds these
//   fail            --offline and not on this machine: fails at once
//   tailwind        the Tailwind CDN while offline: a local preflight stand-in
//   proxy-tailwind  the Tailwind CDN: fetched by Node, the stand-in if that fails
//   proxy-font      fonts and font stylesheets: fetched by Node within --font-timeout
//   proxy           other stylesheets and scripts (they block rendering):
//                   fetched by Node within --asset-timeout
export function requestRoute(url, resourceType, { offline = false } = {}) {
  let u;
  try { u = new URL(url); } catch { return 'continue'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'continue';
  if (u.hostname === TAILWIND_CDN) return offline ? 'tailwind' : 'proxy-tailwind';
  if (offline && !LOOPBACK.has(u.hostname)) return 'fail';
  if (resourceType === 'Document') return 'continue';
  if (resourceType === 'Font' || FONT_HOSTS.has(u.hostname)) return 'proxy-font';
  if (resourceType === 'Stylesheet' || resourceType === 'Script') return 'proxy';
  return 'continue';
}

// Tailwind's preflight with its theme() calls resolved to the CDN's defaults.
// Published pages load the Tailwind CDN for exactly this reset (CLAUDE.md:
// headings, lists and margins are reset), so an offline capture of our own
// render still lays out the way the live page does.
const PREFLIGHT_THEME = { 'borderColor.DEFAULT': '#e5e7eb', 'colors.gray.400': '#9ca3af' };
export function preflightCss(raw) {
  return String(raw).replace(/theme\(\s*'([^']+)'\s*(?:,\s*([^;]*?))?\)(?=\s*;)/g, (m, key, fallback) => (
    PREFLIGHT_THEME[key] ?? (fallback ? fallback.trim() : 'initial')
  ));
}

let preflightCache;
function tailwindStandIn() {
  if (preflightCache === undefined) {
    const file = path.join(REPO_ROOT, 'node_modules/tailwindcss/lib/css/preflight.css');
    preflightCache = existsSync(file) ? preflightCss(readFileSync(file, 'utf8')) : null;
  }
  if (!preflightCache) return null;
  return `(function(){var s=document.createElement('style');s.setAttribute('data-replica-preflight','');`
    + `s.textContent=${JSON.stringify(preflightCache)};(document.head||document.documentElement).appendChild(s);})();`;
}

const shortUrl = (url) => (url.length > 160 ? `${url.slice(0, 157)}...` : url);

const DROP_REQUEST_HEADERS = /^(host|connection|content-length|accept-encoding|upgrade-insecure-requests)$/i;
// Node's fetch decodes the body, so the encoding and length headers would lie.
const DROP_RESPONSE_HEADERS = /^(content-encoding|content-length|transfer-encoding|connection|set-cookie|keep-alive)$/i;

async function proxyFetch(request, timeoutMs) {
  const headers = {};
  for (const [k, v] of Object.entries(request.headers || {})) if (!DROP_REQUEST_HEADERS.test(k)) headers[k] = v;
  const method = request.method || 'GET';
  // The signal also bounds reading the body: a host that sends headers and
  // then stalls fails the same way.
  const res = await fetch(request.url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.postData,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = Buffer.from(await res.arrayBuffer());
  const responseHeaders = [];
  res.headers.forEach((value, name) => { if (!DROP_RESPONSE_HEADERS.test(name)) responseHeaders.push({ name, value }); });
  return { responseCode: res.status, responseHeaders, body: body.toString('base64') };
}

// Answers every paused request (Fetch.enable must follow). Fills `log`
// with { failed: [...], substituted: [...] }.
function interceptRequests(tab, opts, log) {
  return tab.on(async (msg) => {
    if (msg.method !== 'Fetch.requestPaused') return;
    const { requestId, request, resourceType } = msg.params;
    const route = requestRoute(request.url, resourceType, opts);
    const fail = (reason, errorReason) => {
      log.failed.push({ url: shortUrl(request.url), type: resourceType, reason });
      return tab.send('Fetch.failRequest', { requestId, errorReason });
    };
    const standIn = (reason) => {
      const js = tailwindStandIn();
      if (!js) return fail(reason, 'Failed');
      log.substituted.push({ url: shortUrl(request.url), type: resourceType, with: 'tailwind-preflight', reason });
      return tab.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
        ],
        body: Buffer.from(js).toString('base64'),
      });
    };
    try {
      if (route === 'continue') return await tab.send('Fetch.continueRequest', { requestId });
      if (route === 'fail') return await fail('offline', 'InternetDisconnected');
      if (route === 'tailwind') return await standIn('offline');
      const timeoutMs = route === 'proxy-font' ? opts.fontTimeoutMs : opts.assetTimeoutMs;
      let answer;
      try {
        answer = await proxyFetch(request, timeoutMs);
      } catch (e) {
        const reason = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? `timeout ${timeoutMs} ms` : 'unreachable';
        if (route === 'proxy-tailwind') return await standIn(reason);
        return await fail(reason, e?.name === 'TimeoutError' ? 'TimedOut' : 'Failed');
      }
      return await tab.send('Fetch.fulfillRequest', { requestId, ...answer });
    } catch {
      // The request went away (navigation, closed tab): nothing to answer.
    }
  });
}

// ─── In-page scripts (run inside Chrome: self-contained, no closures) ──

function injectCaptureStyles(arg) {
  const css = ['[data-replica-hide]{visibility:hidden!important}'];
  const bad = [];
  for (const sel of arg.hide || []) {
    try {
      document.querySelectorAll(sel);
      css.push(`${sel}{display:none!important}`);
    } catch {
      bad.push(sel);
    }
  }
  const style = document.createElement('style');
  style.setAttribute('data-replica-capture', '');
  style.textContent = css.join('\n');
  (document.head || document.documentElement).appendChild(style);
  return { bad };
}

// Scrolls through the page once, so lazy images load and reveal-on-scroll
// blocks show, then back to the top. Returns the page height (capped).
async function preScroll(arg) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const height = () => Math.min(
    Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
    arg.maxHeight,
  );
  const step = Math.max(200, Math.floor(window.innerHeight * 0.9));
  for (let y = 0, i = 0; y < height() && i < 80; y += step, i += 1) {
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    await wait(arg.waitMs);
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, wait(arg.fontWaitMs)]);
  await wait(arg.waitMs);
  const full = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  // Some smooth-scroll setups scroll an inner box, not the window: the
  // window then never moves and the capture would be one screen.
  let inner = 0;
  for (const el of Array.from(document.querySelectorAll('body, body *')).slice(0, 4000)) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) inner = Math.max(inner, el.scrollHeight);
  }
  return { height: Math.min(full, arg.maxHeight), full, inner };
}

// Scrolls to one tile and hides what would repeat on every tile: fixed
// elements and sticky ones stuck to an edge (the first tile keeps them; the
// last keeps a bottom bar, which is in its own place there).
async function prepareTile(arg) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelectorAll('[data-replica-hide]').forEach((el) => el.removeAttribute('data-replica-hide'));
  window.scrollTo({ top: arg.y, left: 0, behavior: 'instant' });
  const inView = Array.from(document.images).filter((img) => {
    if (img.complete) return false;
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
  await Promise.race([
    Promise.all(inView.map((img) => new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    }))),
    wait(arg.imageWaitMs),
  ]);
  await wait(arg.waitMs);
  const full = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const height = Math.min(full, arg.maxHeight);
  const y = window.scrollY;
  const last = y + window.innerHeight >= height - 1;
  let hidden = 0;
  if (!arg.first) {
    for (const el of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const atTop = r.top <= 1;
      const atBottom = r.bottom >= window.innerHeight - 1;
      if (pos === 'fixed' || atTop || (atBottom && !last)) {
        el.setAttribute('data-replica-hide', '');
        hidden += 1;
      }
    }
  }
  return { y, last, height, hidden };
}

function clearTileMarks() {
  document.querySelectorAll('[data-replica-hide]').forEach((el) => el.removeAttribute('data-replica-hide'));
  return true;
}

// The page's layout in numbers, from computed styles. Runs in the page.
// Coordinates are document pixels (scroll is at the top when it runs).
export function outlinePage(opts) {
  const o = opts || {};
  const textOn = o.text !== false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sy = window.scrollY || 0;
  const doc = document.documentElement;
  const body = document.body || doc;
  const pageH = Math.max(doc.scrollHeight, body.scrollHeight || 0);
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|BR|HEAD|TITLE)$/;
  const GENERICS = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace'];

  const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const cs = (el) => getComputedStyle(el);
  const rect = (el) => el.getBoundingClientRect();
  const box = (el) => { const r = rect(el); return { x: round(r.left), y: round(r.top + sy), w: round(r.width), h: round(r.height) }; };
  const shown = (el) => {
    if (!el || el.nodeType !== 1 || SKIP.test(el.tagName)) return false;
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    const r = rect(el);
    return r.width > 1 && r.height > 1;
  };
  const textOf = (el) => String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
  const clip = (t, n) => (textOn ? String(t || '').slice(0, n) : undefined);
  const parseColor = (c) => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(c || '');
    if (!m) return null;
    const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a };
  };
  const hex = (c) => (c ? `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : null);
  const lum = (c) => {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ownBg = (el) => { const c = parseColor(cs(el).backgroundColor); return c && c.a > 0.05 ? c : null; };
  const effectiveBg = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = ownBg(e); if (c) return c; }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const bgImage = (el) => {
    const b = cs(el).backgroundImage || 'none';
    if (b === 'none') return null;
    return /url\(/.test(b) ? 'image' : 'gradient';
  };
  const firstFamily = (stack) => String(stack || '').split(',')[0].replace(/["']/g, '').trim();
  const genericOf = (stack) => {
    const parts = String(stack || '').toLowerCase().split(',').map((p) => p.replace(/["']/g, '').trim());
    const g = parts.find((p) => GENERICS.includes(p));
    if (!g) return 'unknown';
    return g === 'system-ui' ? 'sans-serif' : g.replace(/^ui-/, '');
  };
  const align = (a) => (a === 'start' || a === 'left' || a === '-webkit-left' ? 'left' : a === 'end' || a === 'right' ? 'right' : a === 'center' || a === '-webkit-center' ? 'center' : a);
  const style = (el) => {
    if (!el) return null;
    const s = cs(el);
    const size = num(s.fontSize) || 16;
    return {
      size: round(size, 1),
      weight: num(s.fontWeight) || 400,
      family: firstFamily(s.fontFamily),
      generic: genericOf(s.fontFamily),
      lineHeight: s.lineHeight === 'normal' ? null : round(num(s.lineHeight) / size, 2),
      letterSpacing: s.letterSpacing === 'normal' ? 0 : round(num(s.letterSpacing) / size, 3),
      transform: s.textTransform || 'none',
      italic: s.fontStyle === 'italic',
      align: align(s.textAlign),
      ...(textOn ? { sample: clip(textOf(el), 60) } : {}),
    };
  };
  const all = Array.from(body.querySelectorAll('*')).slice(0, 8000);
  const shownAll = all.filter(shown);
  const firstShown = (sel, root) => Array.from((root || body).querySelectorAll(sel)).find(shown) || null;
  const kids = (el) => Array.from(el.children).filter((c) => shown(c) && cs(c).position !== 'fixed');
  const mode = (values) => {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    let best = null; let n = 0;
    for (const [v, c] of counts) if (c > n) { best = v; n = c; }
    return best;
  };
  const tally = (values, max = 8) => {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value - b.value).slice(0, max);
  };
  const median = (values) => {
    const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    return v.length % 2 ? v[(v.length - 1) / 2] : round((v[v.length / 2 - 1] + v[v.length / 2]) / 2, 1);
  };

  // ── Buttons: links and buttons that look like buttons.
  const isButtonish = (el) => {
    const tag = el.tagName;
    const kind = tag === 'A' || tag === 'BUTTON' || el.getAttribute('role') === 'button'
      || (tag === 'INPUT' && /^(submit|button)$/i.test(el.type || ''));
    if (!kind) return false;
    const r = rect(el);
    if (r.height < 28 || r.height > 96 || r.width < 40 || r.width > 520) return false;
    const label = tag === 'INPUT' ? (el.value || '') : textOf(el);
    if (label.length < 2) return false;
    const s = cs(el);
    const filled = !!ownBg(el) || bgImage(el) === 'gradient';
    const border = parseColor(s.borderTopColor);
    const bordered = num(s.borderTopWidth) >= 1 && !!border && border.a > 0.1;
    return filled || bordered;
  };
  const buttonEls = shownAll.filter(isButtonish);
  const buttonRec = (el) => {
    const s = cs(el);
    const r = rect(el);
    const radius = num(s.borderTopLeftRadius);
    const filled = !!ownBg(el) || bgImage(el) === 'gradient';
    return {
      filled,
      radius: radius >= r.height / 2 - 1 ? 999 : round(radius),
      h: round(r.height),
      padX: round(num(s.paddingLeft)),
      size: round(num(s.fontSize), 1),
      weight: num(s.fontWeight) || 400,
      transform: s.textTransform || 'none',
      letterSpacing: s.letterSpacing === 'normal' ? 0 : round(num(s.letterSpacing) / (num(s.fontSize) || 16), 3),
      borderWidth: round(num(s.borderTopWidth), 1),
      shadow: s.boxShadow !== 'none',
      fill: filled ? hex(ownBg(el)) : null,
      ...(textOn ? { sample: clip(el.tagName === 'INPUT' ? el.value : textOf(el), 30) } : {}),
    };
  };
  const buttonGroups = new Map();
  for (const el of buttonEls) {
    const b = buttonRec(el);
    const key = [b.filled ? 'fill' : 'line', b.radius, Math.round(b.h / 4) * 4, b.weight, b.transform].join('|');
    const g = buttonGroups.get(key);
    if (g) g.count += 1; else buttonGroups.set(key, { ...b, count: 1 });
  }
  const buttons = Array.from(buttonGroups.values()).sort((a, b) => b.count - a.count).slice(0, 6);

  // ── Repeated siblings (cards, tiles, list items). A group that looks like
  // cards (border, shadow, own fill or rounded corners) beats a bigger one
  // that doesn't, so two plain layout columns never pass for the cards.
  const cardish = (el) => {
    const s = cs(el);
    const border = parseColor(s.borderTopColor);
    return (num(s.borderTopWidth) >= 1 && !!border && border.a > 0.1) || s.boxShadow !== 'none'
      || !!ownBg(el) || num(s.borderTopLeftRadius) > 0;
  };
  const repeatIn = (root) => {
    let best = null;
    const scope = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 1500)];
    for (const el of scope) {
      if (el.children.length < 2 || !shown(el)) continue;
      const groups = new Map();
      for (const c of el.children) {
        if (!shown(c)) continue;
        const r = rect(c);
        if (r.width < 100 || r.height < 60) continue;
        const key = `${c.tagName}.${Array.from(c.classList).filter((k) => !/\d/.test(k)).sort().join('.')}`;
        const list = groups.get(key) || [];
        list.push(c);
        groups.set(key, list);
      }
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const w0 = rect(list[0]).width;
        const same = list.filter((c) => Math.abs(rect(c).width - w0) <= w0 * 0.15);
        if (same.length < 2) continue;
        const area = same.reduce((a, c) => a + rect(c).width * rect(c).height, 0);
        const card = cardish(same[0]);
        if (!best || (card && !best.card) || (card === best.card && area > best.area)) best = { area, card, items: same };
      }
    }
    if (!best) return null;
    const first = best.items[0];
    const s = cs(first);
    const r = rect(first);
    const tops = best.items.map((c) => Math.round(rect(c).top / 8));
    const perRow = Math.max(...Array.from(tops.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map()).values()));
    const border = parseColor(s.borderTopColor);
    return {
      count: best.items.length,
      card: best.card,
      perRow,
      w: round(r.width),
      h: round(r.height),
      radius: round(num(s.borderTopLeftRadius)),
      padding: round(num(s.paddingTop)),
      shadow: s.boxShadow !== 'none',
      border: num(s.borderTopWidth) >= 1 && !!border && border.a > 0.1,
      filled: !!ownBg(first),
      image: !!first.querySelector('img, picture, video, [style*="background-image"]'),
    };
  };

  // ── Columns: the most side-by-side blocks in any row inside `root`.
  const columnsIn = (root) => {
    let best = 1;
    const scope = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 1500)];
    for (const el of scope) {
      if (el.children.length < 2) continue;
      const d = cs(el).display;
      if (!/flex|grid|table/.test(d) && el.children.length < 3) continue;
      const rows = new Map();
      for (const c of el.children) {
        if (!shown(c)) continue;
        const r = rect(c);
        if (r.width < 80 || r.height < 24) continue;
        const k = Math.round(r.top / 6);
        rows.set(k, (rows.get(k) || 0) + 1);
      }
      for (const n of rows.values()) if (n > best) best = n;
    }
    return Math.min(best, 12);
  };

  // ── Nav / header.
  const navCandidates = Array.from(body.querySelectorAll('header, nav, [role="banner"]')).filter(shown)
    .concat(shownAll.filter((el) => {
      const p = cs(el).position;
      if (p !== 'fixed' && p !== 'sticky') return false;
      const r = rect(el);
      return r.top + sy < 10 && r.height < 220 && r.width >= vw * 0.8;
    }))
    .filter((el) => { const r = rect(el); return r.top + sy < 160 && r.height < 260 && r.width >= vw * 0.5; });
  // Outermost candidate first (a <nav> inside a <header> belongs to the header).
  const navEl = navCandidates.find((el) => !navCandidates.some((other) => other !== el && other.contains(el))) || null;
  const positionOf = (el) => {
    for (let e = el; e && e !== body; e = e.parentElement) {
      const p = cs(e).position;
      if (p === 'fixed' || p === 'sticky') return p;
    }
    return cs(el).position === 'absolute' ? 'absolute' : 'static';
  };
  let nav = { found: false };
  if (navEl) {
    const b = box(navEl);
    const logoEl = firstShown('img, svg, picture', navEl);
    let logo = null;
    if (logoEl) {
      const lb = box(logoEl);
      const center = lb.x + lb.w / 2;
      logo = {
        kind: logoEl.tagName.toLowerCase() === 'svg' ? 'svg' : 'img',
        w: lb.w,
        h: lb.h,
        place: Math.abs(center - vw / 2) < vw * 0.1 ? 'center' : center < vw / 3 ? 'left' : 'right',
      };
    }
    const links = Array.from(navEl.querySelectorAll('a')).filter(shown);
    const navBg = ownBg(navEl);
    const position = positionOf(navEl);
    nav = {
      found: true,
      tag: navEl.tagName.toLowerCase(),
      y: b.y,
      h: b.h,
      position,
      transparent: !navBg,
      bg: hex(navBg || effectiveBg(navEl)),
      dark: lum(navBg || effectiveBg(navEl)) < 0.4,
      overlaysHero: (position === 'fixed' || position === 'absolute') && !navBg,
      links: links.length,
      phone: links.some((a) => /^tel:/i.test(a.getAttribute('href') || '')),
      cta: links.some(isButtonish) || Array.from(navEl.querySelectorAll('button')).some((el) => shown(el) && isButtonish(el)),
      menuButton: Array.from(navEl.querySelectorAll('button, [aria-expanded], summary')).some((el) => {
        if (!shown(el)) return false;
        const r = rect(el);
        return r.width <= 64 && r.height <= 64 && textOf(el).length <= 4;
      }),
      logo,
      linkStyle: style(links.find((a) => !isButtonish(a) && textOf(a).length >= 2) || null),
    };
  }

  // ── Sections: unwrap single wrappers, then split tall wrappers of sections.
  let root = body;
  for (let i = 0; i < 15; i += 1) {
    const k = kids(root).filter((c) => rect(c).height >= 40);
    if (k.length === 1 && rect(k[0]).height >= rect(root).height * 0.6) root = k[0];
    else break;
  }
  const isBlock = (c) => { const r = rect(c); return r.height >= 40 && r.width >= vw * 0.6; };
  const hasHeading = (el) => !!firstShown('h1, h2, h3', el);
  const splittable = (el) => {
    if (['SECTION', 'HEADER', 'FOOTER', 'NAV', 'FORM'].includes(el.tagName)) return false;
    const k = kids(el).filter(isBlock);
    if (k.length < 2) return false;
    if (el.tagName === 'MAIN' || el.tagName === 'ARTICLE') return true;
    if (rect(el).height < vh * 1.2) return false;
    return k.filter((c) => hasHeading(c) || ownBg(c) || bgImage(c)).length >= 2;
  };
  const expand = (list, depth) => list.flatMap((el) => (depth < 5 && splittable(el) ? expand(kids(el).filter(isBlock), depth + 1) : [el]));
  // Our own pages tag every orderable block with data-section (CLAUDE.md
  // template contract): those are the exact sections, plus the footer.
  const tagged = Array.from(body.querySelectorAll('[data-section]'))
    .filter((el) => shown(el) && !(el.parentElement && el.parentElement.closest('[data-section]')));
  let blocks;
  if (tagged.length >= 2) {
    const foot = Array.from(body.querySelectorAll('footer')).filter((f) => shown(f) && !tagged.some((t) => t.contains(f)))
      .sort((a, b) => rect(b).height - rect(a).height)[0];
    blocks = foot ? [...tagged, foot] : tagged;
  } else {
    blocks = expand(kids(root).filter(isBlock), 0)
      .filter((el) => !(navEl && (el === navEl || navEl.contains(el) || (el.contains(navEl) && rect(el).height < 260))));
  }
  blocks = blocks.sort((a, b) => rect(a).top - rect(b).top);

  const ID_HINT = {
    hero: 'hero', services: 'services', pricing: 'services', about: 'about', gallery: 'gallery', reviews: 'testimonials',
    contact: 'cta', cta: 'cta', map: 'cta', process: 'process', faq: null, logos: 'brands', stats: 'statsBar', footer: null, content: null,
  };
  const kindOf = (el, i, rec) => {
    const t = textOf(el).toLowerCase().slice(0, 4000);
    const imgs = rec.counts.images;
    if (el.tagName === 'FOOTER' || (i === blocks.length - 1 && rec.counts.links >= 6 && !hasHeading(el))) return 'footer';
    if (i === 0 && rec.h >= vh * 0.35 && (firstShown('h1', el) || rec.y < vh)) return 'hero';
    if (el.querySelector('form') || rec.counts.inputs >= 2) return 'contact';
    if (el.querySelector('iframe[src*="map"]')) return 'map';
    if (el.querySelector('details, summary') || /\bfaq\b|frequently asked/.test(t)) return 'faq';
    if (/review|testimonial|what (our )?(customers|clients) (are )?say|\u2605/.test(t)) return 'reviews';
    if (imgs >= 4 && rec.h < 260) return 'logos';
    if (/\$\s?\d/.test(t) && rec.repeat && rec.repeat.count >= 2) return 'pricing';
    if (imgs >= 4 && t.length < 600) return 'gallery';
    if (/how it works|our process|step 1|step one/.test(t)) return 'process';
    if (rec.h < vh * 0.45 && /\d+\s*(\+|%|k\b|years|yrs)/.test(t) && (rec.repeat?.count || 0) >= 3) return 'stats';
    if (/about us|our story|who we are|meet the|about /.test(t)) return 'about';
    if (/service|package|what we do|detail/.test(t)) return 'services';
    if (/call|book|contact|quote|schedule|get started/.test(t) && rec.h < vh * 0.8) return 'cta';
    return 'content';
  };

  const sections = blocks.slice(0, 40).map((el, i) => {
    const b = box(el);
    const s = cs(el);
    const bg = ownBg(el) || effectiveBg(el);
    const media = Array.from(el.querySelectorAll('img, video, picture')).filter(shown).find((m) => {
      const r = rect(m);
      return r.width >= b.w * 0.8 && r.height >= b.h * 0.6;
    });
    const inner = Array.from(el.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *')).filter(shown)
      .map((c) => rect(c).width).filter((w) => w < b.w - 2 && w >= b.w * 0.4);
    const headings = Array.from(el.querySelectorAll('h1, h2, h3')).filter(shown).slice(0, 4)
      .map((h) => ({ tag: h.tagName.toLowerCase(), ...style(h) }));
    const firstChild = kids(el)[0];
    const padTop = num(s.paddingTop) || (firstChild ? Math.max(0, round(rect(firstChild).top - rect(el).top)) : 0);
    const lastChild = kids(el).slice(-1)[0];
    const padBottom = num(s.paddingBottom) || (lastChild ? Math.max(0, round(rect(el).bottom - rect(lastChild).bottom)) : 0);
    const rec = {
      i,
      tag: el.tagName.toLowerCase(),
      id: el.id && el.id.length <= 40 ? el.id : undefined,
      y: b.y,
      h: b.h,
      hPct: round((b.h / Math.max(pageH, 1)) * 100, 1),
      screens: round(b.h / vh, 2),
      bg: hex(bg),
      dark: lum(bg) < 0.4,
      bgImage: bgImage(el),
      mediaBackdrop: !!media,
      align: headings[0] ? headings[0].align : align(s.textAlign),
      padTop: round(padTop),
      padBottom: round(padBottom),
      contentWidth: inner.length ? round(Math.max(...inner)) : b.w,
      columns: columnsIn(el),
      headings,
      counts: {
        images: Array.from(el.querySelectorAll('img, picture, video')).filter((m) => shown(m) && rect(m).width >= 40).length,
        buttons: Array.from(el.querySelectorAll('a, button, input')).filter((x) => shown(x) && isButtonish(x)).length,
        links: Array.from(el.querySelectorAll('a')).filter(shown).length,
        inputs: Array.from(el.querySelectorAll('input:not([type=hidden]), textarea, select')).filter(shown).length,
        iframes: el.querySelectorAll('iframe').length,
        words: textOf(el).split(' ').filter(Boolean).length,
      },
      repeat: repeatIn(el),
    };
    const sectionId = el.getAttribute('data-section');
    if (sectionId) rec.section = sectionId;
    rec.kind = kindOf(el, i, rec);
    rec.idHint = sectionId || (ID_HINT[rec.kind] ?? null);
    return rec;
  });

  // ── Type scale.
  const largestText = () => {
    let best = null;
    for (const el of shownAll) {
      if (!el.firstChild || !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = rect(el);
      if (r.top + sy > vh * 1.2) continue;
      const size = num(cs(el).fontSize);
      if (!best || size > best.size) best = { el, size };
    }
    return best ? best.el : null;
  };
  const paragraphs = Array.from(body.querySelectorAll('p')).filter((p) => shown(p) && textOf(p).length >= 40);
  const bodySize = mode(paragraphs.map((p) => round(num(cs(p).fontSize), 1)));
  const bodyEl = paragraphs.find((p) => round(num(cs(p).fontSize), 1) === bodySize) || firstShown('p');
  const eyebrowEl = shownAll.find((el) => {
    const s = cs(el);
    if (s.textTransform !== 'uppercase' || num(s.letterSpacing) <= num(s.fontSize) * 0.04 || num(s.fontSize) > 16) return false;
    if (isButtonish(el) || el.closest('nav, header, footer, a, button')) return false;
    const t = textOf(el);
    return t.length >= 2 && t.length <= 40 && el.children.length === 0;
  });
  const h1El = firstShown('h1') || largestText();
  const type = {
    h1: style(h1El),
    h2: style(firstShown('h2')),
    h3: style(firstShown('h3')),
    body: style(bodyEl),
    eyebrow: style(eyebrowEl || null),
    button: buttons[0] ? { size: buttons[0].size, weight: buttons[0].weight, transform: buttons[0].transform, letterSpacing: buttons[0].letterSpacing } : null,
  };

  // ── Fonts.
  const headingStack = h1El ? cs(h1El).fontFamily : '';
  const bodyStack = bodyEl ? cs(bodyEl).fontFamily : cs(body).fontFamily;
  let loaded = [];
  try {
    loaded = Array.from(new Set(Array.from(document.fonts || []).filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''))));
  } catch { /* FontFaceSet not iterable */ }
  const fonts = {
    heading: firstFamily(headingStack),
    headingGeneric: genericOf(headingStack),
    body: firstFamily(bodyStack),
    bodyGeneric: genericOf(bodyStack),
    loaded: loaded.slice(0, 12),
  };

  // ── Spacing, radii, cards.
  const pads = sections.filter((x) => x.kind !== 'footer' && x.kind !== 'hero').flatMap((x) => [x.padTop, x.padBottom]).filter((v) => v > 0);
  const gaps = [];
  for (const el of shownAll.slice(0, 4000)) {
    const s = cs(el);
    if (!/flex|grid/.test(s.display)) continue;
    const g = num(s.columnGap) || num(s.rowGap);
    if (g > 0) gaps.push(round(g));
  }
  const radii = [];
  for (const el of shownAll.slice(0, 4000)) {
    const rr = num(cs(el).borderTopLeftRadius);
    if (rr <= 0) continue;
    const r = rect(el);
    if (r.width < 40 || r.height < 24) continue;
    radii.push(rr >= Math.min(r.width, r.height) / 2 - 1 ? 999 : round(rr));
  }
  // The page's card style: the biggest card-like group, else the biggest group.
  let cards = null;
  const groupArea = (r) => r.count * r.w * r.h;
  for (const x of sections) {
    const r = x.repeat;
    if (!r || x.kind === 'footer') continue;
    if (!cards || (r.card && !cards.card) || (r.card === cards.card && groupArea(r) > groupArea(cards))) cards = r;
  }
  const footerSec = sections.slice().reverse().find((x) => x.kind === 'footer') || null;

  const pageBg = effectiveBg(body);
  const fill = buttons.find((b) => b.filled);
  return {
    format: o.format || 'acg-replica-outline/1',
    _note: 'Layout study only: text samples identify sections, colors show where dark, light and accent bands sit. '
      + 'Never copy the reference\'s words, photos, logos, brand marks or color values into a template.',
    viewport: { width: vw, height: vh },
    page: {
      height: pageH,
      screens: round(pageH / vh, 2),
      lang: doc.lang || '',
      ...(textOn ? { title: clip(document.title, 80) } : {}),
    },
    nav,
    sections,
    footer: footerSec ? { h: footerSec.h, columns: footerSec.columns, dark: footerSec.dark, links: footerSec.counts.links } : null,
    type,
    fonts,
    buttons,
    cards,
    spacing: {
      sectionPadMedian: median(pads),
      sectionPads: tally(pads.map((v) => Math.round(v / 4) * 4), 6),
      gaps: tally(gaps, 8),
      contentWidths: tally(sections.map((x) => Math.round(x.contentWidth / 10) * 10), 4),
    },
    radii: tally(radii, 8),
    density: {
      sections: sections.length,
      avgSectionScreens: sections.length ? round(sections.reduce((a, x) => a + x.screens, 0) / sections.length, 2) : 0,
      wordsPerScreen: round(sections.reduce((a, x) => a + x.counts.words, 0) / Math.max(pageH / vh, 1)),
    },
    colorRoles: {
      page: hex(pageBg),
      pageDark: lum(pageBg) < 0.4,
      sequence: sections.map((x) => (x.mediaBackdrop || x.bgImage === 'image' ? 'photo' : x.dark ? 'dark' : 'light')),
      buttonFill: fill ? fill.fill : null,
    },
  };
}

// ─── Capture ─────────────────────────────────────────────────────────

// Viewport specs from "desktop,phone" or "name:1280x800".
export function parseViewports(spec) {
  const list = String(spec || 'desktop,phone').split(',').map((s) => s.trim()).filter(Boolean);
  return list.map((item) => {
    if (Object.prototype.hasOwnProperty.call(VIEWPORTS, item)) return { ...VIEWPORTS[item] };
    const m = /^([a-z][a-z0-9-]{0,20}):(\d{3,4})x(\d{3,4})$/i.exec(item);
    if (!m) throw new Error(`Unknown viewport "${item}": use ${Object.keys(VIEWPORTS).join(', ')} or name:WIDTHxHEIGHT`);
    const width = Number(m[2]);
    return { name: m[1].toLowerCase(), width, height: Number(m[3]), mobile: width < 600 };
  });
}

// The nearest folder at or above `dir` with a .git entry (a repo or a
// worktree), or null.
export function gitRootOf(dir) {
  for (let cur = path.resolve(dir); ;) {
    if (existsSync(path.join(cur, '.git'))) return cur;
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

// Refuses an output folder inside the repo: a capture holds someone else's
// words and photos, and the repo is where things get committed. Any git
// work tree counts, not only the one these scripts sit in: they run from
// the test mirror (no .git), and the real repo is somewhere else.
export function assertOutsideRepo(dir, repoRoot = REPO_ROOT) {
  const real = (p) => {
    let cur = path.resolve(p);
    const rest = [];
    while (!existsSync(cur)) {
      rest.unshift(path.basename(cur));
      const up = path.dirname(cur);
      if (up === cur) break;
      cur = up;
    }
    return path.join(realpathSync(cur), ...rest);
  };
  const out = real(dir);
  const repo = real(repoRoot);
  const rel = path.relative(repo, out);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`--out ${dir} is inside the repo (${repo}). Captures hold the reference's words and photos: write them to a scratch folder outside the repo.`);
  }
  const git = gitRootOf(out);
  if (git) {
    throw new Error(`--out ${dir} is inside the repo at ${git}. Captures hold the reference's words and photos: write them to a scratch folder outside any repo.`);
  }
  return out;
}

// What a source argument is: { kind: 'url', url } | { kind: 'file', url, file } | { kind: 'image', file }.
export function resolveSource(source) {
  const s = String(source || '').trim();
  if (!s) throw new Error('Give a URL or a local .html file to capture');
  if (/^https?:\/\//i.test(s)) {
    const u = new URL(s);
    return { kind: 'url', url: u.href };
  }
  if (/^file:\/\//i.test(s)) {
    const file = fileURLToPath(s);
    if (!existsSync(file)) throw new Error(`No such file: ${file}`);
    return { kind: 'file', file, url: s };
  }
  const file = path.resolve(s);
  if (!existsSync(file)) throw new Error(`No such file: ${file}`);
  if (IMAGE_EXT_RE.test(file)) return { kind: 'image', file };
  if (!HTML_EXT_RE.test(file)) throw new Error(`Capture a URL, an .html file or a .png/.jpg/.webp screenshot, not ${path.basename(file)}`);
  return { kind: 'file', file, url: pathToFileURL(file).href };
}

const tileName = (i, ext = 'png') => `tile-${String(i).padStart(3, '0')}.${ext}`;

async function captureViewport(browser, source, vp, opts, outDir, log) {
  const tab = await openTab(browser.cdp);
  const requests = { failed: [], substituted: [] };
  let stop = () => {};
  try {
    await tab.send('Page.enable');
    await tab.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: opts.dpr, mobile: vp.mobile, screenWidth: vp.width, screenHeight: vp.height,
    });
    if (vp.mobile) await tab.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const v = browser.version || '130.0.0.0';
    await tab.send('Emulation.setUserAgentOverride', {
      userAgent: vp.mobile
        ? `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Mobile Safari/537.36`
        : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`,
    });
    // Reduced motion: most sites then skip entrance animations, so a tile
    // never catches a block halfway through fading in.
    await tab.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }],
    });
    stop = interceptRequests(tab, opts, requests);
    await tab.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*', requestStage: 'Request' }, { urlPattern: 'https://*', requestStage: 'Request' }] });

    const started = Date.now();
    const loaded = tab.waitFor('Page.loadEventFired', opts.timeoutMs);
    loaded.catch(() => {});
    const nav = await tab.send('Page.navigate', { url: source.url }, opts.timeoutMs);
    if (nav.errorText) throw new Error(`Could not open ${source.url}: ${nav.errorText}`);
    let loadComplete = true;
    try {
      await loaded;
    } catch {
      // Past the deadline: stop whatever is still loading and capture what
      // has rendered.
      loadComplete = false;
      await tab.send('Page.stopLoading').catch(() => {});
    }
    const styles = await evaluate(tab, injectCaptureStyles, { hide: opts.hide || [] });
    if (styles?.bad?.length) log(`  ignored invalid --hide selector(s): ${styles.bad.join(', ')}`);
    const { height: pageHeight, full, inner } = await evaluate(tab, preScroll, {
      maxHeight: opts.maxHeight, waitMs: opts.settleMs, fontWaitMs: opts.fontTimeoutMs,
    }, 120000);
    const outline = await evaluate(tab, outlinePage, { text: opts.text !== false, format: OUTLINE_FORMAT }, 60000);

    const dir = path.join(outDir, vp.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'outline.json'), `${JSON.stringify(outline, null, 2)}\n`);

    const tiles = [];
    const maxTiles = Math.ceil(opts.maxHeight / vp.height) + 1;
    for (let i = 0; i < maxTiles; i += 1) {
      const target = i * vp.height;
      if (i > 0 && target >= pageHeight) break;
      const t = await evaluate(tab, prepareTile, {
        y: target, first: i === 0, maxHeight: opts.maxHeight, waitMs: opts.settleMs, imageWaitMs: 2500,
      });
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 60000);
      const file = tileName(i);
      writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'));
      tiles.push({ file: `${vp.name}/${file}`, y: t.y });
      await evaluate(tab, clearTileMarks);
      if (t.last || t.y < target) break;
    }
    const warnings = [];
    if (full <= vp.height + 2 && inner > vp.height * 1.5) {
      warnings.push(`The page scrolls an inner box (${inner}px), not the window, so only the first screen was captured: use screenshots (--image) for this site.`);
      log(`  ${vp.name}: ${warnings[warnings.length - 1]}`);
    }
    log(`  ${vp.name}: ${tiles.length} tile(s), page ${full}px${full > pageHeight ? ` (cut at ${pageHeight}px)` : ''}, ${outline.sections.length} sections, ${Date.now() - started} ms`);
    return {
      name: vp.name,
      width: vp.width,
      height: vp.height,
      dpr: opts.dpr,
      mobile: vp.mobile,
      pageHeight,
      fullHeight: full,
      truncated: full > pageHeight,
      loadComplete,
      tiles,
      outline: `${vp.name}/outline.json`,
      requests,
      warnings,
    };
  } finally {
    stop();
    await tab.close();
  }
}

// Captures `source` (URL or local .html) at each viewport into `out`.
// Returns the manifest (also written to <out>/manifest.json).
export async function capture(source, {
  out,
  viewports = parseViewports('desktop,phone'),
  offline = false,
  timeoutMs = DEFAULTS.timeoutMs,
  fontTimeoutMs = DEFAULTS.fontTimeoutMs,
  assetTimeoutMs = DEFAULTS.assetTimeoutMs,
  maxHeight = DEFAULTS.maxHeight,
  dpr = DEFAULTS.dpr,
  settleMs = DEFAULTS.settleMs,
  hide = [],
  text = true,
  chromePath,
  log = () => {},
} = {}) {
  if (!out) throw new Error('--out <dir> is required');
  const outDir = assertOutsideRepo(out);
  const src = typeof source === 'string' ? resolveSource(source) : source;
  if (src.kind === 'image') return captureImages([{ viewport: 'desktop', file: src.file }], { out });
  mkdirSync(outDir, { recursive: true });
  const opts = { offline, timeoutMs, fontTimeoutMs, assetTimeoutMs, maxHeight, dpr, settleMs, hide, text };
  const browser = await launchChrome({ chromePath });
  const results = [];
  try {
    log(`Capturing ${src.url} (Chrome ${browser.version || '?'}${offline ? ', offline' : ''})`);
    for (const vp of viewports) results.push(await captureViewport(browser, src, vp, opts, outDir, log));
  } finally {
    await browser.close();
  }
  const manifest = {
    format: CAPTURE_FORMAT,
    note: CAPTURE_NOTE,
    capturedAt: new Date().toISOString(),
    source: src.kind === 'url' ? { kind: 'url', url: src.url } : { kind: 'file', file: src.file },
    options: { offline, timeoutMs, fontTimeoutMs, assetTimeoutMs, maxHeight, dpr, hide, text },
    viewports: results,
  };
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// A screenshot the customer or admin supplied stands in for a capture: no
// outline (there is no page to read), tiles stacked in the order given.
// `images` is [{ viewport: 'desktop' | 'phone' | name, file }].
export function captureImages(images, { out }) {
  if (!out) throw new Error('--out <dir> is required');
  if (!images?.length) throw new Error('Give at least one --image name=file');
  const outDir = assertOutsideRepo(out);
  mkdirSync(outDir, { recursive: true });
  const byName = new Map();
  for (const { viewport, file } of images) {
    const abs = path.resolve(file);
    if (!existsSync(abs)) throw new Error(`No such file: ${abs}`);
    if (!IMAGE_EXT_RE.test(abs)) throw new Error(`Screenshots must be .png, .jpg or .webp: ${path.basename(abs)}`);
    const name = String(viewport || 'desktop').toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,20}$/.test(name)) throw new Error(`Bad viewport name "${viewport}"`);
    const list = byName.get(name) || [];
    list.push(abs);
    byName.set(name, list);
  }
  const viewports = [];
  for (const [name, files] of byName) {
    const dir = path.join(outDir, name);
    mkdirSync(dir, { recursive: true });
    const tiles = files.map((abs, i) => {
      const ext = path.extname(abs).slice(1).toLowerCase().replace('jpeg', 'jpg');
      const file = tileName(i, ext);
      copyFileSync(abs, path.join(dir, file));
      return { file: `${name}/${file}`, y: null };
    });
    const vp = VIEWPORTS[name];
    viewports.push({
      name,
      width: vp ? vp.width : null,
      height: vp ? vp.height : null,
      dpr: null,
      mobile: vp ? vp.mobile : null,
      pageHeight: null,
      fullHeight: null,
      truncated: false,
      loadComplete: true,
      tiles,
      outline: null,
      fromImage: true,
      requests: { failed: [], substituted: [] },
    });
  }
  const manifest = {
    format: CAPTURE_FORMAT,
    note: CAPTURE_NOTE,
    capturedAt: new Date().toISOString(),
    source: { kind: 'image', files: images.map((i) => path.basename(i.file)) },
    options: {},
    viewports,
  };
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// ─── CLI ─────────────────────────────────────────────────────────────

const positiveInt = (v, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive whole number`);
  return n;
};

export function parseCaptureArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      viewports: { type: 'string' },
      offline: { type: 'boolean' },
      timeout: { type: 'string' },
      'font-timeout': { type: 'string' },
      'asset-timeout': { type: 'string' },
      'max-height': { type: 'string' },
      dpr: { type: 'string' },
      hide: { type: 'string', multiple: true },
      'no-text': { type: 'boolean' },
      image: { type: 'string', multiple: true },
      chrome: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return { help: true };
  const images = (values.image || []).map((spec) => {
    const m = /^([a-z][a-z0-9-]{0,20})=(.+)$/i.exec(spec);
    return m ? { viewport: m[1].toLowerCase(), file: m[2] } : { viewport: 'desktop', file: spec };
  });
  if (!images.length && positionals.length !== 1) throw new Error('Give exactly one URL or .html file (or --image name=file)');
  const dpr = values.dpr === undefined ? DEFAULTS.dpr : Number(values.dpr);
  if (!(dpr >= 1 && dpr <= 3)) throw new Error('--dpr must be between 1 and 3');
  return {
    source: positionals[0] || null,
    images,
    out: values.out,
    viewports: parseViewports(values.viewports),
    offline: !!values.offline,
    timeoutMs: values.timeout ? positiveInt(values.timeout, 'timeout') : DEFAULTS.timeoutMs,
    fontTimeoutMs: values['font-timeout'] ? positiveInt(values['font-timeout'], 'font-timeout') : DEFAULTS.fontTimeoutMs,
    assetTimeoutMs: values['asset-timeout'] ? positiveInt(values['asset-timeout'], 'asset-timeout') : DEFAULTS.assetTimeoutMs,
    maxHeight: values['max-height'] ? positiveInt(values['max-height'], 'max-height') : DEFAULTS.maxHeight,
    dpr,
    hide: values.hide || [],
    text: !values['no-text'],
    chromePath: values.chrome,
  };
}

const USAGE = `Usage:
  node scripts/replica/capture.mjs <https://url | page.html> --out <dir outside the repo> [--viewports desktop,phone]
      [--offline] [--timeout ms] [--font-timeout ms] [--asset-timeout ms] [--max-height px] [--dpr n]
      [--hide "<css selector>"] [--no-text] [--chrome <path>]
  node scripts/replica/capture.mjs --image desktop=<shot.png> [--image phone=<shot.png>] --out <dir>
Layout study only: never copy the reference's words, photos, logo or brand marks into a template.`;

async function main() {
  let args;
  try {
    args = parseCaptureArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }
  try {
    const manifest = args.images.length
      ? captureImages(args.images, { out: args.out })
      : await capture(args.source, { ...args, log: (m) => console.log(m) });
    for (const vp of manifest.viewports) {
      const failed = vp.requests?.failed || [];
      if (failed.length) console.log(`  ${vp.name}: ${failed.length} request(s) failed (fonts may show as fallbacks): ${failed.slice(0, 3).map((f) => f.url).join(', ')}${failed.length > 3 ? ', ...' : ''}`);
      if (vp.loadComplete === false) console.log(`  ${vp.name}: the page was still loading at the deadline; captured what had rendered`);
    }
    console.log(`Wrote ${path.join(path.resolve(args.out), 'manifest.json')}`);
    console.log(CAPTURE_NOTE);
  } catch (e) {
    console.error(`capture failed: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
