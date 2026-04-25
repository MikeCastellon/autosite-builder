import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase.js';
import BookingsView from '../bookings/BookingsView.jsx';
import SchedulerSettings from '../booking-settings/SchedulerSettings.jsx';
import SubscribeGate from './SubscribeGate.jsx';
import AppHeader from '../../ui/AppHeader.jsx';

export default function BookingsPage({ userId, profile, userEmail, onExit, onOpenCustomers, onOpenAdmin, onOpenProfile, onOpenPaymentsConnect, onSignOut }) {
  const headerProps = {
    active: 'bookings',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings: () => {},
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onSignOut,
  };
  const [tab, setTab] = useState('schedule');
  const [copied, setCopied] = useState(false);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [activeSiteId, setActiveSiteId] = useState(null);

  useEffect(() => {
    async function fetchSites() {
      const { data, error } = await supabase
        .from('sites')
        .select('id, business_info, scheduler_enabled, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) { setErr(error.message); setLoading(false); return; }
      setSites(data || []);
      if ((data || []).length > 0) setActiveSiteId(data[0].id);
      setLoading(false);
    }
    if (userId) fetchSites();
  }, [userId]);

  // Loading + error + empty all keep the AppHeader rendered so the nav doesn't
  // flash blank between page transitions — same shell pattern as the dashboard.
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-7xl mx-auto px-3 py-10">
          <p className="text-[#888] text-sm">Loading...</p>
        </main>
      </div>
    );
  }
  if (err) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-7xl mx-auto px-3 py-10">
          <div className="border border-[#cc0000]/20 rounded-xl p-4 text-sm text-[#cc0000] bg-[#cc0000]/5">{err}</div>
        </main>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-3 py-10">
          <p className="text-gray-600">Create a site first — bookings attach to a published site.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <SubscribeGate profile={profile}>
        <main className="max-w-7xl mx-auto px-3 py-10">
          <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-3">Bookings</h1>

          {/* Booking link bar */}
          {(() => {
            const site = sites.find(s => s.id === activeSiteId) || sites[0];
            if (!site?.published_url) return null;
            const isCustomLive = site.custom_domain && site.custom_domain_status === 'active_ssl';
            const bookingUrl = isCustomLive ? `https://www.${site.custom_domain}` : site.published_url;
            return (
              <div className="flex items-center gap-2 mb-4 bg-white border border-black/[0.07] rounded-xl px-3 py-2 shadow-sm">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                <span className="text-[12px] font-semibold text-[#888] shrink-0">Booking link:</span>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#1a1a1a] hover:text-[#cc0000] truncate transition-colors flex-1">{bookingUrl.replace(/^https?:\/\//, '')}</a>
                <button
                  onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            );
          })()}

          <div className="flex gap-1 mb-6 border-b border-gray-200">
            <TabBtn on={tab === 'schedule'} onClick={() => setTab('schedule')}>Schedule</TabBtn>
            <TabBtn on={tab === 'settings'} onClick={() => setTab('settings')}>Settings</TabBtn>
          </div>

          {tab === 'settings' && sites.length > 1 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Site</label>
              <select
                value={activeSiteId || ''}
                onChange={(e) => setActiveSiteId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.business_info?.businessName || s.id}</option>
                ))}
              </select>
            </div>
          )}

          {tab === 'schedule' && <BookingsView userId={userId} />}
          {tab === 'settings' && activeSiteId && <SchedulerSettings siteId={activeSiteId} />}
        </main>
      </SubscribeGate>
    </div>
  );
}

function TabBtn({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${on ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}
