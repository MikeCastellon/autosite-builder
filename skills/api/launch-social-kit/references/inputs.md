# Inputs

The server (netlify/functions/_lib/kit/social.js) sends `social-input.json`, the brief, plus the files it names.
`scripts/find_inputs.py` finds them wherever the container put them and writes `/tmp/social/brief.json` (the
brief with `paths`: container name to absolute path). Every other script reads that file.

| Key | What |
|---|---|
| `business` | `{name, type}` |
| `palette` | `{bg, secondary, text, muted, accent}` hex: the brand system, else the Design Studio's, else the site's own colors; `null` when none (a neutral dark set is used) |
| `paletteSource` | `brand`, `levers`, `site` or `none` |
| `fonts` | `{heading, body}`, each `{family, files: [{name, weight}]}` or `null`. The files are TTFs from Google Fonts (`font-Oswald-700.ttf`); without them DejaVu Sans stands in and social.json says so |
| `logo` | `{file, width, height, reading}` or `null`; `reading` is the brand system's look at the logo (dominant colors, background, has text) |
| `photos` | `[{file, width, height, role, score, alt, focal, blur, note}]`: the photo desk's picks (hero, about, after, gallery by score, before), its skipped photos left out; `focal` and `blur` are 0-1 fractions of the photo as shown; `note` is the customer's note on the upload (data) |
| `links` | `{site, host, booking, phone}`: the live address, its host for a footer, whether the site takes bookings and shows a phone |
| `words` | `{ready, captions, bio}`: the Words kit's social texts when it has a ready run |
| `sources` | `[{id, kind, label, text}]`: every text an image may quote (references/text-rules.md) |

The request shows you the logo and the photos as images: use that view for judgement (sharpness, light, what is
in frame, a clean background for text), and the files for drawing. Contact details the site doesn't show (the
owner's own phone and email) are never sent.
