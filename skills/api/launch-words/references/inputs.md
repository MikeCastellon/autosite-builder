# Inputs

## What the request gives you

The request (built by `netlify/functions/_lib/kit/words.js`) names the business, lists the container files,
the links, the site's services, and repeats the sources as data inside `<customer_intake>`,
`<business_facts>`, `<pasted_reviews>` and `<site_copy>`, then the JSON schema of words.json. The same facts
are in `words-inputs.json` for the scripts:

| Key | What it is |
|---|---|
| `today` | The run's date (YYYY-MM-DD): the seasonal post uses its month. |
| `business` | `name`, `type` (detailing_shop, mobile_detailing, tint_shop, wheel_shop, mechanic_shop, car_wash, other, or ''), `typeLabel`, `city`, `state`, `serviceArea`, `address`, `phone` (the number the site shows; '' = no CALL buttons). |
| `services` | The site's services in its order: `name` (use exactly), `description` (the owner's, else the site's), `price` (as the owner wrote it, '' when none). |
| `urls` | `site`, `booking` (only while the site takes bookings), `review` (Google's write-a-review link, only when a Google place is linked). '' when missing. |
| `photos` | The customer's photos sent with this run: `ref` ("photo-2"), `file` ("photo-2.jpg"), `name` (their file name), `note` (their note), `alt` and `role` (from the photo desk, when it ran: hero, about, gallery, before, after, skip), `width`, `height`. Ordered best first when the photo desk ran. |
| `logo` | The logo's container file name, or ''. For the PDF cover only. |
| `brand` | `palette` (`bg`, `secondary`, `text`, `muted`, `accent`, or null) and `fonts` `{ heading, body }`, each `{ family, files: { "400": "font-Oswald-400.ttf", "700": ... } }`. Files may be missing (the PDF then uses a stand-in). |
| `existing` | The site's current `metaTitle`, `metaDescription` and `keywords`: improve on them, don't copy blindly. |
| `placeholders` | `[name]` and `[review link]`. |
| `sources` | `intake` (the customer's answers as "Question: answer" lines; contact details and the pasted reviews left out), `business` (the business facts the site shows, as "key: value" lines), `reviews` (the reviews they pasted, as written), `site` (the written site's copy). |

## Which source backs what

- `intake` and `business`: the customer's word. Any fact in the copy must be in one of them.
- `reviews`: only for quoting a review word for word, with the name as given. A claim a review makes ("best
  in town") is the reviewer's opinion, never the business's claim.
- `site`: our earlier copy. Follow its service names and descriptions and its tone, but a claim only the site
  makes is not backed (the validator warns; the claims ledger checks the site separately).

The intake's "What should your site have?" lists features they want on the site (online booking, gift
cards, financing info): a wish for the website, not proof they offer it today. Treat it as a fact only when
another answer or the business facts confirm it.

## Where the files are

Attached files are copied into the container, but the API does not document a fixed folder.
`scripts/find_inputs.py` searches `$INPUT_DIR`, `/mnt/user-data/uploads`, `/mnt/user-data`, `/mnt/data`, the
working directory, `$HOME`, `/tmp` and similar, then the rest of the filesystem a few levels deep (system
folders and `/skills` skipped). `--names a.json,b.png` limits the list to the files the request names and
exits 1 when one is missing. Photos and the logo are PNG, JPEG, WebP or GIF; font files are TTF.

Uploads the request lists as "not sent" are not in the container.
