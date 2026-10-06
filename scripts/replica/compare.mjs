// "Exact replica" builder, steps 4 and 5: render the replica template with
// the customer's content, then put it side by side with the reference
// (.claude/skills/replica-template/SKILL.md).
//
//   node scripts/replica/compare.mjs render (--row <site-row.json> | --fixture full) --template <id> --out <page.html>
//        [--colors '{"accent":"#rrggbb",...}'] [--free-bar]
//   node scripts/replica/compare.mjs --reference <capture dir> --replica <capture dir | page.html> --out <dir>
//        [--title "Project name"] [--offline] [--max-height 12000] [--chrome <path>]
//   node scripts/replica/compare.mjs leak-check --reference <capture dir> --source <file> [...] [--template <id>]
//   node scripts/replica/compare.mjs palette --project <project-row.json>
//   node scripts/replica/compare.mjs palette --colors '{"bg":"#rrggbb",...all five roles}'
//
// leak-check: exits 1 when a changed file holds the reference's words
// (heading and button text from the outline, page-title parts, so its name),
// its domain or its brand colors, or when a color list can't be checked.
// Run it on every file of the diff before a commit.
//
// palette: the replica's five colors from our side (Studio, brand system,
// brand colors, template), the way "Match its layout" picks them, repaired
// so its registry entry passes kit/theme.test.js. Never from the reference.
// With --colors it checks and repairs a palette you chose (a look's, or the
// registry entry after a hand edit) the same way.
//
// render: the published page exactly as exportHtml builds it (the Site
// upgrades renderer, scripts/site-upgrade/load-render.js), with no site id,
// so no live booking or contact widget loads. --row is the customer's draft
// site (custom_site_projects.site_id) saved from a READ-ONLY query, as plain
// JSON or the Supabase MCP's saved result; --fixture uses the theme:check
// sample business instead. "Powered by" stays off (custom sites are paid)
// unless --free-bar.
//
// compare writes into --out:
//   compare-<viewport>.png   reference | replica side by side: the owner's review image
//   compare-<viewport>.html  the same page to scroll (images load from the capture folders)
//   report.md, report.json   layout checks per viewport and the section-by-section list
//   replica-capture/         the replica's capture, when --replica is an .html file
//
// The review image shows the reference's screenshots for comparison only. No
// file here goes into the repo, and nothing from the reference goes into a
// template beyond layout, structure, spacing, type feel and component style.
//
// Node only: there is no sharp or pngjs in node_modules, so the side by side
// is an HTML page that the same headless Chrome (capture.mjs) screenshots.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  CAPTURE_FORMAT, VIEWPORTS, assertOutsideRepo, capture, evaluate, launchChrome, openTab,
} from './capture.mjs';

export const REPORT_FORMAT = 'acg-replica-compare/1';
export const REVIEW_NOTE = 'Reference: layout only. Its words, photos, logo and brand marks never go into the replica. '
  + 'Replica: the customer\'s own content, colors and logo.';

const COLOR_ROLES = ['bg', 'accent', 'text', 'secondary', 'muted'];
const HEX_RE = /^#[0-9a-f]{6}$/i;
const TEMPLATE_ID_RE = /^[a-z0-9_]{2,40}$/;
const GUTTER = 24;
const MAX_COLUMN = 720;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// ─── Captures ────────────────────────────────────────────────────────

export function loadCapture(dir) {
  const file = path.join(path.resolve(dir), 'manifest.json');
  if (!existsSync(file)) throw new Error(`${dir} is not a capture folder (no manifest.json): run capture.mjs first`);
  // Real path, like the --out folder (assertOutsideRepo), so the review
  // page's relative links stay short (/var vs /private/var on macOS).
  const abs = realpathSync(path.resolve(dir));
  const manifest = readJson(file);
  if (manifest.format !== CAPTURE_FORMAT) throw new Error(`${file} is not a ${CAPTURE_FORMAT} manifest`);
  const viewports = (manifest.viewports || []).map((vp) => ({
    ...vp,
    outlineData: vp.outline && existsSync(path.join(abs, vp.outline)) ? readJson(path.join(abs, vp.outline)) : null,
  }));
  return { dir: abs, manifest, viewports };
}

// ─── Layout checks ───────────────────────────────────────────────────

const bodySections = (o) => (o?.sections || []).filter((s) => s.kind !== 'footer');
const band = (s) => (s.mediaBackdrop || s.bgImage === 'image' ? 'photo' : s.dark ? 'dark' : 'light');
const buttonShape = (b) => (!b ? null : b.radius >= 999 ? 'pill' : b.radius <= 2 ? 'square' : 'rounded');
const cardStyle = (c) => (!c ? null : c.shadow ? 'shadow' : c.border ? 'border' : c.filled ? 'filled' : 'plain');
const maxColumns = (o) => {
  const list = bodySections(o).map((s) => s.columns || 1);
  return list.length ? Math.max(...list) : null;
};

const relWithin = (t) => (a, b) => Math.abs(a - b) <= Math.max(Math.abs(a) * t, 0.5);
const absWithin = (t) => (a, b) => Math.abs(a - b) <= t;
const same = (a, b) => a === b;

// Each check: [metric, unit, pick(outline), test(ref, rep) | null for
// information only]. Colors are never checked: the replica wears the
// customer's palette, not the reference's.
const CHECKS = [
  ['Page length (screens)', '', (o) => o.page?.screens, relWithin(0.3)],
  ['Sections (without footer)', '', (o) => bodySections(o).length, absWithin(1)],
  ['Band rhythm (dark / light / photo)', '', (o) => bodySections(o).map(band).join(' '), null],
  ['Nav height', 'px', (o) => o.nav?.h, relWithin(0.25)],
  ['Nav position', '', (o) => o.nav?.position, same],
  ['Nav over the hero', '', (o) => o.nav?.overlaysHero, same],
  ['Nav links', '', (o) => o.nav?.links, absWithin(2)],
  ['Nav button', '', (o) => (o.nav?.found ? !!(o.nav.cta || o.nav.phone) : undefined), same],
  ['Logo placement', '', (o) => o.nav?.logo?.place, same],
  ['Hero height (screens)', '', (o) => bodySections(o)[0]?.screens, absWithin(0.2)],
  ['Hero text alignment', '', (o) => bodySections(o)[0]?.align, same],
  ['Hero photo backdrop', '', (o) => { const h = bodySections(o)[0]; return h ? !!(h.mediaBackdrop || h.bgImage === 'image') : undefined; }, same],
  ['H1 size', 'px', (o) => o.type?.h1?.size, relWithin(0.2)],
  ['H1 weight', '', (o) => o.type?.h1?.weight, absWithin(100)],
  ['H1 case', '', (o) => o.type?.h1?.transform, same],
  ['H2 size', 'px', (o) => o.type?.h2?.size, relWithin(0.2)],
  ['Body size', 'px', (o) => o.type?.body?.size, relWithin(0.12)],
  ['Heading font kind', '', (o) => o.fonts?.headingGeneric, same],
  ['Body font kind', '', (o) => o.fonts?.bodyGeneric, same],
  ['Eyebrow labels', '', (o) => (o.type ? !!o.type.eyebrow : undefined), same],
  ['Button shape', '', (o) => buttonShape(o.buttons?.[0]), same],
  ['Button corner radius', 'px', (o) => { const b = o.buttons?.[0]; return b && b.radius < 999 ? b.radius : undefined; }, absWithin(4)],
  ['Button height', 'px', (o) => o.buttons?.[0]?.h, relWithin(0.2)],
  ['Button fill', '', (o) => { const b = o.buttons?.[0]; return b ? (b.filled ? 'filled' : 'outline') : undefined; }, same],
  ['Button case', '', (o) => o.buttons?.[0]?.transform, same],
  ['Card style', '', (o) => cardStyle(o.cards), same],
  ['Card corner radius', 'px', (o) => o.cards?.radius, absWithin(4)],
  ['Cards per row', '', (o) => o.cards?.perRow, same],
  ['Section padding (median)', 'px', (o) => o.spacing?.sectionPadMedian, relWithin(0.25)],
  ['Content width (most common)', 'px', (o) => o.spacing?.contentWidths?.[0]?.value, relWithin(0.1)],
  ['Most columns in a section', '', maxColumns, absWithin(1)],
  ['Footer columns', '', (o) => o.footer?.columns, absWithin(1)],
];

// Rows { metric, unit, reference, replica, ok } where ok is true / false, or
// null when either side has no value or the row is information only.
export function outlineDiff(ref, rep) {
  return CHECKS.map(([metric, unit, pick, test]) => {
    const a = ref ? pick(ref) : undefined;
    const b = rep ? pick(rep) : undefined;
    const known = a !== undefined && a !== null && b !== undefined && b !== null;
    return { metric, unit, reference: a ?? null, replica: b ?? null, ok: known && test ? !!test(a, b) : null };
  });
}

export function scoreOf(rows) {
  const judged = rows.filter((r) => r.ok !== null);
  const ok = judged.filter((r) => r.ok).length;
  const ratio = judged.length ? ok / judged.length : null;
  const verdict = ratio === null ? 'no layout data' : ratio >= 0.8 ? 'close' : ratio >= 0.6 ? 'getting there' : 'far';
  return { ok, total: judged.length, ratio: ratio === null ? null : Math.round(ratio * 100) / 100, verdict };
}

// Index-aligned section list (the section map decides the real pairing).
export function sectionPairs(ref, rep) {
  const a = ref?.sections || [];
  const b = rep?.sections || [];
  const brief = (s) => (s ? { kind: s.kind, idHint: s.idHint ?? null, screens: s.screens, columns: s.columns, band: band(s) } : null);
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({ i, reference: brief(a[i]), replica: brief(b[i]) }));
}

// ─── Review page ─────────────────────────────────────────────────────

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shown = (v, unit) => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return unit ? `${v} ${unit}` : String(v);
};
const briefText = (s) => (s ? `${s.kind}${s.idHint ? ` (${s.idHint})` : ''}, ${s.screens} screens, ${s.columns} col, ${s.band}` : '-');

const fileHref = (fromDir, file) => path.relative(fromDir, file).split(path.sep).map(encodeURIComponent).join('/');

// One column: the capture's tiles at their scroll offsets (a stitched page),
// or the supplied screenshots one under the other.
function columnHtml(label, cap, vp, colW, outDir) {
  const tiles = vp.tiles || [];
  const stitched = vp.pageHeight && vp.width && tiles.every((t) => Number.isFinite(t.y));
  let frame;
  if (stitched) {
    const s = colW / vp.width;
    const imgs = tiles.map((t) => `<img src="${esc(fileHref(outDir, path.join(cap.dir, t.file)))}" alt="" style="top:${Math.round(t.y * s)}px;width:${colW}px">`).join('');
    frame = `<div class="frame" style="width:${colW}px;height:${Math.round(vp.pageHeight * s)}px">${imgs}</div>`;
  } else {
    const imgs = tiles.map((t) => `<img src="${esc(fileHref(outDir, path.join(cap.dir, t.file)))}" alt="">`).join('');
    frame = `<div class="frame flow" style="width:${colW}px">${imgs}</div>`;
  }
  return `<div class="col"><h2>${esc(label)}</h2>${frame}</div>`;
}

export function buildCompareHtml({ title, viewport, ref, rep, refVp, repVp, outDir, rows, pairs, score }) {
  const width = refVp.width || repVp.width || VIEWPORTS.desktop.width;
  const colW = Math.round(Math.min(width, MAX_COLUMN));
  const pageWidth = colW * 2 + GUTTER * 3;
  const table = rows && rows.length ? `<table><thead><tr><th>Check</th><th>Reference</th><th>Replica</th><th></th></tr></thead><tbody>${
    rows.map((r) => `<tr><td>${esc(r.metric)}</td><td>${esc(shown(r.reference, r.unit))}</td><td>${esc(shown(r.replica, r.unit))}</td><td class="${r.ok === null ? '' : r.ok ? 'ok' : 'off'}">${r.ok === null ? '' : r.ok ? 'close' : 'off'}</td></tr>`).join('')
  }</tbody></table>` : '<p class="muted">No layout outline on one side (a screenshot reference): compare by eye.</p>';
  const sections = pairs && pairs.length ? `<table><thead><tr><th>#</th><th>Reference section</th><th>Replica section</th></tr></thead><tbody>${
    pairs.map((p) => `<tr><td>${p.i + 1}</td><td>${esc(briefText(p.reference))}</td><td>${esc(briefText(p.replica))}</td></tr>`).join('')
  }</tbody></table>` : '';
  const scoreLine = score && score.total ? `${score.ok} of ${score.total} layout checks close (${Math.round(score.ratio * 100)}%): ${score.verdict}` : 'No layout checks';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${pageWidth}">
<title>${esc(`${title || 'Replica'}: ${viewport}`)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#ececef;color:#1d1d1f;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;width:${pageWidth}px}
.top{padding:${GUTTER}px ${GUTTER}px 4px}
h1{font-size:20px;margin:0 0 4px}
.rule{margin:4px 0;font-size:13px;color:#7a1f1f;font-weight:600}
.score{margin:6px 0 0;font-weight:600}
.muted{color:#555;margin:8px ${GUTTER}px}
.tables{display:flex;gap:${GUTTER}px;align-items:flex-start;padding:8px ${GUTTER}px ${GUTTER}px;flex-wrap:wrap}
table{border-collapse:collapse;background:#fff;font-size:12px}
th,td{border:1px solid #d9d9de;padding:3px 8px;text-align:left;vertical-align:top}
th{background:#f6f6f8}
.ok{color:#176b2c;font-weight:600}.off{color:#a3171d;font-weight:600}
.cols{display:flex;gap:${GUTTER}px;padding:0 ${GUTTER}px ${GUTTER}px;align-items:flex-start}
.col h2{font-size:14px;margin:0 0 8px}
.frame{position:relative;overflow:hidden;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18)}
.frame img{position:absolute;left:0;display:block}
.frame.flow img{position:static;width:100%}
</style></head><body>
<div class="top"><h1>${esc(title || 'Replica')} (${esc(viewport)}, ${esc(width)} px)</h1>
<p class="rule">${esc(REVIEW_NOTE)}</p>
<p class="score">${esc(scoreLine)}</p></div>
<div class="tables">${table}${sections}</div>
<div class="cols">${columnHtml('Reference (layout only)', ref, refVp, colW, outDir)}${columnHtml('Replica (customer content)', rep, repVp, colW, outDir)}</div>
</body></html>
`;
  return { html, pageWidth };
}

// Runs in the review page: scales the columns down when the page would pass
// the screenshot height cap, and returns the final height.
function fitPage(arg) {
  const doc = document.documentElement;
  const cols = document.querySelector('.cols');
  let h = doc.scrollHeight;
  if (cols && h > arg.maxHeight) {
    const top = cols.getBoundingClientRect().top + window.scrollY;
    const f = Math.max(0.1, (arg.maxHeight - top - 24) / cols.offsetHeight);
    cols.style.zoom = String(f);
    h = doc.scrollHeight;
  }
  return Math.min(Math.ceil(h), arg.maxHeight);
}

// Screenshots the review page into `pngFile` (or numbered 2000 px slices if a
// single tall shot fails, as full-page shots did on some machines).
async function shootPage(browser, htmlFile, pngFile, { width, maxHeight }) {
  const tab = await openTab(browser.cdp);
  try {
    await tab.send('Page.enable');
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const loaded = tab.waitFor('Page.loadEventFired', 30000);
    loaded.catch(() => {});
    await tab.send('Page.navigate', { url: pathToFileURL(htmlFile).href }, 30000);
    await loaded.catch(() => tab.send('Page.stopLoading').catch(() => {}));
    const height = await evaluate(tab, fitPage, { maxHeight });
    try {
      await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await new Promise((r) => setTimeout(r, 150));
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' }, 60000);
      writeFileSync(pngFile, Buffer.from(data, 'base64'));
      return { files: [pngFile], width, height };
    } catch {
      const slice = 2000;
      await tab.send('Emulation.setDeviceMetricsOverride', { width, height: slice, deviceScaleFactor: 1, mobile: false });
      const files = [];
      for (let y = 0, i = 1; y < height; y += slice, i += 1) {
        await evaluate(tab, (a) => { window.scrollTo({ top: a.y, left: 0, behavior: 'instant' }); return window.scrollY; }, { y });
        const { data } = await tab.send('Page.captureScreenshot', { format: 'png' }, 60000);
        const file = pngFile.replace(/\.png$/, `-${i}.png`);
        writeFileSync(file, Buffer.from(data, 'base64'));
        files.push(file);
      }
      return { files, width, height };
    }
  } finally {
    await tab.close();
  }
}

function reportMarkdown(report) {
  const lines = [
    `# Replica comparison: ${report.title}`,
    '',
    `> ${REVIEW_NOTE}`,
    '',
    `- Reference: ${report.reference.url || report.reference.file || (report.reference.files || []).join(', ')} (captured ${report.reference.capturedAt})`,
    `- Replica: ${report.replica.url || report.replica.file || '-'} (captured ${report.replica.capturedAt})`,
    '',
  ];
  for (const v of report.viewports) {
    lines.push(`## ${v.name} (${v.width} px): ${v.score.total ? `${v.score.ok} of ${v.score.total} checks close, ${v.score.verdict}` : 'compare by eye'}`, '');
    for (const f of v.images) lines.push(`![${v.name}](${f})`);
    lines.push('');
    if (v.rows.length) {
      lines.push('| Check | Reference | Replica | |', '|---|---|---|---|');
      for (const r of v.rows) lines.push(`| ${r.metric} | ${shown(r.reference, r.unit)} | ${shown(r.replica, r.unit)} | ${r.ok === null ? '' : r.ok ? 'close' : 'off'} |`);
      lines.push('');
    }
    if (v.sections.length) {
      lines.push('| # | Reference section | Replica section |', '|---|---|---|');
      for (const p of v.sections) lines.push(`| ${p.i + 1} | ${briefText(p.reference)} | ${briefText(p.replica)} |`);
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

const sourceOf = (cap) => ({ ...cap.manifest.source, capturedAt: cap.manifest.capturedAt });

// Compares two captures (or a capture and a replica .html, captured first at
// the reference's viewports). Returns the report (also written to --out).
export async function compare({
  reference, replica, out, title = 'Replica', offline = false, maxHeight = 12000, chromePath, log = () => {},
}) {
  if (!reference || !replica || !out) throw new Error('--reference, --replica and --out are required');
  const outDir = assertOutsideRepo(out);
  mkdirSync(outDir, { recursive: true });
  const ref = loadCapture(reference);

  let rep;
  if (existsSync(path.join(path.resolve(replica), 'manifest.json'))) {
    rep = loadCapture(replica);
  } else {
    // Our own page: capture it at the reference's viewports.
    const viewports = ref.viewports.map((vp) => {
      const known = VIEWPORTS[vp.name];
      const width = vp.width || known?.width || VIEWPORTS.desktop.width;
      const height = vp.height || known?.height || VIEWPORTS.desktop.height;
      return { name: vp.name, width, height, mobile: width < 600 };
    });
    const dir = path.join(outDir, 'replica-capture');
    log(`Capturing the replica into ${dir}`);
    await capture(replica, { out: dir, viewports, offline, chromePath, log });
    rep = loadCapture(dir);
  }

  const pairsByName = ref.viewports
    .map((refVp) => ({ refVp, repVp: rep.viewports.find((v) => v.name === refVp.name) }))
    .filter((p) => p.repVp);
  if (!pairsByName.length) throw new Error('The two captures share no viewport (desktop / phone)');

  const browser = await launchChrome({ chromePath });
  const report = {
    format: REPORT_FORMAT,
    note: REVIEW_NOTE,
    title,
    createdAt: new Date().toISOString(),
    reference: sourceOf(ref),
    replica: sourceOf(rep),
    viewports: [],
  };
  try {
    for (const { refVp, repVp } of pairsByName) {
      const rows = refVp.outlineData && repVp.outlineData ? outlineDiff(refVp.outlineData, repVp.outlineData) : [];
      const pairs = refVp.outlineData && repVp.outlineData ? sectionPairs(refVp.outlineData, repVp.outlineData) : [];
      const score = scoreOf(rows);
      const { html, pageWidth } = buildCompareHtml({
        title, viewport: refVp.name, ref, rep, refVp, repVp, outDir, rows, pairs, score,
      });
      const htmlFile = path.join(outDir, `compare-${refVp.name}.html`);
      writeFileSync(htmlFile, html);
      const shot = await shootPage(browser, htmlFile, path.join(outDir, `compare-${refVp.name}.png`), { width: pageWidth, maxHeight });
      const images = shot.files.map((f) => path.basename(f));
      log(`  ${refVp.name}: ${images.join(', ')} (${shot.width}x${shot.height})${score.total ? `, ${score.ok}/${score.total} checks close` : ''}`);
      report.viewports.push({
        name: refVp.name, width: refVp.width || repVp.width, images, html: path.basename(htmlFile), score, rows, sections: pairs,
      });
    }
  } finally {
    await browser.close();
  }
  writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(outDir, 'report.md'), reportMarkdown(report));
  return report;
}

// ─── Leak check ──────────────────────────────────────────────────────
//
// The hard rule, checked mechanically before a commit: none of the
// reference's own words (headings, button labels, page title, so its name),
// its domain or its brand colors may appear in the files we changed. It
// reads the capture's outline text samples, so capture without --no-text
// for this to see words. Generic labels ("Book now", "Our services") are
// not anyone's words and are ignored.

const GENERIC_TEXT = new Set([
  'book now', 'book online', 'call now', 'call us', 'call us today', 'learn more', 'read more', 'see more', 'view all',
  'view more', 'contact', 'contact us', 'get a quote', 'get a free quote', 'get started', 'schedule now', 'request a quote',
  'our services', 'services', 'about', 'about us', 'gallery', 'our work', 'reviews', 'testimonials', 'faq', 'home',
  'what our customers say', 'frequently asked questions', 'send', 'submit', 'menu',
]);
const norm = (s) => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9$%]+/g, ' ').trim();
// Identifiers read as words too: ShinyRidesHero and shiny_rides_hero both
// become "shiny rides hero", so a name can't hide in a component, file or
// CSS class name.
const words = (s) => norm(String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
// First `max` characters of a normalized string, cut at a word boundary
// (outline samples are clipped mid-word).
const head = (n, max = 40) => (n.length <= max ? n : n.slice(0, max).replace(/\s+\S*$/, ''));
const saturated = (hex) => {
  if (!HEX_RE.test(String(hex))) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  return max > 0 && (max - Math.min(r, g, b)) / max >= 0.25;
};

// Words that name a trade or a page, not a business. A page-title part made
// only of these ("Mobile Detailing", "Home", "Car Wash Near Me") names no
// one, and as a "name" it would hit our own business types
// (businessType: 'mobile_detailing') in every registry entry, so the check
// would always fail and people would learn to ignore it.
const GENERIC_TITLE_WORDS = new Set([
  'home', 'welcome', 'official', 'site', 'website', 'page', 'services', 'service', 'about', 'us', 'contact', 'gallery',
  'reviews', 'book', 'online', 'the', 'and', 'of', 'in', 'near', 'me', 'your', 'our', 'best', 'top', 'rated', 'professional',
  'premium', 'local', 'quality', 'mobile', 'auto', 'automotive', 'car', 'cars', 'vehicle', 'truck', 'boat', 'rv', 'detail',
  'details', 'detailing', 'detailer', 'wash', 'washing', 'hand', 'ceramic', 'coating', 'coatings', 'paint', 'correction',
  'protection', 'film', 'ppf', 'window', 'windows', 'tint', 'tinting', 'wheel', 'wheels', 'rim', 'rims', 'tire', 'tires',
  'repair', 'repairs', 'mechanic', 'mechanics', 'shop', 'garage', 'center', 'company', 'co', 'llc', 'inc', 'ltd', 'interior',
  'exterior',
]);
const genericTitle = (n) => n.split(' ').every((w) => GENERIC_TITLE_WORDS.has(w) || /^\d+$/.test(w));

// Site builders host a business under their own domain: the business is
// then the first label (acmedetail.wixsite.com), not the builder's name.
const HOSTED_SUFFIXES = [
  'wixsite.com', 'square.site', 'godaddysites.com', 'business.site', 'weebly.com', 'squarespace.com', 'webflow.io',
  'carrd.co', 'netlify.app', 'vercel.app', 'wordpress.com', 'blogspot.com', 'myshopify.com', 'github.io',
  'autocaregeniushub.com',
];
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);

// The label of a host that names the business: acmedetail.com,
// www.acmedetail.co.uk and acmedetail.wixsite.com all give "acmedetail".
export function domainName(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  const labels = h.split('.').filter(Boolean);
  if (labels.length < 2) return '';
  if (labels.length > 2 && HOSTED_SUFFIXES.some((s) => h.endsWith(`.${s}`))) return labels[0];
  let i = labels.length - 2;
  if (i > 0 && SECOND_LEVEL.has(labels[i]) && labels[labels.length - 1].length === 2) i -= 1;
  return labels[i];
}

// What must not show up: [{ kind: 'domain' | 'name' | 'text' | 'color', value, key, why, loose, compact }].
// `key` must appear as whole words; a `loose` key anywhere (names and the
// domain also inside longer words); `compact` is a name with its spaces
// taken out, as it would be in an identifier (shinyrides_hero).
export function leakNeedles(cap) {
  const out = [];
  const seen = new Set();
  const add = (kind, value, why) => {
    const key = kind === 'color' ? String(value).toLowerCase() : head(norm(value));
    if (!key || seen.has(`${kind}:${key}`)) return;
    seen.add(`${kind}:${key}`);
    const compact = kind === 'name' && key.includes(' ') && key.replace(/ /g, '').length >= 8 ? key.replace(/ /g, '') : '';
    out.push({ kind, value: kind === 'color' ? key : String(value), key, why, loose: kind === 'name' || kind === 'domain', compact });
  };
  const wordy = (s) => { const n = norm(s); return n.length >= 12 && n.split(' ').length >= 3 && !GENERIC_TEXT.has(n); };
  const src = cap.manifest?.source || {};
  if (src.url) {
    try {
      const host = new URL(src.url).hostname.replace(/^www\./, '');
      add('domain', host, 'reference domain');
      const label = domainName(host);
      if (label.length >= 5) add('name', label, 'domain name');
    } catch { /* not a URL */ }
  }
  for (const vp of cap.viewports || []) {
    const o = vp.outlineData;
    if (!o) continue;
    for (const part of String(o.page?.title || '').split(/\s+[|\-–—:·]+\s+/)) {
      const n = norm(part);
      if (n.length < 6 || GENERIC_TEXT.has(n) || genericTitle(n)) continue;
      add('name', part, 'page title');
      // "Shiny Rides Detail" also as "Shiny Rides": a shortened name in an
      // id or label is still their name.
      const lead = n.split(' ').slice(0, 2);
      if (n.split(' ').length >= 3 && lead.join('').length >= 8 && !genericTitle(lead.join(' '))) add('name', lead.join(' '), 'page title (first words)');
    }
    for (const s of o.sections || []) for (const h of s.headings || []) if (wordy(h.sample)) add('text', h.sample, `${s.kind} heading`);
    for (const k of ['h1', 'h2', 'h3', 'eyebrow']) if (wordy(o.type?.[k]?.sample)) add('text', o.type[k].sample, k);
    for (const b of o.buttons || []) if (wordy(b.sample)) add('text', b.sample, 'button');
    const colors = [o.colorRoles?.buttonFill, o.nav?.bg, ...(o.sections || []).map((s) => s.bg), ...(o.buttons || []).map((b) => b.fill)];
    for (const c of colors) if (saturated(c)) add('color', c, 'reference color');
  }
  return out;
}

// '#cc0000' also as '#c00' (not followed by more hex digits).
function colorHit(scope, hex) {
  if (scope.includes(hex)) return true;
  const short = /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/.exec(hex);
  return !!short && new RegExp(`#${short[1]}${short[2]}${short[3]}(?![0-9a-f])`).test(scope);
}

// One template's own entry in a file keyed by template ids: the block
// `<id>: {` ... `},` at the same indent (the TEMPLATES shape), else the
// look objects `{` / `templateId: '<id>', ...` / `},` (src/data/designLooks.js,
// one per look), else the line(s) starting with `<id>:` (one-line mirrors
// such as TEMPLATE_LOOKS in netlify/functions/_lib/kit/inputs.js). '' when
// the file has none. Line endings don't matter: the repo's own files are CRLF.
export function registryEntry(source, templateId) {
  const id = String(templateId || '');
  if (!TEMPLATE_ID_RE.test(id)) return '';
  const src = `\n${String(source).replace(/\r\n?/g, '\n')}\n`;
  const block = new RegExp(`\\n([ \\t]*)${id}:[ \\t]*\\{[ \\t]*\\n[\\s\\S]*?\\n\\1\\},?[ \\t]*(?=\\n)`).exec(src);
  if (block) return block[0];
  const looks = [...src.matchAll(new RegExp(`\\n([ \\t]*)\\{[ \\t]*\\n[ \\t]*templateId:[ \\t]*['"]${id}['"][\\s\\S]*?\\n\\1\\},?[ \\t]*(?=\\n)`, 'g'))];
  if (looks.length) return looks.map((m) => m[0]).join('');
  return src.split('\n').filter((l) => new RegExp(`^[ \\t]*['"]?${id}['"]?[ \\t]*:`).test(l)).join('\n');
}

// Lists that hold every template's colors (the registry, the Launch Kit's
// mirror of it and the Studio's looks): only the replica's own entry there
// is ours to check.
const COLOR_LISTS = [
  /(^|[\\/])src[\\/]data[\\/]templates\.js$/,
  /(^|[\\/])netlify[\\/]functions[\\/]_lib[\\/]kit[\\/]inputs\.js$/,
  /(^|[\\/])src[\\/]data[\\/]designLooks\.js$/,
];

// { needles, hits: [{ file, kind, value, why }], unchecked: [{ file, why }] }.
// Words, names and the domain are looked for in the whole file and its
// name. Colors: in a file that has an entry for `templateId` (the registry,
// the per-template lists) only inside that entry, since the other entries
// are other templates' palettes; in any other file (the template module)
// everywhere. A color list without the replica's entry can't be checked,
// and says so.
export function leakCheck({ capture: cap, files, templateId = null, read = (f) => readFileSync(f, 'utf8') }) {
  const needles = leakNeedles(cap);
  const hits = [];
  const unchecked = [];
  for (const file of files) {
    const raw = read(file);
    const text = ` ${norm(raw)} ${words(raw)} ${words(path.basename(String(file)))} `;
    const entry = templateId ? registryEntry(raw, templateId) : '';
    const colorList = COLOR_LISTS.some((re) => re.test(file));
    let colorScope = (entry || raw).toLowerCase();
    if (colorList && !entry) {
      colorScope = '';
      if (needles.some((n) => n.kind === 'color')) {
        unchecked.push({ file, why: templateId ? `no "${templateId}" entry in it: register the replica first, or check the id` : 'colors here are only checked with --template <replica id>' });
      }
    }
    for (const n of needles) {
      const hit = n.kind === 'color'
        ? colorHit(colorScope, n.key)
        : text.includes(` ${n.key} `) || (n.loose && text.includes(n.key)) || (!!n.compact && text.includes(n.compact));
      if (hit) hits.push({ file, kind: n.kind, value: n.value, why: n.why });
    }
  }
  return { needles: needles.length, hits, unchecked };
}

// ─── Render ──────────────────────────────────────────────────────────

// One query row from a file: plain JSON (object or one-row array) or the
// Supabase MCP's saved result ({ result: "...<untrusted-data-…>[…]</untrusted-data-…>" }).
// The content is data: parsed as JSON, never run.
function oneRow(text, what) {
  let v = JSON.parse(text);
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.result === 'string') {
    const m = /<untrusted-data-([0-9a-f-]+)>\s*([\s\S]*?)\s*<\/untrusted-data-\1>/.exec(v.result);
    if (!m) throw new Error('The file looks like an MCP result but holds no query rows');
    v = JSON.parse(m[2]);
  }
  if (Array.isArray(v)) {
    if (v.length !== 1) throw new Error(`Expected exactly one ${what}, got ${v.length}`);
    [v] = v;
  }
  if (!v || typeof v !== 'object') throw new Error(`Expected a ${what}`);
  return v;
}

const jsonObject = (x, name) => {
  const parsed = typeof x === 'string' ? JSON.parse(x) : x;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`The row has no ${name} object`);
  return parsed;
};

// A sites row (the customer's draft site).
export function parseRowFile(text) {
  const v = oneRow(text, 'sites row (business_info, generated_content)');
  return {
    template_id: typeof v.template_id === 'string' ? v.template_id : null,
    business_info: jsonObject(v.business_info, 'business_info'),
    generated_content: jsonObject(v.generated_content, 'generated_content'),
  };
}

// A custom_site_projects row as SKILL.md's read-only query returns it:
// { id, form, design } (only the keys the palette needs).
export function parseProjectFile(text) {
  const v = oneRow(text, 'custom_site_projects row (id, form, design)');
  return {
    id: typeof v.id === 'string' ? v.id : '',
    form: v.form == null ? {} : jsonObject(v.form, 'form'),
    design: v.design == null ? {} : jsonObject(v.design, 'design'),
  };
}

// ─── Palette ─────────────────────────────────────────────────────────
//
// The replica's colors come from OUR side, never from the reference, in the
// order "Match its layout" uses (matchPalettePlan / matchPaletteFor in
// src/lib/designSuggest.js, so both paths give a customer the same colors):
//   studio       all five roles set in the Studio (design.levers.palette)
//   brand        the ready brand system's palette, Studio roles on top
//   brandColors  their brand color as the accent (brandAccent) on the colors
//                of the template the Design step uses (design.templateId)
//   template     that template's own colors (no brand colors given)
// The picked palette is then made registry-safe (registrySafePalette
// below), because it becomes the replica's registry entry.
// Returns { ok, from, templateId, palette, repairs, notes, reason }, plus
// `picked` (the colors before the repair) when anything was repaired; ok
// false with `missing` when our side holds no full palette yet.
export async function replicaPalette(project) {
  // Loaded here so leak-check and compare never need src/ to load.
  const m = await import('../../src/lib/designSuggest.js');
  const kit = await import('../../src/components/preview/templates/kit/theme.js');
  const design = project?.design && typeof project.design === 'object' ? project.design : {};
  const studio = design.levers?.palette && typeof design.levers.palette === 'object' ? design.levers.palette : {};
  const plan = m.matchPalettePlan(project, studio);
  const templateId = TEMPLATE_ID_RE.test(String(design.templateId || '')) ? design.templateId : '';
  const palette = m.matchPaletteFor(plan, templateId);
  const missing = COLOR_ROLES.filter((role) => !HEX_RE.test(String(palette?.[role] || '')));
  if (missing.length) {
    return {
      ok: false,
      from: plan.from,
      templateId,
      palette,
      missing,
      reason: 'No full palette on our side yet: ask the admin to set the Studio colors (or pick a template) in the '
        + 'Design step and save. Never take the colors from the reference.',
    };
  }
  const safe = registrySafePalette(palette, kit);
  let reason = m.matchPaletteReason(plan, templateId);
  if (safe.repairs.length) {
    // matchPaletteReason says "Kept your Studio palette", which a repair
    // makes untrue: say what was kept and what changed.
    reason = `${reason.replace(/^Kept your Studio palette\./, 'Your Studio palette.')} Repaired for the registry `
      + `(kit/theme.test.js): ${safe.repairs.map((r) => r.role).join(', ')}.`;
  }
  const out = {
    ok: safe.failures.length === 0,
    from: plan.from,
    templateId,
    palette: safe.palette,
    ...(safe.repairs.length ? { picked: palette } : {}),
    repairs: safe.repairs,
    notes: safe.notes,
    reason,
  };
  if (safe.failures.length) {
    // Can't happen with deriveTheme as it is (secondary = bg always reads),
    // but a palette that would fail the registry test must never print as ok.
    out.failures = safe.failures;
    out.reason = `These colors can't be made readable for the registry (${safe.failures.map((f) => f.pair).join(', ')}): `
      + 'ask the admin to pick other Studio colors in the Design step and save.';
  }
  return out;
}

// `palette --colors`: a palette chosen by hand (a Studio look for the
// replica, or the registry entry after an edit), checked and repaired like
// the picked one. Same shape as replicaPalette, with from: 'given'.
export async function givenPalette(colors) {
  const kit = await import('../../src/components/preview/templates/kit/theme.js');
  const safe = registrySafePalette(colors, kit);
  return {
    ok: safe.failures.length === 0,
    from: 'given',
    palette: safe.palette,
    ...(safe.repairs.length ? { picked: colors } : {}),
    repairs: safe.repairs,
    notes: safe.notes,
    ...(safe.failures.length ? { failures: safe.failures, reason: 'These colors can\'t be made readable for the registry.' } : {}),
  };
}

// ─── Registry-safe colors ────────────────────────────────────────────
//
// The palette becomes the replica's registry entry (TEMPLATES[id].colors,
// mirrored in the Launch Kit's TEMPLATE_LOOKS), and
// src/components/preview/templates/kit/theme.test.js ("keeps every text
// pair readable") checks every entry: deriveTheme must keep bg, accent and
// secondary exactly as given, and the text, muted and accent-colored text it
// paints must read at 4.5:1 on bg AND on secondary. matchPaletteFor hands a
// full Studio palette over exactly as the admin set it, so a low-contrast
// one would fail that test, and the swatches would show colors the site
// never paints. So the palette is repaired here the way the page repairs it:
//   secondary    only when no text color can read on both the page and the
//                cards (deriveTheme never trades bg contrast for surface
//                contrast): moved toward bg in 1/50 steps (as brandSpec.js
//                repairPalette does) until the text and muted colors the
//                page paints on bg read on it too (accent text adapts by
//                itself). The smallest move that merely passes would leave
//                a mid-gray card and push muted to the text color; this
//                keeps the customer's text colors and darkens (or lightens)
//                the card instead;
//   text, muted  set to what deriveTheme paints on that page (the smallest
//                blend toward white or black that reads), so the registry,
//                TEMPLATE_LOOKS and the Studio show what the site shows.
// bg and accent never change: they are the customer's picks, and the test
// requires them as given. What isn't repaired (accent-colored text painted
// lighter or darker, an accent that barely stands off the page) is listed
// in `notes` for the section map.
const TEXT_MIN = 4.5;
// WCAG's 3:1 for interface parts (buttons, highlights): designLooks.test.js
// holds every look to it. Advice here, not a registry rule.
const UI_MIN = 3;
const REGISTRY_PAIRS = [
  ['text', 'bg', 'text on bg'],
  ['textMuted', 'bg', 'muted on bg'],
  ['accentText', 'bg', 'accent text on bg'],
  ['text', 'surface', 'text on secondary'],
  ['textMuted', 'surface', 'muted on secondary'],
  ['accentText', 'surface', 'accent text on secondary'],
];
const ratioOf = (kit, a, b) => Math.round(kit.contrastRatio(a, b) * 100) / 100;

// The pairs of `palette` (5 roles) that kit/theme.test.js would reject,
// measured on what deriveTheme paints: [{ pair, fg, bg, ratio }]. `kit` is
// src/components/preview/templates/kit/theme.js.
export function registryFailures(palette, kit) {
  const t = kit.deriveTheme(palette);
  const out = [];
  for (const [fg, bg, pair] of REGISTRY_PAIRS) {
    // Compared unrounded: 4.497 must fail like the test fails it.
    if (kit.contrastRatio(t[fg], t[bg]) < TEXT_MIN) out.push({ pair, fg: t[fg], bg: t[bg], ratio: ratioOf(kit, t[fg], t[bg]) });
  }
  return out;
}

// `palette` (5 valid roles) as colors the registry test accepts, with the
// smallest changes. Returns { palette, repairs: [{ role, from, to, why }],
// notes: ['...'], failures } (failures: what still fails, normally []).
export function registrySafePalette(palette, kit) {
  const picked = Object.fromEntries(COLOR_ROLES.map((role) => [role, String(palette[role]).toLowerCase()]));
  const out = { ...picked };
  const repairs = [];

  const before = registryFailures(out, kit);
  if (before.length) {
    // Text and muted as deriveTheme paints them on bg alone (ensureContrast).
    // At i = 50 the card is bg, where these read by construction, so the
    // loop always ends with a card color.
    const inks = [picked.text, picked.muted].map((c) => kit.ensureContrast(c, picked.bg, TEXT_MIN));
    for (let i = 1; i <= 50; i += 1) {
      const secondary = kit.mix(picked.secondary, picked.bg, i / 50);
      const inksRead = inks.every((c) => kit.contrastRatio(c, secondary) >= TEXT_MIN);
      if (inksRead && !registryFailures({ ...out, secondary }, kit).length) {
        const worst = before.reduce((a, b) => (b.ratio < a.ratio ? b : a));
        repairs.push({
          role: 'secondary',
          from: picked.secondary,
          to: secondary,
          why: `${worst.pair} was ${worst.ratio}:1 (needs ${TEXT_MIN}:1): no text color reads on both the page and `
            + 'the cards, so the card color moved toward the page color until the page\'s text colors read on it',
        });
        out.secondary = secondary;
        break;
      }
    }
  }

  const t = kit.deriveTheme(out);
  for (const [role, token] of [['text', 'text'], ['muted', 'textMuted']]) {
    if (t[token] === out[role]) continue;
    repairs.push({
      role,
      from: out[role],
      to: t[token],
      why: `${role} read ${ratioOf(kit, out[role], out.bg)}:1 on bg and ${ratioOf(kit, out[role], out.secondary)}:1 on `
        + `secondary (needs ${TEXT_MIN}:1 on both): the page paints it as ${t[token]}`,
    });
    out[role] = t[token];
  }

  const notes = [];
  if (t.accentText !== out.accent) {
    notes.push(`The accent ${out.accent} reads ${ratioOf(kit, out.accent, out.bg)}:1 on bg and `
      + `${ratioOf(kit, out.accent, out.secondary)}:1 on secondary, so accent-colored text (links, eyebrows) is `
      + `painted ${t.accentText}. Buttons keep ${out.accent}.`);
  }
  // deriveTheme picks white or near-black for button text, whichever reads
  // better; a mid-tone accent can leave both under 4.5:1.
  if (kit.contrastRatio(t.onAccent, out.accent) < TEXT_MIN) {
    notes.push(`Button text (${t.onAccent}) reads only ${ratioOf(kit, t.onAccent, out.accent)}:1 on the accent `
      + `${out.accent} (${TEXT_MIN}:1 for text): fine for the registry, not for a Studio look.`);
  }
  for (const [where, bg] of [['bg', out.bg], ['secondary', out.secondary]]) {
    const r = ratioOf(kit, out.accent, bg);
    if (r < UI_MIN) {
      notes.push(`The accent stands only ${r}:1 off ${where} (${UI_MIN}:1 for buttons): give accent buttons a border `
        + 'or put them on a band where they stand out.');
    }
  }
  return { palette: out, repairs, notes, failures: registryFailures(out, kit) };
}

// A theme:check fixture (src/components/preview/templates/__fixtures__/businesses.js)
// in the shape of a sites row.
export function fixtureRow(fx) {
  return {
    template_id: null,
    business_info: fx.businessInfo,
    generated_content: {
      ...fx.generatedCopy,
      _images: fx.images || {},
      _customColors: fx.customColors || {},
      _customFonts: fx.customFonts || {},
    },
  };
}

export function parseColors(json) {
  if (!json) return null;
  const v = JSON.parse(json);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('--colors must be a JSON object of roles');
  const out = {};
  for (const [role, hex] of Object.entries(v)) {
    if (!COLOR_ROLES.includes(role)) throw new Error(`Unknown color role "${role}" (use ${COLOR_ROLES.join(', ')})`);
    if (!HEX_RE.test(String(hex))) throw new Error(`--colors ${role} must be #rrggbb`);
    out[role] = String(hex).toLowerCase();
  }
  return out;
}

// The published page for `row` on `templateId`, as exportHtml builds it.
export async function renderReplica({ row, templateId, colors = null, freeBar = false }) {
  const id = templateId || row.template_id;
  if (!TEMPLATE_ID_RE.test(String(id || ''))) throw new Error('--template <id> is required (a src/data/templates.js id)');
  const { startRenderer } = await import('../site-upgrade/load-render.js');
  const { mod, close } = await startRenderer();
  try {
    const generated = { ...row.generated_content };
    if (colors) generated._customColors = { ...(generated._customColors || {}), ...colors };
    // No site id: the page then loads no live booking or contact widget.
    const site = {
      id: null, template_id: id, business_info: row.business_info, generated_content: generated,
      scheduler_enabled: false, widget_config_ids: [],
    };
    const owner = freeBar ? null : { subscription_status: 'active' };
    const built = await mod.buildSitePage({ row: site, owner, widgets: [] });
    if (!built.newHtml) throw new Error(`Template "${id}" is not registered in src/data/templates.js`);
    return built.newHtml;
  } finally {
    await close();
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────

const USAGE = `Usage:
  node scripts/replica/compare.mjs render (--row <site-row.json> | --fixture full) --template <id> --out <page.html>
      [--colors '{"accent":"#rrggbb"}'] [--free-bar]
  node scripts/replica/compare.mjs --reference <capture dir> --replica <capture dir | page.html> --out <dir>
      [--title "Project"] [--offline] [--max-height 12000] [--chrome <path>]
  node scripts/replica/compare.mjs leak-check --reference <capture dir> --source <file> [--source <file> ...] [--template <id>]
      exit 1 when a file holds the reference's words, name, domain or brand colors
  node scripts/replica/compare.mjs palette --project <project-row.json>
      the replica's colors from our side (Studio, brand system, brand colors), never the reference's,
      repaired so the registry entry passes kit/theme.test.js
  node scripts/replica/compare.mjs palette --colors '{"bg":"#rrggbb","secondary":...,"text":...,"muted":...,"accent":...}'
      the same check and repair for a palette you chose (a look's, a hand-edited registry entry)
${REVIEW_NOTE}`;

export function parseCompareArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      reference: { type: 'string' },
      replica: { type: 'string' },
      out: { type: 'string' },
      title: { type: 'string' },
      offline: { type: 'boolean' },
      'max-height': { type: 'string' },
      chrome: { type: 'string' },
      row: { type: 'string' },
      fixture: { type: 'string' },
      template: { type: 'string' },
      colors: { type: 'string' },
      'free-bar': { type: 'boolean' },
      source: { type: 'string', multiple: true },
      project: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return { help: true };
  const command = positionals[0] || 'compare';
  if (command === 'render') {
    if (!!values.row === !!values.fixture) throw new Error('render needs exactly one of --row <file> or --fixture <name>');
    if (!values.out) throw new Error('render needs --out <page.html>');
    return {
      command,
      row: values.row,
      fixture: values.fixture,
      template: values.template,
      colors: parseColors(values.colors),
      freeBar: !!values['free-bar'],
      out: values.out,
    };
  }
  if (command === 'leak-check') {
    if (!values.reference) throw new Error('leak-check needs --reference <capture dir>');
    if (!values.source?.length) throw new Error('leak-check needs at least one --source <file>');
    if (values.template && !TEMPLATE_ID_RE.test(values.template)) throw new Error('--template must be a template id');
    return { command, reference: values.reference, sources: values.source, template: values.template || null };
  }
  if (command === 'palette') {
    if (!!values.project === !!values.colors) throw new Error('palette needs exactly one of --project <project-row.json> or --colors <json>');
    if (values.project) return { command, project: values.project };
    const colors = parseColors(values.colors);
    const missing = COLOR_ROLES.filter((role) => !colors[role]);
    if (missing.length) throw new Error(`palette --colors needs all five roles (missing ${missing.join(', ')})`);
    return { command, colors };
  }
  if (command !== 'compare') throw new Error(`Unknown command "${command}"`);
  const maxHeight = values['max-height'] ? Number(values['max-height']) : 12000;
  if (!Number.isInteger(maxHeight) || maxHeight < 1000 || maxHeight > 16000) throw new Error('--max-height must be 1000 to 16000');
  return {
    command,
    reference: values.reference,
    replica: values.replica,
    out: values.out,
    title: values.title || 'Replica',
    offline: !!values.offline,
    maxHeight,
    chromePath: values.chrome,
  };
}

async function main() {
  let args;
  try {
    args = parseCompareArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }
  try {
    if (args.command === 'leak-check') {
      const { needles, hits, unchecked } = leakCheck({ capture: loadCapture(args.reference), files: args.sources, templateId: args.template });
      if (!needles) console.log('No words, name, domain or colors to look for (screenshot capture or --no-text): check by eye.');
      for (const h of hits) console.log(`LEAK ${h.file}: ${h.kind} "${h.value}" (${h.why})`);
      for (const u of unchecked) console.log(`UNCHECKED ${u.file}: colors (${u.why})`);
      if (hits.length) console.log(`${hits.length} hit(s): rewrite them with the customer's own content and palette.`);
      else if (unchecked.length) console.log('Not clean until every file could be checked.');
      else console.log(`Clean: ${args.sources.length} file(s), ${needles} reference item(s) looked for.`);
      process.exit(hits.length || unchecked.length ? 1 : 0);
    }
    if (args.command === 'palette') {
      const result = args.colors
        ? await givenPalette(args.colors)
        : await replicaPalette(parseProjectFile(readFileSync(args.project, 'utf8')));
      console.log(JSON.stringify(result, null, 2));
      // On stderr, so the JSON on stdout stays parseable.
      if (result.repairs?.length) {
        console.error('Repaired so the registry entry passes kit/theme.test.js (use "palette", not "picked"):');
        for (const r of result.repairs) console.error(`  ${r.role} ${r.from} -> ${r.to}: ${r.why}`);
      }
      for (const n of result.notes || []) console.error(`Note: ${n}`);
      if (!result.ok) {
        console.error(result.reason);
        process.exit(1);
      }
      return;
    }
    if (args.command === 'render') {
      let row;
      if (args.row) {
        row = parseRowFile(readFileSync(args.row, 'utf8'));
      } else {
        const { FIXTURES } = await import('../../src/components/preview/templates/__fixtures__/businesses.js');
        if (!Object.prototype.hasOwnProperty.call(FIXTURES, args.fixture)) throw new Error(`No fixture "${args.fixture}" (${Object.keys(FIXTURES).join(', ')})`);
        row = fixtureRow(FIXTURES[args.fixture]);
      }
      const html = await renderReplica({ row, templateId: args.template, colors: args.colors, freeBar: args.freeBar });
      const file = path.resolve(args.out);
      assertOutsideRepo(path.dirname(file));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, html);
      console.log(`Wrote ${file} (${html.length} bytes)`);
      return;
    }
    const report = await compare({ ...args, log: (m) => console.log(m) });
    console.log(`Wrote ${path.join(path.resolve(args.out), 'report.md')}`);
    for (const v of report.viewports) console.log(`  ${v.name}: ${v.images.join(', ')}${v.score.total ? ` (${v.score.ok}/${v.score.total} close, ${v.score.verdict})` : ''}`);
    console.log(REVIEW_NOTE);
  } catch (e) {
    console.error(`compare failed: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
