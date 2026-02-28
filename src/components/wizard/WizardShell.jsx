import ProgressBar from '../ui/ProgressBar.jsx';

const STEP_LABELS = ['Business Type', 'Your Info', 'Template', 'Generating', 'Preview', 'Export'];

export default function WizardShell({ step, onBack, children }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-8 py-0 flex items-center justify-between h-16 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* Wordmark */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-900 rounded-md flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="5" width="12" height="6" rx="2" fill="white"/>
                <circle cx="4" cy="11" r="1.5" fill="white"/>
                <circle cx="10" cy="11" r="1.5" fill="white"/>
                <rect x="4" y="2" width="5" height="4" rx="1" fill="white"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-[15px] tracking-tight">AutoSite</span>
          </div>
          <span className="text-gray-300 text-sm hidden sm:block">|</span>
          <span className="text-sm text-gray-500 hidden sm:block">Website Builder for Auto Businesses</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">Free</span>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-gray-100 bg-gray-50/60 px-8 py-4">
        <div className="max-w-2xl mx-auto w-full">
          <ProgressBar step={step} labels={STEP_LABELS} />
        </div>
      </div>

      {/* Back button */}
      {step > 1 && (
        <div className="px-8 pt-5 max-w-2xl mx-auto w-full">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-8 py-10 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-8 py-4 text-center text-xs text-gray-400">
        Powered by AI · Built for auto professionals
      </footer>
    </div>
  );
}
