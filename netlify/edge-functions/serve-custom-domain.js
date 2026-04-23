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

const MAIN_HOSTS = new Set([
  'sitebuilder.autocaregenius.com',
  'autosite-builder.netlify.app',
  'master--autosite-builder.netlify.app',
]);

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

  // Customer custom domain — look up slug from Supabase.
  const apex = host.replace(/^www\./, '');
  const sbUrl = Netlify.env.get('VITE_SUPABASE_URL');
  const sbKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!sbUrl || !sbKey) {
    return new Response('Server misconfigured', { status: 500 });
  }

  let slug;
  try {
    const lookup = await fetch(
      `${sbUrl}/rest/v1/sites?custom_domain=eq.${encodeURIComponent(apex)}&select=slug&limit=1`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    );
    const rows = lookup.ok ? await lookup.json() : [];
    slug = rows[0]?.slug;
  } catch {
    return new Response('Lookup failed', { status: 502 });
  }

  if (!slug) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf9f7"><div style="text-align:center"><h1>Site Not Found</h1><p style="color:#888">This domain isn't connected to a published site yet.</p></div></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Proxy to the existing R2-backed Worker on the Cloudflare zone.
  const upstream = `https://${slug}.autocaregeniushub.com${url.pathname}${url.search}`;
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
