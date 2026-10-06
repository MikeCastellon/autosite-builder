// tests/functions/kit-photos.test.js
//
// The photo desk's server spec (netlify/functions/_lib/kit/photos.js): what
// a run sends (the customer's photos as container files, never shown as
// images, the Design setup's current picks first), the prompt, the
// sanitizer and notes over the skill's photos.json, the smoke sample and
// its strict check, and one run through production's buildKitRun with a
// fake Anthropic client. Nothing reaches the API, the database or the
// bucket.
import { describe, it, expect, vi } from 'vitest';
import {
  PHOTO_INPUT_MAX, PHOTO_INTAKE_FIELDS, currentSlotPaths, encodePng, notes, sampleContainerPhotos, samplePhotos,
  smokeCheck, smokeSample, spec,
} from '../../netlify/functions/_lib/kit/photos.js';
import { KIT_SPECS, kitConfigured } from '../../netlify/functions/_lib/kit/index.js';
import { sniffImage } from '../../netlify/functions/_lib/custom-site-suggest-ai.js';
import { buildKitRun, prepareKitRun } from '../../netlify/functions/custom-site-kit-background.js';
import { KIT_BUDGET_MS } from '../../src/lib/launchKit.js';
import { CROP_ASPECTS, PHOTOS_SCHEMA, cropFor, photoSlots, sanitizePhotos } from '../../src/lib/kit/photos.js';
import { sanitizeDesign } from '../../src/lib/customSiteDesign.js';
import { deflateSync } from 'node:zlib';

const NOW = Date.parse('2026-10-06T12:01:00.000Z');
const SKILL = { type: 'custom', skill_id: 'skill_01Photos', version: '1759700000000000' };

// Storage that serves the sample's files (what scripts/skills-smoke.mjs
// does too); `fail` makes some downloads fail.
function sampleDb(files, { fail = () => false } = {}) {
  const downloads = [];
  return {
    downloads,
    storage: {
      from: () => ({
        download: async (p) => {
          downloads.push(p);
          if (fail(p) || !files[p]) return { data: null, error: { message: 'Object not found' } };
          return { data: new Blob([files[p]]), error: null };
        },
      }),
    },
    from: (table) => { throw new Error(`no database here (asked for ${table})`); },
  };
}

async function prepare(sample = smokeSample(), opts = {}) {
  const db = sampleDb(sample.files || {}, opts);
  const prepared = await prepareKitRun({
    db, project: sample.project, site: sample.site ?? null, key: 'photos', spec: KIT_SPECS.photos,
    deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl: async () => { throw new Error('no network'); },
  });
  return { ...prepared, db };
}

// A small PNG (for projects with many photos).
const tinyPng = (seed) => encodePng({ width: 4, height: 3, px: Buffer.alloc(36, seed) }, deflateSync);

// The photos.json a careful run writes for the smoke sample, in container
// names: the sharp driveway photo as the hero (its near-duplicate and the
// blurry shot skipped), the owner as the about photo, the dirty/clean pair,
// and a plate blur over every plate on a used photo.
function goodRaw() {
  const container = sampleContainerPhotos();
  const list = samplePhotos();
  const nameOf = (kind) => container.find((c) => c.path === list.find((p) => p.kind === kind).path).name;
  const info = (kind) => list.find((p) => p.kind === kind);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const plate = (kind) => {
    const b = info(kind).plate;
    return [{ x: r4(b.x - b.w * 0.1), y: r4(b.y - b.h * 0.1), w: r4(b.w * 1.2), h: r4(b.h * 1.2), kind: 'plate' }];
  };
  const pick = (kind, role, score, reason, alt, focal, blur = []) => {
    const p = info(kind);
    return {
      path: nameOf(kind), role, score, reason, alt, focal,
      crops: { desktop: cropFor(p.width, p.height, focal, CROP_ASPECTS.desktop), phone: cropFor(p.width, p.height, focal, CROP_ASPECTS.phone) },
      blur, width: p.width, height: p.height,
    };
  };
  return {
    version: 1,
    picks: [
      pick('hero', 'hero', 9, 'Sharp and wide, the whole car in even light', 'Red sedan parked on a driveway in front of a row of trees', { x: 0.53, y: 0.63 }, plate('hero')),
      pick('about', 'about', 7.5, 'The owner facing the camera', 'Person in a blue top standing in front of a white wall', { x: 0.5, y: 0.3 }),
      pick('before', 'before', 7, 'Same spot as the after photo, mud on the doors', 'White car in a shop with mud on the doors and wheels', { x: 0.5, y: 0.65 }, plate('before')),
      pick('after', 'after', 8, 'Clean, same framing as the before photo', 'The same white car in the shop, clean', { x: 0.5, y: 0.65 }, plate('after')),
      pick('duplicate', 'skip', 5, 'Near-duplicate of the hero', '', { x: 0.54, y: 0.62 }),
      pick('blurry', 'skip', 4, 'Out of focus', '', { x: 0.53, y: 0.43 }),
    ],
    pairs: [{ before: nameOf('before'), after: nameOf('after'), note: 'Mud washed off the doors and wheels' }],
    shotList: [
      'A finished car from the front corner, the whole car in frame, phone held sideways',
      'Before and after of the same car from the same spot',
      'You at work beside your van, logo visible',
    ],
    notes: ['A photo note asked to call the business the best in town; the alt text describes only what is visible.'],
  };
}

describe('the photos spec', () => {
  it('is built and runs once its skill id is set', () => {
    expect(KIT_SPECS.photos.stub).toBe(false);
    expect(KIT_SPECS.photos.maxTurns).toBe(10);
    expect(kitConfigured('photos', { CUSTOM_SITE_KIT_PHOTOS_SKILL_ID: SKILL.skill_id, CUSTOM_SITE_KIT_PHOTOS_SKILL_VERSION: SKILL.version })).toBe(true);
    expect(kitConfigured('photos', {})).toBe(false);
    expect(spec.smokeCheck).toBe(smokeCheck);
  });

  it('sends the photos to the container only, the Design setup\'s picks first', async () => {
    const sample = smokeSample();
    const { files, ctx, db } = await prepare(sample);
    const list = samplePhotos();
    const order = currentSlotPaths(sample.project);
    expect(order).toEqual([list[1].path, list[0].path, list[2].path]);
    expect(files.map((f) => f.name)).toEqual(['photo-1.png', 'photo-2.png', 'photo-3.png', 'photo-4.png', 'photo-5.png', 'photo-6.png']);
    expect(files.every((f) => f.vision === false && f.mediaType === 'image/png')).toBe(true);
    expect(ctx.inputs.photos.map((p) => p.path)).toEqual([...order, ...list.slice(3).map((p) => p.path)]);
    expect(ctx.inputs.photos[0]).toMatchObject({ name: 'photo-1.png', width: 1600, height: 1000, originalName: 'IMG_2042.png' });
    expect(files[0].data.equals(list[1].png)).toBe(true);
    expect(ctx.inputs.current).toEqual({ hero: 'photo-1.png', about: '', gallery: ['photo-2.png', 'photo-3.png'] });
    expect(ctx.inputs.business).toEqual({ name: 'Sample Shine Mobile Detailing', typeId: 'mobile_detailing', label: 'Mobile detailing' });
    expect(db.downloads).toHaveLength(6);
  });

  it('writes a prompt with the photos and intake as data, the schema, and no contact details', async () => {
    const { system, userText } = await prepare();
    expect(system).toMatch(/photo editor at Genius Websites/);
    expect(system).toContain('Use the launch-photo-desk skill');
    expect(system).toContain('- photos.json\n');
    expect(system).toMatch(/contact_sheet\.png \(only when/);
    expect(userText).toContain('Names for analyze.py --names: photo-1.png,photo-2.png,photo-3.png,photo-4.png,photo-5.png,photo-6.png');
    expect(userText).toMatch(/<customer_photos>\n- photo-1\.png: a photo\. Their file name: "IMG_2042\.png"\. Their note: "Use this one as the main photo/);
    expect(userText).toContain('Before: mud from a weekend at the lake');
    expect(userText).toContain('Business type for the shot list (data/shot_list.json): mobile_detailing.');
    expect(userText).toContain('hero photo-1.png; gallery photo-2.png, photo-3.png');
    expect(userText).toContain(JSON.stringify(PHOTOS_SCHEMA));
    expect(userText).toMatch(/<customer_intake>[\s\S]*Full detail \$199[\s\S]*<\/customer_intake>/);
    for (const secret of ['sam@example.test', '(555) 010-0199', 'Sam Sample']) expect(userText).not.toContain(secret);
    expect(PHOTO_INTAKE_FIELDS).not.toContain('contactEmail');
  });

  it('fails before anything is sent when there are no photos, or none can be read', async () => {
    const sample = smokeSample();
    const none = structuredClone({ project: sample.project });
    none.project.assets = [];
    await expect(prepare({ project: none.project, files: {} })).rejects.toThrow(/hasn't uploaded any photos/);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(prepare(sample, { fail: () => true })).rejects.toThrow(/None of the customer's photos could be sent \(Could not be downloaded\)/);
    expect(warn).toHaveBeenCalledTimes(6);
    warn.mockRestore();
  });

  it('sends at most 40 photos and says which were left out', async () => {
    const sample = smokeSample();
    const project = structuredClone(sample.project);
    const files = {};
    project.assets = Array.from({ length: PHOTO_INPUT_MAX + 5 }, (_, i) => {
      const path = `${project.id}/photo/00000000-0000-4000-8000-${String(900 + i).padStart(12, '0')}.png`;
      files[path] = tinyPng(i);
      return { path, kind: 'photo', name: `IMG_${i}.png`, size: files[path].length };
    });
    project.assets.push({ path: `${project.id}/photo/00000000-0000-4000-8000-000000000999.heic`, kind: 'photo', name: 'IMG_9.heic', size: 100 });
    project.assets.push({ path: `${project.id}/photo/00000000-0000-4000-8000-000000000998.jpg`, kind: 'photo', name: 'huge.jpg', size: 30 * 1024 * 1024 });
    project.design = {};
    const { files: sent, ctx } = await prepare({ project, files });
    expect(sent).toHaveLength(PHOTO_INPUT_MAX);
    const reasons = ctx.inputs.skipped.map((s) => s.reason);
    expect(reasons.filter((r) => r === `Only the first ${PHOTO_INPUT_MAX} photos are sent`)).toHaveLength(5);
    expect(reasons).toEqual(expect.arrayContaining([expect.stringMatching(/HEIC files aren't sent/), expect.stringMatching(/Too large to send/)]));
    const { userText } = spec.buildPrompt(ctx);
    expect(userText).toContain('Uploads not sent');
    expect(userText).toContain('IMG_9.heic');
  });

  it('stores the picks under the uploads\' paths, ready for the Design setup', async () => {
    const { ctx } = await prepare();
    const raw = goodRaw();
    const data = spec.sanitize(raw, ctx);
    const list = samplePhotos();
    expect(data.picks.find((p) => p.role === 'hero').path).toBe(list[0].path);
    expect(data.pairs).toEqual([{ before: list[2].path, after: list[3].path, note: 'Mud washed off the doors and wheels' }]);
    expect(notes(raw, data, ctx)).toEqual(raw.notes);
    // The slots "Use these picks" hands over pass the Design setup's own check.
    const slots = photoSlots(data);
    expect(slots).toEqual({ hero: list[0].path, about: list[4].path, gallery: [list[3].path] });
    expect(sanitizeDesign({ slots }).slots).toEqual({ logo: '', ...slots });
  });

  it('tells the admin when the server had to change photos.json', async () => {
    const { ctx } = await prepare();
    const raw = goodRaw();
    raw.picks[0].alt = 'The best detail in town';
    raw.picks.push({ ...raw.picks[1], path: 'photo-99.png' });
    const data = spec.sanitize(raw, ctx);
    const out = notes(raw, data, ctx);
    expect(out[0]).toMatch(/^The server changed photos\.json in 2 places: .*alt text dropped \(claims "best"\); unknown photo photo-99\.png dropped\.$/);
    expect(out.slice(1)).toEqual(raw.notes);
    expect(spec.sanitize({ picks: [] }, ctx)).toBeNull();
  });
});

describe('the smoke sample', () => {
  it('draws six readable photos with known plates', () => {
    const list = samplePhotos();
    expect(list).toHaveLength(6);
    for (const p of list) {
      const info = sniffImage(p.png);
      expect(info).toEqual({ mediaType: 'image/png', width: p.width, height: p.height });
      expect(p.png.length).toBeLessThan(5 * 1024 * 1024);
    }
    expect(list.filter((p) => p.plate)).toHaveLength(5);
    expect(samplePhotos()).toBe(list);
  });

  it('accepts a careful run and names what a careless one got wrong', () => {
    const raw = goodRaw();
    // A comparative judgement in a reason is fine; the planted claim isn't.
    raw.picks[0].reason = 'The best wide photo of the set, the whole car in even light';
    const data = sanitizePhotos(raw, { photos: sampleContainerPhotos() });
    expect(smokeCheck(raw, data, [{ name: 'contact_sheet.png' }])).toEqual([]);
    const planted = goodRaw();
    planted.shotList[0] = 'Show why you are the best detailer in town';
    expect(smokeCheck(planted, sanitizePhotos(planted, { photos: sampleContainerPhotos() }), [{ name: 'contact_sheet.png' }]))
      .toEqual([expect.stringMatching(/"best detailer in town" claim reached/)]);

    const bad = goodRaw();
    bad.picks[0].blur = [];
    bad.picks[5].role = 'gallery';
    bad.picks[5].alt = 'A blue car';
    bad.pairs = [];
    const badData = sanitizePhotos(bad, { photos: sampleContainerPhotos() });
    const problems = smokeCheck(bad, badData, []);
    expect(problems).toEqual(expect.arrayContaining([
      'contact_sheet.png did not come back',
      'the blurry photo is in use',
      'the before/after pair was not found',
      expect.stringMatching(/^the plate on IMG_2041\.png \(hero\) has no blur box over it$/),
      expect.stringMatching(/^the server had to change photos\.json: an unpaired before photo moved$/),
    ]));
  });
});

// ─── One run through production's buildKitRun ────────────────────────

function fakeClient(photosJson, sheet) {
  const uploads = [];
  const deleted = [];
  const outputs = {
    file_out_1: { filename: 'photos.json', data: Buffer.from(JSON.stringify(photosJson)) },
    file_out_2: { filename: 'contact_sheet.png', data: sheet },
  };
  return {
    uploads,
    deleted,
    files: {
      upload: vi.fn(async ({ file }) => {
        uploads.push({ name: file.name, type: file.type, size: (await file.arrayBuffer()).byteLength });
        return { id: `file_in_${uploads.length}` };
      }),
      retrieveMetadata: vi.fn(async (id) => ({ id, filename: outputs[id]?.filename || '', size_bytes: outputs[id]?.data.length || 0 })),
      download: vi.fn(async (id) => ({ arrayBuffer: async () => outputs[id].data })),
      delete: vi.fn(async (id) => { deleted.push(id); return { id }; }),
    },
    messages: {
      stream: vi.fn(() => ({
        finalMessage: async () => ({
          model: 'claude-opus-5-5',
          stop_reason: 'end_turn',
          container: { id: 'cntr_photos' },
          usage: { input_tokens: 30000, output_tokens: 6000 },
          content: [{
            type: 'bash_code_execution_tool_result',
            tool_use_id: 'srvtoolu_1',
            content: {
              type: 'bash_code_execution_result', stdout: '', stderr: '', return_code: 0,
              content: [{ type: 'bash_code_execution_output', file_id: 'file_out_1' }, { type: 'bash_code_execution_output', file_id: 'file_out_2' }],
            },
          }],
        }),
      })),
    },
  };
}

describe('a run', () => {
  it('uploads the photos, takes photos.json and the contact sheet back, and stores what the server checked', async () => {
    const sample = smokeSample();
    const raw = goodRaw();
    const sheet = tinyPng(7);
    const client = fakeClient(raw, sheet);
    const result = await buildKitRun({
      db: sampleDb(sample.files), client, project: sample.project, key: 'photos', spec: KIT_SPECS.photos, skill: SKILL,
      deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW,
    });
    expect(client.uploads.map((u) => [u.name, u.type])).toEqual(
      ['photo-1.png', 'photo-2.png', 'photo-3.png', 'photo-4.png', 'photo-5.png', 'photo-6.png'].map((n) => [n, 'image/png']),
    );
    const body = client.messages.stream.mock.calls[0][0];
    expect(body.container.skills).toEqual([SKILL]);
    // The photos are container files only: the skill's sheets are how
    // Claude sees them.
    expect(body.messages[0].content.filter((b) => b.type === 'image')).toEqual([]);
    expect(body.messages[0].content.filter((b) => b.type === 'container_upload')).toHaveLength(6);
    expect(result.data).toEqual(sanitizePhotos(raw, { photos: sampleContainerPhotos() }));
    expect(result.outputs.map((o) => o.name)).toEqual(['photos.json', 'contact_sheet.png']);
    expect(JSON.parse(result.outputs[0].data.toString('utf8'))).toEqual(result.data);
    expect(result.outputs[1].data.equals(sheet)).toBe(true);
    expect(result.notes).toEqual(raw.notes);
    expect(result.warnings).toEqual([]);
    expect(client.deleted.sort()).toEqual(['file_in_1', 'file_in_2', 'file_in_3', 'file_in_4', 'file_in_5', 'file_in_6', 'file_out_1', 'file_out_2']);
  });
});
