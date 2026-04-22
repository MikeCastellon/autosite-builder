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
import PreviewTab from './PreviewTab.jsx';

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

  if (err) return (
    <div className="text-center py-10">
      <p className="text-red-600 mb-3">{err}</p>
      {onExit && <button onClick={onExit} className="text-sm underline text-[#1a1a1a]">Back</button>}
    </div>
  );
  if (!site) return <div className="p-10 text-gray-500">Loading…</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 text-sm text-gray-600">
        <span>Bookings:</span>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!site.scheduler_enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
          />
          <span className="font-semibold">{site.scheduler_enabled ? 'Live on site' : 'Off'}</span>
        </label>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabBtn on={tab === 'general'} onClick={() => setTab('general')}>General</TabBtn>
        <TabBtn on={tab === 'services'} onClick={() => setTab('services')}>Services</TabBtn>
        <TabBtn on={tab === 'availability'} onClick={() => setTab('availability')}>Availability</TabBtn>
        <TabBtn on={tab === 'preview'} onClick={() => setTab('preview')} disabled={!site.scheduler_enabled}>Preview</TabBtn>
      </div>

      {tab === 'general' && <GeneralTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
      {tab === 'services' && <ServicesTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
      {tab === 'availability' && <AvailabilityTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
      {tab === 'preview' && site.scheduler_enabled && <PreviewTab siteId={siteId} />}
    </div>
  );
}

function TabBtn({ on, onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${on ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
