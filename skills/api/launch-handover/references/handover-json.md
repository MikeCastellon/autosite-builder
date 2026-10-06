# handover.json (version 1)

`build_handover.py` writes it; never edit it by hand. It is what the admin page shows, and the server keeps
only what passes its sanitizer (src/lib/kit/handover.js `sanitizeHandover`), which applies the same caps as
`validate_handover.py final` (data/contract.json `limits`).

```
version    1
summary    one line for the admin (600): pages, zip files, files left out, statements to confirm
sections   [title (80)] x 1-16: the PDF's section titles in page order (the cover isn't one)
pages      handover.pdf's page count (1-80)
files      [zip path (120)] x <= 80: launch-kit.zip's entries in order, handover.pdf and README.txt first
left       [{ file (zip path), reason (200) }] x <= 30: kit files meant for the zip that aren't in it
links      { site, booking, review, signIn }: exactly handover-inputs.json's links, '' where there is none
thisWeek   [{ title (80), detail (240) }] x 5: from content.json
checklist  [{ week 1-4, task (200) }] x 4-24, by week: from content.json
claims     { checked, sourced, toConfirm, listed } or null without a claims ledger
notes      [string (300)] x <= 8: content.json's notes, then the script's own
```

A zip path is a plain name at the top (`handover.pdf`) or one folder deep in a part's folder
(`05-print/business-cards.pdf`): `^(?:\d{2}-[a-z]+/)?[A-Za-z0-9][A-Za-z0-9._()+-]{0,99}$`, no `..`.

`validate_handover.py final` also checks the files against each other: the PDF opens and has `pages` pages;
the zip opens, stays under `zip.maxBytes`, lists exactly `files` in order and holds the same handover.pdf
bytes; every kit file sent and every generated text file is in `files` or in `left`.

The server drops what doesn't fit: a link that isn't the one it sent, a zip path its inputs can't produce,
text over a cap (cut). A handover.json without sections fails the run.
