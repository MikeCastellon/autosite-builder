// POST /.netlify/functions/custom-site-design-background   { id, startedAt }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). Writes a custom website's copy with
// Claude (DESIGN_MODEL, a tier above the free builder) from the project's
// saved design inputs and the customer's intake answers, then creates or
// updates the project's sites row. custom-site-admin `design-generate`
// claims the run first (design_status 'generating', design_started_at); this
// function only runs the claim it is given, so a double click or a retried
// request can't start a second run. The admin page polls `get` for
// design_status: generating → ready | failed.
//
// The site is created under the admin who started it, so they can open it
// in the editor and publish drafts. It moves to the customer at hand-over
// (custom-site-admin `handover`).
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { requestDesignCopy } from './_lib/custom-site-design-ai.js';
import { FIXED_HERO_BUTTONS } from './_lib/copyGeneration.js';
import {
  appliesBeforeAfter, beforeAfterCopy, buildDesignPrompt, designProblems, designSiteImages, fillPackageDescriptions, hasBeforeAfter,
  normalizeDesignCopy, rewriteSite, siteBusinessInfo,
} from '../../src/lib/customSiteDesign.js';
import { leverPatch } from '../../src/lib/designLevers.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-design] event ${type} not logged:`, error.message);
}

async function fail(db, projectId, message, actor) {
  await db.from(TABLE).update({
    design_status: 'failed',
    design_error: String(message || 'Something went wrong').slice(0, 500),
    design_finished_at: new Date().toISOString(),
  }).eq('id', projectId);
  await logEvent(db, projectId, 'design_failed', { error: String(message || '').slice(0, 200) }, actor);
}

// The work, separate from the HTTP wrapper so tests can call it with a
// fake database and a fake Anthropic client.
export async function runDesign({ db, client, projectId, startedAt, adminUser, actor, now = () => new Date().toISOString() }) {
  const { data: project, error: loadError } = await db.from(TABLE).select('*').eq('id', projectId).maybeSingle();
  if (loadError || !project) return { status: 404, error: 'Project not found' };
  // Only the run design-generate claimed: same start time, still generating.
  // Compared as instants: Postgres sends '…+00:00', the claim made '…Z'.
  const sameRun = Date.parse(project.design_started_at || '') === Date.parse(startedAt || '');
  if (project.design_status !== 'generating' || !startedAt || !sameRun) {
    return { status: 409, error: 'No matching run to start' };
  }
  if (project.handed_over_at) {
    await fail(db, project.id, 'This site was already handed over to the customer', actor);
    return { status: 409, error: 'Handed over' };
  }

  const design = project.design || {};
  const problems = designProblems(design);
  if (problems.length) {
    await fail(db, project.id, `Fill in before generating: ${problems.join(', ')}`, actor);
    return { status: 400, error: 'Design incomplete' };
  }

  try {
    const prompt = buildDesignPrompt({
      businessInfo: design.businessInfo,
      template: design.template,
      form: project.form || {},
      assets: project.assets || [],
      heroButtons: FIXED_HERO_BUTTONS[design.templateId] || null,
    });
    const { raw, model } = await requestDesignCopy(client, prompt);
    const copy = normalizeDesignCopy(raw, design.businessInfo);
    const businessInfo = fillPackageDescriptions(siteBusinessInfo(design, project.id), copy);
    // The photos the setup copied into the site's images; the Before &
    // After pairs' only on a template with that section.
    const images = designSiteImages(design);
    // The Design Studio's settings (palette, fonts, sections, layouts) on top
    // of the brand accent; the same patch the setup's preview shows.
    const patch = leverPatch(design.levers, design.templateId);
    const colors = { ...(design.customColors || {}), ...patch.colors };

    const { data: existing } = await db.from('sites').select('id, user_id, template_id, business_info, generated_content').eq('id', design.siteId).maybeSingle();
    // Did this write apply the setup's Before & After? Only then is its
    // "changed" mark spent; otherwise (a template without the section) it
    // stays for the next write on one with it.
    const pairsApplied = existing ? appliesBeforeAfter(design) : hasBeforeAfter(design.templateId);
    if (existing) {
      // Rewriting: new copy and business facts; photos and colors only
      // where the setup changed them (rewriteSite).
      const next = rewriteSite({ existing, copy, businessInfo, design });
      const { error } = await db.from('sites').update({
        ...next,
        template_id: design.templateId,
        updated_at: now(),
      }).eq('id', existing.id);
      if (error) throw new Error(`Could not update the site: ${error.message}`);
    } else {
      const generatedContent = { ...copy, ...patch.copy };
      // Before & After: the admin's pairs, captions, heading and intro (no
      // words of Claude's), on only with a pair whose two photos copied.
      const beforeAfter = beforeAfterCopy(design, images);
      if (beforeAfter) generatedContent.beforeAfter = beforeAfter;
      if (Object.keys(images).length) generatedContent._images = images;
      if (Object.keys(colors).length) generatedContent._customColors = colors;
      if (Object.keys(patch.fonts).length) generatedContent._customFonts = patch.fonts;
      const { error } = await db.from('sites').insert({
        id: design.siteId,
        user_id: adminUser.id,
        site_type: 'website',
        business_info: businessInfo,
        template_id: design.templateId,
        generated_content: generatedContent,
        widget_config_ids: [],
      });
      if (error) throw new Error(`Could not create the site: ${error.message}`);
    }

    await db.from(TABLE).update({
      site_id: design.siteId,
      design_status: 'ready',
      design_error: null,
      design_finished_at: now(),
    }).eq('id', project.id);
    await logEvent(db, project.id, 'design_ready', { model, regenerated: !!existing }, actor);
    const spent = { levers: leversPending(design), beforeAfter: pairsApplied && design.beforeAfterChanged === true };
    if (spent.levers || spent.beforeAfter) await clearAppliedChanges(db, project.id, spent);
    return { status: 200 };
  } catch (err) {
    console.error('[custom-site-design] failed:', err?.message || err);
    await fail(db, project.id, err?.message, actor);
    return { status: 500, error: err?.message };
  }
}

// Does the design mark Design Studio groups as changed?
function leversPending(d) {
  return Array.isArray(d?.leversChanged) ? d.leversChanged.length > 0 : !!d?.leversChanged;
}

// This write applied the Design Studio settings and/or the Before & After
// pairs (`spent`: { levers, beforeAfter }): clear those "changed" marks so
// a later rewrite keeps the editor's own changes to colors, fonts,
// sections and pairs. Guarded by updated_at like every other design write.
async function clearAppliedChanges(db, id, spent) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row } = await db.from(TABLE).select('design, updated_at').eq('id', id).maybeSingle();
    const d = row?.design;
    if (!d || typeof d !== 'object') return;
    const levers = spent.levers && leversPending(d);
    const pairs = spent.beforeAfter && d.beforeAfterChanged === true;
    if (!levers && !pairs) return;
    const next = { ...d };
    if (levers) next.leversChanged = [];
    if (pairs) next.beforeAfterChanged = false;
    let q = db.from(TABLE).update({ design: next }).eq('id', id);
    if (row.updated_at) q = q.eq('updated_at', row.updated_at);
    const { data } = await q.select('id').maybeSingle();
    if (data) return;
  }
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
  // Two attempts at most (structured, then plain) of 6 minutes each stay
  // inside the background function's 15-minute limit.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 6 * 60 * 1000, maxRetries: 0 });
  // Netlify retries a background function that fails (an error or a 5xx),
  // which would pay for the model run again. The run records its own
  // outcome on the project, so once it has started, always answer 200.
  try {
    const result = await runDesign({ db, client, projectId: body.id, startedAt: body.startedAt, adminUser: auth.user, actor: auth.actor });
    return { statusCode: result.status >= 500 ? 200 : result.status };
  } catch (err) {
    console.error('[custom-site-design] run crashed:', err?.message || err);
    return { statusCode: 200 };
  }
};
