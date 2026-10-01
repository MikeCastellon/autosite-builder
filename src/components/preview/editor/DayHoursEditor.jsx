// Business Info > Business Hours: one row per day, Mon..Sun. A drop-in for
// ContentEditor's old HoursEditor (same props, markup and storage), plus a
// "By appointment" state per day. Storage stays the per-day shape
// { Mon: '9am-5pm', ..., Sun: '' } where '' is the only value a template may
// show as "Closed"; By appointment is stored as the literal BY_APPOINTMENT
// text, which every template prints as written (byAppointment.render.test.jsx).
import { HOURS_DAYS, parseRange, rangeToString, daysFromHours, BY_APPOINTMENT, dayHoursKind } from '../../../lib/businessHours.js';
import { formatTimeRange } from '../templates/kit/content.js';
import { Help } from './fields.jsx';

const DEFAULT_RANGE = '9am-5pm';

// The two time inputs get a line of their own under the day (the panel's
// ~216px content column left them ~65px each beside the day name, too
// narrow to show "08:00 AM"), with a slim picker icon; the day's line
// shows the range in short form, readable whatever the inputs show.
const timeInputClass = 'flex-1 min-w-[5.5rem] text-[11px] text-gray-700 border border-gray-200 rounded pl-1 pr-0.5 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-transparent [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:w-3 [&::-webkit-calendar-picker-indicator]:p-0';

// '8am-6pm' -> '8am – 6pm' (the stored range, which is short).
const shortRange = (v) => String(v || '').replace(/\s*[-–]\s*/, ' – ');
const smallButtonClass = 'shrink-0 text-[10px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-1.5 py-1 rounded transition';

// Hours saved before the per-day editor (a free-text string, or day-range
// keys like { 'Mon-Fri': '8am-6pm' }). daysFromHours maps them day by day
// (a day written "by appointment" stays By appointment), and the first edit
// here saves the per-day shape, so the owner is warned before replacing
// them.
export function isLegacyHours(value) {
  if (typeof value === 'string') return value.trim() !== '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && !keys.every((k) => HOURS_DAYS.includes(k));
}

// The first day with anything in it (hours, By appointment or old text): the
// one "Copy ... to all days" copies, as it is.
export function firstFilledDay(hoursObj) {
  return HOURS_DAYS.find((d) => dayHoursKind(hoursObj?.[d]) !== 'closed') || null;
}

function ClearButton({ day, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Mark ${day} closed`}
      title="Mark closed"
      className="shrink-0 text-gray-300 hover:text-red-500 transition p-0.5"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    </button>
  );
}

export default function DayHoursEditor({ label, value, onChange }) {
  const hoursObj = daysFromHours(value);
  // One write per click: always the full per-day object, so a legacy shape
  // becomes the per-day shape on the first edit (as the old editor did).
  const setDay = (day, val) => onChange({ ...hoursObj, [day]: val });
  const firstFilled = firstFilledDay(hoursObj);
  const hasText = HOURS_DAYS.some((d) => dayHoursKind(hoursObj[d]) === 'text');
  const legacy = isLegacyHours(value) ? (typeof value === 'string' ? value.trim() : Object.entries(value).map(([k, v]) => (v ? `${k} ${v}` : k)).join(' · ')) : '';

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</label>
      <div className="space-y-1">
        {HOURS_DAYS.map((day) => {
          const dayValue = hoursObj[day] ?? '';
          const kind = dayHoursKind(dayValue);
          const range = kind === 'hours' ? parseRange(dayValue) : null;
          return (
            <div key={day}>
            <div className="flex items-center gap-1.5">
              <span className="w-9 shrink-0 text-[11px] font-semibold text-gray-700">{day}</span>
              {kind === 'closed' && (
                <>
                  <span className="flex-1 text-[11px] text-gray-400 italic px-1.5">Closed</span>
                  <button type="button" onClick={() => setDay(day, DEFAULT_RANGE)} aria-label={`${day}: open`} className={smallButtonClass}>
                    Open
                  </button>
                  <button type="button" onClick={() => setDay(day, BY_APPOINTMENT)} aria-label={`${day}: by appointment`} className={smallButtonClass}>
                    By appt.
                  </button>
                </>
              )}
              {kind === 'hours' && (
                <>
                  <span className="flex-1 min-w-0 truncate text-[11px] text-gray-700 px-1.5" title={formatTimeRange(dayValue)}>{shortRange(dayValue)}</span>
                  <button type="button" onClick={() => setDay(day, BY_APPOINTMENT)} aria-label={`${day}: by appointment`} className={smallButtonClass}>
                    By appt.
                  </button>
                  <ClearButton day={day} onClick={() => setDay(day, '')} />
                </>
              )}
              {kind === 'appointment' && (
                <>
                  <span className="flex-1 text-[11px] text-gray-700 italic px-1.5">By appointment</span>
                  <button type="button" onClick={() => setDay(day, DEFAULT_RANGE)} aria-label={`${day}: set hours`} className={smallButtonClass}>
                    Hours
                  </button>
                  <ClearButton day={day} onClick={() => setDay(day, '')} />
                </>
              )}
              {kind === 'text' && (
                <>
                  {/* Old free text ("24 hours"): shown, never edited here, so
                      nothing the owner wrote is lost until they replace it. */}
                  <span className="flex-1 min-w-0 truncate text-[11px] text-gray-700 px-1.5" title={String(dayValue)}>
                    {'“'}{String(dayValue)}{'”'}
                  </span>
                  <button type="button" onClick={() => setDay(day, DEFAULT_RANGE)} aria-label={`${day}: set hours`} className={smallButtonClass}>
                    Hours
                  </button>
                  <ClearButton day={day} onClick={() => setDay(day, '')} />
                </>
              )}
            </div>
            {range && (
              <div className="flex items-center gap-1 mt-1 mb-1.5">
                <input
                  type="time"
                  value={range.open}
                  onChange={(e) => setDay(day, rangeToString(e.target.value, range.close))}
                  aria-label={`${day} open time`}
                  className={timeInputClass}
                />
                <span className="text-[10px] text-gray-400 shrink-0">to</span>
                <input
                  type="time"
                  value={range.close}
                  onChange={(e) => setDay(day, rangeToString(range.open, e.target.value))}
                  aria-label={`${day} close time`}
                  className={timeInputClass}
                />
              </div>
            )}
            </div>
          );
        })}
      </div>
      {firstFilled && (
        <button
          type="button"
          onClick={() => onChange(Object.fromEntries(HOURS_DAYS.map((d) => [d, hoursObj[firstFilled]])))}
          className="mt-2 text-[10px] font-semibold text-gray-500 hover:text-gray-900 hover:underline"
        >
          Copy {firstFilled} to all days
        </button>
      )}
      <Help>{"A By appointment day shows on your site as By appointment, never as Closed."}</Help>
      {hasText && <Help>Some days hold text from your old hours; it shows on your site as written.</Help>}
      {legacy && (
        <Help tone="warn">
          {`These hours were saved in an older format ("${legacy}"). Changing any day here replaces them with the seven days above, so check each one.`}
        </Help>
      )}
    </div>
  );
}

export { DayHoursEditor };
