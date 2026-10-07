// POST /.netlify/functions/custom-site-capture-background   { id, startedAt, actor? }
//
// Background function (the -background suffix: Netlify answers 202 at once
// and lets this run up to 15 minutes). Takes screenshots of a reference
// site the admin pasted the address of, so "Match its layout" can read it
// like a screenshot the admin uploaded. A capture is claimed first
// (design.capture = { status: 'running', url, startedAt }, _lib/capture-run.js
// claimCapture) by custom-site-admin `reference-capture`; this function only
// runs the claim it is given, so a double click or a retried request can't
// start a second one. The request carries the server's signature
// (captureSignature) instead of a sign-in.
//
// The capture (_lib/capture.js capturePage): headless Chromium
// (@sparticuz/chromium-min, its binary downloaded to /tmp on a cold start,
// driven by puppeteer-core), 1440 x 900 at device pixel ratio 1, a normal
// desktop Chrome user agent; the page gets 25 s to load and up to 8 s more
// to go quiet, is scrolled to the bottom (at most 9600 px) for its lazy
// images, then shot from the top in parts of 1440 x 2400 (JPEG, at most
// four). Every address the browser reaches is checked by the guard there
// (public addresses only, through its own proxy).
//
// The parts are uploaded to <id>/reference/<uuid>.jpg first, then put on
// project.assets as team reference screenshots in one guarded write that
// also takes out an earlier capture of the same address (its files are
// deleted once the list no longer points at them) and marks the run ready.
// A screenshot is only ever used to match layout and structure: nothing of
// it goes on the customer's site.
import crypto from 'node:crypto';
import { supabaseAdmin } from './_shared/auth.js';
import { CAPTURE_VIEWPORT, CaptureError, capturePage } from './_lib/capture.js';
import {
  CAPTURE_SIGNATURE_HEADER, captureNote, capturedAssetsFor, isSameCaptureClaim, updateCaptureRecord, verifyCaptureSignature,
} from './_lib/capture-run.js';
import { updateProjectRow } from './_lib/heic-run.js';
import { REFERENCE_FULL, REFERENCE_TEAM_MAX, referenceCount } from './_lib/reference-assets.js';
import { ASSET_BUCKET } from '../../src/lib/customSiteForm.js';

const TABLE = 'custom_site_projects';
const EVENTS = 'custom_site_project_events';
const TAG = '[custom-site-capture]';

// The Chromium build @sparticuz/chromium-min 143.0.4 is made for (its pack
// is too big to deploy with the function, ~65 MB): downloaded once per warm
// instance. CHROMIUM_PACK_URL may point at a copy we host.
export const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar';
// chromium-min's serverless flags include these; a capture of a stranger's
// page keeps the browser's same-origin rules and mixed-content blocking.
const UNSAFE_FLAGS = ['--disable-web-security', '--allow-running-insecure-content'];
// They also turn SharedArrayBuffer on for every page, which a person's
// Chrome gives only a cross-origin-isolated one: with it a page can time
// memory reads (Spectre), and in a single process all of the browser's
// memory is in reach. Taken back out of --enable-features.
const UNSAFE_FEATURES = ['SharedArrayBuffer'];

// chromium-min's flags without the unsafe ones above.
export function safeChromiumArgs(args) {
  const out = [];
  for (const raw of Array.isArray(args) ? args : []) {
    const arg = String(raw);
    const name = arg.split('=')[0];
    if (UNSAFE_FLAGS.includes(name)) continue;
    if (name === '--enable-features') {
      const kept = arg.slice(name.length + 1).split(',').filter((f) => f && !UNSAFE_FEATURES.includes(f));
      if (kept.length) out.push(`--enable-features=${kept.join(',')}`);
      continue;
    }
    out.push(arg);
  }
  return out;
}

// The browser runs someone else's page in a single process without a
// sandbox (all a function allows), so it gets an environment without the
// functions' secrets: the service-role key, the Stripe, Postmark and
// Anthropic keys, the platform's own credentials (AWS_*, NETLIFY_*). A
// page that reads the browser's memory finds none of them there. (They
// stay in the function's own process: this narrows a break-in, it doesn't
// replace keeping Chromium current.) What it needs (the library and font
// paths chromium-min sets, HOME, PATH, TZ) passes as it is.
const SECRET_ENV_NAME = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|DATABASE_URL|_DSN$/i;
const SECRET_ENV_PREFIX = /^(AWS_|NETLIFY|SUPABASE|STRIPE|POSTMARK|ANTHROPIC)/i;
export function browserEnv(env = process.env) {
  const out = {};
  for (const [name, value] of Object.entries(env || {})) {
    if (typeof value !== 'string' || SECRET_ENV_NAME.test(name) || SECRET_ENV_PREFIX.test(name)) continue;
    out[name] = value;
  }
  return out;
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function logEvent(db, projectId, type, data, actor) {
  const { error } = await db.from(EVENTS).insert({ project_id: projectId, type, data: data || {}, actor });
  if (error) console.error(`${TAG} event ${type} not logged:`, error.message);
}

// Starts the browser (capturePage's `launch`). Imported here, not in
// _lib/capture.js, so only this function's bundle carries puppeteer-core
// and chromium-min (netlify.toml ships them as node_modules). With
// `executablePath` (the local test) that browser is used as it is.
// `modules` is for tests: the two packages' loaders.
const PACKAGES = {
  puppeteer: () => import('puppeteer-core'),
  chromium: () => import('@sparticuz/chromium-min'),
};
// chromium-min sets up its Amazon Linux libraries when it is first loaded,
// and only when AWS_EXECUTION_ENV or AWS_LAMBDA_JS_RUNTIME names a Node
// 20/22/24 runtime. On a Lambda (LAMBDA_TASK_ROOT) that names neither, say
// which Node it is, before the first import.
export function lambdaRuntimeHint(env = process.env, nodeVersion = process.versions.node) {
  if (!env.LAMBDA_TASK_ROOT || process.platform !== 'linux') return null;
  const named = /(?:20|22|24)\.x/;
  if (named.test(env.AWS_EXECUTION_ENV || '') || named.test(env.AWS_LAMBDA_JS_RUNTIME || '')) return null;
  return `nodejs${String(nodeVersion).split('.')[0]}.x`;
}

// The browser chromium-min unpacked into /tmp, which it reuses whenever
// /tmp/chromium exists: an unpack cut short would fail every capture on
// that instance, so a failed start clears it and unpacks once more.
const UNPACKED = ['chromium', 'chromium-pack', 'al2023', 'fonts', 'swiftshader'];
async function clearUnpacked() {
  const { rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  await Promise.all(UNPACKED.map((name) => rm(join(tmpdir(), name), { recursive: true, force: true }).catch(() => {})));
}

export async function launchBrowser({ args = [], executablePath = null, headless, modules = PACKAGES, clear = clearUnpacked } = {}) {
  const pptr = await modules.puppeteer();
  const puppeteer = pptr.default || pptr;
  const launch = (exe, base, mode) => puppeteer.launch({
    executablePath: exe,
    headless: mode,
    args: [...base, ...args],
    // Read after chromium-min loaded: it sets the library and font paths
    // the browser needs on process.env.
    env: browserEnv(process.env),
    defaultViewport: { ...CAPTURE_VIEWPORT },
    downloadBehavior: { policy: 'deny' },
    acceptInsecureCerts: false,
    timeout: 60_000,
    protocolTimeout: 90_000,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });
  if (executablePath) return launch(executablePath, [], headless ?? true);

  const hint = lambdaRuntimeHint();
  if (hint) process.env.AWS_LAMBDA_JS_RUNTIME = hint;
  const cm = await modules.chromium();
  const chromium = cm.default || cm;
  // No WebGL: a layout screenshot doesn't need it.
  chromium.setGraphicsMode = false;
  const packUrl = process.env.CHROMIUM_PACK_URL || CHROMIUM_PACK_URL;
  const base = safeChromiumArgs(chromium.args);
  try {
    return await launch(await chromium.executablePath(packUrl), base, 'shell');
  } catch (err) {
    console.warn(`${TAG} browser start failed, unpacking it again:`, err?.message || err);
    await clear();
    return launch(await chromium.executablePath(packUrl), base, 'shell');
  }
}

// "shop.com (part 2 of 3).jpg", or "shop.com.jpg" for a page that fits
// one part, as the Design step's uploader names the parts of a screenshot
// it cuts (referenceMatch.js tileName). The name ends in .jpg: a match only
// takes a screenshot it can view by name and path.
export function partName(url, part, parts) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* below */ }
  const base = oneLine(host, 150) || 'site';
  return parts > 1 ? `${base} (part ${part} of ${parts}).jpg` : `${base}.jpg`;
}

// A storage call that never answers would hold the run until Netlify's
// 15-minute kill and leave the claim "running": give up instead. A removal
// too: on a failure the record is written after it.
const STORAGE_TIMEOUT_MS = 60 * 1000;
function withTimeout(promise, what, ms = STORAGE_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function removeObjects(db, paths, why, timeoutMs = STORAGE_TIMEOUT_MS) {
  if (!paths.length) return;
  try {
    const { error } = await withTimeout(db.storage.from(ASSET_BUCKET).remove(paths), 'The removal', timeoutMs);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn(`${TAG} ${why} not removed:`, paths.join(', '), err?.message || err);
  }
}

// Whether project.assets lists `path`: true, false, or null when the
// project can't be read (then nobody can tell).
async function listsPath(db, projectId, path) {
  try {
    const { data, error } = await db.from(TABLE).select('assets').eq('id', projectId).maybeSingle();
    if (error) return null;
    return (Array.isArray(data?.assets) ? data.assets : []).some((a) => isObject(a) && a.path === path);
  } catch {
    return null;
  }
}

// Uploads the parts, then records them (see the top). Returns { parts,
// replaced, recorded } (recorded: the run's record was marked ready in the
// same write) or throws a CaptureError for the admin. Nothing it uploaded
// stays behind unless the list may point at it.
async function storeParts({ db, projectId, claim, startedAt, parts, newId, now, storageTimeoutMs = STORAGE_TIMEOUT_MS }) {
  const url = claim.url;
  const group = newId();
  const note = captureNote(url, claim.note);
  const tried = [];
  const stored = [];
  try {
    for (const p of parts) {
      const path = `${projectId}/reference/${newId()}.jpg`;
      tried.push(path);
      const { error } = await withTimeout(db.storage.from(ASSET_BUCKET).upload(path, p.buffer, { contentType: 'image/jpeg', upsert: false }), 'The upload', storageTimeoutMs);
      if (error) throw new Error(error.message);
      stored.push({
        path,
        kind: 'reference',
        name: partName(url, p.part, parts.length),
        size: p.buffer.length,
        type: 'image/jpeg',
        note,
        addedBy: 'admin',
        group,
        part: p.part,
        captured: true,
      });
    }
  } catch (err) {
    console.warn(`${TAG} upload failed:`, err?.message || err);
    await removeObjects(db, tried, 'unused screenshot', storageTimeoutMs);
    throw new CaptureError('store', 'The screenshots could not be stored. Try again.');
  }

  let replaced = [];
  // The parts that fit: the claim only made sure one does, and a capture
  // that ran the whole browser keeps the top of the page rather than
  // failing over the last part or two.
  let take = stored;
  let full = false;
  let recorded = false;
  let written = false;
  let saveError = null;
  let found = true;
  const finishedAt = now();
  try {
    let row;
    ({ row, written } = await updateProjectRow(db, projectId, 'assets, design', (r) => {
      full = false;
      replaced = [];
      recorded = false;
      const list = Array.isArray(r.assets) ? r.assets : [];
      const old = capturedAssetsFor(list, url);
      const kept = list.filter((a) => !old.includes(a));
      // The same room an upload has (reference-add): this address's
      // earlier capture makes room as it goes.
      const room = REFERENCE_TEAM_MAX - referenceCount(kept);
      if (room < 1) {
        full = true;
        return undefined;
      }
      take = stored.slice(0, room);
      replaced = old;
      // The new parts take the earlier capture's place in the list (a
      // match on the address keeps the order the admin saw).
      const at = old.length ? list.indexOf(old[0]) : list.length;
      const assets = [...list.slice(0, at).filter((a) => !old.includes(a)), ...take, ...list.slice(at).filter((a) => !old.includes(a))];
      const design = isObject(r.design) ? r.design : {};
      let nextDesign = null;
      // The run's outcome rides on the same write: "ready" never shows
      // before the screenshots are there.
      if (isSameCaptureClaim(design.capture, startedAt)) {
        recorded = true;
        nextDesign = { ...design, capture: { ...design.capture, status: 'ready', finishedAt, parts: take.length, error: null } };
      }
      // A reference the Design step picked from the earlier capture
      // follows to the new part in its place.
      const source = design.reference?.source;
      const was = isObject(source) && source.kind === 'asset' ? old.find((a) => a.path === source.path) : null;
      if (was) {
        const to = take[Math.min(Math.max(1, Number(was.part) || 1), take.length) - 1];
        nextDesign = { ...(nextDesign || design), reference: { ...design.reference, source: { ...source, path: to.path } } };
      }
      return nextDesign ? { assets, design: nextDesign } : { assets };
    }));
    found = !!row;
  } catch (err) {
    console.warn(`${TAG} list not updated:`, err?.message || err);
    saveError = err;
  }
  if (!written && saveError && saveError.status !== 409) {
    // A write the database reported as failed may have landed all the same
    // (an answer lost on the way back): the list decides, and a file is
    // never removed while the list may point at it.
    const listed = await listsPath(db, projectId, stored[0].path);
    if (listed === null) {
      console.warn(`${TAG} screenshots kept, the list can't be checked:`, stored.map((a) => a.path).join(', '));
      throw new CaptureError('store', 'The screenshots could not be saved to the project. Try again.');
    }
    written = listed;
  }
  if (!written) {
    await removeObjects(db, stored.map((a) => a.path), 'unused screenshot', storageTimeoutMs);
    if (!found) throw new CaptureError('gone', 'The project was deleted');
    if (full) throw new CaptureError('full', REFERENCE_FULL);
    throw new CaptureError('store', saveError?.status === 409
      ? 'The project kept changing while saving the screenshots. Capture it again.'
      : 'The screenshots could not be saved to the project. Try again.');
  }
  // The list no longer points at the earlier capture's files, and never
  // pointed at the parts that didn't fit.
  await removeObjects(db, [...replaced, ...stored.slice(take.length)].map((a) => a.path), 'replaced or unused screenshot', storageTimeoutMs);
  return { parts: take.length, dropped: stored.length - take.length, replaced: replaced.length, recorded };
}

// The work, separate from the HTTP wrapper so tests can call it with a fake
// database, storage, browser and DNS. `launch` starts the browser
// (launchBrowser); `lookup` is the guard's DNS lookup; `captureOptions`
// goes to capturePage as it is and `storageTimeoutMs` bounds each storage
// call (tests shorten both).
export async function runCapture({
  db, projectId, startedAt, actor = null, launch = launchBrowser, lookup, captureOptions = {},
  newId = () => crypto.randomUUID(), now = () => new Date().toISOString(), storageTimeoutMs = STORAGE_TIMEOUT_MS,
}) {
  if (typeof projectId !== 'string' || !projectId) return { status: 404, error: 'Project not found' };
  const { data: project, error: loadError } = await db.from(TABLE).select('id, design, updated_at').eq('id', projectId).maybeSingle();
  if (loadError || !project) return { status: 404, error: 'Project not found' };
  const claim = isObject(project.design) ? project.design.capture : null;
  if (!isSameCaptureClaim(claim, startedAt)) return { status: 409, error: 'No matching capture to start' };
  // One attempt per claim: marked before the browser starts. If Netlify
  // retries this function after a hard crash (out of memory, killed), the
  // retry finds the mark and stops; the claim then goes stale and "Capture
  // again" starts a fresh one.
  if (claim.attempted) return { status: 200, error: 'This capture was already attempted' };
  const { written: marked } = await updateCaptureRecord(db, project.id, (current) => (
    isSameCaptureClaim(current, startedAt) && !current.attempted ? { ...current, attempted: true } : undefined
  ));
  if (!marked) return { status: 200, error: 'This capture was already attempted or replaced' };

  const id = project.id;
  const who = oneLine(actor, 200) || 'admin';
  let stored = null;
  let failure = null;
  try {
    const shot = await capturePage({ ...captureOptions, url: claim.url, launch, lookup });
    if (shot.refused?.length) console.log(`${TAG} requests refused by the guard:`, shot.refused.length);
    stored = await storeParts({ db, projectId: id, claim, startedAt, parts: shot.parts, newId, now, storageTimeoutMs });
  } catch (err) {
    if (!(err instanceof CaptureError)) console.error(`${TAG} capture failed:`, err?.message || err);
    failure = err instanceof CaptureError ? err : new CaptureError('failed');
  }

  if (failure) {
    // Stored only while the claim is still this run's.
    try {
      await updateCaptureRecord(db, id, (current) => (
        isSameCaptureClaim(current, startedAt)
          ? { ...current, status: 'failed', finishedAt: now(), parts: 0, error: oneLine(failure.message, 300) }
          : undefined
      ));
    } catch (err) {
      console.error(`${TAG} result not saved:`, err?.message || err);
    }
    await logEvent(db, id, 'reference_capture_failed', { url: claim.url, error: oneLine(failure.message, 200), code: failure.code }, who);
    return { status: 200, ok: false, code: failure.code, error: failure.message };
  }
  await logEvent(db, id, 'reference_captured', { url: claim.url, parts: stored.parts, replaced: stored.replaced, ...(stored.dropped ? { dropped: stored.dropped } : {}) }, who);
  return { status: 200, ok: true, ...stored };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400 }; }
  if (!isObject(body)) return { statusCode: 400 };
  const headers = event.headers || {};
  const signature = headers[CAPTURE_SIGNATURE_HEADER] || headers[CAPTURE_SIGNATURE_HEADER.toLowerCase()] || '';
  if (!verifyCaptureSignature({ id: body.id, startedAt: body.startedAt, actor: body.actor }, signature)) return { statusCode: 401 };
  // Netlify retries a background function that fails. The capture records
  // its own outcome on the project (and a claim is attempted once), so once
  // it has started, always answer 200.
  try {
    await runCapture({ db: supabaseAdmin(), projectId: body.id, startedAt: body.startedAt, actor: body.actor || null });
  } catch (err) {
    console.error(`${TAG} run crashed:`, err?.message || err);
  }
  return { statusCode: 200 };
};
