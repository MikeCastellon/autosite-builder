import { createContext, useContext, useState, useCallback, useEffect } from 'react';

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
      setConfirmState({
        message,
        title: options.title || 'Confirm',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        danger: !!options.danger,
        resolve,
      });
    });
  }, []);

  const handleConfirm = (result) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  // Close modal on Escape
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e) => { if (e.key === 'Escape') handleConfirm(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmState]); // eslint-disable-line

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
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => handleConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="text-[17px] font-bold text-[#1a1a1a] mb-2">{confirmState.title}</h3>
            <p className="text-[14px] text-[#555] leading-relaxed mb-6">{confirmState.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleConfirm(false)}
                className="px-4 py-2 rounded-lg border border-black/10 hover:border-black/30 text-[13px] font-medium text-[#555] hover:text-[#1a1a1a] transition-colors"
              >
                {confirmState.cancelText}
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors ${
                  confirmState.danger
                    ? 'bg-[#cc0000] hover:bg-[#aa0000]'
                    : 'bg-[#1a1a1a] hover:bg-[#cc0000]'
                }`}
                autoFocus
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

const TOAST_STYLES = {
  success: {
    border: 'border-green-600',
    bg: 'bg-green-50',
    text: 'text-green-900',
    iconBg: '#16a34a',
    icon: (<><circle cx="12" cy="12" r="10" fill="#16a34a"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></>),
  },
  error: {
    border: 'border-[#cc0000]',
    bg: 'bg-red-50',
    text: 'text-[#8a0000]',
    iconBg: '#cc0000',
    icon: (<><circle cx="12" cy="12" r="10" fill="#cc0000"/><path d="M12 7v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="#fff"/></>),
  },
  info: {
    border: 'border-[#1a1a1a]',
    bg: 'bg-gray-50',
    text: 'text-[#1a1a1a]',
    iconBg: '#1a1a1a',
    icon: (<><circle cx="12" cy="12" r="10" fill="#1a1a1a"/><path d="M12 10v7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="7" r="1.2" fill="#fff"/></>),
  },
};

function Toast({ type = 'info', children, onClose }) {
  const s = TOAST_STYLES[type] || TOAST_STYLES.info;
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border-2 ${s.border} ${s.bg} ${s.text} px-4 py-3 shadow-lg min-w-[280px] max-w-sm`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
        {s.icon}
      </svg>
      <p className="text-[14px] font-semibold leading-snug flex-1">{children}</p>
      <button
        onClick={onClose}
        className={`shrink-0 ${s.text} opacity-60 hover:opacity-100 transition-opacity`}
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
