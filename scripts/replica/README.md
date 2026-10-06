# scripts/replica

Dev-time tools for the **Exact replica** path of a paid custom website: a new hidden, theme-ready template built for
one customer, modeled on the layout of a reference site they gave us. The workflow (inputs, section map, scaffold,
registration, checks, PR) is the Claude Code skill `.claude/skills/replica-template/SKILL.md`. These scripts are its
eyes: they capture pages and put the reference and our replica side by side.

> **Layout only.** A reference lends layout, structure, spacing, type feel and component style. Never its words,
> photos, logos, icons that are brand marks, brand name, color values or other trade dress. The customer's own content,
> colors and logo go in. Captures hold the reference's material, so they live in a scratch folder **outside the repo**
> (both scripts refuse an `--out` inside this repo or any other git work tree, so running them from the test mirror
> still keeps captures out of the real repo) and are never committed, pasted into a PR or uploaded anywhere.

Node only (Node 22+ for the built-in WebSocket), plus a local Chrome or Chromium. Nothing to install: puppeteer, sharp
and pngjs are not in `node_modules`, so the scripts talk to Chrome over the DevTools Protocol themselves and make the
side-by-side image by screenshotting an HTML page. Run them from the test mirror (CLAUDE.md, "Working in this repo"),
which has `node_modules` (needed by `compare.mjs render` and for the offline Tailwind stand-in).

## capture.mjs

```sh
node scripts/replica/capture.mjs https://reference.example --out "$R/ref"
node scripts/replica/capture.mjs /path/page.html --out "$R/rep" --offline
node scripts/replica/capture.mjs --image desktop=/path/full-desktop.png --image phone=/path/full-phone.png --out "$R/ref"
```

| Flag | Default | What it does |
|---|---|---|
| `--viewports` | `desktop,phone` | Names (`desktop` 1440x900, `phone` 390x844 with touch and a phone user agent) or `name:WIDTHxHEIGHT` |
| `--offline` | off | Fails every request off this machine at once (loopback still loads). The Tailwind CDN gets the local preflight instead, so our published pages lay out as they do live |
| `--timeout` | 30000 | Page load deadline in ms. After it, loading stops and the capture goes on with what rendered (`loadComplete: false` in the manifest) |
| `--font-timeout` | 4000 | Per remote font or font stylesheet |
| `--asset-timeout` | 8000 | Per remote stylesheet or script |
| `--max-height` | 16000 | Stop tiling after this many CSS px (`truncated: true`) |
| `--dpr` | 1 | Device pixel ratio of the tiles (1 to 3) |
| `--hide` | none | CSS selector to hide (`display:none`), e.g. a cookie banner or chat bubble. Repeatable. Never click "accept": hiding needs no consent |
| `--no-text` | off | Leaves heading and button text samples out of the outline |
| `--chrome` | `$CHROME_PATH`, else the usual install paths | Chrome or Chromium binary |

Output in `--out`:

- `manifest.json` (`acg-replica-capture/1`): source, options, and per viewport the page height, whether it finished
  loading, the tiles with their scroll offsets, the requests that failed or were substituted, and warnings (e.g. a
  page that scrolls an inner box instead of the window, as some smooth-scroll setups do: only its first screen can be
  captured, so use `--image` screenshots for it).
- `<viewport>/tile-NNN.png`: viewport-sized screenshots from the top down. Fixed and stuck-sticky elements show on the
  first tile only (and a bottom bar on the last), so the stitched page doesn't repeat the header.
- `<viewport>/outline.json` (`acg-replica-outline/1`), read from computed styles: the nav (height, sticky/fixed,
  transparent over the hero, links, call button, menu button, logo box and placement), sections in order (kind guess:
  hero, services, pricing, about, gallery, reviews, process, faq, logos, stats, contact, cta, map, footer, content; an
  `idHint` for our section id; height, band (dark/light/photo), alignment, padding, content width, columns, headings,
  counts, the repeated card group), the type scale (h1, h2, h3, body, eyebrow, button: size, weight, family, case,
  tracking, line height), fonts, the top button styles, the card style, spacing (median section padding, gaps, content
  widths), corner radii, density and the color *roles* (where dark, light and accent bands sit). Our own pages tag
  sections with `data-section`, so on a replica the sections are exact.

`--image` turns supplied screenshots into a capture without an outline (several per viewport stack in order). Use it
when the admin has screenshots (the project's reference uploads) or the page can't be loaded. A tall reference upload
is stored as up to 4 parts of one group (`<name> (part 1 of N).jpg`, part 1 at the top): pass every part, in part
order, with the same viewport name.

## compare.mjs

```sh
# 1. Our page, with the customer's content (their draft site row, saved from a READ-ONLY query) or a fixture
node scripts/replica/compare.mjs render --row "$R/site-row.json" --template replica_1a2b3c4d --out "$R/replica.html"
node scripts/replica/compare.mjs render --fixture full --template replica_1a2b3c4d --colors '{"accent":"#1d4ed8"}' --out "$R/replica.html"

# 2. Side by side (the replica .html is captured first, at the reference's viewports)
node scripts/replica/compare.mjs --reference "$R/ref" --replica "$R/replica.html" --out "$R/review-1" --title "Acme Detail"
```

`render` builds the page exactly as a publish does (`scripts/site-upgrade/load-render.js`, the Site upgrades renderer:
`exportHtmlString` with the template's registry entry, the row's colors, fonts and images), with no site id, so no
live booking or contact widget loads, and without the free-tier bar unless `--free-bar`. `--row` takes plain JSON (an
object or a one-row array) or the Supabase MCP's saved result file; it is parsed as data, never run. `--colors` merges
color roles (`bg`, `accent`, `text`, `secondary`, `muted`) over the row's own.

The comparison writes into `--out`:

- `compare-desktop.png`, `compare-phone.png`: the review images. Header with the rule, the score, the layout checks
  and the section list, then the reference (stitched tiles) and the replica side by side, each column at most 720 px
  wide. Pages that would pass `--max-height` (default 12000 px) are scaled down to fit.
- `compare-<viewport>.html`: the same page to scroll in a browser (images load from the capture folders).
- `report.md`, `report.json`: per viewport, about 30 checks (page length, section count, nav height/position/links/
  button/logo placement, hero height/alignment/photo, h1/h2/body sizes, h1 weight and case, font kinds, eyebrows,
  button shape/radius/height/fill/case, card style/radius/per row, section padding, content width, columns, footer
  columns), each `close` or `off` within a tolerance, a score and a verdict (`close` at 80%+, `getting there` at 60%+,
  else `far`), and the index-aligned section list. Colors are never scored: the replica wears the customer's palette.
- `replica-capture/`: the replica's capture when `--replica` was an .html file.

### leak-check

```sh
node scripts/replica/compare.mjs leak-check --reference "$R/ref" --template replica_1a2b3c4d \
  --source src/components/preview/templates/custom/Replica1A2B3C4D.jsx --source src/data/templates.js \
  --source src/data/designLooks.js --source src/data/templateSections.js
```

The hard rule, checked mechanically: exits 1 and prints each hit when a file holds the reference's words (heading and
button text from the outline that is more than a generic label), its name (the parts of its page title that are more
than trade words like "Mobile Detailing", their first two words, and the domain's name label, also when written into an
identifier such as `ShinyRidesHero` / `shiny_rides` or a file name), its domain, or one of its brand colors (saturated
colors only, `#c00` shorthand too). In a file that has an entry for `--template` (the registry block, the Studio's look
objects in `src/data/designLooks.js`, one-line lists such as the Launch Kit's `TEMPLATE_LOOKS`) colors are checked only
inside that entry, since the rest are other templates' palettes; elsewhere in the whole file. Line endings don't
matter (the repo is CRLF). When `src/data/templates.js`, `src/data/designLooks.js` or
`netlify/functions/_lib/kit/inputs.js` has no entry for the id, it prints `UNCHECKED` and exits 1 rather than
passing. Run it on every file of the diff before each commit. A capture made with `--no-text`, or
from screenshots, has no words to look for: it says so, and the check is by eye.

### palette

```sh
node scripts/replica/compare.mjs palette --project "$R/project.json"
node scripts/replica/compare.mjs palette --colors '{"bg":"#0b0d10","secondary":"#16191f","text":"#f5f5f4","muted":"#a8a29e","accent":"#e11d2e"}'
```

The replica's five colors, from our side only, in the order "Match its layout" uses (`matchPalettePlan` /
`matchPaletteFor` in `src/lib/designSuggest.js`): a full Studio palette, else the ready brand system's (Studio roles
on top), else the customer's brand color as the accent on the colors of the template the Design step uses, else that
template's colors. `--project` is the project row from SKILL.md's read-only query (plain JSON or the MCP's saved
result). The reference's colors are never an input.

The colors become the replica's registry entry, and `src/components/preview/templates/kit/theme.test.js` checks every
entry: `deriveTheme` keeps `bg`, `accent` and `secondary` as given, and the text, muted and accent-colored text it
paints must read at 4.5:1 on `bg` and on `secondary`. A Studio palette is kept exactly as the admin set it, so the
command repairs it the way the page does: `secondary` moves toward `bg` (1/50 steps) when no text color reads on both,
until the text colors the page paints read on it, and `text` / `muted` become what the page paints. `bg` and `accent`
never change. Prints `{ ok, from, templateId, palette, picked, repairs, notes, reason }`: `palette` is what goes in the
registry, `picked` (only when something changed) the colors before the repair, `repairs` each change with its reason,
`notes` what is left as is (accent-colored text painted lighter or darker, an accent under 3:1 off the page, button
text under 4.5:1 on the accent). Repairs and notes go to stderr too. Exits 1 when there is no full palette yet (the
admin sets the Studio colors first).

`--colors` runs the same check and repair on a palette you chose (all five roles): a Studio look's for
`src/data/designLooks.js` (a look must come back with no `repairs`), or the registry entry after a hand edit.

## Why it is built this way

From earlier screenshot work on this Mac (headless Chrome quirks):

- Headless Chrome never finished a page that linked remote CSS such as Google Fonts or the Tailwind CDN when the host
  didn't answer: `readyState` stayed `loading` and `Page.captureScreenshot` timed out. So Node fetches remote fonts,
  stylesheets and scripts with a deadline and hands them to Chrome (CDP `Fetch` domain); what doesn't arrive fails and
  is listed in the manifest. The page load itself has a deadline too, then `Page.stopLoading`.
- `captureBeyondViewport` and full-page clips hung as well, so captures are viewport tiles. The review image is one
  viewport-sized shot of a local page (slices of 2000 px if that ever fails).
- Two sessions on one fixed `--remote-debugging-port` attached to each other's Chrome. These scripts start Chrome with
  port `0` and read the port it picked from `DevToolsActivePort`, with a private temporary profile each time.
- Reduced motion is emulated and the page is scrolled through once before tiling, so lazy images load and
  reveal-on-scroll blocks are visible.

Tests: `tests/replica/capture.test.js`. The pure parts run with every `npx vitest run`. The headless Chrome parts
(about 18 s: generated local pages and a loopback server that never answers) run only under `npm run replica:test`
(in the test mirror; the test file sees the script's name in `npm_lifecycle_event`, so it works from any shell), or
with `REPLICA_CHROME=1` set for another vitest command. They skip when no Chrome is installed.
