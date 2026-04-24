import { useEffect, useState } from 'react';
import {
  loadSchedulerConfig,
  setSchedulerEnabled,
  initializeSchedulerConfig,
  defaultSchedulerConfig,
  mergeServicesFromBusinessInfo,
  saveSchedulerConfig,
} from '../../../lib/schedulerConfig.js';
import GeneralTab from './GeneralTab.jsx';
import ServicesTab from './ServicesTab.jsx';
import AvailabilityTab from './AvailabilityTab.jsx';

export default function SchedulerSettings({ siteId, onExit }) {
  const [tab, setTab] = useState('general');
  const [site, setSite] = useState(null);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);

  // Auto-sync: if the site's business_info.services has items the scheduler
  // config doesn't yet know about, merge them in and persist silently.
  async function autoSyncServices(siteRow) {
    const cfg = siteRow.scheduler_config || {};
    const existing = cfg.services || [];
    const merged = mergeServicesFromBusinessInfo(existing, siteRow.business_info?.services);
    if (merged.length === existing.length) return cfg;
    return saveSchedulerConfig(siteId, { services: merged });
  }

  async function refresh() {
    try {
      const s = await loadSchedulerConfig(siteId);
      if (!s) { setErr('Site not found'); return; }
      let cfg;
      if (s.scheduler_enabled && (!s.scheduler_config || !s.scheduler_config.availability)) {
        cfg = await initializeSchedulerConfig(siteId);
      } else {
        cfg = s.scheduler_config || defaultSchedulerConfig();
      }
      const synced = await autoSyncServices({ ...s, scheduler_config: cfg });
      setSite({ ...s, scheduler_config: synced });
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [siteId]);

  function onSaved(newConfig) {
    setSite((prev) => ({ ...prev, scheduler_config: newConfig }));
  }

  async function toggleEnabled(next) {
    await setSchedulerEnabled(siteId, next);
    if (next) await initializeSchedulerConfig(siteId);
    refresh();
  }

  function openCustomerPreview() {
    // Tear down any previous preview
    const oldScript = document.getElementById('acg-scheduler-customer-preview-script');
    if (oldScript) oldScript.remove();
    const oldModal = document.getElementById('acg-scheduler-modal');
    if (oldModal) oldModal.remove();

    const s = document.createElement('script');
    s.id = 'acg-scheduler-customer-preview-script';
    s.src = window.location.origin + '/scheduler.js?t=' + Date.now();
    s.setAttribute('data-site-id', siteId);
    s.setAttribute('data-auto-open', 'true');
    s.defer = true;
    document.body.appendChild(s);
  }

  if (err) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-black/[0.07] shadow-sm">
      <p className="text-[#cc0000] font-semibold mb-3">{err}</p>
      {onExit && <button onClick={onExit} className="text-sm font-semibold underline text-[#1a1a1a]">Back</button>}
    </div>
  );
  if (!site) return <div className="p-16 text-center text-gray-500 bg-white rounded-2xl border border-black/[0.07] shadow-sm">Loading…</div>;

  const isEnabled = !!site.scheduler_enabled;

  // Build the standalone booking link. Prefer the custom domain once it has
  // a valid SSL certificate; otherwise fall back to the published subdomain.
  // The `#book` hash is handled by public/scheduler.js — it auto-opens the
  // booking modal on page load so customers land directly on the scheduler.
  const siteOrigin = site.custom_domain && site.custom_domain_status === 'active_ssl'
    ? `https://www.${site.custom_domain}`
    : site.published_url;
  const bookingLink = siteOrigin ? `${siteOrigin.replace(/\/$/, '')}/#book` : null;

  async function copyBookingLink() {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers — select the input and let the user copy manually
    }
  }

  return (
    <div>
      {/* Status card: toggle + preview */}
      <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm p-5 sm:p-6 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            onClick={() => toggleEnabled(!isEnabled)}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${isEnabled ? 'bg-[#cc0000]' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[#1a1a1a] tracking-[-0.2px]">
              {isEnabled ? 'Bookings are live' : 'Bookings are off'}
            </p>
            <p className="text-[12px] text-[#888] mt-0.5">
              {isEnabled
                ? 'Customers see your Book Now button on the published site.'
                : 'Turn on to enable the Book Now button on your published site.'}
            </p>
          </div>
        </div>
        {isEnabled && (
          <button
            onClick={openCustomerPreview}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-lg border border-black/10 bg-white text-[#1a1a1a] hover:border-[#cc0000] hover:text-[#cc0000] transition-colors shrink-0"
            title="Opens the real customer-facing modal in an overlay"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview as customer
          </button>
        )}
      </div>

      {/* Standalone booking link — share with customers so they can book
          directly without visiting the full site first. */}
      {isEnabled && bookingLink && (
        <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#cc0000]/6"
              style={{ background: 'rgba(204,0,0,0.06)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#1a1a1a] tracking-[-0.2px]">
                Standalone booking link
              </p>
              <p className="text-[12px] text-[#888] mt-0.5">
                Share this link with customers via text, email, or social. It opens the booking modal instantly — no clicks required.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={bookingLink}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 px-3 py-2 text-[13px] font-mono text-[#1a1a1a] bg-[#faf9f7] border border-black/10 rounded-lg focus:outline-none focus:border-[#cc0000]"
            />
            <button
              type="button"
              onClick={copyBookingLink}
              className="shrink-0 text-[13px] font-semibold px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {/* Prompt to publish the site if bookings are enabled but there's no URL yet */}
      {isEnabled && !bookingLink && (
        <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm p-5 sm:p-6 mb-6">
          <p className="text-[13px] text-[#555]">
            Publish your site to get a shareable booking link.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
        <div className="flex gap-1 border-b border-black/[0.05] px-4 sm:px-6 pt-3">
          <TabBtn on={tab === 'general'} onClick={() => setTab('general')}>General</TabBtn>
          <TabBtn on={tab === 'services'} onClick={() => setTab('services')}>Services</TabBtn>
          <TabBtn on={tab === 'availability'} onClick={() => setTab('availability')}>Availability</TabBtn>
        </div>
        <div className="p-5 sm:p-6">
          {tab === 'general' && <GeneralTab siteId={siteId} config={site.scheduler_config} siteImages={site.generated_content?._images} onSaved={onSaved} />}
          {tab === 'services' && <ServicesTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
          {tab === 'availability' && <AvailabilityTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ on, onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${on ? 'border-[#cc0000] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-900'} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
