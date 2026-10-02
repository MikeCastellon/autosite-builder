import { supabase } from './supabase.js';
import { normalizeCopy } from './normalizeCopy.js';

// The copy is written by a background job (generate-website-background):
// the model thinks before it writes, which can take longer than a
// synchronous function may run. generateWebsite() starts the job with an id
// it makes itself, then polls generate-website-status until the job is done,
// failed, or out of time.

// Errors carry the HTTP status (`err.status`) when the server answered, so
// the caller can tell a retryable failure (network, 5xx) from one that will
// fail the same way again (4xx, e.g. 429 = daily limit reached), and the
// job's `err.code` when it has one. `err.resumeJobId` is set when the job may
// still finish on the server (polling lost the connection): passing it back
// as the `jobId` option polls that job again instead of starting, and paying
// for, a new one.
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

async function startJob(jobId, businessInfo, templateMeta, signal) {
  const token = await accessToken();
  let response;
  try {
    response = await fetch(BACKGROUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobId, businessInfo, templateMeta }),
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
 * Starts the background job and resolves with normalized copy when it is
 * done. Rejects with an Error carrying `status` (and `code` from the job,
 * `resumeJobId` when the job may still finish); an AbortError when `signal`
 * aborts. With `jobId` it starts nothing and polls that job again.
 */
export async function generateWebsite(businessInfo, templateMeta, {
  signal,
  sleep = wait,
  now = Date.now,
  newJobId = () => crypto.randomUUID(),
  jobId: resumeJobId,
  pollIntervalMs = POLL_INTERVAL_MS,
  timeoutMs = JOB_TIMEOUT_MS,
  startGraceMs = START_GRACE_MS,
} = {}) {
  const jobId = resumeJobId || newJobId();

  // A lost start (network error, 5xx) is re-sent with the same job id: the
  // background function runs an id only once, so this never doubles a job.
  if (!resumeJobId) {
    await generateWithRetry(() => startJob(jobId, businessInfo, templateMeta, signal), {
      sleep: (ms) => sleep(ms, signal),
    });
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
    throw err;
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
      // Not written yet: the background function starts within seconds.
      if (now() - startedAt > startGraceMs) throw generationError(NOT_STARTED_MESSAGE, 502, 'not_started');
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
      throw generationError(data.error || 'Something went wrong generating your site. Please try again.', data.httpStatus || 500, data.code);
    }
    // 'running' past our deadline: the job has overrun its own model deadline
    // and missed its final write, so it is not coming back. Not resumable:
    // Try again starts a new job.
    if (now() - startedAt > timeoutMs) throw generationError(TIMEOUT_MESSAGE, 504, 'timeout');
  }
}
