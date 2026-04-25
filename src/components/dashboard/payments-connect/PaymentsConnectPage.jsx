// src/components/dashboard/payments-connect/PaymentsConnectPage.jsx
import { useEffect, useRef, useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectComponentsProvider, ConnectAccountOnboarding } from '@stripe/react-connect-js';
import { supabase } from '../../../lib/supabase.js';
import { createConnectAccount, fetchAccountSession } from '../../../lib/stripeConnect.js';
import { connectAppearance } from '../../../design-tokens.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import ConnectStatusBadge from './ConnectStatusBadge.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

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
    onSignOut,
  };

  const [profile, setProfile] = useState(initialProfile);
  const [connectInstance, setConnectInstance] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [err, setErr] = useState(null);
  const initRef = useRef(false);

  // One-time: ensure an account exists, then load Connect and fetch a session.
  async function bootstrap() {
    if (initRef.current || bootstrapping) return;
    initRef.current = true;
    setBootstrapping(true);
    setErr(null);
    try {
      if (!PUBLISHABLE_KEY) throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is not set.');
      await createConnectAccount();
      const instance = loadConnectAndInitialize({
        publishableKey: PUBLISHABLE_KEY,
        fetchClientSecret: async () => {
          const { client_secret } = await fetchAccountSession();
          return client_secret;
        },
        appearance: connectAppearance,
      });
      setConnectInstance(instance);
    } catch (e) {
      setErr(e.message || 'Could not start onboarding.');
      initRef.current = false;
    } finally {
      setBootstrapping(false);
    }
  }

  // Refresh profile after the embedded component exits (capabilities may have flipped).
  async function refreshProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data);
  }

  // Poll profile on mount to pick up any webhook updates that happened since
  // the user last loaded the page.
  useEffect(() => {
    if (userId) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const accountId = profile?.stripe_connect_account_id;
  const charges = !!profile?.stripe_connect_charges_enabled;
  const payouts = !!profile?.stripe_connect_payouts_enabled;
  const fullyConnected = accountId && charges && payouts && profile?.stripe_connect_details_submitted;

  return (
    <div className="min-h-screen bg-surface-secondary font-outfit">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={initialProfile}
        heading="Payments is a Pro feature"
        subheading="Connect your Stripe account to take deposits, charge customers, and get paid out."
      >
        <main className="max-w-7xl mx-auto px-3 py-10">
          <div className="mb-6">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mt-8">Payments</h1>
              <ConnectStatusBadge profile={profile} />
            </div>
            <p className="text-sm text-[#888] mt-2">Connect your Stripe account to accept deposits and charge customers directly from your phone.</p>
          </div>

          {fullyConnected ? (
            <div className="rounded-token-md border border-black/[0.07] bg-surface-primary p-6 shadow-token-sm">
              <p className="text-sm text-ink-primary">Your Stripe account is connected and ready to take payments.</p>
              <p className="text-xs text-ink-tertiary mt-2">Account ID: <code className="font-mono">{accountId}</code></p>
              <p className="text-sm text-ink-secondary mt-4">Need to update bank info or view payouts? <a className="text-brand-red font-semibold underline hover:no-underline" href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">Open Stripe Dashboard →</a></p>
            </div>
          ) : connectInstance ? (
            <div className="rounded-token-md border border-black/[0.07] bg-surface-primary p-6 shadow-token-sm">
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <ConnectAccountOnboarding
                  onExit={() => { refreshProfile(); }}
                />
              </ConnectComponentsProvider>
            </div>
          ) : (
            <div className="rounded-token-md border border-black/[0.07] bg-surface-primary p-8 shadow-token-sm text-center">
              <p className="text-ink-secondary mb-4">You need a Stripe account to take payments. We'll create one for you and walk through the quick setup.</p>
              {err && <p className="text-sm text-brand-red mb-4">{err}</p>}
              <button
                type="button"
                onClick={bootstrap}
                disabled={bootstrapping}
                className="inline-flex items-center justify-center px-6 py-3 rounded-token-sm bg-brand-red hover:bg-brand-red-hover text-white font-semibold transition-colors disabled:opacity-50"
              >
                {bootstrapping ? 'Starting…' : 'Start Stripe setup'}
              </button>
            </div>
          )}
        </main>
      </SubscribeGate>
    </div>
  );
}
