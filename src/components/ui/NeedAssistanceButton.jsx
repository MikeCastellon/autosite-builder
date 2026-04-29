import { useEffect, useRef, useState } from 'react';
import ScheduleZoomModal from '../help/ScheduleZoomModal.jsx';

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@autocaregenius.com';

// Format a raw E.164-ish phone string ("+15551234567") into something a human
// can read at a glance ("(555) 123-4567"). Anything that doesn't look like a
// 10-digit US number passes through as-is so international numbers still work.
function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

// Header-level support button. Sits next to the profile avatar.
//
// Click → small popover with two actions:
//   • Call Us → tel: link, opens the phone dialer on mobile (or
//     FaceTime/Skype/default-handler on desktop). Falls back to mailto
//     if VITE_SUPPORT_PHONE isn't configured.
//   • Schedule Zoom → opens our own scheduler modal (slot picker → Zoom
//     API → confirmation).
//
// The bottom-right `?` button continues to handle the help articles drawer
// — those are intentionally separate.
export default function NeedAssistanceButton() {
  const [open, setOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const wrapperRef = useRef(null);
  const phoneOn = !!SUPPORT_PHONE;
  const phoneDisplay = phoneOn ? formatPhone(SUPPORT_PHONE) : '';
  const phoneHref = phoneOn ? `tel:${String(SUPPORT_PHONE).replace(/\D/g, '')}` : '';

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function handleZoom() {
    setZoomOpen(true);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[12px] font-bold transition-colors shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Need Assistance?
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 w-72 bg-white border border-black/[0.10] rounded-xl shadow-lg z-[100] overflow-hidden"
        >
          <div className="px-4 py-3 bg-gradient-to-br from-[#cc0000] to-[#8a0000] text-white">
            <p className="text-[10px] font-bold uppercase tracking-[2px] opacity-80 mb-1">Need a human?</p>
            <p className="text-[13px] font-semibold leading-snug">Pick how you'd like to talk to us.</p>
          </div>
          <div className="p-2">
            {phoneOn ? (
              <a
                href={phoneHref}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#faf9f7] transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-lg bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-[#1a1a1a]">Call us</span>
                  <span className="block text-[11px] text-[#888]">{phoneDisplay} · tap to dial</span>
                </span>
              </a>
            ) : (
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Genius Websites — support request')}`}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#faf9f7] transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-lg bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-[#1a1a1a]">Email us</span>
                  <span className="block text-[11px] text-[#888]">We reply fast</span>
                </span>
              </a>
            )}
            <button
              type="button"
              onClick={handleZoom}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#faf9f7] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-lg bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[#1a1a1a]">Schedule a Zoom</span>
                <span className="block text-[11px] text-[#888]">30-min call · Mon–Sat 11am–8pm ET</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {zoomOpen && (
        <ScheduleZoomModal onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}
