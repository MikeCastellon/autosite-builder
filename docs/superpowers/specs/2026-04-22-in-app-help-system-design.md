# In-App Help System — Design Spec

**Date:** 2026-04-22
**Status:** Approved for implementation planning
**Owner:** Mike Castellon

## Problem

New users of the Website Creator have no in-product guidance. When they land in the wizard or the preview/edit screen, they have to figure out the flow on their own. The edit menu is especially dense (inline text, images, colors, fonts, widgets, auto-save) and is where user confusion is most likely to occur.

## Goal

Ship a v1 in-app help system that walks users through the full product: sign-up, wizard, template selection, AI generation, the edit menu (deep-dive), publishing, dashboard, social feeds, and bookings. Content is static articles with real annotated screenshots, accessed from a floating help button visible on every screen.

## Non-Goals

- Interactive walkthroughs / product tours with tooltip overlays on real UI (too fragile for v1)
- Video content
- Searchable help center with backend / analytics
- Instagram widget coverage (disabled pending Meta App Review)
- Editing articles from a CMS — content lives in source for v1

## UX & Component Architecture

### Floating Help Button
- Fixed position, bottom-right, 48px circle
- Background `#cc0000` (existing red accent), white `?` icon
- Shadow `0 4px 12px rgba(0,0,0,0.15)` to lift off content
- `z-index: 60` (above toolbars, below modals)
- Visible on: landing page, wizard, preview, dashboard, admin, bookings-page, booking-settings
- Hidden on: login page, reset-password page

### Help Drawer
- Slides in from the right on open (`transform: translateX(...)` transition, 200ms ease)
- Desktop: fixed width 420px, full height, backdrop behind (click-outside closes)
- Mobile (≤640px): full-screen drawer
- Close via: `X` button top-right, `Esc` key, backdrop click

**Two views inside the drawer:**

1. **List view (default)**
   - Header: "Help Center" + close button
   - Search input below header — client-side filter on article `title + description`
   - Scrollable list of article cards — each shows icon, title, 1-line description, read time
   - Empty-state for no search matches: "No articles match \"{query}\""

2. **Article view**
   - Back arrow → returns to list (retains scroll position and search query)
   - Article title + read time
   - Steps rendered sequentially — each step: `heading`, `body`, optional `screenshot`, optional `callout`
   - "Back to Help Center" link at bottom

### Deep Linking (optional for v1, but the plumbing is cheap)
- Query param `?help=<article-slug>` opens the drawer directly to that article on page load
- Useful later for error-message links ("Having trouble? [Read about the edit menu]")

## Content Outline

Seven articles shipped in v1. Stored in `src/components/help/articles.js` as an ordered array. Order below is the drawer display order.

| # | Title | Slug | Icon | Read Time | Steps |
|---|-------|------|------|-----------|-------|
| 1 | Getting Started | `getting-started` | 🚀 | 5 min | 7 |
| 2 | Choosing a Business Type & Template | `business-type-and-template` | 🎨 | 3 min | 6 |
| 3 | The Edit Menu | `the-edit-menu` | ✏️ | 4 min | 10 |
| 4 | Adding Google Reviews | `google-reviews` | ⭐ | 2 min | 4 |
| 5 | Publishing Your Site | `publishing` | 🌐 | 3 min | 5 |
| 6 | Managing Your Sites | `managing-sites` | 📁 | 2 min | 4 |
| 7 | Bookings | `bookings` | 📅 | 3 min | 6 |

**Article 7 (Bookings)** is conditionally hidden when `profile.scheduler_enabled !== true`.

**Writing style** — second person, imperative tense, 1–2 sentences per step. Bold for UI labels (**Generate Site**), italic for field names (*Business name*), inline code for URLs/keys. Two callout types: `tip` (green bar) and `heads-up` (yellow bar).

## Data Model

Single source of truth: `src/components/help/articles.js`.

```js
export const ARTICLES = [
  {
    slug: 'the-edit-menu',
    title: 'The Edit Menu',
    description: 'Edit text, images, colors, and fonts on your site.',
    icon: '✏️',
    readTime: '4 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open the edit panel',
        body: 'Click the **pencil icon** in the top toolbar to open the editor.',
        screenshot: '/help/edit-menu-01.png',
        annotations: [{ x: 0.82, y: 0.06, label: 'Click here' }],
        callout: { type: 'tip', text: 'Changes save automatically.' }
      },
      // ...
    ]
  },
  // ...
];
```

**Fields:**
- `slug` — unique, kebab-case, used in deep links and React keys
- `title`, `description`, `icon`, `readTime` — displayed in list view
- `schedulerOnly` — boolean gate against `profile.scheduler_enabled`
- `steps[]` — rendered sequentially in article view
  - `heading` — step title
  - `body` — string with minimal inline formatting: `**bold**`, `*italic*`, `` `code` ``, `\n\n` for paragraph breaks
  - `screenshot` — path to a PNG in `public/help/` (optional)
  - `annotations` — optional array of `{x, y, label}` normalized coords (0–1) rendered as red circles + labels overlaid on the screenshot
  - `callout` — optional `{type: 'tip' | 'heads-up', text}`

**Formatting parser** — ~20 lines in a `formatInline.js` utility. No external markdown dependency. Only supports `**bold**`, `*italic*`, `` `code` `` (escapes HTML, returns React nodes).

## Components

Five new files under `src/components/help/`:

### `HelpChrome.jsx`
- Top-level wrapper — owns `open` state, mounts `<HelpButton>` and `<HelpDrawer>` via `createPortal(..., document.body)`
- Handles deep-link on mount (reads `?help=<slug>` from URL once)
- Props: `profile`

### `HelpButton.jsx`
- Floating 48px circle button, bottom-right fixed position
- Props: `open`, `onToggle`

### `HelpDrawer.jsx`
- Drawer shell, list/article view state, search state, Esc/backdrop/X close
- Consumes `ARTICLES` from `articles.js`
- Focus trap while open; focus returns to button on close
- Props: `open`, `onClose`, `profile`, `initialSlug`
- Sub-components (inline): `ArticleList`, `ArticleView`, `Callout`, `Annotation`

### `articles.js`
- Exports `ARTICLES` array (see Data Model section)

### `formatInline.js`
- Exports `formatInline(str)` → React nodes. Supports `**bold**`, `*italic*`, `` `code` ``, `\n\n` paragraph breaks. Escapes HTML.

## App.jsx Integration

App.jsx has multiple early-return branches (bookings-page, booking-settings, admin, dashboard, wizard step 5, step 5.5, step 6, and the default WizardShell return). Rather than restructuring view logic, we mount the help system via a single `<HelpChrome />` component that:

1. Owns its own open/close state internally (no state needed in App.jsx)
2. Renders both the button and drawer
3. Uses a React portal (`createPortal(..., document.body)`) so positioning is consistent regardless of parent layout
4. Reads `profile` via prop for `schedulerOnly` gating

**Mount points** — one line added at the bottom of each non-auth return branch:

```jsx
// In each view branch:
return <>
  <BookingsPage ... />
  <HelpChrome profile={profile} />
</>;
```

Six additions total. The login and reset-password branches intentionally do not mount `<HelpChrome />` — help is signed-in-only for v1.

**File changes:** `src/App.jsx` only. ~8 lines added, 0 removed.

## Screenshot Capture Plan

**Target environment:** Production — `https://sitebuilder.autocaregenius.com/`
**Tool:** Chrome MCP (`navigate`, `computer` for mouse/keyboard + screenshots, `find` for element targeting)
**Account:** New account created during session, email `dev+tutorial-<timestamp>@639hz.com` (alias of `dev@639hz.com`)

### Capture sequence (~25–30 screenshots, target)

| Article | Shots needed |
|--------|-----|
| Getting Started | 3 (hero/overview composites) |
| Business Type & Template | 4 (type picker, info form, template grid, color picker) |
| The Edit Menu | 10 (pencil icon, inline text edit, image replace modal, color picker panel, font panel, section add/remove, undo, auto-save indicator, mobile edit, before/after) |
| Google Reviews | 2 (widget key input, live preview) |
| Publishing | 3 (publish button, published URL, republish) |
| Managing Sites | 2 (dashboard grid, per-site menu) |
| Bookings | 4 (settings, calendar, incoming booking, manage list) — *only if scheduler_enabled can be flipped on the test account* |

**Resolution:** 1440×900 desktop default; 390×844 for any mobile-specific shots.
**Format:** PNG, saved to `public/help/`, named `<article-slug>-NN.png`.

### Flow
1. Navigate to the live site while signed out; capture landing and sign-up form shots first
2. Create the account (email confirm → **pause for user to confirm mailbox**)
3. Run through the wizard using the existing **Fill Demo** data (`DEMO_BUSINESS_INFO` + `DEMO_GENERATED_COPY`)
4. Generate AI content → preview → capture edit menu interactions
5. Publish → capture publish flow
6. Navigate to dashboard → capture
7. If admin can flip `scheduler_enabled` on the test account: capture bookings. Otherwise mark bookings shots as TODO.
8. Delete the test site from the dashboard before finishing
9. Keep the test account signed up so we can update screenshots later without re-registering

**Annotations** are rendered as CSS overlays in the `ArticleView` sub-component of `HelpDrawer`, not baked into the PNGs — so we can tweak labels without re-shooting.

### Blockers & pauses
- **Email confirmation** — I will pause and ask you to confirm the verification email before continuing
- **Scheduler feature flag** — if I can't flip it myself, I'll ask you to enable it on the test account before the bookings shots
- **Auto-save / timing** — screenshots of AI generation may need a 2–3 second wait to capture the loading state; otherwise capture is immediate

## Style

All new UI pulls from existing conventions in the codebase (no design tokens file exists yet — we follow the inline patterns already in use):

- Background: `#faf9f7` (warm off-white) for drawer, `#ffffff` for article cards
- Accent: `#cc0000` for button, headings, active states
- Body text: `#1a1a1a`
- Muted text: `#6b6b6b`
- Border: `#e5e4e0` (1px)
- Font: Outfit (already loaded globally)
- Card radius: `12px` (matches DashboardPage card style)
- Button radius: `9999px` (full pill for the floating help button)
- Shadow: `0 4px 12px rgba(0,0,0,0.08)` for cards, `0 4px 12px rgba(0,0,0,0.15)` for the floating button
- Transitions: 200ms ease for drawer slide, 150ms for hover states

## Testing

- Manual: click through every article on desktop + mobile, verify search filters, verify schedulerOnly gating hides Bookings for a non-scheduler account, verify Esc + backdrop + X all close the drawer
- Keyboard: Tab through the drawer, verify focus trap while open, verify focus returns to the help button on close
- Deep link: open `/?help=the-edit-menu` and verify the drawer opens to that article directly
- No unit tests for v1 (content + presentation only; no logic beyond the inline formatter, which we can smoke-test via the UI)

## Implementation Sequence

1. Scaffold components with placeholder text + empty screenshot slots; mount in App.jsx
2. Verify drawer open/close, list/article navigation, search, mobile layout, Esc/backdrop close
3. Drive the live site via Chrome MCP; capture all screenshots to `public/help/`
4. Fill real article content, wire screenshots and annotations
5. Verify all articles on desktop + mobile; test schedulerOnly gate
6. Delete test site, commit, push, open PR

## Open Questions / Risks

- **Email verification loop** — if the confirmation email doesn't arrive, capture is blocked. Mitigation: use `dev+tutorial-<timestamp>@639hz.com` alias so it lands in your existing inbox.
- **Scheduler feature flag access** — if we can't flip it on the test account, Bookings article ships with no screenshots (content only) until we can grab them.
- **Live-site UI drift** — if the production UI changes between capture and ship, screenshots go stale. Mitigation: we're capturing against the same branch's deploy, so drift should be zero for the initial ship.
