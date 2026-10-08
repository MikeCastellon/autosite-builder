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
  appliesBeforeAfter, beforeAfterCopy, buildDesignPrompt, designProblems, designSiteImages, extraSectionsPlan, extraSectionsWrite,
  fillPackageDescriptions, hasBeforeAfter, normalizeDesignCopy, rewriteSite, siteBusinessInfo, withServiceCategories,
} from '../../src/lib/customSiteDesign.js';
import { normalizeExtraSections, sanitizeExtraSectionIds } from '../../src/lib/customSiteSections.js';
import { leverPatch } from '../../src/lib/designLevers.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-design] event ${type} not logged:`, error.message);
}

// ─── The Detail Showcase's photos, for Claude to title ───────────────
//
// The photos the setup already copied into the site's public images
// (design.images, which sanitizeDesign keeps to the site-images bucket),
// fetched here and sent inline: a photo that won't load is left out (its
// card waits for a title in the editor) instead of failing the run. Only
// what Claude reads (JPEG, PNG, GIF, WebP) and at most 3.75 MB, which stays
// under the API's 5 MB per image once base64-encoded.
const VIEWABLE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const PHOTO_MAX_BYTES = 3.75 * 1024 * 1024;
// Six photos load side by side, so the wait stays well inside the run's
// 15 minutes next to two 6-minute model attempts.
const PHOTO_TIMEOUT_MS = 10 * 1000;

function siteImagesPrefix() {
  const base = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/storage/v1/object/public/site-images/` : '';
}

// { mediaType, data } of one public site image, or null.
export async function fetchSitePhoto(url) {
  const prefix = siteImagesPrefix();
  if (!prefix || typeof url !== 'string' || !url.startsWith(prefix)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!VIEWABLE.includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) return null;
    return { mediaType: type, data: bytes.toString('base64') };
  } catch {
    return null;
  }
}

// The plan's photos (extraSectionsPlan: [{ index, url }]) loaded side by
// side, the ones that loaded numbered 1.. in their order:
// [{ number, index, mediaType, data }].
async function loadShowcasePhotos(photos, loadImage) {
  const loaded = await Promise.all(photos.map((p) => Promise.resolve().then(() => loadImage(p.url)).catch(() => null)));
  const out = [];
  photos.forEach((p, i) => {
    const img = loaded[i];
    if (img?.data && img.mediaType) out.push({ number: out.length + 1, index: p.index, mediaType: img.mediaType, data: img.data });
  });
  return out;
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
// fake database, a fake Anthropic client and a fake photo loader
// (`loadImage`, fetchSitePhoto by default).
export async function runDesign({
  db, client, projectId, startedAt, adminUser, actor, now = () => new Date().toISOString(), loadImage = fetchSitePhoto,
}) {
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
    // The site, if a run made it already: a rewrite applies only what the
    // setup changed (rewriteSite), and the More sections it drafts follow.
    const { data: existing } = await db.from('sites').select('id, user_id, template_id, business_info, generated_content').eq('id', design.siteId).maybeSingle();
    // The More sections this write applies, and which of them Claude drafts
    // (customSiteDesign.js extraSectionsPlan): the showcase's untitled
    // photos are attached for it to look at.
    const plan = extraSectionsPlan(design, { existing: !!existing });
    const photos = plan.draft.includes('showcase') && plan.photos.length ? await loadShowcasePhotos(plan.photos, loadImage) : [];
    const prompt = buildDesignPrompt({
      businessInfo: design.businessInfo,
      template: design.template,
      form: project.form || {},
      assets: project.assets || [],
      heroButtons: FIXED_HERO_BUTTONS[design.templateId] || null,
      sections: plan.draft.length ? {
        draft: plan.draft,
        facts: design.levers?.facts,
        faqNotes: design.faqNotes,
        photos: photos.map((p) => p.number),
        categorize: plan.categorize,
      } : null,
    });
    if (photos.length && prompt.fields?.includes('showcaseTitles')) prompt.images = photos;
    const { raw, model } = await requestDesignCopy(client, prompt);
    const copy = normalizeDesignCopy(raw, design.businessInfo);
    // Claude's sections, checked against the facts the request gave.
    const drafted = normalizeExtraSections(raw, {
      fields: prompt.fields || [], services: design.businessInfo?.services, source: prompt.source || '', photos: photos.map((p) => p.number),
    });
    const extra = extraSectionsWrite(design, drafted, { existing: !!existing, photos });
    const businessInfo = withServiceCategories(fillPackageDescriptions(siteBusinessInfo(design, project.id), copy), extra.categories);
    // The photos the setup copied into the site's images; the Before &
    // After pairs' only on a template with that section, the showcase's
    // only with its copy.
    const images = { ...designSiteImages(design), ...(extra.images || {}) };
    // The Design Studio's settings (palette, fonts, sections, layouts) on top
    // of the brand accent; the same patch the setup's preview shows.
    const patch = leverPatch(design.levers, design.templateId);
    const colors = { ...(design.customColors || {}), ...patch.colors };

    // Did this write apply the setup's Before & After? Only then is its
    // "changed" mark spent; otherwise (a template without the section) it
    // stays for the next write on one with it.
    const pairsApplied = existing ? appliesBeforeAfter(design) : hasBeforeAfter(design.templateId);
    if (existing) {
      // Rewriting: new copy and business facts; photos and colors only
      // where the setup changed them (rewriteSite).
      const next = rewriteSite({ existing, copy, businessInfo, design, extra });
      const { error } = await db.from('sites').update({
        ...next,
        template_id: design.templateId,
        updated_at: now(),
      }).eq('id', existing.id);
      if (error) throw new Error(`Could not update the site: ${error.message}`);
    } else {
      // The More sections drafted (an off one has nothing to take off yet).
      const generatedContent = { ...copy, ...patch.copy, ...extra.copy };
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
    await logEvent(db, project.id, 'design_ready', {
      model, regenerated: !!existing, ...(Object.keys(extra.counts).length ? { sections: extra.counts } : {}),
    }, actor);
    const spent = {
      levers: leversPending(design),
      beforeAfter: pairsApplied && design.beforeAfterChanged === true,
      // The More sections this write applied; a marked one it left (not on
      // this template, or a draft with nothing usable) keeps its mark.
      sections: extra.applied.filter((id) => sanitizeExtraSectionIds(design.extraSectionsChanged).includes(id)),
    };
    if (spent.levers || spent.beforeAfter || spent.sections.length) await clearAppliedChanges(db, project.id, spent);
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

// This write applied the Design Studio settings, the Before & After pairs
// and/or More sections (`spent`: { levers, beforeAfter, sections: [ids] }):
// clear those "changed" marks so a later rewrite keeps the editor's own
// changes to colors, fonts, sections, pairs and those sections' content.
// Guarded by updated_at like every other design write.
async function clearAppliedChanges(db, id, spent) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row } = await db.from(TABLE).select('design, updated_at').eq('id', id).maybeSingle();
    const d = row?.design;
    if (!d || typeof d !== 'object') return;
    const levers = spent.levers && leversPending(d);
    const pairs = spent.beforeAfter && d.beforeAfterChanged === true;
    const marks = sanitizeExtraSectionIds(d.extraSectionsChanged);
    const sections = (spent.sections || []).filter((s) => marks.includes(s));
    if (!levers && !pairs && !sections.length) return;
    const next = { ...d };
    if (levers) next.leversChanged = [];
    if (pairs) next.beforeAfterChanged = false;
    if (sections.length) {
      const left = marks.filter((s) => !sections.includes(s));
      if (left.length) next.extraSectionsChanged = left;
      else delete next.extraSectionsChanged;
    }
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
