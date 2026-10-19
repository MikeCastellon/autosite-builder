// The Genius Store's client side: the call to netlify/functions/genius-store.js
// (terms / status / enable), shared by the Genius Store page in the business
// menu and the editor's Genius Store tab. Spec:
// docs/superpowers/specs/2026-10-19-genius-store-design.md
import { supabase } from './supabase.js';
import { isDark } from '../components/preview/templates/kit/theme.js';

export async function geniusStoreCall(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/.netlify/functions/genius-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || 'Something went wrong. Please try again.'), { code: body.code });
  return body;
}

// The store starts with the website's look: its accent, and dark on a dark
// site. colors: templateMeta.colors.
export function storeLook(colors) {
  return {
    accent: colors?.accent,
    scheme: colors?.bg && isDark(colors.bg) ? 'dark' : 'light',
  };
}

// A commission rate as the owner reads it: 0.1 -> "10%".
export const ratePercent = (rate) => (Number.isFinite(rate) ? `${Math.round(rate * 1000) / 10}%` : null);
