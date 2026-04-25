import { useEffect, useRef, useState } from 'react';
import { saveSchedulerConfig } from '../../../lib/schedulerConfig.js';

export default function GeneralTab({ siteId, config, siteImages, onSaved }) {
  const [welcome, setWelcome] = useState(config?.welcome_text || '');
  const [label, setLabel] = useState(config?.button_label || 'Book Now');
  const [lead, setLead] = useState(String(config?.lead_time_hours ?? 24));
  const [depositPct, setDepositPct] = useState(String(config?.deposit_percentage ?? 0));
  const [ctaSelector, setCtaSelector] = useState(config?.cta_selector || '');
  const [cancellationPolicy, setCancellationPolicy] = useState(config?.cancellation_policy || '');
  const [logoUrl, setLogoUrl] = useState(config?.logo_url || '');
  const [bookingMode, setBookingMode] = useState(config?.booking_mode === 'simple' ? 'simple' : 'full');
  const [modalTheme, setModalTheme] = useState(config?.modal_theme || 'light');
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  const MODAL_THEMES = [
    // Light variants
    { id: 'light',  label: 'Light',  swatch: { bg: '#ffffff', accent: '#1a1a1a', border: '#e5e5e5' } },
    { id: 'cream',  label: 'Cream',  swatch: { bg: '#fffbeb', accent: '#f59e0b', border: '#f0e6c7' } },
    { id: 'alloy',  label: 'Alloy',  swatch: { bg: '#F0F1F3', accent: '#A8813A', border: '#d4d7dd' } },
    { id: 'sky',    label: 'Sky',    swatch: { bg: '#f0f9ff', accent: '#06b6d4', border: '#bae6fd' } },
    { id: 'sand',   label: 'Sand',   swatch: { bg: '#faf6f0', accent: '#78716c', border: '#e7dfd4' } },
    { id: 'mint',   label: 'Mint',   swatch: { bg: '#f0fdfa', accent: '#14b8a6', border: '#99f6e4' } },
    // Dark variants
    { id: 'dark',   label: 'Dark',   swatch: { bg: '#1a1a1a', accent: '#ffffff', border: '#333333' } },
    { id: 'gold',   label: 'Gold',   swatch: { bg: '#0a0a0a', accent: 'linear-gradient(135deg,#ca8a04,#eab308,#fde047,#eab308,#ca8a04)', border: '#322300' } },
    { id: 'silver', label: 'Silver', swatch: { bg: '#0f0f11', accent: 'linear-gradient(135deg,#94a3b8,#cbd5e1,#64748b)', border: '#2a2d35' } },
    { id: 'neon',   label: 'Neon',   swatch: { bg: '#0d0d12', accent: 'linear-gradient(135deg,#7C3AED,#a855f7,#06B6D4)', border: '#2a1f4a' } },
    { id: 'rust',   label: 'Rust',   swatch: { bg: '#171717', accent: '#C0392B', border: '#3a1a15' } },
  ];

  const siteLogo = siteImages?.logo || null;
  const effectiveLogo = logoUrl || siteLogo;

  useEffect(() => {
    setWelcome(config?.welcome_text || '');
    setLabel(config?.button_label || 'Book Now');
    setLead(String(config?.lead_time_hours ?? 24));
    setDepositPct(String(config?.deposit_percentage ?? 0));
    setCtaSelector(config?.cta_selector || '');
    setCancellationPolicy(config?.cancellation_policy || '');
    setLogoUrl(config?.logo_url || '');
    setBookingMode(config?.booking_mode === 'simple' ? 'simple' : 'full');
    setModalTheme(config?.modal_theme || 'light');
  }, [config]);

  async function setTheme(next) {
    setModalTheme(next);
    try {
      const updated = await saveSchedulerConfig(siteId, { modal_theme: next });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
  }

  async function persistLogo(url) {
    setLogoBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, { logo_url: url || null });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
    finally { setLogoBusy(false); }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setErr('Logo must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setLogoUrl(dataUrl);
      persistLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoUrl('');
    persistLogo(null);
  }

  async function setMode(next) {
    setBookingMode(next);
    try {
      const updated = await saveSchedulerConfig(siteId, { booking_mode: next });
      onSaved && onSaved(updated);
    } catch (e) { setErr(e.message); }
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const clampedDepositPct = Math.max(0, Math.min(100, Number(depositPct) || 0));
      const updated = await saveSchedulerConfig(siteId, {
        welcome_text: welcome,
        button_label: label || 'Book Now',
        lead_time_hours: Math.max(0, Number(lead) || 0),
        deposit_percentage: clampedDepositPct,
        cta_selector: ctaSelector.trim(),
        cancellation_policy: cancellationPolicy.trim(),
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
      {/* Booking mode */}
      <div>
        <label className={labelBase}>Booking style</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${bookingMode === 'full' ? 'border-[#cc0000] bg-[#cc0000]/5' : 'border-black/10 bg-white hover:border-black/30'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-4 h-4 rounded-full border-2 ${bookingMode === 'full' ? 'border-[#cc0000] bg-[#cc0000]' : 'border-gray-300'}`}>
                {bookingMode === 'full' && <span className="block w-1.5 h-1.5 bg-white rounded-full m-[3px]" />}
              </span>
              <span className="font-bold text-[#1a1a1a] text-[14px]">Full date & time picker</span>
            </div>
            <p className="text-[12px] text-[#666] leading-relaxed pl-6">
              Customer picks a service, a date on the calendar, and an available time slot based on your availability.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${bookingMode === 'simple' ? 'border-[#cc0000] bg-[#cc0000]/5' : 'border-black/10 bg-white hover:border-black/30'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-4 h-4 rounded-full border-2 ${bookingMode === 'simple' ? 'border-[#cc0000] bg-[#cc0000]' : 'border-gray-300'}`}>
                {bookingMode === 'simple' && <span className="block w-1.5 h-1.5 bg-white rounded-full m-[3px]" />}
              </span>
              <span className="font-bold text-[#1a1a1a] text-[14px]">Simple contact form</span>
            </div>
            <p className="text-[12px] text-[#666] leading-relaxed pl-6">
              Skip the calendar. Customer writes a free-text preferred time and you follow up manually to confirm.
            </p>
          </button>
        </div>
      </div>

      {/* Modal theme */}
      <div>
        <label className={labelBase}>Modal theme</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {MODAL_THEMES.map((t) => {
            const isActive = modalTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${isActive ? 'border-[#cc0000]' : 'border-black/10 hover:border-black/30'}`}
              >
                <div
                  className="w-full aspect-square rounded-lg overflow-hidden border"
                  style={{ background: t.swatch.bg, borderColor: t.swatch.border }}
                >
                  <div style={{ height: '6px', background: t.swatch.accent }} />
                  <div className="p-1.5 flex flex-col gap-0.5">
                    <div className="h-1 rounded-full" style={{ background: t.swatch.accent, width: '70%', opacity: 0.9 }} />
                    <div className="h-0.5 rounded-full" style={{ background: t.swatch.accent, width: '50%', opacity: 0.6 }} />
                    <div className="h-0.5 rounded-full" style={{ background: t.swatch.accent, width: '40%', opacity: 0.4 }} />
                  </div>
                </div>
                <span className={`text-[11px] font-semibold ${isActive ? 'text-[#cc0000]' : 'text-[#1a1a1a]'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
        <p className={helpBase}>Color scheme of the customer-facing booking modal.</p>
      </div>

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
                disabled={logoBusy}
                className="text-[13px] font-semibold px-3.5 py-2 rounded-lg border border-black/10 bg-white text-[#1a1a1a] hover:border-[#cc0000] hover:text-[#cc0000] transition-colors disabled:opacity-50"
              >
                {logoBusy ? 'Saving…' : (logoUrl ? 'Replace logo' : 'Upload logo')}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  disabled={logoBusy}
                  className="text-[13px] font-semibold px-3.5 py-2 rounded-lg border border-black/10 bg-white text-[#888] hover:text-[#cc0000] hover:border-[#cc0000] transition-colors disabled:opacity-50"
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
                ? 'Custom booking logo (saved automatically). Shown at the top of the customer-facing modal.'
                : siteLogo
                  ? 'Using the logo uploaded in your site editor. Upload here to override just for the booking modal.'
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
        <label className={labelBase}>Deposit %</label>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={depositPct}
          onChange={(e) => setDepositPct(e.target.value)}
          className={`${inputBase} w-32`}
        />
        <p className={helpBase}>
          Charge a deposit when customers book. Set to 0 to disable. Requires a connected Stripe account; deposits are skipped on services without a numeric price.
        </p>
      </div>

      <div>
        <label className={labelBase}>
          Cancellation policy <span className="font-normal text-[#aaa] normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          rows={4}
          value={cancellationPolicy}
          onChange={(e) => setCancellationPolicy(e.target.value)}
          placeholder="e.g. Please give us at least 24 hours notice. Late cancellations may be subject to a $25 fee."
          className={`${inputBase} resize-y`}
        />
        <p className={helpBase}>
          Shown as a link on the final step of the booking form. Customers can click "cancellation policy" to read it before submitting.
        </p>
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
