import { useEffect, useRef, useState } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';

export default function GeneralTab({ siteId, config, siteImages, onSaved }) {
  const [welcome, setWelcome] = useState(config?.welcome_text || '');
  const [label, setLabel] = useState(config?.button_label || 'Book Now');
  const [lead, setLead] = useState(String(config?.lead_time_hours ?? 24));
  const [ctaSelector, setCtaSelector] = useState(config?.cta_selector || '');
  const [logoUrl, setLogoUrl] = useState(config?.logo_url || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  const siteLogo = siteImages?.logo || null;
  const effectiveLogo = logoUrl || siteLogo;

  useEffect(() => {
    setWelcome(config?.welcome_text || '');
    setLabel(config?.button_label || 'Book Now');
    setLead(String(config?.lead_time_hours ?? 24));
    setCtaSelector(config?.cta_selector || '');
    setLogoUrl(config?.logo_url || '');
  }, [config]);

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setErr('Logo must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result);
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, {
        welcome_text: welcome,
        button_label: label || 'Book Now',
        lead_time_hours: Math.max(0, Number(lead) || 0),
        cta_selector: ctaSelector.trim(),
        logo_url: logoUrl || null,
      });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const inputBase =
    'w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[14px] text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#cc0000] focus:ring-2 focus:ring-[#cc0000]/20 transition bg-white';
  const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
  const helpBase = 'text-[12px] text-[#888] mt-1.5 leading-relaxed';

  return (
    <div className="max-w-2xl space-y-6">
      {/* Logo */}
      <div>
        <label className={labelBase}>Booking modal logo</label>
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-black/10 bg-[#faf9f7] flex items-center justify-center overflow-hidden shrink-0">
            {effectiveLogo ? (
              <img src={effectiveLogo} alt="Booking logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[11px] text-[#aaa] font-semibold">No logo</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[13px] font-semibold px-3.5 py-2 rounded-lg border border-black/10 bg-white text-[#1a1a1a] hover:border-[#cc0000] hover:text-[#cc0000] transition-colors"
              >
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-[13px] font-semibold px-3.5 py-2 rounded-lg border border-black/10 bg-white text-[#888] hover:text-[#cc0000] hover:border-[#cc0000] transition-colors"
                >
                  Remove
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
            <p className={helpBase}>
              {logoUrl
                ? 'Custom booking logo. Shown at the top of the customer-facing booking modal.'
                : siteLogo
                  ? 'Using the logo uploaded in your site editor. Upload a different one here to override just the booking modal.'
                  : 'No logo yet. Upload one in the site editor (Images tab → Logo) or here. PNG / SVG, under 500KB.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className={labelBase}>Welcome text</label>
        <textarea
          rows={3}
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          className={`${inputBase} resize-y`}
        />
        <p className={helpBase}>Shown at the top of the booking modal, under your brand bar.</p>
      </div>

      <div>
        <label className={labelBase}>Button label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={inputBase}
        />
        <p className={helpBase}>The label on the floating button and any auto-detected CTAs.</p>
      </div>

      <div>
        <label className={labelBase}>Minimum notice (hours)</label>
        <input
          type="number"
          min="0"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          className={`${inputBase} w-32`}
        />
        <p className={helpBase}>Customers can't book slots less than this far into the future.</p>
      </div>

      <div>
        <label className={labelBase}>
          CTA button selector <span className="font-normal text-[#aaa] normal-case tracking-normal">(optional)</span>
        </label>
        <input
          value={ctaSelector}
          onChange={(e) => setCtaSelector(e.target.value)}
          placeholder=".book-btn, #book-cta"
          className={`${inputBase} font-mono`}
        />
        <p className={helpBase}>
          CSS selector pointing at existing Book Now button(s) on the site. If set, it overrides auto-detection.
          Leave blank to auto-bind any button or link whose text contains <span className="font-mono text-[#1a1a1a]">"book"</span>.
        </p>
      </div>

      {err && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-[#cc0000] bg-red-50 text-[#8a0000] px-4 py-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="#cc0000" />
            <path d="M12 7v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1.2" fill="#fff" />
          </svg>
          <p className="text-[14px] font-semibold leading-snug">{err}</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={busy}
          className="px-6 py-2.5 rounded-xl text-[14px] font-semibold bg-[#1a1a1a] hover:bg-[#cc0000] text-white transition-colors disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
