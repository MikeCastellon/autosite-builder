import { useState } from 'react';
import { TEMPLATES } from '../../data/templates.js';
import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import TemplateCard from '../ui/TemplateCard.jsx';

function ColorSwatch({ label, colorKey, baseColor, customColors, onCustomColors }) {
  const value = customColors[colorKey] ?? baseColor;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <label className="text-[11px] text-[#555] font-medium text-center leading-tight">{label}</label>
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-black/[0.07] hover:border-[#cc0000]/40 transition-colors cursor-pointer shadow-sm">
        <div className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onCustomColors((prev) => ({ ...prev, [colorKey]: e.target.value }))}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          title={label}
        />
      </div>
      {customColors[colorKey] && (
        <button
          onClick={() => onCustomColors((prev) => { const n = { ...prev }; delete n[colorKey]; return n; })}
          className="text-[10px] text-[#888] hover:text-[#cc0000] transition-colors"
          title="Reset to default"
        >
          reset
        </button>
      )}
    </div>
  );
}

export default function StepTemplatePicker({ businessType, selected, onSelect, onGenerate, onPreview, error, customColors, onCustomColors }) {
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const regularIds = typeInfo?.templates || [];
  const premiumIds = typeInfo?.premiumTemplates || [];
  const regularTemplates = regularIds.map((id) => TEMPLATES[id]).filter(Boolean);
  const premiumTemplates = premiumIds.map((id) => TEMPLATES[id]).filter(Boolean);
  const hasRegular = regularTemplates.length > 0;
  const hasPremium = premiumTemplates.length > 0;
  const hasBoth = hasRegular && hasPremium;

  const [activeTab, setActiveTab] = useState(hasRegular ? 'themes' : 'premium');

  const displayedTemplates = activeTab === 'themes' ? regularTemplates : premiumTemplates;
  const selectedTpl = selected ? TEMPLATES[selected] : null;

  const tabClass = (tab) =>
    `px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
      activeTab === tab
        ? 'bg-[#1a1a1a] text-white shadow-sm'
        : 'bg-[#faf9f7] text-[#555] hover:bg-[#f2f0ec]'
    }`;

  return (
    <div>
      <div className="mb-8">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">{typeInfo?.label}</p>
        <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] mb-2 tracking-[-1px] leading-[1.1]">Choose a website style</h1>
        <p className="text-[#555] text-[15px]">
          AI will write all the copy — just pick the look and feel that fits your brand.
        </p>
      </div>

      {hasBoth && (
        <div className="flex gap-2 mb-6">
          <button type="button" className={tabClass('themes')} onClick={() => setActiveTab('themes')}>
            Themes
          </button>
          <button type="button" className={tabClass('premium')} onClick={() => setActiveTab('premium')}>
            Premium
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {displayedTemplates.map((template) => (
          <div key={template.id} className="flex flex-col gap-1.5">
            <TemplateCard
              template={template}
              selected={selected}
              onClick={onSelect}
            />
            <button
              type="button"
              onClick={() => onPreview(template.id)}
              className="w-full text-[12px] font-medium text-[#555] hover:text-[#cc0000] py-1.5 border border-black/[0.07] hover:border-[#cc0000]/30 rounded-lg transition-colors"
            >
              Preview Demo
            </button>
          </div>
        ))}
      </div>

      {/* Color customizer — shown when a template is selected */}
      {selectedTpl && (
        <div className="mb-6 p-4 border border-black/[0.07] rounded-xl bg-[#faf9f7]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-bold text-[#1a1a1a]">Customize Colors</p>
              <p className="text-[12px] text-[#888]">Click any swatch to change it</p>
            </div>
            {Object.keys(customColors).length > 0 && (
              <button
                onClick={() => onCustomColors({})}
                className="text-[12px] text-[#888] hover:text-[#cc0000] border border-black/[0.07] hover:border-[#cc0000]/30 rounded-lg px-3 py-1 transition-colors"
              >
                Reset all
              </button>
            )}
          </div>
          <div className="flex items-start gap-5 flex-wrap">
            <ColorSwatch label="Background" colorKey="bg" baseColor={selectedTpl.colors.bg} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Accent / Brand" colorKey="accent" baseColor={selectedTpl.colors.accent} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Text" colorKey="text" baseColor={selectedTpl.colors.text} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Surface" colorKey="secondary" baseColor={selectedTpl.colors.secondary} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Muted Text" colorKey="muted" baseColor={selectedTpl.colors.muted} customColors={customColors} onCustomColors={onCustomColors} />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-[#cc0000]/5 border border-[#cc0000]/20 rounded-xl text-[#cc0000] text-sm">
          {error} — please try again.
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={!selected}
        className={`w-full font-semibold py-3.5 px-6 rounded-xl transition-all text-[15px]
          ${selected
            ? 'bg-[#1a1a1a] hover:bg-[#cc0000] text-white cursor-pointer'
            : 'bg-[#f2f0ec] text-[#888] cursor-not-allowed'}`}
      >
        {selected ? 'Generate My Website' : 'Select a style to continue'}
      </button>
    </div>
  );
}
