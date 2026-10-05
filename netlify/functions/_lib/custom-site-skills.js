import { toFile } from '@anthropic-ai/sdk';
import { DESIGN_EFFORT, DESIGN_MODEL } from '../../../src/lib/customSiteDesign.js';

// Claude Agent Skills for custom websites: one request that runs one of our
// custom skills (uploaded once with POST /v1/skills; the functions only
// read its id and version from the environment) in a code execution
// container, with the customer's files uploaded into it, and the files the
// skill writes to $OUTPUT_DIR coming back as Files API ids. Also the
// read-modify-write that stores a run in custom_site_projects.design.
//
// `client` is an Anthropic SDK client and `db` the service-role Supabase
// client, both injected so tests can stand in for them.
//
// Data handling: inputs and outputs pass through the Files API and the
// container, which Anthropic keeps for up to 30 days (code execution is not
// eligible for zero data retention). The files we upload expire after an
// hour and are deleted when the run ends; outputs are deleted once
// downloaded (deleteFiles).

export const SKILL_MODEL = DESIGN_MODEL;
export const SKILL_EFFORT = DESIGN_EFFORT;
// The newest code execution version (GA, no beta header). Skills run on it.
export const CODE_EXECUTION_TOOL = Object.freeze({ type: 'code_execution_20260521', name: 'code_execution' });
// A long turn comes back as stop_reason 'pause_turn' and is resent to the
// same container; this caps the requests one run may make.
export const MAX_SKILL_TURNS = 8;
// Streamed, so a long turn never trips an HTTP timeout; room for the code
// the model writes as tool input.
export const SKILL_MAX_TOKENS = 32000;
// Below this much time left a new turn isn't worth starting.
const MIN_TURN_MS = 45 * 1000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
// Inputs only need to live through the run; deleteFiles removes them at the
// end, the expiry covers a run that dies first.
const INPUT_TTL_S = 3600;

// ─── Configuration ───────────────────────────────────────────────────

const SKILL_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

// { type: 'custom', skill_id, version } from the environment, or null when
// the skill id isn't set (the feature then says it isn't set up). Without a
// version the latest one runs; the owner pins one after each release.
export function skillFromEnv(id, version) {
  const skillId = String(id || '').trim();
  if (!SKILL_ID_RE.test(skillId)) return null;
  const v = String(version || '').trim();
  return { type: 'custom', skill_id: skillId, version: SKILL_ID_RE.test(v) ? v : 'latest' };
}

// The launch-brand-system skill (custom-site-brand*).
export function brandSkill(env = process.env) {
  return skillFromEnv(env.CUSTOM_SITE_BRAND_SKILL_ID, env.CUSTOM_SITE_BRAND_SKILL_VERSION);
}

export const BRAND_SKILL_NOT_SET_UP = 'Brand skill isn\'t set up yet';

// ─── Files ───────────────────────────────────────────────────────────

// Downloads a Files API file as a Buffer. `maxBytes` refuses anything
// bigger (the size the Files API reports first, then the bytes).
export async function downloadFile(client, fileId, { maxBytes = Infinity, size } = {}) {
  if (Number(size) > maxBytes) throw new Error(`The file is too large (${size} bytes)`);
  const res = await client.files.download(fileId);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`The file is too large (${buf.length} bytes)`);
  return buf;
}

// Deletes Files API files, best effort: a file that can't be deleted
// expires or stays with the account, and the run's result doesn't depend
// on it.
export async function deleteFiles(client, fileIds) {
  const ids = [...new Set((fileIds || []).filter(Boolean))];
  const results = await Promise.allSettled(ids.map((id) => client.files.delete(id)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn('[custom-site-skills] file not deleted:', ids[i], r.reason?.message || r.reason);
  });
}

// File ids the code execution results in `content` carry: what a command
// left at the top level of $OUTPUT_DIR. (container_upload blocks name our
// own inputs and are not outputs.)
export function outputFileIds(content) {
  const ids = [];
  for (const block of Array.isArray(content) ? content : []) {
    if (!/code_execution_tool_result$/.test(String(block?.type || ''))) continue;
    const result = block.content;
    if (!result || typeof result !== 'object' || !Array.isArray(result.content)) continue;
    for (const out of result.content) {
      if (out && typeof out.file_id === 'string' && /_output$/.test(String(out.type || ''))) ids.push(out.file_id);
    }
  }
  return ids;
}

// ─── The request ─────────────────────────────────────────────────────

// Every input token counts toward what the run cost, cached or not.
function addUsage(total, usage) {
  if (!usage) return total;
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    input_tokens: total.input_tokens + n(usage.input_tokens) + n(usage.cache_creation_input_tokens) + n(usage.cache_read_input_tokens),
    output_tokens: total.output_tokens + n(usage.output_tokens),
  };
}

const runError = (message, extra) => Object.assign(new Error(message), extra);

// The first request's content: for each file, a label, the container upload
// and (for images Claude can view) the same file as an image, then the
// instructions.
function firstContent(uploaded, userText) {
  const content = [];
  for (const f of uploaded) {
    content.push({ type: 'text', text: `${f.name}:` });
    content.push({ type: 'container_upload', file_id: f.file_id });
    if (f.vision !== false && /^image\/(png|jpeg|gif|webp)$/.test(f.mediaType)) {
      content.push({ type: 'image', source: { type: 'file', file_id: f.file_id } });
    }
  }
  content.push({ type: 'text', text: userText });
  return content;
}

// Runs a custom skill once.
//   skill     { skill_id, version } (type 'custom' is added)
//   files     [{ name, mediaType, data: Buffer, vision? }]: uploaded to the
//             Files API, put in the container and, when they are images,
//             shown to Claude too
//   deadline  epoch ms by which the run must be done: no turn starts with
//             less than MIN_TURN_MS left, and a turn still running then is
//             cut off
// Returns { outputs: [{ file_id, filename, size_bytes }], message (the last
// response), usage: { input_tokens, output_tokens }, stopReason, turns,
// containerId, timedOut, model }. Throws on a refusal (code 'refusal') and
// when a request fails, after deleting the inputs and anything earlier
// turns wrote; a later turn cut off by the deadline ends the run with what
// it has (timedOut). The server-side refusal fallback is
// on; if the API rejects the request shape (400), the first request is
// retried once without the optional parts (fallback, prompt caching).
export async function runSkillRequest({
  client, skill, system, userText, files = [], maxTurns = MAX_SKILL_TURNS, deadline = null,
  model = SKILL_MODEL, effort = SKILL_EFFORT, maxTokens = SKILL_MAX_TOKENS, now = () => Date.now(),
}) {
  if (!skill?.skill_id) throw runError('No skill to run', { code: 'not_configured' });
  // Checked before anything is uploaded too: a run started (or retried)
  // after its deadline sends nothing anywhere.
  if (deadline && deadline - now() < MIN_TURN_MS) throw runError('There was no time left to start the run', { code: 'timeout' });
  const skills = [{ type: 'custom', skill_id: skill.skill_id, version: skill.version || 'latest' }];
  const uploaded = [];
  // What earlier turns wrote. Returned to the caller (who deletes them once
  // read); deleted here when the run throws, so a failed run leaves none of
  // the customer's derived files in the Files API.
  const outputIds = [];
  let finished = false;
  try {
    for (const f of files) {
      const meta = await client.files.upload({
        file: await toFile(f.data, f.name, { type: f.mediaType }),
        expires_in_seconds: INPUT_TTL_S,
      });
      uploaded.push({ ...f, file_id: meta.id });
    }

    const messages = [{ role: 'user', content: firstContent(uploaded, userText) }];
    let usage = { input_tokens: 0, output_tokens: 0 };
    let optional = true;
    let containerId = null;
    let message = null;
    let turns = 0;
    let timedOut = false;

    while (turns < maxTurns) {
      const left = deadline ? deadline - now() : Infinity;
      if (left < MIN_TURN_MS) {
        if (!turns) throw runError('There was no time left to start the run', { code: 'timeout' });
        timedOut = true;
        break;
      }
      const body = {
        model,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [CODE_EXECUTION_TOOL],
        container: containerId ? { id: containerId, skills } : { skills },
        output_config: { effort },
      };
      const send = (withOptional) => {
        const options = { maxRetries: turns ? 1 : 2 };
        if (Number.isFinite(left)) {
          options.timeout = left;
          options.signal = AbortSignal.timeout(left);
        }
        if (withOptional) options.headers = { 'anthropic-beta': FALLBACK_BETA };
        const params = withOptional ? { ...body, cache_control: { type: 'ephemeral' }, fallbacks: 'default' } : body;
        return client.messages.stream(params, options).finalMessage();
      };
      try {
        message = await send(optional);
      } catch (err) {
        if (!turns && optional && err?.status === 400) {
          console.warn('[custom-site-skills] request rejected, retrying without fallback/caching:', err?.message);
          optional = false;
          message = await send(false);
        } else if (turns && deadline && now() >= deadline - 1000) {
          // Cut off by the deadline mid-turn: what earlier turns wrote stands.
          timedOut = true;
          break;
        } else {
          throw runError(err?.message || 'The request failed', { status: err?.status, usage, turns });
        }
      }
      turns += 1;
      usage = addUsage(usage, message?.usage);
      containerId = message?.container?.id || containerId;
      outputIds.push(...outputFileIds(message?.content));
      if (message?.stop_reason === 'refusal') {
        throw runError('Claude declined to run the skill on these inputs. Check the uploads and answers for anything unusual and try again.', { code: 'refusal', usage, turns, model: message?.model });
      }
      if (message?.stop_reason !== 'pause_turn') break;
      // A paused turn goes back as it came, and the same container picks up
      // where it stopped.
      messages.push({ role: 'assistant', content: message.content });
    }

    const outputs = [];
    for (const id of [...new Set(outputIds)]) {
      try {
        const meta = await client.files.retrieveMetadata(id);
        outputs.push({ file_id: id, filename: String(meta?.filename || ''), size_bytes: Number(meta?.size_bytes) || null });
      } catch (err) {
        console.warn('[custom-site-skills] output metadata failed:', id, err?.message || err);
        outputs.push({ file_id: id, filename: '', size_bytes: null });
      }
    }
    finished = true;
    return {
      outputs, message, usage, turns, containerId, timedOut,
      stopReason: message?.stop_reason || null,
      model: message?.model || model,
    };
  } finally {
    await deleteFiles(client, [...uploaded.map((f) => f.file_id), ...(finished ? [] : outputIds)]);
  }
}

// The output named `filename` (case and -/_ ignored); the last one wins when
// a run wrote it more than once.
export function pickOutput(outputs, filename) {
  const key = (s) => String(s || '').split('/').pop().toLowerCase().replace(/-/g, '_');
  return [...(outputs || [])].reverse().find((o) => key(o.filename) === key(filename)) || null;
}

// ─── Storage (custom_site_projects.design) ───────────────────────────

const TABLE = 'custom_site_projects';

// Read-modify-write of design[key] that keeps every other design key.
// `next(current, project)` returns the value to store, or undefined to
// leave the row as it is. design is one jsonb column other actions write
// too, so the write only lands while the row is still the one read
// (updated_at moves on every write, via the trigger); otherwise it reads
// again and asks `next` again. Returns { project, record, written }
// (project null when there is no such project).
export async function updateDesignRecord(db, projectId, key, next) {
  if (typeof projectId !== 'string' || !projectId) return { project: null, record: null, written: false };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: project, error } = await db.from(TABLE).select('id, design, updated_at').eq('id', projectId).maybeSingle();
    if (error) throw Object.assign(new Error('Could not load the project'), { status: 500 });
    if (!project) return { project: null, record: null, written: false };
    const design = project.design && typeof project.design === 'object' && !Array.isArray(project.design) ? project.design : {};
    const current = design[key] ?? null;
    const record = next(current, project);
    if (record === undefined) return { project, record: current, written: false };
    let q = db.from(TABLE).update({ design: { ...design, [key]: record } }).eq('id', projectId);
    if (project.updated_at) q = q.eq('updated_at', project.updated_at);
    const { data, error: writeError } = await q.select('id').maybeSingle();
    if (writeError) throw Object.assign(new Error('Could not save the project'), { status: 500 });
    if (data) return { project, record, written: true };
  }
  throw Object.assign(new Error('The project kept changing while saving. Try again.'), { status: 409 });
}
