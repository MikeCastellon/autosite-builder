// src/lib/upgradeFlow.js
import { supabase } from './supabase.js';

// Opens the Stripe Checkout Session for the Pro monthly subscription.
// Used by every "Upgrade to Pro" CTA across the app.
export async function startProUpgrade() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required to upgrade.');

  const res = await fetch('/.netlify/functions/stripe-checkout-url', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not start checkout — please try again.');
  }
  window.open(body.url, '_blank', 'noopener');
}

// Opens the Stripe Customer Portal for the signed-in user. Used by the
// "Manage Billing" button and the past-due banner's "Update payment method"
// link.
export async function startBillingPortal() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetch('/.netlify/functions/stripe-portal-url', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not open billing portal — please try again.');
  }
  window.open(body.url, '_blank', 'noopener');
}
