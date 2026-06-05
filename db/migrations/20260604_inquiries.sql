-- Inquiries (general contact form) — table + RLS.
-- Mirrors the bookings table but free-for-all: any existing site can receive
-- inquiries (no scheduler_enabled / subscription gate). Inserts happen via the
-- create-inquiry function using the service role; the anon INSERT policy below
-- is defense-in-depth. Apply via Supabase SQL editor as the postgres role.

begin;

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived')),
  owner_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_owner_status_created_idx
  on inquiries (owner_user_id, status, created_at desc);
create index if not exists inquiries_site_created_idx
  on inquiries (site_id, created_at desc);

-- Helper: can the anon role create an inquiry for this site?
-- Requires the site to exist AND be published (no scheduler/subscription gate).
-- Mirrors the create-inquiry function's published-site check so a direct
-- anon REST insert can't bypass it.
create or replace function public.can_inquire_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sites s where s.id = p_site_id and s.published_url is not null
  );
$$;

alter table inquiries enable row level security;

-- Keep updated_at in sync on UPDATE (reuses tg_set_updated_at from the
-- scheduler MVP migration).
drop trigger if exists set_updated_at_inquiries on inquiries;
create trigger set_updated_at_inquiries
  before update on inquiries
  for each row execute function public.tg_set_updated_at();

-- Anonymous visitors can INSERT only, when the site exists.
create policy "inquiries_insert_anon_when_site_exists" on inquiries
  for insert to anon
  with check (public.can_inquire_site(site_id));

-- Owners (and super admins) can read / update their inquiries.
create policy "inquiries_select_owner_or_admin" on inquiries
  for select using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

create policy "inquiries_update_owner_or_admin" on inquiries
  for update using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

grant execute on function public.can_inquire_site(uuid) to anon, authenticated;
grant insert on table inquiries to anon;
grant select, update on table inquiries to authenticated;

commit;
