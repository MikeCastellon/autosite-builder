import { supabase } from './supabase.js';

const DAY_MS = 86400000;

// Returns ISO { since, prevSince }. The previous window is the equal-length
// span immediately before `since`, used for vs-previous deltas.
export function rangeToDates(rangeDays, now = new Date()) {
  if (rangeDays === 'all') {
    const epoch = new Date(0).toISOString();
    return { since: epoch, prevSince: epoch };
  }
  const ms = rangeDays * DAY_MS;
  return {
    since: new Date(now.getTime() - ms).toISOString(),
    prevSince: new Date(now.getTime() - 2 * ms).toISOString(),
  };
}

// Calls the get_overview RPC and returns the aggregate object.
export async function loadOverview(rangeDays) {
  const { since, prevSince } = rangeToDates(rangeDays);
  const { data, error } = await supabase.rpc('get_overview', { p_since: since, p_prev_since: prevSince });
  if (error) throw error;
  return data;
}
