import { createContext, useContext, useState, useCallback, useEffect, useId, useRef } from 'react';

const AlertContext = createContext(null);

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within <AlertProvider>');
  return ctx;
}

let idCounter = 0;

export default function AlertProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, type }]);
    if (duration > 0) setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const next = {
        id: ++idCounter,
        message,
        title: options.title || 'Confirm',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        danger: !!options.danger,
        resolve,
      };
      setConfirmState((prev) => {
        // A newer confirm replaces an open one: the older one counts as
        // cancelled, so its caller isn't left waiting forever.
        if (prev && prev !== next) prev.resolve(false);
        return next;
      });
    });
  }, []);

  const handleConfirm = (result) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <AlertContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} type={t.type} onClose={() => removeToast(t.id)}>
            {t.message}
          </Toast>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <ConfirmDialog key={confirmState.id} state={confirmState} onResult={handleConfirm} />
      )}
    </AlertContext.Provider>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Which button a confirm dialog focuses first. A destructive (danger) dialog
// focuses Cancel, so a stray Enter or Space can't delete a site.
export function initialFocus(danger) {
  return danger ? 'cancel' : 'confirm';
}

// Where Tab should move focus to keep it inside the dialog, or null to let
// the browser move it. items: the dialog's focusable elements in order;
// inside: whether focus is in the dialog now (the panel itself counts).
export function trapFocusTarget({ items, active, inside, shiftKey }) {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  if (shiftKey) {
    const atStart = !inside || active === first || !items.includes(active);
    return atStart ? last : null;
  }
  return !inside || active === last ? first : null;
}

// Modal confirm. Opens with focus per initialFocus; other dialogs focus the
// confirm button. Tab stays inside the dialog, Escape or a backdrop click
// cancels, and focus goes back to whatever opened it.
export function ConfirmDialog({ state, onResult }) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const titleId = useId();
  const messageId = useId();
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    const opener = document.activeElement;
    (initialFocus(state.danger) === 'cancel' ? cancelRef : confirmRef).current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        resultRef.current(false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const target = trapFocusTarget({
        items: [...panelRef.current.querySelectorAll(FOCUSABLE)],
        active: document.activeElement,
        inside: panelRef.current.contains(document.activeElement),
        shiftKey: e.shiftKey,
      });
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };
    // Capture phase, so page-level Escape/Tab handlers underneath don't
    // act while the dialog is open.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [state.danger]);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => onResult(false)}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 pointer-events-auto outline-none"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h3 id={titleId} className="text-[17px] font-bold text-[#1a1a1a] mb-2">{state.title}</h3>
        <p id={messageId} className="text-[14px] text-[#555] leading-relaxed mb-6">{state.message}</p>
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResult(false)}
            className="px-4 py-2 rounded-lg border border-black/10 hover:border-black/30 text-[13px] font-medium text-[#555] hover:text-[#1a1a1a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-2"
          >
            {state.cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onResult(true)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              state.danger
                ? 'bg-[#cc0000] hover:bg-[#aa0000] focus-visible:ring-[#cc0000]'
                : 'bg-[#1a1a1a] hover:bg-[#cc0000] focus-visible:ring-[#1a1a1a]'
            }`}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const TOAST_STYLES = {
  success: {
    bg: 'bg-green-50',
    text: 'text-green-900',
    icon: (<><circle cx="12" cy="12" r="10" fill="#16a34a"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></>),
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-[#8a0000]',
    icon: (<><circle cx="12" cy="12" r="10" fill="#cc0000"/><path d="M12 7v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="#fff"/></>),
  },
  info: {
    bg: 'bg-gray-50',
    text: 'text-[#1a1a1a]',
    icon: (<><circle cx="12" cy="12" r="10" fill="#1a1a1a"/><path d="M12 10v7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="7" r="1.2" fill="#fff"/></>),
  },
};

function Toast({ type = 'info', children, onClose }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-center gap-2.5 rounded-lg ${s.bg} ${s.text} px-3 py-2 shadow-md max-w-sm`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
        {s.icon}
      </svg>
      <p className="text-[13px] font-semibold leading-snug flex-1">{children}</p>
      <button
        onClick={onClose}
        className={`shrink-0 ${s.text} opacity-60 hover:opacity-100 transition-opacity`}
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
