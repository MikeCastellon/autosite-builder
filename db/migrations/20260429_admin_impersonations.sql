-- 20260429_admin_impersonations.sql
--
-- Audit trail for the admin "View as user" feature.
-- Replaces the prior console.log-only logging in admin-impersonate.js.
-- (Security Audit H1 — privileged-access logging required for SOC2 /
-- Google due-diligence pre-acquisition.)
--
-- The table is INSERT-only from the function side (no UPDATE/DELETE
-- policies). Only super-admins can read it via the dashboard.

begin;

create table if not exists public.admin_impersonations (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  admin_email text,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  target_email text,
  reason text not null check (length(trim(reason)) >= 4),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_impersonations_admin_idx
  on public.admin_impersonations (admin_user_id, created_at desc);
create index if not exists admin_impersonations_target_idx
  on public.admin_impersonations (target_user_id, created_at desc);

alter table public.admin_impersonations enable row level security;

-- Read policy: only super-admins can read the audit log.
drop policy if exists "admin_impersonations_select_super_admin" on public.admin_impersonations;
create policy "admin_impersonations_select_super_admin"
  on public.admin_impersonations
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_super_admin = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for end users — writes happen only
-- via the service role from the netlify function, which bypasses RLS.

comment on table public.admin_impersonations is
  'Audit trail of admin View-as-User actions. Each row is one magic-link generation by an admin acting as another user. Required for SOC2 / acquisition due diligence.';

commit;
