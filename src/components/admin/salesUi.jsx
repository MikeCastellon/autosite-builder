// Small shared pieces for Admin > Pipeline and Admin > Leads, in the admin's
// own idiom (AdminCustomSitesTab, AdminUserDrawer): hand-built modals,
// #1a1a1a / #cc0000 / #faf9f7, white rounded-xl cards.
import { useEffect, useRef } from 'react';

export const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-black/[0.12] bg-white text-sm focus:outline-none focus:border-[#cc0000] disabled:bg-[#faf9f7] disabled:text-ink-tertiary';
export const BTN_PRIMARY = 'px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_DARK = 'px-4 py-2.5 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_SECONDARY = 'px-3 py-2 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_GHOST = 'px-3 py-2 rounded-lg text-[12px] font-semibold text-ink-tertiary hover:text-[#1a1a1a] disabled:opacity-50';
export const LINK = 'font-semibold text-[#cc0000] hover:underline';

export function chipClass(on) {
  return `px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
    on ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-black/[0.10] text-[#555] hover:border-[#cc0000]/40'
  }`;
}

export function Field({ label, required, hint, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">
        {label}{required && <span className="text-[#cc0000]"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="block mt-1 text-[11px] text-ink-tertiary">{hint}</span>}
      {error && <span className="block mt-1 text-[11px] font-semibold text-[#cc0000]">{error}</span>}
    </label>
  );
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-[#cc0000]/20 bg-[#fff5f5] px-4 py-3 text-sm text-[#cc0000]">
      {children}
      {onRetry && <button type="button" onClick={onRetry} className="ml-2 underline font-semibold">Retry</button>}
    </div>
  );
}

/**
 * A centred dialog. Escape and a click outside close it. "Outside" means the
 * press and the release both landed on the backdrop: a text selection dragged
 * past the edge of a half-filled form must not throw the form away.
 */
export function Modal({ title, subtitle, onClose, children, footer, width = 'max-w-lg', z = 'z-[95]' }) {
  const downOnBackdrop = useRef(false);
  const upOnBackdrop = useRef(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center p-4 bg-black/50`}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { upOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        const outside = downOnBackdrop.current && upOnBackdrop.current && e.target === e.currentTarget;
        downOnBackdrop.current = false;
        upOnBackdrop.current = false;
        if (outside) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] overflow-hidden`}
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-[20px] font-[900] tracking-tight text-[#1a1a1a]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[#555]">{subtitle}</p>}
        </div>
        <div className="px-6 py-3 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 bg-[#faf9f7] border-t border-black/[0.06] flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

/** "Mike C" → "MC", in a small dark circle. */
export function Avatar({ text, title }) {
  return (
    <span title={title} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[9px] font-bold shrink-0">
      {text}
    </span>
  );
}

/**
 * A message pinned to the bottom of the screen, with an optional action
 * ("Open lead"). The AlertProvider toast is text only; this one has to link.
 */
export function ActionToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-6 z-[70] mx-auto max-w-lg flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg"
    >
      <span>{toast.text}</span>
      <span className="flex shrink-0 items-center gap-3">
        {toast.action && (
          <button type="button" className="font-semibold underline" onClick={() => { toast.action.run(); onClose(); }}>
            {toast.action.label}
          </button>
        )}
        <button type="button" aria-label="Dismiss" className="font-semibold" onClick={onClose}>×</button>
      </span>
    </div>
  );
}
