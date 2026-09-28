# Themes, Section Editor & Dashboard - Deep Analysis (2026-09-27)

**Codebase:** Website Creator (Genius Websites / AutoCareGenius Hub).
**Audience:** the founder and developer who owns this codebase.

**Inputs:**
- 13 audit streams: theme architecture, section editor, export/publish/serve, AI generation, owner app shell, operational pages, admin, onboarding, and five template-family audits covering all 23 template files.
- A two-pass check of every finding: one pass confirmed the code, the other assessed real-world impact, with read-only queries against the live database (`ktnouhjikmlxlbxcxyif`).
- Three competing architecture proposals and a three-judge panel; a dashboard/admin redesign plan; a Claude upgrade plan.
- A critic review, followed by seven gap investigations: a read-only crawl of every published site, live per-template SQL counts, a slug-collision query, inspection of the production JavaScript bundle, and a read of the Netlify function bundler's source.

Where inputs disagreed, I read the code myself. Those resolutions are marked **lead check**. Facts established by the gap investigations are marked **(G)**.

---

## 0. How to read this report

- **5 minutes:** §1.
- **Deciding what to build:** §11 (architecture) and §14 (roadmap, including the rollout plan for existing sites in §14.2).
- **Everything that is broken:** §10, the findings register.

**Finding IDs** name the audit stream: `arch` (theme architecture), `editor`, `export` (render/publish/serve), `ai`, `shell` (owner app shell), `ops` (bookings, customers, payments, widgets), `admin`, `onboard`, `t-<family>` (template audits), and `gap-N` for new findings from the gap investigations. Every finding cites file:line.

**Severity:** **Critical** = security hole, or loss of customers' content/branding on live sites. **High** = visible breakage or legal exposure on typical live sites. **Medium** = real defect with a workaround or limited scope. **Low** = latent, legacy-only, or cosmetic.

**Template terms:** "Visible" = one of the 10 templates the picker offers. "Hidden" = one of the 11 templates marked `hidden: true`, which still render for rows that use them.

### Verification legend

| Status | Meaning |
|---|---|
| **Verified (V)** | Both passes confirmed mechanism, scope and impact as stated. |
| **Verified with corrections (VC)** | Mechanism confirmed; scope, counts, lines or severity corrected. This report uses the corrected version. |
| **Gap-checked (G)** | Established by a gap investigation with live evidence (crawl, SQL, production bundle) or bundler source. Single pass, but evidence-backed. |
| **Disputed (D)** | Verifiers, judges or the lead check disagree about scope or impact. See §10.2. |
| **Unverified (U)** | One audit pass only (5 findings). Treat as likely but unconfirmed. |

**Totals.** 155 audit findings consolidate into 66 rows; the gap investigations add 6 more, for 72 rows (69 kept in §10.1, 3 disputed in §10.2). No finding was refuted outright; about a dozen sub-claims were dropped (the "black box favicon", which is actually blank; the promo banner colliding with Help; "every dashboard visit inflates page views"; "Garage is hidden", **lead check**: visible at `src/data/templates.js:142-152`). The critic's suspicion that Stripe and custom-domain surfaces are switched off in production was checked and refuted (§7.0).

---

## 1. Executive summary

### The 10 most important things

1. **Customers can overwrite each other's live websites, and it has already happened.** The only guard is skipped when a row has no slug, RLS lets owners write any slug to their own row, there is no unique index, and the server uploads client-supplied HTML. Production has 3 slugs shared across 9 rows; `malpica-detailing` belongs to two ordinary customers, both published, so one live site has most likely replaced the other, and either owner deleting their site takes the other offline (export-1, [§5](#5-published-sites)).
2. **The dashboard's Republish button strips logos, photos, custom colors and fonts from live sites.** Help articles and the editor tell owners to press it. Today 2-3 live sites look already affected; 15 live sites show uploaded images and 6 show custom colors, so all of them are one click from damage (arch-1 + 5 duplicates, [§5](#5-published-sites)).
3. **Sites publish fake reviews and invented claims.** AI-written, named testimonials appear on 25 of 37 live website pages, labeled "Verified Customer" on 4 and "Real Reviews" on 7. 11 of those 25 owners chose Google reviews at signup, and the wizard told them "Real Google reviews will appear" (`StepBusinessInfo.jsx:707`). Templates also hard-code "5.0 Google Rating", "Open Now" and "0% for 12 months". This is exposure under the FTC rule on consumer reviews and testimonials, 16 CFR Part 465 (ai-1, ai-2, [§6](#6-claude-generation-today-and-the-upgrade-path)).
4. **Editor instructions ship to the public.** 32 of 37 live website pages show "Upload a photo in Images tab" (G, live crawl), and the editor has no Images tab. 7 of the 10 visible templates render empty award badges (arch-7).
5. **Each theme is a hand-written React file.** A theme is 5 colors, 2 fonts and a 400-770 line file; the 21 templates total about 10,350 lines, roughly half duplicated, and the editor keeps its own drifting list of each template's sections ([§3](#3-themes-deep-dive)).
6. **Much of the customization doesn't work.** WheelApex ignores every color and font; 8 of 21 font choices never load on live sites; Services edits never appear on Ironclad or Industrial; about 10 editor controls do nothing ([§3](#3-themes-deep-dive), [§4](#4-section-customization-the-editor)).
7. **What owners preview is not what visitors see.** Publishing is a static render: navs that change on scroll stay transparent, export-only CSS rearranges grids and collapses the booking calendar, split heroes never stack on phones, no template has a mobile menu, and `/book` serves the homepage on every live website (G) ([§5](#5-published-sites)).
8. **Claude is barely used, and the one call is fragile.** One `claude-sonnet-4-6` call with a 2,500-token cap and JSON parsed from free text fills 12 keys. Templates read about 33 distinct keys; about 10 content slots are never generated and fall back to generic or invented text. The SDK (0.39) predates structured outputs ([§6](#6-claude-generation-today-and-the-upgrade-path)).
9. **The dashboard ignores its own design system, and its headline metric is broken.** 6 token classes vs about 1,900 raw hex and palette classes; no shared Button, Dialog or Field; no URL routing; three different headers; secondary text at #888 fails contrast. "Website views" is effectively empty: 11 page views recorded across 48 sites in about 3.5 months, because the tracking beacon is rejected (gap-1) ([§7](#7-owner-dashboard-look-and-feel)).
10. **Nothing can push a fix to live sites, and admin has no theme tooling.** Only the owner's own browser session can publish; admin can reach a site only by impersonation, whose exit signs the customer out everywhere. 29 of 37 live pages were last published before June 2026 (G). Template visibility and tier are hard-coded, hidden templates can't be previewed, and Claude usage isn't logged ([§8](#8-admin-panel), [§14.2](#142-phase-0-rollout-getting-fixes-onto-live-sites)).

### Fix this week (all small effort)

1. **Slug authority, in this order:** (a) `publish-site.js` rejects a slug held by another row (service-role check before the upload at `:50`) and always reuses the stored slug (fixes export-4 too); (b) drop `slug` from the client insert in `BookingOnlySetup.jsx:48` and let `publish-site` store it, handling `23505` separately from `42501` (today every `42501` shows "You already have a booking page", `:53-54`); (c) decide who keeps each duplicate slug (Malpica needs both owners' input); (d) create the partial unique index; (e) only then revoke INSERT/UPDATE on `sites.slug` from `anon` and `authenticated`. Revoking first breaks "Create booking page".
2. **One render-input path.** A shared `resolveSiteRender(site)` used by editor Publish and dashboard Republish; delete the dead `handleReExport` (arch-1). Until it ships, admins publish only via Edit -> Publish.
3. **Stop fake reviews and the false promise.** Stop generating testimonials; show reviews only from Google or owner-attested entries; delete "Verified Customer", hardcoded ratings, "Open Now" and financing defaults; replace the wizard's "Real Google reviews will appear" with truthful status plus a publish-time warning when no review source is connected (ai-1, ai-2). Existing sites follow the rollout in §14.2.
4. **Editor-only placeholders** behind a new EditorContext, plus a codemod from `awards &&` to `awards?.length > 0` (arch-7).
5. **Fonts:** build the Google Fonts URL from the fonts the owner chose (arch-3).
6. **Navs:** opaque default background on TintElite and MobileChrome (t-tint-2; 7 live MobileChrome sites).
7. **Logos:** keep transparency (PNG/WebP; SVG passthrough) (editor-7).
8. **Booking times:** format with `timeZone:'UTC'` everywhere and fix `BookCustomerModal` (ops-1).
9. **Booking calendar and contact form, via the live widget scripts:** `scheduler.js` is served `max-age=0` (`netlify.toml:32-35`) and loads on 38 of 41 live pages from the production origin, so forcing the calendar grid (`style.setProperty('grid-template-columns','repeat(7,1fr)','important')`) fixes ops-2 without any republish. Give `contact-form.js`'s fallback section `order: 9998` (export-9). Keep `.tp-root` scoping in the export as the long-term fix.
10. **Stop re-adding deleted booking services** on every load (ops-6).
11. **Page-view beacon:** send a `text/plain` Blob or `fetch(..., {keepalive:true, credentials:'omit'})`, and add an iframe/no-track guard for dashboard thumbnails at the same time (gap-1, shell-4).
12. **Small fixes:** `.label` on the Sites card (shell-5); `photo_url` in the profile select (shell-9); `signOut({scope:'local'})` on impersonation exit (admin-2, a prerequisite for the rollout); demo-mode autosave guard (editor-1); delete-confirm focuses Cancel (shell-7); #888 -> #6b6b6b (shell-8); require `active_ssl` in `bookingShareUrl` (ops-12).

### Recommended direction

Stop hand-writing templates and make a theme a piece of data:

- **Brand kit -> tokens.** A small brand kit expands into design tokens guaranteed to meet contrast requirements.
- **Section list.** An ordered list of section instances from a shared library of about 16 types and 45 variants.
- **One schema per section type**, defined once, driving the renderer, the editor form, Claude's structured output and the tests.
- **Rendering:** CSS-first static HTML rendered on the server, a versioned snapshot per publish, and an editor preview that is an iframe of exactly the same HTML. The booking and contact widgets consume the same tokens.

Get there without a big-bang rewrite: ship Phase 0 and roll it out to the existing sites deliberately (§14.2); build a render test suite first; convert the 10 visible templates one per release behind a renderer flag, **starting with low-risk, high-traffic `mobile_chrome` (7 live sites, no custom overrides) rather than `wheel_apex`**; freeze the hidden templates.

Use Claude in two places, and never let runtime Claude emit code or invent facts: **at dev time**, Claude Code (with an in-repo CLAUDE.md, a `/new-theme` skill and a theme-check hook) turns mockups into section variants that must pass automated gates and human review; **at runtime**, schema-constrained copy for every slot, three brand-matched theme directions built from the logo, and section rewrites.

Budget about 30-34 engineer-weeks: with one developer plus Claude Code, about 7-8 months, shipping monthly.

---

## 2. How it works today

### 2.1 End-to-end map

```
WIZARD (App.jsx `step` 1-4, WizardShell "Pro Hub" header)
  StepBusinessType -> StepBusinessInfo -> StepTemplatePicker -> StepGenerating
    businessType       ~17 fields,           10 visible            POST generate-website
                       googlePlace            templates as          (3 attempts,
                       (localStorage draft)   colour wireframes     fake progress text)
                                                   |
                                                   v
             netlify/functions/generate-website.js
             claude-sonnet-4-6 | max_tokens 2500 | free-text JSON | 12 keys
             + unauthenticated widget-save -> googleWidgetKey
                                                   |
                                                   v
EDITOR (step 5): App.jsx useState slices ----> WebsitePreview (template rendered inline;
  ContentEditor: TOGGLEABLE + 7 isXxx flags      "mobile" = 390px div)
  templateMeta = TEMPLATES[id] + customColors/customFonts (App.jsx:156-163)
    | autosave, 1.5 s debounce -> saveSite upsert
    |   sites.generated_content = copy + _images + _customColors + _customFonts
    v
PUBLISH (runs in the owner's browser, owner's session only):
  publishSite -> exportHtmlString -> renderToStaticMarkup(template)   (no effects run)
  + head: 13 fixed font families, Tailwind Play CDN, scheduler.js + contact-form.js
          (script origin = window.location.origin at publish time), @media grid
          overrides, JSON-LD
    | POST { htmlContent, slug (from business name), isPro }   <- all trusted from client
    v
publish-site.js (requireSiteOwner) -> R2 autosite-published/{slug}/index.html
                                      (+ {slug}/book/index.html), overwritten in place
    v
SERVE: {slug}.autocaregeniushub.com -> Cloudflare Worker (not in this repo) -> R2
       (serves {slug}/index.html for every path, so /book shows the homepage - G)
       custom domain -> Netlify edge fn (anon RPC on every request) -> Worker

SIDE PATH: Dashboard "Republish" -> publishSite(TEMPLATES[id] stock colours, images:{})
           -> live site loses logo, photos, colours, fonts
```

### 2.2 Theme data model: where each piece lives

| Piece | Stored in | Read by / notes |
|---|---|---|
| Theme registry (id, 5 colors, 2 fonts, mood, hidden, tier) | Code: `src/data/templates.js:1-275` | Picker, editor, export. `tier` is read nowhere. |
| Component per theme | Code: `TEMPLATE_COMPONENT_MAP` (`templates.js:277-299`) | Lazy import in preview and export, no fallback (`WebsitePreview.jsx:43-46`, `exportHtml.js:218`). |
| Editor's section list per theme | Code: `ContentEditor.jsx:451-555` (`TOGGLEABLE`) | Editor only; separate from each template's own default list. |
| Business-type fallback copy | Code: `src/lib/templateFallbacks.js:5-151` | Templates. Has no `whyCards`/`howSteps` keys. |
| Business facts | `sites.business_info` | Through `normalizeBusinessInfo` (arrays, `[]` when empty). |
| AI copy, owner edits, layout state (`sectionOrder`, `hiddenSections`, `heroLayout`, `aboutLayout`, `whyCards`, ...) | `sites.generated_content` (untyped jsonb) | Templates and editor. |
| Images, custom colors, custom fonts | `_images`, `_customColors`, `_customFonts` inside `generated_content` (`saveSite.js:18-25`) | Unpacked only by `App.jsx:403-408` (and `SchedulerSettings.jsx:152` for `_images`). 7 rows carry colors or fonts (G). |
| Booking widget look | `sites.scheduler_config` (`modal_theme`, `appearance`, base64 logo) | `scheduler-payload.js`; unrelated to the site theme. |
| Widget script origin | Baked into published HTML from `window.location.origin` (`exportHtml.js:7-20`) | Server fallbacks differ (`app.` vs `sitebuilder.`). |
| Published HTML | R2 `{slug}/index.html`, overwritten | No version history, no `published_at`, no rollback, no Last-Modified from the Worker (G). |

---

## 3. Themes deep dive

### 3.1 The implicit template contract

No code enforces any of this; there are no types, manifests or tests.

- **Props.** Every template receives exactly `businessInfo` (normalized), `generatedCopy`, `templateMeta` and `images` (`WebsitePreview.jsx:107-112`, `exportHtml.js:222-224`). Custom colors and fonts arrive merged into `templateMeta`.
- **`images`** is a flat map: `hero`, `about`, `logo`, `gallery0..11`, product images, `shadeN`, plus social-hide booleans.
- **Shared structure:** a flex-column root with `containerType: 'inline-size'`; one inline `@container (max-width:600px)` style string; `buildSectionOrder()` plus `hidden(id)`; nav at CSS `order: -1`, footer at `9999`; inline style objects only (so no `:hover`/`:focus`); a `scrolled` flag in `useState`/`useEffect`; fallback text from `getFallbacks(businessType)`.
- **Shared primitives** are only `HeroImage`, `GallerySection`, `ServiceCardParts` (no-JS read-more and a scheduler Book Now anchor), `SocialRow` and the Google reviews widget. `ServiceCardParts.jsx` and `SocialIcons.jsx` use JSX without importing React, which matters for server rendering (§11.7).

### 3.2 Copy-key coverage matrix (condensed)

| Key(s) | Claude generates | Owner can edit | Read by |
|---|---|---|---|
| `headline`, `subheadline`, `aboutText`, `servicesSection.intro/items`, `ctaPrimary/Secondary`, `footerTagline` | Yes | Yes | All 21 |
| `testimonialPlaceholders` | Yes, invented reviewers | Edit only, no add/delete | About 24 files |
| `metaTitle`, `metaDescription`, `keywords`, `schemaType` | Yes; keywords/schemaType hardcoded to "auto detailing" / `AutoRepair` | No | Export `<head>` |
| `ctaHeadline`, `ctaSubtext`, `ctaButtonText` | No; per-type fallback | Yes | 20-21 |
| `aboutStats` | No; invented defaults show | Only in About "Stats Box", 3 of 4 slots | 15 |
| `whyCards`, `howSteps` | No | Yes, seeded with mobile-detailing text | 3 / 2 |
| `trustBar`, `tickerItems`, `products` | No | Yes | WheelApex |
| `filmBrandsList`, `wheelBrands`, `tireBrandsList` | No | Yes | 3 tint / 3 wheel |
| `servicesSection.title`, `heroStats`, testimonial `role`/`vehicle` | No | No | Industrial / WheelClean / a few |
| `shadeGuide`, `showShadeGuide`, `showProducts`, `businessInfo.email` | - | Yes | **None** |
| `reviewMode` | Only when the Google widget saves | Yes | TintElite only |
| Section eyebrows/headings, nav labels, marquees, process steps | No | No | Hardcoded everywhere |

One number, used everywhere in this report: **Claude produces 12 keys; templates read about 33 distinct keys; about 11 of those are layout, URL or widget settings; about 10 content slots are never generated** (aboutStats, ctaHeadline, ctaSubtext, ctaButtonText, whyCards, howSteps, trustBar, heroStats, tickerItems, products). They fall back to generic or hardcoded text, some with unchecked claims ("Family-Owned", "same-day", "2 business hours") (arch-11 VC, ai-5). `whyCards`/`howSteps` defaults exist only as template literals and editor seeds; there are none in `templateFallbacks.js` (lead check, 0 matches).

### 3.3 Color and font overrides

**What owners can change:** 5 color roles (`bg`, `accent`, `text`, `secondary`, `muted`) and 2 font slots (`ContentEditor.jsx:1250-1256`, `fontOptions.js:28-41`). No presets, no contrast check, no derived tokens (surfaces, borders, text-on-accent); each template invents those as literals, from 8 hex literals (AutoSyncDark) to 84 (Ironclad); Carwash 82, Sudsy 75, WheelApex 28 with zero theme references.

**Where overrides are ignored:**
- **WheelApex** paints from a hardcoded palette `D` and fixed fonts (`WheelApex.jsx:31-52, 362`); the Colors & Fonts tab does nothing. One live WheelApex site on a custom domain overrides all 5 colors (G), so honoring them later will visibly change that site.
- **Heading-font slot** ignored in 8 body-font-only templates (only Industrial is visible), plus Ironclad (Bebas/Barlow Condensed hardcoded at `:69-70`) and WheelApex. AutoSyncWhite puts the custom font behind DM fonts, so it never renders.
- **Partial palettes:** TintElite never reads `c.accent` (gold is 36 literals); Obsidian's cyan and purple are fixed; Chrome's CTAs use a fixed silver gradient; Sudsy's blue and pink sections are fixed; Ironclad hardcodes surfaces and `#6B6560` body text.

**Fonts on the live site:** the published page loads a fixed 13 families (`exportHtml.js:111`) while the editor preloads 20 (`index.html:11`). Montserrat, Poppins, Oswald, Lato, Open Sans, Manrope, Source Sans 3 and Roboto look right in the editor and fall back on the live site. Several weights never load (Barlow Condensed 800, DM Sans 300, Inter 300, Playfair italic) (arch-3, t-mechanic-10, t-tint-8).

### 3.4 Duplication

About 10,350 lines across 21 registered templates. Structurally identical blocks: footers (~33 lines x 23 files), testimonial blocks (x23), the `aboutStats` fallback (x19), split-hero branching (176 references), scroll listeners (23), the Google reviews branch (23), `@container` strings (22), font-injecting `useEffect`s (7). Estimated 4,500-5,500 lines (~50%) differ only in styling. There are three `IconOrEmoji` implementations, one unused.

Adding a template today touches 6-8 files: the JSX, `TEMPLATES`, `TEMPLATE_COMPONENT_MAP`, `businessTypes.js`, ContentEditor's `TOGGLEABLE`/`isXxx` flags and panels, the export and `index.html` font lists, `generate-website.js` and `templateFallbacks.js` (arch-12).

### 3.5 Registered, hidden and unregistered templates

- **Registered:** 21. **Hidden:** 11, filtered by `StepTemplatePicker.jsx:41`, `ContentEditor.jsx:1410`, `LandingPage.jsx:6`. **Visible:** 10.
- **Premium tier:** 7 templates carry `tier:'premium'` (5 visible). Nothing reads `tier`; every `premiumTemplates` array is empty.
- **Unregistered:** `DetailingMinimal.jsx`, `DetailingPremium.jsx`, and `_g.cjs` (the Node script that generated AutoSyncWhite; its `/D/g` bug survives at `DetailingAutoSyncWhite.jsx:436`).
- **Choice by business type:** detailing, wheel and car-wash shops get one native design each (`businessTypes.js:7,23,47`); every visible template is shown to every type.

**Live usage (G, read-only SQL, 107 `sites` rows):**

| Template | Hidden | Rows | Published | Custom domain | `_customColors` / `_customFonts` |
|---|---|---|---|---|---|
| detailing_sporty | no | 19 | 8 | 0 | 2 / 1 |
| mobile_chrome | no | 15 | 7 | 0 | 0 / 0 |
| tint_obsidian | no | 10 | 5 | 1 | 1 / 2 |
| mobile_sudsy | no | 10 | 4 | 1 | 0 / 0 |
| carwash_bubble | no | 8 | 3 | 0 | 0 / 0 |
| mechanic_ironclad | no | 7 | 5 | 0 | 2 / 1 |
| mechanic_garage | no | 7 | 5 | 0 | 0 / 0 |
| wheel_apex | no | 6 | 3 | 1 | 1 / 1 |
| mechanic_industrial | no | 6 | 4 | 0 | 0 / 0 |
| tint_elite | no | 3 (all super-admin) | 0 | 0 | 0 / 0 |
| autosync_dark / coastal / mobile_bold / wheel_clean / autosync_white | yes | 5 / 2 / 2 / 2 / 1 | 0 | 0 | 0 / 0 |
| mobile_modern, mobile_rugged, wheel_edge, tint_dark, tint_sleek, mechanic_friendly | yes | 0 each | 0 | 0 | 0 / 0 |
| (null template, booking-only) | - | 4 | 4 | 0 | - |

What this settles:
- **Hidden templates have no published sites, but 12 draft rows remain** (10 super-admin; 2 non-admin users whose only site is a coastal or mobile_bold draft). Their components and map entries (`templates.js:280-297`) must stay or those drafts crash in the editor. The six templates with zero rows can be deleted outright.
- **7 rows carry `_customColors` or `_customFonts`** (6 colors, 5 fonts); 6 are published, none on hidden templates. These are the sites to hold back during conversion (§11.6); the 2 on custom domains (tint_obsidian, wheel_apex) matter most.
- **tint_elite** is visible but unused by customers; triage it with the hidden set.

### 3.6 Per-template scorecard

Visual quality is estimated from code (0-10), not screenshots; ranges show audit disagreement. "Live" = published / total rows (G).

| Template | Visible | Tier | Live | Visual | Phones | Honors custom colors | Section order | Top defect |
|---|---|---|---|---|---|---|---|---|
| detailing_sporty | yes | std | 8/19 | 5-6 | OK; split hero doesn't stack | Mostly (fixed nav/footer, `#fff` on accent) | Full; dead Awards toggle | "Real Reviews" on AI text (7 live sites); invented "5.0 Google Rating / 5K+ / 100%" |
| mobile_chrome | yes | std | 7/15 | 5 | Nav transparent on live site | Weak (silver gradient drives CTAs) | Full; dead Awards toggle | Transparent sticky nav; weight-300 type never loads |
| mechanic_garage | yes | std | 5/7 | 4 | Best container rules | Mostly (orange residue) | Warranty has no order | Invented opening-hours table; services listed twice |
| mechanic_ironclad | yes | premium | 5/7 | 6-8 | 32px H1 floor on phones | Partial (83 literals, heading font hardcoded) | Full, matches editor | "Verified Customer" on AI reviews (4 live sites); Services edits invisible |
| tint_obsidian | yes | premium | 5/10 | 6-7 | OK; solid nav | Partial (cyan/purple fixed) | Editor lists nonexistent sections | Footer contrast 1.2-1.9:1; Shades tab does nothing; hardcoded "5.0 ★" |
| mechanic_industrial | yes | std | 4/6 | 4 | OK; hours/warranty jump under hero | Partial (46 literals; heading font ignored) | Hours/warranty unordered | Services edits invisible; empty RECOGNITION/AWARDS/BRANDS boxes |
| mobile_sudsy | yes | premium | 4/10 | 6-8 | Hero doesn't move; bubbles escape preview | Partial (fixed blue/pink sections) | Hero has no order | Placard emoji instead of bubbles; hero text unreadable over photo; pink CTA 2.7:1 |
| carwash_bubble | yes | premium | 3/8 | 6-7 | OK; marquee outside order system | Partial (teal/lavender fixed) | Marquee can't move/hide | "Open Now / 4.9★ / 7 Days" invented; hero text unreadable over photo |
| wheel_apex | yes | premium | 3/6 | 5-7 | Header grid never stacks; brand strip overflows | **None** | Editor order differs | Ignores all colors/fonts; "Image" boxes; H2 = first 3 words of intro |
| tint_elite | yes | std | 0/3 | 6 | Nav transparent on live site | No accent (hardcoded gold) | Warranty unordered | Transparent nav; accent ignored |
| detailing_coastal | hidden | std | 0/2 | 4 | Services grid untagged | Partial | OK | Dark H1 over photo; crashes without `servicesSection` |
| detailing_autosync_dark | hidden | premium | 0/5 | 6 | OK | Weak (16 gold tints) | 3 blocks unordered | Hardcoded brands and "aviation" claims |
| detailing_autosync_white | hidden | premium | 0/1 | 5 | JS `isMobile` never fires | Partial; custom fonts never render | Brands unordered | `tel:` regex bug |
| mobile_bold / modern / rugged | hidden | std | 0/2, 0/0, 0/0 | 4 / 5 / 4 | Rugged nav transparent | Partial | Hero/banner unordered | Contact form under hero (Bold, Rugged); Rugged has no packages branch |
| tint_dark / tint_sleek | hidden | std | 0/0 | 5 / 4 | Nav transparent | Partial | Warranty unordered; Sleek no editor entry | Invented "2K+ / 99%"; white-on-teal 2.5:1 |
| mechanic_friendly | hidden | std | 0/0 | 2 | Services grid untagged | Inverted (bg used as ink) | whyUs missing from editor | White-on-white headings |
| wheel_edge / wheel_clean | hidden | std | 0/0, 0/2 | 4 / 4 | Split hero | Partial | Clean's editor order differs | Uneditable "5.0 ★" and "50+" |
| detailing_minimal / premium | unregistered | - | - | 4 / 5 | - | - | - | Dead code; Premium invents a "Lifetime" guarantee |

### 3.7 Mockup fidelity

Six themes have mockups in `WebsiteMockups/`. Every port lost most of the polish, because inline styles can't express hover/motion and static export drops effects.

- **Ironclad:** H1 `clamp(32px,7cqi,90px)` vs mockup `clamp(72px,10vw,130px)`. Lost: CSS hovers, heroIn and scroll reveal, the price row, the ASE badge, the two-tone headline for AI copy (t-mechanic-12).
- **Obsidian (~45%):** H1 weight 600 at 3.6rem max vs 800 at 100px; no Syne Mono; lost the VLT shade selector, film-tier cards and contact form, while the editor still shows a Shades tab (t-tint-11).
- **Sudsy (~55%):** all 12 keyframe animations and every hover/press state gone, plus the trust bar; brand emoji is U+1FAA7 PLACARD instead of U+1FAE7 BUBBLES (t-mobile-12).
- **WheelApex:** lost the hero image/stats panel, the finish selector (still advertised in `templates.js:211`), fitment search and bronze hovers.
- **CarwashBubble:** lost every animation, the gradient/outline headline, perk-list pricing cards and the contact section.
- **AutoSync dark/white:** `heroH1Em` defined but unused; White never renders its stats, fleet and process sections.
- **`apex-wheel-shop-v2.html`**, the richest wheel design in the repo, has no React implementation.

---

## 4. Section customization (the editor)

### 4.1 Registry and special-casing

Seven booleans come from `templateId` (`ContentEditor.jsx:442-448`). Two registries follow: **`TOGGLEABLE`** (`451-555`, 10 template entries plus `_default` for the other 11) and the **icon-rail `sections` array** (`584-604`). About 425 of the editor's 1,490 lines (~28%) are per-template branching; a schema-driven renderer would replace roughly 650 lines with about 200.

### 4.2 Order and visibility

Stored as `copy.sectionOrder` / `copy.hiddenSections`, applied with CSS `order` (`sectionOrder.js:6-13`); ids missing from a saved order get `999`. Known drift (arch-6, editor-10, t-wheel-wash-8, t-mechanic-8, t-tint-3):

| Template | What goes wrong |
|---|---|
| wheel_apex, tint_elite (and hidden wheel_clean) | Editor order differs from the template default, so the first drag moves untouched sections. |
| tint_obsidian | Toggles for sections that don't exist (shadeGuide, brands). |
| Sporty, Garage, Chrome | `_default` shows an Awards toggle that does nothing. |
| Industrial (hours), Elite/Sleek/Dark (warranty), Sudsy/Modern/Rugged (hero), Bubble (marquee) | Blocks with no `order` sit at 0 right under the hero and can't be hidden. |
| Any template, after a switch | `sectionOrder` is kept (`App.jsx:746-751`), so the new template's unique sections pile up at 999, above the footer. |

CSS `order` leaves DOM order unchanged, so keyboard and screen-reader order don't match the screen.

### 4.3 What owners cannot edit

Section eyebrows and headings on every template ("NO JOB TOO HEAVY." `MechanicIronclad.jsx:364`, "Built Different" `DetailingSporty.jsx:323`); nav labels; Obsidian's process steps (`TintObsidian.jsx:62-67`); Bubble's marquee and "Unlimited Monthly Plans" (`CarwashBubble.jsx:271-276, 343-349`); the gallery heading (`ImageLayers.jsx:57-63`); ratings, "Most Popular" badges and Bubble's hero badges; headline emphasis (every third word, `DetailingSporty.jsx:234-235`); SEO title/description; adding or deleting a testimonial.

Controls that exist but do nothing (editor-3, t-tint-4, ai-10): the Shades tab and `showProducts`; `reviewMode` (TintElite only); hero button URLs (ignored by Ironclad, Obsidian, Sudsy, Bubble); `ctaSecondaryText` (Bubble only); the Icons tab (Ironclad and Bubble print the raw string `icon:shield`).

The Services tab writes `businessInfo.services`, but Ironclad and Industrial render only the AI list, so name, price and delete edits never appear (editor-4). The Why Us and How It Works panels seed six mobile-detailing cards, so the first edit writes "We come to your door" onto mechanic and car-wash sites (arch-5, t-mechanic-7).

### 4.4 Colors, fonts, images

- **Colors:** five native color inputs; no presets, no contrast check.
- **Fonts:** 11 heading, 10 body; 8 don't load live (§3.3).
- **Upload:** browser downscale to 2,000px, re-encode JPEG q0.85 into public Storage (`imageUpload.js`); no size cap, crop, focal point or alt text.
- **Logos:** every upload becomes JPEG, so a transparent PNG logo gets a black box, most visible on WheelApex's and Bubble's light navs (editor-7).
- **Gallery:** 1-3 photos as a grid, 4+ as a scroll-snap carousel; both survive static export.

### 4.5 State, undo, autosave

Seven `useState` slices in App (`App.jsx:43-60`); each change schedules a 1.5 s debounced whole-row upsert; failures only reach `console.error` (`App.jsx:152`). Problems (editor-2): an upload captures the `onChange` from when it started, so two uploads overwrite each other and a finished upload can revert typed text; no undo; no unload warning. **Preview Demo keeps the real `siteId`** (editor-1, onboard-1): any demo edit autosaves Miami demo copy and template over the owner's real site and drops `_images`.

### 4.6 Preview accuracy

The template renders in the app DOM, not an iframe; "Mobile" is a 390px div (`WebsitePreview.jsx:48-50`). `@container` rules fire; the export's viewport `@media` rules never do; the scheduler and contact-form widgets never load. §5.2 lists the differences.

### 4.7 Editor chrome

A 20% black backdrop dims the preview while editing colors (`ContentEditor.jsx:611`); the 320px panel covers the right 320px of the site; the 60px icon rail has 8px group labels and 9px tab labels cut to the first word ("How", "Why", "Film", "Trust", `:642, :658-659`); canvas `bg-gray-900`, blue focus rings, brand tokens unused; no click-to-edit (`ImageEditContext` has zero consumers, `ImageEditContext.jsx:9`); the 17-step tour describes fields that don't exist (editor-12, onboard-9).

---

## 5. Published sites

### 5.1 Rendering, export and the slug problem

HTML is built in the owner's browser with `renderToStaticMarkup` (`exportHtml.js:217-224`); no hydration, no effects. The server trusts the HTML, the slug (from the business name, `publishSite.js:11`) and `isPro`. `publish-site` only checks ownership (`_shared/auth.js:70-74`), so **nobody but the owner's own session can publish** (§14.2).

**Republish (critical, as a risk).** Dashboard Republish passes `images: {}` and stock `TEMPLATES[id]` colors (`DashboardPage.jsx:318-328`). The live site loses its logo, photos, custom colors and fonts and shows "Upload a photo" placeholders. Owners are sent there by `articles.js:136,168`, `EditBusinessInfoModal.jsx:28` and `ContentEditor.jsx:1385`. The database is intact; publishing from the editor restores the site (arch-1 VC). Crawl (G): `dsean-sparkly-detailing` and `obsidian-auto-spa` match the stripped pattern exactly (text matches the draft; logo, photos and colors missing); `onthree-detailing` is unclear. Both also fit "published before images were uploaded", so damage is not proven. The exposure is the 15 live sites showing uploaded images and 6 showing custom colors.

**Slug takeover (critical, realized, lead check + G).**
- The only guard is `if (site.slug && site.slug !== slug) return 409` (`publish-site.js:44`); the comment at `:41-43` promises otherwise.
- `sites_update_own` checks only `auth.uid() = user_id` with no column limit (`20260424_sites_one_per_non_admin.sql:18-22`); live column privileges confirm `anon` and `authenticated` hold INSERT and UPDATE on `sites.slug`.
- The live table has only a non-unique `sites_slug_idx`; no code queries sites by slug before publishing.
- Live duplicates: `malpica-detailing` (2 rows, two ordinary customers, both published), `auto-care-genius` (an admin and a customer), `autosite-demo-shop` (5 rows, two admin accounts). No same-user collisions exist yet, but they are possible since commit `ee1f3b5` allows a website row plus a booking-only row, and both paths derive the slug from the business name.
- `unpublish-site.js:36-47` deletes `{stored slug}/index.html`, so if either Malpica owner deletes their site, the other's live page disappears.

**Renaming the business** changes the computed slug, so every later publish returns 409 until the name reverts (export-4, shell-2).

### 5.2 Responsiveness and interactivity: the reality

- **Container queries** (`@container(max-width:600px)`, cqi) work statically: phones get one column with nav links hidden and **no replacement menu** in any template.
- **Export-only viewport hacks** (`exportHtml.js:174-182`) force every inline-grid `div` to one column at ≤768px, breaking intended layouts (WheelApex products: 2 columns in preview, 1 live) and collapsing the booking widget's 7-column calendar (ops-2).
- **Split heroes** are unclassed flex rows (or a `<header>` grid) that never stack in preview or live (t-tint-1, t-wheel-wash-3; same pattern in 21 templates).
- **Effects that never run live:** `scrolled` state (MobileChrome and TintElite navs stay transparent, t-tint-2); Ironclad's JS hovers; AutoSyncWhite's `isMobile`; 7 font-loading effects.
- **Contact form:** `contact-form.js:29-38` inserts its form before the footer with order 0 when there's no `#contact`, so it lands right under the hero on Sporty, Industrial, Obsidian and Bubble (export-9). Only the 8 live pages published after about 2026-06-04 load this script at all (G).
- **What survives:** checkbox read-more, scroll-snap gallery, CSS keyframe tickers, Book Now anchors bound by `scheduler.js`.

### 5.3 SEO, performance and tracking

- Render-blocking Tailwind Play CDN on every homepage though templates use no Tailwind classes (export-8); fixed 13-family font CSS everywhere.
- No `srcset`, `loading=lazy` or `fetchpriority`; the hero is a CSS background; 2,000px JPEGs go to phones (export-5).
- Title/description/OG are inserted unescaped and `escapeAttr` escapes in the wrong order (`exportHtml.js:50-52`); no canonical, `og:image` or `twitter:card`; invalid `og:type 'local.business'`; schema type always `AutoRepair`; no hours/geo/sameAs; blank logo favicon; no robots.txt or sitemap; www, apex and slug host all return 200 (export-11).
- **Page views are effectively not recorded** (gap-1): `scheduler.js:42-43` sends an `application/json` Blob via `sendBeacon` (always credentialed) to `track-view`, which answers `Access-Control-Allow-Origin: *` (`track-view.js:4-8`), which browsers reject for credentialed requests; the try/catch never falls back to `fetch`. `page_views` holds 11 rows across 48 sites in about 3.5 months. The browser rejection is inferred from the spec (a browser test was blocked); the data strongly supports it.

### 5.4 Persistence, versioning and drift

The `sites` row is a draft autosaved every 1.5 s; publish overwrites `{slug}/index.html`. No `published_at`, version history, rollback or "unpublished changes" state. Template fixes reach a live site only when that owner republishes; the copyright year is frozen in 24 places (export-12).

**Live pages have drifted from their drafts (gap-2, G).** Publishing from today's drafts would change or damage these live sites:
- Live images the draft doesn't have: `estrella` (logo + 3 photos), `central` (5), `juanito`, `malpica`, `rhines`. For Malpica this is consistent with the cross-account overwrite.
- A different template live than in the draft: `lovacar`, `palm-luxe`, `ss`, `estrella`, `eli` (owners switched templates in the editor, which autosaves, and never republished).
- `nxt-premium-detailing` shows the owner's real reviews live while the draft still holds AI placeholders; `onthree-detailing`'s draft has no text at all.

### 5.5 Serving

- **Slug subdomains** go through a Cloudflare Worker in another repo. Per its runbook (`docs/superpowers/runbooks/worker-custom-hostname-routing.md:7,54`) it serves `{slug}/index.html` for every path, and the crawl confirms **`/book` returns the homepage on all 37 live website pages** (gap-3), even though `publish-site.js:70-76` writes `{slug}/book/index.html`. The Worker returns `cache-control: public, max-age=300` with no Last-Modified or ETag.
- **Custom domains** go through a Netlify edge function that calls an anonymous Supabase RPC on every request, uncached (`serve-custom-domain.js:55-106`).
- **Widget origins are frozen at publish time** (gap-4): 38 live pages load `scheduler.js` from `sitebuilder.autocaregenius.com`; `titos-car-wash` (booking on, custom domain live) loads an old 54 KB build from `deploy-preview-8--autosite-builder.netlify.app`; `mike-auto-detaiing` points at a preview origin that now returns 404 (booking off); `eli-auto-detailing` has no scheduler script. The server-side fallback `app.autocaregenius.com` (`exportHtml.js:7-20`) is not in the edge function's `MAIN_HOSTS` (`serve-custom-domain.js:24-28`), so a server render must set the origin explicitly.
- **Unpublish** deletes only `index.html` and leaves `/book`.

### 5.6 What is actually live (G, crawl of every published row, 2026-09-27)

| Measure | Result |
|---|---|
| Published rows -> pages | 48 rows -> 42 distinct pages (duplicate slugs) -> 41 live (`flow-auto-detail` 404) -> 37 website pages + 4 booking-only shells |
| "Images tab" placeholder | 32 of 37 (exceptions: central, og, ss, vivid, zwitch) |
| AI testimonials shown | 25 of 37; 11 of these owners chose Google at signup |
| "Verified Customer" / "Real Reviews" labels | 4 (all Ironclad: fast-eddies, junkelcarwash, mike-c, zwitch) / 7 (all Sporty: central, dsean, luxurious, magician, palm-luxe, primeluxe, venturas) |
| At risk from Republish | 15 show uploaded images (zwitch has 15); 6 show custom colors |
| Loads `contact-form.js` | 8 (the other 29 website pages were last published before about 2026-06-05) |
| `/book` | Homepage on all 37 |

**Owners to contact** (excluding internal and test accounts): missing images: dsean-sparkly-detailing, obsidian-auto-spa, onthree-detailing, veylance (stale hero and accent); fake-review labels: fast-eddies, junkelcarwash, zwitch, central, dsean, magician, primeluxe, venturas; scheduler origin: titos-car-wash; slug dispute: both malpica-detailing owners.

---

## 6. Claude generation today and the upgrade path

### 6.1 Today

**The call.** One non-streaming `claude-sonnet-4-6` call, `max_tokens: 2500`; reads `content[0].text`, strips fences, `JSON.parse`; no schema validation, no `stop_reason` check (`generate-website.js:114-130`); `@anthropic-ai/sdk ^0.39.0` predates `output_config`; the ~75-token system prompt is too short to cache.

**What goes in and out.** Only the template's `label` and `mood` reach the prompt (`:76-77`); output has 12 keys. Package prices and descriptions are dropped; `warrantyOffered` is read under the wrong key; hours, awards, payments, tireBrands and the Google rating are never sent; keywords are hardcoded to "auto detailing" and the schema type to `AutoRepair` (ai-6). For 4 of 6 business types the owner's packages replace the AI's service descriptions (t-tint-7). The prompt asks for 8-12-word city headlines while templates are built for 3-5-word display headlines (ai-8).

**Failure handling.** 3 attempts total (2 retries) on any error, including 400s; 400s and 500s each consume a quota slot because the quota row is written before Claude is called; 429s don't (`rateLimit.js:39-41`). Truncation needs about 20+ services. Progress messages are a fixed loop that restarts after ~12.6 s; Back doesn't cancel, so a late success still pulls the owner into the editor (ai-4, onboard-5).

**Crash risk.** Well-formed output missing `headline` or `servicesSection` white-screens the editor on every reopen (no ErrorBoundary) (ai-3). Moving to a model that thinks by default (Opus 5 included) would break the `content[0].text` read.

### 6.2 Fake reviews and made-up claims: the legal issue

The most urgent non-security item.

**Invented reviews.** The prompt says "NEVER invent or fabricate details" (`:86`), then asks for three "Realistic-sounding customer testimonial[s]" with "First name + Last initial" (`:102-106`). They publish with ★★★★★ whenever there is no `googleWidgetKey`: when the owner never picked a place, when `widget-save` failed, or when the owner chose "AI Testimonials". DetailingSporty titles them "Real Reviews" (`:346`); Ironclad labels them "Verified Customer" (`:559, :573`). Owners see an "AI" label in the wizard and editor; visitors never do. Worse, the wizard's default review source is Google, and it says "Real Google reviews will appear on your website" (`StepBusinessInfo.jsx:707`) even when no place is selected. Live, 25 of 37 website pages show AI reviews, and 11 of those owners chose Google (G).

**Invented numbers and claims** (when the owner hasn't supplied their own): DetailingSporty "5.0 Google Rating", "5K+", "100% Satisfaction" (`DetailingSporty.jsx:184-195`); CarwashBubble "4.9★ Google Rating", "7 Days Always Open", "— Open Now", with no field to edit them (`CarwashBubble.jsx:208, 237-239`); WheelApex "0% for 12 months", a Regulation Z trigger term (`WheelApex.jsx:187-188`); Ironclad "5,000+" and "Family-Owned"; Garage a "12mo" warranty (it reads the tint-only `warranty` field); "5K+" in 12 files.

16 CFR Part 465 (in force since October 2024) prohibits testimonials from consumers who don't exist, and the platform that writes them is a creator. Counsel should review the fix (ai-1, ai-2, t-mechanic-1, t-wheel-wash-1/2).

**The fix** (detail in §12.5):
1. Remove testimonial generation.
2. Show reviews only from Google or owner-entered reviews with an attestation; otherwise hide the section.
3. Make the wizard and editor truthful: show "No review source connected; the reviews section will be hidden" instead of promising Google reviews, and warn at publish time.
4. Allow stats only through `FactRef` bindings to real facts; a missing fact means no tile.
5. A publish-time check that rejects any number, rating or "verified" claim not in the facts.
6. Existing sites: follow §14.2, which hides AI testimonials but skips sites whose live page shows real reviews (e.g. `nxt-premium-detailing`). Never run it before the Republish fix.

### 6.3 Upgrade path (summary of the Claude upgrade plan)

- **Transport.** A background Netlify function streams into a `site_generations` row; the wizard subscribes over Supabase Realtime and the site fills in live. Clients never retry on their own; quota counts only runs that are running or succeeded.
- **Request.** `claude-opus-5`, `thinking:{type:"adaptive"}`, `output_config: {effort:'medium', format:{type:'json_schema', schema}}`; one schema per business type generated from the content contract (§11); `max_tokens` 32000 via `stream().finalMessage()`; `fallbacks:"default"` with beta `server-side-fallback-2026-07-01`; a frozen 3-4k-token system prompt and a per-site facts block, both `cache_control`.
- **Response handling.** `end_turn`: find the text block, parse, validate with zod, `normalizeCopy`. `max_tokens`: split into section groups and retry. `refusal`: friendly message, no quota charge.
- **Content contract.** `contentContract.js` lists every path with its source (`ai`/`derived`/`owner`/`layout`) and word budget. A test renders every template with a recording `Proxy` and fails when a template reads a path not in the contract.
- **Code, not the model, owns** `schemaType` (`car_wash -> AutoWash`), `keywords`, `metaTitle` and trust tiles.
- **Plumbing.** Upgrade the SDK, add zod, add an `ai_calls` log table, add an ErrorBoundary at `WebsitePreview.jsx:107`, and move `widget-save` out of generation under the owner's own user id (ai-9).
- **Cost.** About $0.08-0.15 per full generation vs $0.02-0.03 today (§12.8).

---

## 7. Owner dashboard look and feel

### 7.0 Production reality matrix (G)

Production (`sitebuilder.autocaregenius.com`) runs deploy `6aa1c3f09f0f4e0008dec914` from commit `1498bf7` (current HEAD). Vite bakes env flags into the bundle, which was inspected directly.

| Surface | In production? | Evidence | Gating |
|---|---|---|---|
| Payments and Charges | Live | Payments/Charges callbacks compiled unconditionally (`VITE_STRIPE_PUBLISHABLE_KEY` set; live vs test key unknowable from the bundle); 8 Stripe functions deployed | Charges need Connect onboarding (`AppHeader.jsx:45`) |
| Custom domains | Live | `CUSTOM_DOMAIN_ENABLED` compiled to `true`; connect/disconnect/status functions, `domain-sweep` cron and the edge function deployed | Pro only (`DashboardPage.jsx:599, 622`) |
| Header nav | 7 items for owners, 8 for super-admins | `AppHeader.jsx:49-58`; Bookings/Customers/Charges need only `!!profile` (`subscriptionGating.js:43-45`) | Pages behind SubscribeGate |
| "Website views" | Shown, effectively empty | 11 `page_views` rows / 48 sites / ~3.5 months | Broken beacon (gap-1) |

So every Stripe, Charges and DNS finding below ships to real users. The comment at `App.jsx:257-260` ("production stays Shopify-only") is stale, and `.env.example` doesn't list `VITE_STRIPE_PUBLISHABLE_KEY` (gap-7).

### 7.1 Shell and routing

- **No router.** A `view` string (`App.jsx:55`) plus a wizard `step`; 12 views chosen by if-chains (`454-800`). Refresh returns to Overview, Back leaves the app, nothing deep-links. Stripe and Connect returns land on Overview; their handlers run only when the owner later opens that page. The wizard draft is restored and then always wiped, because both entry points call `handleStartOver` (`App.jsx:664, 675 -> 249-251`), though Help promises "Continue Where You Left Off" (shell-3, onboard-8).
- **Three chromes:** AppHeader ("Genius Websites"), WizardShell ("Pro Hub", white background, different nav), the editor toolbar. Booking-only setup renders outside any shell (shell-11).
- **Nav overlap.** The absolutely centered nav overlaps the logo and account area from 768px up to about 1,060px for owners (7 items) and about 1,145px for super-admins (8 items).

### 7.2 Design-system adherence

| Metric | Count |
|---|---|
| Token classes used (`ink-*`, `rounded-token-*`) | 6, all in `ConnectStatusBadge.jsx` |
| Raw Tailwind palette classes | 665 (gray 483) |
| Arbitrary hex classes | 1,224 (`#cc0000` x398, `#1a1a1a` x329, `#888` x191) |
| Red hover shades | 3 (`#aa0000` x16, `#a80000` x13, `#b30000` x4; token is `#b30000`) |
| Success-green variants | 3 |
| Arbitrary px text sizes | 19 (`text-[11px]` x183, `[10px]` x52, `[9px]` x8, `[8px]` x4) |
| `rounded-xl` / `rounded-2xl` (tokens promise "sharp to barely rounded") | 132 / 49 |
| Hand-rolled `fixed inset-0` overlays | 17, 9 z-index values; 8 declare `role=dialog`; 1 traps focus |
| Labels not associated with inputs | about 77 of 91 |
| `focus-visible` styles / `motion-reduce` variants | 0 / 0 |

`design-tokens.js` defines the brand; `tailwind.config.js` copies part of it by hand. Outfit loads twice (`index.css:1`, `index.html:11`).

### 7.3 Missing primitives

Only `AlertProvider` (toasts plus a promise-based confirm) is shared, and the confirm autofocuses its destructive button, so Enter on "Delete site?" deletes the site (shell-7). No shared Button, Field, Dialog, Drawer, Menu, DataList, Tabs, StatusPill, EmptyState, Skeleton or PageHeader. The operational pages alone have 8 status-badge implementations with conflicting meanings, 4 modal and 2 drawer frames, 7 tables with 3 header styles, and 9 "Loading…" placeholders.

### 7.4 Contrast

Secondary text `#888` is 3.5:1 on white, often at 10-12px; `#aaa` is 2.3:1; `gray-400` 2.5:1. Chart axis labels render at about 9px because the SVG viewBox is scaled down (shell-8).

### 7.5 Page by page

- **Overview.** Admins see every shop's recent bookings and sites (no owner filter, `OverviewPage.jsx:63-67`); a failed query shows "Welcome, let's get you set up" to existing customers; changing the date range blanks the page (shell-10); the headline "Website views" is near zero for everyone (gap-1).
- **Sites.** Shows the raw template id (reads `.name`; templates have `.label`, `DashboardPage.jsx:524`); no "Change theme" or "unpublished changes" state; the $499 promo modal auto-opens on first visit for all owners, Pro included, followed by a fixed banner; non-Pro owners also get a 5-CTA funnel and a "Free plan" pill whose dialog is about domains (shell-5); thumbnails are live iframes of the published site.
- **Profile.** Uploaded photos vanish; the profile select omits `photo_url` (`AuthContext.jsx:73`) (shell-9).
- **Bookings.** Times shifted by the owner's UTC offset; SMS reminders send the wrong time (ops-1); month grid default on phones; "+N more" not clickable; list oldest first; the Schedule tab's booking link points at the homepage (ops-12), and the `/book` link from Settings also lands on the homepage today (gap-3).
- **Booking settings.** Deleted services return on every load (ops-6); mixed instant and manual saves; switching tabs discards edits (ops-9); the logo is ~0.7 MB of base64 downloaded uncached on every page view (ops-10).
- **Booking widget.** Ignores the site theme (brand falls back to `#1a1a1a`; "Dark" modal makes prices invisible); six modal themes and seven template accents put white text on light colors at 1.9-3.6:1 (ops-4, ops-5).
- **Customers and Charges.** "Charge" from a profile queries a nonexistent `published` column, so it lists no services; every vehicle is charged the first vehicle's price, on the client and in `create-charge.js:81-87` (ops-7).
- **Custom domain.** The DNS table is unusable at 375px (Value column ~14px wide) (shell-12).

---

## 8. Admin panel

**What exists.** Admin is a view state with two tabs, Accounts and All bookings.
- **Accounts** loads all profiles, sites and metadata unpaginated and joins them in the browser; it will silently truncate at PostgREST's 1,000-row default (latent: 92 profiles, 107 sites today) (admin-3). The sites query omits `template_id`.
- The user drawer is read-only except tags, notes and impersonation. `toggleField` (comp Pro, grant admin) is written but never called, so those changes happen in the SQL editor (admin-10).
- **All bookings** mixes every shop's bookings with no shop column, and acting on one emails the shop's customer (admin-7).

**No publish path.** Admin can reach a customer's site only via impersonation (`AdminUserDrawer.jsx:136-172`); `publish-site`'s `requireSiteOwner` rejects anyone else. Rolling out fixes therefore needs either impersonation (after admin-2) or a service-role rebuild script (§14.2).

**Impersonation.** Mints a real session and stores the tokens in plaintext, never cleared (admin-6); the audit row is written after the tokens and fails open, with no session link or end time, and admin-to-admin chaining records the wrong person (admin-5); exit calls a global `signOut()`, logging the customer out on every device (admin-2); the reason prompt is `window.prompt` and `window.open` runs after awaits, so popup blockers can eat the tab (admin-9).

**Theme operations: none.** The catalog is code (`hidden`, `tier` literals); `tier` isn't enforced; "Preview Demo" always opens `detailing_sporty`; hidden templates can't be previewed; no usage or publish-rate stats; no bulk rebuild; no Claude usage, cost or failure data (admin-8); the changelog is a hardcoded array last updated 2026-05-18 (admin-1).

**Latent hazard.** The admin edit-any-site RLS policies exist but no UI uses them. Wired as-is, `saveSite` writes the admin's `user_id`, so the first autosave would silently transfer ownership (admin-4).

**Schema drift.** `impersonation_handoffs`, `admin_user_metadata`, `is_super_admin()` and `sites_admin_select_all` have no DDL in the repo, and `20260809` was applied by hand. Before adding the tables in §11.5, snapshot the live schema into migrations.

---

## 9. Onboarding and template picking

- **Landing page.** Shows no real websites (colored wireframes). It says CRM, Stripe payments, deposits and custom domains "ship the moment you publish" for free; all are live in production (§7.0) but gated behind Pro and, for charges, Connect onboarding, so the promise mismatches the gating (onboard-12).
- **Sign-up** collects name, company and phone; the wizard asks for business name and phone again (onboard-7).
- **Business info.** One form of ~17 fields; the Google lookup comes last and autofills nothing; an unsaved package is silently dropped when another is saved; "Fill Demo" appears only for two hard-coded emails although the landing page advertises it.
- **Template picker.** Every card is the same wireframe tinted three colors (`TemplateCard.jsx:12-30`); "Preview Demo" always shows a Miami detailing shop (onboard-3); detailing, wheel and car-wash shops get one native design each (onboard-4); `TemplateGrid` is defined inside render, so every selection remounts it and loses focus.
- **Order of steps.** The template is chosen before generation; going back to compare forces a new generation that wipes edits and images (ai-7). Since copy barely depends on the template, reverse it: **generate first, then choose** from live thumbnails showing the owner's own name, services and logo.
- **Tour and Help.** The tour mounts during demo previews, fails on the missing Finalize button and marks itself done forever; it hijacks Enter and Escape while the owner types; Help (z-60) sits under the editor (z-9999) (onboard-9).
- **After first publish:** a dead end with no dashboard, next steps or slug field, though Help says "Pick a slug" (onboard-10).

---

## 10. Verified findings register

### 10.1 Kept findings, sorted by final severity

Duplicates are merged; every source ID is listed. Effort: S < 2 days, M < 2 weeks, L > 2 weeks.

| Findings | Sev | Status | Area | Anchor | Issue | Fix | Effort |
|---|---|---|---|---|---|---|---|
| export-1 | Critical | V + lead check + G | security | `publish-site.js:44` | Owner can write any slug (RLS no column limit, no unique index), then publish or unpublish over another tenant; client HTML trusted; realized: `malpica-detailing` shared by two customers; unpublish deletes the shared page | Ordered slug-authority steps (§1 item 1), incl. booking-only insert; server render and `isPro` later | S-M |
| arch-1, export-2, shell-1, ops-3, t-detailing-1, t-mobile-1 | Critical* | VC + G | bug | `DashboardPage.jsx:318-328` | Republish drops images, colors, fonts; help docs send owners there; 15 live sites exposed, 2-3 look hit (*duplicates rated High because data is recoverable) | Shared `resolveSiteRender`; delete `handleReExport`; round-trip test | S |
| ai-1, arch-4, export-7, onboard-2, editor-9, t-wheel-wash-1 | High | V + G | legal | `generate-website.js:102-106` | AI-invented named testimonials on 25/37 live pages as "Real Reviews"/"Verified Customer"; wizard says "Real Google reviews will appear" (`StepBusinessInfo.jsx:707`) | Remove generation; Google or attested reviews; truthful wizard + publish warning; §14.2 rollout | S-M |
| ai-2, t-mechanic-1, t-wheel-wash-2, t-detailing-6, t-mobile-2, t-tint-6 | High | VC | legal | `DetailingSporty.jsx:184-195`; `CarwashBubble.jsx:237-239` | Hardcoded ratings, "Open Now", "0% for 12 months", "5K+" (12 files), Garage "12mo"; some uneditable | `trustFacts` / `FactRef` tiles; hide when empty; read `warrantyOffered` | M |
| arch-7, editor-8, t-detailing-2/3, t-mechanic-4/9, t-mobile-5, t-wheel-wash-5/7, t-tint-9 | High | V + G | visual | `DetailingSporty.jsx:232, 310` | "Upload a photo in Images tab" on 32/37 live pages; 19 unguarded `awards &&`; WheelApex "Image" boxes | EditorContext placeholders; publish fallbacks; length-guard codemod; publish-time scan | S |
| editor-4, arch-8, t-mechanic-2 | High | V | bug | `MechanicIronclad.jsx:31, 375` | Services edits never reach Ironclad or Industrial; Garage renders two lists | `useServices()` merging owner list with AI descriptions | S |
| export-4, shell-2 | High | V | bug | `publishSite.js:11` | Business rename changes the slug; every publish returns 409 | Server uses stored slug | S |
| editor-7, export-5 | High | VC | visual | `imageUpload.js:48-58` | Uploads become JPEG (black box on transparent logos); no srcset/lazy; hero is a CSS background | Keep alpha for logos; WebP variants; `<img fetchpriority>` | S / M |
| t-wheel-wash-6 | High | V | bug | `WheelApex.jsx:31-52` | Only wheel template ignores all colors/fonts; H2 cut to 3 words; heroStats unused | Tokenize (late in migration, owner preview for the custom-domain site) | M |
| t-wheel-wash-4, t-mobile-3, t-detailing-5 | High | VC | visual | `ImageLayers.jsx:4, 15` | Hero photo makes dark hero text unreadable (Bubble, Apex, Sudsy) | `heroScrim` / `onHero` tokens | S |
| ops-1 | High | V | bug | `BookingDetailDrawer.jsx:6-11` | Booking times shifted by UTC offset; wrong SMS times; owner-created bookings in wrong slot | UTC formatter everywhere; fix `BookCustomerModal` | M |
| ops-2 | High | VC | visual | `exportHtml.js:174-176` | Export grid rule collapses the booking calendar to 1 column on phones | Fix now in `scheduler.js` (served `max-age=0`); `.tp-root` scoping and Shadow DOM later | S |
| ops-6 | High | V | bug | `SchedulerSettings.jsx:27` | Deleted/renamed booking services re-added, enabled, bookable | Seed once; track dismissed | S |
| t-mechanic-6 | High | V | bug | `MechanicGarage.jsx:158-166` | Invented opening hours; closed days blank or read as open | Shared `HoursTable` | S |
| gap-2 | High | G | ops | `DashboardPage.jsx:299`; `publishSite.js:10` | Live pages have drifted from drafts (images, template, reviews, empty draft); any bulk republish from drafts damages ~10 sites | Per-site dry-run diff vs crawled HTML; hold back drifted sites; back up `index.html` before overwrite | S |
| gap-1 | Medium | G (browser behavior inferred) | bug | `public/scheduler.js:42-43`; `track-view.js:4-8` | Credentialed JSON beacon vs `ACAO *`: page views almost never recorded (11 rows / 48 sites / 3.5 months); Overview metric empty | `text/plain` Blob or `fetch` keepalive without credentials; ship with the thumbnail no-track guard | S |
| gap-3 | Medium | G | ux | Worker (external); runbook `:7,54` | `/book` serves the homepage on all 37 live websites; shared booking links don't open a booking page | Worker route for `{slug}/book/`; add a crawl check to publish QA | S |
| gap-4 | Medium | G | bug | `exportHtml.js:7-20` | Widget script origin frozen at publish: one live site on an old preview build, one on a 404 origin; Node fallback host not in `MAIN_HOSTS` | Constant canonical origin passed in; rebuild affected sites | S |
| gap-5 | Medium | G | arch | `src/lib/supabase.js:3`; `netlify.toml:10` | Server render impossible today: cold-start crash on `import.meta.env`, then "React is not defined" in all 21 templates (classic JSX); duplicated appearance normaliser | Root `jsconfig.json` (`jsx: react-jsx`) or pre-bundle; supabase-free `renderSite.js`; shared `normalizeAppearance` | S |
| arch-3, editor-6, export-6, t-tint-8, t-mechanic-10, t-detailing-9, t-wheel-wash-11, t-mobile-9 | Medium | V | visual | `exportHtml.js:111` | 8 font options and several weights never load live; heading slot ignored in 10 templates | `fontCatalog` + `buildFontHref` | S |
| arch-2, editor-5, t-tint-5, t-detailing-10, t-mobile-10, t-mechanic-11 | Medium | VC | visual | `TintElite.jsx:28` | Colors only partly applied; no contrast guard | Token contract; `supports` hides no-op controls | L |
| arch-6, editor-10, t-wheel-wash-8, t-mechanic-8, t-mobile-8, t-tint-3, t-detailing-4 | Medium | VC | ux | `ContentEditor.jsx:451-555` | Section registries drift; unordered blocks; template switch sends new sections to 999 | Section manifests; merge-not-999; DOM-order render | M |
| arch-5, t-mechanic-7, t-wheel-wash-9 | Medium | V | bug | `ContentEditor.jsx:859-866` | One edit injects 6 mobile-detailing cards into mechanic and car-wash sites | Per-type defaults (new work: none exist in fallbacks) | S |
| editor-3, t-tint-4, ai-10 | Medium | VC | ux | `ContentEditor.jsx:1005-1064` | ~10 controls with no effect; raw `icon:shield` printed | Capability gating; one icon component; sentinel test | M |
| t-tint-1, t-mechanic-5, t-wheel-wash-3, t-mobile-4, t-detailing-8 | Medium | VC | ux | `TintDark.jsx:82` | Opt-in split hero never stacks (21 templates) | Shared split variant with container rule | S |
| arch-9, editor-11, export-10, t-wheel-wash-10 | Medium | VC | ux | `WebsitePreview.jsx:48-50` | Mobile preview differs from live; no mobile menu anywhere | iframe `srcdoc` preview; per-section container queries | M |
| arch-10, ai-7 | Medium | V | ux | `App.jsx:219-221, 746-751` | Template switch wipes branding; copy keeps old mood; regenerate wipes edits and images | Brand kit; headings as copy; confirm before regenerate | M |
| arch-11, ai-5, ai-6, ai-8, onboard-6, t-tint-7 | Medium | VC | ai | `generate-website.js:54-116` | ~10 content slots never generated; dropped facts; wrong keywords/schema type; long headlines; AI descriptions discarded | Contract-driven schema; facts object; budgets | M |
| ai-3 | Medium | VC | bug | `generate-website.js:121-130` | No validation or ErrorBoundary; missing keys white-screen the editor | Structured outputs; `normalizeCopy`; boundary | S |
| ai-4, onboard-5 | Medium | VC | ux | `StepGenerating.jsx:34-57` | 3 blind attempts (400/500 burn quota); fake progress; no cancel | Background function + Realtime | M |
| ai-9 | Medium | VC | security | `generate-website.js:133-154` | Unauthenticated widget-save as a shared user; wizard place search bypasses auth | Owner-scoped widget; local `places-search` | S |
| editor-1, onboard-1 | Medium | VC | bug | `App.jsx:563-573, 686-693` | Demo edits autosave over a real site and drop images | Isolated demo state; guard `autoSave` | S |
| editor-2 | Medium | VC | bug | `ContentEditor.jsx:294-301` | Upload races; silent autosave failures; no undo or unload guard | Reducer with history; SaveStatus pill | M |
| editor-12 | Medium | V | visual | `ContentEditor.jsx:611-659` | Dimmed, covered canvas; 9px truncated labels | Split layout; labeled rail | M |
| export-8 | Medium | VC | perf | `exportHtml.js:114` | Tailwind Play CDN on every homepage | Inline preflight | S |
| export-9, t-mobile-7 | Medium | V | ux | `public/contact-form.js:29-38` | Contact form lands under the hero on 4 visible templates | `order: 9998` in the live script now; `data-acg-slot` mount later | S |
| export-11, ai-11 | Medium | V | seo | `exportHtml.js:94-105` | Unescaped head; missing canonical/og/LocalBusiness data; no sitemap | `buildHead`; correct subtype; 301 www | M |
| export-12 | Medium | V | arch | `publish-site.js:52-62` | No versions, rollback or published state | `site_versions` + versioned R2 keys | L |
| shell-3, onboard-8 | Medium | VC | arch | `App.jsx:55, 664` | No routing; wizard draft never resumes | Router; "Continue your site" card | M / S |
| shell-5, admin-12 | Medium | VC | ux | `DashboardPage.jsx:524` | Raw template id; no theme action/status; promo modal for Pro users too | `.label`; SiteHeroCard; one inline upsell | S / M |
| shell-6, onboard-11 | Medium | V | maint | `tailwind.config.js:6` | Tokens unused (6 vs ~1,900); "Pro Hub" wordmark | Semantic token classes; codemod; ESLint | M |
| shell-7, ops-11 | Medium | VC | a11y | `AlertProvider.jsx:90-97` | No Dialog/Field primitives; Enter deletes site; unlabeled inputs; widget focus | Primitive kit | M |
| shell-8 | Medium | V | a11y | `design-tokens.js:17` | `#888` text at 3.5:1, mostly ≤12px | `#6b6b6b`; 12px floor | S |
| shell-9 | Medium | V | bug | `AuthContext.jsx:73` | Profile photo never shows | Select `photo_url`; Storage upload | S |
| shell-10, admin-11 | Medium | V | bug | `OverviewPage.jsx:63-72` | Cross-tenant data for admins; onboarding shown on errors | Owner filters; error states; skeletons | S |
| shell-11 | Medium | V | ux | `AppHeader.jsx:75` | Nav overlaps to ~1,060px (owners) / ~1,145px (admins); 3 chromes | Sidebar; one shell | M |
| shell-12 | Medium | VC + G | visual | `CustomDomainPanel.jsx:225` | DNS table unusable on phones (live in production) | Stacked cards | S |
| ops-4, ops-5 | Medium | VC | visual | `scheduler-payload.js:11, 30` | Widget ignores site theme; white on light accents | Server-computed tokens with `onAccent` (§11.2) | M |
| ops-7 | Medium | VC + G | bug | `CustomerDetailPage.jsx:158`; `create-charge.js:81-87` | Charge from profile lists no services; wrong vehicle price client- and server-side (live) | Shared services hook; vehicle select; fix server pricing | S |
| ops-8, ops-9 | Medium | VC / V | ux | `scheduler.js:371-379` | /book appearance half-works; inconsistent saves; races | One "Booking look" panel; atomic merge | M |
| ops-10 | Medium | V | perf | `GeneralTab.jsx:67-81` | ~0.7 MB base64 logo fetched uncached per page view | Storage URL; tiny initial payload | S |
| ops-12 | Medium | VC | ux | `BookingsPage.jsx:88-89` | Wrong booking link; /book not published on enable; poor phone defaults | `bookingShareUrl` requiring `active_ssl`; publish on enable; Agenda view | M |
| admin-2 | Medium | V | bug | `ImpersonationBanner.jsx:80` | Exit signs the customer out everywhere | `scope:'local'` (before any impersonation rollout) | S |
| admin-3 | Medium | VC | perf | `adminUsers.js:12-16` | Unpaginated; silent truncation at 1,000 rows (latent) | Paginated RPC | M |
| admin-5 | Medium | V | security | `admin-impersonate-session.js:158-175` | Audit fails open; no session link; admin chaining | Audit first; cap sessions; block admin targets | M |
| admin-7, admin-8, admin-10 | Medium | V | ux / ai | `AdminAllBookingsTab.jsx:3-7` | No shop column; no AI logging; access controls unwired; notes lost | Admin tables; `ai_calls`; audited access function | M |
| onboard-3, onboard-4 | Medium | VC / V | ux | `TemplateCard.jsx:12-30` | Identical wireframes; thin catalog; tier unused | Live thumbnails; grouping; hoist grid | M-L |
| onboard-7 | Medium | V | ux | `StepBusinessInfo.jsx:656` | Long form; Google lookup last; dropped drafts | Google-first autofill | M |
| onboard-9, onboard-10 | Medium | V | ux | `EditorTour.jsx:270-283` | Broken tour; Help hidden; dead end after publish | Fix tour; next-steps checklist | S |
| onboard-12 | Medium | V + G | legal | `LandingPage.jsx:149-163` | "Free the moment you publish" vs Pro/Connect gating of live features | Free vs Pro lists matching real gating | S |
| t-tint-10, t-mobile-11, t-wheel-wash-12, t-detailing-12 | Medium | V / VC | a11y | `TintObsidian.jsx:535-579` | Template contrast 1.2-3:1; `alt=""`; no `<main>`; endless marquees | Contrast clamp; alt text; reduced motion | M |
| t-tint-11, t-mechanic-12, t-mobile-12, t-detailing-11 | Medium | VC / V | visual | `MechanicIronclad.jsx:265, 380` | Mockup polish lost; wrong Sudsy emoji | Class CSS; restore scale; U+1FAE7 | M |
| admin-1 | Low | VC | arch | `templates.js:25-273` | Catalog code-only; no usage view | `template_catalog` + Templates tab | M |
| admin-4 | Low | VC | security | `saveSite.js:10` | Admin edit path would transfer ownership (latent) | Update without `user_id`; trigger | S |
| admin-6, admin-9 | Low | VC / V | security | `impersonate-claim.js:58-64` | Plaintext tokens kept; popup blocked silently | Null tokens; in-app dialog and link | S |
| t-detailing-7 | Low | VC | ux | `DetailingAutoSyncWhite.jsx:16` | Hidden AutoSyncWhite is desktop-only on phones (1 draft row) | Only if un-hidden | - |
| arch-12 | Low | U | maint | `_g.cjs:410` | Dead generator, unregistered files, `/D/g` tel bug | Delete; fix regex | S |
| t-tint-12 | Low | U (partly via ai-3) | bug | `TintElite.jsx:45, 198` | Unguarded accessor; dead nav anchors | Optional chaining; generated nav | S |
| gap-7 | Low | G | maint | `App.jsx:257-260`; `.env.example:30-33` | Stale "production stays Shopify-only" comment; env example omits `VITE_STRIPE_PUBLISHABLE_KEY` | Update comment or drop indirection; add the variable | S |

### 10.2 Disputed findings

| Findings | Sev (this report) | Status | Area | Anchor | Issue | Dispute | Resolution / fix | Effort |
|---|---|---|---|---|---|---|---|---|
| t-tint-2, export-3, t-mobile-6 | Medium (kept in Phase 0) | D | visual | `TintElite.jsx:52`; `MobileChrome.jsx:48` | Sticky nav transparent forever on published Elite and Chrome | Code-truth rated High; both impact verifiers said Medium (cosmetic, links work). Live data: tint_elite has 0 published sites; mobile_chrome has 7 | Medium, but fixed this week: a one-line opaque default for 7 live sites; CSS `data-scrolled` later | S |
| shell-4 | Low (latent) | D | bug | `DashboardPage.jsx:477-493` | Thumbnails run live scripts and would count owner visits as views | Code says it would; data shows no dashboard-referrer rows, because the beacon itself fails (gap-1) | Becomes real once gap-1 is fixed, so ship the no-track guard with it | S |
| t-mechanic-3 | Low | D | visual | `MechanicFriendly.jsx:99` | White-on-white headings | Real code defect; 0 rows use the template | Delete the template (0 rows) | S |

### 10.3 Resolved disputes (kept in §10.1)

| Item | Dispute | Resolution |
|---|---|---|
| export-1 scope | Engineering judge: guard limits it to first publishes. Verifiers: any owner can rewrite their slug. | Lead check + G: no column limit, clients hold UPDATE on `slug`, a cross-customer duplicate exists. Critical. |
| arch-1 severity | Critical vs High (data recoverable). | Critical as a risk; help docs send owners to the button; 15 live sites exposed. |
| "42 of 48 show the placeholder" | DB-inferred. | Replaced by the crawl: 32 of 37 live website pages. |
| Stripe/custom domain "branch-only" | Critic suspected flags off in production. | Refuted by the production bundle: both on (§7.0). |
| Garage "hidden" | One verifier cited `templates.js:153`. | Visible (`templates.js:142-152`). |
| ai-3 thinking-block crash | Hypothetical on sonnet-4-6. | Real on migration to Opus 5; read the text block, not `content[0]`. |
| onboard-1 "forces regeneration" | Back to step 3 already regenerates. | Autosave leak is real; regeneration cost is not demo-caused. |
| editor-1 scope | Initially "customer sites". | Super-admins' own sites, plus owners in onboard-1's path. |
| Architecture winner | 2 of 3 judges picked Schema-Driven; mean favored Evolve. | All three recommended the same hybrid (§11.1). |

Refuted: no whole findings; about 12 sub-claims dropped (§0).

---

## 11. Recommended target architecture: Theme System v2

### 11.1 How the winner was chosen

Three proposals: **Evolve in Place** (keep React templates; add tokens, manifests and a primitive kit template by template), **Schema-Driven Section Library + Design Tokens** (themes become data rendered by a shared library), and **AI-Native Theme Studio** (Schema-Driven plus a runtime command bar and Claude-authored variants).

| Proposal | Experience judge | Engineering judge | AI judge | Mean | Picked by |
|---|---|---|---|---|---|
| Evolve in Place | 7.70 | **8.05** | 7.00 | **7.58** | Engineering |
| Schema-Driven Section Library + Tokens | **7.95** | 6.55 | **7.35** | 7.28 | Experience, AI |
| AI-Native Theme Studio | 7.75 | 5.45 | 7.18 | 6.79 | none |

Weights: **Experience** look/feel 0.30, business value 0.30, safety 0.15, AI leverage 0.15, migration 0.10. **Engineering** safety 0.30, migration 0.25, value 0.20, look 0.15, AI 0.10. **AI** AI leverage 0.35, safety 0.20, others 0.15 each.

**Objections.** AI-Native: its registry used `import.meta.glob`, which the esbuild-bundled server can't resolve; its runtime cost of $0.40-0.90 per site is 15-30x today's on a $19.99/month product with a free tier; its latency targets are unrealistic. Schema-Driven: its schedule assumes 3 engineers, but the repo shows one (**lead check:** 557 commits, one author under three spellings), and it wrote mappers for hidden templates with no published sites. Evolve: its ceiling is 10 bespoke React files and a preview that still isn't the published HTML.

**Decision.** Build the Schema-Driven end state with Evolve-in-Place's sequencing and risk controls, plus four AI-Native grafts: a palette-swap gate, a mobile Call/Book bar, an edit revision log with source and prompt, and a curated-preset fallback when Claude refuses. All three judges converged on this hybrid independently.

### 11.2 Core design

1. **Brand kit to tokens.** Owners edit a brand color, optional second color, light/dark mode, logo and a font pairing. `deriveTokens()` expands these into `bg`, `surface`, `surfaceAlt`, `text`, `textMuted`, `accent`, `onAccent`, `accentText`, `accent2`, `border`, `focus`, `heroScrim`, `onHero`, adjusted in OKLCH until text pairs reach 4.5:1, emitted as `--acg-*` properties. Type, shape, density, motion, imagery and a decorative motif are tokens too, so Ironclad's steel plate or Bubble's blobs become motifs.
2. **Section library.** About 16 types (nav, hero, marquee, stats/trust, services, process, features, brands, warranty, about, hours, gallery, reviews, cta, contact, faq, footer) and about 45 variants, each traced to an existing template or mockup. Sections render in real DOM order; reorder and hide are array operations.
3. **One contract per section type.** `defineSection({ type, schema, variants, bind, requires, defaults, emptyState })` with zod. `.meta()` picks the editor widget; `.describe()` is what Claude sees. `FactRef` stats bind to real facts (missing fact, no tile). Reviews accept only `source: 'google' | 'owner'` (with `attestedAt`). `emptyState` (`hide`, `fallback-variant`, `motif`) decides what publishes when a slot is empty, so editor placeholders can't leak. `edit.field()` emits `data-acg-*` hooks in edit mode only.
4. **Rendering.** An isomorphic `renderSiteHtml(spec, biz, {mode, appOrigin, widgetConfigs})` emits tokens, a ~2 KB inlined preflight, CSS for only the variants used, one font URL from the tokens, and a runtime under 2 KB (`acg-runtime.js`) for the scrolled nav (base style already opaque), reveal on scroll, "open now" from real hours and the copyright year. Mobile menus use `<details>`; hover sits behind `@media (hover:hover)`, motion behind `prefers-reduced-motion`; the hero is an `<img fetchpriority=high srcset>` with a focal point.
5. **Preview equals production.** The editor shows an iframe `srcdoc` of the same HTML at 390, 768 and 1280px; token edits post as CSS variables; content edits re-render one section.
6. **Server publish.** A Netlify function loads the row, runs `resolveSite(row)` (one unpack path), renders with a constant canonical `appOrigin`, and writes a versioned R2 key. The client no longer sends HTML, slug or `isPro`.
7. **Widgets share the theme.** Today the booking modal, `/book` page and contact form have their own palettes (`scheduler.js:198-345`; `#1a1a1a` fallback at `scheduler-payload.js:11`). In v2, `buildSchedulerPayload` returns the site's derived tokens (`bg`, `surface`, `text`, `accent`, `onAccent`, `accentText`, radius, fonts) from `template_id` plus the brand kit; "Match my website" becomes the default modal theme; the widgets render inside a Shadow DOM root with a small `--acg-*` stylesheet so template CSS (and the export's grid hack) can't reach them. `normalizeAppearance` moves into one pure shared module (it exists twice today, `_lib/appearance.js:1-34` vs `schedulerConfig.js:28-61`).

### 11.3 Example theme spec (condensed)

```json
{
  "schemaVersion": 2,
  "preset": { "id": "ironclad", "version": 3 },
  "rendererVersion": "2.0.0",
  "brand": { "primary": "#C0392B", "secondary": "#F39C12", "mode": "dark",
             "fontPair": "bebas-barlow", "logo": "logo" },
  "tokens": {
    "recipe": { "neutralHue": 30, "surfaceSteps": [0.14, 0.18, 0.22] },
    "overrides": {},
    "type":   { "display": "Bebas Neue", "label": "Barlow Condensed", "body": "Barlow",
                "scale": "punchy", "case": { "display": "upper" } },
    "shape":  { "radius": "sharp", "button": "parallelogram" },
    "motion": { "level": "subtle", "reveal": "rise", "hover": "rule-grow" },
    "imagery":{ "hero": "scrim-left", "noPhotoFallback": "motif" },
    "motif":  { "id": "steel-plate", "hatch": true }
  },
  "sections": [
    { "id": "nav", "type": "nav", "variant": "bar-phone-cta",
      "props": { "mobile": { "menu": "details-sheet", "stickyActionBar": ["call", "book"] } } },
    { "id": "hero", "type": "hero", "variant": "overlay-left", "tone": "inverse",
      "props": { "headline": { "lead": "No job too", "accent": "heavy." },
                 "stats": [ { "fact": "yearsInBusiness", "label": "Years in Mesa" },
                            { "fact": "googleRating", "label": "On Google" } ] } },
    { "id": "services", "type": "services", "variant": "cards-numbered", "tone": "alt",
      "props": { "showPrices": true } },
    { "id": "whyUs", "type": "features", "variant": "grid-4" },
    { "id": "reviews", "type": "reviews", "variant": "google-widget",
      "props": { "source": "google", "emptyVariant": "review-us-cta" } },
    { "id": "contact", "type": "contact", "variant": "details-hours-form", "props": { "formSlot": true } },
    { "id": "footer", "type": "footer", "variant": "columns" }
  ]
}
```

Only `brand`, `recipe`/`overrides`, `sections` and assets are stored; derived colors and the contrast report are recomputed on every save and render.

### 11.4 Example section contract

```js
// src/theme/sections/whyUs/index.js
export default defineSection({
  type: 'whyUs',
  label: 'Why choose us',
  schema: z.object({
    eyebrow: Text({ max: 32, ai: 'Short kicker. No numbers, ratings or claims.' }).optional(),
    title:   Headline({ maxWords: 5 }),               // replaces hardcoded "WE DON'T CUT CORNERS."
    cards: z.array(z.object({
      icon:  z.enum(ICON_IDS),                          // one <Icon>, never raw 'icon:shield'
      title: Text({ max: 28 }),
      body:  Text({ max: 140, ai: 'Only from FACTS.' }),
      fact:  FactRef(['warrantyOffered', 'certifications', 'yearsInBusiness']).optional(),
    }).strict()).min(3).max(6),
  }).strict(),
  // Transitional: paths map onto EXISTING generated_content keys, so no data migration.
  paths:  { cards: 'whyCards', title: 'sections.whyUs.title' },
  // NEW WORK (Phase 1): templateFallbacks.js has no whyCards/howSteps today; these
  // per-business-type defaults must be written, replacing template literals and editor seeds.
  defaults: ({ businessType }) => whyUsDefaults[businessType],
  emptyState: 'hide',
  variants: { 'hex-grid': HexGrid, 'pastel-cards': PastelCards, 'glass-cards': GlassCards },
});
```

| Consumer | How it uses the contract |
|---|---|
| Renderer | Validates props, binds facts, renders the variant; CSS emitted once per page |
| Editor (`SchemaForm`) | Builds fields from `.meta()`, hides unsupported fields, shows character counters |
| Claude | `buildGenerationSchema(preset, businessType)` builds `output_config.format`; length bounds stripped for the API and enforced by zod after parsing; schemas keyed by preset version and business type so the compiled-schema cache stays warm |
| Validation | `ThemeSpec.safeParse` on load, autosave, publish and after generation; `migrateThemeSpec` for version changes |
| Tests | Sentinel test (every editable field appears in HTML), palette-swap test, axe, overflow, placeholder scan on 3 fixtures x 390/768/1280 |

### 11.5 Persistence and versioning

- **Transitional.** Contract paths point at existing `generated_content` keys; code writes both `_customColors`/`_customFonts` and the new `_theme`/brand kit, so rolling back to the legacy renderer needs no data reversal. A proper `sites.theme` column follows once all visible templates are converted.
- **New tables** (after snapshotting the live schema, §8): `site_versions` (version, preset and its version, content, `r2_key`, `published_at`, `published_by`); `template_catalog` (status, tier, business types, sort order, thumbnails); `ai_calls` (route, model, effort, `stop_reason`, usage, latency, site); `site_generations` (streaming state); `theme_spec_revisions` (RFC 6902 patches with source owner/claude/admin and prompt).
- **New `sites` columns:** `published_at`, `published_version`, `renderer_version`.
- **R2:** write `{slug}/v/{n}/index.html`, then promote, giving one-click rollback and an "Unpublished changes" chip.

### 11.6 Migrating templates and existing sites

**Visible templates, one per release**, behind `renderer_version`, each passing the gates against v1 baseline screenshots. Order by live sites x severity, with the lowest-risk pilot first (G data):

| # | Preset | Live / rows | Why here |
|---|---|---|---|
| 1 | mobile_chrome | 7 / 15 | Pilot: many live sites, zero custom overrides; fixes the transparent nav and silver-gradient color lock |
| 2 | detailing_sporty | 8 / 19 | Only detailing option; "Real Reviews" and fake stats; 1 published override row to hold back |
| 3 | mechanic_ironclad | 5 / 7 | "Verified Customer", invisible Services edits; 2 override rows |
| 4 | mechanic_garage | 5 / 7 | Invented hours |
| 5 | tint_obsidian | 5 / 10 | Shades tab (build or remove); 2 override rows, 1 on a custom domain |
| 6 | mechanic_industrial | 4 / 6 | Invisible Services edits; hours order |
| 7 | mobile_sudsy | 4 / 10 | Restore motion, fix emoji; 1 custom domain |
| 8 | carwash_bubble | 3 / 8 | Only car-wash option; fake claims |
| 9 | wheel_apex | 3 / 6 | Custom-domain site overrides all 5 colors, which will suddenly apply: owner before/after first |
| 10 | tint_elite | 0 / 3 | No customer usage: convert last or fold into Obsidian |

**Hidden templates.** Phase 0 fixes only, then freeze. Keep the five with draft rows (autosync_dark, coastal, mobile_bold, wheel_clean, autosync_white) and their map entries until their 12 drafts are migrated or abandoned, because two non-admin users' only site is such a draft. Delete now: the six zero-row templates (mobile_modern, mobile_rugged, wheel_edge, tint_dark, tint_sleek, mechanic_friendly), `DetailingMinimal`, `DetailingPremium`, `_g.cjs` and the unused `IconOrEmoji`.

**The published sites.** For each converted preset: backfill new copy slots through the Batches API into drafts; hide AI testimonials where no real reviews exist; produce a dry-run render diff **against the crawled live HTML, not just the draft** (gap-2); rebuild with a `site_versions` row; email the owner. Hold back the 6 published rows with custom colors/fonts (2 Ironclad, 2 Obsidian, 1 Apex, 1 Sporty) and every drifted site in §5.4 for an owner-approved before/after.

### 11.7 Build-pipeline prerequisites (confirmed, gap-5)

Server rendering is the backbone of slug authority, versioned snapshots, bulk rebuilds and backfill. Today a Netlify function **could bundle** `exportHtml` plus the templates without a build error but **would crash twice at runtime** (confirmed from the zip-it-and-ship-it bundler source, not by running it):

1. **Cold start.** Functions use `node_bundler = "esbuild"` (`netlify.toml:10`) with v1 handlers, so they bundle as CommonJS, where `import.meta` becomes an empty object. `exportHtml.js:5` imports `supabase.js`, whose line 3 reads `import.meta.env.VITE_SUPABASE_URL` and throws on load. `exportHtml.js:236-239` also queries `widget_configs` through that browser client.
2. **Render.** The bundler passes no `jsx` option and the repo has no `jsconfig.json`/`tsconfig.json`, so esbuild uses the classic `React.createElement` transform. 17 of 23 template files import only hooks, and the shared `ServiceCardParts.jsx`, `SocialIcons.jsx` and `IconOrEmoji.jsx` import nothing, while all 21 registered templates render `<ServiceCardCss />` and 20 render `<SocialRow>`. So **all 21** throw "React is not defined".

Not blockers: browser globals (all inside `useEffect`); Tailwind (CDN); the missing `react`/`react-dom` in `netlify/functions/package.json`. **Do not add them there**: esbuild resolves `src/**` imports from the root `node_modules`, and a second React copy breaks hooks.

**Minimal fix (~half a day):** a root `jsconfig.json` with `{"compilerOptions":{"jsx":"react-jsx"}}` (the bundled esbuild reads it) or a pre-bundle step with `--jsx=automatic`; split `buildHtmlString` (`exportHtml.js:217-311`) into a supabase-free `src/lib/renderSite.js` taking `widgetConfigs` and `appOrigin` as arguments; move `normalizeAppearance` into a pure shared module. **Origin parity** is part of this: `exportHtml.js:7-20` falls back to `app.autocaregenius.com` for widgets (absent from `MAIN_HOSTS`) and `sitebuilder.` for the owner link, while the editor uses `window.location.origin`.

Other constraints: no `import.meta.glob` or browser globals in anything rendered on the server (generate `sections/index.js` instead); enforce with ESLint `no-restricted-globals` and a Node smoke test; include booking-only pages (`publishBookingPage`, `site_type booking_only`); slug authority (export-1) must ship before server publishing, and the `saveSite` `user_id` fix (admin-4) before any admin editing or bulk rebuild.

---

## 12. Claude-powered theme creation

Model facts as of 2026-09 (from the upgrade plan): `claude-opus-5` $5/$25 per million input/output tokens; `claude-opus-5-5` $4/$20, launching; `claude-sonnet-5` $2/$10; `claude-sonnet-4-6`, used today, is the previous generation at $3/$15.

### 12.1 Dev-time theme factory

Where Claude cuts theme-creation time the most. Gated to `src/theme/sections/**`; always ends in a human PR.

1. **Decompose.** Opus at effort `high` reads the mockup HTML, screenshots and the variant catalog and returns a `DecompositionPlan`: variants to reuse, new ones with contracts, and tokens.
2. **Author.** Claude Code at `xhigh`, in a worktree, writes the variant `.jsx`, `.css`, contract and preset JSON.
3. **Gates** (`npm run theme:check`): zod validation of contract and preset; ESLint bans hooks, `window`, `on*` handlers and hex literals in sections; the content-coverage test; `renderSiteHtml` for 3 fixture businesses x 3 palettes at 390/768/1280; axe contrast, no horizontal overflow, no placeholder text, no empty badges, no invented numbers, no transparent sticky nav; a palette-swap diff (which would have caught WheelApex); CSS ≤ 4 KB per variant.
4. **Vision review.** Claude compares mockup and render screenshots and returns a fidelity score and issues; at most 4 rounds before the PR.
5. **Human review** of a PR with a screenshot gallery.

First targets: the 10 visible ports (restoring lost motion and hover), then `apex-wheel-shop-v2.html` as the flagship wheel preset. Estimated $2-10 per mockup. **Admin preset authoring:** a brief (plus optional screenshot) yields a preset made only of existing variants, as JSON, saved as a draft that must pass the same gates before promotion.

### 12.2 Set up Claude Code in this repo

This is the most direct lever on "maximize theme creation with Claude's new version", and none of it exists: `.claude/` holds only `launch.json`, `settings.local.json` and `worktrees`, and there is no `CLAUDE.md` (lead check).

- **`CLAUDE.md`:** the template contract (4 props; `templateMeta` merge; `images` map); render-path rules (static export, so no hooks, `window` or `onMouseEnter` in render output; no hex literals once tokens exist; no invented numbers, ratings or reviews; editor-only UI behind EditorContext; every top-level block gets `order` + `hidden`); where to register a template today (§3.4 list) and in v2 (one manifest); commands (`npm test`, `npm run theme:check`); the live DB project id and that DB writes need explicit approval.
- **`/new-theme` project skill** (`.claude/skills/new-theme/SKILL.md`) wrapping §12.1's decompose, author, gates and vision-review loop, with the mockup path as its argument.
- **`theme-reviewer` subagent** (`.claude/agents/theme-reviewer.md`): read-only, runs the render suite and screenshot rubric, reports failures by file:line.
- **Hook** in project `.claude/settings.json`: PostToolUse on Edit/Write matching `src/components/preview/templates/**`, `src/theme/**` or `src/lib/exportHtml.js` runs `npm run theme:check` (Phase 0: the vitest render suite in §14.3).

### 12.3 Runtime AI features

All reuse the cached system-plus-facts prefix, return structured output, and treat owner text as data.

| Feature | Behavior | Settings |
|---|---|---|
| **Full copy fill** | Fills every slot the chosen preset renders | Opus, effort `medium` (A/B vs `low`), background function, streaming |
| **Theme Director** (generate first, then choose) | Reads the logo, up to 3 shop photos and extracted colors; returns 3 proposals differing in archetype, light/dark and base preset (brand seeds, catalog font pair, variant enums, rationale); code runs `deriveTokens` and repairs contrast; results render as live thumbnails with the owner's content | `medium`, max_tokens 8000, ~$0.06-0.12 |
| **Section rewrite** | 3 variants with a word diff; Use/Undo; 60/day; also "Rewrite for this template" after a switch | `low`, ~$0.02-0.04 |
| **Tone slider** | Friendly-Premium, Laid-back-High-energy; rewrites only fields not typed by the owner (`copy._edited`) | `low` |
| **Photo intelligence** | Slot suggestion, alt text, focal point, low-quality flags | `low`, ~$0.02/photo |
| **Plain-English theme edits** (after the editor rebuild) | `ThemePatch` limited to contract paths, variant enums, catalog fonts; preview and undo; logged | `low` |
| **Backfill** | New slots for existing sites from stored facts, into drafts | Batches API (50% off); Batches rejects `fallbacks`, so refusals are re-sent as normal calls |

### 12.4 Models and settings

- **Every route:** `thinking:{type:'adaptive'}` with effort set explicitly; `output_config.format` JSON schema; no forced `tool_choice`; thinking never disabled; streaming with `finalMessage()`; `fallbacks:'default'` plus beta `server-side-fallback-2026-07-01` (not on Batches); `cache_control` on the frozen prefix, verified via `usage.cache_read_input_tokens`; `stop_reason` handling for `refusal` and `max_tokens`; every call logged to `ai_calls`.
- **Model per route from env** (`AI_MODEL_GENERATE`, `AI_MODEL_REWRITE`), because prompt caches are per model.
- **"Claude's new version."** If that means Opus 5.5 (`claude-opus-5-5`), this design is already compatible: it never forces `tool_choice` (400 on 5.5), never disables thinking (not allowed on 5.5), and sets effort explicitly (5.5 defaults to `medium`). It is about 20% cheaper at equal tokens. Switch a route only after it passes §12.6; `claude-sonnet-5` is the candidate for cheap, high-volume routes if its evals hold.

### 12.5 Guardrails

- Runtime Claude never emits code, CSS or HTML; only JSON restricted to variant enums, catalog fonts and `^#[0-9A-F]{6}$` colors; strings may not contain `<`.
- No testimonial slot in any schema; numbers only via `FactRef`; `normalizeCopy` rejects numerals, %, star ratings, "since YYYY", "N+ years", brands, certifications or superlatives ("#1", "verified", "guaranteed", "financing") not backed by facts.
- Deterministic contrast repair; publish-time scan of final HTML for placeholders and banned claims.
- Owner text wrapped in `<owner_instruction>` and treated as data.
- Per-plan daily quotas; failed runs refund quota.
- If Claude still refuses after fallbacks, serve the business type's top curated preset with deterministic copy.

### 12.6 Evals

- **Set:** 30 profiles (6 business types x minimal facts, rich facts, 22+ services, awkward strings, claim-heavy tagline).
- **Blocking checks:** 100% schema pass; 0 invented facts; no testimonial keys; city mentions within limits; `metaDescription` 140-160 characters; word budgets met ≥95%; every service name from the facts.
- **LLM judge:** Sonnet 5 (never the model under test), structured pass/fail; blind side-by-sides against a saved baseline for model or prompt changes.
- **Theme directions:** 100% WCAG AA after repair; accents differ by ΔE ≥ 20; all fonts in the catalog.
- **When:** through Batches before any change to model, effort, prompt or schema, ~$5 per run. Record today's baseline first.

### 12.7 Why not generate whole templates at runtime

Runtime-generated JSX would multiply every defect class in §10 and can't be gated per request. Runtime Claude chooses among tested variants; dev-time Claude creates variants under gates.

### 12.8 Cost and latency per site

| Item | Estimate |
|---|---|
| Today (sonnet-4-6) | $0.02-0.03 per generation (up to ~$0.09 with retries) |
| Copy generation v2 | $0.08-0.15 |
| Theme Director | $0.06-0.12 |
| Typical editing (5 rewrites, 1 tone change, 3 theme edits) | $0.25-0.35 |
| **v2 total per active site** | **about $0.40-0.60** |
| Backfill of the published sites | under $3 total |
| Quota cap per user per day | about $3 |

Plan for 30-90 s for full generation, hence the background function, Realtime streaming and immediate curated thumbnails. The AI-native claim of "first direction in 8 s" was judged unrealistic.

---

## 13. Dashboard and admin redesign plan (condensed)

1. **Design tokens v2.** `design-tokens.js` becomes the only source (Tailwind imports it; the build emits CSS variables). Semantic classes: `bg-canvas`, `bg-surface`, `bg-sunken`, `text-fg`, `text-fg-muted`, `text-fg-subtle` (#6b6b6b, 5.3:1), `border-line-*`, `bg-brand*`, status fg/bg pairs; brand-red focus ring; type scale 12/16 to 28/34 with a 12px floor; Outfit as sans; radius 8/12/full; one z-index scale (sticky 10 to tour 70); motion tokens with reduced-motion built in; no dark mode yet; ESLint bans hex and gray/slate/zinc classes outside templates.
2. **15 primitives** plus an admin-only `/ui` gallery: Button, IconButton, Field + Input/Select/Textarea (`useId`), Card, Dialog/Drawer (focus trap, Escape, restore; bottom sheet on phones), Menu, DataList (table on desktop, cards on mobile), Tabs/SegmentedControl/FilterChips, StatusPill (one status-to-tone map), EmptyState, Skeleton, Toast (errors persist), PageHeader/Container, SaveStatus.
3. **Information architecture.** react-router with AppShell as layout route. Routes: `/home` (Overview + Sites), `/sites/new/:step`, `/sites/:id/edit?panel=&device=`, `/sites/:id/theme`, `/bookings?view=agenda|week|month|list`, `/customers/:key`, `/inquiries/:id`, `/payments`, `/settings/*`, `/admin/{overview, accounts, bookings, templates, gallery, ai, changelog}`. Stripe and Connect return URLs point at real routes (both flows are live, §7.0). Sidebar at `lg`+, bottom tab bar plus drawer below. The wizard gets a focus mode in the same shell with a 4-step stepper.
4. **Pages.** **Home:** hero card with a publish-time screenshot, theme label and swatches, Live/Draft/Unpublished-changes chip, Customize/Change theme/View live; setup checklist; "Continue your site" card; one inline upsell card. The analytics card ships only after gap-1 is fixed and has collected real data. **Bookings:** Agenda on phones, Week on desktop. **Booking settings:** one save model; one "Booking look" panel defaulting to "Match my website". **Admin Templates:** thumbnails of every template including hidden, catalog status and tier, usage and publish-rate stats (§3.5 query as an RPC), honored settings, gate results, preview by any id, dry-run "Rebuild all on this template". **Admin Accounts:** paginated RPC with a template column and an audited Access section.
5. **Editor chrome.** Canvas resizes instead of being covered; no backdrop; top bar with device toggle, undo/redo, SaveStatus, Publish with an unpublished dot; a 380px rail generated from manifests (drag handle, full 13px label, eye toggle, fields expanding in place); click-to-edit via `data-section`/`data-field`; Brand panel with contrast badges.
6. **Using Claude for the migration.** A jscodeshift codemod from the token mapping table, one directory per PR with screenshot diffs; primitives built against a contract (keyboard map, ARIA, axe, Playwright); page migrations must not change behavior (reject diffs touching `.from(` calls); a Claude vision rubric reviews every route at 390/768/1280.

---

## 14. Roadmap

### 14.1 Phases

Effort in engineer-weeks. One developer plus Claude Code: about 30-34 engineer-weeks, 7-8 months, shipping monthly.

| Phase | Goal | Deliverables | Effort | Depends on |
|---|---|---|---|---|
| **0. Stabilize, comply, roll out** | Stop live damage and legal exposure, and actually reach the live sites | "Fix this week" items; the list below; §14.2 rollout; §14.3 render test suite | 3.5-4 | - |
| **1. Foundations** | Contracts and gates everything needs | List below | 4-5 | 0 |
| **2. Section library + visible presets** | Replace hand-written templates, one per release | ~16 types / ~45 variants and motifs via the §12.1 factory; the 10 presets in §11.6 order behind `renderer_version`; each passes gates and deletes its `TOGGLEABLE` entry; hidden templates frozen | 7-8 | 1 |
| **3. Claude v2** | Complete, fact-bound copy; brand-matched directions | Background streaming generation; Theme Director onboarding with live thumbnails; section rewrite and tone; photo intelligence; model A/B via eval | 3 | 1; starts after the mobile_chrome pilot |
| **4. Editor v2** | Site-builder feel on manifests | Split layout, manifest rail, iframe device preview, click-to-edit, variant switcher, reducer with undo/redo, SaveStatus, unload guard, isolated demo, ~6-step tour | 4-5 | 1; 2 in progress |
| **5. Dashboard shell** | One consistent product | Router, sidebar/tab bar, Home, Bookings (after the time fix), Customers, Inquiries, Payments, Booking settings, Settings; Change-theme gallery with the owner's content | 4-5 | 1 (primitives) |
| **6. Admin ops + fleet cutover** | Theme operations without deploys; retire legacy code | `template_catalog` + Templates tab, stats RPC, gallery, AI tab, paginated accounts, impersonation hardening; Batches backfill, dry-run rebuilds, owner emails; delete legacy templates, `TOGGLEABLE`, `isXxx` flags and export hacks | 4 | 2, versions |

**Phase 0 deliverables:** all fix-this-week items; testimonial and claims removal with truthful wizard/editor copy; `trustFacts`; EditorContext; `buildFontHref`; inlined preflight instead of the Tailwind CDN; `tp-root` scoping (plus the live `scheduler.js`/`contact-form.js` fixes); opaque navs; logo alpha; slug authority; head escaping and schema type from business type; a "Preview as published" iframe toggle; the gap-5 server-render unblock (`jsconfig.json`, `renderSite.js`, constant origin), pulled forward because the rollout needs it; the beacon fix.

**Phase 1 deliverables:** `deriveTokens` and `fontCatalog`; zod `defineSection` and `FactRef`; per-business-type defaults for whyCards/howSteps (new); a codegen'd section index; `renderSiteHtml` and the runtime; the iframe `PreviewFrame`; Playwright + axe and v1 baseline screenshots; a live-schema snapshot, then `site_versions`, `ai_calls`, `site_generations`, `theme_spec_revisions`; the server renderer function; SDK upgrade and zod; eval baseline; design tokens v2, ESLint rule and the 15 primitives; widget token payload and Shadow DOM widgets; the in-repo Claude Code setup (§12.2).

### 14.2 Phase 0 rollout: getting fixes onto live sites

Nothing in the product can push a fix to a live site today: only the owner's browser session can publish, admin has no publish path, and the one bulk tool (dashboard Republish) strips images and branding. 29 of 37 live website pages were last published before June 2026, so template fixes won't reach them on their own. **The super-admin owns the rollout.**

1. **Preconditions (ship first):** the Republish fix (`resolveSiteRender`); slug-authority step (a) and the stored-slug fix (export-4); `signOut({scope:'local'})` (admin-2), because the rollout may use impersonation; the template fixes (placeholders, awards, navs, fonts, testimonial gating); truthful wizard/editor review copy. **Do not tell owners to republish before these ship.**
2. **Same-day stopgaps through the live channel:** the calendar fix in `scheduler.js` (served `max-age=0`) reaches the 38 pages loading it from the production origin; the order fix in `contact-form.js` reaches the 8 pages that load it. JS hiding is not a legal fix for fake reviews (crawlers still see the text). If immediate legal exposure requires it, a script holding the Cloudflare token (not present locally) can strip the testimonial section from each `{slug}/index.html` in R2, matching that site's known placeholder quotes; the ownership check lives in the function, not R2.
3. **Data step (service-role SQL):** add `'testimonials'` to `generated_content.hiddenSections` for sites with no `googleWidgetKey` and no attested reviews, **skipping sites whose live page shows real reviews** (`nxt-premium-detailing`). Templates honor it (e.g. `TintDark.jsx:39, 374`).
4. **Dry run per site:** render each site from its draft and diff against the crawled live HTML (images, colors, template, reviews). Hold back the drifted sites (§5.4) and the custom-color sites for owner review.
5. **Re-render**, either (a) impersonation -> Edit -> Publish, site by site (~41 sessions, each with a written reason), or (b) a rebuild script pulled forward from Phase 1: run via `vite-node` (handles JSX and `import.meta.env`) with the service-role key, following `scripts/backfill-site-images.mjs:41-57`; pass `appOrigin = https://sitebuilder.autocaregenius.com` explicitly (the Node fallback host isn't served) and `widgetConfigs` explicitly; write R2 the way `publish-site.js:52-62` does; rewrite `/book` when `scheduler_enabled` (`publishSite.js:22-26`); **copy each current `index.html` to a dated backup key before overwriting**, since there is no versioning yet. This also repairs the stale scheduler origins (titos-car-wash, mike-auto-detaiing).
6. **Duplicate slugs:** decide who keeps `malpica-detailing` with both owners; re-slug the other row(s) and republish; clean up the admin/test duplicates; then create the unique index (§1 item 1).
7. **Outreach:** email the owners in §5.6 (missing images, fake-review labels, scheduler origin, slug dispute) explaining what changed. Owner emails come from joining `sites.user_id` to `auth.users`.
8. **Fix the Worker's `/book` route** (gap-3) and re-crawl all sites to confirm: no "Images tab", no "Verified Customer"/"Real Reviews" on AI text, one scheduler origin.

### 14.3 Test-infrastructure baseline

`vitest ^2.1.9` exists with about 30 test files covering `src/lib`, `netlify/functions/_shared` and `tests/functions`, but none render a template or the export, and there is no Playwright or axe dependency (lead check). The cheapest first gate needs no browser:

- **Phase 0:** a vitest suite that runs `exportHtmlString` (Supabase widget fetch stubbed) or `renderToStaticMarkup` for all 21 templates with sparse, typical, long-string and missing-`servicesSection` fixtures. Assert: no throw; no "Images tab"/"Upload a" text; no empty award element; no "Verified Customer"/"Real Reviews" unless the source is Google; sticky nav background not `transparent`; heading font loaded in the font URL. Vitest runs through Vite's transforms, so the automatic JSX runtime and `import.meta.env` already work; it does not wait on gap-5. This suite is the first `theme:check` and the §12.2 hook target.
- **Phase 1:** add `@playwright/test` and `axe-core`; screenshots at 390/768/1280; contrast, overflow and palette-swap gates; v1 baselines per template.

### 14.4 Quick wins (less than a day each)

- `.label` on the Sites card; stop the promo modal auto-opening (and showing to Pro users).
- `#888` -> `#6b6b6b` in both token files; Tailwind imports `design-tokens.js`; Outfit as sans; drop the duplicate Outfit import.
- "Pro Hub" -> "Genius Websites".
- Delete confirmation focuses Cancel; error toasts persist.
- `photo_url` in the profile select; `signOut({scope:'local'})`.
- Demo autosave guard; no tour in demo mode.
- Opaque default nav on TintElite and MobileChrome.
- `awards?.length > 0` codemod; Elite `paymentMethods?.length`.
- Garage reads `warrantyOffered`.
- `/D/g` -> `/\D/g` (`DetailingAutoSyncWhite.jsx:436`); `0x1FAA7` -> `0x1FAE7` (Sudsy).
- Remove the editor backdrop and truncated rail labels.
- Stop re-seeding deleted booking services.
- Logo PNG/SVG passthrough.
- "Continue your site" card instead of the unconditional `handleStartOver`.
- Beacon: `text/plain` Blob or `fetch` keepalive without credentials.
- `bookingShareUrl` requires `active_ssl`.
- Update the stale Stripe comment; add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env.example`.
- Add `CLAUDE.md` (§12.2).

### 14.5 What not to do

- **Don't have Claude write more monolithic JSX templates.** That multiplies every bug in §10.
- **Don't big-bang convert all templates**, and don't write migration mappers for hidden templates; don't delete the five hidden templates that still have drafts.
- **Don't bulk-republish from drafts** without the per-site diff and a backup of the live HTML, and not before the Republish fix and slug authority.
- **Don't revoke client writes to `sites.slug` before** `publish-site` claims slugs server-side and booking-only setup stops inserting them.
- **Don't move publishing server-side before slug authority**, and don't expose admin theme editing before the `saveSite` `user_id` fix.
- **Don't add `react`/`react-dom` to `netlify/functions/package.json`**, and don't use `import.meta.glob` or browser globals in server-rendered code.
- **Don't let runtime Claude emit code, CSS or HTML, or any unfounded number.** No "AI testimonials" in any form; nothing labeled "Verified" unless it comes from Google; no wizard copy promising reviews that won't appear.
- **Don't switch models or effort without the eval.** Don't force `tool_choice` or disable thinking; both break Opus 5.5.
- **Don't adopt server rendering with React hydration** for published sites (~45 KB of React per brochure page).
- **Don't add dashboard dark mode yet**; fix light-mode contrast first.
- **Don't build analytics-led Home cards** until the beacon records real traffic.

---

## 15. Appendix

### 15.1 Disputed and unverified items

- **Disputed:** §10.2 (t-tint-2 severity, shell-4, t-mechanic-3); resolved disputes in §10.3.
- **Unverified (single pass):** arch-12 (the `_g.cjs` regex bug was independently seen in the detailing scorecard); ai-11 (merged with verified export-11); admin-11 (merged with shell-10); admin-12 (merged with shell-5); t-tint-12 (the TintElite accessor was independently confirmed in ai-3; the dead anchors were not).
- **Gap-checked but with inferred steps:** gap-1's browser rejection of the credentialed beacon is reasoned from the CORS spec and supported by the near-empty `page_views` table; a live browser test was blocked. gap-3 relies on the Worker runbook plus the crawl; the Worker code itself was not read. The server-render crash (gap-5) was established by reading bundler source, not by running a build (no `node_modules` in the repo).
- **Now checked (previously judge-reported):** the JSX-runtime question is settled in §11.7.

### 15.2 Limits of this analysis

- **Mostly static code reading.** Visual scores and mockup-fidelity percentages are estimates from source, not screenshots.
- **Live evidence used:** read-only SQL on `ktnouhjikmlxlbxcxyif` (site/profile/page-view counts, per-template usage, custom-color rows, duplicate slugs, column privileges, indexes, `sites` schema); a read-only HTTP crawl of every published site (saved in the session scratchpad as `r2/*.html`, `analyze.py`, `analysis.json`); inspection of the production bundle and deploy metadata; one DNS-table browser replica; one curl check (Referrer-Policy).
- **Not available:** R2 Last-Modified (the Worker strips it and no Cloudflare token is local); analytics, logs, load or Core Web Vitals measurements; the live-vs-test status of the Stripe key.
- **Not reviewed:** the Cloudflare Worker (another repo); the SocialFeeds `widgets.js` DOM (check it for Tailwind class dependence before removing the CDN).
- **Legal points are risk flags, not legal advice.** Have counsel review the reviews/claims UX and the landing-page copy.
- **Costs and latencies are estimates** at 2026-09 pricing; confirm Opus 5.5's structured-output and fallback support at launch.
- **Effort assumes one developer** (557 commits, one author).

### 15.3 File index

| Area | Files |
|---|---|
| Theme registry and data | `src/data/templates.js`, `src/data/businessTypes.js`, `src/data/fontOptions.js`, `src/lib/templateFallbacks.js`, `src/lib/normalizeBusinessInfo.js`, `src/lib/sectionOrder.js` |
| Templates | `src/components/preview/templates/{detailing,mobile,tint,mechanic,wheel,carwash}/*.jsx`, `ImageLayers.jsx`, `ServiceCardParts.jsx`, `SocialIcons.jsx`, `IconOrEmoji.jsx`, `detailing/_g.cjs` |
| Editor and preview | `src/App.jsx`, `src/components/preview/ContentEditor.jsx`, `WebsitePreview.jsx`, `PreviewToolbar.jsx`, `ImageEditContext.jsx`, `src/components/onboarding/EditorTour.jsx`, `src/lib/imageUpload.js`, `src/lib/saveSite.js` |
| Export, publish, serve | `src/lib/exportHtml.js`, `src/lib/publishSite.js`, `src/lib/bookingPageHtml.js`, `src/lib/supabase.js`, `netlify/functions/publish-site.js`, `unpublish-site.js`, `_shared/auth.js`, `track-view.js`, `netlify/edge-functions/serve-custom-domain.js`, `public/scheduler.js`, `public/contact-form.js`, `netlify.toml`, `docs/superpowers/runbooks/worker-custom-hostname-routing.md`, `scripts/backfill-site-images.mjs` |
| AI | `netlify/functions/generate-website.js`, `netlify/functions/package.json`, `src/lib/generateWebsite.js`, `src/components/wizard/StepGenerating.jsx`, `demoData.js` |
| Dashboard shell | `src/components/ui/AppShell.jsx`, `AppHeader.jsx`, `TemplateCard.jsx`, `AlertProvider.jsx`, `src/components/dashboard/DashboardPage.jsx`, `overview/OverviewPage.jsx`, `src/design-tokens.js`, `tailwind.config.js`, `index.html`, `src/index.css`, `src/lib/AuthContext.jsx`, `.env.example` |
| Operational pages | `dashboard/bookings/*`, `bookings-page/*`, `booking-settings/*` (`SchedulerSettings`, `GeneralTab`, `AppearanceTab`, `ServicesTab`), `booking-only/BookingOnlySetup.jsx`, `customers-page/*`, `charges/*`, `netlify/functions/create-charge.js`, `_lib/scheduler-payload.js`, `_lib/appearance.js`, `_lib/slot-math.js`, `src/lib/schedulerConfig.js`, `src/lib/bookingUrl.js` |
| Admin | `src/components/admin/*` (`AdminPage`, `AdminAccountsTab`, `AdminUserDrawer`, `AdminAllBookingsTab`, `ImpersonationBanner`), `src/lib/adminUsers.js`, `netlify/functions/admin-impersonate-session.js`, `impersonate-claim.js`, `admin-impersonate.js` |
| Onboarding | `src/components/LandingPage.jsx`, `auth/LoginPage.jsx`, `wizard/*` (`WizardShell`, `StepBusinessInfo`, `StepTemplatePicker`, `StepExport`), `help/articles.js` |
| Database | `db/migrations/20260424_sites_one_per_non_admin.sql` (`sites_update_own`), `20260518_sites_admin_edit_any.sql`, `20260422_scheduler_mvp.sql`, `20260609_page_views.sql`, `20260809_sites_per_type_insert_limit.sql` |
| Mockups | `WebsiteMockups/{ironclad-mechanics, obsidian-tint-studio, sudsy-suds-detailing, bubble-rush-carwash, apexwheel, apex-wheel-shop-v2, autosync360, autosync360-white}.html` |
| Tooling (to add) | `CLAUDE.md`, `.claude/skills/new-theme/SKILL.md`, `.claude/agents/theme-reviewer.md`, `.claude/settings.json` (hook), `jsconfig.json` |
