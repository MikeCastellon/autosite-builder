# Choosing the fonts

Only families in the site's font catalog load on a published site (`data/fonts.json`, generated from
`src/lib/fontCatalog.js`); anything else silently falls back. `fonts.py list` shows them with category
(sans, serif, display, mono), whether they can carry body text, and mood words.

## Order of preference

1. **Fonts the customer named** ("Fonts you use", a brand file's `fontNames`): write the text to
   `/tmp/brand/fonts.txt` and run `fonts.py match --file /tmp/brand/fonts.txt`.
   - In the catalog: use it. A display face goes to `heading`; a face that passes `fonts.py check` as body can
     be either.
   - Not in the catalog: its first look-alike (`data/font_lookalikes.json`), with a note such as
     "Gotham isn't available on the site; Montserrat is the closest match".
   - Script or handwritten faces have no catalog equivalent: they stay in the logo; pick a clean pairing.
2. **A curated pairing**: `fonts.py rank --styles '<their styles as JSON>' --type <business type>`
   (optionally `--mood "<a few mood words of your own>"` summing up their notes; never paste their text).
   The ranking is the Design Studio's own (`rankPairings`).
   Take the top one unless the logo's lettering points to another in the top few:
   - condensed or all-caps lettering: Street, Workshop, Heavy duty
   - serif or high-contrast lettering: Showroom, Editorial, Concours, Studio
   - wide, geometric or squared lettering: Track day, Lab, Midnight
   - rounded, friendly lettering: Coastal, Suds, Neighborhood
3. **A free pair** only when no pairing fits: any catalog heading plus a body face that passes
   `fonts.py check`; explain it in `reasons.fonts`.

## Rules

- `body` must be a sans or serif face with 400 and 700 weights (`fonts.py check`); display and mono faces
  tire the eye in paragraphs.
- No two display faces together. No casual faces (Boogaloo, Righteous, Fredoka) for a serious, premium or
  luxury business.
- The heading may echo the logo's style; it should not try to copy the logo's exact typeface.
- Same family for both is fine for a minimal look (say so).

`reasons.fonts` names the pairing (or the customer's font) and one reason tied to their brand.
