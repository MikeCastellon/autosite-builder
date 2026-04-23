import { ServerClient } from 'postmark';

// Diagnostic endpoint — hit this with a ?to=your@email query param to verify
// Postmark credentials + sender-domain setup. Returns the raw Postmark
// success/failure so we can see exactly what the API said.
// Usage: /.netlify/functions/test-postmark?to=dev@639hz.com

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body, null, 2) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const to = event.queryStringParameters?.to;
  if (!to) {
    return json(400, { error: 'Missing ?to=<email>' });
  }

  const token = process.env.POSTMARK_API_KEY;
  const from = process.env.POSTMARK_FROM_EMAIL;

  const diagnostics = {
    has_POSTMARK_API_KEY: !!token,
    has_POSTMARK_FROM_EMAIL: !!from,
    POSTMARK_FROM_EMAIL: from || null,
    POSTMARK_API_KEY_preview: token ? token.slice(0, 8) + '...' : null,
    to,
  };

  if (!token) return json(500, { ok: false, error: 'POSTMARK_API_KEY env var is not set', diagnostics });
  if (!from) return json(500, { ok: false, error: 'POSTMARK_FROM_EMAIL env var is not set', diagnostics });

  const client = new ServerClient(token);

  try {
    const res = await client.sendEmail({
      From: from,
      To: to,
      Subject: 'Scheduler test email',
      HtmlBody: '<h2>It worked.</h2><p>Postmark is configured correctly. This is a diagnostic email from the scheduler.</p>',
      TextBody: 'It worked. Postmark is configured correctly. This is a diagnostic email from the scheduler.',
      MessageStream: 'outbound',
    });
    return json(200, {
      ok: true,
      messageId: res?.MessageID,
      postmark_response: res,
      diagnostics,
    });
  } catch (err) {
    return json(500, {
      ok: false,
      error: err?.message || String(err),
      code: err?.code ?? null,
      name: err?.name ?? null,
      response: err?.response ?? null,
      diagnostics,
    });
  }
};
