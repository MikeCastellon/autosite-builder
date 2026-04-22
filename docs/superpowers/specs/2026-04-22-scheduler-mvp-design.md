# Scheduler MVP — Design Spec

**Date:** 2026-04-22
**Status:** Approved, ready for implementation plan
**Target use case:** Auto-detailing businesses (single-service, request-based booking)

## Summary

Add a customer-facing appointment booking feature to published websites. Visitors submit booking requests through a "Book Now" modal. Site owners receive email notifications and approve, decline, complete, or cancel bookings from their account dashboard. The feature is gated per-account by a super-admin toggle — a temporary, manual stand-in for a future Stripe-based paid-upgrade tier (not in scope).

## Goals

- Let site owners accept booking requests from their published sites without leaving the platform.
- Give owners a unified Bookings view in their dashboard (calendar + list).
- Give two designated super admins a panel to grant/revoke scheduler access per account and manage super-admin status.
- Design the data model so a paid billing tier and optional deposits (Stripe) can be added later without migration pain.

## Non-goals (explicitly out of scope)

- Payments, deposits, Stripe — separate project.
- Multiple services, staff selection, resource scheduling.
- Customer accounts, login, or reschedule flow from the widget.
- SMS notifications — email only.
- Real-time availability / slot locking — request-based.
- Google Calendar / iCal sync.
- File upload on the booking form.
- "Propose new time" counter-offer flow.

## Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Scheduler type | Customer-facing appointment booking |
| 2 | Service model | Single service (auto-detailing focus) |
| 3 | Approval model | Request-based; owner approves each |
| 4 | Payment at booking | None at MVP; design for deposits later |
| 5 | Form fields | name, email, phone, date+time, vehicle (make/model/year/size), notes, address, referral source |
| 6 | Notifications | Email both directions only |
| 7 | Visitor UI placement | Modal on published site |
| 8 | Owner dashboard UI | Bookings section with calendar + list views |
| 9 | Gating | Super-admin toggle per account (billing later) |
| 10 | Admin identification | `is_super_admin` on `profiles` table |
| 11 | Visitor date/time picker | Specific date + specific time |
| 12 | Lifecycle | `pending` → `confirmed` → `completed` \| `cancelled`, plus `declined` |
| 13 | Widget delivery | Script tag hosted by main app, injected into published HTML |
| 14 | Email provider | Postmark (project standard) |

## Architecture

### System diagram (logical)

```
Visitor's browser (published site on R2 / *.autocaregeniushub.com)
    │
    │  <script src="yourapp/scheduler.js" data-site-id="…"></script>
    ▼
scheduler.js widget
    │  GET  scheduler-config ─┐
    │  POST create-booking ───┤
    ▼                         │
Netlify functions             │
    scheduler-config ─────────┘
    create-booking ──► Supabase (bookings INSERT, anon RLS)
                   ──► Postmark (2 emails: owner + customer)
    update-booking ──► Supabase (bookings UPDATE, owner/admin RLS)
                   ──► Postmark (status email to customer)
    send-booking-email (internal helper)

Main app (React)
    Dashboard → Bookings tab (owner-scoped, auth'd)
    Admin panel  (super-admin-scoped, auth'd)
    Both read/write via supabase-js under the session's JWT.
```

### Widget delivery chosen over alternatives
**Chosen:** Script tag widget — one codebase, instant updates, real-time kill switch via the super-admin toggle.
**Rejected:** Inline bundled modal (requires owner re-publish for every change) and iframe/popup (cross-origin UX friction).

## Data model

### `profiles` (new)
One row per auth user. Stores admin and feature flags.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_super_admin boolean not null default false,
  scheduler_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-populate on user signup
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end; $$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### `bookings` (new)

```sql
create table bookings (
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
  deposit_amount_cents integer,        -- null at MVP, populated when billing lands
  payment_status text,                 -- null at MVP; 'unpaid'|'paid'|'refunded' later
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_owner_status_at_idx
  on bookings (owner_user_id, status, preferred_at);
create index bookings_site_created_idx
  on bookings (site_id, created_at desc);
```

### RLS policies

**`profiles`**
- SELECT own row: `auth.uid() = id`.
- SELECT all rows: caller is super admin.
- UPDATE own row: `auth.uid() = id` *excluding* `is_super_admin` and `scheduler_enabled` (enforced by column grant).
- UPDATE any row: caller is super admin.

**`bookings`**
- INSERT (anon role): allowed only when the referenced `site_id`'s owner has `scheduler_enabled = true`. Enforced via a `SECURITY DEFINER` helper function `can_book_site(uuid) returns boolean` called from the RLS `with check` clause.
- SELECT / UPDATE: `owner_user_id = auth.uid()` OR caller is super admin.
- DELETE: disallowed (use `cancelled` status instead).

### Seeds

```sql
-- After backfilling profiles for existing users:
update profiles set is_super_admin = true, scheduler_enabled = true
  where email in ('mike.castellon5@gmail.com','dev@639hz.com');
```

## Components

### 1. Widget — `scheduler.js`

**Location:** served from the main Netlify app at `/scheduler.js` (a plain JS file in `public/` or built by Vite as a standalone entry).

**Responsibility:** On any published site, inject a "Book Now" button and a booking modal, but only if the site's owner has scheduler enabled.

**Runtime flow:**
1. Reads `data-site-id` from its own `<script>` tag.
2. Fetches `/.netlify/functions/scheduler-config?siteId=X`. Response: `{ enabled, businessName, brandColor }`.
3. If `enabled === false`: exit silently.
4. Otherwise, inject:
   - Floating button (bottom-right, branded with `brandColor`).
   - Click handlers on any `[data-scheduler-trigger]` elements in the DOM (so templates can embed inline Book Now buttons).
5. On click, open modal.

**Modal:**
- Vanilla JS + inline styles, target ≤ 15 KB gzipped.
- Fields in order: name, email, phone, date, time, vehicle make, model, year, size, service address (optional), notes (optional), referral source (optional), hidden `website` honeypot.
- Required fields: all except `service_address`, `notes`, `referral_source`.
- Client validation: required + email format + date ≥ today.
- Submit → `POST /.netlify/functions/create-booking`.
- Success state: "Thanks — we emailed you a confirmation and we'll be in touch shortly."
- Error state: inline error + retry button.

**Accessibility:**
- Focus trap while open.
- Escape + overlay click + X button close.
- Returns focus to trigger on close.
- `aria-modal`, `role="dialog"`, labelled inputs.

**Responsive:**
- Full-screen sheet on mobile (≤ 640px).
- Centered 480px card on desktop.

### 2. Netlify functions

#### `scheduler-config.js`
- `GET /.netlify/functions/scheduler-config?siteId=<uuid>`
- No auth.
- Returns `{ enabled, businessName, brandColor }`.
  - `businessName`: from `sites.business_info.businessName`.
  - `brandColor`: from `sites.generated_content._customColors.primary` if set; otherwise the template's `colors.primary` (looked up via `sites.template_id` against `src/data/templates.js` server-side, or a hardcoded fallback map in the function).
  - `enabled`: `false` if site not found or owner's `scheduler_enabled` is false.
- Response header: `Cache-Control: public, max-age=60`.

#### `create-booking.js`
- `POST /.netlify/functions/create-booking`
- Body: `{ siteId, customer_name, customer_email, customer_phone, preferred_at, vehicle_make, vehicle_model, vehicle_year, vehicle_size, service_address?, notes?, referral_source?, website? }`.
- Validates: required fields, email format, future `preferred_at`, `vehicle_size` in allowed set.
- Honeypot: if `website` is non-empty, return 200 OK without inserting.
- Rate limit: 5 submissions per IP per hour per site (in-memory LRU; upgrade to Supabase counter if abused).
- Uses **service role key** (server-side) to INSERT with `status='pending'`.
- Fires two Postmark emails via `send-booking-email` helper (fire-and-forget; log failures but still return 200 if insert succeeded).
- Returns `{ ok: true, bookingId }`.

#### `update-booking.js`
- `POST /.netlify/functions/update-booking`
- `Authorization: Bearer <supabase access token>` — verified server-side.
- Body: `{ bookingId, action, reason?, owner_notes? }` where `action ∈ {confirm, decline, complete, cancel}`.
- Verifies caller owns the booking or is super admin.
- State machine:
  - `confirm`: pending → confirmed.
  - `decline`: pending → declined (requires `reason`).
  - `complete`: confirmed → completed.
  - `cancel`: pending|confirmed → cancelled.
  - Any other transition: 400.
- Triggers `statusUpdateToCustomer` email on confirm / decline / cancel.
- Returns updated booking row.

#### `send-booking-email.js`
- Internal helper module used by `create-booking` and `update-booking`.
- Uses Postmark (`postmark` npm package, `POSTMARK_API_TOKEN` env var).
- Two template functions:
  - `newBookingToOwner(booking, site)` — rendered HTML + text, subject `New booking request from <name> — <date>`.
  - `statusUpdateToCustomer(booking, site)` — status-aware (confirmed/declined/cancelled), subject `Your booking request — <status>`.
- From address: `bookings@<verified-domain>` (domain verification is a one-time Postmark setup task).

### 3. Owner dashboard — Bookings tab

**Location:** new item in `DashboardPage.jsx` sidebar, rendered only if `scheduler_enabled`.

**Screen structure:**
- Header with "Bookings" title and tab switcher: `Calendar` | `List` (state in URL query).
- Below: tab content.

**Calendar view:**
- Month grid by default, toggle to week view.
- Each day cell: up to 3 booking pills, color-coded by status (amber=pending, green=confirmed, gray strikethrough=declined, blue=completed, gray=cancelled). Overflow shows "+N more".
- Click day → side panel listing that day's bookings.
- Click pill → Booking Detail Drawer.
- Built with `date-fns` and a custom grid (~50 lines). No external calendar lib.

**List view:**
- Filter bar: status (multi-select chips), date range, free-text search (name/email).
- Default filter: `status != completed && status != cancelled`, sorted by `preferred_at ASC`.
- Columns: status · preferred date/time · customer · phone · vehicle · created_at.
- Click row → Booking Detail Drawer.

**Booking Detail Drawer:**
- Slides in from right.
- All booking fields.
- Actions depend on current status:
  - `pending` → **Confirm** · **Decline** (reason required) · **Cancel**
  - `confirmed` → **Mark Completed** · **Cancel**
  - `declined` / `completed` / `cancelled` → read-only
- Owner notes textarea (save on blur).
- `mailto:` link on email, `tel:` link on phone.

**Empty states:**
- No bookings yet: "No bookings yet. Your booking form is live at <siteUrl>. Share the link with customers to get started."
- Scheduler disabled: "Your scheduler isn't enabled yet. Contact the admin to request access."

### 4. Super-admin panel

**Location:** new route `/admin` in the main app. Access-guarded by `is_super_admin`.

**Tabs:** `Accounts` | `Bookings (all)`

**Accounts tab:**
- Table: email · signed up · # sites · published site link (first site) · scheduler toggle · super-admin toggle · last active.
- Scheduler toggle: `UPDATE profiles SET scheduler_enabled` — takes effect within 60 s on live sites via config cache TTL.
- Super-admin toggle: confirmation modal before flipping.
- Search bar (email), filter chips (scheduler enabled, super admin only).
- "View bookings" per row → cross-links to Bookings tab filtered by that owner.

**Bookings (all) tab:**
- Same UI as owner's list + calendar, with an extra "Owner" column.
- Same detail drawer, super admin can take the same actions on any booking.

### 5. Publish integration

In `src/lib/exportHtml.js`, always inject the widget script tag into the published HTML `<head>`:

```html
<script src="https://<main-app-domain>/scheduler.js" data-site-id="{siteId}" defer></script>
```

No conditional injection — the widget's config call is the live kill switch. This means flipping `scheduler_enabled` on for an existing published site activates booking within ~60 s without re-publishing.

## Error handling

| Scenario | Behavior |
|---|---|
| Widget config call fails | Silent exit (no Book Now button appears). Logged in browser console. |
| Booking insert fails | Modal shows friendly error + retry button. Error logged. |
| Postmark send fails | Booking is still saved. Failure logged with booking ID. Admin can re-send later (future enhancement). |
| Caller lacks permission on update-booking | Server returns 403. Drawer shows "You don't have permission to take this action" and re-fetches booking state. |
| RLS denial on anon insert (scheduler disabled mid-session) | `create-booking` returns 403 "Booking is no longer available for this site." |
| Invalid state transition | `update-booking` returns 400 with `{ error: "Cannot move from X to Y" }`. |

## Testing plan

### Automated
- **Playwright end-to-end:** publish a site, load it, open the modal, submit a booking, sign in as owner in a second context, confirm the booking from the drawer, assert both Postmark messages fired (via test-mode Postmark outbound webhook or mock).
- **RLS spec (pgTAP or SQL script):**
  - Anonymous INSERT succeeds when `scheduler_enabled=true`, fails when false.
  - Anonymous SELECT on `bookings` always fails.
  - Owner SELECT sees only their own bookings.
  - Super admin SELECT sees all.
- **Function unit tests:** input validation, state machine, honeypot, rate limit.

### Manual smoke tests
- Toggle scheduler off from admin panel → widget disappears on a live published site within 60 s.
- Submit from mobile Safari, Chrome, Firefox.
- Verify Postmark emails render correctly in Gmail, Apple Mail, Outlook web.
- Decline without reason → form validation error.

## Env vars and setup

New env vars (Netlify):
- `POSTMARK_API_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side writes)
- `MAIN_APP_URL` (for building dashboard links in emails)

One-time setup:
- Postmark server + domain verification for `<your-domain>` so `bookings@<your-domain>` can send.
- Add `scheduler.js` to Vite build (or serve from `public/`) and verify CORS headers on Netlify.

## Build order

Rough sequence for the implementation plan:

1. Supabase migrations — `profiles`, `bookings`, RLS, seeds.
2. Netlify functions — `scheduler-config`, `create-booking`, `send-booking-email` helper.
3. Widget — `scheduler.js` + modal + injection in `exportHtml.js`.
4. Owner dashboard — list view first, drawer, then calendar view.
5. Super-admin panel — accounts tab first, then all-bookings tab.
6. `update-booking` function + drawer action wiring.
7. E2E tests + manual smoke.

## Open items deferred to later projects

- Stripe billing + real paid tier (replaces super-admin toggle).
- Optional deposits at booking (`deposit_amount_cents` is already nullable-ready).
- Multiple services and staff selection.
- Propose-new-time counter-offer.
- SMS notifications (Twilio).
- Google Calendar / iCal sync.
