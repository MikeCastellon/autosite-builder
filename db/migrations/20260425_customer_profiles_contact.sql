-- Manual customer records — extend customer_profiles with contact + vehicle
-- fields. Today the table is unused; this plan starts populating it with
-- manually-added customers whose identity_key doesn't overlap with any
-- existing booking.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.customer_profiles
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year smallint,
  add column if not exists vehicle_size text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_profiles_vehicle_size_check'
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_vehicle_size_check
      check (vehicle_size is null or vehicle_size in ('sedan','suv','truck','van','other'));
  end if;
end $$;

-- Enforce one profile per (owner, identity_key) so we never double-insert
-- when a customer is added twice.
create unique index if not exists customer_profiles_owner_identity_unique
  on public.customer_profiles (owner_user_id, identity_key);

commit;
