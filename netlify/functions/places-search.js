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

  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,formatted_address,place_id,rating,user_ratings_total&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { statusCode: 502, headers: json, body: JSON.stringify({ error: `Places API error: ${data.status}` }) };
    }

    const results = (data.candidates || []).map((p) => ({
      name: p.name,
      address: p.formatted_address,
      place_id: p.place_id,
      rating: p.rating,
      review_count: p.user_ratings_total,
    }));

    return { statusCode: 200, headers: json, body: JSON.stringify({ results }) };
  } catch (err) {
    console.error('places-search error:', err);
    return { statusCode: 502, headers: json, body: JSON.stringify({ error: 'Search request failed' }) };
  }
};
