import { useEffect, useState } from 'react';

// Pro Hub brand tokens (prohub.autocaregenius.com)
const BRAND_INK = '#1A1A1A';           // near-black body/headings/primary button
const BRAND_RED = '#CC0000';           // accent
const BRAND_RED_SOFT = 'rgba(204, 0, 0, 0.06)'; // red pill fill
const BRAND_RADIUS = 8;                // button radius
const BRAND_PILL_RADIUS = 100;         // pill / badge radius

const STEPS = [
  {
    selector: 'edit-btn',
    placement: 'below-right',
    copy: 'Click Edit to open the customization panel. You can also hit Next to keep moving.',
  },
  {
    selector: 'tab-visibility',
    placement: 'left',
    autoClick: true,
    copy: "Toggle which sections appear on your site and drag to reorder. Hidden sections don't show up when you publish.",
  },
  {
    selector: 'tab-hero',
    placement: 'left',
    autoClick: true,
    copy: 'The Hero is the banner at the top of your site. Edit your headline, subheadline, hero photo, business logo, and your primary and secondary CTA buttons.',
  },
  {
    selector: 'tab-services',
    placement: 'left',
    autoClick: true,
    copy: 'List what your business offers. Each service has an icon, title, and description. Add or remove services to match what you actually do.',
  },
  {
    selector: 'tab-about',
    placement: 'left',
    autoClick: true,
    copy: 'Your story. Add an About headline and a paragraph describing your shop, experience, and values.',
  },
  {
    selector: 'tab-gallery',
    placement: 'left',
    autoClick: true,
    copy: 'Upload photos of your work. The Gallery section stays hidden on your live site until you add at least one photo.',
  },
  {
    selector: 'tab-testimonials',
    placement: 'left',
    autoClick: true,
    copy: 'Showcase reviews. Add quotes, names, and star ratings, or connect Google Reviews to pull live reviews automatically.',
  },
  {
    selector: 'tab-contact',
    placement: 'left',
    autoClick: true,
    copy: 'Configure your contact CTA — headline, subtext, primary button, and phone / secondary button link.',
  },
  {
    selector: 'tab-colors',
    placement: 'left',
    autoClick: true,
    copy: 'Pick your brand colors — background, accent, text, surface, and muted text. Click a swatch to change. Changes apply live.',
  },
  {
    selector: 'tab-footer',
    placement: 'left',
    autoClick: true,
    copy: 'Edit your footer tagline and choose which social icons (Instagram, Facebook, TikTok) appear.',
  },
  {
    selector: 'tab-business',
    placement: 'left',
    autoClick: true,
    optional: true,
    copy: 'Update your business details — name, address, phone, hours, service areas, and specialties — without regenerating the site.',
  },
  {
    selector: 'tab-template',
    placement: 'left',
    autoClick: true,
    optional: true,
    copy: 'Switch to a different template design anytime. Your content carries over automatically.',
  },
  {
    selector: 'finalize-btn',
    placement: 'below-right',
    copy: "When you're happy with your site, click Finalize Website to publish it.",
  },
];

// Bumped from `editor_tour_done` to `_v2` so users who dismissed the old
// broken react-joyride tour get a fresh run of the new one.
const FLAG_KEY = 'editor_tour_done_v2';
const TOOLTIP_WIDTH = 300;
const POLL_INTERVAL_MS = 150;
const WATCHDOG_MS = 3000;

export default function EditorTour() {
  const [phase, setPhase] = useState('welcome'); // 'welcome' | 'tour'
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return true; }
  });

  // Declared BEFORE any hook that references it in a dep array, so it exists
  // on every render (hooks run before conditional returns).
  const step = STEPS[stepIdx];

  const markDone = () => {
    try { localStorage.setItem(FLAG_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const startTour = () => setPhase('tour');

  const advance = () => {
    setStepIdx((i) => {
      if (i >= STEPS.length - 1) {
        markDone();
        return i;
      }
      return i + 1;
    });
  };

  // Target polling with watchdog + auto-click. Optional steps silently advance
  // instead of showing the error state if their target never appears.
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
        if (step.optional) {
          // silently skip to next step
          setStepIdx((i) => (i >= STEPS.length - 1 ? i : i + 1));
        } else {
          setError(true);
        }
      }
    }, WATCHDOG_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(watchdog);
    };
  }, [phase, stepIdx, dismissed, step.selector, step.autoClick, step.optional]);

  // Position recalc
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

  // Click-on-target advance. isTrusted filter keeps synthetic auto-clicks
  // from falsely advancing.
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

  // Keyboard: welcome phase — Enter starts, Esc skips. Tour phase — Enter
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
    top = Math.max(margin, Math.min(top, vh - 220 - margin));

    return { top, left };
  })();

  if (dismissed) return null;

  // Welcome modal — Pro Hub styling
  if (phase === 'welcome') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 10000, background: 'rgba(0, 0, 0, 0.55)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-tour-welcome-title"
      >
        <div
          className="bg-white mx-4"
          style={{
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {/* Red pill — mirrors the "AI-POWERED PLATFORM" badge on Pro Hub */}
          <div
            className="inline-block mb-5"
            style={{
              background: BRAND_RED_SOFT,
              color: BRAND_RED,
              borderRadius: BRAND_PILL_RADIUS,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Tutorial
          </div>

          <h2
            id="editor-tour-welcome-title"
            style={{
              color: BRAND_INK,
              fontSize: 26,
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: 10,
              letterSpacing: '-0.01em',
            }}
          >
            Welcome to the editor.
          </h2>
          <p style={{ color: '#555', fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
            This quick tour walks you through every part of the editor — hero,
            services, gallery, colors, and more. Follow the highlighted steps,
            hit Next to move along, or skip and explore on your own.
          </p>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={markDone}
              style={{
                color: '#888',
                fontSize: 13,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                padding: '6px 2px',
                cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={startTour}
              style={{
                background: BRAND_INK,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                padding: '10px 22px',
                borderRadius: BRAND_RADIUS,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Start tutorial →
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
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        />
      )}

      {error && (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0, 0, 0, 0.55)', pointerEvents: 'auto' }}
        />
      )}

      {(tooltipPos || error) && (
        <div
          className="absolute bg-white pointer-events-auto"
          style={{
            width: TOOLTIP_WIDTH,
            top: error ? '50%' : tooltipPos.top,
            left: error ? '50%' : tooltipPos.left,
            transform: error ? 'translate(-50%, -50%)' : 'none',
            borderRadius: 14,
            padding: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {/* Red pill step counter */}
          <div
            className="inline-block mb-3"
            style={{
              background: BRAND_RED_SOFT,
              color: BRAND_RED,
              borderRadius: BRAND_PILL_RADIUS,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
            }}
          >
            {error ? 'Heads up' : `Step ${stepIdx + 1} of ${STEPS.length}`}
          </div>

          <div
            style={{
              color: BRAND_INK,
              fontSize: 13.5,
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {error
              ? "Couldn't find the next step. You can skip the tour and explore on your own."
              : step.copy}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={markDone}
              style={{
                color: '#888',
                fontSize: 12.5,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                padding: '4px 2px',
                cursor: 'pointer',
              }}
            >
              Skip tour
            </button>
            {!error && (
              <button
                type="button"
                onClick={advance}
                style={{
                  background: BRAND_INK,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 18px',
                  borderRadius: BRAND_RADIUS,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {stepIdx === STEPS.length - 1 ? 'Finish →' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
