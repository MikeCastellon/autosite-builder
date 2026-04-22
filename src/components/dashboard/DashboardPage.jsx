import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { publishSite } from '../../lib/publishSite.js';
import { TEMPLATES } from '../../data/templates.js';
import { canSeeBookingsNav } from '../../lib/subscriptionGating.js';

const MAX_SITES = 1;

export default function DashboardPage({ onNewSite, onEditSite, onSignOut, userEmail, profile, onOpenAdmin, onOpenBookings, onOpenBookingSettings }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const schedulerEnabled = !!profile?.scheduler_enabled;
  const showBookingsNav = canSeeBookingsNav(profile);
  const isAdmin = !!profile?.is_super_admin;
  const canCreateSite = isAdmin || sites.length < MAX_SITES;

  useEffect(() => {
    async function fetchSites() {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setFetchError('Failed to load sites. Please refresh.');
      } else {
        setSites(data || []);
      }
      setLoading(false);
    }
    fetchSites();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this site? This will also unpublish it if live.')) return;
    // Find the site to get slug for R2 cleanup
    const site = sites.find(s => s.id === id);
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) {
      alert('Failed to delete site. Please try again.');
      return;
    }
    // Delete from R2 if published
    if (site?.slug) {
      fetch('/.netlify/functions/unpublish-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: site.slug }),
      }).catch(() => {}); // Best-effort cleanup
    }
    setSites((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRepublish = async (site) => {
    if (!confirm(`Republish ${site.business_info?.businessName || 'this site'}?`)) return;
    try {
      const { TEMPLATES } = await import('../../data/templates.js');
      const templateMeta = TEMPLATES[site.template_id];
      await publishSite({
        siteId: site.id,
        businessInfo: site.business_info,
        generatedCopy: site.generated_content,
        templateId: site.template_id,
        templateMeta: { ...templateMeta, colors: templateMeta?.colors || {} },
        images: {},
        selectedWidgetIds: site.widget_config_ids || [],
        customDomain: site.custom_domain || null,
      });
      alert(`${site.business_info?.businessName || 'Site'} republished successfully!`);
    } catch (err) {
      alert(`Republish failed: ${err.message}`);
    }
  };

  const handleReExport = async (site) => {
    // Download a saved site's HTML again
    const { exportHtml } = await import('../../lib/exportHtml.js');
    const { TEMPLATES } = await import('../../data/templates.js');
    const templateMeta = TEMPLATES[site.template_id];
    await exportHtml(
      site.template_id,
      site.business_info,
      site.generated_content,
      { ...templateMeta, colors: templateMeta?.colors || {} },
      {},
      site.widget_config_ids || [],
      site.id
    );
  };

  const initial = userEmail ? userEmail[0].toUpperCase() : '?';
  const navItems = [
    { label: 'Sites', onClick: () => {}, active: true },
    showBookingsNav && onOpenBookings && { label: 'Bookings', onClick: onOpenBookings, active: false },
    isAdmin && onOpenAdmin && { label: 'Admin', onClick: onOpenAdmin, active: false },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-4 sm:px-8 flex items-center justify-between h-16 sticky top-0 z-50">
        <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Genius Websites</h1>

        {/* Centered nav (desktop only) */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 text-[13px] font-medium">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`px-3 py-1.5 rounded-lg transition-colors ${item.active ? 'bg-[#1a1a1a] text-white' : 'text-[#1a1a1a] hover:bg-black/[0.04]'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: desktop avatar dropdown */}
        <div className="hidden md:flex items-center">
          {userEmail && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#1a1a1a] transition-colors font-medium"
                aria-label="Account menu"
              >
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[12px] font-bold">
                  {initial}
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 bg-white border border-black/[0.1] rounded-xl shadow-lg py-1.5 min-w-[200px] z-[100]">
                  <div className="px-4 py-2 text-[11px] text-[#888] border-b border-black/[0.05] truncate">{userEmail}</div>
                  {onSignOut && (
                    <button
                      onClick={() => { setDropdownOpen(false); onSignOut(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#cc0000] hover:bg-[#faf9f7] transition-colors font-medium"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Open menu"
          className="md:hidden flex items-center justify-center w-10 h-10 text-[#1a1a1a] hover:bg-black/[0.04] rounded-lg transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
            )}
          </svg>
        </button>
      </header>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden border-b border-black/[0.07] bg-white shadow-sm px-4 py-3 sticky top-16 z-40">
          {userEmail && (
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-black/[0.05]">
              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm font-bold">
                {initial}
              </div>
              <div className="text-sm text-[#1a1a1a] font-medium truncate">{userEmail}</div>
            </div>
          )}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { setMobileOpen(false); item.onClick(); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${item.active ? 'bg-[#1a1a1a] text-white' : 'text-[#1a1a1a] hover:bg-black/[0.04]'}`}
              >
                {item.label}
              </button>
            ))}
            {onSignOut && (
              <button
                onClick={() => { setMobileOpen(false); onSignOut(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#cc0000] hover:bg-black/[0.04] transition-colors border-t border-black/[0.05] mt-1 pt-3"
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Your Sites</h2>
          </div>
          {canCreateSite ? (
            <button
              onClick={onNewSite}
              className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
            >
              + New Site
            </button>
          ) : (
            <span className="text-xs text-[#888] bg-black/5 px-4 py-2 rounded-lg">Free plan: 1 site</span>
          )}
        </div>

        {loading ? (
          <p className="text-[#888] text-sm">Loading...</p>
        ) : fetchError ? (
          <div className="border border-[#cc0000]/20 rounded-xl p-4 text-sm text-[#cc0000] bg-[#cc0000]/5">
            {fetchError}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 border border-black/[0.07] rounded-2xl bg-white">
            <p className="text-[#888] mb-4">No sites yet.</p>
            <button
              onClick={onNewSite}
              className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
            >
              Build My Site
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white border border-black/[0.07] rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-[#1a1a1a]">
                      {site.business_info?.businessName || 'Untitled'}
                    </p>
                    {site.published_url ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#888]">
                    {site.template_id && <span className="text-[#555] font-medium">{TEMPLATES[site.template_id]?.name || site.template_id}</span>}
                    {site.template_id && ' · '}
                    {site.business_info?.city}, {site.business_info?.state} · {new Date(site.created_at).toLocaleDateString()}
                  </p>
                  {site.published_url && (
                    <a
                      href={site.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:text-green-800 mt-1 inline-flex items-center gap-1 transition-colors"
                    >
                      <span className="truncate max-w-[260px]">{site.published_url.replace('https://', '')}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  {onEditSite && (
                    <button
                      onClick={() => onEditSite(site)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#1a1a1a] text-white rounded-lg hover:bg-[#cc0000] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {site.published_url && (
                    <button
                      onClick={() => handleRepublish(site)}
                      className="px-3 py-1.5 text-xs font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                    >
                      Republish
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="px-3 py-1.5 text-xs font-medium text-[#888] hover:text-[#cc0000] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
