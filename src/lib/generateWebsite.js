import { supabase } from './supabase.js';
import { normalizeCopy } from './normalizeCopy.js';

// Errors carry the HTTP status (`err.status`) when the server answered, so
// the caller can tell a retryable failure (network, 5xx) from one that will
// fail the same way again (4xx, e.g. 429 = daily limit reached).
function generationError(message, status) {
  const err = new Error(message);
  if (status) err.status = status;
  return err;
}

export const DAILY_LIMIT_MESSAGE =
  "You've reached today's limit for generating website copy. It resets within 24 hours, so please try again later.";

// Network errors (no status) and 5xx may work on a second try. A 4xx (bad
// input, daily limit, 422 = services list too long to write within the
// function's time limit) fails the same way again, and every attempt that
// reaches the function uses one of the owner's daily generations, so it is
// never retried.
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

export async function generateWebsite(businessInfo, templateMeta) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw generationError('Sign in required to generate a website.', 401);

  let response;
  try {
    response = await fetch('/.netlify/functions/generate-website', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ businessInfo, templateMeta }),
    });
  } catch (networkErr) {
    throw generationError('Network error — check your connection and try again.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON (e.g. Netlify timeout HTML, 502, etc.). A 200 that
    // is not JSON is a broken gateway too, so it counts as a retryable 502.
    throw generationError(`Server error (${response.status}) — please try again.`, response.ok ? 502 : response.status);
  }

  if (!response.ok) {
    throw generationError(data?.error || `Generation failed (${response.status})`, response.status);
  }

  if (!data?.copy) {
    throw generationError('No copy returned from generator — please try again.', 502);
  }

  // The function already normalizes; doing it here too keeps the editor safe
  // from an older deploy or a hand-edited response (audit ai-3).
  return normalizeCopy(data.copy, businessInfo);
}
