import { TEMPLATES } from '../../data/templates.js';
import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import TemplateCard from '../ui/TemplateCard.jsx';

export default function StepTemplatePicker({ businessType, selected, onSelect, onGenerate, onPreview, error }) {
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const typeTemplateIds = typeInfo?.templates || [];
  const typeTemplates = typeTemplateIds.map((id) => TEMPLATES[id]).filter(Boolean);

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{typeInfo?.label}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Choose a website style</h1>
        <p className="text-gray-500 text-[15px]">
          AI will write all the copy — just pick the look and feel that fits your brand.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
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
