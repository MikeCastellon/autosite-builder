// The CLI reads the live side exactly as admin-site-upgrade's `live` action
// answers the Site upgrades tab (same R2 keys, size limits, shared-slug
// check and hold), its publish loop honours a stop request, and its
// restore, which cannot read the sites row as the function does, refuses
// whenever the address is not this site's live page any more.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeR2, fakeDb, post, bodyOf } from '../functions/r2Fakes.js';
import { INPUTS_FORMAT, inputsDb, parseInputs } from '../../scripts/site-upgrade/inputs.js';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => ({ id: 'admin-1' }),
}));

const { handler, MAX_HTML_BYTES } = await import('../../netlify/functions/admin-site-upgrade.js');
const { readLive } = await import('../../scripts/site-upgrade/plan.js');
const { publishSites, restoreSite } = await import('../../scripts/site-upgrade/ops.js');
const { createNetGuard } = await import('../../scripts/site-upgrade/net.js');

const SITE = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const BACKUP = '2026-10-04T10-00-00-000Z-publish-1a2b3c4d';
const row = (id, slug) => ({ id, user_id: 'owner-1', slug, published_url: `https://${slug}.autocaregeniushub.com`, site_type: 'website', scheduler_enabled: false });
const page = (id) => `<!DOCTYPE html><html><body><script src="https://sitebuilder.autocaregenius.com/scheduler.js" data-site-id="${id}" defer></script>${id}</body></html>`;

function inputs(sites, { hoursOld = 0 } = {}) {
  return parseInputs(JSON.stringify({
    format: INPUTS_FORMAT, exportedAt: new Date(Date.now() - hoursOld * 3600e3).toISOString(), publishedAtTracked: true, owners: {}, widgets: {},
    sites: sites.map((s) => ({
      ...s, business_info: {}, template_id: 'mobile_chrome', custom_domain: null, custom_domain_status: null, widget_config_ids: [],
      created_at: '2026-05-01T00:00:00+00:00', generated_content: {}, published_at: null, updated_at: null, fingerprint: 'a'.repeat(32), omittedImages: [],
    })),
    slugRows: sites.map((s) => ({ id: s.id, slug: s.slug })),
    admins: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'ops@acg.test' }],
  }));
}

function setup({ objects, sites = [row(SITE, 'alpha')] }) {
  h.db = fakeDb({ sites, profiles: [{ id: 'admin-1', email: 'a@acg.test', is_super_admin: true }] });
  const r2 = fakeR2(objects);
  vi.stubGlobal('fetch', r2.fetch);
  return { r2, doc: inputs(sites) };
}

beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = 'ab'.repeat(16);
  process.env.CLOUDFLARE_API_TOKEN = 'cf-token';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
});

describe('the live side matches admin-site-upgrade\'s live answer', () => {
  it.each([
    ['a live page with a /book page', { 'alpha/index.html': 'LIVE', 'alpha/book/index.html': 'BOOK' }],
    ['no live page', {}],
    ['a page too large to compare', { 'alpha/index.html': 'x'.repeat(MAX_HTML_BYTES + 1) }],
    ['a site on hold', { 'alpha/index.html': 'LIVE', [`_backups/${SITE}/hold.json`]: JSON.stringify({ held: true, reason: 'restored', at: '2026-10-03T00:00:00.000Z', backupId: 'b1', by: { id: 'x', email: 'y@z.test' } }) }],
  ])('%s', async (_, objects) => {
    const { doc } = setup({ objects });
    const fn = bodyOf(await handler(post({ action: 'live', siteId: SITE })));
    const site = doc.sites[0];
    const mine = await readLive(site, { db: inputsDb(doc), source: 'r2' });
    expect({ slug: mine.slug, shared: mine.shared, index: mine.index, book: mine.book, hold: mine.hold }).toEqual(fn);
    expect(mine.holdChecked).toBe(true);
  });

  it('a slug another row holds', async () => {
    const { doc } = setup({ objects: { 'alpha/index.html': 'LIVE' }, sites: [row(SITE, 'alpha'), row(OTHER, 'alpha')] });
    const fn = bodyOf(await handler(post({ action: 'live', siteId: SITE })));
    const mine = await readLive(doc.sites[0], { db: inputsDb(doc), source: 'r2' });
    expect(fn.shared).toBe(true);
    expect(mine.shared).toBe(true);
  });
});

describe('the live side without R2 (public GET)', () => {
  // malpica-detailing / rhines-auto-detailing: ~4 MB pages of inline photos
  // that the site serves slowly. A body that stalls after 1 MB is flagged as
  // too large, never an error that hides the site's other reasons.
  it('flags a page whose body stops coming after the first MB as too large', async () => {
    const { doc } = setup({ objects: {} });
    const { LIVE_GET } = await import('../../scripts/site-upgrade/plan.js');
    const saved = { ...LIVE_GET };
    Object.assign(LIVE_GET, { timeoutMs: 1000, bodyTimeoutMs: 200 });
    try {
      const slow = vi.fn(async (url, init) => new Response(new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(1024 * 1024 + 10).fill(65));
          init.signal.addEventListener('abort', () => c.error(init.signal.reason));
        },
      }), { status: 200 }));
      const live = await readLive(doc.sites[0], { db: inputsDb(doc), source: 'public', fetchImpl: slow });
      expect(live.index).toEqual({ found: true, size: 1024 * 1024 + 10, tooLarge: true, slow: true });
      // One that stalls before that is retried, then reported.
      const dead = vi.fn(async (url, init) => new Response(new ReadableStream({
        start(c) { init.signal.addEventListener('abort', () => c.error(init.signal.reason)); },
      }), { status: 200 }));
      await expect(readLive(doc.sites[0], { db: inputsDb(doc), source: 'public', fetchImpl: dead })).rejects.toThrow(/got no answer/);
      expect(dead).toHaveBeenCalledTimes(3);
    } finally {
      Object.assign(LIVE_GET, saved);
    }
  });
});

describe('publish loop', () => {
  it('stops before the next site when asked (Ctrl-C), writing nothing more', async () => {
    const { r2, doc } = setup({ objects: { 'alpha/index.html': 'LIVE' } });
    const net = createNetGuard({ realFetch: r2.fetch });
    const out = await publishSites(doc.sites, {
      doc, db: inputsDb(doc), pages: new Map(), net, by: null, dryRun: false, log: () => {}, shouldStop: () => true,
    });
    expect(out).toMatchObject({ stopped: true, records: [], writes: [] });
    expect(out.stopReason).toMatch(/Ctrl-C/);
    expect(r2.calls.filter((c) => c[0] === 'PUT')).toEqual([]);
  });
});

describe('restore never writes over what is not this site\'s live page', () => {
  async function cliRestore(r2, doc) {
    const net = createNetGuard({ realFetch: r2.fetch });
    return restoreSite(doc.sites[0], { db: inputsDb(doc), backupId: BACKUP, net, by: { id: 'a', email: 'ops@acg.test' }, dryRun: false, log: () => {} });
  }
  const backupOf = (id) => ({
    [`_backups/${id}/${BACKUP}/index.html`]: page(id),
    [`_backups/${id}/${BACKUP}/meta.json`]: JSON.stringify({ siteId: id }),
  });

  // The owner deleted site SITE after the export (unpublish-site removes
  // alpha/index.html), then another business claimed "alpha" and published.
  it('another site now holds the address: the function and the CLI both refuse', async () => {
    const r2 = fakeR2({ 'alpha/index.html': page(OTHER), ...backupOf(SITE) });
    vi.stubGlobal('fetch', r2.fetch);
    h.db = fakeDb({ sites: [row(OTHER, 'alpha')], profiles: [{ id: 'admin-1', email: 'a@acg.test', is_super_admin: true }] });
    const fn = await handler(post({ action: 'restore', siteId: SITE, backupId: BACKUP }));
    expect(fn.statusCode).toBe(404);
    // The export from earlier still says SITE holds "alpha".
    const doc = inputs([row(SITE, 'alpha')], { hoursOld: 0.2 });
    await expect(cliRestore(r2, doc)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/another site's .*changed hands/) });
    expect(r2.calls.filter((c) => c[0] === 'PUT')).toEqual([]);
    expect(r2.store.get('alpha/index.html')).toBe(page(OTHER));
  });

  it('nothing is live (unpublished or deleted since the export): refuses, writes nothing', async () => {
    const r2 = fakeR2({ ...backupOf(SITE) });
    vi.stubGlobal('fetch', r2.fetch);
    const doc = inputs([row(SITE, 'alpha')]);
    await expect(cliRestore(r2, doc)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Nothing is live at alpha/) });
    expect(r2.calls.filter((c) => c[0] === 'PUT')).toEqual([]);
    expect(r2.store.has('alpha/index.html')).toBe(false);
  });

  it('this site\'s page is live: restores, backs it up first, holds the site', async () => {
    const r2 = fakeR2({ 'alpha/index.html': page(SITE).replace('</body>', 'NEW</body>'), ...backupOf(SITE) });
    vi.stubGlobal('fetch', r2.fetch);
    const out = await cliRestore(r2, inputs([row(SITE, 'alpha')]));
    expect(r2.store.get('alpha/index.html')).toBe(page(SITE));
    expect(out).toMatchObject({ slug: 'alpha', files: ['index.html'], partial: null, hold: { held: true, reason: 'restored', backupId: BACKUP } });
    expect(r2.store.get(`_backups/${SITE}/${out.safetyBackupId}/index.html`)).toContain('NEW');
  });
});
