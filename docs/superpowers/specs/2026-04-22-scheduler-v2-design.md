# Scheduler v2 — Calendly-style + Owner-Managed Settings

**Date:** 2026-04-22
**Status:** Approved, ready for implementation plan
**Builds on:** [2026-04-22-scheduler-mvp-design.md](2026-04-22-scheduler-mvp-design.md)

## Summary

Replace the v1 single-form booking modal with a Calendly-style multi-step flow (service → date+time → details → confirm), gate it behind an owner-controlled per-site toggle, and give the owner a Booking Settings panel to configure services, availability, welcome text, and a live preview — no republish needed to see changes.

Services are auto-pulled from the site's existing `business_info.services` the first time the feature is enabled, then curated independently per site.

Stays request-based (bookings land as `pending`, owner confirms) but shows only confirmed bookings as busy to avoid overbooking.

## Goals

- Replace the basic form with a Calendly-like stepped flow that feels modern.
- Let owners turn the feature on/off per site without admin involvement.
- Let owners configure hours, services, and welcome copy in a dedicated Settings panel.
- Let owners test the widget in-dashboard without publishing.
- Reduce double-bookings by hiding confirmed slots from future customers.

## Non-goals

- Blocked specific dates (vacation) — add as a follow-up.
- Multi-shift availability (two time windows per day) — schema supports it, UI later.
- Instant-confirm mode — still request-based.
- Per-service brand color / full theming — later.
- Customer account / rescheduling portal.
- Payment at booking.

## Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Approval model | Stay request-based (pending → owner confirms) |
| 2 | Slot exclusivity | Pending does NOT lock; confirmed DOES. Confirmed slots hidden from future customers. |
| 3 | Service source | Auto-pull from `sites.business_info.services` on first enable, then curated per site. Re-sync button pulls again on demand. |
| 4 | Service shape | `{id, name, duration_minutes, price, enabled}`. Default duration 60min when auto-pulled. |
| 5 | Slot granularity | 30-min start-time steps (configurable; default 30). |
| 6 | Availability | Weekly hours, one start/end per day. Empty = closed. |
| 7 | Lead time | Default 24 hours minimum. Configurable per site. |
| 8 | Single-service skip | If only 1 enabled service, skip the service picker step. |
| 9 | Per-site toggle | New `sites.scheduler_enabled` column, owner-controlled. |
| 10 | Feature gating | `profiles.scheduler_enabled` (admin unlock) AND `sites.scheduler_enabled` (owner on/off) both required. |
| 11 | Live preview | Widget rendered in Settings panel, reads the same config endpoint. |
| 12 | Customization | MVP: welcome text + button label. Field customization deferred. |

## Data model changes

### `sites` table — add two columns

```sql
alter table public.sites add column if not exists scheduler_enabled boolean not null default false;
alter table public.sites add column if not exists scheduler_config  jsonb   not null default '{}'::jsonb;
```

### Shape of `scheduler_config`

```jsonc
{
  "welcome_text": "Tell us about your car and we'll be in touch.",
  "button_label": "Book Now",
  "lead_time_hours": 24,
  "slot_granularity_minutes": 30,
  "services": [
    {
      "id": "<uuid>",
      "name": "Full Detail",
      "duration_minutes": 120,
      "price": "$149",
      "description": "Full exterior wash, interior vacuum, and window clean.",
      "enabled": true
    }
  ],
  "availability": {
    "mon": [{ "start": "09:00", "end": "17:00" }],
    "tue": [{ "start": "09:00", "end": "17:00" }],
    "wed": [{ "start": "09:00", "end": "17:00" }],
    "thu": [{ "start": "09:00", "end": "17:00" }],
    "fri": [{ "start": "09:00", "end": "17:00" }],
    "sat": [],
    "sun": []
  }
}
```

- `availability[day]` is an array of windows (to allow future multi-shift support). MVP UI writes one window per day or none (closed).
- Default config applied on first enable (see migration notes).

### No new tables

Service lists live inside `scheduler_config.services` — no separate `services` table. Keeps joins simple; services are site-scoped anyway.

### `bookings` table — add two columns

```sql
alter table public.bookings add column if not exists service_id  text;     -- FK-in-spirit to scheduler_config.services[].id
alter table public.bookings add column if not exists service_name text;   -- denormalized at booking time so historical bookings survive service deletion
```

## Customer flow — Calendly-style

The widget opens as a full-height modal (same container as v1). Internally, a 4-step state machine.

### Step 1 — Service picker

- Shown only when `services.filter(s => s.enabled).length > 1`.
- List of service cards: name, duration ("2 hours"), price.
- Click a card → proceeds to Step 2 with service selected.
- Single-service case: widget auto-selects and skips to Step 2.

### Step 2 — Date + time

- **Left:** month calendar. Unavailable days grayed out and unclickable:
  - days where `availability[weekday]` is empty (closed)
  - days before `today + lead_time_hours`
- Click a day → fetches available time-slot start times from `scheduler-slots` function → renders as chips on the right.
- **Right:** vertical list of time chips. Click one → proceeds to Step 3.
- Back button returns to Step 1 (or dismisses if skipped).

### Step 3 — Details

- Form fields identical to v1 (name, email, phone, vehicle make/model/year/size, service address, notes, referral source) minus the date/time inputs (they're already picked).
- Submit → POST `/.netlify/functions/create-booking` with `{ ...v1 fields, service_id }`.
- Back button returns to Step 2.

### Step 4 — Confirm

- Shows summary: service, date, time, customer's name/email.
- On success of Step 3 submission, replaces the form with this panel showing "Request submitted — <BusinessName> will email you to confirm within 24 hours."

### States & back behavior

- Linear progression with breadcrumb showing Step N of 3 (or N of 2 for single-service).
- Back/forward preserves state (don't reset fields).
- Escape + overlay click close modal with confirmation if on step 3/4 and fields are dirty.

## Owner dashboard changes

### Site card (in Dashboard → Sites)

New row below existing actions:
- **Bookings toggle** (shown only if `profile.scheduler_enabled`):
  - OFF state: "Bookings: Off · Enable" button → flips `sites.scheduler_enabled = true`. On first enable, runs the config seed (auto-pull services from `business_info.services`, apply default availability + welcome text).
  - ON state: "Bookings: On · Settings" link → opens Booking Settings panel.

### Booking Settings panel

Full-page view (not a modal — lots of content). Reached by clicking "Settings" next to an enabled site. Four tabs:

**1. General**
- Welcome text (textarea)
- Button label (input, default "Book Now")
- Minimum notice (input + "hours" suffix)
- Save button

**2. Services**
- Table of services with columns: enabled checkbox, name, duration, price, actions (edit, remove)
- "Add service" button opens inline form (name, duration, price, description)
- "Re-sync from site's services" button: pulls current `business_info.services` and merges — existing services with matching names are left alone; new ones added; owner-only services unaffected.

**3. Availability**
- 7-row grid (Mon–Sun), each row:
  - Closed toggle
  - Start time input (native time picker)
  - End time input
- Save button saves to `scheduler_config.availability`.

**4. Preview**
- Renders the widget inline using the same `scheduler.js` code path, pointing at the current site's config.
- Implementation: mount `scheduler.js` inside a container div with `data-site-id="<current>"` and a `data-preview-mode="true"` attribute (widget skips the fixed-position button styling and renders the modal inline). Widget calls the real `scheduler-config` endpoint so any unsaved changes in other tabs appear after Save.

### Admin panel

No changes required. Super admin still controls `profiles.scheduler_enabled` per user. The new site-level toggle is owner-controlled.

## Backend changes

### `scheduler-config.js` — updated response

Now returns the full config (but ONLY when BOTH flags true):

```jsonc
{
  "enabled": true,
  "businessName": "Centenno Detailing",
  "brandColor": "#b8860b",
  "welcome_text": "...",
  "button_label": "Book Now",
  "lead_time_hours": 24,
  "services": [...],            // only enabled services
  "availability": { ... }
}
```

`enabled: false` if `profiles.scheduler_enabled=false` OR `sites.scheduler_enabled=false` OR site not found.

### `scheduler-slots.js` — new function

```
GET /.netlify/functions/scheduler-slots?siteId=<uuid>&date=<YYYY-MM-DD>&serviceId=<id>
```

- Validates the site exists, scheduler is enabled, the date is not before `today + lead_time_hours`.
- Reads `availability[weekday]` windows.
- Pulls all `confirmed` bookings for that day from the DB.
- Returns a list of slot start times (ISO strings): every `slot_granularity_minutes` step within each availability window where a booking of `duration_minutes` length starting there wouldn't overlap with any confirmed booking's occupied range.
- No auth required (like `scheduler-config`).
- Cache: `Cache-Control: public, max-age=30` — short because confirmed bookings shift it.

### `create-booking.js` — validation hardening

- Require `service_id` when the site has more than 1 enabled service. Reject unknown IDs.
- Look up the selected service's `duration_minutes` from the site's config.
- Re-validate the chosen `preferred_at`:
  - Is within an availability window for its weekday.
  - Is >= `now + lead_time_hours`.
  - Does not overlap a `confirmed` booking (compare `[preferred_at, preferred_at + duration]` vs. existing confirmed ranges).
- If overlap → 409 Conflict "That time is no longer available. Please pick another."
- Save `service_id` + `service_name` (denormalized) on the booking row.

### `update-booking.js` — no functional changes, but:

- On `confirm` action, check again for slot overlap with other confirmed bookings at the same time. If conflict (race), return 409.

## Widget implementation

- Rewrite `public/scheduler.js` as a small state machine. Still vanilla JS, still ~15–20 KB gzipped target.
- Accept `data-preview-mode="true"` attribute to render inline instead of fixed-position button.
- Reuse HTML templates from v1 for Step 3 form fields — keeps the diff smaller.
- Calendar grid: plain CSS grid, no date lib required for customer-facing (we can hand-roll a tiny month-grid).

## Migration path for existing data

v1 bookings already in the DB pre-date this change. They have no `service_id` / `service_name`. Leave them as `null` — the dashboard drawer should show "Booking before services were enabled" fallback text when those are missing.

For existing `sites` rows, after the migration:
- `scheduler_enabled = false` (everyone starts off, opt-in)
- `scheduler_config = '{}'` — seeded on first enable via the dashboard toggle

## Error handling

| Scenario | Behavior |
|---|---|
| Owner has `scheduler_enabled=false` at profile level | Site-level toggle is hidden entirely (even if they flip the site-level to true, widget stays silent) |
| `scheduler-slots` returns no slots for a day | Day is clickable but right panel shows "No times available — try another day" |
| Service was deleted between customer picking it and submitting | `create-booking` returns 400 "Service no longer available"; modal shows error and sends user back to Step 1 |
| Confirmed booking race (two customers confirm same slot) | Second one gets 409 on `create-booking`; modal shows "That time was just taken. Please pick another." |

## Testing plan

### Automated
- **Vitest** unit tests for the slot-computation function (given availability + duration + existing confirmed bookings → expected slots).
- Extend v1 tests — no new ones on validation since the shape is mostly same.

### Manual
- Owner: toggle bookings on for a site → services auto-seed → edit availability → open Preview tab → see widget with new hours.
- Customer: full flow on published site: service → date → slot → details → submit.
- Race: open booking modal in two browsers, confirm one in dashboard while other's slot-list is open → verify second sees "not available" on submit.

## Env vars / setup

No new env vars. Uses the Postmark + Supabase env from v1.

## Build order

1. Migration: add `scheduler_enabled` + `scheduler_config` to `sites`; add `service_id` + `service_name` to `bookings`.
2. Default config generator + auto-seed helper (server-side, runs when site-level toggle is first flipped on).
3. Update `scheduler-config` to return full config.
4. Write `scheduler-slots` function (with unit tests for the slot math).
5. Harden `create-booking` with slot validation.
6. Site card: toggle + "Bookings: On/Off" UI + seed-on-enable wiring.
7. Settings panel: General tab.
8. Settings panel: Services tab + re-sync.
9. Settings panel: Availability tab.
10. Rewrite `scheduler.js` as multi-step state machine (service → date/time → details → confirm).
11. Settings panel: Preview tab (reuses the widget with `data-preview-mode`).
12. Smoke test doc update.

## Open items for later

- Block-specific-dates (vacation calendar)
- Multi-shift per day
- Instant-confirm mode as an option
- Automatic cleanup of pending requests for slots that got confirmed-elsewhere (auto-decline with "that time filled")
- SMS notifications
- Service images / icons
