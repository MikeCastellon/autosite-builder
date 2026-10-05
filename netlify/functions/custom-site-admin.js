// POST /.netlify/functions/custom-site-admin
//
// Admin > Custom websites. Super admins only. One endpoint, one `action`
// per operation:
//   list                          → every project, latest activity first
//   get          { id }           → one project + activity + signed file URLs
//   create       { firstName, lastName?, clientEmail, note?, sendEmail? }
//   send-welcome { id, note? }    → (re)send the welcome email with the form link
//   update       { id, stage?, adminNotes?, siteUrl?, paid?,
//                  firstName?, lastName?, clientEmail?, clientPhone?, businessName? }
//   email-customer { id, template: 'draft' | 'live', note? }
//                                 → emails the site link; moves the stage to
//                                   "Draft with customer" / "Live"
//   reset-link   { id }           → new form token; the old link stops working
//   delete       { id }           → removes the project, its activity and its files
//   design-save  { id, design }   → the Design step's inputs (customSiteDesign.js)
//   design-generate { id }        → claims a copy-writing run; the browser then
//                                   calls custom-site-design-background
//   design-release { id, startedAt, error } → gives a claimed run up when the
//                                   browser could not start it
//   handover-check { id }         → the customer's account, if they have one
//   handover     { id, compPro, sendEmail } → moves the site to the customer's
//                                   account (created if needed) and emails them
//   handover-email { id }         → sends the access email again
//
// The tables have RLS on with no policies (see the migration), so this
// function, with the service role, is the only way in.
import crypto from 'node:crypto';
import { supabaseAdmin } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { requireSuperAdmin } from './_lib/custom-site-auth.js';
import { accessLink, findCustomerAccount, handOverSite } from './_lib/custom-site-handover.js';
import { customSiteDraft, customSiteHandover, customSiteLive, customSiteWelcome } from './_lib/postmark.js';
import {
  ASSET_BUCKET, ASSET_KINDS, STAGE_IDS, fullName, isEmail, safeHref, sanitizeForm, stageAfterInvite,
} from '../../src/lib/customSiteForm.js';
import { designProblems, isRunStale, sanitizeDesign } from '../../src/lib/customSiteDesign.js';
import { applyLaunchPatch } from '../../src/lib/customSiteLaunch.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');

export function formLink(token) {
  return `${APP_URL}/custom-site?t=${encodeURIComponent(token)}`;
}

function newToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// The token never leaves as-is: the admin gets the full link instead.
function forAdmin(p) {
  const { token, ...rest } = p;
  return { ...rest, formUrl: formLink(token) };
}

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`[custom-site-admin] event ${type} not logged:`, error.message);
}

// Public URL prefix of the site-images bucket: images a design uses must be
// copied there first (the customer's uploads are private, links expire).
function siteImagesPrefix() {
  return `${String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/site-images/`;
}

// A run that is generating and not stale is still working.
const runLive = (p) => p.design_status === 'generating' && !isRunStale(p);

// The project's site, as the project page shows it.
async function siteSummary(db, siteId) {
  if (!siteId) return null;
  const { data: site } = await db.from('sites')
    .select('id, user_id, slug, published_url, template_id, scheduler_enabled, site_type, updated_at, business_info')
    .eq('id', siteId).maybeSingle();
  if (!site) return null;
  const { data: owner } = await db.from('profiles').select('email, is_super_admin').eq('id', site.user_id).maybeSingle();
  return {
    id: site.id,
    userId: site.user_id,
    ownerEmail: owner?.email || null,
    ownerIsAdmin: !!owner?.is_super_admin,
    slug: site.slug,
    publishedUrl: site.published_url,
    templateId: site.template_id,
    schedulerEnabled: !!site.scheduler_enabled,
    siteType: site.site_type || 'website',
    name: site.business_info?.businessName || '',
    updatedAt: site.updated_at,
  };
}

// Sends the hand-over (access) email and logs it.
async function sendAccessEmail(db, project, { newAccount, site, actor }) {
  const email = String(project.client_email || '').trim().toLowerCase();
  try {
    const actionUrl = await accessLink(db, { email, newAccount, appUrl: APP_URL });
    await customSiteHandover({
      to: email,
      replyTo: isEmail(actor) ? actor : undefined,
      firstName: project.client_first_name,
      businessName: project.business_name,
      siteUrl: site?.publishedUrl || project.site_url || null,
      actionUrl,
      newAccount,
      email,
    });
    await logEvent(db, project.id, 'email', { template: newAccount ? 'handover_new' : 'handover', to: email }, actor);
    return null;
  } catch (e) {
    const message = e?.message || 'Email failed to send';
    await logEvent(db, project.id, 'email_failed', { template: 'handover', to: email, error: message.slice(0, 200) }, actor);
    return message;
  }
}

// Sends the welcome email and records it. A failed send is returned as
// emailError (the project itself is fine) so the admin sees it and can retry.
async function sendWelcome(db, project, note, actor) {
  const to = project.client_email;
  try {
    await customSiteWelcome({
      to,
      // The customer's reply reaches the admin who sent the email.
      replyTo: isEmail(actor) ? actor : undefined,
      firstName: project.client_first_name,
      businessName: project.business_name,
      formUrl: formLink(project.token),
      note: clean(note, 2000),
    });
  } catch (e) {
    const message = e?.message || 'Email failed to send';
    await logEvent(db, project.id, 'email_failed', { template: 'welcome', to, error: message.slice(0, 200) }, actor);
    return { project, emailError: message };
  }
  const fromStage = project.stage;
  const nextStage = stageAfterInvite(fromStage);
  const { data, error } = await db.from(TABLE)
    .update({
      invite_sent_at: new Date().toISOString(),
      invite_count: (project.invite_count || 0) + 1,
      stage: nextStage,
    })
    .eq('id', project.id)
    .select('*')
    .single();
  if (error) console.error('[custom-site-admin] invite bookkeeping failed:', error.message);
  await logEvent(db, project.id, 'email', { template: 'welcome', to }, actor);
  if (nextStage !== fromStage) {
    await logEvent(db, project.id, 'stage', { from: fromStage, to: nextStage }, 'system');
  }
  return { project: data || project };
}

// When each project entered its current stage: its latest stage event, or
// when it was added. `events` newest first.
function stageSince(project, events) {
  return events.find((e) => e.type === 'stage' && (!e.project_id || e.project_id === project.id))?.created_at
    || project.created_at;
}

async function loadProject(db, id) {
  if (typeof id !== 'string' || !id) return null;
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw Object.assign(new Error('Could not load the project'), { status: 500 });
  return data;
}

// Signed links for the customer's uploads, valid for an hour. downloadUrl
// makes the browser save the file under its original name.
async function withFileUrls(db, assets) {
  const list = Array.isArray(assets) ? assets : [];
  if (!list.length) return [];
  const { data, error } = await db.storage.from(ASSET_BUCKET).createSignedUrls(list.map((a) => a.path), 3600);
  if (error) console.error('[custom-site-admin] signed urls failed:', error.message);
  const byPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  return list.map((a) => {
    const url = byPath.get(a.path) || null;
    return { ...a, url, downloadUrl: url ? `${url}&download=${encodeURIComponent(a.name || '')}` : null };
  });
}

// Every object under the project's folder, including uploads the customer
// removed from the form later (those stay in storage until the project goes).
async function removeProjectFiles(db, projectId) {
  const paths = [];
  for (const kind of Object.keys(ASSET_KINDS)) {
    const { data } = await db.storage.from(ASSET_BUCKET).list(`${projectId}/${kind}`, { limit: 1000 });
    for (const f of data || []) paths.push(`${projectId}/${kind}/${f.name}`);
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(ASSET_BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error('[custom-site-admin] file cleanup failed:', error.message);
  }
}

// Launch card (customSiteLaunch.js): merges what the card changed into
// design.launch and keeps every other design key. design is one jsonb
// column the setup's design-save also writes, so the write only lands while
// the row is still the one read (updated_at moves on every write, via the
// trigger); otherwise it reads again and re-applies the patch, so a save
// landing in between is never undone. Returns [status, body].
// design keys only server actions write (see design-save).
const SERVER_DESIGN_KEYS = ['launch', 'suggestion', 'brand'];

async function saveLaunch(db, id, patch, actor) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await loadProject(db, id);
    if (!current) return [404, { error: 'Project not found' }];
    const design = current.design && typeof current.design === 'object' && !Array.isArray(current.design) ? current.design : {};
    const { launch, changed, event } = applyLaunchPatch(design.launch, patch, new Date().toISOString());
    if (!changed) return [200, { project: forAdmin(current) }];
    let q = db.from(TABLE).update({ design: { ...design, launch } }).eq('id', current.id);
    if (current.updated_at) q = q.eq('updated_at', current.updated_at);
    const { data, error } = await q.select('*').maybeSingle();
    if (error) {
      console.error('[custom-site-admin] launch save failed:', error.message);
      return [500, { error: 'Could not save the launch list' }];
    }
    if (!data) continue;
    if (event) await logEvent(db, current.id, 'launch', event, actor);
    return [200, { project: forAdmin(data) }];
  }
  return [409, { error: 'The project changed while saving. Try again.' }];
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
  let adminUser;
  try {
    ({ actor, user: adminUser } = await requireSuperAdmin(event, db));
  } catch (e) {
    return reply(e.status || 401, { error: e.message || 'Not signed in' });
  }

  try {
    switch (body.action) {
      case 'list': {
        const { data, error } = await db.from(TABLE)
          .select('id, token, client_first_name, client_last_name, client_name, client_email, client_phone, business_name, stage, site_url, paid_at, invite_sent_at, invite_count, form_started_at, form_saved_at, form_submitted_at, assets, created_at, updated_at, site_id, design_status, handed_over_at')
          .order('updated_at', { ascending: false })
          .limit(1000);
        if (error) throw Object.assign(new Error('Could not load projects'), { status: 500 });
        const { data: stageEvents } = await db.from(EVENTS)
          .select('project_id, type, created_at')
          .eq('type', 'stage')
          .order('created_at', { ascending: false })
          .limit(5000);
        const since = new Map();
        for (const e of stageEvents || []) if (!since.has(e.project_id)) since.set(e.project_id, e.created_at);
        const projects = (data || []).map(({ assets, ...p }) => ({
          ...forAdmin(p),
          fileCount: Array.isArray(assets) ? assets.length : 0,
          stageSince: since.get(p.id) || p.created_at,
        }));
        return reply(200, { projects });
      }

      case 'get': {
        const project = await loadProject(db, body.id);
        if (!project) return reply(404, { error: 'Project not found' });
        // A run that died (timeout, lost request) shows as failed, with a retry.
        if (isRunStale(project)) {
          const stale = { design_status: 'failed', design_error: 'Writing the site didn\'t finish (it may have timed out). Try again.', design_finished_at: new Date().toISOString() };
          await db.from(TABLE).update(stale).eq('id', project.id).eq('design_status', 'generating');
          Object.assign(project, stale);
          await logEvent(db, project.id, 'design_failed', { error: 'timed out' }, 'system');
        }
        const [{ data: events }, files] = await Promise.all([
          // id breaks ties: one request can log several events in the same millisecond.
          db.from(EVENTS).select('id, type, data, actor, created_at').eq('project_id', project.id)
            .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(300),
          withFileUrls(db, project.assets),
        ]);
        const list = events || [];
        const site = await siteSummary(db, project.site_id);
        // Once the site is published, its address is the draft link (unless
        // the admin set another one).
        if (site?.publishedUrl && !project.site_url) {
          await db.from(TABLE).update({ site_url: site.publishedUrl }).eq('id', project.id);
          project.site_url = site.publishedUrl;
        }
        return reply(200, { project: { ...forAdmin(project), files, stageSince: stageSince(project, list), site }, events: list });
      }

      case 'create': {
        // All we know at this point: name and email. The customer fills
        // in their business, phone and the rest through the form.
        const firstName = clean(body.firstName, 80);
        const lastName = clean(body.lastName, 80);
        const clientEmail = clean(body.clientEmail, 200).toLowerCase();
        if (!firstName) return reply(400, { error: 'First name is required' });
        if (!isEmail(clientEmail)) return reply(400, { error: 'A valid email is required' });
        const clientName = fullName(firstName, lastName);

        const { data: created, error } = await db.from(TABLE)
          .insert({
            token: newToken(),
            client_first_name: firstName,
            client_last_name: lastName || null,
            client_name: clientName,
            client_email: clientEmail,
            // Pre-fills the form's first step with what we already know.
            form: sanitizeForm({ contactName: clientName, contactEmail: clientEmail }),
            created_by: adminUser.id,
          })
          .select('*')
          .single();
        if (error) {
          console.error('[custom-site-admin] create failed:', error.message);
          return reply(500, { error: 'Could not add the customer' });
        }
        await logEvent(db, created.id, 'created', {}, actor);
        if (!body.sendEmail) return reply(200, { project: forAdmin(created) });
        const { project, emailError } = await sendWelcome(db, created, body.note, actor);
        return reply(200, { project: forAdmin(project), emailError });
      }

      case 'send-welcome': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        if (current.stage === 'archived') return reply(400, { error: 'This project is archived. Move it to another stage first.' });
        const { project, emailError } = await sendWelcome(db, current, body.note, actor);
        return reply(emailError ? 502 : 200, { project: forAdmin(project), error: emailError });
      }

      case 'update': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        const patch = {};
        const events = [];

        if ('stage' in body) {
          if (!STAGE_IDS.includes(body.stage)) return reply(400, { error: 'Unknown stage' });
          if (body.stage !== current.stage) {
            patch.stage = body.stage;
            events.push(['stage', { from: current.stage, to: body.stage }]);
          }
        }
        if ('adminNotes' in body) patch.admin_notes = clean(body.adminNotes, 20000);
        if ('siteUrl' in body) {
          const raw = clean(body.siteUrl, 500);
          const url = raw ? safeHref(raw) : null;
          if (raw && !url) return reply(400, { error: 'Enter a web address like https://example.com' });
          if (url !== (current.site_url || null)) {
            patch.site_url = url;
            events.push(['site_url', { url }]);
          }
        }
        if ('paid' in body) {
          const paid = !!body.paid;
          if (paid !== !!current.paid_at) {
            patch.paid_at = paid ? new Date().toISOString() : null;
            events.push(['paid', { paid }]);
          }
        }
        const details = {};
        if ('firstName' in body || 'lastName' in body) {
          const first = 'firstName' in body ? clean(body.firstName, 80) : current.client_first_name;
          const last = 'lastName' in body ? clean(body.lastName, 80) : current.client_last_name;
          if (!first) return reply(400, { error: 'First name is required' });
          details.client_first_name = first;
          details.client_last_name = last || null;
          details.client_name = fullName(first, last);
        }
        if ('clientEmail' in body) {
          const v = clean(body.clientEmail, 200).toLowerCase();
          if (!isEmail(v)) return reply(400, { error: 'A valid email is required' });
          details.client_email = v;
        }
        if ('clientPhone' in body) details.client_phone = clean(body.clientPhone, 40) || null;
        if ('businessName' in body) details.business_name = clean(body.businessName, 160) || null;
        const changed = Object.entries(details).filter(([k, v]) => v !== current[k]);
        if (changed.length) {
          Object.assign(patch, Object.fromEntries(changed));
          events.push(['details', { fields: changed.map(([k]) => k) }]);
        }

        if (!Object.keys(patch).length) return reply(200, { project: forAdmin(current) });
        const { data, error } = await db.from(TABLE).update(patch).eq('id', current.id).select('*').single();
        if (error) {
          console.error('[custom-site-admin] update failed:', error.message);
          return reply(500, { error: 'Could not save' });
        }
        for (const [type, data_] of events) await logEvent(db, current.id, type, data_, actor);
        return reply(200, { project: forAdmin(data) });
      }

      case 'email-customer': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        const template = body.template;
        if (template !== 'draft' && template !== 'live') return reply(400, { error: 'Unknown email' });
        if (!current.site_url) return reply(400, { error: 'Add the site link under Build first' });
        const to = current.client_email;
        try {
          await (template === 'draft' ? customSiteDraft : customSiteLive)({
            to,
            replyTo: isEmail(actor) ? actor : undefined,
            firstName: current.client_first_name,
            businessName: current.business_name,
            siteUrl: current.site_url,
            note: clean(body.note, 2000),
          });
        } catch (e) {
          const message = e?.message || 'Email failed to send';
          await logEvent(db, current.id, 'email_failed', { template, to, error: message.slice(0, 200) }, actor);
          return reply(502, { error: message });
        }
        await logEvent(db, current.id, 'email', { template, to }, actor);
        // Sending the draft puts it with the customer; "you're live" means live.
        const nextStage = template === 'draft' ? 'in_review' : 'live';
        if (current.stage === nextStage) return reply(200, { project: forAdmin(current) });
        const { data, error } = await db.from(TABLE).update({ stage: nextStage }).eq('id', current.id).select('*').single();
        if (error) return reply(200, { project: forAdmin(current) });
        await logEvent(db, current.id, 'stage', { from: current.stage, to: nextStage }, actor);
        return reply(200, { project: forAdmin(data) });
      }

      case 'design-save': {
        const design = sanitizeDesign(body.design, { imageUrlPrefix: siteImagesPrefix() });
        // The launch list, a "Suggest a design" result and a brand-system run
        // are written by their own actions and background functions, never
        // by the setup form: carry them over. updated_at guards against one
        // of those landing between this read and write (then re-read).
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = await loadProject(db, body.id);
          if (!current) return reply(404, { error: 'Project not found' });
          if (runLive(current)) return reply(409, { error: 'Wait for the copy to finish first' });
          const prev = current.design && typeof current.design === 'object' && !Array.isArray(current.design) ? current.design : {};
          const next = { ...design };
          for (const key of SERVER_DESIGN_KEYS) if (prev[key] !== undefined) next[key] = prev[key];
          // A site, once created, keeps its id.
          if (current.site_id) next.siteId = current.site_id;
          let q = db.from(TABLE).update({ design: next }).eq('id', current.id);
          if (current.updated_at) q = q.eq('updated_at', current.updated_at);
          const { data, error } = await q.select('*').maybeSingle();
          if (error) return reply(500, { error: 'Could not save the design' });
          if (data) return reply(200, { project: forAdmin(data) });
        }
        return reply(409, { error: 'The project changed while saving. Try again.' });
      }

      case 'design-generate': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        if (current.handed_over_at) return reply(409, { error: 'This site was already handed over to the customer' });
        const problems = designProblems(current.design || {});
        if (problems.length) return reply(400, { error: `Fill in before generating: ${problems.join(', ')}`, problems });
        if (runLive(current)) return reply(409, { error: 'The copy is already being written' });
        const startedAt = new Date().toISOString();
        // Writing the site means design has started.
        const toDesigning = ['new', 'invited', 'form_started', 'form_received'].includes(current.stage);
        const { data, error } = await db.from(TABLE).update({
          design_status: 'generating', design_error: null, design_started_at: startedAt, design_finished_at: null,
          ...(toDesigning ? { stage: 'designing' } : {}),
        }).eq('id', current.id).select('*').single();
        if (error) return reply(500, { error: 'Could not start' });
        await logEvent(db, current.id, 'design_started', {}, actor);
        if (toDesigning) await logEvent(db, current.id, 'stage', { from: current.stage, to: 'designing' }, actor);
        return reply(200, { project: forAdmin(data), startedAt });
      }

      case 'design-release': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        const sameRun = Date.parse(current.design_started_at || '') === Date.parse(body.startedAt || '');
        if (current.design_status === 'generating' && sameRun) {
          const message = `Couldn't start writing the site: ${clean(body.error, 200) || 'unknown error'}`;
          await db.from(TABLE).update({ design_status: 'failed', design_error: message, design_finished_at: new Date().toISOString() }).eq('id', current.id);
          await logEvent(db, current.id, 'design_failed', { error: message.slice(0, 200) }, actor);
        }
        return reply(200, { ok: true });
      }

      // launch-save { id, launch: { checked?: { itemId: true|false }, round?,
      // roundsIncluded?, notes? } } → the Launch card's change, merged into
      // design.launch. Also after hand-over: "Handed over" is on the list.
      case 'launch-save': {
        if (!body.launch || typeof body.launch !== 'object' || Array.isArray(body.launch)) {
          return reply(400, { error: 'Nothing to save' });
        }
        const [status, out] = await saveLaunch(db, body.id, body.launch, actor);
        return reply(status, out);
      }

      case 'handover-check': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        const account = await findCustomerAccount(db, current.client_email);
        return reply(200, { account });
      }

      case 'handover': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        if (runLive(current)) return reply(409, { error: 'Wait for the copy to finish first' });
        let result;
        try {
          result = await handOverSite({ db, project: current, compPro: !!body.compPro });
        } catch (e) {
          return reply(e.status || 500, { error: e.message || 'Could not hand over the site' });
        }
        const { data } = await db.from(TABLE).update({
          customer_user_id: result.userId, handed_over_at: new Date().toISOString(),
        }).eq('id', current.id).select('*').single();
        await logEvent(db, current.id, 'handover', {
          to: current.client_email, newAccount: result.newAccount, compPro: !!body.compPro, moved: result.moved,
        }, actor);
        const project = data || current;
        const site = await siteSummary(db, project.site_id);
        const emailError = body.sendEmail === false ? null : await sendAccessEmail(db, project, { newAccount: result.newAccount, site, actor });
        return reply(200, { project: forAdmin(project), newAccount: result.newAccount, emailError });
      }

      case 'handover-email': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        if (!current.handed_over_at) return reply(400, { error: 'Hand the site over first' });
        // A new account's first email held a set-password link; resending
        // makes a fresh one if the customer never signed in.
        const { data: authUser } = current.customer_user_id
          ? await db.auth.admin.getUserById(current.customer_user_id)
          : { data: null };
        const neverSignedIn = !authUser?.user?.last_sign_in_at;
        const site = await siteSummary(db, current.site_id);
        const emailError = await sendAccessEmail(db, current, { newAccount: neverSignedIn, site, actor });
        if (emailError) return reply(502, { error: emailError });
        return reply(200, { ok: true });
      }

      case 'reset-link': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        const { data, error } = await db.from(TABLE).update({ token: newToken() }).eq('id', current.id).select('*').single();
        if (error) return reply(500, { error: 'Could not replace the link' });
        await logEvent(db, current.id, 'link_reset', {}, actor);
        return reply(200, { project: forAdmin(data) });
      }

      case 'delete': {
        const current = await loadProject(db, body.id);
        if (!current) return reply(404, { error: 'Project not found' });
        await removeProjectFiles(db, current.id);
        const { error } = await db.from(TABLE).delete().eq('id', current.id);
        if (error) return reply(500, { error: 'Could not delete the project' });
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[custom-site-admin] failed:', e?.message || e);
    return reply(e.status || 500, { error: e.status ? e.message : 'Something went wrong' });
  }
};
