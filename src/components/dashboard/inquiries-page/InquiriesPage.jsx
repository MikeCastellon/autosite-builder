import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import AppHeader from '../../ui/AppHeader.jsx';
import InquiriesView from '../inquiries/InquiriesView.jsx';

export default function InquiriesPage({
  userId, profile, userEmail, onExit,
  onOpenBookings, onOpenCustomers, onOpenAdmin, onOpenProfile,
  onOpenPaymentsConnect, onOpenCharges, onCharge, onSignOut,
}) {
  const headerProps = {
    active: 'inquiries',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenInquiries: () => {},
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onOpenCharges,
    onCharge,
    onSignOut,
  };

  const isAdmin = !!profile?.is_super_admin;
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    async function fetchSites() {
      const { data, error } = await supabase
        .from('sites')
        .select('id, business_info, published_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) { setErr(error.message); setLoading(false); return; }
      setSites(data || []);
      setLoading(false);
    }
    if (userId) fetchSites();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-7xl mx-auto px-3 py-10"><p className="text-[#888] text-sm">Loading...</p></main>
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
  if (!isAdmin && sites.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-3 py-10">
          <p className="text-gray-600">Create and publish a site first — your contact form lives on your published site.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <main className="max-w-7xl mx-auto px-3 py-10">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-3 mt-8">Inquiries</h1>
        <p className="text-sm text-gray-500 mb-6">Messages people sent through your site's contact form.</p>
        <InquiriesView userId={userId} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
