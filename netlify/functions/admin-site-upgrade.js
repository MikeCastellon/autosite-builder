// POST /.netlify/functions/admin-site-upgrade
//
// Admin > Site upgrades (src/components/admin/SiteUpgradesTab.jsx). Super
// admins only. Rolls the new template designs out to owners' live sites:
// the admin's browser builds each page exactly as the owner's dashboard
// Republish would (exportHtml only runs in a browser); this function reads
// the live page, backs it up and uploads the new one. One `action` per call:
//   live    { siteId }                  → the live page (+ /book page) from R2,
//                                         and the site's hold, if any
//   inputs  { siteId }                  → the owner's Google reviews / Instagram
//                                         widget keys (RLS hides another user's
//                                         widget_configs from the admin's client)
//   publish { siteId, htmlContent, bookingPageHtml? }
//                                       → back up the live page, upload the new
//                                         one, stamp published_at
//   backup  { siteId }                  → back up the live page now (before a
//                                         flagged site is republished by hand)
//   backups { siteId }                  → this site's backups, newest first
//   restore { siteId, backupId }        → back up the live page, put the backup
//                                         live, and put the site on hold
//   hold    { siteId, held, note? }     → put the site on hold / release it
// Owner emails ("your website just got an upgrade", _lib/siteUpgradeEmail.js):
//   emailStatus  { siteIds }            → each site's email marker, its owner's
//                                         address and greeting, whether email
//                                         is set up, and a run in progress
//   emailPreview { siteId }             → the email its owner would get, the
//                                         address it would go to, and why it
//                                         would be skipped
//   emailSend    { siteIds, confirm: "SEND", runId }
//                                       → email the owners: one email per owner
//                                         (listing all of that owner's sites in
//                                         the call), per-site results
//   emailSend    { siteIds, testTo }    → one copy to the admin's own address
//                                         instead; nothing is recorded
//   emailRelease { runId }              → the run is over: free the lease
//   emailResolve { siteId, outcome: "sent" | "not_sent" }
//                                       → settle an unconfirmed email after
//                                         checking Postmark's Activity
//
// Safety:
//   - The slug always comes from the sites row. Writes go through
//     resolvePublishSlug, which refuses shared, invalid and reserved slugs;
//     a site without a slug is refused (admins never assign one here).
//   - Publish: only live websites (published_url set, site_type website),
//     never one on the manual check list (UPGRADE_MANUAL_SKIP) or on hold,
//     and only once sites.published_at exists (it records which sites are
//     done; without it a later run would republish them all again).
//   - Nothing is overwritten until a backup of it is stored; a failed
//     backup aborts. Backups live under `_backups/<site id>/` (r2.js), so a
//     site only ever lists and restores its own, even after its slug passes
//     to another row. A restore also refuses a page whose widgets carry
//     another site's id.
//   - A restore puts the site on hold, so the next "Republish all" skips
//     it until an admin releases the hold.
//   - The HTML must be this site's page built on the production app: its
//     widget scripts carry this site's id and load from
//     PRODUCTION_APP_ORIGIN (a page built on a deploy preview or localhost
//     would point the live site's booking widget there).
//   - Every action is logged with the admin's id, the site id and the slug;
//     each backup's meta.json and the hold marker record the admin too.
//   - Owner emails go only to the owners of live websites moved to the new
//     design (published_at on or after SITE_UPGRADE_RELEASE_DATE, created
//     before it, on a new-design template, not on hold, an upgrade backup
//     of the old page, and a new-design page of this site live), never to
//     super admins or internal/test accounts, and never twice for a site:
//     each site's marker (_backups/<site id>/upgrade-email.json) is
//     claimed ("sending") before the email goes to Postmark and becomes
//     "sent" or "refused" after. A claim that stays (no answer, a cut-off
//     call, a lost write) blocks the site until an admin checks Postmark
//     and resolves it. One run at a time: a lease (upgradeEmailRunKey)
//     refuses another admin's or tab's run, and a claim is read back
//     before sending. A real send needs confirm "SEND", the production app
//     (the tab's guard, checked here too) and POSTMARK_UPGRADE_STREAM; a
//     test goes only to the signed-in admin's own address. Sends are
//     sequential and stop at the first error that is not about one
//     recipient; every result so far is returned.
//
// The page checks, backup, upload, restore and hold steps live in
// _shared/siteUpgradeOps.js, which the terminal tool (scripts/site-upgrade/)
// runs too, so both refuse and write the same way.
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_shared/adminAuth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { isReservedSlug, isValidSlug } from './_shared/slug.js';
import { isSlugShared } from './_shared/slugClaim.js';
import {
  BACKUP_ID_RE, backupLivePages, isMissingColumnError, listBackups, livePageKey, r2GetJson, r2GetText, r2PutJson,
  setPublishedAt, upgradeEmailKey, upgradeEmailRunKey, holdKey,
} from './_shared/r2.js';
import {
  MAX_BOOKING_BYTES, MAX_HTML_BYTES, assertNotHeld, backupAndUpload, byteLength, checkPublishRequest, fail,
  holdAfterRestore, holdMarker, holdState, liveFile, readableSlug, restoreBackup, writableSlug, writeHold,
} from './_shared/siteUpgradeOps.js';
import {
  PRODUCTION_APP_ORIGIN, isEmailAddress, upgradeEmailMarkerState, upgradeEmailOwnerSkip,
  upgradeEmailPageSkip, upgradeEmailSiteSkip, upgradeEmailSiteUrl,
} from '../../src/lib/siteUpgrade.js';
import {
  greetingName, sendSiteUpgradeEmail, siteUpgradeEmail, upgradeEmailConfig, upgradeEmailConfigProblem,
  upgradeEmailStreamInfo,
} from './_lib/siteUpgradeEmail.js';

export { MAX_BOOKING_BYTES, MAX_HTML_BYTES };

const TAG = '[admin-site-upgrade]';
const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || 'autocaregeniushub.com';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same as src/lib/siteRender.js WIDGET_KEY_TYPES (that module pulls in the
// template registry, which has no place in a function bundle).
const WIDGET_KEY_TYPES = ['instagram-feed', 'google-reviews'];

async function loadSite(db, siteId) {
  if (typeof siteId !== 'string' || !UUID_RE.test(siteId)) throw fail(400, 'A valid siteId is required');
  const { data, error } = await db
    .from('sites')
    .select('id, user_id, slug, published_url, site_type, scheduler_enabled')
    .eq('id', siteId)
    .maybeSingle();
  if (error) {
    console.error(`${TAG} site ${siteId} could not be loaded:`, error.message);
    throw fail(500, 'Could not load the site');
  }
  if (!data) throw fail(404, 'Site not found');
  return data;
}

// published_at records which sites are on the new design: the tab leaves
// them out of "Republish all", and owners get their badge from it. Without
// the column (migration 20261004_sites_published_at.sql not applied) an
// upgrade would leave no record, so it is refused.
async function requirePublishedAtColumn(db, siteId) {
  const { error } = await db.from('sites').select('id, published_at').eq('id', siteId).maybeSingle();
  if (!error) return;
  if (isMissingColumnError(error)) {
    throw fail(409, 'Apply migration 20261004_sites_published_at.sql before republishing: it records which sites are done and drives the owners\' badge');
  }
  console.error(`${TAG} published_at could not be read for site ${siteId}:`, error.message);
  throw fail(500, 'Could not load the site');
}

// ─── Owner emails ─────────────────────────────────────────────────────

// Sites per emailSend call (the tab sends a few owners at a time) and per
// emailStatus call.
export const MAX_EMAIL_SITES = 25;
export const MAX_STATUS_SITES = 200;
// emailSend's time limits, counted from the start of the request (the
// reads before the first send count too), so a call ends inside Netlify's
// 10 s function limit: a new owner is started only within
// EMAIL_SEND_BUDGET_MS (the first owner of a call within
// EMAIL_FIRST_SEND_MS, so every call gets somewhere), and a failed marker
// write is retried only until EMAIL_HARD_LIMIT_MS. The owners left come
// back as "deferred" and the tab sends them in its next call. Should a
// call be cut off anyway, the claim written before the send keeps the site
// from being emailed again until an admin resolves it.
export const EMAIL_SEND_BUDGET_MS = 4000;
export const EMAIL_FIRST_SEND_MS = 5000;
export const EMAIL_HARD_LIMIT_MS = 8500;
// Every marker and run-lease read or write around a send gives up after
// this (one send's own limit is in siteUpgradeEmail.js).
const R2_QUICK = { timeoutMs: 1500 };
// How long a run holds the lease after its last call: longer than the gap
// between the tab's calls; a tab closed mid-run frees it after this.
export const EMAIL_RUN_LEASE_MS = 45_000;
export const SEND_CONFIRM = 'SEND';
const RUN_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const EMAIL_SITE_COLUMNS = 'id, user_id, slug, published_url, site_type, template_id, scheduler_enabled, business_info, custom_domain, custom_domain_status, created_at';

function siteIdList(value, max) {
  if (!Array.isArray(value) || !value.length) throw fail(400, 'siteIds must be a list of site ids');
  const ids = [...new Set(value)];
  if (ids.length > max) throw fail(400, `At most ${max} sites per call`);
  if (!ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) throw fail(400, 'Every siteId must be a valid id');
  return ids;
}

// A few at a time: R2 and the auth API get no burst from one admin click.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Sites with published_at. Without the column (migration not applied) no
// site counts as upgraded: `strict` (a real send) refuses; otherwise the
// rows come back without it.
async function loadEmailSites(db, column, value, { strict }) {
  const query = (cols) => {
    const q = db.from('sites').select(cols);
    return Array.isArray(value) ? q.in(column, value) : q.eq(column, value);
  };
  let { data, error } = await query(`${EMAIL_SITE_COLUMNS}, published_at`);
  let tracked = true;
  if (error && isMissingColumnError(error)) {
    if (strict) throw fail(409, 'Apply migration 20261004_sites_published_at.sql first: it records which sites are on the new design');
    tracked = false;
    ({ data, error } = await query(EMAIL_SITE_COLUMNS));
  }
  if (error) {
    console.error(`${TAG} sites could not be loaded for email:`, error.message);
    throw fail(500, 'Could not load the sites');
  }
  const rows = data || [];
  return { sites: tracked ? rows : rows.map((r) => ({ ...r, published_at: null })), tracked };
}

// The owners as the email needs them, by user id: the sign-in address
// (auth, else profiles.email), the name to greet them with (profiles, else
// the sign-up metadata, never one of their business names) and whether
// they are a super admin. null without a readable profile: an owner whose
// admin flag is unknown is never emailed.
async function loadOwners(db, userIds) {
  const ids = [...new Set(userIds.filter((id) => typeof id === 'string' && id))];
  const owners = new Map(ids.map((id) => [id, null]));
  if (!ids.length) return owners;
  const [profilesRes, sitesRes, users] = await Promise.all([
    db.from('profiles').select('id, email, first_name, is_super_admin').in('id', ids),
    db.from('sites').select('user_id, business_info').in('user_id', ids),
    mapLimit(ids, 4, async (id) => {
      try {
        const { data, error } = await db.auth.admin.getUserById(id);
        if (error) console.error(`${TAG} account ${id} could not be read:`, error.message || error);
        return [id, data?.user || null];
      } catch (e) {
        console.error(`${TAG} account ${id} could not be read:`, e?.message || e);
        return [id, null];
      }
    }),
  ]);
  if (profilesRes.error) console.error(`${TAG} owner profiles could not be read:`, profilesRes.error.message);
  if (sitesRes.error) console.error(`${TAG} owners' business names could not be read:`, sitesRes.error.message);
  const userById = new Map(users);
  const names = new Map();
  for (const s of sitesRes.data || []) {
    const n = s.business_info?.businessName;
    if (typeof n !== 'string' || !n.trim()) continue;
    if (!names.has(s.user_id)) names.set(s.user_id, []);
    names.get(s.user_id).push(n);
  }
  for (const p of profilesRes.data || []) {
    if (!owners.has(p.id)) continue;
    const user = userById.get(p.id);
    const meta = user?.user_metadata || {};
    owners.set(p.id, {
      id: p.id,
      email: String(user?.email || p.email || '').trim().toLowerCase(),
      firstName: greetingName([p.first_name, meta.first_name, meta.full_name, meta.name], names.get(p.id) || []),
      isSuperAdmin: p.is_super_admin === true,
    });
  }
  return owners;
}

// The site's email marker as stored, or null when there is none. One that
// is there but unreadable comes back as { unreadable: true } (it blocks the
// site like an unconfirmed send). Throws when R2 can't be read: "emailed
// or not" is never a guess.
async function readEmailMarker(siteId, opts) {
  const r = await r2GetText(upgradeEmailKey(siteId), opts);
  if (!r.found) return null;
  try {
    const v = JSON.parse(r.body);
    if (v && typeof v === 'object') return v;
  } catch { /* below */ }
  return { unreadable: true };
}

// The marker as the browser sees it (upgradeEmailMarkerState in
// src/lib/siteUpgrade.js names the states).
function emailState(m) {
  const state = upgradeEmailMarkerState(m);
  if (!state) return null;
  const str = (v) => (typeof v === 'string' ? v : null);
  const who = (b) => (b && typeof b === 'object' ? { id: str(b.id), email: str(b.email) } : null);
  return {
    state,
    at: str(m.sentAt) || str(m.at),
    to: str(m.to),
    messageId: str(m.messageId),
    by: who(m.by),
    error: str(m.error),
    resolved: m.resolved && typeof m.resolved === 'object'
      ? { by: who(m.resolved.by), at: str(m.resolved.at), outcome: str(m.resolved.outcome) }
      : null,
  };
}

// Each site's marker and hold: { marker, hold } per site id, or { error }
// when either could not be read.
async function emailStates(sites) {
  return new Map(await mapLimit(sites, 6, async (s) => {
    try {
      const [marker, hold] = await Promise.all([readEmailMarker(s.id), r2GetJson(holdKey(s.id))]);
      return [s.id, { marker, hold }];
    } catch (e) {
      return [s.id, { error: e.message }];
    }
  }));
}

// Whether the live page shows the site was moved to the new design
// (upgradeEmailPageSkip): an upgrade backup, and a new-design page of this
// site live. { skip } per site id, or { error } when R2 could not be read.
async function pageStates(sites) {
  return new Map(await mapLimit(sites, 4, async (s) => {
    try {
      if (!s.slug || !isValidSlug(s.slug) || isReservedSlug(s.slug)) {
        return [s.id, { skip: { code: 'live_missing', text: 'Has no usable web address' } }];
      }
      const [backups, live] = await Promise.all([listBackups(s.id), r2GetText(livePageKey(s.slug, 'index.html'))]);
      return [s.id, { skip: upgradeEmailPageSkip({ backupIds: backups.map((b) => b.id), liveHtml: live.found ? live.body : null, siteId: s.id }) }];
    } catch (e) {
      return [s.id, { error: e.message }];
    }
  }));
}

function siteRef(s) {
  return { id: s.id, businessName: s.business_info?.businessName || null, siteUrl: upgradeEmailSiteUrl(s) };
}

// One owner's email about `group` (their sites, the first one leading).
function ownerMessage(owner, group) {
  const [primary, ...rest] = group;
  return siteUpgradeEmail({
    firstName: owner?.firstName,
    businessName: primary.business_info?.businessName,
    siteUrl: upgradeEmailSiteUrl(primary),
    otherSites: rest.map((s) => ({ businessName: s.business_info?.businessName, siteUrl: upgradeEmailSiteUrl(s) })),
    booking: group.some((s) => s.scheduler_enabled === true),
  });
}

// ─── The run lease: one owner-email run at a time ─────────────────────
// The tab makes a runId per "Email N owners" and sends it with every call
// of that run. A call from another run is refused while the lease is
// held, so two admins (or two browser tabs) can never email the same
// owners at once. Each call extends it; the tab releases it at the end.

function leaseActive(lease, now = Date.now()) {
  return !!lease && lease.released !== true && Date.parse(lease.expiresAt || '') > now;
}

function runView(lease) {
  if (!lease) return null;
  const str = (v) => (typeof v === 'string' ? v : null);
  return { by: lease.by && typeof lease.by === 'object' ? { id: str(lease.by.id), email: str(lease.by.email) } : null, startedAt: str(lease.startedAt), expiresAt: str(lease.expiresAt) };
}

function runBusy(lease) {
  const who = lease?.by?.email || 'Another admin';
  const when = lease?.startedAt ? ` (started ${lease.startedAt.slice(11, 16)} UTC)` : '';
  return fail(409, `${who} is sending owner emails${when}. Try again once that run has finished; a run that was left open frees itself within a minute.`);
}

async function readRunLease() {
  try {
    return await r2GetJson(upgradeEmailRunKey(), R2_QUICK);
  } catch (e) {
    throw fail(502, `Could not check whether another send is running (${e.message}), so nothing was sent`);
  }
}

// Takes (or extends) the lease for runId, or throws 409 when another run
// holds it. Written, then read back: of two runs starting together only
// the one whose lease stayed goes on.
async function acquireRunLease(runId, by) {
  const now = Date.now();
  const cur = await readRunLease();
  if (leaseActive(cur, now) && cur.runId !== runId) throw runBusy(cur);
  const lease = {
    runId,
    by,
    startedAt: cur?.runId === runId && typeof cur.startedAt === 'string' ? cur.startedAt : new Date(now).toISOString(),
    expiresAt: new Date(now + EMAIL_RUN_LEASE_MS).toISOString(),
  };
  try {
    await r2PutJson(upgradeEmailRunKey(), lease, 'R2 email run', R2_QUICK);
  } catch (e) {
    throw fail(502, `Could not start the send (${e.message}), so nothing was sent`);
  }
  const back = await readRunLease();
  if (back?.runId !== runId) throw runBusy(back);
  return lease;
}

// Marker writes after a send: retried, but only while there is time left.
async function writeMarker(siteId, value, label, deadline) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0 && Date.now() > deadline) break;
    try {
      await r2PutJson(upgradeEmailKey(siteId), value, label, R2_QUICK);
      return null;
    } catch (e) {
      lastErr = e;
    }
  }
  return lastErr;
}

export const handler = async (event) => {
  // emailSend's time limits count from here (EMAIL_SEND_BUDGET_MS).
  const startedAt = Date.now();
  const CORS = jsonHeaders(event.headers);
  const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(event.headers) };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }
  if (!body || typeof body !== 'object') return reply(400, { error: 'Invalid JSON' });

  const db = supabaseAdmin();
  let admin;
  let adminProfile;
  try {
    ({ user: admin, profile: adminProfile } = await requireSuperAdmin(event, db, 'admin-site-upgrade'));
  } catch (e) {
    return reply(e.status || 401, { error: e.message || 'Not signed in' });
  }
  const by = { id: admin.id, email: adminProfile?.email || null };

  // Client values reach the log only trimmed to a safe charset.
  const clean = (v) => String(v ?? '-').slice(0, 40).replace(/[^\w-]/g, '?');
  const action = clean(body.action);
  let site = null;
  let slug = null;
  const log = (msg) => console.log(`${TAG} ${action} admin=${admin.id} site=${site?.id || clean(body.siteId)} slug=${slug || site?.slug || '-'} ${msg}`);

  try {
    switch (body.action) {
      case 'live': {
        site = await loadSite(db, body.siteId);
        slug = readableSlug(site);
        const [index, book, shared, hold] = await Promise.all([
          liveFile(livePageKey(slug, 'index.html'), MAX_HTML_BYTES),
          liveFile(livePageKey(slug, 'book/index.html'), MAX_BOOKING_BYTES * 4),
          isSlugShared(db, site),
          r2GetJson(holdKey(site.id)),
        ]);
        log(`read index=${index.found ? index.size : 'none'} book=${book.found ? book.size : 'none'}${shared ? ' shared' : ''}${hold?.held === true ? ' held' : ''}`);
        return reply(200, { slug, shared, index, book, hold: holdState(hold) });
      }

      case 'inputs': {
        site = await loadSite(db, body.siteId);
        const { data, error } = await db
          .from('widget_configs')
          .select('type, widget_key')
          .eq('user_id', site.user_id)
          .in('type', WIDGET_KEY_TYPES)
          .order('created_at', { ascending: false });
        if (error) {
          console.error(`${TAG} widget keys for site ${site.id} could not be read:`, error.message);
          return reply(502, { error: 'Could not read the owner\'s widgets' });
        }
        log(`widgets=${(data || []).length}`);
        return reply(200, { widgets: (data || []).map((w) => ({ type: w.type, widget_key: w.widget_key })) });
      }

      case 'backups': {
        site = await loadSite(db, body.siteId);
        const backups = await listBackups(site.id);
        log(`listed ${backups.length}`);
        return reply(200, { slug: site.slug, backups });
      }

      case 'backup': {
        site = await loadSite(db, body.siteId);
        slug = readableSlug(site);
        // A shared slug may be serving another row's page: never file that
        // under this site.
        if (await isSlugShared(db, site)) throw fail(409, `Another site also holds "${slug}"`);
        const backup = await backupLivePages({ slug, siteId: site.id, reason: 'manual', by });
        if (!backup.backupId) throw fail(404, 'No live page was found to back up');
        log(`backup=${backup.backupId} files=${backup.files.join(',')}`);
        return reply(200, { slug, backupId: backup.backupId, backupFiles: backup.files });
      }

      case 'hold': {
        if (typeof body.held !== 'boolean') throw fail(400, 'held must be true or false');
        site = await loadSite(db, body.siteId);
        const marker = await writeHold(holdMarker({ siteId: site.id, held: body.held, note: body.note, by }));
        log(body.held ? 'held' : 'released');
        return reply(200, { hold: holdState(marker) });
      }

      case 'publish': {
        site = await loadSite(db, body.siteId);
        const { htmlContent, bookingPageHtml } = body;
        checkPublishRequest(site, { htmlContent, bookingPageHtml });
        slug = await writableSlug(db, site);
        await requirePublishedAtColumn(db, site.id);
        await assertNotHeld(site.id);
        log(`start bytes=${byteLength(htmlContent)}${bookingPageHtml ? ' +book' : ''}`);

        let backup;
        try {
          backup = await backupAndUpload({ slug, siteId: site.id, htmlContent, bookingPageHtml, by, log });
        } catch (e) {
          if (!e.status) throw e;
          return reply(e.status, { error: e.message, ...(e.backupId ? { backupId: e.backupId } : {}) });
        }

        // Same row bookkeeping as publish-site: published_url (unchanged
        // here, the slug is the stored one), then published_at on its own.
        const publishedUrl = `https://${slug}.${PUBLISH_DOMAIN}`;
        const { error: urlErr } = await db.from('sites').update({ published_url: publishedUrl }).eq('id', site.id);
        if (urlErr) console.error(`${TAG} published_url update failed for site ${site.id}:`, urlErr.message);
        const publishedAt = await setPublishedAt(db, site.id);
        log(`published backup=${backup.backupId} published_at=${publishedAt || 'not recorded'}`);
        return reply(200, { slug, publishedUrl, backupId: backup.backupId, backupFiles: backup.files, publishedAt: publishedAt || null });
      }

      case 'restore': {
        const { backupId } = body;
        if (typeof backupId !== 'string' || !BACKUP_ID_RE.test(backupId)) throw fail(400, 'A valid backupId is required');
        site = await loadSite(db, body.siteId);
        slug = await writableSlug(db, site);
        log(`start backup=${backupId}`);

        // Only this site's folder is ever read (backups are keyed by site
        // id), the files must be this site's pages, and the live page is
        // backed up before it is overwritten.
        let restored;
        try {
          restored = await restoreBackup({ slug, siteId: site.id, backupId, by, log });
        } catch (e) {
          if ('safetyBackupId' in e) return reply(500, { error: e.message, safetyBackupId: e.safetyBackupId });
          if (e.status === 502) return reply(502, { error: e.message });
          throw e;
        }
        const { files, safetyBackupId } = restored;

        // The restored page's publish time is unknown: clear published_at
        // (null = "before tracking"), which also drops the dashboard's "New
        // design live" badge after undoing an upgrade.
        await setPublishedAt(db, site.id, null);
        // Hold the site, so the next check flags it and "Republish all"
        // cannot put the new design straight back.
        const { hold, holdError } = await holdAfterRestore({ siteId: site.id, backupId, safetyBackupId, by, log });
        log(`restored backup=${backupId} files=${files.join(',')} safety=${safetyBackupId || 'none'}${holdError ? '' : ' held'}`);
        return reply(200, { slug, restored: backupId, files, safetyBackupId, hold: holdError ? null : holdState(hold), holdError });
      }

      case 'emailStatus': {
        const ids = siteIdList(body.siteIds, MAX_STATUS_SITES);
        const { sites: rows } = await loadEmailSites(db, 'id', ids, { strict: false });
        const rowById = new Map(rows.map((r) => [r.id, r]));
        const [markers, owners, lease, streamInfo] = await Promise.all([
          mapLimit(ids, 8, async (id) => {
            try {
              return [id, { marker: emailState(await readEmailMarker(id)) }];
            } catch (e) {
              return [id, { error: e.message }];
            }
          }),
          loadOwners(db, rows.map((r) => r.user_id)),
          r2GetJson(upgradeEmailRunKey()).catch(() => null),
          upgradeEmailStreamInfo(),
        ]);
        const cfg = upgradeEmailConfig();
        const sitesOut = Object.fromEntries(markers.map(([id, st]) => {
          const owner = owners.get(rowById.get(id)?.user_id) || null;
          return [id, { ...st, to: owner?.email || null, greeting: owner ? owner.firstName || null : null }];
        }));
        log(`email status sites=${ids.length}`);
        return reply(200, {
          sites: sitesOut,
          config: {
            ready: cfg.ready, ownerReady: cfg.ownerReady, missing: cfg.missing, invalid: cfg.invalid, ownerMissing: cfg.ownerMissing,
            from: cfg.from || null, stream: cfg.stream, streamSet: cfg.streamSet, streamInfo,
          },
          run: leaseActive(lease) ? runView(lease) : null,
        });
      }

      case 'emailPreview': {
        if (typeof body.siteId !== 'string' || !UUID_RE.test(body.siteId)) throw fail(400, 'A valid siteId is required');
        const { sites: [row], tracked } = await loadEmailSites(db, 'id', [body.siteId], { strict: false });
        if (!row) throw fail(404, 'Site not found');
        site = row;
        if (!upgradeEmailSiteUrl(row)) throw fail(409, 'This site has no https address to link to');
        const owner = (await loadOwners(db, [row.user_id])).get(row.user_id);
        const st = (await emailStates([row])).get(row.id);
        if (st.error) throw fail(502, `Could not read whether this site's owner was emailed (${st.error})`);
        let skip = upgradeEmailSiteSkip(row, st) || upgradeEmailOwnerSkip(owner);
        if (!skip) {
          const page = (await pageStates([row])).get(row.id);
          if (page.error) throw fail(502, `Could not read the live page (${page.error})`);
          skip = page.skip;
        }

        // The owner's other sites that a send would put in the same email.
        let group = [row];
        if (!skip) {
          const { sites: theirs } = await loadEmailSites(db, 'user_id', row.user_id, { strict: false });
          const others = theirs
            .filter((s) => s.id !== row.id)
            .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
          const otherStates = await emailStates(others);
          const candidates = others.filter((s) => !otherStates.get(s.id).error && !upgradeEmailSiteSkip(s, otherStates.get(s.id)));
          const pages = await pageStates(candidates);
          group = [row, ...candidates.filter((s) => !pages.get(s.id).error && !pages.get(s.id).skip)];
        }
        const message = ownerMessage(owner, group);
        const cfg = upgradeEmailConfig();
        log(`email preview sites=${group.length}${skip ? ` skip=${skip.code}` : ''}`);
        return reply(200, {
          to: owner?.email || null,
          firstName: owner?.firstName || null,
          skip,
          marker: emailState(st.marker),
          publishedAtTracked: tracked,
          sites: group.map(siteRef),
          ...message,
          from: cfg.from || null,
          replyTo: cfg.replyTo || (isEmailAddress(by.email) ? by.email : null),
          stream: cfg.stream,
          streamSet: cfg.streamSet,
          ready: cfg.ready,
          ownerReady: cfg.ownerReady,
        });
      }

      case 'emailSend': {
        const ids = siteIdList(body.siteIds, MAX_EMAIL_SITES);
        const isTest = body.testTo != null;
        const testTo = isTest ? String(body.testTo).trim().toLowerCase() : null;
        const runId = typeof body.runId === 'string' ? body.runId : null;
        if (isTest) {
          // A test carries a real owner's name and business, so it only
          // ever goes to the admin sending it.
          const own = String(adminProfile?.email || admin.email || '').trim().toLowerCase();
          if (!isEmailAddress(testTo) || testTo !== own) throw fail(400, 'A test email goes to your own address only');
        } else {
          if (body.confirm !== SEND_CONFIRM) throw fail(400, `Type ${SEND_CONFIRM} to confirm`);
          if (!runId || !RUN_ID_RE.test(runId)) throw fail(400, 'A runId is required');
          // The tab only sends from the production app; a deploy preview
          // shares this server's keys, so it is refused here too.
          const origin = event.headers?.origin || event.headers?.Origin || '';
          if (origin !== PRODUCTION_APP_ORIGIN) throw fail(409, `Owner emails are only sent from ${PRODUCTION_APP_ORIGIN}`);
        }
        const cfg = upgradeEmailConfig();
        const problem = upgradeEmailConfigProblem(cfg, { toOwner: !isTest });
        if (problem) throw fail(503, problem);
        const replyTo = cfg.replyTo || (isEmailAddress(by.email) ? by.email : null);

        const { sites } = await loadEmailSites(db, 'id', ids, { strict: !isTest });
        const byId = new Map(sites.map((s) => [s.id, s]));
        const found = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
        const owners = await loadOwners(db, found.map((s) => s.user_id));

        if (isTest) {
          const primary = found.find((s) => upgradeEmailSiteUrl(s));
          if (!primary) throw fail(found.length ? 409 : 404, found.length ? 'None of these sites has an https address to link to' : 'Site not found');
          const owner = owners.get(primary.user_id);
          const group = found.filter((s) => s.user_id === primary.user_id && upgradeEmailSiteUrl(s));
          const message = ownerMessage(owner, group);
          let sent;
          try {
            sent = await sendSiteUpgradeEmail({ to: testTo, replyTo, ...message, subject: `[Test] ${message.subject}`, siteId: primary.id });
          } catch (e) {
            log(`email test FAILED: ${e.message}`);
            return reply(e.recipient ? 422 : 502, { error: e.message });
          }
          log(`email test sent sites=${group.map((s) => s.id).join(',')} messageId=${sent.messageId || '-'}`);
          return reply(200, {
            test: true, to: testTo, messageId: sent.messageId, subject: message.subject, stream: sent.stream,
            ownerEmail: owner?.email || null, sites: group.map(siteRef),
          });
        }

        // One run at a time, before anything is read for sending.
        await acquireRunLease(runId, by);

        // Per-site outcome, reported in the order asked:
        //   sent | skipped (code, reason) | failed (reason) | deferred (send
        //   again) | not_attempted (the run stopped first)
        // `marker`: the site's email marker as it now stands, when known.
        const results = new Map();
        const result = (id, r) => results.set(id, { siteId: id, ...r });
        for (const id of ids) if (!byId.has(id)) result(id, { status: 'skipped', code: 'not_found', reason: 'Site not found' });

        const states = await emailStates(found);
        const candidates = [];
        for (const s of found) {
          const st = states.get(s.id);
          if (st.error) {
            result(s.id, { status: 'failed', code: 'unreadable', reason: `Could not read whether its owner was emailed (${st.error}), so nothing was sent` });
            continue;
          }
          const skip = upgradeEmailSiteSkip(s, st) || upgradeEmailOwnerSkip(owners.get(s.user_id));
          if (skip) {
            result(s.id, { status: 'skipped', code: skip.code, reason: skip.text, marker: emailState(st.marker) });
            continue;
          }
          candidates.push(s);
        }
        const pages = await pageStates(candidates);
        const groups = new Map(); // owner id → their sites to email, in request order
        for (const s of candidates) {
          const page = pages.get(s.id);
          if (page.error) {
            result(s.id, { status: 'failed', code: 'unreadable', reason: `Could not read its live page (${page.error}), so nothing was sent` });
            continue;
          }
          if (page.skip) {
            result(s.id, { status: 'skipped', code: page.skip.code, reason: page.skip.text, marker: emailState(states.get(s.id).marker) });
            continue;
          }
          if (!groups.has(s.user_id)) groups.set(s.user_id, []);
          groups.get(s.user_id).push(s);
        }

        const deadline = startedAt + EMAIL_HARD_LIMIT_MS;
        let stopReason = null;
        let sentOwners = 0;
        let attempted = 0;
        for (const [ownerId, group] of groups) {
          const owner = owners.get(ownerId);
          const groupIds = group.map((s) => s.id);
          if (stopReason) {
            for (const id of groupIds) result(id, { status: 'not_attempted', reason: 'Not sent: the run stopped before this owner' });
            continue;
          }
          const elapsed = Date.now() - startedAt;
          if (elapsed > (attempted ? EMAIL_SEND_BUDGET_MS : EMAIL_FIRST_SEND_MS)) {
            for (const id of groupIds) result(id, { status: 'deferred', reason: 'Not sent yet: it goes out with the next batch' });
            continue;
          }
          attempted += 1;
          const message = ownerMessage(owner, group);
          const claimedAt = new Date().toISOString();
          const claimId = randomBytes(8).toString('hex');
          const record = (id, extra) => ({
            siteId: id, siteIds: groupIds, ownerId, to: owner.email, at: claimedAt, by, runId, claimId,
            stream: cfg.stream, subject: message.subject, ...extra,
          });
          const failAll = (r) => { for (const id of groupIds) result(id, { status: 'failed', to: owner.email, ...r }); };

          // 0. Read the markers again right before claiming (the reads above
          //    were before the sends of this call): a site claimed or
          //    emailed since is left alone.
          const fresh = await Promise.allSettled(groupIds.map((id) => readEmailMarker(id, R2_QUICK)));
          const freshErr = fresh.find((f) => f.status === 'rejected')?.reason;
          if (freshErr) {
            failAll({ code: 'unreadable', reason: `Could not read whether its owner was emailed (${freshErr.message}), so nothing was sent` });
            stopReason = `Stopped: ${freshErr.message}`;
            continue;
          }
          const taken = fresh.map((f) => f.value).find((m) => ['sending', 'sent', 'unreadable'].includes(upgradeEmailMarkerState(m)));
          if (taken) {
            for (const [i, id] of groupIds.entries()) {
              const skip = upgradeEmailSiteSkip(group[i], { marker: fresh[i].value }) || { code: 'claimed_elsewhere', text: 'Another send has this owner' };
              result(id, { status: 'skipped', code: skip.code, reason: skip.text, marker: emailState(fresh[i].value) });
            }
            log(`email owner=${ownerId} sites=${groupIds.join(',')} taken meanwhile`);
            continue;
          }

          // 1. Claim every site of this email before it goes to Postmark. A
          //    claim that stays ("sending") blocks the site until an admin
          //    resolves it, so an email whose outcome is unknown (no answer,
          //    a cut-off call, a lost marker write) is never sent twice.
          const claims = await Promise.allSettled(groupIds.map((id) => r2PutJson(upgradeEmailKey(id), record(id, { state: 'sending' }), 'R2 email claim', R2_QUICK)));
          const claimErr = claims.find((c) => c.status === 'rejected')?.reason;
          if (claimErr) {
            // Nothing was sent: undo the claims that were stored.
            const undo = await Promise.all(groupIds.map((id, i) => (claims[i].status === 'fulfilled'
              ? writeMarker(id, record(id, { state: 'cleared', clearedAt: new Date().toISOString(), error: 'The send could not be recorded first, so nothing was sent' }), 'R2 email record', deadline)
              : null)));
            const stuck = undo.some(Boolean);
            failAll({
              code: 'claim_failed',
              reason: `Could not record the send before sending (${claimErr.message}), so nothing was sent${stuck ? '. It may show as unconfirmed: clear it' : ''}`,
            });
            log(`email owner=${ownerId} sites=${groupIds.join(',')} claim FAILED: ${claimErr.message}`);
            stopReason = `Stopped: ${claimErr.message}`;
            continue;
          }
          // 2. Read the claims back: only the run whose claims stayed sends.
          const backs = await Promise.allSettled(groupIds.map((id) => readEmailMarker(id, R2_QUICK)));
          const backErr = backs.find((b) => b.status === 'rejected')?.reason;
          if (backErr) {
            failAll({ code: 'claim_unchecked', reason: `Nothing was sent: its claim could not be checked (${backErr.message}). It shows as unconfirmed: clear it`, marker: emailState(record(groupIds[0], { state: 'sending' })) });
            log(`email owner=${ownerId} sites=${groupIds.join(',')} claim check FAILED: ${backErr.message}`);
            stopReason = `Stopped: ${backErr.message}`;
            continue;
          }
          if (backs.some((b) => b.value?.claimId !== claimId)) {
            for (const id of groupIds) result(id, { status: 'skipped', code: 'claimed_elsewhere', reason: 'Another send claimed this owner at the same moment, so this run sent nothing' });
            log(`email owner=${ownerId} sites=${groupIds.join(',')} claimed elsewhere`);
            stopReason = 'Stopped: another send is running';
            continue;
          }

          // 3. Send.
          let sent;
          try {
            sent = await sendSiteUpgradeEmail({ to: owner.email, replyTo, ...message, siteId: group[0].id, toOwner: true });
          } catch (e) {
            log(`email owner=${ownerId} sites=${groupIds.join(',')} FAILED${e.uncertain ? ' (unknown outcome)' : ''}: ${e.message}`);
            if (e.uncertain) {
              // It may have gone out: the claim stays, so the site is not
              // emailed again until an admin checks Postmark and resolves it.
              failAll({ uncertain: true, reason: `${e.message} It shows as unconfirmed until you mark it sent or clear it.`, marker: emailState(record(groupIds[0], { state: 'sending' })) });
              stopReason = `${e.message} Nothing more was sent.`;
              continue;
            }
            // Refused: nothing went out, the site can be emailed again.
            const writes = await Promise.all(groupIds.map((id) => writeMarker(id, record(id, {
              state: 'refused', refusedAt: new Date().toISOString(), code: e.code || null, error: e.message,
            }), 'R2 email record', deadline)));
            for (const [i, id] of groupIds.entries()) {
              const markerError = writes[i] ? `Not sent, but still shows as unconfirmed (${writes[i].message}): clear it` : undefined;
              result(id, {
                status: 'failed', to: owner.email, reason: e.message, code: e.recipient ? 'refused_recipient' : 'refused',
                marker: emailState(record(id, { state: writes[i] ? 'sending' : 'refused', error: e.message })),
                ...(markerError ? { markerError } : {}),
              });
            }
            // One bad address doesn't stop the run; anything else (token,
            // sender, stream) would hit every owner.
            if (!e.recipient) stopReason = `Stopped: ${e.message}`;
            else if (writes.some(Boolean)) stopReason = `Stopped: ${writes.find(Boolean).message}`;
            continue;
          }

          // 4. Postmark has it: the claims become "sent".
          sentOwners += 1;
          const sentAt = new Date().toISOString();
          log(`emailed owner=${ownerId} sites=${groupIds.join(',')} messageId=${sent.messageId || '-'}`);
          const writes = await Promise.all(groupIds.map((id) => writeMarker(id, record(id, {
            state: 'sent', sentAt, messageId: sent.messageId, stream: sent.stream,
          }), 'R2 email record', deadline)));
          for (const [i, id] of groupIds.entries()) {
            const sentResult = { status: 'sent', to: owner.email, messageId: sent.messageId, at: sentAt };
            if (!writes[i]) {
              result(id, { ...sentResult, marker: emailState(record(id, { state: 'sent', sentAt, messageId: sent.messageId })) });
              continue;
            }
            log(`email record FAILED site=${id}: ${writes[i].message}`);
            result(id, {
              ...sentResult,
              marker: emailState(record(id, { state: 'sending' })),
              markerError: `Sent (Postmark message ${sent.messageId || 'id unknown'}), but not recorded as sent (${writes[i].message}). It shows as unconfirmed, so it is not sent again: mark it sent`,
            });
            stopReason = stopReason || `Stopped: an email went out but could not be recorded as sent (${writes[i].message})`;
          }
        }

        const list = ids.map((id) => results.get(id));
        const count = (status) => list.filter((r) => r.status === status).length;
        log(`email run=${runId} owners=${sentOwners} sent=${count('sent')} skipped=${count('skipped')} failed=${count('failed')} deferred=${count('deferred')}${stopReason ? ' STOPPED' : ''}`);
        return reply(200, { results: list, sentOwners, stopped: !!stopReason, stopReason });
      }

      // The tab's run is over: free the lease for other admins.
      case 'emailRelease': {
        if (typeof body.runId !== 'string' || !RUN_ID_RE.test(body.runId)) throw fail(400, 'A runId is required');
        const cur = await readRunLease();
        if (cur?.runId !== body.runId || cur.released === true) return reply(200, { released: false });
        await r2PutJson(upgradeEmailRunKey(), { ...cur, released: true, expiresAt: new Date().toISOString() }, 'R2 email run');
        log(`email run=${body.runId} released`);
        return reply(200, { released: true });
      }

      // An unconfirmed email ("sending": no answer from Postmark, or a
      // send that was never recorded), once an admin has checked Postmark's
      // Activity: outcome "sent" (it went out: never send again) or
      // "not_sent" (it did not: the owner can be emailed).
      case 'emailResolve': {
        if (body.outcome !== 'sent' && body.outcome !== 'not_sent') throw fail(400, 'outcome must be "sent" or "not_sent"');
        site = await loadSite(db, body.siteId);
        const lease = await readRunLease();
        if (leaseActive(lease)) throw runBusy(lease);
        const m = await readEmailMarker(site.id);
        const state = upgradeEmailMarkerState(m);
        if (state !== 'sending' && state !== 'unreadable') throw fail(409, 'Only an unconfirmed email can be marked sent or cleared');
        const next = {
          ...(state === 'unreadable' ? { siteId: site.id } : m),
          state: body.outcome === 'sent' ? 'sent' : 'cleared',
          resolved: { by, at: new Date().toISOString(), outcome: body.outcome },
        };
        await r2PutJson(upgradeEmailKey(site.id), next, 'R2 email record');
        log(`email resolved ${body.outcome}`);
        return reply(200, { marker: emailState(next) });
      }

      default:
        return reply(400, { error: 'Unknown action' });
    }
  } catch (e) {
    if (!e.status) console.error(`${TAG} ${action} failed:`, e?.message || e);
    else log(`refused ${e.status}: ${e.message}`);
    // Admins only: the message (e.g. an R2 error) helps them more than a
    // generic one.
    return reply(e.status || 500, { error: e?.message || 'Something went wrong' });
  }
};
