# Formats and safe areas

data/formats.json holds the numbers; compose keeps text and the logo inside each `safe` box and out of each
`avoid` box, and the validator checks the drawn boxes. Boxes are `[x0, y0, x1, y1]` in image pixels.

| File | Size | Safe | Why |
|---|---|---|---|
| share-1200x630.png | 1200x630 (1.91:1) | 60,48 to 1140,582 | the og:image size Facebook, LinkedIn, iMessage and Slack show without cropping; some previews trim the edges |
| facebook-cover.png | 1640x624 | 300,80 to 1340,544; avoid 0,384 to 560,624 | 2x the 820x312 desktop cover. Phones show about the middle 1110 px (640x360 at that height), and on desktop the profile picture covers the lower left |
| profile-800.png | 800x800 | circle r=360 around the middle | every platform crops profile pictures to a circle; Google and Facebook show it small, so the mark fills about 80% of the circle |
| post-1..3.png | 1080x1080 | 150,72 to 930,1008 | Instagram's profile grid shows square posts cropped to 3:4 (the middle 810 px) |
| story-1080x1920.png | 1080x1920 | 64,270 to 1016,1650 | the progress bar and name sit over the top 250 px, the reply bar over the bottom 250 px |

## Contrast

- Text: 4.5:1 (WCAG AA) against the pixels behind it, measured on the 1st percentile (99% of the background under
  each line reaches it). Over a photo a scrim in the site's own hero scrim color (theme.js heroScrimBase: the page
  color deepened, or near-black on light themes) starts at 55% and grows by 10% steps until every line passes.
- On a panel the colors come from the palette and are repaired with the site's ensureContrast, so they match the
  site.
- Graphics (the logo, bullets, the quotation mark): 3:1. A logo with less than 70% of its pixels at 3:1 gets a
  rounded plate in the color that reads best (white, the page color, the text color or near-black).

## Photos

The photo fills its area with cover cropping around the focal point. A photo enlarged more than 1.6x is a warning
(it may look soft). Plate and face boxes from the photo desk are blurred before cropping.

## Output

PNG, 8-bit RGB (no transparency: platforms flatten it unpredictably), at most 11 MB each (a warning above 5 MB).
