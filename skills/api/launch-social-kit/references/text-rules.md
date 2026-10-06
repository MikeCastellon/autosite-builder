# What may be written

`scripts/textrules.py` is the gate (data/text_rules.json holds the lists); compose and the validator run it on
every line, caption and alt text, and the server runs the same rules again. Check one line while planning:
write it to a file, then `textrules.py check --brief /tmp/social/brief.json --role headline --file line.txt`.

## Sources

The brief's `sources` carry a `kind`:

| Kind | What | May back a claim |
|---|---|---|
| `facts` | business facts the site shows (name, city, area, phone, services, prices, certifications), the site host | yes |
| `owner` | the customer's own intake answers (services, story, why us, handles) | yes |
| `site` | the written site's copy | no |
| `words` | the Words kit's texts (bio, captions, Google profile, search) | no |
| `reviews` | the reviews the customer pasted | only inside a quote |

Words are compared as lowercase letters and digits only: accents, punctuation and case don't matter, `&` reads as
"and".

## Image lines

A line passes when its words appear in that order, together, in one source text, or when it equals an allowed
phrase. Then every claim in it (any number; claim words such as best, rated, years, certified, insured, licensed,
guaranteed, warranty, free, trusted, family owned, same day, premium, expert) must appear in a `facts` or `owner`
source. Neutral phrases (feel free, spot free, hassle free, ...) are no claims.

| Source text | Line | Result |
|---|---|---|
| site: "Showroom shine, wherever you park" | "Showroom shine" | ok (a run of its words) |
| same | "Shine wherever you park" | refused (not a run) |
| site: "Hand washes and the best interior details" | "the best interior details" | refused: "best" is in no fact or answer |
| facts: "12 years in business" | "12 years in business" | ok |
| facts: "Ceramic Coating $899" | "Ceramic Coating $799" | refused (not in any source) |
| (allowed phrase) | "Book online" | ok only when the site takes bookings |

Allowed phrases: Our new website is live, New website, Now live, Take a look, Visit our website, See our work,
Learn more, Link in bio, Follow us, Our services, What we do, Before and after, Book online / Book now / Now booking
(booking), Call us / Call or text / Call today (a phone on the site), What our customers say / From our customers
(only on an image that carries a quote), and a few more (`textrules.py sources` lists the ones this site may use).

## Reviews

The pasted reviews are read one per line, as the customer pasted them.

- `quote`: one or more whole sentences of one review, word for word, in order. "Best wash in Ohio." from
  "Best wash in Ohio. They even cleaned the floor mats!" is fine; "They even cleaned the floor" is not, and
  neither is a quote that joins the end of one review to the start of the next.
- `cite`: the name pasted with that review, as written ("Jordan P."): on the review's own line, or on a short name
  line right under it ("- Casey V."). Never invent, complete or borrow a name from another review; a review pasted
  without a name gets no cite.
- "What our customers say" and "From our customers" only go on an image that carries a quote.
- A line found only in the reviews may not be a headline, eyebrow, sub or anything but a quote.
- The site's own testimonials are never a source: they may be samples written for the template.

## Captions and alt text

Free text, with the claim rule: every number and claim word must be in the facts or the owner's answers. A whole
review sentence inside quotation marks counts as the reviewer's words: `"Best wash in Ohio." Thanks, Jordan!` is
fine; `The best wash in Ohio!` is refused. Captions: at most 2200 characters and 30 hashtags. Alt text: at most
250 characters, describing what is visible and the words on the image.
