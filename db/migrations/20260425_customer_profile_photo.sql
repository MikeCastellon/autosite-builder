-- Customer profile photo — stored as base64 data URL in the row itself,
-- matching the scheduler's logo_url pattern. Sized-capped at 500KB by the
-- client before upload to keep rows sane.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.customer_profiles
  add column if not exists photo_url text;

commit;
