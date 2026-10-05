import { useState } from 'react';
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT, Modal } from '../salesUi.jsx';

/** Which column? Only for the Move button; a drop already knows. */
export function StagePicker({ lead, stages, onClose, onPick }) {
  return (
    <Modal title={`Move ${lead.companyName}`} subtitle="Where to?" onClose={onClose} width="max-w-sm">
      <ul className="space-y-1 pb-2">
        {stages.filter((s) => s.id !== lead.stageId).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s.id)}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#1a1a1a] hover:bg-[#faf9f7]"
            >
              {s.name}
              {s.kind !== 'open' && <span className="ml-2 text-[11px] font-medium text-ink-tertiary">{s.kind === 'won' ? 'they bought' : 'they didn\'t'}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/**
 * Every move ends here, from a drag or the Move button: a move is a step in
 * the journey, and a step can carry a note. A lost lead must say why: a lost
 * lead with no reason teaches nobody anything.
 */
export default function MoveLeadModal({ lead, toStage, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lost = toStage.kind === 'lost';

  async function submit(e) {
    e.preventDefault();
    if (lost && !lostReason.trim()) { setError('Say why. A lost lead with no reason teaches nobody anything.'); return; }
    setBusy(true);
    setError('');
    const res = await onConfirm({ note, lostReason: lost ? lostReason : null });
    setBusy(false);
    if (res?.error) setError(res.error);
    else onClose();
  }

  return (
    <Modal
      title={`Move to ${toStage.name}`}
      subtitle={lead.companyName}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="submit" form="move-lead-form" disabled={busy} className={BTN_PRIMARY}>{busy ? 'Moving…' : 'Move'}</button>
        </>
      )}
    >
      <form id="move-lead-form" onSubmit={submit} className="space-y-3 pb-2">
        {lost && (
          <Field label="Why did it go away?" required>
            <input autoFocus value={lostReason} maxLength={200} onChange={(e) => setLostReason(e.target.value)} className={INPUT} placeholder="e.g. Went with Wix, too expensive, closed" />
          </Field>
        )}
        <Field label="Note" hint="Optional. Shows on the lead's journey.">
          <textarea autoFocus={!lost} rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={`${INPUT} leading-relaxed`} />
        </Field>
        {error && <p role="alert" className="text-[12px] font-semibold text-[#cc0000]">{error}</p>}
      </form>
    </Modal>
  );
}
