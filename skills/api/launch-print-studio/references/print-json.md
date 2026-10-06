# print.json

Written by `build_print.py`; checked by `validate_print.py` and again by our server
(`src/lib/kit/print.js` `sanitizePrint`), which fails the run when a code points anywhere but the request's links.
Keys and order exactly as below; no other keys.

```json
{
  "version": 1,
  "pieces": [
    {
      "file": "glovebox-card.pdf",
      "name": "Glovebox card",
      "size": "3.5 x 2 in",
      "bleed": "0.125in",
      "pages": ["front", "back"],
      "qr": [
        { "label": "Scan to save our contact", "kind": "contact", "url": "", "vcard": "BEGIN:VCARD\r\n...", "sizeIn": 1.3 },
        { "label": "Scan to book online", "kind": "booking", "url": "https://.../book#book", "vcard": "", "sizeIn": 1.3 }
      ],
      "text": ["Save our contact", "Sample Shine Mobile Detailing", "(555) 010-0199", "..."],
      "note": "16 pt card, both sides printed (business-card size). Trim 3.5 x 2 in; 0.125 in bleed and crop marks on every page."
    }
  ],
  "omitted": [{ "file": "counter-card.pdf", "reason": "No Google profile is linked, so there is no review link for its code." }],
  "fonts": { "heading": "Oswald", "body": "Inter", "fallback": false },
  "colors": { "panel": "#0a0909", "ink": "#f8f8f8", "accent": "#ee3533", "cmykRisk": [] },
  "notes": ["Colors are RGB; the print shop converts them to CMYK. Ask for a proof before a large run."]
}
```

| Field | Rule |
|---|---|
| `pieces` | in this order, each at most once: `review-hang-tag.pdf`, `counter-card.pdf`, `glovebox-card.pdf`, `business-cards.pdf`. The last two always; the first two only with `links.review`. |
| `size`, `pages`, `bleed` | the piece's own (`data/pieces.json`): hang tag `3.5 x 8.5 in` front/back/die-line, counter card `4 x 6 in` front, cards `3.5 x 2 in` front/back; bleed `0.125in`. |
| `qr` | at most 3; `kind` is `review`, `booking`, `site`, `call` or `contact`. `url` is exactly `links[kind]` (`""` for contact); `vcard` is exactly `links.vcard` for contact (`""` otherwise). `sizeIn` 0.75 to 4, the printed code without its quiet zone. `label` (up to 60) is the words printed with it. |
| `text` | every printed line, at most 40, each up to 200 characters (the crop-mark labels in the slug are not listed). |
| `note` | up to 300 characters for the print shop (stock, trim, die-line). |
| `omitted` | the review pieces left out, with the reason (up to 200). |
| `fonts` | the faces in the PDFs; `fallback` true when DejaVu Sans stood in for a brand face. |
| `colors` | `#rrggbb` lowercase; `cmykRisk` (up to 5) the printed colors that may shift in CMYK. |
| `notes` | up to 8 lines of up to 300 characters for the admin. When there are more, the build keeps a "Check before printing" line for text cut to fit, the server's `notes` and yours from copy.json, and drops its own routine lines first. |
