# mobile.json

`build_plan.py` writes it from `choices.json`, `mobile-inputs.json` and `icons.json`; `validate_mobile.py`
checks it. The server (`src/lib/kit/mobile.js` sanitizeMobile) applies the same rules again and replaces
anything that breaks them, so a file that passes here is stored as written. The request also carries this
contract as a JSON schema: both must hold.

```json
{
  "version": 1,
  "themeColor": "#0a0909",
  "shortName": "Gloss Boss",
  "phoneHeadline": "Mobile detailing in your Tampa driveway",
  "phoneSectionOrder": ["hero", "services", "testimonials", "gallery", "about", "cta"],
  "actions": [
    { "kind": "call", "label": "Call", "href": "tel:+18135550142" },
    { "kind": "text", "label": "Text a photo", "href": "sms:+18135550142?&body=Hi%20Gloss%20Boss%2C%20..." },
    { "kind": "book", "label": "Book", "href": "https://gloss-boss.autocaregeniushub.com/book#book" },
    { "kind": "directions", "label": "Directions", "href": "https://www.google.com/maps/search/?api=1&query=..." },
    { "kind": "save", "label": "Save contact", "href": "contact.vcf" }
  ],
  "smsQuote": { "body": "Hi Gloss Boss, I'd like a quote. Here's a photo of my vehicle:", "href": "sms:+18135550142?&body=..." },
  "vcard": { "fn": "Gloss Boss Mobile Detailing", "org": "Gloss Boss Mobile Detailing", "tel": "+18135550142",
             "email": "", "url": "https://gloss-boss.autocaregeniushub.com/", "adr": "1234 W Kennedy Blvd, Tampa, FL 33606" },
  "icons": { "bg": "#0a0909", "source": "logo", "logo": "logo-1.png", "monogram": "" },
  "scorecard": [{ "id": "call", "check": "Tap to call", "pass": true, "note": "Calls (813) 555-0142" }],
  "notes": []
}
```

| Key | Rule |
|---|---|
| `themeColor` | lowercase `#rrggbb`, one of the palette's five colors (usually `bg`: the browser bar then runs into the page) |
| `shortName` | the home-screen label, at most 12 characters, only words of the business name (two or three run together, or its initials) |
| `phoneHeadline` | one line, at most 40 characters (an emoji counts 2), only the site's own words |
| `phoneSectionOrder` | every id of `site.sections` that is not hidden, once each, `hero` first |
| `actions` | kinds `call`, `text`, `book`, `directions`, `save`, each at most once, only when the facts allow it; labels at most 24 characters, no claims; `href` exactly what build_plan.py makes |
| `smsQuote` | `{ body, href }`, or `null` when there is no phone number; body one line, at most 160 characters |
| `vcard` | exactly the facts (build_plan.py fills it) |
| `icons` | `bg` the icons' background; `source` `logo` / `monogram` / `none`; `logo` the file used (else null); `monogram` the letters (else "") |
| `scorecard` | every check in `data/rules.json`, in that order: `{ id, check, pass, note }` |
| `notes` | at most 8 plain lines of at most 300 characters, for the designer |

All strings are single plain lines (no line breaks, tabs, doubled spaces or spaces at the ends).

## The links

- `tel:<dial>`: `dial` from the facts (E.164 like `+18135550142` when the number has a known country code,
  else its digits).
- `sms:<dial>?&body=<encodeURIComponent(body)>`: iOS reads `&body=` and ignores the `?`; Android reads the
  query. Spaces are `%20` (Android shows `+` literally), nothing unencoded but `A-Z a-z 0-9 - _ . ! ~ * ' ( )`.
- `book`: the booking page from the facts, only when the site takes bookings.
- `directions`: `https://www.google.com/maps/search/?api=1&query=<encoded address line>`, only with a street
  address. It opens the Maps app on both phones when installed, the web map otherwise.
- `save`: `contact.vcf` (the card, published next to the page or linked from the kit).

## Scorecard

`pass` is `true`, `false`, or `null` for what only a person or the browser can check:

| from | ids | pass |
|---|---|---|
| inputs | call, phone-format, text, book, directions, contact-card, phone-headline, site-headline, sections, action-bar, hours, theme-color | follows from the facts and the plan; the server recomputes it (action-bar is null on an older template) |
| skill | icons, favicon, logo-contrast | from make_icons.py's measurements |
| manual | text-capable | null: confirm with the customer that the number takes texts |
| preview | tap-targets, text-size, sideways-scroll | null: measured in the browser preview later |

## choices.json (your file)

```json
{
  "phoneHeadline": "...",            // required
  "shortName": "...",                // required
  "phoneSectionOrder": ["hero", "..."],  // required
  "smsBody": "...",                  // optional: default "Hi <name>, I'd like a quote. Here's a photo of my vehicle:"
  "themeColor": "#rrggbb",           // optional: default the palette's bg
  "actions": ["call", "text", "book", "directions", "save"],  // optional: which and in what order
  "labels": { "text": "Text a photo" },  // optional: per kind, default Call / Text a photo / Book / Directions / Save contact
  "notes": ["..."]                   // optional
}
```

(No comments in the real file: it is plain JSON.)
