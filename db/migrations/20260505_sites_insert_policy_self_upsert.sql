-- Fix: non-admin users could not save edits after creating their first site.
--
-- supabase-js .upsert() emits INSERT ... ON CONFLICT (id) DO UPDATE. When
-- the conflict resolution becomes an UPDATE, PostgreSQL still evaluates
-- the INSERT WITH CHECK clause. The previous policy required
-- "count(*) of user's sites = 0", which is true at first-site creation but
-- false on every subsequent autosave for the same site — blocking every
-- update with "new row violates row-level security policy".
--
-- This rewrite adds a third branch: bypass the cap when the row's id
-- already belongs to the calling user. That means "self-upsert" (an
-- UPDATE in disguise) is allowed, while a real second-site INSERT (new
-- id) is still blocked by the cap.

drop policy if exists "sites_insert_own_with_limit" on public.sites;

create policy "sites_insert_own_with_limit"
  on public.sites
  for insert
  with check (
    auth.uid() = user_id
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        select 1 from public.sites s
        where s.id = sites.id and s.user_id = auth.uid()
      )
      OR (
        select count(*) from public.sites s
        where s.user_id = auth.uid()
      ) = 0
    )
  );
