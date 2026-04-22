import { useMemo, useState } from 'react';
import BookingFilters from './BookingFilters.jsx';
import StatusPill from './StatusPill.jsx';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function BookingsList({ bookings, onSelect }) {
  const [statusIn, setStatusIn] = useState(['pending','confirmed']);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => statusIn.length === 0 || statusIn.includes(b.status))
      .filter((b) => !q || b.customer_name.toLowerCase().includes(q) || b.customer_email.toLowerCase().includes(q));
  }, [bookings, statusIn, search]);

  return (
    <div>
      <BookingFilters statusIn={statusIn} onStatusIn={setStatusIn} search={search} onSearch={setSearch} />

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-black/[0.07] rounded-2xl bg-white text-gray-500 text-sm">
          No bookings match these filters.
        </div>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Preferred</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} onClick={() => onSelect(b)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                  <td className="px-4 py-3 text-gray-800">{fmt(b.preferred_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{b.customer_name}</div>
                    <div className="text-xs text-gray-500">{b.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.vehicle_year} {b.vehicle_make} {b.vehicle_model}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
