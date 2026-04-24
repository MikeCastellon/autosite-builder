// src/lib/stripeConnect.js
import { supabase } from './supabase.js';

async function authedFetch(path, opts = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const res = await fetch(path, {
    method: opts.method || 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// Creates the Connect account if the profile doesn't have one yet.
// Idempotent — safe to call on every page load.
export async function createConnectAccount() {
  return authedFetch('/.netlify/functions/connect-account-create');
}

// Returns a fresh AccountSession client_secret for the embedded onboarding.
// Call this every time the onboarding UI needs to mount — client_secrets
// are short-lived.
export async function fetchAccountSession() {
  return authedFetch('/.netlify/functions/connect-account-session');
}
