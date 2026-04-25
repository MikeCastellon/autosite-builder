-- Booking deposits — Stripe Checkout on connected accounts.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.bookings
  add column if not exists deposit_required_cents int,
  add column if not exists deposit_paid_cents int,
  add column if not exists deposit_status text not null default 'not_required',
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_checkout_session_id text,
  add column if not exists deposit_payment_intent_id text,
  add column if not exists deposit_application_fee_cents int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_deposit_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_deposit_status_check
      check (deposit_status in ('not_required','pending','paid','refunded','failed'));
  end if;
end $$;

create index if not exists bookings_deposit_session_idx
  on public.bookings (deposit_checkout_session_id)
  where deposit_checkout_session_id is not null;

commit;
