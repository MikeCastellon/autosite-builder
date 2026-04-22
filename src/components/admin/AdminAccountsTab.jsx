import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAlert } from '../ui/AlertProvider.jsx';

export default function AdminAccountsTab({ onViewOwnerBookings }) {
  const { toast, confirm: confirmDialog } = useAlert();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');

  async function refresh() {
    setLoading(true); setErr(null);
    // Profile rows joined with site count + first published URL.
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, is_super_admin, scheduler_enabled, created_at');
    if (pErr) { setErr(pErr.message); setLoading(false); return; }

    const { data: sites } = await supabase
      .from('sites')
      .select('id, user_id, published_url, business_info');

    const siteByUser = {};
    (sites || []).forEach((s) => {
      const arr = siteByUser[s.user_id] || (siteByUser[s.user_id] = []);
      arr.push(s);
    });

    setRows((profiles || []).map((p) => ({
      ...p,
      siteCount: (siteByUser[p.id] || []).length,
      firstPublishedUrl: (siteByUser[p.id] || []).find((s) => s.published_url)?.published_url || null,
    })));
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, search]);

  async function toggle(id, field, current) {
    if (field === 'is_super_admin' && !current) {
      const ok = await confirmDialog('Grant super admin to this user?', {
        title: 'Grant super admin',
        confirmText: 'Grant',
        danger: true,
      });
      if (!ok) return;
    }
    const { error } = await supabase
      .from('profiles').update({ [field]: !current, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: !current } : r));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email"
          className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
        />
        <button onClick={refresh} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
      </div>

      {loading ? <p className="text-sm text-gray-500">Loading…</p>
       : err   ? <p className="text-sm text-red-600">{err}</p>
       : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Published site</th>
                <th className="px-4 py-3">Scheduler</th>
                <th className="px-4 py-3">Super admin</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{r.email}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-700">{r.siteCount}</td>
                  <td className="px-4 py-3">
                    {r.firstPublishedUrl
                      ? <a href={r.firstPublishedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Visit</a>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><Toggle on={r.scheduler_enabled} onClick={() => toggle(r.id, 'scheduler_enabled', r.scheduler_enabled)} /></td>
                  <td className="px-4 py-3"><Toggle on={r.is_super_admin}    onClick={() => toggle(r.id, 'is_super_admin',    r.is_super_admin)} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => onViewOwnerBookings && onViewOwnerBookings(r)} className="text-xs text-gray-600 hover:text-[#1a1a1a] underline">
                      View bookings
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
