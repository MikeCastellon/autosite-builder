// Lightweight inline-SVG grouped bar chart of booking vs website views over
// time. `series`: [{ bucket: 'YYYY-MM-DD', booking_views, site_views }] — should
// already span the full selected range (gap-filled with zero days). No deps.
function fmtLabel(bucket) {
  if (!bucket) return '';
  const m = String(bucket).slice(5).split('-'); // 'MM-DD' -> ['MM','DD']
  return m.length === 2 ? `${parseInt(m[0], 10)}/${parseInt(m[1], 10)}` : String(bucket).slice(5);
}

export default function TrendChart({ series }) {
  const data = Array.isArray(series) ? series : [];
  const hasAny = data.some((d) => (d.booking_views || 0) + (d.site_views || 0) > 0);
  if (data.length === 0 || !hasAny) {
    return <div className="text-[13px] text-[#888] py-12 text-center">No views yet for this period.</div>;
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
  // viewBox coordinate space (scales to container width via CSS).
  const W = 700, H = 220, padL = 30, padR = 8, padT = 10, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const groupW = plotW / cols.length;
  const barW = Math.max(2, Math.min(16, (groupW - 6) / 2));
  const baseY = padT + plotH;
  const yFor = (v) => baseY - (v / max) * plotH;

  const ticks = [...new Set([0, Math.round(max / 2), max])];
  const labelEvery = Math.ceil(cols.length / 6);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} role="img" aria-label="Views over time: booking page versus website">
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={`t${i}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#000" strokeOpacity="0.06" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#888">{t}</text>
            </g>
          );
        })}
        {cols.map((c, i) => {
          const gx = padL + i * groupW + groupW / 2;
          return (
            <g key={`c${i}`}>
              <rect x={gx - barW - 1} y={yFor(c.booking)} width={barW} height={baseY - yFor(c.booking)} fill="#2563eb" rx="1" />
              <rect x={gx + 1} y={yFor(c.site)} width={barW} height={baseY - yFor(c.site)} fill="#cbd5e1" rx="1" />
              {i % labelEvery === 0 && (
                <text x={gx} y={H - 8} textAnchor="middle" fontSize="10" fill="#888">{c.label}</text>
              )}
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
