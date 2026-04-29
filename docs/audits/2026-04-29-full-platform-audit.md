# Genius Websites — Full Platform Audit
**Date:** 2026-04-29
**Branch:** `claude/serene-borg-576666`
**Scope:** Security · UX/UI · Accessibility · Performance & Code Quality · Product Strategy
**Lens:** "Google / Stripe / a16z about to acquire"

---

## 0. Executive Summary

Genius Websites is a **vertically-tuned SaaS for auto businesses** (detailing, mechanic, tint, wheel, mobile, car wash) that combines AI website generation, a booking scheduler, a customer CRM, and Stripe-powered payments under a single $9.99/mo Pro tier. The codebase (React 19 + Vite + Netlify Functions + Supabase + Cloudflare R2 + Postmark) is unusually clean for a solo-founder SaaS at this stage — the three hardest plumbing problems are already solved (Anthropic generation pipeline, Stripe Connect with three payment rails, identity-keyed CRM aggregation).

**Overall grade by dimension:**

| Dimension | Grade | Headline |
|---|---|---|
| Security | **C+** | Two critical CVE-class issues (`publish-site.js`, `unpublish-site.js` unauthenticated). Otherwise solid Stripe/Shopify/JWT hygiene. |
| UX / UI | **B-** | Strong brand identity, weak design-system discipline (1,593 hex literals across 81 files; tokens defined but unused). |
| Accessibility | **D (App), F (Published Sites)** | High litigation risk under ADA Title III + EU Accessibility Act. No alt-text input anywhere; no focus traps. |
| Performance & Code Quality | **B-** | Clean separation of concerns, no client-side query caching, 20-font preload bloat, no observability. |
| Product / Strategy | **B+** | Solid wedge in auto vertical. Will lose mechanic shops to Shopmonkey within 90 days without DVI/estimates. |

**Investment thesis (one sentence):** With ~6 engineer-weeks of cleanup and a clear 12-month roadmap, this can credibly 5–10× ARPU (from ~$7 → $35–60+) without rewriting the architecture. The single highest-EV bet on the table is an AI Voice Receptionist (no competitor will ship one in 2026); the single highest-risk gap is the unauthenticated `publish-site.js` endpoint.

---

## 1. Cross-Cutting Findings (Where Multiple Audits Agreed)

These are the highest-priority items because they showed up in two or more audits independently:

### CC-1. **`publish-site.js` and `unpublish-site.js` are unauthenticated** *(Security CRITICAL)*
Anyone with a slug (which is public — it's in every `published_url`) can overwrite or delete any customer's published HTML. This is the single most exploitable issue in the codebase. **Fix: ~30 min each.** Add `requireSiteOwner(event, siteId)`, validate slug shape `/^[a-z0-9-]{1,63}$/`.
*See [§2 Security C1, C2](#2-security-audit).*

### CC-2. **Design tokens defined but never used** *(UX/UI + a11y)*
`src/design-tokens.js` is a textbook good token file. Yet:
- **1,593 hex literals across 81 files** including `bg-[#cc0000]` instead of `bg-brand-red`
- **0 uses** of `bg-brand-red` / `text-ink-secondary` / `rounded-token-md`
- Tertiary `#888` ink fails WCAG AA contrast (3.54:1) — the most prevalent text color violation in the app
- Hover/focus rings inconsistent or missing across files

A single Tailwind config extension + codemod fixes 80% of this. **Effort: M (~3-4 days). Impact: massive.**

### CC-3. **No focus traps + no live regions + no `prefers-reduced-motion`** *(a11y)*
9 ad-hoc modal scaffolds (UX audit), all without focus traps, focus restoration, or `inert` background (a11y audit). One `<Dialog>` primitive resolves the modal-proliferation issue AND the focus-trap issue AND the toast `aria-live` issue in one go. **Effort: M.**

### CC-4. **Webhook handlers not idempotent against replays** *(Security + Performance)*
- `booking-deposit-handler.js:13-18` writes `deposit_status: 'paid'` unconditionally
- `stripe-charge-handler.js:11-16` overwrites `amount_cents` from session
- `handleAccountUpdated` blindly overwrites every field every call
- No `processed_stripe_events` table; replays can double-charge

**Fix:** Add `.eq('deposit_status','pending')` guard + add a `processed_stripe_events` event-id table. **30 min for the guard, 1 hour for the dedup table.**

### CC-5. **Rate limits live in process memory** *(Security + Performance)*
`create-booking.js:18-28`, `support-book.js:28-37` use module-scope `Map`. Netlify spins up multiple concurrent instances; the limit is `5 × N_warm_containers` per IP. Cost-blowup vector via Zoom seats + Postmark sends.
**Fix:** Move to Postgres or Upstash/Redis.

### CC-6. **Cost-exfiltration on unauth'd AI/Places endpoints** *(Security HIGH)*
- `generate-website.js` — anyone can invoke; free Claude API proxy
- `places-search.js` — anyone can invoke; ~$17/1000 Google Places lookups
**Fix:** Auth header + per-user daily caps. ~15 min each.

### CC-7. **No observability** *(Performance + Strategic)*
Zero Sentry/PostHog/Datadog. Stripe webhook failures, AI generation failures, SSL provisioning bugs are invisible until a user complains. Without this, every other improvement is shipped blind.

### CC-8. **No SMS anywhere** *(UX + Strategic)*
Booking confirmations, reminders, review requests, charge links — all email-only. SMS is table stakes for service businesses in 2026 and is the single highest-ROI feature missing. Twilio integration unlocks ~5 new product lines.

---

## 2. Security Audit

**Auditor lens:** Google security team doing pre-acquisition due diligence.

### CRITICAL (exploitable now)

#### C1. `publish-site.js` is unauthenticated — anyone can overwrite any site
`netlify/functions/publish-site.js:15-65`. Accepts `{ siteId, htmlContent, slug }` from body, no JWT, no ownership check. Uploads `htmlContent` to R2 at `${slug}/index.html`.
**Attack:** `curl -X POST .../publish-site -d '{"siteId":"<any>","htmlContent":"<malicious>","slug":"victim-slug"}'`. Phishing/payment-skimming on `victim-slug.autocaregeniushub.com` or the victim's connected custom domain.
**Fix:** Add `requireSiteOwner(event, siteId)`; validate slug shape.

#### C2. `unpublish-site.js` is also unauthenticated
`netlify/functions/unpublish-site.js:18-35`. Reads slug + siteId, deletes R2 object, removes Netlify domain aliases. Knock any competitor offline by guessing slug.
**Fix:** Same pattern as C1.

#### C3. `domain-sweep.js` cron is publicly invokable
`netlify.toml:12-13` registers it as a cron, but `domain-sweep.js:7-81` has no auth gate. External callers can trigger sweep on demand → email storms + Netlify quota burn.
**Fix:** Check `event.headers['x-netlify-event'] === 'schedule'` or HMAC.

#### C4. `admin-backfill-subscription-period.js` exists in production
The file's own comment says "this function can be deleted" once backfill is complete. Unbounded enumeration + write amplifier.
**Fix:** Delete the file.

#### C5. `service_role` key used unnecessarily in `serve-custom-domain.js`
Edge function `serve-custom-domain.js:40-52` uses service-role for a public lookup. Defense-in-depth concern — service role bypasses RLS.
**Fix:** Replace with anon key + RLS policy allowing public `select(slug)` where `custom_domain = ?`.

### HIGH

#### H1. Impersonation has no audit table — only `console.log`
`admin-impersonate.js:99-102`. Netlify logs aren't an audit log. Fails SOC2 / Google due diligence on privileged-access logging. No `reason` field captured.
**Fix:** `admin_impersonations` table (admin_id, target_id, reason, ip, ts); insert before generating the magic link.

#### H2. Rate limits are in-memory `Map`s — bypassable by parallel requests
`create-booking.js:18-28`, `support-book.js:28-37`. Combined with Zoom meeting creation + Postmark sends, this is a direct cost-blowup vector.
**Fix:** Postgres `request_log` or Upstash.

#### H3. `places-search.js` unauthenticated — proxies paid Google API
**Fix:** Require JWT, add IP daily caps.

#### H4. `generate-website.js` unauthenticated — free Claude API proxy
Per-user quotas missing. Attacker can stuff instructions in `services` field.
**Fix:** Auth + per-user caps.

#### H5. `stripe-portal-url.js` doesn't cross-check subscription metadata
Defense-in-depth: a flipped `stripe_customer_id` lets a user manage another's subscription.
**Fix:** Verify subscription metadata.supabase_user_id matches caller.

#### H6. Wide-open CORS (`*`) on authenticated endpoints
Every Netlify function uses `Access-Control-Allow-Origin: *`. Removes a defense layer.
**Fix:** Restrict to known origins; echo only when in allowlist.

#### H7. Booking webhook trusts `amount_total` without comparing required deposit
`_lib/booking-deposit-handler.js:13-17`. Stale checkout URL with smaller amount could mark booking paid in full.
**Fix:** Compare `session.amount_total >= booking.deposit_required_cents`.

#### H8. `serve-custom-domain.js` slug not validated for shape
Edge function constructs `https://${slug}.autocaregeniushub.com${url.pathname}${url.search}` — combined with C1 (anyone can write any slug) this could break out of host.
**Fix:** Validate `/^[a-z0-9-]{1,63}$/`. Strip CRLF.

#### H9. Domain conflict check is TOCTOU
Two simultaneous calls can both pass the conflict check before either writes.
**Fix:** `UNIQUE(custom_domain) NULLS NOT DISTINCT` or advisory lock.

### MEDIUM

- **M1.** RLS state of `support_bookings` table not verified (no migration in `db/migrations/`).
- **M2.** Custom-domain slug lookup not cached at edge — every request hits Supabase.
- **M3.** Weak email regex; allows header-injection-flavored payloads.
- **M4.** State JWT signing doesn't validate `aud`/`iss`.
- **M5.** PII in logs (emails, names, phones) — GDPR/CCPA hygiene.
- **M6.** No security headers in `netlify.toml` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- **M7.** Stripe API version pinned to two different values (`2025-01-27.acacia` vs `2024-04-10`).
- **M8.** Webhook replay protection missing — no `processed_stripe_events` table.

### LOW / Hardening

- **L1.** `.env.example` mismatches code: `POSTMARK_SERVER_TOKEN` vs `POSTMARK_API_KEY`.
- **L2.** `test-postmark.js` exposes config to anyone.
- **L3.** `setup-shopify-webhooks.js` doesn't use `timingSafeEqual` for shared secret.
- **L4.** `update-booking.js` doesn't UUID-validate booking IDs.
- **L5.** `connect-domain.js` doesn't block platform-owned suffixes (`autocaregenius.com`, `netlify.app`).
- **L6.** Supabase client uses `flowType: 'implicit'` — PKCE is now recommended.
- **L7.** `AuthContext.jsx` logs auth events with emails to browser console.
- **L8.** `tg_set_updated_at` is `SECURITY DEFINER` without `SET search_path = ''`.
- **L9.** `stripe@22.x` declared in frontend `package.json` (bundler doesn't ship it but it's misleading).
- **L10.** Honeypot field name `website` clashes with legitimate business-info field.

### Positive observations

- Stripe webhook signature verification is correct (raw body, dual-secret support, replay tolerance).
- Shopify HMAC uses `timingSafeEqual` correctly.
- JWT verification is real — `supabaseAdmin.auth.getUser(token)` against the auth server, not local-only decode.
- Connect-account ownership enforced before charging (`create-charge.js:36-38`).
- HTML escaping in email templates — proper `esc()` helper used consistently.
- No `dangerouslySetInnerHTML` on user content (only in widget remount, no user input).
- No service-role key references from `src/`.
- RLS enabled on core tables with sensible policies; `sites` insert policy enforces 1-site cap.
- Booking honeypot + UUID validation + strict whitelists.
- State JWT signing has secret-length guard + tamper/expiry tests.
- `requireSiteOwner` consistently applied across domain functions.

### Top 5 fix order

1. Authenticate `publish-site.js` + `unpublish-site.js` (C1, C2). **30 min each.**
2. Authenticate `places-search.js` + `generate-website.js` (H3, H4). **15 min each.**
3. Move rate limits to Postgres (H2). **2 hours.**
4. Audit table for impersonation + delete `admin-backfill-subscription-period.js` (H1, C4). **1 hour.**
5. CSP/HSTS/security headers in `netlify.toml` (M6). **30 min.**

---

## 3. UX / UI Audit

**Auditor lens:** Linear / Stripe design team evaluating for acquisition.

### Top 5 wins (don't lose these)

1. **Brand identity is locked in.** `design-tokens.js` defines a tight palette (red `#cc0000` on near-black `#1a1a1a`, cream surface `#faf9f7`, Outfit, sharp corners) consistently applied across `LandingPage.jsx`, `WizardShell.jsx`, `AppHeader.jsx`.
2. **The wizard is mercifully short.** 5 steps, sticky `ProgressBar`, localStorage drafts keyed by user email so refresh doesn't lose data.
3. **Live thumbnail of published site on the dashboard.** Sandboxed iframe at `transform: scale(0.219)` with honest empty-state SVG.
4. **`AppHeader.jsx` is the canonical authenticated shell.** Sticky, sane mobile drawer, avatar dropdown, admin-conditional nav. All 7+ pages render it consistently.
5. **`StepGenerating.jsx` has personality.** Rotates 7 status messages, retries up to 3× with explicit "Retrying… (2 of 3)" copy, animated active stage.

### Critical UX issues (causing user drop-off)

1. **No router. View state is a string in `App.jsx`.** 12+ views switched on `view` state + path-checks for `/booking-confirmed`. Browser back doesn't work, deep links break, share links don't exist, no per-route code splitting.
2. **`ContentEditor.jsx` is hostile to the design system.** 21 hex codes, 55 `bg-[#…]`, 99 `text-[#…]` arbitrary values, 15 `focus:outline-none` instances. The most-used surface in the product looks like a developer tool.
3. **Five different spinners, all hand-rolled** — including a rogue `border-t-blue-500` in `WebsitePreview.jsx:89`.
4. **`SubscribeGate.jsx` shows page underneath at 90% opacity + 2px blur.** Reads as "broken" to users unfamiliar with paywall patterns.
5. **Wizard step count is inconsistent.** `WizardShell.jsx:5` declares 6 steps, `StepBusinessType.jsx:8` says "Step 1 of 5".
6. **Mobile editing not supported.** `ContentEditor.jsx` has 0 `sm:`/`md:` breakpoints; hard-codes 320px sidebar that swallows the canvas on phones.
7. **Sign Out racy on mobile.** `AppHeader.jsx:79` 200ms blur timeout races with click.
8. **"Free plan" pill on dashboard** looks passive but is a CTA.

### High-impact polish

- Status colors implemented twice (Tailwind palette vs design tokens).
- Tab pattern reimplemented 3× (`BookingsPage`, `AdminPage`, `SchedulerSettings`).
- `Field` component implemented 3× (different label styling each time).
- `PreviewToolbar.jsx` is gray-on-gray — visual seam where brand falls off.
- Empty states are bare text in gray boxes.
- Loading state is universally `<p>Loading...</p>` — no skeleton UI anywhere.
- `EditorTour.jsx:6-9` redeclares brand constants locally.
- `AlertProvider.jsx` toast styles use Tailwind palette while confirm modal uses tokens — same file, two color systems.

### Design system debt (quantified)

- **1,593 hex literals across 81 files**; 0 uses of token-driven Tailwind classes (`bg-brand-red`, `text-ink`, etc.).
- **47 files with `bg-[#...]`, 44 with `text-[#...]`, 31 with `border-[#...]`** — bespoke arbitrary values.
- **332 Tailwind color-scale uses** competing with the hex tokens.
- **465 `rounded-{sm|md|lg|xl|2xl|3xl}` uses across 53 files** with no apparent system.
- **419 font-weight uses** mixing `font-[900]`, `font-black`, `font-extrabold`, `font-bold`.
- **Inter font sneaks into exported HTML** (`exportHtml.js:116, 158`) while in-app uses Outfit. Published sites and previews look subtly different.
- **9 separate modal scaffolds** (~1500 LOC of duplicate chrome). One `<Modal>` primitive sheds >500 LOC.

### Suggested redesigns

1. Lift the editor out of the gray Tailwind ghetto; align to brand tokens.
2. Build an empty-state primitive (icon + title + description + CTA) and apply everywhere.
3. Kill the see-through paywall overlay; replace with a definitive paywall page that demos the feature.
4. Consolidate routing — React Router for top-level views; URL deep-linking + browser back + per-route code splitting.
5. Real loading skeletons (SkeletonRow, SkeletonCard, SkeletonText) covering ~80% of cases.
6. Generation-step transparency — stream real progress events instead of rotating timer-based copy.
7. Promote tokens to first-class Tailwind classes, codemod hex → tokens, lint `bg-[#...]` as an error.
8. `<Modal>` primitive with header/body/footer slots.
9. Wire help articles to context (current page → suggested article auto-pinned).
10. Replace `EditorTour.jsx` with a graduated activation checklist on the dashboard ("Day 0 / Day 1 / Day 7" — what Stripe and Notion do).

---

## 4. Accessibility Audit (WCAG 2.2 AA)

**Auditor lens:** US enterprise customer with strict ADA / Section 508 requirements; EU Accessibility Act 2025.

### Compliance summary

- **App surface (dashboard / wizard / admin):** **PARTIAL.** Some dialog roles, image alts on logos, error messages announced. But pervasive `focus:outline-none` without rings, no focus traps, no focus restoration, click handlers on `<div>`s, no live regions, `text-[#888]` (3.54:1) failing AA across 100+ instances.
- **Published-sites surface:** **FAIL.** Every site this app generates has unlabeled hero/gallery/About images, no alt-text input anywhere, no skip-link, embedded `scheduler.js` with zero `<label>` associations, no focus management.
- **Estimated regulatory / lawsuit risk: HIGH.** Under ADA Title III (Robles v. Domino's, 2019) and the EU Accessibility Act (in force June 2025), the platform — not the SMB owner — is the obligor for template accessibility.

### Critical violations

#### C1. No focus traps in modals / drawers (WCAG 2.4.3, 4.1.2)
9 dialogs, all without focus trap, focus restoration, or `inert` background: `HelpDrawer`, `BookingDetailDrawer`, `AdminUserDrawer`, `AddCustomerModal`, `BookCustomerModal`, `EmailComposerModal`, `ChargeModal`, `EditBusinessInfoModal`, `ScheduleZoomModal`, `UpgradeProDialog`. ChargeModal handles money — losing focus mid-payment is disorienting.
**Fix:** One `<Dialog>` primitive that handles all of this.

#### C2. No alt-text input for user-uploaded images (WCAG 1.1.1)
`ContentEditor.jsx:150-187` `ImageSlot`/`GallerySlots` take a file → data URL. No alt-text input anywhere. Templates render hard-coded strings: `alt="About us"`, `alt=""` for hero, all gallery images `alt=""`. Every published site has unlabeled imagery.
This is the **#1 demand-letter target** in ADA litigation.
**Fix:** Add alt-text input next to every ImageSlot; persist as `images.heroAlt` etc.; update templates to read it.

#### C3. `focus:outline-none` widely applied with no replacement (WCAG 2.4.7)
**73 occurrences across 32 files**. Particularly bad in `BookingDetailDrawer.jsx:135, 144`, `ContentEditor.jsx` (15 instances), `ScheduleZoomModal.jsx:378-400` (no replacement at all).
**Fix:** Adopt `focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#cc0000]` globally.

#### C4. Heading hierarchy broken on dashboard (WCAG 1.3.1, 2.4.6)
No `<h1>` on `DashboardPage.jsx`. "Welcome to Pro" banner is `<h3>`; "Your Site" is `<h2>`. `BookingDetailDrawer.jsx` uses h2 → h3 → h2 again. `HelpDrawer.jsx` has multiple `<h1>`s.
**Fix:** Add visually-hidden `<h1>` per page; audit drawer outlines.

### Serious violations

- **S1.** Click handlers on non-button `<div>`s (10+ instances).
- **S2.** No live region for toasts; `AlertProvider.jsx:61-67` container is plain `<div>` (individual toasts have `role="alert"`/`status` but multiple-toast announcement is unreliable).
- **S3.** `BookingsCalendar.jsx` has no roving tabindex / arrow-key navigation — 35+ tab stops to reach the next month.
- **S4.** **Color-contrast failures (the most prevalent issue):**
  - `text-[#888]` on white = 3.54:1 → **FAILS AA** for normal text. **Used 100+ times.**
  - `text-[#aaa]` placeholders ≈ 2.6:1 → fails everywhere it appears.
  - `rgba(255,255,255,0.85)` on red CTA bands ≈ 4.0:1 → fails.
- **S5.** Forms lack `aria-describedby` linkage to error messages.
- **S6.** Embedded `scheduler.js` form on every published site has no proper `<label for>`/`<input id>` pairs.
- **S7.** Color is sole indicator for booking status in calendar cells.

### Moderate violations

- **M1.** Custom toggle pills lack `aria-pressed`.
- **M2.** Page titles never change with SPA navigation.
- **M3.** Wizard step transitions don't move focus or announce.
- **M4.** Help Drawer has multiple `<h1>`s (should be `<h2>`).
- **M5.** Backdrops don't have `aria-hidden="true"`.
- **M6.** **`prefers-reduced-motion` is never respected** — 0 occurrences across `src/`. Yet 266 uses of animation utilities.
- **M7.** Avatars `alt=""` even when conveying identity.
- **M8.** Decorative SVGs inconsistent with `aria-hidden`.
- **M9.** No skip-to-main-content link anywhere.
- **M10.** Some `<select>` options show UUIDs when business name is missing.

### Top 5 quick wins

1. **Global focus-visible utility, ban naked `focus:outline-none`.** Resolves C3 fully. Single CSS layer change.
2. **Promote `#888` → `#666` (5.74:1)** in `design-tokens.js`. Find/replace `text-[#888]` → `text-ink-tertiary`. Resolves 80% of contrast failures.
3. **Add alt-text input to image upload UI.** Resolves the #1 demand-letter target. ~3 hours.
4. **Wrap toast container in `aria-live="polite"` + add `prefers-reduced-motion` reset.** 2 tiny edits.
5. **Build a `<Dialog>` primitive with focus trap + restore.** Resolves C1 + 9 modal duplications in one shot.

---

## 5. Performance & Code Quality Audit

**Auditor lens:** Senior staff engineer at Stripe / Linear / Vercel.

**Code health grade: B-**

### Performance issues (high impact)

1. **20 Google Fonts loaded synchronously** in `index.html:11`. Templates inject their own fonts at runtime. ~600–900KB of waste; ~500ms LCP penalty on 4G mobile. **Fix: ship only Outfit globally; let templates lazy-load.**
2. **No code-splitting strategy** in `vite.config.js`. Marketing-page visitors download the entire admin/CRM/Stripe Connect bundle.
3. **`listBookingsForOwner({ userId })` called everywhere** to fetch ALL bookings, then filtered client-side. At 5k bookings per owner this is 1–3MB JSON per page view. Files: `CustomerDetailPage.jsx:97`, `ChargeModal.jsx:63`, `BookingsView.jsx:19`, `CustomersPage.jsx:82`.
4. **`AuthContext.jsx` logs on every render** — 6 `console.*` calls in the hot path.
5. **`adminUsers.js:11-42` `listAllUsers()` fetches everything**, joins client-side, no pagination.
6. **`domain-sweep.js` is sequential `for` loop with 8s timeouts.** At 100 pending domains = 1600s — way past Netlify's 26s scheduled-function timeout. Function silently drops work.
7. **`App.jsx:104-124` widget-key `useEffect`** uses an eslint-disable to paper over a stale-closure issue.
8. **Charges + bookings each separate fetch** — many drawers/modals chain queries serially when `Promise.all` would do.

### Architecture & code-quality

- **10 files over 500 lines.** `ContentEditor.jsx` is **1,241 lines** (emoji picker + icon picker + form fields + image cropping + color picker all in one).
- **Checked-in code generator:** `templates/detailing/_g.cjs` (161-line CJS in an ESM project — dead code).
- **Duplicate `domainUtils.js`** in `src/lib/` AND `netlify/functions/_shared/` — identical bodies.
- **`App.jsx` ~740 lines** of view-state machine with no router.
- **In-process rate limit `Map`** — ineffective in serverless.
- **localStorage draft persistence on every keystroke** — fine until images go in there.
- **`key={index}` JSX patterns** in 33 files — risky in reorderable lists.
- **Zero TypeScript** — money math (`deposit-math.js`, `parsePriceToCents`) is in JS. A `Cents` opaque type catches whole bug classes. `_lib` first, ~80/20.
- **Booking deposit handler — race condition on `deposit_status`.** No state-machine guard against `payment_intent.succeeded` arriving after a `canceled`.
- **`domain-sweep.js:64`** calls `auth.admin.getUserById` per affected site inside the loop.
- **`generate-website.js:103-124`** makes inline blocking call to a 3rd-party widget service during AI generation — slows generation.
- **ESLint declared but not configured** — no `eslint.config.js`. The 10 `eslint-disable` comments disable nothing.
- **Stripe API version mismatch** — `'2025-01-27.acacia'` in main lib, `'2024-04-10'` in admin-backfill.
- **No CI / pre-commit hooks** — `.husky/` and `.github/workflows/` absent.

### Test coverage

12 test files, ~112 assertions. Source files: ~150. **Ratio ~8%.**

**Well-covered:** Stripe event handlers, status mapping, Connect onboarding, deposit math, slot math, booking validation + state machine, subscription gating, scheduler config, Shopify HMAC, domain status machine.

**Critical paths with NO tests:**
- `create-booking.js` end-to-end (most-exposed public endpoint)
- `create-charge.js` (handles money)
- `update-booking.js` (auth + state transitions)
- `domain-sweep.js` (the cron emailing customers when SSL provisions)
- `generate-website.js` (AI call + JSON-parse fallback)
- `stripe-webhook.js` dual-secret signature verification
- `AuthContext` recovery flow
- Every React component (zero component tests)
- Idempotency: webhook replays
- Race: two simultaneous `create-booking` grabbing the same slot. There's a `validSlots.includes(when.toISOString())` check in `create-booking.js:129` but it's TOCTOU. **Need a unique constraint or advisory lock.**

### Quick wins

1. Strip the 20-font preload (~30 min, ~600KB saved).
2. Add `eslint.config.js`; wire into CI (1 hour).
3. Delete `_g.cjs`; dedupe `domainUtils.js` (15 min).
4. State-machine-guard webhook handlers — `.eq('deposit_status','pending')` guards (30 min).
5. Wrap `console.log` in `AuthContext` with `if (import.meta.env.DEV)` (15 min).

### Strategic refactors (6-month horizon)

- **Month 1: observability.** Sentry frontend + functions; structured JSON logging with request IDs.
- **Month 2: query layer.** React Query / SWR; centralize Supabase calls; add server-side filters (`listBookingsForCustomer`, `listBookingsForSite`).
- **Month 3: TypeScript on `_lib` + `_shared`.** `Cents`, status enums, Stripe types.
- **Month 4: routing.** Replace `view` state machine with React Router.
- **Month 5: domain-sweep redesign.** Webhook from Cloudflare on cert provisioning + exponential backoff fallback.
- **Month 6: split `ContentEditor.jsx`** + decompose 21 templates into shared section components (Hero/Services/About/Gallery/Testimonials/CTA). ~10,000 lines of duplicated JSX could collapse to ~3,000.

**Plus:** Postgres unique partial index on `(site_id, preferred_at) WHERE status IN ('pending','confirmed')` to make double-booking literally impossible at the DB level. Move `MAX_SITES = 1` from JS constant to `profiles.max_sites` column.

---

## 6. Strategic Product Audit & Roadmap

**Auditor lens:** McKinsey × a16z memo for an acquirer.

### 6.1 Current product map

Six verticals (detailing, mobile detailing, wheel/tire, tint/PPF, mechanic, car wash). Eight core flows shipped: AI site generation wizard, live editor, publish to Cloudflare R2 with `*.autocaregeniushub.com` subdomain or paid custom domain + SSL, booking scheduler with vehicle make/model/year/size + identity-keyed customer aggregation, customer CRM with tags/notes/CSV/email composer, payments (Pro subscription $9.99/mo + booking deposits $2 platform fee + Connect-routed customer charges), admin/CRM with full impersonation, Google Reviews + Instagram widgets.

**Today's monetization:** ~$7 ARPU. Massive headroom.

### 6.2 Competitive position

| Competitor | Strength | Genius gap |
|---|---|---|
| Squarespace / Wix | Polish, marketplace, blog/store | Genius wins on AI auto-correctness; loses on plugin ecosystem |
| Shopify | Commerce, fulfillment | Genius doesn't compete; misses memberships/gift cards |
| Shopmonkey / Tekmetric / Mitchell1 | Repair-shop ERP, DVI, parts catalogs, QBO, Carfax | **Mechanics will outgrow Genius within 90 days.** |
| Booksy / Square Appointments / Setmore | Multi-staff, Google Cal sync, marketplace, automated SMS | Genius is request-only, no SMS, no resource routing |
| GoHighLevel | Marketing automation, AI voice, white-label | Genius has no campaign engine, no SMS, no voice |
| Jobber / Housecall Pro | Field service ops, dispatch, QBO, customer portal | Genius missing dispatch, estimates, mobile, QBO |

**Genius wins:** Vertical-tuned AI, all-in-one stack at $9.99 (vs $73+ stitched), identity-key CRM aggregation, Charge-by-QR + Connect.
**Genius loses:** No SMS, no multi-location/staff/bay, no Google Cal/GBP sync, no DVI, no estimates, no marketing automation, no mobile owner app, no ongoing AI.

### 6.3 Quick wins (1–2 weeks each, high impact)

| # | Idea | Impact | Effort |
|---|---|---|---|
| QW-1 | Twilio SMS (confirm + 24h reminder + completion) | High | S |
| QW-2 | AI Edit Assistant ("Improve with AI" on every editable block) | High | S–M |
| QW-3 | Google Business Profile read-only sync | High | M |
| QW-4 | Auto SMS/email review request post-completion | High | S |
| QW-5 | LocalBusiness JSON-LD schema + SEO health panel | High | S |
| QW-6 | VIN decode (NHTSA vPIC, free) | Med-High | S |
| QW-7 | Recurring service reminders (oil change every 5k mi) | High | M |
| QW-8 | Tipping at Stripe Checkout | Med | S |
| QW-9 | Memberships product (subscriptions on Connect) | High | M |
| QW-10 | Photo before/after on bookings | Med (compounds with MS-3) | S |

### 6.4 Defensive must-builds

| # | Idea | Why |
|---|---|---|
| DB-1 | Google Calendar / iCal two-way sync | Owners live in Google Cal |
| DB-2 | Multi-staff / multi-bay scheduler | Two-bay shop overbooks today |
| DB-3 | Real availability slots (not request-only) | Can't move upmarket without it |
| DB-4 | Estimates → text-approval workflow | Mechanics literally cannot run a shop without it |
| DB-5 | QuickBooks Online sync | Every accountant lives in QBO |
| DB-6 | Multi-location | Two-shop owners forced to multi-account today |
| DB-7 | Owner mobile PWA | Owners aren't at the desktop |
| DB-8 | Refunds + dispute handling | Platform takes money but can't refund |
| DB-9 | Customer-facing booking history portal | Booksy has this |
| DB-10 | Coupons / promo codes | Drives conversion |

### 6.5 Differentiated bets (auto-vertical moats)

- **DIFF-1. Digital Vehicle Inspection (DVI).** THE feature that defines Shopmonkey/Tekmetric/AutoVitals. Customers approve more upsells after seeing photos of their own worn brake pads. **Effort: L. Impact: game-changer for mechanic + tint.**
- **DIFF-2. Vehicle profile + service history.** Promote vehicle fields to a `vehicles` FK. "2019 Tacoma — 5 services lifetime, $2,400 LTV." Foundation for DIFF-1, QW-7, MS-2.
- **DIFF-3. Drop-off / pickup workflow.** Generic schedulers think "appointment time"; auto thinks "drop off morning, pick up evening." Different UI, different reminders.
- **DIFF-4. Auto-vertical template marketplace** — designers submit, 30% rev share, vertical-tagged.
- **DIFF-5. AI photo backgrounds** — auto-enhance bay photos via Replicate Flux/SDXL inpainting. Massive visual lift for photo-poor shops.
- **DIFF-6. Parts catalog / pricing intelligence** (mechanic-only). Worldpac/NAPA/RockAuto APIs. Required for mechanic adoption.

### 6.6 AI-native moonshots

- **MS-1. AI Voice Receptionist.** Twilio Voice + ElevenLabs/Deepgram + Claude with tool use. Books appointments, quotes services. **$99/mo add-on. Cost ~$0.30/call. Margin: massive. Effort: L. Impact: generational.** No competitor will ship this in 2026.
- **MS-2. AI photo damage assessment.** "Snap a photo of the dent — quote in 15 sec." Customer-facing lead-gen magnet.
- **MS-3. Auto-generated short-form video ads.** Every completed job → TikTok/Reels. Remotion/AE-Lambda + Meta + TikTok APIs.
- **MS-4. AI replies to Google/Yelp reviews.** Owner gets one-tap suggested reply.
- **MS-5. Predictive demand modeling.** "Next Saturday: 23 expected bookings; you have 1 tech."
- **MS-6. Conversational dashboard.** "How much did I make from oil changes last month?" Claude tool-use over MCP-style tool list.
- **MS-7. AI-driven local SEO + Google Ads autopilot.** Justifies $199/mo Pro+ tier.

### 6.7 Pricing & monetization expansion

| Tier | Price | Adds |
|---|---|---|
| Free | $0 | 1 site, no booking, no CRM |
| Pro (today) | $9.99/mo | Current feature set |
| **Pro+** | **$49/mo** | + 500 SMS, recurring reminders, GBP sync, AI edit, photos, tipping |
| **Shop** | **$149/mo** | + Multi-staff/bay, estimates, DVI, vehicle profile, QBO, refunds, customer portal |
| **Voice** add-on | **+$99/mo** | AI Voice Receptionist |
| **Marketing** add-on | **+$49/mo** | Auto social posts, AI review replies, GBP autopilot |
| **Multi-Location** add-on | **+$30/mo per extra location** | DB-6 |
| **White-Label / Reseller** | **$499/mo + 30% rev share** | Marketing agencies resell |

Usage-metered: SMS overage $0.05 (cost $0.008), AI image $0.10 (cost $0.04), voice call $0.50–$1 (cost $0.25).

**ARPU math:** $7 today → $35–60 ARPU on the same install base; $150+ on Voice adopters.

### 6.8 12-month roadmap

- **Q2 2026 — Patch the holes; ship Pro+.** SMS, AI Edit, GBP sync, review request, schema, tipping, refunds. Launch $49 Pro+.
- **Q3 2026 — Become a real shop OS.** VIN, service intervals, memberships, photos, Google Cal, multi-staff, real slots, customer portal, vehicle profile, drop-off/pickup.
- **Q4 2026 — Differentiation: own the vertical.** **DVI flagship**, estimates → text approval, QBO sync, owner PWA, AI photo enhance, coupons. Launch $149 Shop.
- **Q1 2027 — AI moonshots; the moat opens.** **Voice Receptionist** ($99 add-on), AI photo damage, AI review replies, conversational dashboard preview, multi-location, template marketplace.

---

## 7. Consolidated 30 / 60 / 90 Action Plan

### Days 1–7 — Stop the bleeding (security)

- [ ] Authenticate `publish-site.js` + `unpublish-site.js` (CC-1 / Sec C1, C2). **30 min each.**
- [ ] Authenticate `places-search.js` + `generate-website.js` (CC-6 / Sec H3, H4). **15 min each.**
- [ ] Auth-gate `domain-sweep.js` cron (Sec C3). **15 min.**
- [ ] Delete `admin-backfill-subscription-period.js` (Sec C4). **5 min.**
- [ ] State-machine-guard webhook handlers (CC-4 / Perf #4 / Sec H7, M8). **30 min.**
- [ ] Validate slug shape in `serve-custom-domain.js` (Sec H8). **15 min.**
- [ ] Restrict CORS to known origins (Sec H6). **30 min.**
- [ ] Add CSP/HSTS/X-Frame-Options/Referrer-Policy in `netlify.toml` (Sec M6). **30 min.**

### Weeks 2–4 — Foundations

- [ ] **Drop Sentry into frontend + functions** (Perf strategic; CC-7). The blind-flying issue blocks every later refactor.
- [ ] Move rate limits to Postgres (CC-5 / Sec H2). **2 hours.**
- [ ] Build `<Dialog>` primitive with focus trap + restore (CC-3 / a11y C1 / UX modal proliferation). **1 day.**
- [ ] Build `<Spinner>`, `<EmptyState>`, `<Tabs>`, `<Field>`, `<Modal>` primitives in `ui/` (UX). **2–3 days.**
- [ ] Add `eslint.config.js` + GitHub Actions lint+test gate (Perf). **2 hours.**
- [ ] Add `prefers-reduced-motion` CSS reset + wrap toast container in `aria-live="polite"` (a11y M6, S2). **15 min.**
- [ ] Add an `admin_impersonations` audit table + `reason` field (Sec H1). **1 hour.**
- [ ] Add `processed_stripe_events` for replay protection (Sec M8 / CC-4). **1 hour.**
- [ ] Add Postgres `UNIQUE(custom_domain) NULLS NOT DISTINCT` (Sec H9). **30 min + migration.**
- [ ] Strip 20-font preload from `index.html` (Perf #1). **30 min, ~600KB saved.**

### Weeks 5–12 — Design system + a11y wave

- [ ] Extend `tailwind.config.js` with token-driven colors / radii / shadows (CC-2). **1 day.**
- [ ] Codemod `bg-[#cc0000]` → `bg-brand-red`, `text-[#1a1a1a]` → `text-ink`, `text-[#888]` → `text-ink-tertiary` (CC-2 / a11y S4). Shift `#888` → `#666` for AA pass. **2 days + review.**
- [ ] Lint `bg-[#...]` / `text-[#...]` arbitrary values as errors going forward.
- [ ] Add focus-visible utility globally; ban naked `focus:outline-none` (a11y C3). **1 day codemod.**
- [ ] **Add alt-text input to ImageSlot/GallerySlots; thread through every template** (a11y C2 / #1 demand-letter target). **2–3 days.**
- [ ] Add visually-hidden `<h1>` per page; audit drawer outlines (a11y C4). **1 day.**
- [ ] Add skip-to-main-content link (a11y M9). **30 min.**
- [ ] Add `useDocumentTitle` for SPA navigation (a11y M2). **2 hours.**
- [ ] Replace bespoke modal divs with new `<Dialog>` primitive across 9 sites. **1–2 days.**
- [ ] Replace `Loading...` with skeleton primitives. **1 day.**
- [ ] Refactor `SubscribeGate.jsx` into a definitive paywall page with feature demo. **1 day.**
- [ ] React Router migration for top-level views (UX 4 / Perf strategic). **3–5 days.**

### 90 days+ — Strategic moves

- [ ] **Ship QW-1 Twilio SMS** (confirm + 24h reminder + completion). Highest ROI. Unlocks QW-4 (review request) + QW-7 (service intervals).
- [ ] Ship QW-2 AI Edit Assistant. Anthropic SDK already wired.
- [ ] Ship QW-5 SEO schema markup + health panel.
- [ ] Ship QW-3 Google Business Profile sync (read-only first).
- [ ] **Launch Pro+ tier @ $49/mo.** Bundle: SMS + reminders + GBP + AI edit + tipping.
- [ ] Begin DIFF-2 vehicle profile schema work (foundation for DVI).

---

## 8. Investment Memo (One-Page)

**Asset:** Genius Websites — vertically-focused all-in-one SaaS for auto businesses. ~$7 ARPU today.

**Strengths:**
- Three hard plumbing problems already solved cleanly: AI generation pipeline, Stripe Connect with three payment rails, identity-keyed CRM.
- Vertical positioning is genuine — AI generates auto-correct copy in 30 seconds; no competitor matches.
- Brand identity is locked in and consistently applied at the top level.
- Solid test coverage on financial-math primitives (Stripe, deposit math, slot math).
- RLS, JWT verification, and webhook signature verification are correctly implemented.

**Risks (must fix pre-deal):**
- **Two CVE-class issues**: unauthenticated `publish-site.js` and `unpublish-site.js` enable trivial site-takeover and DoS. ~30 min each to fix.
- **Accessibility regulatory risk: HIGH.** Published-site templates have no alt-text input and fail WCAG. ADA Title III + EU Accessibility Act exposure.
- **Mechanic-vertical churn:** Will lose to Shopmonkey within 90 days without DVI/estimates.
- **No observability** — flying blind in production.

**Opportunity:**
- 5–10× ARPU lift within 18 months via Pro+ ($49) + Shop ($149) + Voice ($99) tiers.
- Single highest-EV bet: AI Voice Receptionist (MS-1). No competitor can ship in 2026; one engineer-quarter to build; ~70% margin at $99/mo.
- Architecture cleanly supports the entire roadmap without rewrite.

**Recommended sequencing:**
- **30 days:** security patches + observability. **Cost:** ~1 engineer-week.
- **90 days:** SMS, GBP, design-system codemod, a11y critical fixes, Pro+ launch. **Cost:** ~6 engineer-weeks.
- **6 months:** vehicle profile, DVI, estimates, owner PWA, Shop tier launch. **Cost:** ~1 engineer-quarter.
- **12 months:** Voice Receptionist, AI photo damage, multi-location, marketplace. **Cost:** ~1 engineer-quarter.

**Strategic exit:** auto-shop OS that ate Shopmonkey from underneath. Plausible 2028 acquisition target for Toast, Square, or Solera.

---

*Audit conducted 2026-04-29 by parallel specialist agents (security, UX/UI, accessibility, performance/code-quality, product strategy). All findings cite file:line evidence; full agent transcripts available in session history.*
