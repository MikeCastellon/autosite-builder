import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { publishSite } from '../../lib/publishSite.js';
import { TEMPLATES } from '../../data/templates.js';
import { canSeeBookingsNav, isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import CustomDomainPanel from '../CustomDomainPanel.jsx';
import UpgradeProDialog from '../ui/UpgradeProDialog.jsx';
import EditBusinessInfoModal from './EditBusinessInfoModal.jsx';
import UpgradeFunnel from './UpgradeFunnel.jsx';

const MAX_SITES = 1;
const CUSTOM_DOMAIN_ENABLED = import.meta.env.VITE_CUSTOM_DOMAIN_ENABLED === 'true';

export default function DashboardPage({ onNewSite, onEditSite, onSignOut, userEmail, profile, onOpenAdmin, onOpenBookings, onOpenCustomers, onOpenProfile, onOpenPaymentsConnect, onOpenBookingSettings }) {
  const { toast, confirm: confirmDialog } = useAlert();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [domainPanelSiteId, setDomainPanelSiteId] = useState(null);
  const [domainPanelInitial, setDomainPanelInitial] = useState(null);
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [editBizSite, setEditBizSite] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const schedulerEnabled = !!profile?.scheduler_enabled;
  const showBookingsNav = canSeeBookingsNav(profile);
  const isAdmin = !!profile?.is_super_admin;
  const isPro = isEffectiveSchedulerActive(profile);
  const canCreateSite = isAdmin || sites.length < MAX_SITES;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_success') === '1') {
      setShowWelcome(true);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setShowWelcome(false), 60_000);
    }
  }, []);

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
    const ok = await confirmDialog('This will also unpublish it and remove any custom domain. This cannot be undone.', {
      title: 'Delete site?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const site = sites.find(s => s.id === id);
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) {
      toast('Failed to delete site. Please try again.', 'error');
      return;
    }
    if (site?.slug) {
      fetch('/.netlify/functions/unpublish-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: site.slug, siteId: site.id }),
      }).catch(() => {});
    }
    setSites((prev) => prev.filter((s) => s.id !== id));
    toast('Site deleted', 'success');
  };

  const handleRepublish = async (site) => {
    const ok = await confirmDialog(`Republish ${site.business_info?.businessName || 'this site'} with the latest template updates?`, {
      title: 'Republish site?',
      confirmText: 'Republish',
    });
    if (!ok) return;
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
        isPro,
      });
      toast(`${site.business_info?.businessName || 'Site'} republished successfully`, 'success');
    } catch (err) {
      toast(`Republish failed: ${err.message}`, 'error');
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
    { label: 'Dashboard', onClick: () => {}, active: true },
    showBookingsNav && onOpenBookings && { label: 'Bookings', onClick: onOpenBookings, active: false },
    showBookingsNav && onOpenCustomers && { label: 'Customers', onClick: onOpenCustomers, active: false },
    onOpenPaymentsConnect && { label: 'Payments', onClick: onOpenPaymentsConnect, active: false },
    isAdmin && onOpenAdmin && { label: 'Admin', onClick: onOpenAdmin, active: false },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-4 sm:px-8 flex items-center justify-between h-16 sticky top-0 z-50">
        <a
          href="https://www.autocaregenius.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5"
        >
          <img
            src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200"
            alt="Auto Care Genius"
            className="h-7"
          />
          <div className="w-px h-6 bg-black/[0.07]" />
          <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px]">
            Genius <span className="text-[#cc0000]">Websites</span>
          </span>
        </a>

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
                  {onOpenProfile && (
                    <button
                      onClick={() => { setDropdownOpen(false); onOpenProfile(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#1a1a1a] hover:bg-[#faf9f7] transition-colors font-medium"
                    >
                      Profile
                    </button>
                  )}
                  {onSignOut && (
                    <button
                      onClick={() => { setDropdownOpen(false); onSignOut(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#cc0000] hover:bg-[#faf9f7] transition-colors font-medium border-t border-black/[0.05] mt-1 pt-2.5"
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
            {onOpenProfile && (
              <button
                onClick={() => { setMobileOpen(false); onOpenProfile(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#1a1a1a] hover:bg-black/[0.04] transition-colors"
              >
                Profile
              </button>
            )}
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

      <main className="max-w-5xl mx-auto px-3 py-4">
        {showWelcome && (
          <div className="relative mb-6 rounded-2xl border border-black/[0.07] bg-white shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#cc0000]" />
            <div className="px-8 py-7">
              <button
                onClick={() => setShowWelcome(false)}
                className="absolute top-4 right-5 text-[#aaa] hover:text-[#1a1a1a] text-xl leading-none transition-colors"
                aria-label="Dismiss"
              >
                ×
              </button>
              <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-2">Welcome to Pro</p>
              <h3 className="text-2xl font-[900] text-[#1a1a1a] tracking-tight mb-1">You're all set. Let's build.</h3>
              <p className="text-sm text-[#666] mb-5">Your Pro subscription is active. Here's everything you just unlocked:</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ['Bookings Calendar', 'Accept appointments online, 24/7'],
                  ['Customer CRM', 'Track every lead and returning client'],
                  ['Stripe Payments', 'Get paid directly from your website'],
                  ['Booking Deposits', 'Require deposits to lock in appointments'],
                ].map(([title, desc]) => (
                  <li key={title} className="flex items-start gap-3 bg-[#faf9f7] rounded-xl px-4 py-3">
                    <span className="mt-0.5 text-[#cc0000] font-black text-base leading-none">✓</span>
                    <span>
                      <span className="block text-sm font-[800] text-[#1a1a1a]">{title}</span>
                      <span className="block text-xs text-[#888]">{desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">Your Site</h2>
          <div className="flex items-center gap-2">
            {canCreateSite && sites.length > 0 && (
              <button
                type="button"
                onClick={onNewSite}
                className="text-xs font-semibold text-white bg-[#cc0000] hover:bg-[#aa0000] px-4 py-2 rounded-lg transition-colors"
              >
                + New Site
              </button>
            )}
            {!isPro && (
              <button
                type="button"
                onClick={() => setProDialogOpen(true)}
                className="text-xs text-[#888] bg-black/5 hover:bg-black/10 px-4 py-2 rounded-lg transition-colors"
              >
                Free plan
              </button>
            )}
          </div>
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
          <div className="bg-white border border-black/[0.07] rounded-2xl shadow-sm overflow-hidden">
            <div className="grid gap-8 p-8 sm:p-10">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex flex-col sm:flex-row gap-8 sm:items-center"
              >
                {/* Live preview thumbnail */}
                <div
                  className="relative w-full sm:w-[360px] h-[225px] shrink-0 overflow-hidden rounded-xl border border-black/[0.07] bg-[#faf9f7]"
                  style={{ pointerEvents: 'none' }}
                >
                  {site.published_url ? (
                    <iframe
                      src={site.custom_domain && site.custom_domain_status === 'active_ssl'
                        ? `https://www.${site.custom_domain}`
                        : site.published_url}
                      title={`${site.business_info?.businessName || 'Site'} preview`}
                      loading="lazy"
                      sandbox="allow-same-origin allow-scripts"
                      style={{
                        width: '1280px',
                        height: '800px',
                        border: 0,
                        transform: 'scale(0.281)',
                        transformOrigin: '0 0',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="text-[#aaa] mb-3">
                        <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M3 9h18M8 14h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <p className="text-[12px] font-semibold text-[#888] uppercase tracking-wider">Not published</p>
                      <p className="text-[12px] text-[#aaa] mt-1 leading-tight">Publish to see live preview</p>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-[18px] font-bold text-[#1a1a1a] truncate">
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
                  <p className="text-[13px] text-[#888]">
                    {site.template_id && <span className="text-[#555] font-medium">{TEMPLATES[site.template_id]?.name || site.template_id}</span>}
                    {site.template_id && ' · '}
                    {site.business_info?.city}, {site.business_info?.state} · {new Date(site.created_at).toLocaleDateString()}
                  </p>
                  {site.published_url && (() => {
                    // Prefer the custom domain once the site is live on it,
                    // otherwise fall back to the free subdomain.
                    const isCustomLive =
                      site.custom_domain && site.custom_domain_status === 'active_ssl';
                    const liveUrl = isCustomLive
                      ? `https://www.${site.custom_domain}`
                      : site.published_url;
                    const displayUrl = liveUrl.replace(/^https:\/\//, '');
                    return (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-green-600 hover:text-green-800 mt-1.5 inline-flex items-center gap-1 transition-colors"
                      >
                        <span className="truncate max-w-[260px]">{displayUrl}</span>
                        <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </a>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch sm:w-auto">
                  {onEditSite && (
                    <button
                      onClick={() => onEditSite(site)}
                      className="px-4 py-2 text-[13px] font-semibold bg-[#1a1a1a] text-white rounded-lg hover:bg-[#cc0000] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => setEditBizSite(site)}
                    className="px-4 py-2 text-[13px] font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                  >
                    Business Info
                  </button>
                  {site.published_url && (
                    <button
                      onClick={() => handleRepublish(site)}
                      className="px-4 py-2 text-[13px] font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                    >
                      Republish
                    </button>
                  )}
                  {CUSTOM_DOMAIN_ENABLED && (
                    isPro ? (
                      site.published_url ? (
                        <button
                          onClick={() => {
                            setDomainPanelSiteId(site.id);
                            setDomainPanelInitial({ domain: site.custom_domain, status: site.custom_domain_status });
                          }}
                          className="px-4 py-2 text-[13px] font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                        >
                          {site.custom_domain ? 'Manage Domain' : 'Add Domain'}
                        </button>
                      ) : (
                        <button
                          onClick={() => toast('Publish your site first, then you can connect a custom domain.', 'info')}
                          className="px-4 py-2 text-[13px] font-medium border border-black/10 rounded-lg text-[#888] hover:border-black/20 transition-colors"
                          title="Publish your site first"
                        >
                          Add Domain
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => setProDialogOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                        title="Custom domains are a Pro feature"
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="5.5" width="8" height="5" rx="1" />
                          <path d="M4 5.5V3.5a2 2 0 014 0V5.5" />
                        </svg>
                        Add Domain
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="px-4 py-2 text-[13px] font-medium text-[#888] hover:text-[#cc0000] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </main>

      {/* Long-form upgrade funnel — almost-full-width, non-Pro users only */}
      {!loading && !fetchError && sites.length > 0 && !isPro && (
        <section className="bg-[#faf9f7] border-t border-black/[0.07] px-4 sm:px-8 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto">
            <UpgradeFunnel onUpgrade={() => setProDialogOpen(true)} />
          </div>
        </section>
      )}

      {domainPanelSiteId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDomainPanelSiteId(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-7 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[18px] font-bold text-[#1a1a1a]">Custom Domain</p>
                <p className="text-[12px] text-[#888] mt-0.5">Connect a domain you already own.</p>
              </div>
              <button onClick={() => setDomainPanelSiteId(null)} className="text-[#888] hover:text-[#cc0000] text-xl leading-none">✕</button>
            </div>
            <CustomDomainPanel
              siteId={domainPanelSiteId}
              initialDomain={domainPanelInitial?.domain}
              initialStatus={domainPanelInitial?.status || 'disconnected'}
            />
          </div>
        </div>
      )}

      <UpgradeProDialog
        open={proDialogOpen}
        onClose={() => setProDialogOpen(false)}
        heading="Custom domains are a Pro feature"
        subheading="Connect your own domain (mybusiness.com) instead of the free subdomain — plus everything else included with Pro."
      />

      {editBizSite && (
        <EditBusinessInfoModal
          site={editBizSite}
          onClose={() => setEditBizSite(null)}
          onSaved={(updated) => {
            setSites((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          }}
        />
      )}
    </div>
  );
}
