import { useEffect } from 'react';
import UpgradeProPanel from './UpgradeProPanel.jsx';

// Modal wrapper around UpgradeProPanel. Use anywhere you need to gate a
// Pro-only action (Add Domain, Bookings nav, etc.) — pass `open` + `onClose`.
export default function UpgradeProDialog({ open, onClose, heading, subheading }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <UpgradeProPanel size="lg" heading={heading} subheading={subheading} />
      </div>
    </div>
  );
}
