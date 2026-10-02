// tests/functions/custom-site.test.js
//
// Custom website projects: the customer form function (token-gated), the
// admin function and the emails. Supabase is an in-memory fake that
// understands the query chains these functions use.
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
    customSiteWelcome: vi.fn(async () => ({ MessageID: 'm1' })),
    customSiteDraft: vi.fn(async () => ({ MessageID: 'm4' })),
    customSiteLive: vi.fn(async () => ({ MessageID: 'm5' })),
    customSiteFormToAdmin: vi.fn(async () => ({ MessageID: 'm2' })),
    customSiteReceivedToCustomer: vi.fn(async () => ({ MessageID: 'm3' })),
  };
});

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { handler: formHandler } = await import('../../netlify/functions/custom-site-form.js');
const { handler: adminHandler } = await import('../../netlify/functions/custom-site-admin.js');

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'tok_abcdefghijklmnopqrstuv';

// ─── Fake Supabase ────────────────────────────────────────────────────

function fakeDb({ projects = [], profiles = [] } = {}) {
  const state = { projects, profiles, events: [], storage: [], removed: [] };

  function run(q) {
    const eqs = q.ops.filter((o) => o[0] === 'eq');
    const inOp = q.ops.find((o) => o[0] === 'in');
    const match = (row) => eqs.every(([, c, v]) => row[c] === v) && (!inOp || inOp[2].includes(row[inOp[1]]));
    const insert = q.ops.find((o) => o[0] === 'insert');
    const update = q.ops.find((o) => o[0] === 'update');
    const del = q.ops.find((o) => o[0] === 'delete');
    const single = q.ops.some((o) => o[0] === 'single' || o[0] === 'maybeSingle');

    if (q.table === 'request_log') return insert ? { error: null } : { count: 0, error: null };
    if (q.table === 'custom_site_project_events') {
      if (insert) { state.events.push(insert[1]); return { error: null }; }
      return { data: state.events.filter(match), error: null };
    }
    const rows = q.table === 'profiles' ? state.profiles : state.projects;
    if (insert) {
      const row = { id: PROJECT_ID, stage: 'new', form: {}, assets: [], invite_count: 0, admin_notes: '', ...insert[1] };
      rows.push(row);
      return { data: structuredClone(row), error: null };
    }
    if (del) {
      state.projects = state.projects.filter((r) => !match(r));
      return { error: null };
    }
    // Copies out, like a real client: callers never hold the stored row.
    const copy = (r) => (r ? structuredClone(r) : null);
    const hits = rows.filter(match);
    if (update) {
      hits.forEach((r) => Object.assign(r, update[1]));
      const selected = q.ops.some((o) => o[0] === 'select');
      if (single) return { data: copy(hits[0]), error: null };
      return selected ? { data: hits.map((r) => ({ id: r.id })), error: null } : { error: null };
    }
    return single ? { data: copy(hits[0]), error: null } : { data: hits.map(copy), error: null };
  }

  function from(table) {
    const q = { table, ops: [] };
    const api = {};
    for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'order', 'limit']) {
      api[op] = (...args) => { q.ops.push([op, ...args]); return api; };
    }
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  }

  const storage = {
    from: () => ({
      createSignedUploadUrl: async (path) => ({ data: { path, token: 'upload-token' }, error: null }),
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://files.test/${p}?token=x` })), error: null }),
      list: async (folder) => ({ data: state.storage.filter((p) => p.startsWith(`${folder}/`)).map((p) => ({ name: p.split('/').pop() })), error: null }),
      remove: async (paths) => { state.removed.push(...paths); return { error: null }; },
    }),
  };

  return { from, storage, state };
}

const ADMIN = { id: 'admin-1', email: 'Admin@ACG.test', is_super_admin: true };

function project(extra = {}) {
  return {
    id: PROJECT_ID, token: TOKEN, stage: 'invited', client_first_name: 'Mike', client_last_name: 'Castellon',
    client_name: 'Mike Castellon', client_email: 'mike@shop.test',
    client_phone: null, business_name: 'Top Choice', form: { contactName: 'Mike Castellon' }, assets: [],
    invite_count: 1, admin_notes: '', created_by: 'admin-1',
    form_started_at: null, form_saved_at: null, form_submitted_at: null, ...extra,
  };
}

const post = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
const json = (res) => JSON.parse(res.body);
const validForm = { contactName: 'Mike', contactEmail: 'mike@shop.test', businessName: 'Top Choice', services: 'Detail: $250' };

beforeEach(() => {
  vi.clearAllMocks();
  h.user = null;
  delete process.env.CUSTOM_SITES_EMAIL;
  delete process.env.SUPPORT_HOST_EMAIL;
  delete process.env.POSTMARK_FROM_EMAIL;
});

// ─── Customer form ────────────────────────────────────────────────────

describe('custom-site-form', () => {
  it('answers a malformed token with 404 without touching the database', async () => {
    h.db = { from: () => { throw new Error('db used'); } };
    const res = await formHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('treats an archived project\'s link as inactive', async () => {
    h.db = fakeDb({ projects: [project({ stage: 'archived' })] });
    const res = await formHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: TOKEN } });
    expect(res.statusCode).toBe(404);
  });

  it('loads the saved answers with preview links, never the project id or token', async () => {
    const asset = { path: `${PROJECT_ID}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`, kind: 'logo', name: 'logo.png', size: 10, type: 'image/png' };
    h.db = fakeDb({ projects: [project({ assets: [asset] })] });
    const res = await formHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { t: TOKEN } });
    expect(res.statusCode).toBe(200);
    const { project: p } = json(res);
    expect(p.firstName).toBe('Mike');
    expect(p.businessName).toBe('Top Choice');
    expect(p.assets[0].url).toContain('https://files.test/');
    expect(JSON.stringify(p)).not.toContain(TOKEN);
    expect(p.id).toBeUndefined();
  });

  it('autosaves sanitized answers and moves "Form sent" to "Filling out form" once', async () => {
    h.db = fakeDb({ projects: [project()] });
    const res = await formHandler(post({ action: 'save', t: TOKEN, form: { ...validForm, hacker: 1 }, assets: [] }));
    expect(res.statusCode).toBe(200);
    const p = h.db.state.projects[0];
    expect(p.form).toEqual(validForm);
    expect(p.stage).toBe('form_started');
    expect(p.form_started_at).toBeTruthy();
    expect(h.db.state.events.map((e) => e.type)).toEqual(['form_started', 'stage']);

    await formHandler(post({ action: 'save', t: TOKEN, form: validForm, assets: [] }));
    expect(h.db.state.events).toHaveLength(2);
  });

  it('copies the business name and phone the customer gives onto the project', async () => {
    h.db = fakeDb({ projects: [project({ business_name: null })] });
    await formHandler(post({ action: 'save', t: TOKEN, form: { ...validForm, contactPhone: '(813) 555-0142' }, assets: [] }));
    expect(h.db.state.projects[0].business_name).toBe('Top Choice');
    expect(h.db.state.projects[0].client_phone).toBe('(813) 555-0142');
  });

  it('never moves a project back from a stage an admin set', async () => {
    h.db = fakeDb({ projects: [project({ stage: 'designing', form_started_at: '2026-10-01T00:00:00Z' })] });
    await formHandler(post({ action: 'save', t: TOKEN, form: validForm, assets: [] }));
    expect(h.db.state.projects[0].stage).toBe('designing');
    expect(h.db.state.events).toEqual([]);
  });

  it('drops files that point at another project', async () => {
    h.db = fakeDb({ projects: [project()] });
    const mine = { path: `${PROJECT_ID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`, name: 'car.jpg', size: 5 };
    const theirs = { path: `99999999-2222-4333-8444-555555555555/photo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`, name: 'x.jpg' };
    await formHandler(post({ action: 'save', t: TOKEN, form: validForm, assets: [mine, theirs] }));
    expect(h.db.state.projects[0].assets.map((a) => a.path)).toEqual([mine.path]);
  });

  it('mints upload paths inside the project folder and refuses other file types', async () => {
    h.db = fakeDb({ projects: [project()] });
    const ok = await formHandler(post({ action: 'upload-url', t: TOKEN, kind: 'logo', fileName: 'Logo.SVG', size: 2000 }));
    expect(ok.statusCode).toBe(200);
    expect(json(ok).path).toMatch(new RegExp(`^${PROJECT_ID}/logo/[0-9a-f-]{36}\\.svg$`));
    expect(json(ok).uploadToken).toBe('upload-token');

    const bad = await formHandler(post({ action: 'upload-url', t: TOKEN, kind: 'logo', fileName: 'run.exe', size: 2000 }));
    expect(bad.statusCode).toBe(400);
  });

  it('refuses to submit without the required answers', async () => {
    h.db = fakeDb({ projects: [project()] });
    const res = await formHandler(post({ action: 'submit', t: TOKEN, form: { contactName: 'Mike' }, assets: [] }));
    expect(res.statusCode).toBe(400);
    expect(json(res).missing.map((m) => m.id)).toEqual(['contactEmail', 'businessName']);
    expect(postmark.customSiteFormToAdmin).not.toHaveBeenCalled();
  });

  it('submits: "Form received", the admin who added them gets the answers, the customer a confirmation', async () => {
    const photo = { path: `${PROJECT_ID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`, name: 'car.jpg', size: 5 };
    h.db = fakeDb({ projects: [project({ stage: 'form_started', form_started_at: '2026-10-01T00:00:00Z' })], profiles: [ADMIN] });
    const res = await formHandler(post({ action: 'submit', t: TOKEN, form: validForm, assets: [photo] }));
    expect(res.statusCode).toBe(200);
    const p = h.db.state.projects[0];
    expect(p.stage).toBe('form_received');
    expect(p.form_submitted_at).toBeTruthy();
    expect(postmark.customSiteFormToAdmin).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@acg.test',
      resubmitted: false,
      form: validForm,
      // Files go out with links that open from the email.
      assets: [expect.objectContaining({ name: 'car.jpg', url: expect.stringContaining('https://files.test/') })],
      adminUrl: expect.stringContaining(`/?admin=custom-sites&project=${PROJECT_ID}`),
    }));
    // To the address the team entered, not one typed into the form; replies
    // reach the admin.
    expect(postmark.customSiteReceivedToCustomer).toHaveBeenCalledWith(expect.objectContaining({
      to: 'mike@shop.test',
      replyTo: 'admin@acg.test',
      firstName: 'Mike',
      formUrl: expect.stringContaining(`/custom-site?t=${TOKEN}`),
    }));
  });

  it('also sends the answers to CUSTOM_SITES_EMAIL, once per address', async () => {
    process.env.CUSTOM_SITES_EMAIL = 'support@acg.test, admin@acg.test, not-an-email';
    h.db = fakeDb({ projects: [project()], profiles: [ADMIN] });
    await formHandler(post({ action: 'submit', t: TOKEN, form: validForm, assets: [] }));
    expect(postmark.customSiteFormToAdmin).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@acg.test, support@acg.test' }));
  });

  it('falls back to the support inbox when nobody is on record', async () => {
    process.env.SUPPORT_HOST_EMAIL = 'support@acg.test';
    h.db = fakeDb({ projects: [project({ created_by: null })] });
    await formHandler(post({ action: 'submit', t: TOKEN, form: validForm, assets: [] }));
    expect(postmark.customSiteFormToAdmin).toHaveBeenCalledWith(expect.objectContaining({ to: 'support@acg.test' }));
  });

  it('a resubmit keeps the stage, tells the team it was updated, and does not re-confirm', async () => {
    h.db = fakeDb({ projects: [project({ stage: 'designing', form_started_at: 'x', form_submitted_at: '2026-10-01T00:00:00Z' })], profiles: [ADMIN] });
    await formHandler(post({ action: 'submit', t: TOKEN, form: validForm, assets: [] }));
    expect(h.db.state.projects[0].stage).toBe('designing');
    expect(postmark.customSiteFormToAdmin).toHaveBeenCalledWith(expect.objectContaining({ resubmitted: true }));
    expect(postmark.customSiteReceivedToCustomer).not.toHaveBeenCalled();
    expect(h.db.state.events.map((e) => e.type)).toEqual(['form_resubmitted']);
  });

  it('still saves when the emails fail', async () => {
    postmark.customSiteFormToAdmin.mockRejectedValueOnce(new Error('postmark down'));
    h.db = fakeDb({ projects: [project()], profiles: [ADMIN] });
    const res = await formHandler(post({ action: 'submit', t: TOKEN, form: validForm, assets: [] }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.projects[0].form_submitted_at).toBeTruthy();
  });
});

// ─── Admin ────────────────────────────────────────────────────────────

describe('custom-site-admin', () => {
  const adminProfile = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };

  it('is for super admins only', async () => {
    h.db = fakeDb({ profiles: [{ id: 'u1', email: 'owner@x.test', is_super_admin: false }] });
    expect((await adminHandler(post({ action: 'list' }))).statusCode).toBe(401);
    h.user = { id: 'u1' };
    expect((await adminHandler(post({ action: 'list' }))).statusCode).toBe(403);
  });

  it('adds a customer from a name and email, pre-fills their form and emails them their link', async () => {
    h.db = fakeDb({ profiles: [adminProfile] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({
      action: 'create', firstName: ' Mike ', lastName: 'Castellon', clientEmail: ' Mike@Shop.test ',
      note: 'Great talking today!', sendEmail: true,
    }));
    expect(res.statusCode).toBe(200);
    const { project: p, emailError } = json(res);
    expect(emailError).toBeUndefined();
    expect(p.token).toBeUndefined();
    expect(p.formUrl).toMatch(/\/custom-site\?t=[A-Za-z0-9_-]{32}$/);
    expect(p.stage).toBe('invited');
    expect(p.client_email).toBe('mike@shop.test');
    expect(p.client_first_name).toBe('Mike');
    expect(p.client_name).toBe('Mike Castellon');
    expect(p.business_name ?? null).toBeNull();
    expect(p.form).toEqual({ contactName: 'Mike Castellon', contactEmail: 'mike@shop.test' });
    expect(p.created_by).toBe('admin-1');
    expect(postmark.customSiteWelcome).toHaveBeenCalledWith(expect.objectContaining({
      to: 'mike@shop.test', note: 'Great talking today!', formUrl: p.formUrl, firstName: 'Mike',
      // The customer's reply goes to the admin who sent it.
      replyTo: 'admin@acg.test',
    }));
    expect(h.db.state.events.map((e) => e.type)).toEqual(['created', 'email', 'stage']);
  });

  it('keeps the customer when the welcome email fails, and says so', async () => {
    postmark.customSiteWelcome.mockRejectedValueOnce(new Error('Postmark 422'));
    h.db = fakeDb({ profiles: [adminProfile] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'create', firstName: 'A', clientEmail: 'a@b.co', sendEmail: true }));
    expect(res.statusCode).toBe(200);
    expect(json(res).emailError).toBe('Postmark 422');
    expect(json(res).project.stage).toBe('new');
    expect(h.db.state.events.map((e) => e.type)).toEqual(['created', 'email_failed']);
  });

  it('refuses a customer without a first name or a valid email', async () => {
    h.db = fakeDb({ profiles: [adminProfile] });
    h.user = { id: 'admin-1' };
    expect((await adminHandler(post({ action: 'create', firstName: 'A', clientEmail: 'nope' }))).statusCode).toBe(400);
    expect((await adminHandler(post({ action: 'create', firstName: ' ', clientEmail: 'a@b.co' }))).statusCode).toBe(400);
  });

  it('editing the name keeps first, last and full name in step', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project()] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'update', id: PROJECT_ID, firstName: 'Michael', lastName: '' }));
    expect(json(res).project).toEqual(expect.objectContaining({
      client_first_name: 'Michael', client_last_name: null, client_name: 'Michael',
    }));
  });

  it('moves stages and logs who did it', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project({ stage: 'form_received' })] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'update', id: PROJECT_ID, stage: 'designing', paid: true }));
    expect(res.statusCode).toBe(200);
    expect(json(res).project.stage).toBe('designing');
    expect(json(res).project.paid_at).toBeTruthy();
    expect(h.db.state.events).toEqual([
      expect.objectContaining({ type: 'stage', data: { from: 'form_received', to: 'designing' }, actor: 'admin@acg.test' }),
      expect.objectContaining({ type: 'paid', data: { paid: true } }),
    ]);
    expect((await adminHandler(post({ action: 'update', id: PROJECT_ID, stage: 'party' }))).statusCode).toBe(400);
  });

  it('only stores web links as the site link', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project()] });
    h.user = { id: 'admin-1' };
    const bad = await adminHandler(post({ action: 'update', id: PROJECT_ID, siteUrl: 'javascript:alert(1)' }));
    expect(bad.statusCode).toBe(400);
    const ok = await adminHandler(post({ action: 'update', id: PROJECT_ID, siteUrl: 'topchoice.autocaregeniushub.com' }));
    expect(json(ok).project.site_url).toBe('https://topchoice.autocaregeniushub.com/');
  });

  it('emails the draft link and moves the project to "Draft with customer"', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project({ stage: 'designing', site_url: 'https://draft.test/' })] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'email-customer', id: PROJECT_ID, template: 'draft' }));
    expect(res.statusCode).toBe(200);
    expect(json(res).project.stage).toBe('in_review');
    expect(postmark.customSiteDraft).toHaveBeenCalledWith(expect.objectContaining({
      to: 'mike@shop.test', firstName: 'Mike', siteUrl: 'https://draft.test/', replyTo: 'admin@acg.test',
    }));
    expect(h.db.state.events.map((e) => [e.type, e.data.template || e.data.to])).toEqual([['email', 'draft'], ['stage', 'in_review']]);
  });

  it('"you\'re live" marks the project live; nothing is sent without a site link', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project({ stage: 'revisions', site_url: null })] });
    h.user = { id: 'admin-1' };
    const blocked = await adminHandler(post({ action: 'email-customer', id: PROJECT_ID, template: 'live' }));
    expect(blocked.statusCode).toBe(400);
    expect(postmark.customSiteLive).not.toHaveBeenCalled();

    h.db.state.projects[0].site_url = 'https://topchoice.test/';
    const res = await adminHandler(post({ action: 'email-customer', id: PROJECT_ID, template: 'live' }));
    expect(json(res).project.stage).toBe('live');
    expect((await adminHandler(post({ action: 'email-customer', id: PROJECT_ID, template: 'party' }))).statusCode).toBe(400);
  });

  it('a failed customer email keeps the stage and is logged', async () => {
    postmark.customSiteDraft.mockRejectedValueOnce(new Error('Postmark 406'));
    h.db = fakeDb({ profiles: [adminProfile], projects: [project({ stage: 'designing', site_url: 'https://draft.test/' })] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'email-customer', id: PROJECT_ID, template: 'draft' }));
    expect(res.statusCode).toBe(502);
    expect(h.db.state.projects[0].stage).toBe('designing');
    expect(h.db.state.events.map((e) => e.type)).toEqual(['email_failed']);
  });

  it('says since when a project is in its stage', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project({ created_at: '2026-09-01T00:00:00Z' })] });
    h.user = { id: 'admin-1' };
    h.db.state.events.push(
      { project_id: PROJECT_ID, type: 'email', data: {}, created_at: '2026-09-03T00:00:00Z' },
      { project_id: PROJECT_ID, type: 'stage', data: { to: 'invited' }, created_at: '2026-09-02T00:00:00Z' },
    );
    const list = json(await adminHandler(post({ action: 'list' })));
    expect(list.projects[0].stageSince).toBe('2026-09-02T00:00:00Z');
    h.db.state.events.length = 0;
    const one = json(await adminHandler(post({ action: 'get', id: PROJECT_ID })));
    expect(one.project.stageSince).toBe('2026-09-01T00:00:00Z');
  });

  it('replacing the link changes the token', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project()] });
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'reset-link', id: PROJECT_ID }));
    expect(h.db.state.projects[0].token).not.toBe(TOKEN);
    expect(json(res).project.formUrl).not.toContain(TOKEN);
  });

  it('delete removes every file in the project folder', async () => {
    h.db = fakeDb({ profiles: [adminProfile], projects: [project()] });
    h.db.state.storage.push(`${PROJECT_ID}/logo/a.png`, `${PROJECT_ID}/photo/b.jpg`, `other/photo/c.jpg`);
    h.user = { id: 'admin-1' };
    const res = await adminHandler(post({ action: 'delete', id: PROJECT_ID }));
    expect(res.statusCode).toBe(200);
    expect(h.db.state.removed.sort()).toEqual([`${PROJECT_ID}/logo/a.png`, `${PROJECT_ID}/photo/b.jpg`]);
    expect(h.db.state.projects).toEqual([]);
  });
});

// ─── Emails ───────────────────────────────────────────────────────────

describe('custom website emails', () => {
  const formUrl = 'https://sitebuilder.autocaregenius.com/custom-site?t=abc_DEF-123';

  it('welcome email greets by first name and links to the form, in HTML and text', () => {
    const { subject, html, text } = postmark.customSiteWelcomeEmail({ firstName: 'Mike', formUrl, note: '' });
    expect(subject).toBe('Welcome! Let\'s build your new website');
    expect(html).toContain('Thanks for choosing a custom website. Step one');
    expect(html).toContain(`href="${formUrl}"`);
    expect(html).toContain('Welcome, Mike!');
    expect(html).toContain('Start my website form');
    expect(html).not.toContain('A note from our team');
    expect(text).toContain(formUrl);
    expect(html + text).not.toMatch(/undefined|null/);
  });

  it('escapes what admins and customers typed', () => {
    const { html } = postmark.customSiteWelcomeEmail({
      clientName: '<b>Eve</b>', businessName: 'A&B <script>', formUrl, note: 'Hi <img src=x onerror=alert(1)>\nline two',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('A&amp;B &lt;script&gt;');
    expect(html).toContain('A note from our team');
    expect(html).toContain('line two');
  });

  it('names the business when we know it, and works without a name', () => {
    expect(postmark.customSiteWelcomeEmail({ firstName: 'Mike', businessName: 'Top Choice', formUrl }).subject)
      .toBe('Welcome! Let\'s build the Top Choice website');
    const { html } = postmark.customSiteWelcomeEmail({ firstName: '', formUrl });
    expect(html).toContain('Welcome!');
  });

  it('team email has every answer and links to the files', () => {
    const { html, text } = postmark.customSiteFormToAdminEmail({
      project: { business_name: 'Top Choice', client_name: 'Mike', client_email: 'm@x.test' },
      form: {
        contactName: 'Mike', contactEmail: 'm@x.test', businessType: 'tint_shop', colorMode: 'mine', colors: ['#CC0000'],
        services: 'Wash: $80\nDetail: $250',
        referenceSites: [{ url: 'javascript:alert(1)', note: 'nope' }, { url: 'cool.com', note: 'the <b>layout</b>' }],
      },
      assets: [{ kind: 'logo', name: 'logo.ai', size: 2048, url: 'https://files.test/logo?token=1', note: 'main one' }],
      adminUrl: 'https://app.test/?admin=custom-sites&project=1',
      resubmitted: false,
    });
    expect(html).toContain('Tint / PPF');
    expect(html).toContain('Wash: $80<br/>Detail: $250');
    expect(html).toContain('background:#CC0000');
    expect(html).toContain('href="https://cool.com/"');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('the &lt;b&gt;layout&lt;/b&gt;');
    expect(html).toContain('href="https://files.test/logo?token=1"');
    expect(html).toContain('main one');
    expect(text).toContain('Services and prices:\nWash: $80\nDetail: $250');
    expect(text).toContain('Logo: logo.ai https://files.test/logo?token=1 ("main one")');
  });

  it('draft and live emails link to the site and greet by first name', () => {
    const draft = postmark.customSiteDraftEmail({ firstName: 'Mike', businessName: 'A&B', siteUrl: 'https://draft.test/', note: 'First pass!' });
    expect(draft.subject).toBe('Your A&B website draft is ready');
    expect(draft.html).toContain('Your draft is ready, Mike!');
    expect(draft.html).toContain('href="https://draft.test/"');
    expect(draft.html).toContain('the A&amp;B website');
    expect(draft.html).toContain('First pass!');
    expect(draft.text).toContain('https://draft.test/');
    const live = postmark.customSiteLiveEmail({ firstName: '', businessName: '', siteUrl: 'https://live.test/' });
    expect(live.subject).toBe('Your new website is live!');
    expect(live.html).toContain('You\'re live!');
    expect(live.html).toContain('href="https://live.test/"');
    expect(live.html + live.text).not.toMatch(/undefined|null/);
  });

  it('team email lists files and what is still missing', () => {
    const { subject, text } = postmark.customSiteFormToAdminEmail({
      project: { business_name: 'Top Choice', client_name: 'Mike', client_email: 'm@x.test' },
      form: { contactName: 'Mike', contactEmail: 'm@x.test', colorMode: 'logo', services: 'Wash' },
      assets: [{ kind: 'photo' }, { kind: 'photo' }],
      adminUrl: 'https://app.test/?admin=custom-sites&project=1',
      resubmitted: false,
    });
    expect(subject).toBe('Custom website form received: Top Choice');
    expect(text).toContain('Files: Photos: 2');
    expect(text).toContain('Still missing: Your logo, A website or design you like');
    expect(text).not.toMatch(/\n\n\n/);
  });
});
