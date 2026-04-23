import { useEffect, useState } from 'react';
import UpgradeProPanel from './UpgradeProPanel.jsx';

export default function UpgradeProButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <style>{`
        @keyframes acg-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .acg-pro-btn {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .acg-pro-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 32px rgba(204, 0, 0, 0.45);
        }
        .acg-pro-icon {
          animation: acg-spin-slow 8s linear infinite;
        }
        .acg-pro-modal {
          animation: acg-modal-in 0.25s ease-out;
        }
        @keyframes acg-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Upgrade to Pro"
          className="acg-pro-btn inline-flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-[#cc0000] text-white shadow-[0_8px_24px_rgba(204,0,0,0.35)] font-semibold text-[14px] tracking-tight"
        >
          <svg
            className="acg-pro-icon shrink-0"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
          </svg>
          <span className="whitespace-nowrap">Upgrade to Pro</span>
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="acg-pro-modal w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <UpgradeProPanel size="lg" />
          </div>
        </div>
      )}
    </>
  );
}
