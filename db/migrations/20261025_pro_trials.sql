-- Pro trials: Admin > Free websites can hand a site over with Pro free for
-- 30 days. The account is Pro until profiles.pro_trial_ends_at
-- (isEffectiveSchedulerActive), then on the free plan again, with nothing
-- to switch off. The pro-trial-sweep function emails the customer a few
-- days before the end and when it ends, and stamps each email so it goes
-- out once per trial (a new trial clears both stamps).
--
-- Owners can't write these columns: profiles_guard_owner_columns
-- (20261003_rls_hardening.sql) lets them change only their contact fields,
-- and these are not among them.
--
-- Apply BEFORE deploying the code: the booking functions select
-- pro_trial_ends_at with the other plan columns, and a missing column
-- fails those reads.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.profiles
  add column if not exists pro_trial_ends_at timestamptz,
  add column if not exists pro_trial_reminder_sent_at timestamptz,
  add column if not exists pro_trial_ended_sent_at timestamptz;

-- The sweep reads trials ending soon or just ended.
create index if not exists profiles_pro_trial_ends_idx
  on public.profiles (pro_trial_ends_at) where pro_trial_ends_at is not null;

-- The trial a hand-over gave, for Admin > Free websites (comp_pro is the
-- no-charge Pro).
alter table public.free_site_handovers
  add column if not exists pro_trial_ends_at timestamptz;

commit;
