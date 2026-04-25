import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { listBookingsForOwner } from '../../../lib/bookings.js';
import { getCustomerMetadata, saveCustomerMetadata } from '../../../lib/customers.js';
import { groupBookingsIntoCustomers, pickPrimarySiteId, makeCustomerLikeFromProfile } from '../../../lib/customerIdentity.js';
import { getCustomerProfileByIdentityKey, upsertCustomerPhoto } from '../../../lib/customerProfiles.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import { useAlert } from '../../ui/AlertProvider.jsx';
import EmailComposerModal from './EmailComposerModal.jsx';
import BookCustomerModal from './BookCustomerModal.jsx';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
function statusClass(status) {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'pending':   return 'bg-amber-100 text-amber-800';
    case 'completed': return 'bg-blue-100 text-blue-800';
    case 'declined':
    case 'cancelled': return 'bg-red-100 text-red-700';
    default:          return 'bg-gray-100 text-gray-700';
  }
}

export default function CustomerDetailPage({
  userId,
  userEmail,
  profile,
  identityKey,             // dedup key from customerIdentity.js
  onExit,                  // back to dashboard
  onBackToCustomers,       // back to the Customers list
  onOpenBookings,
  onOpenAdmin,
  onOpenProfile,
  onOpenPaymentsConnect,
  onSignOut,
}) {
  const headerProps = {
    active: 'customers',     // keep the Customers tab highlighted on detail
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers: onBackToCustomers,
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onSignOut,
  };
  const { toast } = useAlert();

  const [bookings, setBookings] = useState([]);
  const [sites, setSites] = useState([]);
  const [meta, setMeta] = useState(null);    // customer_metadata row (or null if none yet)
  const [manualProfile, setManualProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Local editable state for tags + notes. Auto-saves on blur (notes) and on
  // add/remove (tags). The current "in-flight" save promise is tracked so we
  // don't race two updates and lose a value.
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const lastSavedRef = useRef({ notes: '', tags: [] });

  const [emailOpen, setEmailOpen] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState(null);

  useEffect(() => {
    if (!userId || !identityKey) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [bookingsData, sitesRes, metaRow, profileRow] = await Promise.all([
          listBookingsForOwner({ userId }),
          supabase.from('sites').select('id, business_info').eq('user_id', userId),
          getCustomerMetadata({ ownerUserId: userId, identityKey }),
          getCustomerProfileByIdentityKey({ ownerUserId: userId, key: identityKey }),
        ]);
        if (cancelled) return;
        setBookings(bookingsData || []);
        setSites(sitesRes.data || []);
        setMeta(metaRow || null);
        setManualProfile(profileRow || null);
        const initialNotes = metaRow?.notes || '';
        const initialTags = metaRow?.tags || [];
        setNotes(initialNotes);
        setTags(initialTags);
        lastSavedRef.current = { notes: initialNotes, tags: initialTags };
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load customer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, identityKey]);

  const siteNameById = useMemo(() => {
    const m = {};
    for (const s of sites) m[s.id] = s.business_info?.businessName || 'Untitled site';
    return m;
  }, [sites]);

  // Re-run the same dedup as the list page, then pluck out the customer for
  // this identity_key. We refetch (vs receiving a payload prop) so a deep
  // link / hard refresh on the detail page still works.
  const customer = useMemo(() => {
    const all = groupBookingsIntoCustomers(bookings);
    const base = all.find((c) => c.key === identityKey) || null;
    if (base) {
      if (manualProfile) {
        base.photoUrl = manualProfile.photo_url || '';
        base.manualContact = {
          vehicleMake: manualProfile.vehicle_make || '',
          vehicleModel: manualProfile.vehicle_model || '',
          vehicleYear: manualProfile.vehicle_year || null,
          vehicleSize: manualProfile.vehicle_size || null,
          notes: manualProfile.notes || '',
        };
      }
      return base;
    }
    if (manualProfile) return makeCustomerLikeFromProfile(manualProfile);
    return null;
  }, [bookings, identityKey, manualProfile]);

  const hasMultipleSites = sites.length > 1;
  const primarySiteId = customer ? pickPrimarySiteId(customer) : null;

  async function persist({ nextNotes, nextTags }) {
    try {
      const saved = await saveCustomerMetadata({
        ownerUserId: userId,
        identityKey,
        notes: nextNotes,
        tags: nextTags,
      });
      setMeta(saved);
      lastSavedRef.current = { notes: saved.notes || '', tags: saved.tags || [] };
    } catch (e) {
      toast(e.message || 'Could not save', 'error');
    }
  }

  async function handleNotesBlur() {
    if (notes === lastSavedRef.current.notes) return;
    await persist({ nextNotes: notes, nextTags: tags });
  }

  async function addTagFromInput() {
    const next = tagInput.trim();
    if (!next) return;
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) {
      setTagInput('');
      return;
    }
    const nextTags = [...tags, next];
    setTags(nextTags);
    setTagInput('');
    await persist({ nextNotes: notes, nextTags });
  }

  async function removeTag(t) {
    const nextTags = tags.filter((x) => x !== t);
    setTags(nextTags);
    await persist({ nextNotes: notes, nextTags });
  }

  // Upload or replace the customer photo. Stored as base64 data URL on the
  // customer_profiles row. Creates a minimal profile row on first upload
  // for booking-derived customers (who don't have a row yet).
  const PHOTO_MAX_BYTES = 500 * 1024;
  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoErr('Photo must be an image file.'); return; }
    if (file.size > PHOTO_MAX_BYTES)      { setPhotoErr('Photo must be under 500 KB.');  return; }
    setPhotoBusy(true); setPhotoErr(null);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Failed to read file.'));
        r.readAsDataURL(file);
      });
      const updated = await upsertCustomerPhoto({
        ownerUserId: userId,
        identityKey,
        photoUrl: dataUrl,
        fallbackContact: { name: customer?.name, email: customer?.email, phone: customer?.phone },
      });
      setManualProfile(updated);
    } catch (e) {
      setPhotoErr(e.message || 'Upload failed.');
    } finally {
      setPhotoBusy(false);
    }
  }
  async function handlePhotoRemove() {
    if (!manualProfile) return;
    setPhotoBusy(true); setPhotoErr(null);
    try {
      const updated = await upsertCustomerPhoto({
        ownerUserId: userId,
        identityKey,
        photoUrl: null,
        fallbackContact: {},
      });
      setManualProfile(updated);
    } catch (e) {
      setPhotoErr(e.message || 'Remove failed.');
    } finally {
      setPhotoBusy(false);
    }
  }

  // ─── Render states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-4 py-5">
          <p className="text-[#888] text-sm">Loading…</p>
        </main>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-4 py-5">
          <div className="border border-[#cc0000]/20 rounded-xl p-4 text-sm text-[#cc0000] bg-[#cc0000]/5">{err}</div>
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={onBackToCustomers}
            className="text-[12px] font-semibold text-[#1a1a1a] hover:text-[#cc0000] transition-colors mb-4"
          >
            ← Back to Customers
          </button>
          <div className="border border-black/[0.07] rounded-xl p-6 bg-white text-sm text-[#555]">
            Customer not found. They may have been removed.
          </div>
        </main>
      </div>
    );
  }

  const sortedBookings = [...customer.bookings].sort(
    (a, b) => new Date(b.preferred_at || b.created_at) - new Date(a.preferred_at || a.created_at),
  );
  const topService = [...customer.services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={profile}
        heading="Customers is a Pro feature"
        subheading="Customer management relies on the Pro scheduler — upgrade to unlock it along with bookings and everything else in Pro."
      >
        <main className="max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={onBackToCustomers}
            className="text-[12px] font-semibold text-[#555] hover:text-[#cc0000] transition-colors mb-4 inline-flex items-center gap-1"
          >
            ← Back to Customers
          </button>

          {/* Identity card */}
          <div className="bg-white border border-black/[0.07] rounded-2xl p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="h-20 w-20 rounded-full bg-[#f4f3f0] border border-black/[0.07] overflow-hidden flex items-center justify-center">
                    {customer.photoUrl ? (
                      <img src={customer.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 cursor-pointer bg-[#1a1a1a] text-white hover:bg-[#333] rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-colors" title={customer.photoUrl ? 'Replace photo' : 'Upload photo'}>
                    {photoBusy ? (
                      <span className="text-[10px]">…</span>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} disabled={photoBusy} />
                  </label>
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-[-0.5px]">
                    {customer.name}
                  </h1>
                  {customer.nextUpcomingAt && (
                    <div className="mt-2 inline-flex items-center text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                      Upcoming · {formatDate(customer.nextUpcomingAt)}
                    </div>
                  )}
                  {customer.photoUrl && (
                    <button type="button" onClick={handlePhotoRemove} disabled={photoBusy} className="mt-2 ml-0 text-[11px] text-[#888] hover:text-[#cc0000] block">
                      Remove photo
                    </button>
                  )}
                  {photoErr && <p className="mt-1 text-[11px] text-[#cc0000]">{photoErr}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(true)}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-[#cc0000] text-white hover:bg-[#b30000] transition-colors"
                >
                  + Book this customer
                </button>
                {customer.email && (
                  <button
                    onClick={() => setEmailOpen(true)}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-[#cc0000] hover:bg-[#aa0000] transition-colors"
                  >
                    Send email
                  </button>
                )}
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="px-4 py-2 rounded-lg border border-black/10 hover:border-black/30 text-[13px] font-semibold text-[#1a1a1a] transition-colors"
                  >
                    Call
                  </a>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
              {customer.email && (
                <div className="flex gap-2">
                  <dt className="w-16 text-[#888] shrink-0">Email</dt>
                  <dd className="text-[#1a1a1a] break-all">
                    <a className="hover:text-[#cc0000] transition-colors" href={`mailto:${customer.email}`}>{customer.email}</a>
                  </dd>
                </div>
              )}
              {customer.phone && (
                <div className="flex gap-2">
                  <dt className="w-16 text-[#888] shrink-0">Phone</dt>
                  <dd className="text-[#1a1a1a]">
                    <a className="hover:text-[#cc0000] transition-colors" href={`tel:${customer.phone}`}>{customer.phone}</a>
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-16 text-[#888] shrink-0">First</dt>
                <dd className="text-[#1a1a1a]">{formatDate(customer.firstBookedAt)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 text-[#888] shrink-0">Last</dt>
                <dd className="text-[#1a1a1a]">{formatDate(customer.lastBookedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Total visits" value={customer.bookings.length} />
            <Stat label="Distinct services" value={customer.services.size || '—'} />
            <Stat label="Top service" value={topService} small />
            <Stat label="Sites booked" value={customer.siteIds.size || 1} />
          </div>

          {/* Tags + Notes card */}
          <div className="bg-white border border-black/[0.07] rounded-2xl p-6 mb-6">
            <h2 className="text-[15px] font-bold text-[#1a1a1a] mb-1">Tags &amp; notes</h2>
            <p className="text-[12px] text-[#888] mb-4">
              Private to you — never shown to the customer or in emails.
            </p>

            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-1.5">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.length === 0 && (
                <span className="text-[12px] text-gray-400 self-center">No tags yet</span>
              )}
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-[#faf9f7] border border-black/[0.08] rounded-full pl-2.5 pr-1 py-0.5 text-[12px] text-[#555] font-medium"
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                    className="w-4 h-4 rounded-full text-[#888] hover:text-[#cc0000] hover:bg-[#cc0000]/10 flex items-center justify-center transition-colors"
                  >
                    <svg width="8" height="8" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTagFromInput(); }
              }}
              onBlur={addTagFromInput}
              placeholder="Add a tag (e.g. VIP, fleet, prepaid)"
              className="w-full sm:max-w-xs border border-black/[0.10] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] mb-5"
            />

            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={4}
              placeholder="Anything worth remembering about this customer…"
              className="w-full border border-black/[0.10] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] resize-y"
            />
            <p className="text-[11px] text-[#888] mt-1">Auto-saves when you click away.</p>
          </div>

          {/* Booking history */}
          <div className="bg-white border border-black/[0.07] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#1a1a1a]">Booking history</h2>
                <p className="text-[12px] text-[#888]">
                  {customer.bookings.length} {customer.bookings.length === 1 ? 'visit' : 'visits'} · newest first
                </p>
              </div>
              {onOpenBookings && (
                <button
                  onClick={onOpenBookings}
                  className="text-[12px] font-semibold text-[#1a1a1a] hover:text-[#cc0000] transition-colors"
                >
                  Open in Bookings →
                </button>
              )}
            </div>
            {sortedBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 p-6 text-center m-6">
                <p className="text-sm text-[#888]">No bookings yet for this customer.</p>
                <p className="text-xs text-[#bbb] mt-1">Click "Book this customer" above to schedule their first visit.</p>
              </div>
            ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-2.5">When</th>
                  <th className="px-3 py-2.5">Service</th>
                  <th className="px-3 py-2.5">Vehicle</th>
                  <th className="px-3 py-2.5">Status</th>
                  {hasMultipleSites && <th className="px-3 py-2.5 pr-6">Site</th>}
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="px-6 py-3 text-[13px] text-gray-800">{formatDateTime(b.preferred_at)}</td>
                    <td className="px-3 py-3 text-[13px] text-gray-700">{b.service_name || '—'}</td>
                    <td className="px-3 py-3 text-[12px] text-gray-600">
                      {[b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${statusClass(b.status)}`}>
                        {b.status}
                      </span>
                    </td>
                    {hasMultipleSites && (
                      <td className="px-3 py-3 pr-6 text-[12px] text-gray-600">{siteNameById[b.site_id] || '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </main>
      </SubscribeGate>

      <EmailComposerModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        customer={customer}
        siteId={primarySiteId}
        ownerEmail={userEmail}
      />

      {showBookModal && customer && (
        <BookCustomerModal
          customer={customer}
          userId={userId}
          onClose={() => setShowBookModal(false)}
          onBooked={(booking) => {
            setBookings((prev) => [booking, ...prev]);
            setShowBookModal(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div className="bg-white border border-black/[0.07] rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-[#888]">{label}</div>
      <div className={`mt-0.5 font-black text-[#1a1a1a] ${small ? 'text-[15px] truncate' : 'text-2xl'}`}>{value}</div>
    </div>
  );
}
