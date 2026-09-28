-- Slug authority, part 1: only the server assigns sites.slug.
--
-- A slug is the site's subdomain and its R2 key prefix. Before this,
-- sites_update_own let an owner write any slug to their own row, and
-- nothing made slugs unique, so two sites could publish to the same
-- <slug>.autocaregeniushub.com and overwrite each other's live page.
-- publish-site.js now claims slugs with the service role
-- (netlify/functions/_shared/slugClaim.js); this trigger makes sure
-- nothing else can set one.
--
-- Requests from the anon/authenticated roles have slug writes ignored
-- rather than rejected, so an older client that still sends a slug keeps
-- working. The service role and direct SQL are unaffected.
--
-- Apply this first, before 20260928_sites_slug_unique.sql and as early as
-- possible: until it runs, any owner can still rewrite their own row's
-- slug directly through the API. publish-site refuses malformed or
-- reserved stored slugs either way. Apply via Supabase SQL editor as the
-- postgres role.

create or replace function public.sites_guard_slug()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  if coalesce(jwt_role, '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.slug := null;
    elsif new.slug is distinct from old.slug then
      new.slug := old.slug;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_guard_slug on public.sites;
create trigger sites_guard_slug
  before insert or update on public.sites
  for each row execute function public.sites_guard_slug();
