import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a professional copywriter specializing in automotive service businesses in the US.
Your job is to generate compelling, authentic website copy for car industry businesses.
You write in a voice and tone that matches the business type and template style provided.
Use the city name naturally throughout the copy for local SEO.
Always respond with valid JSON only — no markdown code fences, no prose outside the JSON object.`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { businessInfo, templateMeta } = body;

    if (!businessInfo?.businessName || !businessInfo?.city) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required business info' }) };
    }

    const servicesText = Array.isArray(businessInfo.services)
      ? businessInfo.services.join(', ')
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

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, copy: parsed }),
    };
  } catch (error) {
    console.error('generate-website error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate website copy. Please try again.' }),
    };
  }
};
