-- Allow super-admins to edit any site (not just their own).
--
-- The previous policy set covered admin SELECT (sites_admin_select_all) but
-- not UPDATE or INSERT, so opening a customer's site as admin and clicking
-- Save Draft / Publish failed with:
--   "new row violates row-level security policy (USING expression) for table sites"
-- because sites_update_own / sites_insert_own_with_limit both required
-- auth.uid() = user_id.
--
-- These two permissive policies layer on top of the existing per-owner
-- policies. Postgres OR's permissive policies together, so a non-admin's
-- self-edit still goes through the owner policies; admins additionally
-- satisfy the all-sites policies. Delete is intentionally left admin-less
-- so destructive ops still require ownership.

drop policy if exists "sites_admin_update_all" on public.sites;
create policy "sites_admin_update_all"
  on public.sites
  for update
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

drop policy if exists "sites_admin_insert_all" on public.sites;
create policy "sites_admin_insert_all"
  on public.sites
  for insert
  with check (is_super_admin(auth.uid()));
