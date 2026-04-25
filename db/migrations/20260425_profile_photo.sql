-- Owner profile photo — stored as base64 data URL on the profiles row,
-- same pattern as customer_profiles.photo_url. 500KB cap enforced client-side.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists photo_url text;

commit;
