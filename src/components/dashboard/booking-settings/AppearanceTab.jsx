import { useState } from 'react';
import { saveSchedulerConfig, normalizeAppearance } from '../../../lib/schedulerConfig.js';

const labelBase = 'block text-[12px] font-semibold text-[#1a1a1a] mb-1.5 uppercase tracking-[0.5px]';
const helpBase = 'text-[12px] text-[#888] mt-1.5 leading-relaxed';
const inputBase = 'w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[14px]';

const SWATCHES = ['#1a1a1a', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c'];
const FONTS = ['Inter', 'Outfit', 'Poppins', 'Roboto', 'Georgia'];

export default function AppearanceTab({ siteId, config, onSaved }) {
  const [a, setA] = useState(() => normalizeAppearance(config?.appearance));
  const [saving, setSaving] = useState(false);

  function set(patch) { setA((prev) => ({ ...prev, ...patch })); }

  async function persist(next) {
    setSaving(true);
    try {
      const updated = await saveSchedulerConfig(siteId, { appearance: next });
      onSaved && onSaved(updated);
    } finally { setSaving(false); }
  }

  function commit(patch) {
    const next = { ...a, ...patch };
    setA(next);
    persist(next);
  }

  return (
    <div className="max-w-[560px]">
      <label className={labelBase}>Page style</label>
      <div className="flex gap-2 mb-5">
        {['minimal', 'branded'].map((v) => (
          <button key={v} type="button" onClick={() => commit({ page_style: v })}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${a.page_style === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10 text-[#1a1a1a]'}`}>
            {v}
          </button>
        ))}
      </div>

      <label className={labelBase}>Accent color</label>
      <div className="flex items-center gap-2 mb-1.5">
        {SWATCHES.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => commit({ accent_color: c })}
            style={{ background: c }}
            className={`w-7 h-7 rounded-lg ${a.accent_color === c ? 'ring-2 ring-offset-2 ring-[#1a1a1a]' : ''}`} />
        ))}
        <input type="color" value={a.accent_color} onChange={(e) => set({ accent_color: e.target.value })}
          onBlur={(e) => commit({ accent_color: e.target.value })} className="w-9 h-9 rounded-lg border border-black/10 p-0.5" />
        <input type="text" value={a.accent_color} onChange={(e) => set({ accent_color: e.target.value })}
          onBlur={(e) => commit({ accent_color: e.target.value })} className="w-28 border border-black/10 rounded-xl px-2.5 py-2 text-[13px] font-mono" />
      </div>
      <p className={helpBase}>Pick a preset, use the picker, or type a hex code.</p>

      <label className={`${labelBase} mt-5`}>Background</label>
      <div className="flex gap-2 mb-2">
        {['light', 'dark', 'image'].map((v) => (
          <button key={v} type="button" onClick={() => commit({ background: v })}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${a.background === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10 text-[#1a1a1a]'}`}>
            {v}
          </button>
        ))}
      </div>
      {a.background === 'image' && (
        <input type="url" placeholder="https://…/background.jpg" value={a.background_image_url}
          onChange={(e) => set({ background_image_url: e.target.value })}
          onBlur={(e) => commit({ background_image_url: e.target.value })} className={`${inputBase} mb-2`} />
      )}

      <label className={`${labelBase} mt-3`}>Corner style</label>
      <div className="flex gap-2 mb-5">
        {['rounded', 'sharp'].map((v) => (
          <button key={v} type="button" onClick={() => commit({ corner_style: v })}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold capitalize border ${a.corner_style === v ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-black/10 text-[#1a1a1a]'}`}>
            {v}
          </button>
        ))}
      </div>

      <label className={labelBase}>Font</label>
      <select value={a.font} onChange={(e) => commit({ font: e.target.value })} className={`${inputBase} mb-5`}>
        {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      <label className={labelBase}>Tagline (branded style)</label>
      <input type="text" value={a.tagline} onChange={(e) => set({ tagline: e.target.value })}
        onBlur={(e) => commit({ tagline: e.target.value })} placeholder="Premium car care, at your door" className={inputBase} />
      <p className={helpBase}>{saving ? 'Saving…' : 'Changes save automatically and apply live — no republish needed.'}</p>
    </div>
  );
}
