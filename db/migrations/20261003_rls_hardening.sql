-- RLS hardening (audit 2026-10-02). Every hole below was confirmed against
-- the live database, and every fix was checked against every legitimate
-- writer: browser writes use only the columns still allowed, and all other
-- writes go through Netlify functions with the service role (which bypasses
-- RLS and these guards).
-- Apply via Supabase SQL editor as the postgres role.

begin;

-- 1. reviews_cache (critical): RLS was off, so anyone with the public anon
--    key could read, forge or wipe cached Google reviews shown on live sites
--    (and a forged field reached the editor unescaped). Its only reader and
--    writer is the SocialFeeds google-reviews function, with the service role.
alter table public.reviews_cache enable row level security;
revoke all on table public.reviews_cache from anon, authenticated;

-- 2. profiles (high): owners could rewrite their own billing, Stripe/Shopify
--    and Connect columns (subscription_status = 'active' → free Pro). Owners
--    may now change only their contact fields; webhooks, functions (service
--    role), migrations (postgres) and super admins are not limited.
create or replace function public.profiles_guard_owner_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_cols constant text[] := array['first_name', 'last_name', 'business_name', 'phone', 'photo_url', 'email', 'updated_at'];
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if public.is_super_admin(auth.uid()) then
    return new;
  end if;
  if (to_jsonb(new) - owner_cols) is distinct from (to_jsonb(old) - owner_cols) then
    raise exception 'Only name, business name, phone and photo can be changed here'
      using errcode = '42501';
  end if;
  -- The email may only be re-synced to the verified sign-in address.
  if new.email is distinct from old.email
     and lower(new.email) is distinct from lower(auth.jwt() ->> 'email') then
    raise exception 'Email can only be changed from account settings'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_owner_columns on public.profiles;
create trigger profiles_guard_owner_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_owner_columns();

-- 3. sites (high): owners could write custom_domain / published_url /
--    domain status directly; disconnect-domain and unpublish-site trust them,
--    so a crafted 'www.<someone's domain>' took another customer's domain
--    offline. Browser writes to these columns are now ignored (same pattern
--    as sites_guard_slug); only server functions set them.
create or replace function public.sites_guard_server_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jwt_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  if coalesce(jwt_role, '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.custom_domain := null;
      new.custom_domain_status := null;
      new.custom_domain_connected_at := null;
      new.custom_domain_last_checked_at := null;
      new.custom_hostname_apex_id := null;
      new.custom_hostname_www_id := null;
      new.published_url := null;
    else
      new.custom_domain := old.custom_domain;
      new.custom_domain_status := old.custom_domain_status;
      new.custom_domain_connected_at := old.custom_domain_connected_at;
      new.custom_domain_last_checked_at := old.custom_domain_last_checked_at;
      new.custom_hostname_apex_id := old.custom_hostname_apex_id;
      new.custom_hostname_www_id := old.custom_hostname_www_id;
      new.published_url := old.published_url;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_guard_server_columns on public.sites;
create trigger sites_guard_server_columns
  before insert or update on public.sites
  for each row execute function public.sites_guard_server_columns();

-- Applies to the service role too: connect-domain strips one 'www.', so the
-- input 'www.www.<domain>' could still store 'www.<domain>'.
alter table public.sites drop constraint if exists sites_custom_domain_shape;
alter table public.sites add constraint sites_custom_domain_shape
  check (custom_domain is null or (custom_domain ~ '^[a-z0-9.-]+$' and left(custom_domain, 4) <> 'www.'));

--    sites (medium): flipping site_type got around the one-website /
--    one-booking-page cap. Only super admins and the service role may change it.
create or replace function public.sites_guard_site_type()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  if coalesce(jwt_role, '') in ('anon', 'authenticated')
     and new.site_type is distinct from old.site_type
     and not public.is_super_admin(auth.uid()) then
    new.site_type := old.site_type;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_guard_site_type on public.sites;
create trigger sites_guard_site_type
  before update on public.sites
  for each row execute function public.sites_guard_site_type();

-- 4. bookings (high): the anon INSERT policy let anyone write any booking
--    row (any owner, status, "deposit paid") and skip create-booking's
--    checks. Bookings are created only by create-booking / owner-create-booking
--    (service role).
drop policy if exists bookings_insert_anon_when_enabled on public.bookings;
revoke insert on table public.bookings from anon, authenticated;

--    bookings (medium): owners could move their own booking onto another
--    shop's site_id. The browser only ever saves owner notes.
revoke update on table public.bookings from anon, authenticated;
grant update (owner_notes, updated_at) on table public.bookings to authenticated;

-- 5. inquiries (medium): same anon INSERT hole; the contact form goes
--    through create-inquiry (service role).
drop policy if exists "inquiries_insert_anon_when_site_exists" on public.inquiries;
revoke insert on table public.inquiries from anon, authenticated;

-- 6. charges (medium/low): unused owner insert/update policies let any
--    account insert a charge on another shop's site (blocking that site's
--    deletion) or rewrite its own charges. Charges are written only by
--    create-charge and the Stripe webhook (service role).
drop policy if exists owner_charges_insert on public.charges;
drop policy if exists owner_charges_update on public.charges;
alter table public.charges
  drop constraint charges_site_id_fkey,
  add constraint charges_site_id_fkey foreign key (site_id) references public.sites(id) on delete set null;

commit;
