import { useEffect, useRef, useState } from 'react';
import { BTN_SMALL, moveSection, resetSectionOrder, sectionRows, sectionsSupported, toggleSectionHidden } from './studioFields.js';

// Design Studio: the template's sections top to bottom, with up/down
// buttons and a show/hide switch. The hero and the contact section
// (ALWAYS_SHOWN) can move but never hide.
//
// Controlled over levers.sections:
//   templateId  the chosen template (TEMPLATE_SECTIONS lists its sections)
//   value       { order: [], hidden: [] } (order [] = the template's own)
//   onChange    (nextSections) => void

const ARROW = 'w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-[#4a4a4a] hover:text-[#1a1a1a] hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';

export default function SectionsField({ templateId, value, onChange }) {
  const listRef = useRef(null);
  // The arrow to put focus back on after a move: React moves the row, and
  // the button that was pressed can lose focus on the way.
  const refocus = useRef(null);
  const [announce, setAnnounce] = useState('');
  const sections = value || { order: [], hidden: [] };
  const rows = sectionRows(sections, templateId);

  useEffect(() => {
    const want = refocus.current;
    if (!want || !listRef.current) return;
    refocus.current = null;
    const find = (dir) => listRef.current.querySelector(`button[data-move="${want.id}:${dir}"]`);
    const button = find(want.dir);
    // At the top (or bottom) now: the other arrow is the one still usable.
    (button && !button.disabled ? button : find(want.dir === 'up' ? 'down' : 'up'))?.focus();
  });

  if (!sectionsSupported(templateId)) {
    return <p className="text-[13px] text-ink-tertiary">This template keeps its own section order. Pick a newer template to reorder or hide sections.</p>;
  }

  function move(row, dir) {
    const next = moveSection(sections, templateId, row.id, dir === 'up' ? -1 : 1);
    refocus.current = { id: row.id, dir };
    setAnnounce(`${row.label} moved to position ${row.index + (dir === 'up' ? 0 : 2)} of ${rows.length}.`);
    onChange(next);
  }

  function toggle(row) {
    setAnnounce(`${row.label} ${row.hidden ? 'shown' : 'hidden'}.`);
    onChange(toggleSectionHidden(sections, templateId, row.id));
  }

  const customOrder = Array.isArray(sections.order) && sections.order.length > 0;

  return (
    <div>
      <ol ref={listRef} className="rounded-xl border border-black/[0.08] divide-y divide-black/[0.06]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-5 shrink-0 text-[12px] font-bold text-ink-tertiary tabular-nums" aria-hidden="true">{r.index + 1}</span>
            <span className={`flex-1 min-w-0 text-[13px] font-semibold truncate ${r.hidden ? 'text-ink-tertiary line-through' : 'text-[#1a1a1a]'}`}>
              {r.label}
              {r.hidden && <span className="sr-only"> (hidden)</span>}
            </span>
            <button type="button" data-move={`${r.id}:up`} onClick={() => move(r, 'up')} disabled={r.first} aria-label={`Move ${r.label} up`} title="Move up" className={ARROW}>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 7.5L6 4.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" data-move={`${r.id}:down`} onClick={() => move(r, 'down')} disabled={r.last} aria-label={`Move ${r.label} down`} title="Move down" className={ARROW}>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {r.locked ? (
              <span className="w-[76px] shrink-0 text-right text-[11px] font-semibold text-ink-tertiary">Always on</span>
            ) : (
              <span className="w-[76px] shrink-0 flex justify-end">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!r.hidden}
                  aria-label={`Show ${r.label}`}
                  onClick={() => toggle(r)}
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 ${r.hidden ? 'bg-black/[0.15]' : 'bg-[#cc0000]'}`}
                >
                  <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white shadow motion-safe:transition-transform ${r.hidden ? 'translate-x-0.5' : 'translate-x-[18px]'}`} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setAnnounce('Back to the template\'s order.'); onChange(resetSectionOrder(sections, templateId)); }}
          disabled={!customOrder}
          className={BTN_SMALL}
        >
          Reset to template order
        </button>
        <span className="text-[11px] text-ink-tertiary">The hero and the contact section can move but always show.</span>
      </div>
    </div>
  );
}
