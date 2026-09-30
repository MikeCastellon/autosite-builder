import Anthropic from '@anthropic-ai/sdk';
import { requireUser, supabaseAdmin } from './_shared/auth.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { normalizeCopy, parseCopyMessage, CopyResponseError } from '../../src/lib/normalizeCopy.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Netlify ends a synchronous function after 60 s and answers with its own
// 5xx, which the wizard retries: one click would then use up to 3 daily
// generations and 3 billed calls, and the owner never learns why. So the
// model call gets a deadline inside that limit and a timeout becomes our own
// final answer (TOO_SLOW below). Long lists need the background function
// (audit §6); until then this is the most one request can write.
const FUNCTION_LIMIT_MS = 60_000;
// The Google reviews widget request after the model call is capped too.
const WIDGET_TIMEOUT_MS = 4_000;
// Kept free after the model call: the widget request plus building and
// sending the response.
const AFTER_MODEL_MS = WIDGET_TIMEOUT_MS + 2_000;

// What Sonnet can write inside that deadline (about 60-80 tokens/s, so
// 4000 tokens takes 50-65 s): a higher cap is never reached, the deadline
// ends the call first. At 2500 the JSON was cut off at about 20 services.
const MAX_TOKENS = 4000;

// Both are final (4xx, the client does not retry): the same list is too long
// for one request next time as well.
const TOO_LONG = {
  code: 'too_long',
  error: 'Your services list is too long to write in one go. Shorten it or combine similar services, then try again.',
};
const TOO_SLOW = {
  code: 'timeout',
  error: 'Writing your website copy took too long. Please try again. If you listed many services, shorten the list or combine similar ones first.',
};

const SYSTEM_PROMPT = `You are a professional copywriter specializing in automotive service businesses in the US.
Your job is to generate compelling, authentic website copy for car industry businesses.
You write in a voice and tone that matches the business type and template style provided.
Use the city name naturally throughout the copy for local SEO.
Always respond with valid JSON only — no markdown code fences, no prose outside the JSON object.`;

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
  if (!businessInfo?.businessName || !businessInfo?.city) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Missing required business info' }) };
  }

  // Per-user daily cap. Keep generous to not get in the way of legit
  // wizard re-runs while making batch abuse uneconomical.
  const { limited } = await checkAndRecordRateLimit({
    db: supabaseAdmin(),
    ip: user.id,            // bucket by user id, not IP
    kind: 'generate-website',
    windowMs: 24 * 60 * 60 * 1000,
    limit: 30,
  });
  if (limited) {
    return { statusCode: 429, headers: json, body: JSON.stringify({ error: 'Daily generation limit reached. Try again in 24h.' }) };
  }

  try {
    const servicesText = Array.isArray(businessInfo.services)
      ? businessInfo.services.map(s => (typeof s === 'object' ? s.name : s)).filter(Boolean).join(', ')
      : businessInfo.services || 'General auto services';

    const USER_PROMPT = `Generate website copy for this automotive business:

BUSINESS NAME: ${businessInfo.businessName}
BUSINESS TYPE: ${businessInfo.businessType}
CITY: ${businessInfo.city}
STATE: ${businessInfo.state}
PHONE: ${businessInfo.phone}
ADDRESS: ${businessInfo.address || 'Not provided'}
SERVICES: ${servicesText}
TAGLINE / VIBE: ${businessInfo.tagline || 'Not provided'}
YEARS IN BUSINESS: ${businessInfo.yearsInBusiness || 'Not provided'}
SPECIALTIES: ${businessInfo.specialties || 'Not provided'}
PRICE RANGE / STARTING PRICE: ${businessInfo.priceRange || 'Not provided'}
SERVICE AREA: ${businessInfo.serviceArea || businessInfo.city + ', ' + businessInfo.state}
BRANDS CARRIED: ${businessInfo.brands || businessInfo.filmBrands || 'Not provided'}
WARRANTY: ${businessInfo.warranty || 'Not provided'}
CERTIFICATIONS: ${businessInfo.certifications || 'Not provided'}

TEMPLATE STYLE: ${templateMeta?.label || 'Professional'}
MOOD / TONE: ${templateMeta?.mood || 'professional, trustworthy'}

CRITICAL INSTRUCTIONS:
- The H1 headline MUST include the city name (${businessInfo.city})
- Mention the city naturally 2-3 times in the about section
- The meta description MUST include city + business name + top service
- Footer tagline should reference serving ${businessInfo.city} and surrounding areas
- Make it sound authentic and specific to this actual business — not generic
- Use the business name naturally throughout
- NEVER invent or fabricate details not provided above (no made-up certifications, awards, years, brands, or claims)
- If a field says "Not provided", do not mention it at all in the copy

Return ONLY this JSON structure (no markdown, no explanation):
{
  "headline": "Main hero headline including ${businessInfo.city} (8-12 words, punchy, city-specific)",
  "subheadline": "Supporting hero tagline (10-15 words, highlights key value)",
  "aboutText": "Full about section — 2-3 short paragraphs separated by newlines (~180 words). Mention ${businessInfo.city} 2-3 times. Tell their story, build trust.",
  "servicesSection": {
    "intro": "1-2 sentences introducing services, referencing ${businessInfo.city} (20-30 words)",
    "items": [
      { "name": "Exact service name from their list", "description": "2-3 sentence description of this service (30-50 words)" }
    ]
  },
  "ctaPrimary": "Primary CTA button text (3-5 words, action-oriented)",
  "ctaSecondary": "Secondary CTA text (3-5 words)",
  "testimonialPlaceholders": [
    { "text": "Realistic-sounding customer testimonial mentioning the business (20-30 words)", "name": "First name + Last initial" },
    { "text": "Second testimonial (different angle — quality, speed, price, or friendliness)", "name": "First name + Last initial" },
    { "text": "Third testimonial", "name": "First name + Last initial" }
  ],
  "metaDescription": "SEO meta description: business name + city + top 2 services (140-160 chars exactly)",
  "metaTitle": "${businessInfo.businessName} | Auto Service in ${businessInfo.city}, ${businessInfo.state}",
  "keywords": ["${businessInfo.city} auto detailing", "${businessInfo.city} car care", "auto service ${businessInfo.city} ${businessInfo.state}"],
  "footerTagline": "Proudly serving ${businessInfo.city} and surrounding areas — 4-7 word memorable line",
  "schemaType": "AutoRepair"
}`;

    // One attempt that must end before Netlify's limit. The SDK's defaults
    // (10 min, 2 retries) would outlive the function; a transient API error
    // still comes back as a 5xx that the client retries with backoff.
    const modelTimeoutMs = Math.max(1_000, FUNCTION_LIMIT_MS - AFTER_MODEL_MS - (Date.now() - startedAt));
    let message;
    try {
      message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: USER_PROMPT }],
      }, { timeout: modelTimeoutMs, maxRetries: 0 });
    } catch (err) {
      if (!(err instanceof Anthropic.APIConnectionTimeoutError)) throw err;
      console.error(`[generate-website] model call passed ${modelTimeoutMs} ms for "${businessInfo.businessName}"`,
        { services: Array.isArray(businessInfo.services) ? businessInfo.services.length : null });
      return { statusCode: 422, headers: json, body: JSON.stringify(TOO_SLOW) };
    }

    // First text block (not content[0]), truncation refused, then every key
    // the templates and editor read is guaranteed (audit ai-3).
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
        : { statusCode: 502, headers: json, body: JSON.stringify({ error: 'The AI returned an incomplete answer. Please try again.' }) };
    }

    // If user chose Google Reviews, create a widget key via SocialFeeds
    if (businessInfo.reviewSource === 'google' && businessInfo.googlePlace?.placeId) {
      try {
        const widgetRes = await fetch('https://social-feeds-app.netlify.app/.netlify/functions/widget-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'autosite-builder',
            type: 'google-reviews',
            place_id: businessInfo.googlePlace.placeId,
            label: businessInfo.businessName || 'Website',
          }),
          // Inside the time kept free after the model call (AFTER_MODEL_MS).
          signal: AbortSignal.timeout(WIDGET_TIMEOUT_MS),
        });
        const widgetData = await widgetRes.json();
        if (widgetData.widget_key) {
          parsed.googleWidgetKey = widgetData.widget_key;
          parsed.reviewMode = 'google';
        }
      } catch (e) {
        console.error('Widget save error:', e);
        // Fallback: AI testimonials will still be available
      }
    }

    // Pass through Instagram widget key if provided from the form
    if (businessInfo.instagramWidgetKey) {
      parsed.instagramWidgetKey = businessInfo.instagramWidgetKey;
    }

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
      body: JSON.stringify({ error: "We couldn't write your website copy right now. Please try again in a minute." }),
    };
  }
};
