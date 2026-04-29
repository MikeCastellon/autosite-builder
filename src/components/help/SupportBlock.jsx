import { useState } from 'react';
import { isTawkConfigured, openTawk } from '../../lib/tawk.js';
import ScheduleZoomModal from './ScheduleZoomModal.jsx';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@autocaregenius.com';

// Top-of-drawer support card with two CTAs.
//   - Live Chat: Tawk.to loads lazily and maximizes on click. Falls back to
//     mailto if Tawk isn't configured yet.
//   - Schedule Zoom: opens our own scheduler modal. Backed by the
//     support-slots / support-book Netlify functions and Zoom API — no
//     third-party calendar provider.
export default function SupportBlock({ onAfterAction }) {
  const [chatLoading, setChatLoading] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const tawkOn = isTawkConfigured();

  async function handleLiveChat() {
    if (chatLoading) return;
    if (!tawkOn) {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Genius Websites — support request')}`;
      return;
    }
    setChatLoading(true);
    try {
      await openTawk();
      onAfterAction?.();
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Genius Websites — support request')}`;
    } finally {
      setChatLoading(false);
    }
  }

  function handleZoom() {
    setZoomOpen(true);
  }

  return (
    <div className="px-4 pt-4">
      <div className="rounded-xl bg-gradient-to-br from-[#cc0000] to-[#8a0000] text-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[2px] opacity-80 mb-1">Need support?</p>
        <p className="text-[14px] font-semibold leading-snug mb-3">Talk to a real person — usually replies in minutes.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleLiveChat}
            disabled={chatLoading}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-lg bg-white text-[#cc0000] hover:bg-[#faf9f7] disabled:opacity-60 transition-colors text-[12px] font-bold"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {chatLoading ? 'Opening…' : 'Live Chat'}
          </button>
          <button
            type="button"
            onClick={handleZoom}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/40 text-white transition-colors text-[12px] font-bold"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Schedule Zoom
          </button>
        </div>
      </div>

      {zoomOpen && (
        <ScheduleZoomModal
          onClose={() => {
            setZoomOpen(false);
            onAfterAction?.();
          }}
        />
      )}
    </div>
  );
}
