// Writes the website copy as a background job. Netlify answers the POST with
// 202 straight away and runs this for up to 15 minutes, so the model can think
// for as long as it needs (unmeasured so far; our own deadline is 240 s)
// without the 60 s synchronous limit. The result goes to Netlify Blobs at
// `${user.id}/${jobId}`:
//   running -> done { copy } | error { code, httpStatus, error }
// and the wizard polls generate-website-status for it. The return value is
// ignored by Netlify, so every outcome the owner needs to see is a record.
// Records also say which request wrote the copy (`path`: primary = Opus,
// legacy = the Sonnet 4.6 request generate-website.js sends, used when the
// API rejects the Opus request or keeps rate limiting it) and which daily
// generation the job used.
//
// Netlify v2 function (default export) rather than the v1 handler the other
// functions use: in Lambda compatibility mode (connectLambda) the Blobs
// client has no uncached edge URL, so strong-consistency reads and writes
// throw. v2 functions get the full Blobs environment.
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getStore, getDeployStore } from '@netlify/blobs';
import { requireUser, supabaseAdmin } from './_shared/auth.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import {
  generateCopy,
  generateLegacyCopy,
  generationModel,
  describeFailure,
  isStreamedBusyError,
  legacyFallbackReason,
  attachWidgetKeys,
  hasRequiredBusinessInfo,
  overDailyLimit,
  isJobId,
  jobKey,
  claimJob,
  claimFreeRetry,
  openJobStore,
  pruneOldJobs,
  RATE_LIMIT,
  MESSAGES,
  MODEL_DEADLINE_MS,
  LEGACY_MIN_LEFT_MS,
} from './_lib/copyGeneration.js';

// Per HTTP attempt: until the stream's headers arrive for the Opus request,
// the whole answer for the legacy one (not streamed; the sync route gets it
// inside 54 s). The SDK retries 429, 5xx and overloaded twice with backoff,
// all inside MODEL_DEADLINE_MS.
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;
// An overload or rate limit sent inside the open stream is not retried by
// the SDK (the response was already a 200). We try once more ourselves, while
// at least this much of the deadline is left, after a short pause.
const STREAM_RETRY_MIN_LEFT_MS = 120_000;
const STREAM_RETRY_DELAY_MS = 5_000;

const log = (...args) => console.error('[generate-website-background]', ...args);
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export default async function generateWebsiteBackground(req, context) {
  if (req.method !== 'POST') return;

  // Same gate as the synchronous route: no anonymous Claude calls. Nothing
  // can be recorded without a user; the status poll fails the same auth.
  let user;
  try {
    user = await requireUser({ headers: { authorization: req.headers.get('authorization') || '' } });
  } catch (err) {
    log('auth failed:', err?.message || err);
    return;
  }

  let body;
  try {
    body = JSON.parse((await req.text()) || '{}');
  } catch {
    body = null;
  }
  const jobId = body?.jobId;
  if (!isJobId(jobId)) {
    log(`invalid job id from user ${user.id}`);
    return;
  }

  const store = openJobStore(context, { getStore, getDeployStore });
  const key = jobKey(user.id, jobId);
  const startedAt = new Date().toISOString();
  // Fields every later record keeps; the slot fields are added once known.
  const base = { startedAt };
  const finish = async (record) => {
    try {
      await store.setJSON(key, { ...record, ...base, finishedAt: new Date().toISOString() });
    } catch (err) {
      log(`could not write the ${record.status} record for ${key}:`, err?.message || err);
    }
  };

  const { businessInfo, templateMeta, retryOf } = body;
  // Validate before the rate limit records a slot, so a bad request does not
  // use up one of the owner's daily generations.
  if (!hasRequiredBusinessInfo(businessInfo)) {
    try {
      await store.setJSON(key, { status: 'error', code: 'bad_request', httpStatus: 400, error: MESSAGES.missingInfo, startedAt }, { onlyIfNew: true });
    } catch (err) {
      log('could not record a bad request:', err?.message || err);
    }
    return;
  }

  // Claim the job id. Netlify can deliver a background invocation more than
  // once and the wizard re-sends the start after a network error with the
  // same id: only the invocation whose record was stored runs (and is
  // charged). A job whose record could not be stored does not run either:
  // its result could not be stored, and the wizard reports it as not started.
  const model = generationModel();
  const claim = randomUUID();
  try {
    const owned = await claimJob(store, key, { status: 'running', startedAt, model }, claim);
    if (!owned) {
      log(`job ${key} is not ours (already exists, or its record was not stored); not running it`);
      return;
    }
  } catch (err) {
    log(`could not create job ${key}:`, err?.message || err);
    return;
  }

  let path = 'primary';
  try {
    // Try again after a job that never got a billed answer runs on that
    // job's daily generation (claimFreeRetry); anything else uses a new one.
    const inheritedSlotAt = retryOf ? await claimFreeRetry(store, user.id, retryOf, jobId, claim) : null;
    if (inheritedSlotAt) {
      Object.assign(base, { slotAt: inheritedSlotAt, retryOf: String(retryOf).toLowerCase() });
      log(`job ${key} retries failed job ${retryOf} on its daily generation`);
    } else {
      const db = supabaseAdmin();
      const { limited } = await checkAndRecordRateLimit({ db, ip: user.id, ...RATE_LIMIT });
      if (limited || await overDailyLimit(db, user.id)) {
        if (!limited) log(`user ${user.id} passed the daily limit with parallel starts; ${key} not run`);
        await finish({ status: 'error', code: 'daily_limit', httpStatus: 429, error: MESSAGES.dailyLimit });
        return;
      }
      base.slotAt = startedAt;
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const t0 = Date.now();
    const deadline = AbortSignal.timeout(MODEL_DEADLINE_MS);
    const options = { signal: deadline, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES };
    const write = () => generateCopy(client, businessInfo, templateMeta, { model, ...options });
    const writePrimary = async () => {
      try {
        return await write();
      } catch (err) {
        if (!isStreamedBusyError(err, Anthropic) || MODEL_DEADLINE_MS - (Date.now() - t0) < STREAM_RETRY_MIN_LEFT_MS) throw err;
        log(`streamed ${err.type} for ${key}; trying once more`, { request_id: err.requestID });
        await pause(STREAM_RETRY_DELAY_MS);
        return write();
      }
    };

    let result;
    try {
      result = await writePrimary();
    } catch (err) {
      // The API turned the Opus request itself down (parameter, beta, model
      // access) or is still rate limiting it after the retries: either can
      // fail the same way on every Try again. Write the copy with the legacy
      // request instead, in this job and on its daily generation, while the
      // deadline leaves it room, and say so in the log and the record.
      const reason = legacyFallbackReason(err, Anthropic);
      if (!reason || MODEL_DEADLINE_MS - (Date.now() - t0) < LEGACY_MIN_LEFT_MS) throw err;
      path = 'legacy';
      base.primaryRejected = { reason, status: err.status ?? null, type: err.type ?? null, requestId: err.requestID ?? null };
      log(`the API ${reason === 'rejected' ? 'rejected' : 'rate limited'} the ${model} request for ${key}; writing it with the legacy request`, {
        ...base.primaryRejected,
        message: err.message,
      });
      result = await generateLegacyCopy(client, businessInfo, templateMeta, options);
    }
    const { copy, meta } = result;
    console.log(`[generate-website-background] wrote copy for "${businessInfo.businessName}" in ${Math.round((Date.now() - t0) / 1000)} s`, {
      path,
      model: meta.model,
      fallback: meta.fallback,
      ...meta.billed,
    });

    await attachWidgetKeys(copy, businessInfo);
    await finish({ status: 'done', copy, path, model: meta.model });
  } catch (err) {
    const failure = describeFailure(err, Anthropic);
    // Keep the raw API error (JSON, request ids) in the log, not on screen.
    log(`FAILED for "${businessInfo.businessName}" (${failure.code}):`, err?.message || err, {
      path,
      status: err?.status,
      type: err?.type,
      request_id: err?.requestID,
      category: err?.category,
      recommended_model: err?.recommendedModel,
      stop_reason: err?.meta?.stopReason,
      ...err?.meta?.billed,
    });
    await finish({ status: 'error', code: failure.code, httpStatus: failure.httpStatus, error: failure.message, path });
  }

  await pruneOldJobs(store, user.id, { keep: key });
}
