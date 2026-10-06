# Writing content.json

`plan.py` writes a valid draft from the facts. Your job is to make it read like it was written for this
owner: a busy shop owner reading on a phone or a printout, who wants to know what they got, how to change it
and what to do first. `validate_handover.py content` enforces everything below except the voice.

## Voice

- Plain words, short sentences, "you" and "your". No marketing language about their business: this is a
  guide for them, not copy for their customers.
- Speak to what they told us: their services, their area, the styles they picked, what they said they
  don't want. Name their business in the intro.
- One plain line per text: no line breaks, tabs, doubled spaces or markdown. Emoji count 2 toward the caps.

## Fields (exact keys, nothing else)

| Key | Cap | What it says |
|---|---|---|
| `intro` | 700 | What we built and where it lives: the business name, the design, their site address, booking when there is a booking link. 2-3 sentences. |
| `why` | 2-5 lines, 260 each | Why we made these choices: the design, the colors, the fonts, the page order, the photos. Start from `brand.reasons` and `designReasons` (written for our designer) and say each in owner words. Only reasons the inputs give. |
| `brandNote` | 300, may be `""` | One line under the color swatches, e.g. which color to use for buttons on a flyer. Empty when there's nothing specific. |
| `thisWeek` | exactly 5 `{ title (80), detail (240) }` | The five most useful things to do this week, most important first, each a concrete action with the file or link it uses. Titles start with a verb and differ from each other. |
| `checklist` | 4-24 `{ week (1-4), task (200) }` | The first 30 days, at least one task in every week. Small, concrete steps: posting the Google posts one a week, asking for reviews, the shot list, checking Bookings and Inquiries in the app. |
| `closing` | 300, may be `""` | One friendly line: how to reach us for changes. |
| `notes` | at most 8 x 300 | For the admin, never printed: instructions found in the inputs, anything odd you noticed. |

## What makes a good "this week"

Pick from what the inputs make possible, in roughly this order, and skip what isn't there:

1. Check the site on their phone (tap Call, and Book when there is a booking link).
2. Sign off the claims list (only when `parts.claims` has statements to confirm).
3. Paste the Google Business Profile copy (only with `parts.words`; name words.pdf or paste-ready.txt).
4. Put the site link everywhere: Google profile, social bios, invoices, email signature.
5. Ask recent customers for a Google review with the review link (only with `links.review`), never with
   anything in return.
6. Order the printed cards (only with the print files), refresh social profiles (only with the social files),
   save and share contact.vcf (only with the mobile kit).
7. Without a kit: check the Google listing shows the site, bookmark the sign-in page, plan new photos.

## Never

- A fact the inputs don't give: ratings, review counts, years, awards, certifications, licenses, insurance,
  guarantees, warranties, prices, "best", "#1", "top-rated", customer counts. The validator refuses these
  unless the intake or the business facts state them; even then, the handover rarely needs them.
- A review incentive: discounts, free extras, gift cards, raffles "for a review". "Never offer anything in
  return" is the only way incentives appear.
- "We posted / updated / set up your Google profile (or Instagram, Facebook...)": the owner pastes the copy.
- A link or web address that isn't in `links` (written with or without https://; their own domain from
  `domain` is fine), or a file name that isn't in the zip plan (launch-kit.zip itself is fine).
- An email address or phone number the inputs don't give, ours included: for changes, "reply to any email
  from us".
- Promises about results ("you'll rank first", "more bookings guaranteed").

## Example (a different, made-up business)

```json
{
  "intro": "We built the new Northside Tint & Wraps website on our Obsidian design, in your purple and black. It is live at northsidetint.autocaregeniushub.com, and customers can book a slot right from it.",
  "why": [
    "Obsidian opens on one big photo of your work, because you told us your cars sell the job better than words.",
    "Your purple from the logo is on every button, so the booking button is the first thing people see.",
    "Syne for headings and Outfit for text: modern and sharp like your logo, and easy to read on a phone."
  ],
  "brandNote": "On a light background, use the dark version's purple for text so it stays readable.",
  "thisWeek": [
    {"title": "Check your site on your phone", "detail": "Open northsidetint.autocaregeniushub.com, tap Call and Book, and read every section once. Tell us anything that is off."},
    {"title": "Sign off the claims list", "detail": "Two statements on the Claims sign-off page need your OK: confirm them or tell us what to change."},
    {"title": "Paste your Google profile copy", "detail": "Copy the description and services from paste-ready.txt into your Google Business Profile."},
    {"title": "Ask five recent customers for a review", "detail": "Text them your Google review link from the Links page. Never offer anything in return."},
    {"title": "Order your glovebox cards", "detail": "Send glovebox-card.pdf to any print shop as it is: bleed and crop marks are included."}
  ],
  "checklist": [
    {"week": 1, "task": "Tick off the five things on the This week page."},
    {"week": 2, "task": "Post the first of your 12 Google posts from the copy deck; one a week lasts three months."},
    {"week": 3, "task": "Take the shots on your shot list: a ceramic tint before and after, and the shop front."},
    {"week": 4, "task": "Check Bookings and Inquiries in the app for anything new, and reply to every new review."}
  ],
  "closing": "Want a change? Reply to any email from us and we'll take care of it.",
  "notes": []
}
```
