import { describe, it, expect } from 'vitest';
import {
  syncServicesFromBusinessInfo,
  addonPriceForVehicle,
  savedVehicleTypes,
  defaultSchedulerConfig,
} from './schedulerConfig.js';
import { addonPriceForVehicle as serverAddonPrice } from '../../netlify/functions/_lib/vehicle-pricing.js';

const biz = (...names) => names.map((name) => ({ name, price: '$50' }));
const names = (services) => services.map((s) => s.name);
const AVAIL = { mon: [{ start: '09:00', end: '17:00' }] };

describe('syncServicesFromBusinessInfo', () => {
  it('offers every website service to a config that was never saved', () => {
    const r = syncServicesFromBusinessInfo({}, biz('Wash', 'Wax'));
    expect(r.changed).toBe(true);
    expect(names(r.services)).toEqual(['Wash', 'Wax']);
    expect(r.seeded_service_names).toEqual(['Wash', 'Wax']);
    expect(r.services[0]).toMatchObject({ enabled: true, price_cents: 5000 });
  });

  it('never brings back a service the owner deleted', () => {
    const first = syncServicesFromBusinessInfo({}, biz('Wash', 'Wax'));
    const afterDelete = { services: first.services.filter((s) => s.name !== 'Wax'), seeded_service_names: first.seeded_service_names };
    const again = syncServicesFromBusinessInfo(afterDelete, biz('Wash', 'Wax'));
    expect(again.changed).toBe(false);
    expect(names(again.services)).toEqual(['Wash']);
  });

  it('never brings back a service the owner renamed', () => {
    const cfg = { services: [{ id: 'svc_1', name: 'Premium Wash' }], seeded_service_names: ['Wash'] };
    expect(syncServicesFromBusinessInfo(cfg, biz('Wash')).changed).toBe(false);
  });

  it('offers a service added to the website later, once', () => {
    const cfg = { services: [{ id: 'svc_1', name: 'Wash' }], seeded_service_names: ['Wash'] };
    const r = syncServicesFromBusinessInfo(cfg, biz('Wash', 'Ceramic'));
    expect(names(r.services)).toEqual(['Wash', 'Ceramic']);
    expect(r.seeded_service_names).toEqual(['Wash', 'Ceramic']);
    const deleted = { services: [r.services[0]], seeded_service_names: r.seeded_service_names };
    expect(syncServicesFromBusinessInfo(deleted, biz('Wash', 'Ceramic')).changed).toBe(false);
  });

  it('does not duplicate a website service the owner already added by hand (any case)', () => {
    const cfg = { services: [{ id: 'svc_1', name: 'wash' }], seeded_service_names: [] };
    const r = syncServicesFromBusinessInfo(cfg, biz('Wash'));
    expect(names(r.services)).toEqual(['wash']);
    expect(r.seeded_service_names).toEqual(['Wash']);
  });

  it('records a set-up config from before the marker without re-adding what the owner removed', () => {
    const cfg = { availability: AVAIL, services: [{ id: 'svc_1', name: 'Wash' }] };
    const r = syncServicesFromBusinessInfo(cfg, biz('Wash', 'Wax'));
    expect(r.changed).toBe(true);
    expect(names(r.services)).toEqual(['Wash']);
    expect(r.seeded_service_names).toEqual(['Wash', 'Wax']);
  });

  it('is not fooled by the defaults shown for an unsaved config (callers pass the stored one)', () => {
    // defaultSchedulerConfig() has availability; the stored config is {}.
    expect(defaultSchedulerConfig().availability).toBeTruthy();
    expect(names(syncServicesFromBusinessInfo({}, biz('Wash')).services)).toEqual(['Wash']);
  });

  it('seeds a config that has hours but never had a services list', () => {
    const r = syncServicesFromBusinessInfo({ availability: AVAIL }, biz('Wash'));
    expect(names(r.services)).toEqual(['Wash']);
  });

  it('ignores blank and duplicate website service names', () => {
    const r = syncServicesFromBusinessInfo({}, [{ name: ' ' }, { name: 'Wash' }, { name: 'Wash ' }, null]);
    expect(names(r.services)).toEqual(['Wash']);
  });
});

describe('vehicle pricing mirrors', () => {
  it('addonPriceForVehicle matches the server helper', () => {
    const addons = [
      { price_cents: 2500 },
      { price_cents: 2500, prices: { vt_a: 4000, vt_b: null, vt_c: 0 } },
      { price_cents: 0 },
      null,
    ];
    for (const a of addons) {
      for (const vt of [null, 'vt_a', 'vt_b', 'vt_c', 'vt_missing']) {
        expect(addonPriceForVehicle(a, vt)).toBe(serverAddonPrice(a, vt));
      }
    }
  });

  it('savedVehicleTypes keeps enabled saved types and never seeds defaults', () => {
    expect(savedVehicleTypes(undefined)).toEqual([]);
    expect(savedVehicleTypes([])).toEqual([]);
    expect(savedVehicleTypes([
      { id: 'vt_a', name: ' Sedan ', enabled: true },
      { id: 'vt_b', name: 'Van', enabled: false },
      { id: '', name: 'Blank' },
    ])).toEqual([{ id: 'vt_a', name: 'Sedan', enabled: true }]);
  });
});
