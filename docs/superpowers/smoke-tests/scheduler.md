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
