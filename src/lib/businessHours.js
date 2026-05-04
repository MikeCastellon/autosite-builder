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
