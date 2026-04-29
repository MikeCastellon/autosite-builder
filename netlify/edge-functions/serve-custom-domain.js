// Serves customer custom-domain traffic that Netlify routes to this site.
//
// Flow:
//   1. Request arrives at Netlify's edge for www.<customer-domain>.
//   2. This function fires FIRST (configured path = "/*").
//   3. If the host is our main app or a free-tier subdomain, pass through.
//   4. Otherwise look up the slug in Supabase for this custom_domain.
//   5. Proxy the request to the existing R2-backed Worker at
//      https://<slug>.autocaregeniushub.com/… and return its response.
//
// We keep storage on Cloudflare R2 and reuse the existing serving Worker —
// this function is just the "route this Host to that slug" resolver.
//
// Security:
//   - Uses the Supabase ANON key + a SECURITY DEFINER RPC
//     (`get_site_slug_for_custom_domain`) that returns only the slug for an
//     exact-match apex. Avoids putting the service-role key on this code
//     path. (Security Audit C5 — see db/migrations/20260429_custom_domain_lookup_rpc.sql)
//   - Validates the slug returned from the RPC against the conservative
//     DNS-label charset before constructing the upstream URL. Belt and
//     suspenders against a future bug or row tampering producing a slug
//     that could break out of the host/path. (Security Audit H8)

const MAIN_HOSTS = new Set([
  'sitebuilder.autocaregenius.com',
  'autosite-builder.netlify.app',
  'master--autosite-builder.netlify.app',
]);

// Inlined to keep this edge function self-contained (Netlify edge runtime
// is Deno, not Node — won't share the Node `_shared/slug.js` module).
const SLUG_RE = /^[a-z0-9-]{1,63}$/;
function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 63 && SLUG_RE.test(slug);
}

export default async (request, context) => {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // Our app / preview / deploy hostnames → let Netlify serve normally.
  if (MAIN_HOSTS.has(host) || host.endsWith('--autosite-builder.netlify.app')) {
    return;
  }

  // Free-tier subdomain on our Cloudflare zone. These never come through
  // Netlify anyway, but guard against misconfigured DNS just in case.
  if (host.endsWith('.autocaregeniushub.com')) {
    return;
  }

  // Local dev — pass through.
  if (host === 'localhost' || host === '127.0.0.1') return;

  // Customer custom domain — look up slug from Supabase via the public RPC.
  const apex = host.replace(/^www\./, '');
  const sbUrl = Netlify.env.get('VITE_SUPABASE_URL');
  const sbAnon = Netlify.env.get('VITE_SUPABASE_ANON_KEY');
  if (!sbUrl || !sbAnon) {
    return new Response('Server misconfigured', { status: 500 });
  }

  let slug;
  try {
    const lookup = await fetch(`${sbUrl}/rest/v1/rpc/get_site_slug_for_custom_domain`, {
      method: 'POST',
      headers: {
        apikey: sbAnon,
        Authorization: `Bearer ${sbAnon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_apex: apex }),
    });
    if (lookup.ok) {
      const result = await lookup.json();
      // RPC returns the bare value (a text). Could be string or null.
      slug = typeof result === 'string' ? result : null;
    }
  } catch {
    return new Response('Lookup failed', { status: 502 });
  }

  if (!slug || !isValidSlug(slug)) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf9f7"><div style="text-align:center"><h1>Site Not Found</h1><p style="color:#888">This domain isn't connected to a published site yet.</p></div></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Sanitize the upstream path/search of CRLF before splicing into a URL —
  // belt-and-suspenders against header smuggling via a malicious request.
  const safePath = url.pathname.replace(/[\r\n]/g, '');
  const safeSearch = url.search.replace(/[\r\n]/g, '');

  // Proxy to the existing R2-backed Worker on the Cloudflare zone.
  const upstream = `https://${slug}.autocaregeniushub.com${safePath}${safeSearch}`;
  try {
    const res = await fetch(upstream, { headers: { 'User-Agent': 'netlify-edge-custom-domain' } });
    // Strip Cloudflare-specific headers, keep content-type + cache-control.
    const headers = new Headers();
    const passthrough = ['content-type', 'cache-control', 'etag', 'last-modified'];
    for (const h of passthrough) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(res.body, { status: res.status, headers });
  } catch {
    return new Response('Upstream fetch failed', { status: 502 });
  }
};

export const config = {
  path: '/*',
};
