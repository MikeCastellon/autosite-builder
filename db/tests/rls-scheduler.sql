-- Manual RLS checks. Run each block in Supabase SQL editor after the migration.
-- These aren't run automatically; use them to confirm behavior before shipping.

-- 1) Super admin seeds exist
select email, is_super_admin, scheduler_enabled
from profiles where email in ('mike.castellon5@gmail.com','dev@639hz.com');
-- Expect both rows, both flags = true.

-- 2) Anon insert blocked when scheduler disabled
-- Temporarily flip scheduler off for a test user, then try:
-- set local role anon;
-- insert into bookings (site_id, owner_user_id, status, customer_name, customer_email,
--   customer_phone, preferred_at, vehicle_make, vehicle_model, vehicle_year, vehicle_size)
-- values ('<site_id>','<owner_id>','pending','T','t@x.com','555','2030-01-01','Honda','Civic',2020,'sedan');
-- Expect: new row violates row-level security policy

-- 3) Anon insert succeeds when scheduler enabled
-- Flip scheduler on, repeat. Expect: INSERT 0 1.

-- 4) Anon cannot SELECT any bookings
-- set local role anon;
-- select count(*) from bookings;  -- expect 0 or permission denied
