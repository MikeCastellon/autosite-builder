# Scheduler MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a request-based appointment booking feature for published auto-detailing sites, with an owner-facing Bookings dashboard and a super-admin panel that gates the feature per-account.

**Architecture:** The feature has three surfaces. (1) A vanilla-JS widget (`/scheduler.js`) injected as a script tag into every published static site — it fetches a live config from a Netlify function, and if enabled, renders a Book Now button + booking modal. (2) The main React app gains two new screens: an owner Bookings view (list + calendar) inside the existing dashboard, and an `/admin` panel for super admins. (3) Four new Netlify functions handle widget config, booking creation, owner actions, and Postmark email. Data lives in two new Supabase tables (`profiles`, `bookings`) with RLS allowing anonymous booking inserts only when the site's owner has `scheduler_enabled = true`.

**Tech Stack:** React 19 + Vite, Supabase (Postgres + Auth + RLS), Netlify Functions (Node, Lambda-style), Cloudflare R2 (already in use for published sites), Postmark (transactional email), date-fns (calendar grid math), vitest (unit tests for shared helpers).

**Spec reference:** [docs/superpowers/specs/2026-04-22-scheduler-mvp-design.md](../specs/2026-04-22-scheduler-mvp-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `db/migrations/20260422_scheduler_mvp.sql` | All DB changes: `profiles`, `bookings`, RLS, seed |
| `db/tests/rls-scheduler.sql` | Manual RLS sanity checks |
| `netlify/functions/scheduler-config.js` | Widget config endpoint (anon GET) |
| `netlify/functions/create-booking.js` | Booking submit endpoint (anon POST) |
| `netlify/functions/update-booking.js` | Owner action endpoint (auth'd POST) |
| `netlify/functions/_lib/postmark.js` | Postmark client + email templates |
| `netlify/functions/_lib/booking-validation.js` | Pure validation functions (shared, tested) |
| `netlify/functions/_lib/booking-state.js` | Lifecycle state machine (pure, tested) |
| `public/scheduler.js` | Vanilla-JS widget served by Netlify |
| `src/hooks/useProfile.js` | Hook that tracks the signed-in user's profile row |
| `src/lib/bookings.js` | Client-side booking queries/mutations |
| `src/components/dashboard/bookings/BookingsView.jsx` | Tab shell (Calendar \| List) |
| `src/components/dashboard/bookings/BookingsList.jsx` | Filterable list view |
| `src/components/dashboard/bookings/BookingsCalendar.jsx` | Month/week grid |
| `src/components/dashboard/bookings/BookingDetailDrawer.jsx` | Slide-in detail + action buttons |
| `src/components/dashboard/bookings/BookingFilters.jsx` | Filter bar (status/date/search) |
| `src/components/dashboard/bookings/StatusPill.jsx` | Reusable status badge |
| `src/components/admin/AdminPage.jsx` | Admin route shell, tabs, auth guard |
| `src/components/admin/AdminAccountsTab.jsx` | Accounts table + toggle controls |
| `src/components/admin/AdminAllBookingsTab.jsx` | All-accounts booking view |
| `tests/functions/booking-validation.test.js` | Vitest for validator |
| `tests/functions/booking-state.test.js` | Vitest for state machine |

### Modified files

| Path | Change |
|---|---|
| `package.json` | Add `vitest`, `date-fns` to devDependencies; `postmark` to Netlify function deps |
| `netlify/functions/package.json` | Add `postmark` |
| `src/lib/AuthContext.jsx` | Expose `profile` alongside `session` |
| `src/lib/exportHtml.js` | Inject scheduler.js script tag in `<head>` |
| `src/App.jsx` | Route to `AdminPage` when URL is `/admin`; pass profile to Dashboard |
| `src/components/dashboard/DashboardPage.jsx` | Add Bookings tab (conditional) and Admin link (conditional); drop hardcoded `ADMIN_EMAILS` |

---

## Environment setup notes (do once before starting)

These aren't tasks, but the engineer needs them to finish:

- **Postmark**: create a Server in Postmark, verify the sender domain, copy the Server API Token into Netlify env as `POSTMARK_API_TOKEN`, set `POSTMARK_FROM_EMAIL` (e.g. `bookings@autocaregenius.com`).
- **Netlify env vars**: add `POSTMARK_API_TOKEN`, `POSTMARK_FROM_EMAIL`, `MAIN_APP_URL` (e.g. `https://app.autocaregenius.com`). `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` already exist per `publish-site.js`.
- **Supabase SQL editor** is the target for running the migration in Task 1.

---

## Task 1: Database migration

**Files:**
- Create: `db/migrations/20260422_scheduler_mvp.sql`
- Create: `db/tests/rls-scheduler.sql`

- [ ] **Step 1: Create the migration directory**

```bash
mkdir -p db/migrations db/tests
```

- [ ] **Step 2: Write the migration SQL**

Create `db/migrations/20260422_scheduler_mvp.sql`:

```sql
-- Scheduler MVP: profiles + bookings + RLS + seed
-- Apply via Supabase SQL editor as the postgres role.

begin;

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_super_admin boolean not null default false,
  scheduler_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users
insert into profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

alter table profiles enable row level security;

create policy "profiles_select_own_or_admin" on profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

-- Users cannot update their own admin/feature flags; only super admins can.
create policy "profiles_update_self_basic" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_super_admin = (select p.is_super_admin from profiles p where p.id = auth.uid())
    and scheduler_enabled = (select p.scheduler_enabled from profiles p where p.id = auth.uid())
  );

create policy "profiles_update_admin" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

-- ---------- bookings ----------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','confirmed','declined','cancelled','completed')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  preferred_at timestamptz not null,
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_year smallint not null,
  vehicle_size text not null check (vehicle_size in ('sedan','suv','truck','van','other')),
  service_address text,
  notes text,
  referral_source text,
  owner_notes text,
  declined_reason text,
  deposit_amount_cents integer,
  payment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_owner_status_at_idx
  on bookings (owner_user_id, status, preferred_at);
create index if not exists bookings_site_created_idx
  on bookings (site_id, created_at desc);

-- Helper: can the anon role create a booking for this site?
create or replace function public.can_book_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from sites s
    join profiles p on p.id = s.user_id
    where s.id = p_site_id and p.scheduler_enabled = true
  );
$$;

alter table bookings enable row level security;

-- Anonymous visitors can INSERT only
create policy "bookings_insert_anon_when_enabled" on bookings
  for insert to anon
  with check (public.can_book_site(site_id));

-- Owners (and super admins) can read / update their bookings
create policy "bookings_select_owner_or_admin" on bookings
  for select using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

create policy "bookings_update_owner_or_admin" on bookings
  for update using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

-- ---------- seed super admins ----------
update profiles
set is_super_admin = true, scheduler_enabled = true, updated_at = now()
where email in ('mike.castellon5@gmail.com','dev@639hz.com');

commit;
```

- [ ] **Step 3: Write the RLS sanity-check script**

Create `db/tests/rls-scheduler.sql`:

```sql
-- Manual RLS checks. Run each block in Supabase SQL editor after the migration.
-- These aren't run automatically; use them to confirm behavior before shipping.

-- 1) Super admin seeds exist
select email, is_super_admin, scheduler_enabled
from profiles where email in ('mike.castellon5@gmail.com','dev@639hz.com');
-- Expect both rows, both flags = true.

-- 2) Anon insert blocked when scheduler disabled
-- Temporarily flip scheduler off for a test user, then try:
-- set local role anon;
-- insert into bookings (site_id, owner_user_id, status, customer_name, customer_email,
--   customer_phone, preferred_at, vehicle_make, vehicle_model, vehicle_year, vehicle_size)
-- values ('<site_id>','<owner_id>','pending','T','t@x.com','555','2030-01-01','Honda','Civic',2020,'sedan');
-- Expect: new row violates row-level security policy

-- 3) Anon insert succeeds when scheduler enabled
-- Flip scheduler on, repeat. Expect: INSERT 0 1.

-- 4) Anon cannot SELECT any bookings
-- set local role anon;
-- select count(*) from bookings;  -- expect 0 or permission denied
```

- [ ] **Step 4: Apply the migration**

Open Supabase SQL editor → paste the contents of `db/migrations/20260422_scheduler_mvp.sql` → Run. Expect "Success. No rows returned."

- [ ] **Step 5: Run the sanity checks (block 1 only; blocks 2-4 are reference)**

Paste block 1 of `db/tests/rls-scheduler.sql` into the SQL editor and run. Expect two rows with both flags `true`.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/20260422_scheduler_mvp.sql db/tests/rls-scheduler.sql
git commit -m "feat(db): scheduler MVP migration — profiles, bookings, RLS, seed super admins"
```

---

## Task 2: Add vitest + Postmark dependencies

**Files:**
- Modify: `package.json`
- Modify: `netlify/functions/package.json`

- [ ] **Step 1: Install root deps**

```bash
npm install --save-dev vitest@^2.0.0
npm install --save date-fns@^3.6.0
```

- [ ] **Step 2: Add test script to `package.json`**

In `package.json`, add this line inside `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Install Postmark in the Netlify functions package**

```bash
cd netlify/functions
npm install postmark@^4.0.0
cd ../..
```

- [ ] **Step 4: Verify**

Run `npx vitest run`. Expect: "No test files found" — that's fine; it confirms vitest is installed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json netlify/functions/package.json netlify/functions/package-lock.json
git commit -m "chore: add vitest, date-fns, postmark for scheduler feature"
```

---

## Task 3: Booking validation helper (TDD)

**Files:**
- Create: `netlify/functions/_lib/booking-validation.js`
- Test: `tests/functions/booking-validation.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/booking-validation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateBookingPayload } from '../../netlify/functions/_lib/booking-validation.js';

const base = {
  siteId: '00000000-0000-0000-0000-000000000001',
  customer_name: 'Alex',
  customer_email: 'a@x.com',
  customer_phone: '555-1234',
  preferred_at: '2030-06-01T10:00:00Z',
  vehicle_make: 'Honda',
  vehicle_model: 'Civic',
  vehicle_year: 2020,
  vehicle_size: 'sedan',
};

describe('validateBookingPayload', () => {
  it('accepts a fully valid payload', () => {
    const result = validateBookingPayload(base);
    expect(result.ok).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { customer_name, ...rest } = base;
    const result = validateBookingPayload(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/customer_name/);
  });

  it('rejects invalid email', () => {
    const result = validateBookingPayload({ ...base, customer_email: 'not-email' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects past dates', () => {
    const result = validateBookingPayload({ ...base, preferred_at: '2000-01-01T00:00:00Z' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it('rejects invalid vehicle_size', () => {
    const result = validateBookingPayload({ ...base, vehicle_size: 'sportscar' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/vehicle_size/);
  });

  it('rejects non-uuid siteId', () => {
    const result = validateBookingPayload({ ...base, siteId: 'nope' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/siteId/);
  });

  it('accepts optional fields when present', () => {
    const result = validateBookingPayload({
      ...base,
      service_address: '123 Main',
      notes: 'big truck',
      referral_source: 'Google',
    });
    expect(result.ok).toBe(true);
  });

  it('treats non-empty honeypot as invalid (silent reject)', () => {
    const result = validateBookingPayload({ ...base, website: 'http://spam.com' });
    expect(result.ok).toBe(false);
    expect(result.honeypot).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/functions/booking-validation.test.js
```

Expected: FAIL with "Cannot find module ... booking-validation.js".

- [ ] **Step 3: Implement the validator**

Create `netlify/functions/_lib/booking-validation.js`:

```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VEHICLE_SIZES = ['sedan','suv','truck','van','other'];
const REQUIRED = [
  'siteId','customer_name','customer_email','customer_phone',
  'preferred_at','vehicle_make','vehicle_model','vehicle_year','vehicle_size',
];

export function validateBookingPayload(p) {
  if (!p || typeof p !== 'object') return fail('Payload must be an object');

  // Honeypot — if filled, reject silently (caller should 200 and drop).
  if (typeof p.website === 'string' && p.website.trim() !== '') {
    return { ok: false, honeypot: true, error: 'honeypot' };
  }

  for (const key of REQUIRED) {
    if (p[key] === undefined || p[key] === null || p[key] === '') {
      return fail(`Missing required field: ${key}`);
    }
  }

  if (!UUID_RE.test(p.siteId)) return fail('Invalid siteId');
  if (!EMAIL_RE.test(p.customer_email)) return fail('Invalid customer_email');

  const year = Number(p.vehicle_year);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return fail('Invalid vehicle_year');
  }

  if (!VEHICLE_SIZES.includes(p.vehicle_size)) {
    return fail(`Invalid vehicle_size (must be one of ${VEHICLE_SIZES.join(', ')})`);
  }

  const when = Date.parse(p.preferred_at);
  if (Number.isNaN(when)) return fail('Invalid preferred_at');
  if (when <= Date.now()) return fail('preferred_at must be in the future');

  return { ok: true };
}

function fail(error) { return { ok: false, error }; }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/functions/booking-validation.test.js
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/booking-validation.js tests/functions/booking-validation.test.js
git commit -m "feat(booking): validation helper for booking payloads"
```

---

## Task 4: Booking state machine (TDD)

**Files:**
- Create: `netlify/functions/_lib/booking-state.js`
- Test: `tests/functions/booking-state.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/booking-state.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { applyAction, ALLOWED_ACTIONS } from '../../netlify/functions/_lib/booking-state.js';

describe('applyAction', () => {
  it('confirm: pending -> confirmed', () => {
    const next = applyAction('pending', 'confirm');
    expect(next).toEqual({ ok: true, status: 'confirmed' });
  });

  it('decline: pending -> declined, requires reason', () => {
    expect(applyAction('pending', 'decline')).toEqual({ ok: false, error: 'reason required for decline' });
    expect(applyAction('pending', 'decline', { reason: 'full that day' })).toEqual({ ok: true, status: 'declined' });
  });

  it('complete: confirmed -> completed', () => {
    expect(applyAction('confirmed', 'complete')).toEqual({ ok: true, status: 'completed' });
  });

  it('cancel: pending or confirmed -> cancelled', () => {
    expect(applyAction('pending', 'cancel')).toEqual({ ok: true, status: 'cancelled' });
    expect(applyAction('confirmed', 'cancel')).toEqual({ ok: true, status: 'cancelled' });
  });

  it('rejects invalid transitions', () => {
    expect(applyAction('declined', 'confirm').ok).toBe(false);
    expect(applyAction('completed', 'cancel').ok).toBe(false);
    expect(applyAction('cancelled', 'confirm').ok).toBe(false);
  });

  it('rejects unknown actions', () => {
    expect(applyAction('pending', 'explode').ok).toBe(false);
  });

  it('exports the list of allowed actions', () => {
    expect(ALLOWED_ACTIONS).toEqual(['confirm','decline','complete','cancel']);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/functions/booking-state.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the state machine**

Create `netlify/functions/_lib/booking-state.js`:

```js
export const ALLOWED_ACTIONS = ['confirm', 'decline', 'complete', 'cancel'];

const TRANSITIONS = {
  pending: { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' },
  confirmed: { complete: 'completed', cancel: 'cancelled' },
  declined: {},
  completed: {},
  cancelled: {},
};

export function applyAction(currentStatus, action, opts = {}) {
  if (!ALLOWED_ACTIONS.includes(action)) {
    return { ok: false, error: `unknown action: ${action}` };
  }
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed || !allowed[action]) {
    return { ok: false, error: `cannot ${action} from ${currentStatus}` };
  }
  if (action === 'decline' && !opts.reason) {
    return { ok: false, error: 'reason required for decline' };
  }
  return { ok: true, status: allowed[action] };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/functions/booking-state.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/booking-state.js tests/functions/booking-state.test.js
git commit -m "feat(booking): state machine for lifecycle transitions"
```

---

## Task 5: Postmark helper + email templates

**Files:**
- Create: `netlify/functions/_lib/postmark.js`

This task has no tests — Postmark sends are thin wrappers and would require heavy mocking for little value. We'll verify via manual smoke test later.

- [ ] **Step 1: Write the helper**

Create `netlify/functions/_lib/postmark.js`:

```js
import { ServerClient } from 'postmark';

const client = process.env.POSTMARK_API_TOKEN
  ? new ServerClient(process.env.POSTMARK_API_TOKEN)
  : null;

const FROM = process.env.POSTMARK_FROM_EMAIL || 'bookings@example.com';
const APP_URL = process.env.MAIN_APP_URL || 'https://app.example.com';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export async function newBookingToOwner({ booking, site, ownerEmail }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'your site';
  const dashLink = `${APP_URL}/?bookings=${encodeURIComponent(b.id)}`;

  const html = `
    <h2>New booking request for ${esc(name)}</h2>
    <p><strong>${esc(b.customer_name)}</strong> (${esc(b.customer_email)}, ${esc(b.customer_phone)}) wants to book for <strong>${esc(formatWhen(b.preferred_at))}</strong>.</p>
    <p><strong>Vehicle:</strong> ${esc(b.vehicle_year)} ${esc(b.vehicle_make)} ${esc(b.vehicle_model)} (${esc(b.vehicle_size)})</p>
    ${b.service_address ? `<p><strong>Service address:</strong> ${esc(b.service_address)}</p>` : ''}
    ${b.notes ? `<p><strong>Notes:</strong> ${esc(b.notes)}</p>` : ''}
    ${b.referral_source ? `<p><strong>Heard about us via:</strong> ${esc(b.referral_source)}</p>` : ''}
    <p><a href="${dashLink}">Open in your dashboard →</a></p>
  `;
  const text = `New booking request for ${name}\n\n${b.customer_name} (${b.customer_email}, ${b.customer_phone}) wants to book for ${formatWhen(b.preferred_at)}.\nVehicle: ${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model} (${b.vehicle_size})\n${b.service_address ? 'Service address: ' + b.service_address + '\n' : ''}${b.notes ? 'Notes: ' + b.notes + '\n' : ''}Open: ${dashLink}`;

  return client.sendEmail({
    From: FROM,
    To: ownerEmail,
    Subject: `New booking request from ${b.customer_name} — ${formatWhen(b.preferred_at)}`,
    HtmlBody: html,
    TextBody: text,
    MessageStream: 'outbound',
  });
}

export async function statusUpdateToCustomer({ booking, site, status, reason }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'the business';

  const map = {
    confirmed: {
      subject: `Your booking is confirmed — ${name}`,
      heading: `You're confirmed for ${formatWhen(b.preferred_at)}`,
      body: `Thanks ${esc(b.customer_name)} — we'll see you then. Reply to this email if you need to change anything.`,
    },
    declined: {
      subject: `Your booking request — ${name}`,
      heading: `We couldn't confirm that time`,
      body: `Sorry ${esc(b.customer_name)} — we can't make ${esc(formatWhen(b.preferred_at))} work.${reason ? ' Reason: ' + esc(reason) : ''} Feel free to submit another request.`,
    },
    cancelled: {
      subject: `Your booking was cancelled — ${name}`,
      heading: `Your booking was cancelled`,
      body: `Your booking for ${esc(formatWhen(b.preferred_at))} has been cancelled.`,
    },
  };
  const m = map[status];
  if (!m) return;

  const html = `<h2>${m.heading}</h2><p>${m.body}</p>`;
  const text = `${m.heading}\n\n${m.body.replace(/<[^>]+>/g,'')}`;

  return client.sendEmail({
    From: FROM,
    To: b.customer_email,
    Subject: m.subject,
    HtmlBody: html,
    TextBody: text,
    MessageStream: 'outbound',
  });
}
```

- [ ] **Step 2: Sanity-import (no test runner for this one)**

```bash
node --input-type=module -e "import('./netlify/functions/_lib/postmark.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'newBookingToOwner', 'statusUpdateToCustomer' ]`.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/_lib/postmark.js
git commit -m "feat(email): Postmark helper with owner + customer templates"
```

---

## Task 6: `scheduler-config` Netlify function

**Files:**
- Create: `netlify/functions/scheduler-config.js`

No automated test (primarily a DB read + shape check). Manual verification below.

- [ ] **Step 1: Write the function**

Create `netlify/functions/scheduler-config.js`:

```js
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
};

// Minimal fallback color map so scheduler.js can brand the button even before
// we thread through full template lookup. Expand as templates are added.
const TEMPLATE_FALLBACK_COLORS = {
  default: '#1a1a1a',
};

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
    .select('id, user_id, business_info, generated_content, template_id')
    .eq('id', siteId)
    .maybeSingle();

  if (!site) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ enabled: false }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  const enabled = !!profile?.scheduler_enabled;
  if (!enabled) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ enabled: false }) };
  }

  const businessName = site.business_info?.businessName || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor =
    customColors.primary ||
    customColors.accent ||
    TEMPLATE_FALLBACK_COLORS[site.template_id] ||
    TEMPLATE_FALLBACK_COLORS.default;

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ enabled: true, businessName, brandColor }),
  };
};
```

- [ ] **Step 2: Deploy locally and smoke-test**

```bash
npx netlify dev
```

In another terminal (replace `<real-site-id>` with an actual site UUID from the `sites` table):

```bash
curl 'http://localhost:8888/.netlify/functions/scheduler-config?siteId=<real-site-id>'
```

Expected: `{"enabled":true,"businessName":"...","brandColor":"..."}` if the site's owner is a super admin (scheduler_enabled=true), else `{"enabled":false}`.

- [ ] **Step 3: Test the unhappy paths**

```bash
curl 'http://localhost:8888/.netlify/functions/scheduler-config'
# Expected: 400 {"error":"Missing siteId"}

curl 'http://localhost:8888/.netlify/functions/scheduler-config?siteId=00000000-0000-0000-0000-000000000000'
# Expected: 200 {"enabled":false}
```

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/scheduler-config.js
git commit -m "feat(api): scheduler-config endpoint for widget bootstrap"
```

---

## Task 7: `create-booking` Netlify function

**Files:**
- Create: `netlify/functions/create-booking.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/create-booking.js`:

```js
import { createClient } from '@supabase/supabase-js';
import { validateBookingPayload } from './_lib/booking-validation.js';
import { newBookingToOwner } from './_lib/postmark.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Cheap in-memory rate limit: 5 submissions per IP per hour per site.
// Resets when the Lambda instance recycles — that's fine for MVP.
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
  if (v.honeypot) {
    // Silent success so bots don't get signal.
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }
  if (!v.ok) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: v.error }) };
  }

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip, payload.siteId)) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Re-check that the site exists and owner has scheduler enabled.
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info')
    .eq('id', payload.siteId)
    .maybeSingle();

  if (!site) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Site not found' }) };
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select('email, scheduler_enabled')
    .eq('id', site.user_id)
    .maybeSingle();

  if (!owner?.scheduler_enabled) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Bookings not available for this site' }) };
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
    })
    .select()
    .single();

  if (insErr) {
    console.error('create-booking insert error:', insErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create booking' }) };
  }

  // Fire-and-forget email. Don't block the response on mail delivery.
  newBookingToOwner({ booking: inserted, site, ownerEmail: owner.email })
    .catch((err) => console.error('owner email failed:', err));

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, bookingId: inserted.id }) };
};
```

- [ ] **Step 2: Smoke-test locally**

With `npx netlify dev` running, find a site whose owner has scheduler enabled, then:

```bash
curl -X POST http://localhost:8888/.netlify/functions/create-booking \
  -H 'Content-Type: application/json' \
  -d '{
    "siteId":"<real-site-id>",
    "customer_name":"Test Customer",
    "customer_email":"test+smoke@example.com",
    "customer_phone":"555-1234",
    "preferred_at":"2030-06-01T14:00:00Z",
    "vehicle_make":"Toyota",
    "vehicle_model":"Corolla",
    "vehicle_year":2020,
    "vehicle_size":"sedan"
  }'
```

Expected: `{"ok":true,"bookingId":"<uuid>"}`. Then check Supabase: the row exists with `status='pending'`. If Postmark is configured, an owner email arrives.

- [ ] **Step 3: Negative smoke tests**

```bash
# Missing field
curl -X POST http://localhost:8888/.netlify/functions/create-booking \
  -H 'Content-Type: application/json' \
  -d '{"siteId":"<real-site-id>"}'
# Expected: 400 {"error":"Missing required field: customer_name"}

# Honeypot
curl -X POST http://localhost:8888/.netlify/functions/create-booking \
  -H 'Content-Type: application/json' \
  -d '{"siteId":"<real-site-id>","website":"spam.com", ...}'
# Expected: 200 {"ok":true} but NO row in the DB.
```

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/create-booking.js
git commit -m "feat(api): create-booking endpoint with validation + rate limit + email"
```

---

## Task 8: `update-booking` Netlify function

**Files:**
- Create: `netlify/functions/update-booking.js`

- [ ] **Step 1: Write the function**

Create `netlify/functions/update-booking.js`:

```js
import { createClient } from '@supabase/supabase-js';
import { applyAction, ALLOWED_ACTIONS } from './_lib/booking-state.js';
import { statusUpdateToCustomer } from './_lib/postmark.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) };
  }
  const accessToken = auth.slice(7);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { bookingId, action, reason, owner_notes } = body;
  if (!bookingId || !ALLOWED_ACTIONS.includes(action)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  // Verify token and identify the caller
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(accessToken);
  if (authErr || !user) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Fetch booking + site + owner
  const { data: booking } = await authClient
    .from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Booking not found' }) };
  }

  const { data: callerProfile } = await authClient
    .from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  const isOwner = booking.owner_user_id === user.id;
  const isAdmin = !!callerProfile?.is_super_admin;
  if (!isOwner && !isAdmin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const transition = applyAction(booking.status, action, { reason });
  if (!transition.ok) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: transition.error }) };
  }

  const patch = { status: transition.status, updated_at: new Date().toISOString() };
  if (action === 'decline') patch.declined_reason = reason;
  if (owner_notes !== undefined) patch.owner_notes = owner_notes;

  const { data: updated, error: upErr } = await authClient
    .from('bookings').update(patch).eq('id', bookingId).select().single();
  if (upErr) {
    console.error('update-booking update error:', upErr);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Update failed' }) };
  }

  // Customer email on confirm/decline/cancel
  if (['confirm', 'decline', 'cancel'].includes(action)) {
    const { data: site } = await authClient
      .from('sites').select('id, business_info').eq('id', updated.site_id).maybeSingle();
    const emailStatus = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[action];
    statusUpdateToCustomer({ booking: updated, site, status: emailStatus, reason })
      .catch((err) => console.error('customer email failed:', err));
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, booking: updated }) };
};
```

- [ ] **Step 2: Smoke-test locally**

Sign in to the app, copy your Supabase access token from browser storage (`localStorage.getItem('sb-<project>-auth-token')` → parse JSON, grab `access_token`), then:

```bash
curl -X POST http://localhost:8888/.netlify/functions/update-booking \
  -H "Authorization: Bearer <your-token>" \
  -H 'Content-Type: application/json' \
  -d '{"bookingId":"<pending-booking-id>","action":"confirm"}'
```

Expected: `{"ok":true,"booking":{...,"status":"confirmed"}}`. Row updated, customer email arrives.

- [ ] **Step 3: Test unauthorized action**

Attempt `action: "complete"` on a `pending` booking — expect 400 with "cannot complete from pending".

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/update-booking.js
git commit -m "feat(api): update-booking endpoint for owner actions"
```

---

## Task 9: Vanilla-JS widget (`scheduler.js`)

**Files:**
- Create: `public/scheduler.js`

Hosted statically by the main Netlify app. Because `vite` publishes `public/` verbatim to the site root, `https://<main-app>/scheduler.js` will serve it.

- [ ] **Step 1: Create the widget**

Create `public/scheduler.js`:

```js
/* Scheduler widget — loaded on published static sites via:
   <script src="https://<app>/scheduler.js" data-site-id="<uuid>" defer></script> */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  if (!siteId) return;

  var API = script.src.replace(/\/scheduler\.js.*$/, '');

  fetch(API + '/.netlify/functions/scheduler-config?siteId=' + encodeURIComponent(siteId))
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      mount(cfg);
    });

  function mount(cfg) {
    var brand = cfg.brandColor || '#1a1a1a';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Book Now';
    btn.setAttribute('aria-label', 'Open booking form');
    btn.style.cssText =
      'position:fixed;right:20px;bottom:72px;z-index:9998;padding:14px 22px;' +
      'background:' + brand + ';color:#fff;border:0;border-radius:999px;' +
      'font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.18);';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);

    // Also bind any in-template triggers
    document.querySelectorAll('[data-scheduler-trigger]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    });

    function openModal() {
      if (document.getElementById('acg-scheduler-modal')) return;
      var overlay = document.createElement('div');
      overlay.id = 'acg-scheduler-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px;' +
        'font-family:Inter,system-ui,sans-serif;';

      var card = document.createElement('div');
      card.style.cssText =
        'background:#fff;border-radius:14px;max-width:480px;width:100%;' +
        'max-height:90vh;overflow:auto;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

      var today = new Date().toISOString().slice(0, 10);
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">' +
          '<h2 style="margin:0;font-size:22px;font-weight:800;color:#111;">Request a booking</h2>' +
          '<button type="button" data-close aria-label="Close" ' +
            'style="background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#888;">×</button>' +
        '</div>' +
        '<p style="margin:0 0 20px 0;color:#666;font-size:13px;">' +
          (cfg.businessName ? cfg.businessName + ' will' : 'We will') +
          ' email you to confirm.</p>' +
        '<form id="acg-booking-form" novalidate>' +
          field('customer_name', 'Name', 'text', true) +
          field('customer_email', 'Email', 'email', true) +
          field('customer_phone', 'Phone', 'tel', true) +
          row(
            field('date', 'Date', 'date', true, 'min="' + today + '"'),
            field('time', 'Time', 'time', true)
          ) +
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
          '<input type="text" name="website" tabindex="-1" autocomplete="off" ' +
            'style="position:absolute;left:-9999px;" aria-hidden="true" />' +
          '<div id="acg-form-error" style="color:#c00;font-size:13px;margin:8px 0;display:none;"></div>' +
          '<button type="submit" style="width:100%;margin-top:12px;padding:14px;background:' + brand +
            ';color:#fff;border:0;border-radius:10px;font:600 15px Inter;cursor:pointer;">' +
            'Submit request</button>' +
        '</form>' +
        '<div id="acg-booking-success" style="display:none;text-align:center;padding:20px 0;">' +
          '<h3 style="margin:0 0 8px 0;color:#111;">Thanks!</h3>' +
          '<p style="margin:0;color:#666;font-size:14px;">We emailed you a confirmation and will be in touch shortly.</p>' +
        '</div>';

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      var lastFocus = document.activeElement;
      var firstInput = card.querySelector('input,select,textarea,button');
      if (firstInput) firstInput.focus();

      function close() {
        overlay.remove();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }

      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      card.querySelector('[data-close]').addEventListener('click', close);
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
      });

      card.querySelector('#acg-booking-form').addEventListener('submit', function (e) {
        e.preventDefault();
        submit(card);
      });
    }

    function submit(card) {
      var form = card.querySelector('#acg-booking-form');
      var errBox = card.querySelector('#acg-form-error');
      errBox.style.display = 'none';
      errBox.textContent = '';

      var data = Object.fromEntries(new FormData(form).entries());
      var preferred = data.date && data.time
        ? new Date(data.date + 'T' + data.time).toISOString()
        : null;

      var payload = {
        siteId: siteId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        preferred_at: preferred,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: Number(data.vehicle_year),
        vehicle_size: data.vehicle_size,
        service_address: data.service_address || undefined,
        notes: data.notes || undefined,
        referral_source: data.referral_source || undefined,
        website: data.website || undefined,
      };

      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      fetch(API + '/.netlify/functions/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            form.style.display = 'none';
            card.querySelector('#acg-booking-success').style.display = 'block';
          } else {
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

    function field(name, label, type, required, extra) {
      return '<label style="display:block;margin-bottom:12px;font-size:13px;color:#333;">' +
        label + (required ? ' <span style="color:#c00">*</span>' : '') +
        '<input type="' + type + '" name="' + name + '"' + (required ? ' required' : '') + ' ' + (extra || '') +
          ' style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:14px Inter;" />' +
        '</label>';
    }
    function fieldTextarea(name, label, required) {
      return '<label style="display:block;margin-bottom:12px;font-size:13px;color:#333;">' +
        label + (required ? ' <span style="color:#c00">*</span>' : '') +
        '<textarea name="' + name + '" rows="2" ' + (required ? 'required' : '') +
          ' style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:14px Inter;"></textarea>' +
        '</label>';
    }
    function select(name, label, options) {
      var opts = options.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
      return '<label style="display:block;margin-bottom:12px;font-size:13px;color:#333;">' + label +
        ' <span style="color:#c00">*</span>' +
        '<select name="' + name + '" required ' +
          'style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:14px Inter;background:#fff;">' +
          opts + '</select></label>';
    }
    function row(a, b) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' + a + b + '</div>';
    }
  }
})();
```

- [ ] **Step 2: Smoke-test widget directly**

With `npx netlify dev` running, open `http://localhost:8888/scheduler.js` in the browser — you should see the JS source.

Create a throwaway HTML file `public/scheduler-test.html` with:

```html
<!doctype html><html><body>
<h1>Widget test</h1>
<script src="/scheduler.js" data-site-id="<real-site-id>" defer></script>
</body></html>
```

Open `http://localhost:8888/scheduler-test.html`. Expected: Book Now button appears (if scheduler enabled for site), clicking opens the modal, submitting a valid form shows the success panel, a booking row appears in Supabase. Delete `scheduler-test.html` after.

- [ ] **Step 3: Commit**

```bash
git add public/scheduler.js
git commit -m "feat(widget): scheduler.js booking widget for published sites"
```

---

## Task 10: Inject widget script into published sites

**Files:**
- Modify: `src/lib/exportHtml.js`

- [ ] **Step 1: Locate the head-building section**

Open `src/lib/exportHtml.js`. The function `buildSeoHead` returns the `<head>` contents; the full HTML string is assembled near line 147.

- [ ] **Step 2: Add the scheduler script injection**

In `src/lib/exportHtml.js`, inside `buildSeoHead` (after the existing `<script src="https://cdn.tailwindcss.com"></script>` line), append the scheduler script. Find this existing line:

```js
  <!-- Tailwind CSS CDN (for utility classes in templates) -->
  <script src="https://cdn.tailwindcss.com"></script>
```

Replace it with:

```js
  <!-- Tailwind CSS CDN (for utility classes in templates) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Scheduler widget (visible only if owner has scheduler enabled) -->
  <script src="${SCHEDULER_WIDGET_URL}" data-site-id="${siteId}" defer></script>
```

Then, at the top of the file (after the imports), add:

```js
const SCHEDULER_WIDGET_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://app.autocaregenius.com') + '/scheduler.js';
```

And update `buildSeoHead` to accept `siteId`:

```js
function buildSeoHead(businessInfo, generatedCopy, siteId) {
  // ...existing code...
}
```

And pass `siteId` where `buildSeoHead` is called. Find `const seoHead = buildSeoHead(businessInfo, generatedCopy);` and change to:

```js
const seoHead = buildSeoHead(businessInfo, generatedCopy, siteId);
```

Finally, check that `siteId` is in scope where `buildHtmlString` is defined. If not, update the signature of `buildHtmlString` and its callers (`exportHtmlString`, `exportHtml`) to accept and pass `siteId` — audit callers in `src/lib/publishSite.js` (they pass `siteId` already to `exportHtmlString` via the top-level destructure — verify and thread through).

- [ ] **Step 3: Smoke-test**

Run `npm run dev`. Log in, open a site in the editor, click Export → check the downloaded HTML. Expected: `<script src=".../scheduler.js" data-site-id="<site-uuid>" defer></script>` appears in the `<head>`.

- [ ] **Step 4: Republish a live site**

From the Dashboard, click Republish on a site owned by a super-admin email. Visit the published URL. Expected: Book Now button appears bottom-right; modal works.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exportHtml.js
git commit -m "feat(publish): inject scheduler widget script into published sites"
```

---

## Task 11: Extend AuthContext with profile

**Files:**
- Modify: `src/lib/AuthContext.jsx`
- Create: `src/hooks/useProfile.js`

- [ ] **Step 1: Read current AuthContext**

Open `src/lib/AuthContext.jsx`. The context currently exposes `{ session, loading, isRecovery, clearRecovery }`. We'll add `profile` and a `refreshProfile` function.

- [ ] **Step 2: Extend AuthContext**

Modify `src/lib/AuthContext.jsx` to also fetch and expose the user's profile row. Inside the provider, after the session is loaded, add:

```jsx
const [profile, setProfile] = useState(null);

const refreshProfile = useCallback(async () => {
  if (!session?.user?.id) { setProfile(null); return; }
  const { data } = await supabase
    .from('profiles')
    .select('id, email, is_super_admin, scheduler_enabled')
    .eq('id', session.user.id)
    .maybeSingle();
  setProfile(data || null);
}, [session?.user?.id]);

useEffect(() => { refreshProfile(); }, [refreshProfile]);
```

Add `profile` and `refreshProfile` to the provider `value`.

- [ ] **Step 3: Create a lightweight `useProfile` hook**

Create `src/hooks/useProfile.js`:

```jsx
import { useAuth } from '../lib/AuthContext.jsx';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  return { profile, refreshProfile };
}
```

- [ ] **Step 4: Verify in the dashboard**

Temporarily add `console.log(profile)` in `DashboardPage.jsx` inside a `useEffect` — sign in, confirm the profile row loads with `is_super_admin` + `scheduler_enabled`. Remove the log after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/lib/AuthContext.jsx src/hooks/useProfile.js
git commit -m "feat(auth): expose profile (is_super_admin, scheduler_enabled) via AuthContext"
```

---

## Task 12: Client-side bookings library

**Files:**
- Create: `src/lib/bookings.js`

- [ ] **Step 1: Write the library**

Create `src/lib/bookings.js`:

```js
import { supabase } from './supabase.js';

export async function listBookingsForOwner({ userId, statusIn, from, to, search }) {
  let q = supabase
    .from('bookings')
    .select('*')
    .eq('owner_user_id', userId)
    .order('preferred_at', { ascending: true });

  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (from) q = q.gte('preferred_at', from);
  if (to) q = q.lte('preferred_at', to);
  if (search) q = q.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listAllBookings({ statusIn, from, to, search, ownerUserId }) {
  let q = supabase.from('bookings').select('*').order('preferred_at', { ascending: true });
  if (ownerUserId) q = q.eq('owner_user_id', ownerUserId);
  if (statusIn && statusIn.length) q = q.in('status', statusIn);
  if (from) q = q.gte('preferred_at', from);
  if (to) q = q.lte('preferred_at', to);
  if (search) q = q.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateBooking({ bookingId, action, reason, owner_notes }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch('/.netlify/functions/update-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bookingId, action, reason, owner_notes }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Update failed');
  return body.booking;
}

export async function saveOwnerNotes(bookingId, owner_notes) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ owner_notes, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bookings.js
git commit -m "feat(bookings): client-side query + mutation helpers"
```

---

## Task 13: Status pill + booking detail drawer

**Files:**
- Create: `src/components/dashboard/bookings/StatusPill.jsx`
- Create: `src/components/dashboard/bookings/BookingDetailDrawer.jsx`

- [ ] **Step 1: Create StatusPill**

Create `src/components/dashboard/bookings/StatusPill.jsx`:

```jsx
const STYLES = {
  pending:   { bg: 'bg-amber-50',  fg: 'text-amber-700',  border: 'border-amber-200',  label: 'Pending' },
  confirmed: { bg: 'bg-green-50',  fg: 'text-green-700',  border: 'border-green-200',  label: 'Confirmed' },
  declined:  { bg: 'bg-gray-100',  fg: 'text-gray-500',   border: 'border-gray-200',   label: 'Declined', strike: true },
  completed: { bg: 'bg-blue-50',   fg: 'text-blue-700',   border: 'border-blue-200',   label: 'Completed' },
  cancelled: { bg: 'bg-gray-100',  fg: 'text-gray-500',   border: 'border-gray-200',   label: 'Cancelled' },
};

export default function StatusPill({ status, className = '' }) {
  const s = STYLES[status] || STYLES.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.fg} ${s.border} ${s.strike ? 'line-through' : ''} ${className}`}
    >
      {s.label}
    </span>
  );
}
```

- [ ] **Step 2: Create BookingDetailDrawer**

Create `src/components/dashboard/bookings/BookingDetailDrawer.jsx`:

```jsx
import { useState, useEffect } from 'react';
import StatusPill from './StatusPill.jsx';
import { updateBooking, saveOwnerNotes } from '../../../lib/bookings.js';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const ACTIONS_FOR = {
  pending:   ['confirm', 'decline', 'cancel'],
  confirmed: ['complete', 'cancel'],
  declined:  [],
  completed: [],
  cancelled: [],
};

const ACTION_LABELS = {
  confirm:  { label: 'Confirm',        className: 'bg-green-600 hover:bg-green-700 text-white' },
  decline:  { label: 'Decline',        className: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' },
  complete: { label: 'Mark completed', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  cancel:   { label: 'Cancel',         className: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' },
};

export default function BookingDetailDrawer({ booking, onClose, onUpdated }) {
  const [b, setB] = useState(booking);
  const [notes, setNotes] = useState(booking?.owner_notes || '');
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDecline, setShowDecline] = useState(false);

  useEffect(() => { setB(booking); setNotes(booking?.owner_notes || ''); setShowDecline(false); setErr(null); }, [booking?.id]);

  if (!b) return null;

  async function run(action) {
    if (action === 'decline' && !showDecline) { setShowDecline(true); return; }
    if (action === 'decline' && !declineReason.trim()) { setErr('Enter a reason'); return; }
    setBusy(true); setErr(null);
    try {
      const updated = await updateBooking({
        bookingId: b.id,
        action,
        reason: action === 'decline' ? declineReason : undefined,
      });
      setB(updated);
      onUpdated && onUpdated(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function onNotesBlur() {
    if (notes === (b.owner_notes || '')) return;
    try { const updated = await saveOwnerNotes(b.id, notes); setB(updated); onUpdated && onUpdated(updated); }
    catch (e) { setErr(e.message); }
  }

  const actions = ACTIONS_FOR[b.status] || [];

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <StatusPill status={b.status} />
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <h2 className="text-xl font-black text-[#1a1a1a]">{b.customer_name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          <a href={`mailto:${b.customer_email}`} className="hover:underline">{b.customer_email}</a>
          {' · '}
          <a href={`tel:${b.customer_phone}`} className="hover:underline">{b.customer_phone}</a>
        </p>

        <dl className="text-sm space-y-2 mb-6">
          <Row term="When"     def={fmt(b.preferred_at)} />
          <Row term="Vehicle"  def={`${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model} (${b.vehicle_size})`} />
          {b.service_address  && <Row term="Address" def={b.service_address} />}
          {b.notes            && <Row term="Notes" def={b.notes} />}
          {b.referral_source  && <Row term="Heard via" def={b.referral_source} />}
          {b.declined_reason  && <Row term="Declined" def={b.declined_reason} />}
          <Row term="Created" def={fmt(b.created_at)} />
        </dl>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Owner notes (private)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onNotesBlur}
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />

        {showDecline && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason for declining</label>
            <input
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        {actions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a}
                onClick={() => run(a)}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${ACTION_LABELS[a].className}`}
              >
                {ACTION_LABELS[a].label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ term, def }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 text-gray-500 shrink-0">{term}</dt>
      <dd className="text-gray-800 break-words">{def}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/bookings/StatusPill.jsx src/components/dashboard/bookings/BookingDetailDrawer.jsx
git commit -m "feat(dashboard): booking status pill + detail drawer with owner actions"
```

---

## Task 14: Booking filters + list view

**Files:**
- Create: `src/components/dashboard/bookings/BookingFilters.jsx`
- Create: `src/components/dashboard/bookings/BookingsList.jsx`

- [ ] **Step 1: Create filters component**

Create `src/components/dashboard/bookings/BookingFilters.jsx`:

```jsx
const ALL_STATUSES = ['pending','confirmed','declined','completed','cancelled'];

export default function BookingFilters({ statusIn, onStatusIn, search, onSearch }) {
  function toggle(s) {
    if (statusIn.includes(s)) onStatusIn(statusIn.filter((x) => x !== s));
    else onStatusIn([...statusIn, s]);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {ALL_STATUSES.map((s) => {
        const on = statusIn.includes(s);
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${on ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            {s}
          </button>
        );
      })}
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search name or email"
        className="ml-auto w-56 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create list view**

Create `src/components/dashboard/bookings/BookingsList.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import BookingFilters from './BookingFilters.jsx';
import StatusPill from './StatusPill.jsx';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function BookingsList({ bookings, onSelect }) {
  const [statusIn, setStatusIn] = useState(['pending','confirmed']);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => statusIn.length === 0 || statusIn.includes(b.status))
      .filter((b) => !q || b.customer_name.toLowerCase().includes(q) || b.customer_email.toLowerCase().includes(q));
  }, [bookings, statusIn, search]);

  return (
    <div>
      <BookingFilters statusIn={statusIn} onStatusIn={setStatusIn} search={search} onSearch={setSearch} />

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-black/[0.07] rounded-2xl bg-white text-gray-500 text-sm">
          No bookings match these filters.
        </div>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Preferred</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} onClick={() => onSelect(b)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                  <td className="px-4 py-3 text-gray-800">{fmt(b.preferred_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{b.customer_name}</div>
                    <div className="text-xs text-gray-500">{b.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.vehicle_year} {b.vehicle_make} {b.vehicle_model}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/bookings/BookingFilters.jsx src/components/dashboard/bookings/BookingsList.jsx
git commit -m "feat(dashboard): bookings list view with filters"
```

---

## Task 15: Calendar view

**Files:**
- Create: `src/components/dashboard/bookings/BookingsCalendar.jsx`

- [ ] **Step 1: Create calendar**

Create `src/components/dashboard/bookings/BookingsCalendar.jsx`:

```jsx
import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth, format,
} from 'date-fns';
import StatusPill from './StatusPill.jsx';

const STATUS_COLOR = {
  pending:   'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  declined:  'bg-gray-100 text-gray-500 border-gray-200 line-through',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function BookingsCalendar({ bookings, onSelect }) {
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    const gridEnd = endOfWeek(endOfMonth(cursor));
    const out = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = format(new Date(b.preferred_at), 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [bookings]);

  return (
    <div className="bg-white border border-black/[0.07] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="px-3 py-1 rounded hover:bg-gray-100">‹</button>
          <button onClick={() => setCursor(new Date())} className="px-3 py-1 rounded hover:bg-gray-100 text-sm">Today</button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="px-3 py-1 rounded hover:bg-gray-100">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden text-sm">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-500 text-center">{d}</div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const items = byDay.get(key) || [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={key} className={`bg-white min-h-[96px] p-1 ${!inMonth ? 'text-gray-300' : ''}`}>
              <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-red-600' : 'text-gray-500'}`}>{format(day, 'd')}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate ${STATUS_COLOR[b.status]}`}
                    title={`${b.customer_name} — ${format(new Date(b.preferred_at), 'h:mma')}`}
                  >
                    {format(new Date(b.preferred_at), 'h:mma')} {b.customer_name}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="text-[11px] text-gray-500 pl-1">+{items.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2 text-[11px] text-gray-500 items-center">
        <StatusPill status="pending" />
        <StatusPill status="confirmed" />
        <StatusPill status="completed" />
        <StatusPill status="declined" />
        <StatusPill status="cancelled" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/bookings/BookingsCalendar.jsx
git commit -m "feat(dashboard): month calendar view for bookings"
```

---

## Task 16: Bookings view shell (tabs + integration)

**Files:**
- Create: `src/components/dashboard/bookings/BookingsView.jsx`

- [ ] **Step 1: Create the shell**

Create `src/components/dashboard/bookings/BookingsView.jsx`:

```jsx
import { useEffect, useState } from 'react';
import BookingsList from './BookingsList.jsx';
import BookingsCalendar from './BookingsCalendar.jsx';
import BookingDetailDrawer from './BookingDetailDrawer.jsx';
import { listBookingsForOwner, listAllBookings } from '../../../lib/bookings.js';

export default function BookingsView({ userId, isAdmin = false, onBack }) {
  const [tab, setTab] = useState('calendar');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const rows = isAdmin
        ? await listAllBookings({})
        : await listBookingsForOwner({ userId });
      setBookings(rows);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId, isAdmin]);

  function onUpdated(updated) {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
    setSelected(updated);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Bookings</h2>
        {onBack && (
          <button onClick={onBack} className="text-sm text-[#888] hover:text-[#1a1a1a]">← Back</button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <TabBtn on={tab === 'calendar'} onClick={() => setTab('calendar')}>Calendar</TabBtn>
        <TabBtn on={tab === 'list'} onClick={() => setTab('list')}>List</TabBtn>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        tab === 'calendar'
          ? <BookingsCalendar bookings={bookings} onSelect={setSelected} />
          : <BookingsList bookings={bookings} onSelect={setSelected} />
      )}

      {selected && (
        <BookingDetailDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}

function TabBtn({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${on ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/bookings/BookingsView.jsx
git commit -m "feat(dashboard): bookings view with calendar/list tabs and detail drawer"
```

---

## Task 17: Wire Bookings into the dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardPage.jsx`

- [ ] **Step 1: Replace hardcoded ADMIN_EMAILS with profile check**

In `src/components/dashboard/DashboardPage.jsx`, remove the top-of-file constant `const ADMIN_EMAILS = ['dev@639hz.com'];` and stop using `ADMIN_EMAILS.includes(userEmail)`. Accept a `profile` prop and use `profile?.is_super_admin`.

Update the component signature from:

```jsx
export default function DashboardPage({ onNewSite, onEditSite, onSignOut, userEmail }) {
```

to:

```jsx
export default function DashboardPage({ onNewSite, onEditSite, onSignOut, userEmail, profile, onOpenAdmin }) {
```

Replace `const isAdmin = ADMIN_EMAILS.includes(userEmail);` with `const isAdmin = !!profile?.is_super_admin;`.

- [ ] **Step 2: Add view-toggle state and Bookings nav**

At the top of the component body, add:

```jsx
const [view, setView] = useState('sites'); // 'sites' | 'bookings'
const schedulerEnabled = !!profile?.scheduler_enabled;
```

Inside the header, add a "Bookings" link and an "Admin" link. Modify the header section to look like:

```jsx
<header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
  <div className="flex items-center gap-6">
    <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Genius Websites</h1>
    <nav className="flex gap-4 text-sm">
      <button onClick={() => setView('sites')} className={view === 'sites' ? 'font-semibold text-[#1a1a1a]' : 'text-gray-500 hover:text-[#1a1a1a]'}>Sites</button>
      {schedulerEnabled && (
        <button onClick={() => setView('bookings')} className={view === 'bookings' ? 'font-semibold text-[#1a1a1a]' : 'text-gray-500 hover:text-[#1a1a1a]'}>Bookings</button>
      )}
    </nav>
  </div>
  <div className="flex items-center gap-4">
    {isAdmin && onOpenAdmin && (
      <button onClick={onOpenAdmin} className="text-xs text-[#1a1a1a] font-semibold hover:text-[#cc0000]">Admin</button>
    )}
    {userEmail && <span className="text-xs text-[#888]">{userEmail}</span>}
    {onSignOut && (
      <button onClick={onSignOut} className="text-xs text-[#888] hover:text-[#cc0000] transition-colors">Sign Out</button>
    )}
  </div>
</header>
```

- [ ] **Step 3: Render the BookingsView when view==='bookings'**

Add this import near the other dashboard imports:

```jsx
import BookingsView from './bookings/BookingsView.jsx';
```

Replace the `<main>` content's top-level structure so it switches:

```jsx
<main className="max-w-4xl mx-auto px-6 py-10">
  {view === 'bookings'
    ? <BookingsView userId={profile?.id} />
    : (
      /* ...existing sites grid content unchanged... */
    )}
</main>
```

- [ ] **Step 4: Thread `profile` and `onOpenAdmin` from `App.jsx`**

In `src/App.jsx`, pull `profile` from `useAuth()`. At the render of `DashboardPage`, pass:

```jsx
<DashboardPage
  onNewSite={() => { handleStartOver(); setView('wizard'); }}
  onEditSite={handleEditSite}
  onSignOut={handleSignOut}
  userEmail={session?.user?.email}
  profile={profile}
  onOpenAdmin={() => setView('admin')}
/>
```

Add `'admin'` as a valid `view` value (this is used by Task 19).

- [ ] **Step 5: Smoke-test**

Sign in as a super-admin (one of the seeded emails). Expected: "Bookings" appears in the header (because `scheduler_enabled=true`); clicking it shows the empty calendar. Sign in as a non-admin user — no Bookings link.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DashboardPage.jsx src/App.jsx
git commit -m "feat(dashboard): wire Bookings view behind scheduler_enabled flag"
```

---

## Task 18: Super-admin accounts tab

**Files:**
- Create: `src/components/admin/AdminAccountsTab.jsx`

- [ ] **Step 1: Create the tab**

Create `src/components/admin/AdminAccountsTab.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function AdminAccountsTab({ onViewOwnerBookings }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');

  async function refresh() {
    setLoading(true); setErr(null);
    // Profile rows joined with site count + first published URL.
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, is_super_admin, scheduler_enabled, created_at');
    if (pErr) { setErr(pErr.message); setLoading(false); return; }

    const { data: sites } = await supabase
      .from('sites')
      .select('id, user_id, published_url, business_info');

    const siteByUser = {};
    (sites || []).forEach((s) => {
      const arr = siteByUser[s.user_id] || (siteByUser[s.user_id] = []);
      arr.push(s);
    });

    setRows((profiles || []).map((p) => ({
      ...p,
      siteCount: (siteByUser[p.id] || []).length,
      firstPublishedUrl: (siteByUser[p.id] || []).find((s) => s.published_url)?.published_url || null,
    })));
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, search]);

  async function toggle(id, field, current) {
    if (field === 'is_super_admin' && !current) {
      const ok = confirm('Grant super admin to this user?');
      if (!ok) return;
    }
    const { error } = await supabase
      .from('profiles').update({ [field]: !current, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { alert(error.message); return; }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: !current } : r));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email"
          className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
        />
        <button onClick={refresh} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
      </div>

      {loading ? <p className="text-sm text-gray-500">Loading…</p>
       : err   ? <p className="text-sm text-red-600">{err}</p>
       : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Published site</th>
                <th className="px-4 py-3">Scheduler</th>
                <th className="px-4 py-3">Super admin</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{r.email}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-700">{r.siteCount}</td>
                  <td className="px-4 py-3">
                    {r.firstPublishedUrl
                      ? <a href={r.firstPublishedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Visit</a>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><Toggle on={r.scheduler_enabled} onClick={() => toggle(r.id, 'scheduler_enabled', r.scheduler_enabled)} /></td>
                  <td className="px-4 py-3"><Toggle on={r.is_super_admin}    onClick={() => toggle(r.id, 'is_super_admin',    r.is_super_admin)} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => onViewOwnerBookings && onViewOwnerBookings(r)} className="text-xs text-gray-600 hover:text-[#1a1a1a] underline">
                      View bookings
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminAccountsTab.jsx
git commit -m "feat(admin): accounts tab with scheduler + super-admin toggles"
```

---

## Task 19: Super-admin page shell + route wiring

**Files:**
- Create: `src/components/admin/AdminPage.jsx`
- Create: `src/components/admin/AdminAllBookingsTab.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create all-bookings tab**

Create `src/components/admin/AdminAllBookingsTab.jsx` — this re-uses the owner view in admin mode:

```jsx
import BookingsView from '../dashboard/bookings/BookingsView.jsx';

export default function AdminAllBookingsTab({ filterByOwnerId }) {
  // In admin mode, BookingsView calls listAllBookings.
  // Passing a userId here doesn't matter when isAdmin=true unless you want to scope.
  // We ignore filterByOwnerId at MVP — admin sees all.
  return <BookingsView userId={filterByOwnerId} isAdmin={true} />;
}
```

- [ ] **Step 2: Create the admin page shell**

Create `src/components/admin/AdminPage.jsx`:

```jsx
import { useState } from 'react';
import AdminAccountsTab from './AdminAccountsTab.jsx';
import AdminAllBookingsTab from './AdminAllBookingsTab.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';

export default function AdminPage({ onExit }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('accounts');

  if (!profile) return <div className="p-10 text-gray-500">Loading…</div>;
  if (!profile.is_super_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-center">
          <p className="text-gray-600 mb-3">You don't have access to this area.</p>
          <button onClick={onExit} className="text-sm text-[#1a1a1a] hover:text-[#cc0000] underline">Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a]">Admin</h1>
        <button onClick={onExit} className="text-sm text-gray-500 hover:text-[#1a1a1a]">← Back to dashboard</button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <TabBtn on={tab === 'accounts'} onClick={() => setTab('accounts')}>Accounts</TabBtn>
          <TabBtn on={tab === 'bookings'} onClick={() => setTab('bookings')}>All bookings</TabBtn>
        </div>
        {tab === 'accounts' ? <AdminAccountsTab onViewOwnerBookings={() => setTab('bookings')} /> : <AdminAllBookingsTab />}
      </main>
    </div>
  );
}

function TabBtn({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${on ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Route admin view in `App.jsx`**

In `src/App.jsx`, add the admin import:

```jsx
import AdminPage from './components/admin/AdminPage.jsx';
```

Find the dashboard view branch:

```jsx
if (view === 'dashboard') {
  return <DashboardPage ... />;
}
```

Add immediately above it (or just above):

```jsx
if (view === 'admin') {
  return <AdminPage onExit={() => setView('dashboard')} />;
}
```

- [ ] **Step 4: Smoke-test**

Sign in as super admin. Click Admin in the header → admin page loads → Accounts tab lists profiles → toggles work → switching to a non-admin user shows no Admin link.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminPage.jsx src/components/admin/AdminAllBookingsTab.jsx src/App.jsx
git commit -m "feat(admin): admin page with accounts + all-bookings tabs"
```

---

## Task 20: End-to-end smoke test + docs

**Files:**
- Create: `docs/superpowers/smoke-tests/scheduler.md`

- [ ] **Step 1: Write the smoke-test checklist**

Create `docs/superpowers/smoke-tests/scheduler.md`:

```markdown
# Scheduler smoke test

Run after any change to scheduler code. Checkbox each step.

## Setup
- [ ] Netlify env has POSTMARK_API_TOKEN, POSTMARK_FROM_EMAIL, MAIN_APP_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
- [ ] Migration `20260422_scheduler_mvp.sql` applied.
- [ ] Super-admin seeds exist (`select email from profiles where is_super_admin`).

## Happy path (super admin's site)
- [ ] Sign in as `dev@639hz.com`.
- [ ] Publish a site (existing or new) — check that the published HTML contains a `<script src="…/scheduler.js">` tag.
- [ ] Open the published URL in a fresh incognito window.
- [ ] Verify a "Book Now" button appears bottom-right.
- [ ] Click it — modal opens.
- [ ] Submit the form with a throwaway email you can check.
- [ ] Success panel appears.
- [ ] Sign in to the dashboard → Bookings → Calendar → see the booking on the correct day.
- [ ] Open drawer → Confirm → verify status changes to confirmed.
- [ ] Check the throwaway inbox — confirmation email arrived from Postmark.
- [ ] Go back to Calendar → Mark completed → verify status is completed.

## Gating path (non-admin account)
- [ ] Sign up a new test user.
- [ ] Confirm they have NO "Bookings" link in the dashboard header.
- [ ] Their published site shows NO Book Now button (because `scheduler_enabled` defaults to false).
- [ ] Sign in as super admin → Admin → Accounts → toggle scheduler ON for the test user.
- [ ] Wait ~60 seconds (CDN cache TTL), refresh the published site.
- [ ] Book Now button now appears.
- [ ] Toggle scheduler OFF again, wait 60s, refresh — button disappears.

## Failure paths
- [ ] Submit the booking form with an invalid email — inline error appears, no DB row.
- [ ] Submit with the honeypot field filled via devtools — response is 200 but no DB row.
- [ ] On the owner side, try to Decline without a reason — drawer shows "Enter a reason".

## RLS sanity
- [ ] In Supabase SQL editor as anon: `select count(*) from bookings;` → 0 or permission denied.
- [ ] Sign in as one owner, the other owner's bookings do not appear in their list.
```

- [ ] **Step 2: Run the full smoke test in staging / dev**

Actually perform every checkbox. If any fails, file a bug and fix before merge.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/smoke-tests/scheduler.md
git commit -m "docs: scheduler smoke test checklist"
```

---

## Self-review

**Spec coverage:** Every spec section maps to one or more tasks:
- Data model → Task 1
- Widget delivery → Task 9, Task 10
- `scheduler-config` endpoint → Task 6
- `create-booking` endpoint → Task 7
- `update-booking` endpoint → Task 8
- `send-booking-email` helper → Task 5
- Owner dashboard (calendar + list + drawer + filters) → Tasks 13–17
- Super-admin panel → Tasks 18, 19
- Postmark provider → Task 5
- Env vars / setup notes → top of plan
- Smoke tests → Task 20

**Placeholder scan:** No TBDs, no "implement later", every step shows actual code or exact commands.

**Type consistency:** `applyAction`, `ALLOWED_ACTIONS` match between Task 4 (definition) and Task 8 (consumer). `validateBookingPayload` match between Task 3 and Task 7. `newBookingToOwner`, `statusUpdateToCustomer` match between Task 5 and Tasks 7/8. Component props (`booking`, `onUpdated`, `onSelect`) are consistent across Tasks 13–19.
