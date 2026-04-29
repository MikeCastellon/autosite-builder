-- 20260429_custom_domain_lookup_rpc.sql
--
-- Replaces the service-role key read in netlify/edge-functions/serve-custom-domain.js
-- (Security Audit C5). The edge function now calls this RPC with the anon
-- public key so a future leak of edge-function code/env never exposes a
-- service-role key to attackers.
--
-- The function is SECURITY DEFINER and returns ONLY the slug column for the
-- exact-match apex lookup. It cannot be coerced into listing all sites or
-- joining other tables. The search_path is locked to defeat hijacking.

begin;

create or replace function public.get_site_slug_for_custom_domain(p_apex text)
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select slug
  from public.sites
  where custom_domain = lower(p_apex)
  limit 1;
$$;

revoke all on function public.get_site_slug_for_custom_domain(text) from public;
grant execute on function public.get_site_slug_for_custom_domain(text) to anon, authenticated;

comment on function public.get_site_slug_for_custom_domain(text) is
  'Public lookup used by the serve-custom-domain edge function to resolve a request Host to the R2-backed slug. Returns just the slug, scoped to exact apex match. Does not bypass RLS on any other column or table.';

commit;
