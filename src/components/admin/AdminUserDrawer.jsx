import { useEffect, useRef, useState } from 'react';
import { getUserActivityCounts, saveAdminUserMetadata, subStatusBucket } from '../../lib/adminUsers.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { useAlert } from '../ui/AlertProvider.jsx';
import { supabase } from '../../lib/supabase.js';

function SubBadge({ bucket }) {
  const map = {
    'admin':           ['Admin',           'bg-[#1a1a1a] text-white'],
    'pro':             ['Pro',             'bg-[#cc0000] text-white'],
    'pro-comp':        ['Pro (comp)',      'bg-[#cc0000]/15 text-[#cc0000]'],
    'past_due':        ['Past Due',        'bg-amber-100 text-amber-800'],
    'cancelled-grace': ['Cancelled (grace)', 'bg-amber-100 text-amber-800'],
    'cancelled':       ['Cancelled',       'bg-gray-200 text-gray-700'],
    'free':            ['Free',            'bg-gray-100 text-gray-600'],
  };
  const [label, cls] = map[bucket] || ['—', 'bg-gray-100 text-gray-600'];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{label}</span>;
}

function Field({ label, value, mono }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <p className="w-32 shrink-0 text-[11px] font-semibold text-[#888] uppercase tracking-wider">{label}</p>
      <p className={`text-[13px] text-[#1a1a1a] ${mono ? 'font-mono' : ''} truncate`}>{value || <span className="text-[#aaa]">—</span>}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border-b border-black/[0.07] py-4 last:border-b-0">
      <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mb-2">{title}</p>
      {children}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminUserDrawer({ user, allTags, onClose, onRefresh }) {
  const { profile: adminProfile } = useAuth();
  const { toast } = useAlert();
  const [notes, setNotes] = useState(user.adminNotes || '');
  const [tags, setTags] = useState(user.adminTags || []);
  const [tagInput, setTagInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [activity, setActivity] = useState({ bookings: null, charges: null, customers: null });
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const skipFirstNotesAutosave = useRef(true);

  const bucket = subStatusBucket(user);

  // Activity counts on mount
  useEffect(() => {
    let cancelled = false;
    getUserActivityCounts(user.id).then((c) => { if (!cancelled) setActivity(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user.id]);

  // Esc to close + body scroll lock
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Autosave notes (debounced) — but skip the very first run so we don't
  // overwrite the freshly-loaded value with itself when the drawer opens.
  useEffect(() => {
    if (skipFirstNotesAutosave.current) { skipFirstNotesAutosave.current = false; return; }
    const t = setTimeout(async () => {
      setSavingNotes(true);
      try {
        await saveAdminUserMetadata({ userId: user.id, notes, tags, currentAdminId: adminProfile?.id });
        onRefresh?.({ userId: user.id, notes, tags });
      } catch (e) {
        toast(e.message || 'Could not save notes', 'error');
      } finally {
        setSavingNotes(false);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  async function persistTags(nextTags) {
    setSavingTags(true);
    try {
      await saveAdminUserMetadata({ userId: user.id, notes, tags: nextTags, currentAdminId: adminProfile?.id });
      onRefresh?.({ userId: user.id, notes, tags: nextTags });
    } catch (e) {
      toast(e.message || 'Could not save tags', 'error');
    } finally {
      setSavingTags(false);
    }
  }

  function addTag(t) {
    const cleaned = String(t || '').trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) { setTagInput(''); return; }
    const next = [...tags, cleaned];
    setTags(next);
    setTagInput('');
    persistTags(next);
  }
  function removeTag(t) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    persistTags(next);
  }

  const tagSuggestions = (tagInput.trim()
    ? allTags.filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t))
    : allTags.filter((t) => !tags.includes(t))
  ).slice(0, 6);

  const stripeConnected = !!user.stripe_connect_account_id && !!user.stripe_connect_charges_enabled;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
  const initial = (fullName || '?').charAt(0).toUpperCase();

  // Impersonation: one-click new tab opens with a tab-isolated session via
  // sessionStorage (see lib/supabase.js). No magic link or incognito needed
  // — the new tab's session lives only in that tab, so the admin's main
  // session in this browser stays intact.
  const [impersonating, setImpersonating] = useState(false);

  async function handleViewAsUser() {
    if (impersonating) return;
    setImpersonating(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/.netlify/functions/admin-impersonate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: user.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not start impersonation');

      // Open a brand new tab to /?impersonate=<handoff_id>. The
      // ImpersonationBanner mounted at the top of that tab will claim the
      // handoff, set the session, and strip the param from the URL.
      const url = `${window.location.origin}/?impersonate=${encodeURIComponent(body.handoff_id)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast(e.message || 'Could not start impersonation', 'error');
    } finally {
      setImpersonating(false);
    }
  }

  function formatNextBill(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const days = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (days < 0) return `${dateStr} (${-days}d ago)`;
    if (days === 0) return `${dateStr} (today)`;
    if (days === 1) return `${dateStr} (tomorrow)`;
    return `${dateStr} (in ${days}d)`;
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-[80]" aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="User detail"
        className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white z-[90] shadow-[0_0_30px_rgba(0,0,0,0.15)] flex flex-col"
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
              {user.photo_url ? <img src={user.photo_url} alt="" className="w-full h-full object-cover" /> : initial}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-[#1a1a1a] truncate">{fullName}</p>
              <p className="text-[11px] text-[#888] truncate">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-black/[0.05] flex items-center justify-center text-[#888] shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex items-center gap-2 pt-4 pb-2">
            <SubBadge bucket={bucket} />
            {stripeConnected && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#635bff]/10 text-[#635bff]">
                Stripe Connected
              </span>
            )}
            {user.shopify_customer_id && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                Shopify
              </span>
            )}
            <span className="text-[11px] text-[#888] ml-auto">Joined {formatDate(user.created_at)}</span>
          </div>

          <Section title="Account">
            <Field label="Business" value={user.business_name || user.firstSiteName} />
            <Field label="Phone" value={user.phone} />
            <Field label="Email" value={user.email} />
            <Field label="User ID" value={user.id} mono />
          </Section>

          <Section title="Subscription">
            <Field label="Status" value={user.subscription_status || (user.scheduler_enabled ? 'comp' : 'none')} />
            {user.subscription_status === 'active' && user.subscription_current_period_end && (
              <Field label="Next bill" value={formatNextBill(user.subscription_current_period_end)} />
            )}
            {user.subscription_ends_at && <Field label="Ends" value={formatDate(user.subscription_ends_at)} />}
            {user.stripe_trial_ends_at && new Date(user.stripe_trial_ends_at) > new Date() && (
              <Field label="Trial ends" value={formatDate(user.stripe_trial_ends_at)} />
            )}
            <Field label="Scheduler" value={user.scheduler_enabled ? 'Enabled' : 'Disabled'} />
          </Section>

          <Section title="Stripe Connect">
            <Field label="Account ID" value={user.stripe_connect_account_id} mono />
            <Field label="Charges" value={user.stripe_connect_charges_enabled ? 'Enabled' : 'Disabled'} />
            <Field label="Payouts" value={user.stripe_connect_payouts_enabled ? 'Enabled' : 'Disabled'} />
            <Field label="Submitted" value={user.stripe_connect_details_submitted ? 'Yes' : 'No'} />
          </Section>

          <Section title={`Sites (${user.siteCount})`}>
            {user.sites.length === 0 ? (
              <p className="text-sm text-[#aaa]">No sites yet.</p>
            ) : (
              <div className="space-y-2">
                {user.sites.map((s) => {
                  const liveUrl = s.custom_domain && s.custom_domain_status === 'active_ssl'
                    ? `https://www.${s.custom_domain}`
                    : s.published_url;
                  return (
                    <div key={s.id} className="border border-black/[0.07] rounded-lg p-3">
                      <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">
                        {s.business_info?.businessName || <span className="text-[#aaa]">(unnamed)</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {liveUrl ? (
                          <a href={liveUrl} target="_blank" rel="noreferrer" className="text-[12px] text-[#cc0000] font-semibold hover:underline truncate">
                            {liveUrl.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="text-[12px] text-[#aaa]">Unpublished</span>
                        )}
                        {s.custom_domain && (
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                            s.custom_domain_status === 'active_ssl' ? 'text-emerald-700' : 'text-amber-700'
                          }`}>
                            · {s.custom_domain_status || 'pending'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Activity">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-[#faf9f7] border border-black/[0.07] p-3 text-center">
                <p className="text-[20px] font-bold text-[#1a1a1a]">{activity.bookings ?? '…'}</p>
                <p className="text-[10px] text-[#888] uppercase tracking-wider">Bookings</p>
              </div>
              <div className="rounded-lg bg-[#faf9f7] border border-black/[0.07] p-3 text-center">
                <p className="text-[20px] font-bold text-[#1a1a1a]">{activity.customers ?? '…'}</p>
                <p className="text-[10px] text-[#888] uppercase tracking-wider">Customers</p>
              </div>
              <div className="rounded-lg bg-[#faf9f7] border border-black/[0.07] p-3 text-center">
                <p className="text-[20px] font-bold text-[#1a1a1a]">{activity.charges ?? '…'}</p>
                <p className="text-[10px] text-[#888] uppercase tracking-wider">Charges</p>
              </div>
            </div>
          </Section>

          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-[#cc0000]/10 text-[#cc0000] rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                    className="hover:bg-[#cc0000]/20 rounded-full w-4 h-4 flex items-center justify-center text-[#cc0000]"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-[11px] text-[#aaa]">No tags yet</span>}
            </div>
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                  if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
                }}
                placeholder="Add a tag (Enter to add)"
                className="w-full px-3 py-2 rounded-lg border border-black/[0.10] text-sm focus:outline-none focus:border-[#cc0000]"
              />
              {showTagSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.12] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {tagSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#faf9f7] border-b border-black/[0.05] last:border-b-0"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {savingTags && <p className="text-[10px] text-[#aaa] mt-1.5">Saving…</p>}
          </Section>

          <Section title="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Internal notes — only visible to admins. Things like onboarding context, support history, payment quirks, etc."
              className="w-full px-3 py-2 rounded-lg border border-black/[0.10] text-sm focus:outline-none focus:border-[#cc0000] font-mono leading-relaxed"
            />
            <p className="text-[10px] text-[#aaa] mt-1.5">{savingNotes ? 'Saving…' : 'Auto-saves as you type'}</p>
          </Section>

          <Section title="Quick actions">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleViewAsUser}
                disabled={impersonating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[12px] font-bold transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                {impersonating ? 'Opening…' : 'View as user'}
              </button>
              <a
                href={`mailto:${user.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                Email
              </a>
              {user.phone && (
                <a
                  href={`tel:${String(user.phone).replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                  Call
                </a>
              )}
              {user.firstPublishedUrl && (
                <a
                  href={user.firstPublishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Open Site
                </a>
              )}
            </div>
          </Section>
        </div>
      </aside>
    </>
  );
}
