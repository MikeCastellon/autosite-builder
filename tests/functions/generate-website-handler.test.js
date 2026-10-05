// tests/functions/generate-website-handler.test.js
// The generate-website handler with Anthropic, auth and the rate limiter
// stubbed: what reaches the owner for each kind of model answer (audit ai-3),
// and that a bad request does not use up a daily generation (audit ai-4).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ message: null, created: [], options: [], rateLimitCalls: 0, limited: false }));

// Same shape as the SDK's class (a subclass of its connection error), which
// is what messages.create throws once the per-request timeout passes.
const sdk = vi.hoisted(() => {
  class APIConnectionError extends Error {}
  class APIConnectionTimeoutError extends APIConnectionError {
    constructor() { super('Request timed out.'); }
  }
  return { APIConnectionError, APIConnectionTimeoutError };
});

// The SDK is installed only under netlify/functions, so the bare specifier
// would not resolve from this folder; mock the file the handler really loads.
vi.mock('../../netlify/functions/node_modules/@anthropic-ai/sdk/index.mjs', () => ({
  default: class {
    static APIConnectionError = sdk.APIConnectionError;
    static APIConnectionTimeoutError = sdk.APIConnectionTimeoutError;
    constructor() {
      this.messages = {
        create: async (params, options) => {
          state.created.push(params);
          state.options.push(options);
          if (state.message instanceof Error) throw state.message;
          return state.message;
        },
      };
    }
  },
}));

vi.mock('../../netlify/functions/_shared/auth.js', () => ({
  requireUser: async () => ({ id: 'user-1' }),
  supabaseAdmin: () => ({}),
}));

// Only for the client's retry rule (isRetryableGenerationError); the real
// module throws at import without the Vite env.
vi.mock('../../src/lib/supabase.js', () => ({ supabase: {} }));

vi.mock('../../netlify/functions/_shared/rateLimit.js', () => ({
  checkAndRecordRateLimit: async () => {
    state.rateLimitCalls += 1;
    return { limited: state.limited };
  },
}));

// Belt and braces: even if the SDK mock stopped matching, no real key means
// no real (paid) API call from a test run.
vi.stubEnv('ANTHROPIC_API_KEY', '');
const { handler } = await import('../../netlify/functions/generate-website.js');
const { isRetryableGenerationError } = await import('../../src/lib/generateWebsite.js');

const businessInfo = {
  businessName: 'Shine Co',
  businessType: 'detailing_shop',
  city: 'Austin',
  state: 'TX',
  services: [{ name: 'Full Detail' }, { name: 'Ceramic Coating' }],
  reviewSource: 'testimonials',
};

const post = (body) => handler({
  httpMethod: 'POST',
  headers: { origin: 'http://localhost:5190' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const textMessage = (text, stop_reason = 'end_turn') => ({
  content: [{ type: 'text', text }],
  stop_reason,
  usage: { output_tokens: 10 },
});

beforeEach(() => {
  state.message = null;
  state.created = [];
  state.options = [];
  state.rateLimitCalls = 0;
  state.limited = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generate-website handler', () => {
  it('returns normalized copy: missing keys are filled, never invented reviews', async () => {
    state.message = textMessage('```json\n{"headline":"Austin Shine","servicesSection":null}\n```');
    const res = await post({ businessInfo, templateMeta: { label: 'Sporty' } });
    expect(res.statusCode).toBe(200);
    const { copy } = JSON.parse(res.body);
    expect(copy.headline).toBe('Austin Shine');
    expect(copy.servicesSection.items.map((i) => i.name)).toEqual(['Full Detail', 'Ceramic Coating']);
    expect(copy.testimonialPlaceholders).toEqual([]);
    expect(typeof copy.aboutText).toBe('string');
  });

  it('keeps the model id and asks for more output than the old 2500 cap', async () => {
    state.message = textMessage('{"headline":"Hi"}');
    await post({ businessInfo });
    expect(state.created[0].model).toBe('claude-sonnet-4-6');
    expect(state.created[0].max_tokens).toBeGreaterThan(2500);
  });

  it('ends the model call inside the 60 s function limit, in one attempt', async () => {
    state.message = textMessage('{"headline":"Hi"}');
    await post({ businessInfo });
    const { timeout, maxRetries } = state.options[0] || {};
    expect(maxRetries).toBe(0);
    // Room is left for the widget request (4 s) and the response itself.
    expect(timeout).toBeGreaterThan(45_000);
    expect(timeout).toBeLessThanOrEqual(60_000 - 6_000);
    // The cap must be writable within that deadline even at a fast
    // 80 tokens/s, or every long answer would time out instead of stopping.
    expect(state.created[0].max_tokens / 80).toBeLessThanOrEqual(timeout / 1000);
  });

  it('answers a final 422 (not retried by the client) when the model call times out', async () => {
    state.message = new sdk.APIConnectionTimeoutError();
    const res = await post({ businessInfo });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('timeout');
    expect(body.error).toMatch(/took too long/);
    expect(body.error).toMatch(/shorten the list/);
    expect(isRetryableGenerationError({ status: res.statusCode })).toBe(false);
  });

  it('caps the Google widget request after the model call, and still answers if it fails', async () => {
    state.message = textMessage('{"headline":"Hi"}');
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => {
      calls.push(init);
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    try {
      const res = await post({ businessInfo: { ...businessInfo, reviewSource: 'google', googlePlace: { placeId: 'p1' } } });
      expect(calls[0].signal).toBeInstanceOf(AbortSignal);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).copy.googleWidgetKey).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('still answers 500 (retried by the client) for a connection error that is not a timeout', async () => {
    state.message = new sdk.APIConnectionError('Connection error.');
    const res = await post({ businessInfo });
    expect(res.statusCode).toBe(500);
    expect(isRetryableGenerationError({ status: res.statusCode })).toBe(true);
  });

  it('reads the text block even when another block comes first', async () => {
    state.message = {
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"headline":"From text"}' }],
      stop_reason: 'end_turn',
    };
    const res = await post({ businessInfo });
    expect(JSON.parse(res.body).copy.headline).toBe('From text');
  });

  it('answers 422 when the output was cut off (not retried by the client)', async () => {
    state.message = textMessage('{"headline":"Hi","servicesSection":{"items":[{"name":"A', 'max_tokens');
    const res = await post({ businessInfo });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'too_long', error: expect.stringMatching(/services list is too long/) });
  });

  it('answers 502 for an answer that is not JSON', async () => {
    state.message = textMessage('Sorry, I cannot help with that.');
    const res = await post({ businessInfo });
    expect(res.statusCode).toBe(502);
  });

  it('answers 500 with a readable message when the API call fails', async () => {
    state.message = new Error('529 {"type":"error","error":{"type":"overloaded_error"}}');
    const res = await post({ businessInfo });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).not.toMatch(/overloaded_error/);
  });

  it('rejects a bad request before it counts against the daily limit', async () => {
    const missing = await post({ businessInfo: { businessName: 'Shine Co' } });
    expect(missing.statusCode).toBe(400);
    const broken = await post('{not json');
    expect(broken.statusCode).toBe(400);
    expect(state.rateLimitCalls).toBe(0);
    expect(state.created).toEqual([]);
  });

  it('answers 429 when the daily limit is reached, without calling the model', async () => {
    state.limited = true;
    const res = await post({ businessInfo });
    expect(res.statusCode).toBe(429);
    expect(state.created).toEqual([]);
  });
});
