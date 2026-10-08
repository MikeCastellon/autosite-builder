// The photo desk of the Launch Kit (skill launch-photo-desk, kit key
// "photos"): the customer's own photos, art-directed for their site. Pure:
// the server's spec (netlify/functions/_lib/kit/photos.js) sanitizes the
// skill's photos.json with it and puts PHOTOS_SCHEMA in the request, and the
// admin's result view (components/admin/kit/PhotosResult.jsx) re-checks the
// stored data with it and builds the "Use these picks" slots. The skill's
// validator (skills/api/launch-photo-desk/scripts/validate_photos.py) holds
// the same rules, so a file that passes it is stored exactly as written;
// photos.test.js runs both sides over the skill's shared fixtures.
//
// The stored shape (design.kit.photos.data):
//   { version: 1,
//     picks: [{ path, role, score, reason, alt, focal: { x, y },
//               crops: { desktop: { x, y, w, h }, phone: { x, y, w, h } },
//               blur: [{ x, y, w, h, kind }], width, height }],
//     pairs: [{ before, after, note }],
//     shotList: [string], notes: [string] }
//   path    the stored upload (custom-site-assets "<project>/photo/<id>.<ext>");
//           the skill writes the container name ("photo-3.jpg") and the
//           server swaps in the path
//   role    hero | about | gallery | before | after | skip (one per photo;
//           every photo the run saw has a pick, skip says why not)
//   score   0-10, one decimal: how well it serves the site
//   alt     what is visible, plainly (no claims); may be '' for a skip
//   focal, crops, blur   fractions of the photo as a browser shows it (EXIF
//           orientation applied), 0-1 from the top left. Crops are the
//           largest 16:9 (desktop) and 4:5 (phone) boxes around the focal
//           point unless the skill chose tighter ones. Blur boxes are
//           proposals (license plates, faces) an admin confirms.
//   width, height   the photo's size in pixels as shown (an addition to the
//           kit contract, like version: the crops' aspect is checked
//           against it)
// sanitizePhotosReport also lists every change it made (repairs): the run's
// notes start with them and the smoke test fails on any.

export const PHOTOS_VERSION = 1;
export const PHOTO_ROLES = Object.freeze(['hero', 'about', 'gallery', 'before', 'after', 'skip']);
export const PHOTO_ROLE_LABELS = Object.freeze({
  hero: 'Hero', about: 'About', gallery: 'Gallery', before: 'Before', after: 'After', skip: 'Skipped',
});
export const BLUR_KINDS = Object.freeze(['plate', 'face']);
// [width, height] of each crop.
export const CROP_ASPECTS = Object.freeze({ desktop: Object.freeze([16, 9]), phone: Object.freeze([4, 5]) });
// How far a crop's pixel aspect may be off before it counts as wrong (4
// decimal places on a 6000 px photo stay far inside it).
export const CROP_ASPECT_TOLERANCE = 0.02;
// The skill's validator enforces the same caps (scripts/common.py LIMITS).
export const PHOTO_LIMITS = Object.freeze({
  picks: 60, hero: 1, about: 1, gallery: 12, pairs: 6, blur: 12, shotList: 10, notes: 8,
  reason: 200, alt: 160, pairNote: 200, shot: 200, note: 300,
});
// The Design setup's slots take 12 gallery photos (customSiteDesign.js).
export const GALLERY_SLOTS = 12;
const MIN_CROP_SIDE = 0.05;
const MIN_BLUR_SIDE = 0.002;
const MAX_SIDE_PX = 30000;

// Claims alt text and pair notes never carry (the repo's "no invented
// facts" rule): the same list as the skill's data/claim_words.json "errors"
// (photos.test.js compares them). The validator also warns on softer words
// (data/claim_words.json "warnings"); those are kept.
export const CLAIM_WORDS = Object.freeze([
  'best', '#1', 'number one', 'no. 1', 'award', 'awards', 'award-winning', 'certified', 'certification',
  'guarantee', 'guaranteed', 'warranty', 'top-rated', 'top rated', '5-star', 'five-star', '5 star', 'five star',
  'flawless', 'perfect', 'perfectly', 'cheapest', 'lowest price', 'voted', 'world-class', 'unbeatable',
  'licensed', 'insured',
]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CLAIM_RE = new RegExp(`(?<![A-Za-z0-9])(${CLAIM_WORDS.map(escapeRe).join('|')})(?![A-Za-z0-9])`, 'i');
// "Image of …": screen readers already say it's an image.
const IMAGE_OF_RE = /^(an?\s+)?(image|photo|picture|photograph|pic)\s+(of|showing)\b/i;

// The claim word in `text`, or ''.
export function claimIn(text) {
  const m = CLAIM_RE.exec(String(text || ''));
  return m ? m[1] : '';
}

// Is `text` usable as a pair note (no claim)?
export function noteProblem(text) {
  const c = claimIn(text);
  return c ? `claims "${c}"` : '';
}

// Is `text` usable as alt text (no claim, no "image of")?
export function altProblem(text) {
  const s = String(text || '');
  if (claimIn(s)) return `claims "${claimIn(s)}"`;
  if (IMAGE_OF_RE.test(s)) return 'starts with "image of"';
  return '';
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Model text on one line, capped (launchKit.js oneLine).
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v, places) => Math.round(v * 10 ** places) / 10 ** places;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const floor4 = (v) => Math.floor(v * 1e4 + 1e-9) / 1e4;

// ─── Crop math (scripts/common.py crop_for) ───────────────────────────

// The `aspect` crop ([w, h]) of a width x height photo around `focal`, as
// fractions: the largest that fits, times `zoom` (0.3-1), moved to stay
// inside the photo. Widths and heights are rounded down to 4 places, so
// x + w never passes 1.
export function cropFor(width, height, focal, aspect, zoom = 1) {
  const W = Number(width);
  const H = Number(height);
  if (!(W > 0) || !(H > 0)) return null;
  const ar = aspect[0] / aspect[1];
  let cw = W / H > ar ? H * ar : W;
  let ch = W / H > ar ? H : W / ar;
  const z = Math.min(1, Math.max(0.3, Number(zoom) || 1));
  cw *= z;
  ch *= z;
  const fx = clamp01(num(focal?.x) ?? 0.5) * W;
  const fy = clamp01(num(focal?.y) ?? 0.5) * H;
  const w = floor4(cw / W);
  const h = floor4(ch / H);
  const x = Math.min(round(Math.max(0, fx - cw / 2) / W, 4), round(1 - w, 4));
  const y = Math.min(round(Math.max(0, fy - ch / 2) / H, 4), round(1 - h, 4));
  return { x: Math.max(0, x), y: Math.max(0, y), w, h };
}

// How far a crop's pixel aspect is from `aspect` (0 = exact), or null
// without a size.
export function cropAspectError(box, width, height, aspect) {
  if (!(width > 0) || !(height > 0) || !box || !(box.h > 0)) return null;
  return Math.abs((box.w * width) / (box.h * height) / (aspect[0] / aspect[1]) - 1);
}

// A { x, y, w, h } box inside the photo (fractions, 4 places), or null when
// it isn't one or is smaller than `minSide`.
function box(raw, minSide) {
  if (!isObject(raw)) return null;
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((k) => num(raw[k]));
  if (x === null || y === null || w === null || h === null) return null;
  const x0 = clamp01(x);
  const y0 = clamp01(y);
  const out = {
    x: round(x0, 4),
    y: round(y0, 4),
    w: round(Math.min(w - (x0 - x), 1 - x0), 4),
    h: round(Math.min(h - (y0 - y), 1 - y0), 4),
  };
  if (out.x + out.w > 1) out.w = round(1 - out.x, 4);
  if (out.y + out.h > 1) out.h = round(1 - out.y, 4);
  return out.w >= minSide && out.h >= minSide ? out : null;
}

// Did cleaning change a box (moved inside the photo, shrunk, rounded)?
const boxChanged = (raw, clean) => ['x', 'y', 'w', 'h'].some((k) => raw[k] !== clean[k]);

// ─── The sanitizer ────────────────────────────────────────────────────

const PLAIN_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._()+-]{0,150}$/;
// An upload's stored path, exactly as custom-site-form mints them
// (customSiteForm.js sanitizeAssets: "<project>/photo/<uuid>.<ext>"), so a
// stored record can never point the view or the Design setup anywhere else.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PHOTO_PATH_RE = (projectId) => new RegExp(`^${escapeRe(projectId)}/photo/${UUID}\\.[a-z0-9]{1,5}$`);

// Which stored photo a pick means. `photos` are the photos the run saw
// ([{ name (container name), path, width?, height? }]); a pick may name the
// container file or the stored path. Without a list (the result view of a
// project whose files aren't loaded), any path of this project's photos
// counts.
function photoResolver({ photos, projectId } = {}) {
  const byName = new Map();
  const byPath = new Map();
  for (const p of Array.isArray(photos) ? photos : []) {
    if (!isObject(p) || typeof p.path !== 'string' || !p.path) continue;
    if (typeof p.name === 'string' && PLAIN_NAME_RE.test(p.name)) byName.set(p.name, p);
    byPath.set(p.path, p);
  }
  const loose = !byPath.size && typeof projectId === 'string' && projectId ? PHOTO_PATH_RE(projectId) : null;
  return (ref) => {
    if (typeof ref !== 'string' || !ref) return null;
    if (byName.has(ref)) return byName.get(ref);
    if (byPath.has(ref)) return byPath.get(ref);
    if (loose && loose.test(ref)) return { path: ref };
    return null;
  };
}

// The photo's size as shown. The skill measures it after the EXIF
// rotation; the server only knows the stored size (sniffImage), which is
// the same or turned by 90 degrees. { width, height, trusted } where
// `trusted` says the crops may be checked against it (a size that isn't
// the pick's own is a repair: the caller reports it).
function sizeOf(pick, photo) {
  const pw = Number.isInteger(pick.width) && pick.width > 0 && pick.width <= MAX_SIDE_PX ? pick.width : null;
  const ph = Number.isInteger(pick.height) && pick.height > 0 && pick.height <= MAX_SIDE_PX ? pick.height : null;
  const sw = Number(photo?.width) > 0 ? Number(photo.width) : null;
  const sh = Number(photo?.height) > 0 ? Number(photo.height) : null;
  if (pw && ph && (!sw || !sh || (pw === sw && ph === sh) || (pw === sh && ph === sw))) return { width: pw, height: ph, trusted: true };
  if (sw && sh) return { width: sw, height: sh, trusted: false };
  return { width: null, height: null, trusted: false };
}

function cleanCrops(raw, focal, size, repairs) {
  const out = {};
  for (const [key, aspect] of Object.entries(CROP_ASPECTS)) {
    let b = box(raw?.[key], MIN_CROP_SIDE);
    if (b && boxChanged(raw[key], b)) repairs.push(`${key} crop moved inside the photo`);
    const err = b && size.trusted ? cropAspectError(b, size.width, size.height, aspect) : null;
    if (!b || (err !== null && err > CROP_ASPECT_TOLERANCE)) {
      const made = size.width ? cropFor(size.width, size.height, focal, aspect) : null;
      if (made) {
        repairs.push(`${key} crop recomputed`);
        b = made;
      } else if (!b) {
        repairs.push(`${key} crop missing`);
        b = { x: 0, y: 0, w: 1, h: 1 };
      }
    }
    out[key] = b;
  }
  return out;
}

function cleanBlur(raw, repairs) {
  const out = [];
  for (const b of Array.isArray(raw) ? raw : []) {
    const kind = isObject(b) && BLUR_KINDS.includes(b.kind) ? b.kind : null;
    const clean = kind ? box(b, MIN_BLUR_SIDE) : null;
    if (!clean) { repairs.push('a blur box dropped'); continue; }
    if (boxChanged(b, clean)) repairs.push('a blur box moved inside the photo');
    if (out.length >= PHOTO_LIMITS.blur) { repairs.push(`blur boxes over ${PHOTO_LIMITS.blur} dropped`); break; }
    out.push({ ...clean, kind });
  }
  return out;
}

// One line within `max`; a text that had to change (line breaks, extra
// spaces, too long) is a repair, and one `check` objects to is emptied.
function cleanText(v, max, check, repairs, what) {
  const s = oneLine(v, max);
  if (typeof v === 'string' && s !== v) repairs.push(`${what} tidied`);
  else if (v !== undefined && v !== null && typeof v !== 'string') repairs.push(`${what} dropped (not text)`);
  if (s && check && check(s)) {
    repairs.push(`${what} dropped (${check(s)})`);
    return '';
  }
  return s;
}

// photos.json (untrusted model output) → { data, repairs }: `data` in the
// stored shape, or null when there is no usable pick; `repairs` lists what
// had to change (the smoke test counts them as failures).
//   photos     the photos the run saw: [{ name, path, width?, height? }]
//   projectId  without `photos`: accept this project's photo paths
export function sanitizePhotosReport(raw, { photos, projectId } = {}) {
  const repairs = [];
  if (!isObject(raw) || !Array.isArray(raw.picks)) return { data: null, repairs: ['no picks'] };
  const resolve = photoResolver({ photos, projectId });
  const picks = [];
  const seen = new Set();
  const count = Object.fromEntries(PHOTO_ROLES.map((r) => [r, 0]));
  for (const p of raw.picks) {
    if (picks.length >= PHOTO_LIMITS.picks) { repairs.push('picks over the limit dropped'); break; }
    const photo = isObject(p) ? resolve(p.path) : null;
    if (!photo) { repairs.push(`unknown photo ${oneLine(String(p?.path ?? ''), 60) || '(none)'} dropped`); continue; }
    if (seen.has(photo.path)) { repairs.push(`${oneLine(p.path, 60)} listed twice`); continue; }
    seen.add(photo.path);
    let role = PHOTO_ROLES.includes(p.role) ? p.role : 'skip';
    if (role !== p.role) repairs.push(`${oneLine(p.path, 60)}: unknown role`);
    // One hero and one about photo; a second goes to the gallery while it
    // has room. The gallery holds what the Design setup can take.
    if ((role === 'hero' || role === 'about') && count[role] >= PHOTO_LIMITS[role]) {
      repairs.push(`a second ${role} photo moved`);
      role = count.gallery < PHOTO_LIMITS.gallery ? 'gallery' : 'skip';
    }
    if (role === 'gallery' && count.gallery >= PHOTO_LIMITS.gallery) {
      repairs.push('gallery over 12 photos');
      role = 'skip';
    }
    count[role] += 1;
    const score = num(p.score);
    const focal = isObject(p.focal) && num(p.focal.x) !== null && num(p.focal.y) !== null
      ? { x: round(clamp01(p.focal.x), 4), y: round(clamp01(p.focal.y), 4) }
      : null;
    const name = oneLine(p.path, 60);
    if (!focal) repairs.push(`${name}: focal point missing`);
    else if (focal.x !== p.focal.x || focal.y !== p.focal.y) repairs.push(`${name}: focal point moved inside the photo`);
    const cleanScore = score === null ? 0 : round(Math.min(10, Math.max(0, score)), 1);
    if (score === null) repairs.push(`${name}: score missing`);
    else if (cleanScore !== score) repairs.push(`${name}: score rounded`);
    const size = sizeOf(p, photo);
    // A size that isn't the photo's (nor its EXIF turn) is replaced by the
    // stored one, and the crops can't be checked against it.
    if (size.width !== p.width || size.height !== p.height) repairs.push(`${name}: size replaced by the photo's own`);
    const f = focal || { x: 0.5, y: 0.5 };
    picks.push({
      path: photo.path,
      role,
      score: cleanScore,
      reason: cleanText(p.reason, PHOTO_LIMITS.reason, null, repairs, `${name}: reason`),
      // A skip's alt text is checked too: an admin may still use the photo.
      alt: cleanText(p.alt, PHOTO_LIMITS.alt, altProblem, repairs, `${name}: alt text`),
      focal: f,
      crops: cleanCrops(p.crops, f, size, repairs),
      blur: cleanBlur(p.blur, repairs),
      width: size.width,
      height: size.height,
    });
  }
  if (!picks.length) return { data: null, repairs: [...repairs, 'no usable picks'] };

  // Pairs: a "before" pick and an "after" pick of this run, each in one
  // pair. A before or after photo left without a pair can't be shown as
  // one: an after photo joins the gallery while it has room.
  const byPath = new Map(picks.map((p) => [p.path, p]));
  const pairs = [];
  const paired = new Set();
  for (const pr of Array.isArray(raw.pairs) ? raw.pairs : []) {
    if (pairs.length >= PHOTO_LIMITS.pairs) { repairs.push('pairs over the limit dropped'); break; }
    const before = isObject(pr) ? resolve(pr.before) : null;
    const after = isObject(pr) ? resolve(pr.after) : null;
    const ok = before && after && before.path !== after.path
      && byPath.get(before.path)?.role === 'before' && byPath.get(after.path)?.role === 'after'
      && !paired.has(before.path) && !paired.has(after.path);
    if (!ok) { repairs.push('a pair dropped'); continue; }
    paired.add(before.path);
    paired.add(after.path);
    pairs.push({ before: before.path, after: after.path, note: cleanText(pr.note, PHOTO_LIMITS.pairNote, noteProblem, repairs, 'pair note') });
  }
  let gallery = picks.filter((p) => p.role === 'gallery').length;
  for (const p of picks) {
    if ((p.role === 'before' || p.role === 'after') && !paired.has(p.path)) {
      repairs.push(`an unpaired ${p.role} photo moved`);
      p.role = p.role === 'after' && gallery < PHOTO_LIMITS.gallery ? 'gallery' : 'skip';
      if (p.role === 'gallery') gallery += 1;
    }
  }

  const shotList = [];
  for (const s of Array.isArray(raw.shotList) ? raw.shotList : []) {
    const line = cleanText(s, PHOTO_LIMITS.shot, null, repairs, 'a shot');
    if (!line || shotList.includes(line)) { repairs.push('an empty or repeated shot dropped'); continue; }
    if (shotList.length >= PHOTO_LIMITS.shotList) { repairs.push(`shots over ${PHOTO_LIMITS.shotList} dropped`); break; }
    shotList.push(line);
  }
  const notes = [];
  for (const n of Array.isArray(raw.notes) ? raw.notes : []) {
    const line = cleanText(n, PHOTO_LIMITS.note, null, repairs, 'a note');
    if (!line) { repairs.push('an empty note dropped'); continue; }
    if (notes.length >= PHOTO_LIMITS.notes) { repairs.push(`notes over ${PHOTO_LIMITS.notes} dropped`); break; }
    notes.push(line);
  }

  return { data: { version: PHOTOS_VERSION, picks, pairs, shotList, notes }, repairs };
}

// The clean data for design.kit.photos.data, or null (see
// sanitizePhotosReport).
export function sanitizePhotos(raw, opts = {}) {
  return sanitizePhotosReport(raw, opts).data;
}

// ─── Reading the data ─────────────────────────────────────────────────

// The picks of each role, in the order the skill listed them.
export function picksByRole(data) {
  const out = Object.fromEntries(PHOTO_ROLES.map((r) => [r, []]));
  for (const p of Array.isArray(data?.picks) ? data.picks : []) if (out[p?.role]) out[p.role].push(p);
  return out;
}

// The "after" photo of each pair, in pair order (finished work).
export function pairAfters(data) {
  const roles = new Map((Array.isArray(data?.picks) ? data.picks : []).map((p) => [p?.path, p?.role]));
  return (Array.isArray(data?.pairs) ? data.pairs : [])
    .map((pr) => pr?.after)
    .filter((path) => typeof path === 'string' && roles.get(path) === 'after');
}

// What "Use these picks" hands the Design setup: { hero, about, gallery }
// as stored paths ('' / [] where the desk picked none). The pairs
// themselves go to a template's Before & After section from the Design
// step ("Use the photo desk's pairs", most templates have none), so here
// the "after" photos of the pairs (finished work) fill the gallery slots
// the gallery picks leave free; a "before" photo never goes in on its own.
export function photoSlots(data) {
  const by = picksByRole(data);
  const gallery = by.gallery.map((p) => p.path);
  for (const path of pairAfters(data)) if (gallery.length < GALLERY_SLOTS && !gallery.includes(path)) gallery.push(path);
  return {
    hero: by.hero[0]?.path || '',
    about: by.about[0]?.path || '',
    gallery: gallery.slice(0, GALLERY_SLOTS),
  };
}

// CSS for a box of the photo (fractions) laid over the photo's own box.
export function boxStyle(b) {
  const pct = (v) => `${round(clamp01(Number(v) || 0) * 100, 3)}%`;
  return { left: pct(b?.x), top: pct(b?.y), width: pct(b?.w), height: pct(b?.h) };
}

// CSS for the <img> inside a frame of the crop's aspect, so the frame
// shows exactly the crop: the image scaled to 1/w x 1/h of the frame and
// moved by the crop's corner.
export function cropPreviewStyle(b) {
  const w = Math.max(0.01, Number(b?.w) || 1);
  const h = Math.max(0.01, Number(b?.h) || 1);
  const pct = (v) => `${round(v * 100, 3)}%`;
  return {
    position: 'absolute',
    maxWidth: 'none',
    width: pct(1 / w),
    height: pct(1 / h),
    left: pct(-(Number(b?.x) || 0) / w),
    top: pct(-(Number(b?.y) || 0) / h),
  };
}

// Counts for the result's summary line.
export function photoCounts(data) {
  const by = picksByRole(data);
  const blur = (Array.isArray(data?.picks) ? data.picks : []).filter((p) => p.role !== 'skip')
    .reduce((acc, p) => {
      for (const b of p.blur || []) acc[b.kind] = (acc[b.kind] || 0) + 1;
      return acc;
    }, { plate: 0, face: 0 });
  return {
    hero: by.hero.length,
    about: by.about.length,
    gallery: by.gallery.length,
    pairs: Array.isArray(data?.pairs) ? data.pairs.length : 0,
    skip: by.skip.length,
    plates: blur.plate,
    faces: blur.face,
  };
}

// ─── The request's schema ─────────────────────────────────────────────

const boxSchema = (description) => ({
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'w', 'h'],
  description,
  properties: {
    x: { type: 'number', minimum: 0, maximum: 1 },
    y: { type: 'number', minimum: 0, maximum: 1 },
    w: { type: 'number', minimum: 0, maximum: 1 },
    h: { type: 'number', minimum: 0, maximum: 1 },
  },
});

// photos.json as a JSON schema, for the request (the skill's
// references/photos-json.md says the same in words).
export const PHOTOS_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['version', 'picks', 'pairs', 'shotList', 'notes'],
  properties: {
    version: { const: PHOTOS_VERSION },
    picks: {
      type: 'array',
      maxItems: PHOTO_LIMITS.picks,
      description: 'Every photo of the request exactly once; skip says why a photo is not used',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'role', 'score', 'reason', 'alt', 'focal', 'crops', 'blur', 'width', 'height'],
        properties: {
          path: { type: 'string', description: 'The container file name the request lists, e.g. "photo-3.jpg"' },
          role: { type: 'string', enum: [...PHOTO_ROLES], description: 'At most 1 hero, 1 about and 12 gallery photos' },
          score: { type: 'number', minimum: 0, maximum: 10, description: 'How well it serves the site, one decimal' },
          reason: { type: 'string', maxLength: PHOTO_LIMITS.reason, description: 'One plain line for the admin' },
          alt: { type: 'string', maxLength: PHOTO_LIMITS.alt, description: 'What is visible, no claims; empty for skip' },
          focal: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y'],
            properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } },
          },
          crops: {
            type: 'object',
            additionalProperties: false,
            required: ['desktop', 'phone'],
            properties: { desktop: boxSchema('16:9 in pixels'), phone: boxSchema('4:5 in pixels') },
          },
          blur: {
            type: 'array',
            maxItems: PHOTO_LIMITS.blur,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['x', 'y', 'w', 'h', 'kind'],
              properties: { ...boxSchema().properties, kind: { type: 'string', enum: [...BLUR_KINDS] } },
            },
          },
          width: { type: 'integer', minimum: 1, description: 'Pixels as displayed (EXIF orientation applied)' },
          height: { type: 'integer', minimum: 1 },
        },
      },
    },
    pairs: {
      type: 'array',
      maxItems: PHOTO_LIMITS.pairs,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['before', 'after', 'note'],
        properties: {
          before: { type: 'string', description: 'A pick with role "before"' },
          after: { type: 'string', description: 'A pick with role "after"' },
          note: { type: 'string', maxLength: PHOTO_LIMITS.pairNote },
        },
      },
    },
    shotList: { type: 'array', minItems: 3, maxItems: PHOTO_LIMITS.shotList, items: { type: 'string', maxLength: PHOTO_LIMITS.shot } },
    notes: { type: 'array', maxItems: PHOTO_LIMITS.notes, items: { type: 'string', maxLength: PHOTO_LIMITS.note } },
  },
});
