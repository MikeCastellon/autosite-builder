import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [isRecovery, setIsRecovery] = useState(false);
  const [profile, setProfile] = useState(null);

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
    if (!session?.user?.id) { setProfile(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, business_name, phone, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, shopify_customer_id')
      .eq('id', session.user.id)
      .maybeSingle();
    setProfile(data || null);
  }, [session?.user?.id]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{ session: loading ? null : session, loading, isRecovery, clearRecovery: () => setIsRecovery(false), profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
