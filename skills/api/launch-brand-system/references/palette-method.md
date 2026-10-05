# Choosing the palette

## Contents
- The five roles
- Step 1: the accent
- Step 2: light or dark
- Step 3: the neutrals
- Step 4: the alternates
- Style table
- Avoid
- How the site repairs colors

## The five roles

| Role | Where the site paints it | Guide |
|---|---|---|
| `bg` | page background | near-black (dark) or white / very light neutral (light) |
| `secondary` | cards, alternate sections, form fields | close to bg but a visibly separate surface: about 1.05 to 1.35:1 against bg |
| `text` | headings and body text | near-white on dark, near-black on light; may lean slightly toward the brand hue |
| `muted` | captions, secondary text | about 35 to 45% of the way from text to bg, repaired to 4.5:1 |
| `accent` | buttons, links, highlights, icons | the brand color; its button label is white or #111111, whichever reads better |

## Step 1: the accent

1. A brand guide (PDF/AI text, `textColors`) lists exact values: its primary color is the accent.
2. `colorMode: mine`: the first color they gave. Use it as is when its label passes (`labelRatio` >= 4.5 in
   `extract_palette.py` output, or `theme.py check`). If not, `theme.py repair` darkens or lightens it the
   least possible; say so in `reasons.accent` and `notes`.
3. `colorMode: logo`: the logo's strongest brand color: usually `accentCandidates[0]`. Skip a candidate that
   is a tiny detail (under about 3% of the logo) when a bigger chromatic color exists, and any color they
   dislike. A `monochrome` logo has no chromatic color: either keep the brand monochrome (near-black accent
   on a light page, or white/silver accent on a dark page) or pick one accent for their styles; say which.
4. `colorMode: pick`, or nothing usable: one accent from the style table that suits the business type.

Their other colors: use one as the secondary tint or keep them for the logo only; never more than one accent.

## Step 2: light or dark

Decide in this order, and note real conflicts:
1. Their styles: Dark & moody, and most Luxury & high-end and Bold & sporty sites, are dark. Clean & minimal,
   Bright & friendly and Classic & trusted are light.
2. Their inspiration: what most of the sites and screenshots they liked look like.
3. The logo: a logo made for a dark background (white or light lettering, `background: dark`, or a white
   variant uploaded) fits a dark page. A dark wordmark with no light version on a dark page needs a note.

## Step 3: the neutrals

Start from `theme.py propose <accent> light|dark`, then adjust:

- Dark: bg #0b0b0d to #16161a (a faint tint of the accent's hue is fine); secondary bg mixed 5 to 8% toward
  white; text #f2f2f2 to #fafafa; muted around #a1a1aa.
- Light: bg #ffffff or a very light cool/neutral grey; secondary #f4f4f5-like or bg mixed up to 5% toward the
  accent; text #111111 to #1f1f23; muted around #5c5c66.
- `theme.py check` after every change; `theme.py repair` gives the nearest passing values.

## Step 4: the alternates

`theme.py alternates '<palette>'` returns the palette in its own mode plus a proposal for the other mode.
Keep the accent in both when its label passes in both (it does not depend on the page). If the other mode's
accent would be hard to see (validator warns under 3:1 against that bg), a deeper or lighter shade of the same
hue is fine; note it.

## Style table

| Style | Page | Accent direction (examples, not rules) |
|---|---|---|
| Bold & sporty | dark | saturated red, orange, racing yellow, electric blue |
| Clean & minimal | light | one restrained color: deep blue, teal, or near-black |
| Luxury & high-end | dark, or light editorial | gold/champagne, silver, deep jewel tones; low saturation |
| Dark & moody | dark | deep, cool or desaturated: oxblood, petrol blue, violet |
| Bright & friendly | light | sky blue, sunny yellow, fresh green (check the label contrast) |
| Rugged & industrial | dark steel | safety yellow, construction orange, rust red |
| Modern & techy | dark or crisp light | cyan, electric blue, violet |
| Classic & trusted | light | navy, forest green, deep red |

Business types lean: car washes and mobile detailers bright and friendly; tint/PPF and high-end detailers dark
and premium; mechanics trustworthy or industrial; wheel shops bold. Their own answers always win.

## Avoid

- Cream, beige or off-white pages unless the brand is built on them.
- Neon accents the brand doesn't use.
- bg and secondary so close they read as one surface (validator warns under 1.04:1).
- The accent as a page background, or two competing accents.
- Pure #000000 pages with pure #ffffff text in large areas: slightly softened neutrals read better.

## How the site repairs colors

The site never paints the palette raw: `deriveTheme` keeps bg, secondary and accent, repairs text and muted to
4.5:1 on bg (and on secondary when that doesn't break bg), picks the accent button label (white or #111111),
and repaints accent-colored text (links) when the accent is under 4.5:1 on bg. `theme.py` is a line-by-line
port, checked against fixtures generated from the JavaScript, so `theme.py check` is what the site will show.
