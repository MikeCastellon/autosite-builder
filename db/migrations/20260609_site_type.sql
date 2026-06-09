-- Standalone booking service: distinguish booking-only accounts from
-- full websites. Booking-only rows publish a single booking page and
-- skip website content generation. Reuses all existing scheduler infra.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.sites
  add column if not exists site_type text not null default 'website';

-- Guard the allowed values without blocking legacy rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sites_site_type_check'
  ) then
    alter table public.sites
      add constraint sites_site_type_check
      check (site_type in ('website', 'booking_only'));
  end if;
end $$;

commit;
