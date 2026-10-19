-- Admin > Leads: each shop's email and owner's name, read off its website.
-- NOT YET APPLIED. The scanner works without them (it keeps reading socials
-- and stops sending these two); after applying, a rescan fills them in for
-- the shops it finds, or scanSocials({ recheckBefore: now }) for all of them.
--
-- From the same visit that reads the socials: mailto links, JSON-LD `email`
-- and addresses in the page text (the site's own domain first, then free
-- mail; robots, placeholders and the site builder's addresses skipped), and
-- an owner only where the site names one as a person (JSON-LD founder /
-- employee / owner, or "Owner: …" / "Dueño: …"). When the homepage leaves
-- either unknown, its contact or about page is read too.
--
-- Written by the scanner (service role) only; admins read them with the row.
-- Additive.

begin;

alter table public.sales_prospects
  add column if not exists email      text,
  add column if not exists owner_name text;

comment on column public.sales_prospects.email is 'The shop''s email, read off its website by the scanner.';
comment on column public.sales_prospects.owner_name is 'The owner''s name where the shop''s website states it, read by the scanner.';

commit;
