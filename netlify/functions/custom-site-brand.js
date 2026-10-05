// POST /.netlify/functions/custom-site-brand
//
// Admin > Custom websites > Design setup: "Build brand system" (Claude runs
// the launch-brand-system skill over the customer's logo, brand files,
// inspiration images and style answers; src/lib/brandSpec.js). Super admins
// only. The run and its result live in custom_site_projects.design.brand and
// are never applied here: the admin applies a palette and the fonts to the
// Studio's levers and saves the setup as usual.
//   start   { id, invoke? }  → claims a run (design.brand = { status:
//                              'running', startedAt }) and starts
//                              custom-site-brand-background with the
//                              caller's sign-in: { brand, startedAt }. 409
//                              { error, brand } while another run is live.
//                              invoke: false only claims, for a browser
//                              that starts the background itself.
//   get     { id }           → { brand (null before the first run),
//                              boardUrl (a 10-minute signed link to the
//                              board, or null), configured }; a run that
//                              died shows as failed, with a retry
//   release { id, startedAt, error } → gives up a claimed run that could
//                              not be started
// While CUSTOM_SITE_BRAND_SKILL_ID is unset, start answers 503 and get
// answers 200, both with { configured: false, code: 'not_configured',
// error }: the page shows "not set up" instead of an error.
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { BRAND_SKILL_NOT_SET_UP, brandSkill, updateDesignRecord } from './_lib/custom-site-skills.js';
import { ASSET_BUCKET } from '../../src/lib/customSiteForm.js';
import {
  failedBrandRecord, isBrandBoardPath, isBrandClaimLive, isBrandClaimStale, isSameBrandClaim,
} from '../../src/lib/brandSpec.js';

const EVENTS = 'custom_site_project_events';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
const BACKGROUND_PATH = '/.netlify/functions/custom-site-brand-background';
// Netlify answers a background function with 202 at once; anything slower
// than this means it isn't coming.
const START_TIMEOUT_MS = 10_000;
const BOARD_URL_SECONDS = 600;

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-brand] event ${type} not logged:`, error.message);
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

// A short-lived link to the run's board (only a board path this project's
// runs write; never a customer upload).
async function boardUrl(db, projectId, record) {
  if (!isBrandBoardPath(projectId, record?.boardPath)) return null;
  const { data, error } = await db.storage.from(ASSET_BUCKET).createSignedUrl(record.boardPath, BOARD_URL_SECONDS);
  if (error) {
    console.error('[custom-site-brand] board link failed:', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

const NOT_SET_UP = { configured: false, code: 'not_configured', error: BRAND_SKILL_NOT_SET_UP };

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

  const configured = !!brandSkill();

  try {
    switch (body.action) {
      case 'start': {
        // Nothing to claim until the owner has set the skill up.
        if (!configured) return reply(503, NOT_SET_UP);
        const startedAt = new Date().toISOString();
        const { project, record, written } = await updateDesignRecord(db, body.id, 'brand', (current) => (
          isBrandClaimLive(current) ? undefined : { status: 'running', startedAt }
        ));
        if (!project) return reply(404, { error: 'Project not found' });
        if (!written) return reply(409, { error: 'A brand system is already being built', brand: record });
        await logEvent(db, project.id, 'brand_started', {}, actor);
        if (body.invoke === false) return reply(200, { brand: record, startedAt, configured });

        const startError = await startBackground(event, { id: project.id, startedAt });
        if (startError) {
          const message = `Couldn't start building the brand system: ${startError}`;
          await updateDesignRecord(db, project.id, 'brand', (current) => (
            isSameBrandClaim(current, startedAt) ? failedBrandRecord({ startedAt, error: message }) : undefined
          ));
          await logEvent(db, project.id, 'brand_failed', { error: message.slice(0, 200) }, actor);
          return reply(502, { error: message });
        }
        return reply(200, { brand: record, startedAt, configured });
      }

      case 'get': {
        // A run that died (timeout, lost request) shows as failed.
        const { project, record, written } = await updateDesignRecord(db, body.id, 'brand', (current) => (
          isBrandClaimStale(current)
            ? failedBrandRecord({ startedAt: current.startedAt, error: 'Building the brand system didn\'t finish (it may have timed out). Try again.' })
            : undefined
        ));
        if (!project) return reply(404, { error: 'Project not found' });
        if (written) await logEvent(db, project.id, 'brand_failed', { error: 'timed out' }, 'system');
        const url = record?.status === 'ready' ? await boardUrl(db, project.id, record) : null;
        return reply(200, { brand: record, boardUrl: url, ...(configured ? { configured } : NOT_SET_UP) });
      }

      case 'release': {
        const message = `Couldn't start building the brand system: ${clean(body.error, 200) || 'unknown error'}`;
        const { project, written } = await updateDesignRecord(db, body.id, 'brand', (current) => (
          isSameBrandClaim(current, body.startedAt) ? failedBrandRecord({ startedAt: current.startedAt, error: message }) : undefined
        ));
        if (!project) return reply(404, { error: 'Project not found' });
        if (written) await logEvent(db, project.id, 'brand_failed', { error: message.slice(0, 200) }, actor);
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[custom-site-brand] failed:', e?.message || e);
    return reply(e.status || 500, { error: e.status ? e.message : 'Something went wrong' });
  }
};
