import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const cardBase = 'bg-white border border-black/10 rounded-2xl p-5 shadow-sm';
const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
const btnBase = 'rounded-xl px-3.5 py-2 text-[13px] font-semibold border border-black/10 hover:bg-black/[0.03] transition';

// bookingUrl: the public link to share (root for booking-only, /book for sites).
export default function ShareBookingCard({ bookingUrl }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!bookingUrl) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — user can select manually */ }
  }

  return (
    <div className={cardBase}>
      <label className={labelBase}>Your booking link</label>
      <div className="flex items-center gap-2 mb-3">
        <input readOnly value={bookingUrl} onFocus={(e) => e.target.select()}
          className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-[13px] font-mono bg-[#faf9f7]" />
        <button type="button" className={btnBase} onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        <button type="button" className={btnBase} onClick={() => setShowQr((v) => !v)}>{showQr ? 'Hide QR' : 'QR code'}</button>
      </div>
      <p className="text-[12px] text-[#888] leading-relaxed">Drop this in your Instagram bio so customers can book directly.</p>
      {showQr && (
        <div className="mt-4 flex justify-center">
          <QRCodeCanvas value={bookingUrl} size={160} includeMargin />
        </div>
      )}
    </div>
  );
}
