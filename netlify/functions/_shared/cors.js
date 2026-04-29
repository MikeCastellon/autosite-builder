// Origin allowlist for browser-facing Netlify functions. Replaces the old
// '*' wildcard. The list comes from the CORS_ALLOWED_ORIGINS env var so we
// don't have to redeploy to add a preview/staging host. Deploy-preview
// hostnames on the Netlify site are matched separately by suffix because
// Netlify mints a new subdomain per build.
//
// Why echo a single matched origin (instead of returning '*'):
//   - With Authorization: Bearer credentials, '*' is ignored by browsers
//     anyway. A specific echoed origin is what actually allows the call.
//   - It defeats some CSRF-flavored cross-origin probes from non-allowed
//     attacker sites, even when Authorization is supplied.
//
// `Vary: Origin` is added so caches (Cloudflare/Netlify edge) don't serve
// the wrong origin's headers to a different caller.
const NETLIFY_PREVIEW_SUFFIX = '.netlify.app';

// Production-known origins. The env var CORS_ALLOWED_ORIGINS is the
// override path (staging URLs, custom branded admin domains, etc.).
// Localhost dev ports are allowed unconditionally for `netlify dev`.
const DEFAULT_ALLOWED = [
  'https://sitebuilder.autocaregenius.com',
  'https://app.autocaregenius.com',
  'https://autosite-builder.netlify.app',
  'http://localhost:5190',
  'http://localhost:8890',
  'http://127.0.0.1:5190',
  'http://127.0.0.1:8890',
];

function getAllowedList(env) {
  const raw = (env?.CORS_ALLOWED_ORIGINS || '').trim();
  if (!raw) return DEFAULT_ALLOWED;
  // The env var fully replaces the default list — if you set it, you
  // own it. Keeps prod overrides explicit.
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const list = getAllowedList(env);
  if (list.includes(origin)) return true;
  // Allow Netlify deploy-preview / branch-deploy hostnames for the
  // configured site only. We require an exact env entry that ends in
  // `.netlify.app` to opt-in to preview matching for that site.
  for (const allowed of list) {
    if (allowed.endsWith(NETLIFY_PREVIEW_SUFFIX)) {
      // allowed = "https://autosite-builder.netlify.app"
      // origin  = "https://deploy-preview-42--autosite-builder.netlify.app"
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        if (
          originUrl.protocol === allowedUrl.protocol &&
          originUrl.hostname.endsWith(`--${allowedUrl.hostname}`)
        ) {
          return true;
        }
      } catch { /* not a URL — skip */ }
    }
  }
  return false;
}

function readOrigin(headers) {
  if (!headers) return undefined;
  return headers.origin || headers.Origin || headers.ORIGIN;
}

export function corsHeaders(reqHeaders, env = process.env) {
  const origin = readOrigin(reqHeaders);
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (isAllowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function jsonHeaders(reqHeaders, env = process.env) {
  return { ...corsHeaders(reqHeaders, env), 'Content-Type': 'application/json' };
}

// Wide-open CORS for endpoints that are intentionally callable from any
// origin — e.g. the embedded scheduler.js widget injected onto every
// customer's published site (each on its own custom domain). These
// endpoints accept anonymous public input and rely on per-endpoint
// guards (rate limit, honeypot, validation) instead of an origin lock.
//
// Use `corsHeaders` / `jsonHeaders` for app-only endpoints that should
// be locked to our authenticated UI origins. Use these for the public
// widget surface only.
export const PUBLIC_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const PUBLIC_CORS_JSON = { ...PUBLIC_CORS, 'Content-Type': 'application/json' };
