import { TEMPLATES } from '../../data/templates.js';
import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import TemplateCard from '../ui/TemplateCard.jsx';

function ColorSwatch({ label, colorKey, baseColor, customColors, onCustomColors }) {
  const value = customColors[colorKey] ?? baseColor;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <label className="text-[11px] text-gray-500 font-medium text-center leading-tight">{label}</label>
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-colors cursor-pointer shadow-sm">
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
          className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
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
  const typeTemplateIds = typeInfo?.templates || [];
  const typeTemplates = typeTemplateIds.map((id) => TEMPLATES[id]).filter(Boolean);
  const selectedTpl = selected ? TEMPLATES[selected] : null;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{typeInfo?.label}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Choose a website style</h1>
        <p className="text-gray-500 text-[15px]">
          AI will write all the copy — just pick the look and feel that fits your brand.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {typeTemplates.map((template) => (
          <div key={template.id} className="flex flex-col gap-1.5">
            <TemplateCard
              template={template}
              selected={selected}
              onClick={onSelect}
            />
            <button
              type="button"
              onClick={() => onPreview(template.id)}
              className="w-full text-[12px] font-medium text-gray-500 hover:text-gray-900 py-1.5 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors"
            >
              Preview Demo
            </button>
          </div>
        ))}
      </div>

      {/* Color customizer — shown when a template is selected */}
      {selectedTpl && (
        <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Customize Colors</p>
              <p className="text-[12px] text-gray-500">Click any swatch to change it</p>
            </div>
            {Object.keys(customColors).length > 0 && (
              <button
                onClick={() => onCustomColors({})}
                className="text-[12px] text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1 transition-colors"
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
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error} — please try again.
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={!selected}
        className={`w-full font-semibold py-3.5 px-6 rounded-lg transition-all text-[15px]
          ${selected
            ? 'bg-gray-900 hover:bg-gray-800 text-white cursor-pointer'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        {selected ? 'Generate My Website' : 'Select a style to continue'}
      </button>
    </div>
  );
}
