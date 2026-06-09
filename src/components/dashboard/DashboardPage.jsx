import { useEffect, useState } from 'react';
import { supabase, isImpersonationTab } from '../../lib/supabase.js';
import { publishSite } from '../../lib/publishSite.js';
import { TEMPLATES } from '../../data/templates.js';
import { CHANGELOG, formatChangelogDate } from '../../data/changelog.js';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import CustomDomainPanel from '../CustomDomainPanel.jsx';
import UpgradeProDialog from '../ui/UpgradeProDialog.jsx';
import CustomWebsitePromoModal from '../ui/CustomWebsitePromoModal.jsx';
import EditBusinessInfoModal from './EditBusinessInfoModal.jsx';
import UpgradeFunnel from './UpgradeFunnel.jsx';
import AppHeader from '../ui/AppHeader.jsx';
import ShareBookingCard from './booking-only/ShareBookingCard.jsx';

function bookingUrlFor(site) {
  if (!site?.published_url) return '';
  return site.site_type === 'booking_only' ? site.published_url : `${site.published_url}/book`;
}

const MAX_SITES = 1;
const CUSTOM_DOMAIN_ENABLED = import.meta.env.VITE_CUSTOM_DOMAIN_ENABLED === 'true';
// Two-stage dismissal for the custom-website upsell:
//   1) Popup closes → a small "Looking to upgrade?" banner takes its place
//      in the bottom-left so the offer is still recoverable in one click.
//   2) Banner closes (the X on the banner) → 30-day cooldown starts;
//      neither popup nor banner shows until the cooldown expires.
const CUSTOM_PROMO_SEEN_KEY = 'gw.customWebsitePromoSeen';
const CUSTOM_PROMO_DISMISSED_KEY = 'gw.customWebsitePromoDismissedAt';
const CUSTOM_PROMO_REPROMPT_MS = 30 * 24 * 60 * 60 * 1000;
// Delay before the popup appears on a fresh dashboard mount.
const CUSTOM_PROMO_DELAY_MS = 1500;

// Per-entry dismiss key. Once an owner X's a "What's New" banner, that
// specific update stays dismissed forever (the next entry shipping will
// surface as a fresh banner with its own dismiss key). Profile → What's
// New still shows the full archive regardless of dismissals.
const NEWS_DISMISS_PREFIX = 'gw.dashNews.dismissed.';

function ChangelogBullets({ items }) {
  return (
    <ul className="text-sm text-[#52525b] space-y-1.5 leading-snug">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-[#cc0000] font-bold shrink-0">·</span>
          <span>
            <strong className="text-[#1a1a1a] font-semibold">{item.strong}</strong> {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DashboardNewsBanner() {
  const latest = CHANGELOG[0];
  const older = CHANGELOG.slice(1);
  const storageKey = latest ? `${NEWS_DISMISS_PREFIX}${latest.id}` : null;

  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey) return true;
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const [showOlder, setShowOlder] = useState(false);

  if (!latest || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="relative bg-[#f4f4f5] border border-[#e4e4e7] rounded-2xl p-5 sm:p-6 mb-6">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 w-7 h-7 rounded-full text-[#888] hover:text-[#1a1a1a] hover:bg-black/5 flex items-center justify-center transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#cc0000] mb-2">What's New · {formatChangelogDate(latest.date)}</p>
      <h3 className="text-lg sm:text-xl font-black text-[#1a1a1a] mb-3 leading-tight pr-10">
        {latest.title}
      </h3>
      <ChangelogBullets items={latest.items} />

      {older.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#e4e4e7]">
          <button
            type="button"
            onClick={() => setShowOlder((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#666] hover:text-[#1a1a1a] transition-colors"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
              style={{ transform: showOlder ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
            >
              <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {showOlder ? 'Hide previous updates' : `See ${older.length} previous update${older.length === 1 ? '' : 's'}`}
          </button>
          {showOlder && (
            <div className="mt-3 space-y-4">
              {older.map((entry) => (
                <div key={entry.id} className="bg-white border border-[#e4e4e7] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#888] mb-1">{formatChangelogDate(entry.date)}</p>
                  <h4 className="text-sm font-bold text-[#1a1a1a] mb-2 leading-tight">{entry.title}</h4>
                  <ChangelogBullets items={entry.items} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage({ onNewSite, onNewBookingPage, onEditSite, onSignOut, userEmail, profile, onOpenAdmin, onOpenInquiries, onOpenBookings, onOpenCustomers, onOpenProfile, onOpenPaymentsConnect, onOpenCharges, onCharge, onOpenBookingSettings, onPreviewDemo }) {
  const { toast, confirm: confirmDialog } = useAlert();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [domainPanelSiteId, setDomainPanelSiteId] = useState(null);
  const [domainPanelInitial, setDomainPanelInitial] = useState(null);
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [editBizSite, setEditBizSite] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [customPromoOpen, setCustomPromoOpen] = useState(false);
  const [customBannerOpen, setCustomBannerOpen] = useState(false);
  const schedulerEnabled = !!profile?.scheduler_enabled;
  const isAdmin = !!profile?.is_super_admin;
  const isPro = isEffectiveSchedulerActive(profile);
  // Block site creation while impersonating — admin shouldn't be able to
  // spawn a new site under the customer's account.
  const canCreateSite = !isImpersonationTab && (isAdmin || sites.length < MAX_SITES);

  const headerProps = {
    active: 'sites',
    userEmail,
    profile,
    onMySites: () => {}, // already on dashboard
    onOpenInquiries,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onOpenCharges,
    onCharge,
    onSignOut,
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_success') === '1') {
      setShowWelcome(true);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setShowWelcome(false), 60_000);
    }
  }, []);

  // Custom-website upsell decision tree on dashboard mount:
  //   - Within the 30-day cooldown (banner was X'd recently) → show nothing
  //   - User has seen the popup before but hasn't X'd the banner →
  //     show the banner only (no auto-popup nag)
  //   - Fresh visitor → auto-show the popup after a short delay
  //   - Just upgraded via Stripe → suppress everything to avoid stacking
  //     with the welcome flash
  useEffect(() => {
    let inCooldown = false;
    let popupSeen = false;
    try {
      const raw = window.localStorage.getItem(CUSTOM_PROMO_DISMISSED_KEY);
      const dismissedAt = raw ? Number(raw) : 0;
      if (Number.isFinite(dismissedAt) && dismissedAt > 0 &&
          Date.now() - dismissedAt < CUSTOM_PROMO_REPROMPT_MS) {
        inCooldown = true;
      }
      popupSeen = window.localStorage.getItem(CUSTOM_PROMO_SEEN_KEY) === '1';
    } catch { /* localStorage unavailable — show fresh */ }

    const params = new URLSearchParams(window.location.search);
    const justUpgraded = params.get('stripe_success') === '1';
    if (inCooldown || justUpgraded) return;

    if (popupSeen) {
      setCustomBannerOpen(true);
      return;
    }
    const t = setTimeout(() => setCustomPromoOpen(true), CUSTOM_PROMO_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const handleCustomPromoClose = () => {
    setCustomPromoOpen(false);
    setCustomBannerOpen(true);
    try {
      window.localStorage.setItem(CUSTOM_PROMO_SEEN_KEY, '1');
    } catch { /* ignore */ }
  };

  const handleReopenCustomPromo = () => {
    // Banner click — just re-open the popup. Banner stays "open" in state
    // so it returns when the popup closes again, and we don't write to
    // dismissedAt (that's reserved for the explicit X on the banner).
    setCustomPromoOpen(true);
  };

  const handleBannerDismiss = () => {
    // Explicit X on the banner — the user is telling us "stop showing me
    // this." Start the 30-day cooldown.
    setCustomBannerOpen(false);
    try {
      window.localStorage.setItem(CUSTOM_PROMO_DISMISSED_KEY, String(Date.now()));
    } catch { /* ignore */ }
  };

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

    // Unpublish first so the auth-gated function can still verify
    // ownership. If we deleted the DB row first, the ownership check
    // would 404 and the published HTML would be orphaned forever.
    if (site?.slug) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          await fetch('/.netlify/functions/unpublish-site', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ siteId: site.id }),
          });
        }
      } catch { /* best-effort — proceed with DB delete either way */ }
    }

    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) {
      toast('Failed to delete site. Please try again.', 'error');
      return;
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

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />

      <main className="max-w-7xl mx-auto px-3 py-10">
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

        <DashboardNewsBanner />

        <div className="flex items-center justify-between mb-3 mt-8">
          <h2 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">Your Site</h2>
          <div className="flex items-center gap-2">
            {isAdmin && onPreviewDemo && (
              <button
                type="button"
                onClick={() => onPreviewDemo()}
                title="Open the editor with stub data — testing & demoing only, admin-only"
                className="text-xs font-semibold text-[#1a1a1a] bg-white border border-black/[0.12] hover:bg-black/5 px-4 py-2 rounded-lg transition-colors"
              >
                Preview Demo
              </button>
            )}
            {canCreateSite && sites.length > 0 && (
              <button
                type="button"
                onClick={onNewSite}
                className="text-xs font-semibold text-white bg-[#cc0000] hover:bg-[#aa0000] px-4 py-2 rounded-lg transition-colors"
              >
                + New Site
              </button>
            )}
            {onNewBookingPage && sites.length > 0 && (
              <button
                type="button"
                onClick={onNewBookingPage}
                className="text-xs font-semibold text-[#1a1a1a] bg-white border border-black/[0.12] hover:bg-black/5 px-4 py-2 rounded-lg transition-colors"
              >
                Create booking page (no website)
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
            {!isImpersonationTab && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onNewSite}
                  className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  Build My Site
                </button>
                {onNewBookingPage && (
                  <button
                    onClick={onNewBookingPage}
                    className="px-6 py-3 bg-white border border-black/[0.12] hover:bg-black/5 text-[#1a1a1a] rounded-xl font-semibold text-sm transition-colors"
                  >
                    Create booking page (no website)
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-black/[0.07] rounded-2xl shadow-sm overflow-hidden">
            <div className="grid gap-4 px-4 py-6 sm:px-16 sm:py-10 md:px-24 md:py-14">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                {/* Live preview thumbnail */}
                <div
                  className="relative w-full sm:w-[280px] h-[175px] shrink-0 overflow-hidden rounded-xl border border-black/[0.07] bg-[#faf9f7]"
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
                        transform: 'scale(0.219)',
                        transformOrigin: 'top center',
                        marginLeft: 'calc(50% - 640px)',
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
                  {(site.site_type === 'booking_only' || site.scheduler_enabled) && (
                    <div className="mt-3">
                      <ShareBookingCard bookingUrl={bookingUrlFor(site)} />
                    </div>
                  )}
                </div>

                {/* Actions — hidden entirely while impersonating so the
                    admin can't accidentally Edit, Delete, Republish, or
                    re-config the customer's site on their behalf. The
                    "VIEWING AS …" banner makes the read-only context
                    obvious; this just enforces it. */}
                {!isImpersonationTab && (
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch sm:w-auto">
                  {site.site_type !== 'booking_only' && (
                    <>
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
                    </>
                  )}
                  {site.site_type === 'booking_only' && onOpenBookingSettings && (
                    <button
                      onClick={() => onOpenBookingSettings(site.id)}
                      className="px-4 py-2 text-[13px] font-semibold bg-[#1a1a1a] text-white rounded-lg hover:bg-[#cc0000] transition-colors"
                    >
                      Booking Settings
                    </button>
                  )}
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
                )}
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

      {/* Custom-website upsell banner. Fixed-position bottom-left so it
          stays available without occupying flow space. Hidden while the
          popup itself is open (avoid visual stacking) and during the
          30-day cooldown after the user X's it. */}
      {customBannerOpen && !customPromoOpen && (
        <div
          className="fixed bottom-4 left-4 z-40 max-w-[280px] bg-white border border-black/[0.10] rounded-xl shadow-lg overflow-hidden"
          role="region"
          aria-label="Custom website upsell"
        >
          <button
            type="button"
            onClick={handleReopenCustomPromo}
            className="block w-full text-left pl-4 pr-10 pt-3 pb-3 hover:bg-[#faf9f7] transition-colors"
          >
            <span className="block text-[10px] font-bold uppercase tracking-[2px] text-[#cc0000] mb-1">
              Looking to upgrade?
            </span>
            <span className="block text-[13px] font-bold text-[#1a1a1a] leading-snug">
              Custom website — $499
            </span>
            <span className="block text-[11px] text-[#888] mt-0.5">
              Designed and built for you
            </span>
          </button>
          <button
            type="button"
            onClick={handleBannerDismiss}
            aria-label="Dismiss for 30 days"
            className="absolute top-2 right-2 w-7 h-7 rounded-full text-[#888] hover:text-[#1a1a1a] hover:bg-black/[0.05] flex items-center justify-center transition-colors z-10"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
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

      <CustomWebsitePromoModal
        open={customPromoOpen}
        onClose={handleCustomPromoClose}
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
