# Genius Websites — Cleanup Audit
**Date:** 2026-05-20
**Branch:** `claude/upbeat-wu-3506e0`
**Scope:** Database schema · Dead code · Unused dependencies · Verification of 2026-04-29 audit
**Output type:** Report only — no code changes attached

This audit is a technical-debt sweep, not a re-do of the [2026-04-29 full platform audit](2026-04-29-full-platform-audit.md). It answers three questions:

1. What was promised on 2026-04-29 — what got delivered?
2. What dead code, unused deps, and orphan files can be deleted today?
3. What's wrong with the Supabase schema that's hurting us now or will soon?

---

## 0. Executive Summary

**The good news.** Every CRITICAL (5/5) and every HIGH (9/9) security item from 2026-04-29 is now FIXED. The single 2026-04-29 commit `de11a6d` shipped the audit's entire "Top 5 fix order" plus most of HIGH, eliminating publish/unpublish unauth, cost-exfil on AI/Places endpoints, rate-limit-in-memory, CORS wildcard, and the impersonation audit gap.

**The bad news, in one sentence.** One critical regression has emerged since 2026-04-29: **`widget_configs` has RLS disabled and contains live Instagram OAuth tokens** — anyone with the Supabase anon key can read or modify every row. Fix is 1-2 lines of SQL once we verify the existing policies; do this first.

**Cleanup opportunity at a glance.**

| Category | Items | Disk/bundle saved | Risk if shipped |
|---|---|---|---|
| Dead Netlify functions (Shopify trio + impersonate v1 + test-postmark) | 5 files, ~600 lines | Cold-start surface | LOW — none have frontend callers |
| Dead frontend files | 3 (tawk, top-level IconOrEmoji, _g.cjs) | ~250 lines | LOW |
| Unused npm deps in frontend bundle | 4 packages (`@stripe/connect-js`, `@stripe/react-connect-js`, `stripe`, `jose`) | ~600 KB install + cleaner bundle | LOW |
| Dead DB tables | 2 (`reviews_cache`, `customer_messages`) | 0 KB but schema clarity | LOW |
| Dead DB columns | 8 (Shopify, role, netlify_*, deposit_amount_cents, payment_status) | minor | LOW |
| Image bloat in `sites.generated_content._images` | base64 in JSONB | **~280 MB** reclaimable | MEDIUM — needs migration |

**Top priorities (do these this week).**
1. Enable RLS on `widget_configs` — stops the Instagram-token leak (CRITICAL, ~30 min).
2. Delete the dead Shopify stack and `admin-impersonate.js` (~1 hour, satisfying).
3. Add `processed_stripe_events` dedup table — last unfixed item from 2026-04-29 CC-4 (~1 hour).
4. Add security headers to `netlify.toml` — last Day-1-7 item from 2026-04-29 (~30 min).
5. Add `CREATE INDEX sites_user_id_idx` — the most-queried column has no index (~5 min).

---

## 1. Critical / Act Now

### 1.1 `widget_configs` is RLS-disabled and leaking Instagram OAuth tokens — **NEW since 2026-04-29**

`widget_configs` has Row Level Security DISABLED. It holds 61 rows including the `instagram_access_token` column (live OAuth tokens) and `place_id` fields. Two SELECT policies exist on the table but **do not apply** because RLS is off — meaning anyone with the Supabase anon key (which is in the frontend JS bundle of every published site) can read or modify every row.

**Severity:** SEV-2 token exfiltration. An attacker with a published-site URL → grabs anon key from bundle → `SELECT * FROM widget_configs` → has every connected Instagram account's access token.

**Fix path:**
```sql
-- Step 1: verify existing policies are sufficient
SELECT * FROM pg_policies WHERE tablename = 'widget_configs';

-- Step 2: enable RLS
ALTER TABLE public.widget_configs ENABLE ROW LEVEL SECURITY;

-- Step 3: confirm INSERT/UPDATE paths still work
--   src/components/wizard/StepBusinessInfo.jsx (line ~104)
--   src/components/wizard/StepSocialFeeds.jsx  (line ~25)
-- These currently INSERT under the anon key; will fail closed unless you add
-- an INSERT policy: USING (user_id = auth.uid()::text)
```

Smaller issues on the same table:
- `widget_configs.user_id` is `text` defaulting to `'internal-user'`, not a UUID FK to `auth.users`. 4 rows have the literal string `'internal-user'`. Should be `uuid` with a real FK.
- `type='google'` and `type='instagram'` both return zero rows — all 61 rows have a different (NULL or other) type. Worth one cleanup query: `SELECT type, COUNT(*) FROM widget_configs GROUP BY 1`.

### 1.2 Security headers still missing from `netlify.toml` — STILL OPEN from 2026-04-29 M6

`netlify.toml` (47 lines) has zero CSP, HSTS, X-Frame-Options, Referrer-Policy, or X-Content-Type-Options headers. This is the single remaining item from the 2026-04-29 Day-1-7 list. ~30 minutes of work.

### 1.3 `processed_stripe_events` dedup table — STILL OPEN from 2026-04-29 CC-4 / M8

The 2026-04-29 webhook-idempotency fix shipped **half** the audit's recommendation:
- ✅ `_lib/booking-deposit-handler.js:48` now guards with `.eq('deposit_status','pending')`
- ✅ `_lib/stripe-charge-handler.js:25` now guards with `.eq('status','pending')`
- ❌ No `processed_stripe_events` event-id table exists (zero matches in `db/migrations/`)

The per-row guards mitigate most practical replay damage but the principled fix is still pending. With the new booking-add-ons schema (added 2026-05-18), a replay could now miscount `total_cents`. ~1 hour.

---

## 2. What's Been Done Since 2026-04-29 (Verification)

This section verifies the 2026-04-29 audit's findings against today's codebase. Format: ID → status → evidence (file:line where applicable).

### §1 Cross-cutting

| ID | Finding | Status | Evidence |
|---|---|---|---|
| CC-1 | publish-site.js unauth | ✅ FIXED | `netlify/functions/publish-site.js:36` — `await requireSiteOwner(...)`; slug validated at L30; defense-in-depth slug-match at L44 |
| CC-2 | Design tokens defined but unused | ❌ STILL OPEN | Token classes used in only 1 file (`ConnectStatusBadge.jsx`, 3 hits). Counter: 257 `bg-[#…]` across 49 files, 641 `text-[#…]` across 45 files |
| CC-3 | No focus traps / live regions / prefers-reduced-motion | ❌ STILL OPEN | Zero `prefers-reduced-motion` matches in `src/`. Zero `focus-visible:` matches. No `FocusTrap`/`Dialog` primitive. `AlertProvider.jsx` toast still has no `aria-live` |
| CC-4 | Webhook idempotency | ⚠️ PARTIAL | Per-row guards added (see 1.3); `processed_stripe_events` table still missing |
| CC-5 | Rate limits in process memory | ✅ FIXED | `create-booking.js:46` + `support-book.js:68` use `checkAndRecordRateLimit`. Backing table in `db/migrations/20260429_request_log.sql`. Helper at `_shared/rateLimit.js` |
| CC-6 | Cost-exfiltration on AI/Places | ✅ FIXED | `generate-website.js:28` requires user + 30/day cap; `places-search.js:16` requires user |
| CC-7 | No observability | ❌ STILL OPEN | `package.json` has no `@sentry/*`, no `posthog-js`, no `datadog`. Zero Sentry/PostHog refs in code |
| CC-8 | No SMS | ❌ STILL OPEN | No `twilio` dependency |

### §2 Security CRITICAL items

| ID | Status | Evidence |
|---|---|---|
| C1 publish-site.js | ✅ FIXED | See CC-1 |
| C2 unpublish-site.js | ✅ FIXED | `unpublish-site.js:28` requireSiteOwner; L36 forces stored slug; L37 validates with `isValidSlug` |
| C3 domain-sweep.js cron | ✅ FIXED | `domain-sweep.js:17-25` — schedule-header OR shared-token, 401 otherwise |
| C4 admin-backfill-subscription-period.js | ✅ FIXED | File deleted |
| C5 service_role in serve-custom-domain | ✅ FIXED | Edge function uses `VITE_SUPABASE_ANON_KEY` + RPC `get_site_slug_for_custom_domain` (defined in `20260429_custom_domain_lookup_rpc.sql`) |

### §2 Security HIGH items

| ID | Status |
|---|---|
| H1 Impersonation audit table | ✅ FIXED — `admin-impersonate.js:93-103` inserts into `admin_impersonations` before generating link |
| H2 Rate limits in Map | ✅ FIXED (see CC-5) |
| H3 places-search.js unauth | ✅ FIXED (see CC-6) |
| H4 generate-website.js unauth | ✅ FIXED (see CC-6) |
| H5 stripe-portal-url cross-check | ✅ FIXED — `stripe-portal-url.js:49-56` verifies `customer.metadata.supabase_user_id === user.id` |
| H6 Wide-open CORS | ✅ FIXED — `_shared/cors.js` allowlist + Vary: Origin + deploy-preview matching; `PUBLIC_CORS` separated with documented rationale |
| H7 Booking webhook amount check | ✅ FIXED — `_lib/booking-deposit-handler.js:28-37` compares `session.amount_total` to `deposit_required_cents` |
| H8 serve-custom-domain slug validation | ✅ FIXED — edge function inlines `isValidSlug` at L33-35, rejects invalid at L83, strips CRLF at L92-93 |
| H9 Domain conflict TOCTOU | ✅ FIXED — `20260429_custom_domain_unique.sql` adds partial unique index |

### §2 Security MEDIUM items

| ID | Status | Notes |
|---|---|---|
| M1 support_bookings RLS | ⚠️ NOT VERIFIED | No `support_bookings` definition in `db/migrations/` (may live in Supabase dashboard) |
| M2 Domain lookup edge cache | ❌ STILL OPEN | Edge function hits Supabase on every request |
| M3-M5 | ❌ STILL OPEN | Not re-verified — low priority |
| **M6 Security headers in netlify.toml** | ❌ **STILL OPEN** | The only Day-1-7 item still pending — see 1.2 |
| M7 Stripe API version mismatch | ✅ FIXED incidentally | Mismatched file was `admin-backfill-subscription-period.js` which got deleted in C4 |
| **M8 processed_stripe_events** | ❌ **STILL OPEN** | See 1.3 |

### §3-§5 UX/a11y/Performance

Almost untouched. Notable:
- **`ContentEditor.jsx` grew worse**: 1,241 → 1,407 lines (+13%). Service-price editing and add-ons editing piled in without refactoring.
- All a11y wave items (Dialog primitive, focus-visible, alt-text input, prefers-reduced-motion, skip-link, h1-per-page, aria-live toasts) untouched.
- Font preload not stripped (still 20 Google Font families synchronously in `index.html:11`).
- ESLint config still missing (`package.json` declares `"lint": "eslint src"` but no `eslint.config.js`).
- No GitHub Actions CI.

### §6 Strategic product

No commits in window for SMS, AI Edit, GBP integration, review-request automation, schema.org markup, VIN decoder, recurring reminders, tipping, memberships, or before/after photos. Product work was: booking add-ons, trial removal, dashboard tweaks, Places API tuning.

---

## 3. Dead Code & Unused Dependencies

### 3.1 Dead Netlify functions (5 files — DELETE)

All five have **zero frontend callers** and no scheduled trigger. They still deploy on every push, adding cold-start surface and attack surface.

| File | Reason | Confidence |
|---|---|---|
| `netlify/functions/admin-impersonate.js` | Magic-link approach superseded by `admin-impersonate-session.js` + `impersonate-claim.js`. AdminUserDrawer only calls the new one. | HIGH |
| `netlify/functions/subscription-checkout-url.js` | Shopify cart URL generator. Replaced by `stripe-checkout-url.js` | HIGH |
| `netlify/functions/setup-shopify-webhooks.js` | One-time Shopify webhook registrar | HIGH |
| `netlify/functions/shopify-subscription-webhook.js` | Inbound Shopify webhook handler | HIGH |
| `netlify/functions/test-postmark.js` | Dev diagnostic with no auth gate, exposes Postmark config details. Should be a local script | HIGH |

Deletion also makes `netlify/functions/_lib/shopify-hmac.js` dead (its only consumer is the Shopify webhook). Plus its test at `tests/functions/shopify-hmac.test.js`.

### 3.2 Dead frontend files (3 files — DELETE)

| File | Reason | Confidence |
|---|---|---|
| `src/lib/tawk.js` | Live-chat integration never wired into any component. `VITE_TAWK_EMBED` env var not in `.env.example`. Replaced in spirit by `ScheduleZoomModal` | HIGH |
| `src/components/preview/IconOrEmoji.jsx` (top-level) | Stranded duplicate. Templates import from `'../IconOrEmoji.jsx'` which resolves to `src/components/preview/templates/IconOrEmoji.jsx` — a separate file | HIGH |
| `src/components/preview/templates/detailing/_g.cjs` | CJS code-gen script that produced `DetailingAutoSyncWhite.jsx`. Doesn't belong in `src/` tree. Move to `scripts/` or delete | HIGH |

### 3.3 Unused npm dependencies in `package.json` (root)

```bash
npm uninstall @stripe/connect-js @stripe/react-connect-js stripe jose
```

| Package | Reason |
|---|---|
| `@stripe/connect-js` | Zero `from '@stripe/connect-js'` imports anywhere in `src/`. The Connect SDK was planned but never wired up |
| `@stripe/react-connect-js` | Zero imports |
| `stripe` | Node.js server SDK — has no business in the Vite bundle. Already in `netlify/functions/package.json` where it belongs |
| `jose` | JWT library — only used in `netlify/functions/_shared/stateSig.js`, already listed in `netlify/functions/package.json` |

Suspicious entry in `netlify/functions/package.json`: `website-creator: file:../..` — a self-reference forcing esbuild to resolve the entire root project. No function imports from it. CONFIDENCE: MEDIUM — verify by removing temporarily and re-running build.

### 3.4 Dead feature-flag branches

| Flag | Status | Notes |
|---|---|---|
| `VITE_CUSTOM_DOMAIN_ENABLED` | Permanently `false` in `.env.example` | Server-side infra fully built; gated UI is dead branch in every env where var isn't set to `'true'`. Either promote or document |
| `VITE_TAWK_EMBED` | Permanently unset | Together with `src/lib/tawk.js` deletion, this can be removed |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Real gate | Hides Payments tab when absent. Legitimate staged feature |
| `VITE_FB_APP_ID` | Real toggle | Used for OAuth conditional |
| `VITE_PAYWALL_ALLOWLIST_EMAILS` | Real toggle | Added 2026-05-20 for paywall QA. Currently contains `dev@639hz.com` for trial-removal testing |

### 3.5 Duplicate logic — `domainUtils.js`

`src/lib/domainUtils.js` and `netlify/functions/_shared/domainUtils.js` are **byte-for-byte identical** (20 lines each, exports `normalizeDomain` + `isValidDomain`). This is the single most maintenance-risky duplication in the repo: a bug fix on one side won't propagate. Same domain string could be validated differently client vs. server.

Fix: pick one as canonical. Since Vite can't reach into `netlify/`, the cleanest path is to keep `src/lib/domainUtils.js` as the source and add a comment to `netlify/functions/_shared/domainUtils.js` like `// MIRROR OF src/lib/domainUtils.js — keep in sync` (matches existing pattern from `src/lib/subscriptionGating.js` ↔ `netlify/functions/_lib/subscription-gating.js`).

### 3.6 Console.log in production code

`src/lib/AuthContext.jsx` has 6 `console.log` calls (lines 34, 40, 46, 48, 56, 67) logging auth state on every page load. Lines 46 and 56 include user emails. **This was 2026-04-29 quick-win #5, ~15 min**, and it's still open three weeks later. Fix: wrap each in `if (import.meta.env.DEV)` or remove.

Server-side `console.error`/`console.warn` (71 occurrences across 28 files) are intentional structured logging — leave alone.

### 3.7 TODO/FIXME comments

Zero matches across `src/` and `netlify/functions/`. The codebase is unusually clean of comment-debt.

---

## 4. Database Schema Cleanup

### 4.1 Dead tables (DROP)

```sql
-- Zero references in src/ or netlify/functions/. 0 rows.
DROP TABLE public.reviews_cache;

-- Zero references. 0 rows. (Confirm with you it's not pre-wired for an
-- upcoming feature before dropping.)
DROP TABLE public.customer_messages;
```

### 4.2 Dead columns

**On `profiles`:**
```sql
-- All 60 rows say 'client'. Zero code reads or writes. Replaced by is_super_admin
ALTER TABLE public.profiles DROP COLUMN role;

-- 0 populated rows. Only Shopify webhook (itself dead) writes them
ALTER TABLE public.profiles
  DROP COLUMN shopify_customer_id,
  DROP COLUMN shopify_subscription_id;

DROP INDEX profiles_shopify_customer_id_idx;
```

Also remove `shopify_customer_id` from SELECT list in `src/lib/AuthContext.jsx:73` and the conditional in `src/components/admin/AdminUserDrawer.jsx:227`.

**On `sites`:**
```sql
-- 0 populated rows. Zero references. Replaced by R2 publishing flow
ALTER TABLE public.sites
  DROP COLUMN netlify_site_id,
  DROP COLUMN netlify_site_name;
```

**On `bookings`:**
```sql
-- Superseded by deposit_required_cents + deposit_paid_cents in 20260425_booking_deposits.sql
-- Zero code references
ALTER TABLE public.bookings
  DROP COLUMN deposit_amount_cents,
  DROP COLUMN payment_status;
```

`bookings.vehicle_*` fields (`vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_size`, `customer_phone`) are NOT NULL but the platform now serves non-auto verticals. Should relax to nullable next time you touch the bookings schema. Not blocking.

### 4.3 Image bloat — the biggest cleanup win

**Symptom:** `public.sites` is 282 MB / 91 rows = ~3 MB/row average. The top 5 rows alone are 42, 26, 17, 16, 8 MB.

**Cause:** `sites.generated_content._images` stores base64-encoded image data in JSONB. 17 sites have the `_images` key; one site has 42 MB of base64 in that single key.

**Impact:** Every `SELECT * FROM sites WHERE user_id = X` pulls megabytes of base64 over the wire and back through the Supabase JS client. Repeat queries (auth context, dashboard reload, site edit) compound this. Backups and Supabase egress fees scale with table size.

**Fix path:**
1. Add a new column `sites.image_urls jsonb` (or use Cloudflare R2 / Supabase Storage as the canonical store).
2. Backfill: for each site with `_images`, upload each blob to R2/Storage, store the URL.
3. Update writers: `src/lib/saveSite.js`, `src/lib/exportHtml.js`, wizard upload step.
4. Drop `generated_content._images` after verification.

Expected result: 282 MB → ~3 MB. ~280 MB recovered. CONFIDENCE: HIGH the bloat is real; MEDIUM on migration complexity.

### 4.4 Overlapping CRM schemas

`customer_metadata` and `customer_profiles` both store `notes` + `tags` keyed by `(owner_user_id, identity_key)`. The plan `docs/superpowers/plans/2026-04-25-customer-crm-extensions.md` line 14 already calls this out: *"Consolidating customer_metadata + customer_profiles (two tables with overlapping notes/tags columns). Left for a future clean-up."*

Both tables are 0 rows right now. Merge while it's cheap:
1. Verify `customer_profiles` has matching `notes`/`tags` columns (it does).
2. Update `src/lib/customers.js` to read/write `customer_profiles` instead of `customer_metadata`.
3. `DROP TABLE public.customer_metadata`.

### 4.5 Indexes

**Add (HIGH priority — most-queried column in the app):**
```sql
CREATE INDEX sites_user_id_idx ON public.sites (user_id);
```
This is the lookup key in `App.jsx`, `BookingsPage`, `ChargesPage`, `CustomersPage`, `CustomerDetailPage`. Currently only the PK and `slug_idx` exist on `sites`. At 91 rows it doesn't matter; at 10k rows it will.

**Make UNIQUE (MEDIUM priority):**
```sql
-- Verify first: SELECT slug, COUNT(*) FROM sites WHERE slug IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX CONCURRENTLY sites_slug_unique_idx
  ON public.sites (slug) WHERE slug IS NOT NULL;
DROP INDEX sites_slug_idx;
```
Currently `publish-site.js:42-45` enforces slug uniqueness in application code — race-condition risk.

**Drop redundant (HIGH priority):**
```sql
-- customer_profiles_owner_identity_unique and customer_profiles_owner_user_id_identity_key_key
-- are the same key. Drop one.
DROP INDEX customer_profiles_owner_identity_unique;  -- or the other
```

**Drop dead:**
```sql
-- Index on dead column (when you drop shopify_customer_id, this goes too)
DROP INDEX profiles_shopify_customer_id_idx;
```

### 4.6 RLS posture beyond `widget_configs`

| Table | RLS | Issue | Priority |
|---|---|---|---|
| `widget_configs` | **OFF** | Section 1.1 — fix now | CRITICAL |
| `reviews_cache` | OFF | Drop entire table (see 4.1) | HIGH |
| `impersonation_handoffs` | ON, **no policies** | Intentional (service-role only) but should be commented in the migration to prevent confusion | LOW |
| `request_log` | ON, **no policies** | Intentional (service-role only) — same comment recommendation | LOW |
| 4× SECURITY DEFINER fns exposed to anon/authenticated | — | `can_book_site` and `get_site_slug_for_custom_domain` are intentional. `handle_new_user` and `is_super_admin` are trigger/internal helpers — REVOKE EXECUTE from anon/authenticated | MEDIUM |
| 3× functions with mutable search_path | — | `support_bookings_set_updated_at`, `admin_user_metadata_set_updated_at`, `tg_set_updated_at`. `ALTER FUNCTION ... SET search_path = public, pg_temp;` Trivial | LOW |
| Auth: `leaked_password_protection` off | — | Enable in Supabase Auth dashboard | LOW |

### 4.7 Foreign key oddities

- `charges.owner_user_id → profiles.id` (everything else points at `auth.users.id`). Practically benign because of the cascade chain, but inconsistent.
- `charges.owner_user_id` and `charges.site_id` both use `ON DELETE NO ACTION`. Deleting a site or profile with charges will hard-fail. May be intentional — make it explicit: `ON DELETE RESTRICT` documents intent.

### 4.8 Stale data

- `request_log` has 5 rows; oldest is 2026-04-29 (21 days). Migration `20260429_request_log.sql` promised a pruning job that **doesn't exist** anywhere in the codebase. Not urgent now (5 rows); add a pg_cron-scheduled prune of rows older than 24h before traffic grows.

### 4.9 Data anomalies — clean

Spot-checked:
- Sites without `auth.users`: **0**
- Profiles without `auth.users`: **0**
- Sites with `user_id` not in profiles: **0**
- User `5818d18b-…` has 26 sites and user `7eb4542f-…` has 16 — `20260424_sites_one_per_non_admin.sql` allows multiple sites only for super-admins. Verify these are admin accounts; if not, the INSERT policy may be leaking.

---

## 5. Recommendations — Priority Matrix

### Tier 1: Critical / This Week
| Item | Effort | Section |
|---|---|---|
| Enable RLS on `widget_configs` (stops Instagram-token leak) | 30 min | 1.1 |
| Add security headers to `netlify.toml` (last Day-1-7 item) | 30 min | 1.2 |
| Create `processed_stripe_events` dedup table | 1 hour | 1.3 |
| `CREATE INDEX sites_user_id_idx` | 5 min | 4.5 |
| Strip 6 debug console.logs from `AuthContext.jsx` (was 2026-04-29 QW#5) | 15 min | 3.6 |

### Tier 2: High Value / This Sprint
| Item | Effort | Section |
|---|---|---|
| Delete 5 dead Netlify functions + `shopify-hmac.js` + its test | 30 min | 3.1 |
| Delete 3 dead frontend files (tawk, top-level IconOrEmoji, _g.cjs) | 10 min | 3.2 |
| `npm uninstall @stripe/connect-js @stripe/react-connect-js stripe jose` (root) | 10 min | 3.3 |
| Drop dead DB columns (Shopify, role, netlify_*, deposit_amount_cents, payment_status) | 30 min | 4.2 |
| Drop dead DB tables (`reviews_cache`, `customer_messages`*) | 10 min | 4.1 |
| Merge `customer_metadata` into `customer_profiles` (both 0 rows now) | 1 hour | 4.4 |
| Drop redundant duplicate index on `customer_profiles` | 5 min | 4.5 |
| Make `sites.slug` UNIQUE | 15 min | 4.5 |
| Resolve duplicate `domainUtils.js` (add MIRROR-OF comment) | 5 min | 3.5 |

*`customer_messages` drop pending your confirmation it's not pre-wired for an upcoming feature.*

### Tier 3: Big Wins / This Month
| Item | Effort | Section |
|---|---|---|
| Move `sites.generated_content._images` base64 to R2/Storage (~280 MB DB reduction) | 1-2 days | 4.3 |
| Add Sentry or PostHog (CC-7) | half-day | §2 |
| Build a `Dialog` primitive with focus trap (CC-3) | 1 day | §2 |
| Design-system codemod for hex literals → tokens (CC-2) | 3-4 days | §2 |
| Add alt-text input to ImageSlot/GallerySlot | half-day | §2 |

### Tier 4: Nice-to-Have / Q3 Backlog
| Item | Notes |
|---|---|
| Strip 20-font preload from `index.html:11` | |
| Add `prefers-reduced-motion` global utility | |
| Refactor `ContentEditor.jsx` (1,407 lines, +13% since audit) | |
| Add ESLint v9 config + GitHub Actions CI | |
| `pg_cron` to prune `request_log` >24h | |
| Re-point `charges.owner_user_id` at `auth.users(id)` for consistency | |
| Make `bookings.vehicle_*` nullable | |
| Fix `widget_configs.user_id` to be `uuid` with FK | |
| Migrate to React Router (CC §3) | |
| SMS via Twilio (CC-8) | Strategic |

---

## 6. Summary in 60 Seconds

**Security posture is in the best shape it's ever been** — the 5 CRITICALs and 9 HIGHs from 2026-04-29 are all closed, and the codebase passes the "ready-for-acquirer-DD smell test" on every Day-1-7 item except security headers and the dedup table.

**The one regression to address now is `widget_configs` RLS** — Instagram OAuth tokens are publicly readable through the anon key. Single ALTER TABLE fixes it.

**The cleanup opportunity is real but contained.** Deleting the Shopify trio, the 4 unused npm packages, and the few orphan files is ~2 hours of safe work. The DB cleanup is another ~1 day for the column drops + table drops + index work. The big win — moving base64 image data out of `sites.generated_content` to R2 — is a 1-2 day project that frees ~280 MB and meaningfully speeds up the dashboard.

**The architectural debt that hasn't moved** is the same set the 2026-04-29 audit flagged: observability, the design system codemod, and the entire a11y wave. Those need dedicated sprint time, not opportunistic fixes.

**Recommended order of attack:**
1. Days 1-2: Tier 1 (RLS fix, security headers, dedup table, index, console.logs).
2. Days 3-5: Tier 2 cleanup pass — delete the dead code and dead DB rows.
3. Sprint 2 (1 week): Image migration to R2 + Sentry.
4. Sprint 3 (2 weeks): Design system codemod + Dialog primitive + alt-text input + focus-visible.
