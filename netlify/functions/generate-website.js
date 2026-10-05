// LEGACY route, and the wizard's permanent fallback: keep it. The wizard
// starts generate-website-background (Claude Opus 5, thinking, up to 15
// minutes) and polls generate-website-status; when that route is unavailable
// (no answer, 404/5xx, a job that never appears, storage errors) the wizard
// calls this synchronous endpoint once instead (src/lib/generateWebsite.js,
// body.fallback names why). App bundles loaded before that deploy also still
// call it, with the same request and response contract. It shares the prompt,
// parsing and widget handling (_lib/copyGeneration.js) but keeps Sonnet 4.6
// without thinking, which reliably answers inside the synchronous limit.
import Anthropic from '@anthropic-ai/sdk';
import { requireUser, supabaseAdmin } from './_shared/auth.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { normalizeCopy, parseCopyMessage, CopyResponseError } from '../../src/lib/normalizeCopy.js';
import {
  buildLegacyRequest,
  hasRequiredBusinessInfo,
  overDailyLimit,
  attachWidgetKeys,
  RATE_LIMIT,
  MESSAGES,
} from './_lib/copyGeneration.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Netlify ends a synchronous function after 60 s and answers with its own
// 5xx, which the wizard retries: one click would then use up to 3 daily
// generations and 3 billed calls, and the owner never learns why. So the
// model call gets a deadline inside that limit and a timeout becomes our own
// final answer (TOO_SLOW below).
const FUNCTION_LIMIT_MS = 60_000;
// The Google reviews widget request after the model call is capped too.
const WIDGET_TIMEOUT_MS = 4_000;
// Kept free after the model call: the widget request plus building and
// sending the response.
const AFTER_MODEL_MS = WIDGET_TIMEOUT_MS + 2_000;

// Both are final (4xx, the client does not retry): the same list is too long
// for one request next time as well.
const TOO_LONG = { code: 'too_long', error: MESSAGES.tooLong };
const TOO_SLOW = {
  code: 'timeout',
  error: 'Writing your website copy took too long. Please try again. If you listed many services, shorten the list or combine similar ones first.',
};

export const handler = async (event) => {
  const startedAt = Date.now();
  const cors = corsHeaders(event.headers);
  const json = jsonHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: json, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth gate (Security Audit H4): this calls Anthropic with a paid API
  // key. An unauthenticated endpoint is a free Claude proxy. Bind every
  // generation to a signed-in user.
  let user;
  try {
    user = await requireUser(event);
  } catch (err) {
    return { statusCode: err.status || 500, headers: json, body: JSON.stringify({ error: err.message }) };
  }

  // Validate before the rate limit records a slot, so a bad request does not
  // use up one of the owner's daily generations.
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  const { businessInfo, templateMeta } = body || {};
  // The wizard landed here because the background route failed: log it, so a
  // broken background route shows up in the function logs.
  if (body?.fallback) console.log(`[generate-website] wizard fallback (${String(body.fallback).slice(0, 40)}) for ${user.id}`);
  if (!hasRequiredBusinessInfo(businessInfo)) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: MESSAGES.missingInfo }) };
  }

  // Per-user daily cap, shared with the background route. Keep generous to
  // not get in the way of legit wizard re-runs while making batch abuse
  // uneconomical.
  const db = supabaseAdmin();
  const { limited } = await checkAndRecordRateLimit({
    db,
    ip: user.id,            // bucket by user id, not IP
    ...RATE_LIMIT,
  });
  // The recount stops parallel requests that all counted under the limit.
  if (limited || await overDailyLimit(db, user.id)) {
    return { statusCode: 429, headers: json, body: JSON.stringify({ error: MESSAGES.dailyLimit }) };
  }

  try {
    // One attempt that must end before Netlify's limit. The SDK's defaults
    // (10 min, 2 retries) would outlive the function; a transient API error
    // still comes back as a 5xx that the client retries with backoff.
    const modelTimeoutMs = Math.max(1_000, FUNCTION_LIMIT_MS - AFTER_MODEL_MS - (Date.now() - startedAt));
    let message;
    try {
      message = await client.messages.create(
        buildLegacyRequest(businessInfo, templateMeta),
        { timeout: modelTimeoutMs, maxRetries: 0 },
      );
    } catch (err) {
      if (!(err instanceof Anthropic.APIConnectionTimeoutError)) throw err;
      console.error(`[generate-website] model call passed ${modelTimeoutMs} ms for "${businessInfo.businessName}"`,
        { services: Array.isArray(businessInfo.services) ? businessInfo.services.length : null });
      return { statusCode: 422, headers: json, body: JSON.stringify(TOO_SLOW) };
    }

    // Text blocks by type (not content[0]), truncation refused, then every
    // key the templates and editor read is guaranteed (audit ai-3).
    let parsed;
    try {
      parsed = normalizeCopy(parseCopyMessage(message), businessInfo);
    } catch (err) {
      if (!(err instanceof CopyResponseError)) throw err;
      console.error(`[generate-website] unusable response for "${businessInfo.businessName}": ${err.code}`,
        { stop_reason: message?.stop_reason, output_tokens: message?.usage?.output_tokens });
      // Truncation repeats for the same input, so it is a 422 (the client does
      // not retry 4xx); anything else may work on a second try.
      return err.code === 'max_tokens'
        ? { statusCode: 422, headers: json, body: JSON.stringify(TOO_LONG) }
        : { statusCode: 502, headers: json, body: JSON.stringify({ error: MESSAGES.incomplete }) };
    }

    // Google reviews widget key (capped inside AFTER_MODEL_MS) and the
    // Instagram key from the form.
    await attachWidgetKeys(parsed, businessInfo, { timeoutMs: WIDGET_TIMEOUT_MS });

    return {
      statusCode: 200,
      headers: json,
      body: JSON.stringify({ success: true, copy: parsed }),
    };
  } catch (error) {
    console.error(`[generate-website] FAILED for "${businessInfo.businessName}":`, error?.message || error);
    // The owner sees this after the client's last retry: keep the raw API
    // error (JSON, request ids) in the log, not on screen.
    return {
      statusCode: 500,
      headers: json,
      body: JSON.stringify({ error: MESSAGES.generic }),
    };
  }
};
