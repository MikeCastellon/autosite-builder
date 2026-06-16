import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { loadOverview } from '../../../lib/overview.js';
import AppHeader from '../../ui/AppHeader.jsx';
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
export default function OverviewPage({ onNewSite, onNewBookingPage, ...navProps }) {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [site, setSite] = useState(null);
  const [siteCount, setSiteCount] = useState(null);

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
      .select('published_url, site_type, scheduler_enabled, custom_domain, custom_domain_status')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data || [];
        setSiteCount(list.length);
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
        {siteCount === 0 ? (
          <div className="text-center py-20 border border-black/[0.07] rounded-2xl bg-white">
            <h1 className="text-[21px] font-extrabold text-[#1a1a1a] mb-2">Welcome 👋 Let's get you set up</h1>
            <p className="text-[#888] text-sm mb-5">Build a website or a standalone booking page to start taking appointments.</p>
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
              <TrendChart series={fillSeries(data.series, range)} />
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
                {site ? <ShareBookingCard bookingUrl={bookingShareUrl(site)} /> : null}
              </div>
            </div>
          </>
        )}
        </>
        )}
      </div>
    </>
  );
}
