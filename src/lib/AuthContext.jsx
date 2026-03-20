import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Auth temporarily disabled — restore when Google OAuth is configured
  // const [session, setSession] = useState(undefined);
  // useEffect(() => {
  //   const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
  //     setSession(s);
  //   });
  //   return () => listener.subscription.unsubscribe();
  // }, []);

  return (
    <AuthContext.Provider value={{ session: null, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
