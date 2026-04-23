import { useState } from 'react';
import { startProUpgrade } from '../../lib/upgradeFlow.js';
import { useAlert } from './AlertProvider.jsx';

const FEATURES = [
  {
    title: '24/7 Online Booking',
    desc: 'Customers self-book any time straight from your site.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    title: 'Live Google Reviews Widget',
    desc: 'Real reviews pulled from your Google Business profile.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
      </svg>
    ),
  },
  {
    title: 'Connect Your Custom Domain',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
      </svg>
    ),
  },
  {
    title: 'Priority Live Chat Support',
    desc: 'Direct line to our team — answers in minutes.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    title: 'Remove "Powered by" Branding',
    desc: 'Hide the Auto Care Genius bar so your site reads as 100% yours.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M5 5l14 14" />
      </svg>
    ),
  },
];

// Reusable Pro upgrade card. Used by:
//   - UpgradeProButton (inside its modal)
//   - SubscribeGate (paywall on Bookings)
//   - StepExport (inline panel above the publish CTA)
export default function UpgradeProPanel({ heading = 'Unlock the full toolkit', subheading = 'Everything you need to turn visitors into booked customers.', size = 'md' }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useAlert();

  const handleUpgrade = async () => {
    if (busy) return;
    setBusy(true);
    try { await startProUpgrade(); }
    catch (e) { toast(e.message || 'Could not start checkout', 'error'); }
    finally { setBusy(false); }
  };

  const isLg = size === 'lg';

  return (
    <div className="rounded-2xl overflow-hidden border border-[#cc0000]/20 shadow-sm bg-white">
      <div className={`${isLg ? 'px-7 pt-7 pb-6' : 'px-5 pt-5 pb-4'} bg-gradient-to-br from-[#cc0000] to-[#8a0000] text-white relative overflow-hidden`}>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
        <div className="relative">
          <p className={`${isLg ? 'text-[12px]' : 'text-[10px]'} font-bold uppercase tracking-[2px] opacity-80 mb-1.5`}>Genius Websites Pro</p>
          <h3 className={`${isLg ? 'text-[24px]' : 'text-[18px]'} font-[900] tracking-[-0.3px] leading-tight`}>
            {heading}
          </h3>
          {subheading && (
            <p className={`${isLg ? 'text-[14px]' : 'text-[12px]'} opacity-90 leading-snug mt-1.5`}>
              {subheading}
            </p>
          )}
        </div>
      </div>

      <ul className={`${isLg ? 'px-7 py-5 space-y-3.5' : 'px-5 py-4 space-y-2.5'}`}>
        {FEATURES.map((f) => (
          <li key={f.title} className="flex items-start gap-3">
            <span className={`${isLg ? 'w-9 h-9' : 'w-7 h-7'} shrink-0 rounded-lg bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center mt-0.5`}>
              {f.icon}
            </span>
            <div className="min-w-0">
              <p className={`${isLg ? 'text-[14px]' : 'text-[13px]'} font-bold text-[#1a1a1a] leading-tight`}>{f.title}</p>
              {f.desc && <p className={`${isLg ? 'text-[12px]' : 'text-[11px]'} text-[#666] leading-snug mt-0.5`}>{f.desc}</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className={`${isLg ? 'px-7 pb-6' : 'px-5 pb-5'}`}>
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={busy}
          className={`block w-full ${isLg ? 'py-3.5 text-[15px]' : 'py-3 text-[14px]'} px-6 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] disabled:opacity-60 disabled:cursor-not-allowed text-white text-center font-semibold transition-colors shadow-sm`}
        >
          {busy ? 'Loading...' : '⭐ Upgrade to Pro'}
        </button>
        <p className="text-[11px] text-[#888] text-center mt-2.5">
          $9.99/month · Cancel anytime in your Shopify account.
        </p>
      </div>
    </div>
  );
}
