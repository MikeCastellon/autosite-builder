// Services tab: the optional "Package details" of one service card (short
// summary, badge, photo, what's included). ContentEditor mounts it inside
// each card after Description and writes each change (onPatch) to both
// businessInfo.services and .packages. Name, price and description stay
// with the card's own fields; every write here goes through
// setServiceField, which keeps those keys and drops emptied ones.
import { useState, useRef, useEffect } from 'react';
import {
  Field, ImageSlot, Label, Help, MoveButtons,
  smallInputClass, dashedButtonClass, moveItem, removeAt, replaceAt,
} from './fields.jsx';
import {
  SUMMARY_MAX, BADGE_MAX, INCLUDES_MAX,
  serviceObject, setServiceField, includeText, isHeading, isHighlighted,
  withText, toggleHeading, toggleHighlight, hasDetails, photoUploadKey,
  pasteIncludes, insertIncludeAfter,
} from './serviceDetails.js';

const toggleClass = (pressed) =>
  `text-[10px] font-semibold px-1 py-1 rounded border shrink-0 transition disabled:opacity-30 disabled:cursor-not-allowed ${
    pressed ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
  }`;

// The "What's included" list. Not fields.jsx's TextListEditor: a service
// card is only ~175-190px wide inside the editor panel, too narrow for the
// text plus five buttons on one line (the text box shrank to nothing). Each
// row here takes two lines: the text and its remove button, then the
// Heading / Highlight toggles and the move arrows. Control names match
// TextListEditor's ("item 2", "Move item 2 up", "Remove item 2").
function IncludesEditor({ items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  const full = list.length >= INCLUDES_MAX;
  // Typing a list row by row: Enter adds the next row, a pasted list splits
  // into rows, and the new row gets the cursor once the list has rendered.
  const inputs = useRef([]);
  const focusAt = useRef(null);
  useEffect(() => {
    if (focusAt.current == null) return;
    const el = inputs.current[focusAt.current];
    focusAt.current = null;
    if (el) el.focus();
  });
  const write = (next, focus) => {
    focusAt.current = focus;
    onChange(next);
  };
  return (
    <div className="mb-2">
      {list.map((item, i) => {
        const update = (next) => onChange(replaceAt(list, i, next));
        const heading = isHeading(item);
        const highlighted = isHighlighted(item);
        const blank = includeText(item).trim() === '';
        return (
          <div key={i} className="mb-2.5">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={includeText(item)}
                placeholder="e.g. Foam hand wash"
                aria-label={`item ${i + 1}`}
                ref={(el) => { inputs.current[i] = el; }}
                onChange={(e) => update(withText(item, e.target.value))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  const next = insertIncludeAfter(list, i);
                  if (next) write(next, i + 1);
                }}
                onPaste={(e) => {
                  const pasted = pasteIncludes(list, i, e.clipboardData?.getData('text') || '');
                  if (!pasted) return;
                  e.preventDefault();
                  write(pasted.list, pasted.last);
                }}
                className={`${smallInputClass}${heading ? ' font-semibold' : ''}`}
              />
              <button type="button" className="shrink-0 text-gray-300 hover:text-red-500 transition p-0.5" onClick={() => onChange(removeAt(list, i))} aria-label={`Remove item ${i + 1}`} title="Remove">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <button
                type="button"
                className={toggleClass(heading)}
                aria-pressed={heading}
                aria-label={`Item ${i + 1}: group heading`}
                title="Group heading (ends with a colon)"
                // An empty row has nothing to turn into a heading: it would
                // become a lone ':' with the cursor after it.
                disabled={blank && !heading}
                onClick={() => update(toggleHeading(item))}
              >
                Heading
              </button>
              <button
                type="button"
                className={toggleClass(highlighted)}
                aria-pressed={highlighted}
                aria-label={`Item ${i + 1}: highlight`}
                title={heading ? 'Headings are never highlighted' : 'Highlight: what this package adds'}
                disabled={heading}
                onClick={() => update(toggleHighlight(item))}
              >
                Highlight
              </button>
              <span className="ml-auto flex">
                <MoveButtons index={i} count={list.length} onMove={(from, to) => onChange(moveItem(list, from, to))} label={`item ${i + 1}`} />
              </span>
            </div>
          </div>
        );
      })}
      <button type="button" className={dashedButtonClass} disabled={full} onClick={() => write([...list, ''], list.length)}>
        {full ? `Up to ${INCLUDES_MAX}` : '+ Add item'}
      </button>
    </div>
  );
}

export function ServiceDetailsFields({ service, index, onChange, onPatch, siteId }) {
  const s = serviceObject(service);
  // Open on mount when the package already has details; after that the
  // owner's own toggle wins. Deriving `open` from the data on every render
  // would snap the section shut when the owner clears its last field.
  const [open, setOpen] = useState(() => hasDetails(s));
  // onPatch(key, value): ContentEditor writes the one field into the list
  // as it is when the write lands (serviceDetails.patchServiceList), which
  // matters for the photo: its upload finishes after other edits. onChange
  // (the whole service) is the older form, kept for callers without it.
  const set = (key, value) => (onPatch ? onPatch(key, value) : onChange(setServiceField(service, key, value)));

  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="mb-1">
      <summary className="cursor-pointer select-none mb-2 text-[12px] font-semibold text-gray-700">
        Package details
        <span className="text-[11px] font-normal text-gray-400"> · summary, badge, photo, what's included</span>
      </summary>
      <Field
        label="Short summary"
        value={s.summary}
        onChange={(v) => set('summary', v)}
        maxLength={SUMMARY_MAX}
        placeholder="e.g. Full detail + 6 month wax"
        help="One line under the name in the hero price card or list."
      />
      <Field
        label="Badge"
        value={s.badge}
        onChange={(v) => set('badge', v)}
        maxLength={BADGE_MAX}
        placeholder="e.g. Most Popular"
        help="Only if it's true. Leave empty for no badge."
      />
      <ImageSlot
        label="Package Photo"
        value={typeof s.image === 'string' && s.image ? s.image : null}
        onChange={(url) => set('image', url)}
        siteId={siteId}
        uploadKey={photoUploadKey(index)}
        help="Shown at the top of this package card."
      />
      <Label>What's included</Label>
      <IncludesEditor items={s.includes} onChange={(list) => set('includes', list)} />
      <Help className="-mt-1 mb-3">One item per row: Enter adds the next one, and a pasted list splits into rows. A heading ends with a colon (Interior:). Highlight marks what this package adds.</Help>
    </details>
  );
}

export default ServiceDetailsFields;
