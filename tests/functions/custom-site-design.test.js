// tests/functions/custom-site-design.test.js
//
// Custom website projects, part 2: the Design step (custom-site-admin
// design-save / design-generate, custom-site-design-background) and the
// hand-over to the customer's account. Supabase is an in-memory fake.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null, MORE: ['faq', 'process', 'vehicleTypes', 'comparison', 'showcase'] }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

// Bold & Sporty with its Before & After section and the More sections (a
// no-op once templateSections.js lists them; service tabs through the
// editor's capability table) and Chrome Elite without, whatever the
// templates do later.
vi.mock('../../src/data/templateSections.js', async (importOriginal) => {
  const m = await importOriginal();
  const sectionIdsFor = (id) => {
    const real = m.sectionIdsFor(id);
    if (id === 'detailing_sporty') return [...real, ...['beforeAfter', ...h.MORE].filter((s) => !real.includes(s))];
    return id === 'mobile_chrome' ? real.filter((s) => s !== 'beforeAfter' && !h.MORE.includes(s)) : real;
  };
  return { ...m, sectionIdsFor };
});
vi.mock('../../src/components/preview/editorCapabilities.js', async (importOriginal) => {
  const m = await importOriginal();
  const templateReads = (id, key) => (key === 'serviceTabs' && ['detailing_sporty', 'mobile_chrome'].includes(id)
    ? id === 'detailing_sporty' : m.templateReads(id, key));
  return { ...m, templateReads };
});

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
const { fetchSitePhoto, runDesign } = await import('../../netlify/functions/custom-site-design-background.js');
const { requestDesignCopy } = await import('../../netlify/functions/_lib/custom-site-design-ai.js');
const { handler: adminHandler } = await import('../../netlify/functions/custom-site-admin.js');
const { COPY_SCHEMA } = await import('../../src/lib/customSiteDesign.js');
const { SECTION_RULES } = await import('../../src/lib/customSiteSections.js');

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
        // The signup trigger creates the profile with the email and the
        // names passed as user metadata.
        state.profiles.push({ id, email, first_name: user_metadata?.first_name || null, last_name: user_metadata?.last_name || null, scheduler_enabled: false });
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

  it('applies the Design Studio settings on the first write, and names the hero buttons for the prompt', async () => {
    const levers = {
      palette: { bg: '#f8f8f6', text: '#111111' },
      fonts: { heading: 'Fraunces', body: 'Manrope' },
      sections: { order: ['about', 'services'], hidden: ['awards'] },
      heroLayout: 'split',
      facts: { tagline: 'Showroom shine, at your door', yearsInBusiness: '6' },
    };
    const db = fakeDb({ projects: [project({ design: { ...DESIGN, levers } })] });
    const client = fakeClient([ok()]);
    await runDesign({ db, client, projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    const site = db.state.sites[0];
    expect(site.generated_content._customColors).toEqual({ accent: '#cc0000', bg: '#f8f8f6', text: '#111111' });
    expect(site.generated_content._customFonts).toEqual({ font: "'Fraunces', Georgia, serif", bodyFont: "'Manrope', sans-serif" });
    expect(site.generated_content.sectionOrder.slice(0, 4)).toEqual(['about', 'services', 'featured', 'hero']);
    expect(site.generated_content.hiddenSections).toEqual(['awards']);
    expect(site.generated_content.heroLayout).toBe('split');
    expect(site.business_info).toEqual(expect.objectContaining({ tagline: 'Showroom shine, at your door', yearsInBusiness: '6' }));
    expect(site.generated_content.schemaType).toBe('AutoWash');
    // mobile_chrome's Button 1 scrolls to the services: the prompt says so.
    expect(client.calls[0].body.messages[0].content).toContain('Button 1 scrolls to the services list');
  });

  it('clears the changed Studio groups once the run applied them', async () => {
    const db = fakeDb({ projects: [project({ design: { ...DESIGN, levers: { heroLayout: 'split' }, leversChanged: ['layout'] } })] });
    await runDesign({ db, client: fakeClient([ok()]), projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    expect(db.state.sites[0].generated_content.heroLayout).toBe('split');
    expect(db.state.projects[0].design.leversChanged).toEqual([]);
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

  describe('Before & After pairs', () => {
    const IMG = 'https://x.supabase.co/storage/v1/object/public/site-images/s/';
    const photo = (n) => `${PROJECT_ID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.jpg`;
    // Two complete pairs around a half-picked one, copied by the setup
    // (generate: images + imported) to the keys the template reads.
    const PAIRS = {
      ...DESIGN,
      templateId: 'detailing_sporty',
      template: { label: 'Bold & Sporty', mood: 'bold' },
      slots: {
        ...DESIGN.slots,
        beforeAfter: [
          { before: photo(1), after: photo(2), caption: 'Paint correction on the hood' },
          { before: photo(3), after: '', caption: '' },
          { before: photo(4), after: photo(5), caption: '' },
        ],
      },
      beforeAfter: { title: '', intro: 'Every pair is a car we did this year.' },
      images: { ...DESIGN.images, baBefore0: `${IMG}b0.jpg`, baAfter0: `${IMG}a0.jpg`, baBefore1: `${IMG}b1.jpg`, baAfter1: `${IMG}a1.jpg` },
      imported: { baBefore0: photo(1), baAfter0: photo(2), baBefore1: photo(4), baAfter1: photo(5) },
      imagesChanged: ['baBefore0', 'baAfter0', 'baBefore1', 'baAfter1'],
      beforeAfterChanged: true,
    };
    const PAIR_IMAGES = { baBefore0: `${IMG}b0.jpg`, baAfter0: `${IMG}a0.jpg`, baBefore1: `${IMG}b1.jpg`, baAfter1: `${IMG}a1.jpg` };
    const run = (db) => runDesign({ db, client: fakeClient([ok()]), projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a' });
    // A site the editor already gave its own pairs.
    const editorSite = (templateId = 'detailing_sporty') => ({
      id: SITE_ID, user_id: 'admin-1', template_id: templateId, business_info: { businessName: 'Old' },
      generated_content: {
        headline: 'Old', beforeAfter: { title: 'Owner\'s heading', pairs: [{ caption: 'Owner\'s caption' }] },
        _images: { logo: 'editor-logo.png', baBefore0: 'editor-b0.jpg', baAfter0: 'editor-a0.jpg' },
      },
    });

    it('the first write puts the pairs on the site: their photos, captions and intro, no heading of ours', async () => {
      const db = fakeDb({ projects: [project({ design: PAIRS })] });
      expect((await run(db)).status).toBe(200);
      const content = db.state.sites[0].generated_content;
      expect(content.beforeAfter).toEqual({ intro: 'Every pair is a car we did this year.', pairs: [{ caption: 'Paint correction on the hood' }, {}] });
      expect(content._images).toEqual({ ...DESIGN.images, ...PAIR_IMAGES });
      // The changed mark is spent.
      expect(db.state.projects[0].design.beforeAfterChanged).toBe(false);
    });

    it('a template without the section gets neither the copy nor the photos, and the mark waits for one with it', async () => {
      const db = fakeDb({ projects: [project({ design: { ...PAIRS, templateId: 'mobile_chrome', leversChanged: ['layout'] } })] });
      await run(db);
      const content = db.state.sites[0].generated_content;
      expect(content).not.toHaveProperty('beforeAfter');
      expect(content._images).toEqual(DESIGN.images);
      // The Studio's mark is spent, the pairs' isn't: they were never applied.
      expect(db.state.projects[0].design.leversChanged).toEqual([]);
      expect(db.state.projects[0].design.beforeAfterChanged).toBe(true);
    });

    it('a rewrite that keeps the site\'s pairs (none of the setup\'s copied) keeps the mark too', async () => {
      const db = fakeDb({ projects: [project({ site_id: SITE_ID, design: { ...PAIRS, imported: {}, imagesChanged: [] } })], sites: [editorSite()] });
      await run(db);
      expect(db.state.sites[0].generated_content.beforeAfter).toEqual(editorSite().generated_content.beforeAfter);
      expect(db.state.projects[0].design.beforeAfterChanged).toBe(true);
    });

    it('a photo copied from another upload than the pair names now stays off the site', async () => {
      const db = fakeDb({ projects: [project({ design: { ...PAIRS, imported: { ...PAIRS.imported, baAfter0: photo(9) } } })] });
      await run(db);
      const content = db.state.sites[0].generated_content;
      expect(content._images).not.toHaveProperty('baAfter0');
      // Pair 1 still shows, in its place.
      expect(content.beforeAfter.pairs).toEqual([{ caption: 'Paint correction on the hood' }, {}]);
    });

    it('an untouched rewrite keeps the editor\'s own pairs', async () => {
      const db = fakeDb({
        projects: [project({ site_id: SITE_ID, design: { ...PAIRS, imagesChanged: [], beforeAfterChanged: false } })],
        sites: [editorSite()],
      });
      await run(db);
      const content = db.state.sites[0].generated_content;
      expect(content.headline).toBe('Austin\'s mobile shine');
      expect(content.beforeAfter).toEqual(editorSite().generated_content.beforeAfter);
      expect(content._images).toEqual(editorSite().generated_content._images);
    });

    it('a rewrite after the setup changed them replaces the site\'s set, then clears the mark', async () => {
      const db = fakeDb({ projects: [project({ site_id: SITE_ID, design: { ...PAIRS, imagesChanged: [] } })], sites: [editorSite()] });
      await run(db);
      const content = db.state.sites[0].generated_content;
      expect(content.beforeAfter).toEqual({ intro: 'Every pair is a car we did this year.', pairs: [{ caption: 'Paint correction on the hood' }, {}] });
      expect(content._images).toEqual({ logo: 'editor-logo.png', ...PAIR_IMAGES });
      expect(db.state.projects[0].design.beforeAfterChanged).toBe(false);
    });

    it('design-save keeps this project\'s pairs, and the stored ones for a page that sends none', async () => {
      h.db = fakeDb({ projects: [project({ design_status: 'ready', site_id: SITE_ID, design: {} })] });
      const other = '99999999-2222-4333-8444-555555555555/photo/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.jpg';
      const sent = { ...PAIRS, slots: { ...PAIRS.slots, beforeAfter: [...PAIRS.slots.beforeAfter, { before: other, after: photo(6), caption: 'x' }] } };
      expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: sent }))).statusCode).toBe(200);
      const saved = () => h.db.state.projects[0].design;
      expect(saved().slots.beforeAfter).toEqual([...PAIRS.slots.beforeAfter, { before: '', after: photo(6), caption: 'x' }]);
      expect(saved().beforeAfter).toEqual({ title: '', intro: 'Every pair is a car we did this year.' });
      expect(saved().beforeAfterChanged).toBe(true);
      expect(saved().imported).toEqual(PAIRS.imported);
      expect(saved().images).toEqual(PAIRS.images);
      // A tab opened before the pairs existed sends none: they stay.
      expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: DESIGN }))).statusCode).toBe(200);
      expect(saved().slots.beforeAfter).toHaveLength(4);
      expect(saved().beforeAfter.intro).toBe('Every pair is a car we did this year.');
      expect(saved().beforeAfterChanged).toBe(true);
      // The page sends an empty list to clear them.
      await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: { ...DESIGN, slots: { ...DESIGN.slots, beforeAfter: [] }, beforeAfter: { title: '', intro: '' }, beforeAfterChanged: true } }));
      expect(saved().slots).not.toHaveProperty('beforeAfter');
      expect(saved()).not.toHaveProperty('beforeAfter');
    });
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

  it('design-save keeps the launch list, suggestion and brand run the server wrote', async () => {
    const serverKeys = { launch: { round: 2 }, suggestion: { status: 'ready' }, brand: { status: 'ready' } };
    h.db = fakeDb({ projects: [project({ design_status: 'ready', site_id: SITE_ID, design: { ...DESIGN, ...serverKeys } })] });
    const res = await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: { ...DESIGN, launch: { round: 9 }, suggestion: null } }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.projects[0].design).toEqual(expect.objectContaining(serverKeys));
  });

  it('design-save keeps the reference choice, and only this project\'s own screenshot', async () => {
    const shot = (pid) => `${pid}/reference/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.png`;
    const NONE = { status: 'none', requestedAt: '', templateId: '', note: '' };
    h.db = fakeDb({ projects: [project({ design_status: 'ready', site_id: SITE_ID, design: {} })] });
    const reference = {
      mode: 'match',
      source: { kind: 'asset', path: shot(PROJECT_ID) },
      replica: { status: 'requested', requestedAt: '2026-10-06T10:00:00.000Z', templateId: '', note: 'Hero and services grid' },
    };
    const res = await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: { ...DESIGN, reference } }));
    expect(res.statusCode).toBe(200);
    expect(json(res).project.design.reference).toEqual(reference);
    expect(h.db.state.projects[0].design.reference).toEqual(reference);
    // It comes back with the project.
    const { project: loaded } = json(await adminHandler(post({ action: 'get', id: PROJECT_ID })));
    expect(loaded.design.reference).toEqual(reference);
    // A save that doesn't send a choice at all (a tab opened before it
    // existed) keeps the stored one, replica request included.
    expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: DESIGN }))).statusCode).toBe(200);
    expect(h.db.state.projects[0].design.reference).toEqual(reference);

    // Another project's screenshot is dropped, and a match with nothing to
    // match falls back to inspiration.
    const other = await adminHandler(post({
      action: 'design-save', id: PROJECT_ID,
      design: { ...DESIGN, reference: { mode: 'match', source: { kind: 'asset', path: shot('99999999-2222-4333-8444-555555555555') } } },
    }));
    expect(other.statusCode).toBe(200);
    expect(h.db.state.projects[0].design.reference).toEqual({ mode: 'inspire', source: null, replica: NONE });
    // A listed site's address needs no folder and is kept.
    await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: { ...DESIGN, reference: { mode: 'match', source: { kind: 'url', url: 'refshop.test' } } } }));
    expect(h.db.state.projects[0].design.reference).toEqual({ mode: 'match', source: { kind: 'url', url: 'https://refshop.test/' }, replica: NONE });
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

// ─── More sections ────────────────────────────────────────────────────

describe('More sections in the design run', () => {
  const IMG = 'https://x.supabase.co/storage/v1/object/public/site-images/s/';
  const photo = (n) => `${PROJECT_ID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.jpg`;
  const ALL = ['faq', 'process', 'vehicleTypes', 'comparison', 'showcase', 'serviceTabs'];
  const SERVICES = [
    { name: 'Hand Wash', price: '$40', description: '', category: 'Cars' },
    { name: 'Interior Detail', price: '$120', description: '' },
    { name: 'Hull Wash', price: '$200', description: '' },
    { name: 'RV Wash', price: '', description: '' },
  ];
  // Every section on and marked; two showcase photos copied, the first
  // titled by the admin.
  const SECTIONS = {
    ...DESIGN,
    businessInfo: { ...DESIGN.businessInfo, services: SERVICES },
    templateId: 'detailing_sporty',
    template: { label: 'Bold & Sporty', mood: 'bold' },
    levers: { facts: { paymentMethods: ['Cash', 'Zelle'] } },
    extraSections: Object.fromEntries(ALL.map((id) => [id, true])),
    extraSectionsChanged: ALL,
    faqNotes: 'Q: Do you bring water? A: Yes, we bring our own water and power.',
    slots: { ...DESIGN.slots, showcase: [{ path: photo(1), title: 'Ceramic coating', caption: '' }, { path: photo(2), title: '', caption: 'Hull, top to bottom' }] },
    images: { ...DESIGN.images, showcase0: `${IMG}sc0.jpg`, showcase1: `${IMG}sc1.jpg` },
    imported: { showcase0: photo(1), showcase1: photo(2) },
  };
  const DRAFT = {
    faqItems: [
      { q: 'Do you bring water?', a: 'Yes, we bring our own water and power.' },
      { q: 'How do I pay?', a: 'Cash or Zelle.' },
      { q: 'Is it guaranteed?', a: 'Every detail is guaranteed.' },
    ],
    howSteps: [{ title: 'Book', desc: 'Call or send a request.' }, { title: 'We come to you', desc: 'We bring everything.' }, { title: 'Enjoy', desc: 'Drive off clean.' }],
    vehicleTypes: { title: 'Vehicles We Detail', items: [{ name: 'Cars', desc: '', icon: 'car' }, { name: 'Boats', desc: '', icon: 'boat' }, { name: 'RVs', desc: '', icon: 'rv' }] },
    comparisonRows: [{ label: 'Comes to you', us: 'Yes', them: '—' }, { label: 'Hand wash', us: 'Yes', them: 'Brushes' }],
    showcaseTitles: [{ photo: 1, title: 'Hull Wash' }],
    serviceCategories: [
      { name: 'Hand Wash', category: 'Cars' }, { name: 'Interior Detail', category: 'Cars' }, { name: 'Hull Wash', category: 'Boats' }, { name: 'RV Wash', category: 'RVs' },
    ],
  };
  const answer = (extra = DRAFT) => ok(JSON.stringify({ ...JSON.parse(COPY_JSON), ...extra }));
  const b64 = (v) => Buffer.from(v).toString('base64');
  const loadImage = vi.fn(async (url) => ({ mediaType: 'image/jpeg', data: b64(url) }));
  const run = (db, client, opts = {}) => runDesign({
    db, client, projectId: PROJECT_ID, startedAt: STARTED, adminUser: { id: 'admin-1' }, actor: 'a', loadImage, ...opts,
  });
  // A site the editor already gave its own sections.
  const editorSite = () => ({
    id: SITE_ID, user_id: 'admin-1', template_id: 'detailing_sporty',
    business_info: { businessName: 'Old', services: [{ name: 'Hull Wash', category: 'Marine' }], packages: [{ name: 'Hull Wash', category: 'Marine' }] },
    generated_content: {
      headline: 'Old',
      faq: { items: [{ q: 'Owner\'s question?', a: 'Owner\'s answer.' }] },
      howSteps: [{ title: 'Owner step', desc: 'Theirs.' }],
      showcase: { items: [{ title: 'Owner card' }] },
      serviceTabs: { enabled: true, all: true },
      _images: { logo: 'editor-logo.png', showcase0: 'editor-sc0.jpg' },
    },
  });

  it('the first write drafts every section switched on, checks it against the facts, and spends the marks', async () => {
    const db = fakeDb({ projects: [project({ design: SECTIONS })] });
    const client = fakeClient([answer()]);
    expect((await run(db, client)).status).toBe(200);
    const { body } = client.calls[0];
    expect(body.output_config.format.schema.required).toEqual([
      ...COPY_SCHEMA.required, 'faqItems', 'howSteps', 'vehicleTypes', 'comparisonRows', 'showcaseTitles', 'serviceCategories',
    ]);
    expect(body.max_tokens).toBe(20000);
    // The rules ride in the prompt; the untitled photo follows its label.
    const [text, label, image] = body.messages[0].content;
    for (const id of ALL) expect(text.text).toContain(SECTION_RULES[id]);
    expect(text.text).toContain('<pasted_faq>\nQ: Do you bring water? A: Yes, we bring our own water and power.\n</pasted_faq>');
    expect(text.text).toContain('- Hand Wash ($40) [category: Cars]');
    expect(label).toEqual({ type: 'text', text: 'Showcase photo 1:' });
    expect(image).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64(`${IMG}sc1.jpg`) } });
    expect(loadImage.mock.calls.map(([url]) => url)).toEqual([`${IMG}sc1.jpg`]);
    expect(body.system).toContain('More sections: the request may ask for parts of the page');

    const site = db.state.sites[0];
    const c = site.generated_content;
    // The guarantee nobody gave goes; the rest is as checked.
    expect(c.faq).toEqual({ items: DRAFT.faqItems.slice(0, 2) });
    expect(c.howSteps).toEqual(DRAFT.howSteps);
    expect(c.vehicleTypes).toEqual({ title: 'Vehicles We Detail', items: [{ name: 'Cars', icon: 'car' }, { name: 'Boats', icon: 'boat' }, { name: 'RVs', icon: 'rv' }] });
    expect(c.comparison).toEqual({ themLabel: 'Automated car wash', rows: [{ label: 'Comes to you', us: true, them: false }, { label: 'Hand wash', us: true, them: 'Brushes' }] });
    expect(c.showcase).toEqual({ items: [{ title: 'Ceramic coating' }, { title: 'Hull Wash', caption: 'Hull, top to bottom' }] });
    expect(c.serviceTabs).toEqual({ enabled: true });
    expect(c._images).toEqual({ ...DESIGN.images, showcase0: `${IMG}sc0.jpg`, showcase1: `${IMG}sc1.jpg` });
    expect(site.business_info.services.map((x) => x.category)).toEqual(['Cars', 'Cars', 'Boats', 'RVs']);
    expect(site.business_info.packages).toEqual(site.business_info.services);
    expect(db.state.projects[0].design).not.toHaveProperty('extraSectionsChanged');
    expect(db.state.events.find((e) => e.type === 'design_ready').data.sections).toEqual({ faq: 2, process: 3, vehicleTypes: 3, comparison: 2, showcase: 2, serviceTabs: 1 });
  });

  it('a photo that won\'t load goes untitled, and nothing is asked about it', async () => {
    const db = fakeDb({ projects: [project({ design: { ...SECTIONS, extraSections: { showcase: true }, extraSectionsChanged: ['showcase'] } })] });
    const client = fakeClient([answer({})]);
    await run(db, client, { loadImage: async () => null });
    const { body } = client.calls[0];
    expect(typeof body.messages[0].content).toBe('string');
    expect(body.output_config.format.schema).toBe(COPY_SCHEMA);
    expect(db.state.sites[0].generated_content.showcase).toEqual({ items: [{ title: 'Ceramic coating' }, { caption: 'Hull, top to bottom' }] });
  });

  it('a rewrite drafts only the sections changed here; the others keep the editor\'s work', async () => {
    // Only How it works changed: switched off.
    const design = { ...SECTIONS, extraSections: { ...SECTIONS.extraSections, process: false }, extraSectionsChanged: ['process'] };
    const db = fakeDb({ projects: [project({ site_id: SITE_ID, design })], sites: [editorSite()] });
    const client = fakeClient([answer({})]);
    await run(db, client);
    const { body } = client.calls[0];
    // Nothing to draft: the plain request, no photos.
    expect(body.output_config.format.schema).toBe(COPY_SCHEMA);
    expect(typeof body.messages[0].content).toBe('string');
    expect(body.messages[0].content).not.toContain('More sections');
    const site = db.state.sites[0];
    expect(site.generated_content.faq).toEqual(editorSite().generated_content.faq);
    expect(site.generated_content.showcase).toEqual(editorSite().generated_content.showcase);
    expect(site.generated_content.serviceTabs).toEqual({ enabled: true, all: true });
    expect(site.generated_content).not.toHaveProperty('howSteps');
    expect(site.generated_content._images).toEqual(editorSite().generated_content._images);
    // The services are the setup's, with the categories the site gave them.
    expect(site.business_info.services.map((x) => [x.name, x.category])).toEqual([['Hand Wash', undefined], ['Interior Detail', undefined], ['Hull Wash', 'Marine'], ['RV Wash', undefined]]);
    expect(db.state.projects[0].design).not.toHaveProperty('extraSectionsChanged');
  });

  it('a changed section whose draft has nothing usable keeps the site\'s, and its mark waits', async () => {
    const design = { ...SECTIONS, extraSectionsChanged: ['faq', 'comparison'] };
    const db = fakeDb({ projects: [project({ site_id: SITE_ID, design })], sites: [editorSite()] });
    await run(db, fakeClient([answer({ faqItems: [{ q: 'Price?', a: 'Only $5 today!' }], comparisonRows: [{ label: 'Hand wash', us: 'Yes', them: 'No' }, { label: 'Safer', us: 'Yes', them: 'No' }] })]));
    expect(db.state.sites[0].generated_content.faq).toEqual(editorSite().generated_content.faq);
    expect(db.state.sites[0].generated_content).not.toHaveProperty('comparison');
    expect(db.state.projects[0].design.extraSectionsChanged).toEqual(['faq', 'comparison']);
  });

  it('a template without them asks for none and keeps every mark for one that has them', async () => {
    const db = fakeDb({ projects: [project({ design: { ...SECTIONS, templateId: 'mobile_chrome' } })] });
    const client = fakeClient([answer({})]);
    await run(db, client);
    expect(client.calls[0].body.output_config.format.schema).toBe(COPY_SCHEMA);
    const c = db.state.sites[0].generated_content;
    for (const k of ['faq', 'howSteps', 'vehicleTypes', 'comparison', 'showcase', 'serviceTabs']) expect(c).not.toHaveProperty(k);
    expect(c._images).toEqual(DESIGN.images);
    expect(db.state.projects[0].design.extraSectionsChanged).toEqual(ALL);
  });

  it('requestDesignCopy sends the prompt\'s schema and photos, and the plain retry keeps the photos', async () => {
    const client = fakeClient([Object.assign(new Error('bad request'), { status: 400 }), ok()]);
    const schema = { type: 'object', additionalProperties: false, required: [], properties: {} };
    await requestDesignCopy(client, { system: 's', user: 'u', fields: ['faqItems'], schema, images: [{ number: 1, mediaType: 'image/png', data: 'AAAA' }] });
    expect(client.calls[0].body.output_config.format.schema).toBe(schema);
    const content = [{ type: 'text', text: 'u' }, { type: 'text', text: 'Showcase photo 1:' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }];
    expect(client.calls[0].body.messages[0].content).toEqual(content);
    expect(client.calls[1].body.messages[0].content).toEqual(content);
    expect(client.calls[1].body.max_tokens).toBe(20000);
    // Without sections: as before.
    const plain = fakeClient([ok()]);
    await requestDesignCopy(plain, { system: 's', user: 'u' });
    expect(plain.calls[0].body.output_config.format.schema).toBe(COPY_SCHEMA);
    expect(plain.calls[0].body.max_tokens).toBe(16000);
    expect(plain.calls[0].body.messages[0].content).toBe('u');
  });

  it('fetchSitePhoto loads only our own public images, in a format Claude reads, under the size limit', async () => {
    const bytes = (n) => new Uint8Array(n).buffer;
    const fetch = vi.fn(async () => ({ ok: true, headers: { get: () => 'image/jpeg; charset=binary' }, arrayBuffer: async () => new TextEncoder().encode('jpeg-bytes').buffer }));
    vi.stubGlobal('fetch', fetch);
    try {
      expect(await fetchSitePhoto(`${IMG}a.jpg`)).toEqual({ mediaType: 'image/jpeg', data: b64('jpeg-bytes') });
      expect(await fetchSitePhoto('https://evil.test/storage/v1/object/public/site-images/a.jpg')).toBeNull();
      expect(await fetchSitePhoto(null)).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
      fetch.mockImplementationOnce(async () => ({ ok: true, headers: { get: () => 'image/avif' }, arrayBuffer: async () => bytes(4) }));
      expect(await fetchSitePhoto(`${IMG}b.avif`)).toBeNull();
      fetch.mockImplementationOnce(async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => bytes(4 * 1024 * 1024) }));
      expect(await fetchSitePhoto(`${IMG}c.png`)).toBeNull();
      fetch.mockImplementationOnce(async () => ({ ok: false }));
      expect(await fetchSitePhoto(`${IMG}d.png`)).toBeNull();
      fetch.mockImplementationOnce(async () => { throw new Error('network down'); });
      expect(await fetchSitePhoto(`${IMG}e.png`)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('design-save keeps them for a tab that sends none, and clears them for one that sends them empty', async () => {
    h.db = fakeDb({ projects: [project({ design_status: 'ready', site_id: SITE_ID, design: {} })] });
    const saved = () => h.db.state.projects[0].design;
    expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: SECTIONS }))).statusCode).toBe(200);
    expect(saved().extraSections).toEqual(SECTIONS.extraSections);
    expect(saved().extraSectionsChanged).toEqual(ALL);
    expect(saved().faqNotes).toBe(SECTIONS.faqNotes);
    expect(saved().slots.showcase).toEqual(SECTIONS.slots.showcase);
    expect(saved().images.showcase1).toBe(`${IMG}sc1.jpg`);
    expect(saved().businessInfo.services[0].category).toBe('Cars');
    // A tab opened before them: no switches, marks, notes or photos, and
    // services without a Category field. Everything stays.
    const old = { ...DESIGN, businessInfo: { ...DESIGN.businessInfo, services: SERVICES.map((x) => ({ name: x.name, price: x.price, description: '' })) } };
    expect((await adminHandler(post({ action: 'design-save', id: PROJECT_ID, design: old }))).statusCode).toBe(200);
    expect(saved().extraSections).toEqual(SECTIONS.extraSections);
    expect(saved().extraSectionsChanged).toEqual(ALL);
    expect(saved().faqNotes).toBe(SECTIONS.faqNotes);
    expect(saved().slots.showcase).toEqual(SECTIONS.slots.showcase);
    expect(saved().businessInfo.services.map((x) => x.category)).toEqual(['Cars', undefined, undefined, undefined]);
    // The page sends all of them, an all-off set and empty lists too: they clear.
    await adminHandler(post({
      action: 'design-save', id: PROJECT_ID,
      design: { ...old, extraSections: { faq: false }, extraSectionsChanged: [], faqNotes: '', slots: { ...DESIGN.slots, showcase: [] } },
    }));
    for (const k of ['extraSections', 'extraSectionsChanged', 'faqNotes']) expect(saved()).not.toHaveProperty(k);
    expect(saved().slots).not.toHaveProperty('showcase');
    expect(saved().businessInfo.services.map((x) => x.category)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
