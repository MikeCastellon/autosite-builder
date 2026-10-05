import { useEffect, useRef, useState } from 'react';
import { customSiteAdmin } from '../../lib/customSites.js';
import {
  LAUNCH_ITEMS, LAUNCH_NOTES_MAX, MAX_ROUNDS, applyLaunchPatch, launchOf, launchProgress, roundStatus,
} from '../../lib/customSiteLaunch.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatDateTime } from './customSiteUi.jsx';

// The Launch card on a custom website project page: the go-live checklist
// and the revision-round counter (src/lib/customSiteLaunch.js). Every change
// shows at once and saves through custom-site-admin `launch-save` as a patch
// of just that change, so two admins ticking different items never undo
// each other. `onSaved(project)` gets the saved project (the page's own
// `saved`, which also refreshes the activity log).

const BTN_ROUND = 'inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-black/[0.12] text-[16px] font-bold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-40 transition-colors';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.10] text-sm focus:outline-none focus:border-[#cc0000]';

export function LaunchCard({ project, onSaved }) {
  const { toast } = useAlert();
  const server = launchOf(project);
  const [launch, setLaunch] = useState(server);
  const [notes, setNotes] = useState(server.notes);
  const [notesState, setNotesState] = useState('');
  const first = project.client_first_name || 'the customer';

  // Saves go out one after another, in click order: two quick clicks on +
  // must land as 1 then 2, never 2 then 1.
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  // The notes as last loaded: a refresh replaces the box only while it still
  // shows them (never text being typed).
  const loadedNotes = useRef(server.notes);

  // A new project from the page (after a save or a reload) is the truth, once
  // no save of ours is still on its way. Compared by value: the page hands
  // over a new project object on every reload.
  const serverKey = JSON.stringify(server);
  const serverKeyRef = useRef(serverKey);
  serverKeyRef.current = serverKey;
  useEffect(() => {
    const next = JSON.parse(serverKey);
    if (pending.current === 0) setLaunch(next);
    // Captured now: the updater below usually runs in the next render, after
    // loadedNotes already holds the new notes, so reading the ref there would
    // keep stale text in an idle box (and the next keystroke would save it).
    const before = loadedNotes.current;
    loadedNotes.current = next.notes;
    setNotes((current) => (current.trim() === before ? next.notes : current));
  }, [serverKey]);

  function save(patch) {
    setLaunch((l) => applyLaunchPatch(l, patch, new Date().toISOString()).launch);
    pending.current += 1;
    const run = queue.current.then(async () => {
      try {
        const res = await customSiteAdmin('launch-save', { id: project.id, launch: patch });
        pending.current -= 1;
        onSaved?.(res.project);
        return true;
      } catch (e) {
        pending.current -= 1;
        toast(e.message || 'Could not save', 'error');
        // Back to what the server has (the next reload brings it anyway).
        if (pending.current === 0) setLaunch(JSON.parse(serverKeyRef.current));
        return false;
      }
    });
    queue.current = run;
    return run;
  }

  // Notes autosave, debounced (like the project's own notes).
  useEffect(() => {
    // Typed back to what's saved: nothing to send.
    if (notes.trim() === loadedNotes.current) {
      setNotesState((s) => (s === 'pending' ? '' : s));
      return undefined;
    }
    setNotesState('pending');
    const t = setTimeout(async () => {
      setNotesState('saving');
      const ok = await save({ notes });
      setNotesState(ok ? '' : 'error');
    }, 900);
    return () => clearTimeout(t);
    // save is a fresh function each render; the notes are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const progress = launchProgress(launch);
  const rounds = roundStatus(launch);

  return (
    <section className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">Launch</h3>
        <span className={`ml-auto text-[12px] font-semibold ${progress.complete ? 'text-emerald-700' : 'text-ink-tertiary'}`}>{progress.label}</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden"
        role="progressbar"
        aria-label="Launch checklist"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <div className={`h-full rounded-full ${progress.complete ? 'bg-emerald-600' : 'bg-[#cc0000]'}`} style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>

      <ul className="mt-4 space-y-2.5">
        {LAUNCH_ITEMS.map((item) => {
          const at = launch.checked[item.id];
          // The hand-over itself is on record: say so until it's ticked.
          const note = !at && item.id === 'handed_over' && project.handed_over_at
            ? `Hand-over done ${formatDateTime(project.handed_over_at)}. Tick it once they can sign in.`
            : item.hint;
          return (
            <li key={item.id}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!at}
                  onChange={(e) => save({ checked: { [item.id]: e.target.checked } })}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#cc0000]"
                />
                <span className="min-w-0">
                  <span className={`block text-[13px] font-semibold ${at ? 'text-ink-tertiary line-through decoration-black/30' : 'text-[#1a1a1a]'}`}>{item.label}</span>
                  <span className="block text-[12px] text-ink-tertiary">{at ? `Done ${formatDateTime(at)}` : note}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 pt-4 border-t border-black/[0.06]">
        <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-ink-tertiary">Revisions</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => save({ round: rounds.round - 1 })}
              disabled={rounds.round <= 0}
              aria-label="One revision round less"
              className={BTN_ROUND}
            >
              −
            </button>
            <span className="min-w-[104px] text-center text-[14px] font-bold text-[#1a1a1a]" aria-live="polite">{rounds.label}</span>
            <button
              type="button"
              onClick={() => save({ round: rounds.round + 1 })}
              disabled={rounds.round >= MAX_ROUNDS}
              aria-label="One revision round more"
              className={BTN_ROUND}
            >
              +
            </button>
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-tertiary">
            Included
            <select
              value={rounds.included}
              onChange={(e) => save({ roundsIncluded: Number(e.target.value) })}
              className="px-2 py-1 rounded-lg border border-black/[0.12] bg-white text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#cc0000]"
            >
              {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {rounds.warning ? (
          <p className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900" role="status">
            {rounds.warning}. Agree on extra rounds with {first} before doing them.
          </p>
        ) : rounds.isLastIncluded ? (
          <p className="mt-2 text-[12px] text-ink-tertiary">This is the last included round.</p>
        ) : null}
      </div>

      <label className="block mt-5">
        <span className="block text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Launch notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={LAUNCH_NOTES_MAX}
          placeholder="What's left before launch, what each round changed…"
          className={`${INPUT} leading-relaxed`}
        />
      </label>
      <p className="text-[11px] text-ink-tertiary mt-1.5">
        {notesState === 'pending' || notesState === 'saving' ? 'Saving…' : notesState === 'error' ? 'Not saved' : 'Saves as you type'}
      </p>
    </section>
  );
}
