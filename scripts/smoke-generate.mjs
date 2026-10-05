// scripts/smoke-generate.mjs
//
// Sends ONE real request to the Anthropic API for a small fixture business,
// built and read by the production code (netlify/functions/_lib/copyGeneration.js):
// the background job's request by default (buildRequest via generateCopy: same
// model, effort, adaptive thinking, output_config json_schema, beta header,
// fallbacks "default" and max_tokens), or with --legacy the legacy request
// (buildLegacyRequest via generateLegacyCopy, the one generate-website.js and
// the job's fallback send). It checks the answer against COPY_SCHEMA and
// normalizeCopy and prints the model, stop_reason, usage and an estimated cost.
// It shows whether the API accepts the request from this key before the
// owners' wizard depends on it.
//
// COSTS MONEY (one model call, a few cents; the upper bound is printed first),
// so it sends nothing without --yes-spend:
//
//   node scripts/smoke-generate.mjs                          # prints the request, sends nothing
//   node scripts/smoke-generate.mjs --yes-spend              # the background job's request
//   node scripts/smoke-generate.mjs --yes-spend --legacy     # the legacy request
//
// Reads ANTHROPIC_API_KEY (and AI_MODEL_GENERATE, as production does) from the
// environment or the repo's .env; the key is never printed. Needs the
// functions' dependencies (netlify/functions/node_modules), so run it in a
// mirror copy, never `npm install` in the repo. No retries: one request.
// Exit code: 0 the request was accepted and the answer is valid, 1 it was not,
// 2 nothing was sent.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildRequest,
  buildLegacyRequest,
  generateCopy,
  generateLegacyCopy,
  generationModel,
  describeFailure,
  legacyFallbackReason,
  COPY_SCHEMA,
  LEGACY_KEYS,
  MODEL_DEADLINE_MS,
} from '../netlify/functions/_lib/copyGeneration.js';
import { normalizeCopy } from '../src/lib/normalizeCopy.js';

const ENV_FILE = new URL('../.env', import.meta.url);
const SDK_URL = new URL('../netlify/functions/node_modules/@anthropic-ai/sdk/index.mjs', import.meta.url);
const ENV_KEYS = ['ANTHROPIC_API_KEY', 'AI_MODEL_GENERATE'];
const FLAGS = new Set(['--yes-spend', '--legacy']);

// Small on purpose (cheap), but with what the prompt has to handle: an owner
// description on one service, none on the other, a service area and a design
// whose hero buttons are not fixed.
export const FIXTURE_BUSINESS = {
  businessName: 'Lakeside Mobile Detailing',
  businessType: 'mobile_detailing',
  city: 'Austin',
  state: 'TX',
  serviceArea: 'Austin and Round Rock',
  services: [
    { name: 'Interior Detail', description: 'Vacuum, steam clean and wipe-down of the cabin.' },
    { name: 'Exterior Wash and Wax' },
  ],
  tagline: 'We come to you',
};
export const FIXTURE_TEMPLATE = { id: 'mobile_sudsy', label: 'Sudsy', mood: 'fun, friendly' };

// USD per million tokens (first-party API). Cache writes cost 1.25x input.
// Matched by the longest id prefix, so dated or suffixed ids still price.
const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 },
};

export function priceFor(model) {
  if (typeof model !== 'string') return null;
  const id = Object.keys(PRICES).sort((a, b) => b.length - a.length).find((key) => model === key || model.startsWith(`${key}-`));
  return id ? PRICES[id] : null;
}

const count = (value) => (Number.isFinite(value) ? value : 0);

/**
 * Estimated USD for a message's usage. After a refusal fallback the
 * top-level usage covers only the serving attempt; usage.iterations has every
 * attempt (each with its model), so those are summed when present.
 */
export function estimateCost(model, usage) {
  if (!usage || typeof usage !== 'object') return null;
  const entries = Array.isArray(usage.iterations) && usage.iterations.length > 0 ? usage.iterations : [usage];
  let total = 0;
  for (const entry of entries) {
    const price = priceFor(entry?.model || model);
    if (!price) return { total: null, unknownModel: entry?.model || model || null, attempts: entries.length };
    total += (count(entry.input_tokens) * price.input
      + count(entry.output_tokens) * price.output
      + count(entry.cache_read_input_tokens) * price.cacheRead
      + count(entry.cache_creation_input_tokens) * price.input * 1.25) / 1e6;
  }
  return { total, attempts: entries.length };
}

/** Where `value` breaks `schema` (the structured-outputs subset COPY_SCHEMA uses). */
export function schemaProblems(value, schema, path = '$') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path}: expected an object`];
    const problems = [];
    for (const key of schema.required || []) {
      if (!(key in value)) problems.push(`${path}.${key}: missing`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) problems.push(`${path}.${key}: not in the schema`);
      }
    }
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (key in value) problems.push(...schemaProblems(value[key], sub, `${path}.${key}`));
    }
    return problems;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${path}: expected an array`];
    return value.flatMap((item, i) => schemaProblems(item, schema.items, `${path}[${i}]`));
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${path}: expected a string`];
    if (schema.enum && !schema.enum.includes(value)) return [`${path}: "${value}" is not one of ${schema.enum.join(', ')}`];
  }
  return [];
}

// The legacy prompt asks for the 12 keys it always did (no ctaHeadline /
// ctaSubtext) and has no schema enforcement, so an extra key is only noted.
export function legacySchema() {
  return {
    type: 'object',
    additionalProperties: true,
    required: LEGACY_KEYS,
    properties: Object.fromEntries(LEGACY_KEYS.map((key) => [key, COPY_SCHEMA.properties[key]])),
  };
}

export function parseEnvFile(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || !ENV_KEYS.includes(match[1])) continue;
    let value = match[2];
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
    out[match[1]] = value;
  }
  return out;
}

function readEnvFile(url) {
  try {
    return parseEnvFile(readFileSync(url, 'utf8'));
  } catch {
    return {};
  }
}

async function loadClient({ apiKey }) {
  let mod;
  try {
    mod = await import(SDK_URL.href);
  } catch (err) {
    throw new Error(`Could not load the Anthropic SDK from netlify/functions/node_modules (${err.message}). Run this in a mirror copy with the functions' dependencies installed.`);
  }
  const Anthropic = mod.default;
  return { client: new Anthropic({ apiKey, maxRetries: 0 }), Anthropic };
}

const usd = (value) => (value == null ? 'unknown' : `$${value.toFixed(4)}`);

function describeRequest(request, legacy) {
  const user = request.messages?.[0]?.content || '';
  return [
    `Request (${legacy ? 'legacy: buildLegacyRequest, client.messages.create' : 'background job: buildRequest, client.beta.messages.stream'}):`,
    `  model:          ${request.model}`,
    `  max_tokens:     ${request.max_tokens}`,
    `  thinking:       ${request.thinking ? JSON.stringify(request.thinking) : 'none'}`,
    `  effort:         ${request.output_config?.effort || 'not set'}`,
    `  output format:  ${request.output_config?.format?.type || 'none (JSON shape in the prompt)'}`,
    `  betas:          ${request.betas ? request.betas.join(', ') : 'none'}`,
    `  fallbacks:      ${request.fallbacks ? JSON.stringify(request.fallbacks) : 'none'}`,
    `  prompt:         system ${request.system.length} chars, user ${user.length} chars`,
  ];
}

// A ceiling, not a forecast: about 3.5 characters per token for the prompt
// and schema, and every output token up to max_tokens.
function upperBound(request) {
  const price = priceFor(request.model);
  if (!price) return null;
  const chars = request.system.length + JSON.stringify(request.messages).length
    + (request.output_config?.format ? JSON.stringify(request.output_config.format).length : 0);
  return (Math.ceil(chars / 3.5) * price.input + request.max_tokens * price.output) / 1e6;
}

function usageLines(model, usage) {
  if (!usage) return ['  usage:          none reported'];
  const thinking = usage.output_tokens_details?.thinking_tokens;
  const cost = estimateCost(model, usage);
  return [
    `  usage:          input ${count(usage.input_tokens)}, output ${count(usage.output_tokens)}`
      + `${Number.isFinite(thinking) ? ` (thinking ${thinking})` : ''}`
      + `, cache read ${count(usage.cache_read_input_tokens)}, cache write ${count(usage.cache_creation_input_tokens)}`,
    `  attempts:       ${cost?.attempts ?? 1}${Array.isArray(usage.iterations) ? ` (${usage.iterations.map((e) => `${e.type}:${e.model || '?'}`).join(', ')})` : ''}`,
    `  estimated cost: ${cost?.total != null ? usd(cost.total) : `unknown (no price for ${cost?.unknownModel})`}`,
  ];
}

/**
 * Runs the smoke test. Returns the exit code. Everything it touches is
 * injectable, so the tests run it with a fake client and no key.
 */
export async function main(argv = process.argv.slice(2), {
  env = process.env,
  envFile = ENV_FILE,
  createClient = loadClient,
  log = console.log,
  now = Date.now,
} = {}) {
  const unknown = argv.filter((arg) => !FLAGS.has(arg));
  if (unknown.length > 0) {
    log(`Unknown argument(s): ${unknown.join(' ')}`);
    log('Usage: node scripts/smoke-generate.mjs [--legacy] [--yes-spend]');
    return 2;
  }
  const legacy = argv.includes('--legacy');

  const vars = readEnvFile(envFile);
  for (const key of ENV_KEYS) {
    if (typeof env?.[key] === 'string' && env[key].trim()) vars[key] = env[key];
  }
  const model = generationModel(vars);
  const request = legacy
    ? buildLegacyRequest(FIXTURE_BUSINESS, FIXTURE_TEMPLATE)
    : buildRequest(FIXTURE_BUSINESS, FIXTURE_TEMPLATE, { model });
  for (const line of describeRequest(request, legacy)) log(line);

  if (!argv.includes('--yes-spend')) {
    log('');
    log(`Not sent. Sending it is one paid request (at most about ${usd(upperBound(request))} for ${request.model}).`);
    log('Run again with --yes-spend to send it.');
    return 2;
  }

  const apiKey = vars.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log('ANTHROPIC_API_KEY is not set (environment or .env). Nothing sent.');
    return 1;
  }

  let client;
  let sdk = null;
  try {
    ({ client, Anthropic: sdk } = await createClient({ apiKey }));
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }

  log('');
  log('Sending one request...');
  const t0 = now();
  // One request: no SDK retries, and the job's own deadline.
  const options = { signal: AbortSignal.timeout(MODEL_DEADLINE_MS), maxRetries: 0 };
  let result;
  try {
    result = legacy
      ? await generateLegacyCopy(client, FIXTURE_BUSINESS, FIXTURE_TEMPLATE, options)
      : await generateCopy(client, FIXTURE_BUSINESS, FIXTURE_TEMPLATE, { model, ...options });
  } catch (err) {
    const seconds = Math.round((now() - t0) / 1000);
    if (err?.meta) {
      // The API answered, but not with usable copy (refusal, cut off, no JSON).
      log(`FAILED after ${seconds} s: ${err.code || 'error'}: ${err.message}`);
      log(`  model:          ${err.meta.model || 'unknown'} (requested ${err.meta.requestedModel})`);
      log(`  stop_reason:    ${err.meta.stopReason}`);
      if (err.category || err.recommendedModel) log(`  refusal:        category ${err.category ?? 'none'}, recommended_model ${err.recommendedModel ?? 'none'}`);
      for (const line of usageLines(err.meta.model, err.meta.usage)) log(line);
    } else {
      log(`FAILED after ${seconds} s: the API did not answer with a message.`);
      log(`  error:          ${err?.status ?? 'no status'} ${err?.type ?? ''} ${err?.message || err}`.trimEnd());
      if (err?.requestID) log(`  request id:     ${err.requestID}`);
    }
    const reason = sdk && !legacy ? legacyFallbackReason(err, sdk) : null;
    if (reason === 'rejected') {
      log('  in production:  the job writes the copy with the legacy request instead (check that one with --legacy)');
    } else if (reason === 'rate_limited') {
      // This run sends one attempt; production retries twice first.
      log('  in production:  the SDK retries twice; if the rate limit holds, the job writes the copy with the legacy request (check that one with --legacy)');
    } else if (sdk) {
      const failure = describeFailure(err, sdk);
      log(`  in production:  the job records ${failure.code} (${failure.httpStatus})`);
    }
    return 1;
  }

  const { copy, raw, meta } = result;
  log(`Accepted in ${Math.round((now() - t0) / 1000)} s.`);
  log(`  model:          ${meta.model || 'unknown'} (requested ${meta.requestedModel})`);
  log(`  stop_reason:    ${meta.stopReason}`);
  log(`  refusal fallback served it: ${meta.fallback ? 'yes' : 'no'}`);
  for (const line of usageLines(meta.model, meta.usage)) log(line);

  const problems = schemaProblems(raw, legacy ? legacySchema() : COPY_SCHEMA);
  if (problems.length > 0) {
    log(`Schema: ${problems.length} problem(s)`);
    for (const problem of problems) log(`  - ${problem}`);
  } else {
    log(`Schema: OK (${legacy ? `the ${LEGACY_KEYS.length} legacy keys` : 'COPY_SCHEMA'})`);
  }
  if (legacy) {
    const extra = Object.keys(raw).filter((key) => !LEGACY_KEYS.includes(key));
    if (extra.length > 0) log(`  extra keys (kept): ${extra.join(', ')}`);
  }

  // normalizeCopy fills what an answer lacks; a schema-valid answer should
  // come through unchanged, apart from the two keys the legacy prompt omits.
  const normalized = normalizeCopy(raw, FIXTURE_BUSINESS);
  const filled = Object.keys(normalized).filter((key) => JSON.stringify(normalized[key]) !== JSON.stringify(raw[key]));
  log(`normalizeCopy:  ${filled.length > 0 ? `filled or changed ${filled.join(', ')}` : 'unchanged'}`);

  const names = (copy.servicesSection?.items || []).map((item) => item.name);
  const expected = FIXTURE_BUSINESS.services.map((s) => s.name);
  const sameServices = JSON.stringify(names) === JSON.stringify(expected);
  log(`Services:       ${sameServices ? 'as entered, in order' : `expected ${expected.join(' | ')}, got ${names.join(' | ')}`}`);

  log('');
  log(JSON.stringify(copy, null, 2));
  return problems.length > 0 ? 1 : 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  main().then((code) => { process.exitCode = code; });
}
