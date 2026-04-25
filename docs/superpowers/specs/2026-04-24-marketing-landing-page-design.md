# Marketing Landing Page — Design Spec

**Date:** 2026-04-24
**Repo:** autosite-builder (deploys to sitebuilder.autocaregenius.com)
**Status:** Approved design, ready for implementation plan

## Problem

`sitebuilder.autocaregenius.com` currently renders straight into a bare sign-in form ([LoginPage.jsx](../../../src/components/auth/LoginPage.jsx)) for unauthenticated visitors. There is no marketing surface explaining what the product does, who it's for, or why a prospect should sign up. Several new revenue-relevant features — Customer CRM, Stripe merchant onboarding, Booking deposits — have shipped on sibling branches and need a public-facing pitch.

## Goal

Add a marketing landing page as the home of the app. Unauthenticated visitors land on it first; a Get Started / Sign In CTA takes them to the existing LoginPage; signed-in users continue to the wizard/dashboard as today.

## Non-goals

- No backend work. CRM / Stripe / booking deposits live on sibling branches and are not merged as part of this task.
- No merging of sibling feature branches.
- No new design-token system. Match existing hardcoded-hex conventions; token extraction is a separate task.
- No new auth flows. LoginPage stays as-is; the only change is entry point + a back link.
- No CMS or localization. Copy lives directly in the component.

## Scope — what gets built

### Routing / entry point

- `App.jsx`: when `!session && !isRecovery`, default to rendering a new `LandingPage` instead of `LoginPage`.
- Add a local `authView` state (`'landing' | 'login'`) inside the unauthenticated branch. Landing CTAs set it to `'login'`; LoginPage gets a back button that sets it to `'landing'`.
- Email recovery flow (`isRecovery`) continues to route to `ResetPasswordPage` as today — landing is skipped.

### New component

`src/components/landing/LandingPage.jsx` — a single self-contained component rendering the whole page. Takes one prop: `onGetStarted` (fires when user clicks any sign-up/sign-in CTA). Sub-sections may be extracted into sibling files only if they meaningfully improve readability (e.g., if a feature-section block is reused three times, pull a `FeatureSection` component).

### LoginPage change

Add a small "← Back" link above the heading that calls an `onBack` prop. That prop returns the user to the landing view. No other LoginPage changes.

## Page structure (top to bottom)

1. **Nav bar** — sticky or static top bar. Logo / wordmark on left. Right side: text-link "Sign in" + primary pill-button "Get Started".
2. **Hero** — headline, subhead, primary CTA "Build my site free", secondary text link "See a demo" (optional, can defer). Cream background with a subtle red gradient accent. Small trust line below CTA ("Free forever • No credit card required").
3. **Core product strip** — 4 compact feature tiles in a single row (stacks on mobile): AI site generation · 23 industry templates · Custom domain · Google Reviews widget. Each tile: icon + 1-line label + 1-line description.
4. **Feature section — Customer CRM** — split layout (copy left, visual right on desktop; stacked on mobile). Copy covers: booking history per customer, tags + notes, CSV export, send email from inside the app. Visual: a CSS-only stylized mock of the Customers page (rounded card with rows of placeholder customer entries) — no real screenshots in v1.
5. **Feature section — Accept payments with Stripe** — split layout, visual-left / copy-right (alternating direction from section 4). Copy covers: onboard as a merchant in minutes, card-present via Tap to Pay, card-not-present, deposits, payouts direct to your bank. "Powered by Stripe" line with plain-text "Stripe" wordmark styled in the Stripe brand purple (no SVG logo needed in v1). Visual: CSS-only mock of a payment card/deposit UI.
6. **Feature section — Booking deposits** — split layout, copy-left / visual-right. Copy covers: cut no-shows by requiring a deposit at booking, set your cancellation policy, share a standalone booking link with customers. Visual: CSS-only mock of a booking modal with a deposit amount highlighted.
7. **Social proof strip** — 3 testimonial cards (name, business type, short quote). Placeholder copy for v1 — tag these clearly so they're easy to swap when real testimonials arrive.
8. **Closer CTA** — repeat the hero pitch in a compact block with a single "Get Started Free" button.
9. **Footer** — small centered row with links (Help, Contact, Terms, Privacy) and copyright. For v1, any link whose destination doesn't already exist in the app stubs to `#` with an inline `TODO` comment; before starting implementation, the implementer should ask the user which destinations are real and update accordingly.

## Visual style

Match the existing app to feel like one product:

- **Font**: Inter (already loaded in [index.html](../../../index.html)). Playfair Display is also loaded but not used here — headings stay in Inter.
- **Colors**: background `#faf9f7` (cream), primary text `#1a1a1a`, secondary text `#888`, borders `rgb(0 0 0 / 0.1)`, accent `#cc0000` with hover `#aa0000`.
- **Radius**: `rounded-xl` for buttons/inputs, `rounded-2xl` for cards (matches LoginPage conventions).
- **Spacing**: generous section padding (`py-20` desktop, `py-12` mobile). Max content width `max-w-6xl` centered.
- **Hero background**: cream base (`#faf9f7`) with a soft radial gradient from `rgba(204,0,0,0.06)` (top-right area) fading to transparent. No hard stripes or bold blocks — keep the accent subtle.
- **CTA buttons**: primary = `bg-[#1a1a1a] hover:bg-[#cc0000] text-white` (same as LoginPage submit). Secondary = text link in `#cc0000`.

## Responsive behavior

- Mobile-first. Nav collapses to logo + single "Get Started" button (no hamburger needed for v1 — sign-in is reachable from Get Started → LoginPage).
- Hero headline scales down on small screens.
- Split feature sections stack vertically on mobile; copy always appears above visual when stacked.
- Core product strip: 4-up on desktop, 2×2 on tablet, 1-up on mobile.

## Copy direction (to be finalized during implementation)

- **Hero headline** (draft): *"Free AI-built websites for auto shops — now with payments, booking & a CRM"*
- **Hero subhead** (draft): *"Detailers, tint shops, wheel shops, mechanics & mobile pros. Launch a site in minutes, take deposits, manage customers — all in one place."*
- Feature section copy is short: one bold H2, one 2-sentence lede, a 3-bullet list of capabilities.
- All references to features describe them as part of the product. Any features not yet on master get a small "New" badge rather than "Coming soon."

## Out-of-scope but flagged

- Design tokens — the codebase hardcodes hex values everywhere. Global CLAUDE.md flags this as a violation but fixing it repo-wide is not part of this task.
- Real testimonials — placeholder for v1.
- Footer link targets — some may not exist yet (Terms, Privacy). Flag to user during implementation; stub with `#` if needed.
- Analytics / tracking — not added here.
- SEO meta tags beyond the existing `<title>` and `<meta description>` in index.html — can be a follow-up if needed.

## Acceptance criteria

1. Unauthenticated visitor to `/` sees the marketing landing page, not the login form.
2. "Get Started" and "Sign In" CTAs navigate to the existing LoginPage.
3. LoginPage has a back link returning to the landing view.
4. Signed-in users bypass the landing page (no change to wizard/dashboard flow).
5. Password-recovery links still route correctly to ResetPasswordPage.
6. Page renders without console errors, is responsive down to 375px width, and visually matches the app's existing cream/black/red aesthetic.
7. All 9 sections above are present and distinguishable.
