import { useEffect, useState } from 'react';
import AdminAccountsTab from './AdminAccountsTab.jsx';
import AdminAllBookingsTab from './AdminAllBookingsTab.jsx';
import AdminCustomSitesTab from './AdminCustomSitesTab.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';

export default function AdminPage({ onExit }) {
  const { profile } = useAuth();
  // Deep link from the custom website emails: /?admin=custom-sites&project=<id>
  const [deepLink] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') ? { tab: params.get('admin'), project: params.get('project') } : null;
  });
  const [tab, setTab] = useState(deepLink?.tab === 'custom-sites' ? 'custom-sites' : 'accounts');

  useEffect(() => {
    if (deepLink) window.history.replaceState({}, '', window.location.pathname);
  }, [deepLink]);

  if (!profile) return <div className="p-10 text-gray-500">Loading…</div>;
  if (!profile.is_super_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-center">
          <p className="text-gray-600 mb-3">You don't have access to this area.</p>
          <button onClick={onExit} className="text-sm text-[#1a1a1a] hover:text-[#cc0000] underline">Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 py-10">
      <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-6">Admin</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabBtn on={tab === 'accounts'} onClick={() => setTab('accounts')}>Accounts</TabBtn>
        <TabBtn on={tab === 'bookings'} onClick={() => setTab('bookings')}>All bookings</TabBtn>
        <TabBtn on={tab === 'custom-sites'} onClick={() => setTab('custom-sites')}>Custom websites</TabBtn>
      </div>
      {tab === 'accounts' && <AdminAccountsTab />}
      {tab === 'bookings' && <AdminAllBookingsTab />}
      {tab === 'custom-sites' && <AdminCustomSitesTab initialProjectId={deepLink?.project || null} />}
    </main>
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
