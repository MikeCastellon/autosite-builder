// POST /.netlify/functions/custom-site-heic-background   { id, startedAt, actor? }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). Converts a custom-site project's
// iPhone photos (HEIC/HEIF) to JPEG (_lib/heic.js), so they can go on a
// website, into the Design step and in front of Claude. A run is claimed
// first (design.heic = { status: 'running', startedAt }, _lib/heic-run.js
// claimHeicRun) by custom-site-admin `heic-convert` or by a customer save in
// custom-site-form; this function only runs the claim it is given, so a
// double click or a retried request can't start a second run. The request
// carries the server's signature (heicSignature) instead of a sign-in: the
// customer's form has none.
//
// Per file, in the list's order: download the HEIC from the private bucket,
// convert it, upload the JPEG to <projectId>/<kind>/<uuid>.jpg, swap it into
// project.assets in the HEIC's place (a guarded write: the customer's
// autosave and the team write the list too). The original HEIC stays in the
// bucket, named by the JPEG's convertedFrom: a conversion can be redone or
// undone, and deleting a customer's original can't be. It leaves the
// customer's list, and goes with the project's folders when it is deleted.
// A file that fails is recorded and the run goes on. Nothing else of the
// project changes, except design.reference when it pointed at a converted
// file (it follows the file) and the run's own record.
import crypto from 'node:crypto';
import { supabaseAdmin } from './_shared/auth.js';
import { convertHeic } from './_lib/heic.js';
import {
  HEIC_BUDGET_MS, HEIC_FAILED_MAX, HEIC_MAX_BYTES, HEIC_SIGNATURE_HEADER, heicAssetsOf, isSameHeicClaim,
  updateHeicRecord, updateProjectRow, verifyHeicSignature,
} from './_lib/heic-run.js';
import { ASSET_BUCKET } from '../../src/lib/customSiteForm.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const TAG = '[custom-site-heic]';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`${TAG} event ${type} not logged:`, error.message);
}

// The customer's own file name with .jpg for its extension ("IMG_0412.HEIC"
// → "IMG_0412.jpg"): the Design step and the Suggest a design picker go by
// the name's extension.
export function jpegName(name, fallback = 'photo') {
  const base = oneLine(name, 200).replace(/\.[^./\\\s]{1,8}$/, '') || fallback;
  return `${base.slice(0, 195)}.jpg`;
}

// A file named .heic that is a JPEG already (some apps and transfers keep
// the name and send the "most compatible" JPEG): it only needs its name.
const isJpegBytes = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

// A storage call that never answers would hold the run until Netlify's
// 15-minute kill and leave the claim "running": give up on that file instead.
const STORAGE_TIMEOUT_MS = 90 * 1000;
function withTimeout(promise, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${STORAGE_TIMEOUT_MS / 1000} s`)), STORAGE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function download(db, path) {
  const { data, error } = await withTimeout(db.storage.from(ASSET_BUCKET).download(path), 'The download');
  if (error || !data) throw new Error(error?.message || 'no data');
  return Buffer.from(await data.arrayBuffer());
}

// Whether project.assets lists `path`: true, false, or null when the
// project can't be read (then nobody can tell).
async function listsPath(db, projectId, path) {
  try {
    const { data, error } = await db.from(TABLE).select('assets').eq('id', projectId).maybeSingle();
    if (error) return null;
    return (Array.isArray(data?.assets) ? data.assets : []).some((a) => isObject(a) && a.path === path);
  } catch {
    return null;
  }
}

async function removeObject(db, path, why) {
  try {
    const { error } = await db.storage.from(ASSET_BUCKET).remove([path]);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn(`${TAG} ${why} not removed:`, path, err?.message || err);
  }
}

// One HEIC upload to JPEG. Returns { converted: true }, { gone: true } (the
// upload left the list while it was converting: the customer removed it)
// or { failure: { path, name, reason } }.
async function convertOne({ db, projectId, startedAt, asset, convert, newId, progress }) {
  const name = oneLine(asset.name, 200) || asset.path.split('/').pop();
  const fail = (reason) => ({ failure: { path: asset.path, name, reason } });

  if (Number(asset.size) > HEIC_MAX_BYTES) return fail('Too large to convert (over 30 MB)');
  let buf;
  try {
    buf = await download(db, asset.path);
  } catch (err) {
    console.warn(`${TAG} download failed:`, asset.path, err?.message || err);
    return fail('Could not be downloaded');
  }
  if (buf.length > HEIC_MAX_BYTES) return fail('Too large to convert (over 30 MB)');

  let jpeg;
  try {
    jpeg = isJpegBytes(buf) ? buf : (await convert(buf)).jpeg;
  } catch (err) {
    console.warn(`${TAG} conversion failed:`, asset.path, err?.message || err);
    return fail(`Could not be converted: ${oneLine(err?.message, 160) || 'unknown error'}`);
  }

  const path = `${projectId}/${asset.kind}/${newId()}.jpg`;
  try {
    const { error } = await withTimeout(db.storage.from(ASSET_BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false }), 'The upload');
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn(`${TAG} upload failed:`, path, err?.message || err);
    return fail('The JPEG could not be stored');
  }

  // The swap reads the list again: the stored entry (not the one this run
  // started from) is the one replaced, so a note the customer changed in
  // the meantime stays, and so does its place.
  let gone = false;
  let written = false;
  let saveError = null;
  try {
    ({ written } = await updateProjectRow(db, projectId, 'assets, design', (row) => {
      gone = false;
      const assets = Array.isArray(row.assets) ? row.assets : [];
      const at = assets.findIndex((a) => isObject(a) && a.path === asset.path);
      if (at < 0) {
        gone = true;
        return undefined;
      }
      const stored = assets[at];
      const next = assets.slice();
      next[at] = {
        ...stored,
        path,
        name: jpegName(stored.name, asset.kind),
        size: jpeg.length,
        type: 'image/jpeg',
        convertedFrom: stored.path,
      };
      const patch = { assets: next };
      const design = isObject(row.design) ? row.design : {};
      let nextDesign = null;
      // The run's progress rides on the same write (no extra write for the
      // customer's autosave to collide with).
      if (isSameHeicClaim(design.heic, startedAt)) {
        nextDesign = { ...design, heic: { ...design.heic, converted: progress() + 1 } };
      }
      // A reference screenshot the Design step picked follows its file.
      const source = design.reference?.source;
      if (isObject(source) && source.kind === 'asset' && source.path === stored.path) {
        nextDesign = { ...(nextDesign || design) };
        nextDesign.reference = { ...design.reference, source: { ...source, path } };
      }
      if (nextDesign) patch.design = nextDesign;
      return patch;
    }));
  } catch (err) {
    console.warn(`${TAG} list not updated:`, asset.path, err?.message || err);
    saveError = err;
  }
  if (!written && saveError && saveError.status !== 409) {
    // A write the database reported as failed may have landed all the same
    // (an answer lost on the way back). The list decides: the JPEG is never
    // removed while it might be the one the list points at. (A 409 wrote
    // nothing: every attempt found the row changed.)
    const listed = await listsPath(db, projectId, path);
    if (listed === null) {
      console.warn(`${TAG} JPEG kept, the list can't be checked:`, path);
      return fail('The JPEG could not be saved to the project');
    }
    written = listed;
  }
  if (!written) {
    // Nothing points at the JPEG: it goes, and the HEIC stays as it was.
    await removeObject(db, path, 'unused JPEG');
    if (gone) return { gone: true };
    return fail(saveError?.status === 409
      ? 'The project kept changing while saving the JPEG. Run it again.'
      : 'The JPEG could not be saved to the project');
  }
  // The list points at the JPEG now. The original stays (see the top).
  return { converted: true };
}

// The work, separate from the HTTP wrapper so tests can call it with a fake
// database and storage. `convert` is _lib/heic.js convertHeic.
export async function runHeic({
  db, projectId, startedAt, actor = null,
  convert = convertHeic, newId = () => crypto.randomUUID(), budgetMs = HEIC_BUDGET_MS,
  now = () => new Date().toISOString(), nowMs = () => Date.now(),
}) {
  if (typeof projectId !== 'string' || !projectId) return { status: 404, error: 'Project not found' };
  const { data: project, error: loadError } = await db.from(TABLE).select('id, design, assets, updated_at').eq('id', projectId).maybeSingle();
  if (loadError || !project) return { status: 404, error: 'Project not found' };
  const claim = isObject(project.design) ? project.design.heic : null;
  if (!isSameHeicClaim(claim, startedAt)) return { status: 409, error: 'No matching run to start' };
  // One attempt per claim: marked before any file is touched. If Netlify
  // retries this function after a hard crash (out of memory, killed), the
  // retry finds the mark and stops; the claim then goes stale, and the next
  // press or save starts a fresh run, which skips what is converted already.
  if (claim.attempted) return { status: 200, error: 'This run was already attempted' };
  const { written: marked } = await updateHeicRecord(db, project.id, (current) => (
    isSameHeicClaim(current, startedAt) && !current.attempted ? { ...current, attempted: true } : undefined
  ));
  if (!marked) return { status: 200, error: 'This run was already attempted or replaced' };

  const by = claim.by === 'customer' ? 'customer' : 'admin';
  const who = oneLine(actor, 200) || by;
  const id = project.id;
  await logEvent(db, id, 'heic_started', { files: heicAssetsOf(project.assets).length, by }, who);

  // Counted from the claim: the time Netlify took to start this is spent.
  const deadline = Date.parse(claim.startedAt) + budgetMs;
  const tried = new Set();
  const failed = [];
  let converted = 0;
  let left = 0;
  let runError = null;
  try {
    for (;;) {
      // The list as it is now: a file the customer removed is skipped, and
      // one they added while this ran is picked up too.
      const { data: row, error } = await db.from(TABLE).select('id, assets').eq('id', id).maybeSingle();
      if (error) throw new Error('Could not load the project');
      if (!row) throw new Error('The project was deleted');
      const waiting = heicAssetsOf(row.assets).filter((a) => !tried.has(a.path));
      if (!waiting.length) break;
      if (nowMs() >= deadline) {
        left = waiting.length;
        break;
      }
      const asset = waiting[0];
      tried.add(asset.path);
      const result = await convertOne({ db, projectId: id, startedAt, asset, convert, newId, progress: () => converted });
      if (result.converted) converted += 1;
      else if (result.failure) failed.push(result.failure);
    }
  } catch (err) {
    console.error(`${TAG} run failed:`, err?.message || err);
    runError = oneLine(err?.message, 300) || 'The conversion failed';
  }

  const outcome = {
    status: runError ? 'failed' : 'ready',
    finishedAt: now(),
    converted,
    failed: failed.slice(0, HEIC_FAILED_MAX),
    ...(runError ? { error: runError } : {}),
    ...(left ? { note: `Stopped at the time limit with ${left} file${left === 1 ? '' : 's'} left to convert. Run it again to finish.` } : {}),
  };
  // Stored only while the claim is still this run's (a newer run owns the
  // record otherwise; the files converted stay converted either way).
  let stored = false;
  try {
    ({ written: stored } = await updateHeicRecord(db, id, (current) => (
      isSameHeicClaim(current, startedAt) ? { ...current, ...outcome } : undefined
    )));
  } catch (err) {
    console.error(`${TAG} result not saved:`, err?.message || err);
  }
  const counts = { converted, failed: failed.length, left, by };
  if (runError) {
    await logEvent(db, id, 'heic_failed', { ...counts, error: runError.slice(0, 200) }, who);
    return { status: 500, error: runError, ...counts, stored };
  }
  await logEvent(db, id, 'heic_ready', counts, who);
  return { status: 200, ...counts, stored };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400 }; }
  if (!isObject(body)) return { statusCode: 400 };
  const signature = event.headers?.[HEIC_SIGNATURE_HEADER] || event.headers?.[HEIC_SIGNATURE_HEADER.toLowerCase()] || '';
  if (!verifyHeicSignature({ id: body.id, startedAt: body.startedAt, actor: body.actor }, signature)) return { statusCode: 401 };
  const db = supabaseAdmin();
  // Netlify retries a background function that fails (an error or a 5xx).
  // The run records its own outcome on the project, so once it has started,
  // always answer 200.
  try {
    const result = await runHeic({ db, projectId: body.id, startedAt: body.startedAt, actor: body.actor || null });
    return { statusCode: result.status >= 500 ? 200 : result.status };
  } catch (err) {
    console.error(`${TAG} run crashed:`, err?.message || err);
    return { statusCode: 200 };
  }
};
