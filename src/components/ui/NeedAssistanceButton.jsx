import { useEffect, useRef, useState } from 'react';
import { isTawkConfigured, openTawk } from '../../lib/tawk.js';
import ScheduleZoomModal from '../help/ScheduleZoomModal.jsx';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@autocaregenius.com';

// Header-level support button. Sits next to the profile avatar.
//
// Click → small popover with two actions:
//   • Live Chat → lazy-loads Tawk.to, falls back to mailto if not yet
//     configured.
//   • Schedule Zoom → opens our own scheduler modal (slot picker → Zoom
//     API → confirmation).
//
// The bottom-right `?` button continues to handle the help articles drawer
// — those are intentionally separate.
export default function NeedAssistanceButton() {
  const [open, setOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const wrapperRef = useRef(null);
  const tawkOn = isTawkConfigured();

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

  async function handleLiveChat() {
    if (chatLoading) return;
    if (!tawkOn) {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Genius Websites — support request')}`;
      setOpen(false);
      return;
    }
    setChatLoading(true);
    try {
      await openTawk();
      setOpen(false);
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Genius Websites — support request')}`;
    } finally {
      setChatLoading(false);
    }
  }

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
            <button
              type="button"
              onClick={handleLiveChat}
              disabled={chatLoading}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#faf9f7] disabled:opacity-60 transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-lg bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[#1a1a1a]">{chatLoading ? 'Opening chat…' : 'Live Chat'}</span>
                <span className="block text-[11px] text-[#888]">{tawkOn ? 'Usually replies in minutes' : 'Email us — we reply fast'}</span>
              </span>
            </button>
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
