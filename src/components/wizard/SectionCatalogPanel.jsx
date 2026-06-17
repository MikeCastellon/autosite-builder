// src/components/wizard/SectionCatalogPanel.jsx
// Left panel of the Choose Sections wizard step.
// Lists section types grouped by intent. Clicking a card calls onAdd(type).
// Cards for already-locked-singleton types (e.g. hero, cta) are dimmed and disabled.

import { SECTION_GROUPS, getCatalogForTemplate } from '../../data/sectionCatalog.js';
import { hasInstance } from '../../lib/sectionInstances.js';

export default function SectionCatalogPanel({ templateId, sections, onAdd }) {
  const catalog = getCatalogForTemplate(templateId);
  const groups = {};
  for (const entry of catalog) {
    (groups[entry.group] ||= []).push(entry);
  }
  const groupOrder = ['essentials', 'content', 'template'];

  return (
    <aside className="w-80 shrink-0 border-r border-black/[0.07] bg-[#faf9f7] overflow-y-auto">
      <div className="px-4 py-4">
        <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-1">Add a section</p>
        <p className="text-[12px] text-[#888] mb-4">Click to add to the page on the right.</p>
        {groupOrder.map(g => {
          if (!groups[g]?.length) return null;
          return (
            <div key={g} className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888] mb-2">{SECTION_GROUPS[g]}</p>
              <div className="flex flex-col gap-1.5">
                {groups[g].map(entry => {
                  const alreadyHas = hasInstance(sections, entry.type);
                  const isSingleton = !entry.multi;
                  const isLocked = !!entry.locked;
                  const disabled = isLocked || (isSingleton && alreadyHas);
                  return (
                    <button
                      key={entry.type}
                      type="button"
                      onClick={() => !disabled && onAdd(entry.type)}
                      disabled={disabled}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-colors
                        ${disabled
                          ? 'border-black/[0.04] bg-white/40 text-[#bbb] cursor-not-allowed'
                          : 'border-black/[0.07] bg-white hover:border-[#cc0000]/30 hover:bg-white text-[#1a1a1a] cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold">{entry.label}</span>
                        {entry.multi && !isLocked && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#cc0000] bg-[#cc0000]/10 px-1.5 py-0.5 rounded">multi</span>
                        )}
                        {isLocked && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#888] bg-black/5 px-1.5 py-0.5 rounded">locked</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#888] mt-0.5 leading-snug">{entry.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
