# Per-Vehicle Service Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A service (e.g. "Full Detail") can carry a different price, duration, and add-on menu per vehicle type (sedan vs SUV vs truck…), editable by the owner in Booking Settings, selectable by the customer in the public widget, and selectable by the owner in BookCustomerModal.

**Architecture:** Vehicle types live in `sites.scheduler_config.vehicle_types` (jsonb — no column migration). Each service gains a `variants` map keyed by vehicle-type id; each add-on gains a `prices` map keyed by vehicle-type id. Pure resolution helpers live in `netlify/functions/_lib/vehicle-pricing.js` (server canonical) with a small mirror in `src/lib/schedulerConfig.js` (dashboard), following the existing `deposit-math.js` / `parseDollarsToCents` mirror pattern. `bookings` gains three snapshot columns (`vehicle_type_id`, `vehicle_type_name`, `duration_minutes`). Legacy configs keep working: services without `variants` price every vehicle from the base fields, and payloads without `vehicle_types` keep the old widget flow (Size dropdown in the details form).

**Tech Stack:** React (dashboard), vanilla-JS widget (`public/scheduler.js`), Netlify functions (ESM), Supabase Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-booking-platform-v3-design.md` (Feature 2 section).

---

## Data shapes (canonical reference for every task)

```js
// scheduler_config.vehicle_types — ordered, owner-editable
[{ id: 'vt_ab12cd34ef56', name: 'Sedan', enabled: true }, ...]

// scheduler_config.services[] — extended
{
  id: 'svc_...', name, description, enabled,
  price, price_cents, duration_minutes,          // legacy base; synced on save to first enabled vehicle's variant
  variants: {                                     // keyed by vehicle-type id
    'vt_...': { enabled: true, price_cents: 14900, duration_minutes: 90 }
  },
  addons: [{
    id: 'add_...', name, enabled,
    price_cents,                                  // legacy base; synced on save to first enabled vehicle's price
    prices: { 'vt_...': 2500, 'vt_...': null }    // null = NOT offered for that vehicle
  }]
}

// bookings — new snapshot columns
vehicle_type_id text, vehicle_type_name text, duration_minutes int
```

**Resolution rules (implemented once in `vehicle-pricing.js`, mirrored in widget):**
- No `vehicleTypeId` given, or service has no `variants` map, or the map has no entry for that id → fall back to base `price_cents`/`duration_minutes` (base price parsed via `servicePriceCents()` so legacy text prices still work).
- `variants[vtId].enabled === false` → service **not offered** for that vehicle (resolver returns `null`).
- Add-on with a `prices` map: `prices[vtId] == null` (or key absent) → not offered; numeric → that price. Add-on without a `prices` map → offered to every vehicle at `price_cents`.
- `vehicle_size` back-compat: derived from the vehicle-type **name** (`sedan|suv|truck|van|other` buckets).

**Legacy-widget rule:** `scheduler-payload` only emits `vehicle_types` that the owner actually saved. Sites that never re-save Services keep the exact current flow. The dashboard editor seeds the six defaults (Sedan, SUV/Crossover, Truck, Van/Minivan, Motorcycle, Other) the first time the Services tab loads without them; they persist on the owner's next Save.

---

### Task 1: DB migration — bookings snapshot columns

**Files:**
- Create: `db/migrations/20260720_booking_vehicle_types.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Per-vehicle service options (Booking Platform v3, Feature 2).
-- Vehicle types + per-vehicle variants live in sites.scheduler_config (jsonb),
-- so the only schema change is snapshotting the customer's chosen vehicle
-- type and the resolved duration onto each booking. vehicle_size is kept
-- and derived for back-compat.
--
-- Apply via Supabase SQL editor (or Supabase MCP apply_migration) as postgres.

begin;

alter table public.bookings
  add column if not exists vehicle_type_id text,
  add column if not exists vehicle_type_name text,
  add column if not exists duration_minutes int;

commit;
```

- [ ] **Step 2: Apply the migration to the live DB**

Apply via Supabase MCP (`apply_migration`, project `ktnouhjikmlxlbxcxyif`, name `booking_vehicle_types`) with the SQL above.
Verify: `select column_name from information_schema.columns where table_name='bookings' and column_name in ('vehicle_type_id','vehicle_type_name','duration_minutes');` returns 3 rows.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/20260720_booking_vehicle_types.sql
git commit -m "feat(db): bookings vehicle-type + duration snapshot columns"
```

---

### Task 2: Server pure helpers — `vehicle-pricing.js`

**Files:**
- Create: `netlify/functions/_lib/vehicle-pricing.js`
- Test: `tests/functions/vehicle-pricing.test.js`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/functions/vehicle-pricing.test.js`
Expected: FAIL — cannot resolve `../../netlify/functions/_lib/vehicle-pricing.js`.

- [ ] **Step 3: Implement the module**

```js
// netlify/functions/_lib/vehicle-pricing.js
// Pure helpers for per-vehicle service pricing. No I/O, no env access.
//
// A service may carry `variants` keyed by vehicle-type id:
//   variants: { vt_abc: { enabled, price_cents, duration_minutes } }
// Services without variants (legacy) price every vehicle from the base
// price_cents / duration_minutes fields. variants[id].enabled === false
// means "this service is not offered for that vehicle".
//
// Add-ons may carry `prices` keyed by vehicle-type id; null / absent key
// means "not offered for that vehicle". Add-ons without a `prices` map
// (legacy) are offered to every vehicle at price_cents.

import { randomUUID } from 'node:crypto';
import { servicePriceCents } from './deposit-math.js';

export const DEFAULT_VEHICLE_TYPE_NAMES = [
  'Sedan', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Motorcycle', 'Other',
];

export function newVehicleTypeId() {
  return 'vt_' + randomUUID().replace(/-/g, '').slice(0, 12);
}

export function defaultVehicleTypes() {
  return DEFAULT_VEHICLE_TYPE_NAMES.map((name) => ({
    id: newVehicleTypeId(), name, enabled: true,
  }));
}

export function normalizeVehicleTypes(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim() !== '')
    .map((t) => ({ id: t.id, name: t.name.trim(), enabled: t.enabled !== false }));
}

export function enabledVehicleTypes(input) {
  return normalizeVehicleTypes(input).filter((t) => t.enabled);
}

// { price_cents, duration_minutes } the given vehicle books this service at,
// or null when the service is not offered for that vehicle.
export function resolveVariant(service, vehicleTypeId) {
  if (!service) return null;
  const base = {
    price_cents: servicePriceCents(service),
    duration_minutes:
      typeof service.duration_minutes === 'number' && service.duration_minutes > 0
        ? service.duration_minutes
        : 60,
  };
  if (!vehicleTypeId || !service.variants || typeof service.variants !== 'object') return base;
  const v = service.variants[vehicleTypeId];
  if (!v) return base;
  if (v.enabled === false) return null;
  return {
    price_cents:
      typeof v.price_cents === 'number' && v.price_cents > 0 ? v.price_cents : base.price_cents,
    duration_minutes:
      typeof v.duration_minutes === 'number' && v.duration_minutes > 0
        ? v.duration_minutes
        : base.duration_minutes,
  };
}

// Cents (>= 0) when the add-on is offered for that vehicle, else null.
export function addonPriceForVehicle(addon, vehicleTypeId) {
  if (!addon) return null;
  const legacy = typeof addon.price_cents === 'number' && addon.price_cents > 0 ? addon.price_cents : 0;
  if (!vehicleTypeId || !addon.prices || typeof addon.prices !== 'object') return legacy;
  const p = addon.prices[vehicleTypeId];
  if (p == null) return null;
  return typeof p === 'number' && p > 0 ? p : 0;
}

// bookings.vehicle_size is NOT NULL with a check constraint
// (sedan|suv|truck|van|other) — derive the closest bucket from the name.
export function vehicleSizeFromTypeName(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('sedan') || n.includes('coupe')) return 'sedan';
  if (n.includes('suv') || n.includes('crossover')) return 'suv';
  if (n.includes('truck')) return 'truck';
  if (n.includes('van')) return 'van';
  return 'other';
}

// Lowest/highest price across enabled vehicle types ("from $X" support).
// Returns null when no combination has a numeric price.
export function priceRangeCents(service, vehicleTypes) {
  const types = enabledVehicleTypes(vehicleTypes);
  if (types.length === 0) {
    const v = resolveVariant(service, null);
    return v && v.price_cents != null ? { min: v.price_cents, max: v.price_cents } : null;
  }
  let min = null;
  let max = null;
  for (const t of types) {
    const v = resolveVariant(service, t.id);
    if (!v || v.price_cents == null) continue;
    if (min == null || v.price_cents < min) min = v.price_cents;
    if (max == null || v.price_cents > max) max = v.price_cents;
  }
  return min == null ? null : { min, max };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/functions/vehicle-pricing.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/vehicle-pricing.js tests/functions/vehicle-pricing.test.js
git commit -m "feat(booking): pure per-vehicle pricing helpers"
```

---

### Task 3: Client config lib — vehicle types + variant-aware `normalizeService`

**Files:**
- Modify: `src/lib/schedulerConfig.js`
- Test: `src/lib/schedulerConfig.test.js` (extend)

- [ ] **Step 1: Write the failing tests** (append to `src/lib/schedulerConfig.test.js`)

```js
import {
  defaultVehicleTypes,
  normalizeVehicleTypes,
  normalizeService,
} from './schedulerConfig.js';

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

  it('normalizeVehicleTypes keeps a valid saved list untouched', () => {
    const saved = [{ id: 'vt_a', name: 'Sedan', enabled: true }];
    expect(normalizeVehicleTypes(saved)).toEqual(saved);
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schedulerConfig.test.js`
Expected: FAIL — `defaultVehicleTypes` is not exported.

- [ ] **Step 3: Implement** — in `src/lib/schedulerConfig.js`:

3a. Add below `newAddonId()` (client mirror of `_lib/vehicle-pricing.js`; note the **different empty-input semantics**: the editor seeds defaults, the server returns `[]`):

```js
// Mirror of netlify/functions/_lib/vehicle-pricing.js (dashboard copy —
// same reason parseDollarsToCents is mirrored). One deliberate difference:
// the editor seeds the default list when the config has none, while the
// server-side normalizeVehicleTypes returns [] so the public widget never
// sees vehicle types the owner hasn't saved.
export const DEFAULT_VEHICLE_TYPE_NAMES = [
  'Sedan', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Motorcycle', 'Other',
];

export function newVehicleTypeId() {
  return 'vt_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
}

export function defaultVehicleTypes() {
  return DEFAULT_VEHICLE_TYPE_NAMES.map((name) => ({ id: newVehicleTypeId(), name, enabled: true }));
}

export function normalizeVehicleTypes(input) {
  if (!Array.isArray(input) || input.length === 0) return defaultVehicleTypes();
  const cleaned = input
    .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim() !== '')
    .map((t) => ({ id: t.id, name: t.name.trim(), enabled: t.enabled !== false }));
  return cleaned.length > 0 ? cleaned : defaultVehicleTypes();
}
```

3b. Add `vehicle_types: defaultVehicleTypes(),` to the object returned by `defaultSchedulerConfig()` (after `services: [],`).

3c. Replace `normalizeService` with:

```js
// Bring an existing service forward into the new shape — fills price_cents
// from the legacy text and guarantees an addons[] array. When vehicleTypes
// is provided (the editor), also materializes a variant per vehicle type and
// a per-vehicle price map per add-on so every editor cell has a value.
// Explicit nulls in addon prices mean "not offered" and are preserved.
// Idempotent.
export function normalizeService(service, vehicleTypes) {
  if (!service || typeof service !== 'object') return service;
  const out = { ...service };
  if (typeof out.price_cents !== 'number' || out.price_cents <= 0) {
    const parsed = parseDollarsToCents(out.price);
    if (parsed != null) out.price_cents = parsed;
  }
  const hasTypes = Array.isArray(vehicleTypes) && vehicleTypes.length > 0;
  if (!Array.isArray(out.addons)) out.addons = [];
  out.addons = out.addons
    .filter((a) => a && typeof a.name === 'string')
    .map((a) => {
      const addon = {
        id: a.id || newAddonId(),
        name: String(a.name),
        price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
        enabled: a.enabled !== false,
      };
      if (hasTypes) {
        const prices = {};
        for (const t of vehicleTypes) {
          const existing = a.prices && typeof a.prices === 'object' ? a.prices[t.id] : undefined;
          prices[t.id] = existing !== undefined ? existing : addon.price_cents;
        }
        addon.prices = prices;
      } else if (a.prices && typeof a.prices === 'object') {
        addon.prices = { ...a.prices };
      }
      return addon;
    });
  if (hasTypes) {
    const variants = {};
    for (const t of vehicleTypes) {
      const v = (out.variants && typeof out.variants === 'object' && out.variants[t.id]) || null;
      variants[t.id] = {
        enabled: v ? v.enabled !== false : true,
        price_cents:
          v && typeof v.price_cents === 'number' && v.price_cents > 0
            ? v.price_cents
            : (typeof out.price_cents === 'number' && out.price_cents > 0 ? out.price_cents : null),
        duration_minutes:
          v && typeof v.duration_minutes === 'number' && v.duration_minutes > 0
            ? v.duration_minutes
            : (Number(out.duration_minutes) || 60),
      };
    }
    out.variants = variants;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/schedulerConfig.test.js`
Expected: PASS (all, including pre-existing appearance tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedulerConfig.js src/lib/schedulerConfig.test.js
git commit -m "feat(booking): client vehicle-type defaults + variant-aware normalizeService"
```

---

### Task 4: Public payload — expose vehicle types, variants, and add-on price maps

**Files:**
- Modify: `netlify/functions/_lib/scheduler-payload.js`
- Test: `tests/functions/scheduler-payload-vehicles.test.js` (new)

- [ ] **Step 1: Write the failing tests**

```js
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/functions/scheduler-payload-vehicles.test.js`
Expected: FAIL — `p.vehicle_types` is `undefined`.

- [ ] **Step 3: Implement** — in `netlify/functions/_lib/scheduler-payload.js`:

3a. Add import: `import { enabledVehicleTypes } from './vehicle-pricing.js';`

3b. In the returned object, after `cancellation_policy`, add:

```js
    vehicle_types: enabledVehicleTypes(cfg.vehicle_types).map((t) => ({ id: t.id, name: t.name })),
```

3c. In the `services` map, extend the add-on mapping and the returned service:

```js
    services: enabledServices.map((s) => {
      const cents = servicePriceCents(s);
      const enabledAddons = Array.isArray(s.addons)
        ? s.addons
            .filter((a) => a && a.enabled !== false && typeof a.name === 'string' && a.name.trim() !== '')
            .map((a) => ({
              id: a.id,
              name: a.name,
              price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
              ...(a.prices && typeof a.prices === 'object' ? { prices: a.prices } : {}),
            }))
        : [];
      return {
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price ?? (cents != null ? formatCents(cents) : ''),
        price_cents: cents,
        description: s.description ?? '',
        ...(s.variants && typeof s.variants === 'object' ? { variants: s.variants } : {}),
        addons: enabledAddons,
      };
    }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/functions/scheduler-payload-vehicles.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/scheduler-payload.js tests/functions/scheduler-payload-vehicles.test.js
git commit -m "feat(booking): scheduler payload exposes vehicle types + per-vehicle pricing"
```

---

### Task 5: `scheduler-slots` — per-vehicle duration + snapshot-aware blocking

**Files:**
- Modify: `netlify/functions/scheduler-slots.js:24` (query params), `:60-84` (duration + confirmed bookings)

- [ ] **Step 1: Implement**

1a. Add import: `import { resolveVariant } from './_lib/vehicle-pricing.js';`

1b. Change the destructure at line 24 to:

```js
  const { siteId, date, serviceId, vehicleTypeId } = event.queryStringParameters || {};
```

1c. Replace the duration block (lines 60-63):

```js
  const service = (cfg.services || []).find((s) => s.id === serviceId && s.enabled !== false)
    ?? (cfg.services || []).find((s) => s.enabled !== false)
    ?? null;
  const variant = resolveVariant(service, vehicleTypeId);
  const durationMin = variant?.duration_minutes ?? 60;
```

1d. Replace the confirmed-bookings mapping (select + map, lines 70-84) so booked slots block by their **snapshotted** duration first:

```js
  const { data: confirmed } = await supabase
    .from('bookings')
    .select('preferred_at, service_id, duration_minutes')
    .eq('site_id', siteId)
    .eq('status', 'confirmed')
    .gte('preferred_at', dayStart)
    .lte('preferred_at', dayEnd);

  const confirmedBookings = (confirmed || []).map((b) => {
    const bookedSvc = (cfg.services || []).find((s) => s.id === b.service_id);
    return {
      start: b.preferred_at,
      durationMin: b.duration_minutes ?? bookedSvc?.duration_minutes ?? 60,
    };
  });
```

- [ ] **Step 2: Run the full test suite** (guards the helpers this leans on)

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/scheduler-slots.js
git commit -m "feat(booking): slots respect per-vehicle durations"
```

---

### Task 6: `create-booking` — resolve vehicle type, snapshot it, price add-ons per vehicle

**Files:**
- Modify: `netlify/functions/create-booking.js:75-186`

- [ ] **Step 1: Implement**

1a. Add import:

```js
import {
  resolveVariant,
  addonPriceForVehicle,
  vehicleSizeFromTypeName,
  enabledVehicleTypes,
} from './_lib/vehicle-pricing.js';
```

1b. Directly after the `chosenService` resolution block (after line 90), add:

```js
  // Per-vehicle pricing (Feature 2). vehicle_type_id is optional so cached
  // legacy widgets keep working; when present it must match an enabled type.
  const vehicleTypesCfg = enabledVehicleTypes(cfg.vehicle_types);
  let chosenVehicleType = null;
  if (payload.vehicle_type_id) {
    chosenVehicleType = vehicleTypesCfg.find((t) => t.id === payload.vehicle_type_id) || null;
    if (!chosenVehicleType) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown vehicle type' }) };
    }
  }
  const variant = chosenService ? resolveVariant(chosenService, chosenVehicleType?.id) : null;
  if (chosenService && chosenVehicleType && !variant) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'That service is not offered for the selected vehicle type' }) };
  }
```

1c. Replace the add-on matching inside the `for (const id of requestedAddonIds)` loop (lines 103-114) so prices resolve per vehicle and vehicle-excluded add-ons are rejected:

```js
    for (const id of requestedAddonIds) {
      const match = available.find((a) => a.id === id && a.enabled !== false);
      const addonPrice = match ? addonPriceForVehicle(match, chosenVehicleType?.id) : null;
      if (!match || addonPrice == null) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown or disabled add-on' }) };
      }
      resolvedAddons.push({ id: match.id, name: match.name, price_cents: addonPrice });
    }
```

1d. Replace line 116 (`servicePriceCentsValue`) with:

```js
  const servicePriceCentsValue = variant ? variant.price_cents : null;
  const bookedDurationMin = variant?.duration_minutes ?? null;
```

(`resolveVariant` already falls back to `servicePriceCents(service)` internally, so legacy behavior is identical; keep the existing `servicePriceCents` import even though this line no longer calls it — it is still unused only if nothing else references it, in which case remove it from the import list.)

1e. In the slot-validation block, replace `const durationMin = chosenService?.duration_minutes ?? 60;` (line 136) with:

```js
    const durationMin = bookedDurationMin ?? 60;
```

and extend the confirmed-bookings query/mapping (lines 138-149) exactly as in Task 5 step 1d (add `duration_minutes` to the select; `durationMin: b.duration_minutes ?? s?.duration_minutes ?? 60`).

1f. In the insert (lines 164-186), replace `vehicle_size: payload.vehicle_size,` with:

```js
      vehicle_size: chosenVehicleType ? vehicleSizeFromTypeName(chosenVehicleType.name) : payload.vehicle_size,
```

and add after `service_name`:

```js
      vehicle_type_id: chosenVehicleType?.id || null,
      vehicle_type_name: chosenVehicleType?.name || null,
      duration_minutes: chosenService ? bookedDurationMin : null,
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/create-booking.js
git commit -m "feat(booking): create-booking resolves per-vehicle price/duration and snapshots vehicle type"
```

---

### Task 7: `owner-create-booking` — same resolution for the admin path

**Files:**
- Modify: `netlify/functions/owner-create-booking.js:32-116`

- [ ] **Step 1: Implement**

1a. Replace the deposit-math import (line 13) with:

```js
import { computeTotalCents } from './_lib/deposit-math.js';
import {
  resolveVariant,
  addonPriceForVehicle,
  vehicleSizeFromTypeName,
  enabledVehicleTypes,
} from './_lib/vehicle-pricing.js';
```

1b. Add `vehicle_type_id,` to the payload destructure (after `vehicle_size,`).

1c. Replace the resolution block (lines 75-92) with:

```js
  // Resolve service + vehicle type so totals stay honest even when an owner
  // books on a customer's behalf. Owner path is lenient: a vehicle type the
  // service is disabled for still books at the base price (owner knows best).
  const services = (site.scheduler_config?.services) || [];
  const chosenService = service_id ? services.find((s) => s.id === service_id) : null;
  const vehicleTypesCfg = enabledVehicleTypes(site.scheduler_config?.vehicle_types);
  const chosenVehicleType = vehicle_type_id
    ? vehicleTypesCfg.find((t) => t.id === vehicle_type_id) || null
    : null;
  const variant = chosenService
    ? (resolveVariant(chosenService, chosenVehicleType?.id) || resolveVariant(chosenService, null))
    : null;

  const requestedAddonIds = Array.isArray(addon_ids) ? addon_ids : [];
  let resolvedAddons = [];
  if (requestedAddonIds.length > 0 && chosenService && Array.isArray(chosenService.addons)) {
    for (const id of requestedAddonIds) {
      const match = chosenService.addons.find((a) => a.id === id && a.enabled !== false);
      if (!match) continue;
      const addonPrice = addonPriceForVehicle(match, chosenVehicleType?.id);
      if (addonPrice == null) continue;
      resolvedAddons.push({ id: match.id, name: match.name, price_cents: addonPrice });
    }
  }
  const servicePriceCentsValue = variant ? variant.price_cents : null;
  const totalCents = computeTotalCents(servicePriceCentsValue, resolvedAddons);
```

1d. In the insert, replace `vehicle_size: vehicle_size || 'other',` with:

```js
      vehicle_size: chosenVehicleType ? vehicleSizeFromTypeName(chosenVehicleType.name) : (vehicle_size || 'other'),
```

and add after `service_name: service_name || null,`:

```js
      vehicle_type_id: chosenVehicleType?.id || null,
      vehicle_type_name: chosenVehicleType?.name || null,
      duration_minutes: variant?.duration_minutes ?? null,
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/owner-create-booking.js
git commit -m "feat(booking): owner-create-booking snapshots vehicle type + per-vehicle price"
```

---

### Task 8: `VehicleTypesEditor` component

**Files:**
- Create: `src/components/dashboard/booking-settings/VehicleTypesEditor.jsx`

- [ ] **Step 1: Implement** (controlled component — parent owns the list and persists it with Save)

```jsx
// src/components/dashboard/booking-settings/VehicleTypesEditor.jsx
// Owner-managed list of vehicle types (Sedan, SUV, …). Drives the
// per-vehicle pricing rows in ServicesTab. Controlled: parent owns the
// array and persists it alongside services on Save.
import { newVehicleTypeId } from '../../../lib/schedulerConfig.js';
import { useAlert } from '../../ui/AlertProvider.jsx';

export default function VehicleTypesEditor({ vehicleTypes, onChange }) {
  const { confirm: confirmDialog } = useAlert();

  function patch(id, fields) {
    onChange(vehicleTypes.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  function move(id, dir) {
    const idx = vehicleTypes.findIndex((t) => t.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= vehicleTypes.length) return;
    const copy = [...vehicleTypes];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    onChange(copy);
  }

  async function remove(id) {
    const ok = await confirmDialog('Services stop having a separate price for this vehicle type. Existing bookings keep their vehicle info.', {
      title: 'Remove vehicle type?',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    onChange(vehicleTypes.filter((t) => t.id !== id));
  }

  function add() {
    onChange([...vehicleTypes, { id: newVehicleTypeId(), name: '', enabled: true }]);
  }

  return (
    <div className="bg-white border border-black/[0.07] rounded-xl p-4 sm:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#1a1a1a]">Vehicle types</h3>
          <p className="text-xs text-gray-500 mt-0.5">Customers pick their vehicle right after the service — each service can charge a different price and time per type.</p>
        </div>
        <button type="button" onClick={add} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700">+ Add type</button>
      </div>
      <div className="space-y-2">
        {vehicleTypes.map((t, i) => (
          <div key={t.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={t.enabled !== false}
              onChange={(e) => patch(t.id, { enabled: e.target.checked })}
              title="Offer this vehicle type to customers"
            />
            <input
              value={t.name}
              onChange={(e) => patch(t.id, { name: e.target.value })}
              placeholder="e.g. Sedan"
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-white"
            />
            <button type="button" onClick={() => move(t.id, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 rounded text-gray-500 hover:bg-black/[0.05] disabled:opacity-30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button type="button" onClick={() => move(t.id, 1)} disabled={i === vehicleTypes.length - 1} aria-label="Move down" className="p-1.5 rounded text-gray-500 hover:bg-black/[0.05] disabled:opacity-30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button type="button" onClick={() => remove(t.id)} aria-label="Remove vehicle type" className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/booking-settings/VehicleTypesEditor.jsx
git commit -m "feat(booking): vehicle types editor component"
```

---

### Task 9: `ServicesTab` — per-vehicle pricing table + add-on price matrix

**Files:**
- Rewrite: `src/components/dashboard/booking-settings/ServicesTab.jsx`

The tab becomes: `VehicleTypesEditor` card on top, then the services table. Summary row per service shows **On | Name | Price ("from $X") | Add-ons count | edit/remove**. Clicking edit expands a full-width panel with (a) name/description, (b) a per-vehicle pricing table (Offer? / Price / Duration per vehicle type), (c) the add-on matrix (one price cell per enabled vehicle type; blank = not offered for that vehicle). Save persists `services` **and** `vehicle_types` together.

- [ ] **Step 1: Replace the file contents with**

```jsx
import { Fragment, useState } from 'react';
import {
  saveSchedulerConfig,
  normalizeService,
  normalizeVehicleTypes,
  newAddonId,
  parseDollarsToCents,
  formatCentsAsDisplay,
} from '../../../lib/schedulerConfig.js';
import { useAlert } from '../../ui/AlertProvider.jsx';
import VehicleTypesEditor from './VehicleTypesEditor.jsx';

function newService() {
  const id = 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
  return {
    id,
    name: '',
    duration_minutes: 60,
    price: '',
    price_cents: null,
    description: '',
    enabled: true,
    addons: [],
  };
}

function blankAddon(vehicleTypes) {
  const prices = {};
  for (const t of vehicleTypes) prices[t.id] = 0;
  return { id: newAddonId(), name: '', price_cents: 0, enabled: true, prices };
}

// "from $X" summary across enabled variants for the table's Price column.
function priceSummary(service, vehicleTypes) {
  let min = null;
  let max = null;
  for (const t of vehicleTypes.filter((t) => t.enabled !== false)) {
    const v = (service.variants || {})[t.id];
    if (!v || v.enabled === false) continue;
    if (typeof v.price_cents === 'number' && v.price_cents > 0) {
      if (min == null || v.price_cents < min) min = v.price_cents;
      if (max == null || v.price_cents > max) max = v.price_cents;
    }
  }
  if (min == null) return null;
  return min === max ? formatCentsAsDisplay(min) : `from ${formatCentsAsDisplay(min)}`;
}

export default function ServicesTab({ siteId, config, onSaved }) {
  const { confirm: confirmDialog } = useAlert();
  const [vehicleTypes, setVehicleTypes] = useState(() => normalizeVehicleTypes(config?.vehicle_types));
  const [services, setServices] = useState(() =>
    (config?.services || []).map((s) => normalizeService(s, normalizeVehicleTypes(config?.vehicle_types)))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const enabledTypes = vehicleTypes.filter((t) => t.enabled !== false);

  function onVehicleTypesChange(nextTypes) {
    setVehicleTypes(nextTypes);
    // Re-normalize so every service gets a variant + addon price cell for a
    // newly added type; prune data for removed types.
    const keep = new Set(nextTypes.map((t) => t.id));
    setServices((prev) =>
      prev.map((s) => {
        const pruned = {
          ...s,
          variants: Object.fromEntries(Object.entries(s.variants || {}).filter(([id]) => keep.has(id))),
          addons: (s.addons || []).map((a) => ({
            ...a,
            prices: Object.fromEntries(Object.entries(a.prices || {}).filter(([id]) => keep.has(id))),
          })),
        };
        return normalizeService(pruned, nextTypes);
      })
    );
  }

  function patch(id, fields) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }

  function patchVariant(serviceId, typeId, fields) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, variants: { ...s.variants, [typeId]: { ...(s.variants || {})[typeId], ...fields } } }
          : s
      )
    );
  }

  function patchVariantPrice(serviceId, typeId, raw) {
    const cents = parseDollarsToCents(raw);
    patchVariant(serviceId, typeId, { price_cents: cents, _price_input: raw });
  }

  function patchAddon(serviceId, addonId, fields) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, addons: (s.addons || []).map((a) => (a.id === addonId ? { ...a, ...fields } : a)) }
          : s
      )
    );
  }

  // Add-on price cell: blank = not offered for that vehicle (null).
  function patchAddonPrice(serviceId, addonId, typeId, raw) {
    const cents = raw.trim() === '' ? null : (parseDollarsToCents(raw) ?? 0);
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              addons: (s.addons || []).map((a) =>
                a.id === addonId
                  ? {
                      ...a,
                      prices: { ...a.prices, [typeId]: cents },
                      _priceInputs: { ...(a._priceInputs || {}), [typeId]: raw },
                    }
                  : a
              ),
            }
          : s
      )
    );
  }

  function addAddon(serviceId) {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, addons: [...(s.addons || []), blankAddon(vehicleTypes)] } : s))
    );
  }

  function removeAddon(serviceId, addonId) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, addons: (s.addons || []).filter((a) => a.id !== addonId) } : s
      )
    );
  }

  async function remove(id) {
    const ok = await confirmDialog('Existing bookings keep their service name. You can always add it back later.', {
      title: 'Remove service from booking?',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const s = normalizeService(newService(), vehicleTypes);
    setServices((prev) => [...prev, s]);
    setEditingId(s.id);
  }

  async function save() {
    const cleanedTypes = vehicleTypes
      .filter((t) => t.name.trim() !== '')
      .map((t) => ({ id: t.id, name: t.name.trim(), enabled: t.enabled !== false }));

    const cleaned = services
      .filter((s) => s.name.trim() !== '')
      .map((s) => {
        const variants = {};
        for (const t of cleanedTypes) {
          const v = (s.variants || {})[t.id] || {};
          variants[t.id] = {
            enabled: v.enabled !== false,
            price_cents: typeof v.price_cents === 'number' && v.price_cents > 0 ? v.price_cents : null,
            duration_minutes: Math.max(15, Number(v.duration_minutes) || 60),
          };
        }
        // Legacy base fields mirror the first enabled vehicle's variant so old
        // cached widgets and any code reading price_cents stay sensible.
        const firstOffered = cleanedTypes.find((t) => t.enabled && variants[t.id].enabled && variants[t.id].price_cents != null);
        const baseCents = firstOffered ? variants[firstOffered.id].price_cents : (typeof s.price_cents === 'number' && s.price_cents > 0 ? s.price_cents : null);
        const baseDuration = firstOffered ? variants[firstOffered.id].duration_minutes : Math.max(15, Number(s.duration_minutes) || 60);
        const addons = (s.addons || [])
          .filter((a) => a.name && a.name.trim() !== '')
          .map((a) => {
            const prices = {};
            for (const t of cleanedTypes) {
              const p = (a.prices || {})[t.id];
              prices[t.id] = typeof p === 'number' && p >= 0 ? p : null;
            }
            const firstAddonPrice = cleanedTypes.map((t) => prices[t.id]).find((p) => p != null);
            return {
              id: a.id,
              name: a.name.trim(),
              price_cents: firstAddonPrice ?? 0,
              enabled: a.enabled !== false,
              prices,
            };
          });
        return {
          id: s.id,
          name: s.name,
          description: s.description ?? '',
          enabled: s.enabled !== false,
          duration_minutes: baseDuration,
          price: baseCents != null ? formatCentsAsDisplay(baseCents) : (s.price || ''),
          price_cents: baseCents,
          variants,
          addons,
        };
      });

    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, { services: cleaned, vehicle_types: cleanedTypes });
      onSaved && onSaved(updated);
      setVehicleTypes(cleanedTypes);
      setServices(cleaned.map((s) => normalizeService(s, cleanedTypes)));
      setEditingId(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <VehicleTypesEditor vehicleTypes={vehicleTypes} onChange={onVehicleTypesChange} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">Customers pick a service, then their vehicle type — the price, time, and add-ons they see come from the vehicle row you set here.</p>
        <button onClick={add} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000]">+ Add service</button>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
            <tr>
              <th className="px-4 py-3 w-16">On</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 w-32">Price</th>
              <th className="px-4 py-3 w-28">Add-ons</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const editing = editingId === s.id;
              const summary = priceSummary(s, vehicleTypes);
              const addonCount = (s.addons || []).length;
              return (
                <Fragment key={s.id}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={s.enabled !== false} onChange={(e) => patch(s.id, { enabled: e.target.checked })} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{s.name || <em className="text-gray-400">untitled</em>}</span>
                      {s.description ? <span className="block text-xs text-gray-400 truncate max-w-[280px]">{s.description}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={summary ? 'text-gray-700' : 'text-amber-600'}>
                        {summary || (s.price ? `${s.price} (text only)` : '—')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {addonCount === 0 ? '—' : `${addonCount} add-on${addonCount === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(editing ? null : s.id)}
                          aria-label={editing ? 'Done editing' : 'Edit service'}
                          title={editing ? 'Done' : 'Edit pricing & add-ons'}
                          className="p-1.5 rounded hover:bg-black/[0.05] text-gray-600 hover:text-[#1a1a1a] transition-colors"
                        >
                          {editing ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          )}
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          aria-label="Remove service"
                          title="Remove"
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {editing && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4">
                        {/* Name + description */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                          <label className="block text-xs font-semibold text-gray-600">
                            Service name
                            <input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white font-normal" autoFocus />
                          </label>
                          <label className="block text-xs font-semibold text-gray-600">
                            Description
                            <input value={s.description || ''} onChange={(e) => patch(s.id, { description: e.target.value })} className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white font-normal" />
                          </label>
                        </div>

                        {/* Per-vehicle pricing */}
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Price & time per vehicle</div>
                        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg mb-4">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 text-left">
                              <tr className="border-b border-gray-100">
                                <th className="px-3 py-2">Vehicle</th>
                                <th className="px-3 py-2 w-20">Offer</th>
                                <th className="px-3 py-2 w-28">Price</th>
                                <th className="px-3 py-2 w-32">Duration (min)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {enabledTypes.map((t) => {
                                const v = (s.variants || {})[t.id] || {};
                                const offered = v.enabled !== false;
                                return (
                                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-3 py-2 font-medium text-gray-800">{t.name || <em className="text-gray-400">unnamed</em>}</td>
                                    <td className="px-3 py-2">
                                      <input type="checkbox" checked={offered} onChange={(e) => patchVariant(s.id, t.id, { enabled: e.target.checked })} title="Offer this service for this vehicle type" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={v._price_input != null ? v._price_input : (typeof v.price_cents === 'number' && v.price_cents > 0 ? formatCentsAsDisplay(v.price_cents) : '')}
                                        onChange={(e) => patchVariantPrice(s.id, t.id, e.target.value)}
                                        onBlur={() => { if (typeof v.price_cents === 'number' && v.price_cents > 0) patchVariant(s.id, t.id, { _price_input: formatCentsAsDisplay(v.price_cents) }); }}
                                        disabled={!offered}
                                        placeholder="$149"
                                        inputMode="decimal"
                                        className="w-24 border border-gray-200 rounded px-2 py-1 text-sm disabled:opacity-40 disabled:bg-gray-50"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number" min="15" step="15"
                                        value={v.duration_minutes ?? 60}
                                        onChange={(e) => patchVariant(s.id, t.id, { duration_minutes: Number(e.target.value) })}
                                        disabled={!offered}
                                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm disabled:opacity-40 disabled:bg-gray-50"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Add-on matrix */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add-ons <span className="normal-case font-normal">(price per vehicle — leave blank to not offer for that vehicle)</span></div>
                          <button type="button" onClick={() => addAddon(s.id)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700">+ Add an add-on</button>
                        </div>
                        {(s.addons || []).length === 0 ? (
                          <div className="text-xs text-gray-500 italic py-2">No add-ons yet. Add optional extras like "Pet hair removal" — customers see them after picking their vehicle.</div>
                        ) : (
                          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-gray-500 text-left">
                                <tr className="border-b border-gray-100">
                                  <th className="px-3 py-2 w-10">On</th>
                                  <th className="px-3 py-2 min-w-[160px]">Add-on</th>
                                  {enabledTypes.map((t) => (
                                    <th key={t.id} className="px-3 py-2 w-24">{t.name}</th>
                                  ))}
                                  <th className="px-3 py-2 w-12" />
                                </tr>
                              </thead>
                              <tbody>
                                {s.addons.map((a) => (
                                  <tr key={a.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-3 py-2">
                                      <input type="checkbox" checked={a.enabled !== false} onChange={(e) => patchAddon(s.id, a.id, { enabled: e.target.checked })} title="Show this add-on to customers" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={a.name}
                                        onChange={(e) => patchAddon(s.id, a.id, { name: e.target.value })}
                                        placeholder="Add-on name"
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                      />
                                    </td>
                                    {enabledTypes.map((t) => {
                                      const raw = a._priceInputs && a._priceInputs[t.id] != null
                                        ? a._priceInputs[t.id]
                                        : ((a.prices || {})[t.id] != null ? ((a.prices)[t.id] > 0 ? formatCentsAsDisplay(a.prices[t.id]) : '$0') : '');
                                      return (
                                        <td key={t.id} className="px-3 py-2">
                                          <input
                                            value={raw}
                                            onChange={(e) => patchAddonPrice(s.id, a.id, t.id, e.target.value)}
                                            placeholder="—"
                                            inputMode="decimal"
                                            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm"
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2">
                                      <button type="button" onClick={() => removeAddon(s.id, a.id)} aria-label="Remove add-on" className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {services.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No services yet — click "+ Add service" or "Re-sync from site".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save services'}
      </button>
    </div>
  );
}
```

Notes:
- The old add-ons dismissable hint (`ADDONS_HINT_KEY`) is removed — the matrix makes add-ons self-evident. Also drop the now-unused `expandedAddonsId` state and the `Duration` column (durations live in the per-vehicle table now).
- Save persists `vehicle_types` alongside `services` in one `saveSchedulerConfig` call — this is the moment a legacy site "upgrades" to the vehicle-picker flow.
- `_price_input` / `_priceInputs` are transient editor fields; they are dropped on save because `save()` rebuilds each object from scratch.

- [ ] **Step 2: Lint + full tests**

Run: `npm run lint && npm test`
Expected: PASS, no new lint errors.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open Booking Settings → Services for a site: vehicle types card shows the six defaults, editing a service shows the per-vehicle price table and add-on matrix, Save round-trips (reload keeps values).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/booking-settings/ServicesTab.jsx
git commit -m "feat(booking): per-vehicle pricing editor in Services tab"
```

---

### Task 10: Widget — vehicle step + per-vehicle prices end-to-end

**Files:**
- Modify: `public/scheduler.js`

All edits are inside `openModal()` unless noted. The widget only enters the new flow when `cfg.vehicle_types` is non-empty (Task 4 guarantees legacy sites send `[]`).

- [ ] **Step 1: Add resolution helpers + state**

1a. Extend the `state` object (line ~378) with:

```js
      vehicleType: null,   // { id, name } chosen on the vehicle step
```

1b. Below `serviceAddons(s)` (line ~392), add:

```js
    function vehicleTypes() {
      return Array.isArray(cfg.vehicle_types) ? cfg.vehicle_types : [];
    }
    // Mirror of netlify/functions/_lib/vehicle-pricing.js resolveVariant.
    function variantFor(s, vtId) {
      if (!s) return null;
      var base = {
        price_cents: (typeof s.price_cents === 'number' && s.price_cents > 0) ? s.price_cents : null,
        duration_minutes: s.duration_minutes || 60,
      };
      if (!vtId || !s.variants) return base;
      var v = s.variants[vtId];
      if (!v) return base;
      if (v.enabled === false) return null;
      return {
        price_cents: (typeof v.price_cents === 'number' && v.price_cents > 0) ? v.price_cents : base.price_cents,
        duration_minutes: (typeof v.duration_minutes === 'number' && v.duration_minutes > 0) ? v.duration_minutes : base.duration_minutes,
      };
    }
    function offeredVehicleTypes(s) {
      return vehicleTypes().filter(function (t) { return variantFor(s, t.id) !== null; });
    }
    function chosenVariant() {
      return variantFor(state.service, state.vehicleType ? state.vehicleType.id : null);
    }
    function addonPriceFor(a, vtId) {
      var legacy = (typeof a.price_cents === 'number' && a.price_cents > 0) ? a.price_cents : 0;
      if (!vtId || !a.prices) return legacy;
      var p = a.prices[vtId];
      if (p == null) return null;
      return (typeof p === 'number' && p > 0) ? p : 0;
    }
    function offeredAddons() {
      var vtId = state.vehicleType ? state.vehicleType.id : null;
      return serviceAddons(state.service).filter(function (a) { return addonPriceFor(a, vtId) != null; });
    }
    function sizeFromTypeName(name) {
      var n = String(name || '').toLowerCase();
      if (n.indexOf('sedan') !== -1 || n.indexOf('coupe') !== -1) return 'sedan';
      if (n.indexOf('suv') !== -1 || n.indexOf('crossover') !== -1) return 'suv';
      if (n.indexOf('truck') !== -1) return 'truck';
      if (n.indexOf('van') !== -1) return 'van';
      return 'other';
    }
    function servicePriceLabel(s) {
      var vts = vehicleTypes();
      if (vts.length === 0) {
        return (typeof s.price_cents === 'number' && s.price_cents > 0) ? formatCents(s.price_cents) : (s.price || '');
      }
      var min = null, max = null;
      vts.forEach(function (t) {
        var v = variantFor(s, t.id);
        if (v && typeof v.price_cents === 'number' && v.price_cents > 0) {
          if (min == null || v.price_cents < min) min = v.price_cents;
          if (max == null || v.price_cents > max) max = v.price_cents;
        }
      });
      if (min == null) return s.price || '';
      return min === max ? formatCents(min) : 'from ' + formatCents(min);
    }
```

1c. Replace `totalCents()` so it prices by vehicle:

```js
    function totalCents() {
      if (!state.service) return null;
      var v = chosenVariant();
      var base = v ? v.price_cents : null;
      if (base == null) return null;
      var vtId = state.vehicleType ? state.vehicleType.id : null;
      var addOnTotal = selectedAddons().reduce(function (sum, a) {
        var p = addonPriceFor(a, vtId);
        return sum + (p || 0);
      }, 0);
      return base + addOnTotal;
    }
```

and change `selectedAddons()` to select from the offered list:

```js
    function selectedAddons() {
      return offeredAddons().filter(function (a) { return state.addonSelections[a.id]; });
    }
```

- [ ] **Step 2: Update `render()` and `stepCounts()`**

Replace both functions:

```js
    function render() {
      var enabledServices = (cfg.services || []).filter(function (s) { return s.enabled !== false; });
      if (cfg.booking_mode === 'simple') {
        if (!state.details.submitted) return renderSimpleForm(enabledServices);
        return renderSuccess();
      }
      var anyServiceHasAddons = enabledServices.some(function (s) { return serviceAddons(s).length > 0; });
      var showServicePicker = enabledServices.length > 1 || anyServiceHasAddons || vehicleTypes().length > 0;
      if (!state.service && showServicePicker) return renderServices(enabledServices);
      // Vehicle step (Feature 2): shown when the owner saved vehicle types.
      // A single offered type is auto-selected so the step disappears.
      if (state.service && vehicleTypes().length > 0 && !state.vehicleType) {
        var offered = offeredVehicleTypes(state.service);
        if (offered.length === 1) {
          state.vehicleType = { id: offered[0].id, name: offered[0].name };
        } else {
          return renderVehicles(offered);
        }
      }
      if (state.service && offeredAddons().length > 0 && !state.addonsConfirmed) {
        return renderAddons();
      }
      if (!state.dateISO || !state.slotISO) return renderDateTime();
      if (!state.details.submitted) return renderDetails();
      return renderSuccess();
    }

    // Step counts: service-pick + vehicle (if any) + add-ons (if any) +
    // date/time + details. Used by stepBar().
    function stepCounts() {
      var enabledServices = (cfg.services || []).filter(function (s) { return s.enabled !== false; });
      var anyServiceHasAddons = enabledServices.some(function (s) { return serviceAddons(s).length > 0; });
      var showServicePicker = enabledServices.length > 1 || anyServiceHasAddons || vehicleTypes().length > 0;
      var offered = state.service ? offeredVehicleTypes(state.service) : vehicleTypes();
      var hasVehicleStep = vehicleTypes().length > 0 && offered.length > 1;
      var hasAddons = state.service && offeredAddons().length > 0;
      var total = 2 + (showServicePicker ? 1 : 0) + (hasVehicleStep ? 1 : 0) + (hasAddons ? 1 : 0);
      return { total: total, hasMultipleServices: showServicePicker, hasVehicleStep: hasVehicleStep, hasAddons: hasAddons };
    }
```

- [ ] **Step 3: Add `renderVehicles()`** (place after `renderServices`)

```js
    function renderVehicles(offered) {
      var counts = stepCounts();
      var currentStep = 1 + (counts.hasMultipleServices ? 1 : 0);
      var items = offered.map(function (t) {
        var v = variantFor(state.service, t.id);
        var priceLabel = v && v.price_cents != null ? formatCents(v.price_cents) : '';
        var durLabel = v ? v.duration_minutes + ' min' : '';
        return '<button type="button" data-vt="' + esc(t.id) + '" style="display:block;width:100%;text-align:left;padding:16px 18px;margin-bottom:10px;border:1px solid ' + T.chipBorder + ';border-radius:12px;background:' + T.chipBg + ';color:' + T.text + ';cursor:pointer;transition:all 0.15s ease;font-family:' + FONT + ';" onmouseover="this.style.borderColor=\'' + brand + '\';this.style.background=\'' + T.chipHoverBg + '\';" onmouseout="this.style.borderColor=\'' + T.chipBorder + '\';this.style.background=\'' + T.chipBg + '\';">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">' +
            '<div style="font-weight:700;color:' + T.text + ';font-size:15px;letter-spacing:-0.2px;">' + esc(t.name) + '</div>' +
            (priceLabel ? '<div style="font-weight:700;color:' + brand + ';font-size:14px;white-space:nowrap;">' + esc(priceLabel) + '</div>' : '') +
          '</div>' +
          (durLabel ? '<div style="font-size:12px;color:' + T.softMuted + ';margin-top:4px;letter-spacing:0.2px;">' + esc(durLabel) + ' appointment</div>' : '') +
        '</button>';
      }).join('');
      card.innerHTML = brandBar() + brandHeader() + stepBar(currentStep + 1, counts.total) +
        sectionTitle('What are we detailing?', state.service.name) +
        bodyOpen() + items +
          (counts.hasMultipleServices
            ? '<button type="button" data-back style="background:none;border:0;color:' + T.softMuted + ';cursor:pointer;font-size:13px;font-weight:600;font-family:' + FONT + ';padding:6px 0;">← Back</button>'
            : '') +
        bodyClose();
      wireClose();
      card.querySelectorAll('[data-vt]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var t = offered.find(function (x) { return x.id === btn.getAttribute('data-vt'); });
          state.vehicleType = { id: t.id, name: t.name };
          state.addonSelections = {};
          state.addonsConfirmed = false;
          render();
        });
      });
      var backBtn = card.querySelector('[data-back]');
      if (backBtn) backBtn.addEventListener('click', function () {
        state.service = null;
        state.vehicleType = null;
        state.addonSelections = {};
        state.addonsConfirmed = false;
        render();
      });
    }
```

- [ ] **Step 4: Update the existing steps for vehicle awareness**

4a. `renderServices` — price label + reset vehicle on pick. Replace the `priceLabel` assignment with:

```js
        var priceLabel = servicePriceLabel(s);
```

and inside its click handler, after `state.service = ...`, add `state.vehicleType = null;` (before the add-on resets).

4b. `renderAddons` — per-vehicle prices. Replace `var addons = serviceAddons(state.service);` with `var addons = offeredAddons();`. Replace the `basePriceCents` assignment with:

```js
      var v = chosenVariant();
      var basePriceCents = v ? v.price_cents : null;
```

Replace the per-item `priceLabel` with:

```js
        var itemPrice = addonPriceFor(a, state.vehicleType ? state.vehicleType.id : null);
        var priceLabel = itemPrice > 0 ? ('+' + formatCents(itemPrice)) : 'Free';
```

Replace the `currentStep` computation with:

```js
      var currentStep = 1 + (counts.hasMultipleServices ? 1 : 0) + (counts.hasVehicleStep ? 1 : 0);
```

Replace the subtitle with:

```js
      var subtitle = state.service.name +
        (state.vehicleType ? ' · ' + state.vehicleType.name : '') +
        ' · ' + (v ? v.duration_minutes : state.service.duration_minutes) + ' min';
```

Change the back button so it returns to the vehicle step when there is one (replace the existing `data-back` handler body):

```js
      if (backBtn) backBtn.addEventListener('click', function () {
        state.addonSelections = {};
        state.addonsConfirmed = false;
        if (counts.hasVehicleStep) {
          state.vehicleType = null;
        } else {
          state.service = null;
          state.vehicleType = null;
        }
        render();
      });
```

and render the back button whenever there is a previous step: change the condition `counts.hasMultipleServices ? ... : '<span></span>'` to `(counts.hasMultipleServices || counts.hasVehicleStep) ? ... : '<span></span>'`.

4c. `renderDateTime` — step index, subtitle, back nav:

```js
      var currentStep = 1 + (counts.hasMultipleServices ? 1 : 0) + (counts.hasVehicleStep ? 1 : 0) + (counts.hasAddons ? 1 : 0);
      var v = chosenVariant();
      var subtitle = state.service
        ? state.service.name + (state.vehicleType ? ' · ' + state.vehicleType.name : '') + ' · ' + (v ? v.duration_minutes : state.service.duration_minutes) + ' min'
        : '';
```

(keep the existing `totalC` suffix logic). Change `canGoBack` to:

```js
      var canGoBack = state.service && (counts.hasMultipleServices || counts.hasVehicleStep || counts.hasAddons);
```

and the back handler to step back through add-ons → vehicle → service:

```js
      if (backBtn) backBtn.addEventListener('click', function () {
        state.dateISO = null;
        state.slotISO = null;
        if (counts.hasAddons) {
          state.addonsConfirmed = false;
        } else if (counts.hasVehicleStep) {
          state.vehicleType = null;
        } else {
          state.service = null;
        }
        render();
      });
```

4d. `loadSlots` — pass the vehicle type:

```js
      var url = API + '/.netlify/functions/scheduler-slots?siteId=' + encodeURIComponent(siteId) +
        '&date=' + encodeURIComponent(state.dateISO) +
        (state.service ? '&serviceId=' + encodeURIComponent(state.service.id) : '') +
        (state.vehicleType ? '&vehicleTypeId=' + encodeURIComponent(state.vehicleType.id) : '');
```

4e. `renderDetails` — breakdown uses the variant price; Size select hidden when a vehicle type was chosen. Replace the `baseLabel` line with:

```js
        var v2 = chosenVariant();
        var baseLabel = formatCents(v2 ? v2.price_cents : state.service.price_cents);
        lines += '<div style="display:flex;justify-content:space-between;font-size:13px;color:' + T.muted + ';padding:2px 0;">' +
          '<span>' + esc(state.service.name + (state.vehicleType ? ' — ' + state.vehicleType.name : '')) + '</span><span>' + esc(baseLabel) + '</span></div>';
```

In the add-on lines, price each with `addonPriceFor(a, state.vehicleType ? state.vehicleType.id : null)` instead of `a.price_cents`.

Replace form rows 2 and 4 so the Size select only appears in the legacy flow:

```js
            (state.vehicleType
              ? row(
                  field('customer_phone', 'Phone', 'tel', true),
                  field('referral_source', 'How did you hear about us?', 'text', false)
                )
              : row(
                  field('customer_phone', 'Phone', 'tel', true),
                  select('vehicle_size', 'Size', [
                    {value:'sedan', label:'Sedan'},
                    {value:'suv', label:'SUV'},
                    {value:'truck', label:'Truck'},
                    {value:'van', label:'Van'},
                    {value:'other', label:'Other'},
                  ])
                )) +
            row3(
              field('vehicle_make', 'Make', 'text', true),
              field('vehicle_model', 'Model', 'text', true),
              field('vehicle_year', 'Year', 'number', true, 'min="1900" max="2100"')
            ) +
            (state.vehicleType
              ? field('service_address', 'Service address (if mobile)', 'text', false)
              : row(
                  field('service_address', 'Service address (if mobile)', 'text', false),
                  field('referral_source', 'How did you hear about us?', 'text', false)
                )) +
```

4f. `submit()` — payload gains the vehicle type; size is derived:

```js
        vehicle_size: state.vehicleType ? sizeFromTypeName(state.vehicleType.name) : data.vehicle_size,
        vehicle_type_id: state.vehicleType ? state.vehicleType.id : undefined,
```

(replace the existing `vehicle_size: data.vehicle_size,` line).

- [ ] **Step 5: Build + manual verification**

Run: `npm run build`
Expected: builds clean.

Manual: `npm run dev` → Booking Settings → "Preview as customer" on a site with saved vehicle types: flow is service → vehicle (with per-vehicle prices) → add-ons (per-vehicle prices, truck-only add-ons hidden for sedans) → date/time (duration matches vehicle) → details (no Size dropdown, breakdown shows vehicle name) → preview success. Then verify a site **without** saved vehicle types still shows the old flow with the Size dropdown.

- [ ] **Step 6: Commit**

```bash
git add public/scheduler.js
git commit -m "feat(booking): vehicle-type step with per-vehicle pricing in the public widget"
```

---

### Task 11: `BookCustomerModal` — vehicle type select on the admin side

**Files:**
- Modify: `src/components/dashboard/customers-page/BookCustomerModal.jsx`

- [ ] **Step 1: Implement**

1a. Add state + derivations (after the `serviceName` state):

```js
  const [vehicleTypeId, setVehicleTypeId] = useState('');
```

and compute, right before `return`:

```js
  const site = sites.find((s) => s.id === siteId);
  const siteVehicleTypes = (site?.scheduler_config?.vehicle_types || []).filter((t) => t && t.enabled !== false);
  const chosenService = services.find((s) => s.id === serviceId) || null;
  const chosenVariant = (() => {
    if (!chosenService) return null;
    const base = {
      price_cents: typeof chosenService.price_cents === 'number' && chosenService.price_cents > 0 ? chosenService.price_cents : null,
      duration_minutes: chosenService.duration_minutes || 60,
    };
    if (!vehicleTypeId || !chosenService.variants) return base;
    const v = chosenService.variants[vehicleTypeId];
    if (!v) return base;
    if (v.enabled === false) return null;
    return {
      price_cents: typeof v.price_cents === 'number' && v.price_cents > 0 ? v.price_cents : base.price_cents,
      duration_minutes: typeof v.duration_minutes === 'number' && v.duration_minutes > 0 ? v.duration_minutes : base.duration_minutes,
    };
  })();
```

1b. In the site-change `useEffect` (the one keyed on `[siteId, sites]`), reset the vehicle selection by adding `setVehicleTypeId('');` at the top of the effect body.

1c. Below the Service select block, add the vehicle-type select (rendered only when the site has vehicle types):

```jsx
          {siteVehicleTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Vehicle type *</label>
              <select
                required
                value={vehicleTypeId}
                onChange={(e) => setVehicleTypeId(e.target.value)}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              >
                <option value="" disabled>Select vehicle type…</option>
                {siteVehicleTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {chosenVariant && chosenVariant.price_cents != null && (
                <p className="text-[11px] text-[#888] mt-1">
                  {`$${(chosenVariant.price_cents / 100) % 1 === 0 ? chosenVariant.price_cents / 100 : (chosenVariant.price_cents / 100).toFixed(2)} · ${chosenVariant.duration_minutes} min for this vehicle`}
                </p>
              )}
              {chosenService && vehicleTypeId && !chosenVariant && (
                <p className="text-[11px] text-amber-600 mt-1">This service is normally not offered for that vehicle — it will book at the base price.</p>
              )}
            </div>
          )}
```

1d. In the Vehicle section, render the legacy Size select **only when the site has no vehicle types** — wrap the existing Size `<div>` in `{siteVehicleTypes.length === 0 && ( ... )}`.

1e. In `submit()`, add to the JSON body:

```js
          vehicle_type_id: vehicleTypeId || null,
```

- [ ] **Step 2: Lint + manual check**

Run: `npm run lint`
Manual: Customers → a customer → Book: with a vehicle-typed site the modal shows the Vehicle type select with the resolved price line, and the created booking row (Bookings page) carries the right total.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/customers-page/BookCustomerModal.jsx
git commit -m "feat(booking): vehicle type selection in owner Book Customer modal"
```

---

### Task 12: Display surfaces — drawer + emails show the vehicle type

**Files:**
- Modify: `src/components/dashboard/bookings/BookingDetailDrawer.jsx:121`
- Modify: `netlify/functions/_lib/postmark.js` (6 spots)

- [ ] **Step 1: Drawer** — replace line 121 with:

```jsx
          <Row term="Vehicle"  def={`${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model} (${b.vehicle_type_name || b.vehicle_size})`} />
```

- [ ] **Step 2: Emails** — in `netlify/functions/_lib/postmark.js`, replace every vehicle-bucket read used for display with the snapshot name, falling back to size. There are 6 occurrences (lines ~176, ~190, ~227, ~247, ~344, ~360); in each, substitute `b.vehicle_size` with `(b.vehicle_type_name || b.vehicle_size)`. Example for line 176:

```js
      ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${(b.vehicle_type_name || b.vehicle_size) ? ' (' + esc(b.vehicle_type_name || b.vehicle_size) + ')' : ''}</p>` : ''}
```

Apply the same `(b.vehicle_type_name || b.vehicle_size)` substitution in the plain-text template strings at lines ~190, ~247, ~360 and the HTML spots at ~227, ~344.

- [ ] **Step 3: Full tests + commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/components/dashboard/bookings/BookingDetailDrawer.jsx netlify/functions/_lib/postmark.js
git commit -m "feat(booking): show vehicle type name in booking drawer + emails"
```

---

### Task 13: Smoke-test doc, final verification, push

**Files:**
- Modify: `docs/superpowers/smoke-tests/scheduler.md` (append)

- [ ] **Step 1: Append to the smoke-test doc**

```markdown
## Per-vehicle service options (Feature 2)

1. Booking Settings → Services: "Vehicle types" card lists Sedan / SUV/Crossover / Truck / Van/Minivan / Motorcycle / Other; rename, reorder, add, remove all work.
2. Edit a service: per-vehicle table shows a price + duration row per enabled type; untick "Offer" for Motorcycle; set SUV price higher than Sedan. Add an add-on priced only for Truck (blank cells elsewhere). Save, reload — everything persists.
3. Preview as customer: service card shows "from $<lowest>"; picking the service shows the vehicle step with per-vehicle prices; Motorcycle is absent; picking Truck shows the truck-only add-on, picking Sedan hides it; date/time slots reflect the vehicle's duration; details form has no Size dropdown; breakdown line reads "Service — Vehicle".
4. Submit a real booking on the published site: bookings row has vehicle_type_id, vehicle_type_name, duration_minutes, correct total_cents, and a sensible vehicle_size bucket. Owner + customer emails show the vehicle type name.
5. Legacy check: a site that has never saved the new Services tab still books with the old flow (Size dropdown, base prices).
6. Admin side: Customers → Book: vehicle type select appears, resolved price line updates per vehicle, created booking snapshots the type.
```

- [ ] **Step 2: Full verification**

Run: `npm test` → all pass. Run: `npm run build` → clean. Run: `npm run lint` → no new errors.

- [ ] **Step 3: Commit + push to master** (project workflow: direct to master, no PRs)

```bash
git add docs/superpowers/smoke-tests/scheduler.md docs/superpowers/plans/2026-07-20-per-vehicle-service-options.md
git commit -m "docs(booking): per-vehicle options smoke tests + plan"
git push origin master
```

- [ ] **Step 4: Post-deploy smoke test on the live site**

After Netlify deploys: open the owner dashboard for the OG Detailing site, save vehicle types + per-vehicle prices in Booking Settings → Services, then run the customer flow on the published booking page (`https://web.detailconnect.app/u=og-detailing-HKAAVV`) and verify the vehicle step + price changes end-to-end.
