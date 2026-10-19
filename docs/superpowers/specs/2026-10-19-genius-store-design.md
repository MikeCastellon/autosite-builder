# Genius Store on Genius Websites

**Date:** 2026-10-19
**Status:** Approved by the owner 2026-10-19 ("write the spec and start phase 1"); phase 1 in progress
**Builds on:** Genius Storefronts (`MikeCastellon/genius-storefronts`, Supabase `hatitkkwrrzkwmahajhm`), its
[`docs/attribution.md`](https://github.com/MikeCastellon/genius-storefronts/blob/main/docs/attribution.md)

## Summary

Any Genius Websites owner can put a Genius Store on their site: a Shop section that embeds their own Genius
Storefronts iframe of Auto Care Genius products. Shoppers check out on autocaregenius.com, ACG ships the order,
and the owner earns commission on every sale their store sends. Genius Storefronts already does the catalog,
attribution, commission maths and payouts; Website Creator only signs the owner up as a partner and renders
the embed.

## Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Catalog | Genius Storefronts' Shopify mirror (`catalog_collections` / `catalog_products`), unchanged |
| 2 | Fulfilment | ACG ships (dropship); the owner holds no stock |
| 3 | How the owner earns | Commission per attributed sale, Storefronts' existing rules (default 10% of the product subtotal) |
| 4 | Who can turn it on | Every owner, free or Pro, same terms |
| 5 | Approval | Automatic: turning the store on creates an **approved** partner. ACG can still suspend in Storefronts admin |
| 6 | Payouts | Stay in Storefronts: the owner enters ACH / Zelle / PayPal there, ACG settles as for any partner. Not Stripe Connect (only Pro owners have it) |
| 7 | GoAffPro | Storefronts links move from `?ref=` to `?acgref=`, and the order webhook stops reading GoAffPro's `ref` cart attribute, so the two programmes never see each other's referrals |
| 8 | Where it is turned on | The editor's **Genius Store** tab (the section lives there). A dashboard card comes with phase 2 |
| 9 | Where the link is stored | In the site's own copy: `copy.store = { slug, title?, intro? }`. Storefronts is the source of truth for everything else, so Website Creator needs **no database change** |
| 10 | Framing | The storefront's `allowed_domains` stays empty (framable anywhere). An embed only ever credits its owner, so a copy on another site cannot take money from them, and custom-domain changes need no sync |

## Who owns what

```
Website Creator (ktnouhjikmlxlbxcxyif)          Genius Storefronts (hatitkkwrrzkwmahajhm)
──────────────────────────────────────          ─────────────────────────────────────────
editor > Genius Store tab
  └─ POST /.netlify/functions/genius-store  ──►  POST /functions/v1/website-partner
       requireSiteOwner, adds the owner's            shared secret, no user JWT
       email / name / business                       ├─ auth user by email (reused if there)
                                                     ├─ affiliates row, status approved,
  ◄── { slug, refCode, discountCode, ... }  ◄──      │   source 'genius_websites', terms stamped
copy.store = { slug }                                ├─ Shopify discount SAVE-<ref> (best effort)
                                                     └─ storefront external_ref 'gw:<siteId>'
template Shop section                                    + default collections
  <iframe src="storefronts.autocaregenius.com/e/<slug>">
published page: SITE_STORE_JS sizes the iframe
```

Money never flows through Website Creator, and no Storefronts data is copied into it.

## Genius Storefronts changes

**`?acgref=` (decision 7).** `productUrl`, the embed's `/go` hop, `shareLink` and the embed footer link use
`acgref`. The theme snippet reads `acgref` only (cookie and cart attribute stay `acg_ref`). `attribution.js`
drops `ref` from `REF_ATTRIBUTE_NAMES`: GoAffPro writes a cart attribute of that name.
Live impact: the 5 existing partners' embeds switch automatically (links are generated per click); a share link
they copied before (`?ref=`) stops attributing, so they re-copy it from Settings. Shoppers already carrying the
30-day `acg_ref` cookie keep attributing. The theme snippet must be republished on the live Shopify theme right
before the Storefronts deploy (owner step).

**Migration `0018_genius_websites.sql`.**
- `affiliates.source text not null default 'invite' check (source in ('invite','genius_websites'))`, so ACG admin
  can tell the two kinds of partner apart.
- `storefronts.external_ref text unique`: `gw:<site uuid>`, so provisioning is idempotent per site.
- `affiliates_guard_self_update()` also lets `service_role` through. Today it lets only a signed-in admin change
  money columns, so a server-side update fails. Example: the invite function's "clear the discount code when
  Shopify refused it" step fails, which is why 3 of the 5 partners show no code. Provisioning has to approve a
  partner who is still pending, so it needs this too.

**Edge function `website-partner`** (Supabase, `verify_jwt = false`, header `x-genius-websites-key` compared in
constant time with secret `GENIUS_WEBSITES_KEY`; missing secret fails closed):

| action | input | does |
|---|---|---|
| `terms` | none | `{ version, terms }` from `partnerTerms.js`, so the editor shows the exact words the owner accepts |
| `provision` | `email, name, company, siteId, storeName, accent?, scheme?, termsVersion` | idempotent; rejects a stale `termsVersion` (409), a suspended partner (403). New partner: approved, `source 'genius_websites'`, default rate, ref code, Shopify discount best effort. Existing pending partner: approved. Storefront for `gw:<siteId>` reused or created with a slug from the store name, the site's accent and light/dark scheme, the default collections and 8 products per collection |
| `status` | `email, siteId` | `{ partner: { status, refCode, discountCode, rate }, storefront: { slug, status } }` or nulls |

Default collections: the first 4 currently sellable of `best-sellers-1`, `kits-and-bundles`,
`car-wash-soap`, `microfiber`, `interior-cleaners`, `ceramic-coating-kits`, `wheels-tires`,
`glass-window-care`, 8 products each (about 32). The iframe grows to fit the store, and the embed's own
defaults (60 per collection) made a 12,000px section in the first render. The owner changes all of it in the
Storefronts dashboard.

`partnerTerms.js` is vendored into `supabase/functions/_shared/` and added to `portParity.test.js`.
`createShopifyDiscount` moves to `_shared/shopifyDiscount.ts`, shared with `affiliate-invite`.

## Website Creator changes

**Function `netlify/functions/genius-store.js`** (POST, Bearer token): `terms`, `enable { siteId, termsVersion,
accent, scheme }`, `status { siteId }`. `enable` / `status` go through `requireSiteOwner`; the email is always the signed-in
user's, never the client's. Env: `GENIUS_STOREFRONTS_URL` (the `website-partner` URL), `GENIUS_WEBSITES_KEY`.
Missing env answers 503 "not set up yet", never a crash.

**Kit `kit/store.js` + `kit/StoreBand.jsx`.**
- `storeOf(copy.store)` validates the slug against Storefronts' own CHECK (`^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$`),
  so a hand-edited copy can never point the iframe anywhere but `https://storefronts.autocaregenius.com/e/`.
- `StoreBand` renders `<section data-section="shop">`: the heading (owner's title / intro, else
  "Shop car care products" / "Order professional car care products online, shipped to your door by Auto Care
  Genius."),
  the iframe (`data-acg-store`, `loading="lazy"`, 900px until it reports its height), and an always-on
  disclosure line ("<Business> earns a commission on purchases made through this store."). Storefronts' terms
  require that disclosure.
- No `copy.store` (or a bad slug): nothing renders, in the editor too (the Sections list hint says how to turn it on).

**Runtime `SITE_STORE_JS`** (siteRuntime.js): added by exportHtml only to a page with `data-acg-store`, like
`SITE_BA_JS`. A `message` listener that accepts only `event.origin === 'https://storefronts.autocaregenius.com'`,
`type 'acg:height'`, 100-20000px, and resizes the iframe whose `contentWindow` sent it. The editor preview gets the
same listener from WebsitePreview.

**Templates (phase 1):** DetailingSporty (live sites: `shop` goes in `addedSections`, so saved sites render
byte-identical) and MobileDriveway. Section id `shop`, label "Genius Store", placed before the testimonials /
contact block. Each theme aliases the band's `--<p>-st-*` variables to its own repaired tokens.

**Editor:** capability `store` (`copy.store`), tab **Genius Store** (`id 'store'`). Off: what it is, the
commission, the terms (fetched with `terms`, in a scroll box), an "I agree" checkbox, **Turn on my store**.
On: title / intro fields, the referral and discount codes, and "Track sales and set up payouts at
storefronts.autocaregenius.com (sign in with <email>)". Turning it off clears `copy.store` (the Storefronts partner
and storefront remain, so turning it back on reuses them).

## Phases

1. **This PR + Storefronts PR:** everything above.
2. The remaining theme-ready templates; one-click sign-in to Storefronts (`/auth/sso` token from `website-partner`);
   dashboard card with status.
3. Earnings in the Website Creator dashboard (`status` grows totals); a welcome email.

## Rollout order (owner steps marked)

1. Done 2026-10-19 (owner approved): Storefronts migrations 0018 and 0019 applied; the shared key is in Vault
   (`genius_websites_key`, read by the service-role-only `genius_websites_key()`: edge function secrets need the
   CLI, which was not signed in); `website-partner` deployed and smoke-tested (401 without the key, terms and
   status with it); `GENIUS_WEBSITES_KEY` (secret, functions scope) and `GENIUS_STOREFRONTS_URL` set on the
   autosite-builder Netlify site. A copy of the key is in the main checkout's gitignored `.env.local`.
2. Test on this PR's deploy preview with a non-staff account (it creates a real partner and a real `SAVE-` code).
3. Done 2026-10-19: the `?acgref=` snippet is live on the Shopify theme (ACG-ActiveTheme e905d76, two-way
   synced), Storefronts `main` is pushed (embed deploy 14a051b sends `?acgref=`), and `shopify-order-webhook`
   (v11, no `ref` attribute) and `affiliate-invite` are redeployed, in that order so no click went unattributed.
4. **Owner:** merge this PR once a store has been turned on from the preview.
5. Tell the 5 existing partners to re-copy their share link.

## Not in scope

Per-owner commission rates (same terms for all), in-app payouts, Stripe Connect payouts, inventory, owner-set
prices, restricting where the embed may be framed.
