import { useMemo, useState } from 'react';
import InquiryStatusPill from './InquiryStatusPill.jsx';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const FILTERS = [
  { key: 'active',   label: 'Inbox',    statuses: ['new', 'read'] },
  { key: 'new',      label: 'New',      statuses: ['new'] },
  { key: 'read',     label: 'Read',     statuses: ['read'] },
  { key: 'archived', label: 'Archived', statuses: ['archived'] },
  { key: 'all',      label: 'All',      statuses: ['new', 'read', 'archived'] },
];

export default function InquiriesList({ inquiries, onSelect }) {
  const [filterKey, setFilterKey] = useState('active');
  const [search, setSearch] = useState('');

  const unreadCount = useMemo(
    () => inquiries.filter((i) => i.status === 'new').length,
    [inquiries]
  );

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filterKey) || FILTERS[0];
    const q = search.trim().toLowerCase();
    return inquiries
      .filter((i) => f.statuses.includes(i.status))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));
  }, [inquiries, filterKey, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = f.key === filterKey;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                active
                  ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                  : 'bg-white text-[#1a1a1a] border-black/[0.1] hover:bg-black/[0.04]'
              }`}
            >
              {f.label}
              {f.key === 'new' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          );
        })}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="ml-auto border border-black/[0.1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-black/[0.07] rounded-2xl bg-white text-gray-500 text-sm">
          No inquiries match these filters.
        </div>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => onSelect(i)}
                  className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${i.status === 'new' ? 'font-medium' : ''}`}
                >
                  <td className="px-4 py-3"><InquiryStatusPill status={i.status} /></td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{i.name}</div>
                    <div className="text-xs text-gray-500">{i.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[280px] truncate">{i.message}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
