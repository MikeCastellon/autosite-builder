// "Match its layout" on the admin page: what ReferenceShotUpload and
// SuggestPanel need besides React. The rules themselves (formats, sizes,
// which screenshots picture which reference, where the colors come from)
// are designSuggest.js's, shared with the server; this file only turns
// them into the page's wording and prepares files in the browser.
import { MATCH_SHOT_LIMIT, MATCH_SHOT_SEND_BYTES, REFERENCE_GROUP_RE, checkReferenceShot } from '../../../lib/designSuggest.js';
import { safeHref } from '../../../lib/customSiteForm.js';

// What the file picker offers (the server takes PNG, JPEG and WebP only).
export const SHOT_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
// Screenshots one pick may add (each may then be cut into parts).
export const MAX_SHOTS_PER_PICK = 4;

// The files a pick may upload, in the order picked, and the others with
// why: { ok: File[], rejected: [{ name, error }] }.
export function sortPickedShots(files) {
  const ok = [];
  const rejected = [];
  for (const file of Array.from(files || [])) {
    const name = String(file?.name || 'unnamed');
    const { error } = checkReferenceShot({ fileName: name, size: Number(file?.size), type: file?.type });
    if (error) rejected.push({ name, error });
    else if (ok.length >= MAX_SHOTS_PER_PICK) rejected.push({ name, error: `Add at most ${MAX_SHOTS_PER_PICK} at a time.` });
    else ok.push(file);
  }
  return { ok, rejected };
}

// The note stored with a screenshot. For a reference address it starts
// "Screenshot of <url>": that is how a match on that address finds its
// screenshots (designSuggest.js referenceShots), so the address must stay
// a separate word ("-" before the admin's own note, never ":").
export function shotNote(sourceUrl, note) {
  const own = typeof note === 'string' ? note.replace(/\s+/g, ' ').trim() : '';
  const href = safeHref(sourceUrl);
  const text = href ? `Screenshot of ${href}${own ? ` - ${own}` : ''}` : own;
  return text.slice(0, 500);
}

// A screenshot is cut into parts a run can send: scaled to at most this
// wide (plenty for a layout), then cut into parts at most this tall, top
// first, at most MATCH_SHOT_LIMIT of them (what a match looks at); the
// page below the last part is left out. Opus reads an image at up to
// 2576 px on its long side, so every part stays under that both ways.
export const SHOT_TILE_WIDTH = 1440;
export const SHOT_TILE_HEIGHT = 2400;

// How a screenshot of `width` x `height` px is cut, or null when the size
// is unknown. Pure (no canvas), so it is tested on its own:
//   { width, height }  the scaled page (scale <= 1, never enlarged)
//   tiles              [{ part, sx, sy, sw, sh, width, height }]: each
//                      part's rectangle in the original image and its
//                      size once drawn, top first
//   dropped            true when the page is taller than the parts hold
//   droppedShare       how much of the page's height was left out, 0..1
//   asIs               one part at the original size: the file itself
//                      may go up unchanged (when it isn't too heavy)
// Up to MATCH_SHOT_LIMIT parts are cut evenly (no thin sliver at the
// bottom); a longer page keeps full-height parts from the top.
export function planTiles({ width, height } = {}) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const scale = Math.min(1, SHOT_TILE_WIDTH / w);
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const needed = Math.ceil(outH / SHOT_TILE_HEIGHT);
  const dropped = needed > MATCH_SHOT_LIMIT;
  const count = Math.min(needed, MATCH_SHOT_LIMIT);
  const step = dropped ? SHOT_TILE_HEIGHT : Math.ceil(outH / count);
  const keptH = Math.min(outH, step * count);
  // Drawn rows map back to the original's rows; the last part ends at the
  // bottom of what is kept, so rounding never loses or repeats a row.
  const srcY = (y) => (y >= outH ? h : Math.min(h, Math.round(y / scale)));
  const tiles = [];
  for (let i = 0; i < count; i += 1) {
    const y = i * step;
    const end = Math.min(keptH, y + step);
    const sy = srcY(y);
    tiles.push({ part: i + 1, sx: 0, sy, sw: w, sh: Math.max(1, srcY(end) - sy), width: outW, height: end - y });
  }
  return {
    width: outW,
    height: outH,
    tiles,
    dropped,
    droppedShare: dropped ? (outH - keptH) / outH : 0,
    asIs: count === 1 && scale === 1,
  };
}

// The name a part is stored under: "home (part 2 of 3).jpg" (a JPEG
// always: parts are redrawn). The base is kept short: reference-add keeps
// 190 characters of a name, and cutting off " (part 2 of 3)" would make a
// part look like a whole screenshot (wholeShotName).
const TILE_BASE_MAX = 150;
export function tileName(name, part, parts) {
  const base = String(name || 'screenshot').replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, TILE_BASE_MAX).trim() || 'screenshot';
  return parts > 1 ? `${base} (part ${part} of ${parts}).jpg` : `${base}.jpg`;
}

// The screenshot a part came from, for labels: "home (part 2 of 3).jpg"
// -> "home.jpg". Any other name stays as it is.
export function wholeShotName(name) {
  return String(name || '').replace(/ \(part \d+ of \d+\)(?=\.[a-z0-9]{1,5}$)/i, '');
}

// A fresh group id for the parts of one screenshot (designSuggest.js
// REFERENCE_GROUP_RE: lower-case letters, digits and dashes, 8 to 40).
// randomUUID only exists on https pages (and localhost): elsewhere a
// time-and-random id is unique enough for one project's uploads.
export function newShotGroup(cryptoApi = globalThis.crypto) {
  const id = typeof cryptoApi?.randomUUID === 'function' ? String(cryptoApi.randomUUID()).toLowerCase() : '';
  if (REFERENCE_GROUP_RE.test(id)) return id;
  return `g${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12).padEnd(8, '0')}`;
}

const browserCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// The part as a JPEG a run can send: lower quality only when it has to.
// A part is at most 1440 x 2400 px, so even the last try is far below the
// limit in practice; it is used even if not (the server takes up to
// 10 MB, and the run says which images it skipped).
async function jpegOf(canvas) {
  let last = null;
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob) last = blob;
    if (blob && blob.size <= MATCH_SHOT_SEND_BYTES) return blob;
  }
  return last;
}

// Browser only: draws each part of `plan` from `image` (an ImageBitmap)
// onto its own canvas, white under any transparency, and returns them as
// JPEG files named after `name`, top first, or null if the browser can't
// draw or encode one (the caller uploads the original then). `makeCanvas`
// is for tests.
export async function drawTiles(image, plan, { name, makeCanvas = browserCanvas } = {}) {
  const files = [];
  for (const tile of plan.tiles) {
    const canvas = makeCanvas(tile.width, tile.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, tile.width, tile.height);
    // A retina capture is drawn at half size or less: the browser's default
    // (low) smoothing would make small text in it hard to read.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, tile.sx, tile.sy, tile.sw, tile.sh, 0, 0, tile.width, tile.height);
    const blob = await jpegOf(canvas);
    if (!blob) return null;
    files.push(new File([blob], tileName(name, tile.part, plan.tiles.length), { type: 'image/jpeg' }));
  }
  return files;
}

// Browser only: the files to upload for one picked screenshot, top first,
// and how it was cut ({ files, plan }; plan is null when the browser
// couldn't read the image). A screenshot that already fits one part and
// isn't too heavy goes up as it is; any other is redrawn into parts
// (planTiles). Anything that can't be decoded or drawn here is uploaded
// as it is (the server and the run still check it).
export async function prepareShot(file) {
  const asIs = { files: [file], plan: null };
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return asIs;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return asIs;
  }
  try {
    const plan = planTiles({ width: bitmap.width, height: bitmap.height });
    if (!plan) return asIs;
    if (plan.asIs && !(Number(file.size) > MATCH_SHOT_SEND_BYTES)) return { files: [file], plan };
    const files = await drawTiles(bitmap, plan, { name: file.name });
    return files?.length ? { files, plan } : asIs;
  } catch {
    return asIs;
  } finally {
    bitmap.close?.();
  }
}

// What the page says about a cut screenshot ('' for one part): how many
// parts, and how much of a long page was left out. It never suggests
// adding the rest as another screenshot: a match on this one sends only
// its own parts, and one on the address sends the first
// MATCH_SHOT_LIMIT, which these parts already fill (designSuggest.js
// referenceShots).
export function splitText(plan) {
  const parts = plan?.tiles?.length || 0;
  if (parts < 2) return '';
  const text = `Split into ${parts} parts, top first.`;
  if (!plan.dropped) return text;
  const pct = Math.max(1, Math.round(plan.droppedShare * 100));
  return `${text} The bottom ${pct}% of the page was left out: a match looks at the top ${MATCH_SHOT_LIMIT} parts only.`;
}

const PHASE_STEP = { prepare: 0, upload: 1, save: 2, done: 3 };
const PHASE_VERB = { prepare: 'Preparing', upload: 'Uploading', save: 'Saving' };

// Progress over the whole pick, 0..1, as a phase starts. Each file counts
// the same: preparing it is one step, then each of its parts an upload and
// a save step (`part` of `parts`, 1 of 1 for an uncut screenshot).
export function shotProgress({ index = 0, total = 0, phase = 'prepare', part = 1, parts = 1 } = {}) {
  if (!(total > 0)) return 0;
  const n = Math.max(1, Number(parts) || 1);
  const k = Math.min(Math.max(1, Number(part) || 1), n);
  const step = PHASE_STEP[phase] ?? 0;
  // Steps done in this file: none while preparing; then the preparing,
  // the parts above this one, and this part's upload once it is saving.
  const inFile = step === 0 ? 0 : step >= 3 ? 1 : ((k - 1) * 2 + step) / (1 + n * 2);
  return Math.min(1, (index + inFile) / total);
}

// "Uploading 2 of 3: home.png…", "Uploading home.png, part 2 of 4…"
export function shotStatusText({ index = 0, total = 1, name = '', phase = 'upload', part = 1, parts = 1 } = {}) {
  const where = parts > 1 && phase !== 'prepare' ? `, part ${part} of ${parts}` : '';
  return `${PHASE_VERB[phase] || 'Uploading'} ${total > 1 ? `${index + 1} of ${total}: ` : ''}${name || 'screenshot'}${where}…`;
}

// Where a match run's colors come from, as the panel says it
// (designSuggest.js matchPalettePlan's `from`; `brandOff` when they gave
// brand colors but "Use their brand color" is off on the page).
export function paletteSourceText(plan) {
  const overlay = plan?.from !== 'studio' && Object.keys(plan?.studio || {}).length ? ', with your Studio colors on top' : '';
  switch (plan?.from) {
    case 'studio': return 'your Studio palette';
    case 'brand': return `their brand system${overlay}`;
    case 'brandColors': return `their brand color on the template's colors${overlay}`;
    default: return plan?.brandOff
      ? `the template's own colors${overlay} ("Use their brand color" is off)`
      : `the template's own colors${overlay} (they gave no brand colors yet)`;
  }
}
