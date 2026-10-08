# Website Creator (Genius Websites)

Website builder for automotive businesses (detailing, mobile detailing, tint, wheel, mechanic, car wash).
Owners pick one of 21 React templates, customize it in the editor, and publish a static page.

## Stack

- React 19 + Vite 6 + Tailwind 3 (app UI only; published pages load the Tailwind CDN), plain JS/JSX.
- Supabase (auth, Postgres, storage). Live project: `ktnouhjikmlxlbxcxyif` (named "SocialFeeds" in Supabase).
  Any database write, migration or data backfill needs the owner's explicit approval first. Read-only queries only otherwise.
- Netlify: SPA + functions in `netlify/functions` (esbuild bundler) + edge function for custom domains.
  Published HTML lives in R2 behind `*.autocaregeniushub.com`.

## Working in this repo

- The repo sits on an external SSD shared with a Windows machine. There is **no `node_modules` here and you must
  never run `npm install` in the repo.** Run tests and builds in a mirror copy:
  ```
  rsync -a --exclude .git --exclude "._*" --exclude node_modules --exclude .netlify "<repo>/" "<mirror>/"
  cd <mirror> && npx vitest run      # or: npx vite build / npm run theme:check / npm run theme:render
  ```
  The mirror's `node_modules` is a symlink; never delete it. Edit files in the repo only, then re-sync.
- Text files use **CRLF** line endings. After creating a file: `perl -pi -e 's/\r?\n/\r\n/' <file>`, check with `file <file>`.
- macOS writes `._*` AppleDouble files on this volume: ignore them, never read or commit them.
- Match the existing style: plain JS, inline style objects, comments that explain why.

## Commands (run in the mirror)

| Command | What it does |
|---|---|
| `npx vitest run` | All unit tests (`src/**/*.test.{js,jsx}`, `netlify/functions/**`, `tests/**`) |
| `npm run theme:check` | Template render gate + kit/font tests |
| `npm run theme:render` | Writes every template x fixture as a published page to `$RENDER_OUT` (default `<tmpdir>/theme-renders`); filter with `THEMES=id1,id2` |
| `npx vite build` | Production build |
| `node scripts/replica/capture.mjs` / `compare.mjs render\|leak-check\|palette` | "Exact replica" dev tools (`scripts/replica/README.md`): headless Chrome captures, side-by-side review, leak check, registry-safe palette. `npm run replica:test` also runs their ~18 s headless Chrome part, which `npx vitest run` skips unless `REPLICA_CHROME=1` |
| `CAPTURE_CHROME=1 npx vitest run tests/functions/capture-chrome.test.js` | Real-Chrome test of the reference-site capture (`custom-site-capture-background`: headless Chromium via `@sparticuz/chromium-min` + `puppeteer-core`, pinned together, shipped as `external_node_modules`; every request goes through the SSRF guard in `_lib/capture.js`). Skipped by default |

## How a site renders

- Registry: `src/data/templates.js` (`TEMPLATES` metadata + `TEMPLATE_COMPONENT_MAP` lazy imports).
  `hidden: true` + `customFor: ['<project id>']` marks an "Exact replica" (`replica_<first 8 of the project id>`), listed
  only in that custom-site project's Design step; build one with the `.claude/skills/replica-template` skill.
- Editor: `src/components/preview/WebsitePreview.jsx` renders the template inside `<EditorModeProvider>`;
  `ContentEditor.jsx` is the side panel (sections list, copy, images, Colors & Fonts).
- Publish: `src/lib/exportHtml.js` runs `renderToStaticMarkup` in the owner's browser. **No effects, no state
  updates, no hydration**: anything set in `useEffect` or read from `window` keeps its initial value on the live
  site. It injects the Google Fonts link (`src/lib/fontCatalog.js`), `SITE_BASE_CSS` + `SITE_RUNTIME_JS`
  (`src/lib/siteRuntime.js`), widgets and the free-tier "Powered by" bar (`body.acg-has-bar`, 48px, fixed bottom).

## Template contract

Props: `{ businessInfo (normalized), generatedCopy, templateMeta, images }`. `templateMeta.colors` holds the 5
owner-editable roles `{ bg, accent, text, secondary, muted }` (custom colors already merged); `templateMeta.font` /
`bodyFont` are CSS font stacks. `images` is a flat map (`hero`, `about`, `logo`, `gallery0..N`, `shadeN`).

A **theme-ready** template module exports, besides its default component:
```js
export const themeReady = true;
export const sections = [{ id: 'hero', label: 'Hero' }, ...]; // default top-to-bottom order
export const extraFonts = ["'Barlow Condensed', sans-serif"];  // stacks used beyond font/bodyFont (may be [])
```
- `sections` ids must be the ids ContentEditor `TOGGLEABLE` / the template's old `buildSectionOrder` call
  already use. **Never rename an id**: saved sites store them in `copy.sectionOrder` / `copy.hiddenSections`
  (the allowed ids are snapshotted in `templates.render.test.jsx`).
- Root: `display:flex; flex-direction:column; container-type:inline-size` (+ `overflow-x: clip`, never
  `hidden`, so sticky elements keep working). Nav (holding `MobileMenu`) at `order:-1`, footer at `order:9999`,
  both direct children of the root.
- Nothing may paint outside the root's box, e.g. a skip link parked at `top:-80px`: in the editor the root starts
  under the app's fixed 52px toolbar, so it would cover the toolbar. Hide skip links visually until focused
  (`.xx-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`).
- Expose the theme on the root as CSS variables named `--<prefix>-bg`, `-surface`, `-text`, `-muted`, `-accent`,
  `-on-accent` (+ extras). Text on another background is `--<prefix>-<scope>-text|muted` next to
  `--<prefix>-<scope>-bg` (e.g. `--mc-footer-*`). theme:check contrast-checks these pairs at 4.5:1.
- Every orderable block's root element carries `data-section="<id>"` **and** its inline
  `order: buildSectionOrder(copy, sections.map(s => s.id))(id)`. A hidden id (`copy.hiddenSections`) renders nothing.
- Any element that shows awards carries `data-acg-awards` and renders only when there is at least one award.
- Exported from the module file itself: exportHtml reads `themeReady` (drops the legacy font list and the
  legacy `@media (max-width:768px)` grid override) and `extraFonts` (adds them to the font URL).
- A theme-ready module may also export `headingFields` (Edit > Headings: which `copy.sectionTitles` fields each
  section id uses; `titleFrom` / `introFrom` name the copy key that owns the text). Editor controls are gated by
  `editorCapabilities.js`: `CAPABILITY_KEYS` (copy keys) and `SOURCE_CAPABILITIES` (source regexes), both checked
  against the template sources by `editorCapabilities.test.js`.

### The kit (`src/components/preview/templates/kit/`)

- `theme.js`: `deriveTheme(templateMeta.colors)` -> `{ bg, surface, surfaceAlt, text, textMuted, accent, onAccent,
  accentText, accentSoft, border, borderStrong, focus, heroScrim, heroScrimLeft, onHero, isDark }`, contrast-repaired
  to 4.5:1. Helpers: `hexToRgb, rgbToHex, mix, alpha, luminance, contrastRatio, isDark, readableOn, ensureContrast`.
- `EditorMode.jsx`: `EditorModeProvider`, `useEditorMode()` (false on the published page), `<EditorOnly>`.
- `PhotoSlot.jsx`: `<PhotoSlot src alt slot|hint style imgStyle loading fetchPriority fallback />`. Editor shows a
  dashed placeholder naming the real upload location (`PHOTO_HINTS`); the published page shows `fallback` (null).
- `MobileMenu.jsx`: `<MobileMenu links cta colors font />` in the nav (`<details class="acg-menu">`, shown at
  <= 600px of the nearest container; `cta = { href, label, bookingTrigger? }`) and
  `<MobileActionBar phone bookHref colors font />` (Call/Book bar; render it as a direct child of the root; it is
  `position: sticky`, because `container-type` traps `position: fixed`). Book carries `data-scheduler-trigger`, so
  the booking widget opens from it when booking is on; pass `bookHref="#contact"` so it still goes somewhere without.
- Runtime hooks (published page; the preview mirrors scroll flag + menu close): `html[data-acg-scrolled]` after
  20px of scroll, `data-acg-reveal` (+ `style="--acg-delay:120ms"`, `="fade"`) for reveal-on-scroll (never on or
  inside the hero), `data-acg-year` for the copyright year, `details.acg-menu` auto-close. The runtime starts at
  readyState `interactive` (not DOMContentLoaded, which waits for the deferred widget scripts) and fails open:
  any error shows every reveal target.
- Reference implementation: `templates/__fixtures__/KitSampleTemplate.jsx`.

#### Feature blocks (Redline's owner-editable features, shared)

- `kit/features.js` (pure): `heroCardModeOf`, `heroOfferOf`, `featuredServiceOf`, `featuredHasBody`, `featuredTitleDefaults`,
  `makesEyebrowDefault`, `reviewStars`, `footerPlan`, `nameKey`, `bookingAttrs` (a button with the owner's own link gets
  `data-scheduler-bound`, so `public/scheduler.js` never turns its "Book" label into the booking widget). Also
  `kit/icons.jsx` (`LucideIcon`) and `kit/Accented.jsx`.
- Blocks take a class namespace `ns`: `HeroOffer`, `PackageBadge` / `PackagePhoto` / `PackageIncludes`, `FeaturedBand`,
  `MakesBand`. Redline passes `rl` (its markup is frozen in `kit/blocks.golden.json`); other themes pass
  `<p>-hq|pk|ft|mk`. The CSS generators `heroOfferCss` / `packageDetailsCss` / `featuredBandCss` / `makesBandCss` are
  appended to the template's one `<style>` string only while that block renders. They read `--{ns}-*` variables that
  the theme aliases to its repaired tokens; computed colors go on the root, only while the feature renders (the
  `features` fixture contrast-checks them).
- Themes with live sites (detailing_sporty, mobile_chrome, mobile_sudsy) make every feature opt-in: a site with none
  of the new keys must render byte-identical HTML, published and in the editor. So they call
  `heroCardModeOf(copy.heroCard, 'off')`, `googleBadgePlacements(copy.googleBadge, [])`,
  `featuredServiceOf({ ..., automatic: false })`, `vehicleMakesFor(copy.vehicleMakes, [])`, export a `footerSpec` whose
  default columns are the old footer with the button off, and list new section ids in `addedSections`, ordered with
  `buildSectionOrderAdded`: old ids keep their order values, and the editor's order repair (`repairSectionOrder`) leaves
  added ids out, so it saves the same order it saved before the template added them.
- Per-theme defaults live in `editorCapabilities.js` (`HERO_CARD_DEFAULTS`, `GOOGLE_BADGE_DEFAULTS`, `FEATURED_AUTOMATIC`,
  `VEHICLE_MAKES_DEFAULT_ALL`, `TEMPLATE_READS`, `TEMPLATE_HELP`). The panels take them as props, so they are the seed
  for a per-theme feature admin. `editorCapabilities.test.js` checks each one against the template's own calls, so a
  template names `copy.<key>` and those helper calls literally in its source.
- Before & After (`kit/BeforeAfter.jsx` + `kit/beforeAfter.js`) is in every theme-ready template (ns `ds-ba`, `mc-ba`, `ss-ba`, `rl-ba`, `mi-ba`, `mg-ba`, `ic-ba`, `te-ba`, `ob-ba`, `wa-ba`, `cb-ba`; each has a `<Template>.golden.test.jsx` proving sites without it render byte-identical): on only when `copy.beforeAfter` is an object (`{ title?, intro?, pairs: [{ caption? }] }`), photos `images.baBefore0..5` / `baAfter0..5`, published only with a complete pair. Section id `beforeAfter` (an added section). The drag slider's script is `SITE_BA_JS` (`siteRuntime.js`), added by exportHtml only to pages showing the band; the editor uses its twin `beforeAfterPreview.js`. Custom sites pick pairs in the Design step (`design.slots.beforeAfter`).
- Layout helpers: `heroOfferCss(ns, { stackFrom, scope })` (+ `heroOfferLockCss`) keeps the card one height only where
  it sits beside the copy; a split hero renders the card as its own grid item after the photo (over the photo column on
  desktop, never stacked in the text column). Text over an owner photo: `overPhoto` / `heroScrimBase` (`kit/theme.js`),
  repaired for the scrim's lowest alpha; a band that keeps its own color over the photo uses `fillOverPhoto`, which
  deepens the fill until the text reads over a white and a black pixel alike. A `footerSpec` may add `contactFields` / `socialWhenBrandOff` (the Footer
  panel's empty checks); `footerPlan`'s `has()` also gets `shown`, and `hasSocialLinks` (`kit/content.js`) says when the
  social icons have something to move.

### Static-export rules

- No layout or visible state from `useEffect`, `useState` toggles or `window`; style scrolled navs with
  `html[data-acg-scrolled] .xx-nav` in CSS, with an opaque base background. (theme:check rejects React hooks
  and `window`/`document`/`navigator`/storage access in a theme-ready module's source.)
- Tailwind preflight is active in the editor and on the published page (CDN): headings, lists and margins are
  reset, so set font sizes, weights and spacing explicitly.
- All CSS for a template lives in one `<style>` block with classes prefixed per template (`.ic-`, `.sp-`, ...).
  Layout breakpoints use `@container (max-width: 600px)`, not viewport media queries.
- Hover styles only inside `@media (hover: hover)`; transitions/animations only inside
  `@media (prefers-reduced-motion: no-preference)`.
- Colors only from `deriveTheme(templateMeta.colors)` (or `templateMeta.colors`). The module source may contain
  no hex colors except `#fff`/`#000` (and their 6-digit forms) and no `rgb()/rgba()` except translucent neutral
  overlays like `rgba(0,0,0,.2)`: derive everything else from the owner's palette (`mix`, `alpha`, `ensureContrast`).
- Fonts only from `FONT_CATALOG` (`src/lib/fontCatalog.js`); declare extras in `extraFonts`. The preview and the
  published page both load `font` + `bodyFont` + `extraFonts` from it, so never inject font `<link>`s in `useEffect`.
- **No invented facts**: no fabricated ratings, star rows, review counts, stats ("500+ cars", "100%"), awards,
  badges, certifications, "verified"/"real reviews" labels, guarantees or opening status ("Open Now"). Show a fact
  only when the owner entered it; otherwise hide the element. Testimonials from AI copy are never labeled as verified.
- Hours: only the per-day editor's shape (exactly the keys `Mon`..`Sun`, `''` = closed) may produce "Closed".
  Older sites store free text ("Mon-Fri 8am-6pm, Sat" or `{ 'Mon-Fri': '8am-6pm' }` after normalizeBusinessInfo);
  show those as the owner wrote them (`formatHours`), never through `expandHoursToDays`, which guesses.
- Editor-only UI (placeholders, "add your ..." hints) goes through `PhotoSlot` / `<EditorOnly>` /
  `data-acg-editor-only`, so it can never reach the published page.

`npm run theme:check` enforces the contract for every module exporting `themeReady = true`: renders in both modes
for the sparse/full/custom fixtures, no editor-only markup/hint text or banned claims when published, no "Closed"
invented from free-text hours, custom colors and fonts applied, every font (also via `var(--x)`) loadable, token
contrast on default/custom/low-contrast palettes, sections tagged/hideable/ordered, root/nav/footer/menu/action-bar
structure, no reveal in the hero, no empty awards section, and a module source without hooks, browser globals or
hard-coded colors.

## Do not

- Run `npm install` in the repo, or add `react`/`react-dom` to `netlify/functions/package.json`.
- Use `import.meta.glob` or browser globals in code that renders templates (it must stay server-renderable).
- Bulk-republish live sites or write to the production database without the owner's approval.
