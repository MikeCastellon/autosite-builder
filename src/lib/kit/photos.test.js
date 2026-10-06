// src/lib/kit/photos.test.js
//
// The photo desk's contract (src/lib/kit/photos.js): the sanitizer the
// server stores photos.json through, the crop math, the slots "Use these
// picks" hands the Design setup, and the result view
// (components/admin/kit/PhotosResult.jsx).
//
// The skill's validator holds the same rules, and both sides run the
// fixtures its tests/make_fixtures.py writes
// (skills/api/launch-photo-desk/tests/fixtures.json): a photos.json the
// validator accepts is stored unchanged, and every broken copy of it the
// validator rejects for a rule the server holds too is reported as a
// repair here. After changing a rule on either side:
//   python3 skills/api/launch-photo-desk/tests/make_fixtures.py
//   python3 skills/api/launch-photo-desk/tests/test_photos.py
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BLUR_KINDS, CLAIM_WORDS, CROP_ASPECTS, CROP_ASPECT_TOLERANCE, GALLERY_SLOTS, PHOTOS_SCHEMA, PHOTO_LIMITS, PHOTO_ROLES,
  altProblem, boxStyle, claimIn, cropAspectError, cropFor, cropPreviewStyle, pairAfters, photoCounts, photoSlots,
  picksByRole, sanitizePhotos, sanitizePhotosReport,
} from './photos.js';
import PhotosResult from '../../components/admin/kit/PhotosResult.jsx';

const SKILL = path.resolve(__dirname, '../../../skills/api/launch-photo-desk');
const fixtures = JSON.parse(fs.readFileSync(path.join(SKILL, 'tests/fixtures.json'), 'utf8'));
const PID = '11111111-2222-4333-8444-555555555555';
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

// The photos a run saw: container name → stored path, with the size the
// server reads from the bytes (before any EXIF turn).
function runPhotos(extra = []) {
  return [...fixtures.photos, ...extra].map((p, i) => ({
    name: p.name, path: `${PID}/photo/${uuid(i + 1)}.${p.name.split('.').pop()}`, width: p.storedWidth, height: p.storedHeight,
  }));
}

// `doc` with every container name swapped for its stored path.
function stored(doc, photos) {
  const to = new Map(photos.map((p) => [p.name, p.path]));
  const out = structuredClone(doc);
  for (const p of out.picks) p.path = to.get(p.path) || p.path;
  for (const pr of out.pairs) {
    pr.before = to.get(pr.before) || pr.before;
    pr.after = to.get(pr.after) || pr.after;
  }
  return out;
}

const valid = () => structuredClone(fixtures.valid);

describe('shared with the skill', () => {
  it('uses the skill\'s claim words and caps', () => {
    const words = JSON.parse(fs.readFileSync(path.join(SKILL, 'data/claim_words.json'), 'utf8'));
    expect([...CLAIM_WORDS]).toEqual(words.errors);
    const common = fs.readFileSync(path.join(SKILL, 'scripts/common.py'), 'utf8');
    const block = /LIMITS = \{([\s\S]*?)\}/.exec(common)[1];
    const limits = Object.fromEntries([...block.matchAll(/'(\w+)': (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(limits).toEqual({ ...PHOTO_LIMITS });
    expect(common).toContain(`ROLES = (${PHOTO_ROLES.map((r) => `'${r}'`).join(', ')})`);
    expect(common).toContain(`BLUR_KINDS = (${BLUR_KINDS.map((r) => `'${r}'`).join(', ')})`);
    expect(common).toContain(`ASPECT_TOLERANCE = ${CROP_ASPECT_TOLERANCE}`);
    expect(common).toContain(`ASPECTS = {'desktop': (${CROP_ASPECTS.desktop.join(', ')}), 'phone': (${CROP_ASPECTS.phone.join(', ')})}`);
  });

  it('computes the same crops as the skill', () => {
    expect(fixtures.crops.length).toBeGreaterThan(10);
    for (const c of fixtures.crops) {
      const box = cropFor(c.width, c.height, c.focal, CROP_ASPECTS[c.aspect], c.zoom);
      expect(box, JSON.stringify(c)).toEqual(c.box);
      expect(cropAspectError(box, c.width, c.height, CROP_ASPECTS[c.aspect])).toBeLessThanOrEqual(CROP_ASPECT_TOLERANCE);
    }
    expect(cropFor(0, 100, { x: 0.5, y: 0.5 }, [16, 9])).toBeNull();
  });

  it('stores a photos.json the validator accepts exactly as written (paths swapped)', () => {
    const photos = runPhotos();
    const { data, repairs } = sanitizePhotosReport(valid(), { photos });
    expect(repairs).toEqual([]);
    expect(data).toEqual(stored(valid(), photos));
    // The about photo is stored sideways (EXIF): its displayed size is
    // still trusted, and its crops checked against it.
    const about = data.picks.find((p) => p.role === 'about');
    expect([about.width, about.height]).toEqual([1000, 1400]);
  });

  it('reports a repair for every broken copy the server can fix', () => {
    const cases = fixtures.invalid;
    expect(cases.filter((c) => c.server === 'repair').length).toBeGreaterThan(12);
    for (const c of cases) {
      const photos = runPhotos(c.extraPhotos || []);
      const { data, repairs } = sanitizePhotosReport(c.doc, { photos });
      expect(data, c.name).not.toBeNull();
      if (c.server === 'repair') expect(repairs.length, c.name).toBeGreaterThan(0);
    }
  });

  it('describes the same file in the request schema', () => {
    const pick = PHOTOS_SCHEMA.properties.picks.items;
    expect(PHOTOS_SCHEMA.required).toEqual(Object.keys(fixtures.valid));
    expect(pick.required).toEqual(Object.keys(fixtures.valid.picks[0]));
    expect(pick.properties.role.enum).toEqual([...PHOTO_ROLES]);
    expect(PHOTOS_SCHEMA.properties.pairs.items.required).toEqual(Object.keys(fixtures.valid.pairs[0]));
    expect(PHOTOS_SCHEMA.properties.shotList.minItems).toBe(3);
  });
});

describe('sanitizePhotos', () => {
  const photos = runPhotos();
  const pathOf = (name) => photos.find((p) => p.name === name).path;

  it('needs picks of photos this run saw', () => {
    expect(sanitizePhotos(null, { photos })).toBeNull();
    expect(sanitizePhotos({ picks: 'x' }, { photos })).toBeNull();
    expect(sanitizePhotos({ picks: [{ path: '../etc/passwd', role: 'hero' }] }, { photos })).toBeNull();
    expect(sanitizePhotos({ picks: [{ path: `${PID}/photo/other.jpg`, role: 'hero' }] }, { photos })).toBeNull();
    // Another project's path, or a kit file, is never a photo.
    const loose = sanitizePhotosReport({ picks: [{ path: `${uuid(9)}/photo/${uuid(1)}.jpg` }, { path: `${PID}/kit/photos/1-contact_sheet.png` }] }, { projectId: PID });
    expect(loose.data).toBeNull();
    // Only the upload shape ("<project>/photo/<uuid>.<ext>"), never a name
    // that walks out of the folder.
    for (const bad of [`${PID}/photo/..`, `${PID}/photo/.hidden.jpg`, `${PID}/photo/a.jpg`, `${PID}/photo/${uuid(1)}.JPG`]) {
      expect(sanitizePhotos({ picks: [{ path: bad, role: 'hero' }] }, { projectId: PID }), bad).toBeNull();
    }
    expect(sanitizePhotos({ picks: [{ path: `${PID}/photo/${uuid(1)}.jpg`, role: 'hero' }] }, { projectId: PID }).picks).toHaveLength(1);
  });

  it('accepts the container name or the stored path, and this project\'s paths without a list', () => {
    const doc = valid();
    doc.picks[0].path = pathOf('photo-1.jpg');
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect(repairs).toEqual([]);
    expect(data.picks[0].path).toBe(pathOf('photo-1.jpg'));
    const again = sanitizePhotosReport(data, { projectId: PID });
    expect(again.repairs).toEqual([]);
    expect(again.data).toEqual(data);
  });

  it('moves a second hero to the gallery and an unpaired after photo too', () => {
    const doc = valid();
    doc.picks[1].role = 'hero';
    doc.pairs = [];
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    const roles = Object.fromEntries(data.picks.map((p) => [p.path, p.role]));
    expect(roles[pathOf('photo-1.jpg')]).toBe('hero');
    expect(roles[pathOf('photo-7.jpg')]).toBe('gallery');
    expect(roles[pathOf('photo-6.jpg')]).toBe('gallery');
    expect(roles[pathOf('photo-5.jpg')]).toBe('skip');
    expect(repairs).toEqual(expect.arrayContaining(['a second hero photo moved', 'an unpaired before photo moved', 'an unpaired after photo moved']));
  });

  it('recomputes a crop of the wrong shape around the focal point', () => {
    const doc = valid();
    doc.picks[0].crops.phone = { x: 0, y: 0, w: 1, h: 1 };
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect(data.picks[0].crops.phone).toEqual(cropFor(1800, 1200, doc.picks[0].focal, CROP_ASPECTS.phone));
    expect(repairs).toContain('phone crop recomputed');
  });

  it('keeps the crops but not the size when the size doesn\'t match the photo', () => {
    const doc = valid();
    doc.picks[0].width = 900;
    doc.picks[0].height = 600;
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect([data.picks[0].width, data.picks[0].height]).toEqual([1800, 1200]);
    expect(data.picks[0].crops).toEqual(doc.picks[0].crops);
    // Never a quiet change: the admin and the smoke test see it.
    expect(repairs).toEqual(['photo-1.jpg: size replaced by the photo\'s own']);
  });

  it('reports a text field that isn\'t text', () => {
    const doc = valid();
    doc.picks[0].reason = 42;
    doc.picks[1].alt = { text: 'x' };
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect(data.picks[0].reason).toBe('');
    expect(data.picks[1].alt).toBe('');
    expect(repairs).toEqual(['photo-1.jpg: reason dropped (not text)', 'photo-7.jpg: alt text dropped (not text)']);
  });

  it('empties alt text and pair notes that make claims, skips included', () => {
    const doc = valid();
    doc.picks[0].alt = 'The best detail in town';
    doc.picks[4].alt = 'Award-winning flyer';
    doc.pairs[0].note = 'Flawless finish';
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect(data.picks[0].alt).toBe('');
    expect(data.picks[4].alt).toBe('');
    expect(data.pairs[0].note).toBe('');
    expect(repairs.filter((r) => /dropped \(claims/.test(r))).toHaveLength(3);
  });

  it('clips blur boxes into the photo and drops unknown kinds', () => {
    const doc = valid();
    doc.picks[0].blur = [
      { x: 0.95, y: 0.5, w: 0.1, h: 0.1, kind: 'plate' },
      { x: 0.1, y: 0.1, w: 0.1, h: 0.1, kind: 'logo' },
      { x: 0.2, y: 0.2, w: 0.0001, h: 0.1, kind: 'face' },
    ];
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect(data.picks[0].blur).toEqual([{ x: 0.95, y: 0.5, w: 0.05, h: 0.1, kind: 'plate' }]);
    expect(repairs).toEqual(expect.arrayContaining(['a blur box moved inside the photo', 'a blur box dropped']));
  });

  it('caps the gallery at the Design setup\'s 12 slots', () => {
    const extra = Array.from({ length: 14 }, (_, i) => ({ name: `photo-${30 + i}.jpg`, width: 1600, height: 1200, storedWidth: 1600, storedHeight: 1200 }));
    const all = runPhotos(extra);
    const doc = valid();
    for (const p of extra) {
      doc.picks.push({
        path: p.name, role: 'gallery', score: 6, reason: 'Filler', alt: 'Blue car', focal: { x: 0.5, y: 0.5 },
        crops: { desktop: cropFor(1600, 1200, { x: 0.5, y: 0.5 }, [16, 9]), phone: cropFor(1600, 1200, { x: 0.5, y: 0.5 }, [4, 5]) },
        blur: [], width: 1600, height: 1200,
      });
    }
    const { data, repairs } = sanitizePhotosReport(doc, { photos: all });
    expect(picksByRole(data).gallery).toHaveLength(GALLERY_SLOTS);
    expect(picksByRole(data).skip).toHaveLength(3);
    expect(repairs.filter((r) => r === 'gallery over 12 photos')).toHaveLength(2);
  });

  it('tidies texts and drops repeated or extra shots and notes', () => {
    const doc = valid();
    doc.picks[0].reason = '  Sharp\nand wide ';
    doc.shotList = ['One', 'One', '', ...Array.from({ length: 12 }, (_, i) => `Shot ${i}`)];
    doc.notes = ['', ...Array.from({ length: 9 }, (_, i) => `Note ${i}`)];
    const { data, repairs } = sanitizePhotosReport(doc, { photos });
    expect(data.picks[0].reason).toBe('Sharp and wide');
    expect(data.shotList).toEqual(['One', ...Array.from({ length: 9 }, (_, i) => `Shot ${i}`)]);
    expect(data.notes).toHaveLength(PHOTO_LIMITS.notes);
    expect(repairs).toEqual(expect.arrayContaining(['photo-1.jpg: reason tidied', 'an empty or repeated shot dropped', 'shots over 10 dropped', 'an empty note dropped', 'notes over 8 dropped']));
  });

  it('checks alt text the way the skill does', () => {
    expect(claimIn('Rated #1 in town')).toBe('#1');
    expect(claimIn('Bestow')).toBe('');
    expect(altProblem('Photo of a red car')).toMatch(/image of/);
    expect(altProblem('Photographer at work')).toBe('');
    // ASCII folding and word breaks, as the skill's Python regexes (re.A).
    expect(claimIn('be\u017ft')).toBe('');
    expect(altProblem('Photo of\u00e9t\u00e9')).toMatch(/image of/);
    expect(altProblem('A certified installer at work')).toMatch(/certified/);
  });
});

describe('reading the data', () => {
  const photos = runPhotos();
  const data = sanitizePhotos(valid(), { photos });
  const pathOf = (name) => photos.find((p) => p.name === name).path;

  it('fills the free gallery slots with the after photos of the pairs', () => {
    expect(pairAfters(data)).toEqual([pathOf('photo-6.jpg')]);
    expect(photoSlots(data)).toEqual({ hero: pathOf('photo-1.jpg'), about: pathOf('photo-7.jpg'), gallery: [pathOf('photo-6.jpg')] });
    expect(photoSlots(null)).toEqual({ hero: '', about: '', gallery: [] });
  });

  it('counts roles, pairs and blur proposals of used photos', () => {
    expect(photoCounts(data)).toEqual({ hero: 1, about: 1, gallery: 0, pairs: 1, skip: 1, plates: 3, faces: 0 });
  });

  it('turns boxes into CSS', () => {
    expect(boxStyle({ x: 0.1, y: 0.25, w: 0.5, h: 0.3333 })).toEqual({ left: '10%', top: '25%', width: '50%', height: '33.33%' });
    expect(cropPreviewStyle({ x: 0.25, y: 0, w: 0.5, h: 1 })).toEqual({
      position: 'absolute', maxWidth: 'none', width: '200%', height: '100%', left: '-50%', top: '0%',
    });
  });
});

describe('PhotosResult', () => {
  const photos = runPhotos();
  const data = sanitizePhotos(valid(), { photos });
  const project = {
    id: PID,
    files: photos.map((p) => ({ path: p.path, kind: 'photo', name: p.name, url: `https://store.test/${p.name}?token=x` })),
  };
  const run = { status: 'ready', data };
  const render = (props) => renderToStaticMarkup(createElement(PhotosResult, { run, project, urls: {}, ...props }));

  it('shows the picks over their signed photos with roles, crops and blur boxes', () => {
    const html = render();
    expect(html).toContain('https://store.test/photo-1.jpg?token=x');
    expect(html).toContain('alt="Red sedan parked on a driveway in front of a row of trees"');
    expect(html).toMatch(/>Hero</);
    expect(html).toMatch(/>About</);
    expect(html).toContain('Blur to confirm: 1 plate');
    expect(html).toContain('Before and after');
    expect(html).toContain('Mud washed off the doors and wheels');
    expect(html).toContain('Skipped (1)');
    expect(html).toContain('Shot list for their next job');
    expect(html).toContain('Desktop 16:9');
    // Without onApply there is no button to press.
    expect(html).not.toContain('Use these picks');
  });

  it('offers "Use these picks" when the page can take them', () => {
    const html = render({ onApply: () => {} });
    expect(html).toContain('Use these picks');
    expect(html).toContain('the &quot;after&quot; half of a pair');
  });

  it('says when a photo link is missing, and copes with an empty run', () => {
    expect(render({ project: { id: PID, files: [] } })).toContain('Photo link missing or expired');
    // Only signed http(s) links reach an <img>.
    const odd = render({ project: { id: PID, files: photos.map((p) => ({ path: p.path, url: `javascript:alert(1)//${p.name}` })) } });
    expect(odd).not.toContain('javascript:');
    expect(odd).toContain('Photo link missing or expired');
    expect(renderToStaticMarkup(createElement(PhotosResult, { run: { status: 'ready', data: { picks: [] } }, project }))).toContain('no photo picks');
    const skips = sanitizePhotos({ ...valid(), picks: valid().picks.map((p) => ({ ...p, role: 'skip' })), pairs: [] }, { photos });
    expect(render({ run: { status: 'ready', data: skips } })).toContain('No photo is good enough for the site yet');
  });
});
