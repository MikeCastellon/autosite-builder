// tests/functions/booking-emails.test.js
// What the booking emails say, captured from a stand-in Postmark client.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const sent = vi.hoisted(() => []);

// postmark.js creates its client at import when POSTMARK_API_KEY is set.
vi.mock('../../netlify/functions/node_modules/postmark/dist/index.js', () => ({
  ServerClient: class {
    sendEmail(msg) { sent.push(msg); return Promise.resolve({ MessageID: `m${sent.length}` }); }
  },
}));

process.env.POSTMARK_API_KEY = 'test-key';
const pm = await import('../../netlify/functions/_lib/postmark.js');

const SITE = { business_info: { businessName: 'OG Detailing' }, published_url: 'https://og-detailing.autocaregeniushub.com' };
const booking = (over = {}) => ({
  id: 'b1',
  customer_name: "Dana O'Brien",
  customer_email: 'dana@example.com',
  customer_phone: '555-0100',
  preferred_at: '2026-10-13T09:00:00.000Z',
  vehicle_year: 2020, vehicle_make: 'Honda', vehicle_model: 'Civic', vehicle_size: 'sedan',
  service_name: 'Full detail',
  ...over,
});

beforeEach(() => { sent.length = 0; vi.spyOn(console, 'log').mockImplementation(() => {}); });

describe('request-form bookings never show the placeholder time', () => {
  it("owner's new-request email shows the customer's words", async () => {
    await pm.newBookingToOwner({ booking: booking(), site: SITE, ownerEmail: 'owner@example.com', requestedTimeText: 'Saturday morning' });
    const [msg] = sent;
    expect(msg.Subject).toBe("New booking request from Dana O'Brien — time to arrange");
    expect(msg.HtmlBody).toContain('Saturday morning');
    expect(msg.HtmlBody).not.toContain('Oct 13');
    expect(msg.TextBody).toContain('asks for: Saturday morning');
  });

  it('a picked slot still shows its time', async () => {
    await pm.newBookingToOwner({ booking: booking(), site: SITE, ownerEmail: 'owner@example.com' });
    expect(sent[0].Subject).toBe("New booking request from Dana O'Brien — Tue, Oct 13, 2026, 9:00 AM");
  });

  it('declining or cancelling a request names the request', async () => {
    await pm.statusUpdateToCustomer({ booking: booking(), site: SITE, status: 'declined', reason: 'Booked up', requestedTime: 'Saturday morning' });
    await pm.statusUpdateToCustomer({ booking: booking(), site: SITE, status: 'cancelled', requestedTime: 'Saturday morning' });
    expect(sent[0].HtmlBody).toContain('your request (Saturday morning)');
    expect(sent[0].HtmlBody).not.toContain('Oct 13');
    expect(sent[1].HtmlBody).toContain('Your request (Saturday morning) has been cancelled.');
  });
});

describe('owner-created bookings', () => {
  it("say the customer is booked, not that the shop will confirm", async () => {
    await pm.bookingReceivedToCustomer({ booking: booking(), site: SITE, isSimple: false, confirmed: true });
    const [msg] = sent;
    expect(msg.Subject).toBe('Your booking is confirmed — OG Detailing');
    expect(msg.HtmlBody).toContain("You're booked for <strong>Tue, Oct 13, 2026, 9:00 AM</strong>.");
    expect(msg.HtmlBody).not.toContain("We'll confirm availability");
  });

  it('a widget request still says it is a request', async () => {
    await pm.bookingReceivedToCustomer({ booking: booking(), site: SITE, isSimple: false });
    expect(sent[0].Subject).toBe('We got your request — OG Detailing');
  });
});

describe('plain-text status emails', () => {
  it('show apostrophes, not HTML entities', async () => {
    await pm.statusUpdateToCustomer({ booking: booking(), site: SITE, status: 'confirmed' });
    expect(sent[0].TextBody).toContain("Thanks Dana O'Brien");
    expect(sent[0].TextBody).not.toContain('&#39;');
    expect(sent[0].HtmlBody).toContain('Dana O&#39;Brien');
  });
});
