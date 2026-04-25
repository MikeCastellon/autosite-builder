import { useEffect, useState } from 'react';
import BookingsList from './BookingsList.jsx';
import BookingsCalendar from './BookingsCalendar.jsx';
import BookingDetailDrawer from './BookingDetailDrawer.jsx';
import { listBookingsForOwner, listAllBookings } from '../../../lib/bookings.js';

export default function BookingsView({ userId, isAdmin = false, onBack }) {
  const [tab, setTab] = useState('calendar');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const rows = isAdmin
        ? await listAllBookings({})
        : await listBookingsForOwner({ userId });
      setBookings(rows);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId, isAdmin]);

  function onUpdated(updated) {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
    setSelected(updated);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">Bookings</h1>
        <div className="flex items-center gap-3">
          <ViewToggle value={tab} onChange={setTab} />
          {onBack && (
            <button onClick={onBack} className="text-sm text-[#888] hover:text-[#1a1a1a]">← Back</button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        tab === 'calendar'
          ? <BookingsCalendar bookings={bookings} onSelect={setSelected} />
          : <BookingsList bookings={bookings} onSelect={setSelected} />
      )}

      {selected && (
        <BookingDetailDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}

function ViewToggle({ value, onChange }) {
  const opts = [
    {
      key: 'calendar',
      label: 'Calendar',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M11 1.5v3M5 1.5v3M2 7h12" />
        </svg>
      ),
    },
    {
      key: 'list',
      label: 'List',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h9M5 8h9M5 12h9" />
          <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
          <circle cx="2.5" cy="8" r="0.6" fill="currentColor" />
          <circle cx="2.5" cy="12" r="0.6" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <div className="inline-flex items-center bg-[#f2f0ec] border border-black/[0.06] rounded-lg p-0.5">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
              active
                ? 'bg-white text-[#1a1a1a] shadow-sm'
                : 'text-[#888] hover:text-[#1a1a1a]'
            }`}
            aria-pressed={active}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
