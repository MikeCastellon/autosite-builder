import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { useAlert } from '../ui/AlertProvider.jsx';
import AppHeader from '../ui/AppHeader.jsx';

export default function ProfilePage({ onExit, onOpenBookings, onOpenCustomers, onOpenAdmin, onOpenPaymentsConnect, onSignOut }) {
  const { session, profile, refreshProfile } = useAuth();
  const userEmail = session?.user?.email;
  const { toast } = useAlert();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name || '');
    setLastName(profile.last_name || '');
    setBusinessName(profile.business_name || '');
    setPhone(profile.phone || '');
    setPhotoUrl(profile.photo_url || '');
  }, [profile]);

  const PHOTO_MAX_BYTES = 500 * 1024;
  async function persistPhoto(nextUrl) {
    if (!session?.user?.id) return;
    setPhotoBusy(true);
    const { error } = await supabase.from('profiles').update({
      photo_url: nextUrl || null,
    }).eq('id', session.user.id);
    setPhotoBusy(false);
    if (error) {
      toast(`Couldn't save photo: ${error.message}`, 'error');
      return;
    }
    if (refreshProfile) await refreshProfile();
    toast(nextUrl ? 'Photo updated' : 'Photo removed', 'success');
  }
  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Photo must be an image file.', 'error'); return; }
    if (file.size > PHOTO_MAX_BYTES) { toast('Photo must be under 500 KB.', 'error'); return; }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Failed to read file.'));
        r.readAsDataURL(file);
      });
      setPhotoUrl(dataUrl);
      await persistPhoto(dataUrl);
    } catch (err) {
      toast(err.message || 'Upload failed.', 'error');
    }
  }
  async function handlePhotoRemove() {
    setPhotoUrl('');
    await persistPhoto(null);
  }

  const headerProps = {
    active: 'profile',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers,
    onOpenAdmin,
    onOpenPaymentsConnect,
    onOpenProfile: () => {},
    onSignOut,
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      business_name: businessName.trim() || null,
      phone: phone.trim() || null,
    }).eq('id', session.user.id);
    setSavingProfile(false);
    if (error) {
      toast(`Couldn't save: ${error.message}`, 'error');
      return;
    }
    if (refreshProfile) await refreshProfile();
    toast('Profile updated', 'success');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords don't match", 'error');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast(`Couldn't change password: ${error.message}`, 'error');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    toast('Password changed', 'success');
  };

  const inputBase = 'w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition';
  const labelBase = 'block text-[13px] font-semibold text-[#1a1a1a] mb-1.5';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-1">Your Profile</h1>
        <p className="text-[#666] text-[15px] mb-8">Manage your account details and password.</p>

        {/* Profile details card */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white border border-black/[0.07] rounded-2xl p-6 sm:p-7 mb-6 space-y-4"
        >
          <h3 className="text-[15px] font-bold text-[#1a1a1a]">Account details</h3>

          {/* Profile photo */}
          <div className="flex items-center gap-4 pb-2">
            <div className="h-20 w-20 rounded-full bg-[#f4f3f0] border border-black/[0.07] overflow-hidden flex items-center justify-center shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-50">
                  {photoBusy ? 'Saving…' : photoUrl ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} disabled={photoBusy} />
                </label>
                {photoUrl && !photoBusy && (
                  <button type="button" onClick={handlePhotoRemove} className="text-xs text-[#888] hover:text-[#cc0000]">Remove</button>
                )}
              </div>
              <p className="text-[11px] text-[#888] mt-1.5">JPG or PNG, up to 500 KB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputBase}
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
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelBase}>Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelBase}>Email address</label>
            <input
              type="email"
              value={userEmail || ''}
              readOnly
              disabled
              className={`${inputBase} bg-[#faf9f7] text-[#888] cursor-not-allowed`}
            />
            <p className="text-[11px] text-[#888] mt-1">Email is your sign-in identifier and can't be changed here.</p>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-[14px] transition-colors disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Change password card */}
        <form
          onSubmit={handleChangePassword}
          className="bg-white border border-black/[0.07] rounded-2xl p-6 sm:p-7 space-y-4"
        >
          <div>
            <h3 className="text-[15px] font-bold text-[#1a1a1a]">Change password</h3>
            <p className="text-[12px] text-[#888] mt-0.5">Use at least 6 characters.</p>
          </div>

          <div>
            <label className={labelBase}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelBase}>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              className={inputBase}
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
