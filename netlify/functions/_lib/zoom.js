// Zoom Server-to-Server OAuth wrapper.
//
// Setup steps for the operator (one-time):
//   1. https://marketplace.zoom.us → Develop → Build App → "Server-to-Server OAuth"
//   2. Add scopes: meeting:write:meeting:admin (creates meetings on the
//      account owner's behalf — that's you)
//   3. Activate the app
//   4. Copy Account ID, Client ID, Client Secret
//   5. Set Netlify env vars: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
//
// Tokens last 1 hour and are cached in module memory between invocations
// (Netlify functions stay warm for several minutes, so this typically saves
// a roundtrip per call). Cold-start invocations re-fetch.

const TOKEN_URL = 'https://zoom.us/oauth/token';
const API_BASE = 'https://api.zoom.us/v2';

let cachedToken = null;
let cachedExpiresAt = 0;

async function fetchAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom credentials missing (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET)');
  }

  // Refresh if missing or expiring within the next 30s
  if (cachedToken && Date.now() < cachedExpiresAt - 30_000) return cachedToken;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'account_credentials', account_id: accountId });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Zoom token fetch failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  cachedToken = json.access_token;
  cachedExpiresAt = Date.now() + (json.expires_in * 1000); // typically 3600s
  return cachedToken;
}

/**
 * Create a scheduled Zoom meeting on the account owner's calendar.
 *
 * @param {Object} opts
 * @param {string} opts.topic         Meeting topic (shown in Zoom UI + invite)
 * @param {string} opts.startISO      ISO 8601 start time (e.g. "2026-05-04T15:00:00-04:00")
 * @param {number} opts.durationMin   Duration in minutes
 * @param {string} [opts.timezone]    IANA TZ name (default America/New_York)
 * @param {string} [opts.agenda]      Free-form agenda / description
 * @returns {{ id: string, join_url: string, password: string, start_url: string }}
 */
export async function createZoomMeeting({ topic, startISO, durationMin, timezone = 'America/New_York', agenda }) {
  const token = await fetchAccessToken();
  const res = await fetch(`${API_BASE}/users/me/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: topic || 'Genius Websites — Support call',
      type: 2,                      // 2 = scheduled meeting
      start_time: startISO,
      duration: durationMin,
      timezone,
      agenda: agenda || '',
      settings: {
        join_before_host: true,
        jbh_time: 5,
        host_video: true,
        participant_video: true,
        mute_upon_entry: false,
        approval_type: 0,           // automatically approve
        audio: 'both',
        auto_recording: 'none',
        waiting_room: false,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Zoom meeting create failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return {
    id: String(data.id),
    join_url: data.join_url,
    password: data.password || '',
    start_url: data.start_url,
  };
}
