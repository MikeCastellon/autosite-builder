// The production guard: publish refuses unless the production app already
// runs this checkout's code, so no page built with the new designs goes
// live before PR #10 is merged and deployed (its pages load scheduler.js /
// contact-form.js from the app and need their new versions), and a page
// the CLI builds is the page the owner's own Republish builds. Public GETs
// only:
//   1. /scheduler.js and /contact-form.js on the production app are
//      byte-identical to public/ here (line endings aside: the repo keeps
//      CRLF on disk, the deploy serves LF).
//   2. The app's JS bundle (index.html → its module scripts → every chunk
//      they import) holds the site runtime published pages carry
//      (SITE_RUNTIME_JS, SITE_BASE_CSS, SITE_CQ_FALLBACK_JS with its
//      CQ_REWRITE_FN, from src/lib/siteRuntime.js): every line of them that
//      a minifier cannot rewrite is found verbatim.
//   3. App code: this checkout is built here (vite build, in memory) and
//      every piece of src/ text that comes through the minifier verbatim
//      (template CSS lines, exportHtml's markup, copy strings, the manual
//      check list's reasons) must be in the deployed bundle too. A template
//      or kit edit that is not deployed fails this.
//   4. The deployed Site upgrades code has exactly this checkout's
//      UPGRADE_MANUAL_SKIP site ids (no more, no fewer).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PRODUCTION_APP_ORIGIN, UPGRADE_MANUAL_SKIP } from '../../src/lib/siteUpgrade.js';
import { CQ_REWRITE_FN, SITE_BASE_CSS, SITE_CQ_FALLBACK_JS, SITE_RUNTIME_JS } from '../../src/lib/siteRuntime.js';

const MAX_CHUNKS = 400;
const MAX_BUNDLE_BYTES = 40 * 1024 * 1024;

const lf = (s) => String(s).replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(lf(s), 'utf8').digest('hex');

// The runtime as the source spells it: SITE_CQ_FALLBACK_JS interpolates
// CQ_REWRITE_FN, so a bundle holds the two apart.
const RUNTIME_SOURCES = [SITE_RUNTIME_JS, SITE_BASE_CSS, CQ_REWRITE_FN, ...SITE_CQ_FALLBACK_JS.split(CQ_REWRITE_FN)];

// Text a minifier keeps verbatim inside a string or template literal: no
// quotes, backslashes, template syntax or non-ASCII (which it may escape
// differently), and long enough to mean something.
const verbatim = (s) => s.length >= 16 && !/["'`\\]|\$\{|[^\x20-\x7e]/.test(s);

export function runtimeNeedles(sources = RUNTIME_SOURCES) {
  const out = new Set();
  for (const src of sources) {
    for (const raw of lf(src).split('\n')) {
      const line = raw.trim();
      if (verbatim(line)) out.add(line);
    }
  }
  return [...out];
}

// The lines and string-literal contents of some JS text, as a bundle or a
// source file holds them (a template literal keeps its lines; a minifier
// may turn one into a "...\n..." string).
export function textPieces(text) {
  const t = lf(text);
  const lines = new Set();
  for (const raw of t.split(/\n|\\n/)) {
    const line = raw.trim();
    if (verbatim(line)) lines.add(line);
  }
  const strings = new Set();
  for (const m of t.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\$]*)`/g)) {
    const s = m[1] ?? m[2] ?? m[3];
    if (verbatim(s)) strings.add(s);
  }
  return { lines, strings };
}

const SOURCE_RE = /\.(?:js|jsx)$/;
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('._') || name === 'node_modules' || name === '__fixtures__') return [];
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return SOURCE_RE.test(name) && !/\.test\.|\.spec\./.test(name) ? [p] : [];
  });
}

// The app's own text that survives the minifier: src/ pieces (lines and
// string contents) found verbatim in this checkout's build. Library code
// and env values are not src/ text, so they never count.
export function codeNeedles({ appRoot, buildText }) {
  const src = { lines: new Set(), strings: new Set() };
  for (const f of sourceFiles(path.join(appRoot, 'src'))) {
    const p = textPieces(readFileSync(f, 'utf8'));
    p.lines.forEach((x) => src.lines.add(x));
    p.strings.forEach((x) => src.strings.add(x));
  }
  const built = textPieces(buildText);
  return {
    lines: [...src.lines].filter((x) => built.lines.has(x)),
    strings: [...src.strings].filter((x) => built.strings.has(x)),
  };
}

// This checkout's production build (index.html entry, the project's
// vite.config.js), in memory: { chunks: [{ fileName, code, isEntry }],
// text (all chunks' code) }. Writes nothing. Built once per process.
const builds = new Map();
export function localBuild(appRoot) {
  if (!builds.has(appRoot)) {
    builds.set(appRoot, (async () => {
      const { build } = await import('vite');
      // (The build's "caniuse-lite is old" notice is noise in a plan.)
      process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= '1';
      // Built as Netlify builds it. Vite keeps a NODE_ENV that is already
      // set (the page renderer's dev server sets "development", vitest
      // "test"), and React's JSX transform would then emit a dev build.
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      let out;
      try {
        out = await build({ root: appRoot, mode: 'production', logLevel: 'silent', build: { write: false, reportCompressedSize: false } });
      } finally {
        if (nodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = nodeEnv;
      }
      const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output || []);
      const chunks = outputs.filter((o) => o.type === 'chunk').map((o) => ({ fileName: o.fileName, code: o.code, isEntry: !!o.isEntry }));
      if (!chunks.length) throw new Error('the local build produced no JS');
      return { chunks, text: chunks.map((c) => c.code).join('\n') };
    })());
  }
  return builds.get(appRoot);
}

// The manual check list ids a bundle carries ({siteId:"…",reason:"…"}).
export function manualListIds(text) {
  return new Set([...String(text).matchAll(/siteId:\s*["']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/g)].map((m) => m[1]));
}

// Module scripts a page or chunk loads: absolute /assets/… paths and
// relative ./x.js imports (resolved against the chunk's own folder).
export function chunkRefs(text, baseUrl) {
  const refs = new Set();
  for (const m of String(text).matchAll(/(?:["'(]|\bsrc=["'])((?:\/|\.\/|\.\.\/)?assets\/[A-Za-z0-9_.\-/]+\.js)\b/g)) {
    refs.add(new URL(m[1].startsWith('assets/') ? `/${m[1]}` : m[1], baseUrl).href);
  }
  for (const m of String(text).matchAll(/["'](\.\.?\/[A-Za-z0-9_.\-/]+\.js)["']/g)) {
    refs.add(new URL(m[1], baseUrl).href);
  }
  return [...refs].filter((u) => u.startsWith(`${PRODUCTION_APP_ORIGIN}/`));
}

// Downloads the app's JS (index.html and every chunk reachable from it).
async function appBundle(getText) {
  const index = await getText(`${PRODUCTION_APP_ORIGIN}/`);
  const queue = chunkRefs(index, `${PRODUCTION_APP_ORIGIN}/`);
  const seen = new Set(queue);
  const texts = [];
  let bytes = 0;
  while (queue.length) {
    if (texts.length >= MAX_CHUNKS || bytes > MAX_BUNDLE_BYTES) throw new Error('The app bundle is larger than expected');
    const url = queue.shift();
    const text = await getText(url);
    texts.push(text);
    bytes += text.length;
    for (const ref of chunkRefs(text, url)) {
      if (!seen.has(ref)) { seen.add(ref); queue.push(ref); }
    }
  }
  return texts;
}

// Returns { ok, checks: [{ name, ok, detail }] }. `getText(url)` GETs a
// public URL and returns its body (throws on a non-200); `buildOf()`
// resolves to this checkout's build (localBuild).
export async function productionGuard({ getText, appRoot, buildOf = () => localBuild(appRoot) }) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  for (const file of ['scheduler.js', 'contact-form.js']) {
    try {
      const local = readFileSync(path.join(appRoot, 'public', file), 'utf8');
      const remote = await getText(`${PRODUCTION_APP_ORIGIN}/${file}`);
      const same = sha(local) === sha(remote);
      add(file, same, same
        ? `production serves this checkout's ${file} (sha256 ${sha(local).slice(0, 12)})`
        : `production serves another ${file} (sha256 ${sha(remote).slice(0, 12)}, this checkout ${sha(local).slice(0, 12)})`);
    } catch (e) {
      add(file, false, `could not compare: ${e.message}`);
    }
  }

  let prod;
  try {
    const texts = (await appBundle(getText)).map(lf);
    const pieces = textPieces(texts.join('\n'));
    prod = { texts, ...pieces, has: (n) => pieces.lines.has(n) || pieces.strings.has(n) || texts.some((t) => t.includes(n)) };
  } catch (e) {
    add('site runtime', false, `could not read the app bundle: ${e.message}`);
    return { ok: false, checks };
  }

  const needles = runtimeNeedles();
  const missing = needles.filter((n) => !prod.has(n));
  add('site runtime', needles.length > 0 && missing.length === 0, missing.length
    ? `the app bundle lacks ${missing.length} of ${needles.length} runtime lines (e.g. "${missing[0].slice(0, 60)}")`
    : `all ${needles.length} runtime lines found in ${prod.texts.length} bundle files`);

  try {
    const code = codeNeedles({ appRoot, buildText: (await buildOf()).text });
    const all = [...code.lines, ...code.strings];
    // A deploy of other code misses thousands: stop looking after a few
    // hundred (each miss is a full-text search).
    const gone = [];
    for (const n of all) {
      if (!(prod.lines.has(n) || prod.strings.has(n))) {
        if (!prod.texts.some((t) => t.includes(n))) gone.push(n);
        if (gone.length >= 200) break;
      }
    }
    add('app code', all.length > 100 && gone.length === 0, gone.length
      ? `the app bundle lacks ${gone.length >= 200 ? '200+' : gone.length} of ${all.length} pieces of this checkout's code (e.g. "${gone[0].slice(0, 60)}")`
      : `all ${all.length} pieces of this checkout's built code (template CSS, page markup, copy) found`);
  } catch (e) {
    add('app code', false, `could not build this checkout to compare: ${e.message}`);
  }

  const ids = new Set(UPGRADE_MANUAL_SKIP.map((s) => s.siteId));
  const deployed = manualListIds(prod.texts.join('\n'));
  const notDeployed = [...ids].filter((id) => !deployed.has(id));
  const onlyDeployed = [...deployed].filter((id) => !ids.has(id));
  add('manual check list', notDeployed.length === 0 && onlyDeployed.length === 0, notDeployed.length || onlyDeployed.length
    ? `the deployed Site upgrades list differs: ${notDeployed.length} of this checkout's ${ids.size} ids missing, ${onlyDeployed.length} other ids`
    : `the deployed list has exactly this checkout's ${ids.size} manual-check site ids`);

  return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
}
