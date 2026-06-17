# Choose Sections — Wizard Step + Instance-Based Section System

**Date:** 2026-05-18
**Status:** Drafted, pending user review
**Branch:** `claude/funny-margulis-bcc045` (worktree `funny-margulis-bcc045`) — work stays isolated; do NOT push to master until explicitly approved.
**Context:** Today the wizard generates a fixed set of sections for every site. Users can hide/reorder sections only AFTER generation, from the in-editor "Sections" panel. This update adds a "Choose Sections" step to the wizard so users compose their page before generation, introduces new section types (FAQ, Before & After, Media + Text), promotes the existing "Process / How It Works" section to be universal across all templates, and shifts the underlying data model from singleton section IDs to an ordered list of section **instances** (so a page can have multiple Media + Text blocks, each with its own copy).

## Goal

Let users compose the structure of their site before AI generation runs, by picking and ordering an arbitrary sequence of section types (with duplicates allowed). Generation then writes copy keyed to each instance, and the in-editor experience continues to allow per-instance edits.

The four new sections (FAQ, Before & After, Media + Text, universal Process) work in every existing template.

## Non-goals

- **No paid-product overhaul.** Subscription gating, billing flow, and free-tier code stay exactly as they are. A separate project will move the product to paid-only.
- **No new templates.** Existing ~25 templates get updated to render the new sections; no new template designs in this update.
- **No section configuration in the new wizard step.** Users only pick TYPES and ORDER. Per-instance content (Media + Text image, custom heading, etc.) is filled in by AI placeholders during generation and edited in the preview editor afterward.
- **No section catalog gating.** Every section type is available to every user. "Premium" in this spec just means "more polished optional sections" — no paywall.
- **No new templates supporting only some sections.** Every template renders every section type, themed to its own colors/fonts.
- **No mobile-specific wizard layout beyond the catalog collapsing into a bottom-sheet.** The existing wizard mobile layout patterns apply.
- **No analytics or telemetry on section choices.**
- **No automated tests for the new wizard step or section rendering.** Manual QA only. (Existing tests must keep passing.)

## Decisions captured from brainstorming

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Scope: wizard + sections only | Keep this update shippable; paid-product overhaul is a separate project |
| 2 | New section types: FAQ, Before & After, Media + Text, universal Process | User-selected from candidate list |
| 3 | Sections become an ordered list of **instances** with unique IDs | Required to support duplicates (e.g., two Media + Text blocks) |
| 4 | Starting state on the new step: smart default per template | Fastest path; most users won't change much |
| 5 | Existing sites: auto-migrate on load | Zero-break user experience; no two code paths long-term |
| 6 | Required sections: Hero (first) + Contact/CTA (last) locked in | Prevents broken-looking sites with no headline / no contact |
| 7 | AI generation: single call returns copy keyed by instance ID | One round-trip, same speed as today |
| 8 | All templates support all section types | Consistent UX, no "this section doesn't work here" warnings |
| 9 | UI approach: two-panel page builder (catalog left, composition right) | Matches existing editor "Sections" tab paradigm |
| 10 | Post-generation edits remain in the existing preview editor | Editor sidebar becomes per-instance |

## Workflow change

```
Business Type → Business Info → Template → [NEW] Choose Sections → Generating → Preview → Export
   step 1         step 2        step 3       step 3.5            step 4      step 5    step 6
```

`STEP_LABELS` in [WizardShell.jsx](src/components/wizard/WizardShell.jsx:5) becomes:
```js
['Business Type', 'Your Info', 'Template', 'Sections', 'Generating', 'Preview', 'Export']
```

In [App.jsx](src/App.jsx), a new state-handler path `step === 3.5` (or renumbered — see Open Questions) renders the new component `StepChooseSections`. Existing step transitions:
- Template `onSelect` no longer goes straight to Generate. It populates `selectedSections` with the smart default for that template, then advances to the new step.
- The new step's "Generate My Website" CTA writes `selectedSections` onto `businessInfo` (or as a top-level arg to `generateWebsite`) and advances to step 4 (Generating) — replacing today's direct jump from Template → Generating.

## Data model

### New: `sections` array on `generatedCopy`

Replaces `hiddenSections` + `sectionOrder`.

```js
generatedCopy.sections = [
  { id: 'inst_a3f1', type: 'hero',         locked: 'top'    },
  { id: 'inst_9k2m', type: 'mediaText'                       },
  { id: 'inst_77pq', type: 'services'                        },
  { id: 'inst_8w1n', type: 'mediaText'                       },
  { id: 'inst_xx02', type: 'faq'                             },
  { id: 'inst_zzz0', type: 'cta',          locked: 'bottom'  },  // "Contact / CTA"
]
```

- `id`: unique per instance. Format: `inst_` + 8 random base36 chars (collision-safe within a single site).
- `type`: section type key (see Section Catalog below).
- `locked`: optional. `'top'` for Hero, `'bottom'` for Contact. Locked instances cannot be deleted or reordered; their TYPE cannot be changed. Their content IS editable.

### New: `sectionContent` map on `generatedCopy`

Per-instance content for section types that need it. Keyed by instance ID.

```js
generatedCopy.sectionContent = {
  'inst_9k2m': { heading: '...', body: '...', image: 'hero', alignment: 'left' },  // first Media+Text
  'inst_8w1n': { heading: '...', body: '...', image: 'gallery3', alignment: 'right' }, // second Media+Text
  'inst_xx02': { items: [{ q: '...', a: '...' }, ...] },  // FAQ
}
```

Per-instance content is ONLY used for sections that need it (Media + Text, FAQ items, Before & After image pairs). Generic-section copy (hero headline, about text, services list, testimonials, CTA) continues to live at the top level of `generatedCopy` — there is only ever one hero, one about, one services list, etc., so per-instance storage would be wasted overhead.

Sections that may appear multiple times: `mediaText`, `customText`, `videoEmbed` (if/when added). Sections that are unique-per-page (hero, about, services, gallery, testimonials, contact, cta, faq, beforeAfter, process, statsBar, awards, etc.) live at top-level and ignore instance-keyed content.

> Rationale: keeps the existing AI prompt schema mostly intact, avoids forcing every section into the instance-content map, and means the migration of existing sites can leave their copy structure untouched.

### Migration — existing sites

When an existing site is loaded (in [App.jsx's `handleEditSite`](src/App.jsx:367)), detect old format and migrate in-place before passing to the editor:

```js
function migrateSections(copy, templateId) {
  if (Array.isArray(copy.sections)) return copy;  // already migrated

  const defaultIds = getTemplateDefaultSectionIds(templateId);  // from existing TOGGLEABLE registry
  const order = (copy.sectionOrder?.length ? copy.sectionOrder : defaultIds);
  const hidden = new Set(copy.hiddenSections || []);

  const sections = order
    .filter(id => !hidden.has(id))
    .map((type, i) => ({
      id: makeInstanceId(),
      type,
      ...(type === 'hero' ? { locked: 'top' } : {}),
      ...(type === 'cta' ? { locked: 'bottom' } : {}),
    }));

  // Hero/contact may have been hidden; re-add them as locked instances at the right edges
  // (Old sites without a contact section keep whatever they had; only re-add if it existed in the template default.)
  ensureLockedEnds(sections, defaultIds);

  return { ...copy, sections, sectionContent: copy.sectionContent || {} };
  // hiddenSections + sectionOrder remain on the object for one release as a safety net;
  // they are ignored by new code. Removed in a follow-up cleanup pass.
}
```

Migration runs once on load. The migrated `sections` array is written back to Supabase on the next auto-save, so subsequent loads skip migration.

## Section catalog

All section types available in the picker. Grouped by intent in the UI.

### Essentials (always available, Hero/Contact required)

| Type        | Multi? | New?  | Notes                                            |
|-------------|--------|-------|--------------------------------------------------|
| `hero`      | no     | no    | Locked first. Headline + subheadline + CTA + bg image |
| `services`  | no     | no    | Service cards. Pulls from `businessInfo.services`. |
| `about`     | no     | no    | About paragraph(s). AI-generated.                |
| `gallery`   | no     | no    | Photo grid. Hidden in render until ≥1 image.     |
| `testimonials` | no  | no    | Reviews. AI-generated placeholders or Google Reviews widget. |
| `cta`       | no     | no    | Locked last. Labeled "Contact / CTA" in catalog. Combines hours + phone + address + form + CTA band. Matches today's existing `cta` section type — not split into separate `contact` + `cta`. |

### Content (universal as of this update)

| Type           | Multi? | New?  | Notes                                              |
|----------------|--------|-------|----------------------------------------------------|
| `process`      | no     | NOW UNIVERSAL | Numbered "How It Works" steps. AI-generated 3-5 steps based on services. Exists in some templates today; this update extends to ALL templates. |
| `faq`          | no     | **NEW** | Q+A list. AI-generated 4-6 from business info + services. Editable per item. |
| `beforeAfter`  | no     | **NEW** | Image pair grid OR slider. User uploads pairs in the editor. Empty until first pair uploaded. |
| `mediaText`    | **YES** | **NEW** | Image (or video URL) + heading + body + optional button. Per-instance alignment (left/right). AI fills generic placeholder copy; user edits in preview. |

### Trust / Existing template-specific (kept template-scoped)

These remain available only in templates that already render them. They are NOT promoted to universal in this update.

| Type           | Templates                                |
|----------------|------------------------------------------|
| `statsBar`     | DetailingSporty, WheelEdge, WheelClean, TintObsidian, TintDark, TintElite, mobile_* |
| `whyUs`        | mechanic_ironclad, mobile_sudsy, carwash_bubble |
| `awards`       | wheel_clean, _default                    |
| `trustBar`     | wheel_apex                               |
| `ticker`       | wheel_apex, mechanic_ironclad            |
| `ctaBand`      | mechanic_ironclad                        |
| `brands`       | wheel_*, tint_*                          |
| `products`     | wheel_apex                               |
| `shadeGuide`   | tint_obsidian                            |
| `filmBrands`   | tint_*                                   |

In the catalog UI, these appear in a "Template-specific" group that only shows entries the current template supports.

## Choose Sections UI (Step 3.5)

New file: `src/components/wizard/StepChooseSections.jsx`.

**Layout** — two panels, desktop-first:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ProgressBar (4 of 7 highlighted: "Sections")                        │
├──────────────────────────┬──────────────────────────────────────────┤
│  CATALOG (left, 320px)   │  COMPOSITION (right, fills)              │
│  ───────────────────     │  ──────────────────────────              │
│  ESSENTIALS              │  ╔═══════════════════════════╗           │
│   [hero] [services]…     │  ║ ⠿ Hero  🔒                ║           │
│  CONTENT                 │  ╚═══════════════════════════╝           │
│   [faq] [process]…       │  ╔═══════════════════════════╗           │
│  TEMPLATE-SPECIFIC       │  ║ ⠿ Media + Text       ×    ║           │
│   [stats] [brands]…      │  ╚═══════════════════════════╝           │
│                          │  ┌  + Drop section here  ┐                │
│                          │  └                       ┘                │
│                          │  ╔═══════════════════════════╗           │
│                          │  ║ ⠿ Services            ×    ║           │
│                          │  ╚═══════════════════════════╝           │
│                          │  …                                        │
│                          │  ╔═══════════════════════════╗           │
│                          │  ║ ⠿ Contact / CTA  🔒        ║           │
│                          │  ╚═══════════════════════════╝           │
├──────────────────────────┴──────────────────────────────────────────┤
│   [ Generate My Website ]                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Catalog (left)**
- Vertical scrollable list, grouped with sticky group headers (`ESSENTIALS`, `CONTENT`, `TEMPLATE-SPECIFIC`).
- Each item is a card: icon, name (e.g., "FAQ"), one-line description ("Common questions").
- Click an item: appends a new instance of that type to the bottom of the composition (above the locked Contact). Subtle "Added" flash on the catalog card. Optional drag-into-composition supported but click is the primary action.

**Composition (right)**
- Vertical stack of instance rows top-to-bottom (top of stack = top of page).
- Each row: drag handle (⠿), section icon, section name, "×" remove button.
- Hero row pinned at top, Contact row pinned at bottom, both with a 🔒 indicator and no × or drag affordance.
- HTML5 drag-and-drop reorders between Hero (exclusive) and Contact (exclusive). Drop zones light up on hover.
- Duplicating: each Media + Text instance shows a small "Duplicate" action; clicking adds another `mediaText` instance directly below it.

**Empty state**
- The composition is never empty (Hero + Contact always present). Smart-default population happens on enter; the user can clear everything between, but Hero/Contact stay.

**Mobile (< 768px)**
- Composition becomes the main view.
- A floating "+ Add Section" button bottom-right opens the catalog as a bottom-sheet.
- Drag handles work via touch. (Optionally a tap-to-reorder "Move up / Move down" affordance — see Open Questions.)

**Validation**
- Minimum sections: Hero + Contact (always present). No max.
- "Generate My Website" is always enabled; sections array always has at least Hero + Contact.

## Shared section components — architecture

Today section markup lives inline inside each template JSX file (e.g., the FAQ for a future detailing template would be duplicated across all detailing variants). With four new sections × ~25 templates × inline JSX, that's unmaintainable.

**New pattern**: extract shared section renderers into `src/components/preview/sections/`.

```
src/components/preview/sections/
  HeroSection.jsx           // (existing inline → extracted later; deferred)
  FAQSection.jsx            // NEW
  BeforeAfterSection.jsx    // NEW
  MediaTextSection.jsx      // NEW
  ProcessSection.jsx        // NEW (was inline in 3 templates)
  ...
```

Each shared section component takes a uniform prop interface:
```js
function FAQSection({ instance, businessInfo, generatedCopy, templateMeta, images, sectionContent, onEditContent }) { ... }
```
- `instance` — the instance row (`{ id, type, locked? }`)
- `templateMeta` — colors, fonts, mood — sections style themselves from this
- `sectionContent` — `generatedCopy.sectionContent[instance.id]` if any
- The component decides its own background/padding/typography using `templateMeta`, so it visually fits any template.

**Templates change to render the user's section list**: existing inline section blocks in each template file get replaced with a single loop:

```jsx
{(generatedCopy.sections || defaultSections).map((inst) => (
  <SectionRenderer key={inst.id} instance={inst} {...sharedProps} />
))}
```

`SectionRenderer` is a switch on `inst.type` that dispatches to the right shared section component. Existing sections (hero, services, about, etc.) get extracted incrementally — for this update, hero/services/about/gallery/testimonials/cta/contact stay inline in each template (since they already exist and work), and `SectionRenderer` knows to call the template's local renderer for those types via a render-prop or per-template registry. New sections (FAQ, mediaText, beforeAfter, universal process) always go through the shared components.

> This avoids a "rewrite all 25 templates from scratch" risk. We add the loop + dispatch, leave existing sections in place, and only the new section types use shared components in the first ship. Existing sections can be migrated to shared components in follow-up passes when each template is touched for other reasons.

## AI generation changes

The Netlify function [generate-website.js](netlify/functions/generate-website.js) receives the section list and returns copy keyed by instance for the per-instance sections.

**Input change** — `businessInfo` now includes the section composition:
```js
POST /.netlify/functions/generate-website
{
  businessInfo: { ..., sections: [{id, type, locked?}, ...] },
  templateMeta: { ... }
}
```

**Prompt change** — the schema returned by the AI is now dynamic. Build it from the section list:
- Generic sections (hero, about, services, testimonials, cta) → request top-level fields exactly as today (`headline`, `subheadline`, `aboutText`, `servicesSection`, etc.). Only request the fields for section types present in the list (e.g., skip `aboutText` if no `about` instance).
- `faq` instance → request `sectionContent[<instanceId>] = { items: [{q,a}, ...] }` (4-6 items).
- `mediaText` instances → for each, request `sectionContent[<instanceId>] = { heading, body, alignment }` with generic-but-on-topic placeholder copy.
- `beforeAfter` instances → no AI copy needed; user uploads images later. Just `{}` placeholder.
- `process` instance → request `process: { intro, steps: [{title, description}, ...] }` at top level (single instance).

**Response shape**:
```js
{
  success: true,
  copy: {
    // existing top-level fields, scoped to what was requested
    headline, subheadline, aboutText, servicesSection, ctaPrimary, ctaSecondary,
    testimonialPlaceholders, metaTitle, metaDescription, keywords, footerTagline,
    // new top-level fields for universal sections
    process: { intro, steps },
    // per-instance content
    sectionContent: {
      'inst_xx02': { items: [{q,a}, ...] },
      'inst_9k2m': { heading, body, alignment: 'left' },
      'inst_8w1n': { heading, body, alignment: 'right' },
    },
  }
}
```

On success, [App.jsx's `handleGenerateSuccess`](src/App.jsx:190) merges `sectionContent` into `editedCopy` (creating it if absent) and writes the original `sections` array (from businessInfo) onto `generatedCopy.sections` so the editor and template renderers see it.

**Token budget**: existing call uses `max_tokens: 2500`. Adding FAQ (6 q+a ≈ 250 tok), 2x Media+Text (~80 tok each), universal process (~150 tok) = +560 tok in the worst case. Bump to `max_tokens: 3500` to be safe.

**Fallbacks**: if the AI response is malformed or missing fields for a section, the template renders the section with empty/placeholder copy and the user fills it in. We don't fail generation over partial copy.

## Editor changes (post-generation)

[ContentEditor.jsx](src/components/preview/ContentEditor.jsx) sidebar today has a fixed list of tabs per template (Hero, Services, About, …). With instances, the sidebar must show one entry per instance.

**New sidebar behavior**:
- Generate the tab list from `generatedCopy.sections` at render time.
- For unique-type sections (hero, services, about, etc.), the tab label is the type name (e.g., "Hero", "Services").
- For multi-type sections (mediaText), the tab label includes an index: "Media + Text #1", "Media + Text #2".
- The "Sections" tab (currently the toggle/reorder panel) is renamed "Layout" and now lets the user reorder + add/remove instances post-generation as well — same UI as the wizard step, scaled down.
- Each tab's edit pane reads/writes per-instance content from `generatedCopy.sectionContent[instance.id]` (for multi-instance types) or top-level fields (for unique types) — same as today.

**Tour update** ([EditorTour.jsx](src/components/onboarding/EditorTour.jsx)): the existing tour step that references `tab-visibility` ("Toggle which sections appear … drag to reorder") still applies — the renamed Layout tab gets the same `data-tour="tab-visibility"` selector so the tour keeps working without copy changes.

## State management in App.jsx

New state:
```js
const [selectedSections, setSelectedSections] = useState(null);  // null until step 3.5 entered
```

Set when the user enters step 3.5 (initialize from template default). Passed into the new `StepChooseSections` component as `value` + `onChange`. Passed into `generateWebsite()` call as part of `businessInfo`.

Wizard draft localStorage save ([App.jsx:97](src/App.jsx:97)) includes `selectedSections` so a refresh mid-wizard preserves the composition.

## Files touched

**New**:
- `src/components/wizard/StepChooseSections.jsx` — the new step
- `src/components/preview/sections/FAQSection.jsx`
- `src/components/preview/sections/BeforeAfterSection.jsx`
- `src/components/preview/sections/MediaTextSection.jsx`
- `src/components/preview/sections/ProcessSection.jsx`
- `src/components/preview/sections/SectionRenderer.jsx` (dispatcher)
- `src/data/sectionCatalog.js` — section type registry: `{ type, label, description, icon, multi, group, supportedTemplates? }`
- `src/lib/migrateSections.js` — old-format → instance-list migration helper

**Modified**:
- `src/App.jsx` — new step in wizard, `selectedSections` state, pass to generator, migration on edit-existing
- `src/components/wizard/WizardShell.jsx` — `STEP_LABELS` adds "Sections"
- `src/components/wizard/StepTemplatePicker.jsx` — `onGenerate` becomes `onChooseSections` (advances to step 3.5 instead of 4)
- `src/components/preview/ContentEditor.jsx` — dynamic tab list from instances; renamed Layout tab uses new layout panel
- `src/lib/sectionOrder.js` — extended/replaced with instance-aware lookups
- `src/lib/saveSite.js` — accepts/persists `sections` + `sectionContent`
- `netlify/functions/generate-website.js` — dynamic prompt schema based on section list; returns `sectionContent`
- All 25 template files in `src/components/preview/templates/**/*.jsx` — append `<SectionRenderer>` loop for new section types after existing inline sections, OR insert into the right position in the order. Per-template work: each template's section sequence is generated by iterating `generatedCopy.sections`; existing inline sections wrapped in a per-type guard so they only render if the user's section list includes them.
- `src/components/onboarding/EditorTour.jsx` — `tab-visibility` → still works (renamed tab keeps selector)

## Open questions (defer to implementation)

1. **Step numbering** — Currently I've written `step === 3.5`. Cleaner is to renumber all subsequent steps: Sections = 4, Generating = 5, Preview = 6, Export = 7. This means changing every `goTo(4)` / `goTo(5)` / `goTo(6)` reference in App.jsx and StepExport. Implementation plan should pick a path; I lean towards renumbering for cleanliness even though it touches more files.
2. **Mobile reorder UX** — touch drag works but is finicky on long lists. Implementation can ship with drag-only and add tap-up/tap-down arrows in a follow-up if QA shows issues.
3. **Whether to also extract Hero/Services/About into shared section components in this update or defer** — spec defers. Implementation plan can re-evaluate based on time budget; if 25 templates are getting touched anyway, partial extraction may be cheap.
4. **Whether to render a live preview of the page while choosing sections** — out of scope for this spec (would significantly expand the new step). User confirms layout post-generation in the Preview step as today.

## Rollout

- All work happens on the current worktree branch `claude/funny-margulis-bcc045`.
- No merge to master until full QA pass.
- No production deploy until the user explicitly approves the merge.
- Existing sites in production remain on the old data format until they're next opened, at which point migration runs transparently on load and writes back the migrated shape on the next auto-save.

## Risk register

| Risk | Mitigation |
|------|------------|
| Migration corrupts existing sites | Migration is pure-function + dry-runnable; old `hiddenSections`/`sectionOrder` kept on the object for one release as a fallback |
| AI returns malformed `sectionContent` for an instance | Section components render with empty/placeholder copy; user fills in the editor |
| 25 templates × new section types is a slog | Shared section components do the heavy lifting; templates only need a single loop + dispatcher |
| Mobile drag-and-drop is broken on iOS Safari | QA on real devices; fall back to tap-arrows if needed |
| Editor tab list overflows when user has many Media+Text instances | Sidebar already scrolls; add visual separator / "Sections" subheading if list gets long |
