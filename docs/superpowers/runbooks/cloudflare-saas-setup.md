# Cloudflare for SaaS — One-Time Setup

Do this once, by hand, before enabling the feature flag `VITE_CUSTOM_DOMAIN_ENABLED=true`.

## Prerequisites
- Cloudflare account on Free plan or higher.
- `autocaregeniushub.com` zone active in the account.
- `CLOUDFLARE_API_TOKEN` with permissions: `Zone → Custom Hostnames → Edit` and `DNS → Edit` on the zone.

## Step 1 — Create the fallback DNS record

In the dashboard, open the `autocaregeniushub.com` zone → DNS → Records → Add record:

- Type: `CNAME`
- Name: `fallback`
- Target: same target the existing `*.autocaregeniushub.com` Worker uses (check the existing wildcard record if unsure — often a `workers.dev` subdomain).
- Proxy status: **Proxied** (orange cloud).
- TTL: Auto.

Click Save.

## Step 2 — Set fallback origin

In the dashboard, navigate to `autocaregeniushub.com` → SSL/TLS → Custom Hostnames.

Under **Fallback Origin**, enter: `fallback.autocaregeniushub.com`. Click **Add Fallback Origin**.

Wait for the status to become Active (can take a few minutes).

## Step 3 — Record the Zone ID

In the zone overview right sidebar, copy the Zone ID. Set it as env var `CLOUDFLARE_ZONE_ID` in Netlify site settings.

## Step 4 — Smoke test

Run this curl against the Custom Hostnames API to confirm the token works:

```
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/custom_hostnames" \
  -H "Authorization: Bearer <CF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"smoketest.example.com","ssl":{"method":"http","type":"dv"}}'
```

Expected: 200 with `"success": true`. Delete the smoke-test hostname via DELETE on the returned ID.

## Step 5 — Flip the feature flag

In Netlify → Site settings → Environment, set:
- `VITE_CUSTOM_DOMAIN_ENABLED=true`

Trigger a new deploy.
