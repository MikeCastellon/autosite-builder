# Prepress: what the scripts do and what the validator checks

## Pages and boxes

Every page is the trim plus a 0.5 in slug on each side. Inside the slug:

- **Bleed** 0.125 in: backgrounds run to it; everything is clipped there (BleedBox = trim + 0.125 in).
- **Crop marks** at the four corners, 0.25 pt, in the registration color (the PDF `/All` separation), starting
  0.0625 in outside the bleed and 0.25 in long, so they never touch the art.
- A one-line label under the trim (piece, side, trim, bleed) for the print shop.

TrimBox and BleedBox are set on every page, so a shop that wants no marks can crop to the BleedBox. Text and codes
stay inside a 0.125 in safe area; a code's quiet zone (4 modules, on a white pad) stays at least 0.0625 in from the
cut.

## The pieces

| Piece | Trim | Pages | Codes |
|---|---|---|---|
| Review hang tag | 3.5 x 8.5 in | front (review), back (rebook), die-line | review 2.0 in front, rebook 1.6 in back |
| Counter card | 4 x 6 in | front | review 2.2 in |
| Glovebox card | 3.5 x 2 in | front (save contact), back (rebook) | contact 1.3 in, rebook 1.3 in |
| Business cards | 3.5 x 2 in | front (logo, name, tagline), back (contact lines) | site 0.85 in on the back, when there is a site |

The hang tag hangs on a rear-view mirror: its **die-line** (page 3) is the cut path only, in the spot color
`DieCut`: the rounded outline (0.125 in corners), a 1.25 in hole centred 1.0 in below the top edge, and a slit from
the hole at 45 degrees to the edge so it slips over the mirror arm. It is drawn as seen from the front. Nothing is
printed above the hole's clearance line on either side, so the back (mirrored) is clear too. Both sides end with
"Please remove before driving."

## QR codes

- Encoded by `reportlab.graphics.barcode.qr` (QrCodeWidget's encoder), byte mode, error correction M (level H has
  a block-table slip in reportlab at version 15; print never uses it). Drawn as vector rectangles in 100% K inside
  a PDF form named `QR_<kind>_<n>`.
- At least 0.75 in printed; modules at least 0.25 mm (the validator fails smaller ones and warns under 0.4 mm). A
  vCard makes a dense code (about 65 modules at 1.3 in = 0.5 mm): fine. A long link on a small code is the case to
  watch.
- `validate_print.py` (via `qr_decode.py`) reads each form back out of the PDF, rebuilds the module matrix,
  decodes it with its own decoder and compares the text with print.json and print-inputs.json byte for byte.
  It also checks the code's printed size and position.

## Color and type

- Brand colors stay RGB; the print shop converts them. `colors.cmykRisk` lists bright greens, blues, purples,
  electric cyans and bright oranges that usually print duller (a rule of thumb, no ICC profile here): the note asks
  for a proof.
- Text pairs reach 4.5:1: the brand text on the brand background, else white or near-black; accent text on
  white is darkened until it reads. QR codes are always black on white.
- Fonts: the brand TTFs from the request (heading at the weight nearest 700, body nearest 400), embedded as
  subsets; a family without a file, a face reportlab can't embed (CFF-based OTF), or a line with characters the
  face lacks uses DejaVu Sans. Nothing uses the unembedded PDF base fonts.

## Words

- Text is fitted to its box: the largest size that fits, a headline kept on one line when that costs at most a
  quarter of its size, an email or long address broken after `@` or `.` (else `/ _ -`). Only when even the
  smallest size can't hold a line is it cut with an ellipsis, and the build's summary says so (for the tagline,
  shorten it). Characters no font here has (emoji) are left out, with a note.
- Claim check: each printed line against the patterns in `data/claims.json` (years, "since 20xx", "500+", "%",
  "#1", best/top-rated/certified/licensed/insured/guaranteed/warranty/rated, stars, prices, "free estimates").
  A match must appear in the facts (or the business fields), else the build stops.
- Review policy (`reviewBanned`): no discounts, entries, prizes, "in exchange for", "5 stars", "leave a great
  review", "if you were happy" on a review piece, or on any line that mentions a review. The business's own name
  and site address are taken out of a line first: "Thank you for choosing 5 Star Auto Spa" is the shop's name.
