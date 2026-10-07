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
import http from 'node:http';
import net from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { MATCH_SHOT_LIMIT } from '../../../src/lib/designSuggest.js';

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

async function shoot(browser, { url, guard, sleep, navigationTimeoutMs, idleMaxMs, settleMs }) {
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
  return { parts, pageHeight, finalUrl: typeof page.url === 'function' ? page.url() : url, status: Number(response?.status?.()) || 0 };
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
// finalUrl, status, refused } (refused: what the guard stopped, for the
// log), or throws a CaptureError whose message is for the admin.
//   launch({ args })  starts the browser (custom-site-capture-background
//                     launchBrowser; tests pass a fake), given the flags
//                     the capture needs
//   lookup, testOnly  the guard's (createCaptureGuard)
export async function capturePage({
  url, launch, lookup, testOnly = null, sleep = defaultSleep,
  navigationTimeoutMs = CAPTURE_NAV_TIMEOUT_MS, idleMaxMs = CAPTURE_IDLE_MAX_MS, settleMs = CAPTURE_SETTLE_MS,
  budgetMs = CAPTURE_BUDGET_MS,
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
    return shoot(browser, { url: first.url, guard, sleep, navigationTimeoutMs, idleMaxMs, settleMs });
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
