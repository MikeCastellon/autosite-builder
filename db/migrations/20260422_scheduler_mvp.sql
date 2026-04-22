-- Scheduler MVP: profiles + bookings + RLS + seed
-- Apply via Supabase SQL editor as the postgres role.

begin;

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_super_admin boolean not null default false,
  scheduler_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users
insert into profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

alter table profiles enable row level security;

create policy "profiles_select_own_or_admin" on profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

-- Users cannot update their own admin/feature flags; only super admins can.
create policy "profiles_update_self_basic" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_super_admin = (select p.is_super_admin from profiles p where p.id = auth.uid())
    and scheduler_enabled = (select p.scheduler_enabled from profiles p where p.id = auth.uid())
  );

create policy "profiles_update_admin" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

-- ---------- bookings ----------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','confirmed','declined','cancelled','completed')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  preferred_at timestamptz not null,
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_year smallint not null,
  vehicle_size text not null check (vehicle_size in ('sedan','suv','truck','van','other')),
  service_address text,
  notes text,
  referral_source text,
  owner_notes text,
  declined_reason text,
  deposit_amount_cents integer,
  payment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_owner_status_at_idx
  on bookings (owner_user_id, status, preferred_at);
create index if not exists bookings_site_created_idx
  on bookings (site_id, created_at desc);

-- Helper: can the anon role create a booking for this site?
create or replace function public.can_book_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from sites s
    join profiles p on p.id = s.user_id
    where s.id = p_site_id and p.scheduler_enabled = true
  );
$$;

alter table bookings enable row level security;

-- Anonymous visitors can INSERT only
create policy "bookings_insert_anon_when_enabled" on bookings
  for insert to anon
  with check (public.can_book_site(site_id));

-- Owners (and super admins) can read / update their bookings
create policy "bookings_select_owner_or_admin" on bookings
  for select using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

create policy "bookings_update_owner_or_admin" on bookings
  for update using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

-- ---------- seed super admins ----------
update profiles
set is_super_admin = true, scheduler_enabled = true, updated_at = now()
where email in ('mike.castellon5@gmail.com','dev@639hz.com');

commit;
