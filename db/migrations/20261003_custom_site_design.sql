-- Custom website projects, part 2: the Design step and the hand-over.
--
-- A project builds one site (site_id). The admin sets up the design from the
-- customer's intake answers (design), Claude writes the copy in the
-- custom-site-design-background function (design_status / design_error), and
-- the site is built under the admin's account so drafts can be published.
-- At hand-over the site moves to the customer's own account
-- (customer_user_id, handed_over_at).
-- Same access model as part 1: RLS on, no policies, service role only.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.custom_site_projects
  add column if not exists site_id uuid references public.sites(id) on delete set null,
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists design jsonb not null default '{}'::jsonb,
  add column if not exists design_status text not null default 'none'
    check (design_status in ('none', 'generating', 'ready', 'failed')),
  add column if not exists design_error text,
  add column if not exists design_started_at timestamptz,
  add column if not exists design_finished_at timestamptz,
  add column if not exists handed_over_at timestamptz;

create index if not exists custom_site_projects_site_idx
  on public.custom_site_projects (site_id);

commit;
