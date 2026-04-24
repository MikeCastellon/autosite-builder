-- Customer metadata: per-owner notes + tags keyed by the dedup identity_key
-- used by the Customers page (email:foo@x.com → phone:5551234567 → name:foo).
-- Rows survive even if the underlying bookings are deleted; if the customer
-- ever rebooks under the same identity, their notes & tags reattach.
--
-- Apply via Supabase SQL editor as the postgres role.

begin;

create table if not exists customer_metadata (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  identity_key text not null,
  notes text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, identity_key)
);

create index if not exists customer_metadata_owner_idx
  on customer_metadata (owner_user_id);

-- Reuse the shared updated_at trigger function from the scheduler MVP.
drop trigger if exists set_updated_at_customer_metadata on customer_metadata;
create trigger set_updated_at_customer_metadata
  before update on customer_metadata
  for each row execute function public.tg_set_updated_at();

alter table customer_metadata enable row level security;

-- Owner can do everything with their own customer rows; super admins can read
-- anyone's (mirrors the bookings policies).
create policy "customer_metadata_select_owner_or_admin" on customer_metadata
  for select using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

create policy "customer_metadata_insert_owner" on customer_metadata
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "customer_metadata_update_owner_or_admin" on customer_metadata
  for update using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

create policy "customer_metadata_delete_owner_or_admin" on customer_metadata
  for delete using (
    owner_user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
  );

grant select, insert, update, delete on table customer_metadata to authenticated;

commit;
