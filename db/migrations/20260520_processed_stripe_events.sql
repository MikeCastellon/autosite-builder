-- Event-id deduplication table for Stripe webhooks.
--
-- Stripe webhook deliveries are at-least-once: the same event_id may arrive
-- multiple times (network blips, manual "Resend" in the Stripe Dashboard,
-- or a 500 from us triggering Stripe's retry policy).
--
-- The existing per-row guards in _lib/booking-deposit-handler.js and
-- _lib/stripe-charge-handler.js (`.eq('status', 'pending')`) absorb most
-- practical replay damage but don't catch every event type — subscription
-- and Connect events have no such guard. This table closes the gap.
--
-- Usage pattern in stripe-webhook.js:
--   1) Check for existing event_id BEFORE running handlers → drop replays
--   2) Run handlers as usual
--   3) INSERT after success. INSERT-after (not -before) means a failed
--      handler leaves the event un-recorded, so Stripe's retry will run
--      the handler again — combined with per-row guards, this is safe.
--
-- 2026-04-29 platform audit CC-4 / M8.
-- 2026-05-20 cleanup audit, Tier 1 item 3.
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Service-role only — no policies needed (service role bypasses RLS).
-- The explicit RLS-on-with-no-policies posture matches request_log and
-- impersonation_handoffs in the existing schema.
alter table public.processed_stripe_events enable row level security;

-- Used by a future pg_cron prune job ("delete where processed_at < now() - interval '30 days'")
-- and by debugging queries ordered by recency.
create index if not exists processed_stripe_events_processed_at_idx
  on public.processed_stripe_events (processed_at desc);
