import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // Listen for auth changes FIRST (catches OAuth redirects with hash tokens)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    // Then get initial session (for page refreshes with existing cookie)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Only set if onAuthStateChange hasn't already set a session
      setSession(prev => prev === undefined ? s : prev);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loading = session === undefined;

  return (
    <AuthContext.Provider value={{ session: loading ? null : session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
