// Screenshots of a reference site, taken by our own headless browser
// (custom-site-capture-background), and the guard that keeps that browser
// on the public internet.
//
// The admin pastes the address of a site the customer likes; "Match its
// layout" then reads its screenshots like the ones the admin uploads
// (designSuggest.js referenceShots). The address is typed by a person and
// the page it opens is someone else's code, so every address the browser
// may reach goes through one guard (createCaptureGuard):
//   - http and https only, default ports or 80/443/8080/8443, no user name
//     or password in the address
//   - the host's every address (dns.lookup, all) must be public: one
//     private, loopback, link-local, multicast, reserved or unspecified
//     address refuses the host (IPv4, IPv6 and IPv6 forms that carry an
//     IPv4 address: mapped, translated, NAT64, 6to4); "localhost" and
//     *.local / *.internal names are refused before any lookup
// The guard runs three times over: on the address before a run is claimed
// (custom-site-admin reference-capture), on every request the page makes
// (request interception: navigation, redirects, subresources; other
// schemes than http(s)/data/blob are aborted), and in a small proxy every
// connection of the browser goes through (startCaptureProxy). The proxy is
// what makes the guard hold: it connects to the very address the guard
// checked, so a host that answers DNS with a public address for the check
// and a private one a moment later (DNS rebinding) gets nowhere, and so do
// the requests interception never sees (workers, WebSockets). The browser
// can't resolve a name itself (--host-resolver-rules) nor send UDP outside
// the proxy (WebRTC, captureChromeArgs), and downloads are denied.
//
// Loopback is allowed only through the explicit test-only option
// (testOnly.allowLoopback), which no function passes: the local capture
// test serves its page from 127.0.0.1.
//
// Besides the screenshots, the page's outline (PAGE_SCRIPTS.outline, shape
// in src/lib/referenceOutline.js): fonts, sections, spacing and features
// measured from the rendered page, never its colors, images or words.
import http from 'node:http';
import net from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { MATCH_SHOT_LIMIT } from '../../../src/lib/designSuggest.js';
import { sanitizeOutline } from '../../../src/lib/referenceOutline.js';

// ─── What a capture is ───────────────────────────────────────────────

// A desktop page as a person sees it: 1440 wide (what the Design step's
// uploader scales screenshots to), at device pixel ratio 1 so a part is
// exactly as many pixels as CSS pixels.
export const CAPTURE_VIEWPORT = Object.freeze({ width: 1440, height: 900, deviceScaleFactor: 1 });
// Parts of at most 1440 x 2400 (what a match sends Claude at full size),
// top first, at most MATCH_SHOT_LIMIT of them: the page below 9600 px is
// left out, as the uploader leaves it out.
export const CAPTURE_TILE_HEIGHT = 2400;
export const CAPTURE_MAX_PARTS = MATCH_SHOT_LIMIT;
export const CAPTURE_MAX_HEIGHT = CAPTURE_TILE_HEIGHT * CAPTURE_MAX_PARTS;
export const CAPTURE_JPEG_QUALITY = 80;
export const CAPTURE_NAV_TIMEOUT_MS = 25_000;
// After `load`, up to this long for the network to go quiet (late images,
// web fonts); a site that never stops polling is captured as it is then.
export const CAPTURE_IDLE_MAX_MS = 8_000;
// After scrolling to the bottom: lazy images that started loading land.
export const CAPTURE_SETTLE_MS = 1_000;
// The outline script stops itself after ~4 s of work; a page whose own
// scripts keep the browser busy past this is shot without an outline.
export const CAPTURE_OUTLINE_TIMEOUT_MS = 10_000;
// The whole capture (start the browser, load, scroll, shoot): a page that
// keeps the browser busy past this is given up, so the run always ends and
// records why. Starting the browser may download it first (~65 MB).
export const CAPTURE_BUDGET_MS = 3 * 60 * 1000;
export const CAPTURE_URL_MAX = 500;
export const CAPTURE_PORTS = Object.freeze([80, 443, 8080, 8443]);
// A normal desktop Chrome (the engine is Chromium 143): headless Chrome's
// own "HeadlessChrome" agent is refused by many sites' bot protection.
export const CAPTURE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
const SCROLL_STEP = CAPTURE_VIEWPORT.height;
const SCROLL_PAUSE_MS = 120;
const LOOKUP_TIMEOUT_MS = 5_000;
// The proxy marks the answers it makes up itself, so a page that failed in
// the proxy isn't taken for the site's own error page.
export const CAPTURE_PROXY_HEADER = 'x-acg-capture-proxy';

// What the admin reads when an address is refused or a capture fails
// (design.capture.error, the 400 of reference-capture): short, and saying
// what to do where there is something to do.
export const CAPTURE_MESSAGES = Object.freeze({
  invalid: 'Enter a web address like https://example.com',
  too_long: `That address is too long (${CAPTURE_URL_MAX} characters at most)`,
  scheme: 'Only http and https addresses can be captured',
  credentials: 'Take the user name and password out of the address',
  port: 'That address uses a port we don\'t capture (only 80, 443, 8080 and 8443)',
  private: 'That address points to a private network, so it can\'t be captured',
  redirect_private: 'That site sent our browser to a private address, so it can\'t be captured',
  not_found: 'We couldn\'t find that site. Check the address.',
  dns: 'We couldn\'t look that site up just now. Try again in a minute.',
  timeout: 'That site didn\'t load in 25 seconds',
  too_slow: 'That site took too long to capture',
  blocked: 'That site blocked our browser',
  unreachable: 'That site couldn\'t be reached',
  certificate: 'That site\'s security certificate isn\'t valid',
  redirects: 'That site kept redirecting',
  not_page: 'That address isn\'t a web page (it may be a file download)',
  page_not_found: 'That page wasn\'t found (404). Check the address.',
  browser: 'Our browser couldn\'t start. Try again in a minute.',
  failed: 'The capture failed. Try again, or upload a screenshot instead.',
});

export class CaptureError extends Error {
  constructor(code, message = CAPTURE_MESSAGES[code] || CAPTURE_MESSAGES.failed) {
    super(message);
    this.name = 'CaptureError';
    this.code = code;
  }
}

// ─── Addresses ───────────────────────────────────────────────────────

// An IPv4 address as the four bytes, in every form a resolver accepts
// (inet_aton): 1 to 4 parts, each decimal, 0x hex or 0-led octal, the
// last filling the bytes left ("2130706433", "0x7f.1", "017700000001" are
// all 127.0.0.1). null when it isn't one. The WHATWG URL parser already
// turns these into dotted form, this catches anything that didn't go
// through it.
export function parseIPv4(input) {
  let s = String(input ?? '').trim().toLowerCase();
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (!s) return null;
  const parts = s.split('.');
  if (parts.length > 4) return null;
  const nums = [];
  for (const p of parts) {
    if (p.length > 34) return null;
    let n;
    if (/^0x[0-9a-f]*$/.test(p)) n = p.length === 2 ? 0 : parseInt(p.slice(2), 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^(0|[1-9][0-9]*)$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isSafeInteger(n)) return null;
    nums.push(n);
  }
  const last = nums.pop();
  if (nums.some((n) => n > 255) || last >= 256 ** (4 - nums.length)) return null;
  let value = last;
  nums.forEach((n, i) => { value += n * 256 ** (3 - i); });
  return [Math.floor(value / 16777216) % 256, Math.floor(value / 65536) % 256, Math.floor(value / 256) % 256, value % 256];
}

const DOTTED_QUAD = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// An IPv6 address as its 16 bytes (brackets allowed, an IPv4 tail too:
// "::ffff:127.0.0.1"), or null. A zone id ("fe80::1%en0") is refused: it
// only goes with link-local addresses.
export function parseIPv6(input) {
  let s = String(input ?? '').trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (!s || !s.includes(':') || s.includes('%')) return null;
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const m = DOTTED_QUAD.exec(tail);
    const v4 = m ? m.slice(1).map(Number) : null;
    if (!v4 || v4.some((n) => n > 255)) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const groupsOf = (part) => (part === '' ? [] : part.split(':'));
  const head = groupsOf(halves[0]);
  const rest = halves.length === 2 ? groupsOf(halves[1]) : [];
  let groups;
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    if (head.length + rest.length > 7) return null;
    groups = [...head, ...Array(8 - head.length - rest.length).fill('0'), ...rest];
  }
  const bytes = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    bytes.push(n >> 8, n & 255);
  }
  return bytes;
}

// Why an IPv4 address is off limits, or '' for a public one.
function ipv4Reason([a, b, c]) {
  if (a === 0) return 'unspecified';
  if (a === 10) return 'private';
  if (a === 100 && b >= 64 && b <= 127) return 'private'; // carrier-grade NAT, 100.64/10
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'link-local'; // 169.254.169.254 is the cloud metadata address
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return 'reserved';
  if (a === 192 && b === 88 && c === 99) return 'reserved';
  if (a === 192 && b === 168) return 'private';
  if (a === 198 && (b === 18 || b === 19)) return 'reserved';
  if (a === 198 && b === 51 && c === 100) return 'reserved';
  if (a === 203 && b === 0 && c === 113) return 'reserved';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a >= 240) return 'reserved'; // includes 255.255.255.255
  return '';
}

// Why an IPv6 address is off limits, or ''. Forms that carry an IPv4
// address are judged by that address; anything outside global unicast
// (2000::/3) is refused.
function ipv6Reason(b) {
  const zeroTo = (n) => b.slice(0, n).every((x) => x === 0);
  const v4 = (i) => b.slice(i, i + 4);
  if (zeroTo(16)) return 'unspecified';
  if (zeroTo(15) && b[15] === 1) return 'loopback';
  if (zeroTo(10) && b[10] === 0xff && b[11] === 0xff) return ipv4Reason(v4(12)); // ::ffff:a.b.c.d (mapped)
  if (zeroTo(8) && b[8] === 0xff && b[9] === 0xff && b[10] === 0 && b[11] === 0) return ipv4Reason(v4(12)); // ::ffff:0:a.b.c.d
  if (zeroTo(12)) return 'reserved'; // ::a.b.c.d (IPv4-compatible, retired)
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    if (b.slice(4, 12).every((x) => x === 0)) return ipv4Reason(v4(12)) || ''; // 64:ff9b::/96 NAT64
    if (b[4] === 0 && b[5] === 1) return 'private'; // 64:ff9b:1::/48, local NAT64
  }
  if ((b[0] & 0xfe) === 0xfc) return 'private'; // fc00::/7, unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return 'link-local'; // fe80::/10
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return 'private'; // fec0::/10, site-local (retired)
  if (b[0] === 0xff) return 'multicast';
  if ((b[0] & 0xe0) !== 0x20) return 'reserved';
  if (b[0] === 0x20 && b[1] === 0x02) return ipv4Reason(v4(2)); // 2002::/16, 6to4
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0 && b[3] === 0) return 'reserved'; // 2001::/32, Teredo
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return 'reserved'; // documentation
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0 && b[3] === 2 && b[4] === 0 && b[5] === 0) return 'reserved'; // benchmarking
  return '';
}

// Why `address` (as a resolver returns it, or a URL hostname) is off
// limits: 'loopback', 'private', 'link-local', 'multicast', 'reserved',
// 'unspecified', 'invalid' (not an address at all), or '' when public.
export function addressReason(address) {
  const s = String(address ?? '').trim();
  if (net.isIPv4(s)) return ipv4Reason(s.split('.').map(Number));
  const v6 = parseIPv6(s);
  if (v6) return ipv6Reason(v6);
  const v4 = parseIPv4(s);
  if (v4) return ipv4Reason(v4);
  return 'invalid';
}

// Names that only mean something inside a network.
const LOCAL_NAME = /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/;

// The host as the guard judges it: brackets and trailing dots off, lower
// case. An IP literal comes back as { literal: '<address>' }.
function hostOf(url) {
  let host = url.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) return { host, literal: host.slice(1, -1) };
  host = host.replace(/\.+$/, '');
  if (net.isIPv4(host)) return { host, literal: host };
  // Ends in a number: an IPv4 address written some other way. Read it as
  // one (never sent to DNS, whose resolver would read it the same way).
  const last = host.split('.').pop() || '';
  if (/^(0x[0-9a-f]*|\d+)$/i.test(last)) {
    const v4 = parseIPv4(host);
    return v4 ? { host, literal: v4.join('.') } : { host, invalid: true };
  }
  return { host };
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(onTimeout()), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── The guard ───────────────────────────────────────────────────────

// One capture's guard. check(url) resolves to
//   { ok: true, url, host, port, addresses, address }   address: the one
//                                                        to connect to
//   { ok: false, code, error }                          code: a
//                                                        CAPTURE_MESSAGES key
// and never throws. Each host is looked up once per guard (the proxy
// connects to what the check saw). `lookup` is dns/promises lookup (tests
// pass a fake); `testOnly.allowLoopback` lets loopback addresses through
// on any port: for the local capture test only, never set by a function.
export function createCaptureGuard({ lookup = dnsLookup, testOnly = null, lookupTimeoutMs = LOOKUP_TIMEOUT_MS } = {}) {
  const allowLoopback = testOnly?.allowLoopback === true;
  const hosts = new Map();
  const refused = [];
  const refuse = (code, url) => {
    if (url && refused.length < 50) refused.push({ url: String(url).slice(0, 300), code });
    return { ok: false, code, error: CAPTURE_MESSAGES[code] || CAPTURE_MESSAGES.private };
  };
  const allowed = (reason) => !reason || (allowLoopback && reason === 'loopback');

  async function resolve(host, literal) {
    if (literal !== undefined) {
      const reason = addressReason(literal);
      if (reason === 'invalid') return { code: 'invalid' };
      return allowed(reason) ? { addresses: [literal], loopback: reason === 'loopback' } : { code: 'private' };
    }
    // A single word ("intranet") is completed by the resolver's search
    // domains, which belong to the network the function runs in.
    if (!host.includes('.') || LOCAL_NAME.test(host)) return { code: 'private' };
    let found;
    try {
      found = await withTimeout(Promise.resolve(lookup(host, { all: true })), lookupTimeoutMs, () => 'timeout');
    } catch (err) {
      return { code: ['ENOTFOUND', 'ENODATA', 'EAI_NONAME', 'EAI_NODATA'].includes(err?.code) ? 'not_found' : 'dns' };
    }
    if (found === 'timeout') return { code: 'dns' };
    const list = (Array.isArray(found) ? found : [found]).map((a) => (typeof a === 'string' ? a : a?.address)).filter(Boolean);
    if (!list.length) return { code: 'not_found' };
    const reasons = list.map(addressReason);
    if (!reasons.every(allowed)) return { code: 'private' };
    return { addresses: list, loopback: reasons.every((r) => r === 'loopback') };
  }

  async function check(input) {
    let url;
    try {
      url = new URL(String(input ?? ''));
    } catch {
      return refuse('invalid', input);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return refuse('scheme', input);
    if (url.username || url.password) return refuse('credentials', input);
    const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
    const portOk = !url.port || CAPTURE_PORTS.includes(port);
    if (!portOk && !allowLoopback) return refuse('port', input);
    const { host, literal, invalid } = hostOf(url);
    if (invalid || !host) return refuse('invalid', input);
    const key = literal ?? host;
    if (!hosts.has(key)) hosts.set(key, resolve(host, literal));
    const found = await hosts.get(key);
    if (found.code) return refuse(found.code, input);
    // The test-only option opens any port, but only to loopback.
    if (!portOk && !found.loopback) return refuse('port', input);
    // Every address passed, so any may be used: an IPv4 one first. The
    // function has no IPv6 route, and a resolver may list a dual-stack
    // site's IPv6 address first, which would make the site unreachable.
    const address = found.addresses.find((a) => net.isIPv4(a)) || found.addresses[0];
    return { ok: true, url: url.href, host, port, addresses: found.addresses, address };
  }

  return { check, refused, allowLoopback };
}

// One address checked on its own (custom-site-admin reference-capture).
export function checkCaptureUrl(url, options) {
  return createCaptureGuard(options).check(url);
}

// ─── The proxy ───────────────────────────────────────────────────────

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-connection', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
  'transfer-encoding', 'upgrade',
]);

function endToEnd(headers) {
  const named = String(headers.connection || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(k) && !named.includes(k) && v !== undefined) out[k] = v;
  }
  return out;
}

// A forward proxy on 127.0.0.1 for the capture's browser alone: https (and
// WebSockets) as CONNECT tunnels, plain http as absolute-form requests.
// Every target is checked by `guard` and connected to at the address the
// check resolved. Returns { url, port, close() }.
export async function startCaptureProxy(guard, { idleTimeoutMs = 60_000 } = {}) {
  const sockets = new Set();
  const track = (s) => {
    sockets.add(s);
    s.once('close', () => sockets.delete(s));
    return s;
  };

  async function forward(req, res) {
    const verdict = await guard.check(req.url);
    if (!verdict.ok || !/^http:/i.test(verdict.url)) {
      res.writeHead(403, { [CAPTURE_PROXY_HEADER]: verdict.code || 'scheme', 'content-type': 'text/plain' });
      res.end('Blocked');
      return;
    }
    const target = new URL(verdict.url);
    const upstream = http.request({
      host: verdict.address,
      port: verdict.port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: endToEnd(req.headers),
      setHost: false,
    }, (up) => {
      res.writeHead(up.statusCode || 502, endToEnd(up.headers));
      up.on('error', () => res.destroy());
      up.pipe(res);
    });
    upstream.on('socket', track);
    upstream.setTimeout(idleTimeoutMs, () => upstream.destroy(new Error('timed out')));
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { [CAPTURE_PROXY_HEADER]: 'unreachable', 'content-type': 'text/plain' });
        res.end('Unreachable');
      } else res.destroy();
    });
    req.pipe(upstream);
  }

  async function tunnel(req, client, head) {
    client.on('error', () => {});
    // "host:port", nothing else (no user info, no path).
    const target = String(req.url || '');
    if (!/^(\[[0-9a-f:.]+\]|[^\s/?#@[\]:]+):\d{1,5}$/i.test(target)) {
      client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const verdict = await guard.check(`https://${target}/`);
    // Gone while its address was looked up: nothing to connect for (its
    // 'close' came before the listener below could hear it).
    if (client.destroyed) return;
    if (!verdict.ok) {
      client.end(`HTTP/1.1 403 Forbidden\r\n${CAPTURE_PROXY_HEADER}: ${verdict.code}\r\n\r\n`);
      return;
    }
    let connected = false;
    const upstream = track(net.connect({ host: verdict.address, port: verdict.port }));
    upstream.setTimeout(idleTimeoutMs, () => {
      upstream.destroy();
      client.destroy();
    });
    upstream.once('connect', () => {
      connected = true;
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => {
      if (!connected) client.end(`HTTP/1.1 502 Bad Gateway\r\n${CAPTURE_PROXY_HEADER}: unreachable\r\n\r\n`);
      else client.destroy();
    });
    client.once('close', () => upstream.destroy());
  }

  const server = http.createServer((req, res) => {
    forward(req, res).catch(() => res.destroy());
  });
  server.on('connection', track);
  server.on('connect', (req, socket, head) => {
    tunnel(req, socket, head).catch(() => socket.destroy());
  });
  // A WebSocket comes as CONNECT; an Upgrade on a plain request isn't one
  // this proxy forwards.
  server.on('upgrade', (req, socket) => socket.destroy());
  server.on('clientError', (err, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise((resolve) => {
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    }),
  };
}

// The flags the capture needs whatever browser it gets: everything through
// the proxy (loopback too: Chromium bypasses a proxy for loopback unless
// told not to), no name resolved by the browser itself (so nothing can
// leave around the proxy by name), no UDP outside it (WebRTC, QUIC).
// WebRTC sends its UDP (STUN, TURN, ICE checks) to any address a page
// names, past the proxy, unless the policy says otherwise, and the two
// kinds of build read it from different switches: chrome-headless-shell,
// which the function runs, only --force-webrtc-ip-handling-policy
// (headless_web_contents_impl.cc), a full Chrome, as the local test runs,
// only --webrtc-ip-handling-policy (its command-line preferences). Both go,
// so neither build sends a datagram of the page's anywhere.
export function captureChromeArgs(proxyUrl) {
  return [
    `--proxy-server=${proxyUrl}`,
    '--proxy-bypass-list=<-loopback>',
    // (MAP * matches IP literals too: the proxy's own address is excluded.)
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--disable-quic',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
  ];
}

// ─── The capture ─────────────────────────────────────────────────────

// How a page of `pageHeight` px is cut: parts of CAPTURE_TILE_HEIGHT from
// the top, the last one as tall as what is left, at most CAPTURE_MAX_PARTS
// ([{ part, y, height }]). A page of 5000 px is 2400 + 2400 + 200.
export function planCaptureTiles(pageHeight) {
  const h = Math.floor(Number(pageHeight));
  const total = Math.min(Number.isFinite(h) && h > 0 ? h : CAPTURE_VIEWPORT.height, CAPTURE_MAX_HEIGHT);
  const tiles = [];
  for (let y = 0; y < total && tiles.length < CAPTURE_MAX_PARTS; y += CAPTURE_TILE_HEIGHT) {
    tiles.push({ part: tiles.length + 1, y, height: Math.min(CAPTURE_TILE_HEIGHT, total - y) });
  }
  return tiles;
}

// A JPEG's { width, height } from its frame header, or null when the bytes
// aren't a JPEG.
export function jpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof && i + 8 < buf.length) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

// Run in the page (serialized by puppeteer): self-contained, globals only.
// Exported so a test's fake page can tell them apart.
export const PAGE_SCRIPTS = Object.freeze({
  measure: function measurePage() {
    const d = globalThis.document;
    const root = d.scrollingElement || d.documentElement;
    return Math.max(root ? root.scrollHeight : 0, d.body ? d.body.scrollHeight : 0, d.documentElement ? d.documentElement.offsetHeight : 0);
  },
  scrollTo: function scrollPageTo(y) {
    // 'instant' whatever the page's CSS says: with scroll-behavior: smooth
    // (Bootstrap's default, Tailwind's scroll-smooth) the page would still
    // be gliding when the next step or the screenshots come, and its fixed
    // header would be shot halfway down the page.
    globalThis.scrollTo({ top: y, left: 0, behavior: 'instant' });
    return globalThis.scrollY;
  },
  readyState: function pageReadyState() {
    return globalThis.document ? globalThis.document.readyState : '';
  },
  // Reveal-on-scroll libraries hide sections until they scroll into view,
  // and some (AOS at its default once: false) hide them again on the way
  // back up, so the shots would show empty bands. Their final state is the
  // layout the site means: every such element goes there, with no
  // transition. Inline styles through the CSSOM: a strict content security
  // policy blocks an injected <style>, not these.
  // Some site builders (Durable, some Wix and app-style pages) keep the
  // page one screen tall and scroll an inner box instead, so the window
  // never scrolls: lazy content never loads and the screenshots would hold
  // one screen. When the page itself doesn't scroll, the tallest inner
  // scroller and everything above it are let out to their full height.
  unscroll: function unscrollForCapture() {
    const d = globalThis.document;
    const root = d.scrollingElement || d.documentElement;
    const vh = globalThis.innerHeight || 900;
    if (!root || !d.body || root.scrollHeight > vh + 50) return 0;
    let best = null;
    let bestExtra = 200;
    let seen = 0;
    for (const el of d.body.querySelectorAll('*')) {
      seen += 1;
      if (seen > 6000) break;
      if (el.clientHeight < vh * 0.6) continue;
      const extra = el.scrollHeight - el.clientHeight;
      if (extra <= bestExtra) continue;
      const oy = globalThis.getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
      best = el;
      bestExtra = extra;
    }
    if (!best) return 0;
    const free = (el) => {
      const s = el.style;
      s.setProperty('height', 'auto', 'important');
      s.setProperty('max-height', 'none', 'important');
      s.setProperty('overflow', 'visible', 'important');
    };
    if (globalThis.getComputedStyle(best).position === 'fixed') best.style.setProperty('position', 'relative', 'important');
    for (let el = best; el; el = el.parentElement) free(el);
    return root.scrollHeight;
  },
  reveal: function revealForCapture() {
    const d = globalThis.document;
    const els = d.querySelectorAll('[data-aos], [data-sal], .wow, [data-scroll-reveal], [data-sr-id]');
    for (const el of els) {
      if (el.hasAttribute('data-aos')) el.classList.add('aos-animate');
      if (el.hasAttribute('data-sal')) el.classList.add('sal-animate');
      const s = el.style;
      s.setProperty('transition', 'none', 'important');
      s.setProperty('animation', 'none', 'important');
      s.setProperty('visibility', 'visible', 'important');
      s.setProperty('opacity', '1', 'important');
      s.setProperty('transform', 'none', 'important');
    }
    return els.length;
  },
  // Cookie and consent boxes and chat buttons sit over the layout being
  // matched. They are hidden, never answered: the browser doesn't click
  // Accept or close anything. Known vendors by selector, plus any fixed box
  // whose own id, class or label says cookie or consent.
  hideOverlays: function hideOverlaysForCapture() {
    const d = globalThis.document;
    const known = [
      '#onetrust-consent-sdk', '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay', '#usercentrics-root',
      '#truste-consent-track', '.osano-cm-window', '.osano-cm-dialog', '#iubenda-cs-banner', '.qc-cmp2-container', '#didomi-host',
      '.fc-consent-root', '#cmplz-cookiebanner-container', '.cmplz-cookiebanner', '#cookie-law-info-bar', '.cky-consent-container',
      '.cky-overlay', '#hs-eu-cookie-confirmation', '#termly-code-snippet-support', '.cc-window', '.cc-banner', '#cookie-notice',
      '.cookie-notice-container', '#gdpr-cookie-message', '#moove_gdpr_cookie_info_bar', '.cookieconsent', '#cookieConsent',
      '#intercom-container', '.intercom-lightweight-app', '#hubspot-messages-iframe-container', '#drift-widget-container',
      '#drift-frame-controller', '#drift-frame-chat', '#tidio-chat', '#crisp-chatbox', '.crisp-client', '#chat-widget-container',
      '#podium-website-widget', '#podium-bubble', '#podium-prompt', '.zsiq_floatmain', '#zsiq_float', 'iframe#launcher',
      '#birdeye-widget', '#tawk-bubble-container', '#gorgias-chat-container',
      '#chatbase-bubble-button', '#chatbase-bubble-window', '#chatbase-message-bubbles',
    ];
    let hidden = 0;
    const hide = (el) => {
      el.style.setProperty('display', 'none', 'important');
      hidden += 1;
    };
    for (const sel of known) {
      let found = [];
      try { found = d.querySelectorAll(sel); } catch { found = []; }
      for (const el of found) hide(el);
    }
    for (const el of d.querySelectorAll('body *')) {
      const name = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('aria-label') || ''}`;
      if (!/cookie|consent|gdpr|ccpa/i.test(name)) continue;
      if (globalThis.getComputedStyle(el).position !== 'fixed') continue;
      hide(el);
    }
    return hidden;
  },
  // The page's structure in numbers, read next to its screenshots: a
  // picture shows the look, this gives the exact fonts, the sections top
  // to bottom with their layout, the spacing, the header's menu and the
  // features a picture can't show (a booking widget, a form's fields, the
  // chat button the capture hides). From the rendered DOM and computed
  // styles. It returns no color (a reference's colors are never taken), no
  // image or other address and no text but the title, headings and labels,
  // and it changes nothing on the page (the shots come after it). Bounded
  // (elements looked at, 4 s) and never throws: a part that fails is left
  // out. The raw result goes through sanitizeOutline
  // (src/lib/referenceOutline.js), which documents the shape.
  outline: function outlineForCapture() {
    const out = {
      v: 1,
      title: '',
      width: 0,
      stickyHeader: false,
      fonts: { heading: null, body: null, button: null },
      sections: [],
      nav: { items: 0, labels: [], cta: '' },
      spacing: { sectionGap: 0 },
      features: [],
    };
    const d = globalThis.document;
    const body = d ? d.body : null;
    if (!body) return out;
    const vw = globalThis.innerWidth || 1440;
    const pageW = (d.documentElement && d.documentElement.clientWidth) || vw;
    const vh = globalThis.innerHeight || 900;
    const sy = globalThis.scrollY || 0;
    const started = Date.now();
    // Every element looked at spends one: past the budget or 4 s, what is
    // left is skipped, so a giant page still answers in time.
    let budget = 60000;
    const spend = () => {
      budget -= 1;
      return budget > 0 && Date.now() - started < 4000;
    };
    const attempt = (part) => {
      try {
        part();
      } catch {
        // This part is left out; the others still answer.
      }
    };
    let navEl = null;
    let footEl = null;
    // The footer proper: footEl, or its last part when it holds sections.
    let footPart = null;
    let heroEl = null;
    let blocks = [];
    const recs = [];
    const sliders = [];
    const headings = [];
    const found = new Map();
    const feature = (id, provider) => {
      if (!found.has(id)) found.set(id, provider || '');
    };

    // ── Reading the page
    const styles = new WeakMap();
    const boxes = new WeakMap();
    const cs = (el) => {
      let s = styles.get(el);
      if (!s) {
        s = globalThis.getComputedStyle(el);
        styles.set(el, s);
      }
      return s;
    };
    // Page coordinates (the page is at its top when this runs).
    const rect = (el) => {
      let r = boxes.get(el);
      if (!r) {
        const b = el.getBoundingClientRect();
        r = { top: b.top + sy, bottom: b.bottom + sy, left: b.left, right: b.right, width: b.width, height: b.height };
        boxes.set(el, r);
      }
      return r;
    };
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|BR|HEAD|TITLE)$/;
    // Drawn, and on the page (a skip link parked at -9999px is not).
    const shown = (el) => {
      if (!el || el.nodeType !== 1 || SKIP.test(el.tagName)) return false;
      const r = rect(el);
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.right <= 0 || r.left >= vw + 50) return false;
      const s = cs(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.visibility !== 'collapse' && num(s.opacity) > 0.05;
    };
    // Shown, and not inside a faded-out or hidden box either (a slider's
    // other slides, a closed tab).
    const seen = (el) => {
      if (!shown(el)) return false;
      for (let e = el.parentElement, i = 0; e && e !== body && i < 12; e = e.parentElement, i += 1) {
        const s = cs(e);
        if (num(s.opacity) <= 0.05 || s.visibility === 'hidden') return false;
      }
      return true;
    };
    // An element's children as laid out: a display: contents wrapper (a
    // framework's island) stands for its own children.
    const childrenOf = (el) => {
      const list = [];
      for (const c of el.children) {
        if (SKIP.test(c.tagName)) continue;
        if (cs(c).display === 'contents') {
          for (const g of c.children) if (!SKIP.test(g.tagName) && list.length < 200) list.push(g);
        } else if (list.length < 200) list.push(c);
      }
      return list;
    };
    const oneLine = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    const textOf = (el) => oneLine(el ? el.innerText || el.textContent : '');
    // The words a visitor sees in `el`: text in boxes drawn at least 2 px
    // wide and tall (screen-reader-only text is clipped to 1 px, a closed
    // dropdown's isn't drawn), as written (before text-transform).
    const seenText = (el, max) => {
      let s = '';
      const walk = d.createTreeWalker(el, 4);
      for (let n = walk.nextNode(), i = 0; n && i < 80 && s.length < max; n = walk.nextNode(), i += 1) {
        if (!n.textContent.trim()) continue;
        const p = n.parentElement;
        if (p && shown(p)) s += ` ${n.textContent}`;
      }
      return oneLine(s).slice(0, max);
    };
    const rawText = (el, max) => oneLine(el && el.textContent ? el.textContent.slice(0, max) : '');
    const lower = (v) => String(v || '').toLowerCase();
    const tokensOf = (el) => lower(`${el.tagName} ${el.id || ''} ${el.getAttribute('class') || ''}`);
    const srcOf = (el) => lower(el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || '');
    const inside = (outer, el) => !!outer && !!el && (outer === el || outer.contains(el));
    const inChrome = (el) => inside(navEl, el) || inside(footPart || footEl, el);
    const blockOf = (el) => recs.find((r) => inside(r.el, el)) || null;
    const firstFamily = (stack) => String(stack || '').split(',')[0].replace(/["']/g, '').trim();
    const fontOf = (el) => {
      const s = cs(el);
      return { family: firstFamily(s.fontFamily), weight: num(s.fontWeight) || 400, size: Math.round(num(s.fontSize) * 10) / 10 };
    };
    // Colors are read only to tell a filled box from a plain one: none
    // leaves this function.
    const filled = (el) => {
      const c = cs(el).backgroundColor || '';
      if (!c || c === 'transparent') return false;
      const m = /\(([^)]*)\)/.exec(c);
      if (!m) return true;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      return parts.length < 4 || num(parts[3]) > 0.05;
    };
    const behind = (el) => {
      for (let e = el, i = 0; e && i < 12; e = e.parentElement, i += 1) if (filled(e)) return cs(e).backgroundColor;
      return '';
    };
    const bgImage = (el) => {
      const b = cs(el).backgroundImage || 'none';
      if (b === 'none') return '';
      return /url\(/.test(b) ? 'image' : 'gradient';
    };
    const standsOut = (el) => (filled(el) && cs(el).backgroundColor !== behind(el.parentElement)) || bgImage(el) === 'gradient';
    const bordered = (el) => {
      const s = cs(el);
      return num(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none' && num(s.borderBottomWidth) >= 1 && s.borderBottomStyle !== 'none';
    };
    const cardish = (el) => {
      const s = cs(el);
      return filled(el) || bgImage(el) !== '' || s.boxShadow !== 'none' || bordered(el) || num(s.borderTopLeftRadius) > 2;
    };
    // A link or button drawn as one: button-sized, padded, a short label,
    // filled or outlined.
    const labelOf = (el) => (el.tagName === 'INPUT' ? oneLine(el.value).slice(0, 60) : seenText(el, 60));
    const buttonKind = (el) => {
      const r = rect(el);
      if (r.height < 28 || r.height > 96 || r.width < 40 || r.width > 520 || !shown(el)) return '';
      const label = labelOf(el);
      if (label.length < 2 || label.length > 40) return '';
      const s = cs(el);
      if (num(s.paddingLeft) < 8 && num(s.paddingRight) < 8) return '';
      if (standsOut(el)) return 'filled';
      return bordered(el) ? 'bordered' : '';
    };
    // The first filled button in `root`, else the first outlined one (an
    // outlined button is most often the second style). Across the page the
    // header's own button is passed over: the content's buttons show the
    // site's style, the header's is the fallback.
    const firstButton = (root, max) => {
      let outlined = null;
      const list = root.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]');
      for (let i = 0; i < list.length && i < max; i += 1) {
        if (!spend()) break;
        if (inside(navEl, list[i]) && root === body) continue;
        const kind = buttonKind(list[i]);
        if (kind === 'filled') return list[i];
        if (kind === 'bordered' && !outlined) outlined = list[i];
      }
      return outlined;
    };
    const vendorOf = (table, texts) => {
      for (const [re, name] of table) if (texts.some((t) => re.test(t))) return name;
      return null;
    };

    // Who serves a widget, by its addresses and class names.
    const BOOKING = [
      [/squareup\.com\/(appointments|book)|book\.squareup\.com|square\.site/, 'Square'],
      [/calendly\.com|calendly-(inline|badge|popup)/, 'Calendly'],
      [/acuityscheduling\.com|\.as\.me(?:[/?#:]|$)/, 'Acuity'],
      [/squarespacescheduling\.com/, 'Squarespace Scheduling'],
      [/booksy\.com/, 'Booksy'],
      [/urable\.com/, 'Urable'],
      [/vagaro\.com/, 'Vagaro'],
      [/setmore\.com/, 'Setmore'],
      [/housecallpro\.com/, 'Housecall Pro'],
      [/getjobber\.com/, 'Jobber'],
      [/mindbodyonline\.com|mindbody\.io/, 'Mindbody'],
      [/schedulicity\.com/, 'Schedulicity'],
      [/bookingkoala\.com/, 'BookingKoala'],
      [/orbisx\.(ca|com)/, 'OrbisX'],
      [/fresha\.com/, 'Fresha'],
      [/simplybook\.(me|it)/, 'SimplyBook.me'],
      [/youcanbook\.me/, 'YouCanBookMe'],
      [/appointy\.com/, 'Appointy'],
      [/tidycal\.com/, 'TidyCal'],
      [/zohobookings|bookings\.zoho/, 'Zoho Bookings'],
      [/meetings\.hubspot\.com/, 'HubSpot Meetings'],
      [/calendar\.app\.google|calendar\.google\.com\/calendar\/appointments/, 'Google Calendar'],
      [/servicetitan\.com/, 'ServiceTitan'],
      [/workiz\.com/, 'Workiz'],
      [/shopmonkey\.(io|com)/, 'Shopmonkey'],
      [/tekmetric\.com/, 'Tekmetric'],
      [/gettimely\.com/, 'Timely'],
      [/(^|[/.])cal\.com\//, 'Cal.com'],
      [/leadconnectorhq\.com\/widget\/booking|\/widget\/booking\//, 'LeadConnector'],
    ];
    const CHAT = [
      [/intercom\.io|intercomcdn|intercom-(container|lightweight|frame|launcher|app)/, 'Intercom'],
      [/tidio/, 'Tidio'],
      [/podium\.com|podium-(website-widget|bubble|prompt|modal)/, 'Podium'],
      [/driftt\.com|drift-(widget|frame)/, 'Drift'],
      [/usemessages\.com|hubspot-messages/, 'HubSpot'],
      [/crisp\.chat|crisp-client/, 'Crisp'],
      [/tawk\.to/, 'Tawk.to'],
      [/zdassets\.com|zopim|ze-snippet/, 'Zendesk'],
      [/livechatinc\.com|chat-widget-container/, 'LiveChat'],
      [/customerchat/, 'Messenger'],
      [/salesiq|zsiq/, 'Zoho SalesIQ'],
      [/olark/, 'Olark'],
      [/jivosite|jivochat|jivo-/, 'JivoChat'],
      [/smartsupp/, 'Smartsupp'],
      [/birdeye\.com\/embed\/webchat|birdeye-widget/, 'Birdeye'],
      [/gorgias/, 'Gorgias'],
      [/freshchat|fc_frame/, 'Freshchat'],
      [/chatra/, 'Chatra'],
      [/kenect/, 'Kenect'],
      [/widgets\.leadconnectorhq\.com|(^|\s)chat-widget(\s|$)|lc_text-widget/, 'LeadConnector'],
      [/chatbase/, 'Chatbase'],
      [/chatwoot/, 'Chatwoot'],
      [/userlike/, 'Userlike'],
      [/purechat/, 'Pure Chat'],
      [/snapengage/, 'SnapEngage'],
      [/botpress/, 'Botpress'],
      [/voiceflow/, 'Voiceflow'],
      [/getweave\.com|weave-(chat|text)/, 'Weave'],
    ];
    const CHAT_SEL = '[id*="intercom"], [class*="intercom"], [id*="tidio"], [id*="podium"], [id*="drift"], [id*="hubspot-messages"], '
      + '[class*="crisp"], [id*="ze-snippet"], [id*="chat-widget"], [class*="zsiq"], [id*="zsiq"], [class*="fb-customerchat"], '
      + '[id*="birdeye"], [id*="gorgias"], [id*="jivo"], [class*="jivo"], [id*="smartsupp"], [id*="chatra"], [class*="chatra"], '
      + '[id*="kenect"], [class*="kenect"], [id*="olark"], [class*="olark"], [id*="fc_frame"], chat-widget, [id*="lc_text-widget"], '
      + '[id*="chatbase"], [class*="woot-"], [id*="userlike"], [id*="purechat"], [class*="purechat"]';
    const REVIEWS = [
      [/trustindex|ti-widget|ti-reviews/, 'Trustindex'],
      [/eapps-google-reviews|eapps-reviews|elfsight[^\s]*review/, 'Elfsight'],
      [/birdeye\.com(?!\/embed\/webchat)|bf-review|birdeye-review/, 'Birdeye'],
      [/embedsocial[^\s]*review|reviews-widget-embedsocial/, 'EmbedSocial'],
      [/reviewsonmywebsite/, 'Reviews on my Website'],
      [/sk-ww-google-reviews|sk-google-reviews|sociablekit[^\s]*review/, 'SociableKIT'],
      [/podium[^\s]*review|review[^\s]*podium/, 'Podium'],
      [/nicejob/, 'NiceJob'],
      [/grade\.us|gradeus|grade-us-/, 'Grade.us'],
      [/trustpilot/, 'Trustpilot'],
      [/reviews\.io|reviewsio/, 'REVIEWS.io'],
      [/featurable/, 'Featurable'],
      [/shapo\.io|shapo-widget/, 'Shapo'],
      [/repuso/, 'Repuso'],
      [/trustmary/, 'Trustmary'],
      [/endorsal/, 'Endorsal'],
      [/(^|[\s.#])wp-gr(\s|$)|richplugins|(^|\s)grw-/, 'Rich Plugins'],
      [/yelp\.com\/(embed|biz_attribution)|yelp-review/, 'Yelp'],
    ];
    const INSTAGRAM = [
      [/(^|[\s#._-])sbi[_-]|sb_instagram|smash-?balloon/, 'Smash Balloon'],
      [/lightwidget/, 'LightWidget'],
      [/snapwidget/, 'SnapWidget'],
      [/eapps-instagram|elfsight[^\s]*insta/, 'Elfsight'],
      [/behold\.so|behold-widget/, 'Behold'],
      [/curator\.io|crt-feed|crt-widget/, 'Curator'],
      [/juicer\.io|juicer-feed/, 'Juicer'],
      [/embedsocial-(instagram|hashtag)|embedsocial[^\s]*insta/, 'EmbedSocial'],
      [/sk-instagram|sociablekit[^\s]*insta/, 'SociableKIT'],
      [/tagembed/, 'Tagembed'],
      [/taggbox/, 'Taggbox'],
      [/spotlight-instagram|spotlight-feed/, 'Spotlight'],
      [/instagram-media|instagram\.com\/(p|reel|tv)\/[^\s]*embed|instagram\.com\/embed/, 'Instagram'],
      [/instagram-feed|insta-feed|instafeed|insta-gallery|instagram-gallery|instagram-widget|ig-feed/, ''],
    ];
    const MAPS = [
      [/google\.[a-z.]+\/maps|maps\.google\.|gm-style|google-map|googlemap|gmap|gmp-map/, 'Google Maps'],
      [/mapbox/, 'Mapbox'],
      [/leaflet/, 'Leaflet'],
      [/openstreetmap\.org/, 'OpenStreetMap'],
      [/mapkit|maps\.apple\.com/, 'Apple Maps'],
      [/bing\.com\/maps/, 'Bing Maps'],
    ];
    const MAP_SEL = 'iframe, .gm-style, .mapboxgl-map, .leaflet-container, [class*="google-map"], [class*="googlemap"], [class*="gmap"], gmp-map, mapkit-map';
    const VIDEOS = [
      [/youtube\.com|youtube-nocookie\.com|youtu\.be/, 'YouTube'],
      [/vimeo\.com/, 'Vimeo'],
      [/wistia\.(com|net)|wi\.st\//, 'Wistia'],
      [/loom\.com/, 'Loom'],
      [/facebook\.com\/plugins\/video/, 'Facebook'],
      [/tiktok\.com\/embed/, 'TikTok'],
      [/vidyard/, 'Vidyard'],
    ];
    const FORMS = [
      [/wpcf7/, 'Contact Form 7'],
      [/gform/, 'Gravity Forms'],
      [/wpforms/, 'WPForms'],
      [/elementor-form/, 'Elementor'],
      [/hs-form|hbspt|hsforms/, 'HubSpot'],
      [/nf-form|ninja-forms/, 'Ninja Forms'],
      [/frm_forms|frm-show-form/, 'Formidable'],
      [/fluentform|ff-el-form/, 'Fluent Forms'],
      [/jotform/, 'Jotform'],
      [/sqs-block-form|squarespace/, 'Squarespace'],
      [/mc-embedded|mc4wp|list-manage\.com|mailchimp/, 'Mailchimp'],
      [/klaviyo/, 'Klaviyo'],
      [/ctct|constantcontact/, 'Constant Contact'],
      [/ml-embedded|mailerlite/, 'MailerLite'],
      [/convertkit|formkit/, 'ConvertKit'],
      [/formspree/, 'Formspree'],
      [/leadconnectorhq|msgsndr/, 'LeadConnector'],
    ];
    const FORM_FRAMES = [
      [/jotform/, 'Jotform'],
      [/typeform/, 'Typeform'],
      [/docs\.google\.com\/forms|forms\.gle/, 'Google Forms'],
      [/wufoo/, 'Wufoo'],
      [/cognitoforms/, 'Cognito Forms'],
      [/formstack/, 'Formstack'],
      [/123formbuilder/, '123FormBuilder'],
      [/paperform/, 'Paperform'],
      [/tally\.so/, 'Tally'],
      [/hsforms|hubspot\.com\/forms/, 'HubSpot'],
      [/leadconnectorhq\.com\/widget\/(form|survey)/, 'LeadConnector'],
    ];
    const SLIDER_RE = /(^|[\s_-])(swiper|slick|splide|glide|carousel|owl|flickity|keen-slider|embla|slider|slides|slideshow|revslider|rev_slider|rs-module|n2-ss|metaslider|soliloquy|bxslider)([\s_-]|$)/;
    const BEFORE_AFTER_RE = /before[-_ ]?after|twentytwenty|beer-slider|beer-handle|img-comp-(container|img|slider|overlay)|juxtapose|image-compare|img-comparison|ba-slider|cocoen|comparison-slider|compare-slider/;
    const SLIDES = '.swiper-slide:not(.swiper-slide-duplicate), .slick-slide:not(.slick-cloned), .splide__slide:not(.splide__slide--clone), '
      + '.glide__slide:not(.glide__slide--clone), .owl-item:not(.cloned), .carousel-item, .keen-slider__slide, .flickity-slider > *, '
      + '.elementor-slide, .n2-ss-slide, .embla__slide, rs-slide, [aria-roledescription="slide"]';
    // The slider's library, by its own classes or its parts'.
    const sliderLib = (s) => {
      const parts = s.querySelectorAll('[class*="swiper"], [class*="slick"], [class*="splide"], [class*="glide"], [class*="owl"], [class*="flickity"], [class*="keen-slider"]');
      let t = tokensOf(s);
      for (let i = 0; i < parts.length && i < 3; i += 1) t += ` ${tokensOf(parts[i])}`;
      const libs = [
        [/swiper/, 'Swiper'], [/slick/, 'Slick'], [/splide/, 'Splide'], [/glide/, 'Glide'], [/owl/, 'Owl Carousel'],
        [/flickity/, 'Flickity'], [/keen-slider/, 'Keen Slider'], [/embla/, 'Embla'], [/rev_?slider|rs-module/, 'Slider Revolution'],
        [/n2-ss|smart-slider/, 'Smart Slider'],
      ];
      return vendorOf(libs, [t]) || '';
    };

    // ── Sections: how they are laid out
    const MEDIA = /^(IMG|PICTURE|FIGURE|VIDEO|IFRAME)$/;
    const NOT_ITEM = /^(P|H[1-6]|SPAN|LABEL|B|STRONG|EM|I|SMALL|BR|BUTTON|INPUT|SELECT|TEXTAREA|OPTION|SCRIPT|STYLE|NOSCRIPT|TEMPLATE|svg|path|g|use)$/;
    // A card, tile, photo, figure or question: a box with a picture, a
    // title, a card's look or parts of its own (never a bare paragraph).
    const itemOk = (c) => {
      if (MEDIA.test(c.tagName)) return true;
      if (NOT_ITEM.test(c.tagName) || !c.firstElementChild) return false;
      return c.childElementCount >= 2 || cardish(c)
        || !!c.querySelector('img, picture, video, svg, iframe, h2, h3, h4, h5, h6, summary, [aria-expanded], [class*="icon"]');
    };
    const sigOf = (c) => {
      if (!c || !c.classList) return '';
      const keep = [];
      for (const k of c.classList) if (!/\d|active|current|selected|first|last|odd|even|show|visible|animat|aos|fade|in-view|loaded|lazy|hover/i.test(k)) keep.push(k);
      return `${c.tagName}.${keep.sort().join('.')}`;
    };
    // The biggest set of repeated similar items in `root`: the same tag and
    // classes under same-looking parents (a grid's rows hold one set), about
    // the same width (one row of siblings: any width, as content-sized flex
    // items are), outermost only. { items, area, cover } or null; cover: the
    // share of `root` the set spans.
    const groupIn = (root) => {
      const rr = rect(root);
      const rootArea = Math.max(1, rr.width * rr.height);
      const groups = new Map();
      const all = root.getElementsByTagName('*');
      for (let i = 0; i < all.length && i < 1200; i += 1) {
        if (!spend()) break;
        const c = all[i];
        const r = rect(c);
        if (r.width < 60 || r.height < 40 || !itemOk(c) || !shown(c)) continue;
        const key = `${sigOf(c)}<${sigOf(c.parentElement)}`;
        const list = groups.get(key);
        if (!list) groups.set(key, [c]);
        else if (list.length < 120) list.push(c);
      }
      let best = null;
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const top = rect(list[0]).top;
        let same = [];
        if (list.every((c) => c.parentElement === list[0].parentElement && Math.abs(rect(c).top - top) <= 8)) same = list.slice();
        else {
          for (const a of list) {
            const w = rect(a).width;
            const near = list.filter((b) => Math.abs(rect(b).width - w) <= w * 0.12);
            if (near.length > same.length) same = near;
          }
        }
        same = same.filter((a) => !same.some((b) => b !== a && b.contains(a)));
        if (same.length < 2) continue;
        const area = same.reduce((sum, c) => sum + rect(c).width * rect(c).height, 0);
        if (area < rootArea * 0.05) continue;
        // Plain rows as wide as the section are its structure: the cards in
        // them say more (an FAQ's rows still win where nothing else repeats).
        const card = cardish(same[0]);
        const rows = !card && same.every((c) => rect(c).width >= rr.width * 0.6);
        const score = area * Math.sqrt(Math.min(same.length, 16)) * (card ? 1.3 : 1) * (rows ? 0.3 : 1);
        if (best && score <= best.score) continue;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const c of same) {
          const r = rect(c);
          x0 = Math.min(x0, Math.max(r.left, rr.left));
          x1 = Math.max(x1, Math.min(r.right, rr.right));
          y0 = Math.min(y0, r.top);
          y1 = Math.max(y1, r.bottom);
        }
        best = { items: same, area, score, cover: (Math.max(0, x1 - x0) * Math.max(0, y1 - y0)) / rootArea };
      }
      return best;
    };
    // Columns: the most items one horizontal line crosses (a grid's row, a
    // masonry's staggered columns; 1 for items stacked in a list).
    const colsOf = (items) => {
      const boxes = items.map(rect).filter((r) => r.left >= -10 && r.right <= vw + 10);
      let cols = 0;
      for (const a of boxes) {
        const y = (a.top + a.bottom) / 2;
        cols = Math.max(cols, boxes.filter((b) => b.top <= y && b.bottom >= y).length);
      }
      return cols;
    };
    // Two blocks side by side, each 30 to 70% of their row, that aren't a
    // pair of like cards: text beside a photo, a form or a map.
    const splitIn = (root) => {
      const rr = rect(root);
      const scope = [root];
      const desc = root.getElementsByTagName('*');
      for (let i = 0; i < desc.length && i < 300; i += 1) scope.push(desc[i]);
      const media = (c) => MEDIA.test(c.tagName) || !!c.querySelector('img, picture, video, iframe, form') || bgImage(c) === 'image';
      for (const el of scope) {
        if (!spend()) break;
        const r = rect(el);
        if (r.width < rr.width * 0.5 || r.height < 80 || !el.firstElementChild) continue;
        const k = [];
        for (const c of childrenOf(el)) {
          const cr = rect(c);
          if (cr.width < 80 || cr.height < 40 || !shown(c)) continue;
          const p = cs(c).position;
          if (p === 'absolute' || p === 'fixed') continue;
          k.push(c);
          if (k.length > 2) break;
        }
        if (k.length !== 2) continue;
        const a = rect(k[0]);
        const b = rect(k[1]);
        if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < Math.min(a.height, b.height) * 0.5) continue;
        const fa = a.width / r.width;
        const fb = b.width / r.width;
        if (fa < 0.3 || fa > 0.7 || fb < 0.3 || fb > 0.7) continue;
        if (sigOf(k[0]) === sigOf(k[1]) && media(k[0]) === media(k[1]) && cardish(k[0]) && cardish(k[1])) continue;
        return true;
      }
      return false;
    };
    // A photo or video behind the whole band, edge to edge.
    const fullIn = (root) => {
      const rr = rect(root);
      if (rr.width < pageW * 0.9) return false;
      if (bgImage(root) === 'image') return true;
      const covers = (el) => {
        const r = rect(el);
        return r.width >= rr.width * 0.9 && r.height >= rr.height * 0.6;
      };
      const media = root.querySelectorAll('img, video, picture, iframe');
      for (let i = 0; i < media.length && i < 40; i += 1) if (covers(media[i]) && shown(media[i])) return true;
      const near = root.querySelectorAll(':scope > *, :scope > * > *');
      for (let i = 0; i < near.length && i < 40; i += 1) if (covers(near[i]) && bgImage(near[i]) === 'image') return true;
      return false;
    };
    // A section's layout and its repeated items. A set lays the section out
    // when it spans enough of it (a hero's few badges don't make a grid).
    const layoutOf = (el, hero) => {
      const rr = rect(el);
      const slider = sliders.find((s) => inside(el, s) && rect(s).width >= rr.width * 0.5) || null;
      const group = groupIn(el);
      const cards = group ? Math.min(group.items.length, 50) : 0;
      const gridOf = (g) => {
        const cols = colsOf(g.items);
        return cols >= 2 ? `grid-${Math.min(cols, 4)}` : 'list';
      };
      if (slider) return { layout: 'carousel', cards: Math.min(slider.querySelectorAll(SLIDES).length, 50) || cards, group };
      if (group && group.items.length >= 3 && group.cover >= (hero ? 0.4 : 0.2)) return { layout: gridOf(group), cards, group };
      // (A pair is the split's own two halves, not cards.)
      if (splitIn(el)) return { layout: 'split', cards: cards >= 3 ? cards : 0, group };
      if (group && group.cover >= (hero ? 0.4 : 0.15)) return { layout: gridOf(group), cards, group };
      if (fullIn(el)) return { layout: 'full', cards, group };
      return { layout: '', cards, group };
    };

    // ── Sections: what they are
    // Whole words: "Preview" is not a review, "Facebook" not a booking.
    const HEADING_KINDS = [
      ['faq', /\bfaqs?\b|frequently asked|common questions|questions? (and|&) answers|\bq\s?&\s?a\b/i],
      ['reviews', /\breviews?\b|\btestimonials?\b|\bwhat .{0,40}\b(say|said|saying)\b|happy (customers|clients)|customers love|kind words|client love/i],
      ['contact', /\bservice areas?\b|\bareas? (we )?serv(e|ed|ing)?\b|\bserving .{0,40}\barea|\bwhere we (serve|go|work)\b/i],
      ['pricing', /\bpric(e|es|ing)\b|\bpackages?\b|\bplans?\b|\bmemberships?\b|\brates\b/i],
      ['gallery', /\bgallery\b|\bour work\b|\bportfolio\b|\brecent (work|projects|jobs)\b|\bbefore\s*(&|and|\+|\/|-)?\s*after\b|\bshowcase\b|\bphotos?\b/i],
      ['process', /\bhow it works\b|\bprocess\b|\bsteps?\b|\bhow we work\b/i],
      ['booking', /\bbook(ing)?\b|\bappointments?\b|\bschedul|\breserv/i],
      ['contact', /\bcontact\b|\bget in touch\b|\bquotes?\b|\bestimates?\b|\breach (us|out)\b|\bvisit us\b|\bfind us\b|\blocations?\b|\bdirections\b|\bhours\b/i],
      ['about', /\babout\b|\bour story\b|\bwho we are\b|\bmeet (the|our)\b|\bmission\b|\bwhy (choose|us)\b|\bour team\b|\bfamily.owned\b/i],
      ['services', /\bservices?\b|\bwhat we (do|offer)\b|\bwe offer\b|\bspecialt|\bdetailing\b|\bcoatings?\b|\btint(ing)?\b|\bppf\b|\bprotection\b|\brepairs?\b|\bwash(es|ing)?\b|\bcorrection\b|\binterior\b|\bexterior\b/i],
      ['cta', /\bready to\b|\bget started\b|\bcall (us|now|today)\b|\blet'?s (talk|go|get)\b|\bdon'?t wait\b|\btoday\b|\bnow\b/i],
    ];
    const kindOfHeading = (t) => {
      for (const [kind, re] of HEADING_KINDS) if (re.test(t)) return kind;
      return '';
    };
    const STAR = String.fromCharCode(9733);
    const PRICE = /[$€£]\s?\d|\d\s?[$€£]/;
    const STAT = /^\d[\d.,]*\s*(\+|%|k\+?|m\+?|x|\/\d+)?$/i;
    // Big numbers ("500+", "98%", "24/7"): a stats band has three or more.
    const statsIn = (el) => {
      let n = 0;
      const all = el.getElementsByTagName('*');
      for (let i = 0; i < all.length && i < 400 && n < 6; i += 1) {
        if (!spend()) break;
        const c = all[i];
        if (c.childElementCount) continue;
        const t = oneLine(c.textContent);
        if (!t || t.length > 8 || !STAT.test(t) || /^0\d/.test(t)) continue;
        if (num(t.replace(/,/g, '')) < 10 && !/[+%kmx/]/i.test(t)) continue;
        if (c.parentElement && PRICE.test(rawText(c.parentElement, 60))) continue;
        if (num(cs(c).fontSize) >= 28 && shown(c)) n += 1;
      }
      return n;
    };
    const imagesIn = (el) => {
      let n = 0;
      const list = el.querySelectorAll('img, video');
      for (let i = 0; i < list.length && i < 120; i += 1) {
        const r = rect(list[i]);
        if (r.width >= 60 && r.height >= 40) n += 1;
      }
      return n;
    };
    const urlsIn = (el) => {
      const urls = [];
      const list = el.querySelectorAll('a[href], iframe');
      for (let i = 0; i < list.length && i < 150; i += 1) urls.push(list[i].tagName === 'IFRAME' ? srcOf(list[i]) : lower(list[i].getAttribute('href')));
      return urls;
    };
    const mapIn = (root) => {
      const list = root.querySelectorAll(MAP_SEL);
      for (let i = 0; i < list.length && i < 60; i += 1) {
        const el = list[i];
        if (el.tagName !== 'IFRAME') {
          const r = rect(el);
          if (r.width < 100 || r.height < 80) continue;
        }
        const v = vendorOf(MAPS, [el.tagName === 'IFRAME' ? srcOf(el) : tokensOf(el)]);
        if (v !== null) return v;
      }
      return null;
    };
    const analyse = (el) => {
      const hero = el === heroEl;
      // The section's own heading (h1-h3); the kind may also read an
      // eyebrow or a card title (h4-h6) when that one says nothing.
      let heading = '';
      let first = null;
      const titles = [];
      const hl = el.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
      // Fully visible headings first; a slider caught between two slides
      // still has its slides' headings.
      for (const ok of [seen, shown]) {
        for (let i = 0; i < hl.length && i < 16 && titles.length < 2; i += 1) {
          if (!ok(hl[i])) continue;
          const t = textOf(hl[i]).slice(0, 200);
          if (!t) continue;
          titles.push(t);
          if (!first) first = hl[i];
          if (!heading && /^H[1-3]$/.test(hl[i].tagName)) heading = t;
        }
        if (titles.length) break;
      }
      // An eyebrow ("HOW IT WORKS" over the heading) names the section too.
      const eyebrow = first ? first.previousElementSibling : null;
      if (eyebrow && eyebrow.getElementsByTagName('*').length <= 2 && shown(eyebrow)) {
        const t = textOf(eyebrow);
        if (t && t.length <= 40) titles.splice(1, 0, t);
      }
      const lay = layoutOf(el, hero);
      const group = lay.group;
      const words = rawText(el, 6000).split(' ').filter(Boolean).length;
      const priced = !!group && group.items.filter((c) => PRICE.test(rawText(c, 800))).length >= 2;
      const imageGrid = !!group && group.items.length >= 6
        && group.items.filter((c) => MEDIA.test(c.tagName) || (!!c.querySelector('img, picture, video') && rawText(c, 200).length <= 60)).length >= group.items.length * 0.7;
      const bigNumbers = statsIn(el);
      const t = rawText(el, 4000);
      let kind = hero ? 'hero' : '';
      // A quote with a name after it ("- Kaden R.") is a testimonial,
      // whatever it says; a quoted slogan has no name.
      if (!kind && /^["“”„«]/.test(titles[0] || '') && /(^|[\s"“”'’.!?])[-–—]\s?[A-Z][\w.'’]*(\s[A-Z][\w.'’]*)?(\s|$)/.test(t)) kind = 'reviews';
      for (const title of titles) if (!kind) kind = kindOfHeading(title);
      if (!kind) {
        const urls = urlsIn(el);
        if (el.querySelectorAll('details > summary').length >= 2 || el.querySelectorAll('[aria-expanded]').length >= 3) kind = 'faq';
        else if (vendorOf(BOOKING, urls) !== null) kind = 'booking';
        else if (el.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select').length >= 2) kind = 'contact';
        else if (mapIn(el) !== null) kind = 'contact';
        else if (bigNumbers >= 3) kind = 'stats';
        else if (imageGrid || (imagesIn(el) >= 6 && words < 120)) kind = 'gallery';
        else if (priced) kind = 'pricing';
        else if (/testimonial/i.test(t) || t.includes(STAR) || (words < 150 && el.querySelector('blockquote'))
          || el.querySelectorAll('[class*="star"], [aria-label*="star" i], [class*="rating"], [data-rating]').length >= 3) kind = 'reviews';
        else if (rect(el).height < vh * 0.6 && words <= 40 && firstButton(el, 30)) kind = 'cta';
        else kind = 'other';
      }
      return { el, kind, heading, height: Math.round(rect(el).height), layout: lay.layout, cards: lay.cards, priced, imageGrid, bigNumbers };
    };

    attempt(() => {
      out.title = oneLine(d.title).slice(0, 300);
    });

    // ── The header and the footer
    attempt(() => {
      const cands = [];
      const named = d.querySelectorAll('header, [role="banner"], nav, #header, #masthead, #site-header, .site-header, .main-header, .header, .navbar, '
        + '#SITE_HEADER, [data-elementor-type="header"], .elementor-location-header');
      for (let i = 0; i < named.length && i < 60; i += 1) cands.push(named[i]);
      // A bar fixed or stuck to the top, whatever it is called.
      const all = body.getElementsByTagName('*');
      for (let i = 0; i < all.length && i < 1500; i += 1) {
        if (!spend()) break;
        const r = rect(all[i]);
        if (r.top > 10 || r.height < 30 || r.height > 220 || r.width < vw * 0.8) continue;
        const p = cs(all[i]).position;
        if (p === 'fixed' || p === 'sticky') cands.push(all[i]);
      }
      const ok = cands.filter((el) => {
        if (!shown(el)) return false;
        const r = rect(el);
        return r.top < 160 && r.height >= 30 && r.height < 300 && r.width >= vw * 0.5;
      });
      const outer = ok.filter((el) => !ok.some((o) => o !== el && o.contains(el)));
      outer.sort((a, b) => rect(a).top - rect(b).top);
      navEl = outer[0] || null;
    });
    attempt(() => {
      const docHeight = Math.max(body.scrollHeight, d.documentElement ? d.documentElement.scrollHeight : 0);
      const named = d.querySelectorAll('footer, [role="contentinfo"], #footer, #colophon, .site-footer, #SITE_FOOTER, [data-elementor-type="footer"], '
        + '.elementor-location-footer');
      const ok = [];
      for (let i = 0; i < named.length && i < 40; i += 1) {
        const el = named[i];
        if (shown(el) && rect(el).height >= 40 && !inside(navEl, el) && rect(el).bottom >= docHeight * 0.6) ok.push(el);
      }
      const outer = ok.filter((el) => !ok.some((o) => o !== el && o.contains(el)));
      outer.sort((a, b) => rect(b).bottom - rect(a).bottom);
      footEl = outer[0] || null;
    });
    attempt(() => {
      if (!navEl) return;
      let sticky = false;
      for (let e = navEl, i = 0; e && e !== body && i < 8 && !sticky; e = e.parentElement, i += 1) {
        const p = cs(e).position;
        sticky = p === 'fixed' || p === 'sticky';
      }
      // The bar inside a header that keeps its place in the flow.
      for (let e = navEl.firstElementChild, i = 0; e && i < 2 && !sticky; e = e.firstElementChild, i += 1) {
        const p = cs(e).position;
        sticky = (p === 'fixed' || p === 'sticky') && rect(e).width >= vw * 0.5;
      }
      // Made sticky by a script once scrolled (the page is at its top now).
      if (!sticky) sticky = /(^|[\s_-])(sticky|is-sticky|fixed-top|navbar-fixed|headroom|affix)([\s_-]|$)/.test(tokensOf(navEl));
      out.stickyHeader = sticky;
    });
    attempt(() => {
      if (!navEl) return;
      const nb = rect(navEl);
      const cta = firstButton(navEl, 200);
      if (cta) out.nav.cta = labelOf(cta);
      // The menu: the header's <nav>s when it has any (the logo and a top
      // bar's links sit outside them), else the whole header. Its entries:
      // the outermost list items when the menu is a list (a dropdown's own
      // entries are hidden, its trigger is often a button beside the
      // words), else its links and buttons. Never the header's button, a
      // phone or email link, the logo or an icon without words.
      const menus = navEl.matches('nav, [role="navigation"]') ? [navEl] : Array.from(navEl.querySelectorAll('nav, [role="navigation"]'));
      const pick = (sel) => {
        const list = [];
        for (const m of menus.length ? menus : [navEl]) {
          for (const el of m.querySelectorAll(sel)) {
            if (list.length >= 300 || !spend()) break;
            if (!list.includes(el)) list.push(el);
          }
        }
        return list.filter((el) => !list.some((o) => o !== el && o.contains(el)));
      };
      const entries = [];
      const add = (el) => {
        if (cta && (el === cta || el.contains(cta) || cta.contains(el))) return;
        if (!shown(el)) return;
        const r = rect(el);
        if (r.right < 0 || r.left > vw || r.top > nb.bottom + 10) return;
        const link = el.matches('a[href]') ? el : el.querySelector('a[href]');
        if (link && /^(tel|mailto|sms):/.test(lower(link.getAttribute('href')))) return;
        if (/logo|brand|site-title|site-name/.test(`${tokensOf(el)} ${el.parentElement ? tokensOf(el.parentElement) : ''}`)) return;
        const label = seenText(el, 60);
        if (!label || label.length > 40) return;
        // The logo as words: a link to the home page saying what the title
        // says ("Caramics Detailing"), never a plain "Home".
        if (link && label.length >= 3 && !/^home$/i.test(label) && lower(d.title).includes(lower(label))) {
          let home = false;
          try {
            const u = new URL(link.getAttribute('href') || '', globalThis.location.href);
            home = u.origin === globalThis.location.origin && /^\/?(index\.html?)?$/i.test(u.pathname) && !u.hash;
          } catch {
            home = false;
          }
          if (home) return;
        }
        entries.push({ label, top: r.top, left: r.left });
      };
      const items = pick('li');
      for (const el of items.length >= 2 ? items : pick('a[href], button, [role="button"]')) add(el);
      // In reading order: top row first, left to right.
      entries.sort((a, b) => (Math.round(a.top / 24) - Math.round(b.top / 24)) || (a.left - b.left));
      out.nav.items = entries.length;
      for (const e of entries) if (out.nav.labels.length < 12 && !out.nav.labels.includes(e.label)) out.nav.labels.push(e.label);
    });

    // ── Fonts
    attempt(() => {
      const firstShown = (sel) => {
        const list = d.querySelectorAll(sel);
        let spare = null;
        for (let i = 0; i < list.length && i < 200; i += 1) {
          if (!seen(list[i]) || !textOf(list[i])) continue;
          if (!inChrome(list[i])) return list[i];
          if (!spare) spare = list[i];
        }
        return spare;
      };
      const h = firstShown('h1') || firstShown('h2');
      if (h) out.fonts.heading = fontOf(h);
    });
    attempt(() => {
      // The most common look among real paragraphs.
      const counts = new Map();
      const ps = d.querySelectorAll('p');
      for (let i = 0, n = 0; i < ps.length && i < 600 && n < 60; i += 1) {
        const p = ps[i];
        if (inChrome(p) || rawText(p, 400).length < 40 || !shown(p)) continue;
        n += 1;
        const f = fontOf(p);
        const key = `${f.family}|${f.weight}|${f.size}`;
        const entry = counts.get(key);
        if (entry) entry.n += 1;
        else counts.set(key, { n: 1, f });
      }
      let best = null;
      for (const c of counts.values()) if (!best || c.n > best.n) best = c;
      out.fonts.body = best ? best.f : fontOf(body);
    });
    attempt(() => {
      const b = firstButton(body, 800) || (navEl ? firstButton(navEl, 200) : null);
      if (!b) return;
      const s = cs(b);
      const r = rect(b);
      const label = labelOf(b);
      let radius = num(s.borderTopLeftRadius);
      if (/%/.test(String(s.borderTopLeftRadius))) radius = (radius / 100) * Math.min(r.width, r.height);
      const f = fontOf(b);
      out.fonts.button = {
        family: f.family,
        weight: f.weight,
        size: f.size,
        uppercase: s.textTransform === 'uppercase' || (/[A-Z]{3}/.test(label) && label === label.toUpperCase()),
        radius: radius >= r.height / 2 - 1 ? 999 : Math.round(radius),
      };
    });

    // ── Sliders (the layouts and the features both need them)
    attempt(() => {
      // By class, or by the carousel role a slider declares for screen
      // readers (Embla, shadcn/ui and others carry no slider class).
      const list = d.querySelectorAll('[aria-roledescription="carousel"], [class*="swiper"], [class*="slick"], [class*="splide"], [class*="glide"], '
        + '[class*="carousel"], [class*="owl"], [class*="flickity"], [class*="keen-slider"], [class*="embla"], [class*="slide"], [class*="rev_slider"], '
        + 'rs-module-wrap, rs-module, [class*="n2-ss"]');
      for (let i = 0; i < list.length && i < 400 && sliders.length < 40; i += 1) {
        if (!spend()) break;
        const el = list[i];
        const t = tokensOf(el);
        const named = SLIDER_RE.test(t) || lower(el.getAttribute('aria-roledescription')) === 'carousel';
        if (!named || BEFORE_AFTER_RE.test(t) || inside(navEl, el)) continue;
        if (sliders.some((s) => s.contains(el))) continue;
        const r = rect(el);
        if (r.width >= 200 && r.height >= 80 && shown(el)) sliders.push(el);
      }
    });

    // ── Sections, top to bottom
    attempt(() => {
      const kidsOf = (el) => childrenOf(el).filter((c) => {
        if (!shown(c)) return false;
        const p = cs(c).position;
        return p !== 'fixed' && p !== 'absolute';
      });
      const stacked = (list) => {
        const s = list.slice().sort((a, b) => rect(a).top - rect(b).top);
        for (let i = 1; i < s.length; i += 1) if (rect(s[i]).top < rect(s[i - 1]).bottom - 24) return false;
        return true;
      };
      // A section by its tag, or by the class a site builder gives its
      // top-level sections (Divi, Elementor, Beaver Builder, WPBakery,
      // Gutenberg, Squarespace, Shopify, Bricks, Avada, X, Kadence).
      const SECTION_CLASS = /(^|\s)(et_pb_section|elementor-top-section|e-parent|fl-row|vc_section|wp-block-cover|page-section|shopify-section|brxe-section|fusion-fullwidth|x-section|kb-row-layout-wrap)(\s|$)/;
      const sectionLike = (c) => c.tagName === 'SECTION' || SECTION_CLASS.test(lower(c.getAttribute('class')));
      const ownBg = (c) => filled(c) || bgImage(c) !== '';
      // Whether `el` holds several sections (and not one section's rows).
      const splittable = (el, k) => {
        if (k.length < 2 || !stacked(k)) return false;
        const tag = el.tagName;
        if (tag === 'BODY' || tag === 'MAIN' || tag === 'ARTICLE') return true;
        if (/^(HEADER|NAV|FORM|ASIDE|UL|OL|DL|DETAILS|TABLE|FIGURE)$/.test(tag) || (tag === 'FOOTER' && el !== footEl)) return false;
        if (k.filter(sectionLike).length >= 2) return true;
        if (sectionLike(el) || rect(el).height < vh * 1.2) return false;
        // A band with a background of its own is one section: its rows
        // share that background.
        if (ownBg(el) && rect(el).height < vh * 2.5 && k.filter(ownBg).length < 2) return false;
        return k.filter((c) => c.querySelector('h1, h2') || ownBg(c)).length >= 2;
      };
      // The sections inside `el`, or null when `el` is one (a wrapper with
      // one block in it is looked through).
      const splitInto = (el, depth) => {
        if (depth > 14 || !spend()) return null;
        const width = rect(el).width;
        const k = kidsOf(el).filter((c) => rect(c).height >= 80 && rect(c).width >= Math.max(240, width * 0.45));
        if (k.length === 1) return splitInto(k[0], depth + 1);
        if (!splittable(el, k)) return null;
        const list = [];
        for (const c of k) list.push(...(splitInto(c, depth + 1) || [c]));
        return list;
      };
      let list = (splitInto(body, 0) || []).filter((el) => {
        if (navEl && (inside(navEl, el) || (el.contains(navEl) && rect(el).height < 300))) return false;
        return !inside(footEl, el);
      });
      // A theme whose <footer> also holds sections (a blog carousel, a map,
      // a call to action) above the footer itself: those are sections.
      footPart = footEl;
      if (footEl && rect(footEl).height >= vh * 1.2) {
        const parts = splitInto(footEl, 0);
        if (parts && parts.length >= 2) {
          list.push(...parts.slice(0, -1));
          footPart = parts[parts.length - 1];
        }
      }
      if (list.length < 2) {
        // A page whose structure didn't split: its <section>s, outermost.
        const secs = [];
        const sl = d.querySelectorAll('section');
        for (let i = 0; i < sl.length && i < 200; i += 1) {
          const s = sl[i];
          if (shown(s) && rect(s).height >= 80 && !inChrome(s)) secs.push(s);
        }
        const outer = secs.filter((s) => !secs.some((o) => o !== s && o.contains(s)));
        if (outer.length >= 2) list = outer;
      }
      list.sort((a, b) => rect(a).top - rect(b).top);
      blocks = list.slice(0, 28);
      heroEl = blocks.find((el, i) => i < 3 && rect(el).top < vh && rect(el).height >= vh * 0.4) || null;
    });
    attempt(() => {
      for (const el of blocks) {
        let rec = null;
        try {
          if (spend()) rec = analyse(el);
        } catch {
          rec = null;
        }
        recs.push(rec || { el, kind: el === heroEl ? 'hero' : 'other', heading: '', height: Math.round(rect(el).height), layout: '', cards: 0 });
      }
    });
    attempt(() => {
      const list = [];
      if (navEl) list.push({ kind: 'header', heading: '', height: Math.round(rect(navEl).height), layout: '', cards: 0 });
      for (const r of recs) list.push({ kind: r.kind, heading: r.heading, height: r.height, layout: r.layout, cards: r.cards });
      const foot = footPart || footEl;
      if (foot) {
        let lay = { layout: '', cards: 0 };
        try {
          if (spend()) lay = layoutOf(foot, false);
        } catch {
          lay = { layout: '', cards: 0 };
        }
        list.push({ kind: 'footer', heading: '', height: Math.round(rect(foot).height), layout: lay.layout, cards: lay.cards });
      }
      out.sections = list;
    });
    // The content's width: in each section the outermost box centered on
    // the page and narrower than it (a max-width, auto side margins or a
    // grid's middle column), the most common one, to 10 px.
    attempt(() => {
      const widths = new Map();
      for (const b of blocks) {
        const scope = [b];
        const desc = b.getElementsByTagName('*');
        for (let i = 0; i < desc.length && i < 150; i += 1) scope.push(desc[i]);
        for (const el of scope) {
          if (!spend()) break;
          const r = rect(el);
          if (r.width < 480 || r.width > pageW - 40 || r.height < 40 || Math.abs(r.left - (pageW - r.right)) > 4 || !shown(el)) continue;
          const w = Math.round(r.width / 10) * 10;
          widths.set(w, (widths.get(w) || 0) + 1);
          break;
        }
      }
      let n = 0;
      for (const [w, c] of widths) {
        if (c > n) {
          out.width = w;
          n = c;
        }
      }
    });
    // The whitespace between one section's content and the next one's:
    // the median over the sections below the hero.
    attempt(() => {
      const LEAF = /^(IMG|VIDEO|IFRAME|svg|SVG|PICTURE|INPUT|TEXTAREA|SELECT|BUTTON|CANVAS)$/;
      const leafy = (el) => {
        if (LEAF.test(el.tagName)) return true;
        for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
        return false;
      };
      const contentTop = (b) => {
        const all = b.getElementsByTagName('*');
        for (let i = 0; i < all.length && i < 300; i += 1) {
          if (!leafy(all[i])) continue;
          const r = rect(all[i]);
          if (r.width >= 2 && r.height >= 2) return r.top;
        }
        return null;
      };
      const contentBottom = (b) => {
        const all = b.getElementsByTagName('*');
        let bottom = null;
        let seen = 0;
        for (let i = all.length - 1, n = 0; i >= 0 && n < 300 && seen < 30; i -= 1, n += 1) {
          if (!leafy(all[i])) continue;
          const r = rect(all[i]);
          if (r.width < 2 || r.height < 2) continue;
          seen += 1;
          bottom = bottom === null ? r.bottom : Math.max(bottom, r.bottom);
        }
        return bottom;
      };
      const gaps = [];
      for (let i = 0; i + 1 < recs.length; i += 1) {
        if (!spend()) break;
        if (recs[i].el === heroEl) continue;
        const above = contentBottom(recs[i].el);
        const below = contentTop(recs[i + 1].el);
        if (above === null || below === null) continue;
        const gap = below - above;
        if (gap >= 0 && gap <= 600) gaps.push(gap);
      }
      gaps.sort((a, b) => a - b);
      const m = gaps.length >> 1;
      if (gaps.length) out.spacing.sectionGap = Math.round(gaps.length % 2 ? gaps[m] : (gaps[m - 1] + gaps[m]) / 2);
    });

    // ── Features. Where a widget shows itself: the page's scripts, frames,
    // links, form targets and the ids and classes of its elements.
    const scripts = [];
    const frames = [];
    const links = [];
    const targets = [];
    let blob = '';
    attempt(() => {
      for (const s of d.scripts) {
        if (scripts.length >= 300) break;
        if (s.src) scripts.push(lower(s.src));
      }
      const fl = d.querySelectorAll('iframe');
      for (let i = 0; i < fl.length && i < 100; i += 1) frames.push(srcOf(fl[i]));
      const al = d.querySelectorAll('a[href]');
      for (let i = 0; i < al.length && i < 1500; i += 1) links.push(lower(al[i].getAttribute('href')));
      for (const f of d.forms) {
        if (targets.length >= 30) break;
        targets.push(lower(f.getAttribute('action')));
      }
      const dl = d.querySelectorAll('[data-url], [data-href], [onclick]');
      for (let i = 0; i < dl.length && i < 200; i += 1) {
        const e = dl[i];
        targets.push(lower(`${e.getAttribute('data-url') || ''} ${e.getAttribute('data-href') || ''} ${(e.getAttribute('onclick') || '').slice(0, 300)}`));
      }
      const all = body.getElementsByTagName('*');
      const parts = [];
      let size = 0;
      for (let i = 0; i < all.length && i < 5000 && size < 400000; i += 1) {
        const el = all[i];
        const c = el.getAttribute('class');
        if (!el.id && !c && !el.tagName.includes('-')) continue;
        const t = `${el.tagName} ${el.id || ''} ${c || ''}`;
        parts.push(t);
        size += t.length;
      }
      blob = lower(parts.join('\n'));
    });
    attempt(() => {
      const hl = d.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
      for (let i = 0; i < hl.length && i < 200; i += 1) {
        const t = oneLine(hl[i].textContent).slice(0, 200);
        if (t) headings.push(t);
      }
    });
    attempt(() => {
      if (out.stickyHeader) feature('sticky-header', '');
    });
    // A video: a <video>, or a player's frame or tag ('' for one the site
    // serves itself). `accept` picks which ones count.
    const videoIn = (root, accept) => {
      const list = root.querySelectorAll('video, iframe, lite-youtube, lite-vimeo, wistia-player, [data-youtube-id], [data-vimeo-id]');
      for (let i = 0; i < list.length && i < 80; i += 1) {
        const el = list[i];
        if (!accept(el)) continue;
        const tag = el.tagName;
        if (tag === 'VIDEO') return '';
        if (tag === 'LITE-YOUTUBE' || el.hasAttribute('data-youtube-id')) return 'YouTube';
        if (tag === 'LITE-VIMEO' || el.hasAttribute('data-vimeo-id')) return 'Vimeo';
        if (tag === 'WISTIA-PLAYER') return 'Wistia';
        const v = vendorOf(VIDEOS, [srcOf(el)]);
        if (v !== null) return v;
      }
      return null;
    };
    attempt(() => {
      if (heroEl) {
        // On the hero itself, never a player waiting in a closed popup.
        const v = videoIn(heroEl, (el) => {
          const r = rect(el);
          return r.width >= 200 && r.height >= 100 && shown(el);
        });
        if (v !== null) feature('hero-video', v);
        const s = sliders.find((x) => inside(heroEl, x) && rect(x).width >= rect(heroEl).width * 0.5);
        if (s) feature('hero-slider', sliderLib(s));
      }
      const other = sliders.find((x) => !inside(heroEl, x) && !inChrome(x));
      if (other) feature('carousel', sliderLib(other));
      const v = videoIn(body, (el) => !inside(heroEl, el) && !inside(navEl, el));
      if (v !== null) feature('video', v);
    });
    attempt(() => {
      if (recs.some((r) => r.kind === 'gallery' || r.imageGrid)) {
        feature('gallery', '');
        return;
      }
      const list = d.querySelectorAll('[class*="gallery"], [class*="masonry"], [class*="lightbox"], [class*="fancybox"], [class*="photoswipe"], '
        + '[class*="glightbox"], [class*="lightgallery"], [class*="envira"], [class*="foogallery"], [class*="ngg-"]');
      for (let i = 0; i < list.length && i < 80; i += 1) {
        const el = list[i];
        if (inChrome(el)) continue;
        const r = rect(el);
        if (r.width >= 200 && r.height >= 150 && shown(el) && el.querySelectorAll('img').length >= 3) {
          feature('gallery', '');
          return;
        }
      }
      if (d.querySelectorAll('[data-fancybox], [data-lightbox], [data-elementor-lightbox-slideshow], [data-lightbox-gallery]').length >= 3) feature('gallery', '');
    });
    attempt(() => {
      const list = d.querySelectorAll('[class*="before"], [id*="before"], [class*="twentytwenty"], [class*="beer"], [class*="img-comp"], '
        + '[class*="juxtapose"], [class*="compar"], [class*="cocoen"], [class*="ba-slider"], img-comparison-slider');
      for (let i = 0; i < list.length && i < 100; i += 1) {
        const t = tokensOf(list[i]);
        if (!BEFORE_AFTER_RE.test(t)) continue;
        const libs = [[/twentytwenty/, 'TwentyTwenty'], [/beer-/, 'Beer Slider'], [/juxtapose/, 'Juxtapose'], [/img-comparison/, 'img-comparison-slider'], [/cocoen/, 'Cocoen']];
        feature('before-after', vendorOf(libs, [t]) || '');
        return;
      }
      if (headings.some((h) => /before\s*(&|and|\+|\/|-)?\s*after/i.test(h))) feature('before-after', '');
    });
    attempt(() => {
      let vendor = vendorOf(REVIEWS, [blob, scripts.join('\n'), frames.join('\n')]);
      // Elfsight serves every kind of widget from one script: the widget's
      // own words, or the section it sits in, say which.
      const apps = d.querySelectorAll('[class*="elfsight-app"]');
      for (let i = 0; i < apps.length && i < 10 && vendor === null; i += 1) {
        const rec = blockOf(apps[i]);
        if (/review|rating|testimonial/i.test(rawText(apps[i], 3000)) || (rec && rec.kind === 'reviews')) vendor = 'Elfsight';
      }
      if (vendor === null) {
        const list = d.querySelectorAll('[class*="google-review"], [class*="google_review"], [class*="googlereview"], [id*="google-review"]');
        for (let i = 0; i < list.length && i < 20 && vendor === null; i += 1) {
          const r = rect(list[i]);
          if (r.width >= 200 && r.height >= 100 && !inChrome(list[i])) vendor = 'Google';
        }
      }
      if (vendor !== null) feature('reviews-widget', vendor);
      if (vendor !== null || recs.some((r) => r.kind === 'reviews')) feature('reviews', '');
    });
    attempt(() => {
      let n = 0;
      const dl = d.querySelectorAll('details');
      for (let i = 0; i < dl.length && i < 60; i += 1) if (dl[i].querySelector('summary') && !inChrome(dl[i])) n += 1;
      if (n >= 2 || recs.some((r) => r.kind === 'faq')) {
        feature('faq', '');
        return;
      }
      const list = d.querySelectorAll('[class*="accordion"], [class*="faq"], [id*="faq"]');
      for (let i = 0; i < list.length && i < 60; i += 1) {
        const el = list[i];
        if (inChrome(el)) continue;
        const r = rect(el);
        if (r.width >= 200 && r.height >= 40 && shown(el)) {
          feature('faq', '');
          return;
        }
      }
    });
    attempt(() => {
      // Tabs with names (a slider's numbered dots are a tablist too).
      const lists = d.querySelectorAll('[role="tablist"]');
      for (let i = 0; i < lists.length && i < 20; i += 1) {
        const tl = lists[i];
        if (inChrome(tl) || !shown(tl) || sliders.some((s) => inside(s, tl))) continue;
        const named = Array.from(tl.querySelectorAll('[role="tab"]')).filter((t) => {
          const x = textOf(t);
          return x.length >= 2 && !/^\d+$/.test(x);
        });
        if (named.length >= 2) {
          feature('tabs', '');
          return;
        }
      }
      const list = d.querySelectorAll('.nav-tabs, .elementor-tabs, .e-n-tabs, .et_pb_tabs, .wp-block-kadence-tabs, .tabs-nav, .tab-nav');
      for (let i = 0; i < list.length && i < 20; i += 1) {
        if (!inChrome(list[i]) && shown(list[i])) {
          feature('tabs', '');
          return;
        }
      }
    });
    attempt(() => {
      if (recs.some((r) => r.kind === 'pricing' || r.priced)) feature('pricing', '');
    });
    attempt(() => {
      let vendor = vendorOf(BOOKING, [links.join('\n'), frames.join('\n'), scripts.join('\n'), targets.join('\n'), blob]);
      if (vendor === null && d.querySelector('meta[name="generator"][content*="wix" i]') && links.some((h) => /\/book-online|\/booking-calendar|\/service-page\//.test(h))) {
        vendor = 'Wix Bookings';
      }
      if (vendor !== null) feature('booking-widget', vendor);
    });
    attempt(() => {
      // Each form once: a quote request (the vehicle, the service), a
      // newsletter (one email field) or a contact form. Sign-in and search
      // forms aren't features.
      const typeOf = (x) => (x.tagName === 'INPUT' ? lower(x.getAttribute('type') || 'text') : lower(x.tagName));
      const describe = (x) => lower(`${x.name || ''} ${x.id || ''} ${x.getAttribute('placeholder') || ''} ${x.getAttribute('aria-label') || ''} `
        + `${x.labels && x.labels[0] ? x.labels[0].textContent : ''}`).slice(0, 300);
      const fl = d.querySelectorAll('form');
      for (let i = 0; i < fl.length && i < 30; i += 1) {
        if (!spend()) break;
        const f = fl[i];
        if (inside(navEl, f)) continue;
        // The fields a person fills in: on a form that shows, the ones that
        // show (a captcha's or a honeypot's are hidden); on one waiting in a
        // closed popup, all but those.
        const open = shown(f);
        const all = Array.from(f.querySelectorAll('input, textarea, select')).slice(0, 40)
          .filter((x) => !/captcha|honeypot|_gotcha|hp_|ak_hp|website_url|fax/.test(lower(`${x.name || ''} ${x.id || ''}`)) && (!open || shown(x)));
        if (all.some((x) => typeOf(x) === 'password')) continue;
        const texts = all.filter((x) => /^(text|email|tel|number|url|search|date|datetime-local|time|textarea|select)$/.test(typeOf(x)));
        if (!texts.length) continue;
        if (f.getAttribute('role') === 'search' || (texts.length <= 2 && texts.some((x) => typeOf(x) === 'search' || /^(s|q|search|query|keyword)$/.test(lower(x.name))))) continue;
        const words = `${texts.map(describe).join(' | ')} | ${all.filter((x) => /^(checkbox|radio)$/.test(typeOf(x))).map((x) => lower(x.name)).join(' ')}`;
        const rec = blockOf(f);
        const title = lower(`${Array.from(f.querySelectorAll('h1, h2, h3, h4, legend')).slice(0, 3).map((h) => h.textContent).join(' ')} ${rec ? rec.heading : ''}`);
        const up = f.parentElement;
        const tokens = `${tokensOf(f)} ${up ? tokensOf(up) : ''} ${up && up.parentElement ? tokensOf(up.parentElement) : ''} ${lower(f.getAttribute('action'))}`;
        const vendor = vendorOf(FORMS, [tokens]) || '';
        const emails = texts.filter((x) => typeOf(x) === 'email' || /e-?mail/.test(describe(x)));
        if (/vehicle|\bmake\b|\bmodel\b|\byear\b|\bvin\b|service|package|quote|estimate/.test(words) || /quote|estimate/.test(title)) feature('quote-form', vendor);
        else if (texts.length === 1 && emails.length === 1) feature('newsletter', vendor);
        else if (emails.length || texts.some((x) => /^(tel|textarea)$/.test(typeOf(x))) || /phone|message|comment/.test(words)) feature('contact-form', vendor);
      }
      // A form a builder serves in a frame.
      const fr = d.querySelectorAll('iframe');
      for (let i = 0; i < fr.length && i < 100; i += 1) {
        const v = vendorOf(FORM_FRAMES, [srcOf(fr[i])]);
        if (v === null) continue;
        const rec = blockOf(fr[i]);
        feature(rec && /quote|estimate/i.test(rec.heading) ? 'quote-form' : 'contact-form', v);
      }
    });
    attempt(() => {
      const v = mapIn(body);
      if (v !== null) feature('map', v);
    });
    attempt(() => {
      let v = vendorOf(INSTAGRAM, [blob, frames.join('\n'), scripts.join('\n')]);
      const apps = d.querySelectorAll('[class*="elfsight-app"]');
      for (let i = 0; i < apps.length && i < 10 && v === null; i += 1) if (/instagram|followers/i.test(rawText(apps[i], 3000))) v = 'Elfsight';
      if (v !== null) feature('instagram-feed', v);
    });
    attempt(() => {
      // The capture hid the chat button; its script and box are still
      // there.
      const tokens = [];
      const list = d.querySelectorAll(CHAT_SEL);
      for (let i = 0; i < list.length && i < 50; i += 1) tokens.push(tokensOf(list[i]));
      const v = vendorOf(CHAT, [scripts.join('\n'), frames.join('\n'), tokens.join('\n')]);
      if (v !== null) feature('chat', v);
    });
    attempt(() => {
      if (recs.some((r) => r.kind === 'stats' || r.bigNumbers >= 3)) {
        feature('stats', '');
        return;
      }
      const list = d.querySelectorAll('[class*="counter"], [class*="odometer"], [class*="countup"], [class*="count-up"], [class*="numscroller"], '
        + '[data-count], [data-counter], [data-countup], [data-to]');
      for (let i = 0; i < list.length && i < 60; i += 1) {
        const el = list[i];
        if (inChrome(el) || !shown(el)) continue;
        const target = el.getAttribute('data-count') || el.getAttribute('data-counter') || el.getAttribute('data-countup') || el.getAttribute('data-to') || '';
        const named = /(^|[\s_-])(counter|odometer|count-?up|numscroller)/.test(tokensOf(el));
        if (/^\s*\d/.test(target) || (named && /\d/.test(textOf(el)))) {
          feature('stats', '');
          return;
        }
      }
    });
    attempt(() => {
      const AREA = /service areas?\b|areas? (we )?serv(e|ed|ing)?\b|cities (we )?serv|serving .{0,40}\barea|where we (serve|go|work)\b|locations? we serve|coverage area/i;
      if (headings.some((h) => AREA.test(h))) feature('service-area', '');
    });

    out.features = Array.from(found, ([id, provider]) => ({ id, provider }));
    return out;
  },
});

const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// After reveal / hideOverlays: the page lays the changes out.
const REVEAL_SETTLE_MS = 300;

// What a failed page.goto means for the admin. `refusal`: what the guard
// said about the main frame's request (the address, or a redirect).
function navigationError(err, refusal) {
  if (refusal) {
    if (refusal.code === 'private') return new CaptureError(refusal.redirected ? 'redirect_private' : 'private');
    return new CaptureError(CAPTURE_MESSAGES[refusal.code] ? refusal.code : 'private');
  }
  const m = String(err?.message || '');
  if (err?.name === 'TimeoutError' || /Navigation timeout/i.test(m)) return new CaptureError('timeout');
  if (/ERR_NAME_NOT_RESOLVED/.test(m)) return new CaptureError('not_found');
  if (/ERR_CERT_|ERR_SSL_|ERR_BAD_SSL/.test(m)) return new CaptureError('certificate');
  if (/ERR_TOO_MANY_REDIRECTS/.test(m)) return new CaptureError('redirects');
  if (/ERR_BLOCKED_BY_CLIENT/.test(m)) return new CaptureError('private');
  if (/ERR_ABORTED/.test(m)) return new CaptureError('not_page');
  if (/ERR_(TUNNEL_CONNECTION_FAILED|CONNECTION_\w+|ADDRESS_UNREACHABLE|EMPTY_RESPONSE|PROXY_CONNECTION_FAILED|TIMED_OUT|INTERNET_DISCONNECTED|NETWORK_CHANGED|HTTP2_\w+|INVALID_RESPONSE)/.test(m)) {
    return new CaptureError('unreachable');
  }
  return new CaptureError('failed');
}

// The main document's answer: an error page is not the site.
function responseError(response) {
  if (!response) return null;
  const status = Number(response.status?.()) || 0;
  const headers = response.headers?.() || {};
  if (headers[CAPTURE_PROXY_HEADER]) return new CaptureError(headers[CAPTURE_PROXY_HEADER] === 'unreachable' ? 'unreachable' : 'private');
  if (status === 401 || status === 403 || status === 429) return new CaptureError('blocked');
  if (status === 503 && (headers['cf-mitigated'] || /cloudflare|akamai|incapsula|sucuri/i.test(String(headers.server || '')))) return new CaptureError('blocked');
  if (status === 404 || status === 410) return new CaptureError('page_not_found');
  if (status >= 400) return new CaptureError('http_error', `That site answered with an error (${status}). Try again later.`);
  return null;
}

// The page's outline (PAGE_SCRIPTS.outline), sanitized, or null. Never
// throws: a page that breaks the script, or keeps the browser too busy to
// run it, is still shot.
async function readOutline(page, timeoutMs) {
  try {
    const raw = await withTimeout(
      Promise.resolve().then(() => page.evaluate(PAGE_SCRIPTS.outline)).catch(() => null),
      timeoutMs,
      () => null,
    );
    return sanitizeOutline(raw);
  } catch {
    return null;
  }
}

async function shoot(browser, { url, guard, sleep, navigationTimeoutMs, idleMaxMs, settleMs, outlineTimeoutMs }) {
  const page = await browser.newPage();
  await page.setUserAgent(CAPTURE_USER_AGENT);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setViewport({ ...CAPTURE_VIEWPORT });
  // A service worker would answer the page's requests itself, out of
  // interception's sight (the proxy still guards its own fetches).
  if (typeof page.setBypassServiceWorker === 'function') await page.setBypassServiceWorker(true);
  page.on('dialog', (dialog) => { dialog.dismiss().catch(() => {}); });
  page.on('popup', (popup) => { popup?.close().catch(() => {}); });

  let refusal = null;
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    (async () => {
      const href = request.url();
      const scheme = href.slice(0, Math.max(0, href.indexOf(':'))).toLowerCase();
      let verdict;
      if (scheme === 'data' || scheme === 'blob') verdict = { ok: true };
      else if (scheme !== 'http' && scheme !== 'https') verdict = { ok: false, code: 'scheme' };
      else verdict = await guard.check(href);
      if (verdict.ok) {
        await request.continue();
        return;
      }
      if (scheme !== 'http' && scheme !== 'https' && guard.refused.length < 50) guard.refused.push({ url: href.slice(0, 300), code: 'scheme' });
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        refusal = { code: verdict.code, redirected: request.redirectChain().length > 0 };
      }
      await request.abort(verdict.code === 'not_found' ? 'namenotresolved' : 'blockedbyclient');
    })().catch(() => {
      // Answered already, or the page went away: nothing left to do.
    });
  });

  // The main document's answer, kept for when the load event never comes.
  let mainResponse = null;
  page.on('response', (res) => {
    try {
      if (res.request().isNavigationRequest() && res.frame() === page.mainFrame()) mainResponse = res;
    } catch {
      // A response from a frame that went away.
    }
  });

  let response;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout: navigationTimeoutMs });
  } catch (err) {
    // One slow ad, chat or tracking script can hold back the load event
    // while the page itself is there: capture what loaded instead of
    // failing. Only on a timeout, only when the guard refused nothing,
    // and only once the document is parsed.
    const timedOut = !refusal && (err?.name === 'TimeoutError' || /Navigation timeout/i.test(String(err?.message || '')));
    const state = timedOut ? await page.evaluate(PAGE_SCRIPTS.readyState).catch(() => '') : '';
    if (state !== 'interactive' && state !== 'complete') throw navigationError(err, refusal);
    response = mainResponse;
  }
  // (A navigation refused after this one loaded leaves the page where it
  // is: what was loaded is captured.)
  const bad = responseError(response);
  if (bad) throw bad;

  await page.waitForNetworkIdle({ idleTime: 500, timeout: idleMaxMs }).catch(() => {});
  // A page that scrolls an inner box gets its full height first (see
  // PAGE_SCRIPTS.unscroll). Best effort, like the steps below.
  await page.evaluate(PAGE_SCRIPTS.unscroll).catch(() => 0);
  // Down the page a screen at a time, so lazy images and reveal-on-scroll
  // sections load and show, then back to the top for the header's resting
  // state.
  const firstHeight = Number(await page.evaluate(PAGE_SCRIPTS.measure)) || 0;
  const reach = Math.min(firstHeight, CAPTURE_MAX_HEIGHT);
  for (let y = SCROLL_STEP; y < reach; y += SCROLL_STEP) {
    await page.evaluate(PAGE_SCRIPTS.scrollTo, y);
    await sleep(SCROLL_PAUSE_MS);
  }
  await sleep(settleMs);
  await page.evaluate(PAGE_SCRIPTS.scrollTo, 0);
  await sleep(250);
  // Sections that only show once scrolled to, shown; boxes over the
  // layout, hidden. Best effort: a page that breaks either is still shot.
  await page.evaluate(PAGE_SCRIPTS.reveal).catch(() => 0);
  await page.evaluate(PAGE_SCRIPTS.hideOverlays).catch(() => 0);
  await sleep(REVEAL_SETTLE_MS);
  const pageHeight = Number(await page.evaluate(PAGE_SCRIPTS.measure)) || firstHeight;
  // Read from the page as it is shot: sections shown, overlays hidden.
  const outline = await readOutline(page, outlineTimeoutMs);

  const parts = [];
  for (const tile of planCaptureTiles(pageHeight)) {
    const data = await page.screenshot({
      type: 'jpeg',
      quality: CAPTURE_JPEG_QUALITY,
      clip: { x: 0, y: tile.y, width: CAPTURE_VIEWPORT.width, height: tile.height },
      captureBeyondViewport: true,
    });
    const buffer = Buffer.from(data);
    const size = jpegSize(buffer);
    if (!size) throw new CaptureError('failed');
    parts.push({ part: tile.part, y: tile.y, width: size.width, height: size.height, buffer });
  }
  return { parts, pageHeight, finalUrl: typeof page.url === 'function' ? page.url() : url, status: Number(response?.status?.()) || 0, outline };
}

// Closes the browser, and kills it when it doesn't close in 5 s: a run
// must never leave Chromium behind.
async function closeBrowser(browser) {
  if (!browser) return;
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => browser.close()),
      new Promise((resolve) => { timer = setTimeout(resolve, 5_000); }),
    ]);
  } catch { /* killed below */ } finally {
    clearTimeout(timer);
  }
  try {
    const proc = typeof browser.process === 'function' ? browser.process() : null;
    if (proc && proc.exitCode === null && !proc.killed) proc.kill('SIGKILL');
  } catch { /* already gone */ }
}

// Captures `url`: { parts: [{ part, y, width, height, buffer }], pageHeight,
// finalUrl, status, outline, refused } (outline: sanitizeOutline's, or null
// when the page didn't give one; refused: what the guard stopped, for the
// log), or throws a CaptureError whose message is for the admin.
//   launch({ args })  starts the browser (custom-site-capture-background
//                     launchBrowser; tests pass a fake), given the flags
//                     the capture needs
//   lookup, testOnly  the guard's (createCaptureGuard)
export async function capturePage({
  url, launch, lookup, testOnly = null, sleep = defaultSleep,
  navigationTimeoutMs = CAPTURE_NAV_TIMEOUT_MS, idleMaxMs = CAPTURE_IDLE_MAX_MS, settleMs = CAPTURE_SETTLE_MS,
  outlineTimeoutMs = CAPTURE_OUTLINE_TIMEOUT_MS, budgetMs = CAPTURE_BUDGET_MS,
} = {}) {
  if (typeof launch !== 'function') throw new CaptureError('browser');
  const guard = createCaptureGuard({ lookup, testOnly });
  const first = await guard.check(url);
  if (!first.ok) throw new CaptureError(first.code);
  const proxy = await startCaptureProxy(guard);
  let browser = null;
  let done = false;
  let timer;
  const work = (async () => {
    let started;
    try {
      started = await launch({ args: captureChromeArgs(proxy.url) });
    } catch (err) {
      console.error('[capture] browser did not start:', err?.message || err);
      throw new CaptureError('browser');
    }
    // Out of time while it started: closed at once, never left running.
    if (done) {
      await closeBrowser(started);
      throw new CaptureError('too_slow');
    }
    browser = started;
    return shoot(browser, { url: first.url, guard, sleep, navigationTimeoutMs, idleMaxMs, settleMs, outlineTimeoutMs });
  })();
  // Out of time before the browser even started (its download or launch
  // hung): that's our side, not the site, and the admin is told so.
  const budget = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CaptureError(browser ? 'too_slow' : 'browser')), budgetMs);
  });
  try {
    const result = await Promise.race([work, budget]);
    return { ...result, refused: guard.refused.slice() };
  } catch (err) {
    if (err instanceof CaptureError) throw err;
    console.error('[capture] failed:', err?.message || err);
    throw new CaptureError('failed');
  } finally {
    done = true;
    clearTimeout(timer);
    work.catch(() => {});
    await closeBrowser(browser);
    await proxy.close();
  }
}
