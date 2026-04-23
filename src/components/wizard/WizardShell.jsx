import { useState } from 'react';
import ProgressBar from '../ui/ProgressBar.jsx';
import { canSeeBookingsNav } from '../../lib/subscriptionGating.js';

const STEP_LABELS = ['Business Type', 'Your Info', 'Template', 'Generating', 'Preview', 'Export'];

export default function WizardShell({ step, onBack, children, userEmail, onMySites, onSignOut, profile, onOpenBookings, onOpenAdmin }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const showBookingsNav = canSeeBookingsNav(profile);
  const isAdmin = !!profile?.is_super_admin;
  const initial = userEmail ? userEmail[0].toUpperCase() : '?';

  const navItems = [
    onMySites && { label: 'Sites', onClick: onMySites },
    showBookingsNav && onOpenBookings && { label: 'Bookings', onClick: onOpenBookings },
    isAdmin && onOpenAdmin && { label: 'Admin', onClick: onOpenAdmin },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-black/[0.07] bg-white/85 backdrop-blur-xl px-4 sm:px-8 py-0 flex items-center justify-between h-16 sticky top-0 z-50">
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

        {/* Centered nav (desktop only) */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 text-[13px] font-medium">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="px-3 py-1.5 rounded-lg text-[#1a1a1a] hover:bg-black/[0.04] transition-colors"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: desktop avatar dropdown */}
        <div className="hidden md:flex items-center">
          {userEmail && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#1a1a1a] transition-colors font-medium"
                aria-label="Account menu"
              >
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[12px] font-bold">
                  {initial}
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 bg-white border border-black/[0.1] rounded-xl shadow-lg py-1.5 min-w-[200px] z-[100]">
                  <div className="px-4 py-2 text-[11px] text-[#888] border-b border-black/[0.05] truncate">{userEmail}</div>
                  {onSignOut && (
                    <button
                      onClick={() => { setDropdownOpen(false); onSignOut(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#cc0000] hover:bg-[#faf9f7] transition-colors font-medium"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile: hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Open menu"
          className="md:hidden flex items-center justify-center w-10 h-10 text-[#1a1a1a] hover:bg-black/[0.04] rounded-lg transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
            )}
          </svg>
        </button>
      </header>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden border-b border-black/[0.07] bg-white shadow-sm px-4 py-3 sticky top-16 z-40">
          {userEmail && (
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-black/[0.05]">
              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm font-bold">
                {initial}
              </div>
              <div className="text-sm text-[#1a1a1a] font-medium truncate">{userEmail}</div>
            </div>
          )}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { setMobileOpen(false); item.onClick(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#1a1a1a] hover:bg-black/[0.04] transition-colors"
              >
                {item.label}
              </button>
            ))}
            {onSignOut && (
              <button
                onClick={() => { setMobileOpen(false); onSignOut(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#cc0000] hover:bg-black/[0.04] transition-colors border-t border-black/[0.05] mt-1 pt-3"
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      )}

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
      <main className={`flex-1 px-4 sm:px-8 pt-10 mx-auto w-full ${step === 3 ? 'max-w-6xl' : 'max-w-2xl'}`}>
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
