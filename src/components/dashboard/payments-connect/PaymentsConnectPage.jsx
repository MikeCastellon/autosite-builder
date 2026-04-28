// src/components/dashboard/payments-connect/PaymentsConnectPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { createConnectAccount, fetchAccountLink } from '../../../lib/stripeConnect.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import ConnectStatusBadge from './ConnectStatusBadge.jsx';

export default function PaymentsConnectPage({
  userId,
  profile: initialProfile,
  userEmail,
  onExit,
  onOpenBookings,
  onOpenCustomers,
  onOpenAdmin,
  onOpenProfile,
  onOpenPaymentsConnect,
  onOpenCharges,
  onSignOut,
}) {
  const headerProps = {
    active: 'payments-connect',
    userEmail,
    profile: initialProfile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect: () => {},
    onOpenCharges,
    onSignOut,
  };

  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function refreshProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data);
  }

  // On mount: refresh profile + handle return from Stripe hosted onboarding
  useEffect(() => {
    if (!userId) return;
    refreshProfile();

    const params = new URLSearchParams(window.location.search);
    if (params.has('payments_return') || params.has('payments_refresh')) {
      // Clean the URL then re-poll a couple times to catch webhook updates
      window.history.replaceState({}, '', window.location.pathname);
      const poll = setInterval(refreshProfile, 3000);
      setTimeout(() => clearInterval(poll), 15000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function startSetup() {
    setLoading(true);
    setErr(null);
    try {
      await createConnectAccount();
      const { url } = await fetchAccountLink();
      window.location.href = url;
    } catch (e) {
      setErr(e.message || 'Could not start setup. Please try again.');
      setLoading(false);
    }
  }

  async function resumeSetup() {
    setLoading(true);
    setErr(null);
    try {
      const { url } = await fetchAccountLink();
      window.location.href = url;
    } catch (e) {
      setErr(e.message || 'Could not open Stripe. Please try again.');
      setLoading(false);
    }
  }

  const accountId  = profile?.stripe_connect_account_id;
  const charges    = !!profile?.stripe_connect_charges_enabled;
  const payouts    = !!profile?.stripe_connect_payouts_enabled;
  const submitted  = !!profile?.stripe_connect_details_submitted;
  const fullyConnected = accountId && charges && payouts && submitted;
  const setupStarted   = !!accountId && !fullyConnected;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={initialProfile}
        heading="Payments is a Pro feature"
        subheading="Connect your Stripe account to take deposits, charge customers, and get paid out."
      >
        <main className="max-w-7xl mx-auto px-3 py-10">
          <div className="mb-6 mt-8">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">Payments</h1>
              <ConnectStatusBadge profile={profile} />
            </div>
            <p className="text-sm text-[#888] mt-2">
              Connect your Stripe account to accept deposits and charge customers directly from your phone.
            </p>
          </div>

          {fullyConnected ? (
            /* ── Fully connected ── */
            <div className="rounded-xl border border-black/[0.07] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#e8f5ec] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a8f3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#1a1a1a] text-[15px]">Stripe account connected</p>
                  <p className="text-xs text-[#888]">You're ready to accept deposits and payments.</p>
                </div>
              </div>
              <p className="text-sm text-[#555] mb-4">
                Need to update your bank account, view payouts, or change your settings?
              </p>
              <a
                href="https://dashboard.stripe.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-black/[0.1] bg-white hover:bg-[#faf9f7] text-[#1a1a1a] text-sm font-semibold transition-colors"
              >
                Open Stripe Dashboard
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            {/* Charge CTA */}
            <div className="rounded-xl border border-black/[0.07] bg-white p-6 shadow-sm mt-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#fff0f0] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1a1a1a] text-[15px]">Charge a customer</p>
                  <p className="text-sm text-[#555] mt-1 mb-4">
                    Send a Stripe Checkout link via QR code or SMS. The customer pays on their phone — you see it land instantly.
                  </p>
                  {onOpenCharges && (
                    <button
                      type="button"
                      onClick={onOpenCharges}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[13px] font-semibold transition-colors"
                    >
                      Charge $
                    </button>
                  )}
                </div>
              </div>
            </div>

          ) : setupStarted ? (
            /* ── Account created but onboarding not finished ── */
            <div className="rounded-xl border border-black/[0.07] bg-white p-8 shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-[#fff7e6] flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b37400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p className="font-semibold text-[#1a1a1a] mb-1">Setup not finished</p>
              <p className="text-sm text-[#555] mb-5">
                Your Stripe account was created but onboarding isn't complete. Continue where you left off.
              </p>
              {err && <p className="text-sm text-[#cc0000] mb-4">{err}</p>}
              <button
                type="button"
                onClick={resumeSetup}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Opening Stripe…' : 'Continue Stripe setup →'}
              </button>
            </div>

          ) : (
            /* ── Not started ── */
            <div className="rounded-xl border border-black/[0.07] bg-white p-8 shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-[#f2f0ec] flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </div>
              <p className="font-semibold text-[#1a1a1a] mb-1">Connect your Stripe account</p>
              <p className="text-sm text-[#555] mb-5">
                We'll create a Stripe account for you and walk through the quick setup. Takes about 2 minutes.
              </p>
              {err && <p className="text-sm text-[#cc0000] mb-4">{err}</p>}
              <button
                type="button"
                onClick={startSetup}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Opening Stripe…' : 'Start Stripe setup →'}
              </button>
            </div>
          )}
        </main>
      </SubscribeGate>
    </div>
  );
}
