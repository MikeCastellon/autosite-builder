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
import crypto from 'node:crypto';
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { customSiteFormToAdmin, customSiteReceivedToCustomer } from './_lib/postmark.js';
import {
  ASSET_BUCKET, ASSET_KINDS, assetPath, checkUpload, firstName, isEmail, missingRequired, sanitizeAssets,
  sanitizeForm, stageAfterSave, stageAfterSubmit,
} from '../../src/lib/customSiteForm.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
// Answers are text; 400 KB is far beyond a filled-in form.
const MAX_BODY = 400_000;
// File links in the team email.
const EMAIL_LINK_SECONDS = 7 * 24 * 60 * 60;

const NOT_ACTIVE = 'This form link isn\'t active. Check the latest email from us, or reply to it and we\'ll send a new link.';

async function findProject(db, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const { data, error } = await db.from(TABLE)
    .select('id, token, stage, client_first_name, client_name, client_email, client_phone, business_name, form, assets, created_by, form_started_at, form_saved_at, form_submitted_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw Object.assign(new Error('Could not load the form'), { status: 500 });
  if (!data || data.stage === 'archived') return null;
  return data;
}

async function logEvent(db, projectId, type, data = {}) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data, actor: 'customer' });
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
      const assets = Array.isArray(project.assets) ? project.assets : [];
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
        const used = (project.assets || []).filter((a) => a.kind === kind).length;
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
        const assets = sanitizeAssets(body.assets, project.id);
        if (submitting) {
          const missing = missingRequired(form);
          if (missing.length) return reply(400, { error: `Please fill in: ${missing.map((m) => m.label).join(', ')}`, missing });
        }

        // Read before the update: these describe the project as it was.
        const { stage: fromStage } = project;
        const firstSave = !project.form_started_at;
        const resubmitted = !!project.form_submitted_at;

        const patch = { form, assets, form_saved_at: now };
        if (firstSave) patch.form_started_at = now;
        // The admin only had a name and email; the business and phone the
        // customer gives show up in the admin list.
        if (form.businessName && form.businessName !== project.business_name) patch.business_name = form.businessName.slice(0, 160);
        if (form.contactPhone && form.contactPhone !== project.client_phone) patch.client_phone = form.contactPhone.slice(0, 40);
        if (submitting) patch.form_submitted_at = now;
        const { error } = await db.from(TABLE).update(patch).eq('id', project.id);
        if (error) {
          console.error('[custom-site-form] save failed:', error.message);
          return reply(500, { error: 'Could not save. Please try again.' });
        }
        if (firstSave) await logEvent(db, project.id, 'form_started');

        if (!submitting) {
          await advanceStage(db, project.id, fromStage, stageAfterSave(fromStage), ['new', 'invited']);
          return reply(200, { ok: true, savedAt: now });
        }

        await logEvent(db, project.id, resubmitted ? 'form_resubmitted' : 'form_submitted');
        await advanceStage(db, project.id, fromStage, stageAfterSubmit(fromStage), ['new', 'invited', 'form_started']);

        // Await both before returning (Netlify stops the function when the
        // handler returns). allSettled: the answers are saved either way.
        const formUrl = `${APP_URL}/custom-site?t=${encodeURIComponent(project.token)}`;
        const [{ to, creator }, files] = await Promise.all([teamRecipients(db, project), withEmailLinks(db, assets)]);
        const sends = [];
        if (to) {
          sends.push(customSiteFormToAdmin({
            to, project, form, assets: files, resubmitted,
            adminUrl: `${APP_URL}/?admin=custom-sites&project=${project.id}`,
          }));
        }
        // The confirmation goes to the address the team entered, not one
        // typed into the form, and only once.
        if (!resubmitted) {
          sends.push(customSiteReceivedToCustomer({
            to: project.client_email,
            replyTo: creator,
            firstName: project.client_first_name || firstName(form.contactName),
            businessName: form.businessName || project.business_name,
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
