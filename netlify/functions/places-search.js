import { requireUser } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';

export const handler = async (event) => {
  const cors = corsHeaders(event.headers);
  const json = jsonHeaders(event.headers);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors };
  }

  // Auth gate (Security Audit H3): this proxies a paid Google API. An
  // unauthenticated endpoint is a direct quota-burn / cost-exfiltration
  // vector. Tie every call to a signed-in user.
  try {
    await requireUser(event);
  } catch (err) {
    return { statusCode: err.status || 500, headers: json, body: JSON.stringify({ error: err.message }) };
  }

  const query = event.queryStringParameters?.q;
  if (!query) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Missing q parameter' }) };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: json, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  // Append city/state so predictions are biased to the user's area —
  // mirrors how Google's own search-as-you-type behaves.
  const city = event.queryStringParameters?.city?.trim();
  const state = event.queryStringParameters?.state?.trim();
  const locationSuffix = [city, state].filter(Boolean).join(', ');
  const fullQuery = locationSuffix ? `${query} ${locationSuffix}` : query;

  try {
    // Autocomplete is the API behind Google's search-as-you-type. It finds
    // small businesses + partial/abbreviated names that Find Place and Text
    // Search miss (e.g. "og detailing" → "OG Detailing").
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(fullQuery)}&types=establishment&components=country:us&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { statusCode: 502, headers: json, body: JSON.stringify({ error: `Places API error: ${data.status}` }) };
    }

    const results = (data.predictions || []).slice(0, 10).map((p) => ({
      name: p.structured_formatting?.main_text || p.description,
      address: p.structured_formatting?.secondary_text || '',
      place_id: p.place_id,
    }));

    return { statusCode: 200, headers: json, body: JSON.stringify({ results }) };
  } catch (err) {
    console.error('places-search error:', err);
    return { statusCode: 502, headers: json, body: JSON.stringify({ error: 'Search request failed' }) };
  }
};
