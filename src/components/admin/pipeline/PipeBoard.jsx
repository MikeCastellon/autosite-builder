import { useState } from 'react';
import { Avatar } from '../salesUi.jsx';
import { groupByStage, initials, isDue, monthlyLabel, stageAgeLabel } from '../../../lib/pipelineFilters.js';

const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * One card. Three fixed rows so a column of them scans like a list: who, where
 * and how much, then whose and what's next.
 */
export function LeadCard({ lead, onOpen, onMove, draggable = false, dragging = false, onDragStart, onDragEnd }) {
  const converted = Boolean(lead.accountUserId || lead.customProjectId);
  const due = isDue(lead.nextActionOn);
  const value = monthlyLabel(lead.estMonthlyValue);
  return (
    <div
      draggable={draggable && !converted}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl bg-white border border-black/[0.07] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[#cc0000]/40 transition-colors ${
        draggable && !converted ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-bold text-[#1a1a1a] leading-snug">{lead.companyName}</span>
          <span title="Time in this stage" className="shrink-0 rounded-full bg-[#faf9f7] border border-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-ink-tertiary">
            {stageAgeLabel(lead)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[#555]">
          <span className="truncate">{[lead.city, lead.contactName].filter(Boolean).join(' · ') || 'No contact yet'}</span>
          {value && <span className="shrink-0 font-semibold text-[#1a1a1a]">{value}</span>}
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <Avatar text={initials(lead.ownerName)} title={lead.ownerName || 'Unassigned'} />
          <span className="truncate text-[11px] text-ink-tertiary">{lead.ownerName || 'Unassigned'}</span>
        </span>
        {converted ? (
          <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Converted</span>
        ) : lead.nextActionOn ? (
          <span className={`shrink-0 text-[11px] font-semibold ${due ? 'text-[#cc0000]' : 'text-ink-tertiary'}`} title="Next action">
            {due ? '⚑ ' : ''}{fmtDay(lead.nextActionOn)}
          </span>
        ) : onMove ? (
          <button type="button" onClick={onMove} className="shrink-0 text-[11px] font-semibold text-[#cc0000] hover:underline">Move →</button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The board: one column per stage. Drag a card onto another column, or use
 * its Move button; either way the page opens the move dialog (a move carries
 * a note, and Lost needs a reason), so a drop never writes on its own.
 *
 * Native drag and drop: the admin is a desktop tool, and the Move button is
 * there for touch.
 */
export default function PipeBoard({ stages, leads, onOpen, onMove, onDrop }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const columns = groupByStage(leads, stages);
  const dragged = draggingId ? leads.find((l) => l.id === draggingId) : null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-3 px-3 snap-x">
      {columns.map(({ stage, leads: cards }) => {
        const over = overStage === stage.id && dragged && dragged.stageId !== stage.id;
        const terminal = stage.kind !== 'open';
        return (
          <section
            key={stage.id}
            aria-label={stage.name}
            onDragOver={(e) => {
              if (!dragged) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overStage !== stage.id) setOverStage(stage.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOverStage((s) => (s === stage.id ? null : s));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const lead = dragged;
              setOverStage(null);
              setDraggingId(null);
              if (lead && lead.stageId !== stage.id) onDrop(lead, stage.id);
            }}
            className={`snap-start shrink-0 w-[280px] rounded-2xl border p-2.5 transition-colors ${
              over ? 'border-[#cc0000] bg-[#fff5f5]' : stage.kind === 'lost' ? 'border-black/[0.05] bg-[#f3f2ef]' : 'border-black/[0.05] bg-[#faf9f7]'
            }`}
          >
            <header className="flex items-center justify-between px-1 pb-2">
              <h3 className={`text-[11px] font-bold uppercase tracking-wider ${terminal ? 'text-ink-tertiary' : 'text-[#1a1a1a]'}`}>{stage.name}</h3>
              <span className="rounded-full bg-white border border-black/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#555]">{cards.length}</span>
            </header>
            <ul className="space-y-2 min-h-[64px]">
              {cards.map((lead) => (
                <li key={lead.id}>
                  <LeadCard
                    lead={lead}
                    draggable
                    dragging={draggingId === lead.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      // Firefox won't start a drag without data.
                      e.dataTransfer.setData('text/plain', lead.id);
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setOverStage(null); }}
                    onOpen={() => onOpen(lead)}
                    onMove={() => onMove(lead)}
                  />
                </li>
              ))}
              {cards.length === 0 && (
                <li className="rounded-xl border border-dashed border-black/[0.12] px-3 py-5 text-center text-[11px] text-ink-tertiary">
                  {over ? 'Drop it here' : 'Nothing here yet'}
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
