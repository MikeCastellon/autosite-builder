// tests/functions/heic-e2e.test.js
//
// iPhone photos (HEIC) end to end, through the real handlers: the customer
// saves the form with a HEIC upload (custom-site-form), which claims a run
// and starts custom-site-heic-background; that function (dispatched here
// with the very request the form sent, the way Netlify would after its 202)
// converts the real fixture in place; the customer's open page then saves
// its stale list (still the HEIC path) and keeps the JPEG; the project
// page's card (custom-site-admin get, heic-convert) goes running → ready;
// and every reader of the customer's images (the Design step's
// isImportable / designFromIntake, Suggest a design's
// suggestImageCandidates, the Launch Kit's imageCandidates /
// loadAssetImages) refuses the HEIC before and takes the JPEG after.
//
// Supabase and its storage are the in-memory fakes of
// tests/fixtures/heic/fakes.js and fetch is stubbed: nothing here reaches a
// database, a bucket or the network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SAMPLE_HEIC, fakeDb } from '../fixtures/heic/fakes.js';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const { handler: formHandler } = await import('../../netlify/functions/custom-site-form.js');
const { handler: adminHandler } = await import('../../netlify/functions/custom-site-admin.js');
const { handler: backgroundHandler } = await import('../../netlify/functions/custom-site-heic-background.js');
const { HEIC_BACKGROUND_PATH, HEIC_SIGNATURE_HEADER } = await import('../../netlify/functions/_lib/heic-run.js');
const { imageCandidates, loadAssetImages } = await import('../../netlify/functions/_lib/kit/inputs.js');
const { heicCardView } = await import('../../src/components/admin/HeicConvertCard.jsx');
const { designFromIntake, isImportable } = await import('../../src/lib/customSiteDesign.js');
const { suggestImageCandidates } = await import('../../src/lib/designSuggest.js');

const PID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'tok_abcdefghijklmnopqrstuv';
const ORIGIN = 'https://deploy-preview-7--acg.netlify.app';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const LOGO = { path: `${PID}/logo/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.png`, kind: 'logo', name: 'logo.png', size: 100, type: 'image/png' };
// What the customer's page lists after uploading an iPhone photo.
const HEIC = {
  path: `${PID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-000000000412.heic`,
  kind: 'photo', name: 'IMG_0412.HEIC', size: SAMPLE_HEIC.length, type: 'image/heic', note: 'The van, after a full detail',
};
const JPEG_PATH = new RegExp(`^${PID}/photo/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.jpg$`);
const KIT_LIMITS = { logo: 1, photo: 12 };

const row = () => h.db.state.projects[0];
const json = (res) => JSON.parse(res.body);
const isJpeg = (buf) => !!buf && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

function project() {
  return {
    id: PID, token: TOKEN, stage: 'form_started', created_by: ADMIN.id,
    client_first_name: 'Dana', client_name: 'Dana Gloss', client_email: 'dana@gloss.test', client_phone: null,
    business_name: 'Gloss Boss', form: { contactName: 'Dana' }, assets: [structuredClone(LOGO)],
    design: { templateId: 'mobile_sudsy' },
    form_started_at: '2026-10-01T00:00:00.000000+00:00', form_saved_at: null, form_submitted_at: null,
    updated_at: '2026-10-07T08:00:00.000000+00:00',
  };
}

// The customer's page: autosave sends the whole form and its file list.
const save = (assets, form = { contactName: 'Dana', businessName: 'Gloss Boss' }) => formHandler({
  httpMethod: 'POST',
  headers: { 'x-forwarded-for': '203.0.113.9' },
  rawUrl: `${ORIGIN}/.netlify/functions/custom-site-form`,
  body: JSON.stringify({ t: TOKEN, action: 'save', form, assets }),
});

const admin = (body) => adminHandler({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer admin-token' },
  rawUrl: `${ORIGIN}/.netlify/functions/custom-site-admin`,
  body: JSON.stringify(body),
});

// The card on the project page, as it renders from a `get`.
async function card() {
  const res = await admin({ action: 'get', id: PID });
  expect(res.statusCode).toBe(200);
  const { project: p } = json(res);
  return { p, view: heicCardView({ assets: p.assets, run: p.design?.heic }) };
}

let starts;
beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  h.user = ADMIN;
  // The HEIC is in the bucket already: the browser uploads it to its signed
  // URL before the save lists it.
  h.db = fakeDb({ projects: [project()], profiles: [ADMIN], files: { [HEIC.path]: SAMPLE_HEIC } });
  // Netlify answers a background function with 202 and runs it afterwards:
  // the request is kept here and dispatched by the test.
  starts = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    starts.push({ url, init });
    return { ok: true, status: 202 };
  }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HEIC to JPEG, end to end on fakes', () => {
  it('customer save → claim + start → in-place conversion → stale save keeps the JPEG → readers take it', async () => {
    // Before: the HEIC is listed nowhere a reader would take it.
    const before = [LOGO, HEIC];
    expect(isImportable(HEIC.name)).toBe(false);
    expect(suggestImageCandidates(before).unviewable).toEqual([
      expect.objectContaining({ path: HEIC.path, reason: expect.stringContaining('Convert them on the project page') }),
    ]);
    expect(imageCandidates(before, KIT_LIMITS).skipped.map((s) => s.path)).toEqual([HEIC.path]);

    // 1. The customer saves with the HEIC: the answers are stored, and a run
    //    is claimed as the customer and started on the same deploy, signed.
    let res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(row().assets.map((a) => a.path)).toEqual([LOGO.path, HEIC.path]);
    const claim = row().design.heic;
    expect(claim).toMatchObject({ status: 'running', by: 'customer', total: 1, converted: 0, failed: [], finishedAt: null });
    expect(row().design.templateId).toBe('mobile_sudsy');
    expect(starts).toHaveLength(1);
    expect(starts[0].url).toBe(`${ORIGIN}${HEIC_BACKGROUND_PATH}`);
    expect(JSON.parse(starts[0].init.body)).toEqual({ id: PID, startedAt: claim.startedAt });
    expect(starts[0].init.headers[HEIC_SIGNATURE_HEADER]).toEqual(expect.any(String));

    // Autosave again while the run is live: no second claim, no second start.
    res = await save([LOGO, HEIC]);
    expect(res.statusCode).toBe(200);
    expect(row().design.heic).toEqual(claim);
    expect(starts).toHaveLength(1);

    // 2. The project page: the card shows the run, and its button is refused
    //    with that run while it is live.
    let { view } = await card();
    expect(view).toMatchObject({ state: 'running', converted: 0 });
    expect(view.pending.map((a) => a.path)).toEqual([HEIC.path]);
    res = await admin({ action: 'heic-convert', id: PID });
    expect(res.statusCode).toBe(409);
    expect(json(res).heic).toMatchObject({ status: 'running', by: 'customer', startedAt: claim.startedAt });
    expect(starts).toHaveLength(1);

    // 3. Netlify runs the background function with the request it was sent.
    //    An unsigned copy is turned away first.
    const unsigned = await backgroundHandler({ httpMethod: 'POST', headers: {}, body: starts[0].init.body });
    expect(unsigned.statusCode).toBe(401);
    expect(row().design.heic).toEqual(claim);
    const done = await backgroundHandler({ httpMethod: 'POST', headers: { ...starts[0].init.headers }, body: starts[0].init.body });
    expect(done.statusCode).toBe(200);

    // The JPEG took the HEIC's place: same index and note, a .jpg name, its
    // own path under the kind, convertedFrom the HEIC path. The original
    // HEIC stays in the bucket, the JPEG object is a JPEG.
    const [logo, jpeg] = row().assets;
    expect(logo).toEqual(LOGO);
    expect(jpeg).toEqual({
      path: expect.stringMatching(JPEG_PATH), kind: 'photo', name: 'IMG_0412.jpg', size: expect.any(Number),
      type: 'image/jpeg', note: HEIC.note, convertedFrom: HEIC.path,
    });
    expect(h.db.state.files[HEIC.path]).toBeDefined();
    expect(isJpeg(h.db.state.files[jpeg.path])).toBe(true);
    expect(jpeg.size).toBe(h.db.state.files[jpeg.path].length);
    expect(row().design.heic).toMatchObject({
      status: 'ready', startedAt: claim.startedAt, converted: 1, failed: [], by: 'customer', attempted: true,
    });
    expect(Date.parse(row().design.heic.finishedAt)).toBeGreaterThanOrEqual(Date.parse(claim.startedAt));
    const heicEvents = h.db.state.events.filter((e) => e.type.startsWith('heic_'));
    expect(heicEvents.map((e) => [e.type, e.actor])).toEqual([['heic_started', 'customer'], ['heic_ready', 'customer']]);
    expect(heicEvents[1].data).toEqual({ converted: 1, failed: 0, left: 0, by: 'customer' });

    // Netlify retrying the same request does nothing more.
    const files = Object.keys(h.db.state.files).sort();
    const retried = await backgroundHandler({ httpMethod: 'POST', headers: { ...starts[0].init.headers }, body: starts[0].init.body });
    expect(retried.statusCode).toBe(409);
    expect(Object.keys(h.db.state.files).sort()).toEqual(files);

    // 4. The customer's page, opened before the conversion, still lists the
    //    HEIC path. Its next save (a changed note) keeps the JPEG in that
    //    place with the new note, never brings the HEIC back, and starts no
    //    run (nothing is left to convert).
    res = await save([LOGO, { ...HEIC, note: 'Van after the ceramic coat' }]);
    expect(res.statusCode).toBe(200);
    expect(row().assets).toEqual([LOGO, { ...jpeg, note: 'Van after the ceramic coat' }]);
    expect(starts).toHaveLength(1);
    // A page that sends the JPEG's path with its own name, type, size and
    // convertedFrom changes only the note: the rest comes from the stored
    // asset.
    res = await save([LOGO, {
      ...HEIC, path: jpeg.path, name: 'x.png', type: 'image/png', size: 1, convertedFrom: LOGO.path, note: 'Front three-quarter',
    }]);
    expect(res.statusCode).toBe(200);
    expect(row().assets[1]).toEqual({ ...jpeg, note: 'Front three-quarter' });

    // 5. The project page: the card is done, and its button finds nothing.
    let p;
    ({ p, view } = await card());
    expect(view).toMatchObject({ state: 'ready', converted: 1, failed: [] });
    expect(view.pending).toEqual([]);
    expect(p.files[1]).toMatchObject({ path: jpeg.path, convertedFrom: HEIC.path });
    res = await admin({ action: 'heic-convert', id: PID });
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('Nothing to convert');
    expect(starts).toHaveLength(1);

    // 6. Every reader of the customer's images takes the JPEG now.
    const after = row().assets;
    expect(isImportable(jpeg.name)).toBe(true);
    expect(designFromIntake(row()).slots).toMatchObject({ logo: LOGO.path, hero: jpeg.path });
    const suggest = suggestImageCandidates(after);
    expect(suggest.photo.map((a) => a.path)).toEqual([jpeg.path]);
    expect(suggest.unviewable).toEqual([]);
    const kit = imageCandidates(after, KIT_LIMITS);
    expect(kit.photo.map((a) => a.path)).toEqual([jpeg.path]);
    expect(kit.skipped).toEqual([]);
    // The kit downloads it and checks the bytes: a real JPEG, upright 96x64.
    // (The logo in this fake bucket has no bytes, so it is skipped.)
    const loaded = await loadAssetImages(h.db, row(), { limits: KIT_LIMITS });
    expect(loaded.files).toEqual([expect.objectContaining({
      path: jpeg.path, kind: 'photo', mediaType: 'image/jpeg', width: 96, height: 64, originalName: 'IMG_0412.jpg', note: 'Front three-quarter',
    })]);
  });
});
