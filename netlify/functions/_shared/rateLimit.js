// Postgres-backed sliding-window rate limit.
//
// Replaces the in-memory `Map`s previously used in create-booking.js and
// support-book.js, which were ineffective in serverless because Netlify
// spawns multiple containers and an attacker fanning parallel requests
// across them would bypass the limit (Security Audit H2 / CC-5).
//
// Storage: `public.request_log(ip text, kind text, ts timestamptz default now())`
// with index on (kind, ip, ts) — created by migration 20260429_request_log.sql.
//
// Fail-open by design: if the DB query errors (Supabase down, table
// missing on a fresh deploy, etc.) we allow the request rather than
// reject. The cost of rejecting legitimate users during an outage is
// higher than letting a few extra calls through, and the underlying
// downstream guards (auth, validation, Stripe idempotency) still apply.
export async function checkAndRecordRateLimit({
  db,
  ip,
  kind,
  windowMs,
  limit,
}) {
  const safeIp = ip || 'unknown';
  const since = new Date(Date.now() - windowMs).toISOString();

  try {
    const { count, error } = await db
      .from('request_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', safeIp)
      .eq('kind', kind)
      .gte('ts', since);

    if (error) {
      console.error('[rateLimit] count failed, failing open:', error.message);
      return { limited: false, count: null };
    }

    if ((count ?? 0) >= limit) {
      return { limited: true, count };
    }

    const { error: insertErr } = await db
      .from('request_log')
      .insert({ ip: safeIp, kind });
    if (insertErr) {
      console.error('[rateLimit] insert failed:', insertErr.message);
    }
    return { limited: false, count };
  } catch (err) {
    console.error('[rateLimit] unexpected error, failing open:', err?.message || err);
    return { limited: false, count: null };
  }
}
