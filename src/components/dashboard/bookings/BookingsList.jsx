import { useMemo, useState } from 'react';
import BookingFilters from './BookingFilters.jsx';
import StatusPill from './StatusPill.jsx';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function depositPill(booking) {
  const status = booking?.deposit_status;
  if (!status || status === 'not_required') return null;
  const label =
    status === 'paid'    ? 'Deposit paid' :
    status === 'pending' ? 'Deposit pending' :
    status === 'refunded'? 'Deposit refunded' :
    status === 'failed'  ? 'Deposit failed' : null;
  if (!label) return null;
  const cls =
    status === 'paid'    ? 'bg-[#e8f5ec] text-[#0a8f3d]' :
    status === 'pending' ? 'bg-[#fff7e6] text-[#b37400]' :
    status === 'refunded'? 'bg-[#eef0f3] text-[#4a4a4a]' :
                            'bg-[#fff5f5] text-[#cc0000]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusPill status={b.status} />
                      {depositPill(b)}
                    </div>
                  </td>
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
