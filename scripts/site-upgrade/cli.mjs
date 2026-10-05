// Site upgrades from the terminal: Admin > Site upgrades without a browser.
//
// Run it from a mirror of the commit production runs, never from the shared
// repo (no node_modules there, and other sessions' uncommitted edits):
//   sh scripts/site-upgrade/mirror.sh <repo> <deployed commit> <new mirror dir> <node_modules dir> [<functions node_modules dir>]
//   cd <mirror dir> && npm run site:upgrade -- <command> [flags]
// mirror.sh copies the commit with `git archive` and writes SOURCE_COMMIT and
// SOURCE_TREE; publish checks every file against them (source.js).
//
// 1. Export the inputs (READ-ONLY): run scripts/site-upgrade/export-inputs.sql
//    with the Supabase MCP execute_sql on project ktnouhjikmlxlbxcxyif and
//    save the answer as a file (the MCP's saved result file works as is).
// 2. Commands:
//    plan     --inputs f [--sites a,b] [--out dir]            (the default)
//             Builds every site's new page exactly as the tab does, reads the
//             live page, runs every check, writes report.md / report.json,
//             fresh-check.sql (for the ready sites) and per site new.html,
//             live.html, book.html, summary.txt (with a text diff). Writes
//             nothing anywhere else. Without the R2 token it reads live pages
//             with public GETs and CANNOT see holds: it says so.
//    publish  --inputs f --fresh f2 --sites a,b --by admin@x --deployed-commit <sha> --confirm PUBLISH
//             [--dry-run] [--include-upgraded] [--max-input-age N<=30]
//             --fresh: the saved result of the READ-ONLY fresh-check SQL (plan
//             writes it; publish prints it for the named sites), run right
//             before: a site whose row, owner plan or widget keys changed
//             since the export is refused. Only sites READY right now, only
//             from a mirror of --deployed-commit, only when production runs
//             this code (guard.js), only with inputs at most 30 minutes old,
//             only after migration 20261004 (published_at). Per site: check
//             again from R2, back up, upload, verify (R2 and the public URL);
//             stops at the first error. Prints the SQL to check drift and to
//             record published_at, which the operator runs with the owner's
//             approval.
//    backups  --inputs f --site a                              list backups and the hold
//    restore  --inputs f --site a --backup ID --by admin@x --confirm RESTORE [--dry-run]
//             only while this site's page is what is live; backs up the live
//             page, puts the backup live, holds the site, prints the SQL that
//             clears published_at (inputs at most 30 minutes old)
//    hold     --inputs f --site a [--note "..."] --by admin@x --confirm HOLD [--dry-run]
//    unhold   --inputs f --site a --by admin@x --confirm UNHOLD [--dry-run]
//    --by: a super admin's email (the export lists them); writes record that
//    admin as Admin > Site upgrades records the signed-in one.
//    --dry-run shows exactly what would be written (R2 keys, sizes, sha256)
//    and writes nothing. Exit codes: 0 done, 1 stopped by an error (something
//    may have been written: read the log), 2 refused (nothing was written).
// 3. Secrets: only a Cloudflare API token scoped to the R2 bucket
//    autosite-published, in ~/.config/acg/site-upgrade.env (chmod 600; path
//    overridable with ACG_UPGRADE_ENV):
//      CLOUDFLARE_ACCOUNT_ID=<32 hex>
//      CLOUDFLARE_API_TOKEN=<token>
//    The token is never printed, logged or written. No Supabase key is used.
// Output goes to --out (default ~/acg-site-upgrade/<command>-<time>/), never
// inside this checkout. Ctrl-C during publish stops after the current site;
// a second Ctrl-C quits at once, printing the SQL for the sites already
// published.
import { mkdirSync, realpathSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PRODUCTION_APP_ORIGIN, UPGRADE_MANUAL_SKIP, isEmailAddress } from '../../src/lib/siteUpgrade.js';
import { APP_ROOT, startRenderer } from './load-render.js';
import { activateSecrets, loadSecrets, redact } from './env.js';
import {
  adminFor, freshAgeMinutes, freshProblems, inputsAgeMinutes, inputsDb, loadFresh, loadInputs, selectSites,
} from './inputs.js';
import { createNetGuard, liveSiteUrl, publicGet, sha256 } from './net.js';
import { productionGuard } from './guard.js';
import { sourceLine, sourceState } from './source.js';
import {
  assessSite, buildPages, mapLimit, prepareSites, readLive, reportMarkdown, reportRow, writeSiteFiles,
} from './plan.js';
import {
  FRESH_MAX_AGE_MIN, PUBLISH_CONFIRM, RESTORE_CONFIRM, backupLabel, listSiteBackups, publishSites, restoreSite, setHold,
  simulatedWrites,
} from './ops.js';
import { driftSql, freshSql, inert, publishedSql, restoreSql } from './sql.js';

const COMMANDS = ['plan', 'publish', 'backups', 'restore', 'hold', 'unhold', 'help'];
// The longest the inputs may be old: publish and restore build on the
// export's rows (the fresh check narrows publish further); a hold only
// names a site id.
const WRITE_MAX_AGE_MIN = 30;
const HOLD_MAX_AGE_MIN = 24 * 60;
const EXIT = { ok: 0, stopped: 1, refused: 2 };

class Refusal extends Error {}
const sigint = { on: false, state: null };

function stamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// The output folder, checked before it is created: never inside this
// checkout (production pages stay out of the repo).
function outDirFor(cmd, out) {
  const dir = path.resolve(out || path.join(homedir(), 'acg-site-upgrade', `${cmd}-${stamp()}`));
  let existing = dir;
  while (!existsSync(existing)) existing = path.dirname(existing);
  const real = path.join(realpathSync(existing), path.relative(existing, dir));
  if (inside(real, realpathSync(APP_ROOT))) {
    throw new Refusal(`--out ${dir} is inside the app checkout; production pages stay out of the repo`);
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeLog(file) {
  const line = (text = '') => {
    const s = redact(text);
    process.stdout.write(`${s}\n`);
    if (file) appendFileSync(file, `${s}\n`);
  };
  return line;
}

function list(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// --max-input-age: whole or decimal minutes, only ever lower than `limit`.
function maxAge(args, limit) {
  const raw = args['max-input-age'];
  if (raw == null) return limit;
  const n = /^\d+(?:\.\d+)?$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > limit) throw new Refusal(`--max-input-age must be a number of minutes from 1 to ${limit}`);
  return n;
}

function requireFresh(doc, limit, log) {
  const age = inputsAgeMinutes(doc);
  log(`Inputs exported ${doc.exportedAt} (${age.toFixed(1)} min ago), ${doc.sites.length} live websites.`);
  if (age > limit) {
    throw new Refusal(`The inputs are ${Math.round(age)} minutes old (limit ${limit}): run export-inputs.sql again`);
  }
  if (age < -5) throw new Refusal('The inputs say they were exported in the future: check this Mac\'s clock');
}

// The admin a write is recorded under. Required for a real write; a dry
// run takes it when given.
function whoFor(args, doc, dryRun) {
  if (args.by == null) {
    if (dryRun) return { id: null, email: null };
    throw new Refusal('--by <your super admin email> is required: writes record the admin who made them');
  }
  if (!isEmailAddress(args.by)) throw new Refusal('--by must be an email address');
  return adminFor(doc, args.by);
}

async function guardCheck(log) {
  const getText = async (url) => {
    const r = await publicGet(url, { bust: false });
    if (r.status !== 200) throw new Error(`GET ${url} answered ${r.status}`);
    return r.body;
  };
  const g = await productionGuard({ getText, appRoot: APP_ROOT });
  log(`Production guard (${PRODUCTION_APP_ORIGIN} runs this checkout's code): ${g.ok ? 'PASS' : 'FAIL'}`);
  for (const c of g.checks) log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}`);
  return g;
}

function r2Banner(secrets, log) {
  if (secrets.found) {
    log(`R2: token loaded from ${secrets.path}; live pages, holds and backups are read from R2.`);
    return;
  }
  log('!'.repeat(78));
  log(`!! NO R2 TOKEN (${secrets.why}: ${secrets.path}).`);
  log('!! Live pages were read with public GETs. HOLDS (hold.json) and /book objects');
  log('!! COULD NOT BE READ: a READY site may still be on hold. publish needs the token');
  log('!! and checks holds again before every write.');
  log('!'.repeat(78));
}

async function render(doc, sites, log) {
  log(`Building ${sites.length} page${sites.length === 1 ? '' : 's'} (exportHtml, widgets from ${PRODUCTION_APP_ORIGIN})...`);
  const renderer = await startRenderer();
  try {
    return { renderMod: renderer.mod, pages: await buildPages(doc, sites, renderer.mod) };
  } finally {
    // The token is loaded only after this: no template code runs while
    // the process holds it.
    await renderer.close();
  }
}

// ─── plan ──────────────────────────────────────────────────────────────

async function cmdPlan(args) {
  const outDir = outDirFor('plan', args.out);
  const log = makeLog(path.join(outDir, 'plan.log'));
  const doc = loadInputs(args.inputs);
  const db = inputsDb(doc);
  const age = inputsAgeMinutes(doc);
  log(`site-upgrade plan · ${new Date().toISOString()} · output ${outDir}`);
  const source = sourceState(APP_ROOT);
  log(sourceLine(source));
  const sites = await prepareSites(args.sites ? selectSites(doc, list(args.sites)) : doc.sites, { log });
  log(`Inputs exported ${doc.exportedAt} (${age.toFixed(1)} min ago): ${doc.sites.length} live websites, planning ${sites.length}.`);
  const { renderMod, pages } = await render(doc, sites, log);
  const guard = await guardCheck(log);
  // plan works without R2: a missing or broken env file only means it
  // reads public pages and cannot see holds (said loudly below).
  let secrets;
  try {
    secrets = loadSecrets({ appRoot: APP_ROOT });
  } catch (e) {
    secrets = { found: false, path: e.message, why: 'the env file was not used' };
  }
  if (secrets.found) activateSecrets(secrets);
  const liveSource = secrets.found ? 'r2' : 'public';
  r2Banner(secrets, log);
  if (!doc.publishedAtTracked) log('sites.published_at does not exist yet (migration 20261004_sites_published_at.sql): publish refuses until it is applied.');

  const rows = await mapLimit(sites, 4, async (site) => {
    const page = pages.get(site.id);
    let live = null;
    let result;
    try {
      if (page.error) throw new Error(page.error);
      live = await readLive(site, { db, source: liveSource });
      result = await assessSite({ doc, site, built: page.built, live, renderMod, db });
    } catch (e) {
      result = { status: 'error', error: e.message, verdict: null, blocks: [], intended: [], upgraded: false };
    }
    writeSiteFiles(outDir, { site, result, built: page.built, live });
    return reportRow({ site, result, built: page.built, live });
  });
  rows.sort((a, b) => String(a.slug).localeCompare(String(b.slug)) || a.siteId.localeCompare(b.siteId));

  const count = (st) => rows.filter((r) => r.status === st).length;
  const ready = rows.filter((r) => r.status === 'ready');
  const waiting = ready.filter((r) => !r.upgraded).length;
  const freshFile = path.join(outDir, 'fresh-check.sql');
  const fresh = freshSql(ready.map((r) => ({ id: r.siteId, fingerprint: r.fingerprint })));
  if (fresh) writeFileSync(freshFile, `${fresh}\n`);
  const header = [
    `# Site upgrade plan, ${new Date().toISOString()}`,
    '',
    `- ${sourceLine(source)}.`,
    `- Inputs: exported ${doc.exportedAt} (${age.toFixed(1)} min before the plan), ${doc.sites.length} live websites; ${sites.length} planned.`,
    `- Live pages read from: ${liveSource === 'r2' ? 'R2 (with holds)' : '**public GETs: NO R2 TOKEN, HOLDS NOT CHECKED**'}.`,
    `- Production guard: ${guard.ok ? 'PASS' : '**FAIL** (publish refuses)'}: ${guard.checks.map((c) => `${c.name} ${c.ok ? 'ok' : 'FAIL'}`).join(', ')}.`,
    `- sites.published_at: ${doc.publishedAtTracked ? 'present' : '**missing** (migration 20261004 not applied: publish refuses)'}.`,
    `- Result: ${count('ready')} ready (${waiting} not yet on the new design), ${count('flagged')} flagged, ${count('error')} errors. Manual check list: ${UPGRADE_MANUAL_SKIP.length} sites.`,
    `- Before publishing: run ${fresh ? 'fresh-check.sql (READ-ONLY, in this folder)' : 'the fresh-check SQL'} right before, and pass its saved result as --fresh.`,
  ];
  writeFileSync(path.join(outDir, 'report.md'), reportMarkdown({ rows, header }));
  writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({
    kind: 'site-upgrade-plan', at: new Date().toISOString(), inputsExportedAt: doc.exportedAt, liveSource,
    source: { pinned: source.pinned, commit: source.commit }, guard, publishedAtTracked: doc.publishedAtTracked, sites: rows,
  }, null, 2)}\n`);

  log('');
  for (const r of rows) {
    const codes = [...r.reasons, ...r.blocks].map((x) => x.code).join(', ');
    const why = r.error ? `ERROR ${r.error}${codes ? ` (${codes})` : ''}` : codes;
    log(`${r.status.toUpperCase().padEnd(8)} ${String(r.slug).padEnd(38)} ${r.siteId.slice(0, 8)}${r.upgraded ? ' (new design live)' : ''}${why ? `  ${why}` : ''}`);
  }
  log('');
  log(header.slice(2).map((h) => h.replace(/\*\*/g, '')).join('\n'));
  log(`Report: ${path.join(outDir, 'report.md')}`);
  return EXIT.ok;
}

// ─── publish ───────────────────────────────────────────────────────────

async function cmdPublish(args, net, state) {
  if (!args.sites) throw new Refusal('publish needs --sites slug1,slug2 (never all sites at once)');
  const dryRun = !!args['dry-run'];
  if (!dryRun && args.confirm !== PUBLISH_CONFIRM) throw new Refusal(`publish needs --confirm ${PUBLISH_CONFIRM} (or --dry-run)`);
  const limit = maxAge(args, WRITE_MAX_AGE_MIN);
  const doc = loadInputs(args.inputs);
  const by = whoFor(args, doc, dryRun);
  const named = selectSites(doc, list(args.sites));
  const outDir = outDirFor(dryRun ? 'publish-dry-run' : 'publish', args.out);
  const log = makeLog(path.join(outDir, 'run.log'));
  const runId = `${stamp()}-${sha256(String(Math.random())).slice(0, 6)}`;
  const recordsFile = path.join(outDir, 'records.jsonl');
  log(`site-upgrade publish${dryRun ? ' --dry-run' : ''} · run ${runId} · output ${outDir}${by.email ? ` · by ${by.email}` : ''}`);
  const refusals = [];
  const refuse = (msg) => { if (!dryRun) throw new Refusal(msg); refusals.push(msg); log(`WOULD REFUSE: ${msg}`); };
  const sqlFor = (records) => ({ drift: driftSql(records), published: publishedSql(records, { runId }) });

  try { requireFresh(doc, limit, log); } catch (e) { refuse(e.message); }
  if (!doc.publishedAtTracked) refuse('Apply migration 20261004_sites_published_at.sql before republishing: it records which sites are done');
  const source = sourceState(APP_ROOT);
  log(sourceLine(source));
  if (!source.pinned) refuse(`Run publish from a mirror of the deployed commit (scripts/site-upgrade/mirror.sh): ${source.problems.slice(0, 3).join('; ')}`);
  const deployed = String(args['deployed-commit'] || '').trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(deployed)) {
    refuse('publish needs --deployed-commit <sha>: the commit production runs (Netlify > Deploys > published deploy, or the Netlify MCP\'s commit_ref)');
  } else if (source.commit && !source.commit.startsWith(deployed)) {
    refuse(`This mirror is commit ${source.commit}, but production runs ${deployed}: make a mirror of the deployed commit`);
  }
  const guard = await guardCheck(log);
  if (!guard.ok) refuse(`Production does not run this checkout's code (merge and deploy PR #10 first, and run from a mirror of the deployed commit): ${guard.checks.filter((c) => !c.ok).map((c) => c.detail).join('; ')}`);
  const secrets = loadSecrets({ appRoot: APP_ROOT });
  if (!secrets.found) refuse(`No R2 token (${secrets.path}): publish reads holds and backs up through R2`);

  // The fresh check: the named sites' rows, owner plans and widget keys,
  // read through the MCP minutes ago, are still what the export holds.
  let fresh = null;
  const freshText = freshSql(named);
  writeFileSync(path.join(outDir, 'fresh-check.sql'), `${freshText}\n`);
  const showFreshSql = () => { log('-- The fresh check for these sites (READ-ONLY; also saved as fresh-check.sql here):'); log(freshText); };
  if (!args.fresh) {
    showFreshSql();
    refuse('publish needs --fresh <file>: run the READ-ONLY fresh-check SQL (above) right before publishing and save the result');
  } else {
    try {
      fresh = loadFresh(args.fresh);
    } catch (e) {
      refuse(e.message);
    }
    if (fresh) {
      const fAge = freshAgeMinutes(fresh);
      log(`Fresh check ran ${fresh.checkedAt} (${fAge.toFixed(1)} min ago).`);
      if (fAge > FRESH_MAX_AGE_MIN || fAge < -2) {
        showFreshSql();
        refuse(`The fresh check is ${Math.round(fAge)} minutes old (limit ${FRESH_MAX_AGE_MIN}): run it again (above) right before publishing`);
      }
      const problems = freshProblems(doc, named, fresh);
      for (const p of problems) log(`CHANGED ${p.site.slug} ${p.site.id}: ${p.why}`);
      if (problems.length) refuse(`${problems.length} named site${problems.length === 1 ? '' : 's'} changed since the export or are not in the fresh check: export again, plan again`);
    }
  }

  const sites = await prepareSites(named, { log });
  const { renderMod, pages } = await render(doc, sites, log);
  if (secrets.found) activateSecrets(secrets);
  const liveSource = secrets.found ? 'r2' : 'public';
  r2Banner(secrets, log);
  const db = inputsDb(doc);

  // Preflight: every named site must be ready right now.
  const publicCheck = new Map();
  const notReady = [];
  const ready = [];
  for (const site of sites) {
    const page = pages.get(site.id);
    if (page.error) { notReady.push(`${site.slug}: ${page.error}`); continue; }
    let live;
    let result;
    try {
      live = await readLive(site, { db, source: liveSource });
      result = await assessSite({ doc, site, built: page.built, live, renderMod, db });
    } catch (e) {
      notReady.push(`${site.slug}: ${e.message}`);
      continue;
    }
    writeSiteFiles(outDir, { site, result, built: page.built, live });
    if (result.status !== 'ready') {
      notReady.push(`${site.slug}: ${[...result.verdict.reasons, ...result.blocks].map((r) => `[${r.code}] ${r.text}`).join('; ')}`);
    } else if (result.upgraded && !args['include-upgraded']) {
      notReady.push(`${site.slug}: already on the new design (published_at ${site.published_at}); pass --include-upgraded to republish it`);
    } else {
      ready.push(site);
      if (!live.holdChecked) log(`${site.slug}: ready, but its hold could not be checked (no R2 token)`);
    }
    if (liveSource === 'r2' && live.index.html) {
      const pub = await publicGet(liveSiteUrl(live.slug)).catch(() => null);
      // The public URL served the R2 object byte for byte before the
      // publish: after it, it must serve the new page the same way.
      publicCheck.set(site.id, pub?.status === 200 && sha256(pub.body) === sha256(live.index.html) ? 'strict' : 'soft');
    }
  }
  if (notReady.length) {
    for (const n of notReady) log(`NOT READY ${n}`);
    refuse(`${notReady.length} of ${sites.length} named site${sites.length === 1 ? ' is' : 's are'} not ready; nothing was published. Leave ${notReady.length === 1 ? 'it' : 'them'} out of --sites.`);
  }

  // From here on, each published site is on disk the moment it is live,
  // and a second Ctrl-C prints the SQL for those before quitting.
  const records = [];
  const finish = (outcome) => {
    const sql = sqlFor(outcome.records);
    writeFileSync(path.join(outDir, 'run.json'), `${redact(JSON.stringify({
      kind: 'site-upgrade-publish', runId, dryRun, at: new Date().toISOString(), inputsExportedAt: doc.exportedAt,
      freshCheckedAt: fresh?.checkedAt || null, source: { pinned: source.pinned, commit: source.commit }, by,
      guard, refusals, records: outcome.records, writes: outcome.writes, stopped: outcome.stopped, stopReason: outcome.stopReason,
      // A dry run's SQL is for reading only: it never holds a statement.
      sql: dryRun
        ? { drift: inert(sql.drift, 'DRY RUN: nothing was published. Do not run.'), published: inert(sql.published, 'DRY RUN: nothing was published. Do not run.') }
        : sql,
    }, null, 2))}\n`);
    return sql;
  };
  state.onAbort = () => {
    const sql = finish({ records, writes: [], stopped: true, stopReason: 'Quit by a second Ctrl-C' });
    log('');
    log(`QUIT by a second Ctrl-C after ${records.length} published site${records.length === 1 ? '' : 's'}. A write in progress may or may not have landed: see "sending" lines above.`);
    if (records.length && !dryRun) {
      log('-- 1. READ-ONLY drift check, then 2. with the owner\'s approval, record the published sites:');
      log(sql.drift);
      log(sql.published);
    }
  };

  let outcome;
  if (!secrets.found) {
    // Dry run without R2: what the writes would be, worked out by hand.
    log('Without the R2 token the backups cannot be read or simulated exactly; the writes below follow backupLivePages + uploadSitePages:');
    const simulated = [];
    for (const site of ready) {
      const page = pages.get(site.id);
      for (const w of simulatedWrites(site, site.slug, page.built)) {
        log(`  ${site.slug}: WOULD WRITE ${w.key}${w.bytes ? ` (${w.bytes} bytes, sha256 ${w.sha256.slice(0, 16)})` : ` (${w.note})`}`);
      }
      simulated.push({ siteId: site.id, slug: site.slug, publishedAt: new Date().toISOString(), fingerprint: site.fingerprint, dryRun: true });
    }
    outcome = { records: simulated, writes: [], stopped: false, stopReason: null };
  } else {
    // A dry run goes on with the ready sites only (a real run has refused).
    outcome = await publishSites(ready, {
      doc, db, renderMod, pages, net, by, dryRun, includeUpgraded: !!args['include-upgraded'], log, publicCheck, fresh,
      shouldStop: () => state.stop,
      onRecord: (r) => {
        records.push(r);
        appendFileSync(recordsFile, `${JSON.stringify(r)}\n`);
        if (!r.dryRun) log(`recorded ${r.slug} ${r.siteId} published_at=${r.publishedAt} backup=${r.backupId}`);
      },
    });
  }
  state.onAbort = null;

  const sql = finish(outcome);
  log('');
  if (outcome.stopped) log(`STOPPED: ${outcome.stopReason}`);
  if (dryRun) {
    log(refusals.length
      ? `Dry run: nothing was written. A real run with these arguments would REFUSE (${refusals.length} reason${refusals.length === 1 ? '' : 's'} above) and write nothing. Once they are resolved it would publish ${outcome.records.length} of ${sites.length} site${sites.length === 1 ? '' : 's'}, with the writes listed above.`
      : `Dry run: nothing was written. Would publish ${outcome.records.length} of ${sites.length} site${sites.length === 1 ? '' : 's'}.`);
  } else {
    log(`Published ${outcome.records.length} of ${sites.length} site${sites.length === 1 ? '' : 's'}.`);
  }
  if (sql.published) {
    log('');
    if (dryRun) {
      log(inert(sql.published, 'DRY RUN: the SQL a real run would print. Nothing was published: do not run it.'));
    } else {
      log('-- 1. READ-ONLY, first: every row must say unchanged = true (Supabase MCP execute_sql, project ktnouhjikmlxlbxcxyif).');
      log(sql.drift);
      log('');
      log('-- 2. Then, with the owner\'s approval:');
      log(sql.published);
    }
  }
  log(`Run log: ${path.join(outDir, 'run.log')}`);
  if (dryRun && refusals.length) return EXIT.refused;
  return outcome.stopped ? EXIT.stopped : EXIT.ok;
}

// ─── backups / restore / hold ──────────────────────────────────────────

function oneSite(args, cmd) {
  if (!args.site) throw new Refusal(`${cmd} needs --site <slug or site id>`);
  const doc = loadInputs(args.inputs);
  const [site] = selectSites(doc, [args.site]);
  return { doc, site };
}

function needR2(cmd) {
  const secrets = loadSecrets({ appRoot: APP_ROOT });
  if (!secrets.found) throw new Refusal(`${cmd} needs the R2 token (${secrets.path}: ${secrets.why})`);
  activateSecrets(secrets);
}

async function cmdBackups(args) {
  const { site } = oneSite(args, 'backups');
  needR2('backups');
  const log = makeLog(null);
  const { backups, hold } = await listSiteBackups(site);
  log(`${site.slug} ${site.id}: ${backups.length} backup${backups.length === 1 ? '' : 's'}, newest first`);
  for (const b of backups) log(`  ${b.id}  ${backupLabel(b.id)}  ${b.files.join(' + ')}  ${b.size} bytes`);
  log(hold ? `Hold: ${hold.held ? `ON HOLD (${hold.reason}${hold.note ? `: ${hold.note}` : ''}, ${hold.at})` : `released ${hold.at}`}` : 'Hold: none');
  return EXIT.ok;
}

async function cmdRestore(args, net) {
  const dryRun = !!args['dry-run'];
  if (!dryRun && args.confirm !== RESTORE_CONFIRM) throw new Refusal(`restore needs --confirm ${RESTORE_CONFIRM} (or --dry-run)`);
  const limit = maxAge(args, WRITE_MAX_AGE_MIN);
  const { doc, site } = oneSite(args, 'restore');
  const by = whoFor(args, doc, dryRun);
  const outDir = outDirFor(dryRun ? 'restore-dry-run' : 'restore', args.out);
  const log = makeLog(path.join(outDir, 'run.log'));
  requireFresh(doc, limit, log);
  needR2('restore');
  const runJson = (extra) => writeFileSync(path.join(outDir, 'run.json'), `${redact(JSON.stringify({
    kind: 'site-upgrade-restore', dryRun, at: new Date().toISOString(), siteId: site.id, backupId: args.backup, by, ...extra,
  }, null, 2))}\n`);
  let out;
  try {
    out = await restoreSite(site, { db: inputsDb(doc), backupId: args.backup, net, by, dryRun, log });
  } catch (e) {
    // Nothing live was changed. A safety copy of the live page may have
    // been stored on the way: say so.
    runJson({ error: e.message, safetyBackupId: e.safetyBackupId ?? null, wrote: !!e.wrote });
    if (!e.wrote && (e.status == null || e.status < 500)) throw e;
    log(`STOPPED: ${e.message}`);
    log(`The live page was not changed${e.safetyBackupId ? `; a copy of it was saved as backup ${e.safetyBackupId}` : ''}. Nothing to record in the database.`);
    return EXIT.stopped;
  }
  const sql = doc.publishedAtTracked ? restoreSql({ siteId: site.id, slug: out.slug }) : '-- (sites.published_at does not exist yet: nothing to clear)';
  runJson({ slug: out.slug, ...out, sql: dryRun ? inert(sql, 'DRY RUN: nothing was restored. Do not run.') : sql });
  if (out.partial) {
    log(`STOPPED: ${out.partial}`);
    log(`The main page of ${out.slug} IS the restored backup ${args.backup} now, but not every file was written. The page that was live is saved as backup ${out.safetyBackupId || '(none)'}; to put it back: restore --site ${site.slug} --backup ${out.safetyBackupId} --confirm RESTORE.`);
  } else {
    log(`${dryRun ? 'Dry run: nothing was written. Would restore' : 'Restored'} ${args.backup} on ${out.slug} (the live page ${dryRun ? 'would be' : 'is'} saved as ${out.safetyBackupId || 'nothing: none was live'})${out.hold ? '; site on hold' : ''}.`);
  }
  if (out.holdError) log(`WARNING ${out.holdError}`);
  log('');
  if (dryRun) {
    log(inert(sql, 'DRY RUN: the SQL a real run would print. Nothing was restored: do not run it.'));
  } else {
    log('-- Run with the owner\'s approval (Supabase MCP execute_sql):');
    log(sql);
  }
  return out.partial || out.holdError ? EXIT.stopped : EXIT.ok;
}

async function cmdHold(args, net, held) {
  const word = held ? 'HOLD' : 'UNHOLD';
  const dryRun = !!args['dry-run'];
  if (!dryRun && args.confirm !== word) throw new Refusal(`${held ? 'hold' : 'unhold'} needs --confirm ${word} (or --dry-run)`);
  const limit = maxAge(args, HOLD_MAX_AGE_MIN);
  const { doc, site } = oneSite(args, held ? 'hold' : 'unhold');
  const by = whoFor(args, doc, dryRun);
  const log = makeLog(null);
  requireFresh(doc, limit, log);
  needR2(held ? 'hold' : 'unhold');
  const out = await setHold(site, { held, note: args.note, net, by, dryRun, log });
  log(`${dryRun ? 'Dry run: nothing was written. Would put' : 'Put'} ${site.slug} ${held ? 'on hold' : 'off hold (released)'}${out.hold.note ? `: ${out.hold.note}` : ''}.`);
  if (!held) log('Run plan again before publishing it.');
  return EXIT.ok;
}

// ─── main ──────────────────────────────────────────────────────────────

export async function main(argv = process.argv.slice(2)) {
  const { values: args, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      inputs: { type: 'string' }, fresh: { type: 'string' }, out: { type: 'string' }, sites: { type: 'string' }, site: { type: 'string' },
      backup: { type: 'string' }, confirm: { type: 'string' }, note: { type: 'string' }, by: { type: 'string' },
      'deployed-commit': { type: 'string' }, 'max-input-age': { type: 'string' }, 'dry-run': { type: 'boolean' },
      'include-upgraded': { type: 'boolean' }, help: { type: 'boolean' },
    },
  });
  const cmd = positionals[0] || 'plan';
  if (args.help || cmd === 'help') {
    process.stdout.write('Usage: see the comment at the top of scripts/site-upgrade/cli.mjs\n');
    return EXIT.ok;
  }
  if (!COMMANDS.includes(cmd) || positionals.length > 1) throw new Refusal(`Unknown command "${positionals.join(' ')}" (${COMMANDS.join(', ')})`);
  if (!args.inputs) throw new Refusal(`${cmd} needs --inputs <file> (the saved result of export-inputs.sql)`);
  if (!existsSync(args.inputs)) throw new Refusal(`No inputs file at ${args.inputs}`);

  // Only the env file's token is ever used, never one from the shell.
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  const net = createNetGuard();
  net.install();
  const state = { stop: false, onAbort: null };
  if (cmd === 'publish') {
    sigint.state = state;
    if (!sigint.on) {
      sigint.on = true;
      process.on('SIGINT', () => {
        const st = sigint.state;
        if (!st || st.stop) {
          try { st?.onAbort?.(); } finally { process.exit(130); }
        }
        st.stop = true;
        process.stdout.write('\nStopping after the current site (Ctrl-C again to quit now).\n');
      });
    }
  }

  switch (cmd) {
    case 'plan': return cmdPlan(args);
    case 'publish': return cmdPublish(args, net, state);
    case 'backups': return cmdBackups(args);
    case 'restore': return cmdRestore(args, net);
    case 'hold': return cmdHold(args, net, true);
    case 'unhold': return cmdHold(args, net, false);
    default: return EXIT.refused;
  }
}

// main() with its errors turned into an exit code and a message. Refused
// (2) means nothing was written: this tool's refusals, the inputs', the
// env file's, the network guard's, and the shared upgrade checks' (an HTTP
// status below 500, before any write). Anything else stopped the run (1).
export async function run(argv = process.argv.slice(2)) {
  try {
    return await main(argv);
  } catch (e) {
    const refused = e instanceof Refusal || e.inputs || e.config || e.blocked
      || (Number.isInteger(e.status) && e.status < 500 && !e.wrote)
      || e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || e.code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL';
    process.stderr.write(`${redact(refused ? `Refused: ${e.message}` : `Error: ${e.stack || e.message}`)}\n`);
    return refused ? EXIT.refused : EXIT.stopped;
  }
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) run().then((code) => { process.exitCode = code; });
