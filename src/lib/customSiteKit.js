// The Launch Kit in the admin (Admin > Custom websites > a project >
// "Launch kit", LaunchKitPanel.jsx): the browser's side of
// netlify/functions/custom-site-kit plus the pure helpers the panel renders
// with (customSiteKit.test.js). The registry, the run record and the
// stale/needs rules are src/lib/launchKit.js's; these helpers read through
// it so the panel can't disagree with what the server stored.
//
// What custom-site-kit answers (POST, super-admin sign-in):
//   start { id, skill } → { run, skill, startedAt, configured: true };
//                         409 { error, run } while that skill runs, 409
//                         { error, code: 'needs', needs } when something it
//                         needs is missing; 503 { configured: false, code:
//                         'not_configured', error } when the skill isn't
//                         built or set up (nothing claimed or spent)
//   get   { id, links? } → { kit: { [skill]: run }, urls: { [skill]: { [file
//                         name]: signed link } }, configured: { [skill]:
//                         bool }, notSetUp: { [skill]: message } }; with
//                         links: false (polls) no `urls`
import { supabase } from './supabase.js';
import {
  KIT_KEYS, isKitKey, isKitRunStale, kitMissingNeeds, kitOf, kitRunState, kitSkill, sanitizeKitRun,
} from './launchKit.js';

export { elapsedLabel, modelLabel, usageLabel } from './customSiteBrand.js';

export const KIT_FN = '/.netlify/functions/custom-site-kit';
// How often the panel asks while a run is going.
export const KIT_POLL_MS = 5000;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Server text on one line, capped: errors and notes come from the model.
function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// ─── Server calls ─────────────────────────────────────────────────────

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Did the server say a skill isn't built or set up? A state to show, not
// an error to retry.
export function isNotSetUp(data) {
  return isObject(data) && (data.configured === false || data.code === 'not_configured');
}

// A file link, only when it is a web address an <img> or <a> may load (a
// signed storage URL; plain http only for a local Supabase).
export function safeFileUrl(url) {
  const s = typeof url === 'string' ? url.trim() : '';
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s"'<>]*$/i.test(s)) return s;
  return '';
}

function cleanUrls(raw) {
  const out = {};
  for (const key of KIT_KEYS) {
    const map = isObject(raw?.[key]) ? raw[key] : {};
    const clean = {};
    for (const [name, url] of Object.entries(map)) {
      const safe = safeFileUrl(url);
      if (safe && typeof name === 'string' && name.length <= 80) clean[name] = safe;
    }
    if (Object.keys(clean).length) out[key] = clean;
  }
  return out;
}

// One answer from custom-site-kit, as the panel uses it:
//   { kit, urls, configured, notSetUp, skill, run, alreadyRunning, needs,
//     message }
// `kit` maps skills to records; a start's run (or the startedAt it sent
// back) counts as that skill's running record, so the tile starts polling
// at once. `configured` / `notSetUp` are null when the answer didn't say.
export function kitResponse(data, { status = 200, skill = null } = {}) {
  const d = isObject(data) ? data : {};
  const key = isKitKey(d.skill) ? d.skill : (isKitKey(skill) ? skill : null);
  const kit = {};
  for (const k of KIT_KEYS) {
    const run = sanitizeKitRun(d.kit?.[k]);
    if (run) kit[k] = run;
  }
  let run = sanitizeKitRun(d.run);
  if (!run && key && status < 300 && typeof d.startedAt === 'string' && d.startedAt) run = sanitizeKitRun({ status: 'running', startedAt: d.startedAt });
  if (run && key && (status < 300 || status === 409)) kit[key] = run;

  let configured = null;
  let notSetUp = null;
  if (isObject(d.configured)) {
    configured = Object.fromEntries(KIT_KEYS.map((k) => [k, d.configured[k] === true]));
    notSetUp = Object.fromEntries(KIT_KEYS.filter((k) => !configured[k]).map((k) => [k, oneLine(d.notSetUp?.[k], 300)]));
  } else if (key && isNotSetUp(d)) {
    configured = { [key]: false };
    notSetUp = { [key]: oneLine(d.error, 300) };
  }
  const needs = (Array.isArray(d.needs) ? d.needs : [])
    .map((n) => ({ id: oneLine(n?.id, 40), label: oneLine(n?.label, 80) })).filter((n) => n.label);
  return {
    kit,
    urls: cleanUrls(d.urls),
    configured,
    notSetUp,
    skill: key,
    run: key ? kit[key] || null : null,
    alreadyRunning: status === 409 && !needs.length,
    needs,
    message: oneLine(d.error, 300),
  };
}

async function call(action, projectId, extra = {}) {
  if (typeof projectId !== 'string' || !projectId) throw new Error('No project');
  const headers = await authHeaders();
  let res;
  try {
    res = await fetch(KIT_FN, { method: 'POST', headers, body: JSON.stringify({ action, id: projectId, ...extra }) });
  } catch {
    throw Object.assign(new Error('Can\'t reach the server. Check your connection and try again.'), { offline: true });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  // "Not set up", "already running" and "needs X first" are answers, not failures.
  if (res.ok || res.status === 409 || isNotSetUp(data)) return kitResponse(data, { status: res.status, skill: extra.skill });
  throw Object.assign(new Error(oneLine(data?.error, 300) || `Request failed (${res.status})`), { status: res.status, data });
}

// Claims a run of `key` and starts it on the server. Resolves to kitResponse().
export function startKitRun(projectId, key) {
  if (!isKitKey(key)) return Promise.reject(new Error('Unknown launch kit item'));
  return call('start', projectId, { skill: key });
}

// The admin's sign-off on the claims check they read (the run's
// startedAt). Resolves to { run }.
export function signOffClaims(projectId, startedAt, signedOff) {
  return call('sign-off', projectId, { skill: 'claims', startedAt, signedOff: signedOff === true });
}

// Every run (runs that died show as failed), fresh signed links to the
// ready runs' files and which skills are set up. Resolves to kitResponse().
// links: false skips the links (the panel's polls: the links it has stay
// valid, and fresh ones would reload every thumbnail).
export function getKit(projectId, { links = true } = {}) {
  return call('get', projectId, links ? {} : { links: false });
}

// The ready runs, as ids ("mobile@<startedAt>"): the panel signs links
// again when a poll shows one it has no links for, e.g. a run that just
// finished.
export function kitReadyRuns(kit, nowMs = Date.now()) {
  return KIT_KEYS
    .filter((k) => kitRunState(isObject(kit) ? kit[k] : null, nowMs) === 'ready')
    .map((k) => `${k}@${kit[k].startedAt || ''}`);
}

// ─── Runs ─────────────────────────────────────────────────────────────

function startedMs(run) {
  const ms = Date.parse(run?.startedAt || '');
  return Number.isFinite(ms) ? ms : NaN;
}

const FINISHED = { ready: 2, failed: 2, running: 1 };

// The newer of two records of one skill: the project the page loaded and
// the one the panel fetched since. A later start wins; for the same run, a
// finished record beats the "running" one it replaced.
export function newerKitRun(a, b) {
  const x = isObject(a) && typeof a.status === 'string' ? a : null;
  const y = isObject(b) && typeof b.status === 'string' ? b : null;
  if (!x || !y) return x || y;
  const tx = startedMs(x);
  const ty = startedMs(y);
  if (Number.isFinite(tx) && Number.isFinite(ty) && tx !== ty) return ty > tx ? y : x;
  if (Number.isFinite(tx) !== Number.isFinite(ty)) return Number.isFinite(ty) ? y : x;
  return (FINISHED[y.status] || 0) > (FINISHED[x.status] || 0) ? y : x;
}

// The page's design.kit and the panel's fetched records, newest per skill.
export function mergeKit(...kits) {
  const out = {};
  for (const key of KIT_KEYS) {
    let run = null;
    for (const kit of kits) run = newerKitRun(run, isObject(kit) ? kit[key] : null);
    if (run) out[key] = run;
  }
  return out;
}

// The project as the needs check reads it, with the panel's newer runs.
export function projectWithKit(project, kit) {
  const design = isObject(project?.design) ? project.design : {};
  return { ...(project || {}), design: { ...design, kit: mergeKit(kitOf(project), kit) } };
}

// What one tile shows and allows:
//   { state: idle | running | stale | ready | failed, configured, notSetUp,
//     needs: [{ id, label }], canBuild, buildLabel }
// `configured` null means the server hasn't said yet (Build waits for it).
export function kitTile(key, { run, project, configured = null, notSetUp = '', starting = false, nowMs = Date.now() } = {}) {
  const state = kitRunState(run, nowMs);
  const needs = kitMissingNeeds(key, project, nowMs);
  const canBuild = configured === true && !starting && state !== 'running' && needs.length === 0;
  let buildLabel = 'Build';
  if (starting) buildLabel = 'Starting…';
  else if (state === 'failed' || state === 'stale') buildLabel = 'Try again';
  else if (state === 'ready') buildLabel = 'Rebuild';
  return { state, configured, notSetUp: configured === false ? oneLine(notSetUp, 300) : '', needs, canBuild, buildLabel };
}

// The confirm dialog before a run: it costs money, and a rebuild replaces
// the current result. The claim takes the record's place on the server, so
// the current result is gone from the moment the run starts, also when the
// new run then fails: the dialog says so.
export function kitBuildConfirm(key, state) {
  const s = kitSkill(key);
  if (!s) return null;
  const cost = s.estimate ? ` (${s.estimate})` : '';
  if (state === 'ready') {
    return {
      title: `Rebuild ${s.label}?`,
      message: `Claude runs the ${s.label} skill again and its new result replaces the one shown here, files included: the current one goes away as soon as the run starts, even if the new run fails. It takes a few minutes and uses AI credits${cost}.`,
      confirmText: 'Rebuild',
    };
  }
  return {
    title: `Build ${s.label}?`,
    message: `Claude runs the ${s.label} skill on this customer's answers, files and site. It takes a few minutes, you can leave the page, and it uses AI credits${cost}.`,
    confirmText: 'Build',
  };
}

// The error to show for a failed run.
export function kitRunError(run, nowMs = Date.now()) {
  if (isKitRunStale(run, nowMs)) return 'The run stopped answering (it may have timed out).';
  if (run?.status === 'ready' && !isObject(run.data)) return 'The run came back without a usable result.';
  return oneLine(run?.error, 500) || 'Something went wrong.';
}

// ─── Files ────────────────────────────────────────────────────────────

// "12 KB", "3.4 MB", '' for nothing.
export function formatFileSize(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const KINDS = [
  ['image', /^image\//],
  ['pdf', /^application\/pdf$/],
  ['zip', /^application\/zip$/],
  ['vcard', /^text\/vcard$/],
  ['json', /^application\/json$/],
];

// A ready run's stored files as the panel lists them, in the skill's own
// order: [{ name, label, type, kind ('image' | 'pdf' | 'zip' | 'vcard' |
// 'json' | 'file'), size, sizeLabel, url ('' until the server signed one),
// px }]. Without `key`, the files as stored with their names as labels.
export function kitFiles(key, run, urls = {}) {
  const s = kitSkill(key);
  const files = Array.isArray(run?.files) ? run.files.filter((f) => isObject(f) && typeof f.name === 'string') : [];
  const order = s ? s.outputs.map((o) => o.name) : files.map((f) => f.name);
  return files
    .filter((f) => order.includes(f.name))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    .map((f) => {
      const output = s?.outputs.find((o) => o.name === f.name);
      const type = oneLine(f.type, 100) || output?.type || '';
      const size = Number(f.size);
      return {
        name: f.name,
        label: output?.label || f.name,
        type,
        kind: (KINDS.find(([, re]) => re.test(type)) || ['file'])[0],
        size: Number.isFinite(size) ? size : 0,
        sizeLabel: formatFileSize(size),
        url: safeFileUrl(urls?.[f.name]),
        px: output?.px || null,
      };
    });
}

// Notes from the skill and warnings from the server, as lines.
export function kitRunNotes(run) {
  const lines = (list, max) => (Array.isArray(list) ? list : []).map((n) => oneLine(n, 300)).filter(Boolean).slice(0, max);
  return { notes: lines(run?.notes, 8), warnings: lines(run?.warnings, 10) };
}
