// src/components/wizard/StepChooseSections.jsx
// New wizard step between Template and Generating. Composes the catalog panel
// (left) and the composition panel (right) and exposes a single "Generate" CTA.

import SectionCatalogPanel from './SectionCatalogPanel.jsx';
import SectionCompositionPanel from './SectionCompositionPanel.jsx';
import { addInstance } from '../../lib/sectionInstances.js';

export default function StepChooseSections({ templateId, sections, onSectionsChange, onGenerate, error }) {
  const handleAdd = (type) => onSectionsChange(addInstance(sections, type));

  return (
    <div className="-mx-4 sm:-mx-8 -mt-10 flex flex-col h-[calc(100vh-200px)]">
      <div className="px-4 sm:px-8 pt-2 pb-5">
        <h1 className="text-[clamp(22px,3.5vw,28px)] font-[900] text-[#1a1a1a] mb-1 tracking-[-0.5px] leading-[1.1]">Choose your sections</h1>
        <p className="text-[#555] text-[14px]">Compose the structure of your page. AI will write copy for everything you include.</p>
      </div>

      {error && (
        <div className="mx-4 sm:mx-8 mb-3 p-3 bg-[#cc0000]/5 border border-[#cc0000]/20 rounded-lg text-[#cc0000] text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex min-h-0 border-t border-black/[0.07]">
        <SectionCatalogPanel templateId={templateId} sections={sections} onAdd={handleAdd} />
        <SectionCompositionPanel sections={sections} onChange={onSectionsChange} />
      </div>

      <div className="border-t border-black/[0.07] bg-white px-4 sm:px-8 py-4">
        <button
          onClick={onGenerate}
          className="w-full font-semibold py-3.5 px-6 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[15px] transition-colors"
        >
          Generate My Website
        </button>
      </div>
    </div>
  );
}
