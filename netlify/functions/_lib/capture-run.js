import crypto from 'node:crypto';
import { updateProjectRow } from './heic-run.js';
import { REFERENCE_TEAM_MAX, referenceCount } from './reference-assets.js';
import { isTeamAsset } from '../../../src/lib/customSiteForm.js';
import { referenceUrlKey } from '../../../src/lib/designSuggest.js';

// A reference site's screenshots taken by our browser, for custom-site
// projects: the run record, how a run is claimed and started, and which
// stored screenshots a capture made. Shared by custom-site-admin
// (reference-capture: "Add" and "Capture again" in the Design step) and
// custom-site-capture-background (the capture itself, _lib/capture.js).
// Light on purpose: the admin function imports it, the browser only loads
// in the background function.
//
// The run lives in custom_site_projects.design.capture (one at a time per
// project; design-save carries it over like the other server-written keys):
//   { status: 'running' | 'ready' | 'failed', url, note? (the admin's
//     "what to copy"), startedAt, finishedAt, parts (screenshots stored),
//     error (a short sentence for the admin, null unless failed),
//     attempted? }
// Each screenshot is a team reference on project.assets:
//   { path: <id>/reference/<uuid>.jpg, kind: 'reference', name: '<host>
//     (part i of n).jpg', size, type: 'image/jpeg', note: 'Screenshot of
//     <url>[ - <note>]', addedBy: 'admin', group, part, captured: true }
// The note is how a match on that address finds them (designSuggest.js
// referenceShots), exactly as for a screenshot the admin uploads.
//
// Every write is a read-modify-write that lands only while the row is still
// the one read (heic-run.js updateProjectRow): design and assets are
// columns other actions write too (design-save, the customer's autosave).

const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');

// A capture takes a minute or two (the browser may be downloaded first,
// the page gets 25 s to load); one still marked running after this died
// (timeout, lost invocation) and another may start.
export const CAPTURE_RUN_LIVE_MS = 10 * 60 * 1000;
// The admin's "what to copy" note (design.referenceSites keeps as much).
export const CAPTURE_NOTE_MAX = 300;
export const CAPTURE_BACKGROUND_PATH = '/.netlify/functions/custom-site-capture-background';
// The background function takes only requests signed with the server's own
// key (captureSignature), with its own derivation: a HEIC run's signature
// never starts a capture.
export const CAPTURE_SIGNATURE_HEADER = 'x-acg-capture-signature';
export const CAPTURE_NOTE_PREFIX = 'Screenshot of ';
// Netlify answers a background function with 202 at once; anything slower
// than this means it isn't coming. Kept short: the admin's request also
// spends up to 5 s on the address check, inside a normal function's 10 s.
const START_TIMEOUT_MS = 4_000;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// ─── The screenshots a capture stores ────────────────────────────────

// The note a captured screenshot carries: "Screenshot of <url>", then the
// admin's note after " - ". The address stays whole and a word of its own
// (a match looks for it word by word), so only the admin's part is cut.
export function captureNote(url, note) {
  const own = oneLine(note, CAPTURE_NOTE_MAX);
  return `${CAPTURE_NOTE_PREFIX}${url}${own ? ` - ${own}` : ''}`;
}

// The address a screenshot this capture made pictures (referenceUrlKey),
// or '' for any other upload. Only the first word after "Screenshot of "
// counts: an admin note that names another site never makes a capture of
// that site replace this one.
export function capturedUrlKey(asset) {
  if (!isObject(asset) || asset.kind !== 'reference' || !isTeamAsset(asset) || asset.captured !== true) return '';
  const note = String(asset.note || '');
  if (!note.startsWith(CAPTURE_NOTE_PREFIX)) return '';
  return referenceUrlKey(note.slice(CAPTURE_NOTE_PREFIX.length).split(/\s+/)[0]);
}

// The screenshots an earlier capture of `url` stored, in list order.
export function capturedAssetsFor(assets, url) {
  const key = referenceUrlKey(url);
  if (!key) return [];
  return (Array.isArray(assets) ? assets : []).filter((a) => capturedUrlKey(a) === key);
}

// ─── The run record ──────────────────────────────────────────────────

// A capture that is working: marked running and claimed less than 10
// minutes ago. Date.parse, so any ISO form compares as the instant it is.
export function isCaptureLive(capture, nowMs = Date.now()) {
  if (!isObject(capture) || capture.status !== 'running') return false;
  const started = Date.parse(capture.startedAt || '');
  return Number.isFinite(started) && nowMs - started < CAPTURE_RUN_LIVE_MS;
}

// `capture` is the claim made at `startedAt` (compared as instants).
export function isSameCaptureClaim(capture, startedAt) {
  if (!isObject(capture) || capture.status !== 'running') return false;
  const a = Date.parse(capture.startedAt || '');
  const b = Date.parse(typeof startedAt === 'string' ? startedAt : '');
  return Number.isFinite(a) && a === b;
}

const designOf = (row) => (isObject(row?.design) ? row.design : {});

// Read-modify-write of design.capture alone. `next(current, row)` returns
// the record to store, or undefined. Returns { project, record, written }.
export async function updateCaptureRecord(db, projectId, next) {
  let record = null;
  const { row, written } = await updateProjectRow(db, projectId, 'design', (r) => {
    const design = designOf(r);
    const current = design.capture ?? null;
    const value = next(current, r);
    record = value === undefined ? current : value;
    return value === undefined ? undefined : { design: { ...design, capture: value } };
  });
  return { project: row, record: row ? record : null, written };
}

// Claims a capture of `url` (already checked by the guard): design.capture
// becomes { status: 'running', url, note?, startedAt, finishedAt: null,
// parts: 0, error: null }. Refused while another capture is live (reason
// 'live', capture: that one) and when the team's screenshots fill the
// project even once this address's earlier capture goes (reason 'full').
// The checks and the claim are one guarded write, so two clicks at once
// claim one capture. Returns { claimed, capture, project, reason? }
// (project null and reason 'not_found' when there is no such project).
export async function claimCapture(db, projectId, { url, note = '', nowMs = Date.now() } = {}) {
  let refusal = null;
  let capture = null;
  const { row, written } = await updateProjectRow(db, projectId, 'design, assets', (r) => {
    const design = designOf(r);
    const current = design.capture ?? null;
    refusal = null;
    capture = current;
    if (isCaptureLive(current, nowMs)) {
      refusal = 'live';
      return undefined;
    }
    if (referenceCount(r.assets) - capturedAssetsFor(r.assets, url).length >= REFERENCE_TEAM_MAX) {
      refusal = 'full';
      return undefined;
    }
    const own = oneLine(note, CAPTURE_NOTE_MAX);
    capture = {
      status: 'running',
      url,
      ...(own ? { note: own } : {}),
      startedAt: new Date(nowMs).toISOString(),
      finishedAt: null,
      parts: 0,
      error: null,
    };
    return { design: { ...design, capture } };
  });
  if (!row) return { claimed: false, capture: null, project: null, reason: 'not_found' };
  if (!written) return { claimed: false, capture, project: row, reason: refusal || 'live' };
  return { claimed: true, capture, project: row };
}

// Gives up a claim the background function never took (it couldn't be
// started): marked failed with `error`, only while it is still that claim.
// Returns true when it wrote.
export async function releaseCapture(db, projectId, startedAt, error, nowMs = Date.now()) {
  const { written } = await updateCaptureRecord(db, projectId, (current) => (
    isSameCaptureClaim(current, startedAt)
      ? { ...current, status: 'failed', finishedAt: new Date(nowMs).toISOString(), error: oneLine(error, 300) || 'The capture could not be started' }
      : undefined
  ));
  return written;
}

// ─── Starting the background function ────────────────────────────────

// Derived from the service-role key, which only the functions hold (an
// HMAC doesn't reveal its key), and from this function's name, so the
// signature of another background run (heic-run.js) never verifies here.
function signingKey(secret) {
  return crypto.createHmac('sha256', String(secret)).update('custom-site-capture-background v1').digest();
}

// The signature of one start request: the claim it runs (project id and
// startedAt) and the actor its events name. '' without a key.
export function captureSignature({ id, startedAt, actor } = {}, secret = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!secret) return '';
  return crypto.createHmac('sha256', signingKey(secret))
    .update(`${String(id || '')}\n${String(startedAt || '')}\n${String(actor || '')}`)
    .digest('base64url');
}

export function verifyCaptureSignature(payload, signature, secret = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const expected = captureSignature(payload, secret);
  if (!expected || typeof signature !== 'string' || !signature) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The deploy that took this request also serves the background function:
// its own address (rawUrl), so a preview deploy starts its own code.
function functionsOrigin(event) {
  try {
    if (event?.rawUrl) return new URL(event.rawUrl).origin;
  } catch { /* fall through */ }
  return (process.env.URL || APP_URL).replace(/\/$/, '');
}

// Starts custom-site-capture-background for the claim made at `startedAt`.
// Resolves once Netlify accepted it; throws (with what went wrong) when it
// didn't, and the caller gives the claim up (releaseCapture) so the button
// works again at once.
export async function invokeCaptureBackground(event, { id, startedAt, actor } = {}) {
  const payload = { id, startedAt, ...(actor ? { actor: String(actor).slice(0, 200) } : {}) };
  const signature = captureSignature(payload);
  if (!signature) throw new Error('the server has no key to sign the request with');
  let res;
  try {
    res = await fetch(`${functionsOrigin(event)}${CAPTURE_BACKGROUND_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [CAPTURE_SIGNATURE_HEADER]: signature },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(START_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(e?.message || 'network error');
  }
  if (!res.ok) throw new Error(`the background function answered ${res.status}`);
}
