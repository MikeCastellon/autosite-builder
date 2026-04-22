-- Shopify subscription gating — add columns to profiles.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists shopify_customer_id text,
  add column if not exists shopify_subscription_id text,
  add column if not exists subscription_updated_at timestamptz;

-- Only add the check constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_subscription_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_subscription_status_check
      check (subscription_status in ('inactive','active','past_due','cancelled'));
  end if;
end $$;

create index if not exists profiles_shopify_customer_id_idx
  on public.profiles (shopify_customer_id)
  where shopify_customer_id is not null;

commit;
