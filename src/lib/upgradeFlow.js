import { supabase } from './supabase.js';

// Fetches a Shopify checkout URL for the Pro subscription and opens it.
// Uses the same edge function as SubscribeGate so every "Upgrade to Pro" CTA
// across the app routes through the configured Shopify subscription.
export async function startProUpgrade() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to upgrade.');

  const res = await fetch('/.netlify/functions/subscription-checkout-url', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not start checkout — please try again.');
  }
  window.open(body.url, '_blank', 'noopener');
}
