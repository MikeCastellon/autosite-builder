import { useEffect, useState } from 'react';
import { loadOverview, loadRecentBookings, loadOwnerSites, pickShareSite, overviewMode } from '../../../lib/overview.js';
import StatCard from './StatCard.jsx';
import TrendChart from './TrendChart.jsx';
import ShareBookingCard from '../booking-only/ShareBookingCard.jsx';
import { bookingShareUrl } from '../../../lib/bookingUrl.js';

const RANGES = [{ k: 7, l: '7d' }, { k: 30, l: '30d' }, { k: 90, l: '90d' }, { k: 'all', l: 'All' }];

function money(cents) {
  const n = (cents || 0) / 100;
  return n % 1 === 0 ? `$${n.toLocaleString()}` : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
// Expand the RPC's sparse day series (only days with views) into a complete
// daily series across the selected range, so the chart shows quiet days as a
// baseline instead of collapsing to a single stretched bar.
function fillSeries(rpcSeries, rangeDays) {
  const byDay = new Map((rpcSeries || []).map((d) => [String(d.bucket), d]));
  const today = new Date();
  let start;
  if (rangeDays === 'all') {
    if (!rpcSeries || rpcSeries.length === 0) return [];
    start = new Date(`${rpcSeries[0].bucket}T00:00:00Z`);
  } else {
    start = new Date(today.getTime() - (rangeDays - 1) * 86400000);
  }
  const out = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let guard = 0;
  while (cur <= end && guard++ < 800) {
    const key = cur.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    out.push({ bucket: key, booking_views: hit ? (hit.booking_views || 0) : 0, site_views: hit ? (hit.site_views || 0) : 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
// Grey placeholder block shown while a section loads, sized like the
// content it stands in for so the page doesn't jump.
function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`rounded-lg bg-black/[0.06] animate-pulse motion-reduce:animate-none ${className}`} />;
}

function StatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-black/[0.07] rounded-2xl p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-14 mt-2.5" />
            <Skeleton className="h-3 w-24 mt-2.5" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-black/[0.07] rounded-2xl p-[18px] mb-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-44 mt-2 mb-3.5" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </>
  );
}

function RetryButton({ onClick, children = 'Try again' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-[13px] transition-colors"
    >
      {children}
    </button>
  );
}

export default function OverviewPage({ userId, onNewSite, onNewBookingPage }) {
  const [range, setRange] = useState(30);
  // Each block tracks its own status so one failed query shows an error
  // where it failed instead of an empty (or new-user) page.
  const [stats, setStats] = useState({ status: 'loading', data: null });
  const [recent, setRecent] = useState({ status: 'loading', list: [] });
  const [sites, setSites] = useState({ status: 'loading', list: [] });
  const [statsKey, setStatsKey] = useState(0); // bump to retry the stats
  const [listsKey, setListsKey] = useState(0); // bump to retry sites + bookings

  useEffect(() => {
    let active = true;
    setStats((s) => ({ ...s, status: 'loading' }));
    loadOverview(range)
      .then((d) => { if (active) setStats({ status: 'ready', data: d }); })
      .catch(() => { if (active) setStats({ status: 'error', data: null }); });
    return () => { active = false; };
  }, [range, statsKey]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    setSites((s) => ({ ...s, status: 'loading' }));
    setRecent((r) => ({ ...r, status: 'loading' }));
    loadOwnerSites(userId)
      .then((list) => { if (active) setSites({ status: 'ready', list }); })
      .catch(() => { if (active) setSites({ status: 'error', list: [] }); });
    loadRecentBookings(userId)
      .then((list) => { if (active) setRecent({ status: 'ready', list }); })
      .catch(() => { if (active) setRecent({ status: 'error', list: [] }); });
    return () => { active = false; };
  }, [userId, listsKey]);

  const retryAll = () => { setStatsKey((k) => k + 1); setListsKey((k) => k + 1); };
  const mode = overviewMode(sites.status, sites.list.length);
  const shareSite = pickShareSite(sites.list);
  const data = stats.data;
  const conv = data && data.booking_views > 0
    ? `${Math.round((data.bookings_total / data.booking_views) * 1000) / 10}%`
    : '—';

  if (mode === 'loading') {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-6" aria-busy="true">
        <p className="sr-only" role="status">Loading your overview…</p>
        <div className="mb-5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-56 mt-2" />
        </div>
        <StatsSkeleton />
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="max-w-[1000px] mx-auto px-5 py-6">
        <div role="alert" className="text-center py-16 px-6 border border-black/[0.07] rounded-2xl bg-white">
          <h1 className="text-[19px] font-extrabold text-[#1a1a1a] mb-2">We couldn't load your overview</h1>
          <p className="text-ink-tertiary text-sm mb-5">Check your connection and try again. Your sites and bookings are safe.</p>
          <RetryButton onClick={retryAll} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-5 py-6">
        {mode === 'onboarding' ? (
          <div className="text-center py-20 border border-black/[0.07] rounded-2xl bg-white">
            <h1 className="text-[21px] font-extrabold text-[#1a1a1a] mb-2">Welcome 👋 Let's get you set up</h1>
            <p className="text-ink-tertiary text-sm mb-5">Build a website or a standalone booking page to start taking appointments.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onNewSite}
                className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Build My Site
              </button>
              {onNewBookingPage && (
                <button
                  onClick={onNewBookingPage}
                  className="px-6 py-3 bg-white border border-black/[0.12] hover:bg-black/5 text-[#1a1a1a] rounded-xl font-semibold text-sm transition-colors"
                >
                  Create booking page (no website)
                </button>
              )}
            </div>
          </div>
        ) : (
        <>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-[21px] font-extrabold text-[#1a1a1a]">Overview</h1>
            <p className="text-[13px] text-ink-tertiary mt-0.5">How your booking page is performing</p>
          </div>
          <div className="flex border border-black/[0.12] rounded-[9px] overflow-hidden" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.l} onClick={() => setRange(r.k)} aria-pressed={range === r.k}
                className={`text-[12px] font-bold px-3.5 py-1.5 ${range === r.k ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#4a4a4a]'}`}>
                {r.l}
              </button>
            ))}
          </div>
        </div>

        {stats.status === 'loading' && (
          <div aria-busy="true">
            <p className="sr-only" role="status">Loading stats…</p>
            <StatsSkeleton />
          </div>
        )}

        {stats.status === 'error' && (
          <div role="alert" className="bg-white border border-black/[0.07] rounded-2xl p-6 mb-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[14px] text-[#1a1a1a]">We couldn't load your stats for this period.</p>
            <RetryButton onClick={() => setStatsKey((k) => k + 1)} />
          </div>
        )}

        {stats.status === 'ready' && data && (
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
              <p className="text-[12px] text-ink-tertiary mb-3.5">Booking page vs website</p>
              <TrendChart series={fillSeries(data.series, range)} />
            </div>
          </>
        )}

        <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
          <div className="bg-white border border-black/[0.07] rounded-2xl p-[18px]">
            <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-3">Recent bookings</h3>
            {recent.status === 'loading' && (
              <div aria-hidden="true" className="space-y-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
              </div>
            )}
            {recent.status === 'error' && (
              <p role="alert" className="text-[13px] text-[#1a1a1a]">
                We couldn't load your recent bookings.{' '}
                <button type="button" onClick={() => setListsKey((k) => k + 1)} className="font-semibold text-[#cc0000] underline underline-offset-2">Try again</button>
              </p>
            )}
            {recent.status === 'ready' && recent.list.length === 0 && <p className="text-[13px] text-ink-tertiary">No bookings yet.</p>}
            {recent.status === 'ready' && recent.list.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 border-t border-black/[0.06] first:border-t-0 text-[13px]">
                <span className="text-[#1a1a1a] truncate">{b.customer_name}{b.service_name ? ` · ${b.service_name}` : ''}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-[#dcfce7] text-[#166534]' : b.status === 'pending' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-black/[0.06] text-[#4a4a4a]'}`}>{b.status}</span>
              </div>
            ))}
          </div>
          <div>
            {shareSite ? <ShareBookingCard bookingUrl={bookingShareUrl(shareSite)} /> : null}
          </div>
        </div>
        </>
        )}
    </div>
  );
}
