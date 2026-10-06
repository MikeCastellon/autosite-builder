# The plan (`/tmp/social/plan.json`)

You write the plan; `scripts/compose.py` draws it. One entry per image you make (the share image is required;
leave out any other you can't make well and say why in `notes`).

```json
{
  "images": [
    {
      "file": "share-1200x630.png",
      "layout": "photo-left",
      "photo": "photo-1.jpg",
      "focal": { "x": 0.55, "y": 0.6 },
      "zoom": 1.0,
      "text": {
        "eyebrow": "Exampleton, FL",
        "headline": "Showroom shine, wherever you park",
        "sub": "We bring the water and the power.",
        "footer": "sampleshine.com"
      },
      "alt": "A red sedan in a driveway next to the words: Showroom shine, wherever you park."
    },
    { "file": "profile-800.png", "layout": "logo", "logoCrop": { "x": 0.02, "y": 0.08, "w": 0.24, "h": 0.84 },
      "background": "auto", "alt": "Sample Shine logo" }
  ],
  "captions": [ { "file": "post-1.png", "text": "Our new website is live! ..." } ],
  "notes": ["One line for the admin."]
}
```

## Image keys

| Key | Use |
|---|---|
| `file` | one of the seven file names (data/formats.json `order`) |
| `layout` | one the format allows (below) |
| `photo` | a container name from the brief's `photos` (photo layouts; optional for `quote` and `services`) |
| `focal` | `{x, y}` 0-1 of the photo as shown; default the photo desk's focal point, else the middle. The crop keeps it as central as the edges allow |
| `zoom` | 1 to 2.5: crop tighter around the focal point (watch the "enlarged" warning) |
| `text` | words by role (below); every line passes the text gate |
| `alt` | required: what the image shows and the words on it, plainly (no claims) |
| `surface` | panel color for panel and brand layouts: `bg` (default), `secondary` or `accent` |
| `align` / `valign` | override the layout's text alignment: `left` / `center`; `top` / `center` / `bottom` |
| `logo` | `false` leaves the logo off (the text may then start higher) |
| `logoCrop` | `{x, y, w, h}` fractions of the logo file (from `logo.py inspect`): the part of the logo to use |
| `background` | profile only: `auto` (best contrast for the logo, the brand bg first), `bg`, `secondary`, `accent`, `white`, `text` |

## Text roles

Drawn top to bottom in this order; the footer sits at the bottom of the text area. Each role has a largest and
smallest size and a line limit per format (data/formats.json `text`): compose uses the largest common size at which
everything fits, and refuses text that doesn't fit at the smallest (it says how many characters fit).

| Role | Looks like | Typical source |
|---|---|---|
| `eyebrow` | small, uppercase, tracked, accent color | city/area, "New website", "Our services" |
| `headline` | big, heading font | the site's headline or tagline, an allowed phrase |
| `quote` | a pasted review with a big accent quotation mark | whole sentences of one review (one pasted line) |
| `cite` | "— Name" under the quote | the name pasted with that review, as written |
| `sub` | one or two lines, muted | a run of the subheadline or about text |
| `items` | a list (array of strings) with accent bullets | service names from the facts (prices only as written there) |
| `cta` | a pill button | "Book online" (needs booking), "Call today" (needs a phone), "Visit our website" |
| `footer` | small, bottom of the text area | the site host from the facts, the phone, an Instagram handle |

## Layouts

| Format | Layouts |
|---|---|
| share 1200x630 | `photo-left` / `photo-right` (photo on one side, text on a brand panel with the logo), `photo-full` (photo with a dark scrim on the text side), `brand` (no photo) |
| cover 1640x624 | `photo-left` (text right), `photo-right` (text top left, above the profile picture), `photo-full`, `photo-only` (photo and logo, no text), `brand` |
| profile 800x800 | `logo` |
| posts 1080x1080 | `photo-overlay` (full photo, text over a bottom scrim), `photo-band` (photo top, text band below), `brand` (centered), `quote` (review on a panel, optional photo strip on top), `services` (items on a panel, optional photo strip) |
| story 1080x1920 | `photo-top` (photo top, text panel below), `photo-full` (full photo, bottom scrim), `brand` |

Each layout needs: a photo for every `photo-*` layout; a quote for `quote`; at least 2 items for `services`; a
headline, a quote or items everywhere except `photo-only` (which takes no text) and the profile; a cite only
with a quote, and only the name pasted with that review; "What our customers say" only with a quote.

## Captions and notes

`captions`: exactly one per planned post (`post-1.png` .. `post-3.png`), at most 2200 characters and 30 hashtags,
no claims the facts or the owner's answers don't back (a whole review sentence in quotation marks is fine).
Prefer the Words kit's captions as written.

`notes`: at most 8 one-line notes for the admin (compose adds its own about blurred areas and stand-in fonts, and
keeps the first 8).
