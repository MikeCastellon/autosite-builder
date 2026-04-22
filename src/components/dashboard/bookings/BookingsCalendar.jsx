import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth, format,
} from 'date-fns';
import StatusPill from './StatusPill.jsx';

const STATUS_COLOR = {
  pending:   'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  declined:  'bg-gray-100 text-gray-500 border-gray-200 line-through',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function BookingsCalendar({ bookings, onSelect }) {
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    const gridEnd = endOfWeek(endOfMonth(cursor));
    const out = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = format(new Date(b.preferred_at), 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [bookings]);

  return (
    <div className="bg-white border border-black/[0.07] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="px-3 py-1 rounded hover:bg-gray-100">‹</button>
          <button onClick={() => setCursor(new Date())} className="px-3 py-1 rounded hover:bg-gray-100 text-sm">Today</button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="px-3 py-1 rounded hover:bg-gray-100">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden text-sm">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-500 text-center">{d}</div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const items = byDay.get(key) || [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={key} className={`bg-white min-h-[96px] p-1 ${!inMonth ? 'text-gray-300' : ''}`}>
              <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-red-600' : 'text-gray-500'}`}>{format(day, 'd')}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate ${STATUS_COLOR[b.status]}`}
                    title={`${b.customer_name} — ${format(new Date(b.preferred_at), 'h:mma')}`}
                  >
                    {format(new Date(b.preferred_at), 'h:mma')} {b.customer_name}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="text-[11px] text-gray-500 pl-1">+{items.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2 text-[11px] text-gray-500 items-center">
        <StatusPill status="pending" />
        <StatusPill status="confirmed" />
        <StatusPill status="completed" />
        <StatusPill status="declined" />
        <StatusPill status="cancelled" />
      </div>
    </div>
  );
}
