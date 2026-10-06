# Layout only: the copyright and trademark rule

A reference site belongs to another business. Its words, photos, artwork, logo and brand identity are protected by
copyright and trademark law, and a site that looks like *that business* misleads customers. What we may take is the
general way the page is put together. Design ideas, layouts and common UI patterns are not anyone's property. A
"replica" means **their layout with our customer's everything else**.

This rule is the same in the Design step's UI copy ("Match its layout") and in the Suggest a design prompt. Say it the
same way in the PR and to the admin.

## Allowed (layout, structure, spacing, type feel, component style)

| Aspect | Example of what to carry over |
|---|---|
| Section order and structure | Hero, then a 3-up services grid, then a split About, then a reviews strip, then a dark CTA band |
| Grid and columns | 3 cards per row on desktop, 1 on phone; a 55/45 split with the photo on the right |
| Spacing and density | ~96 px section padding, 24 px gaps, a 1140 px content width, a page about 5 screens long |
| Corner radii and borders | Pill buttons, 16 px card corners, hairline card borders, no shadows |
| Type feel | Condensed uppercase display headings at about 64/40 px, a 17 px humanist sans body, tracked uppercase eyebrows, through `FONT_CATALOG` fonts that give that feel |
| Component patterns | Sticky dark header with a call button, centered hero with one button, photo-top cards, a numbered process row, a map beside the hours |
| Color *roles* | "Dark hero, light body, an accent CTA band": which band is dark or light, not which colors |
| Motion and behavior | Sticky nav, reveal on scroll (kit runtime hooks only) |

## Never (any one of these blocks the PR)

| Never copy | Do instead |
|---|---|
| Any of their text: headlines, taglines, slogans, service or package names and descriptions, about copy, FAQ, reviews, button labels that are theirs ("Claim your shine day") | The customer's copy from their draft site. Generic labels ("Book now", "Our services") are fine |
| Their business or brand name, domain, phone, address, social handles | The customer's, from `businessInfo` |
| Photos, video, illustrations, background textures, custom icons | The customer's photos through `PhotoSlot`; generic icons from `kit/icons.jsx` |
| Logo, wordmark, monogram, mascot, badge artwork | The customer's logo (`images.logo`), or their name in the heading font when there is none |
| Color values (hex, gradients, tints sampled from the page or screenshots) | The customer's palette from `compare.mjs palette`: Studio, then brand system, then brand colors (SKILL.md, Inputs) |
| Their HTML, CSS, JS, class names or SVG paths, even "just a snippet" | Our own code, written to the measured tokens with our kit |
| Their self-hosted or licensed fonts | The nearest `FONT_CATALOG` family |
| A signature element that identifies them (trade dress): a unique hero shape or cutout, a custom badge, an illustration style, a distinctive pattern | A generic equivalent from our components, or leave it out. Ask the owner when in doubt |
| Their facts and claims: "500+ cars", "#1 in Miami", "5-star", certifications, guarantees | Only facts the customer entered (CLAUDE.md, no invented facts). Otherwise the element is hidden |
| Hotlinks to their images, fonts or scripts | Nothing: the template loads only what the kit and exportHtml load |

The reference's name and words must not appear anywhere in the repo, including ids, file names, CSS prefixes,
comments, labels, test names, commit messages and PR text. Name everything after the **project id**
(`replica_<first 8 of the id>`, SKILL.md Setup): the customer's name stays out of `src/` too, since it ships in the
public bundle, and appears only in the PR description and scratch files.

## Where reference material may live

- Captures, screenshots, outline JSON, the section map and review images stay in the scratch folder (`$R`) outside the
  repo. `capture.mjs` and `compare.mjs` refuse an output folder inside the repo.
- The owner sees the review images as files sent in the session. They are not committed, attached to the PR or
  uploaded anywhere.
- The outline holds short text samples so you can tell sections apart and so the leak check knows what to look for.
  Read them, and never paste them.

## Checks before every commit

1. `node scripts/replica/compare.mjs leak-check --reference "$R/ref" --template <id> --source <each changed file>`
   exits 0. It looks for the reference's heading and button text, page-title parts (its name, also inside
   identifiers such as `ShinyRidesHero` and in file names), domain and saturated brand colors. In files that list
   every template (the registry, the Launch Kit's `TEMPLATE_LOOKS`, the Studio's `designLooks.js`) colors are checked
   only in the replica's own entry or looks, and a missing entry fails the check instead of passing it.
2. No media files in the diff (`.png`, `.jpg`, `.webp`, `.gif`, `.avif`, `.svg`, video, fonts).
3. `npm run theme:check` passes, which also rejects hard-coded colors and invented claims in the template source.
4. Read the template's visible strings once more: every one either comes from the customer's data or is a generic UI
   label.

## Edge cases

- **The customer's brand happens to match the reference's** (same red, same font): fine when it really is the
  customer's (their brand system or intake colors say so). Note it in the PR so the leak-check hit is explained.
- **The reference is the customer's own old site**: then the content is theirs. Still take the words and photos from
  the draft site (the admin imported them there), not from the capture, so the editor owns them.
- **"Make it identical, logo and all"** from anyone: build the layout, and explain that their words, photos, logo and
  colors can't be copied. Offer the customer's own material.
