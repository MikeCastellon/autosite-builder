export default function PreviewToolbar({ viewMode, onViewMode, onBack, onExport }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-5 h-13 flex items-center justify-between gap-4" style={{ height: 52 }}>
      {/* Left: back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors shrink-0 font-medium"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Templates
      </button>

      {/* Center: view toggle */}
      <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
        <button
          onClick={() => onViewMode('desktop')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${viewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Desktop
        </button>
        <button
          onClick={() => onViewMode('mobile')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${viewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Mobile
        </button>
      </div>

      {/* Right: export */}
      <button
        onClick={onExport}
        className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
      >
        Download Site
      </button>
    </div>
  );
}
