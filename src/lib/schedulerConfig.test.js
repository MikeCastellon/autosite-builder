import { describe, it, expect } from 'vitest';
import {
  defaultAppearance,
  normalizeAppearance,
  defaultSchedulerConfig,
  defaultVehicleTypes,
  normalizeVehicleTypes,
  normalizeService,
  resolveVariant,
} from './schedulerConfig.js';

describe('appearance', () => {
  it('default appearance has all themeable fields', () => {
    const a = defaultAppearance();
    expect(a).toEqual({
      page_style: 'branded',
      accent_color: '#1a1a1a',
      background: 'light',
      background_image_url: '',
      corner_style: 'rounded',
      font: 'Inter',
      logo_url: '',
      tagline: '',
    });
  });

  it('defaultSchedulerConfig includes appearance', () => {
    expect(defaultSchedulerConfig().appearance).toEqual(defaultAppearance());
  });

  it('normalizeAppearance fills missing fields and rejects bad enums', () => {
    const a = normalizeAppearance({ page_style: 'minimal', accent_color: '#ff0000', background: 'bogus' });
    expect(a.page_style).toBe('minimal');
    expect(a.accent_color).toBe('#ff0000');
    expect(a.background).toBe('light'); // bad enum falls back
    expect(a.corner_style).toBe('rounded'); // missing → default
  });

  it('normalizeAppearance coerces a non-object to defaults', () => {
    expect(normalizeAppearance(undefined)).toEqual(defaultAppearance());
  });
});

describe('vehicle types (client)', () => {
  it('defaultVehicleTypes seeds the six defaults with vt_ ids', () => {
    const types = defaultVehicleTypes();
    expect(types.map((t) => t.name)).toEqual([
      'Sedan', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Motorcycle', 'Other',
    ]);
    types.forEach((t) => expect(t.id).toMatch(/^vt_/));
  });

  it('normalizeVehicleTypes seeds defaults when the config has none (editor semantics)', () => {
    expect(normalizeVehicleTypes(undefined).length).toBe(6);
    expect(normalizeVehicleTypes([]).length).toBe(6);
  });

  it('normalizeVehicleTypes keeps a valid saved list untouched and drops blank ids/names', () => {
    const saved = [{ id: 'vt_a', name: 'Sedan', enabled: true }];
    expect(normalizeVehicleTypes(saved)).toEqual(saved);
    expect(normalizeVehicleTypes([
      { id: 'vt_a', name: 'Sedan' },
      { id: '  ', name: 'Ghost' },
      { id: 'vt_b', name: '  ' },
    ])).toEqual([{ id: 'vt_a', name: 'Sedan', enabled: true }]);
  });

  it('defaultSchedulerConfig includes vehicle_types', () => {
    expect(defaultSchedulerConfig().vehicle_types.length).toBe(6);
  });
});

describe('normalizeService with vehicle types', () => {
  const types = [
    { id: 'vt_a', name: 'Sedan', enabled: true },
    { id: 'vt_b', name: 'SUV', enabled: true },
  ];

  it('materializes a variant per vehicle type from the legacy base fields', () => {
    const s = normalizeService(
      { id: 'svc_1', name: 'Detail', price: '$149', duration_minutes: 90, addons: [] },
      types
    );
    expect(s.variants.vt_a).toEqual({ enabled: true, price_cents: 14900, duration_minutes: 90 });
    expect(s.variants.vt_b).toEqual({ enabled: true, price_cents: 14900, duration_minutes: 90 });
  });

  it('keeps existing variant values and fills only the gaps', () => {
    const s = normalizeService(
      {
        id: 'svc_1', name: 'Detail', price_cents: 14900, duration_minutes: 90,
        variants: { vt_b: { enabled: false, price_cents: 19900, duration_minutes: 120 } },
      },
      types
    );
    expect(s.variants.vt_b).toEqual({ enabled: false, price_cents: 19900, duration_minutes: 120 });
    expect(s.variants.vt_a).toEqual({ enabled: true, price_cents: 14900, duration_minutes: 90 });
  });

  it('materializes addon prices per vehicle, preserving explicit nulls (not offered)', () => {
    const s = normalizeService(
      {
        id: 'svc_1', name: 'Detail', price_cents: 14900, duration_minutes: 90,
        addons: [
          { id: 'add_1', name: 'Pet hair', price_cents: 2500 },
          { id: 'add_2', name: 'Bed liner', price_cents: 5000, prices: { vt_a: null, vt_b: 5000 } },
        ],
      },
      types
    );
    expect(s.addons[0].prices).toEqual({ vt_a: 2500, vt_b: 2500 });
    expect(s.addons[1].prices).toEqual({ vt_a: null, vt_b: 5000 });
  });

  it('without a vehicleTypes arg behaves like before (no variants invented)', () => {
    const s = normalizeService({ id: 'svc_1', name: 'Detail', price: '$99' });
    expect(s.price_cents).toBe(9900);
    expect(s.variants).toBeUndefined();
  });

  it('rejects a negative base duration when materializing variants', () => {
    const s = normalizeService(
      { id: 'svc_1', name: 'Detail', price_cents: 14900, duration_minutes: -30 },
      types
    );
    expect(s.variants.vt_a.duration_minutes).toBe(60);
  });
});

describe('resolveVariant (client mirror)', () => {
  const svc = {
    id: 'svc_1', name: 'Detail', price_cents: 14900, duration_minutes: 90,
    variants: {
      vt_a: { enabled: true, price_cents: 19900, duration_minutes: 120 },
      vt_off: { enabled: false, price_cents: 9900, duration_minutes: 60 },
    },
  };
  it('resolves a variant and falls back to base without a vehicleTypeId', () => {
    expect(resolveVariant(svc, 'vt_a')).toEqual({ price_cents: 19900, duration_minutes: 120 });
    expect(resolveVariant(svc, null)).toEqual({ price_cents: 14900, duration_minutes: 90 });
  });
  it('returns null for a disabled variant', () => {
    expect(resolveVariant(svc, 'vt_off')).toBeNull();
  });
  it('parses legacy text prices and guards bad durations', () => {
    expect(resolveVariant({ id: 's', name: 'Q', price: '$75', duration_minutes: -30 }, null))
      .toEqual({ price_cents: 7500, duration_minutes: 60 });
  });
});
