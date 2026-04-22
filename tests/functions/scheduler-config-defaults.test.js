import { describe, it, expect } from 'vitest';
import {
  defaultSchedulerConfig,
  seedServicesFromBusinessInfo,
  mergeServicesFromBusinessInfo,
} from '../../netlify/functions/_lib/scheduler-config-defaults.js';

describe('defaultSchedulerConfig', () => {
  it('returns a complete baseline config', () => {
    const cfg = defaultSchedulerConfig();
    expect(cfg.welcome_text).toMatch(/.+/);
    expect(cfg.button_label).toBe('Book Now');
    expect(cfg.lead_time_hours).toBe(24);
    expect(cfg.slot_granularity_minutes).toBe(30);
    expect(cfg.services).toEqual([]);
    expect(Object.keys(cfg.availability)).toEqual(['mon','tue','wed','thu','fri','sat','sun']);
    expect(cfg.availability.mon).toEqual([{ start: '09:00', end: '17:00' }]);
    expect(cfg.availability.sun).toEqual([]);
  });
});

describe('seedServicesFromBusinessInfo', () => {
  it('converts business_info.services into scheduler services with default duration', () => {
    const services = seedServicesFromBusinessInfo([
      { name: 'Full Detail', price: '$149', description: 'Everything inside and out.' },
      { name: 'Ceramic Coating', price: '$299' },
    ]);
    expect(services).toHaveLength(2);
    expect(services[0]).toMatchObject({
      name: 'Full Detail',
      duration_minutes: 60,
      price: '$149',
      description: 'Everything inside and out.',
      enabled: true,
    });
    expect(services[0].id).toMatch(/^svc_/);
    expect(services[1].name).toBe('Ceramic Coating');
    expect(services[1].description ?? '').toBe('');
  });

  it('returns empty array when business_info has no services', () => {
    expect(seedServicesFromBusinessInfo(undefined)).toEqual([]);
    expect(seedServicesFromBusinessInfo(null)).toEqual([]);
    expect(seedServicesFromBusinessInfo([])).toEqual([]);
  });
});

describe('mergeServicesFromBusinessInfo', () => {
  it('adds new services, leaves existing alone, keeps owner-only services', () => {
    const existing = [
      { id: 'svc_a', name: 'Full Detail', duration_minutes: 120, price: '$149', description: 'x', enabled: true },
      { id: 'svc_owner', name: 'VIP Package', duration_minutes: 180, price: '$499', description: 'owner-only', enabled: true },
    ];
    const biz = [
      { name: 'Full Detail', price: '$149', description: 'y' },
      { name: 'Paint Correction', price: '$299', description: 'new one' },
    ];
    const merged = mergeServicesFromBusinessInfo(existing, biz);
    expect(merged.find((s) => s.name === 'Full Detail')).toMatchObject({ id: 'svc_a', duration_minutes: 120 });
    expect(merged.find((s) => s.name === 'VIP Package')).toMatchObject({ id: 'svc_owner' });
    expect(merged.find((s) => s.name === 'Paint Correction')).toMatchObject({
      duration_minutes: 60,
      price: '$299',
      enabled: true,
    });
    expect(merged).toHaveLength(3);
  });
});
