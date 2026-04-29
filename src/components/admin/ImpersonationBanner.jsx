import { useEffect, useState } from 'react';
import { supabase, isImpersonationTab } from '../../lib/supabase.js';

// Top-of-page banner that's only ever visible in an impersonation tab.
// Three responsibilities:
//   1. Make it impossible to forget you're impersonating.
//   2. Claim the handoff_id from the URL on first mount, exchange it for
//      access+refresh tokens, and call supabase.auth.setSession so the rest
//      of the app sees the impersonated session.
//   3. Provide an Exit button that wipes the impersonated session and
//      tries to close the tab.
//
// Lives outside any auth gate so it can drive the initial setSession.
export default function ImpersonationBanner() {
  const [status, setStatus] = useState('idle'); // idle | claiming | active | error
  const [targetEmail, setTargetEmail] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isImpersonationTab) return;

    const url = new URL(window.location.href);
    const handoffId = url.searchParams.get('impersonate');

    // No handoff param → check if a session already exists from a prior
    // load of this tab. If yes, just show the banner. If no, we're stuck.
    if (!handoffId) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user?.email) {
          setTargetEmail(data.session.user.email);
          setStatus('active');
        } else {
          setStatus('error');
          setError('Impersonation session not found. Close this tab and try again.');
        }
      });
      return;
    }

    setStatus('claiming');
    (async () => {
      try {
        const res = await fetch('/.netlify/functions/impersonate-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoff_id: handoffId }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Could not claim handoff');

        const { error: setErr } = await supabase.auth.setSession({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
        });
        if (setErr) throw setErr;

        setTargetEmail(body.target_email || '');
        setStatus('active');

        // Strip the handoff_id from the URL so a refresh / accidental copy
        // doesn't leak it (and so it can't be re-tried if the click already
        // succeeded).
        url.searchParams.delete('impersonate');
        const cleanUrl = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash;
        window.history.replaceState({}, '', cleanUrl);
      } catch (e) {
        setStatus('error');
        setError(e.message || 'Could not start impersonation');
      }
    })();
  }, []);

  async function handleExit() {
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    try {
      window.sessionStorage.removeItem('genius:impersonating');
      window.sessionStorage.removeItem('sb-genius-impersonate-auth-token');
    } catch { /* ignore */ }
    // Most browsers refuse window.close() unless the tab was script-opened.
    // Our admin "View as user" path uses window.open, so close usually works.
    // If it doesn't (e.g. the tab was reloaded by hand), redirect to the
    // sign-in page as a fallback so the admin isn't stranded mid-session.
    try { window.close(); } catch { /* ignore */ }
    setTimeout(() => { window.location.href = '/'; }, 100);
  }

  if (!isImpersonationTab) return null;

  if (status === 'claiming') {
    return (
      <div className="bg-[#1a1a1a] text-white text-center py-2 px-4 text-[12px] font-semibold tracking-wide">
        Starting impersonation session…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="bg-[#cc0000] text-white text-center py-2 px-4 text-[12px] font-semibold tracking-wide">
        Impersonation error: {error || 'unknown'} ·{' '}
        <button onClick={handleExit} className="underline">Exit</button>
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className="bg-[#cc0000] text-white py-2 px-4 flex items-center justify-center gap-3 text-[12px] font-bold tracking-wide sticky top-0 z-[200]"
        role="alert"
        aria-live="polite"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        VIEWING AS {targetEmail || 'user'}
        <button
          onClick={handleExit}
          className="ml-2 underline-offset-2 underline hover:text-white/80"
        >
          Exit
        </button>
      </div>
    );
  }
  return null;
}
