// POST /.netlify/functions/custom-site-kit
//
// Admin > Custom websites > a project > "Launch kit": the Claude Agent
// Skills that make the paid deliverables (src/lib/launchKit.js KIT_SKILLS).
// Super admins only. Each skill's run and result live in
// custom_site_projects.design.kit[skill]; custom-site-kit-background runs
// it. Nothing here touches the site.
//   start   { id, skill, invoke? } → claims a run (design.kit[skill] =
//                              { status: 'running', startedAt }) and starts
//                              custom-site-kit-background with the caller's
//                              sign-in: { run, skill, startedAt, configured }.
//                              409 { error, run } while that skill's run is
//                              live; 409 { error, code: 'needs', needs } when
//                              something it needs isn't there yet (needs:
//                              [{ id, label }]). invoke: false only claims,
//                              for a browser that starts the background
//                              itself.
//   get     { id, links? }      → { kit: { [skill]: run }, urls: { [skill]:
//                              { [file name]: 10-minute signed link } },
//                              configured: { [skill]: bool }, notSetUp:
//                              { [skill]: message } }; a run that died shows
//                              as failed, with a retry. links: false (the
//                              panel's polls) leaves `urls` out: signing every
//                              file every few seconds costs a storage request
//                              each, and new tokens would make every
//                              thumbnail on the page download again
//   release { id, skill, startedAt, error } → gives up a claimed run that
//                              could not be started
// A skill that isn't built yet or has no <PREFIX>_SKILL_ID makes start
// answer 503 { configured: false, code: 'not_configured', error, skill }
// before anything is claimed or spent.
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { updateDesignRecord } from './_lib/custom-site-skills.js';
import { KIT_SPECS, kitConfigured, kitNotSetUpMessage } from './_lib/kit/index.js';
import { ASSET_BUCKET } from '../../src/lib/customSiteForm.js';
import {
  KIT_KEYS, failedKitRun, isKitKey, isKitRunLive, isKitRunStale, isSameKitClaim, kitMissingNeeds, kitSkill,
  parseKitFilePath, sanitizeKitRun,
} from '../../src/lib/launchKit.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const TAG = '[custom-site-kit]';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
const BACKGROUND_PATH = '/.netlify/functions/custom-site-kit-background';
// Netlify answers a background function with 202 at once; anything slower
// than this means it isn't coming.
const START_TIMEOUT_MS = 10_000;
export const FILE_URL_SECONDS = 600;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`${TAG} event ${type} not logged:`, error.message);
}

// The deploy that took this request also serves the background function:
// its own address (rawUrl), so a preview deploy starts its own code.
function functionsOrigin(event) {
  try {
    if (event?.rawUrl) return new URL(event.rawUrl).origin;
  } catch { /* fall through */ }
  return (process.env.URL || APP_URL).replace(/\/$/, '');
}

// Starts the claimed run, signed in as the admin who asked (the background
// function checks the same super-admin sign-in). Returns null once Netlify
// accepted it, else what went wrong.
async function startBackground(event, payload) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  try {
    const res = await fetch(`${functionsOrigin(event)}${BACKGROUND_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(START_TIMEOUT_MS),
    });
    return res.ok ? null : `the background function answered ${res.status}`;
  } catch (e) {
    return e?.message || 'network error';
  }
}

const kitObject = (current) => (isObject(current) ? current : {});

// design.kit with `key` set to `run` (every other skill's record kept).
const withRun = (current, key, run) => ({ ...kitObject(current), [key]: run });

// Short-lived links to a ready run's files, by file name: only paths that
// are this project's kit files of that skill, never a customer upload.
// Images open inline; the rest download under their plain name.
async function fileUrls(db, projectId, key, run) {
  const urls = {};
  await Promise.all((Array.isArray(run?.files) ? run.files : []).map(async (f) => {
    const p = parseKitFilePath(projectId, f?.path);
    if (!p || p.key !== key || p.name !== f.name) return;
    const options = /^image\//.test(String(f.type || '')) ? undefined : { download: f.name };
    try {
      const { data, error } = await db.storage.from(ASSET_BUCKET).createSignedUrl(f.path, FILE_URL_SECONDS, options);
      if (error) throw new Error(error.message);
      if (data?.signedUrl) urls[f.name] = data.signedUrl;
    } catch (err) {
      console.error(`${TAG} file link failed:`, f.path, err?.message || err);
    }
  }));
  return urls;
}

function setup(env = process.env) {
  const configured = {};
  const notSetUp = {};
  for (const key of KIT_KEYS) {
    configured[key] = kitConfigured(key, env, KIT_SPECS);
    if (!configured[key]) notSetUp[key] = kitNotSetUpMessage(key, env, KIT_SPECS);
  }
  return { configured, notSetUp };
}

export const handler = async (event) => {
  const CORS = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(event.headers) };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const db = supabaseAdmin();
  let actor;
  try {
    ({ actor } = await requireSuperAdmin(event, db));
  } catch (e) {
    return reply(e.status || 401, { error: e.message || 'Not signed in' });
  }

  try {
    switch (body.action) {
      case 'start': {
        const key = body.skill;
        if (!isKitKey(key)) return reply(400, { error: 'Unknown launch kit item' });
        const entry = kitSkill(key);
        // Nothing to claim until the skill is built and set up.
        if (!kitConfigured(key)) {
          return reply(503, { configured: false, code: 'not_configured', error: kitNotSetUpMessage(key), skill: key });
        }
        // The site a run needs is a column, not part of design (which is
        // all the claim's read-modify-write loads).
        const projectRow = typeof body.id === 'string' && body.id
          ? (await db.from(TABLE).select('id, site_id, site_url').eq('id', body.id).maybeSingle()).data || null
          : null;
        const siteId = projectRow?.site_id || null;
        // The handover needs the site's live link.
        const publishedUrl = siteId
          ? (await db.from('sites').select('published_url').eq('id', siteId).maybeSingle()).data?.published_url || null
          : null;
        const startedAt = new Date().toISOString();
        const claim = { status: 'running', startedAt };
        let refusal = null;
        const { project, record, written } = await updateDesignRecord(db, body.id, 'kit', (current, row) => {
          refusal = null;
          const run = kitObject(current)[key];
          if (isKitRunLive(run)) {
            refusal = { status: 409, body: { error: `${entry.label} is already being built`, run: sanitizeKitRun(run, { projectId: row.id, key }), skill: key } };
            return undefined;
          }
          const needs = kitMissingNeeds(key, { ...row, site_id: siteId, site_url: projectRow?.site_url || null, site: { publishedUrl } });
          if (needs.length) {
            refusal = { status: 409, body: { error: `Build ${needs.map((n) => n.label).join(' and ')} first`, code: 'needs', needs, skill: key } };
            return undefined;
          }
          return withRun(current, key, claim);
        });
        if (!project) return reply(404, { error: 'Project not found' });
        if (!written) return reply(refusal?.status || 409, refusal?.body || { error: 'Could not start', run: kitObject(record)[key] || null });
        await logEvent(db, project.id, 'kit_started', { skill: key, label: entry.label }, actor);
        if (body.invoke === false) return reply(200, { run: claim, skill: key, startedAt, configured: true });

        const startError = await startBackground(event, { id: project.id, skill: key, startedAt });
        if (startError) {
          const message = `Couldn't start ${entry.label}: ${startError}`;
          await updateDesignRecord(db, project.id, 'kit', (current) => (
            isSameKitClaim(kitObject(current)[key], startedAt) ? withRun(current, key, failedKitRun({ startedAt, error: message })) : undefined
          ));
          await logEvent(db, project.id, 'kit_failed', { skill: key, label: entry.label, error: message.slice(0, 200) }, actor);
          return reply(502, { error: message, skill: key });
        }
        return reply(200, { run: claim, skill: key, startedAt, configured: true });
      }

      case 'get': {
        // Runs that died (timeout, lost request) show as failed.
        const died = [];
        const { project, record } = await updateDesignRecord(db, body.id, 'kit', (current) => {
          died.length = 0;
          const kit = kitObject(current);
          for (const key of KIT_KEYS) if (isKitRunStale(kit[key])) died.push(key);
          if (!died.length) return undefined;
          const next = { ...kit };
          for (const key of died) {
            next[key] = failedKitRun({
              startedAt: kit[key].startedAt,
              error: `${kitSkill(key).label} didn't finish (it may have timed out). Try again.`,
            });
          }
          return next;
        });
        if (!project) return reply(404, { error: 'Project not found' });
        for (const key of died) await logEvent(db, project.id, 'kit_failed', { skill: key, label: kitSkill(key).label, error: 'timed out' }, 'system');

        const links = body.links !== false;
        const kit = {};
        const urls = {};
        for (const key of KIT_KEYS) {
          const run = sanitizeKitRun(kitObject(record)[key], { projectId: project.id, key });
          if (run) kit[key] = run;
        }
        if (links) {
          await Promise.all(Object.keys(kit).filter((key) => kit[key].status === 'ready').map(async (key) => {
            urls[key] = await fileUrls(db, project.id, key, kit[key]);
          }));
        }
        return reply(200, { kit, ...(links ? { urls } : {}), ...setup() });
      }

      case 'sign-off': {
        // The admin's sign-off on the claims ledger, for the run they read
        // (startedAt). The handover reports it to the customer.
        const key = 'claims';
        const signedOff = body.signedOff === true;
        const { project, record, written } = await updateDesignRecord(db, body.id, 'kit', (current) => {
          const run = kitObject(current)[key];
          if (!run || run.status !== 'ready' || !isSameKitClaim(run, body.startedAt)) return undefined;
          return withRun(current, key, { ...run, signOff: signedOff ? { at: new Date().toISOString(), by: actor } : null });
        });
        if (!project) return reply(404, { error: 'Project not found' });
        if (!written) return reply(409, { error: 'The claims check changed; reload and check it again', run: sanitizeKitRun(kitObject(record)[key], { projectId: project.id, key }) });
        await logEvent(db, project.id, signedOff ? 'kit_signed_off' : 'kit_sign_off_cleared', { skill: key }, actor);
        return reply(200, { run: sanitizeKitRun(kitObject(record)[key], { projectId: project.id, key }) });
      }

      case 'release': {
        const key = body.skill;
        if (!isKitKey(key)) return reply(400, { error: 'Unknown launch kit item' });
        const entry = kitSkill(key);
        const message = `Couldn't start ${entry.label}: ${clean(body.error, 200) || 'unknown error'}`;
        const { project, written } = await updateDesignRecord(db, body.id, 'kit', (current) => {
          const run = kitObject(current)[key];
          return isSameKitClaim(run, body.startedAt) ? withRun(current, key, failedKitRun({ startedAt: run.startedAt, error: message })) : undefined;
        });
        if (!project) return reply(404, { error: 'Project not found' });
        if (written) await logEvent(db, project.id, 'kit_failed', { skill: key, label: entry.label, error: message.slice(0, 200) }, actor);
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error(`${TAG} failed:`, e?.message || e);
    return reply(e.status || 500, { error: e.status ? e.message : 'Something went wrong' });
  }
};
