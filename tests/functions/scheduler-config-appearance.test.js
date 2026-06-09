import { describe, it, expect } from 'vitest';
import { buildSchedulerPayload } from '../../netlify/functions/_lib/scheduler-payload.js';

describe('buildSchedulerPayload appearance', () => {
  const site = {
    business_info: { businessName: 'Joe Detailing', city: 'Austin' },
    generated_content: {},
    template_id: 'default',
    site_type: 'booking_only',
    scheduler_config: {
      appearance: { page_style: 'minimal', accent_color: '#2563eb', tagline: 'At your door' },
      services: [],
      availability: {},
    },
  };

  it('includes a normalized appearance block', () => {
    const p = buildSchedulerPayload(site);
    expect(p.appearance.page_style).toBe('minimal');
    expect(p.appearance.accent_color).toBe('#2563eb');
    expect(p.appearance.tagline).toBe('At your door');
    expect(p.appearance.corner_style).toBe('rounded'); // filled default
  });

  it('echoes site_type', () => {
    expect(buildSchedulerPayload(site).site_type).toBe('booking_only');
  });

  it('defaults site_type to website', () => {
    expect(buildSchedulerPayload({ ...site, site_type: undefined }).site_type).toBe('website');
  });
});
