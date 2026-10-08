-- Free websites (Admin > Free websites): a team member builds a customer's
-- site with the normal builder, in their own account, then hands it to the
-- customer's account (created if needed), like a custom website's hand-over.
--
-- One row per customer. The site is linked by site_id, set by the
-- free-site-admin function when the builder's first save carries the row's
-- id as business_info.freeSiteId, or when the admin picks a site they
-- already built. The client_* / business_name / site_id names match
-- custom_site_projects, so both hand-overs share _lib/custom-site-handover.js.
--
-- Everything goes through free-site-admin with the service role, so RLS is
-- on with no policies: neither the anon key nor a signed-in owner can read
-- these rows (they hold customer contact details).
-- Apply via Supabase SQL editor as the postgres role.

begin;

create table if not exists public.free_site_handovers (
  id uuid primary key default gen_random_uuid(),
  client_first_name text not null,
  client_last_name text,
  client_email text not null,
  client_phone text,
  business_name text,
  note text not null default '',
  -- In the builder's account until the hand-over, then in the customer's.
  -- One row per site.
  site_id uuid references public.sites(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handed_over_at timestamptz,
  handed_over_by uuid references auth.users(id) on delete set null,
  customer_user_id uuid references auth.users(id) on delete set null,
  -- Pro given at no charge with the hand-over.
  comp_pro boolean not null default false,
  -- The last access email: when it went out, or why it didn't.
  email_sent_at timestamptz,
  email_error text
);

create unique index if not exists free_site_handovers_site_idx
  on public.free_site_handovers (site_id) where site_id is not null;

create index if not exists free_site_handovers_updated_idx
  on public.free_site_handovers (updated_at desc);

alter table public.free_site_handovers enable row level security;

-- Keep updated_at in sync (tg_set_updated_at from the scheduler MVP
-- migration). The admin list sorts by it.
drop trigger if exists set_updated_at_free_site_handovers on public.free_site_handovers;
create trigger set_updated_at_free_site_handovers
  before update on public.free_site_handovers
  for each row execute function public.tg_set_updated_at();

commit;
