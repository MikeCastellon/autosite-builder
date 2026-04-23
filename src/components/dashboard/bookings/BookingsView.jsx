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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Bookings</h2>
        {onBack && (
          <button onClick={onBack} className="text-sm text-[#888] hover:text-[#1a1a1a]">← Back</button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <TabBtn on={tab === 'calendar'} onClick={() => setTab('calendar')}>Calendar</TabBtn>
        <TabBtn on={tab === 'list'} onClick={() => setTab('list')}>List</TabBtn>
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

function TabBtn({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${on ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}
