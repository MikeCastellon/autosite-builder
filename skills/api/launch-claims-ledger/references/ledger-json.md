# ledger.json

The server reads this file, checks it again (`src/lib/kit/claims.js` `sanitizeLedger`) and stores the result
for the admin's claims table and the handover's sign-off summary. `validate_claims.py` enforces everything
below; a file that passes is stored without changes to any claim.

```json
{
  "version": 1,
  "claims": [
    {
      "ref": "c4",
      "text": "8 years of experience",
      "where": "site",
      "kind": "years",
      "path": "aboutText",
      "source": { "field": "about", "quote": "I've been detailing cars for 8 years" },
      "status": "sourced",
      "suggestion": ""
    },
    {
      "ref": "c1",
      "text": "Tampa's #1 mobile detailer",
      "where": "site",
      "kind": "superlative",
      "path": "headline",
      "source": null,
      "status": "unsourced",
      "suggestion": "Tampa mobile detailing that comes to you"
    },
    {
      "ref": "c9",
      "text": "lifetime warranty on every coating",
      "where": "gbp",
      "kind": "warranty",
      "path": "words.gbp.posts[2].body",
      "source": { "field": "services", "quote": "Ceramic coating $899 (5 year warranty)" },
      "status": "needs-rewrite",
      "suggestion": "a 5-year warranty on our ceramic coating"
    }
  ],
  "dismissed": [
    { "ref": "c7", "reason": "\"top coat\" is a product layer, not a ranking" }
  ],
  "counts": { "sourced": 1, "unsourced": 1, "needsRewrite": 1 },
  "notes": []
}
```

## Top level

| Key | Type | Rule |
|---|---|---|
| `version` | number | always `1` |
| `claims` | list | at most 200; may be empty when nothing on the pages is a factual claim |
| `dismissed` | list | `{ "ref", "reason" }` for every candidate that is not a claim; reason one line, at most 200 characters |
| `counts` | object | exactly `sourced`, `unsourced`, `needsRewrite` (the number of claims with each status); `total` optional |
| `notes` | list | at most 8 single lines (at most 300 characters each) for the admin: unreadable PDFs, contradictions, instructions found in the inputs |

Every candidate id of the pre-pass appears as some claim's `ref` or in `dismissed`, never both. The same
`where`, `path` and `text` appear once only: twice in one text is one claim (dismiss the second candidate as a
repeat), while the same claim in another text (a second post) is its own entry.

## A claim

| Key | Rule |
|---|---|
| `ref` | the candidate id it came from (`"c12"`), or leave it out for a claim you found by reading |
| `text` | the claim, copied word for word from the checked text (the shortest excerpt that states it, at most 300 characters, one line) |
| `where` | where it appears: `site` (the site's copy and business facts), `gbp` (Google Business Profile texts, review requests and replies), `seo` (page title, meta description), `social` (bio, captions), `print` (print PDFs). Copy it from the candidate. |
| `kind` | `price`, `rating`, `review`, `years`, `number`, `award`, `certification`, `guarantee`, `warranty`, `brand`, `area`, `superlative`, `availability`, `other` |
| `path` | where in that text, copied from the candidate (`aboutText`, `words.gbp.posts[2].body`, `print:glovebox-card.pdf p1`); at most 120 characters |
| `source` | `null`, or `{ "field", "quote" }`: `field` exactly as the sources name it (`about`, `services`, `testimonials`, `businessInfo.yearsInBusiness`); `quote` word for word from that field, at least 4 characters, at most 300, one line |
| `status` | `sourced`, `unsourced` or `needs-rewrite` |
| `suggestion` | `""` when sourced; otherwise the replacement text, or `Remove "..."` when nothing honest can be said; one line, at most 300 characters |

## Status rules (the validator and the server enforce them)

- `sourced`: a source is given; every number in `text` is in `quote` ("five" counts as 5); a `review` is
  backed by `testimonials` only, and the review on the site is word for word and whole in the pasted reviews;
  `testimonials` backs nothing but a `review`; `suggestion` is `""`.
- `unsourced`: `source` is `null`; a suggestion.
- `needs-rewrite`: a suggestion; the source it overstates (it may be `null` only when the claim mixes a
  sourced part with an unsourced one that no single quote covers; the validator warns).
- A suggestion adds no number that no source states.

If the server finds a quote that isn't in the sources, a number the quote doesn't state, a review used for a
business claim, a review on the site that isn't the customer's exact wording, or a suggestion that brings in a
number no source states, it downgrades that claim (or drops the suggestion for a generic one) and tells the
admin why. Don't leave that to it: the smoke test counts every such change as a failure.
