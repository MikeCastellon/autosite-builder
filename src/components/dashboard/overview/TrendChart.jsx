// Lightweight grouped bar chart of booking vs website views over time.
// `series`: [{ bucket: 'YYYY-MM-DD', booking_views, site_views }] — should
// already span the full selected range (gap-filled with zero days). No deps.
//
// Plain HTML boxes rather than a scaled SVG: an SVG viewBox shrinks its
// text with the chart, so axis labels came out around 9px on desktop and 6px
// on phones. Here labels stay 12px at every width and bars keep a max width.
import { tokens } from '../../../design-tokens.js';

function fmtLabel(bucket) {
  if (!bucket) return '';
  const m = String(bucket).slice(5).split('-'); // 'MM-DD' -> ['MM','DD']
  return m.length === 2 ? `${parseInt(m[0], 10)}/${parseInt(m[1], 10)}` : String(bucket).slice(5);
}

const BOOKING_COLOR = '#2563eb';
const SITE_COLOR = '#cbd5e1';
const AXIS_COLOR = tokens.color.ink.tertiary; // AA for small text

export default function TrendChart({ series }) {
  const data = Array.isArray(series) ? series : [];
  const hasAny = data.some((d) => (d.booking_views || 0) + (d.site_views || 0) > 0);
  if (data.length === 0 || !hasAny) {
    return <div className="text-[13px] text-ink-tertiary py-12 text-center">No views yet for this period.</div>;
  }

  // Down-sample to at most ~15 columns, summing views within each group.
  const step = Math.ceil(data.length / 15);
  const cols = [];
  for (let i = 0; i < data.length; i += step) {
    const slice = data.slice(i, i + step);
    cols.push({
      label: fmtLabel(slice[0].bucket),
      booking: slice.reduce((s, d) => s + (d.booking_views || 0), 0),
      site: slice.reduce((s, d) => s + (d.site_views || 0), 0),
    });
  }

  const max = Math.max(1, ...cols.map((c) => Math.max(c.booking, c.site)));
  const pct = (v) => `${(v / max) * 100}%`;
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  // At most 6 date labels, so they fit side by side on a phone.
  const labelEvery = Math.ceil(cols.length / 6);
  const totalBooking = cols.reduce((s, c) => s + c.booking, 0);
  const totalSite = cols.reduce((s, c) => s + c.site, 0);

  return (
    <div>
      <div
        className="relative h-[200px] pl-10 pb-6"
        role="img"
        aria-label={`Views over time, ${cols[0].label} to ${cols[cols.length - 1].label}: ${totalBooking} booking page views, ${totalSite} website views`}
      >
        <div className="relative h-full">
          {ticks.map((t) => (
            <div key={t} className="absolute left-0 right-0 border-t border-black/[0.06]" style={{ bottom: pct(t) }}>
              <span
                className="absolute right-full mr-2 -translate-y-1/2 text-[12px] leading-none tabular-nums whitespace-nowrap"
                style={{ color: AXIS_COLOR }}
              >
                {t}
              </span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-end">
            {cols.map((c, i) => (
              <div key={i} className="relative flex-1 h-full flex items-end justify-center gap-[2px]">
                <div className="w-[38%] max-w-[16px] rounded-t-[1px]" style={{ height: pct(c.booking), background: BOOKING_COLOR }} />
                <div className="w-[38%] max-w-[16px] rounded-t-[1px]" style={{ height: pct(c.site), background: SITE_COLOR }} />
                {i % labelEvery === 0 && (
                  <span
                    className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-[12px] leading-none whitespace-nowrap"
                    style={{ color: AXIS_COLOR }}
                  >
                    {c.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-4 text-[12px] text-[#4a4a4a] mt-3">
        <span><span className="inline-block w-2.5 h-2.5 rounded-[2px] mr-1.5 align-middle" style={{ background: BOOKING_COLOR }} />Booking page</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-[2px] mr-1.5 align-middle" style={{ background: SITE_COLOR }} />Website</span>
      </div>
    </div>
  );
}
