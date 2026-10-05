import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';

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
  isStartUnavailable,
  generationErrorMessage,
  DAILY_LIMIT_MESSAGE,
  TIMEOUT_MESSAGE,
  NOT_STARTED_MESSAGE,
  RETRY_DELAYS_MS,
  MAX_GENERATION_ATTEMPTS,
  POLL_INTERVAL_MS,
  JOB_TIMEOUT_MS,
  START_GRACE_MS,
  MAX_POLL_FAILURES,
} = await import('./generateWebsite.js');

const biz = { businessName: 'Shine Co', businessType: 'detailing_shop', city: 'Austin', state: 'TX', services: ['Full Detail'] };
const JOB = '3b241101-e2bb-4255-8caf-4136c566a962';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (typeof body === 'string' || body === undefined) throw new SyntaxError('not json');
    return body;
  },
});

// A fake server: `start` answers the POST, `polls` answer the GETs in order
// (the last one repeats), `legacy` answers the synchronous route. Each entry
// is a reply or an Error to throw. A legacy call nobody set up fails like a
// network error and is counted, so a test can assert it never happened.
function server({ start = [reply(202)], polls = [], legacy = [new TypeError('legacy route not expected')] } = {}) {
  const calls = { start: [], poll: [], legacy: [] };
  vi.stubGlobal('fetch', async (url, init = {}) => {
    if (url === '/.netlify/functions/generate-website-background') {
      calls.start.push({ init, body: JSON.parse(init.body) });
      const next = start[Math.min(calls.start.length - 1, start.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    }
    if (url.startsWith('/.netlify/functions/generate-website-status?')) {
      calls.poll.push({ url, init });
      const next = polls[Math.min(calls.poll.length - 1, polls.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    }
    if (url === '/.netlify/functions/generate-website') {
      calls.legacy.push({ init, body: JSON.parse(init.body) });
      const next = legacy[Math.min(calls.legacy.length - 1, legacy.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  return calls;
}

const legacyCopy = reply(200, { success: true, copy: { headline: 'From the legacy route', servicesSection: null } });

// A clock that moves only when the code sleeps.
function clock() {
  let t = 0;
  const slept = [];
  return {
    slept,
    now: () => t,
    sleep: async (ms, signal) => {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      slept.push(ms);
      t += ms;
    },
  };
}

const run = (c, extra = {}) => generateWebsite(biz, { label: 'Sporty' }, { sleep: c.sleep, now: c.now, newJobId: () => JOB, ...extra });

describe('generateWebsite (background job + polling)', () => {
  beforeEach(() => {
    session.token = 'tok';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts the job with its own id and token, polls every 2 s, and returns normalized copy', async () => {
    const calls = server({
      polls: [
        reply(404, { error: 'Job not found' }),
        reply(200, { status: 'running' }),
        reply(200, { status: 'done', copy: { headline: 'Hi', servicesSection: null } }),
      ],
    });
    const c = clock();
    const copy = await run(c);
    expect(calls.start).toHaveLength(1);
    expect(calls.start[0].init.method).toBe('POST');
    expect(calls.start[0].init.headers.Authorization).toBe('Bearer tok');
    expect(calls.start[0].body).toEqual({ jobId: JOB, businessInfo: biz, templateMeta: { label: 'Sporty' } });
    expect(calls.poll.map((p) => p.url)).toEqual(Array(3).fill(`/.netlify/functions/generate-website-status?jobId=${JOB}`));
    expect(calls.poll[0].init.headers.Authorization).toBe('Bearer tok');
    expect(c.slept).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
    expect(POLL_INTERVAL_MS).toBe(2000);
    expect(copy.headline).toBe('Hi');
    expect(copy.servicesSection.items).toEqual([{ name: 'Full Detail', description: '' }]);
    expect(copy.testimonialPlaceholders).toEqual([]);
    expect(calls.legacy).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('makes a fresh UUID per job by default', async () => {
    const calls = server({ polls: [reply(200, { status: 'done', copy: { headline: 'Hi' } })] });
    const c = clock();
    await generateWebsite(biz, {}, { sleep: c.sleep, now: c.now });
    await generateWebsite(biz, {}, { sleep: c.sleep, now: c.now });
    const [a, b] = calls.start.map((s) => s.body.jobId);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it('turns a failed job into an error with its status and code (4xx: no retry)', async () => {
    const calls = server({ polls: [reply(200, { status: 'error', code: 'too_long', httpStatus: 422, error: 'Your services list is too long' })] });
    const err = await run(clock()).catch((e) => e);
    expect(err).toMatchObject({ status: 422, code: 'too_long', message: 'Your services list is too long' });
    expect(isRetryableGenerationError(err)).toBe(false);
    // The job's own answer: the legacy route is not tried.
    expect(calls.legacy).toHaveLength(0);

    server({ polls: [reply(200, { status: 'error', code: 'daily_limit', httpStatus: 429, error: 'Daily generation limit reached. Try again in 24h.' })] });
    const limited = await run(clock()).catch((e) => e);
    expect(limited.status).toBe(429);
    expect(generationErrorMessage(limited)).toBe(DAILY_LIMIT_MESSAGE);

    const busy = server({ polls: [reply(200, { status: 'error', code: 'busy', httpStatus: 503, error: 'Busy' })] });
    expect(isRetryableGenerationError(await run(clock()).catch((e) => e))).toBe(true);
    expect(busy.legacy).toHaveLength(0);
  });

  it('names the failed job, so Try again can send it as retryOf', async () => {
    for (const code of ['config', 'busy', 'too_long']) {
      server({ polls: [reply(200, { status: 'error', code, httpStatus: 500, error: 'x' })] });
      expect(await run(clock()).catch((e) => e)).toMatchObject({ code, failedJobId: JOB });
    }
    // Not for a job that is still running (timeout) or lost (resumable).
    server({ polls: [reply(200, { status: 'running' })] });
    expect((await run(clock()).catch((e) => e)).failedJobId).toBeUndefined();
  });

  it('sends retryOf with the start, and nothing when there is none', async () => {
    const calls = server({ polls: [reply(200, { status: 'done', copy: { headline: 'Hi' } })] });
    const failed = '9b241101-e2bb-4255-8caf-4136c566a962';
    await run(clock(), { retryOf: failed });
    expect(calls.start[0].body).toEqual({ jobId: JOB, businessInfo: biz, templateMeta: { label: 'Sporty' }, retryOf: failed });
    await run(clock());
    expect(calls.start[1].body).not.toHaveProperty('retryOf');
  });

  it('gives up after the timeout with a retryable error (a new job: this one is past its own deadline)', async () => {
    const calls = server({ polls: [reply(200, { status: 'running' })] });
    const c = clock();
    const err = await run(c).catch((e) => e);
    expect(err).toMatchObject({ status: 504, code: 'timeout', message: TIMEOUT_MESSAGE });
    expect(err.resumeJobId).toBeUndefined();
    expect(isRetryableGenerationError(err)).toBe(true);
    expect(c.now()).toBeGreaterThan(JOB_TIMEOUT_MS);
    expect(c.now()).toBeLessThanOrEqual(JOB_TIMEOUT_MS + POLL_INTERVAL_MS);
    // The last poll happens after the deadline passed, then it gives up.
    expect(calls.poll.length).toBe(Math.floor(JOB_TIMEOUT_MS / POLL_INTERVAL_MS) + 1);
    expect(JOB_TIMEOUT_MS).toBeGreaterThanOrEqual(4 * 60 * 1000);
  });

  it('reads a job that finished while the tab was asleep past the deadline', async () => {
    const calls = server({ polls: [reply(200, { status: 'done', copy: { headline: 'Hi' } })] });
    const c = clock();
    // The browser froze the tab: the first wait ends 5 minutes later.
    const sleep = async (ms, signal) => c.sleep(c.slept.length === 0 ? JOB_TIMEOUT_MS + 30_000 : ms, signal);
    const copy = await run({ ...c, sleep });
    expect(copy.headline).toBe('Hi');
    expect(calls.poll).toHaveLength(1);
  });

  it('after waking past the deadline, gives up only once the job says it is still running', async () => {
    const calls = server({ polls: [reply(200, { status: 'running' })] });
    const c = clock();
    const sleep = async (ms, signal) => c.sleep(c.slept.length === 0 ? JOB_TIMEOUT_MS + 30_000 : ms, signal);
    const err = await run({ ...c, sleep }).catch((e) => e);
    expect(err).toMatchObject({ status: 504, code: 'timeout' });
    expect(calls.poll).toHaveLength(1);
  });

  it('stops waiting for a job that never appears, and writes the copy with the legacy route', async () => {
    const calls = server({ polls: [reply(404, { error: 'Job not found' })], legacy: [legacyCopy] });
    const c = clock();
    const copy = await run(c);
    expect(c.now()).toBeGreaterThan(START_GRACE_MS);
    expect(c.now()).toBeLessThan(START_GRACE_MS + 2 * POLL_INTERVAL_MS);
    expect(calls.poll.length).toBeLessThan(20);
    expect(calls.legacy).toHaveLength(1);
    expect(calls.legacy[0].body.fallback).toBe('not_started');
    expect(copy.headline).toBe('From the legacy route');
    expect(copy.servicesSection.items).toEqual([{ name: 'Full Detail', description: '' }]);
    expect(console.warn.mock.calls[0][1]).toMatchObject({ reason: 'not_started' });
  });

  it('reports the legacy route\'s error when it fails too (a job that never appeared is not resumable)', async () => {
    server({ polls: [reply(404, { error: 'Job not found' })], legacy: [reply(500, { error: "We couldn't write your website copy right now." })] });
    const err = await run(clock()).catch((e) => e);
    expect(err).toMatchObject({ status: 500, message: "We couldn't write your website copy right now." });
    expect(err.resumeJobId).toBeUndefined();
    expect(isRetryableGenerationError(err)).toBe(true);
    expect(NOT_STARTED_MESSAGE).toMatch(/couldn't start/);
  });

  it('does not retry a 4xx when starting, and shows the server message', async () => {
    const calls = server({ start: [reply(400, { error: 'Missing required business info' }), reply(202)] });
    const err = await run(clock()).catch((e) => e);
    expect(err).toMatchObject({ status: 400, message: 'Missing required business info' });
    expect(calls.start).toHaveLength(1);
    expect(calls.poll).toHaveLength(0);
    expect(calls.legacy).toHaveLength(0);
  });

  it('uses the legacy route once when the background function is not there (404)', async () => {
    const calls = server({ start: [reply(404, '<html>Not found</html>')], legacy: [legacyCopy] });
    const c = clock();
    const copy = await run(c);
    expect(copy.headline).toBe('From the legacy route');
    expect(calls.start).toHaveLength(1);
    expect(calls.poll).toHaveLength(0);
    expect(calls.legacy).toHaveLength(1);
    expect(calls.legacy[0].init.method).toBe('POST');
    expect(calls.legacy[0].init.headers.Authorization).toBe('Bearer tok');
    // `fallback` tells the server why (an app bundle loaded before the
    // background route existed sends none).
    expect(calls.legacy[0].body).toEqual({ businessInfo: biz, templateMeta: { label: 'Sporty' }, fallback: '404' });
    expect(c.slept).toEqual([]);
  });

  it('uses the legacy route after every start attempt failed with a 5xx or no answer', async () => {
    for (const start of [[reply(502, '<html>'), reply(503, { error: 'x' }), reply(500, '<html>')], [new TypeError('Failed to fetch')]]) {
      const calls = server({ start, legacy: [legacyCopy] });
      const c = clock();
      expect((await run(c)).headline).toBe('From the legacy route');
      expect(calls.start).toHaveLength(3);
      expect(c.slept).toEqual(RETRY_DELAYS_MS);
      expect(calls.legacy).toHaveLength(1);
    }
  });

  it('never uses the legacy route for the owner\'s own errors when starting', async () => {
    for (const status of [400, 401, 403, 413, 429]) {
      const calls = server({ start: [reply(status, { error: `Error ${status}` })], legacy: [legacyCopy] });
      await expect(run(clock())).rejects.toMatchObject({ status });
      expect(calls.legacy).toHaveLength(0);
    }
    session.token = null;
    const calls = server({ legacy: [legacyCopy] });
    await expect(run(clock())).rejects.toMatchObject({ status: 401 });
    expect(calls.legacy).toHaveLength(0);
  });

  it('passes on the legacy route\'s final answers (daily limit, too long) and calls it only once', async () => {
    let calls = server({ start: [reply(404, {})], legacy: [reply(429, { error: 'Daily generation limit reached. Try again in 24h.' }), legacyCopy] });
    const limited = await run(clock()).catch((e) => e);
    expect(limited.status).toBe(429);
    expect(generationErrorMessage(limited)).toBe(DAILY_LIMIT_MESSAGE);
    expect(calls.legacy).toHaveLength(1);

    calls = server({ start: [reply(404, {})], legacy: [reply(422, { code: 'too_long', error: 'Your services list is too long' }), legacyCopy] });
    const tooLong = await run(clock()).catch((e) => e);
    expect(tooLong).toMatchObject({ status: 422, code: 'too_long' });
    expect(isRetryableGenerationError(tooLong)).toBe(false);
    expect(calls.legacy).toHaveLength(1);

    // Netlify's own timeout page: status only, worth a Try again.
    calls = server({ start: [reply(404, {})], legacy: [reply(502, '<html>Gateway Timeout</html>'), legacyCopy] });
    const gateway = await run(clock()).catch((e) => e);
    expect(gateway.status).toBe(502);
    expect(isRetryableGenerationError(gateway)).toBe(true);
    expect(calls.legacy).toHaveLength(1);

    server({ start: [reply(404, {})], legacy: [reply(200, { success: true })] });
    expect(await run(clock()).catch((e) => e)).toMatchObject({ status: 502 });
  });

  it('stops when aborted during the legacy route', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', async (url, init = {}) => {
      if (url === '/.netlify/functions/generate-website-background') return reply(404, {});
      controller.abort();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    await expect(run(clock(), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('re-sends a lost start with the same job id (the server runs an id once)', async () => {
    const calls = server({
      start: [new TypeError('Failed to fetch'), reply(502, '<html>'), reply(202)],
      polls: [reply(200, { status: 'done', copy: { headline: 'Hi' } })],
    });
    const c = clock();
    const copy = await run(c);
    expect(copy.headline).toBe('Hi');
    expect(calls.start.map((s) => s.body.jobId)).toEqual([JOB, JOB, JOB]);
    expect(c.slept.slice(0, 2)).toEqual(RETRY_DELAYS_MS);
  });

  it('does not retry a 4xx from the status endpoint', async () => {
    const calls = server({ polls: [reply(401, { error: 'Session expired. Please sign out and sign in again.' }), reply(200, { status: 'done', copy: {} })] });
    const err = await run(clock()).catch((e) => e);
    expect(err).toMatchObject({ status: 401, message: 'Session expired. Please sign out and sign in again.' });
    expect(calls.poll).toHaveLength(1);
  });

  it('keeps polling through brief network and 5xx failures', async () => {
    const calls = server({
      polls: [
        new TypeError('Failed to fetch'),
        reply(503, { error: 'Could not read the job status.' }),
        reply(502, '<html>Bad gateway</html>'),
        reply(200, { status: 'done', copy: { headline: 'Hi' } }),
      ],
    });
    expect((await run(clock())).headline).toBe('Hi');
    expect(calls.poll).toHaveLength(4);
  });

  it('after repeated polling failures, tries the legacy route; if that fails too, names the job so it can be polled again', async () => {
    const calls = server({ polls: [new TypeError('Failed to fetch')], legacy: [new TypeError('Failed to fetch')] });
    const err = await run(clock()).catch((e) => e);
    expect(err.status).toBeUndefined();
    expect(err.message).toMatch(/Network error/);
    expect(err.resumeJobId).toBe(JOB);
    expect(isRetryableGenerationError(err)).toBe(true);
    expect(calls.poll).toHaveLength(MAX_POLL_FAILURES);
    expect(calls.legacy).toHaveLength(1);

    const down = server({ polls: [reply(503, { error: 'down', code: 'storage_unavailable' })], legacy: [reply(500, { error: 'Model failed' })] });
    expect((await run(clock()).catch((e) => e)).resumeJobId).toBe(JOB);
    expect(down.legacy).toHaveLength(1);
  });

  it('keeps the resumable job when the legacy route answers with its own 4xx after polling failures', async () => {
    // The job already used a daily generation and may still finish: the
    // legacy route's own daily limit, its smaller cap (too_long) or its 54 s
    // (timeout) say nothing about it, so Try again must poll that job.
    for (const answer of [
      reply(422, { code: 'too_long', error: 'Your services list is too long' }),
      reply(429, { error: 'Daily generation limit reached. Try again in 24h.' }),
      reply(422, { code: 'timeout', error: 'Writing your website copy took too long.' }),
      reply(400, { error: 'Missing required business info' }),
    ]) {
      const calls = server({ polls: [reply(200, { status: 'running' }), new TypeError('Failed to fetch')], legacy: [answer] });
      const err = await run(clock()).catch((e) => e);
      expect(calls.legacy).toHaveLength(1);
      expect(err.resumeJobId).toBe(JOB);
      expect(err.message).toMatch(/Network error/);
      expect(isRetryableGenerationError(err)).toBe(true);
      expect(generationErrorMessage(err)).not.toBe(DAILY_LIMIT_MESSAGE);
    }
  });

  it('shows the legacy route\'s sign-in error after polling failures (polling would fail the same way)', async () => {
    server({ polls: [new TypeError('Failed to fetch')], legacy: [reply(401, { error: 'Not signed in. Please sign in again.' })] });
    const err = await run(clock()).catch((e) => e);
    expect(err).toMatchObject({ status: 401, message: 'Not signed in. Please sign in again.' });
    expect(err.resumeJobId).toBeUndefined();
  });

  it('says why it fell back: the job error code, the status, or network', async () => {
    let calls = server({ polls: [new TypeError('Failed to fetch')], legacy: [legacyCopy] });
    await run(clock());
    expect(calls.legacy[0].body.fallback).toBe('network');
    calls = server({ polls: [reply(503, { error: 'down', code: 'storage_unavailable' })], legacy: [legacyCopy] });
    await run(clock());
    expect(calls.legacy[0].body.fallback).toBe('502');
    calls = server({ start: [new TypeError('Failed to fetch')], legacy: [legacyCopy] });
    await run(clock());
    expect(calls.legacy[0].body.fallback).toBe('network');
  });

  it('falls back to a function that exists in the repo (generate-website must stay)', async () => {
    // server() answers only /.netlify/functions/generate-website as the
    // legacy route, so this call proves the URL the wizard falls back to.
    const calls = server({ start: [reply(404, {})], legacy: [legacyCopy] });
    await run(clock());
    expect(calls.legacy).toHaveLength(1);
    expect(existsSync(new URL('../../netlify/functions/generate-website.js', import.meta.url))).toBe(true);
  });

  it('writes the copy with the legacy route when job storage stays unreadable', async () => {
    const calls = server({ polls: [reply(503, { error: 'Could not read the job status. Please try again.', code: 'storage_unavailable' })], legacy: [legacyCopy] });
    const copy = await run(clock());
    expect(copy.headline).toBe('From the legacy route');
    expect(calls.poll).toHaveLength(MAX_POLL_FAILURES);
    expect(calls.legacy).toHaveLength(1);
  });

  it('does the same for a job it was asked to poll again', async () => {
    const other = '9b241101-e2bb-4255-8caf-4136c566a962';
    const calls = server({ polls: [reply(503, { error: 'down', code: 'storage_unavailable' })], legacy: [legacyCopy] });
    expect((await run(clock(), { jobId: other })).headline).toBe('From the legacy route');
    expect(calls.start).toHaveLength(0);
    expect(calls.legacy).toHaveLength(1);
  });

  it('polls a given job again without starting (or paying for) a new one', async () => {
    const calls = server({ polls: [reply(200, { status: 'running' }), reply(200, { status: 'done', copy: { headline: 'Hi' } })] });
    const other = '9b241101-e2bb-4255-8caf-4136c566a962';
    const copy = await run(clock(), { jobId: other });
    expect(copy.headline).toBe('Hi');
    expect(calls.start).toHaveLength(0);
    expect(calls.poll.map((p) => p.url)).toEqual(Array(2).fill(`/.netlify/functions/generate-website-status?jobId=${other}`));
  });

  it('does not use the legacy route for a 4xx from the status endpoint', async () => {
    const calls = server({ polls: [reply(401, { error: 'Session expired.' })], legacy: [legacyCopy] });
    await expect(run(clock())).rejects.toMatchObject({ status: 401 });
    expect(calls.legacy).toHaveLength(0);
  });

  it('is 401 when signed out, and stops when aborted', async () => {
    session.token = null;
    const calls = server();
    await expect(run(clock())).rejects.toMatchObject({ status: 401 });
    expect(calls.start).toHaveLength(0);

    session.token = 'tok';
    server({ polls: [reply(200, { status: 'running' })] });
    const controller = new AbortController();
    const c = clock();
    const pending = run({ ...c, sleep: async (ms, signal) => { await c.sleep(ms, signal); if (c.slept.length === 3) controller.abort(); } }, { signal: controller.signal });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a done record without copy', async () => {
    server({ polls: [reply(200, { status: 'done' })] });
    await expect(run(clock())).rejects.toMatchObject({ status: 502 });
  });
});

describe('retry policy', () => {
  it('treats only a missing, 404 or 5xx background route as unavailable when starting', () => {
    expect(isStartUnavailable(new Error('Network error'))).toBe(true);
    for (const status of [404, 500, 502, 503, 504]) expect(isStartUnavailable({ status })).toBe(true);
    for (const status of [400, 401, 403, 413, 422, 429]) expect(isStartUnavailable({ status })).toBe(false);
    expect(isStartUnavailable(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(false);
  });

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
