import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { listBookingsForOwner } from '../../../lib/bookings.js';
import { listCustomerMetadata } from '../../../lib/customers.js';
import { groupBookingsIntoCustomers, makeCustomerLikeFromProfile } from '../../../lib/customerIdentity.js';
import { listManualCustomers } from '../../../lib/customerProfiles.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';
import AddCustomerModal from './AddCustomerModal.jsx';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Escape one CSV field per RFC 4180 — wrap in quotes if it contains a quote,
// comma, or newline; double up any embedded quotes.
function csvField(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n');
  // BOM so Excel opens UTF-8 correctly without mangling accented characters.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function CustomersPage({
  userId,
  profile,
  userEmail,
  onExit,
  onOpenBookings,
  onOpenAdmin,
  onOpenProfile,
  onOpenPaymentsConnect,
  onOpenCustomerDetail,
  onSignOut,
}) {
  const headerProps = {
    active: 'customers',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers: () => {},
    onOpenAdmin,
    onOpenProfile,
    onOpenPaymentsConnect,
    onSignOut,
  };

  const [bookings, setBookings] = useState([]);
  const [sites, setSites] = useState([]);
  const [metadataByKey, setMetadataByKey] = useState(new Map());
  const [manualCustomers, setManualCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookingsData, sitesRes, metaMap, manualProfiles] = await Promise.all([
          listBookingsForOwner({ userId }),
          supabase.from('sites').select('id, business_info').eq('user_id', userId),
          listCustomerMetadata({ ownerUserId: userId }),
          listManualCustomers({ ownerUserId: userId }),
        ]);
        if (cancelled) return;
        setBookings(bookingsData || []);
        setSites(sitesRes.data || []);
        setMetadataByKey(metaMap || new Map());
        setManualCustomers(manualProfiles || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const customers = useMemo(() => {
    const fromBookings = groupBookingsIntoCustomers(bookings);
    const profileByKey = new Map(manualCustomers.map((p) => [p.identity_key, p]));
    // Attach photoUrl from the matching customer_profiles row (if any) to
    // every booked customer so avatars show up on the list for ALL customers
    // regardless of whether they were manually added.
    for (const c of fromBookings) {
      const p = profileByKey.get(c.key);
      if (p?.photo_url) c.photoUrl = p.photo_url;
    }
    const bookedKeys = new Set(fromBookings.map((c) => c.key));
    const manualOnly = manualCustomers
      .filter((p) => !bookedKeys.has(p.identity_key))
      .map(makeCustomerLikeFromProfile);
    // Sort: booked customers first (by lastBookedAt desc), manual customers
    // after (by createdAt desc). Keeps the active pipeline visible.
    fromBookings.sort((a, b) => new Date(b.lastBookedAt) - new Date(a.lastBookedAt));
    manualOnly.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return [...fromBookings, ...manualOnly];
  }, [bookings, manualCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || c.phone.toLowerCase().includes(q)
      || (metadataByKey.get(c.key)?.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [customers, search, metadataByKey]);

  function handleExportCSV() {
    const header = ['Name', 'Email', 'Phone', 'Visits', 'First booked', 'Last booked', 'Upcoming', 'Top services', 'Tags'];
    const rows = filtered.map((c) => {
      const topServices = [...c.services.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .join('; ');
      const tags = (metadataByKey.get(c.key)?.tags || []).join('; ');
      return [
        c.name,
        c.email,
        c.phone,
        c.bookings.length,
        formatDate(c.firstBookedAt),
        formatDate(c.lastBookedAt),
        c.nextUpcomingAt ? formatDate(c.nextUpcomingAt) : '',
        topServices,
        tags,
      ];
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`customers-${stamp}.csv`, [header, ...rows]);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-[#888] text-sm">Loading…</p>
        </main>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <AppHeader {...headerProps} />
        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="border border-[#cc0000]/20 rounded-xl p-4 text-sm text-[#cc0000] bg-[#cc0000]/5">{err}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader {...headerProps} />
      <SubscribeGate
        profile={profile}
        heading="Customers is a Pro feature"
        subheading="Customer management relies on the Pro scheduler — upgrade to unlock it along with bookings and everything else in Pro."
      >
        <main className="max-w-5xl mx-auto px-6 py-10">
          <header className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-[-0.5px]">Customers</h1>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="shrink-0 text-xs font-semibold text-white bg-[#cc0000] hover:bg-[#aa0000] px-4 py-2 rounded-lg transition-colors"
              >
                + Add customer
              </button>
            </div>
            <p className="text-[13px] text-[#888] mt-1.5">
              {customers.length === 0
                ? 'Everyone who books through your scheduler will show up here.'
                : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} · ${bookings.length} total ${bookings.length === 1 ? 'booking' : 'bookings'}`}
            </p>
          </header>

          {customers.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, or tag"
                className="flex-1 min-w-[200px] sm:max-w-sm border border-black/[0.10] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000]"
              />
              <button
                onClick={handleExportCSV}
                disabled={filtered.length === 0}
                title={filtered.length === 0 ? 'Nothing to export' : `Export ${filtered.length} customers as CSV`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/10 hover:border-black/30 text-[13px] font-semibold text-[#1a1a1a] hover:text-[#cc0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            </div>
          )}

          {customers.length === 0 ? (
            <div className="text-center py-16 border border-black/[0.07] rounded-2xl bg-white">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#faf9f7] flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#1a1a1a] mb-1">No customers yet</p>
              <p className="text-[13px] text-[#888] max-w-sm mx-auto">
                As soon as someone books through your site's scheduler, they'll appear here with every visit and service they've booked.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-black/[0.07] rounded-2xl bg-white text-sm text-[#888]">
              No customers match "{search}".
            </div>
          ) : (
            <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Visits</th>
                    <th className="px-4 py-3">Last booked</th>
                    <th className="px-4 py-3">Services / tags</th>
                    <th className="px-4 py-3 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const topServices = [...c.services.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([name]) => name);
                    const extraServiceCount = c.services.size - topServices.length;
                    const tags = metadataByKey.get(c.key)?.tags || [];
                    return (
                      <tr
                        key={c.key}
                        onClick={() => onOpenCustomerDetail && onOpenCustomerDetail(c.key)}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-[#f4f3f0] border border-black/[0.07] overflow-hidden flex items-center justify-center shrink-0">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-[#888]">
                                  {(c.name || '?').charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#1a1a1a] truncate">
                                {c.name}
                                {c.isManual && (
                                  <span className="ml-2 inline-flex items-center rounded-md bg-[#f4f3f0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                                    Manual
                                  </span>
                                )}
                              </div>
                              {c.nextUpcomingAt && (
                                <div className="text-[11px] text-green-700 font-medium mt-0.5">
                                  Upcoming · {formatDate(c.nextUpcomingAt)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-gray-700">
                          {c.email && <div className="truncate max-w-[220px]">{c.email}</div>}
                          {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                          {!c.email && !c.phone && <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold">
                            {c.bookings.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-[13px]">{formatDate(c.lastBookedAt)}</td>
                        <td className="px-4 py-3 text-[13px] text-gray-700">
                          <div className="flex flex-wrap gap-1">
                            {topServices.length === 0 && tags.length === 0 && (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                            {topServices.map((s) => (
                              <span key={`s-${s}`} className="inline-block bg-[#faf9f7] border border-black/[0.06] rounded px-2 py-0.5 text-[11px] text-[#555] font-medium">
                                {s}
                              </span>
                            ))}
                            {extraServiceCount > 0 && (
                              <span className="inline-block text-[11px] text-[#888] self-center">
                                +{extraServiceCount}
                              </span>
                            )}
                            {tags.slice(0, 2).map((t) => (
                              <span key={`t-${t}`} className="inline-block bg-[#cc0000]/[0.06] border border-[#cc0000]/20 rounded-full px-2 py-0.5 text-[11px] text-[#cc0000] font-semibold">
                                {t}
                              </span>
                            ))}
                            {tags.length > 2 && (
                              <span className="inline-block text-[11px] text-[#888] self-center">
                                +{tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {showAddModal && (
            <AddCustomerModal
              ownerUserId={userId}
              onClose={() => setShowAddModal(false)}
              onCreated={(created) => {
                setManualCustomers((prev) => [created, ...prev]);
                setShowAddModal(false);
              }}
            />
          )}
        </main>
      </SubscribeGate>
    </div>
  );
}
