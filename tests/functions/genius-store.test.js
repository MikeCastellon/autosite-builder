// tests/functions/genius-store.test.js
//
// The editor's Genius Store relay: it vouches for the signed-in owner and
// forwards to Genius Storefronts' website-partner with the shared secret. The
// email is always the owner's, never the request's; refusals come back in
// words; missing env is a 503, not a crash.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ site: null, user: null, profile: null, updates: [], updateError: null, pilot: true }));

// The pilot switch (lib/geniusStorePilot.js) is tested on its own; here it is
// on for the test owner unless a test turns it off.
vi.mock('../../src/lib/geniusStorePilot.js', () => ({ geniusStoreAllowed: () => h.pilot }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => ({
    from: (table) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? h.profile : null }) }) }),
      update: (patch) => ({
        eq: async (col, val) => {
          h.updates.push({ table, patch, [col]: val });
          return { error: h.updateError };
        },
      }),
    }),
  }),
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in. Please sign in again.'), { status: 401 });
    return h.user;
  },
  requireSiteOwner: async (_event, siteId) => {
    if (!h.user) throw Object.assign(new Error('Not signed in. Please sign in again.'), { status: 401 });
    if (!h.site || h.site.id !== siteId) throw Object.assign(new Error('Site not found'), { status: 404 });
    if (h.site.user_id !== h.user.id) throw Object.assign(new Error('You do not own this site.'), { status: 403 });
    return { user: h.user, site: h.site };
  },
}));

const { handler } = await import('../../netlify/functions/genius-store.js');

const SITE_ID = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const URL = 'https://sf.example.test/functions/v1/website-partner';

const post = (body) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) });
const bodyOf = (res) => JSON.parse(res.body);

let calls;
function storefronts(respond) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const payload = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, payload });
    const [status, body] = respond(payload);
    return { ok: status < 400, status, json: async () => body };
  }));
}

beforeEach(() => {
  process.env.GENIUS_STOREFRONTS_URL = URL;
  process.env.GENIUS_WEBSITES_KEY = 'k3y';
  h.user = { id: 'owner-1', email: 'Owner@Shop.com' };
  h.site = {
    id: SITE_ID, user_id: 'owner-1', template_id: 'detailing_sporty', published_url: 'https://apex.autocaregeniushub.com',
    business_info: { businessName: 'Apex Detail' },
    generated_content: { headline: 'Shine', store: { title: 'Our shop' } },
  };
  h.profile = { first_name: 'Ana', last_name: 'Ruiz' };
  h.updates = [];
  h.updateError = null;
  h.pilot = true;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('genius-store', () => {
  it('enables the store for the signed-in owner, with the secret and the owner\'s own email', async () => {
    storefronts(() => [200, { ok: true, created: true, partner: { refCode: 'ACDEFGHJ' }, storefront: { slug: 'apex-detail' } }]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: '2026-09-09', accent: '#E11D48', scheme: 'dark', email: 'someone@else.com' }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toMatchObject({ storefront: { slug: 'apex-detail' }, email: 'owner@shop.com' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL);
    expect(calls[0].headers['x-genius-websites-key']).toBe('k3y');
    expect(calls[0].payload).toEqual({
      action: 'provision',
      email: 'owner@shop.com',
      siteId: SITE_ID,
      termsVersion: '2026-09-09',
      name: 'Ana Ruiz',
      company: 'Apex Detail',
      storeName: 'Apex Detail',
      accent: '#E11D48',
      scheme: 'dark',
    });
  });

  it('saves the store on a site whose design has the Shop section, keeping the owner\'s heading', async () => {
    storefronts(() => [200, { ok: true, storefront: { slug: 'apex-detail' } }]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v' }));
    expect(bodyOf(res)).toMatchObject({ siteHasShop: true, storeOnSite: 'apex-detail', published: true });
    expect(h.updates).toEqual([{
      table: 'sites',
      id: SITE_ID,
      patch: { generated_content: { headline: 'Shine', store: { title: 'Our shop', slug: 'apex-detail' } } },
    }]);
  });

  it('leaves a site on another design alone: the link and code still work there', async () => {
    h.site = { ...h.site, template_id: 'carwash_bubble' };
    storefronts(() => [200, { ok: true, storefront: { slug: 'apex-detail' } }]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v' }));
    expect(bodyOf(res)).toMatchObject({ siteHasShop: false, storeOnSite: null, storefront: { slug: 'apex-detail' } });
    expect(h.updates).toEqual([]);
  });

  it('keeps the store when saving it on the site fails', async () => {
    h.updateError = { message: 'boom' };
    storefronts(() => [200, { ok: true, storefront: { slug: 'apex-detail' } }]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v' }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toMatchObject({ storefront: { slug: 'apex-detail' }, storeOnSite: null });
  });

  it('drops an accent that is not a hex colour and falls back to the business name', async () => {
    h.profile = null;
    storefronts(() => [200, { ok: true, storefront: { slug: 'apex-detail' } }]);
    await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v', accent: 'red' }));
    expect(calls[0].payload.accent).toBeUndefined();
    expect(calls[0].payload.scheme).toBe('light');
    expect(calls[0].payload.name).toBe('Apex Detail');
  });

  it('refuses a site the caller does not own, without calling Storefronts', async () => {
    h.site = { ...h.site, user_id: 'someone-else' };
    storefronts(() => [200, {}]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v' }));
    expect(res.statusCode).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('needs the terms agreed before enabling', async () => {
    storefronts(() => [200, {}]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID }));
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res).error).toMatch(/terms/);
    expect(calls).toHaveLength(0);
  });

  it('says why in words when Storefronts refuses', async () => {
    storefronts(() => [403, { error: 'suspended' }]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v' }));
    expect(res.statusCode).toBe(403);
    expect(bodyOf(res)).toMatchObject({ code: 'suspended', error: expect.stringMatching(/on hold/) });
  });

  it('hides an unexpected Storefronts error behind a retry message', async () => {
    storefronts(() => [500, { error: 'could not create the storefront: boom' }]);
    const res = await handler(post({ action: 'enable', siteId: SITE_ID, termsVersion: 'v' }));
    expect(res.statusCode).toBe(502);
    expect(bodyOf(res).error).not.toMatch(/boom/);
  });

  it('answers 503 while the store is not configured', async () => {
    delete process.env.GENIUS_WEBSITES_KEY;
    storefronts(() => [200, {}]);
    const res = await handler(post({ action: 'status', siteId: SITE_ID }));
    expect(res.statusCode).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('relays status and terms', async () => {
    storefronts((p) => (p.action === 'terms'
      ? [200, { version: '2026-09-09', terms: [{ heading: 'H', body: ['b'] }] }]
      : [200, { partner: null, storefront: null, termsVersion: '2026-09-09' }]));
    const terms = await handler(post({ action: 'terms' }));
    expect(bodyOf(terms)).toEqual({ version: '2026-09-09', terms: [{ heading: 'H', body: ['b'] }] });
    const status = await handler(post({ action: 'status', siteId: SITE_ID }));
    expect(bodyOf(status)).toMatchObject({ partner: null, email: 'owner@shop.com', siteHasShop: true, storeOnSite: null, published: true });
    expect(calls[1].payload).toEqual({ action: 'status', email: 'owner@shop.com', siteId: SITE_ID });
  });

  it('needs a signed-in user even for the terms', async () => {
    h.user = null;
    storefronts(() => [200, {}]);
    expect((await handler(post({ action: 'terms' }))).statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('refuses owners outside the pilot, without calling Storefronts', async () => {
    h.pilot = false;
    storefronts(() => [200, {}]);
    for (const body of [{ action: 'terms' }, { action: 'status', siteId: SITE_ID }, { action: 'enable', siteId: SITE_ID, termsVersion: 'v' }]) {
      const res = await handler(post(body));
      expect(res.statusCode).toBe(403);
      expect(bodyOf(res).error).toMatch(/not available/);
    }
    expect(calls).toHaveLength(0);
    expect(h.updates).toEqual([]);
  });

  it('rejects unknown actions and bad site ids', async () => {
    storefronts(() => [200, {}]);
    expect((await handler(post({ action: 'pay-me' }))).statusCode).toBe(400);
    expect((await handler(post({ action: 'status', siteId: 'nope' }))).statusCode).toBe(400);
  });
});
