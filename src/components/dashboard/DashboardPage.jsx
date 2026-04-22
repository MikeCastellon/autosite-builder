import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { publishSite } from '../../lib/publishSite.js';
import { TEMPLATES } from '../../data/templates.js';
import BookingsView from './bookings/BookingsView.jsx';

const MAX_SITES = 1;

export default function DashboardPage({ onNewSite, onEditSite, onSignOut, userEmail, profile, onOpenAdmin, initialView = 'sites' }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [view, setView] = useState(initialView); // 'sites' | 'bookings'
  useEffect(() => { setView(initialView); }, [initialView]);
  const schedulerEnabled = !!profile?.scheduler_enabled;
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

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Genius Websites</h1>
          <nav className="flex gap-4 text-sm">
            <button onClick={() => setView('sites')} className={view === 'sites' ? 'font-semibold text-[#1a1a1a]' : 'text-gray-500 hover:text-[#1a1a1a]'}>Sites</button>
            {schedulerEnabled && (
              <button onClick={() => setView('bookings')} className={view === 'bookings' ? 'font-semibold text-[#1a1a1a]' : 'text-gray-500 hover:text-[#1a1a1a]'}>Bookings</button>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && onOpenAdmin && (
            <button onClick={onOpenAdmin} className="text-xs text-[#1a1a1a] font-semibold hover:text-[#cc0000]">Admin</button>
          )}
          {userEmail && <span className="text-xs text-[#888]">{userEmail}</span>}
          {onSignOut && (
            <button onClick={onSignOut} className="text-xs text-[#888] hover:text-[#cc0000] transition-colors">Sign Out</button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {view === 'bookings' ? (
          <BookingsView userId={profile?.id} />
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
