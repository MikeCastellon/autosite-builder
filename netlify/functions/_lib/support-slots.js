// Slot generation for the platform-level support-Zoom scheduler.
//
// Configurable via env vars (sensible defaults baked in for Mike):
//   SUPPORT_TIMEZONE         IANA TZ name           (default America/New_York)
//   SUPPORT_HOUR_START       Local hour, 0-23       (default 11 → 11am)
//   SUPPORT_HOUR_END         Local hour, 0-23       (default 20 → 8pm; last slot starts before this)
//   SUPPORT_DAYS             Comma list of 0-6      (default 1,2,3,4,5,6 — Mon-Sat; 0=Sun)
//   SUPPORT_SLOT_MINUTES     Slot length            (default 30)
//   SUPPORT_BUFFER_MINUTES   Gap between bookings   (default 15)
//   SUPPORT_HORIZON_DAYS     Days out you can book  (default 14)
//   SUPPORT_LEAD_HOURS       Earliest lead time     (default 2 — can't book within next 2h)

const TZ = process.env.SUPPORT_TIMEZONE || 'America/New_York';
const HOUR_START = Number(process.env.SUPPORT_HOUR_START ?? 11);
const HOUR_END = Number(process.env.SUPPORT_HOUR_END ?? 20);
const DAYS = (process.env.SUPPORT_DAYS || '1,2,3,4,5,6').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
const SLOT_MIN = Number(process.env.SUPPORT_SLOT_MINUTES ?? 30);
const BUFFER_MIN = Number(process.env.SUPPORT_BUFFER_MINUTES ?? 15);
const HORIZON_DAYS = Number(process.env.SUPPORT_HORIZON_DAYS ?? 14);
const LEAD_HOURS = Number(process.env.SUPPORT_LEAD_HOURS ?? 2);

export const SUPPORT_CONFIG = {
  timezone: TZ,
  hourStart: HOUR_START,
  hourEnd: HOUR_END,
  days: DAYS,
  slotMinutes: SLOT_MIN,
  bufferMinutes: BUFFER_MIN,
  horizonDays: HORIZON_DAYS,
  leadHours: LEAD_HOURS,
};

// Get the host's local time parts (year, month, day, weekday) at a given UTC
// instant. We use Intl.DateTimeFormat with the configured timezone — that's
// the only DST-safe approach that doesn't require a third-party tz library.
function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const wkdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? 0 : parts.hour),
    minute: Number(parts.minute),
    weekday: wkdayMap[parts.weekday],
  };
}

// Convert a "local wall clock" (Y/M/D h:m in `tz`) into the UTC Date that
// represents that moment. We do this by guessing UTC, computing the local
// time the guess produces, and adjusting by the difference. Two iterations
// converge across DST transitions.
function zonedToUtc({ year, month, day, hour, minute }, timeZone) {
  // Initial guess: treat the input as if it were UTC.
  let guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let i = 0; i < 2; i++) {
    const local = partsInZone(guessUtc, timeZone);
    const localUtcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
    const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const offset = targetUtcMs - localUtcMs;
    if (offset === 0) break;
    guessUtc = new Date(guessUtc.getTime() + offset);
  }
  return guessUtc;
}

/**
 * Return all open slots within the booking horizon as ISO UTC timestamps.
 *
 * @param {Object} opts
 * @param {Date}   [opts.now]            Current moment (defaults to new Date())
 * @param {Array}  opts.existingBookings Each item has scheduled_at + ends_at ISO strings
 * @returns {Array<{ startISO: string, endISO: string }>}
 */
export function listOpenSlots({ now = new Date(), existingBookings = [] }) {
  const out = [];
  const horizonMs = HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const horizonEnd = new Date(now.getTime() + horizonMs);
  const earliestStart = new Date(now.getTime() + LEAD_HOURS * 60 * 60 * 1000);

  // Iterate days in the host's local TZ from today through the horizon.
  // We compute "today in TZ" first, then walk day-by-day.
  const todayLocal = partsInZone(now, TZ);
  for (let dayOffset = 0; dayOffset < HORIZON_DAYS + 1; dayOffset++) {
    // Construct local midnight for (todayLocal + dayOffset)
    const dateAtZeroUtc = new Date(Date.UTC(todayLocal.year, todayLocal.month - 1, todayLocal.day, 0, 0, 0));
    dateAtZeroUtc.setUTCDate(dateAtZeroUtc.getUTCDate() + dayOffset);
    const dateLocalMidnight = partsInZone(dateAtZeroUtc, TZ);
    if (!DAYS.includes(dateLocalMidnight.weekday)) continue;

    // Generate slot start times for this local day from HOUR_START until
    // HOUR_END − SLOT_MIN (so the slot fully fits before closing time).
    for (let h = HOUR_START; h < HOUR_END; h++) {
      for (let m = 0; m < 60; m += SLOT_MIN) {
        const slotEndHour = h + Math.floor((m + SLOT_MIN) / 60);
        const slotEndMin = (m + SLOT_MIN) % 60;
        // Reject slots that end after closing
        if (slotEndHour > HOUR_END || (slotEndHour === HOUR_END && slotEndMin > 0)) continue;

        const startUtc = zonedToUtc(
          { year: dateLocalMidnight.year, month: dateLocalMidnight.month, day: dateLocalMidnight.day, hour: h, minute: m },
          TZ,
        );
        const endUtc = new Date(startUtc.getTime() + SLOT_MIN * 60 * 1000);

        if (startUtc < earliestStart) continue;
        if (startUtc > horizonEnd) continue;

        // Reject if it conflicts (with buffer) with any existing booking.
        const conflicts = existingBookings.some((b) => {
          const bStart = new Date(b.scheduled_at).getTime();
          const bEnd = new Date(b.ends_at).getTime();
          const bufferMs = BUFFER_MIN * 60 * 1000;
          return startUtc.getTime() < bEnd + bufferMs && endUtc.getTime() > bStart - bufferMs;
        });
        if (conflicts) continue;

        out.push({ startISO: startUtc.toISOString(), endISO: endUtc.toISOString() });
      }
    }
  }
  return out;
}
