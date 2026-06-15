# Overview Dashboard + View Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add view tracking and a new default **Overview** dashboard showing booking-page views, website views, bookings, conversion, and deposits over a selectable time range, with a views-over-time chart and recent bookings; relocate the booking-link card from the Sites cards into Booking Settings.

**Architecture:** `scheduler.js` (already on every published page) fires a `sendBeacon` view event to a new `track-view` function → `page_views` table (RLS-private). The Overview reads aggregates via one `get_overview` Postgres RPC (security definer). Navigation gains an Overview (default) and a Sites item.

**Tech Stack:** React 19 (state-based nav, no router), Tailwind (tokens in `src/design-tokens.js`), Supabase JS + RPC, Netlify functions, Vitest. No new dependencies (chart is inline SVG).

**Spec:** `docs/superpowers/specs/2026-06-09-overview-dashboard-design.md`

---

## File Structure

**Create:**
- `db/migrations/20260609_page_views.sql` — table, indexes, RLS, `get_overview` RPC, grants
- `netlify/functions/_lib/track-view-core.js` — pure parse/validate (tested)
- `tests/functions/track-view-core.test.js`
- `netlify/functions/track-view.js` — beacon endpoint
- `src/lib/overview.js` + `src/lib/overview.test.js` — range math (tested) + RPC loader
- `src/components/dashboard/overview/OverviewPage.jsx`
- `src/components/dashboard/overview/StatCard.jsx`
- `src/components/dashboard/overview/TrendChart.jsx`

**Modify:**
- `public/scheduler.js` — fire view beacon
- `src/components/ui/AppHeader.jsx` — Overview + Sites nav items
- `src/App.jsx` — default view `'overview'`, branch, nav callbacks
- `src/components/dashboard/DashboardPage.jsx` — remove ShareBookingCard from site cards
- `src/components/dashboard/booking-settings/SchedulerSettings.jsx` — add ShareBookingCard

---

## Group A — View tracking

### Task 1: `page_views` table + `get_overview` RPC migration

**Files:** Create `db/migrations/20260609_page_views.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Commit** (the controller applies it to Supabase before the smoke test)

```bash
git add db/migrations/20260609_page_views.sql
git commit -m "feat(db): page_views table + get_overview RPC for analytics"
```

---

### Task 2: `track-view-core` parse/validate helper (TDD)

**Files:** Create `netlify/functions/_lib/track-view-core.js`, `tests/functions/track-view-core.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { parseTrackView } from '../../netlify/functions/_lib/track-view-core.js';

describe('parseTrackView', () => {
  const ok = '11111111-2222-4333-8444-555555555555';
  it('accepts a valid site view', () => {
    expect(parseTrackView(JSON.stringify({ siteId: ok, kind: 'site' })))
      .toEqual({ siteId: ok, kind: 'site', referrer_host: null });
  });
  it('accepts a booking view and extracts referrer host', () => {
    const r = parseTrackView(JSON.stringify({ siteId: ok, kind: 'booking', referrer: 'https://instagram.com/p/abc' }));
    expect(r).toEqual({ siteId: ok, kind: 'booking', referrer_host: 'instagram.com' });
  });
  it('accepts an already-parsed object', () => {
    expect(parseTrackView({ siteId: ok, kind: 'site' }).siteId).toBe(ok);
  });
  it('rejects bad kind', () => {
    expect(parseTrackView(JSON.stringify({ siteId: ok, kind: 'hack' }))).toBeNull();
  });
  it('rejects non-uuid siteId', () => {
    expect(parseTrackView(JSON.stringify({ siteId: 'nope', kind: 'site' }))).toBeNull();
  });
  it('rejects malformed JSON', () => {
    expect(parseTrackView('{not json')).toBeNull();
  });
  it('tolerates a junk referrer (null host)', () => {
    expect(parseTrackView(JSON.stringify({ siteId: ok, kind: 'site', referrer: 'not a url' })).referrer_host).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/functions/track-view-core.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `netlify/functions/_lib/track-view-core.js`**

```javascript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pure parse/validate for the track-view beacon. Returns
// { siteId, kind, referrer_host } or null if invalid.
export function parseTrackView(body) {
  let data;
  if (typeof body === 'string') {
    try { data = JSON.parse(body); } catch { return null; }
  } else if (body && typeof body === 'object') {
    data = body;
  } else {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const siteId = data.siteId;
  const kind = data.kind;
  if (typeof siteId !== 'string' || !UUID_RE.test(siteId)) return null;
  if (kind !== 'site' && kind !== 'booking') return null;
  let referrer_host = null;
  if (typeof data.referrer === 'string' && data.referrer) {
    try { referrer_host = new URL(data.referrer).host || null; } catch { referrer_host = null; }
  }
  return { siteId, kind, referrer_host };
}
```

- [ ] **Step 4: Run — expect PASS (7 tests)**

Run: `npx vitest run tests/functions/track-view-core.test.js`

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/track-view-core.js tests/functions/track-view-core.test.js
git commit -m "feat(track-view): parse/validate helper for view beacons"
```

---

### Task 3: `track-view` Netlify function

**Files:** Create `netlify/functions/track-view.js`

- [ ] **Step 1: Implement**

```javascript
import { createClient } from '@supabase/supabase-js';
import { parseTrackView } from './_lib/track-view-core.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Public beacon endpoint hit by scheduler.js on every published page load.
// Records one page_views row. Always returns 204 (beacons ignore the body);
// junk input is silently dropped so we never throw on the client.
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '' };

  const parsed = parseTrackView(event.body);
  if (!parsed) return { statusCode: 204, headers: CORS, body: '' };

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Cheap existence check so a bogus (but well-formed) UUID can't spam rows.
    const { data: site } = await supabase.from('sites').select('id').eq('id', parsed.siteId).maybeSingle();
    if (site) {
      await supabase.from('page_views').insert({
        site_id: parsed.siteId,
        kind: parsed.kind,
        referrer_host: parsed.referrer_host,
      });
    }
  } catch (err) {
    console.error('track-view error:', err.message);
  }
  return { statusCode: 204, headers: CORS, body: '' };
};
```

- [ ] **Step 2: Verify the function suite still passes & build**

Run: `npx vitest run tests/functions/ && npm run build`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/track-view.js
git commit -m "feat(track-view): record page_views via service role"
```

---

### Task 4: Fire the view beacon from `scheduler.js`

**Files:** Modify `public/scheduler.js`

- [ ] **Step 1: Add the beacon**

In `public/scheduler.js`, locate where `var API = script.src.replace(/\/scheduler\.js.*$/, '');` is defined (after `siteId` and `fullPage` are known). Immediately AFTER that line, add:

```javascript
  // Fire a one-shot page-view beacon (skips owner previews). Independent of
  // whether the scheduler is enabled, so website views count too.
  if (siteId && !previewMode) {
    try {
      var viewUrl = API + '/.netlify/functions/track-view';
      var viewPayload = JSON.stringify({
        siteId: siteId,
        kind: fullPage ? 'booking' : 'site',
        referrer: (document && document.referrer) || ''
      });
      if (navigator && navigator.sendBeacon) {
        navigator.sendBeacon(viewUrl, new Blob([viewPayload], { type: 'application/json' }));
      } else {
        fetch(viewUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: viewPayload, keepalive: true });
      }
    } catch (e) { /* never let tracking break the page */ }
  }
```

Confirm `fullPage` and `previewMode` are declared before this point (they are — `previewMode` near the top, `fullPage` added in the standalone-booking feature). Match the file's ES5 `var` style.

- [ ] **Step 2: Build (Vite copies scheduler.js verbatim)**

Run: `npm run build`
Expected: success. Also run `node --check public/scheduler.js` → no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add public/scheduler.js
git commit -m "feat(track-view): fire page-view beacon from scheduler.js"
```

---

## Group B — Overview data + UI

### Task 5: `overview.js` range math + RPC loader (TDD)

**Files:** Create `src/lib/overview.js`, `src/lib/overview.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { rangeToDates } from './overview.js';

describe('rangeToDates', () => {
  const now = new Date('2026-06-30T00:00:00.000Z');
  it('30 days → since 30d back, prev window another 30d back', () => {
    const { since, prevSince } = rangeToDates(30, now);
    expect(since).toBe('2026-05-31T00:00:00.000Z');
    expect(prevSince).toBe('2026-05-01T00:00:00.000Z');
  });
  it('7 days', () => {
    expect(rangeToDates(7, now).since).toBe('2026-06-23T00:00:00.000Z');
  });
  it("'all' → epoch for both bounds", () => {
    const r = rangeToDates('all', now);
    expect(r.since).toBe('1970-01-01T00:00:00.000Z');
    expect(r.prevSince).toBe('1970-01-01T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/overview.test.js`

- [ ] **Step 3: Implement `src/lib/overview.js`**

```javascript
import { supabase } from './supabase.js';

const DAY_MS = 86400000;

// Returns ISO { since, prevSince }. The previous window is the equal-length
// span immediately before `since`, used for vs-previous deltas.
export function rangeToDates(rangeDays, now = new Date()) {
  if (rangeDays === 'all') {
    const epoch = new Date(0).toISOString();
    return { since: epoch, prevSince: epoch };
  }
  const ms = rangeDays * DAY_MS;
  return {
    since: new Date(now.getTime() - ms).toISOString(),
    prevSince: new Date(now.getTime() - 2 * ms).toISOString(),
  };
}

// Calls the get_overview RPC and returns the aggregate object.
export async function loadOverview(rangeDays) {
  const { since, prevSince } = rangeToDates(rangeDays);
  const { data, error } = await supabase.rpc('get_overview', { p_since: since, p_prev_since: prevSince });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run — expect PASS (3 tests)**

Run: `npx vitest run src/lib/overview.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/lib/overview.js src/lib/overview.test.js
git commit -m "feat(overview): range math + get_overview RPC loader"
```

---

### Task 6: Presentational `StatCard` + `TrendChart`

**Files:** Create `src/components/dashboard/overview/StatCard.jsx`, `src/components/dashboard/overview/TrendChart.jsx`

- [ ] **Step 1: Create `StatCard.jsx`**

```jsx
// A single metric tile. `delta` (number|null) shows a vs-previous arrow when provided.
export default function StatCard({ label, value, sub, delta }) {
  const showDelta = typeof delta === 'number' && isFinite(delta);
  const up = showDelta && delta >= 0;
  return (
    <div className="bg-white border border-black/[0.07] rounded-2xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-[#888]">{label}</div>
      <div className="text-[26px] font-extrabold mt-1.5 leading-none text-[#1a1a1a]">{value}</div>
      {showDelta && (
        <div className={`text-[11px] mt-1.5 font-bold ${up ? 'text-[#16a34a]' : 'text-[#cc0000]'}`}>
          {up ? '▲' : '▼'} {Math.abs(delta)}% vs prev
        </div>
      )}
      {sub && !showDelta && <div className="text-[11px] mt-1.5 font-semibold text-[#888]">{sub}</div>}
      {sub && showDelta && <div className="text-[11px] mt-0.5 font-semibold text-[#888]">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create `TrendChart.jsx`**

```jsx
// Lightweight inline-SVG stacked bar chart of booking vs website views.
// `series`: [{ bucket: 'YYYY-MM-DD', booking_views, site_views }]. No deps.
export default function TrendChart({ series }) {
  const data = Array.isArray(series) ? series : [];
  if (data.length === 0) {
    return <div className="text-[13px] text-[#888] py-10 text-center">No views yet for this period.</div>;
  }
  // Bucket to at most ~14 columns for readability.
  const step = Math.ceil(data.length / 14);
  const cols = [];
  for (let i = 0; i < data.length; i += step) {
    const slice = data.slice(i, i + step);
    cols.push({
      label: slice[0].bucket?.slice(5) || '',
      booking: slice.reduce((s, d) => s + (d.booking_views || 0), 0),
      site: slice.reduce((s, d) => s + (d.site_views || 0), 0),
    });
  }
  const max = Math.max(1, ...cols.map((c) => c.booking + c.site));
  const W = 100, H = 60, gap = 1.5;
  const bw = (W - gap * (cols.length - 1)) / cols.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full" preserveAspectRatio="none" style={{ height: 170 }}>
        {cols.map((c, i) => {
          const x = i * (bw + gap);
          const bH = ((c.booking + c.site) / max) * H;
          const bookH = ((c.booking) / max) * H;
          const y = H - bH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={bH - bookH} fill="#cbd5e1" rx="0.6" />
              <rect x={x} y={H - bookH} width={bw} height={bookH} fill="#2563eb" rx="0.6" />
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-[12px] text-[#4a4a4a] mt-3">
        <span><span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#2563eb] mr-1.5 align-middle" />Booking page</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#cbd5e1] mr-1.5 align-middle" />Website</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build` → success.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/overview/StatCard.jsx src/components/dashboard/overview/TrendChart.jsx
git commit -m "feat(overview): StatCard + inline-SVG TrendChart"
```

---

### Task 7: `OverviewPage`

**Files:** Create `src/components/dashboard/overview/OverviewPage.jsx`

> Mirrors the structure of other dashboard pages: renders `AppHeader` (active='overview') with the same nav callbacks they receive, then page content. Reuses `formatPrice` if present for money; otherwise formats cents inline.

- [ ] **Step 1: Implement**

```jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { loadOverview } from '../../../lib/overview.js';
import AppHeader from '../../ui/AppHeader.jsx';
import StatCard from './StatCard.jsx';
import TrendChart from './TrendChart.jsx';
import ShareBookingCard from '../booking-only/ShareBookingCard.jsx';

const RANGES = [{ k: 7, l: '7d' }, { k: 30, l: '30d' }, { k: 90, l: '90d' }, { k: 'all', l: 'All' }];

function money(cents) {
  const n = (cents || 0) / 100;
  return n % 1 === 0 ? `$${n.toLocaleString()}` : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
function bookingUrlFor(site) {
  if (!site?.published_url) return '';
  return site.site_type === 'booking_only' ? site.published_url : `${site.published_url}/book`;
}

export default function OverviewPage(navProps) {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [site, setSite] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadOverview(range)
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range]);

  useEffect(() => {
    supabase.from('bookings')
      .select('customer_name, service_name, status, created_at')
      .order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setRecent(data || []));
    supabase.from('sites')
      .select('published_url, site_type, scheduler_enabled')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data || [];
        setSite(list.find((s) => s.site_type === 'booking_only' || s.scheduler_enabled) || list[0] || null);
      });
  }, []);

  const conv = data && data.booking_views > 0
    ? `${Math.round((data.bookings_total / data.booking_views) * 1000) / 10}%`
    : '—';

  return (
    <>
      <AppHeader active="overview" {...navProps} />
      <div className="max-w-[1000px] mx-auto px-5 py-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-[21px] font-extrabold text-[#1a1a1a]">Overview</h1>
            <p className="text-[13px] text-[#888] mt-0.5">How your booking page is performing</p>
          </div>
          <div className="flex border border-black/[0.12] rounded-[9px] overflow-hidden">
            {RANGES.map((r) => (
              <button key={r.l} onClick={() => setRange(r.k)}
                className={`text-[12px] font-bold px-3.5 py-1.5 ${range === r.k ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#4a4a4a]'}`}>
                {r.l}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="text-[14px] text-[#888] py-16 text-center">Loading…</div>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <StatCard label="Booking views" value={(data.booking_views || 0).toLocaleString()} delta={pct(data.booking_views, data.booking_views_prev)} />
              <StatCard label="Website views" value={(data.site_views || 0).toLocaleString()} delta={pct(data.site_views, data.site_views_prev)} />
              <StatCard label="Bookings" value={data.bookings_total || 0} sub={`${data.bookings_pending || 0} pending · ${data.bookings_confirmed || 0} confirmed`} />
              <StatCard label="Conversion" value={conv} sub="views → bookings" />
              <StatCard label="Deposits" value={money(data.deposits_cents)} sub={`${money(data.booked_value_cents)} booked value`} />
            </div>

            <div className="bg-white border border-black/[0.07] rounded-2xl p-[18px] mb-4">
              <h3 className="text-[15px] font-bold text-[#1a1a1a]">Views over time</h3>
              <p className="text-[12px] text-[#888] mb-3.5">Booking page vs website</p>
              <TrendChart series={data.series} />
            </div>

            <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
              <div className="bg-white border border-black/[0.07] rounded-2xl p-[18px]">
                <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-3">Recent bookings</h3>
                {recent.length === 0 && <p className="text-[13px] text-[#888]">No bookings yet.</p>}
                {recent.map((b, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-t border-black/[0.06] first:border-t-0 text-[13px]">
                    <span className="text-[#1a1a1a] truncate">{b.customer_name}{b.service_name ? ` · ${b.service_name}` : ''}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-[#dcfce7] text-[#166534]' : b.status === 'pending' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-black/[0.06] text-[#4a4a4a]'}`}>{b.status}</span>
                  </div>
                ))}
              </div>
              <div>
                {site ? <ShareBookingCard bookingUrl={bookingUrlFor(site)} /> : null}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build` → success.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/overview/OverviewPage.jsx
git commit -m "feat(overview): OverviewPage composing stats, chart, recent bookings, link"
```

---

### Task 8: Wire Overview into navigation (default landing + nav items)

**Files:** Modify `src/components/ui/AppHeader.jsx`, `src/App.jsx`, and every page component that renders `<AppHeader>`.

- [ ] **Step 1: AppHeader — add Overview + rename Sites**

In `src/components/ui/AppHeader.jsx`:
1. Add `onOpenOverview,` to the destructured props (near `onMySites`).
2. Update the `active` comment to include `'overview'`.
3. Prepend an Overview item and rename the existing Sites label. Change the `navItems` array's first entries to:
```javascript
    onOpenOverview && { id: 'overview', label: 'Overview', onClick: onOpenOverview },
    onMySites && { id: 'sites', label: 'Sites', onClick: onMySites },
```
(Keep the rest of the array unchanged.)

- [ ] **Step 2: App.jsx — default view + Overview branch + thread callback**

In `src/App.jsx`:
1. Change `const [view, setView] = useState('dashboard');` → `useState('overview');` and update the inline comment to include `'overview'`.
2. Import: `import OverviewPage from './components/dashboard/overview/OverviewPage.jsx';`
3. Add a branch BEFORE the `dashboard` handling (mirror the wrapper style of the other authenticated views, e.g. the `inquiries` branch which wraps with `<>` + `HelpChrome`):
```jsx
if (view === 'overview') {
  return (
    <>
      <OverviewPage
        profile={profile}
        userEmail={session?.user?.email}
        onMySites={() => setView('dashboard')}
        onOpenInquiries={() => setView('inquiries')}
        onOpenBookings={() => setView('bookings-page')}
        onOpenCustomers={() => setView('customers')}
        onOpenCharges={() => setView('charges')}
        onOpenPaymentsConnect={() => setView('payments-connect')}
        onOpenAdmin={() => setView('admin')}
        onOpenProfile={() => setView('profile')}
        onSignOut={handleSignOut}
      />
      <HelpChrome profile={profile} />
    </>
  );
}
```
(Use the EXACT sign-out handler name and `HelpChrome` usage found elsewhere in the file — read a sibling branch like `view === 'inquiries'` and match it precisely.)
4. For EVERY page that App.jsx renders with nav callbacks (the `<AppHeader>`-bearing pages: DashboardPage, BookingsPage/inquiries/customers/customer-detail/charges/payments-connect/admin/profile/booking-settings), add a prop `onOpenOverview={() => setView('overview')}` to that page's render in App.jsx, alongside the existing `onOpen*` props.

- [ ] **Step 3: Thread `onOpenOverview` through each page to its AppHeader**

For each page component that renders `<AppHeader ...>`, add `onOpenOverview` to its destructured props and pass `onOpenOverview={onOpenOverview}` to its `<AppHeader>`. Find them with: search the repo for `<AppHeader`. Expected files: `DashboardPage.jsx`, `bookings-page/BookingsPage.jsx`, `inquiries-page/InquiriesPage.jsx`, `customers-page/CustomersPage.jsx`, `customers-page/CustomerDetailPage.jsx`, `charges/ChargesPage.jsx`, `payments-connect/PaymentsConnectPage.jsx`, `admin/AdminPage.jsx`, `profile/ProfilePage.jsx`, `booking-settings/BookingSettingsPage.jsx`. In each: (a) accept `onOpenOverview` prop, (b) pass it to `<AppHeader>`. Leave `active` as each page already sets it (DashboardPage's header should use `active="sites"`).

- [ ] **Step 4: Build + tests**

Run: `npm run build && npx vitest run`
Expected: build success; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/ui/AppHeader.jsx src/components/dashboard
git commit -m "feat(overview): default landing + Overview/Sites navigation"
```

---

### Task 9: Relocate the booking link out of Sites cards

**Files:** Modify `src/components/dashboard/DashboardPage.jsx`, `src/components/dashboard/booking-settings/SchedulerSettings.jsx`

- [ ] **Step 1: Remove ShareBookingCard from DashboardPage site cards**

In `src/components/dashboard/DashboardPage.jsx`, remove the block that renders `ShareBookingCard` inside each site card (the `{(site.site_type === 'booking_only' || site.scheduler_enabled) && (<div className="mt-3"><ShareBookingCard .../></div>)}` block). Also remove the now-unused `import ShareBookingCard ...` line and the `bookingUrlFor` helper IF they are no longer referenced anywhere else in the file. (Verify with a search before deleting the helper/import.)

- [ ] **Step 2: Add ShareBookingCard to Booking Settings**

In `src/components/dashboard/booking-settings/SchedulerSettings.jsx`:
1. Import `ShareBookingCard` from `../booking-only/ShareBookingCard.jsx`.
2. Add a `bookingUrlFor(site)` helper (same logic: `site.site_type === 'booking_only' ? site.published_url : `${site.published_url}/book``), or inline it.
3. Render `<ShareBookingCard bookingUrl={bookingUrlFor(site)} />` near the top of the settings content (above the tab strip), using the `site` object already loaded in this component (it has `published_url`, `site_type`). Wrap in a `mb-4` div. ShareBookingCard returns null when the URL is empty, so it's safe before first publish.

- [ ] **Step 3: Build + tests**

Run: `npm run build && npx vitest run`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DashboardPage.jsx src/components/dashboard/booking-settings/SchedulerSettings.jsx
git commit -m "feat(booking): move booking link from Sites cards to Booking Settings"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** view tracking table+RPC (Task 1), beacon endpoint (Tasks 2-3), scheduler.js beacon (Task 4), range math + loader (Task 5), cards/chart (Task 6), Overview page with all 5 metrics + deltas + chart + recent bookings + relocated link (Task 7), default-landing + nav (Task 8), link relocation off Sites cards (Task 9).
- **Metrics:** conversion guarded vs divide-by-zero (`—`); deltas from `*_prev`; deposits + booked value from RPC.
- **Privacy/security:** `page_views` RLS-private (service-role insert, security-definer read); no PII; referrer stored as host only.
- **No new dependency:** chart is inline SVG.
- **Risks for executor:** (a) Task 8 touches many files — be systematic, grep for `<AppHeader`; match each page's existing wrapper/`active` value. (b) Confirm `fullPage`/`previewMode` exist in scheduler.js before the beacon (Task 4). (c) `get_overview` must be applied to Supabase before the smoke test (controller does this). (d) Confirm `SchedulerSettings.jsx` exposes a `site` object with `published_url`/`site_type` (Task 9) — read it first.
```
