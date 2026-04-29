-- 20260429_custom_domain_unique.sql
--
-- Fix TOCTOU race in connect-domain.js (Security Audit H9). Two parallel
-- attempts to claim the same custom_domain could both pass the
-- "exists this domain elsewhere?" check before either INSERT/UPDATE
-- landed, then both succeed in writing the same value into different
-- rows. A partial unique index on the non-null values makes the write
-- itself the atomic source of truth: the second writer fails with a
-- constraint violation and the application returns 409 cleanly.

begin;

-- Drop the prior non-unique lookup index in favor of the unique one
-- (a unique index also serves as a lookup index, so there is no need
-- to keep both).
drop index if exists public.idx_sites_custom_domain;

create unique index if not exists sites_custom_domain_unique_idx
  on public.sites(custom_domain)
  where custom_domain is not null;

comment on index public.sites_custom_domain_unique_idx is
  'Enforces at-most-one site per custom_domain. Replaces the connect-domain.js TOCTOU conflict-check guard with a real DB constraint. (Security Audit H9)';

commit;
