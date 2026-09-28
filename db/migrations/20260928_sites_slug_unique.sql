-- Slug authority, part 2: the database refuses duplicate or malformed slugs.
--
-- Apply AFTER 20260928_sites_slug_guard.sql. Safe to apply now: the three
-- slugs that were already duplicated before slugs were server-assigned
-- (listed below) are left out of the unique index until they are resolved
-- by hand, and publish-site refuses to publish those rows meanwhile. Every
-- other slug becomes unique immediately, so 23505 decides any race between
-- two first publishes.
--
-- Pre-flight (read-only). Both queries should match what this file expects:
--
--   -- duplicates: only the three legacy slugs below should appear
--   select slug, count(*) from public.sites
--   where slug is not null group by slug having count(*) > 1;
--
--   -- malformed or reserved slugs: should return no rows
--   select id, slug from public.sites
--   where slug is not null
--     and (slug !~ '^[a-z0-9-]{1,63}$'
--          or slug in ('www','app','api','admin','mail','book','booking','dashboard',
--                      'sitebuilder','support','help','status','cdn','assets','static'));
--
-- Apply via Supabase SQL editor as the postgres role.

do $$
begin
  if exists (
    select 1 from public.sites
    where slug is not null
      and slug not in ('malpica-detailing', 'auto-care-genius', 'autosite-demo-shop')
    group by slug having count(*) > 1
  ) then
    raise exception 'public.sites has duplicate slugs beyond the three known ones; resolve them first (pre-flight query above)';
  end if;
end $$;

create unique index if not exists sites_slug_unique
  on public.sites (slug)
  where slug is not null
    and slug not in ('malpica-detailing', 'auto-care-genius', 'autosite-demo-shop');

-- Slugs are a DNS label and an R2 key prefix. NOT VALID skips checking
-- existing rows; VALIDATE then checks them and fails if any is malformed.
alter table public.sites
  add constraint sites_slug_shape
  check (slug is null or slug ~ '^[a-z0-9-]{1,63}$') not valid;
alter table public.sites validate constraint sites_slug_shape;

-- LATER, once the three legacy duplicates are resolved:
--   for each group, pick the row that keeps the slug; on the others set
--   slug = null AND published_url = null (they claim a fresh slug on their
--   next publish; clearing published_url stops the dashboard showing them
--   as live), then have both owners republish. Then run:
--
--   create unique index sites_slug_unique_all on public.sites (slug) where slug is not null;
--   drop index public.sites_slug_unique;
--   drop index if exists public.sites_slug_idx;
