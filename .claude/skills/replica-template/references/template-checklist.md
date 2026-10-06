# Template checklist (step 3)

CLAUDE.md's "Template contract", "The kit" and "Static-export rules" are the source of truth. This list is how to
satisfy them for a replica, and where to register it. `npm run theme:check` and the full `npx vitest run` enforce
almost all of it.

Names come from the project id (SKILL.md, Setup), never from the customer or the reference: `src/` ships in the public
bundle. The examples below use project `1a2b3c4d-...`, so `ID8=1a2b3c4d`: template id `replica_1a2b3c4d`, module
`Replica1A2B3C4D.jsx` (the same 8 characters, uppercased).

## The module: `src/components/preview/templates/custom/Replica<ID8 uppercased>.jsx`

- [ ] Copied from `__fixtures__/KitSampleTemplate.jsx`, renamed `Replica1A2B3C4D`. The header comment says what it
      is: "Exact replica template for custom site 1a2b3c4d: layout modeled on the customer's reference; content,
      colors and logo are the customer's." Never name the reference business or the customer.
- [ ] `export const themeReady = true;`, `export const sections = [...]` (default order from the section map),
      `export const extraFonts = [...]` (every stack used beyond `font` / `bodyFont`, all in `FONT_CATALOG`).
      `headingFields` only if it reads `copy.sectionTitles`.
- [ ] Root: `display:flex; flex-direction:column; container-type:inline-size; overflow-x:clip`, theme tokens as
      `--<prefix>-bg|surface|text|muted|accent|on-accent` (+ `--<prefix>-<scope>-bg|text|muted` for every band with its
      own background), all from `deriveTheme(templateMeta.colors)`. Nothing paints outside the root (a skip link
      uses the visually-hidden pattern).
- [ ] Nav is a direct child at `order:-1` with `<MobileMenu links cta colors font />`. Style the scrolled state with
      `html[data-acg-scrolled] .<prefix>-nav` over an opaque base. Footer is a direct child at `order:9999`.
      `<MobileActionBar phone bookHref="#contact" colors font />` is a direct child of the root.
- [ ] Every orderable block has `data-section="<id>"` and
      `style={{ order: order('<id>') }}` with `const order = buildSectionOrder(copy, sections.map((s) => s.id))`,
      and renders nothing when `copy.hiddenSections` holds its id.
- [ ] The `cta` block has `id="contact"` (the contact form widget mounts there). Book buttons use `bookingAttrs(...)`
      (`kit/features.js`) and `href="#contact"`. Phone links use `telHref` / `phoneDisplay` (`kit/content.js`).
- [ ] One `<style>` string, every class prefixed `.<prefix>-`. Breakpoints are `@container (max-width: 600px)` (plus
      other `@container` widths if the reference needs them), never viewport media queries. Hover only inside
      `@media (hover: hover)`, transitions and animations only inside
      `@media (prefers-reduced-motion: no-preference)`.
- [ ] Font sizes, weights, margins and list styles set explicitly (Tailwind preflight resets them). Phone sizes use
      `clamp(<phone>px, <n>cqi, <desktop>px)`.
- [ ] No hex colors except `#fff` / `#000` (6-digit forms too), no `rgb()/rgba()` except translucent neutral overlays.
      Derived shades come from `mix`, `alpha` and `ensureContrast`. Text over photos uses `overPhoto` / `heroScrimBase`
      or `fillOverPhoto`.
- [ ] No React hooks for layout, no `useEffect`, no `window` / `document` / `navigator` / storage. Reveal uses
      `data-acg-reveal` (never in or inside the hero). The copyright year uses `data-acg-year`.
- [ ] Owner photos and the logo go through `PhotoSlot` (published: `fallback`, else nothing). Hints go through
      `EditorOnly` / `data-acg-editor-only`.
- [ ] No invented facts: stats, ratings, star rows, review counts, awards, badges, guarantees and "Open now" show only
      from the customer's data. Reviews from AI copy are never labeled verified. Hours follow CLAUDE.md (only the
      per-day shape may say "Closed", free text goes through `formatHours`).
- [ ] Every visible string comes from the customer's data or is a generic label. None comes from the reference
      (leak check).

## Register it (each line but the `NO_HERO_LAYOUT` one has a test that fails until it is done)

| File | Entry | Enforced by |
|---|---|---|
| `src/data/templates.js` `TEMPLATES` | See below: `label: 'Exact replica'`, `hidden: true`, `customFor: ['<project id>']`, the customer's palette from `compare.mjs palette` (registry-safe: see "Registry colors") | `templateSections.test.js`, `kit/theme.test.js` (theme:check) |
| `src/data/templates.js` `TEMPLATE_COMPONENT_MAP` | `replica_1a2b3c4d: () => import('../components/preview/templates/custom/Replica1A2B3C4D.jsx'),` (single quotes: tests parse this line) | `editorCapabilities.test.js`, `templates.render.test.jsx` |
| `src/data/templateSections.js` | `{ sections, added: [], headingFields }` mirroring the module's exports | `src/data/templateSections.test.js` |
| `src/data/designLooks.js` `LOOKS` | 2-3 Studio looks for the replica, each with `customOnly: true` (see "Looks" below) | `src/data/designLooks.test.js` |
| `src/components/preview/templates/templates.render.test.jsx` `SAVED_SECTION_IDS` | `replica_1a2b3c4d: [<its section ids>],` under the "New template" comment: frozen from here on | theme:check |
| `src/components/preview/editorCapabilities.js` `TEMPLATE_READS` | `replica_1a2b3c4d: [...KIT, <other keys it reads>],` (+ `HERO_CARD_DEFAULTS`, `GOOGLE_BADGE_DEFAULTS`, `FEATURED_AUTOMATIC`, `VEHICLE_MAKES_DEFAULT_ALL`, `TEMPLATE_HELP` when it uses those features) | `editorCapabilities.test.js` |
| `src/lib/siteUpgrade.js` `NEW_DESIGN_TEMPLATES` | Add the id (exactly the theme-ready templates) | `siteUpgrade.test.js` |
| `src/lib/kit/mobile.js` `TEMPLATE_SECTIONS` | `replica_1a2b3c4d: tpl(true, 'hero:Hero, ...'),` matching `sections` | `src/lib/kit/mobile.test.js` |
| `src/lib/designLevers.js` `NO_HERO_LAYOUT` | Add the id when the template ignores `copy.heroLayout` (no full/split hero choice) | No test fails for a replica (`designLevers.test.js` covers Redline only): without it the Studio's Layout field offers a Hero choice the template ignores (`studioFields.js` reads it through `leverPatch`) |
| `netlify/functions/_lib/kit/inputs.js` `TEMPLATE_LOOKS` | `replica_1a2b3c4d: look('<bg>', '<secondary>', '<text>', '<muted>', '<accent>', "<font>", "<bodyFont>"),`: exactly the registry entry's `colors`, `font` and `bodyFont` (the Launch Kit's mirror; it can't import the registry) | `tests/functions/kit-inputs.test.js` |
| `netlify/functions/_lib/kit/handover.js` `TEMPLATE_INFO` | `replica_1a2b3c4d: info('Exact replica', '<mood>'),`: exactly the entry's `label` and `mood` | `tests/functions/kit-handover.test.js` |

The registry entry, in a "Replicas" block at the end of `TEMPLATES` (the comment above `TEMPLATES` documents
`customFor`). The label and description are the same for every replica, so the public bundle never carries a customer's
name; the Design step shows it as "Replica, this customer only" in that one project:

```js
  // ─── Replicas (custom websites: one customer each, hidden) ─────
  replica_1a2b3c4d: {
    id: 'replica_1a2b3c4d',
    businessType: 'mobile_detailing',            // the customer's
    label: 'Exact replica',
    description: 'Built from a reference site for one customer.',
    previewColors: ['<bg>', '<accent>', '<secondary>'],
    colors: { bg: '<hex>', accent: '<hex>', text: '<hex>', secondary: '<hex>', muted: '<hex>' }, // compare.mjs palette
    font: "'<FONT_CATALOG family>', sans-serif",
    bodyFont: "'<FONT_CATALOG family>', sans-serif",
    mood: '<layout feel words, e.g. bold, dark hero, card grid>',
    tier: 'premium',
    hidden: true,
    customFor: ['<project uuid>'],
  },
```

### Registry colors (`src/components/preview/templates/kit/theme.test.js`)

"keeps every text pair readable" runs on **every** `TEMPLATES` entry, hidden or not, as part of theme:check. For the
entry's `colors`, `deriveTheme(colors)` must:

- keep `bg`, `accent` and `secondary` exactly as given (six-digit hex; deriveTheme lowercases them);
- paint text, muted and accent-colored text (`text`, `textMuted`, `accentText`) at 4.5:1 or more on `bg` **and** on
  `secondary`. deriveTheme repairs text on the page but never trades page contrast for card contrast, so a card color
  on the other side of light/dark from the page (light cards on a dark page) fails, whatever the text color.

`compare.mjs palette` prints a palette that passes: it moves `secondary` toward `bg` when no text color reads on both,
and sets `text` / `muted` to what the page paints (so the registry, `TEMPLATE_LOOKS` and the Studio swatches show the
real colors). Copy its `palette` as printed, never `picked`. Changed a color by hand? Check it again:
`node scripts/replica/compare.mjs palette --colors '{"bg":"#...","secondary":"#...","text":"#...","muted":"#...","accent":"#..."}'`
(no `repairs` means it passes as is).

### Looks (`src/data/designLooks.js`)

`designLooks.test.js` gives every theme-ready template (every `TEMPLATE_SECTIONS` id) 2-3 Studio looks, and the
replica is one. Add them to `LOOKS` after the Redline block, in the same shape:

```js
  // ─── Exact replica (custom site 1a2b3c4d): hidden, so custom-only looks ───
  {
    templateId: 'replica_1a2b3c4d', slug: '<slug>', name: '<Name>', customOnly: true,
    mood: ['<lowercase>', '<words>'],
    palette: { bg: '#...', secondary: '#...', text: '#...', muted: '#...', accent: '#...' },
    fonts: ['<heading family>', '<body family>'],
    order: ['hero', ..., 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: '<one or two sentences: what this direction is for>',
  },
```

- [ ] 2 or 3 looks, each `customOnly: true` (the test wants `customOnly` exactly on hidden templates' looks).
- [ ] Palette: all five roles as lowercase `#rrggbb` (the test compares them with what deriveTheme and `sanitizeLevers`
      return, both lowercase; `palette --colors` lowercases its input, so it can't catch this), and deriveTheme must
      change nothing (`palette --colors` lists no `repairs`), plus button text 4.5:1 on the accent and the accent
      3:1 off `bg` and `secondary` (the command's notes flag both). Our colors, never the reference's: the leak check
      reads the replica's looks as well.
- [ ] Each look differs from the registry entry in `bg`, `accent` and the font pair, at least one is on the other
      side of light/dark from the entry's `bg`, and the looks differ from each other in `bg`, heading font and order.
- [ ] `order` holds every section id once, `hero` first and `cta` last (only `awards` may follow it); `hidden` never
      holds `hero` or `cta`.
- [ ] Fonts from `FONT_CATALOG`, the body a sans or serif. `heroLayout` is `'full'` or `'split'` (the test accepts
      `''` only for `mobile_redline`; a template in `NO_HERO_LAYOUT` ignores it), `aboutLayout` `'image'` or `'stats'`.
      Use `'stats'` only when the replica reads `copy.aboutLayout` and, in the editor, shows the hint
      "Add your stats in Edit > About > Stats Box" while there are no stats (`mechanic/MechanicGarage.jsx`): the test
      looks for it.
- [ ] `name`, at least two lowercase `mood` words and a `note` over 20 characters. No customer or reference names.
- [ ] Rendered on the replica, every root token pair still reads at 4.5:1 and the look's colors, fonts and section
      order reach the markup (the test renders each look).

Other lists may name every template by the time you build. Find them by following the newest template:
`grep -rln "mobile_redline" src netlify tests`, and the tests that walk the whole registry:
`grep -rlnE "Object\.(keys|values|entries)\((TEMPLATES|TEMPLATE_COMPONENT_MAP)\)" src netlify tests scripts`. Any list
a test enforces fails in `npx vitest run` with the template's id in the message. Lists that are not tests' business
(such as `SUGGEST_TEMPLATES` in `src/lib/designSuggest.js`, the visible templates only) must stay without the replica:
"Suggest a design" never picks one.

## Commands (in the test mirror)

```sh
rsync -a --exclude .git --exclude "._*" --exclude node_modules --exclude .netlify "<repo>/" "<mirror>/"
cd <mirror>
npm run theme:check                                   # the contract, for every theme-ready template
npx vitest run                                        # every list above, editor capabilities, sections
THEMES=replica_1a2b3c4d RENDER_OUT="$R/renders" npm run theme:render   # sparse / full / custom / features fixtures
```

Look at the `theme:render` pages for the sparse fixture as well: a customer with no photos, no reviews and free-text
hours must still get a clean page with no empty bands.
