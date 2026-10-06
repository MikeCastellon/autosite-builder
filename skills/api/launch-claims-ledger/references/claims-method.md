# Claims method

## What is a claim

A claim is anything a reader could check or rely on when choosing the business. One entry per claim, even when
one sentence holds several.

| kind | Examples | Not a claim |
|---|---|---|
| `price` | "$199 full detail", "free estimates", "15% off first visit", "financing available" | "affordable" (taste), "Get a quote" |
| `rating` | "4.9 stars on Google", "5-star rated", "200+ five-star reviews" | "our customers love us" (taste) |
| `review` | a customer's words shown as a review on the site | a review reply in the Words kit (check its claims as `gbp`) |
| `years` | "since 2015", "12 years of experience", "decades" | "for years to come" |
| `number` | "500+ cars", "98% of customers", "done in 2 hours", "over 1,000 coatings" | "one car at a time" (manner) |
| `award` | "award-winning", "Best of Tampa 2023", "voted #1", "as seen on" | |
| `certification` | "IDA certified", "ASE technicians", "licensed and insured", "authorized XPEL installer" | "trained eye" |
| `guarantee` | "satisfaction guaranteed", "money-back", "100% happy or we redo it" | "we care about every car" |
| `warranty` | "lifetime warranty", "5-year coverage", "backed by the manufacturer" | |
| `brand` | "we use Gtechniq", "XPEL film", "Michelin tires" | car makes they work on ("we detail Teslas") unless stated as a partnership |
| `area` | "serving Tampa, Brandon and Riverview", "within 30 miles", "statewide" | the business's own address |
| `superlative` | "best", "#1", "top-rated", "the only", "first in", "leading", "most trusted", "unbeatable" | "showroom shine", "spotless" (taste) |
| `availability` | "24/7", "same-day", "open 7 days", "we're on time, every time" | the posted hours |
| `other` | "eco-friendly", "non-toxic", "scratch-free", "veteran-owned", "family-owned", "OEM parts" | |

Taste and manner ("meticulous", "premium care", "we treat your car like ours") are not claims; dismiss them.
When in doubt, keep it as a claim: the admin can see it is sourced, but can't see what you dismissed.

## Tracing

1. Start from the hints the pre-pass printed; confirm the quote states the claim. A shared number in a
   different sense ("8 years" vs "8 cars a week") is not a source.
2. Search the sources (`search_sources.py`) with the claim's key words and numbers.
3. Choose the strongest source: the customer's own answer (`about`, `whyUs`, `services`, `serviceArea`, ...),
   then `businessInfo.*` (facts the team confirmed or read from Google), then `testimonials` (reviews only).
4. Quote the shortest piece that states it, word for word from the source (the hint quotes are already word
   for word). For business info, quote the whole line (`yearsInBusiness: 8`).

## Status, with examples

| Claim (where) | Source | Status | Suggestion |
|---|---|---|---|
| "8 years of experience" (site) | about: "I've been detailing cars for 8 years" | sourced | "" |
| "over 10 years of experience" (site) | about: "detailing cars for 8 years" | needs-rewrite | "8 years of experience" |
| "IDA certified" (gbp) | whyUs: "I'm IDA certified" | sourced | "" |
| "certified ceramic installer" (site) | about: "trained by Gtechniq last spring" | needs-rewrite | "trained by Gtechniq" |
| "Tampa's #1 mobile detailer" (site) | none | unsourced | "Tampa mobile detailing that comes to you" |
| "best detailer in Tampa" (social) | testimonials: "Best detailer in Tampa! - Mike R." | needs-rewrite | Quote it as a review: "\"Best detailer in Tampa!\" - Mike R." |
| "4.9 stars on Google" (site) | businessInfo.googlePlace: "googlePlace.rating: 4.9" | sourced | "" |
| "5-star rated" (seo) | businessInfo.googlePlace: "googlePlace.rating: 4.9" | needs-rewrite | "rated 4.9 on Google" |
| "lifetime warranty" (print) | services: "Ceramic coating $899 (5 year warranty)" | needs-rewrite | "5-year warranty on ceramic coating" |
| "serving Tampa, Brandon and Riverview" (gbp) | serviceArea: "Tampa and Brandon" | needs-rewrite | "serving Tampa and Brandon" |
| "Full detail $199" (site) | services: "Full detail - $199" | sourced | "" |
| "Full detail from $149" (gbp) | services: "Full detail - $199" | needs-rewrite | "Full detail $199" |
| "satisfaction guaranteed" (site) | none | unsourced | Remove "satisfaction guaranteed" |
| a review on the site, changed from the pasted one | testimonials: the original | needs-rewrite | the original wording, exactly |
| a review on the site, word for word | testimonials: its text | sourced | "" |
| "eco-friendly products" (social) | none | unsourced | "products chosen for each surface" only if the sources say so; else Remove "eco-friendly products" |

## Writing suggestions

- The suggestion replaces the claim text in place: same tone, same length roughly, only what the sources say.
- Use the customer's own figures and words ("8 years", "5-year warranty", their list of towns).
- When nothing honest fits, write `Remove "..."` (naming the words to cut).
- Never add a number, brand, award, area or promise that no source states (the validator rejects new
  numbers; avoid new superlatives too).
- Reviews: never paraphrase. A review on the site that differs from the pasted one gets the pasted wording; a
  review that isn't in the pasted reviews gets: Remove this review, or replace it with one the customer sends,
  word for word with the name.
- The site's testimonials (`testimonialPlaceholders`) start as sample reviews written for the template. One
  that isn't in the pasted reviews is `unsourced` like any other review; never suggest calling it real,
  verified or from Google.

## Where and path

Copy `where` and `path` from the candidate. For claims you found by reading `checked.txt`, take them from its
`[where] path:` prefix. The same claim in two texts (two posts, the site and a print piece) is two entries:
the admin fixes each place. The same claim twice in one text is one.
