# Booking Platform v3 — Design Spec

**Date established:** 2026-06-09
**Status:** Approved for planning
**Build order:** Feature 1 → Feature 2 → Feature 3 (sequential; each gets its own implementation plan)

## Overview

Three features layered onto the existing scheduler/booking system:

1. **Standalone booking service** — booking becomes its own product. A business can sign up and get a shareable, full-page booking link (for an Instagram bio, etc.) **without building a website**.
2. **Per-vehicle service options** — a single service (e.g. "Full Detail") can carry different price, duration, and add-ons per vehicle type (sedan vs SUV vs truck…), with an owner editor to manage it.
3. **Recurring bookings** — Google-Calendar-style repeats ("first Monday of every month", "the 15th monthly", "every 2 weeks"), set by either the owner or the customer.

### Existing system (context)

- Booking config lives in `sites.scheduler_config` (jsonb) + `sites.scheduler_enabled`, keyed by `site_id`.
- Public booking is `public/scheduler.js` — a widget injected into a published site that renders a floating "Book Now" button + multi-step modal (service → date/time → details → confirm). It fetches config via `/.netlify/functions/scheduler-config` and slots via `scheduler-slots`, and submits via `create-booking`.
- Published sites get their own subdomain `slug.autocaregeniushub.com` (Cloudflare R2 + Worker) plus optional custom domains.
- `bookings` table records customer + vehicle (`vehicle_size` ∈ sedan/suv/truck/van/other) + `preferred_at` + service snapshot (`service_id`, `service_name`, `service_price_cents`, `addons` jsonb, `total_cents`) + deposit/payment fields. RLS: anon can INSERT when `can_book_site()` is true; owner/admin can SELECT/UPDATE.

---

## Feature 1 — Standalone Booking Service

### Goal
A booking-only account (no website) that publishes a single full-page booking experience to its own subdomain/slug, reusing the existing publish pipeline.

### Domain / URL model
Same structure as websites:
- **Has a website:** booking lives under the existing subdomain at the `/book` path → `slug.autocaregeniushub.com/book` (the floating "Book Now" button on the site keeps working).
- **Booking-only (no website):** owner sets up a subdomain/slug through the same publish flow; the subdomain **root** is the booking page → `slug.autocaregeniushub.com`.
- Custom domains supported identically to sites (e.g. `book.joesdetailing.com`).

### Data model
- A booking-only account is a lightweight `sites` row — **reuse existing infrastructure** (scheduler_config, bookings.site_id FK, can_book_site RLS, custom domains). No parallel system.
- `sites` gets a `site_type text not null default 'website'` column with values `'website'` | `'booking_only'`. Booking-only rows skip website content generation.

### Standalone full-page booking experience
- `public/scheduler.js` gains a **full-page mode** (renders the whole flow as the page body, not a floating button + modal). Reuses the same step logic.
- The published artifact:
  - **Booking-only:** publish the booking page as the subdomain root `index.html`.
  - **Website + booking:** also publish a `book/index.html` (served at `/book`) alongside the site.
- Two page styles, owner-selectable: **Minimal** (centered Calendly-style card) and **Branded** (hero banner with business name + tagline, then the flow). Mobile-first.

### Appearance / theming (booking page has its own theme since there may be no website)
Stored in `scheduler_config.appearance`:
- `page_style`: `'minimal'` | `'branded'`
- `accent_color`: hex string — **full color picker with hex input**, preset swatches as shortcuts
- `background`: `'light'` | `'dark'` | `'image'` (+ `background_image_url`)
- `corner_style`: `'sharp'` | `'rounded'`
- `font`: from a small curated list
- `logo_url`, `tagline`

### Booking-only setup flow
Short setup screen for new booking-only users:
- Business name → auto-generated editable slug (reuse `generateSlug`)
- Logo (optional), accent color, tagline (optional), page style
- Then existing config: services & prices, weekly availability, deposit %, lead time, cancellation policy
- Dashboard surfaces the **shareable link + Copy + QR code** (qrcode.react already a dependency).

### Onboarding entry point
At signup/dashboard, the user chooses what they want: **Website**, **Booking page**, or **both**. Booking-only routes into the short setup above and skips the website wizard.

### Subscription gating
Booking remains behind the existing subscribe gate (`SubscribeGate` / `subscriptionGating.js`); booking-only accounts use the same gating.

---

## Feature 2 — Per-Vehicle Service Options

### Goal
Let a service vary **price + duration + which add-ons** per vehicle type, editable by the owner.

### Vehicle types (owner-customizable, seeded with defaults)
New `scheduler_config.vehicle_types`: ordered list, each `{ id, name, enabled }`. Seeded defaults: **Sedan, SUV/Crossover, Truck, Van/Minivan, Motorcycle, Other**. Owner can rename, add, remove, reorder. The editor's columns are driven by this list.

### Service shape (extended)
Each `scheduler_config.services[]` entry gains per-vehicle variants:
```
{
  id, name, description, enabled,
  variants: {                       // keyed by vehicle_type id
    <vehicleTypeId>: { enabled, price_cents, duration_minutes }
  },
  addons: [
    { id, name, enabled,
      prices: { <vehicleTypeId>: price_cents | null } }  // null/absent = not offered for that vehicle
  ]
}
```
- **Backward compatibility:** existing services keep `price`/`price_cents`/`duration_minutes` as a fallback. `normalizeService()` (in `schedulerConfig.js`) backfills a single all-vehicles variant from legacy fields so old configs keep working. Old add-ons (`{id,name,price_cents}`) map to a flat `prices` across enabled vehicles.

### Owner editor (extends `ServicesTab.jsx`)
Per service:
- A **pricing & time table**: row per vehicle type with an "offer this?" toggle, price, and duration.
- An **add-ons table**: row per add-on, a price cell per vehicle type; blank = not offered for that vehicle (e.g. "Bed liner — truck only").
- A separate **Vehicle Types** editor (rename/add/remove/reorder).

### Customer booking flow (updated step order)
`service → vehicle type → add-ons → date/time → details → confirm`
- Service list shows "from $X" (lowest enabled variant).
- Picking the vehicle type resolves the correct price, duration, and available add-ons.
- The resolved **duration drives slot availability** (`scheduler-slots`).

### Booking snapshot
`bookings` gains `vehicle_type_id` + `vehicle_type_name` and `duration_minutes` snapshots (alongside existing `service_price_cents`, `addons`, `total_cents`). The existing `vehicle_size` column is retained/derived for back-compat.

---

## Feature 3 — Recurring Bookings

### Goal
Standing appointments that auto-repeat, settable by **both owner and customer**.

### Model: recurrence rule + individual occurrences
- New table **`booking_series`** holds the rule and the shared booking template.
- Each upcoming visit is a **real `bookings` row** linked via `series_id` — so it shows on the calendar, has its own status, deposit/payment, and can be **rescheduled / skipped / cancelled individually** without ending the series.

### `booking_series` columns
- `id`, `site_id` (FK sites), `owner_user_id` (FK auth.users)
- Customer snapshot (name/email/phone) — optionally link to a customer profile
- Service + vehicle snapshot: `service_id`, `service_name`, `vehicle_type_id`, `vehicle_type_name`, `service_price_cents`, `addons` jsonb, `total_cents`, `duration_minutes`
- Recurrence (structured): `freq` ∈ `'weekly'|'monthly'`, `interval` (every N), `byweekday` (for weekly + for "Nth weekday" monthly), `bymonthday` (monthly-by-date), `bysetpos` (1/2/3/4/-1 for first…last weekday), `time_of_day`, `start_date`, end condition: `count` | `until` | none (never)
- `status` ∈ `'active'|'paused'|'ended'`
- `created_by` ∈ `'owner'|'customer'`
- deposit settings, timestamps

### Patterns supported
- **Weekly** — every N weeks on a chosen weekday
- **Monthly by date** — e.g. the 15th of every month
- **Monthly by weekday position** — first / second / third / fourth / last <weekday>
- **End:** never · after N occurrences · until a date
(Daily/yearly out of scope — not needed for this domain.)

### Occurrence materialization
- A **scheduled Netlify function** (same pattern as `send-booking-reminder` / `domain-sweep`) maintains a rolling window: materialize occurrences for the next ~90 days, always keeping at least the next 3 occurrences as `bookings` rows.
- Each occurrence row: `series_id`, `status` defaults to `'pending'` (customer-initiated) or `'confirmed'` (owner-created, configurable), with deposit handled per visit via existing logic.
- **Conflict handling:** if an occurrence lands on a blocked/full day, it is created with a flagged status (e.g. `needs_attention`) for the owner to reschedule — never silent double-booking.

### Owner UI
- In booking detail / `BookCustomerModal`, a **"Repeat"** control with a Google-Calendar-style recurrence picker.
- Calendar (`BookingsCalendar`) shows a **🔁 repeats** marker on occurrences; a series view lists upcoming visits with skip/reschedule/cancel and "cancel series".

### Customer UI
- On the public booking page, a **"Repeat this booking"** toggle after service/vehicle selection, with simplified pattern choices (weekly / monthly). Customer-initiated series occurrences default to `pending` (owner confirms), matching current one-off behavior.

### Data model changes summary
- `bookings`: add `series_id uuid` (nullable, FK booking_series, on delete set null), `occurrence_index int`, occurrence status extension for `needs_attention`.
- new `booking_series` table with RLS mirroring `bookings`: anon INSERT allowed when `can_book_site()` (customer-initiated); owner/admin SELECT/UPDATE; a SECURITY DEFINER helper for the scheduled materializer to create occurrence rows.

---

## Migrations (follow `db/migrations/YYYYMMDD_*.sql` convention)
1. `sites.site_type` column (Feature 1).
2. scheduler_config is jsonb — no column migration; shape changes handled in code via `normalizeService`/defaults (Features 1 & 2).
3. `bookings` vehicle_type snapshot + duration columns (Feature 2).
4. `booking_series` table + `bookings.series_id`/occurrence columns + RLS + materializer helper (Feature 3).

## Design-system note
All new UI (setup, appearance panel, service editor tables, recurrence picker, standalone booking page) must use existing tokens in `src/design-tokens.js` and reuse existing `src/components/ui` components. No hardcoded colors/radii/fonts. The standalone booking page (rendered by `scheduler.js`, outside React) mirrors token values explicitly and is driven by `scheduler_config.appearance`.

## Out of scope (YAGNI)
- Daily/yearly recurrence.
- Multi-staff/resource scheduling.
- Customer self-serve login to manage their own series (owner manages; customer gets confirmation emails).
- Migrating existing one-off bookings into series.

## Open items to confirm during review
- `/book` as the exact path for website+booking users (vs. another word).
- Default occurrence status for **owner-created** series: `confirmed` vs `pending`.
- Materialization window length (proposed 90 days / min 3 ahead).
