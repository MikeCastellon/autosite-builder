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
import { supabaseAdmin } from './_shared/auth.js';
import { requireSuperAdmin } from './_shared/adminAuth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { isReservedSlug, isValidSlug } from './_shared/slug.js';
import { isSlugShared, resolvePublishSlug } from './_shared/slugClaim.js';
import {
  BACKUP_ID_RE, BACKUP_META_FILE, backupKey, backupLivePages, holdKey, isMissingColumnError, listBackups,
  livePageKey, r2GetJson, r2GetText, r2PutHtml, r2PutJson, setPublishedAt, uploadSitePages,
} from './_shared/r2.js';
import { PRODUCTION_APP_ORIGIN, UPGRADE_MANUAL_SKIP, widgetScripts } from '../../src/lib/siteUpgrade.js';

const TAG = '[admin-site-upgrade]';
const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || 'autocaregeniushub.com';

// Netlify caps a function request and response at 6 MB. A built page is
// usually 50-300 KB; one past 3 MB holds inline images and is flagged.
export const MAX_HTML_BYTES = 3 * 1024 * 1024;
// The /book page is a ~1 KB shell (src/lib/bookingPageHtml.js).
export const MAX_BOOKING_BYTES = 64 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same as src/lib/siteRender.js WIDGET_KEY_TYPES (that module pulls in the
// template registry, which has no place in a function bundle).
const WIDGET_KEY_TYPES = ['instagram-feed', 'google-reviews'];

const fail = (status, message) => Object.assign(new Error(message), { status });

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

// For reads: the stored slug, which must be usable. A shared slug may be
// read (the page shown is whichever row published last).
function readableSlug(site) {
  if (!site.slug) throw fail(409, 'This site has no web address');
  if (!isValidSlug(site.slug) || isReservedSlug(site.slug)) throw fail(409, 'This site\'s web address is not usable');
  return site.slug;
}

// For writes: only a live website, only under its own stored slug.
async function writableSlug(db, site) {
  if (site.site_type && site.site_type !== 'website') throw fail(409, 'Only websites are upgraded here');
  if (!site.published_url) throw fail(409, 'This site is not live');
  if (!site.slug) throw fail(409, 'This site has no web address; it can only be published from the editor');
  const claim = await resolvePublishSlug(db, site, site.slug);
  if (!claim.slug) throw fail(claim.status || 409, claim.error);
  // resolvePublishSlug only claims a new slug for a row without one.
  if (claim.slug !== site.slug) throw fail(409, 'Web address mismatch');
  return claim.slug;
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

function byteLength(s) {
  return Buffer.byteLength(s, 'utf8');
}

// This site's page, built on the production app.
function checkPageHtml(html, siteId) {
  if (typeof html !== 'string' || !html.trim()) throw fail(400, 'htmlContent is required');
  if (byteLength(html) > MAX_HTML_BYTES) throw fail(413, 'The page is too large to publish');
  if (!/^\s*<!doctype html>/i.test(html)) throw fail(400, 'htmlContent is not a full page');
  const scripts = widgetScripts(html);
  for (const kind of ['scheduler', 'contact']) {
    if (!scripts.some((s) => s.kind === kind && s.siteId === siteId)) {
      throw fail(400, `The page has no ${kind === 'scheduler' ? 'booking widget' : 'contact form'} for this site`);
    }
  }
  checkScripts(scripts, siteId);
}

function checkBookingHtml(html, siteId) {
  if (typeof html !== 'string' || !html.trim()) throw fail(400, 'bookingPageHtml must be a page');
  if (byteLength(html) > MAX_BOOKING_BYTES) throw fail(413, 'The booking page is too large');
  const scripts = widgetScripts(html);
  if (!scripts.some((s) => s.kind === 'scheduler' && s.fullPage && s.siteId === siteId)) {
    throw fail(400, 'The booking page has no booking widget for this site');
  }
  checkScripts(scripts, siteId);
}

function checkScripts(scripts, siteId) {
  for (const s of scripts) {
    if (s.siteId !== siteId) throw fail(400, 'The page loads a widget for another site');
    if (s.origin !== PRODUCTION_APP_ORIGIN) {
      throw fail(400, `The page's widgets load from ${s.origin || 'an unknown host'}; build it on ${PRODUCTION_APP_ORIGIN}`);
    }
  }
}

// A backed-up page must be this site's: its widgets carry this site's id
// (very old pages may have none). Backups are already stored per site, so
// this is a second guard.
function checkBackupOwner(html, siteId, what) {
  if (widgetScripts(html).some((s) => s.siteId !== siteId)) {
    throw fail(409, `This backup's ${what} belongs to another site, so it was not restored`);
  }
}

// A live file for the browser: its text, or why it is not there.
async function liveFile(key, maxBytes) {
  const r = await r2GetText(key);
  if (!r.found) return { found: false };
  if (r.size > maxBytes) return { found: true, size: r.size, tooLarge: true };
  return { found: true, size: r.size, html: r.body };
}

// The hold marker as the browser sees it, or null when there never was
// one: { held, reason ('restored' | 'manual'), note, at, by, backupId }.
function holdState(h) {
  if (!h) return null;
  const str = (v) => (typeof v === 'string' ? v : null);
  return {
    held: h.held === true,
    reason: str(h.reason),
    note: str(h.note),
    at: str(h.at),
    by: h.by && typeof h.by === 'object' ? { id: str(h.by.id), email: str(h.by.email) } : null,
    backupId: str(h.backupId),
  };
}

export const handler = async (event) => {
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
        const marker = {
          held: body.held,
          reason: body.held ? 'manual' : 'released',
          note: typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null,
          at: new Date().toISOString(),
          by,
          siteId: site.id,
        };
        await r2PutJson(holdKey(site.id), marker, 'R2 hold');
        log(body.held ? 'held' : 'released');
        return reply(200, { hold: holdState(marker) });
      }

      case 'publish': {
        site = await loadSite(db, body.siteId);
        const { htmlContent, bookingPageHtml } = body;
        if (UPGRADE_MANUAL_SKIP.some((s) => s.siteId === site.id)) {
          throw fail(409, 'This site is on the manual check list; it is republished by hand');
        }
        checkPageHtml(htmlContent, site.id);
        if (bookingPageHtml != null) {
          if (!site.scheduler_enabled) throw fail(409, 'Booking is off for this site now; check it again');
          checkBookingHtml(bookingPageHtml, site.id);
        }
        slug = await writableSlug(db, site);
        await requirePublishedAtColumn(db, site.id);
        const hold = await r2GetJson(holdKey(site.id));
        if (hold?.held === true) throw fail(409, 'This site is on hold. Release the hold first.');
        log(`start bytes=${byteLength(htmlContent)}${bookingPageHtml ? ' +book' : ''}`);

        let backup;
        try {
          backup = await backupLivePages({ slug, siteId: site.id, reason: 'publish', by });
        } catch (e) {
          log(`backup FAILED: ${e.message}`);
          return reply(502, { error: `Could not back up the live page, so nothing was published (${e.message})` });
        }
        if (!backup.files.includes('index.html')) {
          log('no live page to back up; not publishing');
          return reply(409, { error: 'No live page was found to back up, so nothing was published. Publish this site from the editor instead.' });
        }
        log(`backup=${backup.backupId} files=${backup.files.join(',')}`);

        try {
          await uploadSitePages(slug, { htmlContent, bookingPageHtml: bookingPageHtml || undefined });
        } catch (e) {
          log(`upload FAILED after backup ${backup.backupId}: ${e.message}`);
          return reply(500, { error: `${e.message}. The previous page is saved as backup ${backup.backupId}.`, backupId: backup.backupId });
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
        // id), and the files must be this site's pages.
        const index = await r2GetText(backupKey(site.id, backupId, 'index.html'));
        if (!index.found) throw fail(404, 'Backup not found');
        const meta = await r2GetJson(backupKey(site.id, backupId, BACKUP_META_FILE));
        if (meta && meta.siteId !== site.id) throw fail(409, 'This backup belongs to another site, so it was not restored');
        checkBackupOwner(index.body, site.id, 'page');
        const book = await r2GetText(backupKey(site.id, backupId, 'book/index.html'));
        if (book.found) checkBackupOwner(book.body, site.id, '/book page');

        let safety;
        try {
          safety = await backupLivePages({ slug, siteId: site.id, reason: 'restore', by });
        } catch (e) {
          log(`safety backup FAILED: ${e.message}`);
          return reply(502, { error: `Could not back up the live page, so nothing was restored (${e.message})` });
        }
        log(`safety backup=${safety.backupId || 'none (nothing live)'}`);

        try {
          await r2PutHtml(livePageKey(slug, 'index.html'), index.body, 'R2 restore');
          // A backup without a /book page leaves the live one alone: the
          // booking shell does not change with the design.
          if (book.found) await r2PutHtml(livePageKey(slug, 'book/index.html'), book.body, 'R2 booking-page restore');
        } catch (e) {
          log(`restore FAILED: ${e.message}`);
          return reply(500, { error: e.message, safetyBackupId: safety.backupId });
        }

        // The restored page's publish time is unknown: clear published_at
        // (null = "before tracking"), which also drops the dashboard's "New
        // design live" badge after undoing an upgrade.
        await setPublishedAt(db, site.id, null);
        // Hold the site, so the next check flags it and "Republish all"
        // cannot put the new design straight back.
        const hold = { held: true, reason: 'restored', note: null, at: new Date().toISOString(), by, siteId: site.id, backupId, safetyBackupId: safety.backupId };
        let holdError = null;
        try {
          await r2PutJson(holdKey(site.id), hold, 'R2 hold');
        } catch (e) {
          holdError = `The page was restored, but the site could not be put on hold (${e.message}). Put it on hold by hand.`;
          log(`hold FAILED: ${e.message}`);
        }
        const files = book.found ? ['index.html', 'book/index.html'] : ['index.html'];
        log(`restored backup=${backupId} files=${files.join(',')} safety=${safety.backupId || 'none'}${holdError ? '' : ' held'}`);
        return reply(200, { slug, restored: backupId, files, safetyBackupId: safety.backupId, hold: holdError ? null : holdState(hold), holdError });
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
