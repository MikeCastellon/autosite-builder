/**
 * A business's social accounts, read off its own website.
 *
 * Google Places has no field for them, so after a scan the business's
 * homepage is fetched once and every link to a known network is kept: anchor
 * hrefs, and the `sameAs` list a site's JSON-LD carries. Links that only look
 * like an account — a share button, a pixel, a single post, the website
 * builder's own page in a template footer — are thrown out, so what is left
 * is the shop's own page on each network.
 *
 * One GET per site, a short timeout, and a capped body: a dead or slow site
 * costs a few seconds, never the scan. Kept in step with the copy in the
 * Genius Routes prospect scanner (netlify/functions/_lib/socialLinks.js).
 */

/** The networks we keep, in the order they're shown. */
export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'yelp'];

// A first path segment that is a network's feature, never an account.
const RESERVED = {
  facebook: new Set([
    'sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php',
    'l.php', 'privacy', 'policies', 'policy.php', 'help', 'groups', 'events', 'hashtag', 'watch',
    'photo.php', 'photo', 'photos', 'story.php', 'permalink.php', 'home.php', 'business', 'ads',
    'legal', 'terms', 'about', 'settings', 'search', 'marketplace', 'gaming', 'reel', 'reels',
    'video.php', 'videos', 'media', 'notes', 'messages', 'v2.0', 'v3.0', 'pg',
  ]),
  instagram: new Set([
    'p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'direct', 'about', 'legal',
    'developer', 'embed.js', 'static',
  ]),
  x: new Set([
    'intent', 'share', 'home', 'search', 'hashtag', 'i', 'widgets.js', 'privacy', 'tos', 'login',
    'signup', 'explore', 'settings', 'messages', 'notifications',
  ]),
};

// The website builders' own accounts, which template footers link to before
// the owner fills in theirs. Matched as the account name on any network.
const PLACEHOLDERS = new Set([
  'wix', 'wixcom', 'squarespace', 'godaddy', 'weebly', 'shopify', 'wordpress', 'wordpressdotcom',
  'duda', 'dudamobile', 'jimdo', 'webflow', 'yourpage', 'yourusername', 'username', 'yourname',
  'facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'linkedin', 'yelp', 'pages', 'profile',
]);

function hostOf(u) {
  return u.hostname.toLowerCase().replace(/^(www|m|mobile|web|business|touch)\./, '');
}

function segments(u) {
  return u.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
}

function ok(name) {
  return Boolean(name) && !PLACEHOLDERS.has(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/**
 * A link, as { network, url } when it is a business's own account page, with
 * the url tidied to one canonical form — else null.
 */
export function socialFromUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u;
  try {
    u = new URL(raw.trim().replace(/^\/\//, 'https://'));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = hostOf(u);
  const seg = segments(u);
  const first = (seg[0] || '').toLowerCase();

  if (host === 'facebook.com' || host === 'fb.com') {
    if (first === 'profile.php') {
      const id = u.searchParams.get('id');
      return /^\d+$/.test(id || '') ? { network: 'facebook', url: `https://www.facebook.com/profile.php?id=${id}` } : null;
    }
    if (!first || RESERVED.facebook.has(first)) return null;
    // /pages/Shop-Name/1234 and /p/Shop-Name-1234 are pages too.
    if (first === 'pages' || first === 'p') {
      return seg.length >= 2 ? { network: 'facebook', url: `https://www.facebook.com/${seg.slice(0, 3).join('/')}` } : null;
    }
    if (!/^[\w.\-]+$/.test(seg[0]) || !ok(seg[0])) return null;
    return { network: 'facebook', url: `https://www.facebook.com/${seg[0]}` };
  }

  if (host === 'instagram.com' || host === 'instagr.am') {
    if (!first || RESERVED.instagram.has(first) || !/^[\w.]{1,30}$/.test(seg[0]) || !ok(seg[0])) return null;
    return { network: 'instagram', url: `https://www.instagram.com/${seg[0]}` };
  }

  if (host === 'tiktok.com') {
    const m = /^@([\w.]{2,24})$/.exec(seg[0] || '');
    return m && ok(m[1]) ? { network: 'tiktok', url: `https://www.tiktok.com/@${m[1]}` } : null;
  }

  if (host === 'youtube.com') {
    if (/^@[\w.\-]{3,30}$/.test(seg[0] || '') && ok(seg[0].slice(1))) {
      return { network: 'youtube', url: `https://www.youtube.com/${seg[0]}` };
    }
    if (['channel', 'c', 'user'].includes(first) && seg[1] && ok(seg[1])) {
      return { network: 'youtube', url: `https://www.youtube.com/${first}/${seg[1]}` };
    }
    return null;
  }

  if (host === 'twitter.com' || host === 'x.com') {
    if (!first || RESERVED.x.has(first) || !/^\w{1,15}$/.test(seg[0]) || !ok(seg[0])) return null;
    return { network: 'x', url: `https://x.com/${seg[0]}` };
  }

  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    if (['company', 'in', 'showcase'].includes(first) && seg[1] && ok(seg[1])) {
      return { network: 'linkedin', url: `https://www.linkedin.com/${first}/${seg[1]}` };
    }
    return null;
  }

  if (host === 'yelp.com' || /^yelp\.[a-z.]+$/.test(host)) {
    if (first === 'biz' && /^[\w\-%]+$/.test(seg[1] || '')) {
      return { network: 'yelp', url: `https://www.yelp.com/biz/${seg[1]}` };
    }
    return null;
  }

  return null;
}

/** The website itself, when what Google calls the website is a social page. */
export function socialsFromWebsite(website) {
  const hit = socialFromUrl(website);
  return hit ? { [hit.network]: hit.url } : {};
}

const decode = (s) => s
  .replace(/&amp;/gi, '&').replace(/&#x2F;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/gi, '"');

function sameAsLinks(html) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (k === 'sameAs') out.push(...[].concat(val).filter((x) => typeof x === 'string'));
        else walk(val);
      }
    }
  };
  const rx = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = rx.exec(html); m; m = rx.exec(html)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* a broken block says nothing */ }
  }
  return out;
}

/**
 * Every network's account linked from a page: { facebook: url, ... }. The
 * first link to a network wins — a header or footer icon comes before a
 * mention in a blog post.
 */
export function extractSocials(html) {
  const found = {};
  if (!html) return found;
  const hrefs = [];
  const rx = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (let m = rx.exec(html); m; m = rx.exec(html)) hrefs.push(decode(m[1] ?? m[2] ?? m[3]));
  for (const link of [...sameAsLinks(html), ...hrefs]) {
    const hit = socialFromUrl(link);
    if (hit && !found[hit.network]) found[hit.network] = hit.url;
  }
  return found;
}

const MAX_BODY = 1_500_000;

/**
 * A business's socials: the website itself when it is a social page, else
 * whatever its homepage links to. Never throws — a site that is down, slow or
 * not HTML gives {} — so `ok` says whether the page was actually read.
 */
export async function fetchSocials({ fetchImpl = fetch, website, timeoutMs = 6000 }) {
  const own = socialsFromWebsite(website);
  if (Object.keys(own).length) return { socials: own, ok: true };
  let url;
  try {
    url = new URL(website);
    if (!/^https?:$/.test(url.protocol)) return { socials: {}, ok: false };
  } catch {
    return { socials: {}, ok: false };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url.toString(), {
      redirect: 'follow',
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AutoCareGeniusBot/1.0; +https://autocaregenius.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res?.ok || typeof res.text !== 'function') return { socials: {}, ok: false };
    const type = res.headers?.get?.('content-type') || '';
    if (type && !/html|xml|text\/plain/i.test(type)) return { socials: {}, ok: false };
    const html = (await res.text()).slice(0, MAX_BODY);
    return { socials: extractSocials(html), ok: true };
  } catch {
    return { socials: {}, ok: false };
  } finally {
    clearTimeout(timer);
  }
}
