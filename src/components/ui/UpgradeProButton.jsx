import { useEffect, useState } from 'react';

const UPGRADE_URL = 'https://www.autocaregenius.com/';

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    title: '24/7 Online Booking',
    desc: 'Customers self-book any time straight from your site.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
      </svg>
    ),
    title: 'Live Google Reviews Widget',
    desc: 'Real reviews pulled from your Google Business profile.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
      </svg>
    ),
    title: 'Your Own Domain',
    desc: 'Connect mybusiness.com instead of the free subdomain.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: 'Priority Live Chat Support',
    desc: 'Direct line to our team — answers in minutes, not days.',
  },
];

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
        @keyframes acg-halo {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes acg-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes acg-sparkle-orbit {
          0%   { top: -8px; left: -8px; opacity: 0; transform: scale(0.5); }
          10%  { opacity: 1; transform: scale(1); }
          25%  { top: -8px; left: calc(100% - 8px); opacity: 1; transform: scale(1); }
          26%  { opacity: 0; }
          35%  { top: -8px; left: -8px; opacity: 0; transform: scale(0.5); }
          50%  { top: calc(100% - 8px); left: calc(100% - 8px); opacity: 1; transform: scale(1); }
          51%  { opacity: 0; }
          75%  { top: calc(100% - 8px); left: -8px; opacity: 1; transform: scale(1); }
          76%  { opacity: 0; }
          100% { top: -8px; left: -8px; opacity: 0; transform: scale(0.5); }
        }
        @keyframes acg-shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        .acg-pro-btn {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .acg-pro-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 12px 32px rgba(204, 0, 0, 0.45);
        }
        .acg-pro-btn:hover .acg-pro-label {
          opacity: 1;
          transform: translateX(-12px);
        }
        .acg-pro-btn:hover .acg-pro-halo {
          animation-duration: 1s;
        }
        .acg-pro-halo {
          animation: acg-halo 2s ease-out infinite;
        }
        .acg-pro-icon {
          animation: acg-spin-slow 8s linear infinite;
        }
        .acg-pro-sparkle {
          animation: acg-sparkle-orbit 6s ease-in-out infinite;
        }
        .acg-pro-label {
          opacity: 0;
          transform: translateX(0);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .acg-pro-modal {
          animation: acg-modal-in 0.25s ease-out;
        }
        @keyframes acg-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .acg-pro-cta {
          position: relative;
          overflow: hidden;
        }
        .acg-pro-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          animation: acg-shimmer 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2">
        <span className="acg-pro-label hidden sm:inline-block bg-[#1a1a1a] text-white text-[12px] font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          Upgrade to Pro
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Upgrade to Pro"
          className="acg-pro-btn relative w-16 h-16 rounded-full bg-[#cc0000] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(204,0,0,0.35)]"
        >
          {/* Pulsing halo */}
          <span
            className="acg-pro-halo absolute inset-0 rounded-full bg-[#cc0000] -z-10"
            aria-hidden="true"
          />
          {/* Sparkle that orbits around */}
          <span
            className="acg-pro-sparkle absolute text-[14px] pointer-events-none"
            aria-hidden="true"
          >
            ✨
          </span>
          {/* Slowly spinning star icon */}
          <svg
            className="acg-pro-icon"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
          </svg>
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="acg-pro-modal w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="acg-pro-title"
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full text-[#888] hover:text-[#1a1a1a] hover:bg-black/[0.04] flex items-center justify-center transition-colors z-10"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-6 pt-7 pb-5 bg-gradient-to-br from-[#cc0000] to-[#8a0000] text-white relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[2px] opacity-80 mb-2">Genius Websites Pro</p>
                <h2 id="acg-pro-title" className="text-[22px] font-[900] tracking-[-0.5px] leading-tight mb-1">
                  Unlock the full toolkit
                </h2>
                <p className="text-[13px] opacity-90 leading-snug">
                  Everything you need to turn visitors into booked customers.
                </p>
              </div>
            </div>

            {/* Features */}
            <ul className="px-6 py-5 space-y-3.5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center mt-0.5">
                    {f.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#1a1a1a] leading-tight">{f.title}</p>
                    <p className="text-[12px] text-[#666] leading-snug mt-0.5">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="px-6 pb-6 pt-1 space-y-2">
              <a
                href={UPGRADE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="acg-pro-cta block w-full py-3.5 px-6 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white text-center font-semibold text-[15px] transition-colors shadow-md"
                onClick={() => setOpen(false)}
              >
                <span className="relative z-10 inline-flex items-center gap-2 justify-center">
                  Upgrade to Pro
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2 text-[13px] text-[#888] hover:text-[#1a1a1a] font-medium transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
