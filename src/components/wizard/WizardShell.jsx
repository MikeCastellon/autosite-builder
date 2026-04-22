import { useState } from 'react';
import ProgressBar from '../ui/ProgressBar.jsx';

const STEP_LABELS = ['Business Type', 'Your Info', 'Template', 'Generating', 'Preview', 'Export'];

export default function WizardShell({ step, onBack, children, userEmail, onMySites, onSignOut }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-black/[0.07] bg-white/85 backdrop-blur-xl px-4 sm:px-8 py-0 flex items-center justify-between h-16 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="https://www.autocaregenius.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5">
            <img
              src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160"
              alt="Auto Care Genius"
              className="h-7"
            />
            <div className="w-px h-6 bg-black/[0.07]" />
            <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px]">
              Pro <span className="text-[#cc0000]">Hub</span>
            </span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#888] uppercase tracking-[1.5px] font-medium hidden sm:block">Website Builder</span>
          <span className="text-[12px] font-semibold bg-[#1a1a1a] text-white px-3 py-1.5 rounded-lg">Free</span>
          {userEmail && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#1a1a1a] transition-colors font-medium ml-2"
              >
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[11px] font-bold">
                  {userEmail[0].toUpperCase()}
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 bg-white border border-black/[0.1] rounded-xl shadow-lg py-1.5 min-w-[180px] z-[100]">
                  <div className="px-4 py-2 text-[11px] text-[#888] border-b border-black/[0.05] truncate">{userEmail}</div>
                  {onMySites && (
                    <button onClick={() => { setDropdownOpen(false); onMySites(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#1a1a1a] hover:bg-[#faf9f7] transition-colors font-medium">
                      My Sites
                    </button>
                  )}
                  {onSignOut && (
                    <button onClick={() => { setDropdownOpen(false); onSignOut(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#cc0000] hover:bg-[#faf9f7] transition-colors font-medium">
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-black/[0.07] bg-[#faf9f7] px-4 sm:px-8 py-4">
        <div className="max-w-2xl mx-auto w-full">
          <ProgressBar step={step} labels={STEP_LABELS} />
        </div>
      </div>

      {/* Back button */}
      {step > 1 && (
        <div className="px-4 sm:px-8 pt-5 max-w-2xl mx-auto w-full">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#888] hover:text-[#1a1a1a] transition-colors font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-4 sm:px-8 pt-10 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.07] px-4 sm:px-8 py-5 flex items-center justify-center gap-2 text-xs text-[#888]">
        <span>Powered by</span>
        <a href="https://www.autocaregenius.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
          <img src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160" alt="Auto Care Genius" className="h-5" />
        </a>
      </footer>
    </div>
  );
}
