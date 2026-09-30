import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatBookingTime, bookingDayKey, wallTimeToBookingIso, defaultReminderMessage } from './bookings.js';
import { bookingShareUrl } from './bookingUrl.js';

// preferred_at is the shop's wall-clock time written as UTC (slot-math.js):
// a 9:00 AM slot is stored as 09:00Z. The owner's browser zone must not
// move it, so run these in a zone far from UTC.
const NINE_AM = '2026-10-06T09:00:00.000Z';
const LATE = '2026-10-06T23:30:00.000Z'; // 11:30 PM shop time, still Oct 6

let savedTz;
beforeAll(() => { savedTz = process.env.TZ; process.env.TZ = 'America/Los_Angeles'; });
afterAll(() => { if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz; });

describe('formatBookingTime', () => {
  it('runs in a non-UTC zone (guards the tests below)', () => {
    expect(new Date(NINE_AM).getHours()).not.toBe(9);
  });

  it('shows the slot the customer picked, whatever the viewer zone', () => {
    expect(formatBookingTime(NINE_AM)).toBe('Tue, Oct 6, 2026, 9:00 AM');
    expect(formatBookingTime(NINE_AM, { hour: 'numeric', minute: '2-digit' })).toBe('9:00 AM');
    expect(formatBookingTime(LATE, { month: 'short', day: 'numeric' })).toBe('Oct 6');
  });

  it('returns an empty string for a missing or bad value', () => {
    expect(formatBookingTime(null)).toBe('');
    expect(formatBookingTime('not a date')).toBe('');
  });
});

describe('bookingDayKey', () => {
  it('buckets by the shop day, not the viewer day', () => {
    expect(bookingDayKey(LATE)).toBe('2026-10-06');
    expect(bookingDayKey('2026-10-06T00:30:00.000Z')).toBe('2026-10-06');
    expect(bookingDayKey('')).toBe('');
  });
});

describe('wallTimeToBookingIso', () => {
  it('stores the time the owner typed as shop wall-clock time', () => {
    expect(wallTimeToBookingIso('2026-10-06T09:00')).toBe(NINE_AM);
    expect(wallTimeToBookingIso('2026-10-06T14:30:15')).toBe('2026-10-06T14:30:15.000Z');
  });

  it('round-trips through formatBookingTime', () => {
    expect(formatBookingTime(wallTimeToBookingIso('2026-10-06T09:00'), { hour: 'numeric', minute: '2-digit' })).toBe('9:00 AM');
  });

  it('rejects empty or malformed input', () => {
    expect(wallTimeToBookingIso('')).toBeNull();
    expect(wallTimeToBookingIso('2026-10-06')).toBeNull();
    expect(wallTimeToBookingIso('2026-13-40T99:00')).toBeNull();
  });
});

describe('defaultReminderMessage', () => {
  it('texts the customer the booked time', () => {
    const msg = defaultReminderMessage(
      { customer_name: 'Dana Smith', preferred_at: NINE_AM },
      { business_info: { businessName: "Joe's Detailing" } },
    );
    expect(msg).toBe("Hi Dana, friendly reminder: your appointment with Joe's Detailing is on Tue, Oct 6, 9:00 AM. Reply to confirm or reschedule. Thanks!");
  });
});

describe('bookingShareUrl', () => {
  const site = { published_url: 'https://joes.autocaregeniushub.com', site_type: 'website' };

  it('links a website to its /book page', () => {
    expect(bookingShareUrl(site)).toBe('https://joes.autocaregeniushub.com/book');
    expect(bookingShareUrl({ ...site, site_type: 'booking_only' })).toBe('https://joes.autocaregeniushub.com');
  });

  it('uses the custom domain (www host) only once HTTPS is live', () => {
    expect(bookingShareUrl({ ...site, custom_domain: 'joes.com', custom_domain_status: 'active_ssl' }))
      .toBe('https://www.joes.com/book');
    for (const status of ['pending_dns', 'active_dns', 'disconnected', null]) {
      expect(bookingShareUrl({ ...site, custom_domain: 'joes.com', custom_domain_status: status }))
        .toBe('https://joes.autocaregeniushub.com/book');
    }
  });

  it('is empty until the site is published', () => {
    expect(bookingShareUrl({ site_type: 'website' })).toBe('');
    expect(bookingShareUrl(null)).toBe('');
  });
});
