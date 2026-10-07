// tests/functions/capture-chrome.test.js
//
// A real capture: puppeteer-core (custom-site-capture-background
// launchBrowser) driving this Mac's own Google Chrome through the guard's
// proxy (_lib/capture.js capturePage), on a page served by a loopback
// server of the test's own. The page is 1440 wide and 5000 tall, in four
// colored bands under a fixed header, scrolling smoothly by its CSS (as
// Bootstrap's does), with a lazy image far down (from a name the fake resolver
// points at loopback, so it goes through the proxy by name) and requests
// to private addresses the guard must stop, and WebRTC aimed at a UDP port
// of the test's own (its datagrams would go around the proxy). Loopback is
// reachable only through the explicit test-only option. No internet, no
// database.
//
// It starts Chrome (a few seconds), so the default `npx vitest run` skips
// it: run it with CAPTURE_CHROME=1. Skipped without Chrome either way.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import dgram from 'node:dgram';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RUN = process.env.CAPTURE_CHROME === '1' && existsSync(CHROME);
// jpeg-js lives with the functions' dependencies.
const fnRequire = createRequire(new URL('../../netlify/functions/package.json', import.meta.url));

const { CAPTURE_MESSAGES, capturePage, jpegSize } = await import('../../netlify/functions/_lib/capture.js');
const { launchBrowser } = await import('../../netlify/functions/custom-site-capture-background.js');

const BANDS = [
  // [top, height, rgb]: the first is a 100vh hero (900 px at the capture's
  // viewport), which must keep its height in the parts below the fold.
  [0, 900, [255, 0, 0]],
  [900, 1500, [0, 200, 0]],
  [2400, 2400, [0, 0, 255]],
  [4800, 200, [255, 220, 0]],
];

function page(port, udpPort) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Capture test</title><style>
html,body{margin:0;padding:0}
html{scroll-behavior:smooth}
header{position:fixed;top:0;left:0;width:1440px;height:80px;background:rgb(255,0,255);z-index:9}
.band{width:1440px;position:relative}
.hero{height:100vh;background:rgb(255,0,0)}
img{position:absolute;left:0;top:0;width:1px;height:1px}
</style></head><body>
<header></header>
<div class="band hero"><img src="http://10.0.0.7/x.png" alt=""></div>
<div class="band" style="height:1500px;background:rgb(0,200,0)"></div>
<div class="band" style="height:2400px;background:rgb(0,0,255)"><img loading="lazy" style="top:1600px" src="http://assets.capture.test:${port}/lazy.png" alt=""></div>
<div class="band" style="height:200px;background:rgb(255,220,0)"></div>
<script>
fetch('http://169.254.169.254/latest/meta-data/').catch(function () {});
try { new WebSocket('ws://evil.capture.test:${port}/socket'); } catch (e) {}
// STUN, TURN over UDP and ICE checks to a peer, all at the test's UDP port.
(async function () {
  try {
    var pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:127.0.0.1:${udpPort}' }, { urls: 'turn:127.0.0.1:${udpPort}?transport=udp', username: 'u', credential: 'c' }] });
    pc.createDataChannel('x');
    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await pc.setRemoteDescription({ type: 'answer', sdp: offer.sdp.replace(/a=ice-ufrag:.*/, 'a=ice-ufrag:abcd').replace(/a=ice-pwd:.*/, 'a=ice-pwd:abcdefghijklmnopqrstuvwx').replace(/a=setup:actpass/, 'a=setup:active') });
    await pc.addIceCandidate({ candidate: 'candidate:1 1 udp 2122260223 127.0.0.1 ${udpPort} typ host', sdpMid: '0', sdpMLineIndex: 0 });
  } catch (e) {}
})();
</script>
</body></html>`;
}

// The resolver the guard asks: a name for loopback (allowed under the
// test option) and one for a private address (never).
async function lookup(host) {
  if (host === 'assets.capture.test') return [{ address: '127.0.0.1', family: 4 }];
  if (host === 'evil.capture.test') return [{ address: '10.0.0.5', family: 4 }];
  throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
}

const PIXEL = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe.skipIf(!RUN)('capturePage in real Chrome', () => {
  let server;
  let port;
  let udp;
  let udpPort;
  const hits = [];
  const datagrams = [];
  beforeAll(async () => {
    udp = dgram.createSocket('udp4');
    udp.on('message', (msg) => datagrams.push(msg.length));
    await new Promise((r) => udp.bind(0, '127.0.0.1', r));
    udpPort = udp.address().port;
    server = http.createServer((req, res) => {
      hits.push(`${req.headers.host} ${req.url}`);
      if (req.url === '/lazy.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PIXEL);
      } else if (req.url === '/go') {
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
      } else if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(page(port, udpPort));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });
  afterAll(async () => {
    if (server) await new Promise((r) => server.close(r));
    if (udp) udp.close();
  });

  // The local Chrome, through the same launcher the function uses.
  const browsers = [];
  const launch = async (opts) => {
    const browser = await launchBrowser({ ...opts, executablePath: CHROME, headless: true });
    browsers.push(browser);
    return browser;
  };

  it('shoots a 1440 x 5000 page as three JPEG parts of 2400, 2400 and 200 px, top first', async () => {
    const out = await capturePage({ url: `http://127.0.0.1:${port}/`, launch, lookup, testOnly: { allowLoopback: true } });
    expect(out.status).toBe(200);
    expect(out.pageHeight).toBe(5000);
    expect(out.parts.map(({ part, y, width, height }) => ({ part, y, width, height }))).toEqual([
      { part: 1, y: 0, width: 1440, height: 2400 }, { part: 2, y: 2400, width: 1440, height: 2400 }, { part: 3, y: 4800, width: 1440, height: 200 },
    ]);

    // Real JPEGs of those sizes, showing the right band at the right place.
    const jpeg = fnRequire('jpeg-js');
    const colorAt = (img, x, y) => {
      const i = (y * img.width + x) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    const near = (got, want) => got.every((v, i) => Math.abs(v - want[i]) < 40);
    const magenta = ([r, g, b]) => r > 200 && g < 60 && b > 200;
    for (const p of out.parts) {
      expect(p.buffer[0]).toBe(0xff);
      expect(p.buffer[1]).toBe(0xd8);
      expect(jpegSize(p.buffer)).toEqual({ width: 1440, height: p.height });
      const img = jpeg.decode(p.buffer, { useTArray: true });
      expect([img.width, img.height]).toEqual([1440, p.height]);
      for (const [top, height, rgb] of BANDS) {
        const from = Math.max(top, p.y);
        const to = Math.min(top + height, p.y + p.height);
        if (to - from < 20) continue;
        const y = Math.floor((from + to) / 2) - p.y;
        expect(near(colorAt(img, 720, y), rgb), `part ${p.part} at ${y}: ${colorAt(img, 720, y)} vs ${rgb}`).toBe(true);
      }
      // The fixed header sits at the top of the page, and only there: the
      // page was back at the top when it was shot, smooth scrolling or not.
      const headerRows = [];
      for (let y = 0; y < img.height; y += 4) if (magenta(colorAt(img, 720, y))) headerRows.push(y);
      expect([p.part, headerRows.length ? [headerRows[0], headerRows.at(-1)] : null]).toEqual([p.part, p.part === 1 ? [0, 76] : null]);
    }

    // The scroll loaded the lazy image, by name, through the proxy.
    expect(hits).toContain(`assets.capture.test:${port} /lazy.png`);
    // The guard stopped the private ones (the page's own and Chrome's).
    const refused = out.refused.map((r) => r.url);
    expect(refused).toContain('http://10.0.0.7/x.png');
    expect(refused).toContain('http://169.254.169.254/latest/meta-data/');
    expect(refused.some((u) => u.includes('evil.capture.test'))).toBe(true);
    expect(hits.every((h) => h.startsWith(`127.0.0.1:${port} `) || h.startsWith(`assets.capture.test:${port} `))).toBe(true);
    // Not one datagram of the page's WebRTC reached the UDP port.
    expect(datagrams).toEqual([]);
    expect(browsers.at(-1).connected).toBe(false);
  }, 60_000);

  it('stops at a redirect to the cloud metadata address', async () => {
    const err = await capturePage({ url: `http://127.0.0.1:${port}/go`, launch, lookup, testOnly: { allowLoopback: true } }).catch((e) => e);
    expect(err.message).toBe(CAPTURE_MESSAGES.redirect_private);
    expect(browsers.at(-1).connected).toBe(false);
  }, 60_000);

  it('never reaches loopback without the test-only option', async () => {
    const before = browsers.length;
    const err = await capturePage({ url: `http://127.0.0.1:${port}/`, launch, lookup }).catch((e) => e);
    expect(err.code).toBe('port');
    expect(browsers.length).toBe(before);
  });
});
