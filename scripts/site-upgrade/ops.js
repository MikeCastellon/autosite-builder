// publish / restore / hold / backups: the writes, through the same steps
// admin-site-upgrade.js runs (netlify/functions/_shared/siteUpgradeOps.js),
// one site at a time, each verified by reading it back, stopping at the
// first unexpected error. The database side is printed as SQL (sql.js).
//
// The function reads the sites row right before each write; this tool
// works from an export, so before each site's writes it also checks that
// nothing moved since: the fresh check (the row, the owner's plan and
// widget keys, read through the MCP minutes before) is recent enough, the
// live page was not published again after the export, and it is not
// already a new-design page.
import { BACKUP_ID_RE, PAGE_FILES, backupKey, listBackups, livePageKey, r2GetText, r2List } from '../../netlify/functions/_shared/r2.js';
import {
  assertNotHeld, backupAndUpload, checkPublishRequest, fail, holdAfterRestore, holdMarker, holdState, readHold, restoreBackup,
  writableSlug, writeHold,
} from '../../netlify/functions/_shared/siteUpgradeOps.js';
import { isNewDesignPage, widgetScripts } from '../../src/lib/siteUpgrade.js';
import { freshAgeMinutes, tabRow } from './inputs.js';
import { holdKeyOnly, liveSiteUrl, publicGet, sha256, siteKeys } from './net.js';
import { assessSite, readLive } from './plan.js';

export const PUBLISH_CONFIRM = 'PUBLISH';
export const RESTORE_CONFIRM = 'RESTORE';
// How old the fresh check may be when a site's writes start.
export const FRESH_MAX_AGE_MIN = 10;

// One write as the log shows it.
function writeLine(x) {
  const what = !x.sent ? 'WOULD WRITE' : x.ok ? 'wrote' : `write FAILED${x.status ? ` (${x.status})` : ''}`;
  return `${what} ${x.key} (${x.bytes} bytes, sha256 ${x.sha256.slice(0, 16)})`;
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// How long the public URL gets to serve a new page after its upload.
export const VERIFY = { tries: 6, waitMs: 5000 };

// The R2 object now holds exactly `body`.
async function verifyR2(key, body) {
  const r = await r2GetText(key);
  if (!r.found) throw new Error(`Verify: ${key} is not in R2 after the upload`);
  if (sha256(r.body) !== sha256(body)) throw new Error(`Verify: ${key} in R2 is not the page that was uploaded`);
}

// The public URL serves `body` (retried: the serving Worker may answer
// from a short cache).
async function verifyPublic(slug, body, { tries = VERIFY.tries, waitMs = VERIFY.waitMs, fetchImpl } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(waitMs);
    last = await publicGet(liveSiteUrl(slug), { fetchImpl });
    if (last.status === 200 && sha256(last.body) === sha256(body)) return { ok: true };
  }
  return { ok: false, detail: `GET ${liveSiteUrl(slug)} answered ${last?.status} with ${last?.bytes ?? 0} bytes that are not the uploaded page` };
}

// When the live index.html was last written (R2's listing), or null.
async function liveModifiedAt(slug) {
  const key = livePageKey(slug, 'index.html');
  const hit = (await r2List(key, { maxPages: 1 })).find((o) => o.key === key);
  return hit?.lastModified || null;
}

// Why this site must not be written now, or null: the checks that stand in
// for the tab's re-read of the row right before the upload.
async function staleReason({ doc, site, live, slug, fresh, includeUpgraded, now }) {
  if (fresh) {
    const age = freshAgeMinutes(fresh, now);
    if (age > FRESH_MAX_AGE_MIN) {
      return `the fresh check is ${Math.round(age)} minutes old (limit ${FRESH_MAX_AGE_MIN}): run the fresh SQL again for the sites left, then publish them`;
    }
  }
  if (live.index?.html && isNewDesignPage(live.index.html) && !includeUpgraded) {
    return 'the live page is already a new-design page: someone published it after the export (or it was built on a preview). Look at it, then pass --include-upgraded if it must be replaced';
  }
  const at = await liveModifiedAt(slug);
  if (at && Date.parse(at) > Date.parse(doc.exportedAt)) {
    return `the live page was written at ${at}, after the export (${doc.exportedAt}): someone published it since. Export again and plan again`;
  }
  return null;
}

// Publishes `sites` (already planned ready) one at a time. ctx:
//   doc, db (inputsDb), renderMod, pages (Map id → { built }), net
//   (net.js guard), by, dryRun, includeUpgraded, log(line), fetchImpl,
//   publicCheck ('strict' | 'soft' per site id, from the preflight),
//   fresh (the --fresh document; required unless dryRun), now(),
//   onRecord(record) (each published site, as soon as it is live),
//   shouldStop()
// Returns { records (published), writes (all R2 PUTs, sent or would-be),
// stopped, stopReason }.
export async function publishSites(sites, ctx) {
  const { doc, db, renderMod, pages, net, by, dryRun, includeUpgraded, log, fetchImpl, verifyWaitMs } = ctx;
  const now = ctx.now || (() => Date.now());
  const records = [];
  const writes = [];
  const record = (r) => { records.push(r); ctx.onRecord?.(r); };
  for (const [i, site] of sites.entries()) {
    const tag = `(${i + 1}/${sites.length}) ${site.slug} ${site.id}`;
    if (ctx.shouldStop?.()) {
      log(`${tag}: not started (stopped by Ctrl-C)`);
      return { records, writes, stopped: true, stopReason: `Stopped by Ctrl-C before ${site.slug}; the remaining sites were not touched` };
    }
    const { built } = pages.get(site.id);
    let backupId = null;
    try {
      if (!dryRun && !ctx.fresh) throw new Error('no fresh check (--fresh)');
      // 1. Check again right before writing, from R2 (the hold too).
      const live = await readLive(site, { db, source: 'r2', fetchImpl });
      const result = await assessSite({ doc, site, built, live, renderMod, db });
      if (result.status !== 'ready') {
        const why = [...result.verdict.reasons, ...result.blocks].map((r) => r.text).join('; ');
        throw new Error(`no longer ready: ${why}`);
      }
      if (result.upgraded && !includeUpgraded) throw new Error('already on the new design (published_at is set); pass --include-upgraded to republish it');

      // 2. The function's own refusals, in its order.
      const row = tabRow(site);
      const htmlContent = built.newHtml;
      const bookingPageHtml = built.bookingPageHtml || undefined;
      checkPublishRequest(row, { htmlContent, bookingPageHtml });
      const slug = await writableSlug(db, row);
      await assertNotHeld(site.id);
      // 3. Nothing moved since the export (the tab would have re-read it).
      // (A dry run shows the writes whatever the fresh check's age: the
      // CLI has listed that refusal already.)
      const stale = await staleReason({ doc, site, live, slug, fresh: dryRun ? null : ctx.fresh, includeUpgraded, now: now() });
      if (stale) throw new Error(`not published: ${stale}`);
      log(`${tag}: start bytes=${Buffer.byteLength(htmlContent, 'utf8')}${bookingPageHtml ? ' +book' : ''} new sha256=${sha256(htmlContent).slice(0, 16)}`);

      // 4. Backup, then upload: only this site's keys can be written.
      net.set(dryRun ? 'dry-run' : 'write', siteKeys(site.id, slug));
      net.onSend = (x) => log(`${tag}: sending ${x.key} (${x.bytes} bytes)`);
      let out;
      try {
        out = await backupAndUpload({ slug, siteId: site.id, htmlContent, bookingPageHtml, by, log: (m) => log(`${tag}: ${m}`) });
      } finally {
        const w = net.take();
        net.set('read');
        net.onSend = null;
        writes.push(...w.map((x) => ({ site: site.slug, siteId: site.id, ...x })));
        for (const x of w) log(`${tag}: ${writeLine(x)}`);
      }
      backupId = out.backupId;
      const publishedAt = new Date(now()).toISOString();
      if (dryRun) {
        record({ siteId: site.id, slug, publishedAt, backupId, dryRun: true, fingerprint: site.fingerprint });
        continue;
      }

      // 5. Verify: the backup is stored and is the page that was checked,
      // and R2 and the public URL now serve the new pages.
      const saved = await r2GetText(backupKey(site.id, backupId, 'index.html'));
      if (!saved.found) throw new Error(`Verify: backup ${backupId} has no index.html`);
      if (live.index.html && sha256(saved.body) !== sha256(live.index.html)) {
        log(`${tag}: WARNING the backed-up page differs from the page checked moments before (it changed in between); the backup holds what was live at backup time`);
      }
      await verifyR2(livePageKey(slug, 'index.html'), htmlContent);
      if (bookingPageHtml) await verifyR2(livePageKey(slug, 'book/index.html'), bookingPageHtml);
      log(`${tag}: verified in R2`);
      record({ siteId: site.id, slug, publishedAt, backupId, fingerprint: site.fingerprint });
      const pub = await verifyPublic(slug, htmlContent, { fetchImpl, ...(verifyWaitMs != null ? { waitMs: verifyWaitMs } : {}) });
      if (!pub.ok) {
        const strict = ctx.publicCheck?.get(site.id) !== 'soft';
        log(`${tag}: ${strict ? 'STOP' : 'WARNING'} ${pub.detail}`);
        if (strict) {
          return { records, writes, stopped: true, stopReason: `${site.slug}: R2 holds the new page but ${pub.detail}. Check it in a browser; restore with: restore --site ${site.slug} --backup ${backupId} --confirm RESTORE` };
        }
      } else {
        log(`${tag}: verified at ${liveSiteUrl(slug)}`);
      }
      log(`${tag}: published backup=${backupId}`);
    } catch (e) {
      log(`${tag}: STOPPED: ${e.message}`);
      const id = backupId || e.backupId;
      const hint = id ? ` The previous page is saved as backup ${id}; to put it back: restore --site ${site.slug} --backup ${id} --confirm RESTORE` : '';
      return { records, writes, stopped: true, stopReason: `${site.slug}: ${e.message}.${hint}`, failedSite: site.id };
    }
  }
  return { records, writes, stopped: false, stopReason: null };
}

// What a publish would write, worked out without R2 (no token): the same
// keys in the same order as backupLivePages + uploadSitePages, assuming
// the live index page exists (the public GET found it) and a /book page
// backup only if one exists.
export function simulatedWrites(site, slug, built) {
  const id = '<backup id>';
  const w = [
    { key: backupKey(site.id, id, PAGE_FILES[0]), note: 'copy of the live index.html' },
    { key: backupKey(site.id, id, PAGE_FILES[1]), note: 'copy of the live /book page, if there is one' },
    { key: backupKey(site.id, id, 'meta.json'), note: 'backup meta' },
    { key: livePageKey(slug, 'index.html'), bytes: Buffer.byteLength(built.newHtml, 'utf8'), sha256: sha256(built.newHtml) },
  ];
  if (built.bookingPageHtml) {
    w.push({ key: livePageKey(slug, 'book/index.html'), bytes: Buffer.byteLength(built.bookingPageHtml, 'utf8'), sha256: sha256(built.bookingPageHtml) });
  }
  return w;
}

// Puts a backup back live, then holds the site. The function reads the
// sites row first; this tool cannot, so it refuses unless this site's page
// is what is live at the address now (nothing live: the owner may have
// unpublished or deleted it; another site's page: the address changed
// hands). Returns { slug, files, safetyBackupId, hold, holdError, writes,
// partial }: `partial` (a message) when the main page was put back but a
// later write failed (the site is held all the same). Throws when nothing
// live was changed; the error carries `safetyBackupId` and `wrote`.
export async function restoreSite(site, { db, backupId, net, by, dryRun, log }) {
  if (typeof backupId !== 'string' || !BACKUP_ID_RE.test(backupId)) throw fail(400, '--backup must be a backup id (see the backups command)');
  const row = tabRow(site);
  const slug = await writableSlug(db, row);
  const now = await r2GetText(livePageKey(slug, 'index.html'));
  if (!now.found) {
    throw fail(409, `Nothing is live at ${slug}: the site may have been unpublished or deleted since the export, and this tool cannot read the row. Nothing was restored (Admin > Site upgrades reads the row, if it must go back up)`);
  }
  const others = [...new Set(widgetScripts(now.body).map((s) => s.siteId).filter((id) => id !== site.id))];
  if (others.length) {
    throw fail(409, `The page live at ${slug} is another site's (${others.join(', ')}): the web address changed hands since the export. Nothing was restored`);
  }
  log(`restore ${slug} ${site.id}: start backup=${backupId}${dryRun ? ' (dry run)' : ''}`);
  const tag = `restore ${slug}`;
  const writes = [];
  const collect = () => {
    const w = net.take();
    writes.push(...w);
    for (const x of w) log(`${tag}: ${writeLine(x)}`);
  };
  const indexKey = livePageKey(slug, 'index.html');
  let restored = null;
  let failure = null;
  let held = { hold: null, holdError: null };
  net.set(dryRun ? 'dry-run' : 'write', siteKeys(site.id, slug));
  net.onSend = (x) => log(`${tag}: sending ${x.key} (${x.bytes} bytes)`);
  try {
    try {
      restored = await restoreBackup({ slug, siteId: site.id, backupId, by, log: (m) => log(`${tag}: ${m}`) });
    } catch (e) {
      failure = e;
    }
    collect();
    const indexPutBack = writes.some((w) => w.key === indexKey && w.ok);
    if (failure && !indexPutBack) {
      throw Object.assign(failure, { safetyBackupId: failure.safetyBackupId ?? null, wrote: writes.some((w) => w.sent && w.ok) });
    }
    // The old page is live (all of it, or the main page): hold the site, so
    // the next plan flags it and no publish puts the new design back.
    held = await holdAfterRestore({ siteId: site.id, backupId, safetyBackupId: restored?.safetyBackupId ?? failure?.safetyBackupId ?? null, by, log: (m) => log(`${tag}: ${m}`) });
    collect();
  } finally {
    net.set('read');
    net.onSend = null;
  }
  if (!dryRun && restored) {
    await verifyR2(indexKey, restored.pages.index);
    if (restored.pages.book) await verifyR2(livePageKey(slug, 'book/index.html'), restored.pages.book);
    log(`${tag}: verified in R2`);
  }
  return {
    slug,
    files: restored?.files || ['index.html'],
    safetyBackupId: restored?.safetyBackupId ?? failure?.safetyBackupId ?? null,
    hold: held.hold ? holdState(held.hold) : null,
    holdError: held.holdError,
    writes,
    partial: failure ? failure.message : null,
  };
}

export async function setHold(site, { held, note, net, by, dryRun, log }) {
  const marker = holdMarker({ siteId: site.id, held, note, by });
  net.set(dryRun ? 'dry-run' : 'write', holdKeyOnly(site.id));
  let writes;
  try {
    await writeHold(marker);
  } finally {
    writes = net.take();
    net.set('read');
    for (const x of writes) log(`${held ? 'hold' : 'unhold'} ${site.slug}: ${writeLine(x)}`);
  }
  if (!dryRun) {
    const back = await readHold(site.id);
    if ((back?.held === true) !== held) throw new Error('Verify: the hold marker in R2 does not say what was written');
  }
  return { hold: holdState(marker), writes };
}

// "2026-10-02T15-30-12-345Z-publish-1a2b3c4d" → "2026-10-02 15:30:12 UTC · publish"
export function backupLabel(id) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-\d{3}Z-([a-z]+)-[0-9a-f]+$/.exec(id);
  return m ? `${m[1]} ${m[2]}:${m[3]}:${m[4]} UTC · ${m[5]}` : id;
}

export async function listSiteBackups(site) {
  const [backups, hold] = await Promise.all([listBackups(site.id), readHold(site.id)]);
  return { backups, hold: holdState(hold) };
}
