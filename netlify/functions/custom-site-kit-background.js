// POST /.netlify/functions/custom-site-kit-background   { id, skill, startedAt }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). One Launch Kit run: Claude
// (KIT_MODEL) runs the skill of design.kit[skill] (src/lib/launchKit.js
// KIT_SKILLS) in a code execution container over the inputs its spec loads
// (_lib/kit/<skill>.js), and the files it writes come back. custom-site-kit
// `start` claims the run first (design.kit[skill] = { status: 'running',
// startedAt }); this function only runs the claim it is given, so a double
// click or a retried request can't start a second run. The admin page polls
// custom-site-kit `get`: running → ready | failed.
//
// It takes only the files the skill is expected to write (by name, each
// checked for its type and size), stores them in the private
// custom-site-assets bucket at <projectId>/kit/<skill>/<ms>-<name>, stores
// the sanitized JSON in design.kit[skill].data, and removes the files no
// record points at any more. It never writes the site, the rest of the
// design or the customer's uploads.
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { sniffImage } from './_lib/custom-site-suggest-ai.js';
import { deleteFiles, downloadFile, pickOutput, runSkillRequest, updateDesignRecord } from './_lib/custom-site-skills.js';
import { KIT_EFFORT, KIT_MODEL, KIT_SPECS, kitConfigured, kitNotSetUpMessage, kitRules } from './_lib/kit/index.js';
import { brandLook, fetchFontFiles, kitFilesBudget, liveUrls, loadKitFiles, loadSite } from './_lib/kit/inputs.js';
import { ASSET_BUCKET } from '../../src/lib/customSiteForm.js';
import {
  KIT_BUDGET_MS, KIT_NOTES_MAX, failedKitRun, isKitKey, isSameKitClaim, kitFilePath, kitSkill, kitUsage,
  parseKitFilePath, sanitizeKitRun,
} from '../../src/lib/launchKit.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const TAG = '[custom-site-kit]';

// What one output may weigh, by type, and all of one run's outputs
// together: the function holds them in memory and the bucket stores them.
export const KIT_OUTPUT_MAX_BYTES = Object.freeze({
  'application/json': 1024 * 1024,
  'image/png': 12 * 1024 * 1024,
  'application/pdf': 25 * 1024 * 1024,
  'application/zip': 50 * 1024 * 1024,
  'text/vcard': 256 * 1024,
});
const OTHER_MAX_BYTES = 10 * 1024 * 1024;
export const KIT_OUTPUTS_TOTAL_BYTES = 120 * 1024 * 1024;
// Everything one run uploads (the spec's images, earlier kit files, fonts):
// the loaders cap each kind, this caps their sum, so the function's memory
// and the Files API uploads stay bounded whatever a spec combines.
export const KIT_INPUTS_TOTAL_BYTES = 110 * 1024 * 1024;
// A container file name: plain, no folders. Specs name the files they send
// ("photo-3.jpg", "kit-words-words.pdf"); the customer's own file names are
// data and never become paths.
const INPUT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._()+-]{0,150}$/;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const oneLine = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`${TAG} event ${type} not logged:`, error.message);
}

const errorWith = (message, run) => Object.assign(new Error(message), { usage: run?.usage, model: run?.model });

// Why a run came back without a file it had to write, in plain words.
function missingMessage(run, name) {
  if (run.timedOut) return `The run ran out of time before it wrote ${name}. Try again.`;
  if (run.stopReason === 'pause_turn') return `The run took too many steps before it wrote ${name}. Try again.`;
  if (run.stopReason === 'max_tokens' || run.stopReason === 'model_context_window_exceeded') return `The run ran out of room before it wrote ${name}. Try again.`;
  return `The run finished without writing ${name}.`;
}

// Is `buf` what `output` says it is? { json } for the JSON file, else
// { warning } (a PNG of the wrong size still counts) or { problem }.
export function checkKitOutput(output, buf) {
  switch (output.type) {
    case 'application/json':
      try {
        return { json: JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, '')) };
      } catch (err) {
        return { problem: `${output.name} isn't valid JSON (${oneLine(err?.message, 120)})` };
      }
    case 'image/png': {
      const info = sniffImage(buf);
      if (info?.mediaType !== 'image/png') return { problem: `${output.name} isn't a PNG image` };
      if (output.px && (info.width !== output.px[0] || info.height !== output.px[1])) {
        return { warning: `${output.name} is ${info.width}x${info.height}, not ${output.px[0]}x${output.px[1]}` };
      }
      return {};
    }
    case 'application/pdf':
      return buf.toString('latin1', 0, 5) === '%PDF-' ? {} : { problem: `${output.name} isn't a PDF` };
    case 'application/zip': {
      const head = buf.toString('latin1', 0, 4);
      return head === 'PK\x03\x04' || head === 'PK\x05\x06' ? {} : { problem: `${output.name} isn't a zip file` };
    }
    case 'text/vcard':
      return /^\s*BEGIN:VCARD/i.test(buf.toString('utf8', 0, 200).replace(/^\uFEFF/, '')) ? {} : { problem: `${output.name} isn't a vCard` };
    default:
      return {};
  }
}

// Uploads the customer's files that were left out, as at most 3 lines.
function skippedLines(skipped) {
  const list = (Array.isArray(skipped) ? skipped : []).filter((s) => s && (s.name || s.path));
  const lines = list.slice(0, 3).map((s) => `Not used: ${oneLine(s.name || String(s.path).split('/').pop(), 80)}: ${oneLine(s.reason, 160)}`);
  if (list.length > 3) lines.push(`${list.length - 3} more uploads weren't used.`);
  return lines;
}

function notesOf(spec, raw, data, ctx) {
  let notes;
  try {
    notes = typeof spec.notes === 'function' ? spec.notes(raw, data, ctx) : raw?.notes;
  } catch (err) {
    console.warn(`${TAG} notes failed:`, err?.message || err);
    notes = [];
  }
  return (Array.isArray(notes) ? notes : []).map((n) => oneLine(n, 300)).filter(Boolean).slice(0, KIT_NOTES_MAX);
}

// Everything up to the request, without sending anything: the context the
// spec gets, its inputs and the prompt (the spec's own system prompt plus
// kitRules). Returns { ctx (with ctx.inputs), files, system, userText }.
// The smoke test's dry run calls exactly this.
export async function prepareKitRun({
  db, project, site = null, key, spec, deadline, nowMs = () => Date.now(), fetchImpl = globalThis.fetch,
}) {
  const entry = kitSkill(key);
  if (!entry || !spec || spec.stub) throw new Error(kitNotSetUpMessage(key) || 'Unknown launch kit item');
  const budget = kitFilesBudget();
  const ctx = {
    key,
    project,
    projectId: project?.id,
    db,
    site,
    look: brandLook(project, site),
    urls: liveUrls(project, site),
    deadline,
    nowMs,
    fetchImpl,
    kitFiles: (k, opts = {}) => loadKitFiles(db, project, k, { ...opts, budget }),
    fonts: (families, opts = {}) => fetchFontFiles(families, { fetchImpl, ...opts }),
  };
  const inputs = (await spec.loadInputs(ctx)) || {};
  const files = Array.isArray(inputs.files) ? inputs.files : [];
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || !f.name || typeof f.mediaType !== 'string' || !Buffer.isBuffer(f.data)) {
      throw new Error(`The ${entry.label} inputs include a file without a name, type or bytes.`);
    }
  }
  if (new Set(files.map((f) => f.name)).size !== files.length) throw new Error(`The ${entry.label} inputs use one file name twice.`);
  const bad = files.find((f) => !INPUT_NAME_RE.test(f.name) || f.name.includes('..'));
  if (bad) throw new Error(`The ${entry.label} inputs include a file name that isn't a plain name (${oneLine(bad.name, 80)}).`);
  const bytes = files.reduce((sum, f) => sum + f.data.length, 0);
  if (bytes > KIT_INPUTS_TOTAL_BYTES) {
    throw new Error(`The ${entry.label} inputs are too large together (${Math.round(bytes / (1024 * 1024))} MB; the limit is ${KIT_INPUTS_TOTAL_BYTES / (1024 * 1024)} MB).`);
  }
  const withInputs = { ...ctx, inputs };
  const prompt = spec.buildPrompt(withInputs) || {};
  if (!String(prompt.userText || '').trim()) throw new Error(`The ${entry.label} request came out empty.`);
  const system = [String(prompt.system || '').trim(), kitRules(key)].filter(Boolean).join('\n\n');
  return { ctx: withInputs, files, system, userText: String(prompt.userText) };
}

// The run for one project, without storing anything: the spec's inputs,
// the skill, the expected outputs (downloaded within their caps and
// checked), the sanitized data. Returns { data, raw, outputs: [{ name,
// type, data: Buffer }] (the data file is the sanitized JSON), notes,
// warnings, skipped, usage, model, turns, stopReason, files (how many went
// in) }; throws (with usage and model once Claude ran) otherwise. The
// smoke test (scripts/skills-smoke.mjs) runs exactly this.
export async function buildKitRun({
  db, client, project, site = null, key, spec, skill, deadline, nowMs = () => Date.now(), fetchImpl = globalThis.fetch,
}) {
  const entry = kitSkill(key);
  const { ctx: withInputs, files, system, userText } = await prepareKitRun({ db, project, site, key, spec, deadline, nowMs, fetchImpl });
  const { inputs } = withInputs;

  const run = await runSkillRequest({
    client, skill, system, userText, files, deadline, maxTurns: spec.maxTurns,
    model: KIT_MODEL, effort: KIT_EFFORT, now: nowMs,
  });
  try {
    const warnings = (Array.isArray(inputs.warnings) ? inputs.warnings : []).map((w) => oneLine(w, 300)).filter(Boolean);
    const outputs = [];
    let raw;
    let total = 0;
    for (const output of entry.outputs) {
      const found = pickOutput(run.outputs, output.name);
      if (!found) {
        if (output.required) throw errorWith(missingMessage(run, output.name), run);
        warnings.push(`${output.label} (${output.name}) didn't come back.`);
        continue;
      }
      let buf;
      let check;
      try {
        buf = await downloadFile(client, found.file_id, { maxBytes: KIT_OUTPUT_MAX_BYTES[output.type] || OTHER_MAX_BYTES, size: found.size_bytes });
        if (total + buf.length > KIT_OUTPUTS_TOTAL_BYTES) throw new Error('the run\'s files are too large together');
        check = checkKitOutput(output, buf);
      } catch (err) {
        check = { problem: `${output.name} could not be read: ${oneLine(err?.message, 160) || 'unknown error'}` };
      }
      if (check.problem) {
        if (output.required) throw errorWith(check.problem, run);
        warnings.push(`${check.problem}; left out.`);
        continue;
      }
      if (check.warning) warnings.push(check.warning);
      total += buf.length;
      if (output.name === entry.dataFile) raw = check.json;
      else outputs.push({ name: output.name, type: output.type, data: buf });
    }

    let data;
    try {
      data = spec.sanitize(raw, withInputs);
    } catch (err) {
      throw errorWith(`${entry.dataFile} could not be checked: ${oneLine(err?.message, 200) || 'unknown error'}`, run);
    }
    if (!isObject(data)) throw errorWith(`${entry.dataFile} came back without usable data.`, run);
    // What the customer and later runs get is what the server checked,
    // never the raw model output.
    outputs.unshift({ name: entry.dataFile, type: 'application/json', data: Buffer.from(`${JSON.stringify(data, null, 2)}\n`) });
    return {
      data,
      raw,
      outputs,
      notes: notesOf(spec, raw, data, withInputs),
      warnings,
      skipped: Array.isArray(inputs.skipped) ? inputs.skipped : [],
      usage: kitUsage(run.usage),
      model: run.model,
      turns: run.turns,
      stopReason: run.stopReason,
      files: files.length,
    };
  } finally {
    // Our copies are in hand: the Files API ones can go.
    await deleteFiles(client, run.outputs.map((o) => o.file_id));
  }
}

// Stores a run's outputs at kitFilePath(…, ms). A required file that can't
// be stored fails the run (and what was stored goes again); an optional
// one is a warning. Returns { files: [{ name, path, type, size }], warnings }.
export async function storeKitFiles(db, projectId, key, outputs, ms) {
  const entry = kitSkill(key);
  const files = [];
  const warnings = [];
  for (const out of outputs) {
    const path = kitFilePath(projectId, key, out.name, ms);
    const { error } = await db.storage.from(ASSET_BUCKET).upload(path, out.data, { contentType: out.type, upsert: false });
    if (!error) {
      files.push({ name: out.name, path, type: out.type, size: out.data.length });
      continue;
    }
    console.warn(`${TAG} file not stored:`, path, error.message);
    const required = out.name === entry.dataFile || entry.outputs.find((o) => o.name === out.name)?.required;
    if (required) {
      if (files.length) await db.storage.from(ASSET_BUCKET).remove(files.map((f) => f.path)).catch(() => {});
      throw new Error(`${out.name} could not be stored: ${oneLine(error.message, 160)}`);
    }
    warnings.push(`${out.name} could not be stored; left out.`);
  }
  return { files, warnings };
}

// Stored files of this key that no record points at any more (earlier
// runs'), best effort. Only files older than `beforeMs`: a newer run's files
// are never touched, whatever order things land in.
async function removeOldKitFiles(db, projectId, key, keep, beforeMs) {
  try {
    const folder = `${projectId}/kit/${key}`;
    const { data } = await db.storage.from(ASSET_BUCKET).list(folder, { limit: 1000 });
    const old = (data || []).map((f) => `${folder}/${f.name}`).filter((path) => {
      const p = parseKitFilePath(projectId, path);
      return p && p.key === key && p.ms < beforeMs && !keep.includes(path);
    });
    if (old.length) await db.storage.from(ASSET_BUCKET).remove(old);
  } catch (err) {
    console.warn(`${TAG} old files not removed:`, err?.message || err);
  }
}

// The work, separate from the HTTP wrapper so tests can call it with a
// fake database, storage, spec and Anthropic client.
export async function runKit({
  db, client, projectId, key, startedAt, actor, specs = KIT_SPECS, env = process.env, skill: givenSkill,
  now = () => new Date().toISOString(), nowMs = () => Date.now(), fetchImpl = globalThis.fetch,
}) {
  if (!isKitKey(key)) return { status: 400, error: 'Unknown launch kit item' };
  if (typeof projectId !== 'string' || !projectId) return { status: 404, error: 'Project not found' };
  const { data: project, error: loadError } = await db.from(TABLE).select('*').eq('id', projectId).maybeSingle();
  if (loadError || !project) return { status: 404, error: 'Project not found' };
  // Only the run `start` claimed. Compared as instants: the claim wrote
  // '…Z' into the JSON, the caller may send it back in another form.
  const claim = project.design?.kit?.[key];
  if (!isSameKitClaim(claim, startedAt)) return { status: 409, error: 'No matching run to start' };
  // One attempt per claim: mark it before anything is spent. If Netlify
  // retries this function after a hard crash (out of memory, killed), the
  // retry finds the mark and stops instead of paying for a second run; the
  // claim then goes stale and shows as failed, with Try again.
  if (claim.attempted) return { status: 200, error: 'This run was already attempted' };
  const { written: marked } = await updateDesignRecord(db, project.id, 'kit', (current) => (
    isSameKitClaim(current?.[key], startedAt) && !current[key].attempted
      ? { ...(isObject(current) ? current : {}), [key]: { ...current[key], attempted: true } }
      : undefined
  ));
  if (!marked) return { status: 200, error: 'This run was already attempted or replaced' };

  const entry = kitSkill(key);
  const spec = specs[key];
  let skill = null;
  let next;
  let result = null;
  let stored = { files: [], warnings: [] };
  try {
    skill = givenSkill !== undefined ? givenSkill : (kitConfigured(key, env, specs) ? spec.skill(env) : null);
    if (!spec || spec.stub || !skill?.skill_id) throw new Error(kitNotSetUpMessage(key, env, specs) || `${entry.label} isn't set up yet`);
    // Counted from the claim: the time Netlify took to start this is spent.
    const deadline = Date.parse(claim.startedAt) + KIT_BUDGET_MS;
    const site = await loadSite(db, project);
    result = await buildKitRun({ db, client, project, site, key, spec, skill, deadline, nowMs, fetchImpl });
    stored = await storeKitFiles(db, project.id, key, result.outputs, nowMs());
    next = sanitizeKitRun({
      status: 'ready',
      startedAt: claim.startedAt,
      finishedAt: now(),
      model: result.model,
      skillVersion: skill.version,
      files: stored.files,
      data: result.data,
      usage: result.usage,
      notes: result.notes,
      warnings: [...result.warnings, ...stored.warnings, ...skippedLines(result.skipped)],
      error: null,
    }, { projectId: project.id, key });
  } catch (err) {
    console.error(`${TAG} ${key} failed:`, err?.message || err);
    next = failedKitRun({
      startedAt: claim.startedAt, finishedAt: now(), error: err?.message, model: err?.model, usage: err?.usage, skillVersion: skill?.version,
    });
  }

  // Stored only while the claim is still this run's: a newer run (after
  // this one went stale) or a release owns the slot otherwise. Other kit
  // runs finishing at the same moment write the same column, so a write
  // that kept missing gets one more round before the run gives up.
  const ours = stored.files.map((f) => f.path);
  let written = false;
  for (let round = 0; round < 2; round += 1) {
    try {
      ({ written } = await updateDesignRecord(db, project.id, 'kit', (current) => (
        isSameKitClaim(current?.[key], startedAt) ? { ...(isObject(current) ? current : {}), [key]: next } : undefined
      )));
      break;
    } catch (err) {
      if (round) {
        // The record still says "running"; `get` shows it as failed once it
        // goes stale. Files nothing points at don't stay behind.
        console.error(`${TAG} ${key} result not saved:`, err?.message || err);
        if (ours.length) await db.storage.from(ASSET_BUCKET).remove(ours).catch(() => {});
        return { status: 500, error: 'The result could not be saved' };
      }
    }
  }
  if (!written) {
    if (ours.length) await db.storage.from(ASSET_BUCKET).remove(ours).catch(() => {});
    // `ran`: this run did start (and may have spent), so the handler still
    // answers 200 and Netlify doesn't retry it.
    return { status: 409, error: 'The run was replaced', ran: true };
  }
  // Earlier results of this key are unreferenced now, whichever way this
  // run ended (the claim already replaced them in the record).
  await removeOldKitFiles(db, project.id, key, ours, nowMs());

  if (next.status === 'ready') {
    await logEvent(db, project.id, 'kit_ready', {
      skill: key, label: entry.label, model: next.model, turns: result.turns, inputs: result.files,
      files: next.files.length, warnings: next.warnings.length, ...next.usage,
    }, actor);
    return { status: 200 };
  }
  await logEvent(db, project.id, 'kit_failed', { skill: key, label: entry.label, error: next.error.slice(0, 200), ...next.usage }, actor);
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
  // Without a built, configured skill the run fails fast (runKit) and needs
  // no client. The model requests are bounded by the run's deadline
  // (runSkillRequest); this timeout only covers the Files API calls.
  const client = kitConfigured(body.skill) ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 2 * 60 * 1000 }) : null;
  // Netlify retries a background function that fails (an error or a 5xx),
  // which would pay for the model run again. The run records its own
  // outcome on the project, so once it has started, always answer 200.
  try {
    const result = await runKit({ db, client, projectId: body.id, key: body.skill, startedAt: body.startedAt, actor: auth.actor });
    // A 4xx only when nothing ran (no such project, no matching claim).
    return { statusCode: result.status >= 500 || result.ran ? 200 : result.status };
  } catch (err) {
    console.error(`${TAG} run crashed:`, err?.message || err);
    return { statusCode: 200 };
  }
};
