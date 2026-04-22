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
  const recommendedIds = [...(typeInfo?.templates || []), ...(typeInfo?.premiumTemplates || [])];

  // Show every visible template at once — recommended ones get a badge,
  // but nothing is hidden behind a "Show all" toggle anymore.
  const recommendedSet = new Set(recommendedIds);
  const visibleTemplates = Object.values(TEMPLATES)
    .filter((t) => t && !t.hidden)
    .sort((a, b) => {
      const aRec = recommendedSet.has(a.id) ? 0 : 1;
      const bRec = recommendedSet.has(b.id) ? 0 : 1;
      return aRec - bRec;
    });

  const selectedTpl = selected ? TEMPLATES[selected] : null;

  const TemplateGrid = ({ templates }) => (
    <div className="grid gap-3 mb-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
      {templates.map((template) => {
        const isRecommended = recommendedSet.has(template.id);
        return (
          <div key={template.id} className="flex flex-col gap-1.5 relative min-w-0">
            {isRecommended && (
              <span className="absolute top-2 left-2 z-10 bg-[#cc0000] text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shadow-sm">
                Recommended
              </span>
            )}
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
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">{typeInfo?.label}</p>
        <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] mb-2 tracking-[-1px] leading-[1.1]">Choose a website style</h1>
        <p className="text-[#555] text-[15px]">
          AI will write all the copy — just pick the look and feel that fits your brand.
        </p>
      </div>

      {/* All templates — recommended ones surface to the top and get a badge */}
      <div className="mb-6">
        {typeInfo?.label && (
          <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3 flex items-center gap-2">
            <span>⭐</span> Recommended for {typeInfo.label} shown first
          </p>
        )}
        <TemplateGrid templates={visibleTemplates} />
      </div>

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
