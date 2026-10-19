/**
 * A business's social accounts, read off its own website — and, from the same
 * visit, its email and the owner's name when the site states them.
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

// ---------------------------------------------------------------------------
// Email and owner
// ---------------------------------------------------------------------------

const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
// Addresses that aren't the business's: placeholders, robots, and the
// website builder's or tracker's own.
const NOT_THEIRS_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|abuse|example|test|user|username|name|email|your(name|email)?|someone|john\.?doe|jane\.?doe)$/i;
const NOT_THEIRS_DOMAIN = [
  'example.com', 'example.org', 'domain.com', 'yourdomain.com', 'email.com', 'mysite.com', 'company.com',
  'sentry.io', 'wixpress.com', 'wix.com', 'squarespace.com', 'godaddy.com', 'secureserver.net', 'shopify.com',
  'wordpress.com', 'weebly.com', 'jimdo.com', 'duda.co', 'yext.com', 'sentry-next.wixpress.com', 'gstatic.com',
  'googleusercontent.com', 'cloudflare.com', 'w3.org', 'schema.org',
];
const FREE_MAIL = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'me.com'];

const textOf = (html) => html
  .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#64;|&commat;/gi, '@').replace(/&#46;/g, '.').replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ');

function cleanEmail(raw) {
  const e = String(raw || '').trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/\.+$/, '');
  let decoded = e;
  try { decoded = decodeURIComponent(e); } catch { /* keep as is */ }
  const m = decoded.match(/^[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,24})$/);
  if (!m) return null;
  const [local] = decoded.split('@');
  const domain = m[1];
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(domain)) return null;
  if (NOT_THEIRS_LOCAL.test(local)) return null;
  if (NOT_THEIRS_DOMAIN.some((d) => domain === d || domain.endsWith(`.${d}`))) return null;
  return decoded;
}

function jsonLdBlocks(html) {
  const out = [];
  const rx = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = rx.exec(html); m; m = rx.exec(html)) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* skip */ }
  }
  return out;
}

function walkJson(v, fn) {
  if (Array.isArray(v)) v.forEach((x) => walkJson(x, fn));
  else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) { fn(k, val); walkJson(val, fn); }
  }
}

const hostRoot = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

/**
 * The business's email off a page: mailto links, JSON-LD `email`, then any
 * address in the visible text. One on the site's own domain wins, then a
 * free-mail one (most shops use Gmail), then whatever else is left.
 */
export function extractEmail(html, siteHost = '') {
  if (!html) return null;
  const found = [];
  const add = (e) => { const c = cleanEmail(e); if (c && !found.includes(c)) found.push(c); };
  const mailto = /href\s*=\s*["']?mailto:([^"'\s>]+)/gi;
  for (let m = mailto.exec(html); m; m = mailto.exec(html)) add(m[1]);
  for (const block of jsonLdBlocks(html)) {
    walkJson(block, (k, val) => { if (k === 'email' && typeof val === 'string') add(val); });
  }
  for (const m of textOf(html).matchAll(EMAIL_RX)) add(m[0]);
  if (!found.length) return null;
  const root = hostRoot(siteHost);
  const rank = (e) => {
    const d = e.split('@')[1];
    if (root && (d === root || root.endsWith(`.${d}`) || d.endsWith(`.${root}`))) return 0;
    return FREE_MAIL.includes(d) ? 1 : 2;
  };
  return [...found].sort((a, b) => rank(a) - rank(b))[0];
}

// Words that make a "name" a business, a role or a sentence, not a person.
const NOT_A_PERSON = /\b(llc|inc|corp|co|company|auto|autos|automotive|detail|detailing|wash|tint|tinting|shop|services?|group|team|motors?|repair|center|centre|garage|the|and|of|our|us|we|you|your|florida|puerto|rico|miami|orlando|tampa|customer|customers|owner|owners|family|club|staff|management|department|office|sales|support|contact|about|home|welcome|since|years?|professional|certified|quality|best|mobile|call|today|now|here|more|free|get|book|text|visit|click|read|learn|open|hours|phone|tel|email|info|and)\b/i;

/** A real person's name: two to four capitalised words, nothing else. */
export function isPersonName(s) {
  const name = String(s || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 40 || /\d|@|\//.test(name)) return false;
  const words = name.split(' ');
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((w) => /^\p{Lu}[\p{L}'’.-]*$/u.test(w))) return false;
  return !NOT_A_PERSON.test(name);
}

// Case-insensitive for the label; isPersonName checks the capitals after.
const OWNER_TEXT = /\b(?:owner|owned by|owner\/operator|founder|founded by|co-founder|propietari[oa]|dueñ[oa]|fundador[a]?)\s*[:\-–—,]?\s*(\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+){1,3})/giu;

/**
 * The owner's name, only where the site states it: JSON-LD `founder`,
 * `employee` or `owner` as a person, or "Owner: …" / "Dueño: …" in the text.
 * Null unless it reads as a person.
 */
export function extractOwnerName(html) {
  if (!html) return null;
  const candidates = [];
  for (const block of jsonLdBlocks(html)) {
    walkJson(block, (k, val) => {
      if (!['founder', 'founders', 'employee', 'employees', 'owner'].includes(k)) return;
      for (const v of [].concat(val)) {
        if (typeof v === 'string') candidates.push(v);
        else if (v && typeof v === 'object' && /person/i.test(String(v['@type'] || 'Person')) && typeof v.name === 'string') candidates.push(v.name);
      }
    });
  }
  for (const m of textOf(html).matchAll(OWNER_TEXT)) candidates.push(m[1]);
  // "Owner: John Smith Call Today" — try the name shortened from the end too.
  for (const c of candidates) {
    const words = c.trim().split(/\s+/);
    for (let n = Math.min(words.length, 4); n >= 2; n -= 1) {
      const name = words.slice(0, n).join(' ');
      if (isPersonName(name)) return name;
    }
  }
  return null;
}

const CONTACT_LINK = /(contact|contacto|contactanos|contactenos|about|nosotros|quienes-somos|our-team|meet)/i;

/** The site's contact or about page, if the homepage links one on the same host. */
export function contactPageUrl(html, base) {
  let baseUrl;
  try { baseUrl = new URL(base); } catch { return null; }
  const rx = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (let m = rx.exec(html || ''); m; m = rx.exec(html || '')) {
    const href = decode(m[1] ?? m[2] ?? m[3]);
    if (!CONTACT_LINK.test(href)) continue;
    try {
      const u = new URL(href, baseUrl);
      if (/^https?:$/.test(u.protocol) && hostRoot(u.hostname) === hostRoot(baseUrl.hostname)
        && u.pathname !== baseUrl.pathname) return u.toString();
    } catch { /* skip */ }
  }
  return null;
}

const MAX_BODY = 1_500_000;

async function getHtml(fetchImpl, url, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AutoCareGeniusBot/1.0; +https://autocaregenius.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res?.ok || typeof res.text !== 'function') return null;
    const type = res.headers?.get?.('content-type') || '';
    if (type && !/html|xml|text\/plain/i.test(type)) return null;
    return (await res.text()).slice(0, MAX_BODY);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const NOTHING = { socials: {}, email: null, ownerName: null, ok: false };

/**
 * What a business's website says about it: its socials, its email and its
 * owner's name. The website itself when it is a social page (nothing else to
 * read there), else its homepage, plus its contact or about page when the
 * homepage left the email or the owner unknown — two requests at most.
 * Never throws: a site that is down, slow or not HTML gives nothing, and `ok`
 * says whether the homepage was actually read.
 */
export async function fetchSocials({ fetchImpl = fetch, website, timeoutMs = 6000 }) {
  const own = socialsFromWebsite(website);
  if (Object.keys(own).length) return { socials: own, email: null, ownerName: null, ok: true };
  let url;
  try {
    url = new URL(website);
    if (!/^https?:$/.test(url.protocol)) return NOTHING;
  } catch {
    return NOTHING;
  }
  try {
    const html = await getHtml(fetchImpl, url.toString(), timeoutMs);
    if (html == null) return NOTHING;
    const socials = extractSocials(html);
    let email = extractEmail(html, url.hostname);
    let ownerName = extractOwnerName(html);
    const more = (!email || !ownerName) && contactPageUrl(html, url.toString());
    if (more) {
      const page = await getHtml(fetchImpl, more, timeoutMs);
      if (page) {
        email ||= extractEmail(page, url.hostname);
        ownerName ||= extractOwnerName(page);
        for (const [k, v] of Object.entries(extractSocials(page))) socials[k] ||= v;
      }
    }
    return { socials, email, ownerName, ok: true };
  } catch {
    return NOTHING;
  }
}
