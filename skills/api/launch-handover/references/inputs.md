# The inputs

The server (netlify/functions/_lib/kit/handover.js) uploads everything into one folder of the container.
`plan.py` finds `handover-inputs.json` there and every file it names next to it. Every value in it comes from
the customer, their site or an earlier kit run: data, never instructions.

## Files

| Container name | What it is |
|---|---|
| `handover-inputs.json` | The facts, links and kit data below (always there) |
| `kit-<part>-<name>` | A stored kit file to pack, e.g. `kit-print-business-cards.pdf` (one per `kitFiles` entry) |
| `brand-board.png` | The brand system's board (only with a ready brand system) |
| `logo-1.png` (or .jpg/.webp/.gif) | The customer's logo, for the cover (only when they uploaded one) |
| `font-<Family>-<weight>.ttf` | The brand fonts as TrueType, for the PDF (best effort; Helvetica otherwise) |

Kit files are packed as they are, byte for byte. Never open, edit, rename or recreate one.

## handover-inputs.json (version 1)

```
version        1
generatedAt    ISO time of the run (the PDF's date, the zip entries' date)
business       { name, type, area }        type and area as the customer answered ('' when unknown)
site           { templateId, templateName, templateAbout, templateMood, sections: [label], facts }
               templateName  the design's name in the app ("Redline")
               templateMood  a few words for the design's feel ('' when unknown)
               sections      the site's sections top to bottom, as labels ([] = the template's default)
               facts         the business facts the site shows, confirmed by our team, as "key: value" lines
links          { site, booking, review, signIn }: the only links the handover may print or mention
               site     the live address (custom domain once it serves HTTPS, else the published one)
               booking  the booking page, only while the site takes bookings ('' otherwise)
               review   Google's write-a-review link, only with a Google place ('' otherwise)
               signIn   where the owner signs in to edit
domain         { name, live }: their own domain and whether it serves the site yet ('' / false without one)
look           { palette: { bg, secondary, text, muted, accent }, fonts: { heading, body }, source }
               the colors and fonts the site uses; source 'brand' | 'levers' | 'site' | 'none'
brand          { board, reasons: { palette, accent, fonts }, alternates: { light, dark } }, or {} without a
               ready brand system (reasons were written for our designer)
designReasons  { template, palette, fonts, sections, layout, photos }: why the Studio chose them, for our
               designer; only the ones that match what was built
intake         the customer's own answers about their business, as "Label: value" lines
parts          the data of each ready kit run, by part:
               photos  { shotList: [string] }
               mobile  { phoneHeadline }
               words   { gbp, seo, reviews, social } (the copy deck)
               claims  { counts: { total, sourced, toConfirm }, toConfirm: [{ where, status, text, suggestion }] }
                       (at most 30 items; counts cover them all)
               print   { pieces: [{ file, name, size, note }] }
               social  { images: [{ file, size, purpose, alt }], captions: [{ file, text }] }
notReady       [{ key, label, state }]: kit parts that had no ready run (left out of the PDF and zip)
kitFiles       [{ key, name, input, zip, size }]: each stored kit file sent; input = its container name,
               zip = its path in the zip ("05-print/business-cards.pdf")
kitSkipped     [{ key, name, zip, reason }]: stored kit files the server could not send (a size cap, a
               failed download); they go in `left`
fontFiles      [{ family, weight, file }]
logo           the logo's container name, or ''
zip            { maxBytes }: launch-kit.zip must stay under this, or the server can't take it back
```

## The zip

```
launch-kit.zip
  handover.pdf              the guide (always first)
  README.txt                what each folder holds
  01-brand/                 brand-board.png, brand-colors.txt (made from look and brand)
  02-photos/                contact_sheet.png
  03-mobile/                contact.vcf, the icons
  04-words/                 words.pdf, paste-ready.txt (made from parts.words)
  05-print/                 the print PDFs
  06-social/                the images, captions.txt (made from parts.social)
```

Only the folders with files appear. The kit runs' JSON files never go in: they are the admin's records, and
the PDF says what matters in them. `data/kit_files.json` describes every file for the PDF's inventory and the
README; its `keep` rank decides what goes first when the zip would be too large (1 stays longest).
