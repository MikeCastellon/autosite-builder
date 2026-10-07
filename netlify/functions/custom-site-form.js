// /.netlify/functions/custom-site-form
//
// The customer's intake form at /custom-site?t=<token>. No sign-in: the
// token from the welcome email is the key, so every action starts by
// looking the project up by token. Archived projects stop answering.
//   GET  ?t=<token>                                   → saved answers, files, status
//   POST { action: 'upload-url', t, kind, fileName, size } → signed upload URL
//   POST { action: 'save',   t, form, assets }        → autosave
//   POST { action: 'submit', t, form, assets }        → final submit; emails the team
//
// Uploads go from the browser straight to the private custom-site-assets
// bucket through the signed URL (Netlify functions cap request bodies at
// ~6 MB, logos and photos are bigger). The form only ever stores paths this
// function minted for the project (sanitizeAssets checks the folder).
// project.assets also holds the team's reference screenshots (addedBy:
// 'admin', custom-site-admin reference-add): the form never lists or
// counts them, and a save keeps them whatever the browser sends
// (mergeFormAssets).
// iPhone photos (HEIC) can't be shown on a website or seen by Claude: a
// save or submit that stores any starts the background run that converts
// them to JPEG (startHeicRun).
import crypto from 'node:crypto';
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { customSiteFormToAdmin, customSiteReceivedToCustomer } from './_lib/postmark.js';
import {
  HEIC_FAILED_MAX, claimHeicRun, heicAssetsOf, invokeHeicBackground, isHeicRunLive, releaseHeicRun,
} from './_lib/heic-run.js';
import {
  ASSET_BUCKET, ASSET_KINDS, assetPath, checkUpload, customerAssets, firstName, isEmail, mergeFormAssets,
  missingRequired, sanitizeForm, stageAfterSave, stageAfterSubmit,
} from '../../src/lib/customSiteForm.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
// Answers are text; 400 KB is far beyond a filled-in form.
const MAX_BODY = 400_000;
// File links in the team email.
const EMAIL_LINK_SECONDS = 7 * 24 * 60 * 60;
// After a conversion run that broke as a whole (not one bad file), or
// failed on more files than it lists (heicRunWanted), the customer's saves
// leave it alone this long; the admin's button can retry at once.
const HEIC_RETRY_AFTER_MS = 30 * 60 * 1000;
// Netlify answers a background function with 202 at once. A save waits no
// longer than this for that answer: invokeHeicBackground's own limit is
// 10 s, the whole time this function gets, so a slow start could otherwise
// hold the customer's save past it. The answers are already stored, and a
// start still on its way either reaches the background function or leaves
// a claim that goes stale in 15 minutes (a later save takes it over). It
// isn't given up, since the run may well have started.
const HEIC_START_WAIT_MS = 4000;

const NOT_ACTIVE = 'This form link isn\'t active. Check the latest email from us, or reply to it and we\'ll send a new link.';

async function findProject(db, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const { data, error } = await db.from(TABLE)
    .select('id, token, stage, client_first_name, client_name, client_email, client_phone, business_name, form, assets, created_by, form_started_at, form_saved_at, form_submitted_at, updated_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw Object.assign(new Error('Could not load the form'), { status: 500 });
  if (!data || data.stage === 'archived') return null;
  return data;
}

async function logEvent(db, projectId, type, data = {}, actor = 'customer') {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data, actor });
  if (error) console.error(`[custom-site-form] event ${type} not logged:`, error.message);
}

// Moves the stage forward only from the stages it expects, in the same
// statement, so a customer save can't undo a stage an admin just set.
async function advanceStage(db, projectId, fromStage, nextStage, fromStages) {
  if (nextStage === fromStage) return false;
  const { data } = await db.from(TABLE).update({ stage: nextStage })
    .eq('id', projectId).in('stage', fromStages).select('id');
  if (!data?.length) return false;
  const { error } = await db.from(EVENTS).insert({
    project_id: projectId, type: 'stage', data: { from: fromStage, to: nextStage }, actor: 'system',
  });
  if (error) console.error('[custom-site-form] stage event not logged:', error.message);
  return true;
}

// Writes the customer's answers and uploads. project.assets is shared with
// the team (custom-site-admin reference-add appends screenshots to it at
// any time), so the write only lands while the row is still the one read
// (updated_at moves on every write, via the trigger); otherwise it reads
// again and merges again, so a screenshot the team added in between is
// never dropped. Returns { current, assets }: the row as it was just
// before the write and the list stored, or null when the row kept
// changing.
async function writeAnswers(db, token, project, { form, list, submitting, now }) {
  let current = project;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) {
      current = await findProject(db, token);
      if (!current) throw Object.assign(new Error(NOT_ACTIVE), { status: 404 });
    }
    const assets = mergeFormAssets(current.assets, list, current.id);
    const patch = { form, assets, form_saved_at: now };
    if (!current.form_started_at) patch.form_started_at = now;
    // The admin only had a name and email; the business and phone the
    // customer gives show up in the admin list.
    if (form.businessName && form.businessName !== current.business_name) patch.business_name = form.businessName.slice(0, 160);
    if (form.contactPhone && form.contactPhone !== current.client_phone) patch.client_phone = form.contactPhone.slice(0, 40);
    if (submitting) patch.form_submitted_at = now;
    let q = db.from(TABLE).update(patch).eq('id', current.id);
    if (current.updated_at) q = q.eq('updated_at', current.updated_at);
    const { data, error } = await q.select('id').maybeSingle();
    if (error) {
      console.error('[custom-site-form] save failed:', error.message);
      throw Object.assign(new Error('Could not save. Please try again.'), { status: 500 });
    }
    if (data) return { current, assets };
  }
  return null;
}

// Who gets the customer's answers: the admin who added the customer, plus
// any addresses in CUSTOM_SITES_EMAIL (comma-separated). With neither, the
// support inbox. Returns { to, creator } (creator: that admin's address).
async function teamRecipients(db, project) {
  let creator = null;
  if (project.created_by) {
    const { data } = await db.from('profiles').select('email').eq('id', project.created_by).maybeSingle();
    if (isEmail(data?.email)) creator = data.email.trim().toLowerCase();
  }
  const extra = (process.env.CUSTOM_SITES_EMAIL || '').split(',').map((e) => e.trim().toLowerCase()).filter(isEmail);
  const list = [...new Set([creator, ...extra].filter(Boolean))];
  if (!list.length) {
    const fallback = process.env.SUPPORT_HOST_EMAIL || process.env.POSTMARK_FROM_EMAIL;
    if (fallback) list.push(fallback);
  }
  return { to: list.join(', '), creator };
}

// The uploads with links that last long enough to open from the email.
async function withEmailLinks(db, assets) {
  if (!assets.length) return assets;
  const { data } = await db.storage.from(ASSET_BUCKET).createSignedUrls(assets.map((a) => a.path), EMAIL_LINK_SECONDS);
  const byPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  return assets.map((a) => ({ ...a, url: byPath.get(a.path) || null }));
}

// ─── iPhone photos (HEIC) ─────────────────────────────────────────────
//
// Autosave runs a second or so after every change, so a save starts a
// conversion run only when it has something new to do: never while one
// runs (one at a time per project), never again for files the last run
// already failed on, and not for HEIC_RETRY_AFTER_MS after a run that broke
// as a whole or whose failure list is full (HEIC_FAILED_MAX: the files past
// it aren't listed, so they would count as new). Each run logs events, and
// a bad file would otherwise start one (and fill the activity log) on
// every keystroke. The admin's "Convert them to JPEG" button retries
// those. `last` is design.heic.
function heicRunWanted(last, waiting, nowMs) {
  if (!waiting.length || isHeicRunLive(last, nowMs)) return false;
  if (!last || typeof last !== 'object') return true;
  const failed = Array.isArray(last.failed) ? last.failed : [];
  if (last.status === 'failed' || failed.length >= HEIC_FAILED_MAX) {
    const at = Date.parse(last.finishedAt || last.startedAt || '');
    if (Number.isFinite(at) && nowMs - at < HEIC_RETRY_AFTER_MS) return false;
  }
  const tried = new Set(failed.map((f) => f?.path));
  return waiting.some((a) => !tried.has(a.path));
}

// true once `promise` resolves within `ms`, false when the wait runs out
// first; a rejection within the wait is thrown. The race has a handler on
// `promise`, so one that rejects after the wait is dropped, never left
// unhandled.
async function settlesWithin(promise, ms) {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(resolve, ms, false); });
  try {
    return await Promise.race([promise.then(() => true), late]);
  } finally {
    clearTimeout(timer);
  }
}

// Starts converting the HEIC files in the list just stored, as the
// customer. Best effort: the answers are saved whatever happens here, so
// nothing in it fails the save, and it waits at most HEIC_START_WAIT_MS for
// the start. The background function logs the run's heic_started /
// heic_ready / heic_failed; this only logs a start Netlify refused.
async function startHeicRun(db, event, projectId, assets) {
  try {
    const waiting = heicAssetsOf(assets);
    if (!waiting.length) return;
    const nowMs = Date.now();
    // Only the run record, not the whole design.
    const { data, error } = await db.from(TABLE).select('heic:design->heic').eq('id', projectId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!heicRunWanted(data?.heic ?? null, waiting, nowMs)) return;
    // The claim checks again on the row it writes: two saves at once start
    // one run.
    const { claimed, run } = await claimHeicRun(db, projectId, { by: 'customer', nowMs });
    if (!claimed) return;
    try {
      const started = await settlesWithin(invokeHeicBackground(event, { id: projectId, startedAt: run.startedAt }), HEIC_START_WAIT_MS);
      if (!started) console.warn('[custom-site-form] HEIC conversion start still pending; the claim stays as it is');
    } catch (e) {
      // Refused: given up at once, like the admin's button does, so the
      // button works again without waiting for the claim to go stale.
      const message = `Couldn't start the conversion: ${e?.message || e}`.slice(0, 200);
      console.error('[custom-site-form]', message);
      if (await releaseHeicRun(db, projectId, run.startedAt, message)) {
        await logEvent(db, projectId, 'heic_failed', { error: message, by: 'customer' }, 'system');
      }
    }
  } catch (e) {
    console.error('[custom-site-form] HEIC conversion not started:', e?.message || e);
  }
}

function clientIp(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

async function limited(db, event, kind, limit) {
  const { limited: hit } = await checkAndRecordRateLimit({ db, ip: clientIp(event), kind, windowMs: 60 * 60 * 1000, limit });
  return hit;
}

export const handler = async (event) => {
  const CORS = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(event.headers) };

  const db = supabaseAdmin();

  try {
    if (event.httpMethod === 'GET') {
      const project = await findProject(db, event.queryStringParameters?.t);
      if (!project) return reply(404, { error: NOT_ACTIVE });
      // The customer's own files only: the team's screenshots aren't theirs
      // to see, edit or remove.
      const assets = customerAssets(project.assets);
      // Thumbnails for the files already uploaded, valid for an hour.
      let urls = new Map();
      if (assets.length) {
        const { data } = await db.storage.from(ASSET_BUCKET).createSignedUrls(assets.map((a) => a.path), 3600);
        urls = new Map((data || []).map((d) => [d.path, d.signedUrl]));
      }
      return reply(200, {
        project: {
          firstName: project.client_first_name,
          clientName: project.client_name,
          businessName: project.business_name,
          stage: project.stage,
          savedAt: project.form_saved_at,
          submittedAt: project.form_submitted_at,
          form: project.form || {},
          assets: assets.map((a) => ({ ...a, url: urls.get(a.path) || null })),
        },
      });
    }

    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    if (raw.length > MAX_BODY) return reply(413, { error: 'That\'s too much text to save at once' });
    let body;
    try { body = JSON.parse(raw || '{}'); }
    catch { return reply(400, { error: 'Invalid JSON' }); }

    const project = await findProject(db, body.t);
    if (!project) return reply(404, { error: NOT_ACTIVE });
    const now = new Date().toISOString();

    switch (body.action) {
      case 'upload-url': {
        if (await limited(db, event, 'custom-site-upload', 300)) {
          return reply(429, { error: 'Too many uploads. Please wait a bit and try again.' });
        }
        const kind = body.kind;
        const check = checkUpload({ kind, fileName: body.fileName, size: Number(body.size) });
        if (check.error) return reply(400, { error: check.error });
        // The team's screenshots don't use up the customer's room.
        const used = customerAssets(project.assets).filter((a) => a.kind === kind).length;
        if (used >= ASSET_KINDS[kind].max) {
          return reply(400, { error: `You can add up to ${ASSET_KINDS[kind].max} files here. Remove one to add another.` });
        }
        const path = assetPath(project.id, kind, crypto.randomUUID(), check.ext);
        const { data, error } = await db.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
        if (error || !data?.token) {
          console.error('[custom-site-form] signed upload failed:', error?.message);
          return reply(500, { error: 'Could not start the upload. Please try again.' });
        }
        return reply(200, { path, uploadToken: data.token });
      }

      case 'save':
      case 'submit': {
        const submitting = body.action === 'submit';
        if (submitting && await limited(db, event, 'custom-site-submit', 20)) {
          return reply(429, { error: 'Too many tries. Please wait a bit and try again.' });
        }
        const form = sanitizeForm(body.form);
        if (submitting) {
          const missing = missingRequired(form);
          if (missing.length) return reply(400, { error: `Please fill in: ${missing.map((m) => m.label).join(', ')}`, missing });
        }

        const written = await writeAnswers(db, body.t, project, { form, list: body.assets, submitting, now });
        if (!written) return reply(409, { error: 'Could not save just now. Please try again.' });
        // The row the write landed on, as it was: these describe the project
        // before this save. The team email lists the customer's own files.
        const { current } = written;
        const assets = customerAssets(written.assets);
        const { stage: fromStage } = current;
        const firstSave = !current.form_started_at;
        const resubmitted = !!current.form_submitted_at;
        if (firstSave) await logEvent(db, current.id, 'form_started');
        // Awaited: Netlify stops the function once the handler returns.
        await startHeicRun(db, event, current.id, written.assets);

        if (!submitting) {
          await advanceStage(db, current.id, fromStage, stageAfterSave(fromStage), ['new', 'invited']);
          return reply(200, { ok: true, savedAt: now });
        }

        await logEvent(db, current.id, resubmitted ? 'form_resubmitted' : 'form_submitted');
        await advanceStage(db, current.id, fromStage, stageAfterSubmit(fromStage), ['new', 'invited', 'form_started']);

        // Await both before returning (Netlify stops the function when the
        // handler returns). allSettled: the answers are saved either way.
        const formUrl = `${APP_URL}/custom-site?t=${encodeURIComponent(current.token)}`;
        const [{ to, creator }, files] = await Promise.all([teamRecipients(db, current), withEmailLinks(db, assets)]);
        const sends = [];
        if (to) {
          sends.push(customSiteFormToAdmin({
            to, project: current, form, assets: files, resubmitted,
            adminUrl: `${APP_URL}/?admin=custom-sites&project=${current.id}`,
          }));
        }
        // The confirmation goes to the address the team entered, not one
        // typed into the form, and only once.
        if (!resubmitted) {
          sends.push(customSiteReceivedToCustomer({
            to: current.client_email,
            replyTo: creator,
            firstName: current.client_first_name || firstName(form.contactName),
            businessName: form.businessName || current.business_name,
            formUrl,
          }));
        }
        const results = await Promise.allSettled(sends);
        results.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`[custom-site-form] email ${i} failed:`, r.reason?.message || r.reason);
        });
        return reply(200, { ok: true, savedAt: now, submittedAt: now });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[custom-site-form] failed:', e?.message || e);
    return reply(e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
};
