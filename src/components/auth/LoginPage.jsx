import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showForgot, setShowForgot] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) { setError('Enter your email address first'); return; }
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=true`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for a password reset link!');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight">
            {showForgot ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-[#888] text-sm mt-1">
            {showForgot ? "Enter your email and we'll send a reset link" : isSignUp ? 'Sign up to start building' : 'Sign in to your account'}
          </p>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-black/10 rounded-xl font-medium text-[#1a1a1a] hover:bg-white transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.5 30.2 0 24 0 14.7 0 6.8 5.5 2.9 13.5l7.9 6.1C12.7 13.3 17.9 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z"/><path fill="#FBBC05" d="M10.8 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.3-6.2z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.7 2.2-7.7 2.2-6.1 0-11.3-3.8-13.2-9.2l-8.3 6.2C6.8 42.5 14.7 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 border-t border-black/10" />
          <span className="text-[#aaa] text-xs">or</span>
          <div className="flex-1 border-t border-black/10" />
        </div>

        {showForgot ? (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              minLength={6}
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            {!isSignUp && (
              <button
                type="button"
                onClick={() => { setShowForgot(true); setError(null); setMessage(null); }}
                className="text-xs text-[#cc0000] hover:text-[#aa0000] transition-colors"
              >
                Forgot password?
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setShowForgot(false); setError(null); setMessage(null); }}
          className="w-full mt-3 text-xs text-[#888] hover:text-[#1a1a1a] transition-colors text-center"
        >
          {showForgot ? '← Back to sign in' : isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-xl border-2 border-[#cc0000] bg-[#cc0000] text-white px-4 py-3 shadow-md"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="rgba(255,255,255,0.15)"/>
              <path d="M12 7v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="12" cy="16.5" r="1.2" fill="currentColor"/>
            </svg>
            <p className="text-[14px] font-semibold leading-snug">{error}</p>
          </div>
        )}
        {message && (
          <div role="status" className="mt-4 rounded-xl border-2 border-green-600 bg-green-600 text-white px-4 py-3 text-[14px] font-semibold text-center shadow-md">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
