// "09:00" from <input type="time"> (seconds tolerated, then dropped).
const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

// scheduler_config is written by the owner's browser, so every number in it
// is untrusted. A step of 0 or less never ends the loop below (one request
// would spin a function until Netlify kills it); a tiny one floods the list.
export const DEFAULT_GRANULARITY_MIN = 30;
export function normalizeGranularity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 5) return DEFAULT_GRANULARITY_MIN;
  return Math.min(Math.round(n), 240);
}

// Lead time in hours: 0 (same day) up to a year. Missing or junk is the
// default 24.
export function normalizeLeadHours(value) {
  if (value === undefined || value === null || value === '') return 24;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 24;
  return Math.min(n, 24 * 365);
}

function toMillis(dateISO, hhmm) {
  const m = HHMM_RE.exec(String(hhmm || '').trim());
  if (!m) return NaN;
  return Date.parse(`${dateISO}T${m[1].padStart(2, '0')}:${m[2]}:00.000Z`);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function computeSlots({
  dateISO,
  availability,
  serviceDurationMin,
  granularityMin,
  confirmedBookings,
}) {
  if (!Array.isArray(availability) || availability.length === 0) return [];
  if (!serviceDurationMin || serviceDurationMin <= 0) return [];

  const durationMs = serviceDurationMin * 60 * 1000;
  const stepMs = normalizeGranularity(granularityMin) * 60 * 1000;

  const busy = (confirmedBookings || []).map((b) => {
    const start = Date.parse(b.start);
    const end = start + (b.durationMin || 0) * 60 * 1000;
    return [start, end];
  });

  const out = [];

  for (const window of availability) {
    const wStart = toMillis(dateISO, window?.start);
    const wEnd = toMillis(dateISO, window?.end);
    // A malformed or backwards window has no slots (NaN fails the loop test).
    if (!Number.isFinite(wStart) || !Number.isFinite(wEnd) || wEnd <= wStart) continue;

    for (let t = wStart; t + durationMs <= wEnd; t += stepMs) {
      const slotEnd = t + durationMs;
      const conflicts = busy.some(([bs, be]) => overlaps(t, slotEnd, bs, be));
      if (!conflicts) out.push(new Date(t).toISOString());
    }
  }

  return out;
}

// True when a { start, end } availability window has room for a slot.
export function isOpenWindow(window) {
  const start = toMillis('2000-01-01', window?.start);
  const end = toMillis('2000-01-01', window?.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}
