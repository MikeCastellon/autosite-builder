import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { listBookingsForOwner } from '../../../lib/bookings.js';
import AppHeader from '../../ui/AppHeader.jsx';
import SubscribeGate from '../bookings-page/SubscribeGate.jsx';

// Normalize a contact string (email or phone) into a stable identity key so
// "John@x.com" and "john@x.com  " collapse to the same customer, and phone
// numbers survive " (555) 123-4567 " vs "5551234567" punctuation drift.
function identityKey(b) {
  const email = (b.customer_email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = (b.customer_phone || '').replace(/\D+/g, '');
  if (phone) return `phone:${phone}`;
  // Last resort — use the name so nameless/contactless entries still show up
  // as separate rows rather than all piling into one bucket.
  return `name:${(b.customer_name || '').trim().toLowerCase() || b.id}`;
}

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

export default function CustomersPage({ userId, profile, userEmail, onExit, onOpenBookings, onOpenAdmin, onOpenProfile, onSignOut }) {
  const headerProps = {
    active: 'customers',
    userEmail,
    profile,
    onMySites: onExit,
    onOpenBookings,
    onOpenCustomers: () => {},
    onOpenAdmin,
    onOpenProfile,
    onSignOut,
  };

  const [bookings, setBookings] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookingsData, sitesRes] = await Promise.all([
          listBookingsForOwner({ userId }),
          supabase.from('sites').select('id, business_info').eq('user_id', userId),
        ]);
        if (cancelled) return;
        setBookings(bookingsData || []);
        setSites(sitesRes.data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Build a map of siteId → display name so we can label which site a booking
  // came from when the owner has more than one.
  const siteNameById = useMemo(() => {
    const m = {};
    for (const s of sites) {
      m[s.id] = s.business_info?.businessName || 'Untitled site';
    }
    return m;
  }, [sites]);

  // Group bookings by identity → one row per unique customer. Each group tracks
  // the full booking history, distinct services ordered, most recent visit,
  // total count, and which sites they've booked at. Cancelled bookings still
  // count as a "visit" for history purposes but are flagged visually later.
  const customers = useMemo(() => {
    const groups = new Map();
    for (const b of bookings) {
      const key = identityKey(b);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: b.customer_name || '(No name)',
          email: b.customer_email || '',
          phone: b.customer_phone || '',
          bookings: [],
          services: new Map(),        // serviceName → count
          siteIds: new Set(),
          firstBookedAt: b.created_at,
          lastBookedAt: b.created_at,
          nextUpcomingAt: null,       // earliest future preferred_at with non-cancelled status
        });
      }
      const g = groups.get(key);
      g.bookings.push(b);
      if (b.service_name) {
        g.services.set(b.service_name, (g.services.get(b.service_name) || 0) + 1);
      }
      if (b.site_id) g.siteIds.add(b.site_id);
      // Track earliest + latest by created_at — keep name fresh on whichever
      // record has the latest customer_name (people's names change, phone
      // numbers change, emails stay — trust the most recent snapshot).
      if (new Date(b.created_at) < new Date(g.firstBookedAt)) g.firstBookedAt = b.created_at;
      if (new Date(b.created_at) >= new Date(g.lastBookedAt)) {
        g.lastBookedAt = b.created_at;
        g.name = b.customer_name || g.name;
        g.email = b.customer_email || g.email;
        g.phone = b.customer_phone || g.phone;
      }
      // Upcoming = future-dated preferred_at with status still pending/confirmed
      const pref = b.preferred_at ? new Date(b.preferred_at) : null;
      const isUpcoming = pref && pref >= new Date() && (b.status === 'pending' || b.status === 'confirmed');
      if (isUpcoming && (!g.nextUpcomingAt || pref < new Date(g.nextUpcomingAt))) {
        g.nextUpcomingAt = b.preferred_at;
      }
    }
    // Newest-first by last booking so returning customers bubble up.
    return [...groups.values()].sort((a, b) => new Date(b.lastBookedAt) - new Date(a.lastBookedAt));
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || c.phone.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const hasMultipleSites = sites.length > 1;

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
      <SubscribeGate profile={profile}>
        <main className="max-w-5xl mx-auto px-6 py-10">
          <header className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-[-0.5px]">Customers</h1>
            <p className="text-[13px] text-[#888] mt-1.5">
              {customers.length === 0
                ? 'Everyone who books through your scheduler will show up here.'
                : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} · ${bookings.length} total ${bookings.length === 1 ? 'booking' : 'bookings'}`}
            </p>
          </header>

          {customers.length > 0 && (
            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="w-full sm:max-w-sm border border-black/[0.10] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000]"
              />
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
                    <th className="px-4 py-3">Services</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isExpanded = expandedKey === c.key;
                    const topServices = [...c.services.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([name]) => name);
                    const extraServiceCount = c.services.size - topServices.length;
                    return (
                      <Fragment key={c.key}>
                        <tr
                          onClick={() => setExpandedKey(isExpanded ? null : c.key)}
                          className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#1a1a1a]">{c.name}</div>
                            {c.nextUpcomingAt && (
                              <div className="text-[11px] text-green-700 font-medium mt-0.5">
                                Upcoming · {formatDate(c.nextUpcomingAt)}
                              </div>
                            )}
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
                            {topServices.length === 0 ? (
                              <span className="text-gray-400 text-xs">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {topServices.map((s) => (
                                  <span key={s} className="inline-block bg-[#faf9f7] border border-black/[0.06] rounded px-2 py-0.5 text-[11px] text-[#555] font-medium">
                                    {s}
                                  </span>
                                ))}
                                {extraServiceCount > 0 && (
                                  <span className="inline-block text-[11px] text-[#888] self-center">
                                    +{extraServiceCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-t border-gray-100 bg-[#faf9f7]">
                            <td colSpan={5} className="px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider font-bold text-[#888] mb-1">Booking history</p>
                                  <p className="text-[12px] text-[#555]">
                                    First booked {formatDate(c.firstBookedAt)} · {c.bookings.length} total {c.bookings.length === 1 ? 'visit' : 'visits'}
                                  </p>
                                </div>
                                {onOpenBookings && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onOpenBookings(); }}
                                    className="text-[12px] font-semibold text-[#1a1a1a] hover:text-[#cc0000] transition-colors"
                                  >
                                    Open in Bookings →
                                  </button>
                                )}
                              </div>
                              <div className="bg-white border border-black/[0.07] rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase tracking-wider">
                                    <tr>
                                      <th className="px-3 py-2">When</th>
                                      <th className="px-3 py-2">Service</th>
                                      <th className="px-3 py-2">Vehicle</th>
                                      <th className="px-3 py-2">Status</th>
                                      {hasMultipleSites && <th className="px-3 py-2">Site</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...c.bookings]
                                      .sort((a, b) => new Date(b.preferred_at || b.created_at) - new Date(a.preferred_at || a.created_at))
                                      .map((b) => (
                                        <tr key={b.id} className="border-t border-gray-100">
                                          <td className="px-3 py-2 text-[13px] text-gray-800">{formatDateTime(b.preferred_at)}</td>
                                          <td className="px-3 py-2 text-[13px] text-gray-700">{b.service_name || '—'}</td>
                                          <td className="px-3 py-2 text-[12px] text-gray-600">
                                            {[b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ') || '—'}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${statusClass(b.status)}`}>
                                              {b.status}
                                            </span>
                                          </td>
                                          {hasMultipleSites && (
                                            <td className="px-3 py-2 text-[12px] text-gray-600">{siteNameById[b.site_id] || '—'}</td>
                                          )}
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </SubscribeGate>
    </div>
  );
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
