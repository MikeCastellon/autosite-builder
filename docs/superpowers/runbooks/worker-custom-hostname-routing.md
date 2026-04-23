# Worker Custom Hostname Routing — Change Spec

**This change lives in the Worker repo, not this one.** It is a prerequisite of the custom-domain feature.

## Current behavior

The Worker routes `{slug}.autocaregeniushub.com` to R2 key `{slug}/index.html`.

## Required new behavior

When the `Host` header does **not** end in `.autocaregeniushub.com`, treat it as a customer-owned custom hostname:

1. Strip any leading `www.` from the host to get the apex form.
2. Look up the site in Supabase: `SELECT slug FROM sites WHERE custom_domain = '{apex}' LIMIT 1`.
3. If found, serve `{slug}/index.html` from R2.
4. If not found, return `404` with a branded "Site not found" page.

## Caching

Wrap the Supabase lookup in Workers KV with a 60-second TTL. Cache key: `hostname:{apex}`. Cache value: `{slug}` or `null` for negative cache (shorter TTL, 10s).

## Environment variables the Worker needs

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or anon + a view if you prefer least-privilege)
- KV namespace binding `HOSTNAME_CACHE`

## Rough implementation sketch

```js
const host = request.headers.get('host').toLowerCase();
const isSubdomain = host.endsWith('.autocaregeniushub.com');
let slug;

if (isSubdomain) {
  slug = host.split('.')[0];
} else {
  const apex = host.replace(/^www\./, '');
  const cached = await env.HOSTNAME_CACHE.get(`hostname:${apex}`);
  if (cached) {
    slug = cached === '__NULL__' ? null : cached;
  } else {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/sites?custom_domain=eq.${apex}&select=slug&limit=1`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const rows = await res.json();
    slug = rows[0]?.slug || null;
    await env.HOSTNAME_CACHE.put(`hostname:${apex}`, slug || '__NULL__', { expirationTtl: slug ? 60 : 10 });
  }
}

if (!slug) return new Response(notFoundHtml, { status: 404, headers: { 'Content-Type': 'text/html' } });

return env.ASSETS_BUCKET.get(`${slug}/index.html`).then(obj => new Response(obj.body, { headers: { 'Content-Type': 'text/html' } }));
```

## Cache invalidation

When a site is disconnected or deleted, our `disconnect-domain` / `unpublish-site` functions should purge the KV key. Add a `purge-hostname-cache` function in this repo that calls the Workers KV API; call it from those two functions after DB updates. (If not feasible, accept 60-second stale time.)

## Testing

- Deploy to Worker staging/preview.
- Add a test custom hostname manually via Cloudflare API that points at a known site.
- `curl -H "Host: test.example.com" https://worker-url/` → returns that site's HTML.
- `curl -H "Host: not-in-db.com" https://worker-url/` → returns 404 page.
