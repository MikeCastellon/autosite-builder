// tests/functions/scheduler-payload-vehicles.test.js
import { describe, it, expect } from 'vitest';
import { buildSchedulerPayload } from '../../netlify/functions/_lib/scheduler-payload.js';

function siteWith(cfg) {
  return { business_info: { businessName: 'OG Detailing' }, scheduler_config: cfg };
}

describe('buildSchedulerPayload — vehicle types', () => {
  it('emits enabled vehicle types (id + name only) in order', () => {
    const p = buildSchedulerPayload(siteWith({
      vehicle_types: [
        { id: 'vt_a', name: 'Sedan', enabled: true },
        { id: 'vt_b', name: 'SUV', enabled: false },
        { id: 'vt_c', name: 'Truck' },
      ],
      services: [],
    }));
    expect(p.vehicle_types).toEqual([
      { id: 'vt_a', name: 'Sedan' },
      { id: 'vt_c', name: 'Truck' },
    ]);
  });

  it('emits an empty vehicle_types for legacy configs (widget keeps old flow)', () => {
    const p = buildSchedulerPayload(siteWith({ services: [] }));
    expect(p.vehicle_types).toEqual([]);
  });

  it('passes service variants and add-on price maps through', () => {
    const p = buildSchedulerPayload(siteWith({
      vehicle_types: [{ id: 'vt_a', name: 'Sedan' }],
      services: [{
        id: 'svc_1', name: 'Detail', duration_minutes: 90, price_cents: 14900, enabled: true,
        variants: { vt_a: { enabled: true, price_cents: 14900, duration_minutes: 90 } },
        addons: [{ id: 'add_1', name: 'Pet hair', price_cents: 2500, enabled: true, prices: { vt_a: 2500 } }],
      }],
    }));
    expect(p.services[0].variants).toEqual({ vt_a: { enabled: true, price_cents: 14900, duration_minutes: 90 } });
    expect(p.services[0].addons[0].prices).toEqual({ vt_a: 2500 });
  });

  it('legacy services keep working with no variants key', () => {
    const p = buildSchedulerPayload(siteWith({
      services: [{ id: 'svc_1', name: 'Detail', duration_minutes: 60, price: '$99', enabled: true }],
    }));
    expect(p.services[0].variants).toBeUndefined();
    expect(p.services[0].price_cents).toBe(9900);
  });

  it('filters variants and prices to enabled vehicle types, preserving enabled:false variants and null prices', () => {
    const p = buildSchedulerPayload(siteWith({
      vehicle_types: [
        { id: 'vt_a', name: 'Sedan', enabled: true },
        { id: 'vt_off', name: 'Bus', enabled: false },
      ],
      services: [{
        id: 'svc_1', name: 'Detail', duration_minutes: 90, price_cents: 14900, enabled: true,
        variants: {
          vt_a: { enabled: false, price_cents: 14900, duration_minutes: 90 },
          vt_off: { enabled: true, price_cents: 9900, duration_minutes: 60 },
          vt_gone: { enabled: true, price_cents: 100, duration_minutes: 15 },
        },
        addons: [{ id: 'add_1', name: 'Pet hair', price_cents: 2500, enabled: true, prices: { vt_a: null, vt_off: 3500 } }],
      }],
    }));
    expect(p.services[0].variants).toEqual({ vt_a: { enabled: false, price_cents: 14900, duration_minutes: 90 } });
    expect(p.services[0].addons[0].prices).toEqual({ vt_a: null });
  });

  it('omits array-shaped variants/prices (malformed config)', () => {
    const p = buildSchedulerPayload(siteWith({
      vehicle_types: [{ id: 'vt_a', name: 'Sedan' }],
      services: [{
        id: 'svc_1', name: 'Detail', duration_minutes: 60, price_cents: 9900, enabled: true,
        variants: [{ enabled: true, price_cents: 100 }],
        addons: [{ id: 'add_1', name: 'X', price_cents: 100, enabled: true, prices: [100] }],
      }],
    }));
    expect(p.services[0].variants).toBeUndefined();
    expect(p.services[0].addons[0].prices).toBeUndefined();
  });

  it('omits variants entirely when no vehicle types are saved', () => {
    const p = buildSchedulerPayload(siteWith({
      services: [{
        id: 'svc_1', name: 'Detail', duration_minutes: 60, price_cents: 9900, enabled: true,
        variants: { vt_orphan: { enabled: true, price_cents: 100, duration_minutes: 15 } },
      }],
    }));
    expect(p.services[0].variants).toBeUndefined();
  });
});
