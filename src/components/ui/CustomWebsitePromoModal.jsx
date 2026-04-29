import { useEffect, useState } from 'react';
import ScheduleZoomModal from '../help/ScheduleZoomModal.jsx';

// "Looking for something more custom?" upsell modal.
// Auto-shows on the dashboard once per user (localStorage gate). Clicking
// Contact Us hands off to the existing ScheduleZoomModal — same flow used
// by the Need Assistance header button.
//
// Dismissal:
//   - X button or "Maybe later" → closes + persists dismissal
//   - Esc key                   → closes (also persists)
//   - Backdrop click            → closes (also persists)
//
// Re-open later via the small "Looking for something more custom?" link
// rendered in the dashboard once dismissed.
export default function CustomWebsitePromoModal({ open, onClose }) {
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open && !zoomOpen) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden={false}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-website-promo-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] overflow-hidden"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full text-[#888] hover:text-[#1a1a1a] hover:bg-black/[0.05] flex items-center justify-center transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <div className="px-7 pt-9 pb-3 bg-gradient-to-br from-[#cc0000] to-[#8a0000] text-white">
              <p className="text-[10px] font-bold uppercase tracking-[2.5px] opacity-85 mb-2">
                Concierge Build
              </p>
              <h2
                id="custom-website-promo-title"
                className="text-[26px] leading-[1.1] font-[900] tracking-tight"
              >
                Looking for something
                <br />
                more custom?
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-white/85 max-w-sm">
                We'll design and build a fully custom website tailored to your
                business — copy, photos, branding, the works.
              </p>
            </div>

            <div className="px-7 py-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-[42px] font-[900] text-[#1a1a1a] leading-none tracking-tight">$499</span>
                <span className="text-[12px] text-[#888]">one-time</span>
              </div>

              <ul className="space-y-2 mb-6">
                {[
                  'Custom design — not a template',
                  'Up to 3 rounds of revisions',
                  'Live in 7-10 business days',
                  'Includes everything in Pro',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-[#1a1a1a]">
                    <svg
                      className="mt-[3px] shrink-0 text-[#cc0000]"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => {
                  // Close the promo *before* opening the Zoom modal so the
                  // two never stack on top of each other. Calling onClose
                  // also persists the dismissal flag in localStorage.
                  setZoomOpen(true);
                  onClose?.();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[14px] font-bold transition-colors shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Contact Us
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-2 px-4 py-2 text-[12px] font-semibold text-[#888] hover:text-[#1a1a1a] transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomOpen && (
        <ScheduleZoomModal onClose={() => setZoomOpen(false)} />
      )}
    </>
  );
}
