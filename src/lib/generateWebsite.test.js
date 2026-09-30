import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const session = vi.hoisted(() => ({ token: 'tok' }));
vi.mock('./supabase.js', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }),
    },
  },
}));

const {
  generateWebsite,
  generateWithRetry,
  isRetryableGenerationError,
  generationErrorMessage,
  DAILY_LIMIT_MESSAGE,
  RETRY_DELAYS_MS,
  MAX_GENERATION_ATTEMPTS,
} = await import('./generateWebsite.js');

const biz = { businessName: 'Shine Co', businessType: 'detailing_shop', city: 'Austin', state: 'TX', services: ['Full Detail'] };

function respond(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (typeof body === 'string') throw new SyntaxError('not json');
      return body;
    },
  });
}

describe('generateWebsite', () => {
  beforeEach(() => { session.token = 'tok'; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns normalized copy, so a partial answer cannot crash the editor', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, copy: { headline: 'Hi', servicesSection: null } }));
    const copy = await generateWebsite(biz, {});
    expect(copy.headline).toBe('Hi');
    expect(copy.servicesSection.items).toEqual([{ name: 'Full Detail', description: '' }]);
    expect(copy.testimonialPlaceholders).toEqual([]);
  });

  it('puts the HTTP status on errors and keeps the server message', async () => {
    vi.stubGlobal('fetch', respond(429, { error: 'Daily generation limit reached. Try again in 24h.' }));
    await expect(generateWebsite(biz, {})).rejects.toMatchObject({ status: 429, message: 'Daily generation limit reached. Try again in 24h.' });

    vi.stubGlobal('fetch', respond(422, { error: 'Your services list is too long' }));
    await expect(generateWebsite(biz, {})).rejects.toMatchObject({ status: 422 });

    vi.stubGlobal('fetch', respond(502, '<html>Bad gateway</html>'));
    await expect(generateWebsite(biz, {})).rejects.toMatchObject({ status: 502 });

    // A 200 that is not JSON (e.g. the SPA page instead of the function) is
    // a broken gateway, so it stays retryable.
    vi.stubGlobal('fetch', respond(200, '<!doctype html>'));
    await expect(generateWebsite(biz, {})).rejects.toMatchObject({ status: 502 });
  });

  it('has no status for a network failure and 401 when signed out', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    const err = await generateWebsite(biz, {}).catch((e) => e);
    expect(err.status).toBeUndefined();
    expect(err.message).toMatch(/Network error/);

    session.token = null;
    await expect(generateWebsite(biz, {})).rejects.toMatchObject({ status: 401 });
  });
});

describe('retry policy', () => {
  it('retries network errors and 5xx only', () => {
    expect(isRetryableGenerationError(new Error('Network error'))).toBe(true);
    expect(isRetryableGenerationError(Object.assign(new Error('x'), { status: 500 }))).toBe(true);
    expect(isRetryableGenerationError(Object.assign(new Error('x'), { status: 502 }))).toBe(true);
    for (const status of [400, 401, 422, 429]) {
      expect(isRetryableGenerationError(Object.assign(new Error('x'), { status }))).toBe(false);
    }
  });

  it('shows the daily-limit message for 429 and the server message otherwise', () => {
    expect(generationErrorMessage(Object.assign(new Error('raw'), { status: 429 }))).toBe(DAILY_LIMIT_MESSAGE);
    expect(generationErrorMessage(Object.assign(new Error('Missing required business info'), { status: 400 })))
      .toBe('Missing required business info');
    expect(generationErrorMessage(null)).toMatch(/Something went wrong/);
  });
});

describe('generateWithRetry', () => {
  const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

  function harness(outcomes) {
    const calls = [];
    const slept = [];
    const retries = [];
    const failures = [];
    const attemptFn = async (attempt) => {
      calls.push(attempt);
      const next = outcomes[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    };
    const opts = {
      sleep: async (ms) => { slept.push(ms); },
      onRetry: (n) => retries.push(n),
      onFailure: (n, err) => failures.push([n, err.status]),
    };
    return { calls, slept, retries, failures, run: () => generateWithRetry(attemptFn, opts) };
  }

  it('allows 3 attempts with growing waits between them', () => {
    expect(MAX_GENERATION_ATTEMPTS).toBe(3);
    expect(RETRY_DELAYS_MS[1]).toBeGreaterThan(RETRY_DELAYS_MS[0]);
  });

  it('returns the first success without waiting', async () => {
    const h = harness(['copy']);
    await expect(h.run()).resolves.toBe('copy');
    expect(h.calls).toEqual([1]);
    expect(h.slept).toEqual([]);
  });

  it('does not retry a 429 (daily limit) or any other 4xx', async () => {
    for (const status of [400, 401, 422, 429]) {
      const h = harness([httpError(status), 'copy']);
      await expect(h.run()).rejects.toMatchObject({ status });
      expect(h.calls).toEqual([1]);
      expect(h.slept).toEqual([]);
      expect(h.failures).toEqual([[1, status]]);
    }
  });

  it('retries network errors and 5xx with backoff, then succeeds', async () => {
    const h = harness([new Error('Network error'), httpError(503), 'copy']);
    await expect(h.run()).resolves.toBe('copy');
    expect(h.calls).toEqual([1, 2, 3]);
    expect(h.slept).toEqual(RETRY_DELAYS_MS);
    expect(h.retries).toEqual([2, 3]);
  });

  it('stops after the last attempt and rethrows its error', async () => {
    const last = httpError(500);
    const h = harness([httpError(502), httpError(504), last, 'never']);
    await expect(h.run()).rejects.toBe(last);
    expect(h.calls).toEqual([1, 2, 3]);
    expect(h.failures.map(([n]) => n)).toEqual([1, 2, 3]);
  });

  it('stops retrying when a later attempt hits a 4xx', async () => {
    const h = harness([httpError(500), httpError(429), 'never']);
    await expect(h.run()).rejects.toMatchObject({ status: 429 });
    expect(h.calls).toEqual([1, 2]);
    expect(h.slept).toEqual([RETRY_DELAYS_MS[0]]);
  });
});
