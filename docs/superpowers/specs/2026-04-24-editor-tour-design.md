# Editor Tour — Design Spec

**Date:** 2026-04-24
**Status:** Approved, ready for implementation plan
**Context:** Replaces a prior `react-joyride` attempt (in the `feat/help-and-onboarding` branch on worktree `help-v2`) that had three unresolved bugs: tooltip not rendering on first step, screen locking in dark overlay, and the "done" flag being set too aggressively. Rather than continue fighting the library, we are building a small custom tour component from scratch in the current worktree.

## Goal

Walk a first-time user through the editor so they understand:
1. Where the Edit button is
2. They can hide/reorder sections
3. Where to change hero content (including logo)
4. Where to change services, gallery photos, and brand colors
5. Where to publish when they're done

The tour must never trap the user. It must always have a visible escape hatch.

## Non-goals

- No analytics, telemetry, or A/B testing
- No internationalization (English only)
- No mobile-specific tour (the editor is desktop-first; mobile users get no tour)
- No automated tests (manual QA only)
- No fonts step — fonts aren't customizable in the current codebase

## User-facing behavior

### Trigger

The tour runs once per browser, on the first visit to the editor for a newly-created site.

- On `WebsitePreview` mount, read `localStorage.editor_tour_done`
- If `=== '1'`, do not render the tour
- If the user is editing an existing site (not a freshly-created one), set the flag and do not render the tour
- Otherwise, render the tour starting at step 1

### Steps

| # | Target (label)            | `data-tour` selector       | Tooltip copy                                                                                       |
|---|---------------------------|----------------------------|----------------------------------------------------------------------------------------------------|
| 1 | Edit button (toolbar)     | `edit-btn`                 | "Click Edit to start customizing your site."                                                       |
| 2 | Sections tab (panel)      | `tab-visibility`           | "Toggle which sections appear on your site, and drag to reorder them."                             |
| 3 | Hero tab (panel)          | `tab-hero`                 | "Change your headline, main photo, and upload your business logo here."                            |
| 4 | Services tab (panel)      | `tab-services`             | "List what your business does. This is where most of your content lives."                          |
| 5 | Gallery tab (panel)       | `tab-gallery`              | "Add photos here. The Gallery section stays hidden on your site until you upload at least one."    |
| 6 | Colors tab (panel)        | `tab-colors`               | "Change your brand colors. Updates preview live."                                                  |
| 7 | Finalize button (toolbar) | `finalize-btn`             | "When you're happy with your site, click Finalize to publish it."                                  |

Note: tab `id` values come from `ContentEditor.jsx`'s `sections` array — `visibility` is labeled "Sections" in the UI, but its id is `visibility`. The `data-tour` attribute uses the id, not the label.

### Advancing

Users can advance in three ways:
1. **Click the spotlighted target** — the natural path; clicking Edit opens the editor and advances, clicking a tab activates it and advances
2. **Click the "Next" button** in the tooltip — always visible as a fallback, so users can't get stuck if a target is unclickable for any reason
3. **Press Enter** — shortcut for Next

### Escape

Every tooltip has a visible "Skip tour" link in its footer. Clicking it:
- Sets `localStorage.editor_tour_done = '1'`
- Unmounts the tour

Pressing **Escape** does the same.

### Resilience

If a step's target element cannot be found in the DOM within 3 seconds of that step becoming active:
- Show an error state in the tooltip: "Couldn't find the next step. Skip tour?"
- The Skip button is the only action

This prevents the lock-in bug that plagued the joyride version.

## Visual design

Follows the project's design conventions (see `~/.claude/CLAUDE.md`) — uses the same Tailwind tokens already in use in `PreviewToolbar` and `ContentEditor`.

**Backdrop:** Semi-transparent black using the "cutout" trick — a transparent rectangle positioned over the target element with `box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)`. No clip-path.

**Tooltip:** White card, 280px wide, with:
- Step counter (top-left): "2 of 7" in gray 400, 11px
- Title (optional, none by default): 14px semibold
- Body copy: 13px, gray 700
- Footer row: "Skip tour" link (gray 400, left-aligned) + "Next" button (gray 900, right-aligned)

**Positioning:** Auto-placement per target:
- Toolbar targets (steps 1, 7): tooltip placed *below* the target, right-aligned to the target
- Editor tab targets (steps 2–6): tooltip placed *to the left* of the target, top-aligned

**Animation:** Tooltip fades in (150ms) when its target is found. Backdrop fades in once on mount, out once on dismiss.

## Architecture

### One new component

`src/components/onboarding/EditorTour.jsx` — a self-contained component. No external dependencies.

### Core loop

```
currentStep (0..6)
  ↓
pollForTarget(stepConfig[currentStep].selector)
  ↓
when found: measure rect, render overlay + tooltip
  ↓
on advance (click target | Next | Enter):
  if last step: markDone() + unmount
  else: currentStep++
```

Polling uses `setInterval` at 150ms, cleared when the target is found. A separate 3-second watchdog timeout fires the error state if polling yields nothing.

### Position recalculation

Tooltip position recomputes on:
- `window.resize`
- `scroll` (capture phase, passive)
- `MutationObserver` on `document.body` (debounced 50ms) — catches the editor panel opening/closing

### Data flow

- Tour has no props except `enabled: boolean` (from `WebsitePreview`)
- Internal state: `currentStep`, `targetRect`, `error`
- External state: `localStorage.editor_tour_done` (read once on mount, written on skip/complete)

### Mount point

`WebsitePreview.jsx` mounts `<EditorTour enabled={isFirstTimeEdit} />` near its root. `isFirstTimeEdit` is a local boolean derived from: `!localStorage.editor_tour_done && !editingExistingSite`.

If `editingExistingSite` is not yet threaded through `WebsitePreview` in the current worktree, we add it — the prop travels from `App.jsx`.

## Files touched

| File                                            | Change                                                       |
|-------------------------------------------------|--------------------------------------------------------------|
| `src/components/onboarding/EditorTour.jsx`      | **NEW** — the tour component                                 |
| `src/components/preview/PreviewToolbar.jsx`     | Add `data-tour="edit-btn"` and `data-tour="finalize-btn"`    |
| `src/components/preview/ContentEditor.jsx`      | Add `data-tour={\`tab-${id}\`}` to each section tab button   |
| `src/components/preview/WebsitePreview.jsx`     | Mount `<EditorTour />`; thread `editingExistingSite` prop    |
| `src/App.jsx`                                   | Pass `editingExistingSite` down to `WebsitePreview` if not already |

## Error handling

- **Target not found within 3s** → tooltip shows error state with only a Skip button
- **`localStorage` unavailable** (rare, e.g., Safari private mode) → tour simply doesn't render; no crash
- **Editor closes while tour is on a tab step** (e.g., user hits Esc on editor) → tour re-polls for the target, and will advance when the user clicks Edit again; if still unfound at 3s, shows error state

## Testing plan

Manual QA only:

1. **Happy path**
   - Clear `localStorage.editor_tour_done` and create a new site via wizard
   - Verify tour starts with tooltip on Edit button
   - Click through each target in order (Edit → Sections tab → Hero tab → Services tab → Gallery tab → Colors tab → Finalize)
   - Verify tooltip appears/disappears cleanly, position is correct, Skip is always visible

2. **Next-button fallback**
   - Repeat happy path using Next button instead of clicking targets
   - Verify advances work

3. **Skip**
   - Start tour, click Skip at step 3
   - Verify tour disappears, `localStorage.editor_tour_done === '1'`
   - Reload page — tour should not appear

4. **Existing-site edit**
   - Edit an existing site (not freshly-created)
   - Verify tour does not render and `editor_tour_done` is set

5. **Esc key**
   - Start tour, press Esc
   - Verify tour dismisses and flag is set

6. **Window resize mid-tour**
   - Start tour, resize browser window
   - Verify tooltip repositions correctly

7. **Error state**
   - Temporarily remove a `data-tour` attribute from the code
   - Start tour; verify error state appears after 3 seconds with only a Skip button

## Out-of-scope / future

- Re-running the tour from a settings menu
- Per-step analytics
- Tour for existing users when new features ship
- Mobile-responsive tour
