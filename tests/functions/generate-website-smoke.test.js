// tests/functions/generate-website-smoke.test.js
// scripts/smoke-generate.mjs with a fake client: it sends nothing without
// --yes-spend, sends exactly the production request (one, no retries) with
// it, and checks and prices the answer. No key, no network, no cost.
import { describe, it, expect, vi } from 'vitest';
import {
  main,
  estimateCost,
  schemaProblems,
  legacySchema,
  parseEnvFile,
  priceFor,
  FIXTURE_BUSINESS,
  FIXTURE_TEMPLATE,
} from '../../scripts/smoke-generate.mjs';
import {
  buildRequest,
  buildLegacyRequest,
  COPY_SCHEMA,
  LEGACY_KEYS,
} from '../../netlify/functions/_lib/copyGeneration.js';

// Same hierarchy as the SDK, for describeFailure / legacyFallbackReason.
class APIError extends Error {
  constructor(status, message, type = null) { super(message); this.status = status; this.type = type; this.requestID = 'req_smoke'; }
}
class APIConnectionError extends APIError { constructor() { super(undefined, 'Connection error.'); } }
class APIConnectionTimeoutError extends APIConnectionError {}
class APIUserAbortError extends APIError { constructor() { super(undefined, 'Request was aborted.'); } }
const Anthropic = { APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError };

// A schema-valid answer for the fixture.
const answer = {
  headline: 'Mobile Detailing Across Austin',
  subheadline: 'Lakeside Mobile Detailing brings interior details and wash and wax to your driveway in Austin, TX.',
  aboutText: 'Lakeside Mobile Detailing works across Austin and Round Rock.\n\nWe come to you.',
  servicesSection: {
    intro: 'Detailing at your home or office in Austin and Round Rock.',
    items: [
      { name: 'Interior Detail', description: 'A vacuum, steam clean and wipe-down of the cabin.' },
      { name: 'Exterior Wash and Wax', description: 'A hand wash of the paint followed by a coat of wax.' },
    ],
  },
  ctaPrimary: 'Book a Detail',
  ctaSecondary: 'See Services',
  ctaHeadline: 'Ready for a Cleaner Car?',
  ctaSubtext: 'Tell us where in Austin or Round Rock your car is parked and what it needs.',
  testimonialPlaceholders: [
    { text: 'They cleaned my car in my driveway in Austin.', name: 'Maria G.' },
    { text: 'The wax looks great.', name: 'Tom R.' },
    { text: 'Easy to book.', name: 'Ana P.' },
  ],
  metaTitle: 'Lakeside Mobile Detailing | Austin, TX',
  metaDescription: 'Lakeside Mobile Detailing offers interior details and wash and wax at your home or office in Austin and Round Rock, TX.',
  keywords: ['mobile detailing austin', 'interior detail austin'],
  footerTagline: 'Mobile detailing in Austin and Round Rock',
  schemaType: 'AutoWash',
};
const legacyAnswer = Object.fromEntries(LEGACY_KEYS.map((key) => [key, answer[key]]));

function fakeClient({ stream, create } = {}) {
  const calls = { stream: [], create: [] };
  const settle = (value) => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value));
  const client = {
    beta: {
      messages: {
        stream(params, options) {
          calls.stream.push({ params, options });
          return { finalMessage: () => settle(stream) };
        },
      },
    },
    messages: {
      create(params, options) {
        calls.create.push({ params, options });
        return settle(create);
      },
    },
  };
  return { client, calls };
}

// Runs main() with no .env, a fixed clock and every line captured.
async function runSmoke(argv, { env = { ANTHROPIC_API_KEY: 'sk-test-not-real' }, client, createClient } = {}) {
  const lines = [];
  const factory = createClient || vi.fn(async () => ({ client, Anthropic }));
  let t = 0;
  const code = await main(argv, {
    env,
    envFile: new URL('file:///nonexistent/smoke-test/.env'),
    createClient: factory,
    log: (line = '') => lines.push(String(line)),
    now: () => { t += 1500; return t; },
  });
  return { code, out: lines.join('\n'), createClient: factory };
}

describe('scripts/smoke-generate.mjs', () => {
  it('sends nothing without --yes-spend, and prints the production request and its cost ceiling', async () => {
    const { client, calls } = fakeClient();
    for (const argv of [[], ['--legacy']]) {
      const { code, out, createClient } = await runSmoke(argv, { client });
      expect(code).toBe(2);
      expect(createClient).not.toHaveBeenCalled();
      expect(out).toMatch(/Not sent\. Sending it is one paid request \(at most about \$0\.\d{4}/);
      expect(out).toMatch(/--yes-spend/);
    }
    expect(calls.stream).toEqual([]);
    expect(calls.create).toEqual([]);

    const { out } = await runSmoke([], { client, env: {} });
    expect(out).toContain('model:          claude-opus-5');
    expect(out).toContain('effort:         medium');
    expect(out).toContain('thinking:       {"type":"adaptive"}');
    expect(out).toContain('output format:  json_schema');
    expect(out).toContain('betas:          server-side-fallback-2026-07-01');
    expect(out).toContain('fallbacks:      "default"');
    expect(out).toContain('max_tokens:     16000');
    const { out: legacyOut } = await runSmoke(['--legacy'], { client, env: {} });
    expect(legacyOut).toContain('model:          claude-sonnet-4-6');
    expect(legacyOut).toContain('thinking:       none');
  });

  it('rejects unknown arguments without sending', async () => {
    const { code, out, createClient } = await runSmoke(['--yes-spend', '--yes']);
    expect(code).toBe(2);
    expect(out).toMatch(/Unknown argument/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('needs a key before it creates a client, and never prints the key', async () => {
    const { code, out, createClient } = await runSmoke(['--yes-spend'], { env: {} });
    expect(code).toBe(1);
    expect(out).toMatch(/ANTHROPIC_API_KEY is not set/);
    expect(createClient).not.toHaveBeenCalled();

    const { client } = fakeClient({ stream: { model: 'claude-opus-5', content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: {} } });
    const ok = await runSmoke(['--yes-spend'], { client });
    expect(ok.createClient).toHaveBeenCalledWith({ apiKey: 'sk-test-not-real' });
    expect(ok.out).not.toContain('sk-test-not-real');
  });

  it('sends exactly one production request (buildRequest, no retries) and checks the answer', async () => {
    const { client, calls } = fakeClient({
      stream: {
        model: 'claude-opus-5',
        content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(answer) }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 2000, output_tokens: 3000, output_tokens_details: { thinking_tokens: 1800 } },
      },
    });
    const { code, out } = await runSmoke(['--yes-spend'], { client, env: { ANTHROPIC_API_KEY: 'k', AI_MODEL_GENERATE: '' } });
    expect(code).toBe(0);
    expect(calls.stream).toHaveLength(1);
    expect(calls.create).toHaveLength(0);
    expect(calls.stream[0].params).toEqual(buildRequest(FIXTURE_BUSINESS, FIXTURE_TEMPLATE, { model: 'claude-opus-5' }));
    expect(calls.stream[0].options.maxRetries).toBe(0);
    expect(calls.stream[0].options.signal).toBeInstanceOf(AbortSignal);
    expect(out).toContain('model:          claude-opus-5 (requested claude-opus-5)');
    expect(out).toContain('stop_reason:    end_turn');
    expect(out).toContain('usage:          input 2000, output 3000 (thinking 1800)');
    // 2000 x $5 + 3000 x $25 per million.
    expect(out).toContain('estimated cost: $0.0850');
    expect(out).toContain('Schema: OK (COPY_SCHEMA)');
    expect(out).toContain('normalizeCopy:  unchanged');
    expect(out).toContain('Services:       as entered, in order');
    expect(out).toContain('"headline": "Mobile Detailing Across Austin"');
  });

  it('uses AI_MODEL_GENERATE like production', async () => {
    const { client, calls } = fakeClient({ stream: { model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 1000 } } });
    const { code, out } = await runSmoke(['--yes-spend'], { client, env: { ANTHROPIC_API_KEY: 'k', AI_MODEL_GENERATE: 'claude-opus-5-5' } });
    expect(code).toBe(0);
    expect(calls.stream[0].params.model).toBe('claude-opus-5-5');
    expect(out).toContain('estimated cost: $0.0240');
  });

  it('fails on an answer that breaks the schema, listing each problem', async () => {
    const broken = { ...answer, schemaType: 'CarShop', extra: 1 };
    delete broken.ctaSubtext;
    const { client } = fakeClient({ stream: { model: 'claude-opus-5', content: [{ type: 'text', text: JSON.stringify(broken) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } });
    const { code, out } = await runSmoke(['--yes-spend'], { client });
    expect(code).toBe(1);
    expect(out).toMatch(/Schema: 3 problem\(s\)/);
    expect(out).toContain('$.ctaSubtext: missing');
    expect(out).toContain('$.extra: not in the schema');
    expect(out).toMatch(/\$\.schemaType: "CarShop" is not one of/);
    expect(out).toMatch(/normalizeCopy:  filled or changed ctaSubtext/);
  });

  it('reports an API rejection with what production does about it, and exits 1', async () => {
    const { client } = fakeClient({ stream: new APIError(400, '400 fallbacks: not supported here', 'invalid_request_error') });
    const { code, out } = await runSmoke(['--yes-spend'], { client });
    expect(code).toBe(1);
    expect(out).toContain('error:          400 invalid_request_error 400 fallbacks: not supported here');
    expect(out).toContain('request id:     req_smoke');
    expect(out).toContain('in production:  the job writes the copy with the legacy request instead (check that one with --legacy)');
    expect(out).not.toContain('the job records');
  });

  it('reports a rate limit with what production does about it (retries, then the legacy request)', async () => {
    const { client } = fakeClient({ stream: new APIError(429, '429 would exceed the rate limit', 'rate_limit_error') });
    const { code, out } = await runSmoke(['--yes-spend'], { client });
    expect(code).toBe(1);
    expect(out).toContain('in production:  the SDK retries twice; if the rate limit holds, the job writes the copy with the legacy request (check that one with --legacy)');
    expect(out).not.toContain('the job records');
    // An overload is not switched: it passes, and production records busy.
    const overloaded = fakeClient({ stream: new APIError(529, '529 overloaded', 'overloaded_error') });
    const { out: busy } = await runSmoke(['--yes-spend'], { client: overloaded.client });
    expect(busy).toContain('in production:  the job records busy (503)');
  });

  it('reports a refusal with its usage and cost', async () => {
    const { client } = fakeClient({
      stream: {
        model: 'claude-opus-5',
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', recommended_model: null },
        usage: { input_tokens: 1500, output_tokens: 0 },
      },
    });
    const { code, out } = await runSmoke(['--yes-spend'], { client });
    expect(code).toBe(1);
    expect(out).toContain('FAILED after');
    expect(out).toContain('stop_reason:    refusal');
    expect(out).toContain('refusal:        category cyber');
    expect(out).toContain('estimated cost: $0.0075');
    expect(out).toContain('in production:  the job records refusal (422)');
  });

  it('with --legacy, sends the legacy request (one, not streamed) and checks the 12 legacy keys', async () => {
    const { client, calls } = fakeClient({
      create: { model: 'claude-sonnet-4-6', content: [{ type: 'text', text: JSON.stringify(legacyAnswer) }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 800 } },
    });
    const { code, out } = await runSmoke(['--yes-spend', '--legacy'], { client });
    expect(code).toBe(0);
    expect(calls.stream).toHaveLength(0);
    expect(calls.create).toHaveLength(1);
    expect(calls.create[0].params).toEqual(buildLegacyRequest(FIXTURE_BUSINESS, FIXTURE_TEMPLATE));
    expect(calls.create[0].options.maxRetries).toBe(0);
    expect(out).toContain('Schema: OK (the 12 legacy keys)');
    expect(out).toContain('normalizeCopy:  filled or changed ctaHeadline, ctaSubtext');
    // 1000 x $3 + 800 x $15 per million.
    expect(out).toContain('estimated cost: $0.0150');
    // A rejected legacy request has no further fallback.
    const rejected = fakeClient({ create: new APIError(404, '404 model', 'not_found_error') });
    const { out: failed } = await runSmoke(['--yes-spend', '--legacy'], { client: rejected.client });
    expect(failed).toContain('in production:  the job records config (500)');
    expect(failed).not.toContain('instead');
  });

  it('reports a client that cannot be created (SDK not installed) without sending', async () => {
    const createClient = vi.fn(async () => { throw new Error('Could not load the Anthropic SDK'); });
    const { code, out } = await runSmoke(['--yes-spend'], { createClient });
    expect(code).toBe(1);
    expect(out).toContain('Could not load the Anthropic SDK');
  });
});

describe('smoke helpers', () => {
  it('prices every attempt with its own model, and by id prefix', () => {
    expect(priceFor('claude-opus-5-5')).toMatchObject({ input: 4, output: 20 });
    expect(priceFor('claude-opus-5')).toMatchObject({ input: 5, output: 25 });
    expect(priceFor('claude-sonnet-4-6-20260101')).toMatchObject({ input: 3, output: 15 });
    expect(priceFor('claude-opus-50')).toBeNull();
    expect(priceFor(undefined)).toBeNull();
    const fallback = estimateCost('claude-opus-4-8', {
      input_tokens: 1300,
      output_tokens: 2000,
      iterations: [
        { type: 'message', model: 'claude-opus-5', input_tokens: 1000, output_tokens: 400 },
        { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 1300, output_tokens: 2000, cache_read_input_tokens: 1000 },
      ],
    });
    expect(fallback.attempts).toBe(2);
    expect(fallback.total).toBeCloseTo((1000 * 5 + 400 * 25 + 1300 * 5 + 2000 * 25 + 1000 * 0.5) / 1e6, 10);
    expect(estimateCost('claude-x', { input_tokens: 1 })).toMatchObject({ total: null, unknownModel: 'claude-x' });
    expect(estimateCost('claude-opus-5', null)).toBeNull();
  });

  it('checks the schema subset COPY_SCHEMA uses', () => {
    const valid = Object.fromEntries(Object.entries(COPY_SCHEMA.properties).map(([key, sub]) => [key, sub.type === 'string' ? (sub.enum ? sub.enum[0] : '') : sub.type === 'array' ? [] : { intro: '', items: [] }]));
    expect(schemaProblems(valid, COPY_SCHEMA)).toEqual([]);
    expect(schemaProblems({ ...valid, keywords: 'a, b' }, COPY_SCHEMA)).toEqual(['$.keywords: expected an array']);
    expect(schemaProblems({ ...valid, servicesSection: { intro: '', items: [{ name: 'A' }] } }, COPY_SCHEMA))
      .toEqual(['$.servicesSection.items[0].description: missing']);
    expect(schemaProblems([], COPY_SCHEMA)).toEqual(['$: expected an object']);
    const legacy = legacySchema();
    expect(legacy.required).toEqual(LEGACY_KEYS);
    expect(schemaProblems({ ...legacyAnswer, ctaHeadline: 'x' }, legacy)).toEqual([]);
    expect(schemaProblems(answer, COPY_SCHEMA)).toEqual([]);
  });

  it('reads only the key and the model from .env, quoted or not', () => {
    expect(parseEnvFile('ANTHROPIC_API_KEY="sk-1"\r\nexport AI_MODEL_GENERATE=claude-opus-5-5\nSTRIPE_SECRET_KEY=sk_live_x\n# ANTHROPIC_API_KEY=old'))
      .toEqual({ ANTHROPIC_API_KEY: 'sk-1', AI_MODEL_GENERATE: 'claude-opus-5-5' });
    expect(parseEnvFile(undefined)).toEqual({});
  });
});
