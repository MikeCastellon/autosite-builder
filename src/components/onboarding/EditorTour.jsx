import { useEffect, useState } from 'react';

const STEPS = [
  {
    selector: 'edit-btn',
    placement: 'below-right',
    copy: 'Click Edit to start customizing your site.',
  },
  {
    selector: 'tab-visibility',
    placement: 'left',
    copy: 'Toggle which sections appear on your site, and drag to reorder them.',
  },
  {
    selector: 'tab-hero',
    placement: 'left',
    copy: 'Change your headline, main photo, and upload your business logo here.',
  },
  {
    selector: 'tab-services',
    placement: 'left',
    copy: 'List what your business does. This is where most of your content lives.',
  },
  {
    selector: 'tab-gallery',
    placement: 'left',
    copy: 'Add photos here. The Gallery section stays hidden on your site until you upload at least one.',
  },
  {
    selector: 'tab-colors',
    placement: 'left',
    copy: 'Change your brand colors. Updates preview live.',
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
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(FLAG_KEY) === '1';
    } catch {
      return true; // localStorage unavailable → skip tour
    }
  });

  // Must be declared BEFORE any hook that references `step` in its dep array,
  // so it exists on every render (hooks run before conditional returns).
  const step = STEPS[stepIdx];

  const markDone = () => {
    try { localStorage.setItem(FLAG_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  // Step 3: Target polling with watchdog
  useEffect(() => {
    if (dismissed) return;

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
  }, [stepIdx, dismissed, step.selector]);

  // Step 4: Position-recalc listeners
  useEffect(() => {
    if (dismissed) return;

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
  }, [dismissed, step.selector]);

  // Step 5: Advance + dismiss handlers
  const advance = () => {
    setStepIdx((i) => {
      if (i >= STEPS.length - 1) {
        markDone();
        return i;
      }
      return i + 1;
    });
  };

  // Click-on-target detection — use capture so our listener sees the click
  // before React's synthetic handler (we don't swallow the click, just advance)
  useEffect(() => {
    if (dismissed || !rect) return;

    const onDocClick = (e) => {
      const el = document.querySelector(`[data-tour="${step.selector}"]`);
      if (el && el.contains(e.target)) {
        advance();
      }
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [dismissed, rect, step.selector, stepIdx]);

  // Keyboard: Enter = advance, Esc = dismiss
  useEffect(() => {
    if (dismissed) return;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        markDone();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissed, stepIdx]);

  // Step 6: Compute tooltip position from rect + placement
  const tooltipPos = (() => {
    if (!rect) return null;
    const gap = 12;
    const margin = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    let top, left;
    if (step.placement === 'below-right') {
      // tooltip below the target, right edge aligned
      top = rect.bottom + gap;
      left = rect.right - TOOLTIP_WIDTH;
    } else {
      // 'left' placement: tooltip to the left of target, top aligned
      top = rect.top;
      left = rect.left - TOOLTIP_WIDTH - gap;
    }

    // Clamp to viewport bounds (assume tooltip height ≤ 200 for top clamp)
    left = Math.max(margin, Math.min(left, vw - TOOLTIP_WIDTH - margin));
    top = Math.max(margin, Math.min(top, vh - 200 - margin));

    return { top, left };
  })();

  if (dismissed) return null;

  // Step 7: Render overlay + tooltip
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10000 }}
      aria-live="polite"
    >
      {/* Full-screen translucent backdrop with a rectangular cutout around the target.
          box-shadow trick: the inner rect has no background, the outer 9999px shadow
          paints the surrounding darkness. */}
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

      {/* Solid backdrop for the error state (no cutout, just dim everything) */}
      {error && (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0, 0, 0, 0.5)', pointerEvents: 'auto' }}
        />
      )}

      {/* Tooltip */}
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
          <div className="text-[13px] text-gray-700 mb-3">
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
