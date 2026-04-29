import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// ─── Impersonation mode detection ──────────────────────────────────────
//
// When an admin clicks "View as user", a new tab opens at /?impersonate=<id>.
// That tab needs its own Supabase session that DOES NOT bleed into the
// admin's main session in their other tabs. localStorage is shared across
// tabs on the same origin, so storing the impersonated session there would
// hijack the admin's tab too. sessionStorage IS tab-isolated — perfect for
// this use case.
//
// We have to detect the mode here, at module load, before the client is
// created — because the storage option is set at construction time.
//
// First-time impersonation tab:
//   - URL has ?impersonate=<id>
//   - We mark sessionStorage with a flag so subsequent same-tab navigations
//     keep using sessionStorage even after the URL param is stripped.
//
// Re-load of an impersonation tab:
//   - URL no longer has the param (we stripped it after claiming)
//   - But sessionStorage flag persists for the life of the tab, so we still
//     use sessionStorage and find the impersonated session there.
//
// Brand new tab in admin's main browser:
//   - No URL param, no sessionStorage flag → uses localStorage, sees admin
//     session like normal.
function detectImpersonationMode() {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    const hasParam = url.searchParams.has('impersonate');
    const flag = window.sessionStorage.getItem('genius:impersonating') === '1';
    if (hasParam && !flag) {
      window.sessionStorage.setItem('genius:impersonating', '1');
    }
    return hasParam || flag;
  } catch {
    return false;
  }
}

export const isImpersonationTab = detectImpersonationMode();

// In normal mode, we DO NOT override storageKey — Supabase falls back to its
// default `sb-<project-ref>-auth-token`, which is what every existing
// signed-in user already has in localStorage. Overriding here would log
// every user out on next deploy.
//
// In impersonation mode, we use a distinct key so even if some browser quirk
// leaks across, the impersonated session can't collide with the admin one.
const authConfig = {
  flowType: 'implicit',
  detectSessionInUrl: !isImpersonationTab, // impersonation tab gets its session via setSession, not the URL
  autoRefreshToken: true,
  persistSession: true,
};
if (isImpersonationTab && typeof window !== 'undefined') {
  authConfig.storage = window.sessionStorage;
  authConfig.storageKey = 'sb-genius-impersonate-auth-token';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authConfig,
});
