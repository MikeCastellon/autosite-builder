# Contact / Inquiry Form — Design Spec

**Date:** 2026-06-04
**Status:** Approved, ready for implementation planning

## Goal

Add a general contact / inquiry form to published sites so site owners can
capture leads **separately from bookings**. Submissions are stored and viewed
in a new **Inquiries** tab in the owner dashboard. **No emails are sent.**

The feature mirrors the existing booking architecture (anonymous Netlify
function → Supabase table with RLS, rate limiting, and honeypot → dashboard
view) but is simpler and is **free for all published sites** (no
subscription/scheduler gating).

## Decisions (locked)

- **Form placement on site:** injected into the template's existing `#contact`
  section by a self-contained widget script.
- **Availability:** free for every published site. No subscription or
  `scheduler_enabled`-style gating.
- **Fields:** Name, Email, Phone (optional), Message.
- **Dashboard depth:** list + detail drawer with read/unread + archive, plus
  owner notes. Three statuses: `new`, `read`, `archived` (no full CRM pipeline).
- **Widget is config-less:** no extra config fetch at load time (it's free for
  all, so there's nothing to check). Trade-off accepted: adding a per-site
  on/off toggle later would require introducing a config check.
- **Inquiries nav visible to all** authenticated users — NOT gated by
  `canSeeBookingsNav`.

## Architecture

```
Published static site (R2)
  └─ <script src="/contact-form.js" data-site-id data-accent defer>
        └─ injects form into #contact section (mirrors scheduler.js)
              │  POST { siteId, name, email, phone, message, website(honeypot) }
              ▼
  /.netlify/functions/create-inquiry  (anonymous)
        - CORS wide-open (_shared/cors.js)
        - rate limit (_shared/rateLimit.js, kind create-inquiry:<siteId>)
        - honeypot `website` → silent 200
        - validate (_lib/inquiry-validation.js)
        - look up site → owner_user_id = sites.user_id
        - insert via service role
              ▼
  inquiries table (RLS: owner/admin read+update own; super-admin all)
              ▲
              │ supabase-js (authenticated)
  Dashboard "Inquiries" tab
        - src/lib/inquiries.js (list/update/notes)
        - InquiriesPage → InquiriesView → InquiriesList + InquiryDetailDrawer
```

## Components

### 1. Database — `inquiries` table

New migration under `db/migrations/` (dated convention, e.g.
`20260604_inquiries.sql`).

```sql
create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived')),
  owner_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_owner_status_created_idx
  on inquiries (owner_user_id, status, created_at desc);
create index if not exists inquiries_site_created_idx
  on inquiries (site_id, created_at desc);
```

**RLS** (mirror `bookings` policies):
- Authenticated owner or super-admin: SELECT + UPDATE their own rows
  (`owner_user_id = auth.uid()` or `is_super_admin`).
- Super-admin: read/update all.
- Defense-in-depth anon INSERT policy gated only by "site exists" — a
  `can_inquire_site(site_id)` SQL function that checks the site row exists.
  This deliberately omits the scheduler/subscription checks that
  `can_book_site()` performs. (Inserts in practice go through the function's
  service role, which bypasses RLS — the policy is belt-and-suspenders.)
- Add an `updated_at` trigger if the project uses one for `bookings`;
  otherwise set `updated_at` explicitly on update.

### 2. Netlify function — `create-inquiry.js`

Anonymous POST. Mirror `create-booking.js` structure:

- Wide-open CORS via `_shared/cors.js`.
- Rate limit via `_shared/rateLimit.js`: `kind: create-inquiry:${siteId}`,
  `windowMs: 60*60*1000`, `limit: 5`. Fail open if DB unavailable.
- Honeypot: hidden field `website`. If non-empty → return 200 OK and do
  nothing (silent reject).
- Validate via new `_lib/inquiry-validation.js`:
  - `siteId` — required, UUID format.
  - `name` — required, non-empty, max ~200 chars.
  - `email` — required, email regex (reuse booking's regex).
  - `phone` — optional, max ~40 chars when present.
  - `message` — required, non-empty, max ~5000 chars.
- Look up the site by `siteId`; require it to exist. Derive
  `owner_user_id = sites.user_id`. **No subscription/scheduler gating.**
- Insert the row using the Supabase service role.
- Return `{ ok: true }` on success.
- **No Postmark / email call.**
- Status codes: 400 validation error, 200 honeypot, 429 rate-limited (or
  fail-open), 404/400 unknown site, 500 db error.

### 3. Site widget — `public/contact-form.js`

Self-contained vanilla-JS script mirroring `public/scheduler.js`:

- Reads `data-site-id` and `data-accent` from its own `<script>` tag.
- On `DOMContentLoaded` (or immediately if already loaded), finds the
  template's contact section: `document.querySelector('#contact')`. Fallback:
  if not found, append a new `<section>` before the last `<footer>` (or at end
  of `<body>`).
- Injects a styled form into that section:
  - Fields: Name (text), Email (email), Phone (tel, optional), Message
    (textarea), hidden honeypot input named `website`.
  - Inline styles for isolation (consistent with `scheduler.js`); the accent
    color (from `data-accent`) is used for the submit button and focus ring.
  - Basic client-side validation (required fields, email shape).
- On submit: `fetch('/.netlify/functions/create-inquiry', { POST, JSON body })`
  with `{ siteId, name, email, phone, message, website }`.
  - On 200: replace the form with an inline success state
    ("Thanks — we'll be in touch.").
  - On error: show an inline error message and allow retry.
- **No config fetch** — renders unconditionally.

### 4. Export wiring — `src/lib/exportHtml.js`

- Add a `CONTACT_WIDGET_URL` constant alongside `SCHEDULER_WIDGET_URL`
  (origin + `/contact-form.js`).
- In `buildSeoHead` (next to exportHtml.js:112, the scheduler script tag),
  inject when `siteId` is present:
  ```html
  <script src="${CONTACT_WIDGET_URL}" data-site-id="${siteId}" data-accent="${accent}" defer></script>
  ```
  where `accent = templateMeta?.colors?.primary || templateMeta?.colors?.accent || '#cc0000'`
  (reuse the favicon accent resolution).
- **Note:** already-published sites get the form only on their next
  re-publish. No backfill of existing static HTML in R2.

### 5. Dashboard — Inquiries tab

Mirror the bookings dashboard, minus the calendar.

- **`src/lib/inquiries.js`:**
  - `listInquiriesForOwner({ userId, statusIn, search })` — select own,
    ordered `created_at desc`, optional status filter and ILIKE search on
    `name`/`email`.
  - `listAllInquiries({})` — admin view (all rows).
  - `updateInquiryStatus({ id, status })` — set `new`/`read`/`archived`.
  - `saveInquiryOwnerNotes({ id, notes })`.
- **Components** (under `src/components/dashboard/inquiries-page/` and
  `.../inquiries/`), modeled on the bookings equivalents:
  - `InquiriesPage.jsx` — loads sites, renders `AppHeader` with
    `active: 'inquiries'`, hosts the view.
  - `InquiriesView.jsx` — fetches via `inquiries.js` (admin vs owner), holds
    selected-row state.
  - `InquiriesList.jsx` — filter chips (New / Read / Archived / All), search
    box, unread count; rows show status pill, name, email/phone, message
    preview, received timestamp; click opens drawer.
  - `InquiryDetailDrawer.jsx` — name, email (mailto), phone (tel), full
    message, created_at, owner-notes editor (save on blur), and actions
    **Mark read / Mark unread** (toggle `read`↔`new`) and **Archive**
    (→ `archived`).
- **`src/components/ui/AppHeader.jsx`:** add a nav item
  `{ id: 'inquiries', label: 'Inquiries', onClick: onOpenInquiries }`. Visible
  to **all** authenticated users (do NOT wrap in `showBookingsNav`). Add
  `onOpenInquiries` to the prop list; render in both desktop and mobile nav.
- **`src/App.jsx`:** add a `view === 'inquiries'` branch rendering
  `InquiriesPage`, and thread `onOpenInquiries: () => setView('inquiries')`
  through the pages that render `AppHeader` (mirror how `onOpenCustomers` is
  threaded).
- **Impersonation read-only:** write actions (status changes, owner notes)
  must respect the existing impersonation read-only guard added in the recent
  commit — reuse whatever bookings uses to disable owner mutations during
  impersonation.

### Design-system compliance

- Dashboard components reuse existing tokens and components (bookings list +
  drawer styling, `AppHeader`, chips, buttons). No new one-off styles; extend
  existing patterns.
- The site widget uses inline styles for DOM isolation (same approach as
  `scheduler.js`), pulling its single accent color from `data-accent`.

## Error Handling

- Function: 400 (validation), 200 (honeypot silent), 429 (rate limit, or
  fail-open on DB error), 404/400 (unknown site), 500 (db error).
- Widget: inline error message with retry on any non-200; client-side required
  checks before submit.
- Dashboard: surface query errors inline (mirror bookings error handling).

## Testing

- **Unit:** `_lib/inquiry-validation.js` — valid payload; missing/blank name,
  email, message; bad email; bad siteId; over-length fields; phone optional.
- **Function:** `create-inquiry` — happy path inserts a row with correct
  `owner_user_id`; honeypot returns 200 without insert; rate limit triggers;
  missing fields → 400; unknown site → 404/400.
- **Dashboard lib:** `inquiries.js` list/update/notes query shapes.
- **Manual end-to-end:** publish a site → submit the contact form → row
  appears in the Inquiries tab → mark read/unread → archive → verify filters
  and unread count.

## Out of Scope (YAGNI)

- Email/SMS notifications of any kind.
- Per-site enable/disable toggle (could be added later via a config check).
- Full CRM pipeline / custom statuses beyond new/read/archived.
- Backfilling the form into already-published static HTML (owners re-publish).
- Spam filtering beyond honeypot + rate limit.
- Floating-button/modal presentation (decided: inline in `#contact`).
