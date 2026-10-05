import { supabase } from './supabase.js';
import { normalizeCopy } from './normalizeCopy.js';

// The copy is written by a background job (generate-website-background):
// the model thinks before it writes, which can take longer than a
// synchronous function may run. generateWebsite() starts the job with an id
// it makes itself, then polls generate-website-status until the job is done,
// failed, or out of time.
//
// That route needs two functions and Netlify Blobs. When it is unavailable
// (the start gets no answer, a 404 or a 5xx; the job never appears; polling
// keeps failing), the copy is written once by the legacy synchronous route
// (generate-website, Sonnet 4.6, what production used before; that function
// must stay, whatever its own header says, and a test checks it is there),
// and the wizard never knows. Never for the owner's own errors (sign-in,
// missing details, daily limit) or the job's answers: those would fail there
// too.
// The legacy route records its own daily generation. A job that never
// appeared used none; a job whose status could not be read, or whose start
// answers were all lost, may have run anyway, and then that one try uses two.

// Errors carry the HTTP status (`err.status`) when the server answered, so
// the caller can tell a retryable failure (network, 5xx) from one that will
// fail the same way again (4xx, e.g. 429 = daily limit reached), and the
// job's `err.code` when it has one. `err.resumeJobId` is set when the job may
// still finish on the server (polling lost the connection): passing it back
// as the `jobId` option polls that job again instead of starting, and paying
// for, a new one. `err.failedJobId` is set when the job itself failed:
// passing it back as the `retryOf` option lets the server run the new job on
// the failed job's daily generation when that job never got a billed answer
// (claimFreeRetry in netlify/functions/_lib/copyGeneration.js).
function generationError(message, status, code) {
  const err = new Error(message);
  if (status) err.status = status;
  if (code) err.code = code;
  return err;
}

export const DAILY_LIMIT_MESSAGE =
  "You've reached today's limit for generating website copy. It resets within 24 hours, so please try again later.";
export const TIMEOUT_MESSAGE =
  'Writing your website copy is taking longer than expected. Please try again. If you listed many services, combining similar ones helps.';
export const NOT_STARTED_MESSAGE = "We couldn't start writing your website copy. Please try again.";
const NETWORK_MESSAGE = 'Network error — check your connection and try again.';

// Network errors (no status) and 5xx may work on a second try. A 4xx (bad
// input, daily limit, 422 = services list too long or copy declined) fails the
// same way again, and every job uses one of the owner's daily generations, so
// it is never retried.
export function isRetryableGenerationError(err) {
  const status = err?.status;
  return !status || status >= 500;
}

export function generationErrorMessage(err) {
  if (err?.status === 429) return DAILY_LIMIT_MESSAGE;
  return err?.message || 'Something went wrong generating your site. Please try again.';
}

// Waits before attempt 2 and attempt 3 (backoff), so at most 3 attempts.
export const RETRY_DELAYS_MS = [2000, 5000];
export const MAX_GENERATION_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

// Polling: every 2 s. The job's model call ends by 240 s on the server
// (MODEL_DEADLINE_MS), so the wizard waits longer than that, with room for
// the job's final write (Blobs retries a failed write for about 25 s), and
// normally reads the job's own timeout record. A job that never shows up
// (the start request was lost) is given up after START_GRACE_MS.
export const POLL_INTERVAL_MS = 2000;
export const JOB_TIMEOUT_MS = 300_000;
export const START_GRACE_MS = 30_000;
// Consecutive network or 5xx failures while polling before giving up.
export const MAX_POLL_FAILURES = 5;

const BACKGROUND_URL = '/.netlify/functions/generate-website-background';
const STATUS_URL = '/.netlify/functions/generate-website-status';
const LEGACY_URL = '/.netlify/functions/generate-website';

// Starting the job failed because the route is not there or not working (no
// answer, 404, 5xx), not because of the request (401, 400, 413, 429).
export function isStartUnavailable(err) {
  if (err?.name === 'AbortError') return false;
  const status = err?.status;
  return !status || status === 404 || status >= 500;
}

// Marks an error as "the background route is unavailable" for generateWebsite.
function unavailable(err) {
  err.routeUnavailable = true;
  return err;
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(abortError());
    return;
  }
  const timer = setTimeout(() => {
    signal?.removeEventListener?.('abort', onAbort);
    resolve();
  }, ms);
  function onAbort() {
    clearTimeout(timer);
    reject(abortError());
  }
  signal?.addEventListener?.('abort', onAbort, { once: true });
});

function abortError() {
  const err = new Error('Generation was cancelled.');
  err.name = 'AbortError';
  return err;
}

/**
 * Runs `attemptFn(attempt)` until it succeeds, retrying only errors that
 * isRetryableGenerationError accepts, with RETRY_DELAYS_MS between attempts.
 * `onFailure(attempt, err)` sees every failed attempt; `onRetry(nextAttempt)`
 * fires before each wait. The last error is rethrown unchanged.
 */
export async function generateWithRetry(attemptFn, { delays = RETRY_DELAYS_MS, sleep = wait, onFailure, onRetry } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptFn(attempt);
    } catch (err) {
      onFailure?.(attempt, err);
      if (attempt > delays.length || !isRetryableGenerationError(err)) throw err;
      onRetry?.(attempt + 1);
      await sleep(delays[attempt - 1]);
    }
  }
}

async function accessToken() {
  // Read per request: supabase-js refreshes an expiring session here.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw generationError('Sign in required to generate a website.', 401);
  return token;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function startJob(jobId, businessInfo, templateMeta, signal, retryOf) {
  const token = await accessToken();
  const body = { jobId, businessInfo, templateMeta };
  if (typeof retryOf === 'string' && retryOf) body.retryOf = retryOf;
  let response;
  try {
    response = await fetch(BACKGROUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (networkErr) {
    if (signal?.aborted) throw abortError();
    throw generationError(NETWORK_MESSAGE);
  }
  // Netlify answers a background function with 202 before it runs.
  if (!response.ok) {
    const data = await readJson(response);
    throw generationError(data?.error || `Generation failed (${response.status})`, response.status);
  }
}

/**
 * The legacy synchronous route: one request, one answer, the response
 * contract production used before the background job ({ success, copy } or
 * { error, code? } with the status). It records its own daily generation.
 * `fallback` says why the background route was given up (the error's code,
 * status or 'network'), so the server can tell a fallback from an app bundle
 * loaded before the background route existed; generate-website ignores
 * fields it does not read.
 */
async function writeWithLegacyRoute(businessInfo, templateMeta, signal, fallback) {
  const token = await accessToken();
  let response;
  try {
    response = await fetch(LEGACY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessInfo, templateMeta, fallback }),
      signal,
    });
  } catch {
    if (signal?.aborted) throw abortError();
    throw generationError(NETWORK_MESSAGE);
  }
  const data = await readJson(response);
  if (!response.ok) {
    // Netlify's own 502/504 pages are HTML: status only, still retryable.
    throw generationError(data?.error || `Generation failed (${response.status})`, response.status, data?.code);
  }
  if (!data?.copy || typeof data.copy !== 'object') {
    throw generationError('No copy returned from generator — please try again.', 502);
  }
  return normalizeCopy(data.copy, businessInfo);
}

/**
 * Starts the background job and resolves with normalized copy when it is
 * done; when the background route is unavailable, writes the copy once with
 * the legacy route instead. Rejects with an Error carrying `status` (and
 * `code` from the job, `resumeJobId` when the job may still finish,
 * `failedJobId` when the job failed); an AbortError when `signal` aborts.
 * With `jobId` it starts nothing and polls that job again; `retryOf` is the
 * `failedJobId` of the run this one retries.
 */
export async function generateWebsite(businessInfo, templateMeta, options = {}) {
  try {
    return await runBackgroundJob(businessInfo, templateMeta, options);
  } catch (cause) {
    if (!cause?.routeUnavailable || options.signal?.aborted) throw cause;
    const reason = String(cause.code || cause.status || 'network');
    console.warn('[generate-website] background route unavailable; writing the copy with the legacy route', {
      reason,
      error: cause.message,
    });
    try {
      return await writeWithLegacyRoute(businessInfo, templateMeta, options.signal, reason);
    } catch (err) {
      if (err?.name === 'AbortError' || options.signal?.aborted) throw abortError();
      // Neither route could write it. If the job may still finish (polling
      // lost it), its error (with resumeJobId) is the one to show: Try again
      // then reads that job, which already used a daily generation, instead
      // of paying for another. The legacy route's answer says nothing about
      // that job: its own daily limit, a list too long for its smaller cap
      // or its 54 s are not the job's. Only a sign-in error (401) stands, as
      // polling the job would fail the same way. Otherwise the legacy
      // route's answer stands (a daily limit or a too-long list is final).
      if (cause.resumeJobId && err?.status !== 401) throw cause;
      throw err;
    }
  }
}

async function runBackgroundJob(businessInfo, templateMeta, {
  signal,
  sleep = wait,
  now = Date.now,
  newJobId = () => crypto.randomUUID(),
  jobId: resumeJobId,
  retryOf,
  pollIntervalMs = POLL_INTERVAL_MS,
  timeoutMs = JOB_TIMEOUT_MS,
  startGraceMs = START_GRACE_MS,
} = {}) {
  const jobId = resumeJobId || newJobId();

  // A lost start (network error, 5xx) is re-sent with the same job id: the
  // background function runs an id only once, so this never doubles a job.
  if (!resumeJobId) {
    try {
      await generateWithRetry(() => startJob(jobId, businessInfo, templateMeta, signal, retryOf), {
        sleep: (ms) => sleep(ms, signal),
      });
    } catch (err) {
      throw isStartUnavailable(err) ? unavailable(err) : err;
    }
  }

  const startedAt = now();
  let failures = 0;
  // Losing the status endpoint says nothing about the job, which keeps
  // running on the server: the error carries its id so it can be polled again.
  const transient = (message) => {
    failures += 1;
    if (failures < MAX_POLL_FAILURES) return;
    const err = generationError(message || NETWORK_MESSAGE, message ? 502 : undefined);
    err.resumeJobId = jobId;
    throw unavailable(err);
  };

  // The deadline is checked only after the job has answered: a phone that
  // slept or a tab the browser froze past it still reads a job that finished
  // meanwhile, instead of reporting a timeout and starting a paid new one.
  for (;;) {
    await sleep(pollIntervalMs, signal);

    const token = await accessToken();
    let response;
    try {
      response = await fetch(`${STATUS_URL}?jobId=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal,
      });
    } catch {
      if (signal?.aborted) throw abortError();
      transient();
      continue;
    }

    if (response.status === 404) {
      // Not written yet: the background function starts within seconds. A
      // job that never shows up was not stored (Blobs) or never ran: it used
      // no daily generation, and the legacy route can still write the copy.
      if (now() - startedAt > startGraceMs) throw unavailable(generationError(NOT_STARTED_MESSAGE, 502, 'not_started'));
      continue;
    }
    const data = await readJson(response);
    if (response.status >= 500 || !data) {
      transient(`Server error (${response.status}) — please try again.`);
      continue;
    }
    if (!response.ok) {
      // 400/401/403: polling again fails the same way.
      throw generationError(data.error || `Generation failed (${response.status})`, response.status);
    }
    failures = 0;

    if (data.status === 'done') {
      if (!data.copy || typeof data.copy !== 'object') {
        throw generationError('No copy returned from generator — please try again.', 502);
      }
      // The job already normalizes; doing it here too keeps the editor safe
      // from an older deploy or a hand-edited record (audit ai-3).
      return normalizeCopy(data.copy, businessInfo);
    }
    if (data.status === 'error') {
      const err = generationError(data.error || 'Something went wrong generating your site. Please try again.', data.httpStatus || 500, data.code);
      err.failedJobId = jobId;
      throw err;
    }
    // 'running' past our deadline: the job has overrun its own model deadline
    // and missed its final write, so it is not coming back. Not resumable:
    // Try again starts a new job.
    if (now() - startedAt > timeoutMs) throw generationError(TIMEOUT_MESSAGE, 504, 'timeout');
  }
}
