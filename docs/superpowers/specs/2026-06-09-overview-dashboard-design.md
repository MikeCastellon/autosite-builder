# Overview Dashboard + View Tracking — Design Spec

**Date established:** 2026-06-09
**Status:** Approved for planning

## Overview

A new **Overview** screen becomes the default landing page after login, showing how a business's booking page (and website) is performing: booking-page views, website views, bookings, conversion, and deposits — over a selectable time range, with a views-over-time chart and recent bookings. This requires adding **view tracking**, which doesn't exist today.

Also folds in a small relocation: the booking link/QR card moves **off the Sites cards** and into the **Booking** area (Booking Settings) + the new Overview, per request ("under booking, no link on the sites").

### Existing context
- No analytics/view tracking exists. `bookings` records bookings (`created_at`, `status`, deposit fields). `request_log` is a rate-limit ledger (not analytics).
- `public/scheduler.js` is injected on **every** published page (website + booking) and already fetches `scheduler-config` on load. This is the single hook for a view beacon.
- App navigation is state-based via a `view` string in `src/App.jsx` (no router). Default is currently `'dashboard'` (the sites list, `DashboardPage.jsx`). `AppHeader.jsx` renders the nav.
- A booking-only account and the full-page booking experience exist (Feature 1, shipped). `ShareBookingCard` lives at `src/components/dashboard/booking-only/ShareBookingCard.jsx` and is currently rendered on Sites cards in `DashboardPage.jsx`.

---

## Part 1 — View tracking

### Data model: `page_views`
```sql
create table public.page_views (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('site','booking')),
  referrer_host text,
  created_at timestamptz not null default now()
);
create index page_views_site_created_idx on public.page_views (site_id, created_at desc);
create index page_views_site_kind_created_idx on public.page_views (site_id, kind, created_at desc);
```
- RLS **enabled**, with **no anon/authenticated policies**. Inserts happen only via the `track-view` function (service role, bypasses RLS). Reads happen only via the `get_overview` RPC (security definer). This keeps raw rows private.

### `track-view` Netlify function
- `POST` `{ siteId, kind, referrer }`. Public/anon CORS (`*`), like `scheduler-config`.
- Validates `siteId` is a UUID and `kind ∈ {'site','booking'}`. Parses `referrer` to a host only (`referrer_host`, no full URL — privacy). Confirms the site exists (cheap single-column lookup) to reject junk site IDs.
- Inserts one row via service role. Returns `204`.
- No PII stored (no IP, no UA, no cookies). Raw page-load counting (no de-duplication) for v1.

### `scheduler.js` beacon
- On load, if a `siteId` is present **and not in preview mode**, fire one view beacon:
  - `kind = fullPage ? 'booking' : 'site'` (full-page mode = the standalone/`/book` booking page; otherwise the website).
  - Send via `navigator.sendBeacon(API + '/.netlify/functions/track-view', blob)` where blob is JSON `{ siteId, kind, referrer: document.referrer }`. Falls back to a `fetch(..., {keepalive:true})` if `sendBeacon` is unavailable.
- Fires **independently of `scheduler.enabled`** so website views count even when the scheduler is off. Fires exactly once per page load. Owner preview loads (`data-preview-mode`) are excluded.

---

## Part 2 — Overview screen

### Placement / navigation
- `src/App.jsx`: default `view` becomes `'overview'`. Add an `if (view === 'overview') return <OverviewPage .../>` branch. The existing sites list (`DashboardPage`) stays as `view === 'dashboard'`, reached via a **"Sites"** nav item.
- `src/components/ui/AppHeader.jsx`: add **Overview** (default/home) and **Sites** nav items, wired through the existing `onOpen*` callback pattern (`onOpenOverview`, `onOpenSites`).

### `OverviewPage.jsx`
- **Time range toggle:** 7d / 30d / 90d / All (default 30d).
- **Stat cards (5):**
  - **Booking views** — `page_views` where kind='booking', in range. Delta vs previous equal-length period.
  - **Website views** — `page_views` where kind='site', in range. Delta vs previous. (Shown even if the user has no website — reads 0; copy adapts.)
  - **Bookings** — count of `bookings` created in range, with a pending/confirmed sub-line.
  - **Conversion** — bookings ÷ booking views (in range), guarded against divide-by-zero (shows "—" when 0 views).
  - **Deposits** — sum of `deposit_paid_cents` in range, with total **booked value** (sum `total_cents`) as a sub-line.
- **Views-over-time chart** — booking vs website views over the range, as a lightweight **inline SVG** stacked-bar/line component (`TrendChart.jsx`). No new charting dependency. Buckets by day (≤30d) or week (90d/All) — bucketing done in the RPC.
- **Recent bookings** — latest ~5 bookings (name · service · status pill), via a normal Supabase query (reuses existing `bookings` owner RLS).
- **Your booking link** — `ShareBookingCard` (link + Copy + QR), derived from the user's site (`published_url`, root vs `/book` by `site_type`).

### Aggregation RPC: `get_overview(p_since timestamptz, p_prev_since timestamptz)`
- `security definer`, uses `auth.uid()` to resolve the caller's site(s) and aggregates across them. Returns JSON:
  ```
  {
    booking_views, site_views,
    booking_views_prev, site_views_prev,
    bookings_total, bookings_pending, bookings_confirmed,
    deposits_cents, booked_value_cents,
    series: [{ bucket: date, booking_views, site_views }, ...]
  }
  ```
- One round-trip for all card numbers + the chart series. Recent bookings and the booking link are fetched/derived client-side (already RLS-allowed / already loaded).
- Most non-admin users have exactly one site (one-per-non-admin), so "across the caller's sites" is effectively single-site; it aggregates correctly if a user has more.

### `src/lib/overview.js`
- `loadOverview(rangeDays)` — computes `since`/`prevSince` from the range, calls the RPC, returns the parsed object. Range helper maps 7/30/90/All → dates (All → site/account creation or a far-past date).

### Booking-link relocation (small change to Feature 1)
- Remove the `ShareBookingCard` block from `DashboardPage.jsx` site cards.
- Add `ShareBookingCard` to **Booking Settings** (`SchedulerSettings.jsx`, top of the page) so the link lives "under booking."
- Also surfaced on the Overview (above).

---

## Files

**Create:**
- `db/migrations/20260609_page_views.sql` — table + indexes + RLS + `get_overview` RPC + grants
- `netlify/functions/track-view.js` — view beacon endpoint
- `netlify/functions/_lib/track-view-core.js` — pure parse/validate helper (unit-tested)
- `src/lib/overview.js` + `src/lib/overview.test.js` — range helpers (tested) + RPC loader
- `src/components/dashboard/overview/OverviewPage.jsx`
- `src/components/dashboard/overview/StatCard.jsx`
- `src/components/dashboard/overview/TrendChart.jsx`

**Modify:**
- `public/scheduler.js` — fire view beacon
- `src/App.jsx` — default view `'overview'`, new branch + nav callbacks
- `src/components/ui/AppHeader.jsx` — Overview + Sites nav items
- `src/components/dashboard/DashboardPage.jsx` — remove ShareBookingCard from site cards
- `src/components/dashboard/booking-settings/SchedulerSettings.jsx` — add ShareBookingCard

## Metrics definitions (explicit)
- **Views** = raw page loads (no unique-visitor dedup in v1).
- **Conversion** = bookings created in range ÷ booking-page views in range; `—` when views = 0.
- **Deltas** = current window vs immediately-preceding equal-length window.
- **Deposits** = `sum(deposit_paid_cents)`; **booked value** = `sum(total_cents)`.

## Testing
- Unit: `track-view-core` (siteId/kind validation, referrer→host parsing); `overview.js` range math.
- Function suite stays green. Build passes.
- Manual smoke (via `netlify dev` + seeded `page_views` rows): load a page → beacon recorded; Overview shows counts, chart, deltas; time-range toggle changes numbers.

## Out of scope (YAGNI)
- Unique visitors / sessions (needs a visitor token + privacy review).
- Bot filtering (note: raw counts include some bot traffic; revisit if noisy).
- Traffic sources / referrer breakdown UI (we store `referrer_host` for a future add).
- Real-time/live updates; export/CSV.
- Daily rollup tables (on-the-fly aggregation is fine at current scale).

## Open items to confirm during review
- Recent-bookings count (proposed 5).
- "All" range lower bound (proposed: earliest of the user's sites' `created_at`).
