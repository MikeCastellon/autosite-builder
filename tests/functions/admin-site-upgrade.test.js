// tests/functions/admin-site-upgrade.test.js
//
// Admin > Site upgrades: super-admin gate, slug refusal, backup before every
// overwrite (stored per site, with meta.json), restore (own backups only,
// then on hold), holds, the manual list, the published_at column gate,
// input validation. R2 is an in-memory bucket behind a fake fetch; Supabase
// is an in-memory fake (r2Fakes.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeR2, fakeDb, fakePostmark, routeFetch, post, bodyOf } from './r2Fakes.js';

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

const { handler, MAX_HTML_BYTES, MAX_EMAIL_SITES } = await import('../../netlify/functions/admin-site-upgrade.js');
const { BACKUP_ID_RE } = await import('../../netlify/functions/_shared/r2.js');
// Email eligibility counts from the release day, so the fixtures follow it.
const { SITE_UPGRADE_RELEASE_DATE: RELEASE } = await import('../../src/lib/siteUpgrade.js');

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
let pm;
function setup({
  sites = [site()], objects = { 'top-choice/index.html': 'OLD PAGE' }, r2opts, dbopts, widgets = [],
  profiles = [ADMIN, OWNER], users = [], postmark,
} = {}) {
  h.user = { id: ADMIN.id };
  h.db = fakeDb({ sites, profiles, widget_configs: widgets, users }, dbopts);
  r2 = fakeR2(objects, r2opts);
  // Postmark is in memory too: any other URL throws.
  pm = fakePostmark(postmark);
  vi.stubGlobal('fetch', routeFetch(r2, pm));
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

describe('owner emails', () => {
  const ORIGIN = { origin: APP };
  const UPGRADED_AT = `${RELEASE}T15:00:00.000Z`;
  const CREATED_AT = '2025-05-01T00:00:00.000Z';
  const A1 = 'a1a1a1a1-1111-4111-8111-111111111111'; // Mike's first site
  const A2 = 'a2a2a2a2-1111-4111-8111-111111111111'; // Mike's second site (own domain, booking on)
  const B = 'bbbbbbbb-1111-4111-8111-111111111111'; // Jane's site
  const C = 'cccccccc-1111-4111-8111-111111111111'; // Carl's site
  const ADM = 'adadadad-1111-4111-8111-111111111111'; // a super admin's demo site
  const INT = 'aaaa0000-1111-4111-8111-111111111111'; // a team account's site
  const OLDP = 'dddddddd-1111-4111-8111-111111111111'; // not republished since the release
  const DONE = 'eeeeeeee-1111-4111-8111-111111111111'; // owner already emailed
  const MISSING = 'ffffffff-1111-4111-8111-111111111111';
  const RUN = 'run-0001-test';
  const LEASE_KEY = '_backups/upgrade-email-run.json';
  const UPGRADE_BACKUP = `${RELEASE}T15-00-00-000Z-publish-0a1b2c3d`;

  const live = (id, userId, name, slug, extra = {}) => ({
    id, user_id: userId, slug, published_url: `https://${slug}.autocaregeniushub.com`, site_type: 'website',
    template_id: 'mobile_redline', scheduler_enabled: false, business_info: { businessName: name },
    custom_domain: null, custom_domain_status: null, created_at: CREATED_AT, published_at: UPGRADED_AT, ...extra,
  });
  const SITES = [
    live(A1, 'owner-1', 'Top Choice', 'top-choice'),
    live(A2, 'owner-1', 'Top Choice Tint', 'top-choice-tint', { custom_domain: 'topchoicetint.com', custom_domain_status: 'active_ssl', scheduler_enabled: true }),
    live(B, 'owner-2', 'Jane\'s Detail', 'janes-detail'),
    live(C, 'owner-6', 'Carl\'s Garage', 'carls-garage'),
    live(ADM, ADMIN.id, 'Demo Shop', 'demo-shop'),
    live(INT, 'owner-3', 'Staff Test', 'staff-test'),
    live(OLDP, 'owner-4', 'Old Paint', 'old-paint', { published_at: '2026-09-01T00:00:00.000Z' }),
    live(DONE, 'owner-5', 'Done Deal', 'done-deal'),
  ];
  const profile = (id, email, extra = {}) => ({ id, email, first_name: null, is_super_admin: false, ...extra });
  const PROFILES = [
    ADMIN,
    profile('owner-1', 'mike@topchoice.com'),
    profile('owner-2', 'jane@janesdetail.com', { first_name: 'Jane' }),
    profile('owner-3', 'staff@autocaregenius.com'),
    profile('owner-4', 'old@oldpaint.com'),
    profile('owner-5', 'done@donedeal.com'),
    profile('owner-6', 'carl@carlsgarage.com'),
  ];
  const USERS = [
    { id: 'owner-1', email: 'Mike@TopChoice.com', user_metadata: { first_name: 'mike' } },
    { id: 'owner-2', email: 'jane@janesdetail.com', user_metadata: {} },
    { id: 'owner-6', email: 'carl@carlsgarage.com', user_metadata: { full_name: 'Carl Diaz' } },
  ];
  const markerKey = (id) => `_backups/${id}/upgrade-email.json`;
  // Written before markers had a state: only after Postmark accepted.
  const DONE_MARKER = { siteId: DONE, at: '2026-10-03T09:00:00.000Z', to: 'done@donedeal.com', messageId: 'old-msg', by: { id: ADMIN.id, email: ADMIN.email } };

  // A live page built by the new designs (their site runtime sets
  // data-acg-scrolled), for site `id`.
  const newLivePage = (id) => page(id, APP, '<script>document.documentElement.setAttribute(\'data-acg-scrolled\',\'\')</script><h1>New design</h1>');
  // Every site: its new-design page live, and the backup of the old page
  // its upgrade made.
  const LIVE_OBJECTS = Object.fromEntries(SITES.flatMap((s) => [
    [`${s.slug}/index.html`, newLivePage(s.id)],
    [`_backups/${s.id}/${UPGRADE_BACKUP}/index.html`, 'OLD PAGE'],
  ]));

  function emailSetup({ objects = {}, omit = [], ...rest } = {}) {
    const all = { ...LIVE_OBJECTS, [markerKey(DONE)]: JSON.stringify(DONE_MARKER), ...objects };
    for (const k of omit) delete all[k];
    setup({ sites: SITES, profiles: PROFILES, users: USERS, objects: all, ...rest });
  }
  const send = (body, headers = ORIGIN) => handler(post({ action: 'emailSend', confirm: 'SEND', runId: RUN, ...body }, headers));
  const act = (body) => handler(post(body, ORIGIN));
  const markerPuts = () => puts().filter((k) => k.endsWith('/upgrade-email.json'));
  const marker = (id) => JSON.parse(r2.store.get(markerKey(id)));
  const resultsById = (res) => Object.fromEntries(bodyOf(res).results.map((r) => [r.siteId, r]));
  const sentTo = () => pm.sent.map((m) => m.To);
  // R2 writes and Postmark sends, in the order they were made.
  const order = () => fetch.mock.calls.map(([url, init = {}]) => {
    const u = String(url);
    if (u === 'https://api.postmarkapp.com/email') return `SEND ${JSON.parse(init.body).To}`;
    if (init.method !== 'PUT') return null;
    const key = decodeURIComponent(u.split('/objects/')[1]);
    return `PUT ${key}${key.endsWith('/upgrade-email.json') ? ` ${JSON.parse(init.body).state}` : ''}`;
  }).filter(Boolean);

  beforeEach(() => {
    process.env.POSTMARK_API_KEY = 'pm-test-token';
    process.env.POSTMARK_FROM_EMAIL = 'hello@autocaregeniushub.com';
    process.env.POSTMARK_UPGRADE_STREAM = 'broadcast';
    delete process.env.UPGRADE_EMAIL_REPLY_TO;
  });
  afterEach(() => {
    delete process.env.POSTMARK_API_KEY;
    delete process.env.POSTMARK_FROM_EMAIL;
    delete process.env.POSTMARK_UPGRADE_STREAM;
    delete process.env.UPGRADE_EMAIL_REPLY_TO;
  });

  describe('gate and confirmation', () => {
    it('refuses non-admins with 403 and sends or writes nothing', async () => {
      emailSetup();
      h.user = { id: 'owner-1' };
      for (const body of [
        { action: 'emailSend', siteIds: [A1], confirm: 'SEND', runId: RUN },
        { action: 'emailSend', siteIds: [A1], testTo: 'mike@topchoice.com' },
        { action: 'emailPreview', siteId: A1 },
        { action: 'emailStatus', siteIds: [A1] },
        { action: 'emailRelease', runId: RUN },
        { action: 'emailResolve', siteId: A1, outcome: 'not_sent' },
      ]) {
        expect((await act(body)).statusCode).toBe(403);
      }
      expect(pm.attempts).toEqual([]);
      expect(r2.fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['no confirmation', { confirm: undefined }, /SEND/],
      ['a lowercase one', { confirm: 'send' }, /SEND/],
      ['another word', { confirm: 'yes' }, /SEND/],
      ['no runId', { runId: undefined }, /runId/],
      ['a malformed runId', { runId: 'not ok!' }, /runId/],
    ])('needs SEND typed and a run: refuses %s', async (_, extra, msg) => {
      emailSetup();
      const res = await send({ siteIds: [A1], ...extra });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res).error).toMatch(msg);
      expect(pm.attempts).toEqual([]);
      expect(puts()).toEqual([]);
    });

    it.each([
      ['a deploy preview', { origin: 'https://deploy-preview-10--autosite-builder.netlify.app' }],
      ['localhost', { origin: 'http://localhost:5190' }],
      ['no origin', {}],
    ])('only sends to owners from the production app: refuses %s', async (_, headers) => {
      emailSetup();
      const res = await send({ siteIds: [A1] }, headers);
      expect(res.statusCode).toBe(409);
      expect(pm.attempts).toEqual([]);
    });

    it('refuses when email is not set up, before the migration, and bad site lists', async () => {
      emailSetup();
      delete process.env.POSTMARK_FROM_EMAIL;
      expect((await send({ siteIds: [A1] })).statusCode).toBe(503);
      process.env.POSTMARK_FROM_EMAIL = 'hello@autocaregeniushub.com';

      // Owner emails never default to the transactional stream.
      delete process.env.POSTMARK_UPGRADE_STREAM;
      let res = await send({ siteIds: [A1] });
      expect(res.statusCode).toBe(503);
      expect(bodyOf(res).error).toMatch(/POSTMARK_UPGRADE_STREAM/);
      process.env.POSTMARK_UPGRADE_STREAM = 'broadcast';

      // A ReplyTo Postmark would refuse for every owner.
      process.env.UPGRADE_EMAIL_REPLY_TO = 'help at acg';
      res = await send({ siteIds: [A1] });
      expect(res.statusCode).toBe(503);
      expect(bodyOf(res).error).toMatch(/UPGRADE_EMAIL_REPLY_TO/);
      delete process.env.UPGRADE_EMAIL_REPLY_TO;

      emailSetup({ dbopts: { publishedAtError: { code: '42703', message: 'column sites.published_at does not exist' } } });
      res = await send({ siteIds: [A1] });
      expect(res.statusCode).toBe(409);
      expect(bodyOf(res).error).toMatch(/20261004_sites_published_at\.sql/);
      expect(puts()).toEqual([]);

      emailSetup();
      const tooMany = Array.from({ length: MAX_EMAIL_SITES + 1 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`);
      for (const siteIds of [[], 'x', [A1, 'top-choice'], tooMany, undefined]) {
        expect((await send({ siteIds })).statusCode).toBe(400);
      }
      expect(pm.attempts).toEqual([]);
      expect(puts()).toEqual([]);
    });
  });

  describe('send', () => {
    it('emails each owner once about all their upgraded sites and skips everyone else', async () => {
      emailSetup();
      const res = await send({ siteIds: [A1, A2, B, ADM, INT, OLDP, DONE, MISSING] });
      expect(res.statusCode).toBe(200);
      const out = bodyOf(res);
      expect(out).toMatchObject({ sentOwners: 2, stopped: false, stopReason: null });
      expect(out.results.map((r) => r.siteId)).toEqual([A1, A2, B, ADM, INT, OLDP, DONE, MISSING]);

      // One email per owner: Mike's names both his sites.
      expect(sentTo()).toEqual(['mike@topchoice.com', 'jane@janesdetail.com']);
      const [mike, jane] = pm.sent;
      expect(mike).toMatchObject({
        token: 'pm-test-token', From: 'hello@autocaregeniushub.com', ReplyTo: ADMIN.email,
        Subject: 'Your websites just got an upgrade', MessageStream: 'broadcast', Tag: 'site-upgrade',
        Metadata: { siteId: A1 },
      });
      expect(mike.TextBody.split('\n')[0]).toBe('Hi Mike, your websites just got an upgrade');
      expect(mike.TextBody).toContain('Your websites:\n- Top Choice: https://top-choice.autocaregeniushub.com\n- Top Choice Tint: https://www.topchoicetint.com');
      // Booking is on for one of his sites.
      expect(mike.TextBody).toContain('Your booking calendar works better on phones.');
      expect(jane.Subject).toBe('Your website just got an upgrade');
      expect(jane.TextBody.split('\n')[0]).toBe('Hi Jane, your website just got an upgrade');
      expect(jane.TextBody).toContain('The Jane\'s Detail website at https://janes-detail.autocaregeniushub.com is now on our new design.');
      expect(jane.TextBody).not.toContain('booking calendar');
      expect(jane.HtmlBody).toContain('Jane&#39;s Detail');

      const r = resultsById(res);
      expect(r[A1]).toMatchObject({ status: 'sent', to: 'mike@topchoice.com', messageId: 'pm-msg-1', marker: { state: 'sent', messageId: 'pm-msg-1' } });
      expect(r[A2]).toMatchObject({ status: 'sent', to: 'mike@topchoice.com', messageId: 'pm-msg-1' });
      expect(r[B]).toMatchObject({ status: 'sent', to: 'jane@janesdetail.com', messageId: 'pm-msg-2' });
      expect(r[ADM]).toMatchObject({ status: 'skipped', code: 'admin_owner' });
      expect(r[INT]).toMatchObject({ status: 'skipped', code: 'test_owner' });
      expect(r[OLDP]).toMatchObject({ status: 'skipped', code: 'not_upgraded' });
      expect(r[DONE]).toMatchObject({ status: 'skipped', code: 'already_emailed', marker: { state: 'sent', to: 'done@donedeal.com', at: DONE_MARKER.at } });
      expect(r[MISSING]).toMatchObject({ status: 'skipped', code: 'not_found' });

      // The run's lease first; each site claimed before its email goes to
      // Postmark, then marked sent.
      expect(order()).toEqual([
        `PUT ${LEASE_KEY}`,
        `PUT ${markerKey(A1)} sending`, `PUT ${markerKey(A2)} sending`,
        'SEND mike@topchoice.com',
        `PUT ${markerKey(A1)} sent`, `PUT ${markerKey(A2)} sent`,
        `PUT ${markerKey(B)} sending`,
        'SEND jane@janesdetail.com',
        `PUT ${markerKey(B)} sent`,
      ]);
      expect(marker(A1)).toMatchObject({
        state: 'sent', siteId: A1, siteIds: [A1, A2], ownerId: 'owner-1', to: 'mike@topchoice.com', messageId: 'pm-msg-1',
        stream: 'broadcast', runId: RUN, by: { id: ADMIN.id, email: ADMIN.email }, at: expect.any(String), sentAt: expect.any(String),
      });
      expect(marker(A2)).toMatchObject({ state: 'sent', siteId: A2, siteIds: [A1, A2], messageId: 'pm-msg-1' });
      expect(marker(B)).toMatchObject({ state: 'sent', siteId: B, siteIds: [B], to: 'jane@janesdetail.com', messageId: 'pm-msg-2' });
      expect(r2.store.get(markerKey(DONE))).toBe(JSON.stringify(DONE_MARKER));
      expect(JSON.parse(r2.store.get(LEASE_KEY))).toMatchObject({ runId: RUN, by: { id: ADMIN.id } });
      // Nothing about the sites themselves changes.
      expect(h.db.updates).toEqual([]);
    });

    it('never emails a site\'s owner twice', async () => {
      emailSetup();
      await send({ siteIds: [A1, A2, B] });
      const again = await send({ siteIds: [A1, A2, B, B] });
      expect(again.statusCode).toBe(200);
      expect(bodyOf(again).sentOwners).toBe(0);
      expect(bodyOf(again).results.map((r) => r.code)).toEqual(['already_emailed', 'already_emailed', 'already_emailed']);
      expect(pm.sent).toHaveLength(2);
    });

    it('treats a repeated site id as one', async () => {
      emailSetup();
      const res = await send({ siteIds: [B, B, B] });
      expect(bodyOf(res).results).toHaveLength(1);
      expect(pm.sent).toHaveLength(1);
    });

    it('uses POSTMARK_UPGRADE_STREAM and UPGRADE_EMAIL_REPLY_TO', async () => {
      process.env.POSTMARK_UPGRADE_STREAM = 'announcements';
      process.env.UPGRADE_EMAIL_REPLY_TO = 'help@autocaregenius.com';
      emailSetup();
      await send({ siteIds: [B] });
      expect(pm.sent[0]).toMatchObject({ MessageStream: 'announcements', ReplyTo: 'help@autocaregenius.com' });
      expect(marker(B).stream).toBe('announcements');
    });

    it('skips a site on hold, one created after the release, and one on an old template', async () => {
      emailSetup({
        sites: [
          ...SITES.filter((s) => ![A1, A2, B].includes(s.id)),
          live(A1, 'owner-1', 'Top Choice', 'top-choice', { created_at: `${RELEASE}T12:00:00.000Z` }),
          live(A2, 'owner-1', 'Top Choice Tint', 'top-choice-tint', { template_id: 'detailing_coastal' }),
          live(B, 'owner-2', 'Jane\'s Detail', 'janes-detail'),
        ],
        objects: { [`_backups/${B}/hold.json`]: JSON.stringify({ held: true, reason: 'manual' }) },
      });
      const r = resultsById(await send({ siteIds: [A1, A2, B] }));
      expect([r[A1].code, r[A2].code, r[B].code]).toEqual(['new_site', 'old_template', 'on_hold']);
      expect(pm.attempts).toEqual([]);
      expect(markerPuts()).toEqual([]);
    });

    it('skips a site whose old page was never replaced, or whose live page is not its new design', async () => {
      emailSetup({
        // C: first published after the release (no upgrade backup);
        // B: published from an editor opened before the release;
        // A1: the live page is another site's.
        omit: [`_backups/${C}/${UPGRADE_BACKUP}/index.html`],
        objects: {
          [`_backups/${C}/2026-10-03T10-00-00-000Z-manual-0a0b0c0d/index.html`]: 'A MANUAL BACKUP',
          'janes-detail/index.html': page(B, APP, '<h1>Old design</h1>'),
          'top-choice/index.html': newLivePage(OTHER_ID),
        },
      });
      const res = await send({ siteIds: [A1, A2, B, C] });
      const r = resultsById(res);
      expect(r[C]).toMatchObject({ status: 'skipped', code: 'never_replaced' });
      expect(r[B]).toMatchObject({ status: 'skipped', code: 'live_not_new' });
      expect(r[A1]).toMatchObject({ status: 'skipped', code: 'live_other_site' });
      // Mike is told about the one site that qualifies.
      expect(r[A2].status).toBe('sent');
      expect(sentTo()).toEqual(['mike@topchoice.com']);
      expect(pm.sent[0].Subject).toBe('Your website just got an upgrade');
      expect(pm.sent[0].TextBody).toContain('The Top Choice Tint website at https://www.topchoicetint.com');
      expect(markerPuts()).toEqual([markerKey(A2), markerKey(A2)]);
    });

    it('sends nothing for a site when it can\'t read whether its owner was emailed, or its live page', async () => {
      emailSetup({ r2opts: { failGet: (k) => k === markerKey(B) || k === 'top-choice/index.html' } });
      const r = resultsById(await send({ siteIds: [A1, B, C] }));
      expect(r[B]).toMatchObject({ status: 'failed', code: 'unreadable', reason: expect.stringMatching(/emailed/) });
      expect(r[A1]).toMatchObject({ status: 'failed', code: 'unreadable', reason: expect.stringMatching(/live page/) });
      expect(r[C]).toMatchObject({ status: 'sent' });
      expect(sentTo()).toEqual(['carl@carlsgarage.com']);
      expect(pm.sent[0].TextBody.split('\n')[0]).toBe('Hi Carl, your website just got an upgrade');
    });

    it('never greets an owner by their business name', async () => {
      const vivid = SITES.map((s) => (s.id === B ? { ...s, business_info: { businessName: 'Vivid Detailing & Customs' } } : s));
      emailSetup({
        sites: vivid,
        profiles: PROFILES.map((p) => (p.id === 'owner-2' ? { ...p, first_name: 'Vivid Detailing' } : p)),
      });
      await send({ siteIds: [B] });
      expect(pm.sent[0].TextBody.split('\n')[0]).toBe('Your website just got an upgrade');

      // The next name on the account is used instead.
      emailSetup({
        sites: vivid,
        profiles: PROFILES.map((p) => (p.id === 'owner-2' ? { ...p, first_name: 'Vivid Detailing' } : p)),
        users: USERS.map((u) => (u.id === 'owner-2' ? { ...u, user_metadata: { full_name: 'Maria Lopez' } } : u)),
      });
      await send({ siteIds: [B] });
      expect(pm.sent[0].TextBody.split('\n')[0]).toBe('Hi Maria, your website just got an upgrade');
    });
  });

  describe('failures', () => {
    it('records a refusal about one address, goes on, and lets that owner be emailed again later', async () => {
      emailSetup({ postmark: { reject: (m) => (m.To === 'mike@topchoice.com' ? { status: 422, ErrorCode: 406, Message: 'Inactive recipient' } : null) } });
      const res = await send({ siteIds: [A1, A2, B] });
      expect(res.statusCode).toBe(200);
      const r = resultsById(res);
      expect(r[A1]).toMatchObject({ status: 'failed', code: 'refused_recipient', to: 'mike@topchoice.com', reason: expect.stringMatching(/Inactive recipient/), marker: { state: 'refused' } });
      expect(r[A2].status).toBe('failed');
      expect(r[B].status).toBe('sent');
      expect(bodyOf(res).stopped).toBe(false);
      expect(marker(A1)).toMatchObject({ state: 'refused', code: 406, error: expect.stringMatching(/Inactive recipient/) });
      expect(marker(B).state).toBe('sent');

      // Nothing went out to Mike, so a later run may try him again.
      const again = resultsById(await send({ siteIds: [A1, A2, B] }));
      expect(again[A1].status).toBe('failed');
      expect(again[B].code).toBe('already_emailed');
      expect(pm.attempts.map((m) => m.To)).toEqual(['mike@topchoice.com', 'jane@janesdetail.com', 'mike@topchoice.com']);
    });

    it.each([
      ['a bad token', { status: 401, ErrorCode: 10, Message: 'Bad or missing API token' }],
      ['an invalid ReplyTo (Postmark 300 not about the To address)', { status: 422, ErrorCode: 300, Message: 'Invalid \'ReplyTo\' address: \'help at acg\'.' }],
    ])('stops at an error that would hit every owner (%s), keeping what was done', async (_, refusal) => {
      emailSetup({ postmark: { reject: (m) => (m.To === 'jane@janesdetail.com' ? refusal : null) } });
      const res = await send({ siteIds: [A1, A2, B, C] });
      const out = bodyOf(res);
      expect(out.stopped).toBe(true);
      expect(out.stopReason).toContain(refusal.Message);
      const r = resultsById(res);
      expect([r[A1].status, r[A2].status, r[B].status, r[C].status]).toEqual(['sent', 'sent', 'failed', 'not_attempted']);
      expect(r[B].code).toBe('refused');
      expect([marker(A1).state, marker(A2).state, marker(B).state]).toEqual(['sent', 'sent', 'refused']);
      expect(r2.store.has(markerKey(C))).toBe(false);
      expect(pm.attempts.map((m) => m.To)).toEqual(['mike@topchoice.com', 'jane@janesdetail.com']);
    });

    it.each([
      ['Postmark does not answer', { noAnswer: (m) => m.To === 'mike@topchoice.com' }, 0],
      ['Postmark accepts it but the answer is lost', { lostAnswer: (m) => m.To === 'mike@topchoice.com' }, 1],
      ['Postmark has a server error', { reject: (m) => (m.To === 'mike@topchoice.com' ? { status: 500, ErrorCode: 0, Message: 'Internal Server Error' } : null) }, 0],
    ])('when %s, keeps the site claimed and never sends it again', async (_, postmark, delivered) => {
      emailSetup({ postmark });
      const res = await send({ siteIds: [A1, A2, B] });
      const r = resultsById(res);
      expect(r[A1]).toMatchObject({ status: 'failed', uncertain: true, reason: expect.stringMatching(/Activity/), marker: { state: 'sending' } });
      expect(r[A2]).toMatchObject({ status: 'failed', uncertain: true });
      expect(r[B].status).toBe('not_attempted');
      expect(bodyOf(res).stopped).toBe(true);
      expect([marker(A1).state, marker(A2).state]).toEqual(['sending', 'sending']);
      expect(pm.sent.filter((m) => m.To === 'mike@topchoice.com')).toHaveLength(delivered);

      // The next call (a retyped SEND) leaves Mike alone and goes on.
      const again = resultsById(await send({ siteIds: [A1, A2, B] }));
      expect(again[A1]).toMatchObject({ status: 'skipped', code: 'unconfirmed', marker: { state: 'sending', to: 'mike@topchoice.com' } });
      expect(again[A2].code).toBe('unconfirmed');
      expect(again[B].status).toBe('sent');
      expect(pm.attempts.filter((m) => m.To === 'mike@topchoice.com')).toHaveLength(1);
    });

    it('reports a sent email whose "sent" record could not be written, keeps it claimed, and stops', async () => {
      emailSetup({ r2opts: { failPut: (k, body) => k === markerKey(A1) && JSON.parse(body).state === 'sent' } });
      const res = await send({ siteIds: [A1, A2, B] });
      const out = bodyOf(res);
      const r = resultsById(res);
      expect(r[A1]).toMatchObject({ status: 'sent', messageId: 'pm-msg-1', marker: { state: 'sending' }, markerError: expect.stringMatching(/unconfirmed/) });
      expect(r[A2]).toMatchObject({ status: 'sent', marker: { state: 'sent' } });
      expect(r[A2].markerError).toBeUndefined();
      expect(r[B].status).toBe('not_attempted');
      expect(out.stopped).toBe(true);
      expect(out.stopReason).toMatch(/could not be recorded/);
      // Retried before giving up.
      expect(markerPuts().filter((k) => k === markerKey(A1))).toHaveLength(4);
      expect(marker(A1).state).toBe('sending');

      const again = resultsById(await send({ siteIds: [A1, A2, B] }));
      expect([again[A1].code, again[A2].code, again[B].status]).toEqual(['unconfirmed', 'already_emailed', 'sent']);
      expect(sentTo()).toEqual(['mike@topchoice.com', 'jane@janesdetail.com']);
    });

    it('sends nothing when the claim can\'t be written, and undoes the claims that were', async () => {
      let broken = true;
      emailSetup({ r2opts: { failPut: (k, body) => broken && k === markerKey(A2) && JSON.parse(body).state === 'sending' } });
      const res = await send({ siteIds: [A1, A2, B] });
      const r = resultsById(res);
      expect(r[A1]).toMatchObject({ status: 'failed', code: 'claim_failed', reason: expect.stringMatching(/nothing was sent/) });
      expect(r[A2]).toMatchObject({ status: 'failed', code: 'claim_failed' });
      expect(r[B].status).toBe('not_attempted');
      expect(bodyOf(res).stopped).toBe(true);
      expect(pm.attempts).toEqual([]);
      expect(marker(A1).state).toBe('cleared');
      expect(r2.store.has(markerKey(A2))).toBe(false);

      broken = false;
      const again = resultsById(await send({ siteIds: [A1, A2, B] }));
      expect([again[A1].status, again[A2].status, again[B].status]).toEqual(['sent', 'sent', 'sent']);
      expect(sentTo()).toEqual(['mike@topchoice.com', 'jane@janesdetail.com']);
    });

    it('gives up on a claim R2 does not answer, and sends nothing', async () => {
      emailSetup({ r2opts: { hangPut: (k) => k === markerKey(B) } });
      const res = await send({ siteIds: [B] });
      expect(resultsById(res)[B]).toMatchObject({ status: 'failed', code: 'claim_failed', reason: expect.stringMatching(/no answer/) });
      expect(pm.attempts).toEqual([]);
    });

    it('leaves a site alone that another send claimed in the meantime', async () => {
      let gets = 0;
      const other = { state: 'sending', siteId: B, to: 'jane@janesdetail.com', runId: 'other-run-1', claimId: 'theirs', at: '2026-10-03T10:00:00.000Z' };
      // The marker appears after this call first read it (2nd read: right
      // before claiming).
      emailSetup({ r2opts: { failGet: (k) => { if (k === markerKey(B) && ++gets === 2) r2.store.set(k, JSON.stringify(other)); return false; } } });
      let r = resultsById(await send({ siteIds: [B] }));
      expect(r[B]).toMatchObject({ status: 'skipped', code: 'unconfirmed' });
      expect(pm.attempts).toEqual([]);
      expect(marker(B)).toEqual(other);

      // ... or overwrote this call's claim (3rd read: reading it back).
      gets = 0;
      emailSetup({ r2opts: { failGet: (k) => { if (k === markerKey(B) && ++gets === 3) r2.store.set(k, JSON.stringify(other)); return false; } } });
      const res = await send({ siteIds: [B] });
      r = resultsById(res);
      expect(r[B]).toMatchObject({ status: 'skipped', code: 'claimed_elsewhere' });
      expect(bodyOf(res).stopped).toBe(true);
      expect(pm.attempts).toEqual([]);
      expect(marker(B)).toEqual(other);
    });

    it('defers the owners left once its time is used, and sends them in the next call', async () => {
      let late = false;
      vi.spyOn(Date, 'now').mockImplementation(() => (late ? 60_000 : 0));
      emailSetup({ postmark: { reject: () => { late = true; return null; } } });
      const res = await send({ siteIds: [A1, A2, B] });
      const r = resultsById(res);
      expect([r[A1].status, r[A2].status, r[B].status]).toEqual(['sent', 'sent', 'deferred']);
      expect(bodyOf(res).stopped).toBe(false);
      expect(r2.store.has(markerKey(B))).toBe(false);

      late = false;
      const next = resultsById(await send({ siteIds: [B] }));
      expect(next[B].status).toBe('sent');
      expect(sentTo()).toEqual(['mike@topchoice.com', 'jane@janesdetail.com']);
    });

    it('starts no send when the reads before it used up the time (the reads count)', async () => {
      let now = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      // The clock jumps once the request is under way.
      emailSetup({ r2opts: { failPut: (k) => { if (k === LEASE_KEY) now = 6_000; return false; } } });
      const res = await send({ siteIds: [A1, A2, B] });
      expect(bodyOf(res).results.map((x) => x.status)).toEqual(['deferred', 'deferred', 'deferred']);
      expect(pm.attempts).toEqual([]);
      expect(markerPuts()).toEqual([]);
    });
  });

  describe('one run at a time', () => {
    const lease = (extra = {}) => ({
      runId: 'other-run-1', by: { id: 'admin-2', email: 'boss@acg.test' }, startedAt: '2026-10-03T10:00:00.000Z',
      expiresAt: new Date(Date.now() + 30_000).toISOString(), ...extra,
    });

    it('refuses a send while another run holds the lease, and sends nothing', async () => {
      emailSetup({ objects: { [LEASE_KEY]: JSON.stringify(lease()) } });
      const res = await send({ siteIds: [A1, B] });
      expect(res.statusCode).toBe(409);
      expect(bodyOf(res).error).toMatch(/boss@acg\.test is sending owner emails/);
      expect(pm.attempts).toEqual([]);
      expect(markerPuts()).toEqual([]);
      expect(JSON.parse(r2.store.get(LEASE_KEY)).runId).toBe('other-run-1');
    });

    it('goes ahead once that lease has lapsed or was released', async () => {
      for (const held of [lease({ expiresAt: new Date(Date.now() - 1000).toISOString() }), lease({ released: true })]) {
        emailSetup({ objects: { [LEASE_KEY]: JSON.stringify(held) } });
        expect(resultsById(await send({ siteIds: [B] }))[B].status).toBe('sent');
        expect(JSON.parse(r2.store.get(LEASE_KEY)).runId).toBe(RUN);
      }
    });

    it('lets one of two runs started together send, never both', async () => {
      emailSetup();
      const [x, y] = await Promise.all([send({ siteIds: [B], runId: 'run-aaaa-1' }), send({ siteIds: [B], runId: 'run-bbbb-2' })]);
      const sentCount = [x, y].filter((res) => res.statusCode === 200 && bodyOf(res).results[0].status === 'sent').length;
      expect(sentCount).toBe(1);
      expect(pm.sent).toHaveLength(1);
    });

    it('emailRelease frees the lease of its own run only', async () => {
      emailSetup();
      await send({ siteIds: [B] });
      expect(bodyOf(await act({ action: 'emailRelease', runId: 'run-other-9' }))).toEqual({ released: false });
      expect((await send({ siteIds: [C], runId: 'run-other-9' })).statusCode).toBe(409);
      expect(bodyOf(await act({ action: 'emailRelease', runId: RUN }))).toEqual({ released: true });
      expect(JSON.parse(r2.store.get(LEASE_KEY))).toMatchObject({ runId: RUN, released: true });
      expect(resultsById(await send({ siteIds: [C], runId: 'run-other-9' }))[C].status).toBe('sent');
      expect((await act({ action: 'emailRelease', runId: 'bad id' })).statusCode).toBe(400);
    });
  });

  describe('resolving an unconfirmed email', () => {
    async function unconfirmed() {
      emailSetup({ postmark: { noAnswer: (m) => m.To === 'jane@janesdetail.com' } });
      await send({ siteIds: [B] });
      expect(marker(B).state).toBe('sending');
      pm = fakePostmark();
      vi.stubGlobal('fetch', routeFetch(r2, pm));
    }

    it('waits for the run to end, then "not_sent" lets the owner be emailed', async () => {
      await unconfirmed();
      // The run that left it is still holding the lease.
      expect((await act({ action: 'emailResolve', siteId: B, outcome: 'not_sent' })).statusCode).toBe(409);
      await act({ action: 'emailRelease', runId: RUN });

      const res = await act({ action: 'emailResolve', siteId: B, outcome: 'not_sent' });
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res).marker).toMatchObject({ state: 'cleared', resolved: { by: { id: ADMIN.id }, outcome: 'not_sent' } });
      expect(marker(B)).toMatchObject({ state: 'cleared', to: 'jane@janesdetail.com', resolved: { outcome: 'not_sent' } });
      expect(resultsById(await send({ siteIds: [B], runId: 'run-next-2' }))[B].status).toBe('sent');
      expect(sentTo()).toEqual(['jane@janesdetail.com']);
    });

    it('"sent" settles it for good', async () => {
      await unconfirmed();
      await act({ action: 'emailRelease', runId: RUN });
      const res = await act({ action: 'emailResolve', siteId: B, outcome: 'sent' });
      expect(bodyOf(res).marker).toMatchObject({ state: 'sent', to: 'jane@janesdetail.com' });
      expect(resultsById(await send({ siteIds: [B], runId: 'run-next-2' }))[B].code).toBe('already_emailed');
      expect(pm.attempts).toEqual([]);
      await act({ action: 'emailRelease', runId: 'run-next-2' });
      // Only an unconfirmed one can be settled.
      expect((await act({ action: 'emailResolve', siteId: B, outcome: 'not_sent' })).statusCode).toBe(409);
    });

    it('refuses a bad outcome, a site never emailed, and a missing site', async () => {
      emailSetup();
      expect((await act({ action: 'emailResolve', siteId: B, outcome: 'maybe' })).statusCode).toBe(400);
      expect((await act({ action: 'emailResolve', siteId: B, outcome: 'sent' })).statusCode).toBe(409);
      expect((await act({ action: 'emailResolve', siteId: MISSING, outcome: 'sent' })).statusCode).toBe(404);
      expect((await act({ action: 'emailResolve', siteId: DONE, outcome: 'not_sent' })).statusCode).toBe(409);
      expect(markerPuts()).toEqual([]);
    });
  });

  describe('test send', () => {
    it('sends one copy to the admin\'s own address and records nothing', async () => {
      emailSetup();
      // No confirmation word, run or origin needed: it only reaches the admin.
      const res = await handler(post({ action: 'emailSend', siteIds: [A1, A2], testTo: ' Admin@ACG.test ' }));
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res)).toMatchObject({ test: true, to: ADMIN.email, messageId: 'pm-msg-1', ownerEmail: 'mike@topchoice.com', stream: 'broadcast' });
      expect(pm.sent).toHaveLength(1);
      expect(pm.sent[0]).toMatchObject({ To: ADMIN.email, Subject: '[Test] Your websites just got an upgrade', MessageStream: 'broadcast' });
      expect(pm.sent[0].TextBody).toContain('Hi Mike, your websites just got an upgrade');
      expect(pm.sent[0].TextBody).toContain('https://www.topchoicetint.com');
      expect(puts()).toEqual([]);
    });

    it('works before POSTMARK_UPGRADE_STREAM is set, on the transactional stream', async () => {
      delete process.env.POSTMARK_UPGRADE_STREAM;
      emailSetup();
      const res = await handler(post({ action: 'emailSend', siteIds: [B], testTo: ADMIN.email }));
      expect(res.statusCode).toBe(200);
      expect(pm.sent[0].MessageStream).toBe('outbound');
    });

    it('works for a site that would be skipped, still recording nothing', async () => {
      emailSetup();
      const res = await handler(post({ action: 'emailSend', siteIds: [DONE], testTo: ADMIN.email }));
      expect(res.statusCode).toBe(200);
      expect(sentTo()).toEqual([ADMIN.email]);
      expect(r2.store.get(markerKey(DONE))).toBe(JSON.stringify(DONE_MARKER));
      expect(puts()).toEqual([]);
    });

    it('only goes to the signed-in admin', async () => {
      emailSetup();
      for (const testTo of ['mike@topchoice.com', 'someone@else.com', '', 'not an address']) {
        const res = await handler(post({ action: 'emailSend', siteIds: [A1], testTo }));
        expect(res.statusCode).toBe(400);
      }
      expect(pm.attempts).toEqual([]);
    });

    it('reports a refused test', async () => {
      emailSetup({ postmark: { reject: () => ({ status: 422, ErrorCode: 300, Message: 'Invalid \'To\' address' }) } });
      const res = await handler(post({ action: 'emailSend', siteIds: [A1], testTo: ADMIN.email }));
      expect(res.statusCode).toBe(422);
      expect(bodyOf(res).error).toMatch(/Invalid 'To' address/);
    });
  });

  describe('preview and status', () => {
    it('emailPreview: the email the owner would get, where it would go, and nothing sent', async () => {
      emailSetup();
      const res = await handler(post({ action: 'emailPreview', siteId: A1 }));
      expect(res.statusCode).toBe(200);
      const out = bodyOf(res);
      expect(out).toMatchObject({
        to: 'mike@topchoice.com', firstName: 'Mike', skip: null, marker: null, publishedAtTracked: true,
        subject: 'Your websites just got an upgrade', from: 'hello@autocaregeniushub.com', replyTo: ADMIN.email,
        stream: 'broadcast', streamSet: true, ready: true, ownerReady: true,
      });
      expect(out.sites.map((s) => s.id)).toEqual([A1, A2]);
      expect(out.sites[1].siteUrl).toBe('https://www.topchoicetint.com');
      expect(out.html).toContain('Top Choice');
      expect(out.text).toContain('Your websites:');
      expect(pm.attempts).toEqual([]);
      expect(puts()).toEqual([]);
    });

    it('emailPreview: says why an owner would be skipped', async () => {
      emailSetup({ omit: [`_backups/${C}/${UPGRADE_BACKUP}/index.html`] });
      let out = bodyOf(await handler(post({ action: 'emailPreview', siteId: ADM })));
      expect(out.skip).toMatchObject({ code: 'admin_owner' });
      expect(out.sites.map((s) => s.id)).toEqual([ADM]);
      expect(out.html).toContain('Demo Shop');
      out = bodyOf(await handler(post({ action: 'emailPreview', siteId: DONE })));
      expect(out.skip).toMatchObject({ code: 'already_emailed' });
      expect(out.marker).toMatchObject({ state: 'sent', at: DONE_MARKER.at, to: 'done@donedeal.com', by: { id: ADMIN.id } });
      out = bodyOf(await handler(post({ action: 'emailPreview', siteId: C })));
      expect(out.skip).toMatchObject({ code: 'never_replaced' });
      expect(pm.attempts).toEqual([]);
    });

    it('emailPreview: works before the published_at migration (nothing counts as upgraded)', async () => {
      emailSetup({ dbopts: { publishedAtError: { code: '42703', message: 'column sites.published_at does not exist' } } });
      const out = bodyOf(await handler(post({ action: 'emailPreview', siteId: A1 })));
      expect(out.publishedAtTracked).toBe(false);
      expect(out.skip).toMatchObject({ code: 'not_upgraded' });
    });

    it('emailPreview: validates the site', async () => {
      emailSetup();
      expect((await handler(post({ action: 'emailPreview', siteId: 'top-choice' }))).statusCode).toBe(400);
      expect((await handler(post({ action: 'emailPreview', siteId: MISSING }))).statusCode).toBe(404);
    });

    it('emailStatus: each site\'s marker, owner address and greeting, the setup, and a run in progress', async () => {
      emailSetup({ r2opts: { failGet: (k) => k === markerKey(B) } });
      const res = await handler(post({ action: 'emailStatus', siteIds: [A1, DONE, B, MISSING] }));
      expect(res.statusCode).toBe(200);
      const out = bodyOf(res);
      expect(out.sites[A1]).toEqual({ marker: null, to: 'mike@topchoice.com', greeting: 'Mike' });
      expect(out.sites[DONE]).toMatchObject({ marker: { state: 'sent', at: DONE_MARKER.at, to: 'done@donedeal.com', messageId: 'old-msg' }, greeting: null });
      expect(out.sites[B]).toMatchObject({ error: expect.stringMatching(/R2 read failed/), to: 'jane@janesdetail.com', greeting: 'Jane' });
      expect(out.sites[MISSING]).toEqual({ marker: null, to: null, greeting: null });
      expect(out.config).toEqual({
        ready: true, ownerReady: true, missing: [], invalid: [], ownerMissing: [],
        from: 'hello@autocaregeniushub.com', stream: 'broadcast', streamSet: true, streamInfo: { found: true, type: 'Broadcasts' },
      });
      expect(out.run).toBeNull();
      expect((await handler(post({ action: 'emailStatus', siteIds: ['nope'] }))).statusCode).toBe(400);
      expect(puts()).toEqual([]);
      expect(pm.attempts).toEqual([]);
    });

    it('emailStatus: shows a run in progress and a stream that is missing or transactional', async () => {
      emailSetup();
      await send({ siteIds: [B] });
      let out = bodyOf(await handler(post({ action: 'emailStatus', siteIds: [B] })));
      expect(out.run).toMatchObject({ by: { id: ADMIN.id, email: ADMIN.email }, startedAt: expect.any(String) });
      expect(out.sites[B].marker).toMatchObject({ state: 'sent', to: 'jane@janesdetail.com' });

      process.env.POSTMARK_UPGRADE_STREAM = 'outbound';
      out = bodyOf(await handler(post({ action: 'emailStatus', siteIds: [B] })));
      expect(out.config.streamInfo).toEqual({ found: true, type: 'Transactional' });
      process.env.POSTMARK_UPGRADE_STREAM = 'no-such-stream';
      out = bodyOf(await handler(post({ action: 'emailStatus', siteIds: [B] })));
      expect(out.config.streamInfo).toEqual({ found: false });
      delete process.env.POSTMARK_UPGRADE_STREAM;
      out = bodyOf(await handler(post({ action: 'emailStatus', siteIds: [B] })));
      expect(out.config).toMatchObject({ ready: true, ownerReady: false, ownerMissing: ['POSTMARK_UPGRADE_STREAM'], stream: 'outbound', streamSet: false });
    });
  });
});
