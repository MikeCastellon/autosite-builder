// GET /.netlify/functions/support-slots
//
// Returns the list of open Zoom support slots within the booking horizon.
// Public (no auth required) — there's nothing sensitive about availability,
// and we want signed-out users to be able to see it from the help drawer
// before they decide to engage.
import { createClient } from '@supabase/supabase-js';
import { listOpenSlots, SUPPORT_CONFIG } from './_lib/support-slots.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Pull only the future + buffer of existing bookings so the conflict
  // check is cheap. A few hours of past is harmless and avoids edge cases
  // around in-progress meetings.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: existing, error } = await supabase
    .from('support_bookings')
    .select('scheduled_at, ends_at, status')
    .gte('scheduled_at', since)
    .neq('status', 'cancelled');
  if (error) {
    console.error('[support-slots] supabase error', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not load slots' }) };
  }

  const slots = listOpenSlots({ existingBookings: existing || [] });
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      slots,
      timezone: SUPPORT_CONFIG.timezone,
      slotMinutes: SUPPORT_CONFIG.slotMinutes,
    }),
  };
};
