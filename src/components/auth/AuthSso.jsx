// SSO landing for Genius HQ's tile: consumes the one-time token minted by
// HQ's sso-login edge function (/auth/sso?token_hash=...). The token is
// scrubbed from the address bar before the exchange runs, and no session
// token ever appears in the URL (unlike a hash-fragment magic link). Paired
// with the Referrer-Policy: no-referrer header on /auth/sso in netlify.toml.
//
// Same contract as the other HQ-provisioned apps' AuthSso pages.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function AuthSso() {
  // Read during the first render; the effect removes it from the URL at once.
  const [tokenHash] = useState(() => new URLSearchParams(window.location.search).get('token_hash'));
  const [failed, setFailed] = useState(false);
  // The token is single-use, and StrictMode runs effects twice.
  const attempted = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, '', '/auth/sso');
    if (!tokenHash) {
      setFailed(true);
      return undefined;
    }
    if (attempted.current) return undefined;
    attempted.current = true;

    // Never hang on the spinner.
    const timer = setTimeout(() => setFailed(true), 8000);
    // A full load of / rather than a state change: it drops any other
    // account's cached profile and starts the app from a clean slate.
    const enter = () => window.location.replace('/');

    supabase.auth
      .verifyOtp({ type: 'magiclink', token_hash: tokenHash })
      .then(async ({ error }) => {
        clearTimeout(timer);
        if (!error) return enter();
        // A duplicate exchange can spend the token while a session already
        // exists — signed in is signed in.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) enter();
        else setFailed(true);
      })
      .catch(() => {
        clearTimeout(timer);
        setFailed(true);
      });

    return () => clearTimeout(timer);
  }, [tokenHash]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-4">
      <div className="w-full max-w-sm text-center">
        {failed ? (
          <>
            <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Sign-In Link Expired</h1>
            <p className="text-ink-tertiary text-sm mt-2">
              We couldn’t complete the sign-in. Head back to Genius HQ and open the app again, or sign in directly.
            </p>
            <a
              href="/"
              className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-sm font-semibold transition-colors"
            >
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin mx-auto" />
            <p className="text-ink-tertiary text-sm mt-4">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
