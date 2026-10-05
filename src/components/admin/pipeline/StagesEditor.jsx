import { useState } from 'react';
import { useAlert } from '../../ui/AlertProvider.jsx';
import { supabase } from '../../../lib/supabase.js';
import { usePipeStages } from '../../../lib/pipeline.js';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, INPUT, Modal } from '../salesUi.jsx';

const KIND = {
  open: ['In play', 'bg-[#faf9f7] text-[#555] border-black/[0.08]'],
  won: ['Won', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  lost: ['Lost', 'bg-gray-100 text-gray-600 border-gray-200'],
};

/**
 * The Pipeline's columns: rename, reorder, hide, add. Hidden rather than
 * deleted, because leads and their journeys still point at a stage. The last
 * active Won or Lost column can't be hidden: the board needs somewhere for a
 * lead to end. Nor can a column that still holds live leads: they would
 * vanish from the board with it, out of reach until it came back.
 */
export default function StagesEditor({ onClose, onChanged }) {
  const { toast } = useAlert();
  const { stages, loading, error, addStage, updateStage, moveStage } = usePipeStages({ includeInactive: true });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.error) toast(res.error, 'error');
    // A stage that was added but not reordered is still on the board.
    if (!res?.error || res?.added) onChanged?.();
    return res;
  }

  async function toggle(stage) {
    if (stage.active) {
      const { count, error } = await supabase.from('sales_leads')
        .select('id', { count: 'exact', head: true }).eq('stage_id', stage.id).is('archived_at', null);
      if (error) { toast(error.message, 'error'); return; }
      if (count) {
        toast(`Move the ${count} lead${count === 1 ? '' : 's'} in ${stage.name} to another stage first.`, 'error');
        return;
      }
    }
    run(() => updateStage(stage.id, { active: !stage.active }));
  }

  function lastOfKind(stage) {
    return stage.kind !== 'open' && stage.active
      && stages.filter((s) => s.kind === stage.kind && s.active).length === 1;
  }

  return (
    <Modal
      title="Pipeline stages"
      subtitle="The columns on the board, top to bottom = left to right."
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={BTN_PRIMARY}>Done</button>}
    >
      {loading && <p className="text-sm text-ink-tertiary pb-2">Loading…</p>}
      {error && <p role="alert" className="text-sm text-[#cc0000] pb-2">{error}</p>}
      <ul className="space-y-1.5">
        {stages.map((s, i) => {
          const [label, cls] = KIND[s.kind] || KIND.open;
          return (
            <li key={s.id} className={`flex items-center gap-2 rounded-lg border border-black/[0.07] px-2 py-1.5 ${s.active ? '' : 'opacity-60'}`}>
              <span className="flex flex-col">
                <button type="button" aria-label={`Move ${s.name} up`} disabled={busy || i === 0} onClick={() => run(() => moveStage(s.id, 'up'))} className="px-1 text-[10px] text-ink-tertiary hover:text-[#1a1a1a] disabled:opacity-30">▲</button>
                <button type="button" aria-label={`Move ${s.name} down`} disabled={busy || i === stages.length - 1} onClick={() => run(() => moveStage(s.id, 'down'))} className="px-1 text-[10px] text-ink-tertiary hover:text-[#1a1a1a] disabled:opacity-30">▼</button>
              </span>
              <input
                key={`${s.id}:${s.name}`}
                defaultValue={s.name}
                aria-label="Stage name"
                maxLength={60}
                disabled={busy}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (!next) { e.target.value = s.name; return; }
                  if (next !== s.name) run(() => updateStage(s.id, { name: next }));
                }}
                className={`${INPUT} py-1.5`}
              />
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
              <button
                type="button"
                disabled={busy || lastOfKind(s)}
                title={lastOfKind(s) ? `The board needs one ${s.kind} column` : undefined}
                onClick={() => toggle(s)}
                className={`${BTN_GHOST} shrink-0`}
              >
                {s.active ? 'Hide' : 'Show'}
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="mt-3 pb-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await run(() => addStage(name));
          if (!res?.error || res?.added) setName('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="New stage (lands before Won)" className={INPUT} />
        <button type="submit" disabled={busy || !name.trim()} className={`${BTN_SECONDARY} shrink-0`}>Add</button>
      </form>
    </Modal>
  );
}
