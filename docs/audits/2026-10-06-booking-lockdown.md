# Booking lockdown: analysis and fixes

**Date:** 2026-10-06 (production read on 2026-10-05) · **Branch:** fix/booking-lockdown
**Scope:** booking as a standalone page (booking-only accounts) and as the widget embedded in published websites, from the public widget through the Netlify functions to the owner dashboard, emails, deposits and the database rules.

Production was only read: SELECT queries, and GET requests to public pages and to `scheduler-config`. No booking, beacon or database write was sent. Everything that writes was tested locally against an in-memory database.

## Summary

Four problems were hurting live sites:

1. **Every standalone booking page was dead.** All 5 booking-only pages show "Loading booking…" forever. Their owners never subscribed, `scheduler-config` answers `{enabled:false}`, and the page never took the loading text down. The setup screen had still told each owner "Your booking page is live 🎉". Each new page also starts with no services, so it couldn't take bookings even for a Pro owner.
2. **A lapsed shop's widget accepted bookings it then refused.** Zwitch Wash's 7-day payment grace ended 2026-10-05 02:03 UTC. `scheduler-config` and `scheduler-slots` didn't select `stripe_first_failed_payment_at`, so they still offered slots. `create-booking` did select it and refused every booking at the last step. The dashboard (same missing column) kept showing Pro. This was GT-EX-1 in the 2026-10-02 audit, still open.
3. **Morning slots were hidden.** Lead time was measured against the real UTC instant, but slots are the shop's wall clock written as UTC. Every Florida and Puerto Rico shop (all of them today) lost the first ~4 hours of slots after the lead-time boundary: with the default 24 h, booking at 9 AM hid tomorrow before 1 PM. Same-day booking with a short lead time was impossible.
4. **A slow Book Now button.** Booking Settings stored uploaded logos as base64 in `scheduler_config.logo_url`, and the widget config is fetched uncached on every page view before the button appears. It measured 377 KB for zwitch-wash and 413 KB for titos-car-wash. centenno, eli and the demo shops are about the same size.

All four are fixed in code. The fixes also close several security holes and correctness bugs (the table below). No database migration is needed.

## How booking works

- **Embedded:** each published page loads `scheduler.js` (from sitebuilder.autocaregenius.com, `max-age=0`). The widget calls `scheduler-config`, mounts the floating Book Now button and binds the page's Book links (`data-scheduler-trigger`, `#book`, `#book=<service>`). The flow is service, then vehicle type, then add-ons, then date (`scheduler-slots`), then details, then `create-booking`. That sends the emails and, with deposits on, a Stripe Checkout redirect.
- **Standalone:** a booking-only site's root page is the `bookingPageHtml.js` shell, which loads `scheduler.js` with `data-full-page`: the same flow, as a page.
- **Owner:** the dashboard's Bookings page confirms, declines, cancels or completes bookings (`update-booking`) and books customers by hand (`owner-create-booking`). The Stripe webhook marks deposits paid.
- **Database:** RLS is on for every table. Since 2026-10-03, bookings are only written by the functions (service role), and owners can only update `owner_notes`. This was verified live.

## Production state (2026-10-05)

| | Count | Notes |
|---|---|---|
| Sites with booking on | 23 rows | 21 published |
| Booking-only pages | 5 | All owners on `inactive`; 0 services each; all showed "Loading booking…" |
| Paying customers with booking | og-detailing (20% deposits, Connect ready), obsidian-auto-spa, flow-auto-detail, titos (admin) | zwitch-wash is past due, grace over |
| Bookings | 224 total, 16 owner-created, 4 with deposits | Widget bookings are rare since May (9 rate-limit rows) |
| Shop locations | All FL or PR | Never a stored time zone |

## Findings and fixes

Severity: **P0** = broken for real users now, **S** = security or abuse, **C** = correctness, **U** = UX or honesty.

| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| 1 | P0 | scheduler.js | Booking page stuck on "Loading booking…" when booking is off or the config call fails | Shows "Online booking is unavailable" (customers) or what to fix (owner preview) |
| 2 | P0 | booking-only setup, Booking Settings | Non-Pro owners were told the page was live; Settings said "Bookings are live"; Preview did nothing | Setup says "set up" with the steps left and an Upgrade button. Settings shows "Bookings are not live yet" with "Upgrade to go live". Preview explains why |
| 3 | P0 | scheduler-config, scheduler-slots, AuthContext | Gate didn't read the failure date: lapsed Stripe owners kept the widget (and Pro in the dashboard) while create-booking refused | Shared `GATING_PROFILE_COLUMNS`; a test fails if any gating function leaves the column out |
| 4 | P0 | slots, create-booking, validation, widget | Lead time and "today" in UTC instead of shop time | `src/lib/shopTimeZone.js`: zone = saved choice, else business state (FL→Eastern, PR→Atlantic), else Eastern. Lead time and the calendar's "today" use the shop's clock |
| 5 | P0 | scheduler-payload, GeneralTab | 400 KB+ base64 logos in every config response | Payload drops inline logos over 48 KB (falls back to the site logo URL or the initial). New uploads go to Storage |
| 6 | P0 | scheduler.js | Pages with nothing bookable (no hours, or no service for any vehicle type) opened a dead-end picker | Server sends `bookable`. Websites keep their own Book links; booking pages say "not open yet"; shared `#book` links get an answer |
| 7 | S | create-booking | Rate limit keyed on the first X-Forwarded-For entry, which the client writes: one header per request bypassed it. Each booking emails the address typed, so this was an email relay | `clientIp()` reads Netlify's `x-nf-client-connection-ip`. Added caps of 20/h per IP across sites and 5/h per recipient email (stored hashed). Three other functions have the same issue (see "Not fixed here", item 7) |
| 8 | S | create-booking | `is_simple_request: true` from the client skipped the slot, hours and lead-time checks on any site | The site's saved mode decides; a stale request form gets "please reload" |
| 9 | S | booking-validation | No length or type limits: megabytes of text (or objects) could be stored and emailed | Caps per field, strings only, `addon_ids` checked, friendly messages |
| 10 | S | booking-deposit-handler | Any connected account could mark another shop's pending deposit paid with its own Checkout session (`client_reference_id` is creator-set) | Only the session create-booking stored for that booking counts (checked and part of the UPDATE) |
| 11 | S | scheduler.js, payload | Owner-written button label went into innerHTML unescaped; colors went into style attributes and inline handlers unchecked | Label escaped; colors must be hex on the server and in the widget |
| 12 | S | slot-math | A slot step of 0 or below looped forever (function timeout); malformed windows were not checked | Step clamped 5–240 (default 30); bad windows skipped |
| 13 | C | create-booking | Deposit redirect used `APP_URL` (.env.example has app.autocaregenius.com, which has no DNS); the "confirmed" page claimed the appointment was confirmed | Stripe returns customers to the shop's own page (`?acg_deposit=paid/cancelled`), which shows an honest result ("Deposit received, the shop will confirm") |
| 14 | C | create-booking | Customer redirected to pay even if the session id couldn't be saved, so the payment could never be matched | No redirect unless the session is recorded |
| 15 | C | request form (simple mode) | Owner email showed a fake time 7 days out; confirming emailed the customer that fake time; declines named it too | Customer's words sent separately and stored first in notes; owner email shows them; confirming such a booking requires picking the real time (drawer time picker); declines and cancels name the request |
| 16 | C | update-booking | Confirming could silently double-book a slot; two concurrent actions could both apply | Overlap check with "Confirm anyway"; transitions apply only from the status that was read (409 otherwise) |
| 17 | C | owner-create-booking, BookCustomerModal | Blank vehicle year hit the NOT NULL column: bare "Failed to create booking". Email said "we'll confirm" for an already-confirmed booking | Year required with a clear message; email says "You're booked"; service name taken from the menu |
| 18 | U | scheduler.js | Slot requests could answer out of order (wrong day's times); a failed request left "Loading…" forever; double fetch per click | Newest request wins; error with "Try again"; one fetch |
| 19 | U | scheduler.js | `novalidate` forms sent empty fields to the server; errors were field names | Checks before sending, names and focuses the field; "Pick another time" when a slot was just taken |
| 20 | U | scheduler.js | No focus management; Escape listeners piled up | Focus moves into the dialog and back to the button; listener removed on every close |
| 21 | U | AvailabilityTab | A day closing before it opens saved silently (no slots) | Refused with a message; time zone picker added |
| 22 | U | Bookings list, calendar, drawer | Request-form bookings showed the placeholder time | Shown as "Time to arrange" / "Request" / "Not set yet (asked for: …)" |
| 23 | U | Help articles | Claimed "reschedule" exists and that the time zone was automatic | Corrected |

## How it was verified

- **Unit tests:** 6 new test files (`booking-lockdown`, `shop-time`, `scheduler-payload-lockdown`, `booking-emails` and the `bookingFakes` in-memory database) plus updates to 4 existing ones. Full suite 2,248 / 2,248, `npm run theme:check` 717 / 717, `vite build` OK, all in a mirror built from HEAD plus these files.
- **Mutation checks:** putting back the old gate select, the X-Forwarded-For IP or the UTC lead time each makes the new tests fail.
- **Browser, real widget and real functions** (local harness, in-memory database): standalone page (Pro, unsubscribed, no services), full flow with SUV pricing, add-on and total ($180 + $35 = $215) stored correctly, out-of-order slot responses, slot errors and retry, form checks, request form, lapsed and no-hours sites (no button, links keep their href), shared `#book` links, deposit return (paid / cancelled), owner preview (no row created), phone width (7-column calendar, no sideways scroll).
- **Browser, dashboard components** with stubbed Supabase and sign-in: honest status for Pro and non-Pro, setup success screen, the time zone picker (a Puerto Rico shop opens on Atlantic time from a Berlin browser), confirm-with-time, overlap warning and "Confirm anyway".

## Not fixed here (needs the owner, another repo or a decision)

1. **`/book` pages are never served.** The Cloudflare Worker (another repo) serves `{slug}/index.html` for every path, so `/book` on websites is the homepage. This is gap-3 in the 2026-09-27 audit. Share links use `/book#book`, which opens the modal on the homepage, so links still work.
2. **Check `APP_URL` in Netlify.** If it is `https://app.autocaregenius.com` (no DNS record), the subscription checkout and billing-portal return pages are dead. Deposits no longer use it.
3. **Logos to re-upload:** titos-car-wash, zwitch-wash, centenno, eli-auto-detailing and the demo shops have 400 KB base64 booking logos. The widget now ignores them. Re-upload through Booking Settings (now Storage), or ask for a one-time move to Storage (a database write, needs approval).
4. **Sites needing a republish from production:** top-choice-mobile-detailing still loads its widgets from deploy-preview-10. flow-auto-detail (active Pro) has a live page from before `scheduler.js` was added, so customers see no booking at all.
5. **The 5 booking-only owners** now see an honest "unavailable" page. They may want a nudge to subscribe and add services (not emailed: owner's call).
6. **Optional database hardening** (needs approval): `revoke delete, truncate, trigger, references on public.bookings from anon, authenticated;` (RLS already blocks deletes; this removes the grant) and drop the unused `can_book_site()`.
7. **Same spoofable-IP rate limit** in `create-inquiry`, `support-book` and `custom-site-form` (owned by another session): switch them to `clientIp()`.
8. **The app's `/booking-confirmed` page** still says "your appointment is confirmed". Only sites without a public address reach it now. `App.jsx` has another session's uncommitted edits, so it was left alone.
9. **Feature gaps:** a general reschedule action, blocked days and vacations, a maximum booking window, in-app deposit refunds, recurring bookings (spec Feature 3, not built). Request-form bookings are recognised by the "Preferred time: " first line of their notes. A dedicated column would be cleaner (migration, needs approval).

## Deploy notes

- No migration. Functions, widget and dashboard ship together; `scheduler.js` is served `max-age=0`, so visitors get it on their next page load.
- **What customers will notice:** FL and PR shops show the morning slots that were hidden (for example 9 AM tomorrow when booking at 9 AM today). A request form left open across the deploy is asked to reload if the owner switched modes.
- **Dashboard tabs opened before the deploy:** confirming a request-form booking or an overlapping booking is refused with a "reload the page" message.

## Files

Functions: `create-booking.js`, `update-booking.js`, `owner-create-booking.js`, `scheduler-config.js`, `scheduler-slots.js`, `_lib/{booking-validation, booking-deposit-handler, booking-request (new), postmark (booking emails), scheduler-payload, shop-time (new), slot-math, subscription-gating}.js`, `_shared/rateLimit.js`.
Widget: `public/scheduler.js`.
App: `src/lib/{AuthContext.jsx, bookings.js, shopTimeZone.js (new)}`; `src/components/dashboard/{booking-only/BookingOnlySetup, booking-settings/{SchedulerSettings, AvailabilityTab, GeneralTab}, bookings/{BookingDetailDrawer, BookingsList, BookingsCalendar}, customers-page/BookCustomerModal(.test)}.jsx`; `src/components/help/articles.js`.
Tests: `tests/functions/{booking-lockdown, shop-time, scheduler-payload-lockdown, booking-emails}.test.js`, `tests/functions/bookingFakes.js` (new); `booking-validation`, `booking-deposit-handler`, `booking-time-basis` (updated).
