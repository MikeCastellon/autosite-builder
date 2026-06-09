import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { generateSlug } from '../../../lib/publishUtils.js';
import { defaultSchedulerConfig, defaultAppearance } from '../../../lib/schedulerConfig.js';
import { publishBookingPage } from '../../../lib/publishSite.js';
import ShareBookingCard from './ShareBookingCard.jsx';

const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
const inputBase = 'w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[14px]';
const SWATCHES = ['#1a1a1a', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c'];

export default function BookingOnlySetup({ onDone, onCancel }) {
  const { session } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [accent, setAccent] = useState('#1a1a1a');
  const [tagline, setTagline] = useState('');
  const [pageStyle, setPageStyle] = useState('branded');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { bookingUrl, siteId }

  function onName(v) {
    setBusinessName(v);
    if (!slugDirty) setSlug(generateSlug(v));
  }

  async function create() {
    setError('');
    if (!businessName.trim()) { setError('Enter a business name.'); return; }
    const finalSlug = (slug || generateSlug(businessName)).trim();
    if (!finalSlug) { setError('Enter a valid link slug.'); return; }
    setBusy(true);
    try {
      const appearance = { ...defaultAppearance(), accent_color: accent, tagline, page_style: pageStyle };
      const scheduler_config = { ...defaultSchedulerConfig(), appearance };

      const { data: site, error: insErr } = await supabase
        .from('sites')
        .insert({
          user_id: session.user.id,
          site_type: 'booking_only',
          business_info: { businessName },
          scheduler_enabled: true,
          scheduler_config,
          slug: finalSlug,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      const { bookingUrl } = await publishBookingPage({
        siteId: site.id, businessName, slug: finalSlug, asSubpath: false,
      });
      setResult({ bookingUrl, siteId: site.id });
      onDone && onDone(site.id);
    } catch (e) {
      setError(e.message || 'Could not create your booking page.');
    } finally { setBusy(false); }
  }

  if (result) {
    return (
      <div className="max-w-[560px] mx-auto py-8">
        <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-1">Your booking page is live 🎉</h2>
        <p className="text-[14px] text-[#888] mb-5">Share this link anywhere — Instagram, text, business cards.</p>
        <ShareBookingCard bookingUrl={result.bookingUrl} />
      </div>
    );
  }

  return (
    <div className="max-w-[560px] mx-auto py-8">
      <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-1">Set up your booking page</h2>
      <p className="text-[14px] text-[#888] mb-6">No website needed — just a link people can book from.</p>

      <label className={labelBase}>Business name</label>
      <input className={`${inputBase} mb-4`} value={businessName} onChange={(e) => onName(e.target.value)} placeholder="Joe's Mobile Detailing" />

      <label className={labelBase}>Your link</label>
      <div className="flex items-center border border-black/10 rounded-xl overflow-hidden mb-4">
        <span className="bg-[#f4f3f0] px-2.5 py-2.5 text-[12px] text-[#888] font-mono">book ·</span>
        <input className="flex-1 px-3 py-2.5 text-[13px] font-mono outline-none" value={slug}
          onChange={(e) => { setSlugDirty(true); setSlug(generateSlug(e.target.value)); }} placeholder="joes-detailing" />
      </div>

      <label className={labelBase}>Accent color</label>
      <div className="flex items-center gap-2 mb-4">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => setAccent(c)} style={{ background: c }}
            className={`w-7 h-7 rounded-lg ${accent === c ? 'ring-2 ring-offset-2 ring-[#1a1a1a]' : ''}`} />
        ))}
        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-9 h-9 rounded-lg border border-black/10 p-0.5" />
        <input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-24 border border-black/10 rounded-xl px-2.5 py-2 text-[13px] font-mono" />
      </div>

      <label className={labelBase}>Page style</label>
      <div className="flex gap-2 mb-4">
        {['minimal', 'branded'].map((v) => (
          <button key={v} type="button" onClick={() => setPageStyle(v)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${pageStyle === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10'}`}>{v}</button>
        ))}
      </div>

      <label className={labelBase}>Tagline (optional)</label>
      <input className={`${inputBase} mb-5`} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Premium car care, at your door" />

      {error && <p className="text-[13px] text-[#dc2626] mb-3">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={create}
          className="rounded-xl px-5 py-2.5 text-[14px] font-semibold bg-[#cc0000] text-white disabled:opacity-60">
          {busy ? 'Creating…' : 'Create booking page'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold border border-black/10">Cancel</button>}
      </div>
      <p className="text-[12px] text-[#888] mt-4">Next: add your services, prices, and availability in Booking Settings.</p>
    </div>
  );
}
