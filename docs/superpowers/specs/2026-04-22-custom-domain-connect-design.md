# Custom Domain Connect — Design Spec

**Date:** 2026-04-22
**Status:** Approved for implementation
**Author:** Brainstorm session with user

## Problem

The `StepExport` wizard has a "Use your own domain" toggle that is a UI stub — the input value is dropped before reaching the server, no DNS is configured, no custom hostname is created on Cloudflare, and no CNAME instructions are returned. Users cannot actually point their own domain at a published site.

## Goal

Ship an end-to-end flow where a user types a domain they own (e.g., `mybusiness.com`), clicks one button, and within a few minutes their domain serves the published site over HTTPS. Primary path: auto-apply DNS via Domain Connect for registrars that support it (GoDaddy, IONOS/1&1, Cloudflare Registrar, Plesk). Fallback: show CNAME instructions for any other registrar.

## Non-goals (explicit)

- Domain search and purchase (deferred to a separate project).
- Support for more than one custom domain per site.
- Wildcard custom hostnames.
- Punycode / IDN input — ASCII domains only for MVP.
- Paid-tier gating (feature is free for all users in MVP; gating is a trivial future addition).
- A "disconnect and reconnect" UI. MVP ships connect + disconnect only.

## Architecture

Three zones of work:

### Zone 1 — Cloudflare one-time setup (manual, documented)

Performed once by the project owner via the Cloudflare dashboard and API. Not automated.

1. Create a proxied DNS record `fallback.autocaregeniushub.com` on the `autocaregeniushub.com` zone. Value: CNAME to wherever the Worker responds (most likely the Worker's `workers.dev` route or an existing proxied origin record). Proxied (orange cloud) = required.
2. On SSL/TLS → Custom Hostnames, set `fallback.autocaregeniushub.com` as the **Fallback Origin**.
3. Wait for Fallback Origin to reach "Active" status (can take a few minutes).
4. Confirm a test hostname can be added via API (smoke test during development).

No code in this repo covers this setup. It is documented in the implementation plan as a prerequisite step.

### Zone 2 — Cloudflare Worker (separate repo or dashboard-edited, not in this repo)

The Worker currently routes `{slug}.autocaregeniushub.com` → R2 object `{slug}/index.html`. It needs one additive change:

- When the `Host` header does **not** end in `.autocaregeniushub.com`, treat it as a custom hostname. Strip any leading `www.` to get the apex form, then query Supabase REST API for the `sites` row where `custom_domain = {apex}`. Serve that site's R2 object (by `slug`).
- Cache the `hostname → slug` lookup in Workers KV with a 60-second TTL to avoid hammering Supabase on every request.
- On cache miss and no Supabase match, return 404 with a branded page pointing to the builder's home.

This change is **flagged as a dependency** of the feature; the Worker lives outside this repo so it is tracked as a separate deliverable in the plan.

### Zone 3 — This repo (app + Netlify functions)

All code changes land here.

**New Netlify functions:**
- `connect-domain` — accepts `{ siteId, domain }`, normalizes, calls Cloudflare Custom Hostnames API (creates both apex and www records), detects Domain Connect via TXT lookup, stores hostname IDs in Supabase, returns Domain Connect apply URL (if supported) or CNAME instructions (always, as fallback).
- `domain-status` — accepts `{ siteId }`, reads hostname IDs from Supabase, polls Cloudflare for current DNS + SSL status of both hostnames, returns a consolidated status machine state for the UI.
- `disconnect-domain` — accepts `{ siteId }`, deletes both Cloudflare custom hostnames, clears the Supabase columns.

**Modified:**
- `unpublish-site` — also tear down any custom hostnames so a deleted site doesn't leak hostnames against the 100-free cap.
- `publishSite` (client lib) — **drop the `customDomain` parameter** from its call sites. Domain connection is a separate flow triggered from the panel, not from publish. Remove the stale line in `StepExport.jsx:30` that passes `customDomain` to `publishSite`.

**New frontend:**
- `CustomDomainPanel` component — shared between `StepExport` (wizard) and the Dashboard (post-publish connect). Contains the input, Connect button, live status display, Domain Connect redirect handling, CNAME instructions fallback, and disconnect button.
- A dedicated callback route `/domain-connected` for post-Domain-Connect-redirect return, which simply marks the UI state and kicks off status polling.

**Static asset:**
- `public/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json` — Domain Connect template provider/service descriptor. Static JSON served by Netlify.

**Database migration:**
- Supabase `sites` table: add columns `custom_hostname_apex_id TEXT`, `custom_hostname_www_id TEXT`, `custom_domain_status TEXT` (enum-ish: `pending_dns | active_dns | active_ssl | error_dns | error_ssl | disconnected`), `custom_domain_connected_at TIMESTAMPTZ`, `custom_domain_last_checked_at TIMESTAMPTZ`. `custom_domain` column already exists and is reused for the normalized primary input.

## Environment variables (added)

- `CLOUDFLARE_ZONE_ID` — the zone ID for `autocaregeniushub.com`, used by all custom-hostname API calls.
- `CUSTOM_DOMAIN_FALLBACK_ORIGIN` — the fallback origin hostname (e.g., `fallback.autocaregeniushub.com`). Used in CNAME instructions and the Domain Connect template build.
- `DOMAIN_CONNECT_STATE_SECRET` — server-side secret used to sign the state JWT on Domain Connect redirects.
- `POSTMARK_SERVER_TOKEN` — for the "domain is live" email. (Assumed already present; confirm during plan.)

## Data model

### Supabase `sites` table additions

```sql
ALTER TABLE sites
  ADD COLUMN custom_hostname_apex_id TEXT,
  ADD COLUMN custom_hostname_www_id TEXT,
  ADD COLUMN custom_domain_status TEXT,
  ADD COLUMN custom_domain_connected_at TIMESTAMPTZ,
  ADD COLUMN custom_domain_last_checked_at TIMESTAMPTZ;

CREATE INDEX idx_sites_custom_domain ON sites(custom_domain)
  WHERE custom_domain IS NOT NULL;
```

### Status state machine

```
disconnected → pending_dns → active_dns → active_ssl (terminal-success)
                    ↓            ↓
                error_dns    error_ssl (both recoverable by disconnect+reconnect)

active_ssl → disconnected (on disconnect)
```

UI copy maps to: "Connecting..." → "DNS verified, issuing SSL..." → "Live!" → error states get a specific message.

## Data flow — three journeys

### Journey A: Domain Connect (supported registrar)

```
1. User types "mybusiness.com" in CustomDomainPanel → clicks Connect.
2. Frontend POSTs to /connect-domain with { siteId, domain: "mybusiness.com" }.
3. Server normalizes (strip protocol, lowercase, strip path/trailing slash, strip leading "www.") → apex form "mybusiness.com". This apex form is what gets persisted to sites.custom_domain (single canonical source of truth).
4. Server queries DNS: TXT _domainconnect.mybusiness.com
   → returns e.g. "api.godaddy.com/v1/domains/settings"
5. Server fetches https://api.godaddy.com/v1/domains/settings/v2/mybusiness.com/settings
   → returns { urlSyncUX, providerId, providerName }
6. Server calls Cloudflare API twice:
   POST /zones/{z}/custom_hostnames { hostname: "mybusiness.com", ssl: { method: "http", type: "dv" } }
   POST /zones/{z}/custom_hostnames { hostname: "www.mybusiness.com", ssl: { method: "http", type: "dv" } }
   → stores both hostname IDs on the site row, status = pending_dns.
7. Server constructs Domain Connect sync apply URL:
   {urlSyncUX}/v2/domainTemplates/providers/autocaregeniushub.com/services/customdomain/apply
     ?domain=mybusiness.com
     &redirect_uri=https://app.autocaregenius.com/domain-connected?siteId={siteId}
     &state={signed-jwt-containing-siteId}
8. Server returns { applyUrl, cnameInstructions, hostnameIds, detectedProvider: "GoDaddy" }.
9. Frontend opens applyUrl in a popup (falls back to full-page redirect on popup block).
10. User authenticates at registrar, approves DNS records, gets redirected to /domain-connected.
11. /domain-connected route validates state, closes popup (or navigates back), triggers polling.
12. Frontend polls /domain-status every 3s while the panel is visible.
13. Cloudflare eventually reports active DNS + issued SSL → status = active_ssl → UI shows "Live!".
14. A Postmark email is sent to the user announcing the domain is live (via the same polling worker).
```

### Journey B: CNAME fallback (unsupported registrar, or Domain Connect TXT missing)

Steps 1–6 same as Journey A.

7'. Server skips Domain Connect URL construction; returns only `{ cnameInstructions, hostnameIds, detectedProvider: null }`.
8'. Frontend shows a panel with two CNAME rows to add at the user's registrar:
   - `@` → `fallback.autocaregeniushub.com`
   - `www` → `fallback.autocaregeniushub.com`
   Plus Cloudflare's `ownership_verification` TXT records (returned from the Cloudflare custom_hostnames response).
9'. User manually adds records at their registrar.
10'. Frontend polls `/domain-status`; same status machine as Journey A.

### Journey C: Disconnect

1. User clicks "Remove custom domain" in the panel.
2. Confirm modal.
3. Frontend POSTs to `/disconnect-domain` with `{ siteId }`.
4. Server calls Cloudflare DELETE `/zones/{z}/custom_hostnames/{apex_id}` and `/zones/{z}/custom_hostnames/{www_id}`.
5. Server clears all five new columns on the `sites` row and resets `custom_domain` to NULL.
6. Frontend returns to the "enter a domain" empty state.

## API / function contracts

### POST `/connect-domain`

Request:
```json
{ "siteId": "uuid", "domain": "mybusiness.com" }
```

Response (200):
```json
{
  "applyUrl": "https://api.godaddy.com/.../apply?...",   // null if no Domain Connect
  "detectedProvider": "GoDaddy",                          // null if no Domain Connect
  "cnameInstructions": [
    { "type": "CNAME", "host": "@",   "value": "fallback.autocaregeniushub.com" },
    { "type": "CNAME", "host": "www", "value": "fallback.autocaregeniushub.com" },
    { "type": "TXT",   "host": "_cf-custom-hostname.mybusiness.com", "value": "<ownership-token>" }
  ],
  "hostnameIds": { "apex": "abc123", "www": "def456" },
  "status": "pending_dns"
}
```

Errors: 400 (invalid domain), 409 (domain already connected to another site), 500 (Cloudflare API failure).

### GET `/domain-status?siteId=xxx`

Response:
```json
{
  "domain": "mybusiness.com",
  "status": "active_dns",
  "apex":  { "cloudflareStatus": "active", "sslStatus": "pending_validation" },
  "www":   { "cloudflareStatus": "active", "sslStatus": "pending_validation" },
  "message": "DNS verified. SSL certificate issuing (usually under 5 minutes).",
  "liveAt": null
}
```

Cache: the function checks `custom_domain_last_checked_at` on the row; if within last 2 seconds, returns cached status (from `custom_domain_status`) without re-calling Cloudflare. Polling at 3s intervals means ~1 Cloudflare call per poll per site, well within rate limits.

### POST `/disconnect-domain`

Request: `{ "siteId": "uuid" }`
Response: `{ "disconnected": true }` or 500.

## Domain Connect template

Hosted as a static JSON file at `public/.well-known/domainconnect/v2/autocaregeniushub.com/settings.json`:

```json
{
  "providerId": "autocaregeniushub.com",
  "providerName": "AutoCareGenius",
  "providerDisplayName": "AutoCare Genius Website Builder",
  "serviceId": "customdomain",
  "serviceName": "Custom Domain",
  "serviceDisplayName": "Connect your domain to AutoCareGenius",
  "description": "Point this domain at your AutoCareGenius website.",
  "variableDescription": "Your AutoCareGenius site",
  "syncBlock": false,
  "sharedProviderName": true,
  "records": [
    { "type": "CNAME", "host": "@",   "pointsTo": "fallback.autocaregeniushub.com", "ttl": 3600 },
    { "type": "CNAME", "host": "www", "pointsTo": "fallback.autocaregeniushub.com", "ttl": 3600 }
  ]
}
```

Note on apex CNAME: traditional DNS forbids CNAME at apex. GoDaddy and IONOS both handle this via CNAME flattening/ANAME when set through their own tooling — Domain Connect abstracts the mechanism. Registrars that reject apex CNAME will skip that record and set only `www`; our CNAME-fallback instructions will tell the user to use an A/ALIAS record in that case.

Netlify is configured to serve the `/public` directory as static. Confirm that `/.well-known/` paths aren't rewritten by the SPA fallback — add an explicit `netlify.toml` redirect exception if needed.

## Error handling and edge cases

**Invalid domain input**
- Regex validation server-side: `^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$` after normalization.
- Reject `localhost`, IPs, reserved TLDs.

**Domain already connected**
- Cloudflare returns `409 Conflict` from the hostname POST.
- Our function checks Supabase first: `SELECT id FROM sites WHERE custom_domain = '{normalized-apex}'` — if another site owns it (different `siteId` from request), reject with 409 and a clear message.
- If no other site owns it but Cloudflare still returns 409, the hostname was left orphaned from a prior delete failure. Handle by calling GET on the hostname list, finding the orphan, deleting it, and retrying the create once.

**Cloudflare API errors**
- Retry once on 5xx. Fail hard on 4xx (log + surface).
- Ownership verification failure (user set wrong TXT) → status reports error_dns with the expected records shown again.

**SSL issuance timeouts**
- Cloudflare may take up to 15 minutes on first issuance. If status is stuck on `pending_validation` for > 1 hour, UI shows a "taking longer than usual, check DNS records" message with a manual retry button.

**DNS propagation lag**
- Status polling runs as long as the panel is mounted. On unmount, the user is emailed when the hostname transitions to `active_ssl`. Email trigger: a cron-based Netlify scheduled function that sweeps sites with status `active_dns` every 2 minutes and re-checks Cloudflare; if any become `active_ssl`, mark the row and enqueue a Postmark email.

**Race conditions**
- The `connect-domain` function is idempotent on retry (server-side): if a hostname with that exact name already exists on **this** site's row, reuse the existing IDs rather than creating duplicates.

**Abuse / rate limiting**
- Limit one successful `connect-domain` call per site per 60 seconds (naive server-side check against `custom_domain_connected_at`).
- Require authenticated user matching the site owner (assumed available from existing Supabase auth context — confirm during implementation).

**Disconnect with orphan Cloudflare hostname**
- On disconnect, attempt both Cloudflare deletes. If one fails, continue and log — the Supabase columns are still cleared. A daily reconciliation cron (future work) can sweep orphans.

## Security considerations

- **Domain ownership is proven by Cloudflare's HTTP-01 validation.** SSL does not issue until the CNAME is correctly set. Our UI must never treat a `pending_dns` status as "owned."
- **State parameter** on Domain Connect redirect is a short-lived JWT containing `siteId` and an expiration, signed with a server secret. Prevents CSRF via crafted redirect URLs.
- **CORS** on `connect-domain` and `disconnect-domain`: same-origin only (already enforced by Netlify Functions default). No external origins.
- **Rate limits on Cloudflare API**: Cloudflare's default rate limit is 1200 requests / 5 min per account. Status polling is bounded (2s server-side cache + panel-only polling); we're orders of magnitude under.
- **User cannot steal another user's domain**: enforced at two levels — Supabase ownership check on `connect-domain`, and Cloudflare's DNS ownership validation at the DNS layer.

## Testing strategy

**Unit tests**
- Domain normalization: assorted inputs → expected outputs (strip protocol, strip path, lowercase, strip trailing slash, extract primary hostname).
- Domain validation regex: positive and negative cases.
- Status state machine: given Cloudflare apex + www statuses, assert the consolidated UI status.

**Integration tests (Netlify functions, via vitest + mocked Cloudflare API)**
- `connect-domain` happy path (Domain Connect provider detected).
- `connect-domain` happy path (no Domain Connect, CNAME fallback).
- `connect-domain` domain already connected to another site → 409.
- `connect-domain` Cloudflare returns 409 (orphan recovery path).
- `domain-status` returns correct consolidated status for each Cloudflare status combination.
- `disconnect-domain` clears columns even when Cloudflare delete returns 404.

**Manual E2E (required before launch)**
- Buy a throwaway domain on GoDaddy. Run the full Domain Connect sync flow. Verify live site loads over HTTPS.
- Same with a Namecheap domain (CNAME fallback). Verify manual CNAME works.
- Disconnect, verify domain stops resolving (after TTL expiry) and Cloudflare hostname is gone.
- Test apex-only (user types `mybusiness.com`) and www-only (user types `www.mybusiness.com`) inputs — both should connect both.

## Rollout plan

1. Land Supabase migration (columns are additive, zero-downtime).
2. Land Netlify functions + static Domain Connect template behind a feature flag env var `VITE_CUSTOM_DOMAIN_ENABLED=false`.
3. Perform Cloudflare one-time setup manually. Smoke test with a single hostname via curl.
4. Update the Worker (separate repo) to route by Host header. Deploy. Test against the smoke-test hostname.
5. Flip feature flag to true. Ship frontend panel.
6. Manual E2E on GoDaddy + Namecheap.
7. Monitor first 10 real connections closely. Have a disable-flag ready.

## Open questions flagged during implementation

- **Worker repo location**: need to confirm where the Worker lives and who deploys it. This is captured as a plan step ("locate Worker repo, document access, land Host-header routing change").
- **Postmark template**: an existing "domain live" email template is assumed — if absent, creating one is a plan step.
- **`providerId` registration**: Domain Connect does not require formal registration for sync flows; the `providerId` is self-asserted. If we later want to go async (template-signed, no user auth every time), we'd submit the template to the Domain-Connect/Templates GitHub repo and get it mirrored by GoDaddy/IONOS.
