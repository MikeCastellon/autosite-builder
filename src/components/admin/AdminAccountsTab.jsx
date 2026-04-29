import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { listAllUsers, listAllAdminTags, subStatusBucket } from '../../lib/adminUsers.js';
import AdminUserDrawer from './AdminUserDrawer.jsx';

const FILTERS = [
  { id: 'all',     label: 'All',         match: () => true },
  { id: 'pro',     label: 'Pro',         match: (u) => ['pro', 'pro-comp'].includes(subStatusBucket(u)) },
  { id: 'free',    label: 'Free',        match: (u) => subStatusBucket(u) === 'free' },
  { id: 'cancelled', label: 'Cancelled', match: (u) => ['cancelled', 'cancelled-grace'].includes(subStatusBucket(u)) },
  { id: 'past_due', label: 'Past Due',   match: (u) => subStatusBucket(u) === 'past_due' },
  { id: 'has_site', label: 'Has Site',   match: (u) => u.publishedSiteCount > 0 },
  { id: 'stripe',   label: 'Stripe',     match: (u) => !!u.stripe_connect_charges_enabled },
];

function SubBadge({ bucket }) {
  const map = {
    'admin':           ['Admin',       'bg-[#1a1a1a] text-white'],
    'pro':             ['Pro',         'bg-[#cc0000] text-white'],
    'pro-comp':        ['Pro (comp)',  'bg-[#cc0000]/15 text-[#cc0000]'],
    'past_due':        ['Past Due',    'bg-amber-100 text-amber-800'],
    'cancelled-grace': ['Cancelled',   'bg-amber-100 text-amber-800'],
    'cancelled':       ['Cancelled',   'bg-gray-200 text-gray-700'],
    'free':            ['Free',        'bg-gray-100 text-gray-600'],
  };
  const [label, cls] = map[bucket] || ['—', 'bg-gray-100 text-gray-600'];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cls}`}>{label}</span>;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function AdminAccountsTab() {
  const { toast, confirm: confirmDialog } = useAlert();
  const [users, setUsers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const [list, tags] = await Promise.all([listAllUsers(), listAllAdminTags()]);
      setUsers(list);
      setAllTags(tags);
    } catch (e) {
      setErr(e.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  // Splice an updated user back into the list when the drawer saves notes/tags,
  // so the row's tag chips reflect the change without a full refresh.
  function applyMetadataPatch({ userId, notes, tags }) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, adminNotes: notes, adminTags: tags } : u));
    // Also fold any new tag names into the global suggestion list
    setAllTags((prev) => {
      const next = new Set(prev);
      (tags || []).forEach((t) => next.add(t));
      return [...next].sort();
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filterFn = (FILTERS.find((f) => f.id === activeFilter) || FILTERS[0]).match;
    return users
      .filter(filterFn)
      .filter((u) => {
        if (!q) return true;
        return (u.email || '').toLowerCase().includes(q)
          || (u.first_name || '').toLowerCase().includes(q)
          || (u.last_name || '').toLowerCase().includes(q)
          || (u.business_name || '').toLowerCase().includes(q)
          || (u.firstSiteName || '').toLowerCase().includes(q)
          || (u.adminTags || []).some((t) => t.toLowerCase().includes(q));
      });
  }, [users, search, activeFilter]);

  // Bucket counts for the chip labels — gives the admin a sense of scale at a glance.
  const counts = useMemo(() => {
    const out = {};
    for (const f of FILTERS) out[f.id] = users.filter(f.match).length;
    return out;
  }, [users]);

  async function toggleField(id, field, current) {
    if (field === 'is_super_admin' && !current) {
      const ok = await confirmDialog('Grant super admin to this user?', { title: 'Grant super admin', confirmText: 'Grant', danger: true });
      if (!ok) return;
    }
    const { error } = await supabase.from('profiles').update({ [field]: !current, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    setUsers((prev) => prev.map((r) => r.id === id ? { ...r, [field]: !current } : r));
  }

  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, business, tag…"
          className="flex-1 min-w-[240px] sm:max-w-xs px-3 py-2 border border-black/[0.10] rounded-lg text-sm focus:outline-none focus:border-[#cc0000]"
        />
        <button onClick={refresh} className="text-xs text-gray-500 hover:text-[#1a1a1a]">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <span className="text-xs text-[#888] ml-auto">{filtered.length} of {users.length}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              activeFilter === f.id
                ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                : 'bg-white text-[#555] border-black/[0.10] hover:border-[#cc0000]/40'
            }`}
          >
            {f.label} <span className={`ml-1 ${activeFilter === f.id ? 'opacity-70' : 'text-[#aaa]'}`}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {err ? (
        <p className="text-sm text-[#cc0000]">{err}</p>
      ) : loading ? (
        <p className="text-sm text-[#888]">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[#888] text-center py-10">No users match.</p>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#faf9f7] text-left text-[10px] text-[#888] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
                const initial = (fullName || u.email || '?').charAt(0).toUpperCase();
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="border-t border-black/[0.05] hover:bg-[#faf9f7] cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[11px] font-bold overflow-hidden shrink-0">
                          {u.photo_url ? <img src={u.photo_url} alt="" className="w-full h-full object-cover" /> : initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1a1a1a] truncate">{fullName || u.email}</p>
                          {fullName && <p className="text-[11px] text-[#888] truncate">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#555] truncate max-w-[160px]">
                      {u.business_name || u.firstSiteName || <span className="text-[#aaa]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <SubBadge bucket={subStatusBucket(u)} />
                    </td>
                    <td className="px-4 py-3">
                      {u.firstPublishedUrl ? (
                        <a
                          href={u.firstPublishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[12px] text-[#cc0000] font-semibold hover:underline truncate max-w-[140px] inline-block"
                        >
                          {u.firstPublishedUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      ) : u.siteCount > 0 ? (
                        <span className="text-[12px] text-[#888]">{u.siteCount} draft</span>
                      ) : (
                        <span className="text-[#aaa] text-[12px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.adminTags || []).slice(0, 3).map((t) => (
                          <span key={t} className="bg-[#cc0000]/[0.08] text-[#cc0000] rounded-full px-2 py-0.5 text-[10px] font-semibold">{t}</span>
                        ))}
                        {(u.adminTags || []).length > 3 && (
                          <span className="text-[10px] text-[#888] self-center">+{u.adminTags.length - 3}</span>
                        )}
                        {(u.adminTags || []).length === 0 && <span className="text-[#aaa] text-[12px]">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#888] text-[12px] whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      {selectedUser && (
        <AdminUserDrawer
          user={selectedUser}
          allTags={allTags}
          onClose={() => setSelectedUserId(null)}
          onRefresh={applyMetadataPatch}
        />
      )}
    </div>
  );
}
