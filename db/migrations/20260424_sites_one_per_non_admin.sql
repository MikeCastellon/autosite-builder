-- Limit non-admin users to a single site via Row-Level Security.
--
-- The prior policy "Users can manage own sites" covered ALL commands with a
-- single `auth.uid() = user_id` check, so any authenticated user could
-- insert unlimited sites via a direct Supabase call (bypassing the
-- client-side `canCreateSite` guard on DashboardPage).
--
-- Splits into per-command policies so INSERT can carry the 1-site cap
-- while SELECT/UPDATE/DELETE keep the straight ownership check.

drop policy if exists "Users can manage own sites" on public.sites;

create policy "sites_select_own"
  on public.sites
  for select
  using (auth.uid() = user_id);

create policy "sites_update_own"
  on public.sites
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sites_delete_own"
  on public.sites
  for delete
  using (auth.uid() = user_id);

-- INSERT: user must own the new row AND be either a super admin or have
-- zero existing sites. Admins bypass the cap; everyone else is capped at 1.
create policy "sites_insert_own_with_limit"
  on public.sites
  for insert
  with check (
    auth.uid() = user_id
    AND (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_super_admin = true
      )
      OR (
        select count(*) from public.sites s
        where s.user_id = auth.uid()
      ) = 0
    )
  );
