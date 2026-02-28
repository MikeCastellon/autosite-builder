export default function TemplateCard({ template, selected, onClick }) {
  const [c1, c2, c3] = template.previewColors;
  const isSelected = selected === template.id;

  return (
    <button
      onClick={() => onClick(template.id)}
      className={`group flex flex-col rounded-2xl border-2 overflow-hidden transition-all duration-200 cursor-pointer text-left w-full
        ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-gray-700 hover:border-gray-500'}`}
    >
      {/* Color preview */}
      <div className="h-28 flex" style={{ background: c1 }}>
        {/* Simulated nav bar */}
        <div className="w-full flex flex-col">
          <div className="flex items-center px-3 py-2 gap-2" style={{ background: c1 }}>
            <div className="w-2 h-2 rounded-full" style={{ background: c2 }} />
            <div className="h-1.5 rounded-full w-12" style={{ background: c2, opacity: 0.6 }} />
          </div>
          {/* Hero area */}
          <div className="flex-1 flex flex-col justify-center px-3 gap-1.5">
            <div className="h-2 rounded-full w-3/4" style={{ background: c2, opacity: 0.9 }} />
            <div className="h-1.5 rounded-full w-1/2" style={{ background: c2, opacity: 0.5 }} />
            <div className="mt-1 h-5 rounded-md w-20" style={{ background: c2, opacity: 0.8 }} />
          </div>
          {/* Cards row */}
          <div className="flex gap-1.5 px-3 pb-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 h-8 rounded" style={{ background: c3, opacity: 0.9 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-900 p-4 flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-white text-sm">{template.label}</p>
          {isSelected && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Selected</span>
          )}
        </div>
        <p className="text-gray-500 text-xs leading-relaxed">{template.description}</p>
        {/* Color swatches */}
        <div className="flex gap-1.5 mt-3">
          {template.previewColors.map((c) => (
            <div key={c} className="w-4 h-4 rounded-full border border-gray-700" style={{ background: c }} />
          ))}
        </div>
      </div>
    </button>
  );
}
