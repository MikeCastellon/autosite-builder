import { useState } from 'react';
import AdminAccountsTab from './AdminAccountsTab.jsx';
import AdminAllBookingsTab from './AdminAllBookingsTab.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import AppHeader from '../ui/AppHeader.jsx';

export default function AdminPage({ onExit, onOpenBookings, onOpenCustomers, onOpenProfile, onSignOut }) {
  const { session, profile } = useAuth();
  const [tab, setTab] = useState('accounts');
  const userEmail = session?.user?.email;

  const headerProps = {
    active: 'admin',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin: () => {},
    onOpenProfile,
    onSignOut,
  };

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
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight mb-6">Admin</h2>
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <TabBtn on={tab === 'accounts'} onClick={() => setTab('accounts')}>Accounts</TabBtn>
          <TabBtn on={tab === 'bookings'} onClick={() => setTab('bookings')}>All bookings</TabBtn>
        </div>
        {tab === 'accounts' ? <AdminAccountsTab onViewOwnerBookings={() => setTab('bookings')} /> : <AdminAllBookingsTab />}
      </main>
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
