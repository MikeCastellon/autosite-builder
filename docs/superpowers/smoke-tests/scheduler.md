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
