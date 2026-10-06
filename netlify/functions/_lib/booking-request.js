// Request-form bookings (scheduler_config.booking_mode 'simple'): the
// customer describes when they'd like to come in instead of picking a slot.
// create-booking stores those words as the first line of notes, behind this
// prefix, and puts a placeholder in preferred_at; the owner sets the real
// time when confirming (update-booking). The dashboard reads the same line
// (src/lib/bookings.js requestedTimeText).
export const REQUESTED_TIME_PREFIX = 'Preferred time: ';

// The customer's words, or null for a booking with a picked time.
export function requestedTimeText(notes) {
  if (typeof notes !== 'string' || !notes.startsWith(REQUESTED_TIME_PREFIX)) return null;
  return notes.slice(REQUESTED_TIME_PREFIX.length).split('\n')[0].trim() || null;
}
