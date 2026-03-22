import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { publishSite } from '../../lib/publishSite.js';

export default function DashboardPage({ onNewSite, onEditSite, onSignOut, userEmail }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

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
    if (!confirm('Delete this site?')) return;
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) {
      alert('Failed to delete site. Please try again.');
      return;
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
      site.widget_config_ids || []
    );
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">AutoSite Builder</h1>
        <div className="flex items-center gap-4">
          {userEmail && <span className="text-xs text-[#888]">{userEmail}</span>}
          {onSignOut && (
            <button onClick={onSignOut} className="text-xs text-[#888] hover:text-[#cc0000] transition-colors">
              Sign Out
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Your Sites</h2>
          </div>
          <button
            onClick={onNewSite}
            className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            + New Site
          </button>
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
              Create your first site
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
                  <p className="font-semibold text-[#1a1a1a]">
                    {site.business_info?.businessName || 'Untitled'}
                  </p>
                  <p className="text-xs text-[#888] mt-0.5">
                    {site.business_info?.city}, {site.business_info?.state} &middot;{' '}
                    {new Date(site.created_at).toLocaleDateString()}
                    {site.widget_config_ids?.length > 0 && (
                      <span className="ml-2 text-[#cc0000]">
                        {site.widget_config_ids.length} widget{site.widget_config_ids.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  {site.published_url && (
                    <a
                      href={site.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#cc0000] underline mt-0.5 block truncate max-w-[260px]"
                    >
                      {site.published_url.replace('https://', '')}
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
                    onClick={() => handleReExport(site)}
                    className="px-3 py-1.5 text-xs font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                  >
                    Download
                  </button>
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
