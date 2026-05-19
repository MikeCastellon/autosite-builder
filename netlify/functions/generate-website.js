import Anthropic from '@anthropic-ai/sdk';
import { requireUser, supabaseAdmin } from './_shared/auth.js';
import { checkAndRecordRateLimit } from './_shared/rateLimit.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a professional copywriter specializing in automotive service businesses in the US.
Your job is to generate compelling, authentic website copy for car industry businesses.
You write in a voice and tone that matches the business type and template style provided.
Use the city name naturally throughout the copy for local SEO.
Always respond with valid JSON only — no markdown code fences, no prose outside the JSON object.`;

export const handler = async (event) => {
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
    const body = JSON.parse(event.body || '{}');
    const { businessInfo, templateMeta } = body;

    // --- Dynamic section schema support ---
    const sections = Array.isArray(businessInfo.sections) ? businessInfo.sections : null;

    // types present anywhere in the section list
    const presentTypes = sections ? new Set(sections.map(s => s.type)) : null;
    const mediaTextInstances  = sections ? sections.filter(s => s.type === 'mediaText') : [];
    const faqInstance         = sections ? sections.find(s => s.type === 'faq') : null;
    const processInstance     = sections ? sections.find(s => s.type === 'process') : null;

    // When `sections` is absent (legacy callers), include() is permissive — include everything.
    function include(type) {
      return !presentTypes || presentTypes.has(type);
    }
    // --- End dynamic section schema support ---

    if (!businessInfo?.businessName || !businessInfo?.city) {
      return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Missing required business info' }) };
    }

    const servicesText = Array.isArray(businessInfo.services)
      ? businessInfo.services.map(s => (typeof s === 'object' ? s.name : s)).filter(Boolean).join(', ')
      : businessInfo.services || 'General auto services';

    // Build dynamic JSON schema based on which section types the user chose
    const schemaParts = [];
    if (include('hero')) {
      schemaParts.push(`"headline": "Main hero headline including ${businessInfo.city} (8-12 words, punchy, city-specific)"`);
      schemaParts.push(`"subheadline": "Supporting hero tagline (10-15 words, highlights key value)"`);
    }
    if (include('about')) {
      schemaParts.push(`"aboutText": "Full about section — 2-3 short paragraphs separated by newlines (~180 words). Mention ${businessInfo.city} 2-3 times. Tell their story, build trust."`);
    }
    if (include('services')) {
      schemaParts.push(`"servicesSection": { "intro": "1-2 sentences introducing services, referencing ${businessInfo.city} (20-30 words)", "items": [ { "name": "Exact service name from their list", "description": "2-3 sentence description (30-50 words)" } ] }`);
    }
    if (include('cta') || include('hero')) {
      schemaParts.push(`"ctaPrimary": "Primary CTA button text (3-5 words, action-oriented)"`);
      schemaParts.push(`"ctaSecondary": "Secondary CTA text (3-5 words)"`);
    }
    if (include('testimonials')) {
      schemaParts.push(`"testimonialPlaceholders": [ { "text": "Realistic customer testimonial mentioning the business (20-30 words)", "name": "First name + Last initial" }, { "text": "Second testimonial (different angle)", "name": "First name + Last initial" }, { "text": "Third testimonial", "name": "First name + Last initial" } ]`);
    }

    // Per-instance content goes into sectionContent
    const instanceParts = [];
    if (faqInstance) {
      instanceParts.push(`"${faqInstance.id}": { "items": [ { "q": "Common customer question", "a": "Short helpful answer (1-2 sentences)" } ] }`);
    }
    if (processInstance) {
      instanceParts.push(`"${processInstance.id}": { "intro": "1-2 sentences about how the service flows (20-30 words)", "steps": [ { "title": "Step name (2-4 words)", "description": "Step description (15-25 words)" } ] }`);
    }
    for (const m of mediaTextInstances) {
      instanceParts.push(`"${m.id}": { "heading": "Short section heading (3-6 words)", "body": "On-topic paragraph for ${businessInfo.businessName} (40-70 words)", "alignment": "left" }`);
    }
    if (instanceParts.length) {
      schemaParts.push(`"sectionContent": { ${instanceParts.join(', ')} }`);
    }

    // SEO + meta (always)
    schemaParts.push(`"metaDescription": "SEO meta description: business name + city + top 2 services (140-160 chars exactly)"`);
    schemaParts.push(`"metaTitle": "${businessInfo.businessName} | Auto Service in ${businessInfo.city}, ${businessInfo.state}"`);
    schemaParts.push(`"keywords": ["${businessInfo.city} auto detailing", "${businessInfo.city} car care", "auto service ${businessInfo.city} ${businessInfo.state}"]`);
    schemaParts.push(`"footerTagline": "Proudly serving ${businessInfo.city} and surrounding areas — 4-7 word memorable line"`);
    schemaParts.push(`"schemaType": "AutoRepair"`);

    const jsonSchema = `{\n  ${schemaParts.join(',\n  ')}\n}`;

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
${jsonSchema}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT }],
    });

    const rawText = message.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Strip markdown fences if model added them despite instructions
      const cleaned = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(cleaned);
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
    const bizName = event?.body ? (() => { try { return JSON.parse(event.body)?.businessInfo?.businessName; } catch { return 'unknown'; } })() : 'unknown';
    console.error(`[generate-website] FAILED for "${bizName}":`, error?.message || error);
    return {
      statusCode: 500,
      headers: json,
      body: JSON.stringify({ error: error.message || String(error) }),
    };
  }
};
