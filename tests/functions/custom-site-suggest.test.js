// tests/functions/custom-site-suggest.test.js
//
// "Suggest a design" on the server: the images a request sends
// (_lib/custom-site-suggest-ai.js), the request itself, the background run
// (custom-site-suggest-background) and the claim/read actions
// (custom-site-suggest). Supabase and Anthropic are in-memory fakes; the
// run must never touch the sites table.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: null }));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  supabaseAdmin: () => h.db,
  requireUser: async () => {
    if (!h.user) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return h.user;
  },
}));

const {
  MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, SUGGEST_MAX_TOKENS, loadSuggestImages, requestSuggestion, sniffImage,
} = await import('../../netlify/functions/_lib/custom-site-suggest-ai.js');
const { SUGGEST_STALE_MS } = await import('../../src/lib/designSuggest.js');
const { runSuggest, handler: backgroundHandler } = await import('../../netlify/functions/custom-site-suggest-background.js');
const { handler } = await import('../../netlify/functions/custom-site-suggest.js');

const PID = '11111111-2222-4333-8444-555555555555';
const ADMIN = { id: 'admin-1', email: 'admin@acg.test', is_super_admin: true };
const STARTED = '2026-10-05T12:00:00.000Z';
const path = (kind, n, ext = 'jpg') => `${PID}/${kind}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;

// ─── Image bytes ──────────────────────────────────────────────────────

const pad = (buf, size = 64) => Buffer.concat([buf, Buffer.alloc(Math.max(0, size - buf.length))]);
function png(w = 1200, h = 800, size) {
  const head = Buffer.alloc(24);
  Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(head, 0);
  head.writeUInt32BE(13, 8);
  head.write('IHDR', 12, 'latin1');
  head.writeUInt32BE(w, 16);
  head.writeUInt32BE(h, 20);
  return pad(head, size);
}
function jpeg(w = 1600, h = 1200, size) {
  const app0 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0', 'latin1'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3]);
  return pad(Buffer.concat([app0, sof]), size);
}
function webp(w = 800, h = 600) {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'latin1');
  b.write('WEBP', 8, 'latin1');
  b.write('VP8X', 12, 'latin1');
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return b;
}
const gif = (w = 300, h = 200) => {
  const b = pad(Buffer.from('GIF89a', 'latin1'), 32);
  b.writeUInt16LE(w, 6);
  b.writeUInt16LE(h, 8);
  return b;
};

// ─── Fakes ────────────────────────────────────────────────────────────

// Projects carry updated_at, moved on every write as the table's trigger
// does; `state.beforeUpdate` runs once just before the next update, to
// stand in for another write landing between a read and a write.
function fakeDb({ projects = [], profiles = [ADMIN], files = {} } = {}) {
  const state = { projects, profiles, events: [], downloads: [], tables: new Set(), clock: 0, beforeUpdate: null };
  state.tick = () => new Date(Date.UTC(2026, 9, 5, 13, 0, 0, ++state.clock)).toISOString();
  const tableOf = { custom_site_projects: 'projects', custom_site_project_events: 'events', profiles: 'profiles' };
  function run(q) {
    state.tables.add(q.table);
    const key = tableOf[q.table];
    if (!key) throw new Error(`unexpected table ${q.table}`);
    const rows = state[key];
    const match = (r) => q.ops.filter((o) => o[0] === 'eq').every(([, c, v]) => r[c] === v);
    const op = (n) => q.ops.find((o) => o[0] === n);
    if (op('insert')) {
      rows.push({ ...op('insert')[1], created_at: new Date().toISOString() });
      return { error: null };
    }
    const single = op('single') || op('maybeSingle');
    if (op('update')) {
      const hook = state.beforeUpdate;
      state.beforeUpdate = null;
      if (hook) hook();
      const hits = rows.filter(match);
      hits.forEach((r) => Object.assign(r, structuredClone(op('update')[1]), key === 'projects' ? { updated_at: state.tick() } : {}));
      return single ? { data: hits[0] ? structuredClone(hits[0]) : null, error: null } : { error: null };
    }
    const hits = rows.filter(match);
    return single ? { data: structuredClone(hits[0] || null), error: null } : { data: hits.map((r) => structuredClone(r)), error: null };
  }
  const from = (table) => {
    const q = { table, ops: [] };
    const api = {};
    for (const n of ['select', 'insert', 'update', 'eq', 'order', 'limit']) api[n] = (...a) => { q.ops.push([n, ...a]); return api; };
    api.single = () => { q.ops.push(['single']); return Promise.resolve(run(q)); };
    api.maybeSingle = () => { q.ops.push(['maybeSingle']); return Promise.resolve(run(q)); };
    api.then = (res, rej) => Promise.resolve(run(q)).then(res, rej);
    return api;
  };
  const storage = {
    from: (bucket) => ({
      download: async (p) => {
        state.downloads.push({ bucket, path: p });
        const f = files[p];
        if (!f) return { data: null, error: { message: 'Object not found' } };
        return { data: new Blob([f]), error: null };
      },
    }),
  };
  return { from, storage, state };
}

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      create: vi.fn(async (body, opts) => {
        calls.push({ body, opts });
        const next = responses.shift();
        if (typeof next === 'function') return next();
        if (next instanceof Error) throw next;
        return next;
      }),
    },
  };
}

const ASSETS = [
  { path: path('logo', 1, 'png'), kind: 'logo', name: 'logo.png', size: 64 },
  { path: path('reference', 2), kind: 'reference', name: 'ref.jpg', size: 64, note: 'love the dark look' },
  { path: path('photo', 3), kind: 'photo', name: 'car1.jpg', size: 64 },
  { path: path('photo', 4), kind: 'photo', name: 'car2.jpg', size: 64 },
  { path: path('photo', 5, 'heic'), kind: 'photo', name: 'IMG_5.HEIC', size: 64 },
];
const FILES = { [path('logo', 1, 'png')]: png(), [path('reference', 2)]: jpeg(), [path('photo', 3)]: jpeg(), [path('photo', 4)]: jpeg() };

const OTHER_DESIGN = {
  businessInfo: { businessName: 'Gloss Boss', businessType: 'mobile_detailing', city: 'Austin', state: 'TX' },
  templateId: 'mobile_chrome',
  levers: { palette: { accent: '#00ff00' } },
  slots: { logo: path('logo', 1, 'png'), hero: '', about: '', gallery: [] },
  launch: { domain: 'gloss.test' },
};

function project(extra = {}, suggestion = { status: 'running', startedAt: STARTED }) {
  return {
    id: PID,
    business_name: 'Gloss Boss',
    form: {
      businessName: 'Gloss Boss', businessType: 'mobile_detailing', about: 'Started in 2012 out of my garage, 12 years in business. Fully insured.',
      whyUs: 'We take cash and Venmo.',
    },
    assets: ASSETS,
    design: { ...OTHER_DESIGN, ...(suggestion ? { suggestion } : {}) },
    updated_at: '2026-10-05T11:00:00.000Z',
    ...extra,
  };
}

const SUGGESTION_JSON = {
  templateId: 'mobile_sudsy',
  levers: {
    palette: { bg: '#fffbeb', secondary: '#fef3c7', text: '#1c1917', muted: '#78716c', accent: '#cc0000' },
    fonts: { heading: 'Poppins', body: 'Nunito' },
    sections: { order: ['gallery', 'services'], hidden: ['whyUs'] },
    heroLayout: 'split',
    aboutLayout: 'image',
  },
  photoPlan: { hero: path('photo', 3), about: '', gallery: [path('photo', 4), path('photo', 99)] },
  reasons: { template: 'Friendly brand', palette: 'Their red', fonts: 'Readable', sections: 'Photos first', layout: 'Busy photo', photos: 'Sharpest car' },
  facts: [
    { field: 'yearsInBusiness', value: '12', quote: '12 years in business' },
    { field: 'awards', value: 'Best of Austin 2024', quote: 'Best of Austin 2024' },
    { field: 'paymentMethods', value: 'Venmo', quote: 'We take cash and Venmo' },
  ],
};
const ok = (json = SUGGESTION_JSON) => ({
  model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(json) }],
});
const post = (body) => ({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer admin-token' },
  rawUrl: 'https://deploy-preview-7--acg.netlify.app/.netlify/functions/custom-site-suggest',
  body: JSON.stringify(body),
});
const json = (res) => JSON.parse(res.body);

let fetchMock;
beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 'admin-1' };
  fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── Images ───────────────────────────────────────────────────────────

describe('sniffImage', () => {
  it('reads the real format and size from the first bytes', () => {
    expect(sniffImage(png(1200, 800))).toEqual({ mediaType: 'image/png', width: 1200, height: 800 });
    expect(sniffImage(jpeg(4032, 3024))).toEqual({ mediaType: 'image/jpeg', width: 4032, height: 3024 });
    expect(sniffImage(webp(800, 600))).toEqual({ mediaType: 'image/webp', width: 800, height: 600 });
    expect(sniffImage(gif(300, 200))).toEqual({ mediaType: 'image/gif', width: 300, height: 200 });
    expect(sniffImage(pad(Buffer.from('%PDF-1.7')))).toBeNull();
    expect(sniffImage(Buffer.from('tiny'))).toBeNull();
  });
});

describe('loadSuggestImages', () => {
  it('sends 1 logo, 4 inspiration images and 8 photos at most, in order, and says why the rest are not sent', async () => {
    const assets = [
      { path: path('logo', 1, 'svg'), kind: 'logo', name: 'logo.svg', size: 64 },
      { path: path('logo', 2, 'png'), kind: 'logo', name: 'logo.png', size: 64 },
      { path: path('logo', 3, 'png'), kind: 'logo', name: 'logo-white.png', size: 64 },
      ...Array.from({ length: 6 }, (_, i) => ({ path: path('reference', 10 + i), kind: 'reference', name: `ref${i}.jpg`, size: 64 })),
      ...Array.from({ length: 10 }, (_, i) => ({ path: path('photo', 20 + i), kind: 'photo', name: `car${i}.jpg`, size: 64 })),
      { path: path('brand', 40, 'pdf'), kind: 'brand', name: 'guide.pdf', size: 64 },
    ];
    const files = Object.fromEntries(assets.map((a) => [a.path, a.name.endsWith('.png') ? png() : jpeg()]));
    const db = fakeDb({ files });
    const { images, skipped } = await loadSuggestImages(db, { assets });
    expect(images.map((i) => i.name)).toEqual(['logo.png', 'ref0.jpg', 'ref1.jpg', 'ref2.jpg', 'ref3.jpg', ...Array.from({ length: 8 }, (_, i) => `car${i}.jpg`)]);
    expect(images[0]).toEqual(expect.objectContaining({ kind: 'logo', mediaType: 'image/png', data: png().toString('base64') }));
    expect(skipped.map((s) => [s.name, s.reason])).toEqual([
      ['logo.svg', expect.stringMatching(/SVG files can't be viewed/)],
      ['guide.pdf', expect.stringMatching(/Brand files are not sent/)],
      ['logo-white.png', 'Another version of the logo (one is sent)'],
      ['ref4.jpg', 'Only the first 4 inspiration images are sent'],
      ['ref5.jpg', 'Only the first 4 inspiration images are sent'],
      ['car8.jpg', 'Only the first 8 photos are sent'],
      ['car9.jpg', 'Only the first 8 photos are sent'],
    ]);
    // Only what is sent gets downloaded, from the private bucket.
    expect(db.state.downloads).toHaveLength(13);
    expect(new Set(db.state.downloads.map((d) => d.bucket))).toEqual(new Set(['custom-site-assets']));
  });

  it('checks each file: real format, size, pixels, download; the next one takes a failed one\'s place', async () => {
    const assets = [
      { path: path('photo', 1), kind: 'photo', name: 'huge.jpg', size: MAX_IMAGE_BYTES + 1 },
      { path: path('photo', 2), kind: 'photo', name: 'pano.jpg', size: 64 },
      { path: path('photo', 3), kind: 'photo', name: 'gone.jpg', size: 64 },
      { path: path('photo', 4), kind: 'photo', name: 'fake.jpg', size: 64 },
      { path: path('photo', 5, 'png'), kind: 'photo', name: 'really-a-jpeg.png', size: 64 },
      { path: path('photo', 6), kind: 'photo', name: 'liar.jpg', size: 10 },
      ...Array.from({ length: 8 }, (_, i) => ({ path: path('photo', 10 + i), kind: 'photo', name: `ok${i}.jpg`, size: 64 })),
    ];
    const files = {
      [path('photo', 1)]: jpeg(),
      [path('photo', 2)]: jpeg(MAX_IMAGE_SIDE + 1, 2000),
      [path('photo', 4)]: pad(Buffer.from('not an image at all')),
      [path('photo', 5, 'png')]: jpeg(),
      [path('photo', 6)]: jpeg(1000, 800, MAX_IMAGE_BYTES + 10),
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [path('photo', 10 + i), jpeg()])),
    };
    const db = fakeDb({ files });
    const { images, skipped } = await loadSuggestImages(db, { assets });
    expect(images.map((i) => i.name)).toEqual(['really-a-jpeg.png', 'ok0.jpg', 'ok1.jpg', 'ok2.jpg', 'ok3.jpg', 'ok4.jpg', 'ok5.jpg', 'ok6.jpg']);
    expect(images[0].mediaType).toBe('image/jpeg');
    expect(Object.fromEntries(skipped.map((s) => [s.name, s.reason]))).toEqual({
      'huge.jpg': expect.stringMatching(/^Too large to send/),
      'pano.jpg': expect.stringMatching(/^Too many pixels to send \(8001×2000/),
      'gone.jpg': 'Could not be downloaded',
      'fake.jpg': 'Not a readable JPEG, PNG, GIF or WebP image',
      'liar.jpg': expect.stringMatching(/^Too large to send/),
      'ok7.jpg': 'Only the first 8 photos are sent',
    });
    // The oversized upload is never downloaded.
    expect(db.state.downloads.map((d) => d.path)).not.toContain(path('photo', 1));
  });

  it('keeps the whole request under its size limit', async () => {
    const big = jpeg(2000, 1500, 3_600_000);
    const assets = [
      { path: path('logo', 1), kind: 'logo', name: 'logo.jpg', size: big.length },
      ...Array.from({ length: 4 }, (_, i) => ({ path: path('reference', 10 + i), kind: 'reference', name: `ref${i}.jpg`, size: big.length })),
      ...Array.from({ length: 2 }, (_, i) => ({ path: path('photo', 20 + i), kind: 'photo', name: `car${i}.jpg`, size: big.length })),
    ];
    const db = fakeDb({ files: Object.fromEntries(assets.map((a) => [a.path, big])) });
    const { images, skipped } = await loadSuggestImages(db, { assets });
    expect(images).toHaveLength(5);
    expect(skipped.map((s) => [s.name, s.reason])).toEqual([
      ['car0.jpg', 'Left out to keep the request under its size limit'],
      ['car1.jpg', 'Left out to keep the request under its size limit'],
    ]);
  });
});

// ─── The request ──────────────────────────────────────────────────────

describe('requestSuggestion', () => {
  const prompt = { system: 's', content: [{ type: 'text', text: 'u' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AA==' } }], schema: { type: 'object' } };

  it('asks Claude Opus 5.5 at high effort for schema JSON with the images, with the refusal fallback', async () => {
    const client = fakeClient([ok()]);
    const { raw, model } = await requestSuggestion(client, prompt);
    expect(raw.templateId).toBe('mobile_sudsy');
    expect(model).toBe('claude-opus-5-5');
    const { body, opts } = client.calls[0];
    expect(body.model).toBe('claude-opus-5-5');
    // Thinking is always on and counts toward max_tokens.
    expect(body.max_tokens).toBe(SUGGEST_MAX_TOKENS);
    expect(SUGGEST_MAX_TOKENS).toBeGreaterThanOrEqual(32000);
    expect(body.system).toBe('s');
    expect(body.messages).toEqual([{ role: 'user', content: prompt.content }]);
    expect(body.output_config).toEqual({ effort: 'high', format: { type: 'json_schema', schema: prompt.schema } });
    expect(body.fallbacks).toBe('default');
    expect(opts.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    expect(body.thinking).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });

  it('retries as a plain request when the structured one is rejected', async () => {
    const client = fakeClient([Object.assign(new Error('bad request'), { status: 400 }), ok()]);
    await requestSuggestion(client, prompt);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].body.output_config).toEqual({ effort: 'high' });
    expect(client.calls[1].body.fallbacks).toBeUndefined();
    expect(client.calls[1].body.messages[0].content).toBe(prompt.content);
  });

  it('gives both attempts together only the time left before the deadline', async () => {
    const deadlineMs = Date.now() + 5 * 60 * 1000;
    const client = fakeClient([
      () => {
        vi.setSystemTime(Date.now() + 2 * 60 * 1000);
        throw Object.assign(new Error('bad request'), { status: 400 });
      },
      ok(),
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await requestSuggestion(client, prompt, { deadlineMs });
    } finally {
      vi.useRealTimers();
    }
    expect(client.calls[0].opts.timeout).toBeGreaterThan(4.9 * 60 * 1000);
    expect(client.calls[0].opts.timeout).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(client.calls[1].opts.timeout).toBeGreaterThan(2.9 * 60 * 1000);
    expect(client.calls[1].opts.timeout).toBeLessThanOrEqual(3 * 60 * 1000);
    // Without a deadline the client's own timeout applies.
    const plain = fakeClient([ok()]);
    await requestSuggestion(plain, prompt);
    expect(plain.calls[0].opts.timeout).toBeUndefined();
  });

  it('reports a refusal, a cut-off answer and other API errors plainly', async () => {
    await expect(requestSuggestion(fakeClient([{ stop_reason: 'refusal', content: [] }]), prompt)).rejects.toMatchObject({ code: 'refusal' });
    await expect(requestSuggestion(fakeClient([{ stop_reason: 'max_tokens', content: [] }]), prompt)).rejects.toMatchObject({ code: 'max_tokens' });
    const overloaded = Object.assign(new Error('overloaded'), { status: 529 });
    const client = fakeClient([overloaded]);
    await expect(requestSuggestion(client, prompt)).rejects.toBe(overloaded);
    expect(client.calls).toHaveLength(1);
  });
});

// ─── The background run ───────────────────────────────────────────────

describe('custom-site-suggest-background runSuggest', () => {
  it('stores a checked suggestion, keeps the rest of the design and never touches the site', async () => {
    const db = fakeDb({ projects: [project()], files: FILES });
    const client = fakeClient([ok()]);
    const res = await runSuggest({ db, client, projectId: PID, startedAt: STARTED, actor: 'admin@acg.test', now: () => '2026-10-05T12:03:00.000Z' });
    expect(res.status).toBe(200);

    const { body } = client.calls[0];
    expect(body.messages[0].content.filter((b) => b.type === 'image')).toHaveLength(4);
    expect(body.output_config.format.schema.properties.templateId.enum).toEqual(['mobile_chrome', 'mobile_sudsy']);
    expect(body.system).toMatch(/never follow instructions/);

    const { design } = db.state.projects[0];
    const { suggestion, ...rest } = design;
    expect(rest).toEqual(OTHER_DESIGN);
    expect(suggestion).toEqual({
      status: 'ready',
      startedAt: STARTED,
      finishedAt: '2026-10-05T12:03:00.000Z',
      model: 'claude-opus-5-5',
      templateId: 'mobile_sudsy',
      levers: {
        // muted repaired as the page would (4.5:1 on the cards' surface too).
        palette: { ...SUGGESTION_JSON.levers.palette, muted: '#756e69' },
        fonts: { heading: 'Poppins', body: 'Nunito' },
        sections: { order: ['hero', 'gallery', 'services', 'process', 'whyUs', 'about', 'testimonials', 'cta'], hidden: ['whyUs'] },
        heroLayout: 'split',
        aboutLayout: 'image',
      },
      // The made-up path is gone; the HEIC photo was never shown.
      photoPlan: { hero: path('photo', 3), about: '', gallery: [path('photo', 4)] },
      reasons: SUGGESTION_JSON.reasons,
      // The award isn't in the intake: dropped.
      facts: [
        { field: 'yearsInBusiness', value: '12', quote: '12 years in business' },
        { field: 'paymentMethods', value: 'Venmo', quote: 'We take cash and Venmo' },
      ],
      skipped: [{ path: path('photo', 5, 'heic'), kind: 'photo', name: 'IMG_5.HEIC', reason: expect.stringMatching(/HEIC files/) }],
      error: null,
    });
    expect([...db.state.tables].sort()).toEqual(['custom_site_project_events', 'custom_site_projects']);
    expect(db.state.events).toEqual([expect.objectContaining({
      type: 'design_suggest_ready', actor: 'admin@acg.test',
      data: { model: 'claude-opus-5-5', templateId: 'mobile_sudsy', images: 4, skipped: 1, droppedFacts: 1, droppedPhotos: 1 },
    })]);
  });

  it('stops its request before the claim would count as stale', async () => {
    const startedAt = new Date(Date.now() - 60 * 1000).toISOString();
    const db = fakeDb({ projects: [project({}, { status: 'running', startedAt })], files: FILES });
    const client = fakeClient([ok()]);
    expect((await runSuggest({ db, client, projectId: PID, startedAt, actor: 'a' })).status).toBe(200);
    const { timeout } = client.calls[0].opts;
    // 10 minutes from the claim, less a 30 s margin, less the minute already gone.
    expect(timeout).toBeLessThanOrEqual(SUGGEST_STALE_MS - 90 * 1000);
    expect(timeout).toBeGreaterThan(SUGGEST_STALE_MS - 100 * 1000);
  });

  it('matches its run although the start time comes back in another form', async () => {
    const db = fakeDb({ projects: [project({}, { status: 'running', startedAt: '2026-10-05T12:00:00+00:00' })], files: FILES });
    const res = await runSuggest({ db, client: fakeClient([ok()]), projectId: PID, startedAt: STARTED, actor: 'a' });
    expect(res.status).toBe(200);
    expect(db.state.projects[0].design.suggestion).toEqual(expect.objectContaining({ status: 'ready', startedAt: '2026-10-05T12:00:00+00:00' }));
  });

  it('runs only the run start claimed', async () => {
    for (const suggestion of [{ status: 'running', startedAt: '2026-10-05T11:00:00.000Z' }, { status: 'ready', startedAt: STARTED }, null]) {
      const db = fakeDb({ projects: [project({}, suggestion)], files: FILES });
      const client = fakeClient([ok()]);
      const res = await runSuggest({ db, client, projectId: PID, startedAt: STARTED, actor: 'a' });
      expect(res.status).toBe(409);
      expect(client.calls).toHaveLength(0);
      expect(db.state.downloads).toHaveLength(0);
      expect(db.state.projects[0].design.suggestion ?? null).toEqual(suggestion);
    }
    expect((await runSuggest({ db: fakeDb(), client: fakeClient([]), projectId: PID, startedAt: STARTED })).status).toBe(404);
  });

  it('a refusal stores a failed suggestion with the reason', async () => {
    const db = fakeDb({ projects: [project()], files: FILES });
    const res = await runSuggest({ db, client: fakeClient([{ stop_reason: 'refusal', content: [] }]), projectId: PID, startedAt: STARTED, actor: 'a' });
    expect(res.status).toBe(500);
    const { suggestion, ...rest } = db.state.projects[0].design;
    expect(rest).toEqual(OTHER_DESIGN);
    expect(suggestion).toEqual(expect.objectContaining({ status: 'failed', startedAt: STARTED, templateId: '', levers: null, error: expect.stringMatching(/declined/) }));
    expect(db.state.events.map((e) => e.type)).toEqual(['design_suggest_failed']);
  });

  it('keeps a design save that lands between reading and writing', async () => {
    const db = fakeDb({ projects: [project()], files: FILES });
    db.state.beforeUpdate = () => {
      const row = db.state.projects[0];
      row.design = { ...row.design, templateId: 'mobile_sudsy', slots: { ...row.design.slots, hero: path('photo', 3) } };
      row.updated_at = db.state.tick();
    };
    const res = await runSuggest({ db, client: fakeClient([ok()]), projectId: PID, startedAt: STARTED, actor: 'a' });
    expect(res.status).toBe(200);
    const { design } = db.state.projects[0];
    expect(design.templateId).toBe('mobile_sudsy');
    expect(design.slots.hero).toBe(path('photo', 3));
    expect(design.suggestion.status).toBe('ready');
  });

  it('writes nothing when its claim was replaced while it ran', async () => {
    const db = fakeDb({ projects: [project()], files: FILES });
    const newer = { status: 'running', startedAt: '2026-10-05T12:11:00.000Z' };
    const client = fakeClient([() => {
      db.state.projects[0].design.suggestion = newer;
      return ok();
    }]);
    const res = await runSuggest({ db, client, projectId: PID, startedAt: STARTED, actor: 'a' });
    expect(res.status).toBe(409);
    expect(db.state.projects[0].design.suggestion).toEqual(newer);
    expect(db.state.events).toEqual([]);
  });

  it('the background function runs only for a super admin, and only on POST', async () => {
    h.db = fakeDb({ projects: [project()], profiles: [{ ...ADMIN, is_super_admin: false }], files: FILES });
    expect((await backgroundHandler(post({ id: PID, startedAt: STARTED }))).statusCode).toBe(403);
    h.user = null;
    expect((await backgroundHandler(post({ id: PID, startedAt: STARTED }))).statusCode).toBe(401);
    expect((await backgroundHandler({ ...post({ id: PID, startedAt: STARTED }), httpMethod: 'GET' })).statusCode).toBe(405);
    // Nothing was read for the run, nothing sent, the claim is untouched.
    expect(h.db.state.downloads).toHaveLength(0);
    expect(h.db.state.projects[0].design.suggestion).toEqual({ status: 'running', startedAt: STARTED });
    expect(h.db.state.events).toEqual([]);
  });
});

// ─── Claim and read ───────────────────────────────────────────────────

describe('custom-site-suggest', () => {
  it('is for super admins only', async () => {
    h.db = fakeDb({ projects: [project({}, null)], profiles: [{ ...ADMIN, is_super_admin: false }] });
    expect((await handler(post({ action: 'start', id: PID }))).statusCode).toBe(403);
    h.user = null;
    expect((await handler(post({ action: 'get', id: PID }))).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('start claims a run, keeps the rest of the design and starts the background function as the admin', async () => {
    h.db = fakeDb({ projects: [project({}, { status: 'ready', startedAt: '2026-10-01T00:00:00.000Z', templateId: 'mobile_chrome' })] });
    const res = await handler(post({ action: 'start', id: PID }));
    expect(res.statusCode).toBe(200);
    const { startedAt, suggestion } = json(res);
    expect(suggestion).toEqual({ status: 'running', startedAt });
    const { suggestion: stored, ...rest } = h.db.state.projects[0].design;
    expect(stored).toEqual({ status: 'running', startedAt });
    expect(rest).toEqual(OTHER_DESIGN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://deploy-preview-7--acg.netlify.app/.netlify/functions/custom-site-suggest-background');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer admin-token');
    expect(JSON.parse(init.body)).toEqual({ id: PID, startedAt });
    expect(h.db.state.events.map((e) => e.type)).toEqual(['design_suggest_started']);
  });

  it('start refuses a second live run, but not one that went stale', async () => {
    h.db = fakeDb({ projects: [project({}, null)] });
    expect((await handler(post({ action: 'start', id: PID }))).statusCode).toBe(200);
    const second = await handler(post({ action: 'start', id: PID }));
    expect(second.statusCode).toBe(409);
    expect(json(second).suggestion.status).toBe('running');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    h.db.state.projects[0].design.suggestion.startedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    expect((await handler(post({ action: 'start', id: PID }))).statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('start gives the claim up when the background function can\'t be started', async () => {
    h.db = fakeDb({ projects: [project({}, null)] });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const res = await handler(post({ action: 'start', id: PID }));
    expect(res.statusCode).toBe(502);
    expect(json(res).error).toMatch(/answered 404/);
    expect(h.db.state.projects[0].design.suggestion).toEqual(expect.objectContaining({ status: 'failed', error: expect.stringMatching(/Couldn't start/) }));

    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));
    expect((await handler(post({ action: 'start', id: PID }))).statusCode).toBe(502);
    expect(h.db.state.events.map((e) => e.type)).toEqual(['design_suggest_started', 'design_suggest_failed', 'design_suggest_started', 'design_suggest_failed']);
  });

  it('start with invoke: false only claims, and release gives up only the run it names', async () => {
    h.db = fakeDb({ projects: [project({}, null)] });
    const { startedAt } = json(await handler(post({ action: 'start', id: PID, invoke: false })));
    expect(fetchMock).not.toHaveBeenCalled();
    await handler(post({ action: 'release', id: PID, startedAt: '2026-10-05T11:00:00.000Z', error: 'x' }));
    expect(h.db.state.projects[0].design.suggestion.status).toBe('running');
    await handler(post({ action: 'release', id: PID, startedAt, error: 'Network down' }));
    expect(h.db.state.projects[0].design.suggestion).toEqual(expect.objectContaining({ status: 'failed', startedAt, error: expect.stringContaining('Network down') }));
  });

  it('get returns the suggestion, and shows a run that died as failed', async () => {
    h.db = fakeDb({ projects: [project({}, null)] });
    expect(json(await handler(post({ action: 'get', id: PID })))).toEqual({ suggestion: null });

    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    h.db = fakeDb({ projects: [project({}, { status: 'running', startedAt: old })] });
    const { suggestion } = json(await handler(post({ action: 'get', id: PID })));
    expect(suggestion).toEqual(expect.objectContaining({ status: 'failed', startedAt: old, error: expect.stringMatching(/didn't finish/) }));
    expect(h.db.state.projects[0].design.suggestion.status).toBe('failed');
    expect(h.db.state.events).toEqual([expect.objectContaining({ type: 'design_suggest_failed', actor: 'system' })]);
  });

  it('answers 404 for an unknown project and 400 for an unknown action', async () => {
    h.db = fakeDb({ projects: [] });
    expect((await handler(post({ action: 'start', id: PID }))).statusCode).toBe(404);
    expect((await handler(post({ action: 'get' }))).statusCode).toBe(404);
    expect((await handler(post({ action: 'apply', id: PID }))).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
