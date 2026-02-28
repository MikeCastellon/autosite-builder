import { TEMPLATES } from '../../data/templates.js';
import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import TemplateCard from '../ui/TemplateCard.jsx';

export default function StepTemplatePicker({ businessType, selected, onSelect, onGenerate, error }) {
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const typeTemplateIds = typeInfo?.templates || [];
  const typeTemplates = typeTemplateIds.map((id) => TEMPLATES[id]).filter(Boolean);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{typeInfo?.icon}</span>
          <span className="text-sm font-medium text-blue-400 uppercase tracking-wider">{typeInfo?.label}</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Pick your website style</h1>
        <p className="text-gray-400">AI will fill in all the copy — just pick the look and feel.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {typeTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selected}
            onClick={onSelect}
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/40 border border-red-700 rounded-xl text-red-300 text-sm">
          {error} — please try again.
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={!selected}
        className={`w-full font-semibold py-4 px-6 rounded-xl transition-all text-lg
          ${selected
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
      >
        {selected ? '✨ Generate My Website' : 'Select a template to continue'}
      </button>
    </div>
  );
}
