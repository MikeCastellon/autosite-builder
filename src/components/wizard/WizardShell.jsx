import ProgressBar from '../ui/ProgressBar.jsx';

const STEP_LABELS = ['Business Type', 'Your Info', 'Template', 'Generating', 'Preview', 'Export'];

export default function WizardShell({ step, onBack, children }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚗</span>
          <span className="font-bold text-lg tracking-tight">AutoSite Builder</span>
        </div>
        <span className="text-sm text-gray-500 hidden sm:block">Free websites for auto businesses</span>
      </header>

      {/* Progress */}
      <div className="px-6 pt-6 pb-2 max-w-3xl mx-auto w-full">
        <ProgressBar step={step} labels={STEP_LABELS} />
      </div>

      {/* Back button */}
      {step > 1 && (
        <div className="px-6 pt-3 max-w-3xl mx-auto w-full">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-600">
        Powered by AI · Built for auto professionals
      </footer>
    </div>
  );
}
