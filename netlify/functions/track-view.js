import { createClient } from '@supabase/supabase-js';
import { parseTrackView } from './_lib/track-view-core.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Public beacon endpoint hit by scheduler.js on every published page load.
// Records one page_views row. Always returns 204 (beacons ignore the body);
// junk input is silently dropped so we never throw on the client.
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '' };

  const parsed = parseTrackView(event.body);
  if (!parsed) return { statusCode: 204, headers: CORS, body: '' };

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Cheap existence check so a bogus (but well-formed) UUID can't spam rows.
    const { data: site } = await supabase.from('sites').select('id').eq('id', parsed.siteId).maybeSingle();
    if (site) {
      await supabase.from('page_views').insert({
        site_id: parsed.siteId,
        kind: parsed.kind,
        referrer_host: parsed.referrer_host,
      });
    }
  } catch (err) {
    console.error('track-view error:', err.message);
  }
  return { statusCode: 204, headers: CORS, body: '' };
};
