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
