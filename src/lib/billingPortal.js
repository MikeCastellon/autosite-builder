// Opens the Stripe Customer Portal (update card, view invoices, cancel
// subscription) in a new tab. Shared by the AppHeader account menu and the
// past-due notice in SubscribeGate.
//
// Deps are injectable for tests; defaults lazy-import the Supabase client so
// importing this module never requires VITE_SUPABASE_* env vars (supabase.js
// throws at import time without them).
export async function openBillingPortal({
  getSession,
  fetchFn = (...args) => fetch(...args),
  openWindow = (url) => window.open(url, '_blank', 'noopener'),
} = {}) {
  const resolveSession = getSession ?? (async () => {
    const { supabase } = await import('./supabase.js');
    return supabase.auth.getSession();
  });

  const { data: sessionData } = await resolveSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetchFn('/.netlify/functions/stripe-portal-url', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not open billing — please try again.');
  }

  openWindow(body.url);
  return body.url;
}
