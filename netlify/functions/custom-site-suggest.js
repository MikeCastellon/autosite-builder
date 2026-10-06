// POST /.netlify/functions/custom-site-suggest
//
// Admin > Custom websites > Design: "Suggest a design" (Claude proposes the
// look from the customer's images and intake; src/lib/designSuggest.js).
// Super admins only. The proposal lives in custom_site_projects.design
// .suggestion and is never applied here: the admin reviews it on the page
// and saves the parts they take with custom-site-admin `design-save`.
//   start   { id, invoke?, reference?, palette?, useBrand? }
//                            → claims a run (design.suggestion = { status:
//                              'running', startedAt }) and starts
//                              custom-site-suggest-background with the
//                              caller's sign-in. 409 while another run is
//                              live. invoke: false only claims, for a
//                              browser that starts the background itself.
//                              reference is the page's choice ({ mode,
//                              source }, design.reference): 'match' is
//                              checked against the project here (its own
//                              reference uploads, an http(s) address, a
//                              screenshot Claude can view; 400 otherwise,
//                              nothing claimed) and goes into the claim
//                              with palette (the Studio's current colors)
//                              as studioPalette and useBrand (the page's
//                              "Use their brand color" toggle, maybe not
//                              saved yet; true or false only, 400
//                              otherwise; absent = the saved setting).
//                              'inspire' runs as before.
//   get     { id }           → { suggestion } (null before the first run); a
//                              run that died shows as failed, with a retry
//   release { id, startedAt, error } → gives up a claimed run that could not
//                              be started
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { failedSuggestion, isSameSuggestRun, updateSuggestion } from './_lib/custom-site-suggest-ai.js';
import { checkReferenceChoice, isSuggestRunLive, isSuggestRunStale, studioPaletteOf } from '../../src/lib/designSuggest.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
const BACKGROUND_PATH = '/.netlify/functions/custom-site-suggest-background';
// Netlify answers a background function with 202 at once; anything slower
// than this means it isn't coming.
const START_TIMEOUT_MS = 10_000;

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-suggest] event ${type} not logged:`, error.message);
}

// The claim's "Match its layout" part, from a start request: null for an
// inspiration run (no reference, or mode 'inspire'), else { reference,
// studioPalette?, useBrand? }. Checked against the project as stored, so
// the browser can only point at this project's own uploads; a match
// without a screenshot is refused here, before anything is claimed or paid
// for. useBrand is kept only when the page sent one: the run then follows
// the toggle as the admin sees it, saved or not, and otherwise the saved
// design.useBrand (matchPalettePlan). Returns { status, error, problem }
// when the choice can't run.
async function matchClaim(db, body) {
  // Checked before anything else, for an inspiration run too: anything but
  // a boolean is a page bug, never a choice to guess at.
  if (body.useBrand !== undefined && body.useBrand !== null && typeof body.useBrand !== 'boolean') {
    return { status: 400, error: 'Unknown "Use their brand color" setting' };
  }
  if (body.reference === undefined || body.reference === null) return { claim: null };
  if (typeof body.id !== 'string' || !body.id) return { status: 404, error: 'Project not found' };
  const { data: project, error } = await db.from(TABLE).select('id, assets, form, design').eq('id', body.id).maybeSingle();
  if (error) return { status: 500, error: 'Could not load the project' };
  if (!project) return { status: 404, error: 'Project not found' };
  const check = checkReferenceChoice(body.reference, project);
  if (check.error) return { status: 400, error: check.error, problem: check.problem };
  if (check.reference.mode !== 'match') return { claim: null };
  const studioPalette = studioPaletteOf(body.palette);
  return {
    claim: {
      reference: check.reference,
      ...(Object.keys(studioPalette).length ? { studioPalette } : {}),
      ...(typeof body.useBrand === 'boolean' ? { useBrand: body.useBrand } : {}),
    },
  };
}

// The log's mark for a claimed run that was a match, so its failure reads
// "Layout match failed" like its start and ready lines.
const modeOf = (suggestion) => (suggestion?.reference?.mode === 'match' ? { mode: 'match' } : {});

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
        const match = await matchClaim(db, body);
        if (match.status) return reply(match.status, { error: match.error, ...(match.problem ? { problem: match.problem } : {}) });
        const startedAt = new Date().toISOString();
        const { project, suggestion, written } = await updateSuggestion(db, body.id, (current) => (
          isSuggestRunLive(current) ? undefined : { status: 'running', startedAt, ...(match.claim || {}) }
        ));
        if (!project) return reply(404, { error: 'Project not found' });
        if (!written) return reply(409, { error: 'A design is already being suggested', suggestion });
        const mode = modeOf(suggestion);
        await logEvent(db, project.id, 'design_suggest_started', mode, actor);
        if (body.invoke === false) return reply(200, { suggestion, startedAt });

        const startError = await startBackground(event, { id: project.id, startedAt });
        if (startError) {
          const message = `Couldn't start the suggestion: ${startError}`;
          await updateSuggestion(db, project.id, (current) => (
            isSameSuggestRun(current, startedAt) ? failedSuggestion({ startedAt, error: message }) : undefined
          ));
          await logEvent(db, project.id, 'design_suggest_failed', { error: message.slice(0, 200), ...mode }, actor);
          return reply(502, { error: message });
        }
        return reply(200, { suggestion, startedAt });
      }

      case 'get': {
        // A run that died (timeout, lost request) shows as failed.
        let mode = {};
        const { project, suggestion, written } = await updateSuggestion(db, body.id, (current) => {
          if (!isSuggestRunStale(current)) return undefined;
          mode = modeOf(current);
          return failedSuggestion({ startedAt: current.startedAt, error: 'The suggestion didn\'t finish (it may have timed out). Try again.' });
        });
        if (!project) return reply(404, { error: 'Project not found' });
        if (written) await logEvent(db, project.id, 'design_suggest_failed', { error: 'timed out', ...mode }, 'system');
        return reply(200, { suggestion });
      }

      case 'release': {
        const message = `Couldn't start the suggestion: ${clean(body.error, 200) || 'unknown error'}`;
        let mode = {};
        const { project, written } = await updateSuggestion(db, body.id, (current) => {
          if (!isSameSuggestRun(current, body.startedAt)) return undefined;
          mode = modeOf(current);
          return failedSuggestion({ startedAt: current.startedAt, error: message });
        });
        if (!project) return reply(404, { error: 'Project not found' });
        if (written) await logEvent(db, project.id, 'design_suggest_failed', { error: message.slice(0, 200), ...mode }, actor);
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[custom-site-suggest] failed:', e?.message || e);
    return reply(e.status || 500, { error: e.status ? e.message : 'Something went wrong' });
  }
};
