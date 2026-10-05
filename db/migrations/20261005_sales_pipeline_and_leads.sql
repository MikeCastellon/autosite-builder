-- Admin > Pipeline and Admin > Leads: selling websites to automotive shops.
--
-- Ported from Genius Routes (Pipe + Leads). Two halves:
--
--   Pipeline: sales_stages / sales_leads / sales_lead_movements /
--   sales_lead_notes. A lead is one business somebody is working, moving
--   through editable stages. Every stage change writes an immutable movement
--   row, so "how long did this sit in Demo Sent" can be answered later.
--
--   Leads: sales_prospects / sales_prospect_notes / sales_prospect_scans.
--   An admin scans an area on Google Maps (leads-admin + leads-scan-background,
--   service role) for detailers, tint shops, car washes and the rest. A scan
--   turns up hundreds of businesses nobody has called; dropped straight into
--   the Pipeline they would bury the ten leads somebody is working, so they
--   wait here until "Add to Pipeline" makes one somebody's lead.
--
-- Only super admins sell, so every policy is is_super_admin(auth.uid())
-- (SECURITY DEFINER, from the RLS hardening work). The admin reads and writes
-- these tables straight from the browser, like adminUsers.js does profiles.
-- Prospect rows come only from the scanner; the browser may change a
-- prospect's status and nothing else, so nobody edits what Google said.
--
-- Additive: no existing table, policy or grant is touched.
-- Applied to ktnouhjikmlxlbxcxyif on 2026-10-05 via Supabase MCP, with the owner's approval.

begin;

-- ---------------------------------------------------------------------------
-- sales_stages: the columns, as rows
-- ---------------------------------------------------------------------------
-- Rows, not an enum, so the sales process can change without a deploy. `kind`
-- tells the board which columns end a lead: won and lost leads leave the open
-- pipeline total, and won ones drop off the board after a week.
create table if not exists public.sales_stages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 1 and 60),
  sort_order int  not null default 0,
  active     boolean not null default true,
  kind       text not null default 'open' check (kind in ('open', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_stages_order_idx on public.sales_stages (sort_order, name);

drop trigger if exists set_updated_at_sales_stages on public.sales_stages;
create trigger set_updated_at_sales_stages before update on public.sales_stages
  for each row execute function public.tg_set_updated_at();

-- Seeded once. on conflict do nothing, so re-running never undoes a rename
-- made from Edit stages.
insert into public.sales_stages (name, sort_order, kind) values
  ('New Lead',   10, 'open'),
  ('Contacted',  20, 'open'),
  ('Demo Sent',  30, 'open'),
  ('Follow Up',  40, 'open'),
  ('Onboarding', 50, 'open'),
  ('Won',        60, 'won'),
  ('Lost',       70, 'lost')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- sales_leads
-- ---------------------------------------------------------------------------
-- No unique name: two admins writing down the same shop is a warning in the
-- add form, not an insert error.
create table if not exists public.sales_leads (
  id                 uuid primary key default gen_random_uuid(),

  company_name       text not null check (char_length(company_name) between 1 and 200),
  contact_name       text,
  email              text,
  phone              text,
  website            text,
  address            text,
  city               text,
  state              text,
  zip                text,
  lat                double precision,
  lng                double precision,
  -- One of the builder's business types (src/data/businessTypes.js), when known.
  business_type      text,

  stage_id           uuid not null references public.sales_stages(id) on delete restrict,
  owner_id           uuid references public.profiles(id) on delete set null,
  created_by         uuid references public.profiles(id) on delete set null,
  source             text,
  est_monthly_value  numeric(12, 2) check (est_monthly_value is null or est_monthly_value >= 0),
  next_action_on     date,
  lost_reason        text check (lost_reason is null or char_length(lost_reason) <= 200),

  -- What the lead became: an account in the builder, and/or a custom
  -- website project. Either one means "they bought".
  account_user_id    uuid references public.profiles(id) on delete set null,
  custom_project_id  uuid references public.custom_site_projects(id) on delete set null,
  converted_at       timestamptz,

  -- "How long has this sat here". updated_at can't answer it: editing a phone
  -- number would reset the clock. Stamped by sales_leads_stage_entered.
  stage_entered_at   timestamptz not null default now(),

  archived_at        timestamptz,
  archived_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists sales_leads_stage_idx on public.sales_leads (stage_id) where archived_at is null;
create index if not exists sales_leads_owner_idx on public.sales_leads (owner_id, archived_at);
create index if not exists sales_leads_next_action_idx on public.sales_leads (next_action_on)
  where archived_at is null and next_action_on is not null;

drop trigger if exists set_updated_at_sales_leads on public.sales_leads;
create trigger set_updated_at_sales_leads before update on public.sales_leads
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- sales_lead_movements: one row per step of the journey
-- ---------------------------------------------------------------------------
-- Rows rather than a jsonb array on the lead: concurrent moves can't lose
-- history. from_stage_id is null exactly once per lead, on creation.
create table if not exists public.sales_lead_movements (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.sales_leads(id) on delete cascade,
  from_stage_id uuid references public.sales_stages(id) on delete set null,
  to_stage_id   uuid not null references public.sales_stages(id) on delete restrict,
  moved_by      uuid references public.profiles(id) on delete set null,
  note          text not null default '' check (char_length(note) <= 500),
  created_at    timestamptz not null default now()
);

create index if not exists sales_lead_movements_lead_idx on public.sales_lead_movements (lead_id, created_at);

create table if not exists public.sales_lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.sales_leads(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists sales_lead_notes_lead_idx on public.sales_lead_notes (lead_id, created_at);

-- ---------------------------------------------------------------------------
-- Journey invariants, kept by the database
-- ---------------------------------------------------------------------------
-- 1. Every lead opens with a movement row. Written by a second request from
--    the browser, a dropped connection would leave a journey that starts
--    nowhere.
-- 2. stage_entered_at follows stage_id, so no caller can forget it.
-- Moves themselves stay browser-written, because they carry a note.
create or replace function public.sales_leads_log_initial_movement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.sales_lead_movements (lead_id, from_stage_id, to_stage_id, moved_by, note)
  values (new.id, null, new.stage_id, new.created_by, '');
  return new;
end;
$$;

drop trigger if exists sales_leads_initial_movement on public.sales_leads;
create trigger sales_leads_initial_movement after insert on public.sales_leads
  for each row execute function public.sales_leads_log_initial_movement();

create or replace function public.sales_leads_stamp_stage_entered()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists sales_leads_stage_entered on public.sales_leads;
create trigger sales_leads_stage_entered before update on public.sales_leads
  for each row execute function public.sales_leads_stamp_stage_entered();

-- ---------------------------------------------------------------------------
-- sales_prospect_scans: one row per scan
-- ---------------------------------------------------------------------------
-- Claimed by leads-admin (which resolves the area first, so a typo fails on
-- the spot), run by leads-scan-background. The page polls the row for
-- progress, and a failed scan leaves its error here instead of a quietly
-- stale list.
create table if not exists public.sales_prospect_scans (
  id            uuid primary key default gen_random_uuid(),
  area_query    text not null,
  area_label    text not null,
  center_lat    double precision not null,
  center_lng    double precision not null,
  radius_mi     numeric(5, 1) not null check (radius_mi > 0 and radius_mi <= 100),
  categories    text[] not null default '{}',
  requested_by  uuid references public.profiles(id) on delete set null,
  -- started_at is the claim; run_started_at is set once, by the background
  -- function that takes the claim, so a retried request can't run it twice.
  started_at    timestamptz not null default now(),
  run_started_at timestamptz,
  finished_at   timestamptz,
  requests      integer not null default 0,
  found         integer not null default 0,
  added         integer not null default 0,
  matched       integer not null default 0,
  capped        boolean not null default false,
  skipped       integer not null default 0,
  error         text
);

create index if not exists sales_prospect_scans_started_idx on public.sales_prospect_scans (started_at desc);

-- One scan at a time, however close together two presses land: a single
-- unfinished row is allowed. The scanner closes rows a killed function left.
create unique index if not exists sales_prospect_scans_one_running
  on public.sales_prospect_scans ((true)) where finished_at is null;

-- ---------------------------------------------------------------------------
-- sales_prospects: businesses found on Google Maps
-- ---------------------------------------------------------------------------
create table if not exists public.sales_prospects (
  id              uuid primary key default gen_random_uuid(),

  -- Google's place id: the one field Google lets us keep indefinitely, and
  -- the key a rescan upserts on.
  place_id        text not null unique,
  name            text not null,
  -- One of the builder's business types (src/lib/leadCategories.js).
  category        text not null,
  google_type     text,

  address         text,
  city            text,
  county          text,
  state           text,
  zip             text,
  lat             double precision not null,
  lng             double precision not null,

  phone           text,
  website         text,
  -- none / social (a Facebook or Instagram page) / builder (Wix, GoDaddy...)
  -- / own. The reason this list exists: "none" and "social" need a website.
  website_kind    text not null default 'none' check (website_kind in ('none', 'social', 'builder', 'own')),
  rating          numeric(2, 1),
  rating_count    integer,

  -- Label of the last scan that found it ("Kissimmee, FL, USA · 10 mi").
  area            text,
  scan_id         uuid references public.sales_prospect_scans(id) on delete set null,

  -- Already has a builder account (sure matches only: same Google place,
  -- same phone, or same name in the same town). Kept off New so nobody
  -- cold-calls a customer. not_user_ids remembers "Not this account".
  match_user_id   uuid references public.profiles(id) on delete set null,
  match_reason    text,
  not_user_ids    uuid[] not null default '{}',

  status          text not null default 'new' check (status in ('new', 'piped', 'dismissed')),
  lead_id         uuid references public.sales_leads(id) on delete set null,
  dismiss_reason  text check (dismiss_reason is null or char_length(dismiss_reason) <= 200),
  status_note     text check (status_note is null or char_length(status_note) <= 2000),
  status_by       uuid references public.profiles(id) on delete set null,
  status_at       timestamptz,

  -- first_seen_at never moves; last_seen_at is stamped by every scan that
  -- still finds the place.
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sales_prospects_status_idx on public.sales_prospects (status, category);
create index if not exists sales_prospects_lead_idx on public.sales_prospects (lead_id) where lead_id is not null;

drop trigger if exists set_updated_at_sales_prospects on public.sales_prospects;
create trigger set_updated_at_sales_prospects before update on public.sales_prospects
  for each row execute function public.tg_set_updated_at();

-- Who decided, and when, stamped by the database rather than trusted from the
-- browser. Any change to the verdict re-stamps it. The scanner (service role,
-- no auth.uid()) keeps whatever it sends.
create or replace function public.sales_prospects_stamp_status()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and (
    new.status is distinct from old.status
    or new.dismiss_reason is distinct from old.dismiss_reason
    or new.status_note is distinct from old.status_note
  ) then
    new.status_by := auth.uid();
    new.status_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists sales_prospects_stamp_status on public.sales_prospects;
create trigger sales_prospects_stamp_status before update on public.sales_prospects
  for each row execute function public.sales_prospects_stamp_status();

create table if not exists public.sales_prospect_notes (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.sales_prospects(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists sales_prospect_notes_prospect_idx on public.sales_prospect_notes (prospect_id, created_at);

-- A note added after the business went to the Pipeline belongs on the lead's
-- timeline too; the lead is where it gets read from then on.
create or replace function public.sales_prospect_notes_to_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lead uuid;
begin
  select lead_id into v_lead from public.sales_prospects where id = new.prospect_id;
  if v_lead is not null and exists (select 1 from public.sales_leads where id = v_lead) then
    insert into public.sales_lead_notes (lead_id, author_id, body, created_at)
    values (v_lead, new.author_id, left(new.body, 4000), new.created_at);
  end if;
  return new;
end;
$$;

drop trigger if exists sales_prospect_notes_to_lead on public.sales_prospect_notes;
create trigger sales_prospect_notes_to_lead after insert on public.sales_prospect_notes
  for each row execute function public.sales_prospect_notes_to_lead();

-- ---------------------------------------------------------------------------
-- RLS: super admins only
-- ---------------------------------------------------------------------------
-- (select ...) so the check runs once per statement, not once per row: the
-- Leads tab reads thousands of prospects.
alter table public.sales_stages          enable row level security;
alter table public.sales_leads           enable row level security;
alter table public.sales_lead_movements  enable row level security;
alter table public.sales_lead_notes      enable row level security;
alter table public.sales_prospects       enable row level security;
alter table public.sales_prospect_notes  enable row level security;
alter table public.sales_prospect_scans  enable row level security;

drop policy if exists sales_stages_admin on public.sales_stages;
create policy sales_stages_admin on public.sales_stages
  for all to authenticated
  using ((select public.is_super_admin(auth.uid())))
  with check ((select public.is_super_admin(auth.uid())));

drop policy if exists sales_leads_admin on public.sales_leads;
create policy sales_leads_admin on public.sales_leads
  for all to authenticated
  using ((select public.is_super_admin(auth.uid())))
  with check ((select public.is_super_admin(auth.uid())));

-- Append-only: no update or delete policy, so the history can't be rewritten
-- with the anon key, not even by its author.
drop policy if exists sales_lead_movements_read on public.sales_lead_movements;
create policy sales_lead_movements_read on public.sales_lead_movements
  for select to authenticated
  using ((select public.is_super_admin(auth.uid())));

drop policy if exists sales_lead_movements_insert on public.sales_lead_movements;
create policy sales_lead_movements_insert on public.sales_lead_movements
  for insert to authenticated
  with check ((select public.is_super_admin(auth.uid())) and moved_by = auth.uid());

drop policy if exists sales_lead_notes_read on public.sales_lead_notes;
create policy sales_lead_notes_read on public.sales_lead_notes
  for select to authenticated
  using ((select public.is_super_admin(auth.uid())));

drop policy if exists sales_lead_notes_insert on public.sales_lead_notes;
create policy sales_lead_notes_insert on public.sales_lead_notes
  for insert to authenticated
  with check ((select public.is_super_admin(auth.uid())) and author_id = auth.uid());

drop policy if exists sales_lead_notes_delete on public.sales_lead_notes;
create policy sales_lead_notes_delete on public.sales_lead_notes
  for delete to authenticated
  using ((select public.is_super_admin(auth.uid())));

drop policy if exists sales_prospects_read on public.sales_prospects;
create policy sales_prospects_read on public.sales_prospects
  for select to authenticated
  using ((select public.is_super_admin(auth.uid())));

-- The browser only moves a business between New and Not a fit. Piping goes
-- through sales_prospect_to_pipe, so a lead and its "In Pipeline" row are
-- written together or not at all.
drop policy if exists sales_prospects_update_status on public.sales_prospects;
create policy sales_prospects_update_status on public.sales_prospects
  for update to authenticated
  using ((select public.is_super_admin(auth.uid())) and status in ('new', 'dismissed'))
  with check ((select public.is_super_admin(auth.uid())) and status in ('new', 'dismissed'));

revoke insert, update, delete on public.sales_prospects from anon, authenticated;
grant select on public.sales_prospects to authenticated;
grant update (status, dismiss_reason, status_note) on public.sales_prospects to authenticated;

drop policy if exists sales_prospect_notes_read on public.sales_prospect_notes;
create policy sales_prospect_notes_read on public.sales_prospect_notes
  for select to authenticated
  using ((select public.is_super_admin(auth.uid())));

drop policy if exists sales_prospect_notes_insert on public.sales_prospect_notes;
create policy sales_prospect_notes_insert on public.sales_prospect_notes
  for insert to authenticated
  with check ((select public.is_super_admin(auth.uid())) and author_id = auth.uid());

drop policy if exists sales_prospect_notes_delete on public.sales_prospect_notes;
create policy sales_prospect_notes_delete on public.sales_prospect_notes
  for delete to authenticated
  using ((select public.is_super_admin(auth.uid())));

-- Scans are written only by the functions (service role).
drop policy if exists sales_prospect_scans_read on public.sales_prospect_scans;
create policy sales_prospect_scans_read on public.sales_prospect_scans
  for select to authenticated
  using ((select public.is_super_admin(auth.uid())));

revoke insert, update, delete on public.sales_prospect_scans from anon, authenticated;
grant select on public.sales_prospect_scans to authenticated;

-- ---------------------------------------------------------------------------
-- sales_prospect_to_pipe: one click from a found business to a lead
-- ---------------------------------------------------------------------------
-- One transaction, so a dropped connection can't leave a lead in the Pipeline
-- while the business still reads "New" (and gets piped a second time).
-- Idempotent: a business already in the Pipeline hands back its lead.
-- p_owner lets an admin file the lead for another admin; default is the caller.
-- Returns { lead_id, created }.
create or replace function public.sales_prospect_to_pipe(
  p_prospect_id uuid,
  p_note text default null,
  p_owner uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me    uuid := auth.uid();
  v_owner uuid := coalesce(p_owner, auth.uid());
  v_p     public.sales_prospects%rowtype;
  v_stage uuid;
  v_lead  uuid;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_me is null or not public.is_super_admin(v_me) then
    raise exception 'not permitted';
  end if;
  if v_owner <> v_me and not public.is_super_admin(v_owner) then
    raise exception 'the owner must be an admin';
  end if;

  select * into v_p from public.sales_prospects where id = p_prospect_id for update;
  if not found then
    raise exception 'that business is gone';
  end if;

  if v_p.lead_id is not null and exists (select 1 from public.sales_leads where id = v_p.lead_id) then
    -- Already in the Pipeline. Make the row say so if it somehow doesn't.
    if v_p.status <> 'piped' then
      update public.sales_prospects set status = 'piped' where id = v_p.id;
    end if;
    return jsonb_build_object('lead_id', v_p.lead_id, 'created', false);
  end if;

  select id into v_stage from public.sales_stages
   where active and kind = 'open'
   order by sort_order, name
   limit 1;
  if v_stage is null then
    raise exception 'the Pipeline has no open stage to put it in';
  end if;

  insert into public.sales_leads (
    company_name, phone, website, address, city, state, zip, lat, lng, business_type,
    stage_id, owner_id, created_by, source
  ) values (
    v_p.name, v_p.phone, v_p.website, v_p.address, v_p.city, v_p.state, v_p.zip, v_p.lat, v_p.lng, v_p.category,
    v_stage, v_owner, v_me, 'Leads finder'
  )
  returning id into v_lead;

  -- What the scan knew that a lead has no column for.
  insert into public.sales_lead_notes (lead_id, author_id, body)
  values (
    v_lead, v_me,
    left(concat_ws(E'\n',
      'Found by the Leads finder (Google Maps).',
      nullif(concat_ws(' · ',
        v_p.google_type,
        case when v_p.rating is not null
             then v_p.rating::text || '★ (' || coalesce(v_p.rating_count, 0) || ' reviews)' end
      ), ''),
      case v_p.website_kind
        when 'none' then 'No website on Google.'
        when 'social' then 'Only a social page: ' || coalesce(v_p.website, '')
        when 'builder' then 'Site-builder page: ' || coalesce(v_p.website, '')
        else 'Website: ' || coalesce(v_p.website, '')
      end
    ), 4000)
  );

  -- The thread from the Leads tab comes along, authors and times intact.
  insert into public.sales_lead_notes (lead_id, author_id, body, created_at)
  select v_lead, n.author_id, left(n.body, 4000), n.created_at
    from public.sales_prospect_notes n
   where n.prospect_id = v_p.id
   order by n.created_at;

  if v_note is not null then
    insert into public.sales_lead_notes (lead_id, author_id, body, created_at)
    values (v_lead, v_me, left(v_note, 4000), clock_timestamp());
  end if;

  update public.sales_prospects
     set status = 'piped', lead_id = v_lead, dismiss_reason = null, status_note = null
   where id = v_p.id;

  return jsonb_build_object('lead_id', v_lead, 'created', true);
end;
$$;

comment on function public.sales_prospect_to_pipe(uuid, text, uuid) is
  'Turn a found business into a Pipeline lead (owner p_owner or the caller) and mark it piped. '
  'Returns { lead_id, created }; calling it again returns the same lead.';

revoke all on function public.sales_prospect_to_pipe(uuid, text, uuid) from public, anon;
grant execute on function public.sales_prospect_to_pipe(uuid, text, uuid) to authenticated;

-- "Not this account": the match was wrong. Back to New, and the scanner never
-- pairs the two again. Acts only if the row still points at the account the
-- admin was shown, so two admins answering at once can't clobber each other.
create or replace function public.sales_prospect_unmatch(p_prospect_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_super_admin(auth.uid()) then
    raise exception 'not permitted';
  end if;
  update public.sales_prospects
     set match_user_id = null,
         match_reason = null,
         not_user_ids = array_append(array_remove(not_user_ids, p_user_id), p_user_id)
   where id = p_prospect_id and match_user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.sales_prospect_unmatch(uuid, uuid) from public, anon;
grant execute on function public.sales_prospect_unmatch(uuid, uuid) to authenticated;

-- Trigger functions only: nobody calls these over the API.
revoke all on function public.sales_leads_log_initial_movement() from public, anon, authenticated;
revoke all on function public.sales_prospect_notes_to_lead() from public, anon, authenticated;
revoke all on function public.sales_leads_stamp_stage_entered() from public, anon, authenticated;
revoke all on function public.sales_prospects_stamp_status() from public, anon, authenticated;

commit;
