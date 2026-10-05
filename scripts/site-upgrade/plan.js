// plan: builds every site's new page, reads its live page and runs every
// check Admin > Site upgrades runs (the tab's verdict, unchanged), plus the
// checks admin-site-upgrade's publish would refuse on and the CLI's own.
// Reads only: nothing is written anywhere but the output folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { livePageKey } from '../../netlify/functions/_shared/r2.js';
import { isSlugShared } from '../../netlify/functions/_shared/slugClaim.js';
import {
  MAX_BOOKING_BYTES, MAX_HTML_BYTES, checkPublishRequest, holdState, liveFile, readHold, readableSlug, writableSlug,
} from '../../netlify/functions/_shared/siteUpgradeOps.js';
import { UPGRADE_MANUAL_SKIP, isUpgradedSite, nextStep } from '../../src/lib/siteUpgrade.js';
import { ownerOf, rehydrateSite, tabRow, widgetsOf } from './inputs.js';
import { liveSiteUrl, publicGet, sha256 } from './net.js';
import { diffSummary, formatDiff } from './text-diff.js';

export async function mapLimit(items, limit, fn) {
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

// The sites as the pages are built from them: a draft whose inline photos
// the export left out gets them back from its live page when that page
// holds the very same data (rehydrateSite), so the page and its checks are
// the ones the tab gets. Public GETs only (before the R2 token is loaded).
// Returns the list in the same order, with `rehydrated` / `omittedImages`
// telling what was put back and what is still missing.
export async function prepareSites(sites, { fetchImpl = globalThis.fetch, log = () => {} } = {}) {
  return mapLimit(sites, 2, async (site) => {
    if (!site.omittedImages?.length || !site.slug) return site;
    const why = 'the draft photos left out of the export stay missing (omitted_data)';
    let r = null;
    for (let attempt = 1; !r; attempt++) {
      try {
        r = await publicGet(liveSiteUrl(site.slug), { fetchImpl, maxBytes: MAX_HTML_BYTES, ...LIVE_GET });
        if (r.timedOut) throw new Error(`the page stopped after ${r.bytes} bytes`);
      } catch (e) {
        r = null;
        if (attempt >= 3) {
          log(`${site.slug}: could not read the live page (${e.message}): ${why}`);
          return site;
        }
      }
    }
    if (r.status !== 200 || !r.body) {
      log(`${site.slug}: the live page ${r.status !== 200 ? `answered ${r.status}` : `is over ${MAX_HTML_BYTES} bytes`}: ${why}`);
      return site;
    }
    const out = rehydrateSite(site, r.body);
    log(`${site.slug}: ${out.restored} of ${site.omittedImages.length} draft photo(s) left out of the export put back from the live page (same md5)${out.left ? `; ${out.left} not on the live page` : ''}`);
    return out.site;
  });
}

// Builds each site's page with the render module (render.js, loaded by
// load-render.js). Map site id → { built } or { error }.
export async function buildPages(doc, sites, renderMod) {
  const out = new Map();
  for (const site of sites) {
    try {
      out.set(site.id, { built: await renderMod.buildSitePage({ row: tabRow(site), owner: ownerOf(doc, site), widgets: widgetsOf(doc, site) }) });
    } catch (e) {
      out.set(site.id, { error: `The new page could not be built: ${e.message}` });
    }
  }
  return out;
}

// Time limits for a live page read without R2 (net.js publicGet).
export const LIVE_GET = { timeoutMs: 60000, bodyTimeoutMs: 180000 };
const SLOW_BYTES = 1024 * 1024;

// The live side, shaped like admin-site-upgrade's `live` answer:
// { shared, index, book, hold } plus how it was read.
//   source 'r2':     the R2 objects and the hold, as the function reads them
//   source 'public': GET https://<slug>.autocaregeniushub.com/ (no token):
//                    the hold and the /book object can't be read
export async function readLive(site, { db, source, fetchImpl = globalThis.fetch }) {
  const slug = readableSlug(site);
  const shared = await isSlugShared(db, site);
  if (source === 'r2') {
    const [index, book, hold] = await Promise.all([
      liveFile(livePageKey(slug, 'index.html'), MAX_HTML_BYTES),
      liveFile(livePageKey(slug, 'book/index.html'), MAX_BOOKING_BYTES * 4),
      readHold(site.id),
    ]);
    return { slug, shared, index, book, hold: holdState(hold), holdChecked: true, source };
  }
  // The live sites sometimes stall; a GET that gets no answer is tried
  // again (an answer, even an error status, is final). A body that stops
  // coming after SLOW_BYTES is a page full of inline photos served slowly:
  // flagged as too large to compare, as it is in practice.
  let r;
  for (let attempt = 1; !r; attempt++) {
    try {
      r = await publicGet(liveSiteUrl(slug), { fetchImpl, maxBytes: MAX_HTML_BYTES, ...LIVE_GET });
      if (r.timedOut && r.bytes < SLOW_BYTES) throw new Error(`the page stopped after ${r.bytes} bytes`);
    } catch (e) {
      r = null;
      if (attempt >= 3) throw new Error(`GET ${liveSiteUrl(slug)} got no answer (${e.message})`);
    }
  }
  let index;
  if (r.status === 404) index = { found: false };
  // Too large: like the function's `live`, the size and no page (here the
  // size is "at least").
  else if (r.status === 200 && r.timedOut) index = { found: true, size: r.bytes, tooLarge: true, slow: true };
  else if (r.status === 200) index = r.tooLarge ? { found: true, size: r.bytes, tooLarge: true } : { found: true, size: r.bytes, html: r.body };
  else throw new Error(`GET ${liveSiteUrl(slug)} answered ${r.status}`);
  return { slug, shared, index, book: { found: null }, hold: null, holdChecked: false, source };
}

// One site's outcome. `blocks` are refusals beyond the tab's verdict: what
// admin-site-upgrade's publish would refuse, and the CLI's own rules.
export async function assessSite({ doc, site, built, live, renderMod, db }) {
  const row = tabRow(site);
  const owner = ownerOf(doc, site);
  const { verdict, intended, check, liveHtml } = renderMod.checkSitePage({ row, owner, built, live });
  const blocks = [];
  if (site.omittedImages.length) {
    blocks.push({ code: 'omitted_data', text: `${site.omittedImages.length} photo(s) stored inside the draft were left out of the export and are not on the live page, so this page is not the exact one; the CLI never publishes it` });
  }
  if (verdict.status === 'ready') {
    try {
      checkPublishRequest(row, { htmlContent: built.newHtml, bookingPageHtml: built.bookingPageHtml });
      await writableSlug(db, row);
    } catch (e) {
      blocks.push({ code: 'server_refuses', text: `admin-site-upgrade would refuse it: ${e.message}` });
    }
  }
  const status = verdict.status === 'ready' && !blocks.length ? 'ready' : 'flagged';
  return {
    status, verdict, blocks, intended, check, liveHtml,
    upgraded: isUpgradedSite({ published_at: site.published_at }),
    isPro: built.isPro,
    holdChecked: live.holdChecked,
    hold: live.hold,
  };
}

export function siteDirName(site) {
  return `${site.slug || 'no-slug'}--${site.id.slice(0, 8)}`;
}

function summaryText({ site, result, built, live }) {
  const lines = [];
  const name = site.business_info?.businessName || '(no name)';
  lines.push(`${name} · ${site.slug} · ${site.id}`);
  lines.push(`Template ${site.template_id} · owner plan ${built?.isPro ? 'Pro (no "Powered by" bar)' : 'Free ("Powered by" bar)'} · live read from ${live?.source || '-'}`);
  lines.push(`Status: ${result.status.toUpperCase()}${result.upgraded ? ' · already on the new design (published_at ' + site.published_at + ')' : ''}`);
  if (live && !live.holdChecked) lines.push('Hold: NOT CHECKED (no R2 token)');
  else if (live?.hold?.held) lines.push(`Hold: on hold (${live.hold.reason || 'manual'})`);
  if (result.error) lines.push(`Error: ${result.error}`);
  if (site.rehydrated) lines.push(`Draft photos: ${site.rehydrated} left out of the export were put back from the live page (same md5)`);
  const reasons = result.verdict?.reasons || [];
  if (reasons.length) {
    lines.push('', `Why the tab flags it (${reasons.length}):`);
    for (const r of reasons) {
      lines.push(`  - [${r.code}] ${r.text}`);
      if (nextStep(r.code)) lines.push(`      Next: ${nextStep(r.code)}`);
    }
  }
  if (result.blocks?.length) {
    lines.push('', 'Also refused by the publish path:');
    for (const b of result.blocks) lines.push(`  - [${b.code}] ${b.text}`);
  }
  if (result.intended?.length) {
    lines.push('', 'Dropped on purpose (invented claims, editor placeholders):');
    for (const i of result.intended) lines.push(`  - ${i.label} ("${i.example}")`);
  }
  if (built?.newHtml && result.liveHtml) lines.push('', formatDiff(diffSummary(result.liveHtml, built.newHtml)));
  return `${lines.join('\n')}\n`;
}

// Writes the site's files: new.html, book.html, live.html, summary.txt.
export function writeSiteFiles(outDir, { site, result, built, live }) {
  const dir = path.join(outDir, 'sites', siteDirName(site));
  mkdirSync(dir, { recursive: true });
  if (built?.newHtml) writeFileSync(path.join(dir, 'new.html'), built.newHtml);
  if (built?.bookingPageHtml) writeFileSync(path.join(dir, 'book.html'), built.bookingPageHtml);
  if (result.liveHtml) writeFileSync(path.join(dir, 'live.html'), result.liveHtml);
  writeFileSync(path.join(dir, 'summary.txt'), summaryText({ site, result, built, live }));
  return dir;
}

// The plan row kept in report.json (no page bodies).
export function reportRow({ site, result, built, live }) {
  return {
    siteId: site.id,
    slug: site.slug,
    businessName: site.business_info?.businessName || null,
    template: site.template_id,
    status: result.status,
    error: result.error || null,
    // An error row still says when the site is on the manual check list.
    reasons: result.verdict?.reasons || manualSkipReasons(site),
    blocks: result.blocks || [],
    intended: (result.intended || []).map((i) => i.label),
    upgraded: !!result.upgraded,
    publishedAt: site.published_at || null,
    isPro: built ? built.isPro : null,
    hold: live ? (live.holdChecked ? live.hold : 'unchecked') : null,
    liveSource: live?.source || null,
    liveBytes: live?.index?.size || 0,
    liveSha256: result.liveHtml ? sha256(result.liveHtml) : null,
    newBytes: built?.newHtml ? Buffer.byteLength(built.newHtml, 'utf8') : 0,
    newSha256: built?.newHtml ? sha256(built.newHtml) : null,
    bookSha256: built?.bookingPageHtml ? sha256(built.bookingPageHtml) : null,
    fingerprint: site.fingerprint,
    omittedImages: site.omittedImages.length,
    rehydratedImages: site.rehydrated || 0,
  };
}

function manualSkipReasons(site) {
  const s = UPGRADE_MANUAL_SKIP.find((x) => x.siteId === site.id);
  return s ? [{ code: 'manual_skip', text: `On the manual check list: ${s.reason}` }] : [];
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');

export function reportMarkdown({ rows, header }) {
  const lines = [...header, '', '| Site | Status | Template | Plan | Hold | Reasons |', '|---|---|---|---|---|---|'];
  for (const r of rows) {
    const listed = [...r.reasons.map((x) => `[${x.code}] ${x.text}`), ...r.blocks.map((x) => `[${x.code}] ${x.text}`)];
    const why = (r.error ? [`ERROR: ${r.error}`, ...listed] : listed).join('<br>') || '—';
    const hold = r.hold === 'unchecked' ? 'not checked' : r.hold?.held ? 'ON HOLD' : 'none';
    lines.push(`| ${cell(r.slug)} \`${r.siteId.slice(0, 8)}\` | **${r.status.toUpperCase()}**${r.upgraded ? ' (new design live)' : ''} | ${cell(r.template)} | ${r.isPro == null ? '?' : r.isPro ? 'Pro' : 'Free'} | ${hold} | ${cell(why)} |`);
  }
  return `${lines.join('\n')}\n`;
}
