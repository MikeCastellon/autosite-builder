# Section map and style tokens (step 2)

Copy the sheet below to `$R/section-map.md`, which lives in the scratch folder and is never committed, and fill it in
from the tiles and `outline.json` (desktop and phone). It is the spec for the template. Write it in our terms: never
paste the reference's text into it. Name sections by kind ("hero", "3-up services"), not by their headings.

## Our section ids and the content behind them

Reuse these ids. Templates read the same keys, so the editor's panels already work.

| Reference kind (outline `kind`) | Our id | Content it reads (copy = `generatedCopy`, biz = `businessInfo`) |
|---|---|---|
| hero | `hero` | `copy.headline`, `copy.subheadline`, `copy.ctaPrimary` / `ctaPrimaryUrl`, `copy.ctaSecondary` / `ctaSecondaryUrl`, `images.hero`, `biz.tagline` |
| services, pricing | `services` | `copy.servicesSection` (`title`, `items`), `biz.services` / `biz.packages` (prices only as entered); kit `PackageBadge` / `PackagePhoto` / `PackageIncludes` for package menus |
| about | `about` | `copy.aboutText`, `copy.aboutStats` (owner-entered only), `images.about`, `biz.yearsInBusiness`, `biz.specialties` |
| gallery | `gallery` | `images.gallery0..N` |
| reviews | `testimonials` | `copy.testimonialPlaceholders` (never labeled verified), `copy.googleWidgetKey` (`GoogleReviewsWidget`), `copy.googleReviewsTitle` |
| contact, cta, map | `cta` (root `id="contact"`) | `copy.ctaHeadline`, `copy.ctaSubtext`, `copy.ctaButtonText`, `biz.phone`, `biz.email`, `biz.address`, `biz.hours` (`formatHours`, or the per-day shape only), `biz.serviceArea`. The contact form widget mounts here |
| stats | `statsBar` | Owner-entered facts only (`biz.yearsInBusiness`, `copy.aboutStats`): hidden when there are none |
| logos | `brands` | `copy.vehicleMakes` (`vehicleMakesFor`, kit `MakesBand`) or brand lists the customer entered |
| process | `process` | `copy.howSteps` |
| why us / features | `whyUs` | `copy.whyCards` |
| featured offer | `featured` | `copy.featuredService` (`featuredServiceOf`, kit `FeaturedBand`) |
| service area + hours | `locations` | `serviceAreasOf(biz)`, `biz.hours` |
| awards, badges | `awards` | `biz.awards` (renders only with one or more, under `data-acg-awards`) |
| faq, team, blog, shop, careers | (skip) | No content model: leave out, or ask the admin |
| footer | footer (not orderable) | `copy.footerTagline`, `biz.*` contact and social, the kit footer helpers (`footerPlan`, `hasSocialLinks`) |

A new id is a last resort, for a block whose content we already hold under a key no existing id shows. Once a site
saves it, it is frozen (`templates.render.test.jsx` `SAVED_SECTION_IDS`).

## The sheet

```md
# <Customer> replica: section map   (scratch file: the customer's name is fine here, never in src/)
Project: <project id>   Template id: replica_<ID8>   Module: Replica<ID8 uppercased>.jsx   Prefix: .<xx>-
Reference capture: $R/ref (desktop <n> tiles, phone <n> tiles)   Captured: <date>
Rule: layout only. No words, photos, logo, brand marks or colors from the reference.

## Sections (top to bottom, desktop / phone)
| # | Reference (kind, screens, band, columns) | Our id | Layout to build | Customer content |
|---|---|---|---|---|
| 1 | hero, 0.9, photo, 1 | hero | full-bleed photo, scrim, left-aligned copy, 2 buttons, call chip | headline, subheadline, hero photo |
| 2 | services, 0.7, light, 3 | services | eyebrow + h2 left, 3 photo-top cards, price bottom-right, Book link | 3 packages with prices |
| 3 | ... | | | |
| - | team (skip) | - | - | no content: left out |

## Nav
height <px>, sticky | fixed | static, over hero yes/no (transparent until scrolled?), logo left | center,
<n> links, call button yes/no (style), phone: MobileMenu + MobileActionBar

## Type (desktop / phone)
h1 <px>/<px>, weight, case, tracking, line height
h2 <px>/<px>   h3 <px>   body <px>, line height   eyebrow <px>, case, tracking   button <px>, weight, case
Fonts (FONT_CATALOG): heading '<family>', body '<family>', extra [...]: feel matched: condensed / geometric / serif ...

## Spacing and shape
section padding <px> desktop / <px> phone   content width <px>   gaps <px>
radii: buttons <px | pill>, cards <px>, images <px>
cards: border | shadow | filled | plain, padding <px>, per row <n>/<n>
density: <screens> screens desktop, <n> sections

## Color roles (values are the customer's)
palette source: Studio | brand system | brand colors + neutral base
bg <hex>  secondary <hex>  text <hex>  muted <hex>  accent <hex>   (compare.mjs palette's `palette`, registry-safe)
repairs: none | <role> <from> -> <to> (why), from the command's stderr: tell the admin
bands: hero = photo + scrim, services = bg, about = secondary, CTA = accent fill (on-accent text), footer = dark of text ...

## Left out or adapted, and why
- <signature element>: generic equivalent / left out (trade dress)
- "<n>+ customers" counter: hidden, the customer has no such figure (no invented facts)
```

## Reading the outline

- `sections[].kind` / `idHint` are guesses from structure and keywords. The tiles decide. On our own pages the sections
  come from `data-section`, so the replica side is exact.
- `screens` is the section height in viewport heights. `dark`, `bgImage` and `mediaBackdrop` give its band, and
  `colorRoles.sequence` lists the bands as dark, light or photo. `columns` is the most side-by-side blocks in one row.
  `repeat` is the card group (count, per row, radius, border, shadow, image).
- `type.*.size` are computed pixels at that viewport. Compare desktop with phone to get the phone scale (`clamp()` in
  the template, written against `cqi`).
- `spacing.sectionPadMedian` ignores the hero and footer. `contentWidths` is the most common inner width (the
  container).
- `colorRoles` and `bg` values are only there to read the band pattern. Never use them as colors.
