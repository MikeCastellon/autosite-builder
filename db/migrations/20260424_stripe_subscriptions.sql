-- Stripe subscription integration — columns added alongside Shopify columns
-- on profiles. The existing subscription_status + subscription_ends_at columns
-- remain the gate source of truth; both Shopify and Stripe webhooks write to
-- them. These new columns are Stripe-bookkeeping only.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_trial_ends_at timestamptz,
  add column if not exists stripe_first_failed_payment_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

commit;
