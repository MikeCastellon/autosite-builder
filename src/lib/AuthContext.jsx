import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isImpersonationTab } from './supabase.js';

const AuthContext = createContext(null);

// localStorage cache for the user profile. Lets returning users see the full
// header nav (Bookings, Customers, Charges, Charge button, etc.) on first
// paint instead of waiting for the profile fetch to resolve and watching
// items pop in. Background refresh keeps it fresh.
// A "View as user" tab never touches it: localStorage is shared with the
// admin's own tabs, which would then start from the customer's profile (and
// an admin link opened next would be treated as a non-admin's).
const PROFILE_CACHE_KEY = 'genius-profile-cache:v1';
export function readCachedProfile() {
  if (isImpersonationTab) return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return null;
    return parsed;
  } catch { return null; }
}
export function writeCachedProfile(profile) {
  if (isImpersonationTab) return;
  try {
    if (profile && profile.id) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Quota: photo_url can be an inline data URL of a few hundred KB. Cache
    // the profile without it (the fetch fills it in) rather than leaving an
    // older cached profile behind.
    try {
      if (!profile?.id) throw new Error('nothing to cache');
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...profile, photo_url: null }));
    } catch {
      try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
    }
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [isRecovery, setIsRecovery] = useState(false);
  // Hydrate from cache so returning users get a populated header on first paint.
  const [profile, setProfile] = useState(() => readCachedProfile());
  // The user id whose profile fetch last finished (with or without a row).
  // Until it matches the session, `profile` may still be the cached one.
  const [profileLoadedFor, setProfileLoadedFor] = useState(null);

  useEffect(() => {
    console.log('[Auth] Initializing... URL hash:', window.location.hash.substring(0, 80));

    // Detect recovery from URL query param or hash
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get('reset') === 'true' || hash.includes('type=recovery')) {
      console.log('[Auth] Recovery flow detected from URL');
      setIsRecovery(true);
    }

    // Listen for auth changes FIRST
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[Auth] onAuthStateChange:', event, s ? `user=${s.user?.email}` : 'no session');
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[Auth] PASSWORD_RECOVERY event fired');
        setIsRecovery(true);
      }
      setSession(s);
    });

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      console.log('[Auth] getSession:', s ? `user=${s.user?.email}` : 'no session', error || '');
      setSession(prev => {
        if (prev === undefined) return s;
        return prev;
      });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loading = session === undefined;
  console.log('[Auth] Render — loading:', loading, 'session:', session ? 'yes' : 'no');

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) { setProfile(null); writeCachedProfile(null); setProfileLoadedFor(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, business_name, phone, photo_url, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, subscription_current_period_end, stripe_first_failed_payment_at, shopify_customer_id, stripe_customer_id, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted')
      .eq('id', session.user.id)
      .maybeSingle();
    setProfile(data || null);
    writeCachedProfile(data || null);
    setProfileLoadedFor(session.user.id);
  }, [session?.user?.id]);

  // If the cached profile doesn't match the active session user, drop it
  // immediately so we don't render the previous user's nav on first paint.
  useEffect(() => {
    if (session?.user?.id && profile && profile.id !== session.user.id) {
      setProfile(null);
      writeCachedProfile(null);
    }
    if (session === null && profile) {
      setProfile(null);
      writeCachedProfile(null);
    }
  }, [session, profile]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{
      session: loading ? null : session,
      loading,
      isRecovery,
      clearRecovery: () => setIsRecovery(false),
      profile,
      // True once the signed-in user's own profile has been fetched (it may
      // still be null: no row, or the fetch failed).
      profileReady: !loading && !!session?.user?.id && profileLoadedFor === session.user.id,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
