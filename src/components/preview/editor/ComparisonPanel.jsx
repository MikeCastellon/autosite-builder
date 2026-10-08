// Edit > Comparison: the "us vs. them" table (copy.comparison.rows: a label
// and two cells, each Yes / No / a short text / empty), the two column
// labels, and the band's heading and intro line (copy.comparison; Edit >
// Headings edits the same two and adds the small label and the highlighted
// words). The band is opt-in: it is on while copy.comparison exists, and the
// published page shows a row only once it has a label (kit/comparison.js).
//   businessName        the business column's label while the owner gives
//                       none (the page prints it the same way)
//   confirm(message, { title, confirmText }) -> Promise<boolean>: the
//                       editor's dialog, before the section is removed
import { useState } from 'react';
import { Label, Help, Note, Field, MoveButtons, smallInputClass, dashedButtonClass, linkButtonClass } from './fields.jsx';
import { CMP_DEFAULTS } from '../templates/kit/comparison.js';
import {
  CMP_TITLE_MAX, CMP_INTRO_MAX, CMP_COLUMN_MAX, CMP_LABEL_MAX, CMP_CELL_MAX, CMP_MAX_ROWS, CELL_MODES,
  cmpValue, cmpStart, cmpRows, cellMode, cellText, columnPlaceholders,
  cmpSetText, cmpSetLabel, cmpSetCell, cmpAddRow, cmpRemoveRow, cmpMoveRow,
} from './comparisonEdit.js';

const modeClass = (on) => `flex-1 py-1 px-1 rounded-md text-[11px] font-medium border transition ${
  on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
}`;

// One cell: Yes / No / Text / Empty, and the text box while it is text.
function CellControl({ label, mode, text, onMode, onText, name }) {
  return (
    <div className="mb-3">
      <Label>{label}</Label>
      <div className="flex gap-1 mb-1.5" role="radiogroup" aria-label={name}>
        {CELL_MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={modeClass(mode === m.id)} onClick={() => onMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'text' && (
        <input type="text" value={text} maxLength={CMP_CELL_MAX} placeholder="e.g. From $49" aria-label={`${name}: text`} onChange={(e) => onText(e.target.value)} className={smallInputClass} />
      )}
    </div>
  );
}

export function ComparisonPanel({ copy, setCopy, confirm, businessName = '', hasHeadingsTab = false }) {
  // Cells switched to Text but not typed yet: an empty text is an empty
  // cell in the saved row, so the choice is only remembered here.
  const [pendingText, setPendingText] = useState({});
  const cmp = cmpValue(copy);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('comparison');
  const hiddenNote = hidden && <Note tone="warn" title="This section is switched off in Sections." />;

  if (!cmp) {
    return (
      <>
        {hiddenNote}
        <Help className="mt-0 mb-3">Set what you do next to an alternative (an automated car wash, say), row by row, with checks, dashes or a few words. Only what you write shows.</Help>
        <button type="button" className={dashedButtonClass} onClick={() => setCopy('comparison', cmpStart())}>
          + Add a Comparison section
        </button>
      </>
    );
  }

  const rows = cmpRows(copy);
  const ph = columnPlaceholders(businessName);
  // Each cell control is named after its column, as the page labels it.
  const own = (v) => (typeof v === 'string' ? v.trim() : '');
  const usName = own(cmp.usLabel) || ph.usLabel;
  const themName = own(cmp.themLabel) || ph.themLabel;
  const write = (next) => { if (next) setCopy('comparison', next); };
  const key = (i, side) => `${i}:${side}`;
  const setMode = (i, side, mode, current) => {
    setPendingText((prev) => ({ ...prev, [key(i, side)]: mode === 'text' }));
    write(cmpSetCell(cmp, i, side, mode, mode === 'text' ? cellText(current) : ''));
  };
  // Removing or moving rows renumbers them: forget the pending choices.
  const reorder = (next) => {
    setPendingText({});
    write(next);
  };
  const removeSection = async () => {
    const ok = typeof confirm === 'function'
      ? await confirm('Remove the Comparison section? Its rows come off your page too.', { title: 'Remove section?', confirmText: 'Remove' })
      : true;
    if (ok) setCopy('comparison', null);
  };
  const full = rows.length >= CMP_MAX_ROWS;

  return (
    <>
      {hiddenNote}
      <Field label="Heading" value={cmp.title} onChange={(v) => write(cmpSetText(cmp, 'title', v))} placeholder={CMP_DEFAULTS.title} maxLength={CMP_TITLE_MAX} />
      <Field label="Intro line" value={cmp.intro} onChange={(v) => write(cmpSetText(cmp, 'intro', v))} placeholder="Optional" maxLength={CMP_INTRO_MAX} multiline rows={2} />
      {hasHeadingsTab && <Help className="-mt-2 mb-4">The small label above the heading and its highlighted words: Edit &gt; Headings.</Help>}

      <Field label="Your column" value={cmp.usLabel} onChange={(v) => write(cmpSetText(cmp, 'usLabel', v))} placeholder={ph.usLabel} maxLength={CMP_COLUMN_MAX} />
      <Field label="Compared with" value={cmp.themLabel} onChange={(v) => write(cmpSetText(cmp, 'themLabel', v))} placeholder={ph.themLabel} maxLength={CMP_COLUMN_MAX} help="Name a kind of alternative, never a real business." />

      <Label>Rows</Label>
      <Help className="mt-0 mb-3">A row shows on your site once it has a label. An empty cell stays empty. Up to {CMP_MAX_ROWS}.</Help>
      {rows.map((row, i) => {
        const cell = (side) => {
          const pending = pendingText[key(i, side)] && cellMode(row[side]) === 'blank';
          return {
            mode: pending ? 'text' : cellMode(row[side]),
            text: cellText(row[side]),
            onMode: (mode) => setMode(i, side, mode, row[side]),
            onText: (text) => write(cmpSetCell(cmp, i, side, 'text', text)),
          };
        };
        return (
          <div key={row.index} className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Row {i + 1}</p>
              <span className="flex items-center gap-1">
                <MoveButtons index={i} count={rows.length} onMove={(from, to) => reorder(cmpMoveRow(cmp, from, to))} label={`row ${i + 1}`} />
                <button type="button" onClick={() => reorder(cmpRemoveRow(cmp, i))} className="ml-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
              </span>
            </div>
            <Field label="Label" value={row.label} onChange={(v) => write(cmpSetLabel(cmp, i, v))} placeholder="e.g. Comes to you" maxLength={CMP_LABEL_MAX} />
            <CellControl label={usName} name={`Row ${i + 1}, your column`} {...cell('us')} />
            <CellControl label={themName} name={`Row ${i + 1}, compared with`} {...cell('them')} />
            {!row.labelled && <Help tone="warn" className="-mt-1">Not on your site yet: it needs a label.</Help>}
          </div>
        );
      })}
      <button type="button" className={dashedButtonClass} disabled={full} onClick={() => reorder(cmpAddRow(cmp))}>
        {full ? `Up to ${CMP_MAX_ROWS} rows` : '+ Add a row'}
      </button>
      <button type="button" className={linkButtonClass} onClick={removeSection}>Remove this section</button>
    </>
  );
}

export default ComparisonPanel;
