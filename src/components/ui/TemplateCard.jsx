export default function TemplateCard({ template, selected, onClick }) {
  const [c1, c2, c3] = template.previewColors;
  const isSelected = selected === template.id;

  return (
    <button
      onClick={() => onClick(template.id)}
      className={`group flex flex-col rounded-xl border-2 overflow-hidden transition-all duration-150 cursor-pointer text-left w-full
        ${isSelected ? 'border-gray-900 shadow-md' : 'border-gray-200 hover:border-gray-400'}`}
    >
      {/* Website mockup preview */}
      <div className="h-28 flex flex-col" style={{ background: c1 }}>
        {/* Simulated nav */}
        <div className="flex items-center px-2.5 py-1.5 gap-2" style={{ background: c1 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: c2, opacity: 0.9 }} />
          <div className="h-1 rounded-full w-10" style={{ background: c2, opacity: 0.5 }} />
        </div>
        {/* Hero lines */}
        <div className="flex-1 flex flex-col justify-center px-2.5 gap-1.5">
          <div className="h-1.5 rounded-full w-3/4" style={{ background: c2, opacity: 0.85 }} />
          <div className="h-1 rounded-full w-1/2" style={{ background: c2, opacity: 0.4 }} />
          <div className="mt-1 h-4 rounded w-16" style={{ background: c2, opacity: 0.75 }} />
        </div>
        {/* Service cards */}
        <div className="flex gap-1 px-2.5 pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 h-6 rounded" style={{ background: c3, opacity: 0.85 }} />
          ))}
        </div>
      </div>

      {/* Info row */}
      <div className="bg-white p-3 border-t border-gray-100 flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-semibold text-gray-900 text-[13px]">{template.label}</p>
          {isSelected && (
            <span className="bg-gray-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide">SELECTED</span>
          )}
        </div>
        <p className="text-gray-400 text-[11px] leading-relaxed">{template.description}</p>
        {/* Color swatches */}
        <div className="flex gap-1 mt-2">
          {template.previewColors.map((c) => (
            <div key={c} className="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-sm" style={{ background: c }} />
          ))}
        </div>
      </div>
    </button>
  );
}
