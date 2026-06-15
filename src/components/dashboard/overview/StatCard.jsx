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
