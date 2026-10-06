import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import InquiriesView from '../dashboard/inquiries/InquiriesView.jsx';

// Who each inquiry belongs to. The site names the business (an owner can
// have several sites, and admin-owned sites are many different businesses);
// the profile names the owner. Super admins read every row of both through
// RLS (profiles_select_own_or_admin, sites_admin_select_all).
export async function loadShopDirectory() {
  const [profilesRes, sitesRes] = await Promise.all([
    supabase.from('profiles').select('id, business_name, first_name, last_name, email, is_super_admin'),
    supabase.from('sites').select('id, user_id, business_info, published_url'),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (sitesRes.error) throw sitesRes.error;
  return { profiles: profilesRes.data || [], sites: sitesRes.data || [] };
}

function clean(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

// Built once per load, so each table row is two Map lookups.
// shopFor(inquiry) -> { business, ownerName, ownerEmail, owner, siteUrl, ownerIsAdmin }
export function buildShopLookup({ profiles = [], sites = [] } = {}) {
  const ownersById = new Map(profiles.map((p) => [p.id, p]));
  const sitesById = new Map(sites.map((s) => [s.id, s]));
  return function shopFor(inquiry) {
    const site = sitesById.get(inquiry?.site_id) || null;
    const owner = ownersById.get(inquiry?.owner_user_id) || null;
    const ownerName = [clean(owner?.first_name), clean(owner?.last_name)].filter(Boolean).join(' ') || null;
    const ownerEmail = clean(owner?.email);
    return {
      business: clean(site?.business_info?.businessName) || clean(owner?.business_name),
      ownerName,
      ownerEmail,
      owner: ownerName || ownerEmail,
      siteUrl: site?.published_url || null,
      ownerIsAdmin: !!owner?.is_super_admin,
    };
  };
}

// Admin > All inquiries: every shop's contact-form messages, read-only (the
// status and notes are each owner's; InquiriesView's allShops mode locks the
// drawer).
export default function AdminAllInquiriesTab() {
  const [directory, setDirectory] = useState(null);
  const [dirErr, setDirErr] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDirectory(null);
    setDirErr(null);
    loadShopDirectory()
      .then((d) => { if (!cancelled) setDirectory(d); })
      .catch((e) => {
        if (cancelled) return;
        // Still list the inquiries: missing names beat a blank page.
        setDirErr(e?.message || 'Could not load shop names');
        setDirectory({ profiles: [], sites: [] });
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const shopFor = useMemo(() => (directory ? buildShopLookup(directory) : null), [directory]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-xs text-ink-tertiary">
          Messages sent through every shop's contact form. Read-only: the status and notes belong to each owner.
        </p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="ml-auto text-xs text-gray-500 hover:text-[#1a1a1a]"
        >
          {shopFor ? 'Refresh' : 'Loading…'}
        </button>
      </div>

      {dirErr && (
        <p className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Shop names could not load ({dirErr}), so the Shop column says "Unknown shop".
        </p>
      )}

      {shopFor
        ? <InquiriesView key={reloadKey} allShops shopFor={shopFor} />
        : <p className="text-sm text-gray-500">Loading…</p>}
    </div>
  );
}
