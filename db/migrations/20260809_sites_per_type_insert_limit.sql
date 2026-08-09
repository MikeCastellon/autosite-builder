-- Fix: "Create booking page (no website)" failed with an RLS violation
-- for any non-admin who already had a website.
--
-- The previous policy capped non-admins at one sites row TOTAL, but the
-- standalone booking service intentionally lets one account hold both a
-- website row and a booking_only row. The cap now applies per site_type:
-- at most one 'website' row and at most one 'booking_only' row each.
-- The self-upsert branch (autosave via upsert) and the super-admin
-- bypass are unchanged.
--
-- Apply via Supabase SQL editor as the postgres role.

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
          and s.site_type = sites.site_type
      ) = 0
    )
  );
