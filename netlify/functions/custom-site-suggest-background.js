// POST /.netlify/functions/custom-site-suggest-background   { id, startedAt }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). "Suggest a design": Claude
// (SUGGEST_MODEL) looks at the customer's logo, inspiration images and
// photos plus their intake answers and proposes the look
// (src/lib/designSuggest.js). custom-site-suggest `start` claims the run
// first (design.suggestion = { status: 'running', startedAt }); this
// function only runs the claim it is given, so a double click or a retried
// request can't start a second run. The admin page polls
// custom-site-suggest `get`: running → ready | failed.
//
// It stores the proposal in design.suggestion and nothing else: the site,
// the rest of the design and the levers stay as they are until the admin
// applies the parts they want.
//
// "Match its layout": a claim that carries reference { mode: 'match',
// source } (and studioPalette, the Studio's colors when it started, and
// useBrand, its "Use their brand color" toggle) runs as a match: the
// reference's screenshots go first as the layout to mirror, the colors
// come from our side, and the result carries suggestion.reference. The
// claim is the only place the choice is read from: the request body only
// names the run. Its events (ready or failed) carry mode: 'match'.
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { failedSuggestion, isSameSuggestRun, suggestDesign, updateSuggestion } from './_lib/custom-site-suggest-ai.js';
import { SUGGEST_STALE_MS } from '../../src/lib/designSuggest.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
// The request stops this long before the claim counts as stale, so its
// result is stored while the claim is still this run's.
const DEADLINE_MARGIN_MS = 30 * 1000;

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-suggest] event ${type} not logged:`, error.message);
}

// The work, separate from the HTTP wrapper so tests can call it with a
// fake database and a fake Anthropic client.
export async function runSuggest({ db, client, projectId, startedAt, actor, now = () => new Date().toISOString() }) {
  if (typeof projectId !== 'string' || !projectId) return { status: 404, error: 'Project not found' };
  const { data: project, error: loadError } = await db.from(TABLE).select('*').eq('id', projectId).maybeSingle();
  if (loadError || !project) return { status: 404, error: 'Project not found' };
  // Only the run `start` claimed. Compared as instants: the claim wrote
  // '…Z' into the JSON, the caller may send it back in another form.
  const claim = project.design?.suggestion;
  if (!isSameSuggestRun(claim, startedAt)) return { status: 409, error: 'No matching run to start' };

  // A match run says so in its log whether it ends ready or failed, so the
  // activity reads "Layout match failed" rather than a plain suggestion.
  const mode = claim.reference?.mode === 'match' ? { mode: 'match' } : {};
  let next;
  let result = null;
  try {
    const deadlineMs = Date.parse(claim.startedAt) + SUGGEST_STALE_MS - DEADLINE_MARGIN_MS;
    result = await suggestDesign({
      db,
      client,
      project,
      deadlineMs,
      reference: claim.reference || null,
      studioPalette: claim.studioPalette || null,
      useBrand: typeof claim.useBrand === 'boolean' ? claim.useBrand : undefined,
    });
    next = {
      status: 'ready',
      startedAt: claim.startedAt,
      finishedAt: now(),
      model: result.model,
      templateId: result.templateId,
      levers: result.levers,
      photoPlan: result.photoPlan,
      reasons: result.reasons,
      facts: result.facts,
      skipped: result.skipped,
      error: null,
      ...(result.reference ? { reference: result.reference } : {}),
    };
  } catch (err) {
    console.error(`[custom-site-suggest] ${mode.mode === 'match' ? 'layout match' : 'suggestion'} failed:`, err?.message || err);
    next = failedSuggestion({ startedAt: claim.startedAt, finishedAt: now(), error: err?.message });
  }

  // Stored only while the claim is still this run's: a newer run (after
  // this one went stale) or a release owns the slot otherwise.
  let written;
  try {
    ({ written } = await updateSuggestion(db, project.id, (current) => (isSameSuggestRun(current, startedAt) ? next : undefined)));
  } catch (err) {
    // The claim stays "running" and shows as failed once stale.
    console.error('[custom-site-suggest] could not store the result:', err?.message || err);
    return { status: 500, error: err?.message };
  }
  if (!written) return { status: 409, error: 'The run was replaced' };
  if (next.status === 'ready') {
    await logEvent(db, project.id, 'design_suggest_ready', {
      model: result.model, templateId: result.templateId, images: result.imageCount, skipped: result.skipped.length,
      droppedFacts: result.dropped.facts, droppedPhotos: result.dropped.photos,
      ...mode,
    }, actor);
    return { status: 200 };
  }
  await logEvent(db, project.id, 'design_suggest_failed', { error: next.error.slice(0, 200), ...mode }, actor);
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
  // No SDK retries: the two attempts (structured, then plain) share the
  // time left before the claim goes stale (runSuggest passes each its
  // timeout); the client's own timeout is only a ceiling.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: SUGGEST_STALE_MS, maxRetries: 0 });
  // Netlify retries a background function that fails (an error or a 5xx),
  // which would pay for the model run again. The run records its own
  // outcome on the project, so once it has started, always answer 200.
  try {
    const result = await runSuggest({ db, client, projectId: body.id, startedAt: body.startedAt, actor: auth.actor });
    return { statusCode: result.status >= 500 ? 200 : result.status };
  } catch (err) {
    console.error('[custom-site-suggest] run crashed:', err?.message || err);
    return { statusCode: 200 };
  }
};
