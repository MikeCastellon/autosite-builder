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
// Then the page's outline (PAGE_SCRIPTS.outline) on three pages of known
// structure: a detailer's (sticky header, a hero video, three service
// cards, an FAQ of details/summary, a Calendly frame and link, a contact
// form, fonts named in its CSS), a studio's (fixed header, a Swiper hero,
// a split, stats, pricing, a gallery, before/after, reviews with Elfsight
// and Slick, tabs, a YouTube frame, a quote form, a map, an Instagram feed,
// Intercom, a newsletter) and one without header, footer or <section>s.
// Their widgets' hosts don't resolve here: the guard refuses them, and the
// outline still reads them off the page.
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
// A whole 1 x 1 PNG, for the outline pages' pictures.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('\n');

// The outline's pages, by name (served at /outline/<name>).
const OUTLINE_PAGES = {
  // One screen tall; the content scrolls inside an inner box (the way
  // Durable and some app-style builders lay pages out).
  inner: () => `<!doctype html><html><head><meta charset="utf-8"><title>Inner</title><style>
html, body { margin: 0; height: 100%; overflow: hidden; }
#app { height: 100vh; overflow-y: auto; }
.band { height: 1000px; }
</style></head><body><div id="app">
<div class="band" style="background:#c00"></div><div class="band" style="background:#0a0"></div><div class="band" style="background:#00c"></div><div class="band" style="background:#cc0"></div>
</div></body></html>`,
  detailer: () => `<!doctype html><html><head><meta charset="utf-8"><title>Shine Auto Detailing | Tampa</title><style>
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;font-size:17px;color:#222}
h1,h2,h3{font-family:'Poppins',Arial,sans-serif;margin:0}
h1{font-size:64px;font-weight:800}
h2{font-size:40px;font-weight:700;margin-bottom:16px}
h3{font-size:22px;font-weight:600}
p{margin:0 0 12px}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;height:80px;background:#fff;display:flex;align-items:center;z-index:5}
header .wrap{display:flex;align-items:center;justify-content:space-between;width:100%}
header nav a{margin:0 12px;color:#111;text-decoration:none}
.btn{display:inline-block;padding:14px 28px;background:#0a7;color:#fff;border:0;border-radius:6px;font-family:'Poppins',sans-serif;font-weight:600;font-size:16px;text-transform:uppercase;text-decoration:none}
.hero{position:relative;height:720px;overflow:hidden;padding:0}
.hero video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;background:#234}
.hero .wrap{position:relative;padding-top:200px;color:#fff}
section{padding:96px 0}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:40px}
.card{border:1px solid #ddd;border-radius:12px;padding:24px;background:#fff}
.card img{width:100%;height:160px;display:block;background:#ccc}
details{border-bottom:1px solid #ddd;padding:16px 0}
form{display:grid;gap:12px;max-width:600px}
input,textarea{padding:12px;font-size:16px}
iframe{border:0;display:block;background:#eee}
footer{background:#111;color:#fff;padding:60px 0}
.cols{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.cols > div{min-height:120px}
</style></head><body>
<header><div class="wrap"><a href="/" class="logo"><img src="/img.png" alt="Shine" width="120" height="40"></a>
<nav><a href="#services">Services</a><a href="#gallery">Gallery</a><a href="#faq">FAQ</a><a href="#contact">Contact</a><a href="tel:+15555550100">(555) 555-0100</a></nav>
<a class="btn" href="https://calendly.com/shine/detail">Book Now</a></div></header>
<section class="hero"><video muted playsinline></video><div class="wrap"><h1>Showroom shine, at your door</h1><p>Mobile detailing in Tampa Bay.</p><a class="btn" href="#contact">Get a quote</a></div></section>
<section id="services"><div class="wrap"><h2>Our Services</h2><p>Every detail by hand, with products we trust on our own cars.</p>
<div class="cards">${repeat(3, (i) => `<div class="card"><img src="/img.png" alt=""><h3>Detail ${i + 1}</h3><p>Hand wash, clay bar and a sealant that lasts for months.</p></div>`)}</div></div></section>
<section id="faq"><div class="wrap"><h2>Frequently Asked Questions</h2>
${repeat(3, (i) => `<details><summary>Question ${i + 1}?</summary><p>An answer that is long enough to be a paragraph of text.</p></details>`)}
</div></section>
<section id="booking"><div class="wrap"><h2>Book online</h2><iframe src="https://calendly.com/shine/detail?embed=true" width="800" height="300" title="Booking"></iframe></div></section>
<section id="contact"><div class="wrap"><h2>Contact us</h2><form><input name="name" placeholder="Your name"><input type="email" name="email" placeholder="Email"><input type="tel" name="phone" placeholder="Phone"><textarea name="message" placeholder="Message"></textarea><button class="btn" type="submit">Send</button></form></div></section>
<footer><div class="wrap cols">${repeat(4, (i) => `<div><h3>Column ${i + 1}</h3><p>Links</p></div>`)}</div></footer>
</body></html>`,

  studio: () => `<!doctype html><html><head><meta charset="utf-8"><title>Gloss Studio</title><style>
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Open Sans',Helvetica,sans-serif;font-size:16px;color:#222}
h1,h2,h3{font-family:'Montserrat',sans-serif;margin:0}
h1{font-size:56px;font-weight:700}
h2{font-size:36px;font-weight:700;margin-bottom:24px}
h3{font-size:20px;font-weight:600}
p{margin:0 0 10px}
.container{max-width:1140px;margin:0 auto;padding:0 15px}
#masthead{position:fixed;top:0;left:0;right:0;height:90px;background:#000;color:#fff;z-index:9}
#masthead .container{display:flex;justify-content:space-between;align-items:center;height:90px}
#masthead a{color:#fff;margin:0 10px;text-decoration:none}
.button{display:inline-block;padding:12px 30px;border:2px solid #000;border-radius:30px;font-weight:700;font-size:15px;text-decoration:none;color:#000;background:transparent}
.button.solid{background:#e30;color:#fff;border-color:#e30}
main{padding-top:90px}
.band{padding:80px 0}
.swiper{height:640px;position:relative;overflow:hidden}
.swiper-wrapper{display:flex;height:100%}
.swiper-slide{flex:0 0 100%;height:100%;background:#345;color:#fff;padding:160px 80px}
.split{display:flex;gap:40px;align-items:center}
.split > *{flex:1}
.split img{width:100%;height:400px;display:block;background:#ccc}
.stats{display:flex;justify-content:space-around;text-align:center}
.num{font-size:48px;font-weight:800;display:block}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.price-card{border:1px solid #ccc;border-radius:8px;padding:24px;min-height:260px}
.photo{width:100%;height:200px;display:block;background:#bbb}
.twentytwenty-container{position:relative;height:300px;margin-top:20px}
.twentytwenty-container img{position:absolute;left:0;top:0;width:100%;height:300px}
.slick-slider{overflow:hidden}
.slick-track{display:flex}
.slick-slide{flex:0 0 33.33%;padding:20px;min-height:160px}
[role=tablist]{display:flex;gap:10px}
[role=tab]{padding:10px 20px;border:1px solid #ccc}
.quote{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.quote input,.quote select{padding:12px;font-size:16px}
iframe{border:0;display:block;width:100%;height:320px;background:#ddd}
#sb_instagram{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
#sb_instagram .sbi_item img{width:100%;height:180px;display:block;background:#999}
footer{padding:60px 0;background:#111;color:#eee}
footer form{display:flex;gap:10px}
</style>
<script src="https://widget.intercom.io/widget/abc123" async></script>
</head><body>
<header id="masthead" class="site-header"><div class="container"><a href="/">Gloss</a>
<nav><a href="/services">Services</a><a href="/pricing">Pricing</a><a href="/gallery">Gallery</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<a class="button solid" href="/quote">Free Quote</a></div></header>
<main>
<section class="hero"><div class="swiper"><div class="swiper-wrapper">${repeat(3, (i) => `<div class="swiper-slide"><h1>Ceramic Coating Experts ${i + 1}</h1><p>Protection that lasts.</p><a class="button" href="/quote">Learn more</a></div>`)}</div></div></section>
<section class="band about"><div class="container split"><div><img src="/img.png" alt=""></div><div><h2>About Us</h2><p>We started in a two-car garage and grew one happy customer at a time, ten years and counting.</p><a class="button solid" href="/about">Our story</a></div></div></section>
<section class="band"><div class="container stats">${['500+', '98%', '24/7'].map((n) => `<div><span class="num">${n}</span><span>label</span></div>`).join('')}</div></section>
<section class="band"><div class="container"><h2>Packages &amp; Pricing</h2><div class="grid4">${['$199', '$299', '$399', '$599'].map((p, i) => `<div class="price-card"><h3>Package ${i + 1}</h3><p class="price">${p}</p><p>What is included in this package, in a few words.</p></div>`).join('')}</div></div></section>
<section class="band gallery"><div class="container"><h2>Our Work</h2><div class="grid4">${repeat(8, () => '<img class="photo" src="/img.png" alt="">')}</div>
<div class="twentytwenty-container"><img src="/img.png" alt="before"><img src="/img.png" alt="after"></div></div></section>
<section class="band reviews"><div class="container"><h2>What our customers say</h2><div class="elfsight-app-123e4567-e89b-12d3-a456-426614174000"></div>
<div class="slick-slider"><div class="slick-track">${repeat(3, (i) => `<div class="slick-slide"><p>Great job on my car, it looks brand new again. Customer ${i + 1}</p></div>`)}</div></div></div></section>
<section class="band"><div class="container"><h2>Interior or exterior?</h2><div role="tablist"><button role="tab">Interior</button><button role="tab">Exterior</button></div><p>Pick a tab to see what each detail covers, step by step.</p></div></section>
<section class="band"><div class="container"><h2>See it in action</h2><iframe src="https://www.youtube.com/embed/abc123" title="Video"></iframe></div></section>
<section class="band"><div class="container"><h2>Get a free quote</h2><form class="wpcf7-form quote"><input name="vehicle-make" placeholder="Make"><input name="vehicle-model" placeholder="Model"><input name="vehicle-year" placeholder="Year"><select name="service"><option>Ceramic coating</option></select><input type="email" name="email" placeholder="Email"><button class="button solid" type="submit">Send</button></form></div></section>
<section class="band"><div class="container"><h2>Areas we serve</h2><iframe src="https://www.google.com/maps/embed?pb=!1m18" title="Map"></iframe></div></section>
<section class="band"><div class="container"><h2>Follow along</h2><div id="sb_instagram" class="sbi">${repeat(6, () => '<div class="sbi_item"><img src="/img.png" alt=""></div>')}</div></div></section>
</main>
<footer><div class="container"><h3>Gloss Studio</h3><form class="mc4wp-form"><input type="email" name="EMAIL" placeholder="Your email"><button class="button solid" type="submit">Subscribe</button></form></div></footer>
<div id="intercom-container" style="position:fixed;right:20px;bottom:20px;width:60px;height:60px;background:#06f"></div>
</body></html>`,

  // No header, footer or <section>: blocks in a display: contents wrapper,
  // more of them than an outline keeps.
  soup: () => `<!doctype html><html><head><meta charset="utf-8"><title>Soup</title><style>
html,body{margin:0}
.s{height:160px;border-top:1px solid #ccc}
</style></head><body><div id="app"><div style="display:contents"><div class="page">
${repeat(35, (i) => `<div class="s"><h2>Block ${i + 1}</h2><p>Some words in block ${i + 1}, long enough to read as a paragraph.</p></div>`)}
</div></div></div></body></html>`,
};

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
      } else if (req.url === '/img.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG);
      } else if (req.url.startsWith('/outline/') && Object.hasOwn(OUTLINE_PAGES, req.url.slice(9))) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(OUTLINE_PAGES[req.url.slice(9)]());
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

  // ─── The outline ──────────────────────────────────────────────────
  const outlineOf = async (name) => {
    const out = await capturePage({ url: `http://127.0.0.1:${port}/outline/${name}`, launch, lookup, testOnly: { allowLoopback: true } });
    expect(out.parts.length).toBeGreaterThan(0);
    expect(browsers.at(-1).connected).toBe(false);
    // Never a color, an image or other address.
    expect(JSON.stringify(out.outline)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|https?:|www\.|\.png|\.jpg/i);
    return out.outline;
  };
  const shape = (o) => o.sections.map(({ kind, layout, cards }) => [kind, layout, cards]);

  it('reads a detailer\'s page: its fonts, menu, sections, spacing and features', async () => {
    const o = await outlineOf('detailer');
    expect(o).toMatchObject({
      v: 1,
      title: 'Shine Auto Detailing | Tampa',
      width: 1200,
      stickyHeader: true,
      fonts: {
        heading: { family: 'Poppins', weight: 800, size: 64 },
        body: { family: 'Inter', weight: 400, size: 17 },
        // The content's first button (the hero's), as written: uppercase by CSS.
        button: { family: 'Poppins', weight: 600, size: 16, uppercase: true, radius: 6 },
      },
      // The phone link and the logo aren't menu items; the button is the CTA.
      nav: { items: 4, labels: ['Services', 'Gallery', 'FAQ', 'Contact'], cta: 'Book Now' },
    });
    expect(shape(o)).toEqual([
      ['header', '', 0], ['hero', 'full', 0], ['services', 'grid-3', 3], ['faq', 'list', 3], ['booking', '', 0], ['contact', '', 0], ['footer', 'grid-4', 4],
    ]);
    expect(o.sections.map((s) => s.heading)).toEqual(['', 'Showroom shine, at your door', 'Our Services', 'Frequently Asked Questions', 'Book online', 'Contact us', '']);
    expect(o.sections.slice(0, 2).map((s) => s.height)).toEqual([80, 720]);
    // 96 px of padding on each side of a section's content, give or take
    // a card's own padding.
    expect(o.spacing.sectionGap).toBeGreaterThanOrEqual(180);
    expect(o.spacing.sectionGap).toBeLessThanOrEqual(240);
    expect(o.features).toEqual([
      { id: 'sticky-header', provider: '' }, { id: 'hero-video', provider: '' }, { id: 'faq', provider: '' },
      { id: 'booking-widget', provider: 'Calendly' }, { id: 'contact-form', provider: '' },
    ]);
  }, 60_000);

  it('reads a studio\'s page: sliders, split, stats, pricing, gallery and the widgets the screenshots can\'t show', async () => {
    const o = await outlineOf('studio');
    expect(o).toMatchObject({
      title: 'Gloss Studio',
      width: 1140,
      stickyHeader: true,
      fonts: {
        heading: { family: 'Montserrat', weight: 700, size: 56 },
        body: { family: 'Open Sans', weight: 400, size: 16 },
        // The first filled one, a pill (the hero's outlined ones come first).
        button: { family: 'Open Sans', weight: 700, size: 15, uppercase: false, radius: 999 },
      },
      nav: { items: 5, labels: ['Services', 'Pricing', 'Gallery', 'About', 'Contact'], cta: 'Free Quote' },
    });
    expect(shape(o)).toEqual([
      ['header', '', 0], ['hero', 'carousel', 3], ['about', 'split', 0], ['stats', 'grid-3', 3], ['pricing', 'grid-4', 4],
      ['gallery', 'grid-4', 8], ['reviews', 'carousel', 3], ['services', '', 0], ['other', '', 0], ['contact', '', 0],
      ['contact', '', 0], ['gallery', 'grid-4', 6], ['footer', '', 0],
    ]);
    expect(o.sections[1].heading).toBe('Ceramic Coating Experts 1');
    expect(o.features).toEqual([
      { id: 'sticky-header', provider: '' }, { id: 'hero-slider', provider: 'Swiper' }, { id: 'carousel', provider: 'Slick' },
      { id: 'gallery', provider: '' }, { id: 'before-after', provider: 'TwentyTwenty' }, { id: 'reviews', provider: '' },
      { id: 'reviews-widget', provider: 'Elfsight' }, { id: 'tabs', provider: '' }, { id: 'pricing', provider: '' },
      { id: 'quote-form', provider: 'Contact Form 7' }, { id: 'map', provider: 'Google Maps' }, { id: 'video', provider: 'YouTube' },
      { id: 'instagram-feed', provider: 'Smash Balloon' }, { id: 'chat', provider: 'Intercom' }, { id: 'stats', provider: '' },
      { id: 'newsletter', provider: 'Mailchimp' }, { id: 'service-area', provider: '' },
    ]);
  }, 60_000);

  it('lets a page that scrolls an inner box out to its full height, and shoots all of it', async () => {
    const out = await capturePage({ url: `http://127.0.0.1:${port}/outline/inner`, launch, lookup, testOnly: { allowLoopback: true } });
    expect(out.pageHeight).toBe(4000);
    expect(out.parts.map((p) => p.height)).toEqual([2400, 1600]);
    // The last band (yellow) is in the second part, not a blank screen.
    const jpeg = fnRequire('jpeg-js');
    const img = jpeg.decode(out.parts[1].buffer, { useTArray: true });
    const i = ((img.height - 200) * img.width + 720) * 4;
    expect(img.data[i] > 150 && img.data[i + 1] > 150 && img.data[i + 2] < 90).toBe(true);
  });

  it('reads a page without header, footer or sections, and keeps at most 30 sections', async () => {
    const o = await outlineOf('soup');
    expect(o.sections).toHaveLength(28);
    expect(o.sections.every((s) => s.kind === 'other' && s.layout === '' && s.height === 161)).toBe(true);
    expect(o.sections.map((s) => s.heading).slice(0, 3)).toEqual(['Block 1', 'Block 2', 'Block 3']);
    expect(o).toMatchObject({ title: 'Soup', width: 0, stickyHeader: false, nav: { items: 0, labels: [], cta: '' }, features: [] });
    expect(o.fonts.button).toBe(null);
  }, 60_000);
});
