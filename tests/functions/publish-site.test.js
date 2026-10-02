// tests/functions/publish-site.test.js
//
// The owner's Publish / Republish: uploads to R2 as always, records
// published_url, then (for a website homepage only) published_at in a
// separate update that never fails the publish (the column's migration may
// land after this code). The first publish of a live website on the new
// designs backs the old page up first, and never fails over it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeR2, fakeDb, post, bodyOf } from './r2Fakes.js';

const h = vi.hoisted(() => ({ db: null, site: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireSiteOwner: async (_event, siteId) => {
    if (!h.site || h.site.id !== siteId) throw Object.assign(new Error('Site not found'), { status: 404 });
    return { user: { id: h.site.user_id }, site: h.site };
  },
}));

const { handler } = await import('../../netlify/functions/publish-site.js');

const SITE = { id: 'site-1', user_id: 'owner-1', slug: 'top-choice', published_url: null, site_type: 'website' };
const LIVE = { ...SITE, published_url: 'https://top-choice.autocaregeniushub.com', published_at: null };

let r2;
function setup({ site = SITE, r2opts, dbopts, objects = {} } = {}) {
  h.site = { ...site };
  h.db = fakeDb({ sites: [{ ...site }] }, dbopts);
  r2 = fakeR2(objects, r2opts);
  vi.stubGlobal('fetch', r2.fetch);
}
const puts = () => r2.calls.filter((c) => c[0] === 'PUT').map((c) => c[1]);

beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
  process.env.CLOUDFLARE_API_TOKEN = 'cf-token';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('publish-site', () => {
  it('uploads the page and /book page under the stored slug, then records the publish', async () => {
    setup();
    const res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>', bookingPageHtml: '<html>B</html>', slug: 'ignored' }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toEqual({
      publishedUrl: 'https://top-choice.autocaregeniushub.com',
      bookingUrl: 'https://top-choice.autocaregeniushub.com/book',
      slug: 'top-choice',
    });
    expect(r2.calls).toEqual([
      ['PUT', 'top-choice/index.html', 'text/html; charset=utf-8'],
      ['PUT', 'top-choice/book/index.html', 'text/html; charset=utf-8'],
    ]);
    expect(r2.fetch.mock.calls[0][0]).toBe('https://api.cloudflare.com/client/v4/accounts/acct/r2/buckets/autosite-published/objects/top-choice%2Findex.html');
    expect(r2.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer cf-token');
    // published_url first (as before), published_at on its own.
    expect(h.db.updates.map((u) => u.patch)).toEqual([
      { published_url: 'https://top-choice.autocaregeniushub.com' },
      { published_at: expect.any(String) },
    ]);
    expect(Date.parse(h.db.state.sites[0].published_at)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('still publishes when the published_at column does not exist yet', async () => {
    setup({ dbopts: { publishedAtError: { code: 'PGRST204', message: "Could not find the 'published_at' column of 'sites' in the schema cache" } } });
    const res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.sites[0].published_url).toBe('https://top-choice.autocaregeniushub.com');
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/published_at does not exist yet/));
  });

  it('still publishes when Postgres reports the column as undefined (42703) or the update throws', async () => {
    setup({ dbopts: { publishedAtError: { code: '42703', message: 'column "published_at" of relation "sites" does not exist' } } });
    expect((await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }))).statusCode).toBe(200);
    setup({ dbopts: { throwOnPublishedAt: true } });
    expect((await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }))).statusCode).toBe(200);
    expect(console.error).toHaveBeenCalled();
  });

  it('publishes a /book page alone without marking the website as on the new design', async () => {
    // Booking Settings refreshes only the /book shell of a live website.
    setup({ site: LIVE, objects: { 'top-choice/index.html': 'OLD' } });
    const res = await handler(post({ siteId: 'site-1', bookingPageHtml: '<html>B</html>' }));
    expect(res.statusCode).toBe(200);
    expect(puts()).toEqual(['top-choice/book/index.html']);
    expect(h.db.updates.some((u) => 'published_at' in u.patch)).toBe(false);
    expect(h.db.state.sites[0].published_at).toBeNull();
  });

  it('does not stamp published_at for a booking-only account\'s page', async () => {
    setup({ site: { ...LIVE, site_type: 'booking_only' }, objects: { 'top-choice/index.html': 'OLD SHELL' } });
    const res = await handler(post({ siteId: 'site-1', htmlContent: '<html>shell</html>' }));
    expect(res.statusCode).toBe(200);
    expect(puts()).toEqual(['top-choice/index.html']);
    expect(h.db.updates.some((u) => 'published_at' in u.patch)).toBe(false);
  });

  it('backs up the old live page before an owner\'s first new-design publish', async () => {
    setup({ site: LIVE, objects: { 'top-choice/index.html': 'OLD', 'top-choice/book/index.html': 'OLD BOOK' } });
    const res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }));
    expect(res.statusCode).toBe(200);
    const backup = puts().find((k) => /^_backups\/site-1\/[^/]+-owner-[0-9a-f]{8}\/index\.html$/.test(k));
    expect(backup).toBeTruthy();
    const folder = backup.replace(/index\.html$/, '');
    expect(puts()).toEqual([`${folder}index.html`, `${folder}book/index.html`, `${folder}meta.json`, 'top-choice/index.html']);
    expect(r2.store.get(backup)).toBe('OLD');
    expect(JSON.parse(r2.store.get(`${folder}meta.json`))).toMatchObject({ siteId: 'site-1', slug: 'top-choice', reason: 'owner', by: null });
    expect(r2.store.get('top-choice/index.html')).toBe('<html>A</html>');
  });

  it('publishes even when that backup fails', async () => {
    setup({ site: LIVE, objects: { 'top-choice/index.html': 'OLD' }, r2opts: { failPut: (k) => k.startsWith('_backups/') } });
    const res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }));
    expect(res.statusCode).toBe(200);
    expect(r2.store.get('top-choice/index.html')).toBe('<html>A</html>');
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/backup before the first new-design publish failed/), expect.anything());
  });

  it('does not back up a first publish or a site already on the new design', async () => {
    setup({ objects: { 'top-choice/index.html': 'STRAY' } });
    expect((await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }))).statusCode).toBe(200);
    expect(puts()).toEqual(['top-choice/index.html']);

    setup({ site: { ...LIVE, published_at: '2099-01-01T00:00:00.000Z' }, objects: { 'top-choice/index.html': 'NEW' } });
    expect((await handler(post({ siteId: 'site-1', htmlContent: '<html>B</html>' }))).statusCode).toBe(200);
    expect(puts()).toEqual(['top-choice/index.html']);
  });

  it('keeps its errors: missing fields, failed upload', async () => {
    setup();
    expect((await handler(post({ siteId: 'site-1' }))).statusCode).toBe(400);

    setup({ r2opts: { failPut: (k) => k === 'top-choice/index.html' } });
    let res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }));
    expect(res.statusCode).toBe(500);
    expect(bodyOf(res).error).toBe('R2 upload failed (500): boom');
    expect(h.db.updates).toEqual([]);

    setup({ r2opts: { failPut: (k) => k === 'top-choice/book/index.html' } });
    res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>', bookingPageHtml: '<html>B</html>' }));
    expect(res.statusCode).toBe(500);
    expect(bodyOf(res).error).toBe('R2 booking-page upload failed (500): boom');
  });

  it('refuses a stored slug another site also holds', async () => {
    setup();
    h.db.state.sites.push({ id: 'site-2', slug: 'top-choice' });
    const res = await handler(post({ siteId: 'site-1', htmlContent: '<html>A</html>' }));
    expect(res.statusCode).toBe(409);
    expect(r2.calls).toEqual([]);
  });
});
