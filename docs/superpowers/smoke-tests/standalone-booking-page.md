# Smoke test: standalone booking page

1. Run `npm run dev`.
2. In a scratch HTML file (or temporary route), add:
   `<script src="http://localhost:5173/scheduler.js" data-site-id="<A_BOOKING_ENABLED_SITE_ID>" data-full-page="true" defer></script>`
3. Open it. Expect: a full-page booking experience (not a floating button).
   - Branded style → hero banner with business name + tagline.
   - Minimal style → centered logo/name, then the booking card.
4. Toggle appearance in Booking Settings → Appearance, reload the page,
   confirm accent color, corner style, light/dark background update WITHOUT republishing.
5. Complete a booking; confirm it appears in the dashboard Bookings list.
