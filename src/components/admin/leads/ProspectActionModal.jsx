import { useEffect, useState } from 'react';
import { DISMISS_REASONS } from '../../../lib/prospectFilters.js';
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT, Modal } from '../salesUi.jsx';

const COPY = {
  pipe: {
    title: 'Add to the Pipeline',
    help: 'It becomes your lead, in the first stage. The note goes on the lead.',
    button: 'Add to Pipeline',
  },
  dismiss: {
    title: 'Not a fit',
    help: 'Takes it off New for every admin, with the reason.',
    button: 'Not a fit',
  },
  restore: {
    title: 'Put it back on New',
    help: 'The reason and note below are cleared.',
    button: 'Put back',
  },
};

/**
 * The decision on one business: to the Pipeline, or not a fit, each with a
 * note. "Not a fit" needs a reason, and "Other" needs the note to say what.
 * action = { mode: 'pipe' | 'dismiss' | 'restore', prospect }
 */
export default function ProspectActionModal({ action, onClose, onPipe, onDismiss, onRestore }) {
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // A new business, or a new decision, starts with a clean form.
  useEffect(() => { setNote(''); setReason(''); setError(''); }, [action?.prospect?.id, action?.mode]);

  if (!action) return null;
  const { mode, prospect } = action;
  const copy = COPY[mode];

  async function submit(e) {
    e.preventDefault();
    if (mode === 'dismiss') {
      if (!reason) { setError('Pick a reason.'); return; }
      if (reason === 'Other' && !note.trim()) { setError('Say what it is in the note.'); return; }
    }
    setBusy(true);
    setError('');
    const res = mode === 'pipe' ? await onPipe(prospect.id, note)
      : mode === 'dismiss' ? await onDismiss(prospect.id, reason, note)
        : await onRestore(prospect.id);
    setBusy(false);
    if (res?.error) setError(res.error);
    else onClose();
  }

  return (
    <Modal
      title={copy.title}
      subtitle={prospect.name}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="submit" form="prospect-action-form" disabled={busy} className={BTN_PRIMARY}>{busy ? 'Saving…' : copy.button}</button>
        </>
      )}
    >
      <form id="prospect-action-form" onSubmit={submit} className="space-y-3 pb-2">
        <p className="text-[13px] text-[#555]">{copy.help}</p>
        {mode === 'restore' && (prospect.dismiss_reason || prospect.status_note) && (
          <div className="rounded-lg bg-[#faf9f7] px-3 py-2 text-[13px] text-[#555]">
            {prospect.dismiss_reason && <p><span className="font-semibold">Reason:</span> {prospect.dismiss_reason}</p>}
            {prospect.status_note && <p className="whitespace-pre-wrap"><span className="font-semibold">Note:</span> {prospect.status_note}</p>}
          </div>
        )}
        {mode === 'dismiss' && (
          <fieldset className="space-y-1.5">
            <legend className="text-[12px] font-semibold text-[#1a1a1a] mb-1">Why?</legend>
            {[...DISMISS_REASONS, 'Other'].map((r) => (
              <label key={r} className="flex items-center gap-2 text-[13px] text-[#1a1a1a] cursor-pointer">
                <input type="radio" name="dismiss-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#cc0000]" />
                {r}
              </label>
            ))}
          </fieldset>
        )}
        {mode !== 'restore' && (
          <Field label="Note" hint={mode === 'dismiss' && reason === 'Other' ? 'Required for Other.' : 'Optional.'}>
            <textarea rows={3} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} className={`${INPUT} leading-relaxed`} />
          </Field>
        )}
        {error && <p role="alert" className="text-[12px] font-semibold text-[#cc0000]">{error}</p>}
      </form>
    </Modal>
  );
}
