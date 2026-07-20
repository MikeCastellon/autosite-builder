-- Per-vehicle service options (Booking Platform v3, Feature 2).
-- Vehicle types + per-vehicle variants live in sites.scheduler_config (jsonb),
-- so the only schema change is snapshotting the customer's chosen vehicle
-- type and the resolved duration onto each booking. vehicle_size is kept
-- and derived for back-compat.
--
-- Apply via Supabase SQL editor (or Supabase MCP apply_migration) as postgres.

begin;

alter table public.bookings
  add column if not exists vehicle_type_id text,
  add column if not exists vehicle_type_name text,
  add column if not exists duration_minutes int;

commit;
