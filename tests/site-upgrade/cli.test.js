// The site-upgrade CLI end to end (scripts/site-upgrade/cli.mjs run()):
// real page builds (Vite, as `npm run site:upgrade` runs them), an
// in-memory R2 bucket (r2Fakes.js), the live sites served from that bucket,
// and a fake production app serving this checkout's own build for the
// guard. Nothing leaves the process.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeR2 } from '../functions/r2Fakes.js';

vi.mock('../../src/lib/supabase.js', () => import('../../scripts/site-upgrade/supabase-stub.js'));
// This test tree is not a mirror of one commit (source.test covers that
// check): here it stands for one.
const COMMIT = 'c0ffee'.padEnd(40, '0');
const pin = vi.hoisted(() => ({ pinned: true }));
vi.mock('../../scripts/site-upgrade/source.js', async (orig) => ({
  ...(await orig()),
  sourceState: () => (pin.pinned
    ? { pinned: true, commit: 'c0ffee'.padEnd(40, '0'), files: 1, problems: [] }
    : { pinned: false, commit: null, files: 0, problems: ['not a mirror of one commit (test)'] }),
}));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP = 'https://sitebuilder.autocaregenius.com';
const STORAGE = 'https://ktnouhjikmlxlbxcxyif.supabase.co/storage/v1/object/public/site-images/0b1c2d3e';
const OWNER = '0b1c2d3e-0000-4000-8000-000000000001';
const ADMIN = 'adadadad-0000-4000-8000-000000000001';
const A = 'a1a1a1a1-0000-4000-8000-000000000001';
const B = 'b2b2b2b2-0000-4000-8000-000000000002';
const ACCT = 'ab'.repeat(16);
const TOKEN = 'cf-SECRET-token-must-never-print-0123456789';
const BY = ['--by', 'ops@acg.test'];

let run;
let render;
let FIXTURES;
let SKIP;
let VERIFY;
let BUILT;

beforeAll(async () => {
  // render.js in this process, as the production app builds pages (for the
  // live "old" pages and the expected new ones).
  vi.stubGlobal('window', { location: { origin: APP } });
  render = await import('../../scripts/site-upgrade/render.js');
  vi.unstubAllGlobals();
  ({ FIXTURES } = await import('../../src/components/preview/templates/__fixtures__/businesses.js'));
  const su = await import('../../src/lib/siteUpgrade.js');
  SKIP = su.UPGRADE_MANUAL_SKIP[0].siteId;
  ({ VERIFY } = await import('../../scripts/site-upgrade/ops.js'));
  // The production app once PR #10 is deployed: this checkout's build.
  BUILT = await (await import('../../scripts/site-upgrade/guard.js')).localBuild(ROOT);
  ({ run } = await import('../../scripts/site-upgrade/cli.mjs'));
}, 120000);

const images = { hero: `${STORAGE}/hero.jpg`, about: `${STORAGE}/about.jpg`, logo: `${STORAGE}/logo.png`, gallery0: `${STORAGE}/g0.jpg` };
function site(id, slug, templateId, extra = {}) {
  const fx = FIXTURES.full;
  return {
    id, user_id: OWNER, business_info: fx.businessInfo, template_id: templateId, slug,
    published_url: `https://${slug}.autocaregeniushub.com`, custom_domain: null, custom_domain_status: null, site_type: 'website',
    scheduler_enabled: true, widget_config_ids: [], created_at: '2026-05-01T12:00:00+00:00',
    generated_content: { ...fx.generatedCopy, _images: images, _customColors: fx.customColors, _customFonts: fx.customFonts },
    published_at: null, updated_at: '2026-10-01T00:00:00+00:00', fingerprint: createHash('md5').update(id).digest('hex'), omittedImages: [], ...extra,
  };
}
const plan = (status) => ({ id: OWNER, is_super_admin: false, scheduler_enabled: false, subscription_status: status, subscription_ends_at: null, stripe_first_failed_payment_at: null });
const tabRow = (s) => Object.fromEntries(['id', 'user_id', 'business_info', 'template_id', 'slug', 'published_url', 'custom_domain', 'custom_domain_status', 'site_type', 'scheduler_enabled', 'widget_config_ids', 'created_at', 'generated_content'].map((c) => [c, s[c]]));
// A page published before the release has no new-design runtime marker.
const oldDesign = (html) => html.replaceAll('data-acg-scrolled', 'data-old-scrolled');

let dir;
let r2;
let out;
let stdout;
let sites;
let oldPages;
let newPages;
let exportedAt;

function inputsFile(extra = {}) {
  const doc = {
    format: 'acg-site-upgrade-inputs/2', exportedAt, publishedAtTracked: true,
    sites, owners: { [OWNER]: plan('active') }, widgets: { [OWNER]: [] },
    slugRows: sites.map((s) => ({ id: s.id, slug: s.slug })), admins: [{ id: ADMIN, email: 'ops@acg.test' }], ...extra,
  };
  const f = path.join(dir, `inputs-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(f, JSON.stringify([{ inputs: doc }]));
  return f;
}

// The saved result of the fresh-check SQL: each site's fingerprint now.
function freshFile({ checkedAt = new Date().toISOString(), current = {} } = {}) {
  const rows = sites.map((s) => ({ id: s.id, expected: s.fingerprint, current: s.id in current ? current[s.id] : s.fingerprint }));
  const f = path.join(dir, `fresh-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(f, JSON.stringify([{ fresh: { format: 'acg-site-upgrade-fresh/1', checkedAt, sites: rows } }]));
  return f;
}

function envFile({ empty = false } = {}) {
  const f = path.join(dir, 'site-upgrade.env');
  writeFileSync(f, empty ? 'CLOUDFLARE_ACCOUNT_ID=\nCLOUDFLARE_API_TOKEN=\n' : `CLOUDFLARE_ACCOUNT_ID=${ACCT}\nCLOUDFLARE_API_TOKEN=${TOKEN}\n`);
  chmodSync(f, 0o600);
  process.env.ACG_UPGRADE_ENV = f;
}

// The production app, the live sites (served from the bucket) and R2.
function world({ guardPass = true, publicStale = false } = {}) {
  const local = (f) => readFileSync(path.join(ROOT, 'public', f), 'utf8').replace(/\r\n/g, '\n');
  const entry = BUILT.chunks.find((c) => c.isEntry);
  const app = {
    '/': `<!DOCTYPE html><script type="module" crossorigin src="/${entry.fileName}"></script>`,
    '/scheduler.js': guardPass ? local('scheduler.js') : '/* the old scheduler */',
    '/contact-form.js': local('contact-form.js'),
  };
  for (const c of BUILT.chunks) app[`/${c.fileName}`] = guardPass ? c.code : 'const r="the old app";';
  const firstPages = new Map(oldPages);
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.cloudflare.com') return r2.fetch(url, init);
    if (u.origin === APP) return app[u.pathname] == null ? new Response('nf', { status: 404 }) : new Response(app[u.pathname], { status: 200 });
    if (u.hostname.endsWith('.autocaregeniushub.com')) {
      const slug = u.hostname.split('.')[0];
      const body = publicStale ? firstPages.get(slug) : r2.store.get(`${slug}/index.html`);
      return body == null ? new Response('Not found', { status: 404 }) : new Response(body, { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

const puts = () => r2.calls.filter((c) => c[0] === 'PUT').map((c) => c[1]);
const said = () => stdout.join('');
async function cli(...argv) {
  return run([...argv, '--out', path.join(out, `run-${Math.random().toString(36).slice(2)}`)]);
}
// Everything a real publish needs, for these sites.
const publishArgs = (sitesArg = 'alpha') => ['publish', '--inputs', inputsFile(), '--fresh', freshFile(), '--sites', sitesArg, ...BY, '--deployed-commit', COMMIT.slice(0, 12), '--confirm', 'PUBLISH'];

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'acg-cli-'));
  out = mkdtempSync(path.join(tmpdir(), 'acg-cli-out-'));
  exportedAt = new Date(Date.now() - 60e3).toISOString();
  pin.pinned = true;
  sites = [site(A, 'alpha', 'mobile_chrome'), site(B, 'beta', 'detailing_sporty'), site(SKIP, 'skipme', 'mobile_chrome')];
  oldPages = new Map();
  newPages = new Map();
  const objects = {};
  for (const s of sites) {
    // Live now: the same draft built for a free owner (with the "Powered
    // by" bar) before the release; the new page is the Pro owner's. Same
    // content, so ready.
    const old = await render.buildSitePage({ row: tabRow(s), owner: plan(null), widgets: [] });
    const neu = await render.buildSitePage({ row: tabRow(s), owner: plan('active'), widgets: [] });
    objects[`${s.slug}/index.html`] = oldDesign(old.newHtml);
    objects[`${s.slug}/book/index.html`] = old.bookingPageHtml;
    oldPages.set(s.slug, oldDesign(old.newHtml));
    newPages.set(s.slug, neu);
  }
  r2 = fakeR2(objects);
  stdout = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => { stdout.push(String(chunk)); return true; });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => { stdout.push(String(chunk)); return true; });
  delete process.env.ACG_UPGRADE_ENV;
}, 60000);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ACG_UPGRADE_ENV;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
});

function filesUnder(d) {
  return readdirSync(d).flatMap((f) => {
    const p = path.join(d, f);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

// When R2 last wrote each key (the listing's last_modified), per test.
function lastModified(times) {
  const base = r2.fetch.getMockImplementation();
  r2.fetch.mockImplementation(async (url, init = {}) => {
    const res = await base(url, init);
    if (!new URL(url).searchParams.has('prefix')) return res;
    const body = await res.json();
    for (const o of body.result) if (times[o.key]) o.last_modified = times[o.key];
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

describe('plan', () => {
  it('without a token: public GETs only, says holds were not checked, writes nothing', async () => {
    process.env.ACG_UPGRADE_ENV = path.join(dir, 'missing.env');
    world();
    const o = path.join(out, 'p1');
    expect(await run(['plan', '--inputs', inputsFile(), '--out', o])).toBe(0);
    expect(r2.calls).toEqual([]);
    expect(said()).toMatch(/NO R2 TOKEN/);
    const report = JSON.parse(readFileSync(path.join(o, 'report.json'), 'utf8'));
    const by = Object.fromEntries(report.sites.map((s) => [s.slug, s]));
    expect(by.alpha).toMatchObject({ status: 'ready', hold: 'unchecked', liveSource: 'public', isPro: true });
    expect(by.skipme.status).toBe('flagged');
    expect(by.skipme.reasons[0].code).toBe('manual_skip');
    expect(report.guard.ok).toBe(true);
    expect(report.source).toEqual({ pinned: true, commit: COMMIT });
    const files = readdirSync(path.join(o, 'sites', `alpha--${A.slice(0, 8)}`)).sort();
    expect(files).toEqual(['book.html', 'live.html', 'new.html', 'summary.txt']);
    expect(readFileSync(path.join(o, 'sites', `alpha--${A.slice(0, 8)}`, 'new.html'), 'utf8')).toBe(newPages.get('alpha').newHtml);
    expect(readFileSync(path.join(o, 'report.md'), 'utf8')).toMatch(/HOLDS NOT CHECKED/);
    // The fresh check for the ready sites, ready to run before a publish.
    const fresh = readFileSync(path.join(o, 'fresh-check.sql'), 'utf8');
    expect(fresh).toContain(`('${A}'::uuid, '${sites[0].fingerprint}')`);
    expect(fresh).not.toContain(SKIP);
  }, 60000);

  it('treats an env template with empty values as no token', async () => {
    envFile({ empty: true });
    world();
    expect(await cli('plan', '--inputs', inputsFile())).toBe(0);
    expect(r2.calls).toEqual([]);
    expect(said()).toMatch(/no token yet/);
  }, 60000);

  it('with the token: reads R2 and flags a site on hold; still writes nothing', async () => {
    envFile();
    r2.store.set(`_backups/${A}/hold.json`, JSON.stringify({ held: true, reason: 'manual', note: 'owner asked', at: '2026-10-04T00:00:00.000Z' }));
    world();
    const o = path.join(out, 'p2');
    expect(await run(['plan', '--inputs', inputsFile(), '--out', o])).toBe(0);
    expect(puts()).toEqual([]);
    const report = JSON.parse(readFileSync(path.join(o, 'report.json'), 'utf8'));
    const alpha = report.sites.find((s) => s.slug === 'alpha');
    expect(alpha.status).toBe('flagged');
    expect(alpha.reasons.map((r) => r.code)).toContain('on_hold');
    expect(alpha.liveSource).toBe('r2');
    expect(said()).not.toContain(TOKEN);
  }, 60000);

  // luxurious-auto-detailing: the export leaves the draft's inline photos
  // out; the live page has the same ones, so the page is built from them.
  it('builds a draft whose inline photos the export left out from the live page\'s copies', async () => {
    process.env.ACG_UPGRADE_ENV = path.join(dir, 'missing.env');
    const hero = `data:image/jpeg;base64,/9j/${'Q'.repeat(4000)}AB==`;
    const md5 = createHash('md5').update(hero).digest('hex');
    const full = site(A, 'alpha', 'mobile_chrome', { generated_content: { ...sites[0].generated_content, _images: { ...images, hero } } });
    const livePage = oldDesign((await render.buildSitePage({ row: tabRow(full), owner: plan(null), widgets: [] })).newHtml);
    const tabPage = (await render.buildSitePage({ row: tabRow(full), owner: plan('active'), widgets: [] })).newHtml;
    r2.store.set('alpha/index.html', livePage);
    sites[0] = { ...full, generated_content: { ...full.generated_content, _images: { ...images, hero: `data:image/jpeg;acg-omitted;bytes=${hero.length};md5=${md5},` } }, omittedImages: [{ key: 'hero', bytes: hero.length, md5 }] };
    world();
    const o = path.join(out, 'p3');
    expect(await run(['plan', '--inputs', inputsFile(), '--sites', 'alpha', '--out', o])).toBe(0);
    expect(readFileSync(path.join(o, 'sites', `alpha--${A.slice(0, 8)}`, 'new.html'), 'utf8')).toBe(tabPage);
    const [row] = JSON.parse(readFileSync(path.join(o, 'report.json'), 'utf8')).sites;
    expect(row).toMatchObject({ rehydratedImages: 1, omittedImages: 0, status: 'flagged' });
    // The tab's verdict for this draft: only that it holds an inline photo.
    expect(row.reasons.map((r) => r.code)).toEqual(['draft_inline_images']);
    expect(row.blocks).toEqual([]);
  }, 60000);
});

describe('publish refuses, and writes nothing', () => {
  it.each([
    ['without --confirm PUBLISH', (a) => a.filter((x) => x !== '--confirm' && x !== 'PUBLISH'), {}, /--confirm PUBLISH/],
    ['before production runs this code', (a) => a, { guardPass: false }, /Production does not run this checkout/],
    ['with stale inputs', (a) => a, { stale: true }, /minutes old/],
    ['with a --max-input-age that is not a number of minutes', (a) => [...a, '--max-input-age', '30m'], { stale: 5 }, /--max-input-age must be a number of minutes from 1 to 30/],
    ['with a --max-input-age above 30', (a) => [...a, '--max-input-age', '600'], {}, /--max-input-age must be/],
    ['before the published_at migration', (a) => a, { untracked: true }, /20261004_sites_published_at/],
    ['a site on the manual check list', () => publishArgs('alpha,skipme'), {}, /not ready; nothing was published/],
    ['a site already on the new design', (a) => a, { upgraded: true }, /already on the new design/],
    ['without --by', (a) => a.filter((x) => !BY.includes(x)), {}, /--by <your super admin email> is required/],
    ['--by someone who is not a super admin', (a) => a.map((x) => (x === 'ops@acg.test' ? 'owner@shop.test' : x)), {}, /not a super admin/],
    ['outside a mirror of one commit', (a) => a, { unpinned: true }, /mirror of the deployed commit/],
    ['when the mirror is not the deployed commit', (a) => a.map((x) => (x === COMMIT.slice(0, 12) ? 'beefbeef' : x)), {}, /production runs beefbeef/],
    ['without --fresh, printing the fresh-check SQL to run', (a) => a.filter((x, i) => x !== '--fresh' && a[i - 1] !== '--fresh'), {}, /needs --fresh/],
    ['with a fresh check older than 10 minutes', (a) => a.map((x, i) => (a[i - 1] === '--fresh' ? freshFile({ checkedAt: new Date(Date.now() - 15 * 60e3).toISOString() }) : x)), {}, /fresh check is 15 minutes old/],
    ['when the owner\'s row, plan or widgets changed since the export', (a) => a.map((x, i) => (a[i - 1] === '--fresh' ? freshFile({ current: { [A]: 'f'.repeat(32) } }) : x)), {}, /changed since the export/],
  ])('%s', async (_, edit, opts, msg) => {
    envFile();
    world({ guardPass: opts.guardPass !== false });
    if (opts.upgraded) sites[0].published_at = '2026-10-03T00:00:00+00:00';
    if (opts.stale) exportedAt = new Date(Date.now() - (opts.stale === true ? 2 : opts.stale) * 3600e3).toISOString();
    if (opts.unpinned) pin.pinned = false;
    const base = publishArgs();
    if (opts.untracked) base[2] = inputsFile({ publishedAtTracked: false });
    expect(await cli(...edit(base))).toBe(2);
    expect(said()).toMatch(msg);
    expect(puts()).toEqual([]);
    expect(r2.store.get('alpha/index.html')).toBe(oldPages.get('alpha'));
  }, 60000);

  it('without the token', async () => {
    process.env.ACG_UPGRADE_ENV = path.join(dir, 'missing.env');
    world();
    expect(await cli(...publishArgs())).toBe(2);
    expect(said()).toMatch(/No R2 token/);
    expect(r2.calls).toEqual([]);
  }, 60000);

  it('prints the fresh-check SQL for the named sites when --fresh is missing', async () => {
    envFile();
    world();
    const a = publishArgs('alpha,beta');
    const i = a.indexOf('--fresh');
    a.splice(i, 2);
    expect(await cli(...a)).toBe(2);
    expect(said()).toContain(`('${A}'::uuid, '${sites[0].fingerprint}'), ('${B}'::uuid, '${sites[1].fingerprint}')`);
    expect(said()).toMatch(/READ-ONLY site-upgrade fresh check/);
  }, 60000);
});

describe('publish', () => {
  it('--dry-run shows every write and sends none; its SQL is commented out', async () => {
    envFile();
    world();
    const o = path.join(out, 'dry');
    expect(await run(['publish', '--inputs', inputsFile(), '--fresh', freshFile(), '--sites', 'alpha', '--deployed-commit', COMMIT, '--dry-run', '--out', o])).toBe(0);
    expect(puts()).toEqual([]);
    const log = readFileSync(path.join(o, 'run.log'), 'utf8');
    expect(log).toMatch(new RegExp(`WOULD WRITE _backups/${A}/[^ ]+-publish-[0-9a-f]{8}/index\\.html`));
    expect(log).toMatch(/WOULD WRITE alpha\/index\.html/);
    expect(log).toMatch(/WOULD WRITE alpha\/book\/index\.html/);
    expect(log).toMatch(/Dry run: nothing was written\. Would publish 1 of 1 site\./);
    expect(r2.store.get('alpha/index.html')).toBe(oldPages.get('alpha'));
    // Nothing a copy of could ever run: every SQL line is a comment.
    const sqlStart = log.indexOf('-- DRY RUN');
    expect(sqlStart).toBeGreaterThan(0);
    const sqlLines = log.slice(sqlStart).split('\n').filter((l) => l && !l.startsWith('Run log:'));
    expect(sqlLines.every((l) => l.startsWith('-- '))).toBe(true);
    const json = JSON.parse(readFileSync(path.join(o, 'run.json'), 'utf8'));
    expect(json.sql.published.split('\n').every((l) => l.startsWith('-- '))).toBe(true);
    expect(json.sql.drift.split('\n').every((l) => l.startsWith('-- '))).toBe(true);
  }, 60000);

  it('--dry-run that a real run would refuse says so, and shows the writes for once it is resolved', async () => {
    envFile();
    world({ guardPass: false });
    const o = path.join(out, 'dry2');
    expect(await run(['publish', '--inputs', inputsFile(), '--sites', 'alpha,skipme', '--dry-run', '--out', o])).toBe(2);
    const log = readFileSync(path.join(o, 'run.log'), 'utf8');
    expect(log).toMatch(/WOULD REFUSE: Production does not run/);
    expect(log).toMatch(/WOULD REFUSE: publish needs --deployed-commit/);
    expect(log).toMatch(/WOULD REFUSE: publish needs --fresh/);
    expect(log).toMatch(/WOULD REFUSE: 1 of 2 named sites are not ready/);
    expect(log).toMatch(/A real run with these arguments would REFUSE \(\d+ reasons above\) and write nothing\. Once they are resolved it would publish 1 of 2 sites/);
    expect(log).not.toMatch(/^update public\.sites/m);
    expect(puts()).toEqual([]);
  }, 60000);

  it('--dry-run without the token works the writes out from the public page and says it would refuse', async () => {
    process.env.ACG_UPGRADE_ENV = path.join(dir, 'missing.env');
    world();
    expect(await cli('publish', '--inputs', inputsFile(), '--sites', 'alpha', '--dry-run')).toBe(2);
    expect(said()).toMatch(/WOULD REFUSE: No R2 token/);
    expect(said()).toMatch(/alpha: WOULD WRITE alpha\/index\.html \(\d+ bytes, sha256 [0-9a-f]{16}\)/);
    expect(said()).toMatch(/alpha: ready, but its hold could not be checked/);
    expect(r2.calls).toEqual([]);
  }, 60000);

  it('backs up, uploads and verifies each site, then prints the SQL; the token never shows', async () => {
    envFile();
    world();
    const o = path.join(out, 'real');
    const a = publishArgs('alpha,beta');
    expect(await run([...a, '--out', o])).toBe(0);
    for (const [slug, id] of [['alpha', A], ['beta', B]]) {
      expect(r2.store.get(`${slug}/index.html`)).toBe(newPages.get(slug).newHtml);
      expect(r2.store.get(`${slug}/book/index.html`)).toBe(newPages.get(slug).bookingPageHtml);
      const backup = [...r2.store.keys()].find((k) => k.startsWith(`_backups/${id}/`) && k.endsWith('/index.html') && !k.includes('/book/'));
      expect(r2.store.get(backup)).toBe(oldPages.get(slug));
      // The admin is recorded as admin-site-upgrade records the signed-in one.
      expect(JSON.parse(r2.store.get(backup.replace(/index\.html$/, 'meta.json')))).toMatchObject({ siteId: id, slug, reason: 'publish', by: { id: ADMIN, email: 'ops@acg.test' } });
    }
    // Same order as admin-site-upgrade's publish: backup first, then upload.
    const alphaPuts = puts().filter((k) => k.includes('alpha') || k.includes(A));
    expect(alphaPuts.map((k) => k.replace(/\d{4}-\d{2}-\d{2}T[^/]+/, 'ID'))).toEqual([
      `_backups/${A}/ID/index.html`, `_backups/${A}/ID/book/index.html`, `_backups/${A}/ID/meta.json`, 'alpha/index.html', 'alpha/book/index.html',
    ]);
    const text = said();
    expect(text).toMatch(new RegExp(`'${A}'::uuid, 'alpha', 'https://alpha\\.autocaregeniushub\\.com', '[0-9T:.\\-]+Z'::timestamptz`));
    // The drift check comes first, then the update.
    expect(text.indexOf('READ-ONLY, run it BEFORE the update')).toBeLessThan(text.indexOf('update public.sites'));
    expect(text).toMatch(/sending alpha\/index\.html/);
    expect(text).not.toContain(TOKEN);
    for (const f of filesUnder(o)) expect(readFileSync(f, 'utf8')).not.toContain(TOKEN);
    expect(existsSync(path.join(o, 'run.json'))).toBe(true);
    // Each site was on disk the moment it was live.
    const records = readFileSync(path.join(o, 'records.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(records.map((r) => r.slug)).toEqual(['alpha', 'beta']);
  }, 120000);

  it('stops at the first failed write; the next site is not touched', async () => {
    envFile();
    world();
    const failing = r2.fetch.getMockImplementation();
    r2.fetch.mockImplementation(async (url, init = {}) => {
      if ((init.method || 'GET') === 'PUT' && decodeURIComponent(new URL(url).pathname.split('/').pop()) === 'alpha/index.html') {
        return new Response('boom', { status: 500 });
      }
      return failing(url, init);
    });
    expect(await cli(...publishArgs('alpha,beta'))).toBe(1);
    expect(said()).toMatch(/STOPPED: alpha: R2 upload failed \(500\)/);
    expect(said()).toMatch(/restore --site alpha --backup \S+-publish-[0-9a-f]{8} --confirm RESTORE/);
    expect(puts().some((k) => k.startsWith('beta/') || k.includes(B))).toBe(false);
    expect(r2.store.get('beta/index.html')).toBe(oldPages.get('beta'));
    expect(said()).not.toMatch(/update public\.sites/);
  }, 120000);

  it('stops when the public URL does not serve the new page', async () => {
    envFile();
    world({ publicStale: true });
    const wait = VERIFY.waitMs;
    VERIFY.waitMs = 1;
    try {
      expect(await cli(...publishArgs('alpha,beta'))).toBe(1);
    } finally {
      VERIFY.waitMs = wait;
    }
    expect(said()).toMatch(/R2 holds the new page but GET https:\/\/alpha\.autocaregeniushub\.com\//);
    expect(r2.store.get('beta/index.html')).toBe(oldPages.get('beta'));
    // alpha is live in R2, so its row is still recorded.
    expect(said()).toMatch(new RegExp(`'${A}'::uuid, 'alpha'`));
  }, 120000);

  // The owner republished after the export (the tab would have re-read the
  // row): the CLI must not put the export's older draft back over it.
  it('does not overwrite a live page published after the export', async () => {
    envFile();
    world();
    lastModified({ 'alpha/index.html': new Date().toISOString() });
    expect(await cli(...publishArgs('alpha,beta'))).toBe(1);
    expect(said()).toMatch(/alpha: not published: the live page was written at .*, after the export/);
    expect(puts()).toEqual([]);
    expect(r2.store.get('alpha/index.html')).toBe(oldPages.get('alpha'));
  }, 120000);

  it('does not overwrite a live page that is already a new-design page, unless asked', async () => {
    envFile();
    world();
    r2.store.set('alpha/index.html', newPages.get('alpha').newHtml.replace('</body>', '<!--owner republish--></body>'));
    expect(await cli(...publishArgs('alpha'))).toBe(1);
    expect(said()).toMatch(/alpha: not published: the live page is already a new-design page/);
    expect(puts()).toEqual([]);
  }, 120000);
});

describe('backups, restore and holds', () => {
  const restoreArgs = (backup, ...more) => ['restore', '--inputs', inputsFile(), '--site', 'alpha', '--backup', backup, ...more];

  it('restores a backup, holds the site and prints the SQL; a held site is refused', async () => {
    envFile();
    world();
    expect(await cli(...publishArgs('alpha'))).toBe(0);
    const backupId = /backup=(\S+-publish-[0-9a-f]{8})/.exec(said())[1];
    stdout.length = 0;
    expect(await cli('backups', '--inputs', inputsFile(), '--site', 'alpha')).toBe(0);
    expect(said()).toContain(backupId);

    expect(await cli(...restoreArgs(backupId, ...BY))).toBe(2);
    expect(await cli(...restoreArgs(backupId, '--confirm', 'RESTORE'))).toBe(2);
    expect(said()).toMatch(/--by <your super admin email> is required/);
    expect(await cli(...restoreArgs(backupId, ...BY, '--confirm', 'RESTORE'))).toBe(0);
    expect(r2.store.get('alpha/index.html')).toBe(oldPages.get('alpha'));
    expect(JSON.parse(r2.store.get(`_backups/${A}/hold.json`))).toMatchObject({ held: true, reason: 'restored', backupId, siteId: A, by: { id: ADMIN, email: 'ops@acg.test' } });
    expect(said()).toMatch(new RegExp(`set published_at = null\\nwhere s.id = '${A}'::uuid and s.slug = 'alpha'`));

    stdout.length = 0;
    expect(await cli(...publishArgs('alpha'))).toBe(2);
    expect(said()).toMatch(/on_hold/);
    expect(await cli('unhold', '--inputs', inputsFile(), '--site', 'alpha', ...BY, '--confirm', 'UNHOLD')).toBe(0);
    expect(JSON.parse(r2.store.get(`_backups/${A}/hold.json`))).toMatchObject({ held: false, reason: 'released' });
    expect(await cli('hold', '--inputs', inputsFile(), '--site', 'alpha', '--note', 'owner on vacation', ...BY, '--confirm', 'HOLD')).toBe(0);
    expect(JSON.parse(r2.store.get(`_backups/${A}/hold.json`))).toMatchObject({ held: true, reason: 'manual', note: 'owner on vacation' });
  }, 120000);

  it('restore --dry-run writes nothing, and a restore never takes another site\'s backup', async () => {
    envFile();
    world();
    const other = '2026-10-01T10-00-00-000Z-publish-0a1b2c3d';
    r2.store.set(`_backups/${A}/${other}/index.html`, oldPages.get('beta'));
    expect(await cli(...restoreArgs(other, '--dry-run'))).toBe(2);
    expect(said()).toMatch(/belongs to another site/);
    const mine = '2026-10-01T11-00-00-000Z-publish-0a1b2c3e';
    r2.store.set(`_backups/${A}/${mine}/index.html`, oldPages.get('alpha'));
    stdout.length = 0;
    expect(await cli(...restoreArgs(mine, '--dry-run'))).toBe(0);
    expect(said()).toMatch(/WOULD WRITE alpha\/index\.html/);
    expect(said()).toMatch(/WOULD WRITE _backups\/[^/]+\/hold\.json/);
    expect(said()).not.toMatch(/^update public\.sites/m);
    expect(puts()).toEqual([]);
  }, 60000);

  it('refuses inputs older than 30 minutes, nothing live, or another site\'s page at the address', async () => {
    envFile();
    world();
    const mine = '2026-10-01T11-00-00-000Z-publish-0a1b2c3e';
    r2.store.set(`_backups/${A}/${mine}/index.html`, oldPages.get('alpha'));
    exportedAt = new Date(Date.now() - 45 * 60e3).toISOString();
    expect(await cli(...restoreArgs(mine, ...BY, '--confirm', 'RESTORE'))).toBe(2);
    expect(said()).toMatch(/45 minutes old \(limit 30\)/);
    exportedAt = new Date().toISOString();
    // Unpublished by its owner since the export.
    r2.store.delete('alpha/index.html');
    expect(await cli(...restoreArgs(mine, ...BY, '--confirm', 'RESTORE'))).toBe(2);
    expect(said()).toMatch(/Nothing is live at alpha/);
    // The address now serves another site's page.
    r2.store.set('alpha/index.html', oldPages.get('beta'));
    expect(await cli(...restoreArgs(mine, ...BY, '--confirm', 'RESTORE'))).toBe(2);
    expect(said()).toMatch(/is another site's/);
    expect(puts()).toEqual([]);
    expect(r2.store.get('alpha/index.html')).toBe(oldPages.get('beta'));
  }, 60000);

  it('a restore cut off after the main page went back: holds the site, prints the SQL, exit 1', async () => {
    envFile();
    world();
    const mine = '2026-10-01T11-00-00-000Z-publish-0a1b2c3e';
    r2.store.set(`_backups/${A}/${mine}/index.html`, oldPages.get('alpha').replace('</body>', '<!--restored--></body>'));
    r2.store.set(`_backups/${A}/${mine}/book/index.html`, newPages.get('alpha').bookingPageHtml);
    const base = r2.fetch.getMockImplementation();
    r2.fetch.mockImplementation(async (url, init = {}) => {
      if ((init.method || 'GET') === 'PUT' && decodeURIComponent(new URL(url).pathname.split('/').pop()) === 'alpha/book/index.html') return new Response('boom', { status: 500 });
      return base(url, init);
    });
    const o = path.join(out, 'partial');
    expect(await run([...restoreArgs(mine, ...BY, '--confirm', 'RESTORE'), '--out', o])).toBe(1);
    expect(r2.store.get('alpha/index.html')).toContain('<!--restored-->');
    expect(JSON.parse(r2.store.get(`_backups/${A}/hold.json`))).toMatchObject({ held: true, reason: 'restored', backupId: mine });
    expect(said()).toMatch(/STOPPED: R2 booking-page restore failed \(500\)/);
    expect(said()).toMatch(/to put it back: restore --site alpha --backup \S+-restore-[0-9a-f]{8} --confirm RESTORE/);
    expect(said()).toMatch(/set published_at = null/);
    expect(JSON.parse(readFileSync(path.join(o, 'run.json'), 'utf8'))).toMatchObject({ partial: expect.stringMatching(/booking-page/) });
  }, 60000);

  it('a restore whose first write fails changed nothing live: exit 1, the safety copy named, no SQL', async () => {
    envFile();
    world();
    const mine = '2026-10-01T11-00-00-000Z-publish-0a1b2c3e';
    r2.store.set(`_backups/${A}/${mine}/index.html`, oldPages.get('alpha').replace('</body>', '<!--restored--></body>'));
    const base = r2.fetch.getMockImplementation();
    r2.fetch.mockImplementation(async (url, init = {}) => {
      if ((init.method || 'GET') === 'PUT' && decodeURIComponent(new URL(url).pathname.split('/').pop()) === 'alpha/index.html') return new Response('boom', { status: 500 });
      return base(url, init);
    });
    expect(await cli(...restoreArgs(mine, ...BY, '--confirm', 'RESTORE'))).toBe(1);
    expect(r2.store.get('alpha/index.html')).toBe(oldPages.get('alpha'));
    expect(r2.store.has(`_backups/${A}/hold.json`)).toBe(false);
    expect(said()).toMatch(/The live page was not changed; a copy of it was saved as backup \S+-restore-[0-9a-f]{8}/);
    expect(said()).not.toMatch(/update public\.sites/);
  }, 60000);
});

describe('arguments', () => {
  it('refuses an unknown command, an unknown flag, and an output folder inside the checkout', async () => {
    world();
    expect(await run(['deploy', '--inputs', inputsFile()])).toBe(2);
    expect(await run(['plan', '--inputs', inputsFile(), '--force'])).toBe(2);
    expect(await run(['plan', '--inputs', inputsFile(), '--out', path.join(ROOT, 'tmp-site-upgrade-out')])).toBe(2);
    expect(said()).toMatch(/inside the app checkout/);
    expect(existsSync(path.join(ROOT, 'tmp-site-upgrade-out'))).toBe(false);
    expect(r2.calls).toEqual([]);
  }, 60000);
});
