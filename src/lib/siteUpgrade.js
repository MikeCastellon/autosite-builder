// Admin > Site upgrades (SiteUpgradesTab): the checks an admin's republish
// of an owner's live site must pass. After PR #10 ships, admins republish
// every live website with the new template designs; a site goes out only
// when nothing the owner put on their live page would go missing and the
// saved draft still looks like what is live. Anything doubtful is flagged
// for a personal check instead.
//
// Pure and import-free: the browser tab and the admin-site-upgrade
// function both use it (the function for widgetScripts / html checks).

// The release day of the new designs. Set to the day PR #10 is merged and
// deployed. A site whose published_at is on or after it shows "New design
// live" on the owner's dashboard. (published_at is only written by code
// that ships with the new designs, so this is a second guard.)
export const SITE_UPGRADE_RELEASE_DATE = '2026-10-02';

// exportHtml bakes window.location.origin into the published page's widget
// script URLs (scheduler.js, contact-form.js), so a page built anywhere
// else (deploy preview, localhost) would point live sites at that host.
export const PRODUCTION_APP_ORIGIN = 'https://sitebuilder.autocaregenius.com';

// Sites an admin must handle by hand, from the impact analysis:
// { siteId, reason }. Always flagged, never bulk-published.
export const UPGRADE_MANUAL_SKIP = Object.freeze([]);

// Legacy templates whose live (pre-upgrade) version ignored the owner's
// palette, so the colors heuristic in eligibility() can't apply to them.
const LEGACY_FIXED_PALETTE = new Set(['wheel_apex']);

// Mirror of netlify/functions/_shared/slug.js (siteUpgrade.test.js keeps
// them in step); this module stays import-free.
const SLUG_RE = /^[a-z0-9-]{1,63}$/;
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'book', 'booking', 'dashboard',
  'sitebuilder', 'support', 'help', 'status', 'cdn', 'assets', 'static',
]);
export function slugProblem(slug) {
  if (!slug) return 'missing';
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return 'invalid';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

// True when the site was published with the new designs.
export function isUpgradedSite(site, releaseDate = SITE_UPGRADE_RELEASE_DATE) {
  const at = Date.parse(site?.published_at || '');
  return Number.isFinite(at) && at >= Date.parse(`${releaseDate}T00:00:00Z`);
}

// How long the dashboard's "New design live" badge stays up after the
// release.
export const NEW_DESIGN_BADGE_DAYS = 60;

// The dashboard badge: a live website created before the release (it had
// an old design to replace) that is now on the new design, for the first
// NEW_DESIGN_BADGE_DAYS after the release. A site created later never had
// an old design, and after that window the badge would mean nothing.
// `site` needs published_url, site_type, created_at and published_at.
export function showNewDesignBadge(site, now = Date.now(), releaseDate = SITE_UPGRADE_RELEASE_DATE) {
  if (!site?.published_url || site.site_type === 'booking_only') return false;
  if (!isUpgradedSite(site, releaseDate)) return false;
  const release = Date.parse(`${releaseDate}T00:00:00Z`);
  const created = Date.parse(site.created_at || '');
  if (Number.isFinite(created) && created >= release) return false;
  return now < release + NEW_DESIGN_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

// ─── HTML reading ─────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™',
};

export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

// The text a visitor reads: no <head> (title, meta, JSON-LD repeat the
// phone and address on every page), scripts, styles or icons.
export function visibleText(html) {
  const s = String(html || '')
    .replace(/<head\b[\s\S]*?<\/head\s*>/i, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

// For "does the new page still say X": case, curly quotes, dash style and
// all whitespace ignored (templates split headings across elements).
export function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '');
}

function parseAttrs(attrText) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrText))) {
    const name = m[1].toLowerCase();
    if (name in out) continue;
    out[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

function tags(html, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>`, 'gi');
  return [...String(html || '').matchAll(re)].map((m) => parseAttrs(m[1]));
}

function originOf(src) {
  try { return new URL(src).origin; } catch { return null; }
}

// The site's widget <script>s (scheduler.js / contact-form.js), each with
// its data-site-id. exportHtml writes both on every published page.
export function widgetScripts(html) {
  return tags(html, 'script')
    .filter((a) => 'data-site-id' in a)
    .map((a) => {
      const src = a.src || '';
      const kind = /\/scheduler\.js(?:[?#]|$)/.test(src) ? 'scheduler'
        : /\/contact-form\.js(?:[?#]|$)/.test(src) ? 'contact'
        : 'other';
      return { kind, src, origin: originOf(src), siteId: a['data-site-id'], fullPage: a['data-full-page'] === 'true' };
    });
}

// Google reviews / Instagram widget mounts: [{ type, key }].
export function widgetMounts(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<[a-z][a-z0-9-]*\b([^>]*\bdata-widget-key\s*=[^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    if (a['data-widget-key']) out.push({ type: a['data-widget'] || '', key: a['data-widget-key'] });
  }
  return out;
}

function hrefs(html) {
  return tags(html, 'a').map((a) => (a.href || '').trim()).filter(Boolean);
}

// Every absolute URL anywhere in the markup (src, srcset, inline and
// <style> background images), without query or hash.
function urlsIn(html) {
  const out = new Set();
  for (const m of decodeEntities(String(html || '')).matchAll(/https?:\/\/[^\s"'<>()\\]+/gi)) {
    out.add(stripUrl(m[0]));
  }
  return out;
}

function stripUrl(u) {
  return String(u).replace(/[,;]+$/, '').split(/[?#]/)[0];
}

// Photos stored inside the page as data: URIs: older exports inlined the
// owner's uploads, and some live pages still carry them (urlsIn only sees
// http(s) URLs). Each is identified by a cheap signature (length and both
// ends of the base64). Small inline icons (under ~1.5 KB) are skipped.
const INLINE_IMAGE_RE = /data:image\/(?:jpeg|jpg|png|webp|gif|avif);base64,([A-Za-z0-9+/=]{2000,})/gi;

function inlineImages(html) {
  const out = new Set();
  for (const m of String(html || '').matchAll(INLINE_IMAGE_RE)) {
    const b = m[1];
    out.add(`${b.length}:${b.slice(0, 64)}:${b.slice(-64)}`);
  }
  return out;
}

// Uploads in Supabase Storage (site-images and older buckets).
function isStorageUrl(u) {
  return /\/storage\/v1\/(?:object|render\/image)\//.test(u);
}

function phoneDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.slice(-10);
}

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function phonesInText(text) {
  return new Set([...text.matchAll(PHONE_RE)].map((m) => `${m[1]}${m[2]}${m[3]}`));
}

function formatPhone(d) {
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function telLinks(html) {
  return new Set(hrefs(html).filter((h) => /^tel:/i.test(h)).map((h) => phoneDigits(h)).filter(Boolean));
}

function mailtoLinks(html) {
  return new Set(hrefs(html)
    .filter((h) => /^mailto:/i.test(h))
    .map((h) => {
      let addr = h.slice(7).split('?')[0];
      try { addr = decodeURIComponent(addr); } catch { /* keep as is */ }
      return addr.trim().toLowerCase();
    })
    .filter(Boolean));
}

const SOCIAL_HOSTS = [
  'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be',
  'twitter.com', 'x.com', 'linkedin.com', 'yelp.com', 'pinterest.com', 'threads.net',
  'snapchat.com', 'nextdoor.com',
];

function socialKey(href) {
  let u;
  try { u = new URL(href); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  if (!SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  const path = u.pathname.replace(/\/+$/, '').toLowerCase();
  return `${host}${path}`;
}

function socialLinks(html) {
  const out = new Map();
  for (const h of hrefs(html)) {
    const k = socialKey(h);
    if (k && !out.has(k)) out.set(k, h);
  }
  return out;
}

// ─── Owner data from the site row ─────────────────────────────────────

function splitList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return v.split(/[·,;|]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function draftCopy(site) {
  const { _images, _customColors, _customFonts, ...copy } = site?.generated_content || {};
  return copy;
}

function draftImages(site) {
  return site?.generated_content?._images || {};
}

// Owner-entered service / package names and prices, plus the service
// names in the copy (servicesSection.items).
function ownerServices(site) {
  const info = site?.business_info || {};
  const copy = draftCopy(site);
  const names = new Set();
  const prices = new Set();
  const items = [
    ...splitList(info.services),
    ...splitList(info.packages),
    ...(Array.isArray(copy.servicesSection?.items) ? copy.servicesSection.items : []),
  ];
  for (const item of items) {
    if (typeof item === 'string') { if (item.trim().length >= 3) names.add(item.trim()); continue; }
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || item.title || '').trim();
    if (name.length >= 3) names.add(name);
    const price = item.price == null ? '' : String(item.price).trim();
    if (!price) continue;
    // Compare the $ amounts only: templates differ in "From $99" vs "$99".
    const amounts = price.match(/\$\s*\d[\d,]*(?:\.\d+)?/g)
      || (/^[\d.]/.test(price) ? [`$${price.match(/^[\d.,]+/)[0]}`] : null);
    for (const a of amounts || []) prices.add(a.replace(/[\s,]/g, ''));
  }
  return { names: [...names], prices: [...prices] };
}

function pricesInText(text) {
  return new Set([...text.matchAll(/\$\s*\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/[\s,]/g, '')));
}

// business_info fields the free-text check leaves alone: checked on their
// own above (name, address, city, phone, email, services), shown
// reformatted by every template (hours, state), or not page text at all.
const OWNER_TEXT_SKIP = new Set([
  'businessName', 'address', 'city', 'state', 'zip', 'phone', 'email', 'services', 'packages', 'hours',
  'reviewSource', 'businessType', 'logo', 'website',
]);
// Social handles and links: the social-link check covers them.
const SOCIAL_FIELD_RE = /^(instagram|facebook|tiktok|youtube|twitter|x|linkedin|yelp|pinterest|threads|snapchat|nextdoor|google\w*)$/i;
const LINKISH_RE = /^@|https?:\/\/|\bwww\.|\.(?:com|net|org|co|io|us|biz)(?:\/|$)/i;

// The owner's free text (tagline, specialties, service area, warranty,
// brands, certifications, awards...): [{ key, value }], 12+ characters.
function ownerFreeText(site) {
  const out = [];
  for (const [key, v] of Object.entries(site?.business_info || {})) {
    if (OWNER_TEXT_SKIP.has(key) || SOCIAL_FIELD_RE.test(key) || typeof v !== 'string') continue;
    const value = v.trim();
    if (value.length < 12 || LINKISH_RE.test(value)) continue;
    out.push({ key, value });
  }
  return out;
}

// ─── Content check ────────────────────────────────────────────────────

// Labels the new designs drop on purpose (CLAUDE.md "No invented facts"),
// and the old editor placeholders that leaked onto some live pages.
const INTENDED_REMOVALS = [
  { kind: 'verified-label', label: '"Verified" customer/review label', re: /\bverified\s+(?:customer|client|buyer|review|owner)s?\b/i },
  { kind: 'real-reviews', label: '"Real reviews" label', re: /\breal\s+(?:customer\s+)?reviews?\b/i },
  { kind: 'star-row', label: 'Star rating row (★★★★★)', re: /[★⭐]{3,}/ },
  { kind: 'rating-claim', label: 'Rating claim ("5.0 stars", "5★ avg rating", "5-star rated")', re: /\b[45](?:\.\d)?\s*-?\s*(?:stars?\b|★)|\b5[\s-]*star\s+(?:rated|service|reviews?)\b/i },
  { kind: 'open-now', label: '"Open now" status', re: /\bopen\s+now\b/i },
  { kind: 'stat-claim', label: 'Invented stat ("500+ cars", "1,000+ vehicles")', re: /\b\d{1,3}(?:,\d{3})*\+\s*(?:cars|vehicles|customers|clients|jobs|details|happy|satisfied|reviews|projects)\b/i },
  { kind: 'percent-claim', label: 'Invented percentage ("100% satisfaction")', re: /\b100\s*%\s*(?:satisf|guarant|customer|happy|quality)/i },
  { kind: 'satisfaction-claim', label: '"Satisfaction rate / guaranteed" claim', re: /\bsatisfaction\s+(?:rate|guarantee[d]?)\b/i },
  { kind: 'editor-placeholder', label: 'Editor placeholder ("Upload a photo", "Images tab")', re: /\bupload\s+(?:a|your)\s+(?:photo|image|logo)\b|\bimages\s+tab\b|\badd\s+your\s+(?:photo|logo|image)s?\b/i },
];

// What owner content on the live page would be missing from the new page.
// Returns { regressions, intended, live, ok }:
//   regressions — owner content the new page lost; any one flags the site
//   intended    — fabricated claims / placeholders the new designs drop on purpose
//   live        — facts about the live page eligibility() uses
// `appOrigin` is where the new page's widget scripts must point.
export function checkUpgradedContent(liveHtml, newHtml, site, { appOrigin = PRODUCTION_APP_ORIGIN } = {}) {
  const regressions = [];
  const intended = [];
  const add = (kind, label, value) => regressions.push(value === undefined ? { kind, label } : { kind, label, value });

  const liveText = visibleText(liveHtml);
  const newText = visibleText(newHtml);
  const liveNorm = normText(liveText);
  const newNorm = normText(newText);
  const keptText = (s) => newNorm.includes(normText(s));
  const wasShown = (s) => !!normText(s) && liveNorm.includes(normText(s));
  const info = site?.business_info || {};

  // Business name, street address, city.
  for (const [kind, label, value] of [
    ['business-name', 'Business name', info.businessName],
    ['address', 'Street address', info.address],
    ['city', 'City', info.city],
  ]) {
    const v = String(value || '').trim();
    if (v && wasShown(v) && !keptText(v)) add(kind, `${label} "${v}" is missing`, v);
  }

  // The owner's other free text. A list the new design shows item by item
  // ("XPEL, LLumar, 3M" as chips) still counts as kept.
  for (const { key, value } of ownerFreeText(site)) {
    if (!wasShown(value) || keptText(value)) continue;
    const pieces = value.split(/[,;|·•\n]+/).map((s) => s.trim()).filter((s) => normText(s).length >= 3);
    if (pieces.length > 1 && pieces.every(keptText)) continue;
    const short = value.length > 80 ? `${value.slice(0, 77)}…` : value;
    add('owner-text', `Owner text (${key}) "${short}" is missing`, value);
  }

  // Phone numbers (text or call links) and call links.
  const liveTel = telLinks(liveHtml);
  const newTel = telLinks(newHtml);
  const livePhones = new Set([...phonesInText(liveText), ...liveTel]);
  const newPhones = new Set([...phonesInText(newText), ...newTel]);
  for (const d of livePhones) {
    if (!newPhones.has(d)) add('phone', `Phone number ${formatPhone(d)} is missing`, d);
    else if (liveTel.has(d) && !newTel.has(d)) add('call-link', `Tap-to-call link for ${formatPhone(d)} is missing`, d);
  }

  // Email addresses (text or mailto links) and mailto links.
  const liveMail = mailtoLinks(liveHtml);
  const newMail = mailtoLinks(newHtml);
  const liveEmails = new Set([...(liveText.match(EMAIL_RE) || []).map((e) => e.toLowerCase()), ...liveMail]);
  const newEmails = new Set([...(newText.match(EMAIL_RE) || []).map((e) => e.toLowerCase()), ...newMail]);
  for (const e of liveEmails) {
    if (!newEmails.has(e)) add('email', `Email address ${e} is missing`, e);
    else if (liveMail.has(e) && !newMail.has(e)) add('email-link', `Email link for ${e} is missing`, e);
  }

  // Service names and prices the owner entered.
  const { names, prices } = ownerServices(site);
  for (const name of names) {
    if (wasShown(name) && !keptText(name)) add('service', `Service "${name}" is missing`, name);
  }
  const livePrices = pricesInText(liveText);
  const newPrices = pricesInText(newText);
  for (const p of prices) {
    if (livePrices.has(p) && !newPrices.has(p)) add('price', `Price ${p} is missing`, p);
  }

  // Photos: owner uploads (Storage) and every image URL the draft holds.
  const draftUrls = new Set(Object.values(draftImages(site))
    .filter((v) => typeof v === 'string' && /^https?:\/\//i.test(v))
    .map(stripUrl));
  const liveUrls = urlsIn(liveHtml);
  const newUrls = urlsIn(newHtml);
  const liveOwnerImages = [...liveUrls].filter((u) => isStorageUrl(u) || draftUrls.has(u));
  for (const u of liveOwnerImages) {
    if (!newUrls.has(u)) add('image', `Photo ${u.split('/').pop()} is missing`, u);
  }
  // Photos stored inside the live page (data: URIs), which no draft URL
  // can match: each must be on the new page too.
  const liveInline = inlineImages(liveHtml);
  const newInline = inlineImages(newHtml);
  const inlineMissing = [...liveInline].filter((sig) => !newInline.has(sig)).length;
  if (inlineMissing) {
    add('inline-image', `${inlineMissing} photo(s) stored inside the live page ${inlineMissing === 1 ? 'is' : 'are'} missing`, inlineMissing);
  }

  // Social profile links.
  const newSocial = socialLinks(newHtml);
  for (const [key, href] of socialLinks(liveHtml)) {
    if (!newSocial.has(key)) add('social', `Social link ${href} is missing`, href);
  }

  // Booking / contact widgets: the new page needs both, for this site, from
  // the app the live page will load them from.
  const liveScripts = widgetScripts(liveHtml);
  const newScripts = widgetScripts(newHtml);
  const siteId = site?.id;
  for (const kind of ['scheduler', 'contact']) {
    const hasNew = newScripts.some((s) => s.kind === kind && s.siteId === siteId);
    if (!hasNew) {
      const was = liveScripts.some((s) => s.kind === kind);
      add(`${kind}-script`, `${kind === 'scheduler' ? 'Booking widget' : 'Contact form'} script for this site is missing${was ? '' : ' (also missing on the live page)'}`);
    }
  }
  for (const s of newScripts) {
    if (s.siteId !== siteId) add('site-id', `New page loads a widget for another site (${s.siteId})`, s.siteId);
    if (s.origin !== appOrigin) add('widget-origin', `Widget script points at ${s.origin || s.src || 'nowhere'} instead of ${appOrigin}`, s.src);
  }

  // Google reviews / Instagram widgets.
  const newKeys = new Set(widgetMounts(newHtml).map((w) => w.key));
  for (const w of widgetMounts(liveHtml)) {
    if (!newKeys.has(w.key)) add('widget', `${w.type === 'instagram-feed' ? 'Instagram feed' : w.type === 'google-reviews' ? 'Google reviews' : 'Widget'} (key ${w.key}) is missing`, w.key);
  }
  const widgetsJs = (h) => /social-feeds-app\.netlify\.app\/widgets\.js/.test(String(h || ''));
  if (widgetsJs(liveHtml) && !widgetsJs(newHtml)) add('widgets-script', 'Google reviews / Instagram widget script is missing');

  // Dropped on purpose.
  for (const p of INTENDED_REMOVALS) {
    const m = liveText.match(p.re);
    if (m && !p.re.test(newText)) intended.push({ kind: p.kind, label: p.label, example: m[0] });
  }

  return {
    regressions,
    intended,
    live: {
      siteIds: [...new Set(liveScripts.map((s) => s.siteId))],
      ownerImages: liveOwnerImages,
      inlineImages: liveInline.size,
      inlineImagesMissing: inlineMissing,
    },
    ok: regressions.length === 0,
  };
}

// ─── Eligibility ──────────────────────────────────────────────────────

function hexes(colors) {
  return ['bg', 'accent']
    .map((k) => colors?.[k])
    .filter((v) => typeof v === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(v))
    .map((v) => v.toLowerCase());
}

// Can this site be republished by an admin without a personal check?
//   site         — the sites row, with generated_content loaded
//   liveHtml     — its live page (null when missing / unreadable)
//   checkResult  — checkUpgradedContent(liveHtml, newHtml, site)
//   ownerProfile — the owner's profiles row (their plan decides the
//                  "Powered by" bar), null when it could not be read
//   ctx          — { sharedSlug, liveTooLarge, renderCopy (copy after the
//                  owner's widget keys), draftColors (templateMeta.colors),
//                  templateKnown, hold (admin-site-upgrade's hold marker),
//                  manualSkip (defaults to UPGRADE_MANUAL_SKIP) }
// Returns { status: 'ready' | 'flagged', reasons: [{ code, text }] };
// nextStep(code) says what an admin does about each.
export function eligibility(site, liveHtml, checkResult, ownerProfile, ctx = {}) {
  const reasons = [];
  const flag = (code, text) => reasons.push({ code, text });

  const skip = (ctx.manualSkip || UPGRADE_MANUAL_SKIP).find((s) => s.siteId === site?.id);
  if (skip) flag('manual_skip', `On the manual check list: ${skip.reason || 'no reason given'}`);

  if (ctx.hold?.held) {
    const when = String(ctx.hold.at || '').slice(0, 10) || 'an earlier check';
    const why = ctx.hold.reason === 'restored'
      ? `an admin put the previous page back (backup ${ctx.hold.backupId || 'unknown'})`
      : (ctx.hold.note ? String(ctx.hold.note).slice(0, 200) : 'put on hold by an admin');
    flag('on_hold', `On hold since ${when}: ${why}`);
  }

  if (site?.site_type === 'booking_only') flag('booking_only', 'Booking-only page: handled separately, not part of the website upgrade');
  if (!site?.published_url) flag('not_live', 'Not published');

  const slugIssue = slugProblem(site?.slug);
  if (slugIssue === 'missing') flag('no_slug', 'Has no web address (slug)');
  else if (slugIssue === 'invalid') flag('invalid_slug', `Web address "${site.slug}" is not a valid slug`);
  else if (slugIssue === 'reserved') flag('reserved_slug', `Web address "${site.slug}" is reserved`);
  if (ctx.sharedSlug) flag('shared_slug', `Another site also holds "${site?.slug}": publishing could overwrite the wrong page`);

  if (site?.custom_domain && site.custom_domain_status !== 'active_ssl') {
    flag('custom_domain_pending', `Custom domain ${site.custom_domain} is not active (${site.custom_domain_status || 'no status'})`);
  }

  if (!ownerProfile) flag('owner_unknown', 'Owner profile could not be read, so their plan (and the "Powered by" bar) is unknown');

  if (ctx.liveTooLarge) flag('live_too_large', 'Live page is too large to compare: it stores photos inside the page, which the saved draft may not have');
  else if (!liveHtml) flag('live_missing', 'No live page found in storage');

  // The saved draft vs what is live.
  const copy = draftCopy(site);
  const images = draftImages(site);
  const renderCopy = ctx.renderCopy || copy;
  if (!site?.template_id || ctx.templateKnown === false) flag('no_template', 'Draft has no known template');
  const hasCopy = !!String(copy.headline || '').trim()
    || !!String(copy.aboutText || '').trim()
    || (Array.isArray(copy.servicesSection?.items) && copy.servicesSection.items.length > 0);
  if (!hasCopy) flag('draft_empty', 'Draft copy is empty');

  const inline = Object.entries(images).filter(([, v]) => typeof v === 'string' && v.startsWith('data:image'));
  if (inline.length) flag('draft_inline_images', `Draft holds ${inline.length} old inline image(s) that must be uploaded first (owner Republish or the editor does it)`);

  if (liveHtml) {
    const liveNorm = normText(visibleText(liveHtml));
    const onLive = (s) => liveNorm.includes(normText(s));

    const draftUrls = new Set(Object.values(images).filter((v) => typeof v === 'string').map(stripUrl));
    const notInDraft = (checkResult?.live?.ownerImages || []).filter((u) => !draftUrls.has(u)).length
      + (checkResult?.live?.inlineImagesMissing || 0);
    if (notInDraft) flag('draft_missing_images', `Live page shows ${notInDraft} photo(s) the saved draft doesn't have`);

    const headline = String(copy.headline || '').trim();
    if (headline && !onLive(headline)) {
      flag('draft_copy_differs', 'Live page doesn\'t show the draft\'s headline: the draft changed since the last publish, or the live page came from another template');
    }

    // The draft's other copy must be what is live too. Text that is only on
    // the live page (reviews pasted in by hand, an older about text) is
    // nowhere in the row, so the new page would lose it without any
    // regression to point at. Testimonials only count when they render,
    // i.e. without a Google reviews widget.
    const differs = [];
    if (String(renderCopy.subheadline || '').trim() && !onLive(renderCopy.subheadline)) differs.push('subheadline');
    if (String(renderCopy.aboutText || '').trim() && !onLive(renderCopy.aboutText)) differs.push('about text');
    if (!renderCopy.googleWidgetKey) {
      const list = Array.isArray(renderCopy.testimonialPlaceholders) ? renderCopy.testimonialPlaceholders
        : Array.isArray(renderCopy.testimonials) ? renderCopy.testimonials : [];
      const quotes = list.map((t) => String((typeof t === 'string' ? t : t?.text) || '').trim()).filter(Boolean);
      if (quotes.some((q) => !onLive(q))) differs.push('testimonials');
    }
    if (differs.length) {
      flag('draft_text_differs', `Live page doesn't show the draft's ${differs.join(', ')}: the draft changed since the last publish, or the live page has text the draft doesn't (it would be replaced)`);
    }

    const colors = hexes(ctx.draftColors);
    if (colors.length && !LEGACY_FIXED_PALETTE.has(site?.template_id)) {
      const liveLower = String(liveHtml).toLowerCase();
      if (!colors.some((c) => liveLower.includes(c))) {
        flag('draft_colors_differ', 'Live page uses neither the draft\'s background nor accent color: the template or colors changed since the last publish');
      }
    }

    const others = (checkResult?.live?.siteIds || []).filter((id) => id !== site?.id);
    if (others.length) flag('live_other_site', `Live page belongs to another site (${others.join(', ')})`);
  }

  const widgetIds = Array.isArray(site?.widget_config_ids) ? site.widget_config_ids : [];
  if (widgetIds.length && !renderCopy.googleWidgetKey && !renderCopy.instagramWidgetKey) {
    flag('legacy_widgets', 'Uses the old widget section (widget_config_ids), which only the owner\'s own Republish can rebuild');
  }

  for (const r of checkResult?.regressions || []) flag('regression', r.label);

  return { status: reasons.length ? 'flagged' : 'ready', reasons };
}

// What an admin does about each reason. Flagged sites are never published
// from the tab: they go out through the owner's own Republish (or the
// admin's, impersonating them), which backs the old page up the first
// time; "Back up now" in the tab makes an extra copy first.
const OWNER_REPUBLISH = 'Ask the owner to open the site in the editor and click Republish (or do it while impersonating them)';
const COMPARE_THEN = `Compare both pages. If the new page is right, ${OWNER_REPUBLISH.charAt(0).toLowerCase()}${OWNER_REPUBLISH.slice(1)}; otherwise fix the draft in the editor first`;
export const NEXT_STEPS = Object.freeze({
  manual_skip: `Go through it with the owner. When they agree: ${OWNER_REPUBLISH}.`,
  on_hold: 'Fix what was wrong, then Release hold, check again and Republish.',
  booking_only: 'Nothing to do: booking pages keep their layout.',
  not_live: 'Nothing to do: the site is not published.',
  no_slug: `${OWNER_REPUBLISH}: publishing from the editor gives it a web address.`,
  invalid_slug: 'Give the site a valid web address in the database first (owner approval needed).',
  reserved_slug: 'Give the site another web address in the database first (owner approval needed).',
  shared_slug: 'Two sites hold this web address. Sort that out in the database before anything is published.',
  custom_domain_pending: 'Wait until the custom domain is connected (active_ssl), then check again.',
  owner_unknown: 'Check again. If it stays, look the owner up in Accounts.',
  live_too_large: `Back up now, then compare by hand. ${OWNER_REPUBLISH} once any photo stored in the old page is uploaded in the editor.`,
  live_missing: `Nothing is live to replace. ${OWNER_REPUBLISH} when they are ready.`,
  no_template: 'Ask the owner to pick a template in the editor, then Republish.',
  draft_empty: `${OWNER_REPUBLISH}; the editor writes the copy.`,
  draft_inline_images: `${OWNER_REPUBLISH}; that uploads the old images. Then check again.`,
  draft_missing_images: 'Add the missing photos in the editor (the owner, or you impersonating them), then check again.',
  draft_copy_differs: `${COMPARE_THEN}.`,
  draft_text_differs: `${COMPARE_THEN}. Text that is only on the live page (e.g. real reviews) must be added to the draft first.`,
  draft_colors_differ: `${COMPARE_THEN}.`,
  live_other_site: 'The live page belongs to another site. Sort out the web address before anything is published.',
  legacy_widgets: `${OWNER_REPUBLISH}; that rebuilds their widgets.`,
  regression: `${COMPARE_THEN}. If a template drops it on purpose (e.g. Redline hides a mobile business's street address), the owner decides.`,
  no_page: 'Open the site in the editor to see why the page does not build.',
});

export function nextStep(code) {
  return NEXT_STEPS[code] || null;
}
