-- Booking add-ons: snapshot of optional extras chosen at booking time,
-- plus the locked-in service price (in cents) and total. Add-ons live
-- inside scheduler_config.services[].addons[] (JSON) on the sites table;
-- on each booking we snapshot what the customer actually picked so prices
-- stay correct even if the owner edits their menu later.
--
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.bookings
  add column if not exists service_price_cents int,
  add column if not exists addons jsonb,
  add column if not exists total_cents int;

-- Sanity check: total should never be less than the service price when
-- both are set. Keep this loose (allow nulls) so legacy rows pass.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_total_gte_service_check'
  ) then
    alter table public.bookings
      add constraint bookings_total_gte_service_check
      check (
        total_cents is null
        or service_price_cents is null
        or total_cents >= service_price_cents
      );
  end if;
end $$;

commit;
