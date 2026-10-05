// Status of a copy-generation job started with generate-website-background.
//   GET /.netlify/functions/generate-website-status?jobId=<uuid>
//   200 { status: 'running' } | { status: 'done', copy } |
//       { status: 'error', code, httpStatus, error }
//   404 while the job does not exist (yet): the background function may not
//       have written its first record when the first poll arrives.
//   503 { error, code: 'storage_unavailable' } when Blobs cannot be read.
// The key is built from the signed-in user, never taken from the request, so
// a job id alone cannot read someone else's copy.
//
// Netlify v2 function, like the background function, for Blobs strong
// consistency (see generate-website-background.js).
import { getStore, getDeployStore } from '@netlify/blobs';
import { requireUser } from './_shared/auth.js';
import { corsHeaders, jsonHeaders } from './_shared/cors.js';
import { isJobId, jobKey, openJobStore, publicJobState } from './_lib/copyGeneration.js';

export default async function generateWebsiteStatus(req, context) {
  const reqHeaders = { origin: req.headers.get('origin') || undefined };
  // Polled every 2 s and changes between polls: never cache it.
  const headers = { ...jsonHeaders(reqHeaders), 'Cache-Control': 'no-store' };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(reqHeaders) });
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser({ headers: { authorization: req.headers.get('authorization') || '' } });
  } catch (err) {
    return reply(err.status || 500, { error: err.message });
  }

  const jobId = new URL(req.url).searchParams.get('jobId');
  if (!isJobId(jobId)) return reply(400, { error: 'Invalid job id' });

  let record;
  try {
    const store = openJobStore(context, { getStore, getDeployStore });
    record = await store.get(jobKey(user.id, jobId), { type: 'json' });
  } catch (err) {
    console.error('[generate-website-status] read failed:', err?.message || err);
    // 5xx: the wizard keeps polling through a brief storage hiccup. The code
    // names the cause; after MAX_POLL_FAILURES of these in a row the wizard
    // writes the copy with the legacy route instead (generateWebsite.js).
    return reply(503, { error: 'Could not read the job status. Please try again.', code: 'storage_unavailable' });
  }
  if (!record) return reply(404, { error: 'Job not found' });
  return reply(200, publicJobState(record));
}
