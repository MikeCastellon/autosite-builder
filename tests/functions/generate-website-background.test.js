// tests/functions/generate-website-background.test.js
// The background job with Anthropic, Blobs, auth and the rate limiter
// stubbed: who may start a job, what is recorded at each step, that one job
// id never runs (or is charged) twice, the switch to the legacy request when
// the API rejects or keeps rate limiting the Opus request, and the free Try
// again after a job that
// failed before a billed answer. No network, no real model call.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({
  message: null,
  queue: null,
  streams: [],
  legacy: null,
  creates: [],
  blobs: 'normal',
  recount: 1,
  records: new Map(),
  writes: [],
  stores: [],
  rateLimitCalls: 0,
  limited: false,
  onStream: null,
}));

// Same class hierarchy as the SDK, for describeFailure.
const sdk = vi.hoisted(() => {
  class APIError extends Error {
    constructor(status, message = `status ${status}`, type = null) { super(message); this.status = status; this.type = type; this.requestID = 'req_1'; }
  }
  class APIConnectionError extends APIError { constructor() { super(undefined, 'Connection error.'); } }
  class APIConnectionTimeoutError extends APIConnectionError {}
  class APIUserAbortError extends APIError { constructor() { super(undefined, 'Request was aborted.'); } }
  return { APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError };
});

// The SDK and Blobs are installed only under netlify/functions, so the bare
// specifiers would not resolve from this folder; mock the files the function
// really loads.
vi.mock('../../netlify/functions/node_modules/@anthropic-ai/sdk/index.mjs', () => ({
  default: class {
    static APIError = sdk.APIError;
    static APIConnectionError = sdk.APIConnectionError;
    static APIConnectionTimeoutError = sdk.APIConnectionTimeoutError;
    static APIUserAbortError = sdk.APIUserAbortError;
    constructor(opts) {
      this.opts = opts;
      this.beta = {
        messages: {
          stream: (params, options) => {
            state.streams.push({ params, options });
            state.onStream?.();
            const next = state.queue ? state.queue.shift() : state.message;
            return {
              finalMessage: async () => {
                if (next instanceof Error) throw next;
                return next;
              },
            };
          },
        },
      };
      // The legacy request (generateLegacyCopy) is not streamed.
      this.messages = {
        create: async (params, options) => {
          state.creates.push({ params, options });
          if (state.legacy instanceof Error) throw state.legacy;
          return state.legacy;
        },
      };
    }
  },
}));

function memoryStore(name) {
  return {
    name,
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew && state.records.has(key)) return { modified: false };
      // How @netlify/blobs 10 can misreport a conditional write: a 5xx after
      // its retries comes back as modified with nothing stored, and a write
      // whose answer was lost comes back from its retry as a 412.
      if (options.onlyIfNew && state.blobs === 'phantom') return { modified: true, etag: '' };
      if (options.onlyIfNew && state.blobs === 'lost-answer') {
        state.records.set(key, structuredClone(value));
        return { modified: false };
      }
      state.records.set(key, structuredClone(value));
      state.writes.push({ key, status: value.status, onlyIfNew: Boolean(options.onlyIfNew) });
      return { modified: true, etag: 'e' };
    },
    async get(key) {
      return state.records.has(key) ? structuredClone(state.records.get(key)) : null;
    },
    async list({ prefix }) {
      return { blobs: [...state.records.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
    async delete(key) { state.records.delete(key); },
  };
}

vi.mock('../../netlify/functions/node_modules/@netlify/blobs/dist/main.js', () => ({
  getStore: (opts) => { state.stores.push({ kind: 'site', opts }); return memoryStore('site'); },
  getDeployStore: (opts) => { state.stores.push({ kind: 'deploy', opts }); return memoryStore('deploy'); },
}));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  requireUser: async (event) => {
    const auth = event.headers.authorization || '';
    if (auth === 'Bearer tok-1') return { id: 'user-1' };
    if (auth === 'Bearer tok-2') return { id: 'user-2' };
    throw Object.assign(new Error('Not signed in. Please sign in again.'), { status: 401 });
  },
  // request_log as the daily-limit recount reads it: our own row is counted.
  supabaseAdmin: () => ({
    from: () => {
      const chain = { select: () => chain, eq: () => chain, gte: async () => ({ count: state.recount, error: null }) };
      return chain;
    },
  }),
}));

vi.mock('../../netlify/functions/_shared/rateLimit.js', () => ({
  checkAndRecordRateLimit: async (opts) => {
    state.rateLimitCalls += 1;
    state.rateLimitOpts = opts;
    return { limited: state.limited };
  },
}));

// Belt and braces: even if the SDK mock stopped matching, no real key means
// no real (paid) API call from a test run.
vi.stubEnv('ANTHROPIC_API_KEY', '');
const { default: handler } = await import('../../netlify/functions/generate-website-background.js');

const JOB = '3b241101-e2bb-4255-8caf-4136c566a962';
const KEY = `user-1/${JOB}`;
const businessInfo = {
  businessName: 'Shine Co',
  businessType: 'detailing_shop',
  city: 'Austin',
  state: 'TX',
  services: [{ name: 'Full Detail' }],
  reviewSource: 'testimonials',
};
const production = { deploy: { context: 'production' } };

function post(body, { token = 'tok-1', context = production, method = 'POST' } = {}) {
  const req = new Request('https://example.test/.netlify/functions/generate-website-background', {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  return handler(req, context);
}

const answer = (extra = {}) => ({
  model: 'claude-opus-5',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ headline: 'Austin Shine', ctaHeadline: 'Ready?', ...extra }) }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 1000, output_tokens: 2000 },
});
const legacyAnswer = () => ({
  model: 'claude-sonnet-4-6',
  content: [{ type: 'text', text: '{"headline":"Austin Shine (legacy)"}' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 900, output_tokens: 600 },
});

beforeEach(() => {
  state.message = answer();
  state.queue = null;
  state.legacy = legacyAnswer();
  state.creates = [];
  state.blobs = 'normal';
  state.recount = 1;
  state.streams = [];
  state.records = new Map();
  state.writes = [];
  state.stores = [];
  state.rateLimitCalls = 0;
  state.rateLimitOpts = null;
  state.limited = false;
  state.onStream = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Runs a request whose job pauses on a timer (the in-stream retry) to the end.
async function settle(promise) {
  let done = false;
  promise.finally(() => { done = true; });
  for (let i = 0; i < 60 && !done; i++) await vi.advanceTimersByTimeAsync(1000);
  return promise;
}

const streamedError = (type) => new sdk.APIError(undefined, `{"type":"error","error":{"type":"${type}"}}`, type);

describe('generate-website-background', () => {
  it('records running, then done with normalized copy', async () => {
    await post({ jobId: JOB, businessInfo, templateMeta: { label: 'Sporty', mood: 'bold' } });
    expect(state.writes.map((w) => [w.status, w.onlyIfNew])).toEqual([['running', true], ['done', false]]);
    const record = state.records.get(KEY);
    expect(record.status).toBe('done');
    // Which request wrote it, which model served it, which generation it used.
    expect(record).toMatchObject({ path: 'primary', model: 'claude-opus-5', slotAt: record.startedAt });
    expect(record).not.toHaveProperty('primaryRejected');
    expect(state.creates).toEqual([]);
    expect(record.copy.headline).toBe('Austin Shine');
    expect(record.copy.ctaHeadline).toBe('Ready?');
    expect(record.copy.servicesSection.items).toEqual([{ name: 'Full Detail', description: '' }]);
    expect(record.copy.testimonialPlaceholders).toEqual([]);
    expect(Date.parse(record.finishedAt)).toBeGreaterThanOrEqual(Date.parse(record.startedAt));
  });

  it('sends the Opus 5 request with a deadline and SDK retries', async () => {
    await post({ jobId: JOB, businessInfo, templateMeta: { label: 'Sporty' } });
    expect(state.streams).toHaveLength(1);
    const { params, options } = state.streams[0];
    expect(params).toMatchObject({
      model: 'claude-opus-5',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.maxRetries).toBe(2);
    expect(options.timeout).toBeGreaterThan(0);
  });

  it('uses AI_MODEL_GENERATE when set', async () => {
    vi.stubEnv('AI_MODEL_GENERATE', 'claude-opus-5-5');
    try {
      await post({ jobId: JOB, businessInfo });
      expect(state.streams[0].params.model).toBe('claude-opus-5-5');
      expect(state.records.get(KEY).status).toBe('done');
    } finally {
      vi.stubEnv('AI_MODEL_GENERATE', '');
    }
  });

  it('does nothing for a caller who is not signed in', async () => {
    await post({ jobId: JOB, businessInfo }, { token: null });
    await post({ jobId: JOB, businessInfo }, { token: 'expired' });
    expect(state.records.size).toBe(0);
    expect(state.rateLimitCalls).toBe(0);
    expect(state.streams).toEqual([]);
  });

  it('ignores a request without a valid job id (nothing it could be stored under)', async () => {
    await post({ jobId: '../user-2/x', businessInfo });
    await post({ businessInfo });
    await post('{not json');
    await post(undefined, { method: 'GET' });
    expect(state.records.size).toBe(0);
    expect(state.streams).toEqual([]);
  });

  it('records a bad request without using a daily generation', async () => {
    await post({ jobId: JOB, businessInfo: { businessName: 'Shine Co' } });
    expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'bad_request', httpStatus: 400 });
    expect(state.rateLimitCalls).toBe(0);
    expect(state.streams).toEqual([]);
  });

  it('records the daily limit (429) without calling the model', async () => {
    state.limited = true;
    await post({ jobId: JOB, businessInfo });
    expect(state.rateLimitOpts).toMatchObject({ ip: 'user-1', kind: 'generate-website', limit: 30 });
    expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'daily_limit', httpStatus: 429 });
    expect(state.streams).toEqual([]);
  });

  it('runs a job id once: a repeated delivery neither calls the model nor uses another generation', async () => {
    await post({ jobId: JOB, businessInfo });
    await post({ jobId: JOB, businessInfo });
    expect(state.streams).toHaveLength(1);
    expect(state.rateLimitCalls).toBe(1);
    expect(state.records.get(KEY).status).toBe('done');
  });

  it('keeps jobs of different users apart, even with the same id', async () => {
    await post({ jobId: JOB, businessInfo });
    await post({ jobId: JOB, businessInfo: { ...businessInfo, businessName: 'Other' } }, { token: 'tok-2' });
    expect(state.streams).toHaveLength(2);
    expect(state.records.get(KEY).status).toBe('done');
    expect(state.records.get(`user-2/${JOB}`).status).toBe('done');
  });

  it.each([
    ['a refusal', () => ({ content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' } }), { code: 'refusal', httpStatus: 422 }],
    ['an answer that is too long by itself', () => ({ ...answer({ aboutText: 'x'.repeat(40000) }), stop_reason: 'max_tokens' }), { code: 'too_long', httpStatus: 422 }],
    ['a cut-off after long thinking', () => ({ ...answer(), stop_reason: 'max_tokens', usage: { output_tokens: 16000, output_tokens_details: { thinking_tokens: 15000 } } }), { code: 'cut_off', httpStatus: 502 }],
    ['a refusal whose fallback model could not run', () => ({ content: [], stop_reason: 'refusal', stop_details: { category: null, recommended_model: 'claude-opus-4-8' } }), { code: 'fallback_busy', httpStatus: 503 }],
    ['an answer without text', () => ({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'end_turn' }), { code: 'incomplete', httpStatus: 502 }],
    ['an overloaded API', () => new sdk.APIError(529), { code: 'busy', httpStatus: 503 }],
    ['the deadline', () => new sdk.APIUserAbortError(), { code: 'timeout', httpStatus: 504 }],
    ['a bad API key', () => new sdk.APIError(401, '401 {"type":"authentication_error"}', 'authentication_error'), { code: 'config', httpStatus: 500 }],
  ])('records %s as an error the wizard can explain', async (_, make, expected) => {
    state.message = make();
    await post({ jobId: JOB, businessInfo });
    const record = state.records.get(KEY);
    expect(record).toMatchObject({ status: 'error', path: 'primary', ...expected });
    expect(record.error).toEqual(expect.any(String));
    expect(record.error).not.toMatch(/invalid_request_error|authentication_error|status \d/);
    expect(record).not.toHaveProperty('copy');
    // None of these is a rejected request: the legacy request is not sent.
    expect(state.creates).toEqual([]);
  });

  describe('when the API rejects the Opus request', () => {
    it.each([
      ['a 400 (parameter or beta header)', () => new sdk.APIError(400, '400 {"type":"invalid_request_error"}', 'invalid_request_error'), 400, 'invalid_request_error'],
      ['a 404 (model id)', () => new sdk.APIError(404, '404 {"type":"not_found_error"}', 'not_found_error'), 404, 'not_found_error'],
      ['a 403 (model or beta not allowed for this key)', () => new sdk.APIError(403, '403 {"type":"permission_error"}', 'permission_error'), 403, 'permission_error'],
      ['a 422', () => new sdk.APIError(422, '422 {"type":"invalid_request_error"}', 'invalid_request_error'), 422, 'invalid_request_error'],
      ['an invalid_request_error sent inside the stream', () => new sdk.APIError(undefined, '{"type":"invalid_request_error"}', 'invalid_request_error'), null, 'invalid_request_error'],
    ])('after %s, writes the copy with the legacy request in the same job and daily generation', async (_, make, status, type) => {
      state.message = make();
      await post({ jobId: JOB, businessInfo, templateMeta: { label: 'Sporty' } });
      expect(state.streams).toHaveLength(1);
      expect(state.creates).toHaveLength(1);
      const { params, options } = state.creates[0];
      expect(params).toMatchObject({ model: 'claude-sonnet-4-6', max_tokens: 4000 });
      for (const key of ['thinking', 'output_config', 'betas', 'fallbacks']) expect(params).not.toHaveProperty(key);
      // The job's own deadline and retry policy.
      expect(options.signal).toBe(state.streams[0].options.signal);
      expect(options).toMatchObject({ maxRetries: 2, timeout: state.streams[0].options.timeout });
      expect(state.rateLimitCalls).toBe(1);

      const record = state.records.get(KEY);
      expect(record).toMatchObject({ status: 'done', path: 'legacy', model: 'claude-sonnet-4-6', primaryRejected: { status, type, requestId: 'req_1' } });
      expect(record.copy.headline).toBe('Austin Shine (legacy)');
      expect(record.copy.servicesSection.items).toEqual([{ name: 'Full Detail', description: '' }]);
      const wrote = console.log.mock.calls.find((args) => String(args[0]).includes('wrote copy'));
      expect(wrote[1]).toMatchObject({ path: 'legacy', model: 'claude-sonnet-4-6', inputTokens: 900 });
      const switched = console.error.mock.calls.find((args) => String(args[1]).includes('rejected'));
      expect(switched.at(-1)).toMatchObject({ status, type });
    });

    it('records the legacy request\'s own failure, still on one daily generation', async () => {
      state.message = new sdk.APIError(400, '400 bad', 'invalid_request_error');
      state.legacy = new sdk.APIError(400, '400 bad too', 'invalid_request_error');
      await post({ jobId: JOB, businessInfo });
      expect(state.streams).toHaveLength(1);
      expect(state.creates).toHaveLength(1);
      expect(state.rateLimitCalls).toBe(1);
      expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'config', httpStatus: 500, path: 'legacy' });

      state.records.clear();
      state.legacy = new sdk.APIError(529, '529 overloaded', 'overloaded_error');
      await post({ jobId: JOB, businessInfo });
      expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'busy', httpStatus: 503, path: 'legacy' });

      state.records.clear();
      state.legacy = { content: [{ type: 'text', text: '{"headline":"x' }], stop_reason: 'max_tokens', usage: { output_tokens: 4000 } };
      await post({ jobId: JOB, businessInfo });
      expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'too_long', httpStatus: 422, path: 'legacy' });
    });

    it('does not use the legacy request for overloads, network errors, timeouts or answers it did not like', async () => {
      for (const make of [
        () => new sdk.APIError(529, 'overloaded', 'overloaded_error'),
        () => new sdk.APIError(500, 'api error', 'api_error'),
        () => new sdk.APIConnectionError(),
        () => new sdk.APIUserAbortError(),
        () => ({ content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' } }),
        () => ({ content: [{ type: 'text', text: 'Sorry.' }], stop_reason: 'end_turn' }),
      ]) {
        state.records.clear();
        state.message = make();
        await post({ jobId: JOB, businessInfo });
        expect(state.records.get(KEY).status).toBe('error');
      }
      expect(state.creates).toEqual([]);
    });
  });

  describe('when the API keeps rate limiting the Opus request', () => {
    // An organization output limit below the request's max_tokens answers
    // every Opus request with 429, so Try again could never succeed.
    it('after a 429 left by the SDK retries, writes the copy with the legacy request in the same job and daily generation', async () => {
      state.message = new sdk.APIError(429, '429 {"type":"rate_limit_error"}', 'rate_limit_error');
      await post({ jobId: JOB, businessInfo });
      expect(state.streams).toHaveLength(1);
      expect(state.creates).toHaveLength(1);
      expect(state.creates[0].params).toMatchObject({ model: 'claude-sonnet-4-6', max_tokens: 4000 });
      expect(state.creates[0].options.signal).toBe(state.streams[0].options.signal);
      expect(state.rateLimitCalls).toBe(1);
      const record = state.records.get(KEY);
      expect(record).toMatchObject({
        status: 'done',
        path: 'legacy',
        model: 'claude-sonnet-4-6',
        primaryRejected: { reason: 'rate_limited', status: 429, type: 'rate_limit_error', requestId: 'req_1' },
      });
      const switched = console.error.mock.calls.find((args) => String(args[1]).includes('rate limited the claude-opus-5 request'));
      expect(switched.at(-1)).toMatchObject({ reason: 'rate_limited', status: 429 });
    });

    it('after a rate_limit_error inside the stream outlasts the extra try, writes it with the legacy request', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      state.queue = [streamedError('overloaded_error'), streamedError('rate_limit_error')];
      await settle(post({ jobId: JOB, businessInfo }));
      expect(state.streams).toHaveLength(2);
      expect(state.creates).toHaveLength(1);
      expect(state.rateLimitCalls).toBe(1);
      expect(state.records.get(KEY)).toMatchObject({
        status: 'done',
        path: 'legacy',
        primaryRejected: { reason: 'rate_limited', status: null, type: 'rate_limit_error' },
      });
    });

    it('records busy (a free Try again) when the legacy request is rate limited too', async () => {
      state.message = new sdk.APIError(429, 'rate limited', 'rate_limit_error');
      state.legacy = new sdk.APIError(429, 'rate limited too', 'rate_limit_error');
      await post({ jobId: JOB, businessInfo });
      expect(state.creates).toHaveLength(1);
      expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'busy', httpStatus: 503, path: 'legacy' });
    });

    it('keeps the Opus error (busy) when too little of the deadline is left for the legacy request', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      state.message = new sdk.APIError(429, 'rate limited', 'rate_limit_error');
      // The SDK's retries used 190 s of the 240 s deadline.
      state.onStream = () => vi.setSystemTime(Date.now() + 190_000);
      await post({ jobId: JOB, businessInfo });
      expect(state.creates).toEqual([]);
      expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'busy', httpStatus: 503, path: 'primary' });
      expect(state.records.get(KEY)).not.toHaveProperty('primaryRejected');
    });
  });

  it('tries once more after an overload sent inside the stream, without another daily generation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    state.queue = [streamedError('overloaded_error'), answer()];
    await settle(post({ jobId: JOB, businessInfo }));
    expect(state.streams).toHaveLength(2);
    expect(state.rateLimitCalls).toBe(1);
    expect(state.records.get(KEY).status).toBe('done');
  });

  it('records a second in-stream overload as busy (retryable), with its type in the log', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    state.queue = [streamedError('overloaded_error'), streamedError('api_error')];
    await settle(post({ jobId: JOB, businessInfo }));
    expect(state.streams).toHaveLength(2);
    expect(state.creates).toEqual([]);
    expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'busy', httpStatus: 503 });
    const failed = console.error.mock.calls.find((args) => String(args[1]).startsWith('FAILED'));
    expect(failed.at(-1)).toMatchObject({ type: 'api_error', request_id: 'req_1' });
  });

  it('does not retry an error with a status (the SDK already did)', async () => {
    state.queue = [new sdk.APIError(529, 'overloaded', 'overloaded_error'), answer()];
    await post({ jobId: JOB, businessInfo });
    expect(state.streams).toHaveLength(1);
    expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'busy' });
  });

  it('logs the tokens of every attempt after a fallback', async () => {
    state.message = {
      ...answer(),
      model: 'claude-opus-4-8',
      usage: {
        input_tokens: 1300,
        output_tokens: 2000,
        iterations: [
          { type: 'message', model: 'claude-opus-5', input_tokens: 1200, output_tokens: 500 },
          { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 1300, output_tokens: 2000 },
        ],
      },
    };
    await post({ jobId: JOB, businessInfo });
    const wrote = console.log.mock.calls.find((args) => String(args[0]).includes('wrote copy'));
    expect(wrote[1]).toMatchObject({ model: 'claude-opus-4-8', fallback: true, attempts: 2, inputTokens: 2500, outputTokens: 2500 });
  });

  it('runs a job whose first write landed although Blobs reported it as existing (lost answer, retried)', async () => {
    state.blobs = 'lost-answer';
    await post({ jobId: JOB, businessInfo });
    expect(state.streams).toHaveLength(1);
    expect(state.records.get(KEY).status).toBe('done');
  });

  it('does not run (or charge) a job whose first record was not stored, though Blobs reported it written', async () => {
    state.blobs = 'phantom';
    await post({ jobId: JOB, businessInfo });
    expect(state.streams).toEqual([]);
    expect(state.rateLimitCalls).toBe(0);
    expect(state.records.has(KEY)).toBe(false);
  });

  it('stops parallel starts that all counted under the daily limit', async () => {
    state.recount = 31;
    await post({ jobId: JOB, businessInfo });
    expect(state.rateLimitCalls).toBe(1);
    expect(state.streams).toEqual([]);
    expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'daily_limit', httpStatus: 429 });
  });

  it('keeps the Google widget side effect and the Instagram key', async () => {
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => {
      calls.push({ url, init });
      return { json: async () => ({ widget_key: 'gw_1' }) };
    });
    await post({
      jobId: JOB,
      businessInfo: { ...businessInfo, reviewSource: 'google', googlePlace: { placeId: 'p1' }, instagramWidgetKey: 'ig_1' },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/widget-save$/);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(state.records.get(KEY).copy).toMatchObject({ googleWidgetKey: 'gw_1', reviewMode: 'google', instagramWidgetKey: 'ig_1' });
  });

  it('still finishes the job when the widget request fails', async () => {
    vi.stubGlobal('fetch', async () => { throw new DOMException('timeout', 'TimeoutError'); });
    await post({ jobId: JOB, businessInfo: { ...businessInfo, reviewSource: 'google', googlePlace: { placeId: 'p1' } } });
    expect(state.records.get(KEY).status).toBe('done');
    expect(state.records.get(KEY).copy.googleWidgetKey).toBeUndefined();
  });

  it('uses the strongly consistent site store in production and a deploy store in previews', async () => {
    await post({ jobId: JOB, businessInfo });
    expect(state.stores.at(-1)).toEqual({ kind: 'site', opts: { name: 'copy-jobs', consistency: 'strong' } });
    await post({ jobId: '9b241101-e2bb-4255-8caf-4136c566a962', businessInfo }, { context: { deploy: { context: 'deploy-preview' } } });
    expect(state.stores.at(-1)).toEqual({ kind: 'deploy', opts: { name: 'copy-jobs', consistency: 'strong' } });
  });

  it('deletes the user\'s own day-old records after a job', async () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    state.records.set('user-1/old', { status: 'done', finishedAt: old });
    state.records.set('user-2/old', { status: 'done', finishedAt: old });
    await post({ jobId: JOB, businessInfo });
    expect([...state.records.keys()].sort()).toEqual([KEY, 'user-2/old'].sort());
  });

  describe('Try again after a failed job (retryOf)', () => {
    const NEXT = '9b241101-e2bb-4255-8caf-4136c566a962';
    const THIRD = '7b241101-e2bb-4255-8caf-4136c566a962';

    it('runs on the failed job\'s daily generation when that job got no billed answer, once', async () => {
      state.message = new sdk.APIError(529, 'overloaded', 'overloaded_error');
      await post({ jobId: JOB, businessInfo });
      expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'busy' });
      expect(state.rateLimitCalls).toBe(1);

      state.message = answer();
      await post({ jobId: NEXT, businessInfo, retryOf: JOB });
      expect(state.rateLimitCalls).toBe(1);
      expect(state.records.get(`user-1/${NEXT}`)).toMatchObject({ status: 'done', retryOf: JOB, slotAt: state.records.get(KEY).slotAt });

      // The same failed job cannot be handed on twice.
      await post({ jobId: THIRD, businessInfo, retryOf: JOB });
      expect(state.rateLimitCalls).toBe(2);
      expect(state.records.get(`user-1/${THIRD}`)).toMatchObject({ status: 'done', slotAt: state.records.get(`user-1/${THIRD}`).startedAt });
      expect(state.records.get(`user-1/${THIRD}`)).not.toHaveProperty('retryOf');
    });

    it('keeps one generation through a chain of failures', async () => {
      state.message = new sdk.APIError(400, 'bad', 'invalid_request_error');
      state.legacy = new sdk.APIError(400, 'bad', 'invalid_request_error');
      await post({ jobId: JOB, businessInfo });
      await post({ jobId: NEXT, businessInfo, retryOf: JOB });
      state.message = answer();
      await post({ jobId: THIRD, businessInfo, retryOf: NEXT });
      expect(state.rateLimitCalls).toBe(1);
      expect(state.records.get(`user-1/${NEXT}`)).toMatchObject({ status: 'error', code: 'config', retryOf: JOB });
      expect(state.records.get(`user-1/${THIRD}`)).toMatchObject({ status: 'done', retryOf: NEXT, slotAt: state.records.get(KEY).slotAt });
    });

    it('uses a new daily generation after a failure that was paid for, or for someone else\'s job', async () => {
      state.message = { ...answer(), stop_reason: 'max_tokens', usage: { output_tokens: 16000, output_tokens_details: { thinking_tokens: 15000 } } };
      await post({ jobId: JOB, businessInfo });
      expect(state.records.get(KEY)).toMatchObject({ code: 'cut_off' });
      state.message = answer();
      await post({ jobId: NEXT, businessInfo, retryOf: JOB });
      expect(state.rateLimitCalls).toBe(2);

      // user-2 names user-1's failed job: read under user-2's own key, nothing there.
      state.records.set(KEY, { status: 'error', code: 'busy', startedAt: new Date().toISOString(), slotAt: new Date().toISOString() });
      await post({ jobId: THIRD, businessInfo, retryOf: JOB }, { token: 'tok-2' });
      expect(state.rateLimitCalls).toBe(3);
      expect(state.records.has(`user-1/${JOB}/retry`)).toBe(false);
    });

    it('still applies the daily limit to a retry it cannot hand on', async () => {
      state.limited = true;
      await post({ jobId: NEXT, businessInfo, retryOf: JOB });
      expect(state.records.get(`user-1/${NEXT}`)).toMatchObject({ status: 'error', code: 'daily_limit', httpStatus: 429 });
      expect(state.records.get(`user-1/${NEXT}`)).not.toHaveProperty('slotAt');
      expect(state.streams).toEqual([]);
    });
  });

  it('never throws, so Netlify has nothing to retry', async () => {
    state.message = new TypeError('unexpected');
    await expect(post({ jobId: JOB, businessInfo })).resolves.toBeUndefined();
    expect(state.records.get(KEY)).toMatchObject({ status: 'error', code: 'internal', httpStatus: 500 });
  });
});
