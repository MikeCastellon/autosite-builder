export default function PreviewToolbar({ viewMode, onViewMode, onBack, onExport, onEdit, editorOpen, isDemoPreview }) {
  return (
    <div className="fixed top-0 left-0 z-50 bg-white border-b border-gray-200 px-3 sm:px-5 h-13 flex items-center justify-between gap-2 sm:gap-4" style={{ height: 52, right: editorOpen ? 320 : 0, transition: 'right 0.2s ease' }}>
      {/* Left: back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-[#cc0000] hover:bg-[#cc0000] hover:text-white active:scale-[0.98] transition-all shrink-0 shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="hidden sm:inline">Back to Templates</span>
        <span className="sm:hidden">Back</span>
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

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onEdit}
          className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg border transition-all ${
            editorOpen
              ? 'bg-gray-900 text-white border-gray-900'
              : 'border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9.5 1.5a1.414 1.414 0 012 2L4 11H1.5V8.5L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Edit
        </button>
        {!isDemoPreview && onExport && (
          <button
            onClick={onExport}
            className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg transition-colors"
          >
            <span className="hidden sm:inline">Finalize Website</span>
            <span className="sm:hidden">Finalize</span>
          </button>
        )}
      </div>
    </div>
  );
}
