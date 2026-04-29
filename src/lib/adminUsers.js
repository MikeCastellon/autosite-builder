// Admin-only helpers for the platform CRM. Reads + writes pass through
// Supabase with RLS — super-admin gating is enforced server-side, so a
// non-admin who somehow renders the admin UI still can't read or write
// anything sensitive.
import { supabase } from './supabase.js';

// Pull every signed-up user with the bits the admin list needs.
// Rather than join in SQL (Supabase doesn't expose a clean cross-table
// join through PostgREST without views), we fetch the three sources in
// parallel and stitch them in JS.
export async function listAllUsers() {
  const [profilesRes, sitesRes, metaRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('sites').select('id, user_id, business_info, slug, published_url, custom_domain, custom_domain_status, scheduler_enabled, created_at'),
    supabase.from('admin_user_metadata').select('*'),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (sitesRes.error) throw sitesRes.error;
  if (metaRes.error) throw metaRes.error;

  const sitesByUser = new Map();
  for (const s of (sitesRes.data || [])) {
    if (!sitesByUser.has(s.user_id)) sitesByUser.set(s.user_id, []);
    sitesByUser.get(s.user_id).push(s);
  }
  const metaByUser = new Map((metaRes.data || []).map((m) => [m.user_id, m]));

  return (profilesRes.data || []).map((p) => {
    const sites = sitesByUser.get(p.id) || [];
    const meta = metaByUser.get(p.id) || { notes: '', tags: [] };
    return {
      ...p,
      sites,
      siteCount: sites.length,
      publishedSiteCount: sites.filter((s) => s.published_url).length,
      firstPublishedUrl: sites.find((s) => s.published_url)?.published_url || null,
      firstSiteName: sites[0]?.business_info?.businessName || null,
      adminNotes: meta.notes || '',
      adminTags: meta.tags || [],
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Per-user activity counts (bookings, customers, charges). Cheap aggregate
// queries — only called when the detail drawer opens.
export async function getUserActivityCounts(userId) {
  const [bookingsRes, chargesRes, customersRes] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId),
    supabase.from('charges').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId),
    supabase.from('customer_profiles').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId),
  ]);
  return {
    bookings: bookingsRes.count ?? 0,
    charges: chargesRes.count ?? 0,
    customers: customersRes.count ?? 0,
  };
}

// Upsert notes + tags. Empty string + empty array is a valid state — that's
// how a row can exist with cleared metadata after the admin removes everything.
export async function saveAdminUserMetadata({ userId, notes, tags, currentAdminId }) {
  const payload = {
    user_id: userId,
    notes: notes || null,
    tags: Array.isArray(tags) ? tags : [],
    updated_by: currentAdminId || null,
  };
  const { data, error } = await supabase
    .from('admin_user_metadata')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Aggregate every distinct tag in use across all users — feeds the
// autocomplete dropdown when admin starts typing a new tag.
export async function listAllAdminTags() {
  const { data, error } = await supabase.from('admin_user_metadata').select('tags');
  if (error) throw error;
  const set = new Set();
  for (const row of (data || [])) {
    for (const t of (row.tags || [])) {
      const trimmed = String(t).trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort();
}

// Convenience: human-friendly subscription status bucket. Used by both the
// list filter and the detail badge.
export function subStatusBucket(profile) {
  if (profile?.is_super_admin) return 'admin';
  if (profile?.scheduler_enabled && profile?.subscription_status !== 'active') return 'pro-comp';
  const s = profile?.subscription_status;
  if (s === 'active') return 'pro';
  if (s === 'past_due') return 'past_due';
  if (s === 'cancelled') {
    if (profile?.subscription_ends_at && new Date(profile.subscription_ends_at) > new Date()) return 'cancelled-grace';
    return 'cancelled';
  }
  return 'free';
}
