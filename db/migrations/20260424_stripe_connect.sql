-- Stripe Connect Express — add capability tracking columns on profiles.
-- The existing stripe_* columns (from 20260424_stripe_subscriptions) stay
-- untouched; these are the business-side account (not the platform sub).
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_charges_enabled boolean not null default false,
  add column if not exists stripe_connect_payouts_enabled boolean not null default false,
  add column if not exists stripe_connect_details_submitted boolean not null default false,
  add column if not exists stripe_connect_updated_at timestamptz;

create unique index if not exists profiles_stripe_connect_account_id_idx
  on public.profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

commit;
