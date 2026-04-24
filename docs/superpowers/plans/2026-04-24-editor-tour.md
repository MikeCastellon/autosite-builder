# Editor Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom 7-step first-time guided tour for the site editor, replacing an abandoned `react-joyride` attempt.

**Architecture:** One self-contained React component (`EditorTour.jsx`) that polls the DOM for elements tagged with `data-tour` attributes, renders a backdrop-with-cutout overlay plus a tooltip card, and advances when the user clicks the spotlighted target (or a visible "Next" button). Uses `localStorage.editor_tour_done` flag. No external libraries.

**Tech Stack:** React 18, Tailwind CSS, Vite dev server. No automated tests — manual QA only (per spec).

**Spec:** `docs/superpowers/specs/2026-04-24-editor-tour-design.md`

---

## File Structure

| File                                            | Responsibility                                                    |
|-------------------------------------------------|-------------------------------------------------------------------|
| `src/components/onboarding/EditorTour.jsx`      | **NEW** — tour state machine, polling, overlay, tooltip           |
| `src/components/preview/PreviewToolbar.jsx`     | **MODIFY** — add `data-tour` to Edit and Finalize buttons         |
| `src/components/preview/ContentEditor.jsx`      | **MODIFY** — add `data-tour="tab-${id}"` to each section tab      |
| `src/components/preview/WebsitePreview.jsx`     | **MODIFY** — mount `<EditorTour />` conditionally                 |
| `src/App.jsx`                                   | **MODIFY** — track and pass `editingExistingSite` flag            |

---

## Task 1: Add `data-tour` attributes to existing components

This task instruments the DOM so `EditorTour` can find its targets later. No behavior change — just added attributes. We commit this first so the rest of the work can build on a stable DOM contract.

**Files:**
- Modify: `src/components/preview/PreviewToolbar.jsx`
- Modify: `src/components/preview/ContentEditor.jsx`

- [ ] **Step 1: Add `data-tour="edit-btn"` to the Edit button in `PreviewToolbar.jsx`**

Find the Edit button (around line 33-45, the `<button onClick={onEdit}>` with `Edit` label). Add the attribute to the opening tag:

```jsx
<button
  onClick={onEdit}
  data-tour="edit-btn"
  className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg border transition-all ${
    editorOpen
      ? 'bg-gray-900 text-white border-gray-900'
      : 'border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900'
  }`}
>
```

- [ ] **Step 2: Add `data-tour="finalize-btn"` to the Finalize button in `PreviewToolbar.jsx`**

Find the Finalize Website button (around line 53-58). Add the attribute:

```jsx
<button
  onClick={onExport}
  data-tour="finalize-btn"
  className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
>
  Finalize Website
</button>
```

- [ ] **Step 3: Add `data-tour={\`tab-${s.id}\`}` to each section tab button in `ContentEditor.jsx`**

Find the `.map((s) => (...))` block that renders section tab buttons (around line 412-423). Add the attribute:

```jsx
{sections.map((s) => (
  <button
    key={s.id}
    type="button"
    data-tour={`tab-${s.id}`}
    onClick={(e) => { e.stopPropagation(); setActiveSection(s.id); }}
    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
      activeSection === s.id
        ? 'bg-gray-900 text-white'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    {s.label}
  </button>
))}
```

- [ ] **Step 4: Verify no crashes by running the dev server**

Run: `npm run dev`
Expected: Server starts on port 5173/5174/5175 without errors. Navigate to the site, open an editor preview, and verify the Edit/Finalize buttons still work and the tab clicks still switch tabs.

- [ ] **Step 5: Commit**

```bash
git add src/components/preview/PreviewToolbar.jsx src/components/preview/ContentEditor.jsx
git commit -m "feat(editor-tour): add data-tour attributes to toolbar and section tabs

Instruments Edit button, Finalize button, and every section tab button
with a data-tour attribute. No behavior change. Lays the DOM contract
for the upcoming EditorTour component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `editingExistingSite` flag to `App.jsx` and thread it to `WebsitePreview`

The tour must be suppressed when a user is editing a previously-created site (not their brand-new one). We add a boolean state in `App.jsx` and pass it to `WebsitePreview`.

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/preview/WebsitePreview.jsx`

- [ ] **Step 1: Add `editingExistingSite` state in `App.jsx`**

Locate the other `useState` declarations near the top of the `App` component (look for `useState(false)` patterns like `const [isDemoPreview, setIsDemoPreview] = useState(false);`). Add:

```jsx
const [editingExistingSite, setEditingExistingSite] = useState(false);
```

- [ ] **Step 2: Set `editingExistingSite` to `true` in `handleEditSite`**

Find the `handleEditSite` function (it ends around line 216 with `setView('wizard')`). At the end of the function, add one line:

```jsx
setEditingExistingSite(true);
```

- [ ] **Step 3: Reset `editingExistingSite` to `false` in `handleStartOver` and `handlePreviewDemo`**

Find `handleStartOver` (this resets state when user clicks "Create Another"). Add near its other resets:

```jsx
setEditingExistingSite(false);
```

Also in `handlePreviewDemo` (around line 227), add:

```jsx
setEditingExistingSite(false);
```

This guarantees the flag is only `true` when the user actually clicked "Edit" on a site card, not when they're previewing a demo or creating fresh.

- [ ] **Step 4: Pass `editingExistingSite` as a prop to `WebsitePreview`**

In the `<WebsitePreview ... />` JSX block (around line 247), add the prop:

```jsx
<WebsitePreview
  businessInfo={isDemoPreview ? DEMO_BUSINESS_INFO : businessInfo}
  generatedCopy={generatedCopy}
  editedCopy={editedCopy}
  // ... existing props
  isDemoPreview={isDemoPreview}
  editingExistingSite={editingExistingSite}
/>
```

- [ ] **Step 5: Accept `editingExistingSite` prop in `WebsitePreview.jsx`**

Open `src/components/preview/WebsitePreview.jsx`, find the function signature (default-exported component). Add `editingExistingSite` to the destructured props. For example:

```jsx
export default function WebsitePreview({
  businessInfo,
  generatedCopy,
  // ... existing props
  isDemoPreview,
  editingExistingSite,
}) {
```

Don't use it yet — just accept it. (We wire the tour mount in Task 4.)

- [ ] **Step 6: Verify the app still works**

Run: `npm run dev`
Expected: No crashes. Go to the dashboard, click "Edit" on an existing site → it should open WebsitePreview normally. Then go back and create a fresh site via the wizard → also opens WebsitePreview normally. (No visible difference yet; we haven't mounted the tour.)

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/preview/WebsitePreview.jsx
git commit -m "feat(editor-tour): thread editingExistingSite flag through App to WebsitePreview

Tracks whether the user arrived at the editor via 'Edit existing site'
or via the wizard's fresh-site flow. Used by the upcoming tour to
suppress itself for returning users.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create the `EditorTour` component

The whole tour — config, state, polling, overlay, tooltip, keybindings, position recalc — lives in one self-contained file. We build it up in small steps and commit once.

**Files:**
- Create: `src/components/onboarding/EditorTour.jsx`

- [ ] **Step 1: Create the folder and file with step config + imports**

Create `src/components/onboarding/EditorTour.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';

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
    copy: 'When you\'re happy with your site, click Finalize to publish it.',
  },
];

const FLAG_KEY = 'editor_tour_done';
const TOOLTIP_WIDTH = 280;
const POLL_INTERVAL_MS = 150;
const WATCHDOG_MS = 3000;

export default function EditorTour() {
  return null;
}
```

- [ ] **Step 2: Add core state + localStorage short-circuit**

Replace the component body with:

```jsx
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

  // All hooks added in later steps go HERE, before the early return.

  if (dismissed) return null;

  return null; // replaced with real JSX in Step 7
}
```

- [ ] **Step 3: Add target polling with watchdog**

Insert this `useEffect` block after the state declarations and before the `if (dismissed)` line:

```jsx
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
```

- [ ] **Step 4: Add position-recalc listeners**

Add a second `useEffect` below the first:

```jsx
useEffect(() => {
  if (dismissed || !rect) return;

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
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });

  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('scroll', update, { capture: true });
    mo.disconnect();
    clearTimeout(mutTimer);
  };
}, [dismissed, rect, step.selector]);
```

- [ ] **Step 5: Add advance + dismiss handlers**

Below the effects, add:

```jsx
const advance = () => {
  if (stepIdx >= STEPS.length - 1) {
    markDone();
  } else {
    setStepIdx(stepIdx + 1);
  }
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
```

- [ ] **Step 6: Compute tooltip position from rect + placement**

Above the return statement, add:

```jsx
const tooltipPos = (() => {
  if (!rect) return null;
  const gap = 12;
  if (step.placement === 'below-right') {
    // tooltip below the target, right edge aligned
    return {
      top: rect.bottom + gap,
      left: rect.right - TOOLTIP_WIDTH,
    };
  }
  // 'left' placement: tooltip to the left of target, top aligned
  return {
    top: rect.top,
    left: rect.left - TOOLTIP_WIDTH - gap,
  };
})();
```

- [ ] **Step 7: Render overlay + tooltip**

Replace the final `return null;` with this return block:

```jsx
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
```

- [ ] **Step 8: Verify no syntax errors**

Run: `npm run dev`
Expected: Dev server compiles without errors. The tour is not mounted yet (that's Task 4), so nothing visible changes in the browser.

- [ ] **Step 9: Commit**

```bash
git add src/components/onboarding/EditorTour.jsx
git commit -m "feat(editor-tour): custom guided tour component

Self-contained 7-step tour for the editor. Polls the DOM for targets
tagged with data-tour, renders a backdrop-with-cutout overlay plus
a tooltip card. Advances on click-on-target, Enter, or Next button.
Dismisses on Skip, Esc, or completion. No external dependencies.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mount `EditorTour` in `WebsitePreview` with correct trigger logic

Wire the tour into the live app. Mount it conditionally (only for fresh sites), and set the done flag when the user is editing an existing site so they don't see the tour later if they happen to create a new one.

**Files:**
- Modify: `src/components/preview/WebsitePreview.jsx`

- [ ] **Step 1: Import `EditorTour`**

At the top of `WebsitePreview.jsx`, add:

```jsx
import EditorTour from '../onboarding/EditorTour.jsx';
```

- [ ] **Step 2: Add a `useEffect` to set the flag when editing an existing site**

Inside the `WebsitePreview` component body (near the top, after state declarations), add:

```jsx
useEffect(() => {
  if (editingExistingSite) {
    try { localStorage.setItem('editor_tour_done', '1'); } catch { /* ignore */ }
  }
}, [editingExistingSite]);
```

If `useEffect` is not already imported in this file, add it to the React import at the top.

- [ ] **Step 3: Mount `<EditorTour />` conditionally**

Find the top-level returned JSX of `WebsitePreview`. At the end of the fragment (or wrapping div), add:

```jsx
{!editingExistingSite && !isDemoPreview && <EditorTour />}
```

We also skip on demo previews because there's no real editing to do there.

- [ ] **Step 4: Verify the tour appears on a fresh site**

Run: `npm run dev`

In the browser devtools console, clear the flag:

```js
localStorage.removeItem('editor_tour_done'); location.reload();
```

Create a new site through the wizard. When you reach the preview screen, the tour should appear with its first tooltip pointing at the Edit button in the top-right toolbar.

- [ ] **Step 5: Verify the tour does NOT appear when editing an existing site**

Go back to the dashboard. Click "Edit" on an existing site card. The tour should NOT appear.

Open devtools and verify `localStorage.editor_tour_done === '1'`.

- [ ] **Step 6: Commit**

```bash
git add src/components/preview/WebsitePreview.jsx
git commit -m "feat(editor-tour): mount tour in WebsitePreview with first-time-only gating

Tour renders only for fresh sites (not existing-site edits, not demo
previews). When a user edits an existing site, we set the done flag
so subsequent fresh sites also skip the tour — the editor has already
been seen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Manual QA walkthrough

This is the verification gate. Every scenario from the spec's testing plan must pass. If anything fails, fix it inline and re-test before the final commit.

**Files:** None initially. If fixes are needed, modify the relevant file from Tasks 1–4.

- [ ] **Step 1: Reset flag and start dev server**

```bash
npm run dev
```

In browser devtools console:

```js
localStorage.removeItem('editor_tour_done'); location.reload();
```

- [ ] **Step 2: Happy path — click through every step**

Create a new site via the wizard. At the preview screen:

1. Tooltip should appear on the Edit button (top-right). Copy: "Click Edit to start customizing your site." Step counter: "1 of 7"
2. Click the Edit button. Editor panel opens. Tooltip moves to the "Sections" tab.
3. Click "Sections" tab. Tooltip moves to the "Hero" tab.
4. Click "Hero". Tooltip moves to "Services".
5. Click "Services". Tooltip moves to "Gallery".
6. Click "Gallery". Tooltip moves to "Colors".
7. Click "Colors". Tooltip moves to "Finalize Website" button.
8. Click "Finalize". Tour dismisses cleanly.

Expected at the end: `localStorage.editor_tour_done === '1'`. Reload page — tour does NOT reappear.

- [ ] **Step 3: Next-button fallback**

Reset the flag and reload. Instead of clicking targets, click the "Next" button in the tooltip each time. The tour should advance step-by-step. The last step's button reads "Finish" and dismisses the tour.

- [ ] **Step 4: Skip button**

Reset the flag and reload. Start the tour. At step 3, click "Skip tour". Tour disappears. Verify flag is set. Reload — tour does not reappear.

- [ ] **Step 5: Existing-site suppression**

Reset the flag and reload. From the dashboard, click "Edit" on an existing site card. Tour does NOT appear. Verify `localStorage.editor_tour_done === '1'` was set automatically.

- [ ] **Step 6: Escape key**

Reset the flag and reload. Start the tour. Press Escape. Tour dismisses. Verify flag is set.

- [ ] **Step 7: Window resize mid-tour**

Reset the flag and reload. Start the tour. Resize the browser window. The cutout and tooltip should reposition to track the target.

- [ ] **Step 8: Error state**

Temporarily break a `data-tour` attribute. In `ContentEditor.jsx`, change `data-tour={\`tab-${s.id}\`}` to `data-tour={\`tabBROKEN-${s.id}\`}`. Reset the flag, reload, start the tour. Click the Edit button to advance past step 1. Step 2 should show the error state tooltip centered on screen with only a "Skip tour" button after ~3 seconds.

Revert the `data-tour` attribute change.

- [ ] **Step 9: Demo preview suppression**

Reset the flag and reload. From the template picker, click "Preview" on a template (demo preview, not a real site). The tour should NOT appear.

- [ ] **Step 10: If any fixes were needed, commit them**

If Steps 2–9 uncovered bugs and you fixed them:

```bash
git add -p  # review fixes one by one
git commit -m "fix(editor-tour): <specific issue found in QA>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 11: Push to master (per user preference for this project)**

```bash
git push origin HEAD:master
```

---

## Done

After Task 5 completes cleanly, the editor tour ships. Users who create their first site see the 7-step walkthrough. Everyone else is unaffected.
