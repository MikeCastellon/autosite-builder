# Icons

| File | Size | Where it shows | Rule |
|---|---|---|---|
| `apple-touch-icon.png` | 180x180 | iPhone home screen | opaque (iOS fills transparency with black), 12% padding: iOS rounds the corners |
| `icon-192.png` | 192x192 | Android home screen, PWA | opaque, maskable: the mark inside the centered circle of radius 40%, which every Android mask keeps |
| `icon-512.png` | 512x512 | Android splash, install sheets | same as 192 |
| `favicon-32.png` | 32x32 | browser tabs, bookmarks | the mark on a rounded tile of the background color |

`make_icons.py` draws all four from one mark on one background and checks the geometry; the validator measures
the files again (sizes, opacity, one flat background, nothing outside the safe circle, not empty).

## The mark

- A cut-out logo (transparent PNG) is used as it is.
- A logo on a flat color (a JPEG on white) is un-mixed from that color, so it can sit on any background without
  a box or a halo. `--plate logo` keeps its own color as the icon background instead; `--plate none` always
  lifts it onto `--bg`. `auto` lifts it only when at least 80% of it still reads at 2:1 on the brand background.
- Artwork that runs to its edges (a photo, a filled badge) is placed whole.

Wide logos: a wordmark 3 times wider than tall fills a third of a square icon and is unreadable at 32 px. Run
`--parts` first: it lists the logo's separate pieces (an emblem beside the words, a tagline under them) as
`x,y,w,h` boxes; pass the emblem's box as `--crop` (all icons) or `--favicon-crop` (the favicon only). Never
crop through letters: a cut word looks broken. A logo that is only lettering stays whole on the big icons; use
`--favicon-crop` on its first letter or initials only when that letter stands on its own.

## The background

`--bg auto` (default) takes the brand `bg` when the logo stands out on it, else the first of `secondary`,
`accent`, `text`, white, near-black it stands out on. The report says which and why. Prefer the brand
background; a white plate for a dark-ink logo on a dark brand is fine and honest. The theme color stays a brand
color either way.

## Monogram (no logo)

`--monogram` with 1-3 letters of the business name (initials), drawn in the accent (else the brand text color)
when it reads at 4.5:1 on the background, else white or black. The letters are text: `--ink` may choose another
color, but the logo-contrast check passes only at 4.5:1. `--font` takes a TTF the request sent
(`font-<Family>-700.ttf`); without one it uses DejaVu Sans Bold. A monogram is a placeholder until the customer
has a logo: say so in `notes`.

## The report (icons.json)

`bg`, `bgReason`, `source`, `logo`, `logoBackground` (transparent / solid / edge), `logoBackgroundColor`,
`markPx`, `markAspect`, `visibleShare` (share of the logo reading at 2:1 on `bg`), `faviconMarkPx`, `files`
(each icon's mark box; `markRadius` as a share of the icon for the maskable ones), `warnings`, and `checks`
(the scorecard's icons, favicon and logo-contrast). `build_plan.py --icons icons.json` copies the summary and
checks into mobile.json.
