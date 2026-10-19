-- Admin > Leads: each business's social accounts, read off its own website.
-- Applied to ktnouhjikmlxlbxcxyif on 2026-10-19 via Supabase MCP, with the owner's approval.
--
-- Google Places has no social field, so after a scan writes sales_prospects
-- it fetches each shop's homepage and keeps the links to Facebook,
-- Instagram, TikTok, YouTube, X, LinkedIn and Yelp: { "facebook": url, ... }.
-- A website that is itself a social page (website_kind 'social') counts as
-- one without a fetch. Null when there are none. socials_checked_at is when
-- the site was last read (or tried), so a rescan reads the never-read and
-- oldest first and leaves the rest for a month.
--
-- Written by the scanner (service role) only; admins read them with the row
-- (the existing select grant covers new columns). Additive.

begin;

alter table public.sales_prospects
  add column if not exists socials            jsonb,
  add column if not exists socials_checked_at timestamptz;

comment on column public.sales_prospects.socials is
  'Social accounts linked from the business''s website: {facebook, instagram, tiktok, youtube, x, linkedin, yelp} → url.';

commit;
