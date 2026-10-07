import crypto from 'node:crypto';

// iPhone photos (HEIC/HEIF) to JPEG for custom-site projects: which uploads
// need it, the run record, and how a run is claimed and started. Shared by
// custom-site-admin (the project page's "Convert them to JPEG"),
// custom-site-form (a customer save that stores HEIC files) and
// custom-site-heic-background (the conversion itself, _lib/heic.js). This
// module stays light: the form function imports it, and the wasm decoder
// only loads in the background function.
//
// The run lives in custom_site_projects.design.heic:
//   { status: 'running' | 'ready' | 'failed', startedAt, finishedAt,
//     converted (files done so far), failed: [{ path, name, reason }] (at
//     most HEIC_FAILED_MAX), total (HEIC files waiting when it was claimed),
//     by: 'admin' | 'customer', note? (a run that stopped at its time limit
//     with files left), error? (a run that broke as a whole), attempted? }
// 'ready' means the run went through: files it couldn't convert are listed
// in `failed`, and the rest of the project's HEIC files are JPEGs now.
// A converted file takes the HEIC upload's place in project.assets (same
// spot, note, addedBy, group and part) and records convertedFrom: <the HEIC
// path>; the HEIC object is deleted once the list no longer points at it.
//
// Every write here is a read-modify-write that only lands while the row is
// still the one read (updated_at moves on every write, via the trigger):
// design and assets are columns other actions write too (design-save,
// brand and kit runs, the customer's autosave).

const TABLE = 'custom_site_projects';
const APP_URL = (process.env.MAIN_APP_URL || 'https://sitebuilder.autocaregenius.com').replace(/\/$/, '');

// The upload kinds a HEIC can be (customSiteForm.js ASSET_KINDS).
export const HEIC_KINDS = Object.freeze(['photo', 'logo', 'brand', 'reference']);
// A background function gets 15 minutes: a run still marked running after
// that died (timeout, lost invocation) and another may start.
export const HEIC_RUN_LIVE_MS = 15 * 60 * 1000;
// The run stops picking up files after this long (counted from the claim),
// so the file in hand and the final write finish well inside the 15.
export const HEIC_BUDGET_MS = 12 * 60 * 1000;
// Uploads cap at 25 MB (UPLOAD_MAX_BYTES); anything bigger isn't one.
export const HEIC_MAX_BYTES = 30 * 1024 * 1024;
export const HEIC_FAILED_MAX = 50;
export const HEIC_BACKGROUND_PATH = '/.netlify/functions/custom-site-heic-background';
// The background function takes only requests signed with the server's own
// key (heicSignature): the customer's form has no sign-in to pass along.
export const HEIC_SIGNATURE_HEADER = 'x-acg-heic-signature';
// Netlify answers a background function with 202 at once; anything slower
// than this means it isn't coming.
const START_TIMEOUT_MS = 10_000;

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_EXT = /\.hei[cf]$/i;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── Which uploads ───────────────────────────────────────────────────

// A HEIC/HEIF upload still to convert: one of the four upload kinds, a HEIC
// type or a .heic/.heif name or path, and not a JPEG this conversion wrote.
export function isHeicAsset(asset) {
  if (!isObject(asset) || !HEIC_KINDS.includes(asset.kind)) return false;
  if (typeof asset.path !== 'string' || !asset.path || asset.convertedFrom) return false;
  const type = String(asset.type || '').trim().toLowerCase();
  return HEIC_TYPES.includes(type) || HEIC_EXT.test(String(asset.name || '')) || HEIC_EXT.test(asset.path);
}

// The uploads still to convert, in the list's order.
export function heicAssetsOf(assets) {
  return (Array.isArray(assets) ? assets : []).filter(isHeicAsset);
}

// ─── The run record ──────────────────────────────────────────────────

// A run that is working: marked running and claimed less than 15 minutes
// ago. Date.parse, so any ISO form compares as the instant it is.
export function isHeicRunLive(run, nowMs = Date.now()) {
  if (!isObject(run) || run.status !== 'running') return false;
  const started = Date.parse(run.startedAt || '');
  return Number.isFinite(started) && nowMs - started < HEIC_RUN_LIVE_MS;
}

// `run` is the claim made at `startedAt` (compared as instants: the claim
// wrote '…Z', a caller may send it back in another form).
export function isSameHeicClaim(run, startedAt) {
  if (!isObject(run) || run.status !== 'running') return false;
  const a = Date.parse(run.startedAt || '');
  const b = Date.parse(typeof startedAt === 'string' ? startedAt : '');
  return Number.isFinite(a) && a === b;
}

// Read-modify-write of one project row. `change(row)` gets the row (the
// `columns` read, plus id and updated_at) and returns the patch to write,
// or undefined to leave the row as it is. The write lands only while
// updated_at is still the one read; otherwise the row is read again and
// `change` asked again, up to `attempts` times. Returns { row, patch,
// written } (row null when there is no such project); throws (status 409)
// when the row kept changing, or (500) when the database fails.
export async function updateProjectRow(db, projectId, columns, change, { attempts = 3 } = {}) {
  if (typeof projectId !== 'string' || !projectId) return { row: null, patch: undefined, written: false };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data: row, error } = await db.from(TABLE).select(`id, ${columns}, updated_at`).eq('id', projectId).maybeSingle();
    if (error) throw Object.assign(new Error('Could not load the project'), { status: 500 });
    if (!row) return { row: null, patch: undefined, written: false };
    const patch = change(row);
    if (patch === undefined) return { row, patch, written: false };
    let q = db.from(TABLE).update(patch).eq('id', row.id);
    if (row.updated_at) q = q.eq('updated_at', row.updated_at);
    const { data, error: writeError } = await q.select('id').maybeSingle();
    if (writeError) throw Object.assign(new Error('Could not save the project'), { status: 500 });
    if (data) return { row, patch, written: true };
  }
  throw Object.assign(new Error('The project kept changing while saving. Try again.'), { status: 409 });
}

const designOf = (row) => (isObject(row?.design) ? row.design : {});

// Read-modify-write of design.heic alone. `next(current, row)` returns the
// record to store, or undefined. Returns { project, record, written }
// (record: what design.heic holds now).
export async function updateHeicRecord(db, projectId, next) {
  let record = null;
  const { row, written } = await updateProjectRow(db, projectId, 'design', (r) => {
    const design = designOf(r);
    const current = design.heic ?? null;
    const value = next(current, r);
    record = value === undefined ? current : value;
    return value === undefined ? undefined : { design: { ...design, heic: value } };
  });
  return { project: row, record: row ? record : null, written };
}

// Claims a conversion run: design.heic becomes { status: 'running',
// startedAt, finishedAt: null, converted: 0, failed: [], total, by }.
// Refused while another run is live (reason 'live', run: that run) and
// when the project holds no HEIC upload (reason 'nothing'). The check and
// the claim are one guarded write, so two saves or clicks at once claim
// one run. Returns { claimed, run, project, reason? } (project: the row as
// read, null when there is no such project, reason 'not_found').
export async function claimHeicRun(db, projectId, { by = 'admin', nowMs = Date.now() } = {}) {
  const who = by === 'customer' ? 'customer' : 'admin';
  let refusal = null;
  let run = null;
  const { row, written } = await updateProjectRow(db, projectId, 'design, assets', (r) => {
    const design = designOf(r);
    const current = design.heic ?? null;
    refusal = null;
    run = current;
    if (isHeicRunLive(current, nowMs)) {
      refusal = 'live';
      return undefined;
    }
    const waiting = heicAssetsOf(r.assets);
    if (!waiting.length) {
      refusal = 'nothing';
      return undefined;
    }
    run = {
      status: 'running',
      startedAt: new Date(nowMs).toISOString(),
      finishedAt: null,
      converted: 0,
      failed: [],
      total: waiting.length,
      by: who,
    };
    return { design: { ...design, heic: run } };
  });
  if (!row) return { claimed: false, run: null, project: null, reason: 'not_found' };
  if (!written) return { claimed: false, run, project: row, reason: refusal || 'nothing' };
  return { claimed: true, run, project: row };
}

// Gives up a claim the background function never took (it couldn't be
// started): marked failed with `error`, only while it is still that claim.
// Returns true when it wrote.
export async function releaseHeicRun(db, projectId, startedAt, error, nowMs = Date.now()) {
  const { written } = await updateHeicRecord(db, projectId, (current) => (
    isSameHeicClaim(current, startedAt)
      ? { ...current, status: 'failed', finishedAt: new Date(nowMs).toISOString(), error: String(error || 'The conversion could not be started').slice(0, 300) }
      : undefined
  ));
  return written;
}

// ─── Starting the background function ────────────────────────────────

// The key requests to the background function are signed with: derived from
// the service-role key, which only the functions hold (and which never
// leaves them: an HMAC doesn't reveal its key).
function signingKey(secret) {
  return crypto.createHmac('sha256', String(secret)).update('custom-site-heic-background v1').digest();
}

// The signature of one start request: the claim it runs (project id and
// startedAt) and the actor its events name. '' without a key.
export function heicSignature({ id, startedAt, actor } = {}, secret = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!secret) return '';
  return crypto.createHmac('sha256', signingKey(secret))
    .update(`${String(id || '')}\n${String(startedAt || '')}\n${String(actor || '')}`)
    .digest('base64url');
}

export function verifyHeicSignature(payload, signature, secret = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const expected = heicSignature(payload, secret);
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

// Starts custom-site-heic-background for the claim made at `startedAt`.
// Resolves once Netlify accepted it; throws (with what went wrong) when it
// didn't, and the caller gives the claim up (releaseHeicRun) so the next
// press or save can start again. `actor` (optional) is who the run's
// events name; without it, the claim's `by`.
export async function invokeHeicBackground(event, { id, startedAt, actor } = {}) {
  const payload = { id, startedAt, ...(actor ? { actor: String(actor).slice(0, 200) } : {}) };
  const signature = heicSignature(payload);
  if (!signature) throw new Error('the server has no key to sign the request with');
  let res;
  try {
    res = await fetch(`${functionsOrigin(event)}${HEIC_BACKGROUND_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [HEIC_SIGNATURE_HEADER]: signature },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(START_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(e?.message || 'network error');
  }
  if (!res.ok) throw new Error(`the background function answered ${res.status}`);
}
