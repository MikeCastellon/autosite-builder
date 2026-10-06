import { useEffect, useId, useRef, useState } from 'react';
import { uploadReferenceShot } from '../../../lib/customSites.js';
import { MATCH_SHOT_LIMIT, referenceLabel } from '../../../lib/designSuggest.js';
import {
  SHOT_ACCEPT, newShotGroup, prepareShot, shotNote, shotProgress, shotStatusText, sortPickedShots, splitText,
} from './referenceMatch.js';

// Design step: the admin adds screenshots of a reference site. "Match its
// layout" only ever looks at screenshots (it never fetches a website), so
// a reference the customer gave only as an address needs one. Each file
// is checked here (PNG, JPEG or WebP, at most 10 MB), then prepared in the
// browser: one that is too wide, too tall or too heavy for a run is cut
// into parts (referenceMatch.js planTiles: at most MATCH_SHOT_LIMIT, top
// first, the rest of a very long page left out, which the panel says).
// Each part is uploaded straight to the project's private reference folder
// and recorded on the project (customSites.js uploadReferenceShot; the
// server checks again), the parts of one file as one group, so a match
// sends the whole page in order.
//
//   projectId   the project
//   onAdded     (asset, project) => void, once per screenshot (or part)
//               recorded: asset is the stored upload with signed
//               url/downloadUrl (like the project page's files), project
//               the saved row
//   sourceUrl   optional: the reference address these screenshots show;
//               their note then reads "Screenshot of <url>", which is how
//               a match on that address finds them
//   onBusy      optional: (busy) => void, true when a pick starts uploading
//               and false once it is done (even if this panel has gone
//               meanwhile). The first part recorded already makes a match
//               possible, so the page holds a match until the rest are in.
//   disabled

const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 focus-within:ring-2 focus-within:ring-[#cc0000]/40 transition-colors';

export default function ReferenceShotUpload({ projectId, onAdded, onBusy, sourceUrl = '', disabled = false }) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState([]);
  // [{ name, text }]: the files this pick cut into parts, and what of a
  // long page was left out.
  const [splits, setSplits] = useState([]);
  const alive = useRef(true);
  const noteId = useId();
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const busy = !!status;
  const label = sourceUrl ? referenceLabel({ kind: 'url', url: sourceUrl }) : '';

  // One file at a time, in the order picked, and one part at a time,
  // top first. A failed file doesn't stop the rest; a failed part stops
  // its file (the parts above it stay recorded, still in order).
  async function pick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const { ok, rejected } = sortPickedShots(files);
    const problems = rejected.map((r) => `${r.name}: ${r.error}`);
    const told = [];
    setErrors(problems);
    setSplits([]);
    // Every part carries the same note, so a match on the address finds
    // each of them.
    const text = shotNote(sourceUrl, note);
    if (ok.length) onBusy?.(true);
    try {
      for (let i = 0; i < ok.length; i += 1) {
        const file = ok[i];
        let part = 1;
        let parts = 1;
        const at = (phase) => { if (alive.current) setStatus({ index: i, total: ok.length, name: file.name, phase, part, parts }); };
        try {
          at('prepare');
          const { files: tiles, plan } = await prepareShot(file);
          parts = tiles.length;
          const split = parts > 1 ? splitText(plan) : '';
          if (split) {
            told.push({ name: file.name, text: split });
            if (alive.current) setSplits([...told]);
          }
          const group = parts > 1 ? newShotGroup() : '';
          for (let k = 0; k < tiles.length; k += 1) {
            part = k + 1;
            const { asset, project } = await uploadReferenceShot(projectId, tiles[k], {
              note: text, ...(group ? { group, part } : {}), onProgress: at,
            });
            // Recorded on the server either way: the page hears about it
            // even if this panel has gone meanwhile.
            onAdded?.(asset, project);
          }
        } catch (err) {
          const where = parts > 1 ? `${file.name} stopped at part ${part} of ${parts}` : file.name;
          problems.push(`${where}: ${err?.message || 'Upload failed'}`);
          if (alive.current) setErrors([...problems]);
        }
      }
    } finally {
      if (ok.length) onBusy?.(false);
    }
    if (!alive.current) return;
    setStatus(null);
    // The note stays for another try when anything went wrong.
    if (ok.length && !problems.length) setNote('');
  }

  const pct = status ? Math.round(shotProgress(status) * 100) : 0;

  return (
    <div className="rounded-xl border border-dashed border-black/[0.15] p-3">
      <p className="text-[12px] text-[#4a4a4a]">
        {label ? <>Add a screenshot of <span className="font-semibold">{label}</span>.</> : 'Add a screenshot of the reference site.'}
        {' '}PNG, JPEG or WebP, up to 10 MB. One full-page screenshot is fine: it's split into parts automatically, and a match looks at the
        top {MATCH_SHOT_LIMIT}.
      </p>
      <p className="mt-1 text-[11px] text-ink-tertiary">
        Used for ideas, or to match its layout and structure when you pick Match its layout. Its text, photos, logo, colors and brand never go on the customer's site.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={noteId} className="sr-only">Note for these screenshots</label>
        <input
          id={noteId}
          type="text"
          value={note}
          maxLength={300}
          disabled={disabled || busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What to look at (optional)"
          className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-black/[0.12] text-[13px] text-[#1a1a1a] disabled:opacity-50"
        />
        <label className={`${BTN} ${disabled || busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
          <input type="file" accept={SHOT_ACCEPT} multiple className="sr-only" disabled={disabled || busy} onChange={pick} />
          {busy ? 'Uploading…' : 'Add screenshots'}
        </label>
      </div>
      {status && (
        <div role="status" className="mt-2">
          <p className="text-[12px] text-[#4a4a4a]">{shotStatusText(status)}</p>
          <div
            className="mt-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="h-full bg-[#cc0000] motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>
      )}
      {splits.length > 0 && (
        <ul role="status" className="mt-2 space-y-0.5 text-[12px] text-[#4a4a4a]">
          {splits.map((s, i) => <li key={i}><span className="font-semibold">{s.name}</span> · {s.text}</li>)}
        </ul>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="mt-2 space-y-0.5 text-[12px] font-medium text-[#cc0000]">
          {errors.map((msg, i) => <li key={i}>{msg}</li>)}
        </ul>
      )}
    </div>
  );
}
