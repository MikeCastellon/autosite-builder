-- Add an index on sites.user_id, the most-queried column in the app.
--
-- This column is the WHERE clause in:
--   src/App.jsx — initial dashboard load
--   src/components/dashboard/bookings-page/BookingsPage.jsx
--   src/components/dashboard/charges/ChargesPage.jsx
--   src/components/dashboard/customers-page/CustomersPage.jsx
--   src/components/dashboard/customers-page/CustomerDetailPage.jsx
--
-- Without an index, every dashboard load does a full table scan. At 91 rows
-- it doesn't matter today; at 10k it will. Add proactively while it's free.
--
-- 2026-05-20 cleanup audit, Tier 1 item 4.
create index if not exists sites_user_id_idx
  on public.sites (user_id);
