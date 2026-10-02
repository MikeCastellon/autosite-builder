-- When a website's homepage was last written to R2.
--
-- publish-site.js (owner Publish / Republish of a website homepage; not a
-- /book-only refresh or a booking-only page) and admin-site-upgrade.js
-- (admins rolling the new template designs out to live sites) set it to
-- now() after a successful upload; an admin restore clears it. It drives:
--   - the dashboard's "New design live" badge (on or after the release
--     date in src/lib/siteUpgrade.js, SITE_UPGRADE_RELEASE_DATE), and
--   - Admin > Site upgrades: sites already on the new design are left out
--     of "Republish all", and owners' first new-design publish backs up
--     the old page.
--
-- No backfill: publishes were not tracked before this column, so existing
-- live sites stay null, meaning "published before tracking started". Do
-- not fill it from updated_at or created_at: those change on every draft
-- save and would show the badge on sites that were never republished.
--
-- Server-owned, like published_url: sites_guard_server_columns (below,
-- re-created from its production definition with published_at added)
-- nulls it on a client INSERT and keeps the old value on a client UPDATE,
-- so an owner cannot mark their own site as done (that would also drop it
-- from the admin rollout). The service role (both functions) is not
-- affected. Reads need no change: owners read their own row through
-- sites_select_own and super admins read every row through
-- sites_admin_select_all; the table-level grants cover new columns.
--
-- Requires 20261003_rls_hardening.sql (custom websites, #13) to be applied
-- first: it creates the sites_guard_server_columns trigger this file extends.
-- Re-running that older file after this one would drop the published_at
-- lines again.
--
-- Apply BEFORE the admin rollout starts: admin-site-upgrade refuses to
-- republish until the column exists (without it nothing records which
-- sites are done). Owner publishes work either way: publish-site ignores
-- a missing column. Idempotent.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.sites
  add column if not exists published_at timestamptz;

comment on column public.sites.published_at is
  'When the website homepage was last uploaded (publish-site / admin-site-upgrade); cleared by an admin restore. Null = not published since this column was added. Server-owned (sites_guard_server_columns).';

-- Production definition as of 2026-10-02, plus the two published_at lines.
create or replace function public.sites_guard_server_columns()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
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
      new.published_at := null;
    else
      new.custom_domain := old.custom_domain;
      new.custom_domain_status := old.custom_domain_status;
      new.custom_domain_connected_at := old.custom_domain_connected_at;
      new.custom_domain_last_checked_at := old.custom_domain_last_checked_at;
      new.custom_hostname_apex_id := old.custom_hostname_apex_id;
      new.custom_hostname_www_id := old.custom_hostname_www_id;
      new.published_url := old.published_url;
      new.published_at := old.published_at;
    end if;
  end if;
  return new;
end;
$function$;

commit;
