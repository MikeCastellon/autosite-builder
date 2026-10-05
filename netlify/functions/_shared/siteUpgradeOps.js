// The write path of a site upgrade, shared by Admin > Site upgrades
// (admin-site-upgrade.js) and the terminal tool (scripts/site-upgrade/),
// so both refuse, back up, upload and restore the same way: the same
// checks on the page, the same order (nothing is overwritten until a
// backup of it is stored), the same R2 keys and the same messages.
//
// Nothing here touches the database: the function does its sites-row
// bookkeeping itself, and the terminal tool prints the SQL instead.
// Errors that refuse a request carry an HTTP status (`fail`); the
// function sends their message to the browser, the tool prints it.
import { isReservedSlug, isValidSlug } from './slug.js';
import { resolvePublishSlug } from './slugClaim.js';
import {
  BACKUP_META_FILE, backupKey, backupLivePages, holdKey, livePageKey, r2GetJson, r2GetText, r2PutHtml, r2PutJson,
  uploadSitePages,
} from './r2.js';
import { PRODUCTION_APP_ORIGIN, UPGRADE_MANUAL_SKIP, widgetScripts } from '../../../src/lib/siteUpgrade.js';

// Netlify caps a function request and response at 6 MB. A built page is
// usually 50-300 KB; one past 3 MB holds inline images and is flagged.
export const MAX_HTML_BYTES = 3 * 1024 * 1024;
// The /book page is a ~1 KB shell (src/lib/bookingPageHtml.js).
export const MAX_BOOKING_BYTES = 64 * 1024;

export const fail = (status, message) => Object.assign(new Error(message), { status });

export function byteLength(s) {
  return Buffer.byteLength(s, 'utf8');
}

// For reads: the stored slug, which must be usable. A shared slug may be
// read (the page shown is whichever row published last).
export function readableSlug(site) {
  if (!site.slug) throw fail(409, 'This site has no web address');
  if (!isValidSlug(site.slug) || isReservedSlug(site.slug)) throw fail(409, 'This site\'s web address is not usable');
  return site.slug;
}

// For writes: only a live website, only under its own stored slug. `db`
// answers resolvePublishSlug's "does another row hold this slug" read.
export async function writableSlug(db, site) {
  if (site.site_type && site.site_type !== 'website') throw fail(409, 'Only websites are upgraded here');
  if (!site.published_url) throw fail(409, 'This site is not live');
  if (!site.slug) throw fail(409, 'This site has no web address; it can only be published from the editor');
  const claim = await resolvePublishSlug(db, site, site.slug);
  if (!claim.slug) throw fail(claim.status || 409, claim.error);
  // resolvePublishSlug only claims a new slug for a row without one.
  if (claim.slug !== site.slug) throw fail(409, 'Web address mismatch');
  return claim.slug;
}

function checkScripts(scripts, siteId) {
  for (const s of scripts) {
    if (s.siteId !== siteId) throw fail(400, 'The page loads a widget for another site');
    if (s.origin !== PRODUCTION_APP_ORIGIN) {
      throw fail(400, `The page's widgets load from ${s.origin || 'an unknown host'}; build it on ${PRODUCTION_APP_ORIGIN}`);
    }
  }
}

// This site's page, built on the production app.
export function checkPageHtml(html, siteId) {
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

export function checkBookingHtml(html, siteId) {
  if (typeof html !== 'string' || !html.trim()) throw fail(400, 'bookingPageHtml must be a page');
  if (byteLength(html) > MAX_BOOKING_BYTES) throw fail(413, 'The booking page is too large');
  const scripts = widgetScripts(html);
  if (!scripts.some((s) => s.kind === 'scheduler' && s.fullPage && s.siteId === siteId)) {
    throw fail(400, 'The booking page has no booking widget for this site');
  }
  checkScripts(scripts, siteId);
}

// A backed-up page must be this site's: its widgets carry this site's id
// (very old pages may have none). Backups are already stored per site, so
// this is a second guard.
export function checkBackupOwner(html, siteId, what) {
  if (widgetScripts(html).some((s) => s.siteId !== siteId)) {
    throw fail(409, `This backup's ${what} belongs to another site, so it was not restored`);
  }
}

// The request itself, before anything is read: never a site on the manual
// check list, only this site's production-built pages, and a /book page
// only while booking is on.
export function checkPublishRequest(site, { htmlContent, bookingPageHtml } = {}) {
  if (UPGRADE_MANUAL_SKIP.some((s) => s.siteId === site.id)) {
    throw fail(409, 'This site is on the manual check list; it is republished by hand');
  }
  checkPageHtml(htmlContent, site.id);
  if (bookingPageHtml != null) {
    if (!site.scheduler_enabled) throw fail(409, 'Booking is off for this site now; check it again');
    checkBookingHtml(bookingPageHtml, site.id);
  }
}

// A live file: its text, or why it is not there.
export async function liveFile(key, maxBytes) {
  const r = await r2GetText(key);
  if (!r.found) return { found: false };
  if (r.size > maxBytes) return { found: true, size: r.size, tooLarge: true };
  return { found: true, size: r.size, html: r.body };
}

// The hold marker as a reader sees it, or null when there never was one:
// { held, reason ('restored' | 'manual'), note, at, by, backupId }.
export function holdState(h) {
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

// The site's hold marker as stored (null when there is none). Throws when
// R2 can't be read: "held or not" is never a guess.
export function readHold(siteId) {
  return r2GetJson(holdKey(siteId));
}

export async function assertNotHeld(siteId) {
  const hold = await readHold(siteId);
  if (hold?.held === true) throw fail(409, 'This site is on hold. Release the hold first.');
}

// An admin's hold (or release) of a site, as stored in hold.json.
export function holdMarker({ siteId, held, note = null, by, now = new Date() }) {
  return {
    held,
    reason: held ? 'manual' : 'released',
    note: typeof note === 'string' ? note.trim().slice(0, 200) || null : null,
    at: now.toISOString(),
    by,
    siteId,
  };
}

export async function writeHold(marker) {
  await r2PutJson(holdKey(marker.siteId), marker, 'R2 hold');
  return marker;
}

// Backs up the live page (and /book page), then uploads the new ones.
// Returns { backupId, files }. Refuses (throws `fail`) when the backup
// fails (502) or nothing is live to back up (409); an upload that fails
// after the backup throws 500 with `backupId`, so the caller can offer
// the restore. `log(msg)` gets one line per step.
export async function backupAndUpload({ slug, siteId, htmlContent, bookingPageHtml, by, log = () => {} }) {
  let backup;
  try {
    backup = await backupLivePages({ slug, siteId, reason: 'publish', by });
  } catch (e) {
    log(`backup FAILED: ${e.message}`);
    throw fail(502, `Could not back up the live page, so nothing was published (${e.message})`);
  }
  if (!backup.files.includes('index.html')) {
    log('no live page to back up; not publishing');
    throw fail(409, 'No live page was found to back up, so nothing was published. Publish this site from the editor instead.');
  }
  log(`backup=${backup.backupId} files=${backup.files.join(',')}`);

  try {
    await uploadSitePages(slug, { htmlContent, bookingPageHtml: bookingPageHtml || undefined });
  } catch (e) {
    log(`upload FAILED after backup ${backup.backupId}: ${e.message}`);
    throw Object.assign(fail(500, `${e.message}. The previous page is saved as backup ${backup.backupId}.`), { backupId: backup.backupId });
  }
  return { backupId: backup.backupId, files: backup.files };
}

// Puts one of this site's backups live: reads it (only this site's
// folder, and only pages carrying this site's widgets), backs the current
// live page up first, then writes the backup over it. Returns
// { files, safetyBackupId }. A write that fails throws 500 with
// `safetyBackupId`. The caller clears published_at and then holds the
// site (holdAfterRestore).
export async function restoreBackup({ slug, siteId, backupId, by, log = () => {} }) {
  const index = await r2GetText(backupKey(siteId, backupId, 'index.html'));
  if (!index.found) throw fail(404, 'Backup not found');
  const meta = await r2GetJson(backupKey(siteId, backupId, BACKUP_META_FILE));
  if (meta && meta.siteId !== siteId) throw fail(409, 'This backup belongs to another site, so it was not restored');
  checkBackupOwner(index.body, siteId, 'page');
  const book = await r2GetText(backupKey(siteId, backupId, 'book/index.html'));
  if (book.found) checkBackupOwner(book.body, siteId, '/book page');

  let safety;
  try {
    safety = await backupLivePages({ slug, siteId, reason: 'restore', by });
  } catch (e) {
    log(`safety backup FAILED: ${e.message}`);
    throw fail(502, `Could not back up the live page, so nothing was restored (${e.message})`);
  }
  log(`safety backup=${safety.backupId || 'none (nothing live)'}`);

  try {
    await r2PutHtml(livePageKey(slug, 'index.html'), index.body, 'R2 restore');
    // A backup without a /book page leaves the live one alone: the
    // booking shell does not change with the design.
    if (book.found) await r2PutHtml(livePageKey(slug, 'book/index.html'), book.body, 'R2 booking-page restore');
  } catch (e) {
    log(`restore FAILED: ${e.message}`);
    throw Object.assign(fail(500, e.message), { safetyBackupId: safety.backupId });
  }
  return {
    files: book.found ? ['index.html', 'book/index.html'] : ['index.html'],
    safetyBackupId: safety.backupId,
    // What was put live, for a caller that verifies it.
    pages: { index: index.body, book: book.found ? book.body : null },
  };
}

// After a restore: hold the site, so the next check flags it and a bulk
// republish cannot put the new design straight back. Returns
// { hold (the marker, null when it could not be written), holdError }.
export async function holdAfterRestore({ siteId, backupId, safetyBackupId, by, log = () => {}, now = new Date() }) {
  const hold = { held: true, reason: 'restored', note: null, at: now.toISOString(), by, siteId, backupId, safetyBackupId };
  try {
    await r2PutJson(holdKey(siteId), hold, 'R2 hold');
    return { hold, holdError: null };
  } catch (e) {
    log(`hold FAILED: ${e.message}`);
    return { hold: null, holdError: `The page was restored, but the site could not be put on hold (${e.message}). Put it on hold by hand.` };
  }
}
