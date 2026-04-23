import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import BookingsView from '../bookings/BookingsView.jsx';
import SchedulerSettings from '../booking-settings/SchedulerSettings.jsx';
import SubscribeGate from './SubscribeGate.jsx';
import AppHeader from '../../ui/AppHeader.jsx';

export default function BookingsPage({ userId, profile, userEmail, onExit, onOpenAdmin, onSignOut }) {
  const headerProps = {
    active: 'bookings',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings: () => {},
    onOpenAdmin,
    onSignOut,
  };
  const [tab, setTab] = useState('schedule');
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

  if (loading) return <div className="p-10 text-gray-500">Loading…</div>;
  if (err) return <div className="p-10 text-red-600">{err}</div>;

  if (sites.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight mb-4">Bookings</h2>
          <p className="text-gray-600">Create a site first — bookings attach to a published site.</p>
        </main>
      </div>
    );
  }

  return (
    <SubscribeGate profile={profile} onExit={onExit}>
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />

        <main className="max-w-5xl mx-auto px-6 py-10">
          <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight mb-6">Bookings</h2>
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
      </div>
    </SubscribeGate>
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
