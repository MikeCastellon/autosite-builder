-- Custom website projects (Admin > Custom websites) + the customer intake form.
--
-- An admin adds a customer; that creates a project with a secret `token`.
-- The welcome email links to /custom-site?t=<token>, where the customer
-- fills in the intake form and uploads their logo, brand files, inspiration
-- and photos. The admin then moves the project through the build stages.
--
-- Everything goes through the custom-site-admin / custom-site-form Netlify
-- functions with the service role, so RLS is on with no policies: neither
-- the anon key nor a signed-in owner can read these rows directly (they hold
-- customer contact details and the form tokens).
-- Apply via Supabase SQL editor as the postgres role.

begin;

create table if not exists public.custom_site_projects (
  id uuid primary key default gen_random_uuid(),
  -- Secret for the customer's form link. Replaced by "reset link".
  token text not null unique,
  -- What the admin knows when adding a customer: first/last name and email.
  -- client_name is "first last", kept by the functions for display/search.
  client_first_name text not null,
  client_last_name text,
  client_name text not null,
  client_email text not null,
  -- Filled from the customer's form answers (or edited by an admin).
  client_phone text,
  business_name text,
  stage text not null default 'new' check (stage in (
    'new','invited','form_started','form_received','designing',
    'in_review','revisions','live','on_hold','archived'
  )),
  -- Intake answers (src/lib/customSiteForm.js sanitizeForm) and uploads
  -- ([{ path, kind, name, size, type, note? }] in the custom-site-assets bucket).
  form jsonb not null default '{}'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  admin_notes text not null default '',
  site_url text,
  paid_at timestamptz,
  invite_sent_at timestamptz,
  invite_count integer not null default 0,
  form_started_at timestamptz,
  form_saved_at timestamptz,
  form_submitted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_site_projects_stage_updated_idx
  on public.custom_site_projects (stage, updated_at desc);

-- Activity log. Insert-only, so a customer autosave and an admin stage change
-- landing at the same moment can't overwrite each other's entries.
create table if not exists public.custom_site_project_events (
  id bigserial primary key,
  project_id uuid not null references public.custom_site_projects(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  -- Admin email, 'customer' or 'system'.
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists custom_site_project_events_project_idx
  on public.custom_site_project_events (project_id, created_at desc);

alter table public.custom_site_projects enable row level security;
alter table public.custom_site_project_events enable row level security;

-- Keep updated_at in sync (reuses tg_set_updated_at from the scheduler MVP
-- migration). The admin list sorts by it as "last activity".
drop trigger if exists set_updated_at_custom_site_projects on public.custom_site_projects;
create trigger set_updated_at_custom_site_projects
  before update on public.custom_site_projects
  for each row execute function public.tg_set_updated_at();

-- Private bucket for the customer's uploads, 25 MB per file. No storage
-- policies: customers upload through signed upload URLs minted by
-- custom-site-form, admins read through signed URLs from custom-site-admin.
insert into storage.buckets (id, name, public, file_size_limit)
values ('custom-site-assets', 'custom-site-assets', false, 26214400)
on conflict (id) do nothing;

commit;
