import { useMemo, useState } from 'react';
import { useAdmins, useLeads, usePipeStages } from '../../../lib/pipeline.js';
import {
  OWNER_FILTERS, SORTS, filterLeads, openPipelineTotal, visibleOnBoard,
} from '../../../lib/pipelineFilters.js';
import { BTN_PRIMARY, BTN_SECONDARY, ErrorBox, INPUT, chipClass } from '../salesUi.jsx';
import PipeBoard, { LeadCard } from './PipeBoard.jsx';
import AddLeadModal from './AddLeadModal.jsx';
import MoveLeadModal, { StagePicker } from './MoveLeadModal.jsx';
import ConvertLeadModal from './ConvertLeadModal.jsx';
import StagesEditor from './StagesEditor.jsx';
import LeadDrawer from './LeadDrawer.jsx';

const money = (n) => `$${Math.round(n).toLocaleString()}`;

/**
 * Admin > Pipeline: every business we're selling a website to, as a board.
 * Ported from Genius Routes' Pipe. The Leads tab answers "who could buy";
 * this answers "who might, and what did we last do about it".
 *
 * openLeadId lives in AdminPage, so the Leads tab can drop an admin straight
 * into the lead it just created.
 */
export default function PipelineTab({ userId, openLeadId, onOpenLead }) {
  const [view, setView] = useState('board'); // 'board' | 'archived'
  const { stages, loading: stagesLoading, error: stagesError, refresh: refreshStages } = usePipeStages();
  const admins = useAdmins();
  const {
    leads, loading, error, refresh, addLead, moveLead, updateLead, archiveLead, unarchiveLead, convertLead,
  } = useLeads({ view });

  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('all');
  const [sort, setSort] = useState('age');
  const [adding, setAdding] = useState(false);
  const [editingStages, setEditingStages] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null); // { lead, toStageId? }
  const [converting, setConverting] = useState(null);
  // Bumped after a move or a conversion, so an open drawer re-reads its own
  // copy of the lead instead of showing the stage it was in before.
  const [version, setVersion] = useState(0);
  // Custom website projects created from a lead whose conversion didn't
  // finish, by lead id: reopening "They bought…" links that project instead
  // of creating another.
  const [unlinked, setUnlinked] = useState({});

  const onBoard = useMemo(() => (view === 'archived' ? leads : visibleOnBoard(leads, stages)), [leads, stages, view]);
  const rows = useMemo(() => filterLeads(onBoard, { search, owner, userId, sort }), [onBoard, search, owner, userId, sort]);
  const openTotal = openPipelineTotal(rows, stages);
  const wonStage = stages.find((s) => s.kind === 'won') || null;
  const moveStage = moveTarget?.toStageId ? stages.find((s) => s.id === moveTarget.toStageId) : null;
  const filtered = search.trim() !== '' || owner !== 'all';
  const busy = loading || stagesLoading;
  const failed = error || stagesError;

  async function confirmMove({ note, lostReason }) {
    const { lead, toStageId } = moveTarget;
    const res = await moveLead(lead, toStageId, { note, lostReason, userId });
    setVersion((n) => n + 1);
    // Won and not linked to anything yet: ask where they live in the builder now.
    if (!res.error && moveStage?.kind === 'won' && !lead.accountUserId && !lead.customProjectId) {
      setConverting({ ...lead, stageId: toStageId });
    }
    return res;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-[13px] text-[#555]">
          {view === 'archived'
            ? 'Leads you set aside.'
            : `${rows.length} lead${rows.length === 1 ? '' : 's'}${openTotal > 0 ? ` · ${money(openTotal)}/mo in play` : ''}`}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setView(view === 'archived' ? 'board' : 'archived')} className={BTN_SECONDARY}>
            {view === 'archived' ? 'Back to board' : 'Archived'}
          </button>
          <button type="button" onClick={() => setEditingStages(true)} className={BTN_SECONDARY}>Edit stages</button>
          {view === 'board' && (
            <button type="button" disabled={!stages.length} onClick={() => setAdding(true)} className={BTN_PRIMARY}>+ New lead</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business, contact, town, email…"
          aria-label="Search leads"
          className={`${INPUT} flex-1 min-w-[220px] sm:max-w-xs py-2`}
        />
        <div className="flex gap-1" role="group" aria-label="Whose leads">
          {OWNER_FILTERS.map((o) => (
            <button key={o.key} type="button" onClick={() => setOwner(o.key)} className={chipClass(owner === o.key)}>{o.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-[#555]">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-2 py-1.5 rounded-lg border border-black/[0.10] bg-white text-[12px] font-semibold text-[#1a1a1a]">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {busy && (
        <div className="flex gap-3" aria-live="polite">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 w-[280px] animate-pulse rounded-2xl bg-[#faf9f7]" />)}
        </div>
      )}

      {!busy && failed && <ErrorBox onRetry={() => { refresh(); refreshStages(); }}>{failed}</ErrorBox>}

      {!busy && !failed && stages.length === 0 && (
        <div className="rounded-xl border border-black/[0.07] bg-white px-6 py-10 text-center">
          <p className="text-sm text-[#555]">No stages yet.</p>
          <button type="button" onClick={() => setEditingStages(true)} className="mt-2 text-sm font-semibold text-[#cc0000]">Set up the pipeline →</button>
        </div>
      )}

      {!busy && !failed && stages.length > 0 && rows.length === 0 && (
        <div className="rounded-xl border border-black/[0.07] bg-white px-6 py-10 text-center">
          <p className="text-sm text-[#555]">
            {view === 'archived' ? 'Nothing archived.' : filtered ? 'No leads match that.' : 'No leads yet. Add one, or send some over from the Leads tab.'}
          </p>
          {filtered ? (
            <button type="button" onClick={() => { setSearch(''); setOwner('all'); }} className={`${BTN_SECONDARY} mt-3`}>Clear filters</button>
          ) : view === 'board' && (
            <button type="button" onClick={() => setAdding(true)} className={`${BTN_PRIMARY} mt-3`}>Add the first one</button>
          )}
        </div>
      )}

      {!busy && !failed && rows.length > 0 && (view === 'archived' ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((lead) => <li key={lead.id}><LeadCard lead={lead} onOpen={() => onOpenLead(lead.id)} /></li>)}
        </ul>
      ) : (
        <PipeBoard
          stages={stages}
          leads={rows}
          onOpen={(lead) => onOpenLead(lead.id)}
          onMove={(lead) => setMoveTarget({ lead })}
          onDrop={(lead, toStageId) => setMoveTarget({ lead, toStageId })}
        />
      ))}

      {adding && (
        <AddLeadModal
          stages={stages}
          admins={admins}
          userId={userId}
          existingLeads={leads}
          onClose={() => setAdding(false)}
          onCreate={(values) => addLead(values, userId)}
        />
      )}

      {editingStages && <StagesEditor onClose={() => setEditingStages(false)} onChanged={refreshStages} />}

      {moveTarget && !moveTarget.toStageId && (
        <StagePicker
          lead={moveTarget.lead}
          stages={stages}
          onClose={() => setMoveTarget(null)}
          onPick={(stageId) => setMoveTarget({ lead: moveTarget.lead, toStageId: stageId })}
        />
      )}
      {moveTarget && moveStage && (
        <MoveLeadModal lead={moveTarget.lead} toStage={moveStage} onClose={() => setMoveTarget(null)} onConfirm={confirmMove} />
      )}

      {converting && (
        <ConvertLeadModal
          lead={converting}
          initialCreated={unlinked[converting.id] || null}
          onCreated={(project) => setUnlinked((m) => ({ ...m, [converting.id]: project }))}
          onClose={() => setConverting(null)}
          onConvert={async (link) => {
            const res = await convertLead(converting, { ...link, wonStageId: wonStage?.id, userId });
            setVersion((n) => n + 1);
            if (!res.error && link.customProjectId) {
              setUnlinked((m) => { const next = { ...m }; delete next[converting.id]; return next; });
            }
            return res;
          }}
        />
      )}

      {openLeadId && (
        <LeadDrawer
          key={openLeadId}
          leadId={openLeadId}
          version={version}
          blocked={Boolean(moveTarget || converting || adding || editingStages)}
          stages={stages}
          admins={admins}
          userId={userId}
          onClose={() => onOpenLead(null)}
          onUpdate={updateLead}
          onMove={(lead) => setMoveTarget({ lead })}
          onConvert={(lead) => setConverting(lead)}
          onArchive={(id) => archiveLead(id, userId)}
          onUnarchive={unarchiveLead}
        />
      )}
    </div>
  );
}
