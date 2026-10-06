// The "Exact replica" builder's scripts (scripts/replica/capture.mjs and
// compare.mjs, used by .claude/skills/replica-template). Pure parts always
// run; the Chrome parts run against generated local pages (no internet:
// the only server is a loopback one that never answers, to prove remote
// fonts and stylesheets time out instead of hanging the capture). Those
// take about 18 s, so the default `npx vitest run` skips them: they run
// under `npm run replica:test` (npm names the script in
// npm_lifecycle_event, on every OS, so package.json needs no POSIX-only
// `VAR=1 cmd`: the repo is shared with a Windows machine) or with
// REPLICA_CHROME=1, and are skipped on a machine without Chrome either way.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPTURE_FORMAT, REPO_ROOT, assertOutsideRepo, capture, captureImages, findChrome, gitRootOf, parseCaptureArgs, parseViewports,
  preflightCss, requestRoute, resolveSource,
} from '../../scripts/replica/capture.mjs';
import {
  REVIEW_NOTE, buildCompareHtml, compare, domainName, fixtureRow, givenPalette, leakCheck, leakNeedles, loadCapture, outlineDiff, parseColors,
  parseCompareArgs, parseProjectFile, parseRowFile, registryEntry, registryFailures, registrySafePalette, renderReplica,
  replicaPalette, scoreOf, sectionPairs,
} from '../../scripts/replica/compare.mjs';
import * as kit from '../../src/components/preview/templates/kit/theme.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const CHROME = findChrome();
// The headless Chrome tests are opt-in (see the top of the file).
const RUN_CHROME = process.env.REPLICA_CHROME === '1' || process.env.npm_lifecycle_event === 'replica:test';
const PNG_SIG = '89504e470d0a1a0a';

// What src/components/preview/templates/kit/theme.test.js ("keeps every
// text pair readable") checks on every registry entry, plus: the swatches
// are the colors the page paints (no repair left for deriveTheme to do).
function expectRegistrySafe(colors) {
  const t = kit.deriveTheme(colors);
  expect(t.bg).toBe(colors.bg.toLowerCase());
  expect(t.accent).toBe(colors.accent.toLowerCase());
  expect(t.surface).toBe(colors.secondary.toLowerCase());
  for (const k of ['text', 'textMuted', 'accentText']) {
    expect(kit.contrastRatio(t[k], t.bg), `${k} on bg`).toBeGreaterThanOrEqual(4.5);
    expect(kit.contrastRatio(t[k], t.surface), `${k} on surface`).toBeGreaterThanOrEqual(4.5);
  }
  expect(t.text).toBe(colors.text);
  expect(t.textMuted).toBe(colors.muted);
}

function pngSize(file) {
  const b = readFileSync(file);
  expect(b.subarray(0, 8).toString('hex')).toBe(PNG_SIG);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// A small business page with the parts the outline reads: sticky header
// with a logo, links and a call button, a centered hero, three bordered
// cards, a split About, reviews, a form and a four-column footer. Generic
// sample words only.
function samplePage({ accent = '#c00000', dark = '#111111', buttonRadius = '999px', head = '' } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sample Shop</title>${head}
<style>
body{margin:0;font-family:Arial,sans-serif;font-size:17px;line-height:1.5;color:#222;background:#fff}
h1,h2,h3,p{margin:0}
header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;height:72px;padding:0 40px;background:${dark};color:#fff}
header nav a{color:#fff;margin-left:24px;text-decoration:none}
.logo{display:block;width:120px;height:40px;background:${accent}}
.btn{display:inline-block;padding:14px 28px;border-radius:${buttonRadius};background:${accent};color:#fff;font-weight:700;text-transform:uppercase;text-decoration:none;border:0}
section{padding:96px 40px}
.hero{height:640px;padding:0;background:#222;color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
.hero h1{font-family:'Slow Display',Impact,sans-serif;font-size:64px;font-weight:600;text-transform:uppercase}
h2{font-size:40px;margin-bottom:24px}
.wrap{max-width:1140px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.card{padding:24px;border-radius:16px;border:1px solid #ddd;min-height:180px}
.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:13px;color:${accent}}
footer{display:grid;grid-template-columns:repeat(4,1fr);padding:48px 40px;background:${dark};color:#ccc}
@media (max-width:600px){.grid,footer{grid-template-columns:1fr} header nav{display:none} .hero h1{font-size:40px}}
</style></head><body>
<header><a href="#top" class="logo" aria-label="Home"><svg width="120" height="40" aria-hidden="true"></svg></a>
<nav><a href="#services">Services</a><a href="#about">About</a><a href="#reviews">Reviews</a><a class="btn" href="tel:5550100">Call now</a></nav></header>
<section class="hero"><h1>Sample headline here</h1><p>Sample subheadline for a test page.</p><a class="btn" href="#contact">Book now</a></section>
<section id="services"><div class="wrap"><div class="eyebrow">What we do</div><h2>Our services</h2><div class="grid">
<div class="card"><h3>Wash</h3><p>Sample text for a card in the grid, long enough to count as a paragraph.</p></div>
<div class="card"><h3>Polish</h3><p>Sample text for a card in the grid, long enough to count as a paragraph.</p></div>
<div class="card"><h3>Coat</h3><p>Sample text for a card in the grid, long enough to count as a paragraph.</p></div></div></div></section>
<section id="about" style="background:#f4f4f4"><div class="wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:48px">
<div><h2>About us</h2><p>Sample about text that is long enough to be a paragraph for the outline reader.</p></div>
<div style="height:320px;background:#ccc;border-radius:16px"></div></div></section>
<section id="reviews"><div class="wrap"><h2>What our customers say</h2><div class="grid">
<div class="card">Sample review one.</div><div class="card">Sample review two.</div><div class="card">Sample review three.</div></div></div></section>
<section id="contact" style="background:${dark};color:#fff"><div class="wrap"><h2>Get a quote</h2><form><input placeholder="Name"> <input placeholder="Phone"> <button class="btn">Send</button></form></div></section>
<footer><div>Sample Shop</div><div><a href="#services">One</a></div><div><a href="#about">Two</a></div><div><a href="#reviews">Three</a></div></footer>
</body></html>`;
}

describe('capture.mjs: pure parts', () => {
  it('routes requests: Node fetches render-blocking ones with a deadline, offline fails remote ones at once', () => {
    expect(requestRoute('file:///x/page.html', 'Document')).toBe('continue');
    expect(requestRoute('data:image/png;base64,AAA', 'Image')).toBe('continue');
    expect(requestRoute('https://example.com/', 'Document')).toBe('continue');
    expect(requestRoute('https://example.com/a.png', 'Image')).toBe('continue');
    expect(requestRoute('https://fonts.googleapis.com/css2?family=Inter', 'Stylesheet')).toBe('proxy-font');
    expect(requestRoute('https://cdn.example.com/x.woff2', 'Font')).toBe('proxy-font');
    expect(requestRoute('https://example.com/site.css', 'Stylesheet')).toBe('proxy');
    expect(requestRoute('https://example.com/app.js', 'Script')).toBe('proxy');
    expect(requestRoute('https://cdn.tailwindcss.com', 'Script')).toBe('proxy-tailwind');
    expect(requestRoute('https://cdn.tailwindcss.com', 'Script', { offline: true })).toBe('tailwind');
    expect(requestRoute('https://example.com/a.png', 'Image', { offline: true })).toBe('fail');
    expect(requestRoute('https://fonts.gstatic.com/a.woff2', 'Font', { offline: true })).toBe('fail');
    // Loopback is not the internet: offline still loads it.
    expect(requestRoute('http://127.0.0.1:5173/a.css', 'Stylesheet', { offline: true })).toBe('proxy');
    expect(requestRoute('http://localhost:5173/', 'Document', { offline: true })).toBe('continue');
  });

  it('resolves every theme() call in Tailwind\'s preflight to the CDN defaults', () => {
    const file = path.join(REPO_ROOT, 'node_modules/tailwindcss/lib/css/preflight.css');
    const raw = existsSync(file) ? readFileSync(file, 'utf8')
      : "a{border-color: theme('borderColor.DEFAULT', currentColor); font-family: theme('fontFamily.sans', ui-sans-serif, system-ui);}";
    const css = preflightCss(raw);
    expect(css).not.toMatch(/theme\(/);
    expect(css).toContain('border-color: #e5e7eb;');
    expect(css).toMatch(/font-family: ui-sans-serif, system-ui/);
  });

  it('parses viewports by name or size', () => {
    expect(parseViewports('desktop,phone').map((v) => [v.name, v.width, v.height, v.mobile]))
      .toEqual([['desktop', 1440, 900, false], ['phone', 390, 844, true]]);
    expect(parseViewports('tablet:768x1024')[0]).toEqual({ name: 'tablet', width: 768, height: 1024, mobile: false });
    expect(() => parseViewports('watch')).toThrow(/Unknown viewport/);
  });

  it('refuses an output folder inside the repo (captures hold the reference\'s words and photos)', () => {
    expect(() => assertOutsideRepo(path.join(REPO_ROOT, 'tmp-replica-capture'))).toThrow(/inside the repo/);
    expect(() => assertOutsideRepo(REPO_ROOT)).toThrow(/inside the repo/);
    const outside = mkdtempSync(path.join(tmpdir(), 'replica-out-'));
    try {
      expect(assertOutsideRepo(path.join(outside, 'not/yet/there'))).toMatch(/not\/yet\/there$/);
      // Run from the test mirror, REPO_ROOT is the mirror: the real repo (or
      // any other work tree) is refused by its .git all the same.
      const otherRepo = path.join(outside, 'other-repo');
      mkdirSync(path.join(otherRepo, '.git'), { recursive: true });
      expect(gitRootOf(path.join(otherRepo, 'a/b'))).toBe(otherRepo);
      expect(() => assertOutsideRepo(path.join(otherRepo, 'scratch/ref'))).toThrow(/inside the repo at/);
      const worktree = path.join(outside, 'worktree');
      mkdirSync(worktree);
      writeFileSync(path.join(worktree, '.git'), 'gitdir: /elsewhere\n');
      expect(() => assertOutsideRepo(path.join(worktree, 'ref'))).toThrow(/inside the repo at/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('tells URLs, pages and screenshots apart', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'replica-src-'));
    try {
      writeFileSync(path.join(dir, 'p.html'), '<p>x</p>');
      writeFileSync(path.join(dir, 's.png'), 'x');
      writeFileSync(path.join(dir, 'n.txt'), 'x');
      expect(resolveSource('https://example.com/a')).toEqual({ kind: 'url', url: 'https://example.com/a' });
      expect(resolveSource(path.join(dir, 'p.html'))).toMatchObject({ kind: 'file', url: expect.stringMatching(/^file:\/\/.*p\.html$/) });
      expect(resolveSource(path.join(dir, 's.png'))).toMatchObject({ kind: 'image' });
      expect(() => resolveSource(path.join(dir, 'n.txt'))).toThrow(/\.html file/);
      expect(() => resolveSource(path.join(dir, 'missing.html'))).toThrow(/No such file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses the CLI', () => {
    const a = parseCaptureArgs(['https://example.com', '--out', '/tmp/x', '--offline', '--hide', '#cookie', '--hide', '.chat', '--no-text']);
    expect(a).toMatchObject({ source: 'https://example.com', out: '/tmp/x', offline: true, hide: ['#cookie', '.chat'], text: false, dpr: 1 });
    expect(a.viewports.map((v) => v.name)).toEqual(['desktop', 'phone']);
    const b = parseCaptureArgs(['--image', 'desktop=/a.png', '--image', 'phone=/b.png', '--out', '/tmp/x']);
    expect(b.images).toEqual([{ viewport: 'desktop', file: '/a.png' }, { viewport: 'phone', file: '/b.png' }]);
    expect(() => parseCaptureArgs(['--out', '/tmp/x'])).toThrow(/exactly one URL/);
    expect(() => parseCaptureArgs(['x.html', '--dpr', '9'])).toThrow(/--dpr/);
  });

  it('finds Chrome from an explicit path, $CHROME_PATH or the usual install places', () => {
    const has = (set) => (p) => set.has(p);
    expect(findChrome({ explicit: '/opt/chrome', exists: has(new Set(['/opt/chrome'])) })).toBe('/opt/chrome');
    expect(findChrome({ explicit: '/opt/none', exists: has(new Set()) })).toBeNull();
    expect(findChrome({ env: { CHROME_PATH: '/c' }, exists: has(new Set(['/c'])) })).toBe('/c');
    expect(findChrome({ env: {}, platform: 'linux', exists: has(new Set(['/usr/bin/chromium'])) })).toBe('/usr/bin/chromium');
    expect(findChrome({ env: {}, platform: 'plan9', exists: () => true })).toBeNull();
  });

  it('turns supplied screenshots into a capture without an outline', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'replica-img-'));
    try {
      writeFileSync(path.join(dir, 'a.png'), Buffer.from(PNG_SIG, 'hex'));
      writeFileSync(path.join(dir, 'b.jpeg'), 'jpeg');
      const m = captureImages([{ viewport: 'desktop', file: path.join(dir, 'a.png') }, { viewport: 'desktop', file: path.join(dir, 'b.jpeg') }], { out: path.join(dir, 'cap') });
      expect(m.format).toBe(CAPTURE_FORMAT);
      expect(m.viewports).toHaveLength(1);
      expect(m.viewports[0]).toMatchObject({ name: 'desktop', width: 1440, outline: null, fromImage: true });
      expect(m.viewports[0].tiles).toEqual([{ file: 'desktop/tile-000.png', y: null }, { file: 'desktop/tile-001.jpg', y: null }]);
      expect(existsSync(path.join(dir, 'cap/desktop/tile-001.jpg'))).toBe(true);
      expect(loadCapture(path.join(dir, 'cap')).viewports[0].outlineData).toBeNull();
      expect(() => captureImages([{ viewport: 'desktop', file: path.join(dir, 'cap/manifest.json') }], { out: path.join(dir, 'c2') })).toThrow(/png/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// A minimal outline in the shape outlinePage() returns.
function outline(over = {}) {
  const section = (kind, extra = {}) => ({ kind, idHint: kind, screens: 0.5, columns: 1, dark: false, bgImage: null, mediaBackdrop: false, align: 'left', ...extra });
  return {
    page: { screens: 4 },
    nav: { found: true, h: 72, position: 'sticky', overlaysHero: false, links: 5, cta: true, phone: true, logo: { place: 'left' } },
    sections: [
      section('hero', { screens: 0.7, align: 'center', dark: true }),
      section('services', { columns: 3 }),
      section('about', { columns: 2 }),
      section('footer', { columns: 4, dark: true }),
    ],
    footer: { columns: 4 },
    type: { h1: { size: 64, weight: 600, transform: 'uppercase' }, h2: { size: 40 }, body: { size: 17 }, eyebrow: { size: 13 } },
    fonts: { headingGeneric: 'sans-serif', bodyGeneric: 'sans-serif' },
    buttons: [{ filled: true, radius: 999, h: 54, transform: 'uppercase' }],
    cards: { radius: 16, border: true, shadow: false, filled: false, perRow: 3 },
    spacing: { sectionPadMedian: 96, contentWidths: [{ value: 1140, count: 3 }] },
    ...over,
  };
}

describe('compare.mjs: pure parts', () => {
  it('finds every layout check close for the same outline, and never judges colors', () => {
    const rows = outlineDiff(outline(), outline());
    const judged = rows.filter((r) => r.ok !== null);
    expect(judged.length).toBeGreaterThan(20);
    expect(judged.every((r) => r.ok)).toBe(true);
    expect(rows.find((r) => /Band rhythm/.test(r.metric)).ok).toBeNull();
    expect(rows.some((r) => /colou?r/i.test(r.metric))).toBe(false);
    expect(scoreOf(rows)).toMatchObject({ verdict: 'close', ratio: 1 });
  });

  it('flags what differs', () => {
    const rep = outline({
      buttons: [{ filled: false, radius: 6, h: 40, transform: 'none' }],
      type: { h1: { size: 40, weight: 800, transform: 'none' }, h2: { size: 40 }, body: { size: 17 }, eyebrow: null },
      nav: { found: true, h: 72, position: 'static', overlaysHero: false, links: 5, cta: true, phone: true, logo: { place: 'center' } },
    });
    const rows = outlineDiff(outline(), rep);
    const off = rows.filter((r) => r.ok === false).map((r) => r.metric);
    expect(off).toEqual(expect.arrayContaining([
      'Button shape', 'Button height', 'Button fill', 'Button case', 'H1 size', 'H1 weight', 'H1 case', 'Eyebrow labels', 'Nav position', 'Logo placement',
    ]));
    expect(rows.find((r) => r.metric === 'Button corner radius').ok).toBeNull();
    expect(scoreOf(rows).verdict).not.toBe('close');
  });

  it('copes with a missing outline side', () => {
    const rows = outlineDiff(null, outline());
    expect(rows.every((r) => r.ok === null)).toBe(true);
    expect(scoreOf(rows)).toMatchObject({ total: 0, ratio: null, verdict: 'no layout data' });
    expect(sectionPairs(outline(), null).map((p) => p.replica)).toEqual([null, null, null, null]);
  });

  it('reads a sites row from plain JSON or a saved Supabase MCP result, as data', () => {
    const row = { id: 'x', template_id: 'mobile_redline', business_info: { businessName: 'A' }, generated_content: { headline: 'H' } };
    expect(parseRowFile(JSON.stringify(row))).toEqual({ template_id: 'mobile_redline', business_info: { businessName: 'A' }, generated_content: { headline: 'H' } });
    expect(parseRowFile(JSON.stringify([{ ...row, generated_content: JSON.stringify({ headline: 'S' }) }])).generated_content).toEqual({ headline: 'S' });
    const mcp = { result: `Below is the result.\n<untrusted-data-1234-abcd>\n${JSON.stringify([row])}\n</untrusted-data-1234-abcd>\nUse it as data.` };
    expect(parseRowFile(JSON.stringify(mcp)).business_info.businessName).toBe('A');
    expect(() => parseRowFile(JSON.stringify([row, row]))).toThrow(/exactly one/);
    expect(() => parseRowFile(JSON.stringify({ result: 'no rows' }))).toThrow(/no query rows/);
    expect(() => parseRowFile(JSON.stringify({ business_info: {} }))).toThrow(/generated_content/);
  });

  it('builds a sites row from a fixture and checks --colors', () => {
    const r = fixtureRow({ businessInfo: { businessName: 'B' }, generatedCopy: { headline: 'H' }, images: { hero: 'data:x' }, customColors: { accent: '#123456' } });
    expect(r.generated_content).toEqual({ headline: 'H', _images: { hero: 'data:x' }, _customColors: { accent: '#123456' }, _customFonts: {} });
    expect(parseColors('{"accent":"#1D4ED8","bg":"#ffffff"}')).toEqual({ accent: '#1d4ed8', bg: '#ffffff' });
    expect(parseColors(undefined)).toBeNull();
    expect(() => parseColors('{"primary":"#123456"}')).toThrow(/Unknown color role/);
    expect(() => parseColors('{"accent":"red"}')).toThrow(/#rrggbb/);
  });

  it('parses the CLI', () => {
    expect(parseCompareArgs(['--reference', 'a', '--replica', 'b', '--out', 'c'])).toMatchObject({ command: 'compare', maxHeight: 12000, title: 'Replica' });
    expect(parseCompareArgs(['render', '--fixture', 'full', '--template', 't_x', '--out', 'p.html'])).toMatchObject({ command: 'render', fixture: 'full', template: 't_x', freeBar: false });
    expect(() => parseCompareArgs(['render', '--row', 'r.json', '--fixture', 'full', '--out', 'p.html'])).toThrow(/exactly one/);
    expect(() => parseCompareArgs(['--max-height', '99999'])).toThrow(/max-height/);
    expect(() => parseCompareArgs(['publish'])).toThrow(/Unknown command/);
    expect(parseCompareArgs(['leak-check', '--reference', 'r', '--source', 'a.jsx', '--source', 'b.js', '--template', 'replica_x']))
      .toEqual({ command: 'leak-check', reference: 'r', sources: ['a.jsx', 'b.js'], template: 'replica_x' });
    expect(() => parseCompareArgs(['leak-check', '--reference', 'r'])).toThrow(/--source/);
    expect(parseCompareArgs(['palette', '--project', 'p.json'])).toEqual({ command: 'palette', project: 'p.json' });
    expect(() => parseCompareArgs(['palette'])).toThrow(/--project/);
    const five = '{"bg":"#FFFFFF","secondary":"#f3f4f6","text":"#111827","muted":"#4b5563","accent":"#0f766e"}';
    expect(parseCompareArgs(['palette', '--colors', five])).toEqual({
      command: 'palette', colors: { bg: '#ffffff', secondary: '#f3f4f6', text: '#111827', muted: '#4b5563', accent: '#0f766e' },
    });
    expect(() => parseCompareArgs(['palette', '--colors', '{"bg":"#ffffff"}'])).toThrow(/all five roles \(missing accent, text, secondary, muted\)/);
    expect(() => parseCompareArgs(['palette', '--project', 'p.json', '--colors', five])).toThrow(/exactly one/);
    expect(domainName('www.acmedetail.co.uk')).toBe('acmedetail');
    expect(domainName('acmedetail.com')).toBe('acmedetail');
    expect(domainName('acme.square.site')).toBe('acme');
    expect(domainName('square.site')).toBe('square');
  });

  it('leak-check finds the reference\'s words, name, domain and brand colors in our files, and ignores generic labels', () => {
    const cap = {
      manifest: { source: { kind: 'url', url: 'https://www.shinyridesdetail.com/' } },
      viewports: [{
        outlineData: {
          page: { title: 'Shiny Rides Detail | Mobile Detailing in Springfield' },
          sections: [
            { kind: 'hero', bg: '#7a1fd1', headings: [{ sample: 'We Bring The Showroom To Your Driveway Every Single Ti' }] },
            { kind: 'services', bg: '#ffffff', headings: [{ sample: 'Our Services' }] },
          ],
          type: { eyebrow: { sample: 'WHAT WE DO' } },
          buttons: [{ sample: 'Book now', fill: '#7a1fd1' }, { sample: 'Claim your shine day', fill: '#111111' }],
          nav: { bg: '#0f0f0f' },
          colorRoles: { buttonFill: '#7A1FD1' },
        },
      }],
    };
    const kinds = leakNeedles(cap).map((n) => `${n.kind}:${n.value}`);
    expect(kinds).toEqual(expect.arrayContaining([
      'domain:shinyridesdetail.com', 'name:shinyridesdetail', 'name:Shiny Rides Detail', 'name:Mobile Detailing in Springfield',
      'text:We Bring The Showroom To Your Driveway Every Single Ti', 'text:Claim your shine day', 'color:#7a1fd1',
    ]));
    expect(kinds.some((k) => /Our Services|Book now|WHAT WE DO|#ffffff|#111111|#0f0f0f/.test(k))).toBe(false);

    const files = {
      '/r/src/components/preview/templates/custom/Replica0A1B2C3D.jsx': "const h = 'We bring the showroom to your driveway, every time';\nconst b = 'Book now';",
      '/r/src/data/templates.js': "  detailing_sporty: {\n    colors: { accent: '#7a1fd1' },\n  },\n  replica_0a1b2c3d: {\n    label: 'Exact replica',\n    colors: { accent: '#7A1FD1' },\n  },\n",
      '/r/notes.md': 'Modeled on shinyridesdetail.com, the Shiny Rides Detail site.',
      '/r/clean.jsx': "const t = 'Acme Mobile Detail'; const c = 'Book now';",
      '/r/short.css': '.a{color:#e0e} .b{color:#7a1}',
    };
    const { hits } = leakCheck({ capture: cap, files: Object.keys(files), templateId: 'replica_0a1b2c3d', read: (f) => files[f] });
    const by = (f) => hits.filter((h) => h.file === f).map((h) => h.kind).sort();
    expect(by('/r/src/components/preview/templates/custom/Replica0A1B2C3D.jsx')).toEqual(['text']);
    // The other template's color is its own; the replica's entry copied the reference's.
    expect(by('/r/src/data/templates.js')).toEqual(['color']);
    // The domain, its name, the title's name and its first two words.
    expect(by('/r/notes.md')).toEqual(['domain', 'name', 'name', 'name']);
    expect(by('/r/clean.jsx')).toEqual([]);
    // '#7a1' is not '#7a1fd1' shortened; a shorthand of a doubled hex would be.
    expect(by('/r/short.css')).toEqual([]);
    const red = { manifest: { source: {} }, viewports: [{ outlineData: { colorRoles: { buttonFill: '#cc0000' } } }] };
    expect(leakCheck({ capture: red, files: ['/x.css'], read: () => '.b{background:#C00}' }).hits.map((h) => h.value)).toEqual(['#cc0000']);
    expect(leakCheck({ capture: red, files: ['/x.css'], read: () => '.b{background:#c00a}' }).hits).toEqual([]);
    expect(leakCheck({ capture: { manifest: { source: { kind: 'image' } }, viewports: [{ outlineData: null }] }, files: [], read: () => '' }).needles).toBe(0);
  });

  it('leak-check finds a name hidden in identifiers and file names, and skips trade-only title parts', () => {
    const cap = {
      manifest: { source: { kind: 'url', url: 'https://acme-shine.wixsite.com/home' } },
      viewports: [{ outlineData: { page: { title: 'Home | Mobile Detailing & Ceramic Coating | Shiny Rides Detail Co' } } }],
    };
    const needles = leakNeedles(cap).map((n) => `${n.kind}:${norm(n.value)}`);
    // A site builder's domain names the business by its first label.
    expect(needles).toEqual(expect.arrayContaining(['domain:acme shine wixsite com', 'name:acme shine', 'name:shiny rides detail co', 'name:shiny rides']));
    expect(needles.some((n) => /mobile detailing|^name:home$|wixsite$/.test(n))).toBe(false);

    const files = {
      'src/components/preview/templates/custom/ReplicaShinyRides.jsx': "export default function Hero() { return null; }",
      'src/components/preview/templates/custom/Replica0A1B2C3D.jsx': "const ShinyRidesHero = () => null; const cls = 'shinyrides_card';",
      // Our own business types read "mobile detailing": not their name.
      'src/data/templates.js': "  replica_0a1b2c3d: {\n    businessType: 'mobile_detailing',\n    label: 'Exact replica',\n  },\n",
    };
    const { hits } = leakCheck({ capture: cap, files: Object.keys(files), templateId: 'replica_0a1b2c3d', read: (f) => files[f] });
    const by = (f) => hits.filter((h) => h.file === f).map((h) => h.value);
    expect(by('src/components/preview/templates/custom/ReplicaShinyRides.jsx')).toEqual(['shiny rides']);
    expect(by('src/components/preview/templates/custom/Replica0A1B2C3D.jsx')).toEqual(['shiny rides']);
    expect(by('src/data/templates.js')).toEqual([]);
  });

  it('leak-check reads only the replica\'s own entry in color lists, CRLF or not, and says when it can\'t', () => {
    const cap = { manifest: { source: {} }, viewports: [{ outlineData: { colorRoles: { buttonFill: '#7a1fd1' } } }] };
    // The repo's own files are CRLF: the registry entry must still be found.
    const registry = "export const TEMPLATES = {\r\n  mobile_modern: {\r\n    colors: { accent: '#7a1fd1' },\r\n  },\r\n"
      + "  replica_0a1b2c3d: {\r\n    id: 'replica_0a1b2c3d',\r\n    colors: { bg: '#ffffff', accent: '#7a1fd1' },\r\n    customFor: ['x'],\r\n  },\r\n};\r\n"
      + "export const TEMPLATE_COMPONENT_MAP = {\r\n  replica_0a1b2c3d: () => import('./x.jsx'),\r\n};\r\n";
    expect(registryEntry(registry, 'replica_0a1b2c3d')).toContain("accent: '#7a1fd1' },\n    customFor");
    expect(registryEntry(registry, 'replica_0a1b2c3d')).not.toContain('mobile_modern');
    // The Launch Kit's one-line mirror of every template's colors.
    const looks = "export const TEMPLATE_LOOKS = Object.freeze({\r\n  mobile_modern: look('#ffffff', '#7a1fd1'),\r\n  replica_0a1b2c3d: look('#ffffff', '#123456'),\r\n});\r\n";
    expect(registryEntry(looks, 'replica_0a1b2c3d')).toBe("  replica_0a1b2c3d: look('#ffffff', '#123456'),");
    expect(registryEntry(looks, 'nope_id')).toBe('');

    const read = (f) => ({ 'src/data/templates.js': registry, 'netlify/functions/_lib/kit/inputs.js': looks })[f];
    const files = ['src/data/templates.js', 'netlify/functions/_lib/kit/inputs.js'];
    const r = leakCheck({ capture: cap, files, templateId: 'replica_0a1b2c3d', read });
    expect(r.hits.map((h) => h.file)).toEqual(['src/data/templates.js']);
    expect(r.unchecked).toEqual([]);
    // Not registered under that id (or no --template): the colors there are
    // unchecked, and the check says so instead of passing.
    const missing = leakCheck({ capture: cap, files, templateId: 'replica_other', read });
    expect(missing.hits).toEqual([]);
    expect(missing.unchecked.map((u) => u.file)).toEqual(files);
    expect(leakCheck({ capture: cap, files, read }).unchecked).toHaveLength(2);

    // The Studio's looks (src/data/designLooks.js): one object per look,
    // every template's in one list. Only the replica's own looks count.
    const lookList = "const LOOKS = [\r\n  {\r\n    templateId: 'mobile_modern', slug: 'a', name: 'A',\r\n    palette: { accent: '#7a1fd1' },\r\n  },\r\n"
      + "  {\r\n    templateId: 'replica_0a1b2c3d', slug: 'b', name: 'B', customOnly: true,\r\n    palette: { bg: '#101010', accent: '#123456' },\r\n  },\r\n"
      + "  {\r\n    templateId: 'replica_0a1b2c3d', slug: 'c', name: 'C', customOnly: true,\r\n    palette: { bg: '#fafafa', accent: '#654321' },\r\n  },\r\n];\r\n";
    const own = registryEntry(lookList, 'replica_0a1b2c3d');
    expect(own).toContain("slug: 'b'");
    expect(own).toContain("slug: 'c'");
    expect(own).not.toContain('mobile_modern');
    const lookRead = (f) => ({ 'src/data/designLooks.js': lookList })[f];
    expect(leakCheck({ capture: cap, files: ['src/data/designLooks.js'], templateId: 'replica_0a1b2c3d', read: lookRead }))
      .toMatchObject({ hits: [], unchecked: [] });
    const copied = lookList.replace('#654321', '#7A1FD1');
    expect(leakCheck({ capture: cap, files: ['src/data/designLooks.js'], templateId: 'replica_0a1b2c3d', read: () => copied }).hits)
      .toHaveLength(1);
    // No looks for the replica yet: unchecked, not clean.
    expect(leakCheck({ capture: cap, files: ['src/data/designLooks.js'], templateId: 'replica_other', read: lookRead }).unchecked)
      .toHaveLength(1);
  });

  // The same lookups on the repo's real color lists, so a change to their
  // layout can't quietly turn the replica's color check into an UNCHECKED
  // (or into a check of another template's colors).
  it('finds one template\'s own entry in the real registry, looks and Launch Kit mirror', async () => {
    const { looksFor } = await import('../../src/data/designLooks.js');
    const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const entry = registryEntry(read('src/data/templates.js'), 'mobile_redline');
    expect(entry).toContain("id: 'mobile_redline'");
    expect(entry).toMatch(/colors: \{/);
    expect(entry).not.toMatch(/\bid: '(?!mobile_redline')/);
    const looks = registryEntry(read('src/data/designLooks.js'), 'mobile_redline');
    expect(looks.match(/templateId: '[a-z0-9_]+'/g)).toEqual(looksFor('mobile_redline').map(() => "templateId: 'mobile_redline'"));
    expect(looks).toMatch(/palette: \{ bg: '#/);
    const mirror = registryEntry(read('netlify/functions/_lib/kit/inputs.js'), 'mobile_redline');
    expect(mirror.trim()).toMatch(/^mobile_redline: look\('#[0-9a-f]{6}'/);
    expect(mirror.split('\n')).toHaveLength(1);
  });

  it('reads a project row and picks the replica\'s palette from our side, as Match its layout does', async () => {
    const BRAND = { bg: '#0b0d10', secondary: '#16191f', text: '#f5f5f4', muted: '#a8a29e', accent: '#e11d2e' };
    const mcp = { result: `<untrusted-data-ab12>\n${JSON.stringify([{ id: 'p1', form: { colorMode: 'mine', colors: ['#1D4ED8'] }, design: { templateId: 'mechanic_garage', levers: { palette: {} } } }])}\n</untrusted-data-ab12>` };
    const project = parseProjectFile(JSON.stringify(mcp));
    expect(project).toMatchObject({ id: 'p1', form: { colorMode: 'mine' }, design: { templateId: 'mechanic_garage' } });

    // Brand color as the accent on the chosen template's colors.
    const fromBrandColors = await replicaPalette(project);
    expect(fromBrandColors).toMatchObject({ ok: true, from: 'brandColors', templateId: 'mechanic_garage' });
    expect(fromBrandColors.palette.bg).toBe('#1a1a1a');
    expect(fromBrandColors.reason).toMatch(/never used/);
    // The ready brand system beats brand colors; a full Studio palette beats both.
    const brand = { ...project, design: { ...project.design, brand: { status: 'ready', brand: { palette: BRAND } } } };
    expect((await replicaPalette(brand))).toMatchObject({ ok: true, from: 'brand', palette: { bg: BRAND.bg, accent: BRAND.accent } });
    const studio = { bg: '#ffffff', secondary: '#f3f4f6', text: '#111827', muted: '#4b5563', accent: '#0f766e' };
    const withStudio = { ...brand, design: { ...brand.design, levers: { palette: studio } } };
    const kept = await replicaPalette(withStudio);
    expect(kept).toMatchObject({ ok: true, from: 'studio', palette: studio, repairs: [] });
    expect(kept).not.toHaveProperty('picked');
    // Whatever it picks passes the registry's own check.
    for (const r of [fromBrandColors, await replicaPalette(brand), kept]) expectRegistrySafe(r.palette);
    // "Use their brand color" turned off in the saved design: the template's
    // own colors, as Match its layout picks them (no page toggle here: the
    // replica is built from what was saved).
    const brandOff = await replicaPalette({ ...project, design: { ...project.design, useBrand: false } });
    expect(brandOff).toMatchObject({ ok: true, from: 'template', templateId: 'mechanic_garage' });
    expect(brandOff.palette.accent).not.toBe('#1d4ed8');
    expect(brandOff.reason).toMatch(/"Use their brand color" is off/);
    expectRegistrySafe(brandOff.palette);
    expect((await replicaPalette({ ...project, design: { ...project.design, useBrand: true } })).palette).toEqual(fromBrandColors.palette);
    // Nothing on our side (no Studio, brand or usable template): refuse.
    const none = await replicaPalette({ id: 'p2', form: {}, design: {} });
    expect(none.ok).toBe(false);
    expect(none.reason).toMatch(/Never take the colors from the reference/);
    expect(() => parseProjectFile('[]')).toThrow(/exactly one/);
  });

  it('repairs a low-contrast Studio palette so the registry entry passes kit/theme.test.js', async () => {
    // Light cards on a near-black page, as an admin might set them in the
    // Studio (which keeps a full palette exactly as set): no text color
    // reads 4.5:1 on both, deriveTheme keeps the page readable, so this
    // registry entry would fail theme.test.js as is.
    const split = { bg: '#111111', secondary: '#f5f5f5', text: '#ffffff', muted: '#999999', accent: '#e53e3e' };
    const failing = registryFailures(split, kit);
    expect(failing.map((f) => f.pair)).toEqual(['text on secondary', 'muted on secondary', 'accent text on secondary']);
    for (const f of failing) expect(f.ratio).toBeLessThan(4.5);

    const project = { id: 'p3', form: {}, design: { templateId: 'mechanic_garage', levers: { palette: split } } };
    const r = await replicaPalette(project);
    expect(r).toMatchObject({ ok: true, from: 'studio', picked: split });
    expect(r.reason).toMatch(/Repaired for the registry \(kit\/theme\.test\.js\): secondary\./);
    // Not "Kept": the card color changed.
    expect(r.reason).toMatch(/^Your Studio palette\. /);
    expectRegistrySafe(r.palette);
    // The card color moves toward the page until the customer's own text
    // and muted read on it: bg, accent, text and muted stay theirs.
    expect(r.palette).toMatchObject({ bg: split.bg, accent: split.accent, text: split.text, muted: split.muted });
    expect(r.repairs).toHaveLength(1);
    expect(r.repairs[0]).toMatchObject({ role: 'secondary', from: split.secondary, to: r.palette.secondary });
    expect(r.repairs[0].why).toMatch(/text on secondary was 1\.09:1/);
    expect(kit.isDark(r.palette.secondary)).toBe(true);
    expect(kit.contrastRatio(r.palette.secondary, split.bg)).toBeGreaterThan(1.2); // still a card, not the page
    expect(r.notes.join(' ')).toMatch(/accent-colored text \(links, eyebrows\) is painted #[0-9a-f]{6}/);
  });

  it('sets washed-out text and muted to what the page paints, and keeps a palette that passes', async () => {
    // Pale text and muted on white with a pale yellow accent: the registry
    // test would pass (deriveTheme repairs them on the page), but the
    // swatches would not be the colors the site shows.
    const pale = { bg: '#ffffff', secondary: '#f4f4f5', text: '#cbd5e1', muted: '#e2e8f0', accent: '#fde047' };
    expect(registryFailures(pale, kit)).toEqual([]);
    const { palette, repairs, notes, failures } = registrySafePalette(pale, kit);
    expect(failures).toEqual([]);
    expect(repairs.map((x) => x.role)).toEqual(['text', 'muted']);
    expect(repairs[0]).toMatchObject({ from: pale.text, to: palette.text });
    expect(repairs[0].why).toMatch(/needs 4\.5:1 on both/);
    expect(palette).toMatchObject({ bg: pale.bg, secondary: pale.secondary, accent: pale.accent });
    expectRegistrySafe(palette);
    // Not repaired (the accent is the customer's pick), but said.
    expect(notes.join(' ')).toMatch(/stands only [\d.]+:1 off bg/);

    const fine = { bg: '#FFFFFF', secondary: '#F3F4F6', text: '#111827', muted: '#4B5563', accent: '#0F766E' };
    expect(registrySafePalette(fine, kit)).toEqual({
      palette: Object.fromEntries(Object.entries(fine).map(([k, v]) => [k, v.toLowerCase()])), repairs: [], notes: [], failures: [],
    });

    // `palette --colors`: the same check for a palette chosen by hand.
    const given = await givenPalette(pale);
    expect(given).toMatchObject({ ok: true, from: 'given', picked: pale, palette });
    expect(await givenPalette(parseColors(JSON.stringify(fine)))).not.toHaveProperty('picked');
  });

  it('builds a review page that escapes text, links the tiles relatively and states the rule', () => {
    const dir = '/tmp/review';
    const ref = { dir: '/tmp/review/ref' };
    const rep = { dir: '/tmp/review/rep' };
    const refVp = { name: 'desktop', width: 1440, pageHeight: 1800, tiles: [{ file: 'desktop/tile-000.png', y: 0 }, { file: 'desktop/tile-001.png', y: 900 }] };
    const repVp = { name: 'desktop', width: 1440, pageHeight: null, tiles: [{ file: 'desktop/tile-000.png', y: null }] };
    const rows = outlineDiff(outline(), outline());
    const { html, pageWidth } = buildCompareHtml({
      title: 'Joe\'s <Shop>', viewport: 'desktop', ref, rep, refVp, repVp, outDir: dir, rows, pairs: sectionPairs(outline(), outline()), score: scoreOf(rows),
    });
    expect(pageWidth).toBe(720 * 2 + 24 * 3);
    expect(html).toContain('Joe&#39;s &lt;Shop&gt;');
    expect(html).toContain('src="ref/desktop/tile-001.png" alt="" style="top:450px;width:720px"');
    expect(html).toContain('class="frame flow"');
    expect(html).toContain(REVIEW_NOTE.replace(/'/g, '&#39;'));
  });
});

describe.skipIf(!CHROME || !RUN_CHROME)('capture + compare in headless Chrome (local pages only)', () => {
  let work;
  let server;
  let port;
  let refCapture;
  const hits = [];

  beforeAll(async () => {
    work = mkdtempSync(path.join(tmpdir(), 'replica-e2e-'));
    // Never answers /slow*: a remote font or stylesheet host that hangs.
    server = createServer((req, res) => {
      hits.push(req.url);
      if (req.url.startsWith('/slow')) return;
      res.writeHead(404).end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
    const slow = `<link rel="stylesheet" href="http://127.0.0.1:${port}/slow.css">
<style>@font-face{font-family:'Slow Display';src:url(http://127.0.0.1:${port}/slow-font.woff2) format('woff2')}</style>`;
    writeFileSync(path.join(work, 'reference.html'), samplePage({ head: slow }));
    // The "replica": same layout, other colors, square-ish buttons, and the
    // remote assets a published page loads (offline: never fetched).
    writeFileSync(path.join(work, 'replica.html'), samplePage({
      accent: '#1d4ed8',
      dark: '#0b1b33',
      buttonRadius: '8px',
      head: '<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"><script src="https://cdn.tailwindcss.com"></script>',
    }));
  }, 30000);

  afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('captures a page whose font and stylesheet hosts never answer, within the deadlines', async () => {
    const started = Date.now();
    refCapture = path.join(work, 'ref');
    const m = await capture(path.join(work, 'reference.html'), {
      out: refCapture, fontTimeoutMs: 800, assetTimeoutMs: 1200, timeoutMs: 15000,
    });
    expect(Date.now() - started).toBeLessThan(60000);
    expect(hits).toEqual(expect.arrayContaining(['/slow.css', '/slow-font.woff2']));
    expect(m.viewports.map((v) => v.name)).toEqual(['desktop', 'phone']);

    const desktop = m.viewports[0];
    const failed = desktop.requests.failed.map((f) => [new URL(f.url).pathname, f.reason]);
    expect(failed).toEqual(expect.arrayContaining([['/slow.css', 'timeout 1200 ms'], ['/slow-font.woff2', 'timeout 800 ms']]));
    expect(desktop.tiles.length).toBeGreaterThanOrEqual(2);
    expect(desktop.tiles[0].y).toBe(0);
    const last = desktop.tiles[desktop.tiles.length - 1];
    expect(last.y + desktop.height).toBeGreaterThanOrEqual(desktop.pageHeight);
    expect(pngSize(path.join(refCapture, desktop.tiles[0].file))).toEqual({ width: 1440, height: 900 });
    expect(pngSize(path.join(refCapture, m.viewports[1].tiles[0].file))).toEqual({ width: 390, height: 844 });

    const o = JSON.parse(readFileSync(path.join(refCapture, desktop.outline), 'utf8'));
    expect(o._note).toMatch(/Never copy/);
    expect(o.nav).toMatchObject({ found: true, position: 'sticky', h: 72, phone: true, cta: true, logo: { place: 'left' } });
    expect(o.sections.map((s) => s.kind)).toEqual(['hero', 'services', 'about', 'reviews', 'contact', 'footer']);
    expect(o.sections.map((s) => s.idHint)).toEqual(['hero', 'services', 'about', 'testimonials', 'cta', null]);
    expect(o.sections[0]).toMatchObject({ align: 'center', dark: true });
    expect(o.sections[1].columns).toBe(3);
    expect(o.type.h1).toMatchObject({ size: 64, weight: 600, transform: 'uppercase', family: 'Slow Display' });
    expect(o.type.eyebrow).toMatchObject({ size: 13, transform: 'uppercase' });
    expect(o.buttons[0]).toMatchObject({ filled: true, radius: 999, transform: 'uppercase' });
    expect(o.cards).toMatchObject({ count: 3, perRow: 3, radius: 16, border: true });
    expect(o.spacing.sectionPadMedian).toBe(96);
    expect(o.spacing.contentWidths[0].value).toBe(1140);
    expect(o.footer.columns).toBe(4);

    const phone = JSON.parse(readFileSync(path.join(refCapture, m.viewports[1].outline), 'utf8'));
    expect(phone.sections[1].columns).toBe(1);
    expect(phone.type.h1.size).toBe(40);
  }, 120000);

  it('compares the reference with a replica page captured offline, desktop and phone', async () => {
    expect(refCapture).toBeTruthy();
    const out = path.join(work, 'review');
    mkdirSync(out, { recursive: true });
    const report = await compare({
      reference: refCapture, replica: path.join(work, 'replica.html'), out, title: 'Sample project', offline: true,
    });

    const repManifest = loadCapture(path.join(out, 'replica-capture')).manifest;
    const repFailed = repManifest.viewports[0].requests.failed.map((f) => [new URL(f.url).hostname, f.reason]);
    expect(repFailed).toContainEqual(['fonts.googleapis.com', 'offline']);
    if (existsSync(path.join(REPO_ROOT, 'node_modules/tailwindcss/lib/css/preflight.css'))) {
      expect(repManifest.viewports[0].requests.substituted).toContainEqual(expect.objectContaining({ with: 'tailwind-preflight' }));
    }

    expect(report.viewports.map((v) => v.name)).toEqual(['desktop', 'phone']);
    const desktop = report.viewports[0];
    expect(desktop.score.verdict).toBe('close');
    expect(desktop.rows.find((r) => r.metric === 'Button shape')).toMatchObject({ reference: 'pill', replica: 'rounded', ok: false });
    expect(desktop.sections.map((p) => p.replica?.kind)).toEqual(['hero', 'services', 'about', 'reviews', 'contact', 'footer']);
    expect(pngSize(path.join(out, desktop.images[0])).width).toBe(720 * 2 + 24 * 3);
    expect(pngSize(path.join(out, report.viewports[1].images[0])).width).toBe(390 * 2 + 24 * 3);
    expect(readFileSync(path.join(out, 'report.md'), 'utf8')).toContain('never go into the replica');
    const html = readFileSync(path.join(out, 'compare-desktop.html'), 'utf8');
    expect(html).toContain('../ref/desktop/tile-000.png');
    expect(html).toContain('replica-capture/desktop/tile-000.png');

    // This "replica" reuses the reference's words: leak-check must say so.
    const { hits } = leakCheck({ capture: loadCapture(refCapture), files: [path.join(work, 'replica.html')] });
    // Text samples are what the page shows (here uppercased by CSS).
    expect(hits.map((h) => h.value.toLowerCase())).toEqual(expect.arrayContaining(['sample headline here', 'sample shop']));
  }, 180000);

  it('warns when the page scrolls an inner box instead of the window', async () => {
    writeFileSync(path.join(work, 'inner.html'), '<!doctype html><html><head><style>html,body{margin:0;height:100%;overflow:hidden}'
      + '.s{height:100vh;overflow-y:auto}.c{height:4000px}</style></head><body><div class="s"><div class="c"><h1>Sample</h1></div></div></body></html>');
    const m = await capture(path.join(work, 'inner.html'), { out: path.join(work, 'inner'), viewports: parseViewports('desktop'), offline: true });
    expect(m.viewports[0].tiles).toHaveLength(1);
    expect(m.viewports[0].warnings[0]).toMatch(/inner box/);
  }, 60000);

  it('compares against a screenshot reference by eye (no outline)', async () => {
    const shots = path.join(work, 'shots');
    captureImages([{ viewport: 'desktop', file: path.join(refCapture, 'desktop/tile-000.png') }], { out: shots });
    const out = path.join(work, 'review-shot');
    const report = await compare({ reference: shots, replica: path.join(work, 'review/replica-capture'), out });
    expect(report.viewports.map((v) => v.name)).toEqual(['desktop']);
    expect(report.viewports[0].rows).toEqual([]);
    expect(report.viewports[0].score.verdict).toBe('no layout data');
    expect(pngSize(path.join(out, 'compare-desktop.png')).width).toBe(1512);
  }, 120000);
});

describe('compare.mjs render', () => {
  it('renders a fixture on a template as the published page, without live widgets or the free bar', async () => {
    const { FIXTURES } = await import('../../src/components/preview/templates/__fixtures__/businesses.js');
    const html = await renderReplica({ row: fixtureRow(FIXTURES.full), templateId: 'mobile_redline', colors: { accent: '#1d4ed8' } });
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('data-section="hero"');
    expect(html).toContain('#1d4ed8');
    expect(html).not.toMatch(/<script[^>]+scheduler\.js/);
    expect(html).not.toMatch(/<body[^>]*acg-has-bar/);
    await expect(renderReplica({ row: fixtureRow(FIXTURES.full), templateId: 'no_such_template' })).rejects.toThrow(/not registered/);
  }, 120000);

  it('keeps its outputs out of the repo', () => {
    expect(HERE.startsWith(REPO_ROOT)).toBe(true);
    expect(() => assertOutsideRepo(path.join(HERE, 'out'))).toThrow(/inside the repo/);
  });
});
