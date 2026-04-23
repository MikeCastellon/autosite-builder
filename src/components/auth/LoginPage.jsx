import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function LoginPage({ initialMode = 'signin' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
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

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            business_name: businessName.trim(),
            phone: phone.trim(),
          },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Persist profile fields. Tries to update an existing profile row created
      // by Supabase trigger — falls back to upsert if the row isn't there yet.
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          email: email.trim().toLowerCase(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          business_name: businessName.trim() || null,
          phone: phone.trim() || null,
        }, { onConflict: 'id' });
      }
      if (data?.session) {
        // Logged in immediately (Supabase email confirmation off) — AuthContext picks this up.
        setMessage('Welcome — your account is ready.');
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }

    setLoading(false);
  };

  const inputBase = 'w-full border border-black/10 rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition';
  const labelBase = 'block text-[13px] font-semibold text-[#1a1a1a] mb-1.5';

  return (
    <div className="min-h-screen flex flex-col bg-[#eef4fb]">
      {/* Brand header at the top */}
      <header className="border-b border-black/[0.07] bg-white px-4 sm:px-8 h-16 flex items-center sticky top-0 z-50">
        <a
          href="https://www.autocaregenius.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5"
        >
          <img
            src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200"
            alt="Auto Care Genius"
            className="h-7"
          />
          <div className="w-px h-6 bg-black/[0.07]" />
          <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px]">
            Genius <span className="text-[#cc0000]">Websites</span>
          </span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md bg-white border border-black/[0.07] rounded-2xl shadow-sm p-8 sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-[clamp(28px,4vw,36px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1]">
              {showForgot ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-[#666] text-[15px] mt-2.5">
              {showForgot ? "Enter your email and we'll send a reset link" : isSignUp ? 'Sign up to start building your website' : 'Sign in to your account'}
            </p>
          </div>

          {showForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className={labelBase}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputBase}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-[15px] transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelBase}>First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jane"
                        className={inputBase}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelBase}>Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Smith"
                        className={inputBase}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelBase}>
                      Company name <span className="text-[#888] font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Smith Auto Detailing"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className={labelBase}>Phone number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputBase}
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <label className={labelBase}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputBase}
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-semibold text-[#1a1a1a]">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setError(null); setMessage(null); }}
                      className="text-[12px] text-[#cc0000] hover:text-[#aa0000] font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                  minLength={6}
                  className={inputBase}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-[15px] transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setShowForgot(false); setError(null); setMessage(null); }}
              className="w-full text-[15px] font-medium text-[#555] hover:text-[#1a1a1a] transition-colors text-center"
            >
              {showForgot ? (
                <>← Back to sign in</>
              ) : isSignUp ? (
                <>Already have an account? <span className="text-[#cc0000] font-semibold">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="text-[#cc0000] font-semibold">Sign up</span></>
              )}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-xl border-2 border-[#cc0000] bg-red-50 text-[#8a0000] px-4 py-3 shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="#cc0000"/>
                <path d="M12 7v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                <circle cx="12" cy="16.5" r="1.2" fill="#fff"/>
              </svg>
              <p className="text-[14px] font-semibold leading-snug">{error}</p>
            </div>
          )}
          {message && (
            <div
              role="status"
              className="mt-5 flex items-start gap-3 rounded-xl border-2 border-green-700 bg-green-50 text-green-900 px-4 py-3 shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="#16a34a"/>
                <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[14px] font-semibold leading-snug">{message}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
