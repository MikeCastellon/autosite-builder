const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A real beacon is ~150 bytes; anything this big is junk.
const MAX_BODY_CHARS = 4096;

// The event body as a string: Netlify base64-encodes bodies it does not
// treat as text.
export function decodeTrackViewBody(event) {
  if (!event || !event.isBase64Encoded || typeof event.body !== 'string') return event?.body;
  try { return Buffer.from(event.body, 'base64').toString('utf8'); } catch { return null; }
}

// Hosts of the owner app (dashboard, deploy previews, local dev). A view
// referred from there is the owner opening their own site (dashboard
// thumbnail, "View live"), not a visitor. scheduler.js already skips
// framed pages and #acg-no-track; this also covers a tab still running an
// older copy of it.
const APP_HOSTS = new Set([
  'sitebuilder.autocaregenius.com',
  'app.autocaregenius.com',
  'autosite-builder.netlify.app',
]);

export function isOwnerAppReferrer(host) {
  if (typeof host !== 'string' || !host) return false;
  const h = host.toLowerCase().replace(/:\d+$/, '');
  return APP_HOSTS.has(h)
    || h.endsWith('--autosite-builder.netlify.app')
    || h === 'localhost' || h === '127.0.0.1';
}

// Pure parse/validate for the track-view beacon. Returns
// { siteId, kind, referrer_host } or null if invalid. scheduler.js sends
// the JSON as text/plain, so it arrives as a string.
export function parseTrackView(body) {
  let data;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) return null;
    try { data = JSON.parse(body); } catch { return null; }
  } else if (body && typeof body === 'object') {
    data = body;
  } else {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const siteId = data.siteId;
  const kind = data.kind;
  if (typeof siteId !== 'string' || !UUID_RE.test(siteId)) return null;
  if (kind !== 'site' && kind !== 'booking') return null;
  let referrer_host = null;
  if (typeof data.referrer === 'string' && data.referrer) {
    try { referrer_host = new URL(data.referrer).host || null; } catch { referrer_host = null; }
  }
  return { siteId, kind, referrer_host };
}
