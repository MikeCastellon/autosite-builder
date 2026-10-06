# The phone plan (choices.json)

## Phone headline (at most 40 characters)

The site's hero headline (`site.headline`) made short enough for two lines at phone width. Condense: keep the
service and the place, drop the rest. Allowed words: those of the headline, the subheadline, the business name
and type, the city, state and service area, the service names and the hero buttons, plus small glue words
("your", "with", "near", "in", "for"). Not allowed: any new word of four or more letters, any number the site
doesn't state, claims ("best", "top", "#1", "free", "certified", "guaranteed", years) the site doesn't make.

| Site headline | Phone headline |
|---|---|
| Showroom-level mobile detailing, right in your Tampa driveway | Mobile detailing in your Tampa driveway |
| Ceramic coatings and paint correction for Orlando drivers | Ceramic coatings in Orlando |
| Tint that keeps your car cool and private | Tint that keeps your car cool |

If the site headline already fits, use it as it is.

## Home-screen name (at most 12 characters)

iOS and Android cut longer names. Use the business name's best-known words ("Gloss Boss" for "Gloss Boss
Mobile Detailing"), two words run together ("TopChoice"), or its initials. Nothing else.

## Text-for-a-quote message (at most 160 characters)

What the visitor sends: a short, polite request in their voice that tells the business a photo follows. It
must work as written (no `[brackets]` to fill in), name the business when it fits, carry no claims, no prices or
other numbers the site doesn't state, nothing about the visitor. One line. The default is "Hi <name>, I'd like a quote. Here's a photo of my
vehicle:". Match the trade: "of my wheels" for a wheel shop, "of my car" for tint.

The sms link can't attach the photo; Messages opens with the text ready and the visitor adds the photo.

## Actions

Order by what a phone visitor of this business does first:

- Shop with an address (detailing shop, tint, wheels, repair, car wash): call, book (when there is booking),
  directions, text, save.
- Mobile service (no street address): call, text, book, save.
- Quote-driven trades (tint, PPF, ceramic, wheels, paint correction): text moves up, right after call.

Labels: short verbs, at most 24 characters ("Call", "Text a photo", "Book", "Directions", "Save contact"). No
"free", "now!", claims or numbers the site doesn't state ("Call 24/7"). Leave out an action only with a reason
in `notes` (e.g. the intake says they don't take texts).

## Phone section order

The site has one order for every screen; this is the order recommended for phones (the designer applies it
when it also suits desktop). Use every visible id of `site.sections` once, `hero` first. On a phone each
section is a full screen of scrolling, so lead with what decides a booking:

1. `hero`
2. what they sell: `services` / `products` / `featured` (keep `services` within the first three)
3. proof: `testimonials`, `gallery`, `brands`
4. `about`, `process`, `whyUs`, `shadeGuide`, ticker-style bands lower
5. `locations` / service area and hours, then `cta` near the end (the Call/Book bar is always on screen)

Keep a section where the site has it when moving it gains nothing, and say why the big moves help in `notes`.

## Scorecard

`build_plan.py` fills it; you don't write it. "To fix" lines you can't fix in the kit (no hours, no booking,
no country code) go to the designer through `notes`. The three "check in preview" checks are measured in the
browser later, and "The number takes texts" needs the customer to confirm.
