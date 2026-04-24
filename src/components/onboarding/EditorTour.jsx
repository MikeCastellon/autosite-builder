import { useEffect, useState } from 'react';

const STEPS = [
  {
    selector: 'edit-btn',
    placement: 'below-right',
    copy: 'Click Edit to open the customization panel. You can also hit Next to keep going.',
  },
  {
    selector: 'tab-visibility',
    placement: 'left',
    autoClick: true,
    copy: "Sections lets you toggle which parts of your site are visible, and drag to reorder. Anything hidden won't appear when you publish.",
  },
  {
    selector: 'tab-hero',
    placement: 'left',
    autoClick: true,
    copy: 'The Hero is the banner at the top of your site. Edit your headline, subheadline, hero photo, business logo, and your primary and secondary CTA buttons here.',
  },
  {
    selector: 'tab-services',
    placement: 'left',
    autoClick: true,
    copy: 'List what your business does. Each service has an icon, title, and description. Add or remove services to match what you actually offer.',
  },
  {
    selector: 'tab-gallery',
    placement: 'left',
    autoClick: true,
    copy: "Upload photos of your work. The Gallery section stays hidden on your live site until you add at least one photo.",
  },
  {
    selector: 'tab-colors',
    placement: 'left',
    autoClick: true,
    copy: 'Pick your brand colors — background, accent, text, surface, and muted text. Click a swatch to change, and changes apply live on the preview.',
  },
  {
    selector: 'finalize-btn',
    placement: 'below-right',
    copy: "When you're happy with your site, click Finalize to publish it.",
  },
];

const FLAG_KEY = 'editor_tour_done';
const TOOLTIP_WIDTH = 280;
const POLL_INTERVAL_MS = 150;
const WATCHDOG_MS = 3000;

export default function EditorTour() {
  // `welcome` shows the intro modal; `tour` runs the step machine.
  const [phase, setPhase] = useState('welcome');
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(FLAG_KEY) === '1';
    } catch {
      return true;
    }
  });

  // Declared BEFORE any hook that references it in a dep array, so it exists
  // on every render (hooks run before conditional returns).
  const step = STEPS[stepIdx];

  const markDone = () => {
    try { localStorage.setItem(FLAG_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const startTour = () => setPhase('tour');

  // Target polling with watchdog, plus auto-click when the step asks for it.
  useEffect(() => {
    if (dismissed || phase !== 'tour') return;

    setRect(null);
    setError(false);

    const selector = `[data-tour="${step.selector}"]`;
    let found = false;
    const poll = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        found = true;
        clearInterval(poll);
        clearTimeout(watchdog);
        setRect(el.getBoundingClientRect());
        // Auto-open the tab so its content is visible while the tooltip
        // describes it. Synthetic clicks have isTrusted=false, which the
        // click-on-target listener uses to skip advancing.
        if (step.autoClick) el.click();
      }
    }, POLL_INTERVAL_MS);

    const watchdog = setTimeout(() => {
      if (!found) {
        clearInterval(poll);
        setError(true);
      }
    }, WATCHDOG_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(watchdog);
    };
  }, [phase, stepIdx, dismissed, step.selector, step.autoClick]);

  // Position-recalc listeners
  useEffect(() => {
    if (dismissed || phase !== 'tour') return;

    const update = () => {
      const el = document.querySelector(`[data-tour="${step.selector}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });

    let mutTimer = null;
    const mo = new MutationObserver(() => {
      clearTimeout(mutTimer);
      mutTimer = setTimeout(update, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      mo.disconnect();
      clearTimeout(mutTimer);
    };
  }, [phase, dismissed, step.selector]);

  const advance = () => {
    setStepIdx((i) => {
      if (i >= STEPS.length - 1) {
        markDone();
        return i;
      }
      return i + 1;
    });
  };

  // Click-on-target advance. Capture phase + isTrusted filter keeps our own
  // synthetic auto-clicks from falsely advancing the tour.
  useEffect(() => {
    if (dismissed || phase !== 'tour' || !rect) return;

    const onDocClick = (e) => {
      if (!e.isTrusted) return;
      const el = document.querySelector(`[data-tour="${step.selector}"]`);
      if (el && el.contains(e.target)) advance();
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [phase, dismissed, rect, step.selector, stepIdx]);

  // Keyboard. During welcome: Enter starts, Esc skips. During tour: Enter
  // advances, Esc dismisses.
  useEffect(() => {
    if (dismissed) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        markDone();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'welcome') startTour();
        else advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, dismissed, stepIdx]);

  const tooltipPos = (() => {
    if (!rect) return null;
    const gap = 12;
    const margin = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    let top, left;
    if (step.placement === 'below-right') {
      top = rect.bottom + gap;
      left = rect.right - TOOLTIP_WIDTH;
    } else {
      top = rect.top;
      left = rect.left - TOOLTIP_WIDTH - gap;
    }

    left = Math.max(margin, Math.min(left, vw - TOOLTIP_WIDTH - margin));
    top = Math.max(margin, Math.min(top, vh - 200 - margin));

    return { top, left };
  })();

  if (dismissed) return null;

  // Welcome modal
  if (phase === 'welcome') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 10000, background: 'rgba(0, 0, 0, 0.5)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-tour-welcome-title"
      >
        <div className="bg-white rounded-xl shadow-2xl p-6 mx-4" style={{ width: 380, maxWidth: 'calc(100vw - 32px)' }}>
          <h2 id="editor-tour-welcome-title" className="text-[18px] font-bold text-gray-900 mb-2">
            Welcome to the editor
          </h2>
          <p className="text-[13px] text-gray-600 mb-5 leading-relaxed">
            This quick tutorial walks you through how to customize your site —
            your hero, services, gallery, colors, and more. Follow along with
            the highlighted steps, or skip and explore on your own.
          </p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={markDone}
              className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={startTour}
              className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors"
            >
              Start tutorial
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10000 }}
      aria-live="polite"
    >
      {rect && !error && (
        <div
          className="absolute transition-all duration-150"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        />
      )}

      {error && (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0, 0, 0, 0.5)', pointerEvents: 'auto' }}
        />
      )}

      {(tooltipPos || error) && (
        <div
          className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 p-4 pointer-events-auto"
          style={{
            width: TOOLTIP_WIDTH,
            top: error ? '50%' : tooltipPos.top,
            left: error ? '50%' : tooltipPos.left,
            transform: error ? 'translate(-50%, -50%)' : 'none',
          }}
        >
          <div className="text-[11px] text-gray-400 mb-1">
            {error ? 'Something went wrong' : `${stepIdx + 1} of ${STEPS.length}`}
          </div>
          <div className="text-[13px] text-gray-700 mb-3 leading-relaxed">
            {error
              ? "Couldn't find the next step. You can skip the tour and explore on your own."
              : step.copy}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={markDone}
              className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              Skip tour
            </button>
            {!error && (
              <button
                type="button"
                onClick={advance}
                className="bg-gray-900 hover:bg-gray-800 text-white text-[12px] font-semibold px-3 py-1.5 rounded-md transition-colors"
              >
                {stepIdx === STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
