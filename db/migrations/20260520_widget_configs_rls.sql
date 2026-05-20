-- Enable Row Level Security on widget_configs to stop the Instagram-token
-- leak documented in the 2026-05-20 cleanup audit (Tier 1 item 1).
--
-- BACKGROUND
--
-- widget_configs holds connected widget credentials (Instagram OAuth access
-- tokens, Google place_id) keyed by user_id. Two SELECT policies already
-- existed on the table:
--   - "Service role can read all widget_configs"
--   - "Users can read own widget_configs"  (auth.uid()::text = user_id)
-- But RLS was DISABLED — meaning the policies were inert and anyone with
-- the Supabase anon key (which ships in every published-site bundle) could
-- read every instagram_access_token on the platform. SEV-2 token leak.
--
-- ACCESS PATTERN (verified before writing this migration)
--
-- The builder app accesses widget_configs from the BROWSER only:
--   * App.jsx, StepSocialFeeds.jsx, StepBusinessInfo.jsx: SELECT WHERE user_id = session.user.id
--   * StepSocialFeeds.jsx:94: INSERT user_id = session.user.id (google-reviews)
--   * Instagram OAuth callback (external social-feeds-app) inserts via its
--     own service-role connection — bypasses RLS by design.
--   * No netlify/functions/ code reads or writes this table.
--   * No UPDATE/DELETE paths in src/ today.
--
-- POLICIES ADDED
--
-- Mirror the existing SELECT policy for the other three commands so the
-- INSERT path in StepSocialFeeds doesn't fail closed. Defensive UPDATE
-- and DELETE policies in case future code needs them; without these, the
-- table would only be writable by service role.
--
-- LEGACY ROWS
--
-- 59 of 61 current rows have user_id set to literal strings 'autosite-builder'
-- or 'internal-user' rather than a real auth.users UUID. After RLS those rows
-- become invisible to authenticated users — but they're already invisible
-- because every browser query filters by session.user.id. Service role still
-- sees them. This is acceptable for now; a separate cleanup pass should
-- either migrate them to real user_ids or drop them.

create policy "Users can insert own widget_configs"
  on public.widget_configs for insert
  to authenticated
  with check ((auth.uid())::text = user_id);

create policy "Users can update own widget_configs"
  on public.widget_configs for update
  to authenticated
  using ((auth.uid())::text = user_id)
  with check ((auth.uid())::text = user_id);

create policy "Users can delete own widget_configs"
  on public.widget_configs for delete
  to authenticated
  using ((auth.uid())::text = user_id);

alter table public.widget_configs enable row level security;
