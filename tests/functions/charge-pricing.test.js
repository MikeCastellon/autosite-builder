// tests/functions/charge-pricing.test.js
import { describe, it, expect } from 'vitest';
import { quoteCharge } from '../../netlify/functions/_lib/charge-pricing.js';
import { chargeQuote, chargeVehicleOptions, chargeableServices } from '../../src/lib/createCharge.js';

const TYPES = [
  { id: 'vt_sedan', name: 'Sedan', enabled: true },
  { id: 'vt_suv', name: 'SUV/Crossover', enabled: true },
  { id: 'vt_moto', name: 'Motorcycle', enabled: true },
  { id: 'vt_off', name: 'Van', enabled: false },
];

// What ServicesTab saves: base price_cents mirrors the FIRST vehicle.
const DETAIL = {
  id: 'svc_detail', name: 'Full Detail', enabled: true,
  price: '$149', price_cents: 14900, duration_minutes: 90,
  variants: {
    vt_sedan: { enabled: true, price_cents: 14900, duration_minutes: 90 },
    vt_suv: { enabled: true, price_cents: 19900, duration_minutes: 120 },
    vt_moto: { enabled: false, price_cents: 9900, duration_minutes: 60 },
    vt_off: { enabled: true, price_cents: 25000, duration_minutes: 60 },
  },
  addons: [
    { id: 'add_pet', name: 'Pet hair', enabled: true, price_cents: 2500, prices: { vt_sedan: 2500, vt_suv: 4000, vt_moto: null } },
    { id: 'add_scent', name: 'Scent', enabled: true, price_cents: 0, prices: { vt_sedan: 0, vt_suv: 0 } },
    { id: 'add_off', name: 'Retired', enabled: false, price_cents: 1000 },
    { id: 'add_sedan_only', name: 'Trim', enabled: true, price_cents: 1500, prices: { vt_sedan: 1500, vt_suv: null } },
  ],
};

// Legacy service: no variants, one price for every vehicle.
const WASH = {
  id: 'svc_wash', name: 'Wash', enabled: true, price: '$40', price_cents: null,
  addons: [{ id: 'add_wax', name: 'Wax', enabled: true, price_cents: 1500 }],
};

// Priced per vehicle, but every offered vehicle happens to cost the same.
const FLAT = {
  id: 'svc_flat', name: 'Interior', enabled: true, price_cents: 8000,
  variants: {
    vt_sedan: { enabled: true, price_cents: 8000 },
    vt_suv: { enabled: true, price_cents: 8000 },
    vt_moto: { enabled: false, price_cents: 8000 },
  },
};

describe('quoteCharge (server)', () => {
  it('charges the chosen vehicle its own price, not the first vehicle price', () => {
    const q = quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_suv', addonIds: [] });
    expect(q.ok).toBe(true);
    expect(q.basePriceCents).toBe(19900);
    expect(q.totalCents).toBe(19900);
    expect(q.lineName).toBe('Full Detail (SUV/Crossover)');
    expect(q.serviceName).toBe('Full Detail (SUV/Crossover)');
  });

  it('prices add-ons for the chosen vehicle', () => {
    const q = quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_suv', addonIds: ['add_pet', 'add_scent'] });
    expect(q.addons).toEqual([
      { id: 'add_pet', name: 'Pet hair', price_cents: 4000 },
      { id: 'add_scent', name: 'Scent', price_cents: 0 },
    ]);
    expect(q.totalCents).toBe(19900 + 4000);
    expect(q.serviceName).toBe('Full Detail (SUV/Crossover) + 2 add-ons');
  });

  it('ignores a repeated add-on id instead of charging it twice', () => {
    const q = quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_sedan', addonIds: ['add_pet', 'add_pet'] });
    expect(q.totalCents).toBe(14900 + 2500);
  });

  it('refuses a vehicle the service is not offered for', () => {
    const q = quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_moto', addonIds: [] });
    expect(q.ok).toBe(false);
    expect(q.status).toBe(400);
  });

  it('refuses a disabled or unknown vehicle type', () => {
    expect(quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_off' }).ok).toBe(false);
    expect(quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_nope' }).ok).toBe(false);
  });

  it('refuses an add-on the vehicle is not offered, and disabled or unknown add-ons', () => {
    expect(quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_suv', addonIds: ['add_sedan_only'] }).ok).toBe(false);
    expect(quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_sedan', addonIds: ['add_off'] }).ok).toBe(false);
    expect(quoteCharge({ service: DETAIL, vehicleTypes: TYPES, vehicleTypeId: 'vt_sedan', addonIds: ['add_x'] }).ok).toBe(false);
  });

  it('requires the vehicle when the price depends on it (an old dashboard tab sends none)', () => {
    const q = quoteCharge({ service: DETAIL, vehicleTypes: TYPES, addonIds: [] });
    expect(q.ok).toBe(false);
    expect(q.error).toMatch(/vehicle/i);
  });

  it('charges without a vehicle when every offered vehicle costs the same', () => {
    const q = quoteCharge({ service: FLAT, vehicleTypes: TYPES, addonIds: [] });
    expect(q.ok).toBe(true);
    expect(q.totalCents).toBe(8000);
    expect(q.vehicleType).toBeNull();
    expect(q.lineName).toBe('Interior');
  });

  it('prices a legacy service (no variants) from its text price, with or without a vehicle', () => {
    expect(quoteCharge({ service: WASH, vehicleTypes: TYPES, addonIds: ['add_wax'] }).totalCents).toBe(5500);
    expect(quoteCharge({ service: WASH, vehicleTypes: [], addonIds: [] }).totalCents).toBe(4000);
    expect(quoteCharge({ service: WASH, vehicleTypes: TYPES, vehicleTypeId: 'vt_suv', addonIds: ['add_wax'] }).totalCents).toBe(5500);
  });

  it('refuses a missing/disabled service and a service without a price', () => {
    expect(quoteCharge({ service: null, vehicleTypes: TYPES }).ok).toBe(false);
    expect(quoteCharge({ service: { ...WASH, enabled: false }, vehicleTypes: TYPES }).ok).toBe(false);
    const quoteOnly = { id: 'svc_q', name: 'Ceramic', enabled: true, price: 'Call for quote' };
    const q = quoteCharge({ service: quoteOnly, vehicleTypes: [] });
    expect(q.ok).toBe(false);
    expect(q.error).toMatch(/no chargeable price/);
  });
});

describe('chargeQuote (dashboard mirror) agrees with the server', () => {
  const [detail, wash, flat] = chargeableServices([
    { id: 'site_1', scheduler_config: { vehicle_types: TYPES, services: [DETAIL, WASH, FLAT] } },
  ]);

  const cases = [
    [detail, 'vt_sedan', []],
    [detail, 'vt_sedan', ['add_pet', 'add_sedan_only']],
    [detail, 'vt_suv', ['add_pet', 'add_scent']],
    [wash, 'vt_suv', ['add_wax']],
    [flat, 'vt_suv', []],
  ];
  it.each(cases)('%# same total', (svc, vt, addons) => {
    const server = quoteCharge({ service: svc, vehicleTypes: TYPES, vehicleTypeId: vt, addonIds: addons });
    const client = chargeQuote(svc, vt, addons);
    expect(server.ok).toBe(true);
    expect(client.totalCents).toBe(server.totalCents);
  });

  it('asks for the vehicle where the server would refuse to guess', () => {
    expect(chargeQuote(detail, '', [])).toBeNull();
  });

  it('lists only the vehicles the service is offered for', () => {
    expect(chargeVehicleOptions(detail).map((t) => t.id)).toEqual(['vt_sedan', 'vt_suv']);
  });

  it('does not ask for the vehicle on a service priced the same for all (no variants)', () => {
    expect(chargeVehicleOptions(wash)).toEqual([]);
    expect(chargeQuote(wash, '', ['add_wax']).totalCents).toBe(5500);
  });
});

describe('chargeableServices', () => {
  it('keeps ids, tags each service with its site and vehicle types, and lets the newest site win a name', () => {
    const list = chargeableServices([
      { id: 'new', scheduler_config: { vehicle_types: TYPES, services: [DETAIL, { ...WASH, enabled: false }] } },
      { id: 'old', scheduler_config: { services: [{ ...DETAIL, id: 'svc_old' }, WASH] } },
      { id: 'empty', scheduler_config: null },
    ]);
    expect(list.map((s) => [s.id, s._site_id])).toEqual([['svc_detail', 'new'], ['svc_wash', 'old']]);
    expect(list[0]._vehicle_types.map((t) => t.id)).toEqual(['vt_sedan', 'vt_suv', 'vt_moto']);
    expect(list[1]._vehicle_types).toEqual([]);
  });
});
