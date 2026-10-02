// tests/functions/custom-site-design.test.js
//
// Custom website projects, part 2: the Design step (custom-site-admin
// design-save / design-generate, custom-site-design-background) and the
// hand-over to the customer's account. Supabase is an in-memory fake.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

vi.mock('../../netlify/functions/_lib/postmark.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    customSiteWelcome: vi.fn(async () => ({})),
    customSiteDraft: vi.fn(async () => ({})),
    customSiteLive: vi.fn(async () => ({})),
    customSiteHandover: vi.fn(async () => ({})),
  };
});

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { runDesign } = await import('../../netlify/functions/custom-site-design-background.js');
const { requestDesignCopy } = await import('../../netlify/functions/_lib/custom-site-design-ai.js');
const { handler: adminHandler } = await import('../../netlify/functions/custom-site-admin.js');

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SITE_ID = '22222222-3333-4444-8555-666666666666';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const STARTED = '2026-10-02T12:00:00.000Z';

function fakeDb({ projects = [], profiles = [ADMIN], sites = [], bookings = [], authUsers = [] } = {}) {
  const state = { projects, profiles, sites, bookings, inquiries: [], charges: [], events: [], authUsers, created: [], links: [], updatedUsers: [] };
  const tableOf = (t) => ({
    custom_site_projects: 'projects', custom_site_project_events: 'events', profiles: 'profiles', sites: 'sites',
    bookings: 'bookings', inquiries: 'inquiries', charges: 'charges',
  })[t];
  // Like PostgREST: timestamptz comes back as '…+00:00', never '…Z'.
  const pgTime = (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? v.replace(/\.000Z$/, '+00:00').replace(/Z$/, '+00:00') : v);
  const copy = (r) => (r ? Object.fromEntries(Object.entries(structuredClone(r)).map(([k, v]) => [k, k.endsWith('_at') ? pgTime(v) : v])) : null);

  function run(q) {
    const key = tableOf(q.table);
    const rows = state[key];
    const eqs = q.ops.filter((o) => o[0] === 'eq');
    const match = (r) => eqs.every(([, c, v]) => r[c] === v);
    const op = (n) => q.ops.find((o) => o[0] === n);
    const single = op('single') || op('maybeSingle');
    if (op('insert')) {
      const row = { ...op('insert')[1] };
      if (key === 'events') row.created_at = row.created_at || new Date().toISOString();
      rows.push(row);
      return { data: copy(row), error: null };
    }
    if (op('delete')) { state[key] = rows.filter((r) => !match(r)); return { error: null }; }
    const hits = rows.filter(match);
    if (op('update')) {
      hits.forEach((r) => Object.assign(r, op('update')[1]));
      if (single) return { data: copy(hits[0]), error: null };
      return op('select') ? { data: hits.map((r) => ({ id: r.id })), error: null } : { error: null };
    }
    return single ? { data: copy(hits[0]), error: null } : { data: hits.map(copy), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'order', 'limit']) {
      api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  const auth = {
    admin: {
      createUser: async ({ email, user_metadata }) => {
        const id = `user-${state.authUsers.length + 1}`;
        state.authUsers.push({ id, email, email_confirmed_at: '2026-10-02T00:00:00Z' });
        state.created.push({ email, user_metadata });
        // The signup trigger creates the profile with the email only.
        state.profiles.push({ id, email, scheduler_enabled: false });
        return { data: { user: { id, email } }, error: null };
      },
      generateLink: async ({ type, email, options }) => {
        state.links.push({ type, email, redirectTo: options?.redirectTo });
        return { data: { properties: { action_link: `https://auth.test/verify?type=${type}&email=${email}` } }, error: null };
      },
      getUserById: async (id) => ({ data: { user: state.authUsers.find((u) => u.id === id) || null }, error: null }),
      updateUserById: async (id, attrs) => {
        state.updatedUsers.push({ id, ...attrs });
        const u = state.authUsers.find((x) => x.id === id);
        if (u && attrs.email_confirm) u.email_confirmed_at = new Date().toISOString();
        return { data: { user: u }, error: null };
      },
      // Accounts created here are confirmed (email_confirm: true).
    },
  };
  const storage = { from: () => ({ createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}` })), error: null }) }) };
  return { from, auth, storage, state };
}

const DESIGN = {
  businessInfo: {
    businessName: 'Gloss Boss', businessType: 'mobile_detailing', phone: '555', city: 'Austin', state: 'TX',
    address: '', serviceArea: 'Austin', hours: 'Daily 9-5', tagline: '', specialties: 'Fast',
    services: [{ name: 'Wash', price: '$40', description: '' }, { name: 'Wax', price: '$80', description: '' }],
    instagram: '', facebook: '', tiktok: '',
  },
  templateId: 'mobile_chrome',
  template: { label: 'Chrome Elite', mood: 'luxury' },
  customColors: { accent: '#cc0000' },
  slots: { logo: '', hero: '', about: '', gallery: [] },
  images: { logo: 'https://x.supabase.co/storage/v1/object/public/site-images/s/logo.jpg' },
  imported: {},
  siteId: SITE_ID,
};

function project(extra = {}) {
  return {
    id: PROJECT_ID, token: 'tok_abcdefghijklmnopqrstuv', stage: 'form_received', client_first_name: 'Dana', client_last_name: 'Ruiz',
    client_name: 'Dana Ruiz', client_email: 'dana@gloss.test', client_phone: '555', business_name: 'Gloss Boss',
    form: { businessName: 'Gloss Boss', about: 'Started in 2019', testimonials: '"Great" - Ana' }, assets: [],
    invite_count: 1, admin_notes: '', created_by: 'admin-1', design: DESIGN, design_status: 'generating',
    design_started_at: STARTED, site_id: null, customer_user_id: null, handed_over_at: null, ...extra,
  };
}

const COPY_JSON = JSON.stringify({
  headline: 'Austin\'s mobile shine', subheadline: 'We come to you', aboutText: 'Since 2019.',
  servicesSection: { intro: 'Services', items: [{ name: 'Wash', description: 'Hand wash' }] },
  ctaPrimary: 'Book now', ctaSecondary: 'Call', testimonialPlaceholders: [{ text: 'Great', name: 'Ana' }],
  metaDescription: 'd', metaTitle: 't', keywords: ['austin detailing'], footerTagline: 'Shine on',
});

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      create: vi.fn(async (body, opts) => {
        calls.push({ body, opts });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      }),
    },
  };
}
const ok = (text = COPY_JSON) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] });
const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 'admin-1' };
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
});

// ─── The model request ────────────────────────────────────────────────

describe('requestDesignCopy', () => {
  it('asks Claude Opus 5.5 at high effort for schema JSON, with the refusal fallback', async () => {
    const client = fakeClient([ok()]);
    const { raw } = await requestDesignCopy(client, { system: 's', user: 'u' });
    expect(raw.headline).toBe('Austin\'s mobile shine');
    const { body, opts } = client.calls[0];
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.output_config.effort).toBe('high');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.fallbacks).toBe('default');
    expect(opts.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    expect(body.temperature).toBeUndefined();
    expect(body.thinking).toBeUndefined();
  });

  it('retries as a plain request when the structured one is rejected', async () => {
    const client = fakeClient([Object.assign(new Error('bad request'), { status: 400 }), ok()]);
    await requestDesignCopy(client, { system: 's', user: 'u' });
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].body.output_config).toEqual({ effort: 'high' });
    expect(client.calls[1].body.fallbacks).toBeUndefined();
  });

  it('reports a refusal and a cut-off answer plainly', async () => {
    await expect(requestDesignCopy(fakeClient([{ stop_reason: 'refusal', content: [] }]), { system: 's', user: 'u' })).rejects.toMatchObject({ code: 'refusal' });
    await expect(requestDesignCopy(fakeClient([{ stop_reason: 'max_tokens', content: [] }]), { system: 's', user: 'u' })).rejects.toMatchObject({ code: 'max_tokens' });
  });
});

// ─── The background run ───────────────────────────────────────────────

describe('custom-site-design-background runDesign', () => {
  it('matches its run although Postgres writes the start time as +00:00', async () => {
    const db = fakeDb({ projects: [project({ design_started_at: '2026-10-02T12:00:00+00:00' })] });
    const res = await runDesign({ db, client: fakeClient([ok()]), projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    expect(res.status).toBe(200);
    expect(db.state.sites).toHaveLength(1);
  });

  it('runs only the run design-generate claimed', async () => {
    const db = fakeDb({ projects: [project()] });
    const client = fakeClient([ok()]);
    const res = await runDesign({ db, client, projectId: PROJECT_ID, startedAt: 'other', adminUser: { id: 'admin-1' }, actor: 'admin@acg.test' });
    expect(res.status).toBe(409);
    expect(client.calls).toHaveLength(0);
  });

  it('writes the copy and creates the site under the admin, marked as a project site', async () => {
    const db = fakeDb({ projects: [project()] });
    const res = await runDesign({ db, client: fakeClient([ok()]), projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'admin@acg.test' });
    expect(res.status).toBe(200);
    const site = db.state.sites[0];
    expect(site).toEqual(expect.objectContaining({ id: SITE_ID, user_id: 'admin-1', site_type: 'website', template_id: 'mobile_chrome' }));
    expect(site.business_info).toEqual(expect.objectContaining({ businessName: 'Gloss Boss', city: 'Austin', customProjectId: PROJECT_ID }));
    expect(site.business_info.packages).toEqual(site.business_info.services);
    expect(site.generated_content.headline).toBe('Austin\'s mobile shine');
    expect(site.generated_content.servicesSection.items).toEqual([{ name: 'Wash', description: 'Hand wash' }, { name: 'Wax', description: '' }]);
    // Package cards show the package's own description.
    expect(site.business_info.packages[0]).toEqual({ name: 'Wash', price: '$40', description: 'Hand wash' });
    expect(site.generated_content._images).toEqual(DESIGN.images);
    expect(site.generated_content._customColors).toEqual({ accent: '#cc0000' });
    const p = db.state.projects[0];
    expect(p).toEqual(expect.objectContaining({ site_id: SITE_ID, design_status: 'ready', design_error: null }));
    expect(db.state.events.map((e) => e.type)).toEqual(['design_ready']);
  });

  it('rewriting replaces text and facts, and photos/colors only where the setup changed them', async () => {
    const db = fakeDb({
      projects: [project({ site_id: SITE_ID, design: { ...DESIGN, imagesChanged: [], colorsChanged: false } })],
      sites: [{ id: SITE_ID, user_id: 'admin-1', template_id: 'mobile_chrome', business_info: { businessName: 'Old', address: '1 Old Rd', extraFromEditor: 1 }, generated_content: { headline: 'Old', sectionOrder: ['hero'], _images: { gallery0: 'g.jpg', logo: 'editor-logo.png' }, _customColors: { accent: '#00ff00' } } }],
    });
    await runDesign({ db, client: fakeClient([ok()]), projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    const site = db.state.sites[0];
    expect(site.user_id).toBe('admin-1');
    expect(site.generated_content.headline).toBe('Austin\'s mobile shine');
    expect(site.generated_content.sectionOrder).toEqual(['hero']);
    // Nothing changed in the setup: the editor's photo and color stay.
    expect(site.generated_content._images).toEqual({ gallery0: 'g.jpg', logo: 'editor-logo.png' });
    expect(site.generated_content._customColors).toEqual({ accent: '#00ff00' });
    // Facts come from the design: the cleared address is gone, editor-only keys stay.
    expect(site.business_info.businessName).toBe('Gloss Boss');
    expect(site.business_info.address).toBeUndefined();
    expect(site.business_info.extraFromEditor).toBe(1);
    expect(db.state.events.at(-1)).toEqual(expect.objectContaining({ type: 'design_ready', data: expect.objectContaining({ regenerated: true }) }));
  });

  it('a refusal marks the run failed and creates nothing', async () => {
    const db = fakeDb({ projects: [project()] });
    await runDesign({ db, client: fakeClient([{ stop_reason: 'refusal', content: [] }]), projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    expect(db.state.sites).toEqual([]);
    expect(db.state.projects[0].design_status).toBe('failed');
    expect(db.state.projects[0].design_error).toMatch(/declined/);
  });

  it('never rewrites a site already handed over', async () => {
    const db = fakeDb({ projects: [project({ handed_over_at: '2026-10-01T00:00:00Z' })] });
    const client = fakeClient([ok()]);
    await runDesign({ db, client, projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    expect(client.calls).toHaveLength(0);
    expect(db.state.projects[0].design_status).toBe('failed');
  });
});

// ─── Admin actions ────────────────────────────────────────────────────

describe('custom-site-admin design actions', () => {
  it('a run that died shows as failed on the next load, and can be retried', async () => {
    h.db = fakeDb({ projects: [project({ design_started_at: '2026-01-01T00:00:00Z' })] });
    const { project: p } = json(await adminHandler(post({ action: 'get', id: PROJECT_ID })));
    expect(p.design_status).toBe('failed');
    expect(p.design_error).toMatch(/didn't finish/);
    expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: DESIGN }))).statusCode).toBe(200);
  });

  it('design-release gives up only the run it names', async () => {
    h.db = fakeDb({ projects: [project({ design_started_at: '2026-10-02T12:00:00+00:00' })] });
    await adminHandler(post({ action: 'design-release', id: PROJECT_ID, startedAt: '2026-10-02T11:00:00.000Z', error: 'x' }));
    expect(h.db.state.projects[0].design_status).toBe('generating');
    await adminHandler(post({ action: 'design-release', id: PROJECT_ID, startedAt: STARTED, error: 'Network down' }));
    expect(h.db.state.projects[0]).toEqual(expect.objectContaining({ design_status: 'failed', design_error: expect.stringContaining('Network down') }));
  });

  it('design-save keeps the site id once a site exists and refuses while writing', async () => {
    h.db = fakeDb({ projects: [project({ design_status: 'ready', site_id: SITE_ID, design: {} })] });
    const res = await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: { ...DESIGN, siteId: '99999999-3333-4444-8555-666666666666', templateId: '../x' } }));
    expect(res.statusCode).toBe(200);
    const saved = h.db.state.projects[0].design;
    expect(saved.siteId).toBe(SITE_ID);
    expect(saved.templateId).toBe('');
    expect(saved.images).toEqual(DESIGN.images);
    Object.assign(h.db.state.projects[0], { design_status: 'generating', design_started_at: new Date().toISOString() });
    expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: DESIGN }))).statusCode).toBe(409);
  });

  it('design-generate claims a run, moves the project to Designing, and refuses a second run', async () => {
    h.db = fakeDb({ projects: [project({ design_status: 'none', design_started_at: null })] });
    const res = await adminHandler(post({ action: 'design-generate', id: PROJECT_ID }));
    expect(res.statusCode).toBe(200);
    const { startedAt, project: p } = json(res);
    expect(p.design_status).toBe('generating');
    expect(Date.parse(p.design_started_at)).toBe(Date.parse(startedAt));
    expect(p.stage).toBe('designing');
    expect(h.db.state.events.map((e) => e.type)).toEqual(['design_started', 'stage']);
    expect((await adminHandler(post({ action: 'design-generate', id: PROJECT_ID }))).statusCode).toBe(409);
  });

  it('design-generate names what is missing', async () => {
    h.db = fakeDb({ projects: [project({ design_status: 'none', design: { businessInfo: { businessName: 'A' } } })] });
    const res = await adminHandler(post({ action: 'design-generate', id: PROJECT_ID }));
    expect(res.statusCode).toBe(400);
    expect(json(res).problems).toContain('City');
  });

  it('get shows the site and takes its published address as the draft link', async () => {
    h.db = fakeDb({
      projects: [project({ design_status: 'ready', site_id: SITE_ID, site_url: null })],
      sites: [{ id: SITE_ID, user_id: 'admin-1', published_url: 'https://gloss-boss.autocaregeniushub.com', template_id: 'mobile_chrome', business_info: { businessName: 'Gloss Boss' } }],
    });
    const { project: p } = json(await adminHandler(post({ action: 'get', id: PROJECT_ID })));
    expect(p.site).toEqual(expect.objectContaining({ id: SITE_ID, ownerEmail: 'admin@acg.test', publishedUrl: 'https://gloss-boss.autocaregeniushub.com' }));
    expect(p.site_url).toBe('https://gloss-boss.autocaregeniushub.com');
    expect(h.db.state.projects[0].site_url).toBe('https://gloss-boss.autocaregeniushub.com');
  });
});

describe('custom-site-admin hand-over', () => {
  const ready = (extra = {}) => project({ design_status: 'ready', site_id: SITE_ID, ...extra });
  const site = () => ({ id: SITE_ID, user_id: 'admin-1', published_url: 'https://gloss.test', business_info: { businessName: 'Gloss Boss' } });

  it('creates the customer\'s account, moves the site and its bookings, gives Pro and emails a set-password link', async () => {
    h.db = fakeDb({ projects: [ready()], sites: [site()], bookings: [{ id: 'b1', site_id: SITE_ID, owner_user_id: 'admin-1' }, { id: 'b2', site_id: 'other', owner_user_id: 'admin-1' }] });
    const check = json(await adminHandler(post({ action: 'handover-check', id: PROJECT_ID })));
    expect(check.account).toBeNull();

    const res = await adminHandler(post({ action: 'handover', id: PROJECT_ID, compPro: true, sendEmail: true }));
    expect(res.statusCode).toBe(200);
    expect(json(res).newAccount).toBe(true);
    const { state } = h.db;
    expect(state.created).toEqual([{ email: 'dana@gloss.test', user_metadata: { first_name: 'Dana', last_name: 'Ruiz' } }]);
    const profile = state.profiles.find((p) => p.email === 'dana@gloss.test');
    expect(profile).toEqual(expect.objectContaining({ first_name: 'Dana', last_name: 'Ruiz', business_name: 'Gloss Boss', scheduler_enabled: true }));
    expect(state.sites[0].user_id).toBe(profile.id);
    expect(state.bookings.find((b) => b.id === 'b1').owner_user_id).toBe(profile.id);
    expect(state.bookings.find((b) => b.id === 'b2').owner_user_id).toBe('admin-1');
    expect(state.projects[0]).toEqual(expect.objectContaining({ customer_user_id: profile.id, handed_over_at: expect.any(String) }));
    expect(state.sites[0].business_info.customProjectId).toBeUndefined();
    expect(state.links).toEqual([{ type: 'recovery', email: 'dana@gloss.test', redirectTo: 'https://sitebuilder.autocaregenius.com' }]);
    expect(postmark.customSiteHandover).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dana@gloss.test', newAccount: true, actionUrl: expect.stringContaining('type=recovery'), siteUrl: 'https://gloss.test', replyTo: 'admin@acg.test',
    }));
    expect(state.events.map((e) => e.type)).toEqual(['handover', 'email']);
  });

  it('an existing account keeps its details and gets a sign-in link', async () => {
    const dana = { id: 'dana-1', email: 'dana@gloss.test', first_name: 'Dee', scheduler_enabled: false, subscription_status: 'active' };
    h.db = fakeDb({ projects: [ready()], sites: [site()], profiles: [ADMIN, dana], authUsers: [{ id: 'dana-1', email: 'dana@gloss.test', email_confirmed_at: '2026-09-01T00:00:00Z' }] });
    const check = json(await adminHandler(post({ action: 'handover-check', id: PROJECT_ID })));
    expect(check.account).toEqual(expect.objectContaining({ userId: 'dana-1', isPro: true }));
    await adminHandler(post({ action: 'handover', id: PROJECT_ID, compPro: false, sendEmail: true }));
    expect(h.db.state.created).toEqual([]);
    expect(h.db.state.profiles[1]).toEqual(dana);
    expect(h.db.state.sites[0].user_id).toBe('dana-1');
    expect(postmark.customSiteHandover).toHaveBeenCalledWith(expect.objectContaining({ newAccount: false, actionUrl: 'https://sitebuilder.autocaregenius.com' }));
  });

  it('secures an unconfirmed account someone else may have made: new password, set-password link', async () => {
    const squatter = { id: 'sq-1', email: 'dana@gloss.test', first_name: 'Not Dana', scheduler_enabled: false };
    h.db = fakeDb({ projects: [ready()], sites: [site()], profiles: [ADMIN, squatter], authUsers: [{ id: 'sq-1', email: 'dana@gloss.test', email_confirmed_at: null }] });
    const res = await adminHandler(post({ action: 'handover', id: PROJECT_ID, compPro: true, sendEmail: true }));
    expect(res.statusCode).toBe(200);
    expect(json(res).newAccount).toBe(true);
    expect(h.db.state.updatedUsers).toEqual([{ id: 'sq-1', email_confirm: true, password: expect.stringMatching(/^[\w-]{30,}$/) }]);
    expect(h.db.state.profiles[1]).toEqual(expect.objectContaining({ first_name: 'Dana', scheduler_enabled: true }));
    expect(h.db.state.links).toEqual([expect.objectContaining({ type: 'recovery', email: 'dana@gloss.test' })]);
  });

  it('never comps Pro on top of a paid plan', async () => {
    const payer = { id: 'p-1', email: 'dana@gloss.test', scheduler_enabled: false, subscription_status: 'active' };
    h.db = fakeDb({ projects: [ready()], sites: [site()], profiles: [ADMIN, payer], authUsers: [{ id: 'p-1', email: 'dana@gloss.test', email_confirmed_at: '2026-01-01T00:00:00Z' }] });
    await adminHandler(post({ action: 'handover', id: PROJECT_ID, compPro: true, sendEmail: false }));
    expect(h.db.state.profiles[1].scheduler_enabled).toBe(false);
    expect(h.db.state.sites[0].user_id).toBe('p-1');
  });

  it('never hands a site to an admin account', async () => {
    h.db = fakeDb({ projects: [ready({ client_email: 'admin@acg.test' })], sites: [site()], authUsers: [{ id: 'admin-1', email: 'admin@acg.test', email_confirmed_at: '2026-01-01T00:00:00Z' }] });
    const res = await adminHandler(post({ action: 'handover', id: PROJECT_ID, compPro: true }));
    expect(res.statusCode).toBe(409);
    expect(h.db.state.sites[0].user_id).toBe('admin-1');
  });

  it('needs a designed site first, and no email when asked not to', async () => {
    h.db = fakeDb({ projects: [project({ design_status: 'none', site_id: null })] });
    expect((await adminHandler(post({ action: 'handover', id: PROJECT_ID }))).statusCode).toBe(400);
    h.db = fakeDb({ projects: [ready()], sites: [site()] });
    await adminHandler(post({ action: 'handover', id: PROJECT_ID, sendEmail: false }));
    expect(postmark.customSiteHandover).not.toHaveBeenCalled();
  });
});

describe('hand-over email', () => {
  it('links to setting a password for a new account and names the sign-in email', () => {
    const { subject, html, text } = postmark.customSiteHandoverEmail({
      firstName: 'Dana', businessName: 'Gloss & Co', siteUrl: 'https://gloss.test/', actionUrl: 'https://auth.test/verify?x=1', newAccount: true, email: 'dana@gloss.test',
    });
    expect(subject).toBe('The Gloss & Co website is in your account');
    expect(html).toContain('href="https://auth.test/verify?x=1"');
    expect(html).toContain('Set my password');
    expect(html).toContain('Gloss &amp; Co');
    expect(html).toContain('dana@gloss.test');
    expect(text).toContain('Forgot password');
    expect(postmark.customSiteHandoverEmail({ firstName: '', actionUrl: 'https://app.test', newAccount: false, email: 'a@b.co' }).html).toContain('Sign in');
  });
});
