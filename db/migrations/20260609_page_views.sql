-- Overview dashboard: view tracking + aggregation RPC.
-- page_views is written ONLY by the track-view function (service role) and
-- read ONLY via get_overview (security definer). RLS enabled, no public policies.
-- Apply via Supabase SQL editor as the postgres role.

begin;

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('site','booking')),
  referrer_host text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_site_created_idx
  on public.page_views (site_id, created_at desc);
create index if not exists page_views_site_kind_created_idx
  on public.page_views (site_id, kind, created_at desc);

alter table public.page_views enable row level security;
-- No anon/authenticated policies: inserts via service role, reads via RPC below.

create or replace function public.get_overview(p_since timestamptz, p_prev_since timestamptz)
returns json
language sql
security definer
set search_path = public
as $$
  with my_sites as (
    select id from sites where user_id = auth.uid()
  ),
  v as (
    select kind, created_at from page_views where site_id in (select id from my_sites)
  ),
  cur as (
    select
      count(*) filter (where kind='booking' and created_at >= p_since) as booking_views,
      count(*) filter (where kind='site' and created_at >= p_since) as site_views,
      count(*) filter (where kind='booking' and created_at >= p_prev_since and created_at < p_since) as booking_views_prev,
      count(*) filter (where kind='site' and created_at >= p_prev_since and created_at < p_since) as site_views_prev
    from v
  ),
  b as (
    select
      count(*) as bookings_total,
      count(*) filter (where status='pending') as bookings_pending,
      count(*) filter (where status='confirmed') as bookings_confirmed,
      coalesce(sum(deposit_paid_cents),0) as deposits_cents,
      coalesce(sum(total_cents),0) as booked_value_cents
    from bookings
    where owner_user_id = auth.uid() and created_at >= p_since
  ),
  series as (
    select coalesce(json_agg(t order by t.bucket), '[]'::json) as data
    from (
      select date_trunc('day', created_at)::date as bucket,
        count(*) filter (where kind='booking') as booking_views,
        count(*) filter (where kind='site') as site_views
      from v
      where created_at >= p_since
      group by 1
    ) t
  )
  select json_build_object(
    'booking_views', cur.booking_views,
    'site_views', cur.site_views,
    'booking_views_prev', cur.booking_views_prev,
    'site_views_prev', cur.site_views_prev,
    'bookings_total', b.bookings_total,
    'bookings_pending', b.bookings_pending,
    'bookings_confirmed', b.bookings_confirmed,
    'deposits_cents', b.deposits_cents,
    'booked_value_cents', b.booked_value_cents,
    'series', series.data
  ) from cur, b, series;
$$;

grant execute on function public.get_overview(timestamptz, timestamptz) to authenticated;

commit;
