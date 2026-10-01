// Per-day business hours editor utilities. Bridge between the native
// <input type="time"> ("HH:MM" 24h) format and the friendly "9am-5pm"
// string format that downstream templates already understand. Storage
// shape stays { Mon: '9am-5pm', ..., Sun: '' } where '' means closed.

export const HOURS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function time24To12(t) {
  if (!t) return '';
  const [hStr, mStr] = String(t).split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (!Number.isFinite(h)) return '';
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

export function time12To24(label) {
  if (!label) return '';
  const m = String(label).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  const ap = (m[3] || '').toLowerCase();
  if (!Number.isFinite(h)) return '';
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Splits "9am-5pm" / "9am - 5pm" / "9am" into 24h open/close strings the
// time inputs can render. Tolerates partial values during edits.
export function parseRange(s) {
  if (!s) return { open: '', close: '' };
  const m = String(s).match(/^([^-–]*)\s*[-–]\s*(.*)$/);
  if (!m) return { open: time12To24(s.trim()), close: '' };
  return { open: time12To24(m[1].trim()), close: time12To24(m[2].trim()) };
}

export function rangeToString(open24, close24) {
  const o = time24To12(open24);
  const c = time24To12(close24);
  if (!o && !c) return '';
  return `${o}-${c}`;
}

// Best-effort migration from the previous free-text "Mon-Fri 8am-6pm" /
// `{ "Mon-Fri": "8am-6pm" }` formats into a per-day object so existing
// data renders without forcing the user to retype.
export function expandHoursToDays(hoursMaybeObj) {
  const result = Object.fromEntries(HOURS_DAYS.map((d) => [d, '']));
  if (!hoursMaybeObj) return result;

  const setRange = (startLabel, endLabel, time) => {
    const norm = (s) => String(s || '').toLowerCase().slice(0, 3);
    const startIdx = HOURS_DAYS.findIndex((d) => d.toLowerCase().startsWith(norm(startLabel)));
    const endIdx = HOURS_DAYS.findIndex((d) => d.toLowerCase().startsWith(norm(endLabel)));
    if (startIdx >= 0 && endIdx >= 0 && startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) result[HOURS_DAYS[i]] = time;
    }
  };
  const setSingleDay = (label, time) => {
    const norm = String(label || '').toLowerCase().slice(0, 3);
    const idx = HOURS_DAYS.findIndex((d) => d.toLowerCase().startsWith(norm));
    if (idx >= 0) result[HOURS_DAYS[idx]] = time;
  };
  const applyDayPart = (dayPart, timePart) => {
    const range = String(dayPart).match(/^([A-Za-z]+)\s*[-–]\s*([A-Za-z]+)$/);
    if (range) setRange(range[1], range[2], timePart);
    else setSingleDay(dayPart, timePart);
  };

  if (typeof hoursMaybeObj === 'object' && !Array.isArray(hoursMaybeObj)) {
    for (const [k, v] of Object.entries(hoursMaybeObj)) {
      if (HOURS_DAYS.includes(k)) result[k] = v ?? '';
      else applyDayPart(k, v ?? '');
    }
    return result;
  }
  if (typeof hoursMaybeObj === 'string') {
    const parts = hoursMaybeObj.split(/[·;|]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(.+?)\s+(.+)$/);
      if (m) applyDayPart(m[1].trim(), m[2].trim());
    }
    return result;
  }
  return result;
}

// A day the owner opens by appointment only. The per-day editor stores this
// exact text; templates print a day's value as written, so it reads
// "By appointment" on the site and never turns into "Closed" (only '' does).
export const BY_APPOINTMENT = 'By appointment';

// True for the stored value and for the ways owners type it by hand
// ("by appointment only", "BY APPOINTMENT."). Anything longer ("Appointments
// daily") is ordinary text.
export function isByAppointment(value) {
  return typeof value === 'string' && /^\s*by\s+appointment(\s+only)?\s*\.?\s*$/i.test(value);
}

// The editor's own half-typed range: what rangeToString writes while one of
// the two time inputs is empty ("9am-", "-5pm", "8:30am-").
const PARTIAL_RANGE = /^(\d{1,2}(:\d{2})?(am|pm))?-(\d{1,2}(:\d{2})?(am|pm))?$/i;

// What one per-day value is, for the editor row that shows it:
// 'closed' ('' / null / undefined), 'appointment' (isByAppointment),
// 'hours' (a time range the two time inputs can show: both ends parse, or
// the editor's own half-typed range, so clearing one input keeps the row as
// time inputs) or 'text' (anything else, e.g. "24 hours" from older sites,
// which the site prints as written).
export function dayHoursKind(value) {
  if (value === '' || value == null) return 'closed';
  if (isByAppointment(value)) return 'appointment';
  if (typeof value === 'string' && /\d/.test(value)) {
    const { open, close } = parseRange(value);
    if (open && close) return 'hours';
    if (PARTIAL_RANGE.test(value.trim())) return 'hours';
  }
  return 'text';
}

const DAY_WORD = '(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?';
// "Mon-Fri 8am-6pm", "Sat: by appointment", "Sun" (days only).
const DAY_PART = new RegExp(`^(${DAY_WORD})(?:\\s*(?:-|–|to)\\s*(${DAY_WORD}))?\\s*:?\\s*(.*)$`, 'i');

// One day group's value from older free text: by appointment -> the stored
// BY_APPOINTMENT, "closed" -> '', anything else as written (a time range the
// editor can show, or text the site prints as written).
function legacyDayValue(text) {
  const t = String(text || '').trim();
  if (isByAppointment(t)) return BY_APPOINTMENT;
  if (/^closed\.?$/i.test(t)) return '';
  return t;
}

// The per-day editor's view of saved hours, Mon..Sun. The per-day shape
// and day-range keys go through expandHoursToDays. Older free text is read
// group by group ("Mon-Fri 8am-6pm, Sat by appointment": commas,
// semicolons, middots and new lines separate groups; "Mon, Wed 9am-1pm"
// gives both days the time), so a day the owner wrote "by appointment" for
// shows as By appointment instead of Closed, and a whole "By appointment
// only" applies to every day. Days the text never names stay ''.
export function daysFromHours(value) {
  if (typeof value !== 'string') return expandHoursToDays(value);
  const result = Object.fromEntries(HOURS_DAYS.map((d) => [d, '']));
  const text = value.trim();
  if (!text) return result;
  if (isByAppointment(text)) return Object.fromEntries(HOURS_DAYS.map((d) => [d, BY_APPOINTMENT]));
  const indexOf = (word) => HOURS_DAYS.findIndex((d) => d.toLowerCase() === String(word).toLowerCase().slice(0, 3));
  let waiting = [];
  for (const part of text.split(/[,;·|\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(DAY_PART);
    if (!m) continue;
    const from = indexOf(m[1]);
    const to = m[2] ? indexOf(m[2]) : from;
    if (from < 0 || to < 0) continue;
    // A range may wrap the week ("Fri-Mon"); "Mon-Sun" is all seven.
    const days = Array.from({ length: ((to - from + 7) % 7) + 1 }, (_, k) => HOURS_DAYS[(from + k) % 7]);
    if (!m[3].trim()) {
      waiting = [...waiting, ...days];
      continue;
    }
    for (const d of [...waiting, ...days]) result[d] = legacyDayValue(m[3]);
    waiting = [];
  }
  return result;
}
