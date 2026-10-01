// The per-day hours helpers: what each stored day value means to the editor
// row, and the older helpers the wizard and templates use, which the
// By-appointment option must not change.
import { describe, it, expect } from 'vitest';
import { BY_APPOINTMENT, isByAppointment, dayHoursKind, parseRange, rangeToString, expandHoursToDays, daysFromHours, HOURS_DAYS } from './businessHours.js';

describe('isByAppointment', () => {
  it('accepts the stored value and the ways owners type it', () => {
    expect(isByAppointment(BY_APPOINTMENT)).toBe(true);
    expect(isByAppointment('By appointment')).toBe(true);
    expect(isByAppointment('by Appointment only')).toBe(true);
    expect(isByAppointment('BY APPOINTMENT.')).toBe(true);
    expect(isByAppointment('  By  appointment  ')).toBe(true);
  });

  it('rejects other text and non-strings', () => {
    expect(isByAppointment('Appointments daily')).toBe(false);
    expect(isByAppointment('By appointment, 9am-5pm')).toBe(false);
    expect(isByAppointment('')).toBe(false);
    expect(isByAppointment(null)).toBe(false);
    expect(isByAppointment(undefined)).toBe(false);
    expect(isByAppointment({ Mon: 'By appointment' })).toBe(false);
  });
});

describe('dayHoursKind', () => {
  it('closed only for an empty day', () => {
    expect(dayHoursKind('')).toBe('closed');
    expect(dayHoursKind(null)).toBe('closed');
    expect(dayHoursKind(undefined)).toBe('closed');
  });

  it('hours for a range the time inputs can show', () => {
    expect(dayHoursKind('9am-5pm')).toBe('hours');
    expect(dayHoursKind('8:30am-6pm')).toBe('hours');
    expect(dayHoursKind('9am – 5pm')).toBe('hours');
    expect(dayHoursKind(rangeToString('08:00', '18:00'))).toBe('hours');
  });

  it('keeps a half-typed range (one time input cleared) as hours', () => {
    expect(dayHoursKind(rangeToString('09:00', ''))).toBe('hours');
    expect(dayHoursKind(rangeToString('', '17:30'))).toBe('hours');
  });

  it('appointment for By appointment in any spelling', () => {
    expect(dayHoursKind('By Appointment')).toBe('appointment');
    expect(dayHoursKind(BY_APPOINTMENT)).toBe('appointment');
    expect(dayHoursKind('by appointment only')).toBe('appointment');
  });

  it('text for anything else', () => {
    expect(dayHoursKind('24 hours')).toBe('text');
    expect(dayHoursKind('Call ahead')).toBe('text');
    expect(dayHoursKind('Noon-5pm')).toBe('text');
    expect(dayHoursKind('9am')).toBe('text');
  });
});

describe('existing helpers are unchanged', () => {
  it('parseRange and rangeToString round-trip', () => {
    expect(parseRange('9am-5pm')).toEqual({ open: '09:00', close: '17:00' });
    expect(parseRange('')).toEqual({ open: '', close: '' });
    expect(rangeToString('09:00', '17:00')).toBe('9am-5pm');
    expect(rangeToString('', '')).toBe('');
  });

  it('expandHoursToDays keeps By appointment in the per-day shape', () => {
    const perDay = { Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '', Sun: BY_APPOINTMENT };
    expect(expandHoursToDays(perDay)).toEqual(perDay);
    expect(Object.keys(expandHoursToDays(perDay))).toEqual(HOURS_DAYS);
  });

  it('expandHoursToDays still migrates the older shapes', () => {
    expect(expandHoursToDays('Mon-Fri 8am-6pm · Sat 9am-4pm')).toEqual({ Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '9am-4pm', Sun: '' });
    expect(expandHoursToDays({ 'Mon-Fri': '8am-6pm' }).Wed).toBe('8am-6pm');
    expect(expandHoursToDays(null)).toEqual(Object.fromEntries(HOURS_DAYS.map((d) => [d, ''])));
  });
});

describe('daysFromHours (the per-day editor reading older hours)', () => {
  const week = (o) => ({ Mon: '', Tue: '', Wed: '', Thu: '', Fri: '', Sat: '', Sun: '', ...o });

  it('keeps a day written as by appointment instead of closing it', () => {
    expect(daysFromHours('Mon-Fri 8am-6pm, Sat by appointment')).toEqual(week({
      Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: BY_APPOINTMENT,
    }));
    expect(dayHoursKind(daysFromHours('Mon-Fri 8am-6pm, Sat by appointment').Sat)).toBe('appointment');
    // "By appointment only" on its own: every day.
    expect(daysFromHours('By appointment only')).toEqual(Object.fromEntries(HOURS_DAYS.map((d) => [d, BY_APPOINTMENT])));
  });

  it('reads groups, day lists, colons, closed days and wrapped ranges', () => {
    expect(daysFromHours('Mon, Wed 9am-1pm; Fri: 10am-2pm · Sun closed')).toEqual(week({ Mon: '9am-1pm', Wed: '9am-1pm', Fri: '10am-2pm' }));
    expect(daysFromHours('Monday to Sunday 7am-7pm')).toEqual(Object.fromEntries(HOURS_DAYS.map((d) => [d, '7am-7pm'])));
    expect(daysFromHours('Fri-Mon 9am-5pm')).toEqual(week({ Fri: '9am-5pm', Sat: '9am-5pm', Sun: '9am-5pm', Mon: '9am-5pm' }));
    // Other text stays on its days, as written.
    expect(daysFromHours('Sat 24 hours').Sat).toBe('24 hours');
    expect(daysFromHours('Open late')).toEqual(week({}));
  });

  it('leaves the per-day shape and day-range keys to expandHoursToDays', () => {
    const perDay = week({ Mon: '9am-5pm', Sun: BY_APPOINTMENT });
    expect(daysFromHours(perDay)).toEqual(perDay);
    expect(daysFromHours({ 'Mon-Fri': '8am-6pm' })).toEqual(expandHoursToDays({ 'Mon-Fri': '8am-6pm' }));
    expect(daysFromHours(null)).toEqual(week({}));
  });
});
