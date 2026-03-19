import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
    if (error) setError(error.message);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formatted = phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, '');
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) setError(error.message);
    else setOtpSent(true);
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formatted = phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, '');
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-[#1a1a1a] mb-1 tracking-tight">Sign in</h1>
        <p className="text-[#888] text-sm mb-6">Continue to Website Creator</p>

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

        {!otpSent ? (
          <form onSubmit={handleSendOtp}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="text-sm text-[#555] mb-3">Enter the 6-digit code sent to {phone}</p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-[#cc0000]/30 text-center tracking-widest"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full mt-2 text-xs text-[#888] hover:text-[#1a1a1a] transition-colors"
            >
              Use a different number
            </button>
          </form>
        )}

        {error && (
          <p className="mt-3 text-xs text-[#cc0000] text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
