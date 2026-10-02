import { useRef, useState } from 'react';
import { UPLOAD_ACCEPT, fileExtension, formatBytes, isPreviewable } from '../../lib/customSiteForm.js';

// Controls for the custom website intake form (CustomSiteFormPage). Each
// field in customSiteForm.js FORM_SECTIONS renders through IntakeField.

const INPUT = 'w-full px-3.5 py-2.5 rounded-xl border bg-white text-base text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:outline-none focus:border-[#cc0000] focus:ring-4 focus:ring-[#cc0000]/10';
const inputCls = (error) => `${INPUT} ${error ? 'border-[#cc0000]' : 'border-black/[0.14]'}`;

// Short inputs sit two to a row on wider screens.
export const SHORT_TYPES = ['text', 'email', 'tel', 'url', 'select'];

function Label({ field, htmlFor, as = 'label' }) {
  const Tag = as;
  return (
    <Tag {...(as === 'label' ? { htmlFor } : {})} className="block text-[14px] font-semibold text-[#1a1a1a] mb-1">
      {field.label}
      {field.required && (
        <>
          <span className="text-[#cc0000]" aria-hidden="true"> *</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </Tag>
  );
}

// Above the control for big fields; below it for short ones, so two inputs
// side by side stay level when only one of them has a hint.
function Hint({ id, children, below }) {
  if (!children) return null;
  return <p id={id} className={`text-[13px] text-ink-tertiary leading-snug ${below ? 'mt-1.5' : 'mb-2'}`}>{children}</p>;
}

function ErrorText({ id, children }) {
  if (!children) return null;
  return <p id={id} className="mt-1.5 text-[13px] font-medium text-[#cc0000]">{children}</p>;
}

export default function IntakeField({ field, value, onChange, error, files }) {
  const id = `f-${field.id}`;
  const hintId = field.hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;

  switch (field.type) {
    case 'textarea':
      return (
        <div>
          <Label field={field} htmlFor={id} />
          <Hint id={hintId}>{field.hint}</Hint>
          <textarea
            id={id}
            rows={field.rows || 4}
            value={value || ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={`${inputCls(error)} leading-relaxed resize-y`}
          />
          <ErrorText id={errId}>{error}</ErrorText>
        </div>
      );

    case 'select':
      return (
        <div>
          <Label field={field} htmlFor={id} />
          <select
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={describedBy}
            className={`${inputCls(error)} appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10`}
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b6b6b%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E")' }}
          >
            <option value="">Choose one</option>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Hint id={hintId} below>{field.hint}</Hint>
        </div>
      );

    case 'radio':
    case 'chips': {
      const multi = field.type === 'chips';
      const picked = multi ? (Array.isArray(value) ? value : []) : value;
      return (
        <fieldset aria-describedby={describedBy}>
          <Label field={field} as="legend" />
          <Hint id={hintId}>{field.hint}</Hint>
          <div className="flex flex-wrap gap-2">
            {field.options.map((o) => {
              const on = multi ? picked.includes(o.value) : picked === o.value;
              return (
                <label
                  key={o.value}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[14px] font-medium cursor-pointer select-none focus-within:ring-4 focus-within:ring-[#cc0000]/20 ${
                    on
                      ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                      : 'bg-white border-black/[0.14] text-[#1a1a1a] hover:border-[#cc0000]/50'
                  }`}
                >
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={id}
                    value={o.value}
                    checked={on}
                    onChange={() => {
                      if (!multi) onChange(o.value);
                      else onChange(on ? picked.filter((v) => v !== o.value) : [...picked, o.value]);
                    }}
                    className="sr-only"
                  />
                  {multi && on && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }

    case 'checkbox':
      return (
        <label htmlFor={id} className="inline-flex items-start gap-2.5 cursor-pointer text-[14px] text-[#1a1a1a]">
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 w-[18px] h-[18px] rounded border-black/30 accent-[#cc0000]"
          />
          <span>{field.label}</span>
        </label>
      );

    case 'colors':
      return <ColorsField field={field} id={id} hintId={hintId} value={value} onChange={onChange} />;

    case 'sites':
      return <SitesField field={field} id={id} hintId={hintId} value={value} onChange={onChange} />;

    case 'files':
      return <FilesField field={field} id={id} hintId={hintId} {...files} />;

    default:
      return (
        <div>
          <Label field={field} htmlFor={id} />
          <input
            id={id}
            type={field.type === 'url' ? 'url' : field.type}
            inputMode={field.type === 'url' ? 'url' : undefined}
            autoComplete={field.autoComplete || 'off'}
            value={value || ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={inputCls(error)}
          />
          <ErrorText id={errId}>{error}</ErrorText>
          <Hint id={hintId} below>{field.hint}</Hint>
        </div>
      );
  }
}

// ─── Colors ───────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;
const STARTER_COLORS = ['#CC0000', '#1A1A1A', '#FFFFFF', '#C0C0C0', '#1E40AF', '#F5B700'];

function ColorsField({ field, id, hintId, value, onChange }) {
  const colors = Array.isArray(value) ? value : [];
  const max = field.max || 6;
  const set = (i, hex) => onChange(colors.map((c, j) => (j === i ? hex : c)));
  const add = () => onChange([...colors, STARTER_COLORS.find((c) => !colors.includes(c)) || '#1A1A1A']);
  return (
    <fieldset aria-describedby={hintId}>
      <Label field={field} as="legend" />
      <Hint id={hintId}>{field.hint}</Hint>
      <div className="flex flex-wrap gap-3">
        {colors.map((c, i) => {
          const valid = HEX.test(c);
          return (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-black/[0.12] bg-white p-1.5 pr-2">
              <label className="relative w-10 h-10 rounded-lg overflow-hidden border border-black/10 cursor-pointer shrink-0"
                style={{ background: valid ? c : 'repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}>
                <span className="sr-only">Pick color {i + 1}</span>
                <input
                  type="color"
                  value={valid ? c.toLowerCase() : '#000000'}
                  onChange={(e) => set(i, e.target.value.toUpperCase())}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <input
                id={i === 0 ? id : undefined}
                type="text"
                value={c}
                maxLength={7}
                spellCheck={false}
                aria-label={`Color ${i + 1} hex code`}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  set(i, (v.startsWith('#') ? v : `#${v}`).toUpperCase());
                }}
                className={`w-[92px] px-2 py-1.5 rounded-lg border text-[14px] font-mono uppercase focus:outline-none focus:border-[#cc0000] ${valid ? 'border-black/[0.10]' : 'border-[#cc0000]'}`}
              />
              <button
                type="button"
                onClick={() => onChange(colors.filter((_, j) => j !== i))}
                aria-label={`Remove color ${i + 1}`}
                className="w-7 h-7 rounded-full text-ink-tertiary hover:text-[#cc0000] hover:bg-black/[0.04] flex items-center justify-center"
              >
                <XIcon />
              </button>
            </div>
          );
        })}
        {colors.length < max && (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-2 h-[54px] px-4 rounded-xl border-2 border-dashed border-black/[0.14] text-[14px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/50 hover:text-[#cc0000]"
          >
            <PlusIcon /> {colors.length ? 'Add a color' : 'Add your first color'}
          </button>
        )}
      </div>
    </fieldset>
  );
}

// ─── Reference websites ───────────────────────────────────────────────

function SitesField({ field, id, hintId, value, onChange }) {
  const rows = Array.isArray(value) && value.length ? value : [{ url: '', note: '' }];
  const max = field.max || 8;
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset aria-describedby={hintId}>
      <Label field={field} as="legend" />
      <Hint id={hintId}>{field.hint}</Hint>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-black/[0.10] bg-[#faf9f7] p-3 sm:p-3.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">{i + 1}</span>
              <input
                id={i === 0 ? id : undefined}
                type="url"
                inputMode="url"
                value={r.url || ''}
                placeholder="https://www.example.com"
                aria-label={`Website ${i + 1} address`}
                onChange={(e) => set(i, { url: e.target.value })}
                className={`${inputCls(false)} py-2`}
              />
              {(rows.length > 1 || r.url || r.note) && (
                <button
                  type="button"
                  onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [])}
                  aria-label={`Remove website ${i + 1}`}
                  className="w-8 h-8 rounded-full text-ink-tertiary hover:text-[#cc0000] hover:bg-black/[0.05] flex items-center justify-center shrink-0"
                >
                  <XIcon />
                </button>
              )}
            </div>
            <textarea
              rows={2}
              value={r.note || ''}
              placeholder="What do you like about it?"
              aria-label={`What you like about website ${i + 1}`}
              onChange={(e) => set(i, { note: e.target.value })}
              className={`${inputCls(false)} mt-2 py-2 text-[15px] leading-relaxed resize-y`}
            />
          </div>
        ))}
      </div>
      {rows.length < max && (
        <button
          type="button"
          onClick={() => onChange([...rows, { url: '', note: '' }])}
          className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#cc0000] hover:text-[#a80000]"
        >
          <PlusIcon /> Add another site
        </button>
      )}
    </fieldset>
  );
}

// ─── Uploads ──────────────────────────────────────────────────────────

function FilesField({ field, id, hintId, assets = [], uploads = [], onAdd, onRemove, onNote, onDismiss }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const mine = assets.filter((a) => a.kind === field.kind);
  const pending = uploads.filter((u) => u.kind === field.kind);
  const pick = (list) => { if (list?.length) onAdd(field.kind, Array.from(list)); };

  return (
    <div>
      <Label field={field} htmlFor={id} />
      <Hint id={hintId}>{field.hint}</Hint>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        className={`rounded-2xl border-2 border-dashed px-4 py-6 text-center ${drag ? 'border-[#cc0000] bg-[#fff5f5]' : 'border-black/[0.14] bg-[#faf9f7]'}`}
      >
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-[#cc0000]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-[14px] text-[#1a1a1a]">
          <button
            type="button"
            id={id}
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
            className="font-semibold text-[#cc0000] underline underline-offset-2 hover:text-[#a80000] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#cc0000]/20 rounded"
          >
            Choose files
          </button>
          <span className="hidden sm:inline"> or drag them here</span>
        </p>
        <p className="mt-1 text-[12px] text-ink-tertiary">Images, PDF, AI, EPS or PSD · up to 25 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          tabIndex={-1}
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
        />
      </div>

      {(mine.length > 0 || pending.length > 0) && (
        field.notes ? (
          <ul className="mt-3 space-y-2.5">
            {mine.map((a) => (
              <li key={a.path} className="flex gap-3 rounded-xl border border-black/[0.10] bg-white p-2.5">
                <Thumb asset={a} className="w-20 h-20 sm:w-24 sm:h-24" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1a1a1a]" title={a.name}>{a.name}</p>
                    <RemoveButton name={a.name} onClick={() => onRemove(a)} />
                  </div>
                  <textarea
                    rows={2}
                    value={a.note || ''}
                    placeholder="What do you like about this?"
                    aria-label={`What you like about ${a.name}`}
                    onChange={(e) => onNote(a, e.target.value)}
                    className={`${inputCls(false)} mt-1.5 py-2 text-[14px] leading-snug resize-y`}
                  />
                </div>
              </li>
            ))}
            {pending.map((u) => (
              <li key={u.id}><PendingTile upload={u} onDismiss={onDismiss} wide /></li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {mine.map((a) => (
              <li key={a.path} className="relative">
                <Thumb asset={a} className="w-full aspect-square" contain={field.kind !== 'photo'} />
                <div className="absolute top-1.5 right-1.5"><RemoveButton name={a.name} onClick={() => onRemove(a)} floating /></div>
                <p className="mt-1 truncate text-[12px] text-ink-tertiary" title={a.name}>{a.name}</p>
              </li>
            ))}
            {pending.map((u) => (
              <li key={u.id}><PendingTile upload={u} onDismiss={onDismiss} /></li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function Thumb({ asset, className = '', contain }) {
  const [broken, setBroken] = useState(false);
  const showImg = asset.url && isPreviewable(asset.name) && !broken;
  return (
    <div
      className={`${className} shrink-0 rounded-lg overflow-hidden border border-black/[0.08] flex items-center justify-center`}
      style={{ background: contain ? 'repeating-conic-gradient(#f1f1f1 0% 25%, #fff 0% 50%) 50% / 14px 14px' : '#f4f3f0' }}
    >
      {showImg ? (
        <img
          src={asset.url}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className={`w-full h-full ${contain ? 'object-contain p-2' : 'object-cover'}`}
        />
      ) : (
        <FileBadge name={asset.name} size={asset.size} />
      )}
    </div>
  );
}

function FileBadge({ name, size }) {
  return (
    <div className="text-center px-2">
      <span className="inline-block px-2 py-1 rounded-md bg-[#1a1a1a] text-white text-[11px] font-bold uppercase tracking-wider">
        {fileExtension(name) || 'file'}
      </span>
      {size > 0 && <p className="mt-1 text-[11px] text-ink-tertiary">{formatBytes(size)}</p>}
    </div>
  );
}

function PendingTile({ upload, onDismiss, wide }) {
  const failed = upload.status === 'error';
  return (
    <div
      role={failed ? 'alert' : 'status'}
      className={`relative rounded-lg border flex ${wide ? 'items-center gap-3 p-2.5' : 'flex-col items-center justify-center aspect-square p-3 text-center'} ${
        failed ? 'border-[#cc0000]/40 bg-[#fff5f5]' : 'border-black/[0.08] bg-[#faf9f7]'
      }`}
    >
      {failed ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
        <span className="w-5 h-5 shrink-0 border-[2.5px] border-black/15 border-t-[#cc0000] rounded-full motion-safe:animate-spin" aria-hidden="true" />
      )}
      <div className={`min-w-0 ${wide ? 'flex-1' : 'mt-2 w-full'}`}>
        <p className="truncate text-[12px] font-semibold text-[#1a1a1a]" title={upload.name}>{upload.name}</p>
        <p className={`text-[11px] leading-snug ${failed ? 'text-[#cc0000]' : 'text-ink-tertiary'}`}>
          {failed ? upload.error : 'Uploading…'}
        </p>
      </div>
      {failed && (
        <button
          type="button"
          onClick={() => onDismiss(upload.id)}
          aria-label={`Dismiss ${upload.name}`}
          className={`${wide ? '' : 'absolute top-1 right-1'} w-7 h-7 rounded-full text-ink-tertiary hover:text-[#1a1a1a] hover:bg-black/[0.05] flex items-center justify-center`}
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

function RemoveButton({ name, onClick, floating }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${name}`}
      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        floating
          ? 'bg-white/95 shadow-sm border border-black/[0.08] text-[#1a1a1a] hover:text-[#cc0000]'
          : 'text-ink-tertiary hover:text-[#cc0000] hover:bg-black/[0.05]'
      }`}
    >
      <XIcon />
    </button>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
