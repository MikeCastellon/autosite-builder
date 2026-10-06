// tests/functions/scheduler-payload-lockdown.test.js
// The public widget payload: what reaches innerHTML / style attributes on
// every published page, and the `bookable` / `today` fields the widget uses.
import { describe, it, expect } from 'vitest';
import { buildSchedulerPayload, MAX_INLINE_LOGO_CHARS } from '../../netlify/functions/_lib/scheduler-payload.js';

const HOURS = { mon: [{ start: '09:00', end: '17:00' }] };
const base = (cfg = {}, extra = {}) => ({
  site_type: 'website',
  business_info: { businessName: 'OG Detailing', state: 'FL' },
  generated_content: {},
  scheduler_config: { availability: HOURS, services: [{ id: 's1', name: 'Wash', price_cents: 5000, duration_minutes: 60 }], ...cfg },
  ...extra,
});

describe('colors are plain hex or the default', () => {
  it('keeps hex brand and accent colors', () => {
    const p = buildSchedulerPayload(base({ appearance: { accent_color: '#2563eb' } }, { generated_content: { _customColors: { primary: '#ff0000' } } }));
    expect(p.brandColor).toBe('#ff0000');
    expect(p.appearance.accent_color).toBe('#2563eb');
  });

  it('drops anything that could break out of a style attribute', () => {
    const evil = 'red;" onmouseover="alert(1)';
    const p = buildSchedulerPayload(base({ appearance: { accent_color: evil } }, { generated_content: { _customColors: { primary: evil } } }));
    expect(p.brandColor).toBe('#1a1a1a');
    expect(p.appearance.accent_color).toBe('#1a1a1a');
  });
});

describe('logos', () => {
  const bigDataUri = 'data:image/jpeg;base64,' + 'A'.repeat(MAX_INLINE_LOGO_CHARS + 10);

  it('drops a large inline (base64) logo: it was 400 KB+ on every page view', () => {
    const p = buildSchedulerPayload(base({ logo_url: bigDataUri }));
    expect(p.logo_url).toBeNull();
  });

  it("falls back to the site's own logo URL", () => {
    const site = base({ logo_url: bigDataUri }, { generated_content: { _images: { logo: 'https://cdn.example.com/logo.png' } } });
    expect(buildSchedulerPayload(site).logo_url).toBe('https://cdn.example.com/logo.png');
  });

  it('keeps small inline logos and https URLs, refuses other schemes', () => {
    expect(buildSchedulerPayload(base({ logo_url: 'data:image/png;base64,iVBORw0KGgo=' })).logo_url).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(buildSchedulerPayload(base({ logo_url: 'https://x.test/l.png' })).logo_url).toBe('https://x.test/l.png');
    expect(buildSchedulerPayload(base({ logo_url: 'javascript:alert(1)' })).logo_url).toBeNull();
  });
});

describe('bookable', () => {
  it('true with hours and a service (or no menu at all, the legacy generic booking)', () => {
    expect(buildSchedulerPayload(base()).bookable).toBe(true);
    expect(buildSchedulerPayload(base({ services: [] })).bookable).toBe(true);
  });

  it('false without any opening hours', () => {
    expect(buildSchedulerPayload(base({ availability: { mon: [], tue: [] } })).bookable).toBe(false);
    expect(buildSchedulerPayload(base({ availability: { mon: [{ start: '17:00', end: '09:00' }] } })).bookable).toBe(false);
  });

  it('false when vehicle types are saved but no service is offered for any of them', () => {
    // Every booking-only page starts like this (6 default types, no services).
    const vt = [{ id: 'vt_a', name: 'Sedan', enabled: true }];
    expect(buildSchedulerPayload(base({ vehicle_types: vt, services: [] })).bookable).toBe(false);
    const offOnly = [{ id: 's1', name: 'Wash', price_cents: 5000, variants: { vt_a: { enabled: false } } }];
    expect(buildSchedulerPayload(base({ vehicle_types: vt, services: offOnly })).bookable).toBe(false);
    expect(buildSchedulerPayload(base({ vehicle_types: vt })).bookable).toBe(true);
  });

  it('the request form is always bookable (no calendar)', () => {
    expect(buildSchedulerPayload(base({ booking_mode: 'simple', availability: {}, services: [] })).bookable).toBe(true);
  });
});

describe("the shop's date and zone", () => {
  it("sends today's date at the shop", () => {
    const p = buildSchedulerPayload(base(), { now: Date.parse('2026-10-06T02:00:00.000Z') });
    expect(p.timezone).toBe('America/New_York');
    expect(p.today).toBe('2026-10-05');
  });
});

describe('owner text is capped', () => {
  it('button label and welcome text', () => {
    const p = buildSchedulerPayload(base({ button_label: 'B'.repeat(100), welcome_text: 'w'.repeat(1000) }));
    expect(p.button_label).toHaveLength(40);
    expect(p.welcome_text).toHaveLength(600);
  });

  it('junk granularity / lead time reach the widget normalized', () => {
    const p = buildSchedulerPayload(base({ slot_granularity_minutes: 0, lead_time_hours: -3 }));
    expect(p.slot_granularity_minutes).toBe(30);
    expect(p.lead_time_hours).toBe(24);
  });
});
