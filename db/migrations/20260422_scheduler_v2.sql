-- Scheduler v2: per-site enable toggle + owner config + booking service linkage
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.sites
  add column if not exists scheduler_enabled boolean not null default false;

alter table public.sites
  add column if not exists scheduler_config jsonb not null default '{}'::jsonb;

alter table public.bookings
  add column if not exists service_id text;

alter table public.bookings
  add column if not exists service_name text;

commit;
