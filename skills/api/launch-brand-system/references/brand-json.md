# brand.json contract

The site's runner reads this file, checks it again in JavaScript (`src/lib/brandSpec.js` `sanitizeBrand`) and
stores it as `custom_site_projects.design.brand.brand`. Applying a brand sets the Design Studio's
`levers.palette` (the 5 roles of `palette`, or of an alternate) and `levers.fonts` (`heading`, `body`).
`scripts/validate_brand.py` enforces everything below with the same limits, so a file that passes is stored
exactly as written (anything the server has to repair or drop shows up to the designer as an adjustment).

## Shape

Exactly these keys at every level (extra keys are errors):

```json
{
  "version": 1,
  "palette":    { "bg": "#0e0e10", "secondary": "#1a1a1d", "text": "#f5f5f5", "muted": "#a1a1aa", "accent": "#c8102e" },
  "alternates": {
    "light": { "bg": "#ffffff", "secondary": "#f2ebed", "text": "#201116", "muted": "#655662", "accent": "#c8102e" },
    "dark":  { "bg": "#0e0e10", "secondary": "#1a1a1d", "text": "#f5f5f5", "muted": "#a1a1aa", "accent": "#c8102e" }
  },
  "fonts": { "heading": "Bebas Neue", "body": "Barlow" },
  "reasons": {
    "palette": "Dark page to match the black badge the logo sits on; cards one step lighter.",
    "accent": "#c8102e is the red of the logo's shield.",
    "fonts": "Street pairing: tall caps headings echo the logo's condensed lettering; Barlow stays readable."
  },
  "logo": { "dominant": ["#c8102e", "#111111", "#fbcc15"], "background": "transparent", "hasText": true },
  "notes": ["The logo's yellow pinstripe is left out of the site palette; it stays in the logo."]
}
```

## Fields

| Field | Rule |
|---|---|
| `version` | `1` |
| `palette.*` | lowercase `#rrggbb`. The roles: `bg` page background; `secondary` cards and alternate sections; `text` headings and body text; `muted` secondary text; `accent` buttons, links, highlights |
| contrast | on the tokens the site derives (`theme.py` = `kit/theme.js` `deriveTheme`): text/bg, muted/bg, onAccent/accent, text/secondary all >= 4.5:1 |
| fixed point | `text` and `muted` must already be what the site renders (`theme.py repair` gives them); otherwise the board and Studio swatches would show colors the site never paints |
| `alternates.light` / `.dark` | complete palettes, same rules; `light` has a light bg, `dark` a dark bg (`theme.py`'s `is_dark`); the alternate of the main palette's own mode is an exact copy of `palette` |
| `fonts.heading` / `.body` | exact `FONT_CATALOG` names (`data/fonts.json`, case-sensitive); `body` must be a body face (`fonts.py check`) |
| `reasons.palette` / `.accent` / `.fonts` | one plain line each (no line breaks, tabs or doubled spaces), 1 to 600 characters, for the designer, no invented facts |
| `logo` | `null` when there is no logo; otherwise exactly the three keys below |
| `logo.dominant` | 1 to 8 unique lowercase `#rrggbb`, biggest area first (`extract_palette.py` `logoField.dominant`, or the colors a brand file lists) |
| `logo.background` | `"light"`, `"dark"` or `"transparent"`: what the main logo file sits on |
| `logo.hasText` | `true` when the logo contains letters (a name, initials, a wordmark); decide by looking at it |
| `notes` | 0 to 8 one-line strings of 1 to 300 characters: substitutions, conflicts, unreadable files, a missing logo version (for example no white logo for a dark page) |

The whole file stays under 16 KB. Warnings from the validator are allowed but each one deserves a sentence in
`reasons` or `notes` when you keep it (for example an accent under 3:1 on the page because the brand's yellow
is the brand's yellow).
