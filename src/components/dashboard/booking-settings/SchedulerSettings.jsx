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
