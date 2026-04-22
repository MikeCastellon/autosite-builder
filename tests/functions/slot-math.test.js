import { describe, it, expect } from 'vitest';
import { computeSlots } from '../../netlify/functions/_lib/slot-math.js';

function iso(date, hhmm) {
  return new Date(`${date}T${hhmm}:00.000Z`).toISOString();
}

describe('computeSlots', () => {
  const availability = [{ start: '09:00', end: '12:00' }];
  const tz = 'UTC';
  const date = '2030-06-01';

  it('generates slot start times every granularity within window, minus service duration', () => {
    const slots = computeSlots({
      dateISO: date,
      availability,
      serviceDurationMin: 60,
      granularityMin: 30,
      confirmedBookings: [],
      timezone: tz,
    });
    expect(slots).toEqual([
      iso(date, '09:00'), iso(date, '09:30'),
      iso(date, '10:00'), iso(date, '10:30'),
      iso(date, '11:00'),
    ]);
  });

  it('hides slots that would overlap a confirmed booking', () => {
    const confirmed = [{ start: iso(date, '10:00'), durationMin: 90 }];
    const slots = computeSlots({
      dateISO: date,
      availability,
      serviceDurationMin: 60,
      granularityMin: 30,
      confirmedBookings: confirmed,
      timezone: tz,
    });
    expect(slots).toEqual([iso(date, '09:00')]);
  });

  it('handles empty availability (closed day)', () => {
    expect(
      computeSlots({
        dateISO: date,
        availability: [],
        serviceDurationMin: 60,
        granularityMin: 30,
        confirmedBookings: [],
        timezone: tz,
      })
    ).toEqual([]);
  });

  it('handles service longer than window', () => {
    expect(
      computeSlots({
        dateISO: date,
        availability,
        serviceDurationMin: 240,
        granularityMin: 30,
        confirmedBookings: [],
        timezone: tz,
      })
    ).toEqual([]);
  });

  it('two windows in one day (multi-shift schema)', () => {
    const twoWindows = [
      { start: '09:00', end: '11:00' },
      { start: '13:00', end: '15:00' },
    ];
    const slots = computeSlots({
      dateISO: date,
      availability: twoWindows,
      serviceDurationMin: 60,
      granularityMin: 60,
      confirmedBookings: [],
      timezone: tz,
    });
    expect(slots).toEqual([
      iso(date, '09:00'), iso(date, '10:00'),
      iso(date, '13:00'), iso(date, '14:00'),
    ]);
  });
});
