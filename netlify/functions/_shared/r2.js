// Published-site storage: Cloudflare R2 bucket `autosite-published`, read
// and written through the Cloudflare v4 REST API with CLOUDFLARE_API_TOKEN /
// CLOUDFLARE_ACCOUNT_ID. A site's live page is `${slug}/index.html` (plus
// `${slug}/book/index.html` when booking is on); the serving Worker maps
// https://<slug>.autocaregeniushub.com to that prefix.
//
// Used by publish-site (owner Publish / Republish) and admin-site-upgrade
// (admins rolling a new design out to live sites), so both upload the same
// way: same keys, same content type, same error messages.
//
// Env is read per call (not at import) so tests can set it.
import { randomBytes } from 'node:crypto';

const R2_BUCKET = 'autosite-published';
const HTML_TYPE = 'text/html; charset=utf-8';
const JSON_TYPE = 'application/json; charset=utf-8';

// Backups of live pages, written before an admin overwrites or restores
// one (and before an owner's first publish on the new designs).
// `_backups/<site id>/<backup id>/<file>`: keyed by the site, never by the
// slug, because a slug is freed when its site is deleted and can then be
// claimed by a new row (or another business), which must never see or
// restore the old site's pages. `_backups` can never be a site's prefix:
// slugs are [a-z0-9-] only (_shared/slug.js). The serving Worker must still
// refuse host labels outside that pattern; the random part of each backup
// id keeps a backup unguessable even if it does not.
const BACKUP_ROOT = '_backups';
// <ISO time with ":" and "." as "-">-<why>-<8 random hex>, e.g.
// 2026-10-02T15-30-12-345Z-publish-1a2b3c4d. Sorts by time as plain text.
//   publish  before an admin upgrade      restore  before an admin restore
//   manual   an admin's "Back up now"     owner    before an owner's first
//                                                  publish on the new designs
export const BACKUP_ID_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(publish|restore|manual|owner)-[0-9a-f]{8}$/;

// Relative to the slug (live) or the backup folder: the only two files a
// published site has.
export const PAGE_FILES = ['index.html', 'book/index.html'];
// Written into every backup folder: whose page it is and who saved it.
export const BACKUP_META_FILE = 'meta.json';

function r2Base() {
  return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects`;
}

function authHeader() {
  return { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` };
}

// The key is one path segment of the API URL, so its "/" are encoded too
// (as publish-site has always done).
export function r2ObjectUrl(key) {
  return `${r2Base()}/${encodeURIComponent(key)}`;
}

export function livePageKey(slug, file) {
  return `${slug}/${file}`;
}

export function backupPrefix(siteId) {
  return `${BACKUP_ROOT}/${siteId}/`;
}

export function backupKey(siteId, backupId, file) {
  return `${backupPrefix(siteId)}${backupId}/${file}`;
}

// An admin's hold on a site (set by a restore, or by hand): the upgrade
// skips it until an admin releases it. Lives beside the site's backups.
export function holdKey(siteId) {
  return `${backupPrefix(siteId)}hold.json`;
}

// The owner's "your website got an upgrade" email for this site
// (admin-site-upgrade emailSend): claimed (state "sending") before the
// email goes to Postmark, then "sent" with Postmark's message id, or
// "refused". A site with a "sending" or "sent" marker is never emailed
// about again until an admin resolves it. Who, to whom and when are kept.
// Beside the backups, like the hold.
export function upgradeEmailKey(siteId) {
  return `${backupPrefix(siteId)}upgrade-email.json`;
}

// The owner-email run in progress ({ runId, by, startedAt, expiresAt }):
// one run at a time across admins and browser tabs. Not under a site's
// folder (site ids are UUIDs, so it can't collide with one).
export function upgradeEmailRunKey() {
  return `${BACKUP_ROOT}/upgrade-email-run.json`;
}

export function newBackupId(reason, now = new Date()) {
  return `${now.toISOString().replace(/[:.]/g, '-')}-${reason}-${randomBytes(4).toString('hex')}`;
}

// timeoutMs (optional): give up after this long, so a caller with a time
// limit (the owner emails) is never held up by a slow R2. An aborted PUT
// may still have been stored.
function timeoutSignal(timeoutMs) {
  return timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {};
}

async function r2Put(key, body, contentType, label, { timeoutMs } = {}) {
  let res;
  try {
    res = await fetch(r2ObjectUrl(key), {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': contentType },
      body,
      ...timeoutSignal(timeoutMs),
    });
  } catch (e) {
    if (!timeoutMs) throw e;
    throw new Error(`${label} failed (no answer: ${e?.message || e})`);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${label} failed (${res.status}): ${errText}`);
  }
}

// PUT an HTML object. `label` names it in the error ("R2 upload failed").
export function r2PutHtml(key, body, label = 'R2 upload') {
  return r2Put(key, body, HTML_TYPE, label);
}

export function r2PutJson(key, value, label = 'R2 write', opts = {}) {
  return r2Put(key, JSON.stringify(value), JSON_TYPE, label, opts);
}

// GET an object as text. { found: false } when the key does not exist;
// throws on any other failure, so a backup never mistakes an outage for
// "nothing there". opts.timeoutMs as for r2Put.
export async function r2GetText(key, { timeoutMs } = {}) {
  let res;
  try {
    res = await fetch(r2ObjectUrl(key), { method: 'GET', headers: authHeader(), ...timeoutSignal(timeoutMs) });
  } catch (e) {
    if (!timeoutMs) throw e;
    throw new Error(`R2 read failed (no answer: ${e?.message || e})`);
  }
  if (res.status === 404) return { found: false };
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`R2 read failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  const body = await res.text();
  return { found: true, body, size: Buffer.byteLength(body, 'utf8') };
}

// A JSON object, or null when it does not exist or is not JSON. Throws on
// a failed read, like r2GetText.
export async function r2GetJson(key, opts = {}) {
  const r = await r2GetText(key, opts);
  if (!r.found) return null;
  try {
    const v = JSON.parse(r.body);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

// Every object under a prefix: [{ key, size, lastModified }]. Pages through
// the listing with its cursor, up to maxPages * 1000 keys.
export async function r2List(prefix, { maxPages = 10 } = {}) {
  const out = [];
  let cursor = '';
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ prefix, per_page: '1000' });
    if (cursor) qs.set('cursor', cursor);
    const res = await fetch(`${r2Base()}?${qs}`, { method: 'GET', headers: authHeader() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) {
      const msg = body.errors?.map((e) => e.message).join('; ') || `status ${res.status}`;
      throw new Error(`R2 list failed: ${msg}`);
    }
    for (const o of body.result || []) {
      out.push({ key: o.key, size: o.size ?? null, lastModified: o.last_modified ?? null });
    }
    cursor = body.result_info?.cursor || '';
    if (!body.result_info?.is_truncated || !cursor) break;
  }
  return out;
}

// Uploads a site's pages exactly as publish-site always has: the homepage
// first, then the /book page, each failing with its own message.
export async function uploadSitePages(slug, { htmlContent, bookingPageHtml } = {}) {
  if (htmlContent) await r2PutHtml(livePageKey(slug, 'index.html'), htmlContent, 'R2 upload');
  if (bookingPageHtml) await r2PutHtml(livePageKey(slug, 'book/index.html'), bookingPageHtml, 'R2 booking-page upload');
}

// Copies whatever is live for `slug` into a new backup folder of site
// `siteId`, with a meta.json naming the site, slug, reason and who saved
// it (`by`: { id, email } of the admin, or null for an owner publish).
// Returns { backupId, files } (files: the PAGE_FILES that existed), or
// { backupId: null, files: [] } when nothing is live. Throws if any read
// or write fails: callers must not overwrite a page they could not save.
export async function backupLivePages({ slug, siteId, reason, by = null, now = new Date() }) {
  if (!slug || !siteId) throw new Error('backupLivePages needs a slug and a site id');
  const backupId = newBackupId(reason, now);
  const files = [];
  for (const file of PAGE_FILES) {
    const live = await r2GetText(livePageKey(slug, file));
    if (!live.found) continue;
    await r2PutHtml(backupKey(siteId, backupId, file), live.body, 'R2 backup');
    files.push(file);
  }
  if (!files.length) return { backupId: null, files: [] };
  await r2PutJson(backupKey(siteId, backupId, BACKUP_META_FILE), {
    siteId, slug, reason, at: now.toISOString(), by: by ? { id: by.id || null, email: by.email || null } : null, files,
  }, 'R2 backup');
  return { backupId, files };
}

// Backups of a site, newest first: [{ id, files, size, lastModified }].
export async function listBackups(siteId) {
  const prefix = backupPrefix(siteId);
  const byId = new Map();
  for (const o of await r2List(prefix)) {
    const rest = o.key.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 0) continue;
    const id = rest.slice(0, slash);
    const file = rest.slice(slash + 1);
    if (!BACKUP_ID_RE.test(id) || !PAGE_FILES.includes(file)) continue;
    const entry = byId.get(id) || { id, files: [], size: 0, lastModified: null };
    entry.files.push(file);
    entry.size += o.size || 0;
    if (!entry.lastModified || (o.lastModified && o.lastModified > entry.lastModified)) entry.lastModified = o.lastModified;
    byId.set(id, entry);
  }
  for (const entry of byId.values()) entry.files.sort((a, b) => PAGE_FILES.indexOf(a) - PAGE_FILES.indexOf(b));
  return [...byId.values()].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

// ─── Publish bookkeeping (sites row) ─────────────────────────────────

// PostgREST answers a request naming an unknown column with PGRST204
// ("Could not find the 'published_at' column ... in the schema cache");
// Postgres itself says 42703 (undefined_column).
export function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = String(error.message || '');
  return /published_at/.test(msg) && /(does not exist|schema cache)/i.test(msg);
}

// Sets sites.published_at (or clears it with at = null). The column comes
// from migration 20261004_sites_published_at.sql. An owner's publish must
// never fail over it (the page is already live), so a missing column or
// any other failure is logged and ignored here; admin-site-upgrade refuses
// to start an upgrade until the column exists.
// Returns the stored value, or undefined when nothing was stored.
export async function setPublishedAt(db, siteId, at = new Date()) {
  const value = at ? at.toISOString() : null;
  try {
    const { error } = await db.from('sites').update({ published_at: value }).eq('id', siteId);
    if (!error) return value;
    if (isMissingColumnError(error)) {
      console.warn('[publish] sites.published_at does not exist yet (migration 20261004_sites_published_at.sql); not recorded');
    } else {
      console.error(`[publish] could not record published_at for site ${siteId}:`, error.message || error);
    }
  } catch (e) {
    console.error(`[publish] could not record published_at for site ${siteId}:`, e?.message || e);
  }
  return undefined;
}
