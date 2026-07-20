// tests/functions/vehicle-pricing.test.js
import { describe, it, expect } from 'vitest';
import {
  defaultVehicleTypes,
  normalizeVehicleTypes,
  enabledVehicleTypes,
  resolveVariant,
  addonPriceForVehicle,
  vehicleSizeFromTypeName,
  priceRangeCents,
} from '../../netlify/functions/_lib/vehicle-pricing.js';

const SVC = {
  id: 'svc_1', name: 'Full Detail', enabled: true,
  price: '$149', price_cents: 14900, duration_minutes: 90,
  variants: {
    vt_sedan: { enabled: true, price_cents: 14900, duration_minutes: 90 },
    vt_suv:   { enabled: true, price_cents: 19900, duration_minutes: 120 },
    vt_moto:  { enabled: false, price_cents: 9900, duration_minutes: 60 },
  },
};

describe('defaultVehicleTypes', () => {
  it('seeds the six defaults, enabled, with vt_ ids', () => {
    const types = defaultVehicleTypes();
    expect(types.map((t) => t.name)).toEqual([
      'Sedan', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Motorcycle', 'Other',
    ]);
    for (const t of types) {
      expect(t.id).toMatch(/^vt_/);
      expect(t.enabled).toBe(true);
    }
    // ids are unique
    expect(new Set(types.map((t) => t.id)).size).toBe(6);
  });
});

describe('normalizeVehicleTypes / enabledVehicleTypes', () => {
  it('drops malformed entries and defaults enabled to true', () => {
    const out = normalizeVehicleTypes([
      { id: 'vt_a', name: ' Sedan ' },
      { id: 'vt_b', name: 'SUV', enabled: false },
      { id: 'vt_c', name: '' },
      { name: 'no-id' },
      null,
    ]);
    expect(out).toEqual([
      { id: 'vt_a', name: 'Sedan', enabled: true },
      { id: 'vt_b', name: 'SUV', enabled: false },
    ]);
    expect(enabledVehicleTypes([{ id: 'vt_a', name: 'Sedan' }, { id: 'vt_b', name: 'SUV', enabled: false }]))
      .toEqual([{ id: 'vt_a', name: 'Sedan', enabled: true }]);
  });

  it('returns [] for missing config (server never invents types)', () => {
    expect(normalizeVehicleTypes(undefined)).toEqual([]);
    expect(normalizeVehicleTypes(null)).toEqual([]);
  });

  it('drops blank/whitespace-only ids', () => {
    expect(normalizeVehicleTypes([
      { id: '  ', name: 'Sedan' },
      { id: '', name: 'SUV' },
    ])).toEqual([]);
  });
});

describe('resolveVariant', () => {
  it('returns the variant for an enabled vehicle type', () => {
    expect(resolveVariant(SVC, 'vt_suv')).toEqual({ price_cents: 19900, duration_minutes: 120 });
  });
  it('returns null when the variant is disabled (not offered)', () => {
    expect(resolveVariant(SVC, 'vt_moto')).toBeNull();
  });
  it('falls back to base fields with no vehicleTypeId (legacy widget)', () => {
    expect(resolveVariant(SVC, null)).toEqual({ price_cents: 14900, duration_minutes: 90 });
  });
  it('falls back to base fields when the service has no variants (legacy service)', () => {
    const legacy = { id: 'svc_2', name: 'Wash', price_cents: 4900, duration_minutes: 45 };
    expect(resolveVariant(legacy, 'vt_suv')).toEqual({ price_cents: 4900, duration_minutes: 45 });
  });
  it('falls back to base when variants map lacks that id', () => {
    expect(resolveVariant(SVC, 'vt_unknown')).toEqual({ price_cents: 14900, duration_minutes: 90 });
  });
  it('parses legacy text-only prices for the base fallback', () => {
    const textOnly = { id: 'svc_3', name: 'Quote', price: '$75', duration_minutes: 30 };
    expect(resolveVariant(textOnly, null)).toEqual({ price_cents: 7500, duration_minutes: 30 });
  });
  it('fills a variant with missing price/duration from the base', () => {
    const svc = { ...SVC, variants: { vt_suv: { enabled: true } } };
    expect(resolveVariant(svc, 'vt_suv')).toEqual({ price_cents: 14900, duration_minutes: 90 });
  });
});

describe('addonPriceForVehicle', () => {
  const addon = { id: 'add_1', name: 'Pet hair', price_cents: 2500, prices: { vt_sedan: 2500, vt_suv: 3500, vt_moto: null } };
  it('returns the per-vehicle price', () => {
    expect(addonPriceForVehicle(addon, 'vt_suv')).toBe(3500);
  });
  it('returns null when not offered (null or absent key)', () => {
    expect(addonPriceForVehicle(addon, 'vt_moto')).toBeNull();
    expect(addonPriceForVehicle(addon, 'vt_unknown')).toBeNull();
  });
  it('legacy add-on without prices map is offered everywhere at price_cents', () => {
    expect(addonPriceForVehicle({ id: 'a', name: 'x', price_cents: 1500 }, 'vt_suv')).toBe(1500);
  });
  it('no vehicleTypeId → legacy price', () => {
    expect(addonPriceForVehicle(addon, null)).toBe(2500);
  });
});

describe('vehicleSizeFromTypeName', () => {
  it('maps names to the legacy vehicle_size buckets', () => {
    expect(vehicleSizeFromTypeName('Sedan')).toBe('sedan');
    expect(vehicleSizeFromTypeName('SUV/Crossover')).toBe('suv');
    expect(vehicleSizeFromTypeName('Truck')).toBe('truck');
    expect(vehicleSizeFromTypeName('Van/Minivan')).toBe('van');
    expect(vehicleSizeFromTypeName('Motorcycle')).toBe('other');
    expect(vehicleSizeFromTypeName('Anything else')).toBe('other');
    expect(vehicleSizeFromTypeName(undefined)).toBe('other');
  });
});

describe('priceRangeCents', () => {
  const types = [
    { id: 'vt_sedan', name: 'Sedan', enabled: true },
    { id: 'vt_suv', name: 'SUV', enabled: true },
    { id: 'vt_moto', name: 'Motorcycle', enabled: true },
  ];
  it('spans enabled variants only (disabled ones are skipped)', () => {
    expect(priceRangeCents(SVC, types)).toEqual({ min: 14900, max: 19900 });
  });
  it('collapses to the base price with no vehicle types', () => {
    expect(priceRangeCents(SVC, [])).toEqual({ min: 14900, max: 14900 });
  });
  it('returns null when nothing is priced', () => {
    expect(priceRangeCents({ id: 's', name: 'Quote only', price: 'Call us' }, types)).toBeNull();
  });
});
