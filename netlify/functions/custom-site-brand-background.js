// POST /.netlify/functions/custom-site-brand-background   { id, startedAt }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). "Build brand system": Claude
// (BRAND_MODEL) runs the launch-brand-system skill in a code execution
// container over the customer's logo, brand files and inspiration images
// plus their style answers, and writes brand.json and brand_board.png
// (src/lib/brandSpec.js). custom-site-brand `start` claims the run first
// (design.brand = { status: 'running', startedAt }); this function only runs
// the claim it is given, so a double click or a retried request can't start
// a second run. The admin page polls custom-site-brand `get`: running →
// ready | failed.
//
// It stores the checked brand system in design.brand and the board image
// in the private custom-site-assets bucket, and nothing else: the site, the
// rest of the design and the levers stay as they are until the admin
// applies a palette.
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { sniffImage } from './_lib/custom-site-suggest-ai.js';
import {
  BRAND_SKILL_NOT_SET_UP, brandSkill, deleteFiles, downloadFile, pickOutput, runSkillRequest, updateDesignRecord,
} from './_lib/custom-site-skills.js';
import { ASSET_BUCKET } from '../../src/lib/customSiteForm.js';
import {
  BRAND_FILES, BRAND_INPUT_EXT, BRAND_INPUT_LIMITS, BRAND_INPUT_MAX_BYTES, BRAND_INPUT_TYPES, BRAND_MODEL,
  BRAND_RUN_BUDGET_MS, brandBoardPath, brandInputCandidates, brandUsage, buildBrandPrompt, failedBrandRecord,
  isBrandBoardPath, isSameBrandClaim, sanitizeBrand,
} from '../../src/lib/brandSpec.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
// Claude reads images up to 8000 px on a side; bigger ones still go to the
// container, where the skill reads them with Pillow.
const MAX_VISION_SIDE = 8000;
const MAX_SPEC_BYTES = 256 * 1024;
const MAX_BOARD_BYTES = 10 * 1024 * 1024;

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-brand] event ${type} not logged:`, error.message);
}

const skip = (a, reason) => ({ path: a.path, kind: a.kind, name: a.name || '', reason });

async function loadOne(db, asset) {
  let buf;
  try {
    const { data, error } = await db.storage.from(ASSET_BUCKET).download(asset.path);
    if (error || !data) throw new Error(error?.message || 'no data');
    buf = Buffer.from(await data.arrayBuffer());
  } catch (err) {
    console.warn('[custom-site-brand] download failed:', asset.path, err?.message || err);
    return { skip: skip(asset, 'Could not be downloaded') };
  }
  // What the file really is, from its bytes: the name and stored type can
  // be wrong, and a wrong media type fails the request.
  const info = sniffImage(buf);
  if (!info || !BRAND_INPUT_TYPES.includes(info.mediaType)) return { skip: skip(asset, 'Not a readable PNG, JPEG, WebP or GIF image') };
  if (buf.length > BRAND_INPUT_MAX_BYTES) return { skip: skip(asset, 'Too large to send (over 4.5 MB)') };
  return {
    file: {
      kind: asset.kind,
      mediaType: info.mediaType,
      data: buf,
      originalName: asset.name || '',
      note: asset.note || '',
      vision: !(info.width > MAX_VISION_SIDE || info.height > MAX_VISION_SIDE),
    },
  };
}

// The files one run gets: at most 1 logo, 2 brand files and 4 inspiration
// images (BRAND_INPUT_LIMITS), in upload order, each checked after
// download. A file that can't be sent makes room for the next of its kind.
// Each gets a plain name in the container ("logo-1.png"): the customer's
// own file name is data, not a path. Returns { files, skipped }.
export async function loadBrandInputs(db, project) {
  const candidates = brandInputCandidates(project?.assets);
  const skipped = [...candidates.skipped];
  const files = [];
  for (const kind of ['logo', 'brand', 'reference']) {
    const limit = BRAND_INPUT_LIMITS[kind];
    const queue = candidates[kind].slice();
    let taken = 0;
    while (queue.length && taken < limit) {
      const batch = queue.splice(0, limit - taken);
      const loaded = await Promise.all(batch.map((a) => loadOne(db, a)));
      for (const r of loaded) {
        if (r.skip) {
          skipped.push(r.skip);
        } else {
          taken += 1;
          files.push({ ...r.file, name: `${kind}-${taken}.${BRAND_INPUT_EXT[r.file.mediaType]}` });
        }
      }
    }
    for (const a of queue) {
      skipped.push(skip(a, kind === 'logo' ? 'Another version of the logo (one is sent)' : `Only the first ${limit} of these are sent`));
    }
  }
  return { files, skipped };
}

const errorWith = (message, run) => Object.assign(new Error(message), { usage: run?.usage, model: run?.model });

// Why a run came back without brand.json, in plain words.
function missingSpecMessage(run) {
  if (run.timedOut) return 'The brand run ran out of time before it wrote its files. Try again.';
  if (run.stopReason === 'pause_turn') return 'The brand run took too many steps before it wrote its files. Try again.';
  if (run.stopReason === 'max_tokens' || run.stopReason === 'model_context_window_exceeded') return 'The brand run ran out of room before it wrote its files. Try again.';
  return 'The brand run finished without writing brand.json.';
}

// The run for one project: inputs, the skill, the checks, the board upload.
// Writes nothing to the project. Returns { brand, boardPath, model, usage,
// skipped, warnings, turns, imageCount }; throws (with usage and model when
// Claude ran) otherwise.
export async function buildBrand({ db, client, project, skill, deadline, nowMs = () => Date.now() }) {
  const { files, skipped } = await loadBrandInputs(db, project);
  const prompt = buildBrandPrompt({ project, files, skipped });
  const run = await runSkillRequest({
    client, skill, system: prompt.system, userText: prompt.userText, files, deadline, model: BRAND_MODEL, now: nowMs,
  });
  try {
    const specOut = pickOutput(run.outputs, BRAND_FILES.spec);
    if (!specOut) throw errorWith(missingSpecMessage(run), run);
    let raw;
    try {
      const buf = await downloadFile(client, specOut.file_id, { maxBytes: MAX_SPEC_BYTES, size: specOut.size_bytes });
      raw = JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, ''));
    } catch (err) {
      throw errorWith(`brand.json could not be read: ${err?.message || 'unknown error'}`, run);
    }
    const brand = sanitizeBrand(raw);
    if (!brand) throw errorWith('brand.json came back without a usable palette (five #rrggbb colors that can be made readable).', run);

    const warnings = [];
    let boardPath = null;
    const boardOut = pickOutput(run.outputs, BRAND_FILES.board);
    if (!boardOut) {
      warnings.push('No brand board image came back.');
    } else {
      try {
        const png = await downloadFile(client, boardOut.file_id, { maxBytes: MAX_BOARD_BYTES, size: boardOut.size_bytes });
        if (sniffImage(png)?.mediaType !== 'image/png') throw new Error('it isn\'t a PNG image');
        const path = brandBoardPath(project.id, nowMs());
        const { error } = await db.storage.from(ASSET_BUCKET).upload(path, png, { contentType: 'image/png', upsert: false });
        if (error) throw new Error(error.message);
        boardPath = path;
      } catch (err) {
        console.warn('[custom-site-brand] board not stored:', err?.message || err);
        warnings.push(`The brand board image could not be stored: ${String(err?.message || 'unknown error').slice(0, 160)}`);
      }
    }
    return {
      brand, boardPath, warnings, skipped, model: run.model, usage: brandUsage(run.usage), turns: run.turns, imageCount: files.length,
    };
  } finally {
    // Our copy is in the bucket and the record: the Files API ones can go.
    await deleteFiles(client, run.outputs.map((o) => o.file_id));
  }
}

// Boards earlier runs left behind, best effort (only "board-<ms>.png" in
// the project's brand folder; the customer's uploads there have UUID names).
async function removeOldBoards(db, projectId, keep) {
  try {
    const { data } = await db.storage.from(ASSET_BUCKET).list(`${projectId}/brand`, { limit: 1000 });
    const old = (data || []).map((f) => `${projectId}/brand/${f.name}`).filter((p) => p !== keep && isBrandBoardPath(projectId, p));
    if (old.length) await db.storage.from(ASSET_BUCKET).remove(old);
  } catch (err) {
    console.warn('[custom-site-brand] old boards not removed:', err?.message || err);
  }
}

// The work, separate from the HTTP wrapper so tests can call it with a
// fake database, storage and Anthropic client.
export async function runBrand({
  db, client, projectId, startedAt, actor, skill, now = () => new Date().toISOString(), nowMs = () => Date.now(),
}) {
  if (typeof projectId !== 'string' || !projectId) return { status: 404, error: 'Project not found' };
  const { data: project, error: loadError } = await db.from(TABLE).select('*').eq('id', projectId).maybeSingle();
  if (loadError || !project) return { status: 404, error: 'Project not found' };
  // Only the run `start` claimed. Compared as instants: the claim wrote
  // '…Z' into the JSON, the caller may send it back in another form.
  const claim = project.design?.brand;
  if (!isSameBrandClaim(claim, startedAt)) return { status: 409, error: 'No matching run to start' };

  let next;
  let result = null;
  try {
    if (!skill?.skill_id) throw new Error(BRAND_SKILL_NOT_SET_UP);
    // Counted from the claim: the time Netlify took to start this is spent.
    const deadline = Date.parse(claim.startedAt) + BRAND_RUN_BUDGET_MS;
    result = await buildBrand({ db, client, project, skill, deadline, nowMs });
    next = {
      status: 'ready',
      startedAt: claim.startedAt,
      finishedAt: now(),
      model: result.model,
      brand: result.brand,
      boardPath: result.boardPath,
      usage: result.usage,
      error: null,
      skipped: result.skipped,
      warnings: result.warnings,
      skill: { id: skill.skill_id, version: skill.version },
    };
  } catch (err) {
    console.error('[custom-site-brand] failed:', err?.message || err);
    next = failedBrandRecord({ startedAt: claim.startedAt, finishedAt: now(), error: err?.message, model: err?.model, usage: err?.usage });
  }

  // Stored only while the claim is still this run's: a newer run (after
  // this one went stale) or a release owns the slot otherwise.
  const { written } = await updateDesignRecord(db, project.id, 'brand', (current) => (isSameBrandClaim(current, startedAt) ? next : undefined));
  if (!written) {
    if (next.boardPath) await db.storage.from(ASSET_BUCKET).remove([next.boardPath]).catch(() => {});
    return { status: 409, error: 'The run was replaced' };
  }
  if (next.status === 'ready') {
    if (next.boardPath) await removeOldBoards(db, project.id, next.boardPath);
    await logEvent(db, project.id, 'brand_ready', {
      model: next.model, turns: result.turns, images: result.imageCount, skipped: result.skipped.length,
      adjustments: next.brand.adjustments.length, board: !!next.boardPath, ...next.usage,
    }, actor);
    return { status: 200 };
  }
  await logEvent(db, project.id, 'brand_failed', { error: next.error.slice(0, 200), ...next.usage }, actor);
  return { status: 500, error: next.error };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400 }; }
  const db = supabaseAdmin();
  let auth;
  try {
    auth = await requireSuperAdmin(event, db);
  } catch (e) {
    return { statusCode: e.status || 401 };
  }
  // Without the skill the run fails fast (runBrand) and needs no client.
  // The model requests are bounded by the run's deadline (runSkillRequest);
  // this timeout only covers the Files API calls.
  const skill = brandSkill();
  const client = skill ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 2 * 60 * 1000 }) : null;
  // Netlify retries a background function that fails (an error or a 5xx),
  // which would pay for the model run again. The run records its own
  // outcome on the project, so once it has started, always answer 200.
  try {
    const result = await runBrand({ db, client, projectId: body.id, startedAt: body.startedAt, actor: auth.actor, skill });
    return { statusCode: result.status >= 500 ? 200 : result.status };
  } catch (err) {
    console.error('[custom-site-brand] run crashed:', err?.message || err);
    return { statusCode: 200 };
  }
};
