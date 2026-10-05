# PR #10 merge impact: will it hurt current sites or paying customers?

Date: 2026-10-02, about 20:15 UTC (4:15 PM ET).
Question from the owner: "Will merging this mess up any of our current sites and paying customers in any way? I need a deep analysis."

The analysis was read-only. Production data was only SELECTed and live pages were only fetched with GET. Every page, booking, inquiry, beacon and charge test ran against local stubs. Sites appear by slug or business name. No shop customer's personal data is included.

**What was analysed.** The deep work (every live site, widgets, bookings, money, editor, functions, republish dry-runs) ran on PR head **99d66cd** merged into master **8970027**. Both branches have moved since then:

| | When the analysis started | Now (`git ls-remote origin`, 20:10 UTC) |
|---|---|---|
| Production master | 8970027 | **3e72d7d**, which is PR #13 (custom-website design and hand-over, RLS hardening). It is live as Netlify deploy `6abffcdf058ba40009663376`. |
| PR #10 head | 99d66cd | **ce9f67f**. It adds 1eaa8d1 (new AI copy generation), 368db9a (master merged in), 79b5205 and ce9f67f (an admin "Site upgrades" tool, a new migration and a dashboard banner). |

I re-checked ce9f67f for this report (section 5, HEAD-1). These files are byte-identical in 99d66cd and ce9f67f, so the per-site, widget, booking and template findings still apply: the widget scripts, `src/lib/bookings.js`, `BookCustomerModal.jsx`, `charge-pricing.js` and every template. The parts added after 99d66cd have only been code-read and test-run (see section 8).

> **Update 2026-10-05. Where this doc and the branch now differ, the branch wins:**
>
> - **OG backfill:** use `impact/rollback/og-booking-time-sql-v2.sql` (session folder, not in the repo). v1 is renamed `og-booking-time-sql.v1.superseded.txt`.
>   - v2 builds its list at deploy time (`created_at < T`) and checks its own counts. It also handles rows v1 already moved, and it refuses other sites' rows.
>   - It replaces every "expect UPDATE 14" and every list of 8 old jobs below (lines about sections 1, 5, 7.1 and 7.4). OG had 16 dashboard rows on 2026-10-05.
> - **Merge window:** weekday daytime ET (Wed Oct 7 8-10 AM, fallback Tue Oct 6 noon-2 PM), not after 9 PM ET. OG enters most dashboard bookings between 8 and 10 PM ET.
> - **Stale tabs (EO-2 / SF-2 / DS-1):** fixed in 91112cf. A Book Customer dialog opened before the deploy now gets a 409 "please reload" and saves nothing, so post-deploy rows can't escape the backfill. OG still has to reload, because old tabs show times 4 hours off.
> - **AI generation (NB-1):** verified against the real API on 2026-10-05: Opus 5 and the legacy request both returned valid copy. 11d0750 adds fallbacks to the legacy request and the legacy route.
> - **What's New (HEAD-2):** the owner approved new wording (34181a9). It no longer invites owners to Republish.
> - **New since ce9f67f:**
>   - the old-browser container-query fallback (XB-1 / R1, 3fc5be1);
>   - template QA fixes (4a62f0d);
>   - `UPGRADE_MANUAL_SKIP` (16ab5cc);
>   - owner emails in Site upgrades (9f9d076).
> - **New env vars:** `POSTMARK_UPGRADE_STREAM` (owner emails refuse to send without it), plus the optional `UPGRADE_EMAIL_REPLY_TO` and `AI_MODEL_GENERATE`.
> - **Migration `20261004`:** apply it right before the merge, so owner publishes after the deploy are recorded.

---

## 1. Bottom line

**Yes, we can merge. No live website breaks, no money is charged wrongly, and no paying customer is locked out. One paying customer needs a database fix within minutes of the deploy, and four decisions need you first.**

- **The merge itself changes no live page's design.** Templates reach a live site only when someone republishes it. Only the two widget scripts change on every live page at deploy time. I tested them in Chrome, Firefox and iOS Safari on all 44 testable live pages: 0 errors and 0 booking-flow changes. The changes are fixes (phone calendar, page-view counting, inquiry-form position).
- **One problem hits a paying customer the moment we deploy (high, INV-1 / SE-1 / BK-1).** OG Detailing (og-detailing) has 8 confirmed upcoming appointments that the owner entered from the dashboard. The first is **tomorrow, Sat Oct 3 at 8:00 AM ET**. The new dashboard shows each of them 4 hours late (8:00 AM becomes 12:00 PM), and the pre-filled reminder text does too. A one-time SQL backfill, run **right after** the deploy and never before, fixes it completely. It also fixes two problems OG already has today. It is a production write, so it needs your approval.
- **You need to approve what the PR now tells every owner (medium, HEAD-2).** On deploy, every owner's dashboard shows a "What's New" banner. It says the new designs carry over "your photos, services, prices and contact details" and that "over the next few days we're republishing live websites with the new design". On 6 live sites a republish would lose owner photos or text that exist only in the live page (section 3). On every republished site, visitors on iPhones with iOS 15 or older get a broken layout (XB-1). Approve that rollout, or change the text, before merging.
- **The real risk is republishing, not merging.** It applies whether or not we merge, because the content gaps already exist. It needs a policy (section 7.3): no bulk republish until the old-iPhone fallback is in and the 6 risk sites are fixed.

**Merge under these conditions:**

1. Merge exactly **ce9f67f**, or re-run the checks on whatever is pushed. Your working tree has 64 more uncommitted changes. Don't push them into this PR without re-analysis (INV-2).
2. Approve the OG backfill. Have someone ready to run it within minutes of the deploy, at a quiet hour (tonight after about 9 PM ET, or Monday). Tell OG to reload the dashboard afterwards (section 7.1).
3. Approve or reword the "What's New" banner (HEAD-2). The text is in `src/data/changelog.js`, entry `2026-10-site-upgrade`.
4. Keep the admin "Site upgrades → Republish all" unused until the republish policy conditions in section 7.3 are met. Apply its migration `20261004_sites_published_at.sql` only with your approval. Owner publishes work fine without it (HEAD-3).

---

## 2. What changes the moment we merge

### 2.1 Live sites (the two widget scripts load from the app on every page view)

The deploy reaches the **39 live pages** that load `scheduler.js` from sitebuilder.autocaregenius.com, all 3 paying customers among them. Ten pages load `contact-form.js`. The deploy does not reach titos-car-wash and its custom domain quandetach.com (scripts on deploy-preview-8, CUS-2), top-choice-mobile-detailing (deploy-preview-10, CUS-1), mike-auto-detaiing (dead script origin, CUS-8) or eli-auto-detailing (an old export with no script tags).

| ID | Change | Who sees it | Severity | Evidence |
|---|---|---|---|---|
| W-3 | The booking calendar on phones becomes a 7-column month grid. Today it is a 1-column list about 2,000px tall. | All 40 old-design pages; booking is on today for 7 of them, including all 3 paying customers. | none (fix) | Branch `public/scheduler.js:1066`; headless runs at 390px: master 1 column on 40 of 40 pages, branch 7 on 40 of 40; same in Firefox and iOS Safari. |
| W-2 / INV-4 | Page views start being recorded. Today the browser blocks every beacon (CORS), so Overview "views" jump from almost zero. | Every owner's Overview. | low | Master beacon blocked in 176 of 176 runs; branch sends exactly 1 POST per load. Only 16 `page_views` rows exist ever. top-choice already records views from preview-10. |
| W-1 / INV-5 / CUS-5 | On 5 pages that have no `#contact` section, the inquiry form moves from just under the hero to just above the footer. | og-detailing (**paying**), auto-care-genius, primeluxe-detail, ss, veylance-auto-spa. | low | `contact-form.js:38` `order:9998`; measured position at 390px for og-detailing goes from 11% to 87% of the page; submit is identical. |
| W-4 | No view is counted inside a frame, for `#acg-no-track`, or when the visitor came from the owner app. | Owner previews, embeds. | low | `scheduler.js:33-34`, `track-view.js:25`. None of the 3 custom domains is framed. |

Safe confirmations (widgets):

- 0 JavaScript errors in 522 Chrome runs, 652 Firefox runs and 652 iOS Safari 26.5 runs.
- The Book buttons, floating button, `#book` / `#book=<service>` deep links, booking steps, 12 time slots, booking-details fields and the inquiry form POST are identical before and after on every page.
- Both scripts still parse as ES5. The worst case on an old browser is one uncounted view.
- `track-view` still accepts the old JSON beacon from cached script copies, so the order in which a deploy swaps files cannot lose views.
- `scheduler.js` is served with `max-age=0, must-revalidate`, so no stale copy lingers.

### 2.2 Owners in the dashboard and editor

| ID | Change | Severity | Notes |
|---|---|---|---|
| **INV-1 / SE-1 / BK-1** | Bookings created with the dashboard's "Book customer" dialog before the deploy show **4 hours late** in the Bookings list, calendar, booking drawer, customer profile history, and the pre-filled SMS "Text reminder". | **high** | Only og-detailing has such rows: 14, of which 8 are confirmed upcoming between Oct 3 and Oct 18. Branch `src/lib/bookings.js:22-33` now reads times as shop wall-clock (UTC); master `BookCustomerModal.jsx:81` stored real instants. Reproduced: master "Oct 3, 8:00 AM", branch "Oct 3, 12:00 PM". Dates never move. Fixed by the backfill in section 7.1. |
| SF-1 | The SMS reminder text that OG's owner can send from the drawer shows the wrong hour until the backfill. Emails do **not** change: they already print these rows 4 hours late today (BK-3). | medium | The owner reviews and sends the SMS from their own phone; nothing is sent automatically (`bookings.js:111-114`). |
| **HEAD-2** | New "What's New" banner on every owner's dashboard: "New designs for every website… with your photos, services, prices and contact details carried over… over the next few days we're republishing live websites… You can also switch any time… click Republish." | medium | `src/data/changelog.js` entry `2026-10-site-upgrade` (commit 79b5205). It invites owners to Republish themselves, and the dashboard Republish button gives no preview. On the 6 RISK sites in section 3 that loses content, and every republished site has the old-iPhone problem (XB-1). |
| EO-2 / SF-2 / DS-1 | Tabs opened **before** the deploy keep running old code. The editor can go blank when opening a template (the old chunk names are gone and there is no error boundary). OG's old Charge dialog gets "Pick the vehicle type" on 7 of 12 services. The old Book Customer dialog keeps writing real instants, which the backfill (cut off at deploy time) misses. | medium | Reload fixes everything. Edits autosave after 1.5 s, so a blank screen loses nothing, and a failed Republish only shows a toast. OG creates dashboard bookings almost daily (the latest at 10:53 AM ET today), so ask OG to reload. |
| CH-1 / INV-6 | Charges for SUVs and trucks now use the vehicle's own listed price instead of the sedan price. Example: OG ceramic coating on a truck is $1,200, where master charged $600. | low | Affects only og-detailing (32 of 71 service × vehicle × add-on combinations); every other shop is unchanged. The amount shown equals the amount charged in 71 of 71 cases. The `charges` table holds 2 internal demo rows, so no past money is affected. |
| BS-1 / INV-7 | Opening Booking Settings writes a one-time marker (`seeded_service_names`). Services the owner deleted no longer come back. | low | No service is added, removed, renamed or disabled on any of the 22 configured menus. obsidian-auto-spa's website service "Full Detail" will not be auto-added to its booking menu. |
| BS-2 | Booking Settings offers "Publish booking page". It writes only `<slug>/book/index.html` and only when the owner clicks. | low | Shared slugs get a 409 (`slugClaim.js:37`). |
| INV-8 | Shared booking links become `/book#book` on the www host. Custom domains are used only with HTTPS. | low | Old links keep working. |
| INV-9 | The header logo now goes to hq.autocaregenius.com in the same tab. | low | Confirm this is intended. |
| HEAD-3 | The dashboard now queries `sites.published_at`. Until migration `20261004` is applied, that query fails silently (no badge, list unaffected) and logs a 400 in Supabase for each dashboard load. | low | `DashboardPage.jsx` `loadPublishedAt`. Expect these 400s in monitoring. |
| HEAD-4 | An owner's first new-design publish now **backs up** the old live page in R2 (`_backups/<site id>/…`) before overwriting it. A failed backup never blocks the publish. | positive | `publish-site.js` with `backupLivePages` (`_shared/r2.js:161`). Until the migration runs, every owner publish is backed up. |
| CUS-1 | top-choice-mobile-detailing can be opened and republished. On production today its editor white-screens. | positive | Its template `mobile_redline` is not registered on master. |
| — | Opening any existing site in the editor writes nothing new. | safe | Real editor run on all 107 website rows with production data, plus every row × every template (1,177 sessions): 0 autosaves and 0 errors. Saving an untouched editor state writes back exactly what is stored (111 of 111 rows). |

### 2.3 Paying customers: bookings, times, charges, emails, gating

- **Booking acceptance, deposits and Stripe are unchanged.** These are byte-identical between production and the PR head: `create-booking.js`, `owner-create-booking.js`, `update-booking.js`, `send-booking-reminder.js`, `slot-math.js`, `deposit-math.js`, every Stripe and Connect function, `subscription-gating` (client and server), the custom-domain edge function, and `domain-sweep`. OG's 20% deposit is computed exactly as before.
- **Customer emails are byte-identical** for all 10 booking email variants and all 26 real bookings, under the Lambda's UTC zone. Only internal support-call emails change: they now show real ET, where they used to show UTC labelled "ET".
- **Gating is identical.** Nothing can lock a paying owner out or give free owners Pro. The new `photo_url` column in the profile select is readable by `authenticated`, so the profile load cannot fail.
- **Times:** see INV-1. The PR also corrects 12 **past** widget bookings, which master showed 4 hours early (BK-2).

### 2.4 Admins

- **View as user:** expired handoff tokens are scrubbed on the next use, and exiting signs out only the impersonation tab, not the customer everywhere (EX-3).
- **saveSite** no longer reassigns a site to a super admin who saves it.
- **Custom websites (PR #11/#12/#13)** were run in a real browser on the merged build. The intake form (`/custom-site?t=…`) sent requests identical to master's and a form left open across the deploy loses nothing; Admin > Custom websites also works. The only change is darker hint text, and destructive confirms now focus Cancel.
- **New in the PR head:** Admin > **Site upgrades** (`admin-site-upgrade.js`, `SiteUpgradesTab.jsx`). Super admins can back up, republish, restore and hold live sites. It refuses to republish until migration `20261004` exists, refuses shared slugs and pages built on a preview origin, backs up before every write, and flags drift cases ("live page shows N photos the draft doesn't have", "draft text differs", "draft copy empty", "draft colors differ", "live page too large"). I read the code and its tests pass. It was **not** run against real sites (section 8).

### 2.5 New signups

- 1eaa8d1 moves copy generation to a background function (`generate-website-background` / `-status`, on Netlify Blobs) and bumps the Anthropic SDK from 0.39 to 0.131.
- Checked: tests pass, every function bundles, and the custom-site design request is identical on both SDK versions. The deploy preview now serves a bundle that contains it.
- Not checked: no end-to-end wizard generation has been run on a Netlify build (NB-1). Existing sites are not affected.

---

## 3. What changes only when a site is republished

Nothing republishes by itself. A live page changes only through an owner's Republish or Publish, the wizard, or an admin using Site upgrades.

**How the verdicts were reached.** Every live row was rendered through the real Republish pipeline with the master code ("what Republish does today") and with the PR code. Every row's inputs were checked against the production md5. Each render was compared field by field (phones, emails, address, hours, services and prices, about text, CTAs, social links, testimonials, photos, widget keys, script tags, JSON-LD, colors, fonts) and screenshotted at 390px and 1280px.

**Across all rows, the PR causes no loss of owner content compared with today's Republish.** It removes invented claims ("5K+ cars", "100% satisfaction", star rows, "Open Now", "Verified customer", invented years), removes leaked editor hints ("Upload a photo in Images tab": today's Republish produced it on 9 of the 12 batch-2 sites, and it is visible on 7 of the 11 batch-4 live pages), fixes broken anchors and 5px phone overflow, and applies owners' custom colors and fonts.

The content risks below are **pre-existing drift**: the live page holds content that is not in the saved row, so a Republish on today's production code loses it too.

**Caveat on every row (XB-1, medium):** the new templates use CSS container queries with no fallback. On iOS 15 and older (iPhone 6s, 7 and first-generation SE can't upgrade), macOS Safari 15, Firefox 109 and older, and Chrome 104 and older, 38 of 39 republished pages lay out 504 to 1,560px wide on a 390px phone, with the desktop menu and squeezed grids. That is about 3.4% of global browser usage and about 6% of iOS Safari. A prototype fallback fixed headline sizes on 46 of 46 pages; sideways scroll still needs `overflow-x` moved to `html`/`body`. Evidence: `impact/xbrowser/old-browser-summary.txt`. The verdicts below assume XB-1 is fixed or knowingly accepted.

Verdicts:

- **SAFE**: a republish only improves the site.
- **OWNER-SHOULD-REVIEW**: a visible change the owner should see in the editor first.
- **RISK**: a republish, today or after the merge, loses owner content or shows wrong information unless it is fixed first.

"Internal" means a super-admin or company account.

| # | Site (row) | Template (live if different) | Paying? | Custom domain | Custom palette / font | Verdict | Key differences on republish |
|---|---|---|---|---|---|---|---|
| 1 | **og-detailing** | tint_obsidian | **Yes, active** | stayog.com (pending_dns; shows a domain-for-sale page, CUS-3) | font (Outfit) | SAFE | All 8 services with prices and descriptions, logo, about photo, Google widget and scripts are kept. The invented "since 2025 / warranty / rating 5.0 ★" strip is removed. Hours are corrected (they were in jsonb key order). Same purple brand. |
| 2 | **obsidian-auto-spa** | mechanic_industrial | **Yes, active** | — | — | OWNER-SHOULD-REVIEW | All 4 owner services now show with prices ($100–$200); live shows 3 AI services without prices. Invented stats are removed and the hidden Awards section stays hidden. The saved draft holds a 5 MB iPhone HEIC photo that Chrome can't decode; a republish from Chrome publishes it as a full-width broken "Our Work" image (RP1-2, the same on master). Replace the photo with a JPG first. The logo replaces the name text in the nav. |
| 3 | **zwitch-wash-car-wash-detailing** | mechanic_ironclad | **Yes, past_due** (grace ends about Oct 5 02:03 UTC) | — | colors | OWNER-SHOULD-REVIEW | No loss: all 16 photos are kept. The owner's 7 Spanish packages and prices replace 4 English AI descriptions, one of which was wrong (B2-4). The blue text color is lightened from 2.86:1 to 5.14:1 contrast and now also colors body text (B2-5). Hours are fixed, "Verified Customer" is removed, and email and Facebook now show. On phones the hero photo moves under the headline. |
| 4 | ap-detailing | mobile_chrome | no (comp flag, Pro) | — | — | SAFE | Invented "1,000+ cars / 100%" and the editor hint are removed; services and prices kept. The Powered-by bar goes away (billing, same on master). |
| 5 | auto-care-genius (1c0c5f16, served) | mechanic_industrial | no | — | — | SAFE | Invented "105+ years / 5K+ / 5★ / 100%" removed; hero photo and Google widget kept. Republish is blocked today by the shared slug (409, CUS-4). |
| 6 | auto-care-genius (f8a3a528) | mobile_sudsy | internal | — | — | SAFE | Not the served row; publish returns 409. |
| 7 | autosite-demo-shop (b27546fb, served) | mobile_chrome | internal | — | — | SAFE | Invented stats removed; 409 (shared slug). |
| 8 | autosite-demo-shop (785ffed0) | mechanic_garage | internal | — | — | SAFE | Not served; 409. |
| 9 | autosite-demo-shop (079d777f) | mechanic_industrial | internal | — | — | SAFE | Not served; 409. |
| 10 | autosite-demo-shop (42a3b5a6) | mechanic_garage | internal | — | — | SAFE | Not served; 409. |
| 11 | autosite-demo-shop (11338c07) | tint_obsidian | internal | — | — | SAFE | Not served; 409. |
| 12 | centenno-detailing | mobile_sudsy | internal | — | — | SAFE | Invented "same-day / eco-friendly" claims removed. |
| 13 | central-auto-detailing | detailing_sporty | no | — | — | **RISK** (pre-existing, B2-1) | 5 owner photos (hero, about, 3 gallery) exist only inside the live HTML. Any republish replaces them with a monogram and no gallery. Recover them from the live HTML first (needs approval) or exclude this site. |
| 14 | dsean-sparkly-detailing | detailing_sporty | no | — | colors | OWNER-SHOULD-REVIEW (RP3-2) | Republish crashes on master today (empty 4th package); the PR fixes it. The first republish publishes the owner's saved prices, hours and pink/neon-green palette, none of which has ever been live, plus 8 inline images uploaded first. |
| 15 | eli-auto-detailing | carwash_bubble | internal | — | — | SAFE (RB4-7) | The live page is an old "Eli Auto Detailing, Miami" export; the row is now "Auto Care Genius, Kissimmee". Any republish changes the name, address and widget key. |
| 16 | estrella-handwash-detailing | wheel_apex (live: detailing_sporty) | no (cancelled; comp flag, Pro) | estrellahandwashdetail.com (pending_dns, doesn't resolve) | colors (all white) + font | **RISK** (pre-existing, RP1-3) | Any republish switches the design and drops the owner's logo and hero photo, which exist only in the live HTML. The PR's render is better than master's: contrast is repaired, Syne is used, and invented claims are gone. Don't prompt until the logo and photo are re-uploaded. |
| 17 | fast-eddies-mobile-detailing | mechanic_ironclad | no (cancelled) | — | — | OWNER-SHOULD-REVIEW (B2-4) | The owner's one-line descriptions and prices replace AI paragraphs. The Powered-by bar appears (billing, same on master). |
| 18 | flow-auto-detail | mobile_sudsy | internal test account (EX-1) | — | — | SAFE | Already returns 404; it is a "Test Site" with no billing. |
| 19 | foam-force | mechanic_garage | no | — | — | SAFE, and better (RB4-2) | The live page shows **invented hours** (Sunday closed); the owner is open 8am–8pm daily. Only a republish after the merge fixes this. Invented "2,000+ cars / 12mo warranty" also removed. |
| 20 | j-j-central-florida-detailing | tint_obsidian | no | — | — | SAFE | "Since 2015 / rating 5.0 ★" removed; the owner's award is kept. |
| 21 | juanito-detailing | mobile_chrome | no | — | — | OWNER-SHOULD-REVIEW (B2-2, B2-3) | A live-only hero image (looks like a supplier ad) drops on any republish. The new page shows the owner's street address with a Maps link. |
| 22 | junkelcarwash | mechanic_ironclad | no | — | colors + font | OWNER-SHOULD-REVIEW (RP3-7) | The hero "Book" button follows the owner's own CTA link (Instagram) instead of calling. Spanish descriptions and prices now show. Mon–Thu "Closed" (valid per-day hours). |
| 23 | litty-mobile-detailing | wheel_apex | internal | — | — | SAFE | Low: the long "specialties" sentence is dropped (RB4-4), and the ticker glitches with reduced motion (RB4-5, one-line CSS fix). |
| 24 | lovacar | mechanic_ironclad (live: mechanic_garage) | internal | — | — | SAFE | Design switch (drift). The invented hours table is removed. |
| 25 | luxurious-auto-detailing | detailing_sporty | internal | — | — | SAFE | All 4 photos kept. |
| 26 | magician-detailing | detailing_sporty | no | — | — | SAFE | Fake stats and the editor hint removed; inquiry form added. |
| 27 | malpica-detailing (714f4438, served) | mobile_chrome | no | — | — | **RISK** (pre-existing, RB4-3) | The 5 MB hero photo exists only in the live HTML and drops on any republish. Republish is blocked today by the shared slug (CUS-4). |
| 28 | malpica-detailing (f6a2da33) | mechanic_garage | internal | — | — | SAFE | Not served; 409. |
| 29 | mike-auto-detaiing | mechanic_industrial | internal (super admin) | — | — | SAFE | Its widget scripts load from a dead deploy URL (404, CUS-8). A republish from production fixes that. |
| 30 | mike-c | mechanic_ironclad | internal | — | — | SAFE | Content kept; fake stats removed. |
| 31 | nxt-premium-detailing | mobile_chrome | no | — | — | **RISK** (pre-existing, RB4-1) | The live page has **3 real customer reviews** and edited wording that exist only in the live HTML. Any republish replaces them with AI testimonials and the old wording. Restore them first (needs approval) or exclude this site. |
| 32 | onthree-detailing | carwash_bubble | no (cancelled) | — | — | **RISK** (pre-existing, RP3-3) | The saved copy is empty (`{}`), so any republish loses the live headline, about text and testimonials. The owner's 6 photos would appear for the first time. |
| 33 | palm-luxe-auto-spa | mobile_chrome (live: detailing_sporty) | internal | — | — | SAFE | Design switch (drift). |
| 34 | primeluxe-detail | detailing_sporty | no | — | — | SAFE | Hero, logo and gallery kept; the 5th service and the email now show. |
| 35 | proppa-llc | mobile_chrome | no (comp flag, Pro) | — | — | OWNER-SHOULD-REVIEW (B2-3) | Fake stats removed. The owner's street address (it looks residential) now shows publicly with a Maps link. |
| 36 | rhines-auto-detailing | carwash_bubble | no | — | — | **RISK** (pre-existing, RP3-4) | The hero photo exists only in the live HTML and drops on any republish. |
| 37 | ss | detailing_sporty (live: carwash_bubble) | no | — | — | OWNER-SHOULD-REVIEW (RB4-6) | It can be republished only after the merge (master crashes). The whole design switches. The data looks like test data. |
| 38 | swift | tint_obsidian | no | — | — | SAFE | Fake stats removed. |
| 39 | that-detail-shop | detailing_sporty | internal | — | — | SAFE | Hero kept. |
| 40 | the-spot-orlando | mechanic_garage | no | — | — | OWNER-SHOULD-REVIEW (RP3-1, RP3-5) | Fixes **invented hours**: live says it is open Saturday; the owner entered Mon–Fri 6am–5pm. But the live teal brand color was never saved, so any republish turns the site orange. Re-pick the color first. |
| 41 | titos-car-wash | mobile_sudsy | internal (super admin, Stripe) | quandetach.com (active_ssl) | — | SAFE | Its scripts move from deploy-preview-8 to production, which removes the preview dependency (CUS-2). Invented "van" copy removed. |
| 42 | top-choice-mobile-detailing | mobile_redline | no (new owner today) | — | — | SAFE | Output is byte-identical to the live page except the script origin, which moves from deploy-preview-10 to production. Possible only after the merge (CUS-1). |
| 43 | venturas-garage | detailing_sporty | no (comp flag, Pro) | — | — | SAFE | Fake stats removed. The Powered-by bar goes away (billing, same on master). |
| 44 | veylance-auto-spa | tint_obsidian | no | — | colors + fonts | OWNER-SHOULD-REVIEW (RP3-6, RP3-8) | The saved hero image differs from the live one. The owner's blue accent and Syne/Outfit fonts apply for the first time. On desktop the 4-line headline pushes the hero buttons below the fold. |
| 45 | vivid-detailing-customs | wheel_apex | no | — | — | SAFE, and better | "4.9 star / Finance 0%" removed. The broken secondary CTA becomes a real `tel:` link. All photos kept. Low: the specialties paragraph is dropped. |
| 46 | walts-mobile-detailing | mechanic_garage | no | — | colors | OWNER-SHOULD-REVIEW (RP1-4, RP1-1) | Fixes **invented hours**: live shows Mon–Thu until 6pm and Saturday 9–3; the owner entered Mon–Sat 8–5. Two packages now show the owner's placeholder descriptions ("Interior, Exterior...", "...") instead of AI text. |
| 47 | diamond-autos-detailing | booking-only page | no | — | — | SAFE | Not affected by the template change (the admin tool excludes booking-only pages). The widget is unchanged. It shows "Loading booking…" forever because booking is off (CUS-7, pre-existing). |
| 48 | fintech-auto-mobile-detailing | booking-only page | no | — | — | SAFE | Same as above. |
| 49 | hjhjhj-uh-oi | booking-only page | no | — | — | SAFE | Same as above. |
| 50 | twobrotherwindowtiting-and-detailing | booking-only page | no | — | — | SAFE | Same as above. |

Totals:

- 50 published rows: 46 websites and 4 booking-only pages, on 44 distinct live URLs. 43 return 200; flow-auto-detail returns 404.
- Website verdicts: 29 SAFE, 11 OWNER-SHOULD-REVIEW, 6 RISK (all pre-existing).
- The PR's render is never worse than today's Republish, except these low-severity items:
  - RP1-1: walts placeholder descriptions.
  - RB4-4 and RB4-5: wheel_apex specialties text and ticker glitch.
  - B2-3: mobile_chrome now shows street addresses.
  - RP3-8: veylance desktop fold.
  - RP1-2: obsidian broken photo, which is more visible on the PR's layout.

---

## 4. Paying customers

The 3 real paying customers are the Stripe-billed, non-internal accounts below. Excluded:

- The super-admin account with its own Stripe subscription (titos-car-wash, mike-auto-detaiing, mike-c).
- flow-auto-detail, a test account with no billing (EX-1).

| Customer | What they notice the moment we deploy | Risk on deploy | When they republish | Pre-existing issues (not caused by the PR) |
|---|---|---|---|---|
| **OG Detailing** (og-detailing, tint_obsidian, active, Connect charges and 20% deposits, 17 bookings, 8 upcoming) | 8 upcoming appointments show 4 hours late in the dashboard and SMS text until the backfill runs. The inquiry form moves to above the footer. The phone booking calendar becomes a proper 7-column grid. Page-view counts start. The Charge dialog asks for the vehicle type and charges SUV and truck prices from OG's own price list. Booking Settings shows a "Publish booking page" offer. The "What's New" banner appears. | **High** until the backfill runs (INV-1); then none. Medium if OG keeps a pre-deploy tab open (DS-1). Ask OG to reload. | SAFE: an improvement (section 3, row 1). | Its widget offers slots that clash with these confirmed jobs, and their confirmation emails already printed times 4 hours late (BK-3). The same backfill fixes both, but it cannot correct emails already sent. Consider telling OG. stayog.com points to a domain-for-sale page (CUS-3). |
| **Obsidian Auto Spa** (obsidian-auto-spa, mechanic_industrial, active, booking on, no Connect) | The phone calendar is fixed and page views start. Booking Settings will no longer re-add its website service "Full Detail" to the booking menu (BS-1). The "Publish booking page" offer and the banner appear. | low | OWNER-SHOULD-REVIEW: replace the HEIC gallery photo first (RP1-2). | Opening its site in the editor uploads its old inline logo and autosaves, the same as today (EO-1). |
| **Zwitch Wash** (zwitch-wash-car-wash-detailing, mechanic_ironclad, past_due since Sep 28, booking on, 0 bookings) | The phone calendar is fixed, page views start, and the banner appears. | low | OWNER-SHOULD-REVIEW: Spanish packages, lighter text color (section 3, row 3). | When the 7-day grace ends (about Oct 5 02:03 UTC), its widget keeps showing open slots but every booking attempt fails with "Bookings not available" (GT-EX-1). The dashboard keeps showing Pro. |

Comp-flag and cancelled owners (proppa-llc, ap-detailing, venturas-garage, estrella-handwash-detailing, onthree-detailing, fast-eddies-mobile-detailing) see only the widget changes and the banner on deploy. Their Powered-by bar changes on republish come from billing state, not the PR (CUS-9).

---

## 5. Must-fix (or must-decide) before merge

| # | Item | Why | Exact action |
|---|---|---|---|
| M1 | **Approve and schedule the OG backfill** (INV-1 / SE-1 / BK-1) | Without it, a paying customer's 8 upcoming jobs show 4 hours late, starting tomorrow 8:00 AM ET. | Use `impact/rollback/og-booking-time-sql.sql` (prepared, not run). Step 0: snapshot just before the merge. Step 1: forward update, keyed on booking id plus expected value so it is idempotent; expect `UPDATE 14`. Run in the Supabase SQL editor as `postgres`, because RLS hardening blocks browser-role updates. Never run it before the deploy: the current dashboard would then show the rows 4 hours **early** (RB-1). |
| M2 | **Pin what is merged** (INV-2, HEAD-1) | The head moved twice today. Your working tree has 64 more uncommitted changes, including `r2.js`, `admin-site-upgrade.js` and `SiteUpgradesTab.jsx`. | Merge **ce9f67f**. I checked it: it contains master 3e72d7d, `git merge-tree 3e72d7d ce9f67f` is clean (tree `9fe2e8d5…` = ce9f67f's tree), vitest 82 files / 1,836 tests pass (with dummy Supabase env), theme:check passes 701, vite build passes, and 39 of 39 functions bundle with esbuild. Its App.jsx conflict resolution is identical to the one tested in merge-work 5205cd5. If anything else is pushed, re-run these checks and the widget, booking and template diffs. |
| M3 | **Approve or reword the "What's New" banner** (HEAD-2) | It goes to every owner on deploy, promises "photos… carried over" and announces a republish rollout "over the next few days". CLAUDE.md requires your approval for bulk republishing. | Edit `src/data/changelog.js` entry `2026-10-site-upgrade`. Either keep it, because you approve the rollout in section 7.3, or drop or soften the last bullet ("Most sites switch over on their own…") until the RISK sites and XB-1 are handled. If the merge happens after Oct 2, set the entry date and `SITE_UPGRADE_RELEASE_DATE` (`src/lib/siteUpgrade.js:15`) to the real release day, and keep the two in sync. |
| M4 | **Tell OG Detailing** (with your OK) | Their dashboard will show wrong times for a few minutes, and an old tab breaks Charge and Book Customer. | Ask them to close or reload the dashboard after the deploy and not to send "Text reminder" until you confirm. |
| — | Should fix before **any** republish rollout (not needed for the merge itself) | | |
| R1 | Old-browser fallback (XB-1) | Every republished page breaks on iOS 15 and older phones. | Add the fallback to published pages only. When `CSS.supports('container-type:inline-size')` is false, rewrite `@container (` to `@media (` and container units to viewport units, and move `overflow-x` clipping to `html`/`body`. Check on a real iOS 15 device. Prototype and notes: `impact/xbrowser/`. |
| R2 | wheel_apex reduced-motion ticker (RB4-5) | Cosmetic glitch on wheel_apex sites. | In `WheelApex.jsx:143`, change the rule to `.wa-tick-item.wa-tick-rep,.wa-tick-dup{display:none}`, or move it after `.wa-tick-item`. |
| R3 | Fix the 6 RISK sites' content first | Republishing loses owner photos, reviews or copy. | With your approval: restore content from the saved live HTML (`impact/customers/live/<slug>.html`) into `site-images` and `generated_content`. Otherwise ask each owner to re-enter it, or exclude the site. |

---

## 6. Merge procedure

The state at 20:10 UTC:

- Master is 3e72d7d (PR #13, already live).
- The PR #10 head is ce9f67f, which already includes master. The PR author resolved the `src/App.jsx` conflict (DashboardPage props and the editor `backLabel`) in merge commit 368db9a. That resolution keeps #13's `setReturnToProject(null)` and "Back to project", together with the branch's demo handling. It is identical to the resolution tested in 5205cd5, so the custom-website flows were tested in a real browser on it.

Steps:

1. Run `git ls-remote origin refs/heads/master refs/heads/fix/publish-safety-and-theme-kit`. Expect `3e72d7d…` and `ce9f67f…`. If either has moved, stop and re-check (section 8).
2. In Netlify, confirm that deploy-preview-10 built ce9f67f. Its bundle already contains Site upgrades, the custom-site pages and the new generation status code. If you approve, run one wizard copy generation on the preview with an internal test account. Preview functions use the production database, so this creates real rows.
3. Use GitHub **"Create a merge commit"**, not squash, so the tested tree is what deploys. Afterwards, `git rev-parse origin/master^{tree}` must equal `9fe2e8d5fafe609cd6831c594c4a6882cd135932`.
4. No new environment variables are needed: the env names read in `netlify/` and `src/` are identical between 3e72d7d and ce9f67f. `netlify/functions/package.json` adds `@netlify/blobs` and bumps `@anthropic-ai/sdk` to ^0.131.0; the Netlify build installs them (`npm install --prefix netlify/functions`).
5. Migration `20261004_sites_published_at.sql` is **not** needed for the merge. Owner publishes ignore a missing column (`_shared/r2.js:204-228`). It requires `20261003_rls_hardening.sql`, which production already has (latest applied: `20261002181901`). Apply it with your approval only when you start the admin rollout.
6. The test runs above are the regression evidence. Earlier full-analysis runs on the 99d66cd + 8970027 merge also passed: 1,586 tests and theme:check.

---

## 7. Rollout plan

### 7.1 Merge-day checklist

**Before (T minus 30 minutes)**
- [ ] You approve: the backfill (M1), the banner text (M3), the merge time, and the message to OG (M4).
- [ ] Record the rollback target: Netlify production deploy `6abffcdf058ba40009663376` (commit 3e72d7d, 36 functions).
- [ ] Refs check (section 6, step 1).
- [ ] Run SQL step 0 (snapshot) and save its output with the deploy notes.
- [ ] Back up the current live HTML: GET every live URL (`https://<slug>.autocaregeniushub.com/` and `/book`, plus quandetach.com) into a dated folder. Today's copies of 48 pages are in `impact/customers/live/`.
- [ ] Pick a quiet time. OG's latest dashboard booking was entered at 10:53 AM ET, and its first affected job is Sat 8:00 AM ET. Tonight after about 9 PM ET is good. Otherwise wait for Monday.

**Deploy (T)**
- [ ] Merge, then watch the Netlify production deploy reach "published". Check that `commit_ref` is the merge SHA and that it lists **39 functions**, including `custom-site-*`, `generate-website-background`, `generate-website-status` and `admin-site-upgrade`.
- [ ] Note T in UTC. **Within minutes**, run the forward backfill (expect `UPDATE 14`), then check step 4. The 8 confirmed rows should read 10-03 08:00, 10-03 14:30, 10-04 08:30, 10-04 12:00, 10-04 15:00, 10-10 08:30, 10-17 08:30 and 10-18 08:30.

**Smoke checks (GET only)**
- [ ] `md5(/scheduler.js)` = `fe09d885…` (was `050b239a…`); `md5(/contact-form.js)` = `c23c8a98…` (was `f892bfe0…`).
- [ ] `/.netlify/functions/custom-site-form?t=invalid` returns 404 with the JSON "This form link isn't active…" (a Netlify 404 page would mean the function is missing). `/custom-site` returns 200.
- [ ] OG's 2026-10-10 slots: 08:30 is no longer offered and the 12:00–14:00 window is offered again. Baseline: `impact/rollback/slots-baseline-2026-10-10.json`.
- [ ] OG reloads: the dashboard shows "Sat, Oct 3, 8:00 AM".
- [ ] og-detailing on a phone: the calendar has 7 columns and the inquiry form sits above the footer.
- [ ] New `page_views` rows appear with `created_at > T`.
- [ ] An admin can open top-choice-mobile-detailing in the editor.

### 7.2 Monitoring (first 72 hours)

- **Netlify function logs:**
  - `track-view` errors.
  - `create-charge` 400 "Pick the vehicle type" (a stale tab, so ask the owner to reload).
  - `[publish-site] backup … failed`.
  - `published_at does not exist yet` (expected until the migration).
  - `[generate-website…] FAILED` and `Widget save error` (new signups, SF-3).
- **Supabase API logs:** 400s on `sites?select=id,published_at` are expected until the migration (HEAD-3). Any other new 4xx/5xx from owner traffic, especially 42501 RLS errors, is not expected.
- **At T + 24h and T + 72h:** run SQL step 3 for `owner-dashboard` bookings created at or after T. Any row whose UTC time is 4 hours off OG's opening hours came from a stale tab; fix it with OG, with your approval.
- **Daily:** bookings, inquiries and charges are still created at normal rates, and the `page_views` volume looks reasonable.

### 7.3 Republish policy

1. **No bulk republish yet.** Don't use Admin > Site upgrades "Republish all" until all of the following are true:
   - you approve the rollout;
   - R1 (old-browser fallback) has shipped, or you have accepted XB-1 in writing;
   - migration `20261004` is applied (with approval);
   - a dry run of the tab's eligibility on all 40 live websites flags at least the 6 RISK sites, the-spot-orlando's color, obsidian's HEIC photo and dsean's inline images (compare it with section 3).
2. **Order**:
   - **First, internal sites.** titos-car-wash, mike-auto-detaiing, mike-c, lovacar, centenno, palm-luxe, litty, luxurious, that-detail-shop, eli. These also move titos and mike-auto off preview and dead origins.
   - **Second, SAFE outside sites that gain a fix.** foam-force, magician, primeluxe, swift, j-j, vivid, venturas, ap-detailing. top-choice-mobile-detailing goes here too, after telling its owner, to move it off deploy-preview-10.
   - **Third, OWNER-SHOULD-REVIEW sites.** Only after the owner has looked in the editor. That includes the paying customers OG, zwitch (after its billing is settled) and obsidian (after the photo is replaced).
   - **Last, RISK sites.** Only after their content is restored or re-entered. The malpica and auto-care-genius slug collisions (CUS-4) must be resolved first.
3. **Who:** preferably the owner's own Republish after a preview in the editor. An admin may do it only with the owner's consent, through Site upgrades or View as user.
4. **Backups before overwriting.** The new code backs up the old-design page automatically: an owner's first new-design publish, and every Site upgrades publish (`_backups/<site id>/<backup id>/`), restorable from Admin > Site upgrades, which also puts the site on hold. Keep our own GET snapshot as well, because it survives a deploy rollback (the restore action does not exist in the old code).
5. **Communication:**
   - A personal note to each paying owner before their republish: what changes, and that the old page is backed up.
   - A note to each RISK owner explaining what would be lost.
   - Optionally tell owners that view counts now work (W-2), and tell OG about the new inquiry-form position (W-1) and the per-vehicle charge prices (CH-1).

### 7.4 Rollback plan

Roll back if, after the deploy, live pages lose their booking or inquiry widget, owners cannot publish, bookings or charges fail, or the dashboard is unusable after a reload.

1. In Netlify, publish deploy **`6abffcdf058ba40009663376`** (3e72d7d). Functions roll back with it, because they are versioned per deploy. Lock auto-publishing (a settings change, so it needs your approval). Never roll back further than this deploy: it carries PR #13 and the live RLS hardening.
2. Check that the script md5s are back to `050b239a…` and `f892bfe0…`.
3. **If the backfill ran:** run step 2 (REVERSE) in `og-booking-time-sql.sql` (expect `UPDATE 14`). Without it, the old dashboard shows OG's 8 jobs 4 hours **early**, for example 4:00 AM (RB-1). The backfill is not idempotent; the keyed statements protect against running it twice.
4. Run step 3 for bookings made with the new dialog while the PR was live, and convert them with OG's confirmation (RB-3).
5. Ask OG and any active owners to reload.
6. Revert the merge on master (`git revert -m 1 <merge sha>`, pushed by you), so the next auto-deploy does not re-ship it.
7. Live pages republished in the new design stay that way and keep working with the old scripts. Every new template renders `id="contact"`, and the old scheduler handles `#book`, `data-full-page` and `data-scheduler-trigger`. To put a site's old page back after a rollback, PUT the saved HTML to R2 `<slug>/index.html` (Cloudflare dashboard or API), because the admin restore action exists only in the new code. If you can, restore from Site upgrades **before** rolling back.
8. Expected side effects (RB-4): top-choice's editor white-screens again, and the fixes come out again: per-vehicle pricing, the page-view beacon, the deleted-service fix and the inquiry-form position.

Data the new code writes and the old code ignores is harmless after a rollback. That covers the `seeded_service_names` marker, the `published_at` column, and copy keys such as `sectionTitles` and `heroCard`: all 21 production templates render byte-identical HTML with them, and the production editor opened 31 such rows with 0 errors.

---

## 8. Disputed or unverified items, and the limits of this analysis

**Refuted or corrected during verification**
- **EX-2 / CUS-10** (`reviews_cache` RLS off): refuted. Migration `20261002181842 rls_hardening` fixed it today. An unknown external writer updated the table before that, so if it used the anon key it now fails. Check separately.
- **EX-1** (flow-auto-detail is an "active paying customer" with a 404): the 404 is real, but the account is an internal test account ("Test Site", no Stripe or Shopify, 8 minutes of activity in April). No customer is affected.
- Severity changes:
  - INV-2 went from medium to low (a process risk).
  - SF-1 went from high to medium: emails do not change, only the SMS prefill does.
  - CUS-3 went from medium to low: nothing we publish links to stayog.com.
  - RP1-2, B2-1, RB4-3, RP3-2, RP3-4 and CUS-4 went to low as merge impact (pre-existing, owner-triggered, non-paying).
  - RB4-1, RB4-2 and RP3-1 went from high to medium: 1–3 free sites each, and pre-existing.
  - EX-4 went to low.
- NB-2 (RLS hardening could block the PR's writes): checked against a real-Postgres harness with production policies and grants. All 20 app and server write paths behave the same before and after; the conclusions hold.

**Not caused by the PR, but worth fixing separately**
- Stripe webhook leaves `subscription_current_period_end` NULL (EX-4). People who cancel at period end lose access immediately.
- Zwitch's widget shows open slots after its grace period ends but refuses bookings (GT-EX-1).
- OG's widget offers slots that clash with confirmed jobs, and its emails print times 4 hours late (BK-3). The backfill fixes this.
- titos-car-wash runs a frozen PR #8 widget from a deploy preview (CUS-2). mike-auto-detaiing's widget origin is dead (CUS-8). top-choice depends on deploy-preview-10 (CUS-1).
- 3 duplicate-slug groups block republish (CUS-4). Booking-only pages show "Loading booking…" forever when booking is off (CUS-7).
- The mechanic_garage template shows an **invented hours table** on foam-force, the-spot-orlando and walts-mobile-detailing (RP3-1 / RB4-2). Only a republish after the merge fixes it.
- Signup profile details are lost. `LoginPage.jsx:63` upserts `profiles` and fails RLS (no INSERT policy). The production log shows it at 19:03 UTC today, and all 20 profiles created in the last 60 days have no first name.
- 5 live pages embed 2–5 MB camera photos inline (W-5). 10 old impersonation handoff rows still hold tokens; the PR scrubs them on the next use (EX-3).

**Limits**
- **What was analysed:** 99d66cd on 8970027 in depth. For ce9f67f, I re-checked only the shared files (byte-identical), the merge cleanliness, the full test suite, theme:check, the build and the function bundles.
- **Code read but not run against real data:**
  - 1eaa8d1: new AI copy generation, SDK 0.131, Netlify Blobs background function.
  - 79b5205 / ce9f67f: the Site upgrades tool, publish-site backups, the `published_at` migration, the dashboard badge and the banner.
  - No end-to-end wizard generation and no real R2 backup or restore has been run on any Netlify build.
  - Whether the `_backups/` prefix in the R2 bucket can be reached publicly was not verified.
- **Working tree:** the 64 uncommitted changes in your working tree are not covered.
- **Browsers:** current Chrome, Firefox 155 and iOS Safari 26.5 (simulator) were covered. iOS 15/16/17 was only emulated, not tested on a real device. Firefox ESR and Samsung Internet were not tested.
- **Services:** Stripe Checkout and Connect, Postmark sending and live R2 writes were not exercised; all were stubbed. Whether OG's customers actually received the wrong-time emails is inferred: `send_email` defaults to on and every row has an email, but no send log was checked.
- **Timing:** the data is as of about 18:50–20:10 UTC on 2026-10-02. New bookings, site edits or publishes after that (OG books almost daily) need the snapshot and checks in section 7.1.
- **Screenshots:** republish batch 3's screenshots taken between about 20:21 and 20:26 CEST may show the wrong page or viewport, because of a debug-port clash (B2-OPS). Its verdicts rest on HTML field comparisons, which were not affected.
- **Assumption:** no shop time zone is stored anywhere. The backfill assumes America/New_York for OG (Kissimmee, FL), and the completion timestamps and opening hours support it.

**Evidence locations.** Project data dir: `~/.claude/projects/-Volumes-Extreme-SSD-Work-Projects-DESKTOP-54LN9AS-Website-Creator/50974ebe-1bda-4741-8edb-bd6ca7f13a0c/impact/`.

| Topic | Folders |
|---|---|
| Sites | `customers/` |
| Widgets | `widgets/` |
| Bookings and money | `bookings/`, `verify-*` |
| Editor | `editor-open/` |
| Functions | `serverfn/` |
| Republish dry-runs | `republish/<slug>/` |
| Rollback and SQL | `rollback/` |
| Netlify | `netlify-build/` |
| RLS | `rls-drift/` |
| Browsers | `xbrowser/` |
| Dashboard sessions | `dash-session/` |
| Custom websites | `custom-sites-browser/` |
