const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pure parse/validate for the track-view beacon. Returns
// { siteId, kind, referrer_host } or null if invalid.
export function parseTrackView(body) {
  let data;
  if (typeof body === 'string') {
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
