// src/components/dashboard/charges/ChargesPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import ChargeModal from './ChargeModal.jsx';

function formatCents(cents) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-800">
        Paid
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
      Awaiting payment
    </span>
  );
}

export default function ChargesPage({
  userId,
  profile,
  userEmail,
  autoOpen = false,
  onExit,
  onOpenOverview,
  onOpenInquiries,
  onOpenBookings,
  onOpenCustomers,
  onOpenAdmin,
  onOpenProfile,
  onOpenPaymentsConnect,
  onOpenCharges,
  onCharge,
  onSignOut,
}) {
  const headerProps = {
    active: 'charges',
    userEmail,
    profile,
    onOpenOverview,
    onMySites: onExit,
    onOpenInquiries,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onOpenCharges: () => {},
    onCharge,
    onSignOut,
  };

  const [charges, setCharges] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (autoOpen) setShowModal(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fullyConnected = profile?.stripe_connect_account_id && profile?.stripe_connect_charges_enabled;

  async function fetchCharges() {
    const { data } = await supabase
      .from('charges')
      .select('*')
      .order('created_at', { ascending: false });
    setCharges(data || []);
  }

  async function fetchSites() {
    // Order by most-recently-updated first so the site the owner is
    // actively configuring wins the per-name dedupe below. Without this,
    // an owner who just added an add-on to one site might see the older
    // site's version of the same service (without the add-on).
    const { data } = await supabase
      .from('sites')
      .select('id, scheduler_config, updated_at')
      .eq('user_id', userId)
      .not('published_url', 'is', null)
      .order('updated_at', { ascending: false });
    setSites(data || []);
  }

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchCharges(), fetchSites()]).finally(() => setLoading(false));
  }, [userId]);

  // Flatten services across all the owner's sites, deduping by name. Each
  // service carries its origin _site_id so the charge is created against
  // the correct site (matters when add-ons differ across sites).
  const services = [];
  const seenNames = new Set();
  for (const site of sites) {
    for (const svc of (site.scheduler_config?.services || [])) {
      if (svc.enabled !== false && !seenNames.has(svc.name)) {
        seenNames.add(svc.name);
        services.push({ ...svc, _site_id: site.id });
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={profile}
        heading="Charges is a Pro feature"
        subheading="Connect your Stripe account and upgrade to Pro to charge customers in person."
      >
        <main className="max-w-7xl mx-auto px-3 py-10">
          <div className="mb-6 mt-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">Charges</h1>
              <p className="text-sm text-[#888] mt-1">In-person payments collected from customers.</p>
            </div>
            {fullyConnected && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#cc0000] hover:bg-[#a80000] text-white font-bold text-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Charge
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
            </div>
          ) : charges.length === 0 ? (
            <div className="rounded-xl border border-black/[0.07] bg-white p-10 text-center">
              <p className="text-[#888] text-sm mb-4">No charges yet.</p>
              {fullyConnected && (
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#cc0000] hover:bg-[#a80000] text-white font-bold text-sm transition-colors"
                >
                  Charge a customer →
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-black/[0.07] bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.07] bg-[#faf9f7]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Service / Amount</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wide hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge, i) => (
                    <tr key={charge.id} className={i < charges.length - 1 ? 'border-b border-black/[0.05]' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1a1a1a]">{charge.customer_name || <span className="text-[#aaa]">—</span>}</p>
                        {charge.customer_phone && <p className="text-[11px] text-[#888]">{charge.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1a1a1a]">{formatCents(charge.amount_cents)}</p>
                        {charge.service_name && <p className="text-[11px] text-[#888]">{charge.service_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={charge.status} />
                      </td>
                      <td className="px-4 py-3 text-[#888] hidden sm:table-cell">
                        {formatDate(charge.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </SubscribeGate>

      {showModal && (
        <ChargeModal
          userId={userId}
          profile={profile}
          services={services}
          siteId={sites[0]?.id || null}
          onClose={() => { setShowModal(false); fetchCharges(); }}
        />
      )}
    </div>
  );
}
