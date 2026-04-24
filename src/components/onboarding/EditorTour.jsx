// Guided editor walkthrough using react-joyride.
// Runs once per user (tracked via localStorage). Each step is "locked" until
// the user clicks the highlighted element — clicks pass through the overlay
// via spotlightClicks.
//
// Steps:
//   1. Click Edit to open the editor panel
//   2. Open Colors & Fonts tab
//   3. Open Business Info tab
//   4. Open Template tab (Switch Template)
//   5. Finalize your site
//
// To reset for testing: run  localStorage.removeItem('editor_tour_done')  in devtools.

import { useEffect, useRef, useState } from 'react';
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride';

const DONE_KEY = 'editor_tour_done';

const STEPS = [
  {
    target: '[data-tour="edit-btn"]',
    title: 'Welcome to the editor',
    content: 'This is your live site. Click Edit to open the panel where you can change text, images, colors, and more.',
    disableBeacon: true,
    spotlightClicks: true,
    hideBackButton: true,
    showNext: false,
  },
  {
    target: '[data-tour="tab-colors"]',
    title: 'Match your brand',
    content: 'Open Colors & Fonts to tweak your brand colors and typography. Changes apply live across the whole site.',
    disableBeacon: true,
    spotlightClicks: true,
    hideBackButton: true,
    hideFooter: true,
  },
  {
    target: '[data-tour="tab-business"]',
    title: 'Keep your info current',
    content: "Open Business Info to update your name, hours, phone, address, and description. Every section on the site uses these details.",
    disableBeacon: true,
    spotlightClicks: true,
    hideBackButton: true,
    hideFooter: true,
  },
  {
    target: '[data-tour="tab-template"]',
    title: 'Switch layouts anytime',
    content: "Don't like the layout? Pick a different template from the Template tab. Your content carries over.",
    disableBeacon: true,
    spotlightClicks: true,
    hideBackButton: true,
    hideFooter: true,
  },
  {
    target: '[data-tour="finalize-btn"]',
    title: "You're all set",
    content: "When you're happy with it, click Finalize Website to publish it live. You can always come back and edit more later.",
    disableBeacon: true,
    spotlightClicks: true,
    hideBackButton: true,
    hideFooter: true,
  },
];

// Styles pulled from Genius Websites brand palette.
const JOYRIDE_STYLES = {
  options: {
    primaryColor: '#cc0000',
    textColor: '#1a1a1a',
    backgroundColor: '#ffffff',
    arrowColor: '#ffffff',
    zIndex: 10000,
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    spotlightShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
  },
  tooltip: {
    fontFamily: 'Outfit, system-ui, sans-serif',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  tooltipContent: {
    padding: 0,
    lineHeight: 1.5,
  },
  tooltipFooter: {
    marginTop: 12,
  },
  buttonNext: {
    // Hidden by default — each step forces user to click the highlighted
    // element. The last step overrides this to show a "Got it" button.
    display: 'none',
  },
  buttonSkip: {
    color: '#888',
    fontSize: 12,
  },
  spotlight: {
    borderRadius: 8,
  },
};

export default function EditorTour({ editorOpen, editingExistingSite }) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const lastSeenOpen = useRef(editorOpen);

  // If the user is editing a site that was already built, they've clearly
  // used the editor before — mark the tour as seen and never show it.
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (editingExistingSite) {
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
    }
  }, [editingExistingSite]);

  // Start the tour once per user on their first new-site editor visit.
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (editingExistingSite) return; // assume they've seen it
    const done = localStorage.getItem(DONE_KEY) === '1';
    if (!done) {
      // Tiny delay so the preview finishes painting before we spotlight.
      const t = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(t);
    }
  }, [editingExistingSite]);

  // Advance through steps as the user performs actions — they can't click
  // Next in the tooltip, only on the highlighted element.
  useEffect(() => {
    if (!run) return;
    // Step 1 unlocks when editor opens.
    if (stepIndex === 0 && editorOpen && !lastSeenOpen.current) {
      lastSeenOpen.current = editorOpen;
      setStepIndex(1);
    } else {
      lastSeenOpen.current = editorOpen;
    }
  }, [editorOpen, stepIndex, run]);

  // Advance steps 2–4 by watching the DOM for which section tab is active.
  useEffect(() => {
    if (!run) return;
    if (stepIndex < 1 || stepIndex > 3) return;
    const observer = new MutationObserver(() => {
      // The active tab has bg-gray-900 class — we target by checking which
      // tab has that class to detect which one the user clicked.
      const mapping = {
        1: '[data-tour="tab-colors"]',
        2: '[data-tour="tab-business"]',
        3: '[data-tour="tab-template"]',
      };
      const sel = mapping[stepIndex];
      const el = document.querySelector(sel);
      if (el && el.classList.contains('bg-gray-900')) {
        setStepIndex((i) => i + 1);
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [stepIndex, run]);

  const handleCallback = (data) => {
    const { status, action, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
      setRun(false);
    }
    // Final step: user clicks Finalize → end.
    if (type === EVENTS.TARGET_NOT_FOUND && stepIndex === STEPS.length - 1) {
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
      setRun(false);
    }
  };

  // Last step (Finalize) gets a "Got it" button since there's no forced
  // action to advance — clicking Finalize would navigate away from the
  // editor mid-tour and skip the cleanup.
  const steps = STEPS.map((s, i) => {
    if (i === STEPS.length - 1) {
      return {
        ...s,
        spotlightClicks: false,
        styles: { buttonNext: { display: 'inline-block', backgroundColor: '#cc0000', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600 } },
        locale: { last: 'Got it' },
      };
    }
    return s;
  });

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      stepIndex={stepIndex}
      run={run}
      continuous
      disableBeacon
      disableOverlayClose
      disableCloseOnEsc
      showSkipButton
      styles={JOYRIDE_STYLES}
      locale={{ skip: 'Skip tour', last: 'Got it', next: 'Next', back: 'Back' }}
      callback={handleCallback}
    />
  );
}
