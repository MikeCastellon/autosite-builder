export default function PreviewToolbar({ viewMode, onViewMode, onBack, onExport }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-950 border-b border-gray-800 px-4 h-14 flex items-center justify-between gap-4">
      {/* Left: back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
      >
        ← Back to Templates
      </button>

      {/* Center: view toggle */}
      <div className="flex items-center bg-gray-900 rounded-lg p-1 gap-1">
        <button
          onClick={() => onViewMode('desktop')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
        >
          🖥 Desktop
        </button>
        <button
          onClick={() => onViewMode('mobile')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
        >
          📱 Mobile
        </button>
      </div>

      {/* Right: export */}
      <button
        onClick={onExport}
        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
      >
        Download Site →
      </button>
    </div>
  );
}
