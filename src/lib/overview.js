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

// Calls the get_overview RPC and returns the aggregate object. The RPC
// scopes everything to auth.uid() itself.
export async function loadOverview(rangeDays, client = supabase) {
  const { since, prevSince } = rangeToDates(rangeDays);
  const { data, error } = await client.rpc('get_overview', { p_since: since, p_prev_since: prevSince });
  if (error) throw error;
  return data;
}

// The Overview's direct table reads filter by the signed-in owner. RLS alone
// isn't enough: it lets super-admins read every shop's bookings and sites,
// so without the filter an admin's own Overview showed other shops' data.
export async function loadRecentBookings(userId, client = supabase) {
  const { data, error } = await client.from('bookings')
    .select('customer_name, service_name, status, created_at')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data || [];
}

export async function loadOwnerSites(userId, client = supabase) {
  const { data, error } = await client.from('sites')
    .select('published_url, site_type, scheduler_enabled, custom_domain, custom_domain_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Share card target: the standalone booking page wins; else a website with
// booking enabled (its /book page). Never a plain website: that link
// wouldn't be a booking page.
export function pickShareSite(sites) {
  const list = sites || [];
  return list.find((s) => s.site_type === 'booking_only') || list.find((s) => s.scheduler_enabled) || null;
}

// What the Overview shows, from the sites query: 'loading' | 'error' |
// 'onboarding' (no sites yet) | 'ready'. A failed query must never look like
// an empty account, or existing customers get the new-user welcome.
export function overviewMode(sitesStatus, siteCount) {
  if (sitesStatus === 'error') return 'error';
  if (sitesStatus !== 'ready') return 'loading';
  return siteCount === 0 ? 'onboarding' : 'ready';
}
