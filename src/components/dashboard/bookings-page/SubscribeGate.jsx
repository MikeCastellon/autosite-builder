import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { isEffectiveSchedulerActive } from '../../../lib/subscriptionGating.js';

export default function SubscribeGate({ profile, children, onExit }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const active = isEffectiveSchedulerActive(profile);
  const pastDue = profile?.subscription_status === 'past_due';

  if (active) return children;

  async function subscribe() {
    setBusy(true); setErr(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/.netlify/functions/subscription-checkout-url', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || 'Could not build checkout URL');
      window.open(body.url, '_blank', 'noopener');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a]">Bookings</h1>
        {onExit && <button onClick={onExit} className="text-sm text-gray-500 hover:text-[#1a1a1a]">← Back</button>}
      </header>

      <main className="max-w-xl mx-auto px-6 py-12">
        {pastDue && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your subscription has a payment issue. <a className="font-semibold underline hover:no-underline" href="https://account.shopify.com" target="_blank" rel="noreferrer">Update your payment method →</a>
          </div>
        )}

        <div className="rounded-2xl border border-black/[0.07] bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-black text-[#1a1a1a] mb-2">Enable bookings for your site</h2>
          <p className="text-gray-600 mb-6">
            Customers can request appointments right from your website — calendar, services,
            availability, and confirmation emails. All managed from this dashboard.
          </p>
          <div className="text-4xl font-black text-[#1a1a1a] mb-1">$9.99<span className="text-lg text-gray-500 font-semibold">/month</span></div>
          <p className="text-xs text-gray-500 mb-6">Cancel anytime — manage in your Shopify account.</p>

          <button
            onClick={subscribe}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1a1a1a] text-white font-semibold hover:bg-[#cc0000] transition-colors disabled:opacity-50"
          >
            {busy ? 'Loading…' : 'Subscribe through Shopify →'}
          </button>

          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
        </div>
      </main>
    </div>
  );
}
