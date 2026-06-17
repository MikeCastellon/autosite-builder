// src/components/wizard/SectionCompositionPanel.jsx
// Right panel of the Choose Sections wizard step. Shows the ordered list of
// section instances. Each row: drag handle + label + (× and duplicate when applicable).
// Hero and Contact/CTA are locked at top/bottom respectively.

import { useState } from 'react';
import { getCatalogEntry } from '../../data/sectionCatalog.js';
import { removeInstance, moveInstance, duplicateInstance } from '../../lib/sectionInstances.js';

export default function SectionCompositionPanel({ sections, onChange }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver  = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop      = (idx) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const moving = sections[dragIdx];
    if (moving?.locked) { setDragIdx(null); setDragOverIdx(null); return; }
    onChange(moveInstance(sections, moving.id, idx));
    setDragIdx(null); setDragOverIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  return (
    <main className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6">
        <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-1">Your page</p>
        <p className="text-[12px] text-[#888] mb-5">Drag to reorder. Hero stays on top and the Contact/CTA at the bottom.</p>
        <div className="flex flex-col gap-1.5">
          {sections.map((inst, idx) => {
            const entry = getCatalogEntry(inst.type);
            const label = entry?.label || inst.type;
            const isLocked = !!inst.locked;
            const isDup = !!entry?.multi;
            return (
              <div
                key={inst.id}
                draggable={!isLocked}
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={onDragEnd}
                className="flex items-center gap-2.5 py-3 px-3 rounded-lg border border-black/[0.07] bg-white select-none"
                style={{
                  opacity: dragIdx === idx ? 0.35 : 1,
                  boxShadow: dragOverIdx === idx && dragIdx !== idx ? 'inset 0 2px 0 0 #cc0000' : 'none',
                  cursor: isLocked ? 'default' : 'grab',
                }}
              >
                <span className="text-[#bbb] text-[14px] leading-none shrink-0" title={isLocked ? 'Locked' : 'Drag to reorder'}>
                  {isLocked ? '🔒' : '⠿'}
                </span>
                <span className="flex-1 text-[13px] font-medium text-[#1a1a1a]">{label}</span>
                {isDup && !isLocked && (
                  <button
                    type="button"
                    onClick={() => onChange(duplicateInstance(sections, inst.id))}
                    className="text-[11px] font-medium text-[#555] hover:text-[#cc0000] px-2 py-1 rounded transition-colors"
                    title="Duplicate this section"
                  >
                    + Duplicate
                  </button>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => onChange(removeInstance(sections, inst.id))}
                    className="text-[#bbb] hover:text-[#cc0000] text-[18px] leading-none w-6 h-6 flex items-center justify-center transition-colors shrink-0"
                    title="Remove"
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
