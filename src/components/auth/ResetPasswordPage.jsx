import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function ResetPasswordPage({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => onComplete(), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Set New Password</h1>
          <p className="text-[#888] text-sm mt-1">Choose a new password for your account</p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 font-semibold text-sm">✓ Password updated!</p>
            <p className="text-green-600 text-xs mt-1">Redirecting to dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              minLength={6}
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              minLength={6}
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-xs text-[#cc0000] text-center">{error}</p>}
      </div>
    </div>
  );
}
