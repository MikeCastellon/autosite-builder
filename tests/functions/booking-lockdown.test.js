// tests/functions/booking-lockdown.test.js
//
// The booking endpoints end to end against an in-memory database
// (bookingFakes.js): the public widget's scheduler-config / scheduler-slots /
// create-booking, and the owner's update-booking / owner-create-booking.
// Each block names the hole it closes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fakeDb, profileSelects } from './bookingFakes.js';

const h = vi.hoisted(() => ({ db: null, stripe: null }));

// The functions resolve supabase-js from netlify/functions/node_modules.
vi.mock('../../netlify/functions/node_modules/@supabase/supabase-js/dist/index.mjs', () => ({
  createClient: () => h.db,
}));

vi.mock('../../netlify/functions/_lib/postmark.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    bookingReceivedToCustomer: vi.fn(async () => ({ MessageID: 'm1' })),
    newBookingToOwner: vi.fn(async () => ({ MessageID: 'm2' })),
    statusUpdateToCustomer: vi.fn(async () => ({ MessageID: 'm3' })),
  };
});

vi.mock('../../netlify/functions/_lib/stripe.js', () => ({
  getStripe: () => h.stripe,
}));

const postmark = await import('../../netlify/functions/_lib/postmark.js');
const { handler: schedulerConfig } = await import('../../netlify/functions/scheduler-config.js');
const { handler: schedulerSlots } = await import('../../netlify/functions/scheduler-slots.js');
const { handler: createBooking } = await import('../../netlify/functions/create-booking.js');
const { handler: updateBooking } = await import('../../netlify/functions/update-booking.js');
const { handler: ownerCreate } = await import('../../netlify/functions/owner-create-booking.js');
const { clientIp } = await import('../../netlify/functions/_shared/rateLimit.js');

const SITE_ID = '6c79cf20-0000-4000-8000-0000000000aa';
const OWNER_ID = 'owner-1';
const DAY = 24 * 3600 * 1000;

// Tuesday 2026-10-06, 9:00 AM in Florida (EDT, UTC-4) = 13:00 UTC.
const NOW = Date.parse('2026-10-06T13:00:00.000Z');

function site(cfg = {}, extra = {}) {
  return {
    id: SITE_ID,
    user_id: OWNER_ID,
    slug: 'og-detailing',
    site_type: 'website',
    published_url: 'https://og-detailing.autocaregeniushub.com',
    custom_domain: null,
    custom_domain_status: null,
    business_info: { businessName: 'OG Detailing', city: 'Kissimmee', state: 'FL' },
    generated_content: {},
    scheduler_enabled: true,
    scheduler_config: {
      services: [{ id: 'svc-1', name: 'Full detail', price: '$150', duration_minutes: 60 }],
      availability: {
        mon: [{ start: '09:00', end: '17:00' }], tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }], thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }], sat: [], sun: [],
      },
      slot_granularity_minutes: 30,
      lead_time_hours: 24,
      ...cfg,
    },
    ...extra,
  };
}
const ACTIVE = { id: OWNER_ID, email: 'owner@example.com', subscription_status: 'active' };

function setDb({ siteRow = site(), profile = ACTIVE, bookings = [], opts = {} } = {}) {
  h.db = fakeDb({ sites: [siteRow], profiles: [profile], bookings }, { users: { 'owner-token': OWNER_ID }, ...opts });
  return h.db;
}

const get = (fn, params) => fn({ httpMethod: 'GET', headers: {}, queryStringParameters: params });
const post = (fn, body, headers = {}) => fn({
  httpMethod: 'POST',
  headers: { 'x-nf-client-connection-ip': '203.0.113.7', ...headers },
  body: JSON.stringify(body),
});
const ownerPost = (fn, body) => fn({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer owner-token', origin: 'https://sitebuilder.autocaregenius.com' },
  body: JSON.stringify(body),
});
const json = (res) => JSON.parse(res.body);

function widgetBooking(overrides = {}) {
  return {
    siteId: SITE_ID,
    customer_name: 'Lee Park',
    customer_email: 'lee@example.com',
    customer_phone: '555-0101',
    preferred_at: '2026-10-07T13:00:00.000Z', // Wed 1 PM shop time
    vehicle_make: 'Ford',
    vehicle_model: 'F-150',
    vehicle_year: 2021,
    vehicle_size: 'truck',
    service_id: 'svc-1',
    addon_ids: [],
    ...overrides,
  };
}
const bookingInserts = () => h.db.state.inserts.filter((i) => i.table === 'bookings');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  h.stripe = null;
  setDb();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Gate: the widget and create-booking agree on who may take bookings ──
describe('the Pro gate is the same for the widget and for booking', () => {
  // Zwitch Wash, 2026-10-05: a Stripe payment failed 8 days ago (grace is
  // 7). create-booking refused every booking, but scheduler-config and
  // scheduler-slots didn't select the failure date, read it as "Shopify,
  // no clock" and kept offering slots.
  const lapsed = { ...ACTIVE, subscription_status: 'past_due', stripe_first_failed_payment_at: new Date(NOW - 8 * DAY).toISOString() };
  const inGrace = { ...ACTIVE, subscription_status: 'past_due', stripe_first_failed_payment_at: new Date(NOW - 2 * DAY).toISOString() };

  it('after the grace period: no config, no slots, no booking', async () => {
    setDb({ profile: lapsed });
    expect(json(await get(schedulerConfig, { siteId: SITE_ID }))).toEqual({ enabled: false });
    expect(json(await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-08', serviceId: 'svc-1' })).slots).toEqual([]);
    const res = await post(createBooking, widgetBooking());
    expect(res.statusCode).toBe(403);
    expect(bookingInserts()).toHaveLength(0);
  });

  it('inside the grace period: all three still work', async () => {
    setDb({ profile: inGrace });
    expect(json(await get(schedulerConfig, { siteId: SITE_ID })).enabled).toBe(true);
    expect(json(await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-08', serviceId: 'svc-1' })).slots.length).toBeGreaterThan(0);
    expect((await post(createBooking, widgetBooking())).statusCode).toBe(200);
  });

  it('every gate selects the failure date', async () => {
    await get(schedulerConfig, { siteId: SITE_ID });
    await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-08' });
    await post(createBooking, widgetBooking());
    const selects = profileSelects(h.db);
    expect(selects.length).toBe(3);
    for (const cols of selects) expect(cols).toContain('stripe_first_failed_payment_at');
  });

  it('no function gates on a profile without the failure date (source check)', () => {
    const dirs = ['netlify/functions', 'netlify/functions/_lib'];
    const offenders = [];
    for (const dir of dirs) {
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.js') || name.startsWith('._')) continue;
        const src = readFileSync(path.join(dir, name), 'utf8');
        if (!src.includes('isEffectiveSchedulerActive(')) continue;
        if (name === 'subscription-gating.js') continue;
        if (!src.includes('GATING_PROFILE_COLUMNS') && !src.includes('stripe_first_failed_payment_at')) offenders.push(`${dir}/${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a non-uuid siteId is simply "off" (no database lookup)', async () => {
    expect(json(await get(schedulerConfig, { siteId: 'nope' }))).toEqual({ enabled: false });
    expect(h.db.state.queries).toHaveLength(0);
  });
});

// ─── Shop clock: lead time counts from the shop's wall clock ─────────────
describe("lead time counts from the shop's wall clock, not UTC", () => {
  // Slots are wall-clock times written as UTC. Against Date.now() a Florida
  // shop looked 4 hours further ahead: with 24 h lead time, booking at 9 AM
  // hid the next day's slots before 1 PM.
  it("24 h lead at 9 AM Tuesday: Wednesday from 9 AM is open", async () => {
    const res = json(await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-07', serviceId: 'svc-1' }));
    expect(res.slots[0]).toBe('2026-10-07T09:00:00.000Z');
    expect(res.slots).toContain('2026-10-07T12:30:00.000Z');
  });

  it('same-day booking works with a short lead time', async () => {
    setDb({ siteRow: site({ lead_time_hours: 2 }) });
    const res = json(await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-06', serviceId: 'svc-1' }));
    // 9:00 now + 2 h → 11:00 is the first slot (UTC reading gave 15:00).
    expect(res.slots[0]).toBe('2026-10-06T11:00:00.000Z');
  });

  it('create-booking takes the slot the widget offered, and refuses one inside the lead time', async () => {
    expect((await post(createBooking, widgetBooking({ preferred_at: '2026-10-07T09:00:00.000Z' }))).statusCode).toBe(200);
    const early = await post(createBooking, widgetBooking({ preferred_at: '2026-10-06T16:00:00.000Z', customer_email: 'b@example.com' }));
    expect(early.statusCode).toBe(400);
    expect(json(early).error).toMatch(/too close/i);
  });

  it('uses the zone Booking Settings saved (Pacific: 6 AM there)', async () => {
    setDb({ siteRow: site({ timezone: 'America/Los_Angeles', lead_time_hours: 2 }) });
    const res = json(await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-06', serviceId: 'svc-1' }));
    expect(res.slots[0]).toBe('2026-10-06T09:00:00.000Z'); // 6:00 + 2 h = 8:00, before opening
  });

  it('a junk slot step can no longer hang the function', async () => {
    setDb({ siteRow: site({ slot_granularity_minutes: 0 }) });
    const res = json(await get(schedulerSlots, { siteId: SITE_ID, date: '2026-10-08', serviceId: 'svc-1' }));
    expect(res.slots[0]).toBe('2026-10-08T09:00:00.000Z');
    expect(res.slots[1]).toBe('2026-10-08T09:30:00.000Z'); // the 30-minute default
  });
});

// ─── Request form (booking_mode 'simple') ─────────────────────────────────
describe('request form (simple mode)', () => {
  const requestBody = (overrides = {}) => widgetBooking({
    preferred_at: new Date(NOW + 7 * DAY).toISOString(),
    is_simple_request: true,
    preferred_time_text: 'Saturday morning',
    notes: 'Black paint',
    ...overrides,
  });

  it("the site's saved mode decides: a request flag can't skip the slot checks on a calendar site", async () => {
    // is_simple_request used to bypass the slot, lead-time and hours checks
    // for any site, at any preferred_at the request named.
    const res = await post(createBooking, requestBody({ preferred_at: '2026-10-11T03:00:00.000Z' }));
    expect(res.statusCode).toBe(409);
    expect(json(res).code).toBe('reload_required');
    expect(bookingInserts()).toHaveLength(0);
  });

  it("stores the customer's words first in notes and sets the placeholder time itself", async () => {
    setDb({ siteRow: site({ booking_mode: 'simple' }) });
    const res = await post(createBooking, requestBody({ preferred_at: '2029-01-01T00:00:00.000Z' }));
    expect(res.statusCode).toBe(200);
    const row = bookingInserts()[0].row;
    expect(row.notes).toBe('Preferred time: Saturday morning\n\nBlack paint');
    // A week from the shop's now (9:00), whatever the request said.
    expect(row.preferred_at).toBe('2026-10-13T09:00:00.000Z');
    expect(postmark.newBookingToOwner).toHaveBeenCalledWith(expect.objectContaining({ requestedTimeText: 'Saturday morning' }));
    expect(postmark.bookingReceivedToCustomer).toHaveBeenCalledWith(expect.objectContaining({ isSimple: true }));
  });

  it('accepts the form loaded before this deploy (time already in the notes)', async () => {
    setDb({ siteRow: site({ booking_mode: 'simple' }) });
    const res = await post(createBooking, requestBody({ preferred_time_text: undefined, notes: 'Preferred time: after 3pm\n\nBlack paint' }));
    expect(res.statusCode).toBe(200);
    expect(bookingInserts()[0].row.notes).toBe('Preferred time: after 3pm\n\nBlack paint');
    expect(postmark.newBookingToOwner).toHaveBeenCalledWith(expect.objectContaining({ requestedTimeText: 'after 3pm' }));
  });

  it('needs the preferred time', async () => {
    setDb({ siteRow: site({ booking_mode: 'simple' }) });
    const res = await post(createBooking, requestBody({ preferred_time_text: '  ', notes: 'hi' }));
    expect(res.statusCode).toBe(400);
    expect(bookingInserts()).toHaveLength(0);
  });
});

// ─── Abuse limits ─────────────────────────────────────────────────────────
describe('rate limits key on the address Netlify saw', () => {
  it("prefers x-nf-client-connection-ip over X-Forwarded-For (whose first entry the client writes)", () => {
    expect(clientIp({ headers: { 'x-nf-client-connection-ip': '198.51.100.1', 'x-forwarded-for': '1.2.3.4, 198.51.100.1' } })).toBe('198.51.100.1');
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4'); // netlify dev
    expect(clientIp({ headers: {} })).toBe('unknown');
  });

  it('a made-up X-Forwarded-For per request no longer opens a fresh bucket', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await post(createBooking, widgetBooking({ customer_email: `c${i}@example.com`, preferred_at: `2026-10-0${7 + (i % 2)}T1${i}:00:00.000Z` }), { 'x-forwarded-for': `10.0.0.${i}` });
      expect(res.statusCode, `request ${i}`).not.toBe(429);
    }
    const sixth = await post(createBooking, widgetBooking({ customer_email: 'c9@example.com' }), { 'x-forwarded-for': '10.0.0.99' });
    expect(sixth.statusCode).toBe(429);
  });

  it('limits bookings per recipient email, stored hashed', async () => {
    for (let i = 0; i < 5; i++) {
      await post(createBooking, widgetBooking({ preferred_at: '2026-10-08T10:00:00.000Z' }), { 'x-nf-client-connection-ip': `198.51.100.${i}` });
    }
    const res = await post(createBooking, widgetBooking(), { 'x-nf-client-connection-ip': '198.51.100.50' });
    expect(res.statusCode).toBe(429);
    const emailRows = h.db.state.request_log.filter((r) => r.kind === 'create-booking-email');
    expect(emailRows.length).toBe(5);
    expect(emailRows.every((r) => !r.ip.includes('@'))).toBe(true);
  });
});

// ─── Deposits ─────────────────────────────────────────────────────────────
describe('deposits', () => {
  function stripeMock() {
    return {
      checkout: {
        sessions: {
          create: vi.fn(async (params) => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', params })),
        },
      },
    };
  }
  const depositProfile = { ...ACTIVE, stripe_connect_account_id: 'acct_1', stripe_connect_charges_enabled: true };

  it("sends the customer back to the shop's own page, which shows the outcome", async () => {
    h.stripe = stripeMock();
    setDb({ siteRow: site({ deposit_percentage: 20 }), profile: depositProfile });
    const res = await post(createBooking, widgetBooking());
    expect(res.statusCode).toBe(200);
    expect(json(res).checkout_url).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
    const params = h.stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.success_url).toBe('https://og-detailing.autocaregeniushub.com/?acg_deposit=paid');
    expect(params.cancel_url).toBe('https://og-detailing.autocaregeniushub.com/?acg_deposit=cancelled');
    expect(params.line_items[0].price_data.unit_amount).toBe(3000);
    const row = h.db.state.bookings[0];
    expect(row.deposit_status).toBe('pending');
    expect(row.deposit_checkout_session_id).toBe('cs_test_1');
  });

  it('uses the custom domain once it serves HTTPS', async () => {
    h.stripe = stripeMock();
    setDb({
      siteRow: site({ deposit_percentage: 20 }, { custom_domain: 'stayog.com', custom_domain_status: 'active_ssl' }),
      profile: depositProfile,
    });
    await post(createBooking, widgetBooking());
    expect(h.stripe.checkout.sessions.create.mock.calls[0][0].success_url).toBe('https://www.stayog.com/?acg_deposit=paid');
  });

  it("doesn't send the customer to pay when the session can't be recorded (the payment could never be matched)", async () => {
    h.stripe = stripeMock();
    setDb({
      siteRow: site({ deposit_percentage: 20 }),
      profile: depositProfile,
      opts: { failUpdatesOn: (table, patch) => table === 'bookings' && 'deposit_checkout_session_id' in patch },
    });
    const res = await post(createBooking, widgetBooking());
    expect(res.statusCode).toBe(200);
    expect(json(res).checkout_url).toBeNull();
  });
});

// ─── Owner actions ────────────────────────────────────────────────────────
describe('update-booking', () => {
  const pending = (over = {}) => ({
    id: 'b-new', site_id: SITE_ID, owner_user_id: OWNER_ID, status: 'pending',
    customer_name: 'Lee Park', customer_email: 'lee@example.com',
    preferred_at: '2026-10-08T10:00:00.000Z', duration_minutes: 60, notes: null, ...over,
  });
  const confirmedAt = (iso, over = {}) => ({
    id: 'b-old', site_id: SITE_ID, owner_user_id: OWNER_ID, status: 'confirmed',
    customer_name: 'Dana Smith', customer_email: 'dana@example.com',
    preferred_at: iso, duration_minutes: 90, ...over,
  });

  it('refuses to confirm on top of a confirmed booking unless the owner says so', async () => {
    setDb({ bookings: [pending(), confirmedAt('2026-10-08T09:30:00.000Z')] });
    const res = await ownerPost(updateBooking, { bookingId: 'b-new', action: 'confirm' });
    expect(res.statusCode).toBe(409);
    expect(json(res).code).toBe('overlap');
    expect(json(res).conflicts).toEqual([{ id: 'b-old', customer_name: 'Dana Smith', preferred_at: '2026-10-08T09:30:00.000Z' }]);
    expect(h.db.state.bookings.find((b) => b.id === 'b-new').status).toBe('pending');

    const forced = await ownerPost(updateBooking, { bookingId: 'b-new', action: 'confirm', force: true });
    expect(forced.statusCode).toBe(200);
    expect(h.db.state.bookings.find((b) => b.id === 'b-new').status).toBe('confirmed');
  });

  it('back-to-back bookings are not an overlap', async () => {
    setDb({ bookings: [pending(), confirmedAt('2026-10-08T08:30:00.000Z')] }); // ends 10:00
    expect((await ownerPost(updateBooking, { bookingId: 'b-new', action: 'confirm' })).statusCode).toBe(200);
  });

  it('a request-form booking needs its real time before it can be confirmed', async () => {
    setDb({ bookings: [pending({ notes: 'Preferred time: Saturday morning', preferred_at: '2026-10-13T09:00:00.000Z' })] });
    const res = await ownerPost(updateBooking, { bookingId: 'b-new', action: 'confirm' });
    expect(res.statusCode).toBe(400);
    expect(json(res).code).toBe('time_required');
    expect(postmark.statusUpdateToCustomer).not.toHaveBeenCalled();

    const ok = await ownerPost(updateBooking, { bookingId: 'b-new', action: 'confirm', shop_preferred_at: '2026-10-10T09:30' });
    expect(ok.statusCode).toBe(200);
    expect(json(ok).booking.preferred_at).toBe('2026-10-10T09:30:00.000Z');
    expect(postmark.statusUpdateToCustomer).toHaveBeenCalledWith(expect.objectContaining({
      status: 'confirmed',
      booking: expect.objectContaining({ preferred_at: '2026-10-10T09:30:00.000Z' }),
    }));
  });

  it("declining a request names what the customer asked for, not the placeholder", async () => {
    setDb({ bookings: [pending({ notes: 'Preferred time: Saturday morning' })] });
    expect((await ownerPost(updateBooking, { bookingId: 'b-new', action: 'decline', reason: 'Booked up' })).statusCode).toBe(200);
    expect(postmark.statusUpdateToCustomer).toHaveBeenCalledWith(expect.objectContaining({ status: 'declined', requestedTime: 'Saturday morning' }));
  });

  it('applies a transition only from the status it read (second click / second person gets 409)', async () => {
    setDb({ bookings: [pending()] });
    // Someone else cancels it between our read and our write.
    const realFrom = h.db.from;
    h.db.from = (table) => {
      const q = realFrom(table);
      if (table === 'bookings') {
        const realUpdate = q.update;
        q.update = (...args) => {
          h.db.state.bookings[0].status = 'cancelled';
          return realUpdate(...args);
        };
      }
      return q;
    };
    const res = await ownerPost(updateBooking, { bookingId: 'b-new', action: 'decline', reason: 'x' });
    expect(res.statusCode).toBe(409);
    expect(json(res).code).toBe('stale');
    expect(postmark.statusUpdateToCustomer).not.toHaveBeenCalled();
  });

  it('caps the decline reason', async () => {
    setDb({ bookings: [pending()] });
    const res = await ownerPost(updateBooking, { bookingId: 'b-new', action: 'decline', reason: 'x'.repeat(1001) });
    expect(res.statusCode).toBe(400);
  });
});

describe('owner-create-booking', () => {
  const body = (over = {}) => ({
    siteId: SITE_ID,
    customer_name: 'Dana Smith',
    customer_email: 'dana@example.com',
    customer_phone: '555-0100',
    shop_preferred_at: '2026-10-17T10:00:00.000Z',
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    vehicle_year: 2020,
    service_id: 'svc-1',
    service_name: 'stale name from the dialog',
    send_email: true,
    ...over,
  });

  it("emails the customer that they're booked (it is confirmed), with the menu's service name", async () => {
    const res = await ownerPost(ownerCreate, body());
    expect(res.statusCode).toBe(200);
    expect(postmark.bookingReceivedToCustomer).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true }));
    expect(bookingInserts()[0].row.service_name).toBe('Full detail');
  });

  it('a blank vehicle year is a clear 400, not a failed insert', async () => {
    const res = await ownerPost(ownerCreate, body({ vehicle_year: null }));
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toMatch(/year/i);
    expect(bookingInserts()).toHaveLength(0);
  });

  it('checks the email and the time', async () => {
    expect((await ownerPost(ownerCreate, body({ customer_email: 'not-an-email' }))).statusCode).toBe(400);
    expect((await ownerPost(ownerCreate, body({ shop_preferred_at: 'tomorrow' }))).statusCode).toBe(400);
    expect(bookingInserts()).toHaveLength(0);
  });
});
