-- Signup names never reached profiles (found 2026-10-05: 92 of 96 accounts
-- had no first name, every signup since mid-May).
--
-- Why: the signup form passes first/last name, business name and phone as
-- user metadata, but handle_new_user copied only email and auth phone. The
-- form's follow-up profiles.upsert() always failed: an upsert needs an INSERT
-- policy and profiles has none (and with email confirmation on there is no
-- session yet, so it ran as anon). The error was never shown.
--
-- Fix: the trigger copies the four signup fields from raw_user_meta_data
-- (the signing-up user typed them, as they would on the profile page), and a
-- one-time backfill fills the same fields for existing CONFIRMED accounts
-- where the profile is still empty (60 on 2026-10-05). Unconfirmed accounts
-- are left out: whoever typed those may not own the inbox. Nothing an owner
-- already set is overwritten. Not filled: 10 early Google sign-ups (their
-- metadata has full_name, no first_name) and 7 early email sign-ups that
-- sent no metadata.
-- Trimming covers tabs, newlines and no-break spaces too, so a value made
-- only of those is stored as null, not as a blank "name".
-- Apply via Supabase SQL editor as the postgres role.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ws constant text := E' \t\r\n\u00a0';
begin
  insert into public.profiles (id, email, phone, first_name, last_name, business_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.phone, ''), nullif(left(btrim(meta ->> 'phone', ws), 40), '')),
    nullif(left(btrim(meta ->> 'first_name', ws), 80), ''),
    nullif(left(btrim(meta ->> 'last_name', ws), 80), ''),
    nullif(left(btrim(meta ->> 'business_name', ws), 120), '')
  )
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    phone = coalesce(public.profiles.phone, excluded.phone),
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    business_name = coalesce(public.profiles.business_name, excluded.business_name);
  return new;
end;
$$;

-- One-time backfill (60 confirmed accounts on 2026-10-05). Fills empty fields only.
update public.profiles p set
  first_name = coalesce(nullif(p.first_name, ''), nullif(left(btrim(u.raw_user_meta_data ->> 'first_name', E' \t\r\n\u00a0'), 80), '')),
  last_name = coalesce(nullif(p.last_name, ''), nullif(left(btrim(u.raw_user_meta_data ->> 'last_name', E' \t\r\n\u00a0'), 80), '')),
  business_name = coalesce(nullif(p.business_name, ''), nullif(left(btrim(u.raw_user_meta_data ->> 'business_name', E' \t\r\n\u00a0'), 120), '')),
  phone = coalesce(nullif(p.phone, ''), nullif(left(btrim(u.raw_user_meta_data ->> 'phone', E' \t\r\n\u00a0'), 40), ''))
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is not null
  and (
    (coalesce(p.first_name, '') = '' and coalesce(btrim(u.raw_user_meta_data ->> 'first_name', E' \t\r\n\u00a0'), '') <> '')
    or (coalesce(p.last_name, '') = '' and coalesce(btrim(u.raw_user_meta_data ->> 'last_name', E' \t\r\n\u00a0'), '') <> '')
    or (coalesce(p.business_name, '') = '' and coalesce(btrim(u.raw_user_meta_data ->> 'business_name', E' \t\r\n\u00a0'), '') <> '')
    or (coalesce(p.phone, '') = '' and coalesce(btrim(u.raw_user_meta_data ->> 'phone', E' \t\r\n\u00a0'), '') <> '')
  );

commit;
