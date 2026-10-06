# words.json

Exactly these keys, nothing else (the request also carries this as a JSON schema; both must hold). Lengths
count like the server counts them: JavaScript string length, so most emoji count 2. The limits live in
`data/limits.json`; `validate_words.py` enforces them.

```json
{
  "gbp": {
    "description": "250-750 characters, plain text, no links, no prices",
    "services": [{ "name": "Full Detail", "description": "up to 300 characters" }],
    "categories": [{ "name": "Car detailing service", "confirm": true }],
    "posts": [{
      "title": "up to 58 characters, one line",
      "body": "150-1500 characters, line breaks allowed",
      "cta": "BOOK | CALL | LEARN_MORE",
      "imageHint": "up to 200 characters",
      "photo": "photo-2"
    }]
  },
  "seo": { "title": "20-60", "description": "110-160", "keywords": ["4-12 phrases, up to 60 each"] },
  "reviews": {
    "requestSms": "up to 300, line breaks allowed",
    "requestEmail": { "subject": "up to 80, one line", "body": "up to 1500" },
    "replies": [{ "rating": 5, "text": "up to 1000" }]
  },
  "social": { "bio": "up to 150", "captions": ["up to 2200 each, at most 30 hashtags"] },
  "notes": ["up to 8 lines, up to 300 characters each"]
}
```

## Field rules

| Field | Rule |
|---|---|
| `gbp.description` | What they do, where, their services by name, what sets them apart in their words, how to reach them. No URL, no price or offer (Google's rules). A phone number is allowed only if it is the business phone, but leave it out: the profile shows it. |
| `gbp.services` | Every site service, the site's exact names (`plan.json` `services`), in the site's order, nothing else. One description each, what the work involves (from the owner's description or the site's). No prices: GBP has its own price field. |
| `gbp.categories` | 1 to 10 (aim for 2 to 4). The first is the suggested primary. Names from `data/gbp_categories.json` (`plan.json` `categories`); a name outside it is a warning. `confirm` is always `true`: the owner picks the exact name in the GBP category box. |
| `gbp.posts` | Exactly 12, a different title and text each. `cta`: `BOOK` (booking page, else the site), `CALL` (only when the request has a business phone), `LEARN_MORE` (the site). The server sets each button's link from the request's links; never write a link into `cta` or `title`. No phone number in `title` or `body`. Links in a body are discouraged (not clickable in GBP). |
| `posts[].photo` | A photo ref from words-inputs.json (`"photo-2"`, or its file name `"photo-2.jpg"`), or `null`. When there are photos, posts must use them; a photo may appear on two posts. |
| `posts[].imageHint` | What the picture shows. With a photo: describe that photo (what is visible, from the photo and its note). Without: the photo to take next (a shot to add to their library). Never stock or AI images. |
| `seo.title` | Main service + area + business name (the distinctive part of the name is enough). |
| `seo.description` | Services + area + a reason to click, from their answers. No claims. |
| `seo.keywords` | Phrases a local customer types: service + city or area. No duplicates. |
| `reviews.requestSms`, `requestEmail.body` | Must contain the Google review link exactly as given (`urls.review`), or the placeholder `[review link]` when there is none. `[name]` is allowed. |
| `reviews.replies` | Exactly 5, one per rating 1 to 5 (any order; the server sorts 5 first). `[name]` allowed. A phone number only if it is the business phone. |
| `social.bio` | Fits a 150-character profile bio: what, where, how to book. |
| `social.captions` | Exactly 3, all different. 3 to 8 hashtags read best. |
| `notes` | For the admin, not the customer. |

Every text is plain: no tabs, no spaces at line ends, no more than one blank line in a row; one-line fields
(titles, subject, keywords, service names, image hints) have no line breaks or doubled spaces.

## What the server does after you

`src/lib/kit/words.js` re-checks the file. It cuts anything over a limit, puts the site's service names back
in the site's order, sets every category's `confirm` to `true`, turns a CALL button into LEARN_MORE without a
phone, replaces a photo ref with the stored photo, sets each post's link, adds the review link or the
placeholder when a request text lacks it, and lists every change and every unsourced claim it finds for the
admin. A file that passes `validate_words.py` comes through unchanged.
