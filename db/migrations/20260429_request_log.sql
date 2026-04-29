-- 20260429_request_log.sql
--
-- Backing store for the Postgres-based rate limiter that replaces the
-- in-memory `Map`s previously used in create-booking.js and
-- support-book.js. (Security Audit H2 / CC-5 — those Maps were per-
-- container so an attacker fanning parallel requests across Netlify's
-- pool of warm containers could trivially exceed the cap.)

begin;

create table if not exists public.request_log (
  id bigserial primary key,
  ip text not null,
  kind text not null,
  ts timestamptz not null default now()
);

create index if not exists request_log_kind_ip_ts_idx
  on public.request_log (kind, ip, ts desc);

-- Time-based pruning so the table stays small. Anything older than 24h
-- is irrelevant to any rate-limit decision (longest window we care
-- about is ~1 hour).
create index if not exists request_log_ts_idx
  on public.request_log (ts);

alter table public.request_log enable row level security;
-- No policies: writes/reads happen only via the service role from the
-- netlify functions, which bypasses RLS. End users have no business
-- reading this table.

comment on table public.request_log is
  'Sliding-window rate-limit ledger. Written by Netlify functions via service role. Pruned by a separate maintenance job.';

commit;
