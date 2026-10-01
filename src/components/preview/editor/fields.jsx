// Form controls shared by the editor panels in this folder (Hero services,
// Google rating, Headings, Footer, Featured Service, package details, ...).
// They copy the look of ContentEditor.jsx's own Field / Switch / Toggle /
// ImageSlot, which stay where they are: the panels are separate files so
// they never touch ContentEditor's tab blocks, and they import their
// controls from here, never from ContentEditor.
//
// Frozen API: panels import these as they are (optional props may be added,
// never changed). A panel that needs another control defines it in its own
// file.
import { useState } from 'react';
import { uploadSiteImage } from '../../../lib/imageUpload.js';

export const inputClass = 'w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition resize-none disabled:bg-gray-50 disabled:text-gray-400';
export const smallInputClass = 'min-w-0 w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400';
export const dashedButtonClass = 'w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2 disabled:opacity-40 disabled:cursor-not-allowed';
export const linkButtonClass = 'text-[11px] font-semibold text-gray-500 hover:text-gray-900 hover:underline transition';
const iconButtonClass = 'w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition shrink-0';

// The small uppercase label every editor field carries.
export function Label({ children, htmlFor, className = 'mb-1' }) {
  return (
    <label htmlFor={htmlFor} className={`block text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${className}`}>
      {children}
    </label>
  );
}

// One line of help under a control. tone: 'muted' (default), 'warn' (amber:
// something the owner should know), 'error' (red: it will not work as typed),
// 'ok' (green).
const HELP_TONES = {
  muted: 'text-gray-500',
  warn: 'text-amber-700',
  error: 'text-red-600',
  ok: 'text-green-700',
};
export function Help({ children, tone = 'muted', className = 'mt-1' }) {
  if (!children) return null;
  return <p className={`${className} text-[11px] leading-snug ${HELP_TONES[tone] || HELP_TONES.muted}`}>{children}</p>;
}

// A boxed note at the top of a panel (connection status, "switched off in
// Sections", ...). tone as Help.
const NOTE_TONES = {
  muted: 'bg-gray-50 border-gray-200 text-gray-600',
  warn: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-red-50 border-red-200 text-red-700',
  ok: 'bg-green-50 border-green-200 text-green-800',
};
export function Note({ title, children, tone = 'muted' }) {
  return (
    <div className={`border rounded-lg px-3 py-2.5 mb-3 ${NOTE_TONES[tone] || NOTE_TONES.muted}`}>
      {title && <p className="text-[12px] font-semibold leading-snug">{title}</p>}
      {children && <div className="text-[11px] leading-snug">{children}</div>}
    </div>
  );
}

// Text input / textarea with a label and optional help. maxLength also
// shows a "12/60" counter, so a short-text limit is visible before it bites.
// onBlur(value) (optional): tidy the value once the owner leaves the field
// (a link gets https://), never while they type.
export function Field({ label, value, onChange, onBlur, multiline = false, rows = 3, placeholder, help, helpTone, maxLength, disabled = false, id }) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return (
    <div className="mb-4">
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          {maxLength ? <span className="text-[10px] text-gray-400 tabular-nums">{text.length}/{maxLength}</span> : null}
        </div>
      )}
      {multiline ? (
        <textarea id={id} rows={rows} value={text} placeholder={placeholder} maxLength={maxLength} disabled={disabled} onChange={(e) => onChange(e.target.value)} onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined} className={inputClass} />
      ) : (
        <input id={id} type="text" value={text} placeholder={placeholder} maxLength={maxLength} disabled={disabled} onChange={(e) => onChange(e.target.value)} onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined} className={inputClass} />
      )}
      <Help tone={helpTone}>{help}</Help>
    </div>
  );
}

// An on/off switch (same as ContentEditor's).
export function Switch({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(on)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-gray-900' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// A labelled switch on one row, with optional help under it.
export function SwitchRow({ label, on, onChange, help, helpTone, disabled = false }) {
  return (
    <div className="py-2 mb-2">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[13px] ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
        <Switch on={on} onChange={onChange} label={label} disabled={disabled} />
      </div>
      <Help tone={helpTone}>{help}</Help>
    </div>
  );
}

// Segmented buttons for a small set of choices (same as ContentEditor's).
export function Toggle({ value, onChange, options }) {
  return (
    <div className="flex gap-1 mb-4" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[12px] font-medium border transition ${value === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Image upload slot (same as ContentEditor's): uploads through
// imageUpload.js under `uploadKey` and hands the public URL to onChange;
// Remove hands null.
export function ImageSlot({ label, value, onChange, siteId, uploadKey, help }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await uploadSiteImage(file, { siteId, imageKey: uploadKey });
      onChange(url);
    } catch (ex) {
      setErr(ex.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file
    }
  };

  return (
    <div className="mb-4">
      <Label>{label}</Label>
      <label className="block cursor-pointer">
        {value ? (
          <div className="relative group rounded-lg overflow-hidden border border-gray-200">
            <img src={value} alt={label} className="w-full h-28 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-[12px] font-medium">{uploading ? 'Uploading…' : 'Change Image'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-400 hover:text-gray-600">
            {uploading ? (
              <span className="text-[12px]">Uploading…</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mb-1" aria-hidden="true">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-[12px]">Upload {label}</span>
              </>
            )}
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFile} className="sr-only" disabled={uploading} aria-label={`Upload ${label}`} />
      </label>
      {err && <p className="mt-1 text-[11px] text-red-500">{err}</p>}
      <Help>{help}</Help>
      {value && !uploading && (
        <button type="button" onClick={() => onChange(null)} className="mt-1 text-[11px] text-red-400 hover:text-red-600 transition">
          Remove
        </button>
      )}
    </div>
  );
}

// The gray box a list entry sits in (a service, a review), with an
// optional Remove link in its header.
export function Card({ title, onRemove, removeLabel = 'Remove', children }) {
  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
      {(title || onRemove) && (
        <div className="flex items-center justify-between mb-2">
          {title ? <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</p> : <span />}
          {onRemove && <button type="button" onClick={onRemove} className="text-[11px] text-red-400 hover:text-red-600 transition">{removeLabel}</button>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Divider() {
  return <hr className="my-4 border-gray-100" />;
}

// Pure list helpers (exported for tests and for panels' own helpers).
export function moveItem(list, from, to) {
  if (!Array.isArray(list) || from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
export function removeAt(list, index) {
  return Array.isArray(list) ? list.filter((_, i) => i !== index) : [];
}
export function replaceAt(list, index, item) {
  return Array.isArray(list) ? list.map((x, i) => (i === index ? item : x)) : [];
}

function ArrowIcon({ up }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d={up ? 'M3 7.5L6 4.5l3 3' : 'M3 4.5L6 7.5l3-3'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// An editable, reorderable list of one-line entries (bullets, areas, what's
// included). Items may be strings or objects: getText / setText read and
// write an item's text, newItem() makes an empty one. renderExtra(item,
// index, update) adds per-row controls (update(nextItem) replaces the item).
// Empty rows are kept while the owner types; templates skip empty text.
export function TextListEditor({
  items,
  onChange,
  getText = (item) => (typeof item === 'string' ? item : ''),
  setText = (_item, text) => text,
  newItem = () => '',
  placeholder,
  addLabel = '+ Add',
  max,
  itemLabel = 'item',
  renderExtra,
}) {
  const list = Array.isArray(items) ? items : [];
  const full = typeof max === 'number' && list.length >= max;
  return (
    <div className="mb-2">
      {list.map((item, i) => {
        const update = (next) => onChange(replaceAt(list, i, next));
        return (
          <div key={i} className="flex items-center gap-1 mb-1.5">
            <input
              type="text"
              value={getText(item) || ''}
              placeholder={placeholder}
              aria-label={`${itemLabel} ${i + 1}`}
              onChange={(e) => update(setText(item, e.target.value))}
              className={smallInputClass}
            />
            {renderExtra ? renderExtra(item, i, update) : null}
            <button type="button" className={iconButtonClass} disabled={i === 0} onClick={() => onChange(moveItem(list, i, i - 1))} aria-label={`Move ${itemLabel} ${i + 1} up`} title="Move up"><ArrowIcon up /></button>
            <button type="button" className={iconButtonClass} disabled={i === list.length - 1} onClick={() => onChange(moveItem(list, i, i + 1))} aria-label={`Move ${itemLabel} ${i + 1} down`} title="Move down"><ArrowIcon /></button>
            <button type="button" className="shrink-0 text-gray-300 hover:text-red-500 transition p-0.5" onClick={() => onChange(removeAt(list, i))} aria-label={`Remove ${itemLabel} ${i + 1}`} title="Remove">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        );
      })}
      <button type="button" className={dashedButtonClass} disabled={full} onClick={() => onChange([...list, newItem()])}>
        {full ? `Up to ${max}` : addLabel}
      </button>
    </div>
  );
}

// Up / down arrow pair for reordering rows that are not text lists (hero
// services, footer columns). onMove(from, to).
export function MoveButtons({ index, count, onMove, label }) {
  return (
    <>
      <button type="button" className={iconButtonClass} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${label} up`} title="Move up"><ArrowIcon up /></button>
      <button type="button" className={iconButtonClass} disabled={index >= count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${label} down`} title="Move down"><ArrowIcon /></button>
    </>
  );
}
