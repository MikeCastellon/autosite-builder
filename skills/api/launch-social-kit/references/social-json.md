# social.json

Written by `scripts/compose.py` from the plan; `scripts/validate_social.py` checks it. Never edit it by hand:
the validator compares its text with what was drawn.

```json
{
  "version": 1,
  "images": [
    {
      "file": "share-1200x630.png",
      "size": "1200x630",
      "purpose": "Link preview when the site is shared (also the site's og:image later)",
      "alt": "A red sedan in a driveway next to the words: Showroom shine, wherever you park.",
      "layout": "photo-left",
      "photo": "photo-1.jpg",
      "text": [
        { "role": "eyebrow", "text": "Exampleton, FL" },
        { "role": "headline", "text": "Showroom shine, wherever you park" }
      ]
    }
  ],
  "captions": [ { "file": "post-1.png", "text": "Our new website is live! ..." } ],
  "fonts": { "heading": "Oswald", "body": "Inter", "standIn": false },
  "notes": ["..."]
}
```

| Key | Rule |
|---|---|
| `images` | one per PNG delivered, in data/formats.json order; the share image is required |
| `size`, `purpose` | exactly as data/formats.json says for the file |
| `alt` | 1-250 characters, no unbacked claim |
| `layout` | one the format allows |
| `photo` | the container name of the customer's photo used, or `null` |
| `text` | the words on the image as `{role, text}`, in drawing order (`items` once per item) |
| `captions` | `{file, text}`, one per post that was delivered |
| `fonts` | the brand families the text is set in; `standIn: true` when DejaVu Sans stood in |
| `notes` | at most 8 strings of at most 300 characters |

The server (src/lib/kit/social.js `sanitizeSocial`) stores this with the photo's stored path in place of its
container name, size and purpose from its own copy of formats.json, `checks` per image (what its own run of the
text gate flags; empty when the validator passed), and `captionChecks: [{file, source, checks}]` beside the
captions (`source` is `words` when the caption is one of the Words kit's as written). `captions` itself stays
`{file, text}`: the claims ledger reads every value under it.
