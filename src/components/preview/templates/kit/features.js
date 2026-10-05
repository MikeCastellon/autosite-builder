// Pure logic behind the owner-editable feature blocks (Redline's hero price
// card, featured-service band, vehicle-makes band, footer builder, Google
// review stars), shared so every theme that offers a feature computes it the
// same way. No React and no browser globals; every helper tolerates whatever
// a saved row holds (missing keys, wrong types).
//
// Themes with live sites call these with opt-in arguments (heroCardModeOf(...,
// 'off'), featuredServiceOf({ automatic: false }), a footerSpec whose button
// is off), so a site that saved none of the new keys renders as before.
import { sectionTitle, footerColumnsOf } from './content.js';

const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const num = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

// Names compared loosely: case, spaces and punctuation ignored, so "Full
// Detail" in copy.heroServices still finds "full-detail" after an edit.
export const nameKey = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

// copy.heroCard: 'quote' = the price-picker card, 'list' = a compact price
// list, 'off' = no card. Anything else (absent, old values) -> the theme's
// default: 'quote' for Redline, 'off' for themes with live sites.
export const HERO_CARD_MODES = ['quote', 'list', 'off'];
export function heroCardModeOf(value, fallback = 'quote') {
  return HERO_CARD_MODES.includes(value) ? value : fallback;
}

// Prices that are text or long ("Call for quote", "$150/$200/$250",
// "Starting at $1,299"): the package card sets them smaller, the price card
// gives them their own line under the package name.
export const cardPriceLong = (p) => !/\d/.test(p) || p.length > 9 || p.includes('/');
export const optPriceLong = (p) => cardPriceLong(p) || p.length > 7 || /\s/.test(p);

// The hero card's packages. `services`: [{ name, price, summary }] as trimmed
// strings, in the page's order. The owner's picks (copy.heroServices, up to
// four, matched by name, so a renamed or deleted package simply drops out),
// else the first three named packages whose price holds a number. The price
// card ('quote') offers only priced picks (never "Your Price" without a
// price); the list card shows any named pick, and without a priced package
// it lists the first three named ones (editor heroServices.js
// defaultHeroPicks). -> { mode, picks, listPicks, hasCard }
export function heroOfferOf({ services, heroServices, mode } = {}) {
  const all = list(services);
  const ownPicks = [];
  for (const n of list(heroServices)) {
    const key = nameKey(n);
    const s = key ? all.find((x) => nameKey(x.name) === key) : null;
    if (s && !ownPicks.includes(s)) ownPicks.push(s);
    if (ownPicks.length === 4) break;
  }
  const priced = (s) => /\d/.test(s.price);
  const autoPicks = all.filter((s) => s.name && priced(s)).slice(0, 3);
  const heroPicks = ownPicks.length ? ownPicks
    : autoPicks.length || mode !== 'list' ? autoPicks : all.filter((s) => s.name).slice(0, 3);
  const picks = mode === 'quote' ? heroPicks.filter(priced).slice(0, 4) : [];
  const listPicks = mode === 'list' ? heroPicks.filter((s) => s.name).slice(0, 4) : [];
  return { mode, picks, listPicks, hasCard: picks.length > 0 || listPicks.length > 0 };
}

// The featured-service band (copy.featuredService { serviceName, priceFrom,
// bullets, buttonText, buttonUrl }). `services`: [{ name, price, summary,
// description, includes: [{ text, heading }] }]. The band features the
// owner's chosen name; with `automatic` (Redline) and no choice, the first
// ceramic / coating package. Without `automatic` (themes with live sites) no
// choice means no band. Bullets: the owner's own, else the matched package's
// included items; without bullets its summary / description is the intro.
// `defaults` = the template's headingDefaults().featured ({ title, accent }).
// -> null or { name, priceFrom, price, bullets, eyebrow, title, accent,
// intro, buttonText, buttonUrl }
export function featuredServiceOf({ featuredService, services, sectionTitles, defaults = {}, automatic = true } = {}) {
  const fs = featuredService && typeof featuredService === 'object' ? featuredService : {};
  const all = list(services);
  const fsName = str(fs.serviceName);
  if (!fsName && !automatic) return null;
  const fsMatch = fsName
    ? all.find((s) => nameKey(s.name) === nameKey(fsName))
    : all.find((s) => /ceramic|coating/i.test(s.name));
  if (!fsName && !fsMatch) return null;
  const fName = fsName || fsMatch.name;
  const ownBullets = list(fs.bullets).map(str).filter(Boolean);
  const bullets = ownBullets.length
    ? ownBullets
    : (fsMatch?.includes || []).filter((i) => !i.heading).map((i) => i.text);
  const ft = sectionTitle(sectionTitles, 'featured');
  const d = defaults && typeof defaults === 'object' ? defaults : {};
  // Without bullets the matched service's own summary / description says
  // what it is (an AI service item often has nothing else).
  const intro = ft.intro || (bullets.length ? '' : fsMatch?.summary || fsMatch?.description || '');
  return {
    name: fName,
    priceFrom: str(fs.priceFrom),
    price: fsMatch?.price || '',
    bullets,
    eyebrow: ft.eyebrow,
    title: ft.title || d.title,
    accent: ft.accent || d.accent,
    intro,
    buttonText: str(fs.buttonText) || `Book ${fName}`,
    buttonUrl: str(fs.buttonUrl),
  };
}

// A band with only a heading and a button repeats the package grid: the
// published page skips it (the editor keeps it, with a hint).
export function featuredHasBody(featured, image) {
  return Boolean(featured) && Boolean(image || featured.priceFrom || featured.price || featured.bullets.length || featured.intro);
}

// The featured band's default heading for a service name (headingDefaults):
// protective services read "Protect Your Vehicle With X", others "Ask About
// Our X"; the name is the accent while the owner typed no title of their own.
export function featuredTitleDefaults(name, hasOwnTitle) {
  const n = str(name);
  if (!n) return {};
  const protective = /ceramic|coating|protect|film|ppf|sealant|graphene|wax/i.test(n);
  return {
    title: protective ? `Protect Your Vehicle With ${n}` : `Ask About Our ${n}`,
    accent: hasOwnTitle ? '' : n,
  };
}

// The vehicle-makes band's default line for a business kind (businessKindOf).
export function makesEyebrowDefault(kind) {
  return /detail/.test(kind) || kind === 'car_wash' ? 'We Detail All Vehicle Makes & Models' : 'All Makes & Models Welcome';
}

// A short makes list is repeated inside each marquee copy so the moving row
// always spans the band: how many copies of `count` makes fill `fill` slots.
export function makesRepeats(count, fill = 16) {
  return Math.max(1, Math.ceil(fill / Math.max(1, count)));
}

// Stars for a review card: only a quote the owner marked as a Google review
// (source === 'google') with a 1-5 rating; AI quotes never get stars.
export function reviewStars(q) {
  const r = num(q?.rating);
  return q?.source === 'google' && r >= 1 && r <= 5 ? r : 0;
}

// The footer to render from copy.footer (Edit > Footer) and the template's
// footerSpec export:
//   spec = { columns: [{ type, show }], titles: { [type]: title },
//            mergeHours, cta, ctaLabel, notes? }
// columns: the design's own footer (types in order; show false = a column the
// owner can switch on); titles: each column's default title; mergeHours: hours
// right after the contact column print under it; cta: whether the footer
// button shows while the owner saved no showCta; ctaLabel: its default text;
// notes: optional per-type text for the editor's Footer panel; contactFields:
// optional businessInfo keys that fill the contact column (the panel's
// "nothing to list" check), socialWhenBrandOff: the social icons move to the
// contact column while the logo column is off.
// `has(type, { builder, cta, hoursMerged, shown })` says whether a column
// has anything to list (an empty column is left out; shown = the types the
// owner's columns show); `ctaFallback` is where the
// button goes without an owner URL (it then opens the booking widget), or
// null when it has nowhere to go.
// -> { builder, cells: [{ type, title }], hoursMerged, hoursTitle, cta:
//      { href, label, books } | null, bottomText ('' = the template's own) }
export function footerPlan({ footer, spec, has, ctaFallback = null } = {}) {
  const sp = spec && typeof spec === 'object' ? spec : {};
  const titles = sp.titles && typeof sp.titles === 'object' ? sp.titles : {};
  const builder = Boolean(footer) && typeof footer === 'object' && !Array.isArray(footer);
  const f = builder ? footer : null;
  const cols = footerColumnsOf(f, Array.isArray(sp.columns) ? sp.columns : undefined).filter((c) => c.show);
  const hoursMerged = sp.mergeHours === true && cols.some((c, i) => c.type === 'contact' && cols[i + 1]?.type === 'hours');
  const hoursTitle = cols.find((c) => c.type === 'hours')?.title || titles.hours || 'Hours';
  const showCta = typeof f?.showCta === 'boolean' ? f.showCta : sp.cta === true;
  const ctaUrl = str(f?.ctaUrl);
  const cta = showCta && (ctaUrl || ctaFallback)
    ? { href: ctaUrl || ctaFallback, label: str(f?.ctaText) || sp.ctaLabel, books: !ctaUrl }
    : null;
  const ok = typeof has === 'function' ? has : () => true;
  const cells = cols
    .filter((c) => ok(c.type, { builder, cta, hoursMerged, shown: cols.map((x) => x.type) }))
    .map((c) => ({ type: c.type, title: c.title || titles[c.type] || '' }));
  return { builder, cells, hoursMerged, hoursTitle, cta, bottomText: str(f?.bottomText) };
}
