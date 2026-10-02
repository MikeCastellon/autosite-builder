// tests/functions/admin-site-upgrade.test.js
//
// Admin > Site upgrades: super-admin gate, slug refusal, backup before every
// overwrite (stored per site, with meta.json), restore (own backups only,
// then on hold), holds, the manual list, the published_at column gate,
// input validation. R2 is an in-memory bucket behind a fake fetch; Supabase
// is an in-memory fake (r2Fakes.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeR2, fakeDb, post, bodyOf } from './r2Fakes.js';

const h = vi.hoisted(() => ({ db: null, user: null }));
const SKIP_ID = '33333333-2222-4333-8444-555555555555';

vi.mock('../../src/lib/siteUpgrade.js', async (importOriginal) => ({
  ...(await importOriginal()),
  UPGRADE_MANUAL_SKIP: [{ siteId: '33333333-2222-4333-8444-555555555555', reason: 'owner asked to wait' }],
}));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const { handler, MAX_HTML_BYTES } = await import('../../netlify/functions/admin-site-upgrade.js');
const { BACKUP_ID_RE } = await import('../../netlify/functions/_shared/r2.js');

const SITE_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_ID = '99999999-2222-4333-8444-555555555555';
const BK = `_backups/${SITE_ID}`;
const OLD_ID = '2026-10-01T10-00-00-000Z-publish-0a1b2c3d';
const APP = 'https://sitebuilder.autocaregenius.com';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const OWNER = { id: 'owner-1', email: 'owner@shop.test', is_super_admin: false };

function page(siteId = SITE_ID, origin = APP, body = '<h1>New design</h1>') {
  return `<!DOCTYPE html>
<html lang="en"><head>
  <script src="${origin}/scheduler.js" data-site-id="${siteId}" defer></script>
  <script src="${origin}/contact-form.js" data-site-id="${siteId}" data-accent="#cc0000" defer></script>
</head><body>${body}</body></html>`;
}
function bookPage(siteId = SITE_ID, origin = APP) {
  return `<!DOCTYPE html><html><body><script src="${origin}/scheduler.js" data-site-id="${siteId}" data-full-page="true" defer></script></body></html>`;
}

function site(extra = {}) {
  return {
    id: SITE_ID, user_id: OWNER.id, slug: 'top-choice', published_url: 'https://top-choice.autocaregeniushub.com',
    site_type: 'website', scheduler_enabled: false, ...extra,
  };
}

let r2;
function setup({ sites = [site()], objects = { 'top-choice/index.html': 'OLD PAGE' }, r2opts, dbopts, widgets = [] } = {}) {
  h.user = { id: ADMIN.id };
  h.db = fakeDb({ sites, profiles: [ADMIN, OWNER], widget_configs: widgets }, dbopts);
  r2 = fakeR2(objects, r2opts);
  vi.stubGlobal('fetch', r2.fetch);
}

const puts = () => r2.calls.filter((c) => c[0] === 'PUT').map((c) => c[1]);
const pagePuts = () => puts().filter((k) => !k.endsWith('/meta.json') && !k.endsWith('/hold.json'));
const meta = (backupId) => JSON.parse(r2.store.get(`${BK}/${backupId}/meta.json`));

beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
  process.env.CLOUDFLARE_API_TOKEN = 'cf-token';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth', () => {
  it('refuses a signed-in non-admin with 403 and touches nothing', async () => {
    setup();
    h.user = { id: OWNER.id };
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(403);
    expect(r2.fetch).not.toHaveBeenCalled();
    expect(h.db.updates).toEqual([]);
  });

  it('refuses a caller without a session with 401', async () => {
    setup();
    h.user = null;
    const res = await handler(post({ action: 'live', siteId: SITE_ID }));
    expect(res.statusCode).toBe(401);
    expect(r2.fetch).not.toHaveBeenCalled();
  });

  it('answers OPTIONS and refuses other methods', async () => {
    setup();
    expect((await handler({ httpMethod: 'OPTIONS', headers: {} })).statusCode).toBe(204);
    expect((await handler({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
  });
});

describe('input validation', () => {
  it.each([
    ['a missing siteId', {}],
    ['a non-uuid siteId', { siteId: 'top-choice' }],
    ['a siteId with injected text', { siteId: `${SITE_ID}' or 1=1` }],
  ])('refuses %s', async (_, extra) => {
    setup();
    const res = await handler(post({ action: 'live', ...extra }));
    expect(res.statusCode).toBe(400);
    expect(r2.fetch).not.toHaveBeenCalled();
  });

  it('refuses an unknown action and bad JSON', async () => {
    setup();
    expect((await handler(post({ action: 'delete', siteId: SITE_ID }))).statusCode).toBe(400);
    expect((await handler({ httpMethod: 'POST', headers: {}, body: '{nope' })).statusCode).toBe(400);
  });

  it('404s a site that does not exist', async () => {
    setup();
    const res = await handler(post({ action: 'live', siteId: OTHER_ID }));
    expect(res.statusCode).toBe(404);
  });

  it.each([
    ['not a full page', '<div>hi</div>', 400],
    ['a page for another site', page(OTHER_ID), 400],
    ['a page built on localhost', page(SITE_ID, 'http://localhost:5190'), 400],
    ['a page built on a deploy preview', page(SITE_ID, 'https://deploy-preview-10--autosite-builder.netlify.app'), 400],
    ['a page without widgets', '<!DOCTYPE html><html><body>x</body></html>', 400],
    ['an oversized page', page(SITE_ID, APP, 'x'.repeat(MAX_HTML_BYTES)), 413],
  ])('refuses %s before any backup or upload', async (_, htmlContent, status) => {
    setup();
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent }));
    expect(res.statusCode).toBe(status);
    expect(puts()).toEqual([]);
    expect(r2.store.get('top-choice/index.html')).toBe('OLD PAGE');
  });

  it('refuses a booking page when booking is off, or one for another site', async () => {
    setup();
    let res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page(), bookingPageHtml: bookPage() }));
    expect(res.statusCode).toBe(409);
    setup({ sites: [site({ scheduler_enabled: true })] });
    res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page(), bookingPageHtml: bookPage(OTHER_ID) }));
    expect(res.statusCode).toBe(400);
    expect(puts()).toEqual([]);
  });

  it('refuses a malformed backupId', async () => {
    setup();
    for (const backupId of ['', '../../other-site', `${OLD_ID}/../x`, 'latest', '2026-10-01T10-00-00-000Z-publish']) {
      const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId }));
      expect(res.statusCode).toBe(400);
    }
    expect(r2.fetch).not.toHaveBeenCalled();
  });
});

describe('slug refusal', () => {
  it.each([
    ['a slug another site also holds', [site(), site({ id: OTHER_ID, user_id: 'x' })], 409],
    ['an invalid stored slug', [site({ slug: 'Other-Site/book' })], 409],
    ['a reserved slug', [site({ slug: 'admin' })], 409],
    ['a site without a slug', [site({ slug: null })], 409],
    ['a site that is not live', [site({ published_url: null })], 409],
    ['a booking-only page', [site({ site_type: 'booking_only' })], 409],
  ])('refuses to publish %s and writes nothing', async (_, sites, status) => {
    setup({ sites });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(status);
    expect(puts()).toEqual([]);
    // Never claims a slug for a row without one.
    expect(h.db.updates).toEqual([]);
  });

  it('ignores a slug sent by the client', async () => {
    setup();
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, slug: 'victim', htmlContent: page() }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).slug).toBe('top-choice');
    expect(puts().some((k) => k.startsWith('victim'))).toBe(false);
  });

  it('refuses to restore onto a shared slug', async () => {
    setup({ sites: [site(), site({ id: OTHER_ID })], objects: { [`${BK}/${OLD_ID}/index.html`]: page() } });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(409);
    expect(puts()).toEqual([]);
  });
});

describe('publish', () => {
  it('backs up the live page and /book page before uploading the new ones', async () => {
    setup({
      sites: [site({ scheduler_enabled: true })],
      objects: { 'top-choice/index.html': 'OLD PAGE', 'top-choice/book/index.html': 'OLD BOOK' },
    });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page(), bookingPageHtml: bookPage() }));
    expect(res.statusCode).toBe(200);
    const out = bodyOf(res);
    expect(out.backupId).toMatch(BACKUP_ID_RE);
    expect(out.backupId).toMatch(/-publish-[0-9a-f]{8}$/);
    expect(out.backupFiles).toEqual(['index.html', 'book/index.html']);
    expect(out.publishedUrl).toBe('https://top-choice.autocaregeniushub.com');

    // Stored under the site's id, never its slug.
    const backupIndex = `${BK}/${out.backupId}/index.html`;
    const backupBook = `${BK}/${out.backupId}/book/index.html`;
    const backupMeta = `${BK}/${out.backupId}/meta.json`;
    expect(puts()).toEqual([backupIndex, backupBook, backupMeta, 'top-choice/index.html', 'top-choice/book/index.html']);
    expect(r2.store.get(backupIndex)).toBe('OLD PAGE');
    expect(r2.store.get(backupBook)).toBe('OLD BOOK');
    expect(meta(out.backupId)).toEqual({
      siteId: SITE_ID, slug: 'top-choice', reason: 'publish', at: expect.any(String),
      by: { id: ADMIN.id, email: ADMIN.email }, files: ['index.html', 'book/index.html'],
    });
    expect(r2.store.get('top-choice/index.html')).toBe(page());
    expect(r2.store.get('top-choice/book/index.html')).toBe(bookPage());
    // Pages uploaded exactly like publish-site.
    for (const c of r2.calls.filter((x) => x[0] === 'PUT' && !x[1].endsWith('.json'))) expect(c[2]).toBe('text/html; charset=utf-8');
  });

  it('records published_url (unchanged) and published_at', async () => {
    setup();
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(200);
    expect(h.db.updates.map((u) => Object.keys(u.patch))).toEqual([['published_url'], ['published_at']]);
    expect(h.db.state.sites[0].published_url).toBe('https://top-choice.autocaregeniushub.com');
    expect(Date.parse(h.db.state.sites[0].published_at)).toBeGreaterThan(Date.now() - 60_000);
    expect(bodyOf(res).publishedAt).toBe(h.db.state.sites[0].published_at);
  });

  it('refuses to publish before the published_at migration (nothing would record the site as done)', async () => {
    setup({ dbopts: { publishedAtError: { code: '42703', message: 'column sites.published_at does not exist' } } });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).error).toMatch(/20261004_sites_published_at\.sql/);
    expect(puts()).toEqual([]);
    expect(r2.store.get('top-choice/index.html')).toBe('OLD PAGE');
  });

  it('still succeeds when only the published_at update fails', async () => {
    setup({ dbopts: { throwOnPublishedAt: true } });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).publishedAt).toBeNull();
    expect(r2.store.get('top-choice/index.html')).toBe(page());
  });

  it('refuses a site on the manual check list', async () => {
    setup({ sites: [site({ id: SKIP_ID })] });
    const res = await handler(post({ action: 'publish', siteId: SKIP_ID, htmlContent: page(SKIP_ID) }));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).error).toMatch(/manual check list/);
    expect(puts()).toEqual([]);
  });

  it('refuses a site on hold, and publishes once the hold is released', async () => {
    setup({ objects: { 'top-choice/index.html': 'OLD PAGE', [`${BK}/hold.json`]: JSON.stringify({ held: true, reason: 'restored' }) } });
    let res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).error).toMatch(/on hold/);
    expect(puts()).toEqual([]);

    res = await handler(post({ action: 'hold', siteId: SITE_ID, held: false }));
    expect(res.statusCode).toBe(200);
    res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(200);
  });

  it('aborts without touching the live page when the backup write fails', async () => {
    setup({ r2opts: { failPut: (k) => k.startsWith('_backups/') } });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(502);
    expect(bodyOf(res).error).toMatch(/nothing was published/);
    expect(puts().filter((k) => !k.startsWith('_backups/'))).toEqual([]);
    expect(r2.store.get('top-choice/index.html')).toBe('OLD PAGE');
    expect(h.db.updates).toEqual([]);
  });

  it('aborts when the backup\'s meta.json cannot be written', async () => {
    setup({ r2opts: { failPut: (k) => k.endsWith('/meta.json') } });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(502);
    expect(r2.store.get('top-choice/index.html')).toBe('OLD PAGE');
  });

  it('aborts when the live page cannot be read (an outage is not "nothing there")', async () => {
    setup({ r2opts: { failGet: (k) => k === 'top-choice/index.html' } });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(502);
    expect(puts()).toEqual([]);
  });

  it('refuses when there is no live page to back up', async () => {
    setup({ objects: {} });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(409);
    expect(puts()).toEqual([]);
  });

  it('returns the backup id when the upload fails after the backup', async () => {
    setup({ r2opts: { failPut: (k) => k === 'top-choice/index.html' } });
    const res = await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    expect(res.statusCode).toBe(500);
    expect(bodyOf(res).backupId).toMatch(BACKUP_ID_RE);
    expect(bodyOf(res).error).toMatch(/R2 upload failed \(500\)/);
    expect(h.db.updates).toEqual([]);
  });

  it('logs the admin, site and slug', async () => {
    setup();
    await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }));
    const lines = console.log.mock.calls.map((c) => c.join(' '));
    expect(lines.some((l) => l.includes('publish') && l.includes(`admin=${ADMIN.id}`) && l.includes(`site=${SITE_ID}`) && l.includes('slug=top-choice') && l.includes('published'))).toBe(true);
  });
});

describe('restore', () => {
  const OLD = page(SITE_ID, APP, '<h1>Old design</h1>');

  it('backs up the current page first, puts the backup live, clears published_at and holds the site', async () => {
    setup({
      sites: [site({ published_at: '2026-10-02T12:00:00.000Z' })],
      objects: {
        'top-choice/index.html': 'NEW DESIGN',
        [`${BK}/${OLD_ID}/index.html`]: OLD,
      },
    });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(200);
    const out = bodyOf(res);
    expect(out.safetyBackupId).toMatch(BACKUP_ID_RE);
    expect(out.safetyBackupId).toMatch(/-restore-[0-9a-f]{8}$/);
    expect(out.files).toEqual(['index.html']);
    expect(pagePuts()).toEqual([`${BK}/${out.safetyBackupId}/index.html`, 'top-choice/index.html']);
    expect(r2.store.get(`${BK}/${out.safetyBackupId}/index.html`)).toBe('NEW DESIGN');
    expect(r2.store.get('top-choice/index.html')).toBe(OLD);
    expect(h.db.state.sites[0].published_at).toBeNull();
    // On hold: the next check flags it and publish refuses it.
    expect(out.hold).toMatchObject({ held: true, reason: 'restored', backupId: OLD_ID, by: { id: ADMIN.id, email: ADMIN.email } });
    expect(out.holdError).toBeNull();
    const live = bodyOf(await handler(post({ action: 'live', siteId: SITE_ID })));
    expect(live.hold).toMatchObject({ held: true, reason: 'restored' });
    expect((await handler(post({ action: 'publish', siteId: SITE_ID, htmlContent: page() }))).statusCode).toBe(409);
  });

  it('restores the /book page too when the backup has one', async () => {
    setup({
      objects: {
        'top-choice/index.html': 'NEW', 'top-choice/book/index.html': 'NEW BOOK',
        [`${BK}/${OLD_ID}/index.html`]: OLD, [`${BK}/${OLD_ID}/book/index.html`]: bookPage(),
      },
    });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(200);
    expect(r2.store.get('top-choice/book/index.html')).toBe(bookPage());
  });

  it('never reads another site\'s backups, even under the same slug', async () => {
    // A deleted site that held "top-choice" before this row claimed it.
    setup({ objects: { 'top-choice/index.html': 'NEW', [`_backups/${OTHER_ID}/${OLD_ID}/index.html`]: page(OTHER_ID) } });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(404);
    expect(puts()).toEqual([]);
    const list = bodyOf(await handler(post({ action: 'backups', siteId: SITE_ID })));
    expect(list.backups).toEqual([]);
  });

  it.each([
    ['whose page carries another site\'s widgets', { [`${BK}/${OLD_ID}/index.html`]: page(OTHER_ID) }],
    ['whose /book page carries another site\'s widget', { [`${BK}/${OLD_ID}/index.html`]: page(), [`${BK}/${OLD_ID}/book/index.html`]: bookPage(OTHER_ID) }],
    ['whose meta.json names another site', { [`${BK}/${OLD_ID}/index.html`]: page(), [`${BK}/${OLD_ID}/meta.json`]: JSON.stringify({ siteId: OTHER_ID }) }],
  ])('refuses a backup %s', async (_, objects) => {
    setup({ objects: { 'top-choice/index.html': 'NEW', ...objects } });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(409);
    expect(puts()).toEqual([]);
    expect(r2.store.get('top-choice/index.html')).toBe('NEW');
  });

  it('restores a very old page without widgets', async () => {
    setup({ objects: { 'top-choice/index.html': 'NEW', [`${BK}/${OLD_ID}/index.html`]: '<html>no widgets</html>' } });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(200);
    expect(r2.store.get('top-choice/index.html')).toBe('<html>no widgets</html>');
  });

  it('still reports the restore when the hold cannot be written', async () => {
    setup({
      objects: { 'top-choice/index.html': 'NEW', [`${BK}/${OLD_ID}/index.html`]: OLD },
      r2opts: { failPut: (k) => k.endsWith('/hold.json') },
    });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(200);
    expect(r2.store.get('top-choice/index.html')).toBe(OLD);
    expect(bodyOf(res).hold).toBeNull();
    expect(bodyOf(res).holdError).toMatch(/could not be put on hold/);
  });

  it('aborts when the safety backup fails', async () => {
    setup({
      objects: { 'top-choice/index.html': 'NEW', [`${BK}/${OLD_ID}/index.html`]: OLD },
      r2opts: { failPut: (k) => k.includes('-restore-') },
    });
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(502);
    expect(r2.store.get('top-choice/index.html')).toBe('NEW');
  });

  it('404s a backup that does not exist', async () => {
    setup();
    const res = await handler(post({ action: 'restore', siteId: SITE_ID, backupId: OLD_ID }));
    expect(res.statusCode).toBe(404);
    expect(puts()).toEqual([]);
  });
});

describe('reads', () => {
  it('live: returns the live page, the /book page and whether the slug is shared', async () => {
    setup({ objects: { 'top-choice/index.html': 'LIVE', 'top-choice/book/index.html': 'BOOK' } });
    const res = await handler(post({ action: 'live', siteId: SITE_ID }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toEqual({
      slug: 'top-choice', shared: false,
      index: { found: true, size: 4, html: 'LIVE' },
      book: { found: true, size: 4, html: 'BOOK' },
      hold: null,
    });
    expect(puts()).toEqual([]);
  });

  it('live: reports a missing page and an oversized one without sending it', async () => {
    setup({ objects: {} });
    expect(bodyOf(await handler(post({ action: 'live', siteId: SITE_ID }))).index).toEqual({ found: false });
    setup({ objects: { 'top-choice/index.html': 'x'.repeat(MAX_HTML_BYTES + 1) } });
    const out = bodyOf(await handler(post({ action: 'live', siteId: SITE_ID })));
    expect(out.index).toEqual({ found: true, size: MAX_HTML_BYTES + 1, tooLarge: true });
  });

  it('backups: lists this site\'s backups newest first and skips stray keys', async () => {
    const RESTORE_ID = '2026-10-02T10-00-00-000Z-restore-11aa22bb';
    setup({
      objects: {
        [`${BK}/${OLD_ID}/index.html`]: 'A',
        [`${BK}/${OLD_ID}/meta.json`]: '{}',
        [`${BK}/${RESTORE_ID}/index.html`]: 'B',
        [`${BK}/${RESTORE_ID}/book/index.html`]: 'BB',
        [`${BK}/junk/index.html`]: 'J',
        [`${BK}/hold.json`]: '{"held":true}',
        [`_backups/${OTHER_ID}/2026-10-03T10-00-00-000Z-publish-99999999/index.html`]: 'other site',
        '_backups/top-choice/2026-10-03T10-00-00-000Z-publish-99999999/index.html': 'keyed by slug',
      },
    });
    const res = await handler(post({ action: 'backups', siteId: SITE_ID }));
    expect(res.statusCode).toBe(200);
    const { backups } = bodyOf(res);
    expect(backups.map((b) => b.id)).toEqual([RESTORE_ID, OLD_ID]);
    expect(backups[0].files).toEqual(['index.html', 'book/index.html']);
    expect(backups[1].files).toEqual(['index.html']);
    expect(r2.calls).toContainEqual(['LIST', `${BK}/`]);
  });

  it('live: reports a hold', async () => {
    setup({ objects: { 'top-choice/index.html': 'LIVE', [`${BK}/hold.json`]: JSON.stringify({ held: true, reason: 'manual', note: 'owner on vacation', at: '2026-10-03T00:00:00.000Z' }) } });
    const out = bodyOf(await handler(post({ action: 'live', siteId: SITE_ID })));
    expect(out.hold).toEqual({ held: true, reason: 'manual', note: 'owner on vacation', at: '2026-10-03T00:00:00.000Z', by: null, backupId: null });
  });

  it('live: fails rather than guess when the hold cannot be read', async () => {
    setup({ objects: { 'top-choice/index.html': 'LIVE' }, r2opts: { failGet: (k) => k.endsWith('/hold.json') } });
    expect((await handler(post({ action: 'live', siteId: SITE_ID }))).statusCode).toBe(500);
  });

  it('inputs: returns the owner\'s widget keys, newest first', async () => {
    setup({
      widgets: [
        { user_id: OWNER.id, type: 'google-reviews', widget_key: 'g1' },
        { user_id: OWNER.id, type: 'instagram-feed', widget_key: 'ig1' },
        { user_id: OWNER.id, type: 'other', widget_key: 'x' },
        { user_id: 'someone-else', type: 'google-reviews', widget_key: 'nope' },
      ],
    });
    const res = await handler(post({ action: 'inputs', siteId: SITE_ID }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).widgets).toEqual([
      { type: 'google-reviews', widget_key: 'g1' },
      { type: 'instagram-feed', widget_key: 'ig1' },
    ]);
  });
});

describe('backup and hold', () => {
  it('backup: saves the live page now, with who saved it', async () => {
    setup({ objects: { 'top-choice/index.html': 'LIVE' } });
    const res = await handler(post({ action: 'backup', siteId: SITE_ID }));
    expect(res.statusCode).toBe(200);
    const { backupId, backupFiles } = bodyOf(res);
    expect(backupId).toMatch(/-manual-[0-9a-f]{8}$/);
    expect(backupFiles).toEqual(['index.html']);
    expect(r2.store.get(`${BK}/${backupId}/index.html`)).toBe('LIVE');
    expect(meta(backupId)).toMatchObject({ siteId: SITE_ID, slug: 'top-choice', reason: 'manual', by: { id: ADMIN.id } });
    expect(r2.store.get('top-choice/index.html')).toBe('LIVE');
  });

  it('backup: refuses a shared slug and a site with nothing live', async () => {
    setup({ sites: [site(), site({ id: OTHER_ID })] });
    expect((await handler(post({ action: 'backup', siteId: SITE_ID }))).statusCode).toBe(409);
    setup({ objects: {} });
    expect((await handler(post({ action: 'backup', siteId: SITE_ID }))).statusCode).toBe(404);
    expect(puts()).toEqual([]);
  });

  it('hold: sets and releases the marker, recording the admin', async () => {
    setup();
    let res = await handler(post({ action: 'hold', siteId: SITE_ID, held: true, note: '  owner wants to look first ' }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).hold).toMatchObject({ held: true, reason: 'manual', note: 'owner wants to look first', by: { id: ADMIN.id } });
    expect(JSON.parse(r2.store.get(`${BK}/hold.json`))).toMatchObject({ held: true, siteId: SITE_ID });
    res = await handler(post({ action: 'hold', siteId: SITE_ID, held: false }));
    expect(bodyOf(res).hold).toMatchObject({ held: false, reason: 'released' });
  });

  it('hold: needs a boolean and a real site', async () => {
    setup();
    expect((await handler(post({ action: 'hold', siteId: SITE_ID, held: 'yes' }))).statusCode).toBe(400);
    expect((await handler(post({ action: 'hold', siteId: OTHER_ID, held: true }))).statusCode).toBe(404);
    expect(puts()).toEqual([]);
  });

  it('refuses non-admins', async () => {
    setup();
    h.user = { id: OWNER.id };
    expect((await handler(post({ action: 'hold', siteId: SITE_ID, held: false }))).statusCode).toBe(403);
    expect((await handler(post({ action: 'backup', siteId: SITE_ID }))).statusCode).toBe(403);
    expect(r2.fetch).not.toHaveBeenCalled();
  });
});
