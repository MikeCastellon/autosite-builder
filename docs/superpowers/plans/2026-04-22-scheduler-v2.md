# Scheduler v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the booking widget as a Calendly-style multi-step flow backed by owner-managed services, availability, and per-site on/off toggle, with a live preview in the dashboard so owners can iterate without republishing.

**Architecture:** A new `scheduler_config` JSONB column on the `sites` table stores services, availability windows, welcome text, and slot rules. A new `scheduler-slots` Netlify function computes bookable start times for a given date + service based on availability minus confirmed bookings. The widget (`public/scheduler.js`) becomes a 4-step state machine: pick service → pick date+time → fill details → confirm. The owner gets a new Booking Settings page with General/Services/Availability/Preview tabs. Stays request-based — pending bookings do not lock slots, confirmed ones do.

**Tech Stack:** Supabase (Postgres + RLS), Netlify Functions (Node, Lambda-style), vanilla JS for the widget, React 19 for the owner dashboard, date-fns for calendar math, vitest for slot-math unit tests.

**Spec reference:** [docs/superpowers/specs/2026-04-22-scheduler-v2-design.md](../specs/2026-04-22-scheduler-v2-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `db/migrations/20260422_scheduler_v2.sql` | Add `scheduler_enabled`, `scheduler_config` to `sites`; add `service_id`, `service_name` to `bookings` |
| `netlify/functions/scheduler-slots.js` | Return available slot start times for a given site + date + serviceId |
| `netlify/functions/_lib/slot-math.js` | Pure function: given availability windows, service duration, confirmed bookings → list of slot ISO start times |
| `netlify/functions/_lib/scheduler-config-defaults.js` | Default config factory + auto-seed from `business_info.services` |
| `tests/functions/slot-math.test.js` | Vitest for slot-math |
| `tests/functions/scheduler-config-defaults.test.js` | Vitest for the seeding / merging helper |
| `src/lib/schedulerConfig.js` | Client helpers: load/save `scheduler_config`, seed defaults, re-sync from `business_info.services` |
| `src/components/dashboard/booking-settings/BookingSettingsPage.jsx` | Tab shell (General \| Services \| Availability \| Preview) |
| `src/components/dashboard/booking-settings/GeneralTab.jsx` | Welcome text, button label, lead time inputs |
| `src/components/dashboard/booking-settings/ServicesTab.jsx` | Service list + add/remove/edit + re-sync button |
| `src/components/dashboard/booking-settings/AvailabilityTab.jsx` | 7-day grid with start/end per day |
| `src/components/dashboard/booking-settings/PreviewTab.jsx` | Inline widget preview |

### Modified files

| Path | Change |
|---|---|
| `netlify/functions/scheduler-config.js` | Return full config (services, availability, welcome text, etc.) gated by both profile + site flags |
| `netlify/functions/create-booking.js` | Accept + validate `service_id`; re-validate slot against availability + confirmed bookings; persist `service_id`/`service_name` |
| `netlify/functions/_lib/booking-validation.js` | Allow optional `service_id` field |
| `public/scheduler.js` | Full rewrite: 4-step state machine, calendar grid + slot chips; support `data-preview-mode` |
| `src/App.jsx` | Add `booking-settings` view routing |
| `src/components/dashboard/DashboardPage.jsx` | Site card: bookings toggle + Settings link; handler to open settings per site |

---

## Task 1: Database migration

**Files:**
- Create: `db/migrations/20260422_scheduler_v2.sql`

- [ ] **Step 1: Write the migration SQL**

Create `db/migrations/20260422_scheduler_v2.sql`:

```sql
-- Scheduler v2: per-site enable toggle + owner config + booking service linkage
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.sites
  add column if not exists scheduler_enabled boolean not null default false;

alter table public.sites
  add column if not exists scheduler_config jsonb not null default '{}'::jsonb;

alter table public.bookings
  add column if not exists service_id text;

alter table public.bookings
  add column if not exists service_name text;

commit;
```

- [ ] **Step 2: Apply via the Supabase MCP**

The migration should be applied by the orchestrator or user through the Supabase MCP's `apply_migration` tool with project_id `ktnouhjikmlxlbxcxyif` and name `scheduler_v2`. Subagent: flag this as a deferred user action in your report rather than attempting it.

- [ ] **Step 3: Commit the file**

```bash
git add db/migrations/20260422_scheduler_v2.sql
git commit -m "feat(db): scheduler v2 migration — site-level enable, config JSON, booking service_id"
```

---

## Task 2: Scheduler config defaults + service seeding helper (TDD)

**Files:**
- Create: `netlify/functions/_lib/scheduler-config-defaults.js`
- Test: `tests/functions/scheduler-config-defaults.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/scheduler-config-defaults.test.js`:

```js
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
    // Full Detail: left alone (existing duration preserved)
    expect(merged.find((s) => s.name === 'Full Detail')).toMatchObject({ id: 'svc_a', duration_minutes: 120 });
    // VIP Package: owner-only, kept
    expect(merged.find((s) => s.name === 'VIP Package')).toMatchObject({ id: 'svc_owner' });
    // Paint Correction: new
    expect(merged.find((s) => s.name === 'Paint Correction')).toMatchObject({
      duration_minutes: 60,
      price: '$299',
      enabled: true,
    });
    expect(merged).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
npx vitest run tests/functions/scheduler-config-defaults.test.js
```

Expected: fail — module not found.

- [ ] **Step 3: Implement the helper**

Create `netlify/functions/_lib/scheduler-config-defaults.js`:

```js
import { randomUUID } from 'node:crypto';

const DEFAULT_HOURS = [{ start: '09:00', end: '17:00' }];

export function defaultSchedulerConfig() {
  return {
    welcome_text: "Tell us about your car and we'll be in touch.",
    button_label: 'Book Now',
    lead_time_hours: 24,
    slot_granularity_minutes: 30,
    services: [],
    availability: {
      mon: [...DEFAULT_HOURS],
      tue: [...DEFAULT_HOURS],
      wed: [...DEFAULT_HOURS],
      thu: [...DEFAULT_HOURS],
      fri: [...DEFAULT_HOURS],
      sat: [],
      sun: [],
    },
  };
}

function newServiceId() {
  return 'svc_' + randomUUID().replace(/-/g, '').slice(0, 12);
}

export function seedServicesFromBusinessInfo(bizServices) {
  if (!Array.isArray(bizServices)) return [];
  return bizServices
    .filter((s) => s && typeof s.name === 'string' && s.name.trim() !== '')
    .map((s) => ({
      id: newServiceId(),
      name: String(s.name),
      duration_minutes: 60,
      price: s.price ?? '',
      description: s.description ?? '',
      enabled: true,
    }));
}

export function mergeServicesFromBusinessInfo(existing, bizServices) {
  const existingByName = new Map((existing || []).map((s) => [s.name, s]));
  const newlySeeded = seedServicesFromBusinessInfo(bizServices);
  const result = [...(existing || [])];

  for (const seeded of newlySeeded) {
    if (!existingByName.has(seeded.name)) {
      result.push(seeded);
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run tests/functions/scheduler-config-defaults.test.js
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/scheduler-config-defaults.js tests/functions/scheduler-config-defaults.test.js
git commit -m "feat(scheduler): config defaults + service seed/merge helpers"
```

---

## Task 3: Slot-math pure function (TDD)

**Files:**
- Create: `netlify/functions/_lib/slot-math.js`
- Test: `tests/functions/slot-math.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/slot-math.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeSlots } from '../../netlify/functions/_lib/slot-math.js';

function iso(date, hhmm) {
  return new Date(`${date}T${hhmm}:00.000Z`).toISOString();
}

describe('computeSlots', () => {
  const availability = [{ start: '09:00', end: '12:00' }]; // one 3-hour window
  const tz = 'UTC';
  const date = '2030-06-01'; // Saturday, far future

  it('generates slot start times every granularity within window, minus service duration', () => {
    // 60-min service, 30-min granularity, no bookings -> 09:00, 09:30, 10:00, 10:30, 11:00
    const slots = computeSlots({
      dateISO: date,
      availability,
      serviceDurationMin: 60,
      granularityMin: 30,
      confirmedBookings: [],
      timezone: tz,
    });
    expect(slots).toEqual([
      iso(date, '09:00'), iso(date, '09:30'),
      iso(date, '10:00'), iso(date, '10:30'),
      iso(date, '11:00'),
    ]);
  });

  it('hides slots that would overlap a confirmed booking', () => {
    // A confirmed 90-min booking at 10:00 occupies 10:00-11:30
    const confirmed = [{ start: iso(date, '10:00'), durationMin: 90 }];
    const slots = computeSlots({
      dateISO: date,
      availability,
      serviceDurationMin: 60,
      granularityMin: 30,
      confirmedBookings: confirmed,
      timezone: tz,
    });
    // 09:00 ends 10:00 (touches start of booking = OK, not overlapping)
    // 09:30 ends 10:30 -> overlaps
    // 10:00 overlaps (starts inside booking)
    // 10:30 overlaps
    // 11:00 ends 12:00 -> but booking ends 11:30, so 11:00 starts inside booking -> overlap
    // So only 09:00 remains.
    expect(slots).toEqual([iso(date, '09:00')]);
  });

  it('handles empty availability (closed day)', () => {
    expect(
      computeSlots({
        dateISO: date,
        availability: [],
        serviceDurationMin: 60,
        granularityMin: 30,
        confirmedBookings: [],
        timezone: tz,
      })
    ).toEqual([]);
  });

  it('handles service longer than window', () => {
    // 4-hour service in a 3-hour window
    expect(
      computeSlots({
        dateISO: date,
        availability,
        serviceDurationMin: 240,
        granularityMin: 30,
        confirmedBookings: [],
        timezone: tz,
      })
    ).toEqual([]);
  });

  it('two windows in one day (multi-shift schema)', () => {
    const twoWindows = [
      { start: '09:00', end: '11:00' },
      { start: '13:00', end: '15:00' },
    ];
    const slots = computeSlots({
      dateISO: date,
      availability: twoWindows,
      serviceDurationMin: 60,
      granularityMin: 60,
      confirmedBookings: [],
      timezone: tz,
    });
    expect(slots).toEqual([
      iso(date, '09:00'), iso(date, '10:00'),
      iso(date, '13:00'), iso(date, '14:00'),
    ]);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npx vitest run tests/functions/slot-math.test.js
```

Expected: fail — module not found.

- [ ] **Step 3: Implement the slot math**

Create `netlify/functions/_lib/slot-math.js`:

```js
// Pure slot computation. Operates in the site's configured timezone interpreted
// as UTC offsets at the Date level — for MVP we assume server time is UTC and
// "HH:MM" availability values are UTC too. If timezone handling is ever
// promoted, swap in date-fns-tz here.

function toMillis(dateISO, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return Date.parse(`${dateISO}T${hhmm.padStart(5, '0')}:00.000Z`);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function computeSlots({
  dateISO,
  availability,
  serviceDurationMin,
  granularityMin,
  confirmedBookings,
}) {
  if (!Array.isArray(availability) || availability.length === 0) return [];
  if (!serviceDurationMin || serviceDurationMin <= 0) return [];

  const durationMs = serviceDurationMin * 60 * 1000;
  const stepMs = granularityMin * 60 * 1000;

  const busy = (confirmedBookings || []).map((b) => {
    const start = Date.parse(b.start);
    const end = start + (b.durationMin || 0) * 60 * 1000;
    return [start, end];
  });

  const out = [];

  for (const window of availability) {
    const wStart = toMillis(dateISO, window.start);
    const wEnd = toMillis(dateISO, window.end);

    for (let t = wStart; t + durationMs <= wEnd; t += stepMs) {
      const slotEnd = t + durationMs;
      const conflicts = busy.some(([bs, be]) => overlaps(t, slotEnd, bs, be));
      if (!conflicts) out.push(new Date(t).toISOString());
    }
  }

  return out;
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
npx vitest run tests/functions/slot-math.test.js
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/slot-math.js tests/functions/slot-math.test.js
git commit -m "feat(scheduler): pure slot-math function with vitest coverage"
```

---

## Task 4: Update `scheduler-config` to return full config

**Files:**
- Modify: `netlify/functions/scheduler-config.js`

- [ ] **Step 1: Read the current scheduler-config.js**

Read `netlify/functions/scheduler-config.js` in full before editing.

- [ ] **Step 2: Replace the handler body**

Replace the entire file with:

```js
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
};

const TEMPLATE_FALLBACK_COLORS = { default: '#1a1a1a' };

function disabled() {
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ enabled: false }) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const siteId = event.queryStringParameters?.siteId;
  if (!siteId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing siteId' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, generated_content, template_id, scheduler_enabled, scheduler_config')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || !site.scheduler_enabled) return disabled();

  const { data: profile } = await supabase
    .from('profiles')
    .select('scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!profile?.scheduler_enabled) return disabled();

  const businessName = site.business_info?.businessName || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor =
    customColors.primary ||
    customColors.accent ||
    TEMPLATE_FALLBACK_COLORS[site.template_id] ||
    TEMPLATE_FALLBACK_COLORS.default;

  const cfg = site.scheduler_config || {};
  const enabledServices = (cfg.services || []).filter((s) => s.enabled !== false);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      enabled: true,
      businessName,
      brandColor,
      welcome_text: cfg.welcome_text || "Tell us about your car and we'll be in touch.",
      button_label: cfg.button_label || 'Book Now',
      lead_time_hours: cfg.lead_time_hours ?? 24,
      slot_granularity_minutes: cfg.slot_granularity_minutes ?? 30,
      services: enabledServices.map((s) => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price ?? '',
        description: s.description ?? '',
      })),
      availability: cfg.availability || {},
    }),
  };
};
```

- [ ] **Step 3: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./scheduler-config.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'handler' ]`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/scheduler-config.js
git commit -m "feat(api): scheduler-config returns full owner config"
```

---

## Task 5: New `scheduler-slots` function

**Files:**
- Create: `netlify/functions/scheduler-slots.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/scheduler-slots.js`:

```js
import { createClient } from '@supabase/supabase-js';
import { computeSlots } from './_lib/slot-math.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=30',
};

const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { siteId, date, serviceId } = event.queryStringParameters || {};
  if (!siteId || !date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing siteId or date' }) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid date (YYYY-MM-DD)' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, scheduler_enabled, scheduler_config')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || !site.scheduler_enabled) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots: [] }) };
  }

  const { data: owner } = await supabase
    .from('profiles').select('scheduler_enabled').eq('id', site.user_id).maybeSingle();
  if (!owner?.scheduler_enabled) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots: [] }) };
  }

  const cfg = site.scheduler_config || {};
  const leadMs = (cfg.lead_time_hours ?? 24) * 3600 * 1000;
  const granularityMin = cfg.slot_granularity_minutes ?? 30;

  const service = (cfg.services || []).find((s) => s.id === serviceId && s.enabled !== false);
  const durationMin = service?.duration_minutes
    ?? (cfg.services || []).find((s) => s.enabled !== false)?.duration_minutes
    ?? 60;

  const weekday = WEEKDAY_KEYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  const availability = (cfg.availability || {})[weekday] || [];

  // Pull confirmed bookings for this day
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const { data: confirmed } = await supabase
    .from('bookings')
    .select('preferred_at, service_id')
    .eq('site_id', siteId)
    .eq('status', 'confirmed')
    .gte('preferred_at', dayStart)
    .lte('preferred_at', dayEnd);

  const confirmedBookings = (confirmed || []).map((b) => {
    const bookedSvc = (cfg.services || []).find((s) => s.id === b.service_id);
    return {
      start: b.preferred_at,
      durationMin: bookedSvc?.duration_minutes ?? 60,
    };
  });

  let slots = computeSlots({
    dateISO: date,
    availability,
    serviceDurationMin: durationMin,
    granularityMin,
    confirmedBookings,
  });

  // Drop slots earlier than now + lead time
  const earliest = Date.now() + leadMs;
  slots = slots.filter((iso) => Date.parse(iso) >= earliest);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ slots }) };
};
```

- [ ] **Step 2: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./scheduler-slots.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'handler' ]`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/scheduler-slots.js
git commit -m "feat(api): scheduler-slots endpoint computes bookable start times"
```

---

## Task 6: Harden `create-booking` with slot validation

**Files:**
- Modify: `netlify/functions/create-booking.js`
- Modify: `netlify/functions/_lib/booking-validation.js`

- [ ] **Step 1: Make `service_id` optional in the validator**

In `netlify/functions/_lib/booking-validation.js`, the current `REQUIRED` array does not include `service_id` — leave it out of required. But we DO need to allow/validate `service_id` when present. No change strictly needed for the validator.

**Confirm by reading** `netlify/functions/_lib/booking-validation.js` and verifying `REQUIRED` does not include `service_id`. If it does (unexpected), remove it.

- [ ] **Step 2: Replace `create-booking.js` with slot-aware version**

Read the current `netlify/functions/create-booking.js`. Replace the handler body with the version below (delta: loads site config, validates service, validates slot, persists `service_id`/`service_name`):

```js
import { createClient } from '@supabase/supabase-js';
import { validateBookingPayload } from './_lib/booking-validation.js';
import { newBookingToOwner } from './_lib/postmark.js';
import { computeSlots } from './_lib/slot-math.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];

const rateBuckets = new Map();
function rateLimited(ip, siteId) {
  const key = `${ip}:${siteId}`;
  const now = Date.now();
  const arr = rateBuckets.get(key) || [];
  const recent = arr.filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 5) return true;
  recent.push(now);
  rateBuckets.set(key, recent);
  return false;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const v = validateBookingPayload(payload);
  if (v.honeypot) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  if (!v.ok) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: v.error }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip, payload.siteId)) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, scheduler_enabled, scheduler_config')
    .eq('id', payload.siteId)
    .maybeSingle();
  if (!site || !site.scheduler_enabled) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Bookings not available for this site' }) };
  }

  const { data: owner } = await supabase
    .from('profiles').select('email, scheduler_enabled').eq('id', site.user_id).maybeSingle();
  if (!owner?.scheduler_enabled) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Bookings not available for this site' }) };
  }

  const cfg = site.scheduler_config || {};
  const services = cfg.services || [];
  const enabledServices = services.filter((s) => s.enabled !== false);

  // If site offers services, a service_id is required and must be valid.
  let chosenService = null;
  if (enabledServices.length > 1) {
    if (!payload.service_id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'service_id required' }) };
    }
    chosenService = enabledServices.find((s) => s.id === payload.service_id);
    if (!chosenService) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown or disabled service' }) };
    }
  } else if (enabledServices.length === 1) {
    chosenService = enabledServices[0];
  }

  // Slot validation: availability + lead time + no conflict with confirmed bookings
  const when = new Date(payload.preferred_at);
  const dateISO = when.toISOString().slice(0, 10);
  const weekday = WEEKDAY_KEYS[when.getUTCDay()];
  const availability = (cfg.availability || {})[weekday] || [];

  const leadMs = (cfg.lead_time_hours ?? 24) * 3600 * 1000;
  if (when.getTime() < Date.now() + leadMs) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Too close to now; please pick a later time.' }) };
  }

  const granularityMin = cfg.slot_granularity_minutes ?? 30;
  const durationMin = chosenService?.duration_minutes ?? 60;

  const { data: confirmed } = await supabase
    .from('bookings')
    .select('preferred_at, service_id')
    .eq('site_id', site.id)
    .eq('status', 'confirmed')
    .gte('preferred_at', `${dateISO}T00:00:00.000Z`)
    .lte('preferred_at', `${dateISO}T23:59:59.999Z`);

  const confirmedBookings = (confirmed || []).map((b) => {
    const s = services.find((sv) => sv.id === b.service_id);
    return { start: b.preferred_at, durationMin: s?.duration_minutes ?? 60 };
  });

  const validSlots = computeSlots({
    dateISO,
    availability,
    serviceDurationMin: durationMin,
    granularityMin,
    confirmedBookings,
  });

  if (!validSlots.includes(when.toISOString())) {
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'That time is no longer available. Please pick another.' }) };
  }

  const { data: inserted, error: insErr } = await supabase
    .from('bookings')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      status: 'pending',
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      preferred_at: payload.preferred_at,
      vehicle_make: payload.vehicle_make,
      vehicle_model: payload.vehicle_model,
      vehicle_year: payload.vehicle_year,
      vehicle_size: payload.vehicle_size,
      service_address: payload.service_address || null,
      notes: payload.notes || null,
      referral_source: payload.referral_source || null,
      service_id: chosenService?.id || null,
      service_name: chosenService?.name || null,
    })
    .select()
    .single();

  if (insErr) {
    console.error('create-booking insert error:', insErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create booking' }) };
  }

  newBookingToOwner({ booking: inserted, site, ownerEmail: owner.email })
    .catch((err) => console.error('owner email failed:', err));

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, bookingId: inserted.id }) };
};
```

- [ ] **Step 3: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861\netlify\functions"
node --input-type=module -e "import('./create-booking.js').then(m => console.log('OK'))"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add netlify/functions/create-booking.js
git commit -m "feat(api): create-booking validates service + slot + lead time"
```

---

## Task 7: Client `schedulerConfig` helper library

**Files:**
- Create: `src/lib/schedulerConfig.js`

- [ ] **Step 1: Write the helper**

Create `src/lib/schedulerConfig.js`:

```js
import { supabase } from './supabase.js';

// Mirror of the defaults in the Netlify function — duplicated because
// client can't import from netlify/functions (Vite/CommonJS boundary).
// Keep in sync with netlify/functions/_lib/scheduler-config-defaults.js.
const DEFAULT_HOURS = [{ start: '09:00', end: '17:00' }];

export function defaultSchedulerConfig() {
  return {
    welcome_text: "Tell us about your car and we'll be in touch.",
    button_label: 'Book Now',
    lead_time_hours: 24,
    slot_granularity_minutes: 30,
    services: [],
    availability: {
      mon: [...DEFAULT_HOURS], tue: [...DEFAULT_HOURS], wed: [...DEFAULT_HOURS],
      thu: [...DEFAULT_HOURS], fri: [...DEFAULT_HOURS], sat: [], sun: [],
    },
  };
}

function newServiceId() {
  // URL-safe short id. 12 hex chars is plenty for per-site scope.
  return 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
}

export function seedServicesFromBusinessInfo(bizServices) {
  if (!Array.isArray(bizServices)) return [];
  return bizServices
    .filter((s) => s && typeof s.name === 'string' && s.name.trim() !== '')
    .map((s) => ({
      id: newServiceId(),
      name: String(s.name),
      duration_minutes: 60,
      price: s.price ?? '',
      description: s.description ?? '',
      enabled: true,
    }));
}

export function mergeServicesFromBusinessInfo(existing, bizServices) {
  const existingByName = new Map((existing || []).map((s) => [s.name, s]));
  const newlySeeded = seedServicesFromBusinessInfo(bizServices);
  const result = [...(existing || [])];
  for (const s of newlySeeded) {
    if (!existingByName.has(s.name)) result.push(s);
  }
  return result;
}

export async function loadSchedulerConfig(siteId) {
  const { data, error } = await supabase
    .from('sites').select('scheduler_enabled, scheduler_config, business_info').eq('id', siteId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSchedulerConfig(siteId, patch) {
  // Merge-patch into jsonb via a read-modify-write (small objects, safe enough).
  const { data: current } = await supabase
    .from('sites').select('scheduler_config').eq('id', siteId).maybeSingle();
  const next = { ...(current?.scheduler_config || {}), ...patch };
  const { data, error } = await supabase
    .from('sites')
    .update({ scheduler_config: next, updated_at: new Date().toISOString() })
    .eq('id', siteId).select().single();
  if (error) throw error;
  return data.scheduler_config;
}

export async function setSchedulerEnabled(siteId, enabled) {
  const { data, error } = await supabase
    .from('sites').update({ scheduler_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', siteId).select().single();
  if (error) throw error;
  return data;
}

// Called on FIRST enable: initialize scheduler_config with defaults + seeded services.
export async function initializeSchedulerConfig(siteId) {
  const { data: site } = await supabase
    .from('sites').select('scheduler_config, business_info').eq('id', siteId).maybeSingle();
  const existing = site?.scheduler_config || {};
  if (existing.availability && existing.services) return existing; // already initialized
  const config = {
    ...defaultSchedulerConfig(),
    services: seedServicesFromBusinessInfo(site?.business_info?.services),
  };
  return saveSchedulerConfig(siteId, config);
}
```

- [ ] **Step 2: Build check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/schedulerConfig.js
git commit -m "feat(scheduler): client-side schedulerConfig helpers"
```

---

## Task 8: General tab

**Files:**
- Create: `src/components/dashboard/booking-settings/GeneralTab.jsx`

- [ ] **Step 1: Create the directory**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
mkdir -p src/components/dashboard/booking-settings
```

- [ ] **Step 2: Write the component**

Create `src/components/dashboard/booking-settings/GeneralTab.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';

export default function GeneralTab({ siteId, config, onSaved }) {
  const [welcome, setWelcome] = useState(config?.welcome_text || '');
  const [label, setLabel] = useState(config?.button_label || 'Book Now');
  const [lead, setLead] = useState(String(config?.lead_time_hours ?? 24));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setWelcome(config?.welcome_text || '');
    setLabel(config?.button_label || 'Book Now');
    setLead(String(config?.lead_time_hours ?? 24));
  }, [config]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, {
        welcome_text: welcome,
        button_label: label || 'Book Now',
        lead_time_hours: Math.max(0, Number(lead) || 0),
      });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Welcome text</label>
        <textarea
          rows={3}
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1">Shown at the top of the booking modal.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Button label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Minimum notice (hours)</label>
        <input
          type="number"
          min="0"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          className="w-32 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1">Customers can't book slots less than this far into the future.</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] transition-colors disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/booking-settings/GeneralTab.jsx
git commit -m "feat(dashboard): Booking Settings General tab"
```

---

## Task 9: Services tab

**Files:**
- Create: `src/components/dashboard/booking-settings/ServicesTab.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/dashboard/booking-settings/ServicesTab.jsx`:

```jsx
import { useState } from 'react';
import { saveSchedulerConfig, mergeServicesFromBusinessInfo } from '../../../lib/schedulerConfig.js';

function newService() {
  const id = 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
  return { id, name: '', duration_minutes: 60, price: '', description: '', enabled: true };
}

export default function ServicesTab({ siteId, config, businessInfo, onSaved }) {
  const [services, setServices] = useState(config?.services || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editingId, setEditingId] = useState(null);

  function patch(id, fields) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }

  function remove(id) {
    if (!confirm('Remove this service from booking? Existing bookings keep their service name.')) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const s = newService();
    setServices((prev) => [...prev, s]);
    setEditingId(s.id);
  }

  function resync() {
    const merged = mergeServicesFromBusinessInfo(services, businessInfo?.services);
    setServices(merged);
  }

  async function save() {
    // Reject services with empty name.
    const cleaned = services.filter((s) => s.name.trim() !== '')
      .map((s) => ({ ...s, duration_minutes: Math.max(15, Number(s.duration_minutes) || 60) }));
    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, { services: cleaned });
      onSaved && onSaved(updated);
      setServices(cleaned);
      setEditingId(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">Customers pick one of these when booking. Duration is used to block off time on your calendar.</p>
        <div className="flex gap-2">
          <button onClick={resync} className="text-xs text-gray-600 hover:text-[#1a1a1a] underline">Re-sync from site</button>
          <button onClick={add} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000]">+ Add service</button>
        </div>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
            <tr>
              <th className="px-4 py-3 w-16">On</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 w-28">Duration</th>
              <th className="px-4 py-3 w-24">Price</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const editing = editingId === s.id;
              return (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={s.enabled !== false} onChange={(e) => patch(s.id, { enabled: e.target.checked })} />
                  </td>
                  <td className="px-4 py-3">
                    {editing
                      ? <input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="w-full border border-gray-200 rounded px-2 py-1 text-sm" autoFocus />
                      : <span className="font-semibold text-gray-900">{s.name || <em className="text-gray-400">untitled</em>}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editing
                      ? <input type="number" min="15" step="15" value={s.duration_minutes} onChange={(e) => patch(s.id, { duration_minutes: Number(e.target.value) })} className="w-20 border border-gray-200 rounded px-2 py-1 text-sm" />
                      : <span className="text-gray-700">{s.duration_minutes} min</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editing
                      ? <input value={s.price || ''} onChange={(e) => patch(s.id, { price: e.target.value })} className="w-20 border border-gray-200 rounded px-2 py-1 text-sm" placeholder="$149" />
                      : <span className="text-gray-700">{s.price || '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditingId(editing ? null : s.id)} className="text-xs text-gray-600 hover:text-[#1a1a1a] mr-2">{editing ? 'Done' : 'Edit'}</button>
                    <button onClick={() => remove(s.id)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                  </td>
                </tr>
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

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/booking-settings/ServicesTab.jsx
git commit -m "feat(dashboard): Booking Settings Services tab with re-sync"
```

---

## Task 10: Availability tab

**Files:**
- Create: `src/components/dashboard/booking-settings/AvailabilityTab.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/dashboard/booking-settings/AvailabilityTab.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function AvailabilityTab({ siteId, config, onSaved }) {
  const [state, setState] = useState(() => normalize(config?.availability));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { setState(normalize(config?.availability)); }, [config]);

  function normalize(avail) {
    const out = {};
    for (const { key } of DAYS) {
      const windows = avail?.[key] || [];
      out[key] = windows.length
        ? { closed: false, start: windows[0].start, end: windows[0].end }
        : { closed: true, start: '09:00', end: '17:00' };
    }
    return out;
  }

  function setDay(key, patch) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save() {
    setBusy(true); setErr(null);
    const availability = {};
    for (const { key } of DAYS) {
      const d = state[key];
      availability[key] = d.closed ? [] : [{ start: d.start, end: d.end }];
    }
    try {
      const updated = await saveSchedulerConfig(siteId, { availability });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden divide-y divide-gray-100">
        {DAYS.map(({ key, label }) => {
          const d = state[key];
          return (
            <div key={key} className="flex items-center gap-3 px-4 py-3">
              <div className="w-24 text-sm font-semibold text-gray-800">{label}</div>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => setDay(key, { closed: e.target.checked })}
                />
                Closed
              </label>
              {!d.closed && (
                <>
                  <input type="time" value={d.start} onChange={(e) => setDay(key, { start: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-sm" />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="time" value={d.end} onChange={(e) => setDay(key, { end: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-sm" />
                </>
              )}
            </div>
          );
        })}
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save availability'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/booking-settings/AvailabilityTab.jsx
git commit -m "feat(dashboard): Booking Settings Availability tab"
```

---

## Task 11: Rewrite scheduler.js widget as multi-step state machine

**Files:**
- Modify: `public/scheduler.js`

- [ ] **Step 1: Replace `public/scheduler.js` entirely**

Overwrite `public/scheduler.js` with:

```js
/* Scheduler widget v2 — multi-step (service → date+time → details → confirm). */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  var previewMode = script && script.getAttribute('data-preview-mode') === 'true';
  if (!siteId) return;

  var API = script.src.replace(/\/scheduler\.js.*$/, '');

  fetch(API + '/.netlify/functions/scheduler-config?siteId=' + encodeURIComponent(siteId))
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      if (previewMode) openModal(cfg, { inline: true });
      else mountButton(cfg);
    });

  function mountButton(cfg) {
    var brand = cfg.brandColor || '#1a1a1a';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = cfg.button_label || 'Book Now';
    btn.setAttribute('aria-label', 'Open booking form');
    btn.style.cssText =
      'position:fixed;right:20px;bottom:72px;z-index:9998;padding:14px 22px;' +
      'background:' + brand + ';color:#fff;border:0;border-radius:999px;' +
      'font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.18);';
    btn.addEventListener('click', function () { openModal(cfg, { inline: false }); });
    document.body.appendChild(btn);

    document.querySelectorAll('[data-scheduler-trigger]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openModal(cfg, { inline: false }); });
    });
  }

  function openModal(cfg, opts) {
    if (document.getElementById('acg-scheduler-modal')) return;
    var brand = cfg.brandColor || '#1a1a1a';

    var container, card;
    if (opts.inline) {
      container = document.createElement('div');
      container.id = 'acg-scheduler-modal';
      container.style.cssText = 'font-family:Inter,system-ui,sans-serif;';
      card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1px solid #eee;border-radius:12px;max-width:520px;padding:24px;';
      container.appendChild(card);
      var host = document.getElementById('acg-scheduler-preview-host') || document.body;
      host.innerHTML = '';
      host.appendChild(container);
    } else {
      container = document.createElement('div');
      container.id = 'acg-scheduler-modal';
      container.setAttribute('role', 'dialog');
      container.setAttribute('aria-modal', 'true');
      container.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px;' +
        'font-family:Inter,system-ui,sans-serif;';
      card = document.createElement('div');
      card.style.cssText =
        'background:#fff;border-radius:14px;max-width:520px;width:100%;' +
        'max-height:90vh;overflow:auto;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
      container.appendChild(card);
      document.body.appendChild(container);
      container.addEventListener('click', function (e) { if (e.target === container) close(); });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
      });
    }

    var state = {
      service: cfg.services && cfg.services.length === 1 ? cfg.services[0] : null,
      dateISO: null,
      slotISO: null,
      details: {},
      step: null,
    };

    function close() { container.remove(); }

    function header(title, stepLabel) {
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">' +
        '<div><h2 style="margin:0;font-size:20px;font-weight:800;color:#111;">' + esc(title) + '</h2>' +
        (stepLabel ? '<div style="color:#888;font-size:12px;margin-top:4px;">' + esc(stepLabel) + '</div>' : '') +
        '</div>' +
        (opts.inline ? '' : '<button type="button" data-close aria-label="Close" style="background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#888;">×</button>') +
      '</div>';
    }

    function render() {
      // Decide step based on state
      var enabledServices = (cfg.services || []).filter(function (s) { return s.enabled !== false; });
      if (!state.service && enabledServices.length > 1) return renderServices(enabledServices);
      if (!state.dateISO || !state.slotISO) return renderDateTime();
      if (!state.details.submitted) return renderDetails();
      return renderSuccess();
    }

    function renderServices(services) {
      var items = services.map(function (s) {
        return '<button type="button" data-svc="' + esc(s.id) + '" style="display:block;width:100%;text-align:left;padding:14px;margin-bottom:8px;border:1px solid #eee;border-radius:10px;background:#fff;cursor:pointer;">' +
          '<div style="font-weight:700;color:#111;">' + esc(s.name) + '</div>' +
          '<div style="font-size:13px;color:#666;margin-top:2px;">' + esc(s.duration_minutes) + ' min' + (s.price ? ' · ' + esc(s.price) : '') + '</div>' +
          (s.description ? '<div style="font-size:12px;color:#888;margin-top:4px;">' + esc(s.description) + '</div>' : '') +
        '</button>';
      }).join('');
      card.innerHTML = header('Pick a service', 'Step 1 of 3') +
        '<p style="margin:0 0 12px 0;color:#555;font-size:13px;">' + esc(cfg.welcome_text || '') + '</p>' +
        items;
      wireClose();
      card.querySelectorAll('[data-svc]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.service = services.find(function (s) { return s.id === btn.getAttribute('data-svc'); });
          render();
        });
      });
    }

    function renderDateTime() {
      var stepLabel = state.service && cfg.services && cfg.services.length > 1 ? 'Step 2 of 3' : 'Step 1 of 2';
      card.innerHTML = header('Pick a date and time', stepLabel) +
        '<p style="margin:0 0 8px 0;color:#666;font-size:13px;">' + esc(state.service ? state.service.name + ' · ' + state.service.duration_minutes + ' min' : '') + '</p>' +
        '<div id="acg-cal" style="margin-bottom:12px;"></div>' +
        '<div id="acg-slots" style="display:flex;flex-wrap:wrap;gap:6px;min-height:32px;"></div>' +
        (state.service && cfg.services && cfg.services.length > 1
          ? '<button type="button" data-back style="margin-top:16px;background:none;border:0;color:#888;cursor:pointer;font-size:13px;">← Back</button>'
          : '');
      wireClose();
      renderCalendar(card.querySelector('#acg-cal'));
      var backBtn = card.querySelector('[data-back]');
      if (backBtn) backBtn.addEventListener('click', function () { state.service = null; state.dateISO = null; state.slotISO = null; render(); });
    }

    function renderCalendar(host) {
      var cursor = state.cursorMonth || monthStart(new Date());
      state.cursorMonth = cursor;
      var rows = monthGrid(cursor);
      var label = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      host.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<div style="font-weight:600;">' + esc(label) + '</div>' +
          '<div><button type="button" data-prev style="background:none;border:0;padding:4px 8px;cursor:pointer;">‹</button>' +
          '<button type="button" data-next style="background:none;border:0;padding:4px 8px;cursor:pointer;">›</button></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:12px;">' +
          ['S','M','T','W','T','F','S'].map(function (d) { return '<div style="text-align:center;color:#888;padding:4px 0;">' + d + '</div>'; }).join('') +
          rows.map(function (day) {
            var iso = day.iso;
            var weekday = day.weekday;
            var availabilityForDay = (cfg.availability || {})[weekday] || [];
            var isPast = day.past || (availabilityForDay.length === 0);
            var isCurrent = day.iso === state.dateISO;
            return '<button type="button" data-day="' + iso + '" ' + (isPast || !day.inMonth ? 'disabled' : '') + ' style="padding:8px 0;border:1px solid #eee;background:' + (isCurrent ? '#1a1a1a' : '#fff') + ';color:' + (isCurrent ? '#fff' : (isPast || !day.inMonth ? '#ccc' : '#111')) + ';border-radius:6px;cursor:' + (isPast || !day.inMonth ? 'default' : 'pointer') + ';font-size:12px;">' + day.dayNum + '</button>';
          }).join('') +
        '</div>';

      host.querySelector('[data-prev]').addEventListener('click', function () { state.cursorMonth = addMonths(cursor, -1); renderDateTime(); });
      host.querySelector('[data-next]').addEventListener('click', function () { state.cursorMonth = addMonths(cursor, 1); renderDateTime(); });
      host.querySelectorAll('[data-day]:not([disabled])').forEach(function (b) {
        b.addEventListener('click', function () {
          state.dateISO = b.getAttribute('data-day');
          state.slotISO = null;
          renderDateTime();
          loadSlots();
        });
      });
      if (state.dateISO) loadSlots();
    }

    function loadSlots() {
      var slotsHost = card.querySelector('#acg-slots');
      slotsHost.innerHTML = '<div style="color:#888;font-size:13px;">Loading…</div>';
      var url = API + '/.netlify/functions/scheduler-slots?siteId=' + encodeURIComponent(siteId) +
        '&date=' + encodeURIComponent(state.dateISO) +
        (state.service ? '&serviceId=' + encodeURIComponent(state.service.id) : '');
      fetch(url).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.slots || res.slots.length === 0) {
          slotsHost.innerHTML = '<div style="color:#888;font-size:13px;">No times available — try another day.</div>';
          return;
        }
        slotsHost.innerHTML = res.slots.map(function (iso) {
          var t = new Date(iso);
          var label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
          return '<button type="button" data-slot="' + iso + '" style="padding:8px 12px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;font-size:13px;">' + label + '</button>';
        }).join('');
        slotsHost.querySelectorAll('[data-slot]').forEach(function (b) {
          b.addEventListener('click', function () {
            state.slotISO = b.getAttribute('data-slot');
            render();
          });
        });
      });
    }

    function renderDetails() {
      var stepLabel = cfg.services && cfg.services.length > 1 ? 'Step 3 of 3' : 'Step 2 of 2';
      var whenLabel = new Date(state.slotISO).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
      card.innerHTML = header('Your details', stepLabel) +
        '<div style="color:#666;font-size:13px;margin-bottom:16px;">' + esc((state.service ? state.service.name + ' · ' : '') + whenLabel) + '</div>' +
        '<form id="acg-booking-form" novalidate>' +
          field('customer_name', 'Name', 'text', true) +
          field('customer_email', 'Email', 'email', true) +
          field('customer_phone', 'Phone', 'tel', true) +
          row(
            field('vehicle_make', 'Make', 'text', true),
            field('vehicle_model', 'Model', 'text', true)
          ) +
          row(
            field('vehicle_year', 'Year', 'number', true, 'min="1900" max="2100"'),
            select('vehicle_size', 'Size', ['sedan','suv','truck','van','other'])
          ) +
          field('service_address', 'Service address (if mobile)', 'text', false) +
          fieldTextarea('notes', 'Notes', false) +
          field('referral_source', 'How did you hear about us?', 'text', false) +
          '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;" aria-hidden="true" />' +
          '<div id="acg-form-error" style="color:#c00;font-size:13px;margin:8px 0;display:none;"></div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<button type="button" data-back style="padding:12px 14px;background:#fff;border:1px solid #ccc;border-radius:10px;font:600 14px Inter;cursor:pointer;">Back</button>' +
            '<button type="submit" style="flex:1;padding:14px;background:' + brand + ';color:#fff;border:0;border-radius:10px;font:600 15px Inter;cursor:pointer;">Submit request</button>' +
          '</div>' +
        '</form>';
      wireClose();
      card.querySelector('[data-back]').addEventListener('click', function () { state.slotISO = null; render(); });
      card.querySelector('#acg-booking-form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    }

    function renderSuccess() {
      card.innerHTML = header('Thanks!', '') +
        '<p style="color:#555;font-size:14px;">' + esc((cfg.businessName || 'We') + ' will email you to confirm shortly.') + '</p>';
      wireClose();
    }

    function submit() {
      var form = card.querySelector('#acg-booking-form');
      var errBox = card.querySelector('#acg-form-error');
      errBox.style.display = 'none';
      var data = Object.fromEntries(new FormData(form).entries());
      var payload = {
        siteId: siteId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        preferred_at: state.slotISO,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: Number(data.vehicle_year),
        vehicle_size: data.vehicle_size,
        service_address: data.service_address || undefined,
        notes: data.notes || undefined,
        referral_source: data.referral_source || undefined,
        website: data.website || undefined,
        service_id: state.service ? state.service.id : undefined,
      };
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      fetch(API + '/.netlify/functions/create-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { state.details.submitted = true; render(); }
          else {
            errBox.textContent = (res.j && res.j.error) || 'Something went wrong. Please try again.';
            errBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit request';
          }
        })
        .catch(function () {
          errBox.textContent = 'Network error. Please try again.';
          errBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit request';
        });
    }

    function wireClose() {
      var b = card.querySelector('[data-close]');
      if (b) b.addEventListener('click', close);
    }

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function field(name, label, type, required, extra) {
      return '<label style="display:block;margin-bottom:10px;font-size:12px;color:#555;">' +
        label + (required ? ' <span style="color:#c00">*</span>' : '') +
        '<input type="' + type + '" name="' + name + '"' + (required ? ' required' : '') + ' ' + (extra || '') +
          ' style="width:100%;margin-top:3px;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font:13px Inter;" />' +
        '</label>';
    }
    function fieldTextarea(name, label) {
      return '<label style="display:block;margin-bottom:10px;font-size:12px;color:#555;">' + label +
        '<textarea name="' + name + '" rows="2" style="width:100%;margin-top:3px;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font:13px Inter;"></textarea>' +
        '</label>';
    }
    function select(name, label, options) {
      var opts = options.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
      return '<label style="display:block;margin-bottom:10px;font-size:12px;color:#555;">' + label + ' <span style="color:#c00">*</span>' +
        '<select name="' + name + '" required style="width:100%;margin-top:3px;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font:13px Inter;background:#fff;">' + opts + '</select></label>';
    }
    function row(a, b) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + a + b + '</div>';
    }

    render();
  }

  // Date helpers (UTC)
  function monthStart(d) { var x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); return x; }
  function addMonths(d, n) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); }
  function isoDay(d) { return d.toISOString().slice(0, 10); }
  function monthGrid(cursor) {
    var first = monthStart(cursor);
    var gridStart = new Date(first); gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());
    var out = [];
    var today = new Date(); today.setUTCHours(0, 0, 0, 0);
    for (var i = 0; i < 42; i++) {
      var d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + i);
      out.push({
        iso: isoDay(d),
        dayNum: d.getUTCDate(),
        weekday: ['sun','mon','tue','wed','thu','fri','sat'][d.getUTCDay()],
        inMonth: d.getUTCMonth() === cursor.getUTCMonth(),
        past: d.getTime() < today.getTime(),
      });
    }
    return out;
  }
})();
```

- [ ] **Step 2: Syntax check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
node --check public/scheduler.js && echo "SYNTAX_OK"
```

Expected: `SYNTAX_OK`.

- [ ] **Step 3: Commit**

```bash
git add public/scheduler.js
git commit -m "feat(widget): rewrite scheduler.js as multi-step Calendly-style flow"
```

---

## Task 12: Preview tab

**Files:**
- Create: `src/components/dashboard/booking-settings/PreviewTab.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/dashboard/booking-settings/PreviewTab.jsx`:

```jsx
import { useEffect, useRef } from 'react';

export default function PreviewTab({ siteId }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return;
    // Mount the widget in preview mode by injecting a script tag.
    // Scheduler.js will find data-preview-mode and render inline into
    // the element with id "acg-scheduler-preview-host".
    const host = hostRef.current;
    host.id = 'acg-scheduler-preview-host';
    host.innerHTML = '';

    // Remove any previous script so re-mount works
    const oldScript = document.getElementById('acg-scheduler-preview-script');
    if (oldScript) oldScript.remove();

    const s = document.createElement('script');
    s.id = 'acg-scheduler-preview-script';
    s.src = window.location.origin + '/scheduler.js?t=' + Date.now(); // cache-bust
    s.setAttribute('data-site-id', siteId);
    s.setAttribute('data-preview-mode', 'true');
    s.defer = true;
    document.body.appendChild(s);

    return () => {
      s.remove();
      const modal = document.getElementById('acg-scheduler-modal');
      if (modal) modal.remove();
    };
  }, [siteId]);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">This is exactly what customers see. Changes in other tabs show up after you save and revisit this tab.</p>
      <div ref={hostRef} className="border border-dashed border-gray-200 rounded-xl p-4 min-h-[320px] bg-gray-50" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/booking-settings/PreviewTab.jsx
git commit -m "feat(dashboard): Booking Settings Preview tab using scheduler.js preview mode"
```

---

## Task 13: Booking Settings page shell + routing

**Files:**
- Create: `src/components/dashboard/booking-settings/BookingSettingsPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/dashboard/DashboardPage.jsx`

- [ ] **Step 1: Create the page shell**

Create `src/components/dashboard/booking-settings/BookingSettingsPage.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { loadSchedulerConfig, saveSchedulerConfig, setSchedulerEnabled, initializeSchedulerConfig, defaultSchedulerConfig } from '../../../lib/schedulerConfig.js';
import GeneralTab from './GeneralTab.jsx';
import ServicesTab from './ServicesTab.jsx';
import AvailabilityTab from './AvailabilityTab.jsx';
import PreviewTab from './PreviewTab.jsx';

export default function BookingSettingsPage({ siteId, onExit }) {
  const [tab, setTab] = useState('general');
  const [site, setSite] = useState(null);
  const [err, setErr] = useState(null);

  async function refresh() {
    try {
      const s = await loadSchedulerConfig(siteId);
      if (!s) { setErr('Site not found'); return; }
      if (s.scheduler_enabled && (!s.scheduler_config || !s.scheduler_config.availability)) {
        const cfg = await initializeSchedulerConfig(siteId);
        setSite({ ...s, scheduler_config: cfg });
      } else {
        setSite({ ...s, scheduler_config: s.scheduler_config || defaultSchedulerConfig() });
      }
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [siteId]);

  function onSaved(newConfig) {
    setSite((prev) => ({ ...prev, scheduler_config: newConfig }));
  }

  async function toggleEnabled(next) {
    await setSchedulerEnabled(siteId, next);
    if (next) await initializeSchedulerConfig(siteId);
    refresh();
  }

  if (err) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="text-center">
        <p className="text-red-600 mb-3">{err}</p>
        <button onClick={onExit} className="text-sm underline text-[#1a1a1a]">Back to dashboard</button>
      </div>
    </div>
  );
  if (!site) return <div className="p-10 text-gray-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a]">Booking Settings</h1>
        <button onClick={onExit} className="text-sm text-gray-500 hover:text-[#1a1a1a]">← Back to dashboard</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6 text-sm text-gray-600">
          <span>Bookings:</span>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={!!site.scheduler_enabled}
              onChange={(e) => toggleEnabled(e.target.checked)}
            />
            <span className="font-semibold">{site.scheduler_enabled ? 'Live on site' : 'Off'}</span>
          </label>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <TabBtn on={tab === 'general'} onClick={() => setTab('general')}>General</TabBtn>
          <TabBtn on={tab === 'services'} onClick={() => setTab('services')}>Services</TabBtn>
          <TabBtn on={tab === 'availability'} onClick={() => setTab('availability')}>Availability</TabBtn>
          <TabBtn on={tab === 'preview'} onClick={() => setTab('preview')} disabled={!site.scheduler_enabled}>Preview</TabBtn>
        </div>

        {tab === 'general' && <GeneralTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
        {tab === 'services' && <ServicesTab siteId={siteId} config={site.scheduler_config} businessInfo={site.business_info} onSaved={onSaved} />}
        {tab === 'availability' && <AvailabilityTab siteId={siteId} config={site.scheduler_config} onSaved={onSaved} />}
        {tab === 'preview' && site.scheduler_enabled && <PreviewTab siteId={siteId} />}
      </main>
    </div>
  );
}

function TabBtn({ on, onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${on ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Add routing in `src/App.jsx`**

Add the import:

```jsx
import BookingSettingsPage from './components/dashboard/booking-settings/BookingSettingsPage.jsx';
```

Add state for the currently-open site settings:

```jsx
const [settingsSiteId, setSettingsSiteId] = useState(null);
```

Right before `if (view === 'admin')`, add:

```jsx
if (view === 'booking-settings' && settingsSiteId) {
  return <BookingSettingsPage siteId={settingsSiteId} onExit={() => { setSettingsSiteId(null); setView('dashboard'); }} />;
}
```

In the DashboardPage render call, add:

```jsx
onOpenBookingSettings={(siteId) => { setSettingsSiteId(siteId); setView('booking-settings'); }}
```

- [ ] **Step 3: Add site-card toggle + settings link in `DashboardPage.jsx`**

Accept the new prop:

```jsx
export default function DashboardPage({ ..., onOpenBookingSettings }) {
```

Inside the sites grid, next to existing Edit / Republish / Delete actions for each site, add (before Delete):

```jsx
{schedulerEnabled && (
  <button
    onClick={() => onOpenBookingSettings && onOpenBookingSettings(site.id)}
    className="px-3 py-1.5 text-xs font-medium border border-black/10 rounded-lg hover:border-[#1a1a1a]/30 hover:text-[#1a1a1a] transition-colors"
  >
    Bookings
  </button>
)}
```

(`schedulerEnabled` already exists in DashboardPage from v1 — it's `!!profile?.scheduler_enabled`.)

- [ ] **Step 4: Build check**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/booking-settings/BookingSettingsPage.jsx src/App.jsx src/components/dashboard/DashboardPage.jsx
git commit -m "feat(dashboard): Booking Settings page with per-site toggle + tab routing"
```

---

## Task 14: Smoke-test doc update

**Files:**
- Modify: `docs/superpowers/smoke-tests/scheduler.md`

- [ ] **Step 1: Append a v2 section to the checklist**

Append this block to the end of `docs/superpowers/smoke-tests/scheduler.md`:

```markdown

---

## v2 — Calendly-style flow + Booking Settings

### Setup
- [ ] Migration `20260422_scheduler_v2.sql` applied (adds `sites.scheduler_enabled`, `sites.scheduler_config`, `bookings.service_id`, `bookings.service_name`).
- [ ] Existing users on scheduler_enabled profile keep seeing the Bookings tab.

### Owner settings
- [ ] Sign in as super-admin owner.
- [ ] Open any site → click "Bookings" button → Booking Settings page opens.
- [ ] Toggle "Bookings" ON at the top → services auto-seed from site's business_info.services.
- [ ] Services tab: all services visible, enabled, duration=60 default. Edit one to 120 min, save.
- [ ] Availability tab: Mon-Fri 9-5, Sat/Sun closed (default). Change Sat to open 10-2, save.
- [ ] General tab: change welcome text, save.
- [ ] Preview tab: widget renders inline, shows new services + welcome text.

### Customer flow on preview
- [ ] Click Book Now button in Preview.
- [ ] Step 1 shows services list (if 2+ services). Pick one.
- [ ] Step 2 shows calendar. Sun/Mon-Fri/Sat/Sun rules honored (closed days gray).
- [ ] Click a valid day → time chips load from scheduler-slots.
- [ ] Pick a time → Step 3 contact form.
- [ ] Submit → success panel appears.
- [ ] Booking row appears in dashboard Bookings tab with service_id + service_name populated.

### Slot exclusivity
- [ ] Confirm the booking from step above (Bookings → detail drawer → Confirm).
- [ ] Open widget again, try same date. The confirmed slot is now missing from the chip list.

### Failure paths
- [ ] Disable all services → widget still loads but no services shown → submit blocked.
- [ ] Set availability to all-closed → widget calendar grays out all days.
- [ ] Book less than lead_time_hours in advance → server returns "too close to now".
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\mikec\Website Creator\.claude\worktrees\reverent-bose-b90861"
git add docs/superpowers/smoke-tests/scheduler.md
git commit -m "docs: scheduler v2 smoke test checklist"
```

---

## Self-review

**1. Spec coverage:**
- Per-site toggle ✅ Task 1 (column), Task 13 (UI)
- Services auto-pull + merge ✅ Task 2 (helpers), Task 9 (UI), Task 13 (init on first enable)
- Availability config ✅ Task 1 (schema), Task 10 (UI), Task 5 (slot math), Task 3 (pure function)
- Welcome text + button label ✅ Task 4 (API returns them), Task 8 (UI)
- Multi-step Calendly widget ✅ Task 11
- Live preview ✅ Task 12
- Slot exclusivity (confirmed only) ✅ Task 5 (scheduler-slots), Task 6 (create-booking re-check)
- Service denormalization on bookings ✅ Task 1 (columns), Task 6 (insert)
- Customer error states ✅ Task 6 (409 on conflict), widget (Task 11) displays errors

**2. Placeholder scan:** No "TBD", no "implement later", code blocks everywhere changes are made. The one remaining user action is applying the DB migration via Supabase MCP (Task 1 Step 2), clearly flagged as deferred.

**3. Type consistency:**
- `scheduler_config.services[].id` uses `svc_*` prefix consistently (Task 2, Task 7, Task 11).
- `scheduler_config.availability` shape (`{ [day]: [{start, end}] }`) matches between the spec, `scheduler-slots` (Task 5), `create-booking` (Task 6), and `AvailabilityTab` (Task 10).
- `computeSlots` signature in Task 3 matches callers in Task 5 and Task 6 (`{dateISO, availability, serviceDurationMin, granularityMin, confirmedBookings}`).
- `loadSchedulerConfig` / `saveSchedulerConfig` / `setSchedulerEnabled` / `initializeSchedulerConfig` in Task 7 match the call sites in Tasks 8–10 and 13.
- Widget `data-preview-mode` from Task 11 matches the PreviewTab mount code in Task 12.
