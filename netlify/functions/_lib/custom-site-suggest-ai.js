import { ASSET_BUCKET, isTeamAsset } from '../../../src/lib/customSiteForm.js';
import { parseCopyJson } from '../../../src/lib/customSiteDesign.js';
import {
  MATCH_SHOT_LIMIT, SUGGEST_EFFORT, SUGGEST_IMAGE_LIMITS, SUGGEST_MODEL, buildSuggestPrompt, matchContextFor, normalizeSuggestion,
  referenceShotGroup, suggestBusinessType, suggestImageCandidates, suggestTemplateIds,
} from '../../../src/lib/designSuggest.js';

// "Suggest a design" on the server: the customer's images from the private
// bucket, one Claude request, and the stored suggestion
// (design.suggestion). Used by custom-site-suggest (claim, read) and
// custom-site-suggest-background (the run). `db` is the service-role
// Supabase client and `client` an Anthropic SDK client, both injected so
// tests can stand in for them.

const TABLE = 'custom_site_projects';

// ─── Images ──────────────────────────────────────────────────────────

// The API refuses an image over 5 MB, counted on the base64 text, which is
// a third bigger than the file; a refused image fails the whole request,
// so anything that could be over is left out instead.
export const MAX_IMAGE_BASE64_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = Math.floor((MAX_IMAGE_BASE64_BYTES * 3) / 4);
// Images over 8000 px on a side are refused too.
export const MAX_IMAGE_SIDE = 8000;
// The whole request must stay under 32 MB: the images get 24 of it, in
// order (logo, inspiration, photos); later ones that don't fit are left out.
export const MAX_TOTAL_BASE64_BYTES = 24 * 1024 * 1024;

const mb = (n) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

// JPEG frame headers that carry the image size (SOF0-SOF15, without DHT,
// JPG and DAC, which share the range).
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    if (JPEG_SOF.has(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function webpSize(buf) {
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8 ' && buf.length >= 30) return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L' && buf.length >= 25) {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X' && buf.length >= 30) return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return null;
}

// What a file really is, from its first bytes (the customer's file name
// and the stored type can be wrong, and a wrong media type fails the
// request): { mediaType, width, height } (sizes null when unreadable), or
// null for anything but JPEG, PNG, GIF and WebP.
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  const size = (s) => ({ width: s?.width || null, height: s?.height || null });
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mediaType: 'image/jpeg', ...size(jpegSize(buf)) };
  if (buf.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') {
    return { mediaType: 'image/png', ...size(buf.length >= 24 ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : null) };
  }
  const head = buf.toString('latin1', 0, 6);
  if (head === 'GIF87a' || head === 'GIF89a') return { mediaType: 'image/gif', width: buf.readUInt16LE(6) || null, height: buf.readUInt16LE(8) || null };
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return { mediaType: 'image/webp', ...size(webpSize(buf)) };
  return null;
}

const skip = (a, reason) => ({ path: a.path, kind: a.kind, name: a.name || '', reason });

async function loadOne(db, asset) {
  if (Number(asset.size) > MAX_IMAGE_BYTES) return { skip: skip(asset, `Too large to send (${mb(asset.size)}; the limit is ${mb(MAX_IMAGE_BYTES)})`) };
  let buf;
  try {
    const { data, error } = await db.storage.from(ASSET_BUCKET).download(asset.path);
    if (error || !data) throw new Error(error?.message || 'no data');
    buf = Buffer.from(await data.arrayBuffer());
  } catch (err) {
    console.warn('[custom-site-suggest] download failed:', asset.path, err?.message || err);
    return { skip: skip(asset, 'Could not be downloaded') };
  }
  const info = sniffImage(buf);
  if (!info) return { skip: skip(asset, 'Not a readable JPEG, PNG, GIF or WebP image') };
  const data = buf.toString('base64');
  if (data.length > MAX_IMAGE_BASE64_BYTES) return { skip: skip(asset, `Too large to send (${mb(buf.length)}; the limit is ${mb(MAX_IMAGE_BYTES)})`) };
  if (info.width > MAX_IMAGE_SIDE || info.height > MAX_IMAGE_SIDE) {
    return { skip: skip(asset, `Too many pixels to send (${info.width}×${info.height}; the limit is ${MAX_IMAGE_SIDE} on a side)`) };
  }
  return { image: { path: asset.path, kind: asset.kind, name: asset.name || '', note: asset.note || '', team: isTeamAsset(asset), mediaType: info.mediaType, data } };
}

const KIND_PLURAL = { logo: 'logo', reference: 'inspiration images', photo: 'photos' };

// The images one request shows: at most 1 logo, 4 inspiration images and
// 8 photos (SUGGEST_IMAGE_LIMITS), in upload order, each one checked after
// download. A file that can't be sent makes room for the next of its kind.
// `matchShots` (a "Match its layout" run: referenceShots' assets, top of
// the page first) go first, marked `match: true`, ahead of everything else
// in the size budget; the other inspiration images are left out then, so
// nothing pulls the layout away from the one to match. Of a cut-up
// screenshot (tiles sharing a group), a lower tile that can't be sent only
// loses that stretch of the page and the others still go, in order; but
// without its top tile none of the group goes: the prompt shows the shots
// as "top of the page first", so a middle tile would be read as the nav
// and hero, the part a layout match leans on most. Returns { images:
// [{ path, kind, name, note, mediaType, data, match? }], skipped: [{ path,
// kind, name, reason }] }.
export async function loadSuggestImages(db, project, { matchShots } = {}) {
  const candidates = suggestImageCandidates(project?.assets);
  const skipped = candidates.unviewable.map((a) => skip(a, a.reason));
  const images = [];
  let budget = MAX_TOTAL_BASE64_BYTES;
  const shots = (Array.isArray(matchShots) ? matchShots : []).slice(0, MATCH_SHOT_LIMIT);
  if (shots.length) {
    const loaded = await Promise.all(shots.map((a) => loadOne(db, a)));
    const seenGroups = new Set();
    const toplessGroups = new Set();
    loaded.forEach((r, i) => {
      const group = referenceShotGroup(shots[i]);
      // referenceShots orders a group by part: its first shot here is its top.
      const isTop = !!group && !seenGroups.has(group);
      if (group) seenGroups.add(group);
      if (toplessGroups.has(group)) {
        skipped.push(skip(shots[i], 'Not sent: the top of this screenshot couldn\'t be sent'));
        return;
      }
      const left = r.skip || (r.image.data.length > budget ? skip(shots[i], 'Left out to keep the request under its size limit') : null);
      if (left) {
        skipped.push(left);
        if (isTop) toplessGroups.add(group);
        return;
      }
      budget -= r.image.data.length;
      images.push({ ...r.image, match: true });
    });
    const shotPaths = new Set(shots.map((a) => a.path));
    for (const a of candidates.reference) {
      if (!shotPaths.has(a.path)) skipped.push(skip(a, 'Not sent: this run matches the chosen reference\'s layout'));
    }
  }
  for (const kind of shots.length ? ['logo', 'photo'] : ['logo', 'reference', 'photo']) {
    const limit = SUGGEST_IMAGE_LIMITS[kind];
    const queue = candidates[kind].slice();
    let taken = 0;
    while (queue.length && taken < limit) {
      const batch = queue.splice(0, limit - taken);
      const loaded = await Promise.all(batch.map((a) => loadOne(db, a)));
      loaded.forEach((r, i) => {
        if (r.skip) skipped.push(r.skip);
        else if (r.image.data.length > budget) skipped.push(skip(batch[i], 'Left out to keep the request under its size limit'));
        else {
          budget -= r.image.data.length;
          images.push(r.image);
          taken += 1;
        }
      });
    }
    for (const a of queue) {
      skipped.push(skip(a, kind === 'logo' ? 'Another version of the logo (one is sent)' : `Only the first ${limit} ${KIND_PLURAL[kind]} are sent`));
    }
  }
  return { images, skipped };
}

// ─── The request ─────────────────────────────────────────────────────

// Thinking is always on for SUGGEST_MODEL and counts toward max_tokens, so
// the limit leaves room for it on top of the JSON (a few thousand tokens).
export const SUGGEST_MAX_TOKENS = 32000;
// An attempt never gets less than this, so a run that starts late fails
// with a timeout rather than a request that can't succeed.
const MIN_ATTEMPT_MS = 5000;

// One suggestion request on SUGGEST_MODEL at SUGGEST_EFFORT, as
// requestDesignCopy (custom-site-design-ai.js) does it: JSON matching the
// prompt's schema (structured output) with the server-side refusal
// fallback; if the API rejects that request shape (400), one plain retry,
// where the prompt itself asks for JSON. `prompt` is buildSuggestPrompt's
// { system, content, schema }. `deadlineMs` (epoch ms), when given, bounds
// both attempts together: each one's timeout is the time left.
export async function requestSuggestion(client, prompt, { deadlineMs } = {}) {
  const base = {
    model: SUGGEST_MODEL,
    max_tokens: SUGGEST_MAX_TOKENS,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.content }],
  };
  const timeout = () => (Number.isFinite(deadlineMs) ? { timeout: Math.max(MIN_ATTEMPT_MS, deadlineMs - Date.now()) } : {});
  let message;
  try {
    message = await client.messages.create({
      ...base,
      output_config: { effort: SUGGEST_EFFORT, format: { type: 'json_schema', schema: prompt.schema } },
      fallbacks: 'default',
    }, { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' }, ...timeout() });
  } catch (err) {
    if (err?.status !== 400) throw err;
    console.warn('[custom-site-suggest] structured request rejected, retrying plain:', err?.message);
    message = await client.messages.create({ ...base, output_config: { effort: SUGGEST_EFFORT } }, timeout());
  }
  if (message?.stop_reason === 'refusal') {
    throw Object.assign(new Error('Claude declined to suggest a design. Check the intake and images for anything unusual and try again.'), { code: 'refusal' });
  }
  if (message?.stop_reason === 'max_tokens') {
    throw Object.assign(new Error('The suggestion came out too long. Try again.'), { code: 'max_tokens' });
  }
  return { raw: parseCopyJson(message?.content), model: message?.model || SUGGEST_MODEL };
}

// The whole suggestion for one project: images, request, checks
// (normalizeSuggestion). Never writes anything. Returns { model,
// templateId, levers, photoPlan, reasons, facts, skipped, dropped,
// imageCount } (+ reference for a match run).
//
// `reference` is the choice the run was claimed with (custom-site-suggest
// `start` checked it; it is checked again here, against the project as it
// is now), `studioPalette` the Studio colors and `useBrand` the "Use their
// brand color" toggle sent with it (a boolean wins over the saved
// design.useBrand; matchPalettePlan). A match run needs a screenshot it can
// send (for a cut-up one, its top tile; loadSuggestImages): without one it
// fails before the request (the reference is never fetched from the web,
// and a match never quietly turns into an inspiration run).
export async function suggestDesign({ db, client, project, deadlineMs, reference = null, studioPalette = null, useBrand }) {
  const templateIds = suggestTemplateIds(suggestBusinessType(project));
  const { error, match: context } = matchContextFor(project, { reference, studioPalette, useBrand });
  if (error) throw Object.assign(new Error(error), { code: 'reference' });
  const { images, skipped } = await loadSuggestImages(db, project, { matchShots: context?.shots });
  let match = null;
  if (context) {
    const sent = images.filter((img) => img.match);
    if (!sent.length) {
      const why = skipped.find((s) => context.shots.some((a) => a.path === s.path))?.reason;
      throw Object.assign(new Error(`The screenshot to match couldn't be sent${why ? ` (${why})` : ''}. Add a PNG, JPEG or WebP screenshot and try again.`), { code: 'reference' });
    }
    match = { ...context, shots: sent.map(({ path, name }) => ({ path, name })) };
  }
  const prompt = buildSuggestPrompt({ project, templateIds, images, skipped, match });
  const { raw, model } = await requestSuggestion(client, prompt, { deadlineMs });
  return { ...normalizeSuggestion(raw, { project, templateIds, match }), model, skipped, imageCount: images.length };
}

// ─── Storage (design.suggestion) ─────────────────────────────────────

// Is `suggestion` the running run that started at `startedAt`? Compared as
// instants, so '…Z' and '…+00:00' match.
export function isSameSuggestRun(suggestion, startedAt) {
  return suggestion?.status === 'running' && !!startedAt
    && Date.parse(suggestion.startedAt || '') === Date.parse(startedAt);
}

// The stored shape of a run that ended without a suggestion.
export function failedSuggestion({ startedAt, finishedAt = new Date().toISOString(), error }) {
  return {
    status: 'failed', startedAt: startedAt || null, finishedAt, model: null, templateId: '', levers: null,
    photoPlan: null, reasons: {}, facts: [], skipped: [], error: String(error || 'Something went wrong').slice(0, 500),
  };
}

// Read-modify-write of design.suggestion that keeps every other design
// key. design is one jsonb column that design-save and launch-save write
// too, so the write only lands while the row is still the one read
// (updated_at moves on every write, via the trigger); otherwise it reads
// again and asks `next` again. `next(current, project)` returns the
// suggestion to store, or undefined to leave the row as it is. Returns
// { project, suggestion, written } (project null when there is no such
// project).
export async function updateSuggestion(db, projectId, next) {
  if (typeof projectId !== 'string' || !projectId) return { project: null, suggestion: null, written: false };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: project, error } = await db.from(TABLE).select('id, design, updated_at').eq('id', projectId).maybeSingle();
    if (error) throw Object.assign(new Error('Could not load the project'), { status: 500 });
    if (!project) return { project: null, suggestion: null, written: false };
    const design = project.design && typeof project.design === 'object' && !Array.isArray(project.design) ? project.design : {};
    const current = design.suggestion || null;
    const suggestion = next(current, project);
    if (suggestion === undefined) return { project, suggestion: current, written: false };
    let q = db.from(TABLE).update({ design: { ...design, suggestion } }).eq('id', projectId);
    if (project.updated_at) q = q.eq('updated_at', project.updated_at);
    const { data, error: writeError } = await q.select('id').maybeSingle();
    if (writeError) throw Object.assign(new Error('Could not save the suggestion'), { status: 500 });
    if (data) return { project, suggestion, written: true };
  }
  throw Object.assign(new Error('The project changed while saving. Try again.'), { status: 409 });
}
