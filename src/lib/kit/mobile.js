// The Mobile kit of the Launch Kit (skill launch-mobile-kit, kit key
// "mobile"): what a custom website needs on a phone. Home-screen and
// browser icons from the logo, the browser bar color, a phone headline
// condensed from the site's own headline, a phone section order with the
// template's section ids, tap actions (call, text, book, directions, save
// contact), a "text us a photo for a quote" sms: link, the contact card's
// fields and a phone scorecard.
//
// Pure, browser and server:
//   - mobileFacts() builds mobile-inputs.json, the confirmed facts a run may
//     use (only what the written site shows: business_info, the copy's hero,
//     its sections, the live links). The server spec
//     (netlify/functions/_lib/kit/mobile.js) sends it to the skill.
//   - sanitizeMobile() turns the skill's untrusted mobile.json into the
//     stored data: every link, the contact card and the checks that follow
//     from the facts are recomputed here, never taken from the model.
//   - the result view (components/admin/kit/MobileResult.jsx) reads the
//     stored data with mobileView() and headSnippet().
// The skill's Python scripts (skills/api/launch-mobile-kit/scripts/common.py)
// mirror these rules: MOBILE_RULES is data/rules.json, and mobile.test.js
// writes tests/cases.json, which tests/test_scripts.py checks Python
// against, so a mobile.json that passes validate_mobile.py is stored as
// written.
//
// The stored shape (design.kit.mobile.data):
//   { version: 1, themeColor, shortName, phoneHeadline,
//     phoneSectionOrder: [section ids], siteOrder: [ids the site shows now],
//     sections: [{ id, label }], actions: [{ kind, label, href }],
//     smsQuote: { body, href } | null, vcard: { fn, org, tel, email, url, adr },
//     icons: { bg, source, logo, monogram }, scorecard: [{ id, check, pass,
//     note }], changes: [what the server corrected] }
import { BUSINESS_TYPE_OPTIONS, safeHref } from '../customSiteForm.js';
import { mergeSectionOrder } from '../sectionManifest.js';
import { beforeAfterPairs } from '../../components/preview/templates/kit/beforeAfter.js';
import { vehicleTypesOf } from '../../components/preview/templates/kit/vehicleTypes.js';
import { howItWorksSteps } from '../../components/preview/templates/kit/howItWorks.js';
import { showcaseItems } from '../../components/preview/templates/kit/showcase.js';
import { comparisonOf } from '../../components/preview/templates/kit/comparison.js';
import { faqItems } from '../../components/preview/templates/kit/faq.js';

export const MOBILE_VERSION = 1;
export const MOBILE_INPUTS_FILE = 'mobile-inputs.json';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const deepFreeze = (v) => {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
};

// ─── Rules (= skills/api/launch-mobile-kit/data/rules.json) ───────────

// mobile.test.js fails when the skill's data/rules.json differs (and
// rewrites it with UPDATE_SKILL_FIXTURES=1).
export const MOBILE_RULES = deepFreeze({
  version: 1,
  inputsFile: MOBILE_INPUTS_FILE,
  limits: {
    phoneHeadline: 40,
    siteHeadlinePhone: 60,
    shortName: 12,
    smsBody: 160,
    label: 24,
    note: 300,
    notes: 8,
    checkNote: 200,
    monogram: 3,
  },
  actionKinds: ['call', 'text', 'book', 'directions', 'save'],
  defaultLabels: {
    call: 'Call',
    text: 'Text a photo',
    book: 'Book',
    directions: 'Directions',
    save: 'Save contact',
  },
  defaultSmsBody: 'Hi {name}, I\'d like a quote. Here\'s a photo of my vehicle:',
  defaultSmsBodyShort: 'Hi, I\'d like a quote. Here\'s a photo of my vehicle:',
  saveHref: 'contact.vcf',
  servicesSectionIds: ['services', 'products'],
  servicesWithin: 3,
  icons: [
    { name: 'apple-touch-icon.png', size: 180, purpose: 'apple' },
    { name: 'icon-192.png', size: 192, purpose: 'maskable' },
    { name: 'icon-512.png', size: 512, purpose: 'maskable' },
    { name: 'favicon-32.png', size: 32, purpose: 'favicon' },
  ],
  maskableSafeRadius: 0.4,
  applePadding: 0.12,
  faviconMinContentPx: 12,
  logoContrastPixel: 2.0,
  logoVisibleShare: 0.8,
  checks: [
    { id: 'call', label: 'Tap to call', from: 'inputs' },
    { id: 'phone-format', label: 'Number dials from any phone', from: 'inputs' },
    { id: 'text', label: 'Text-a-photo link opens Messages', from: 'inputs' },
    { id: 'text-capable', label: 'The number takes texts', from: 'manual' },
    { id: 'book', label: 'Online booking', from: 'inputs' },
    { id: 'directions', label: 'Directions to the shop', from: 'inputs' },
    { id: 'contact-card', label: 'Contact card has a name and a way to reach them', from: 'inputs' },
    { id: 'phone-headline', label: 'Phone headline fits', from: 'inputs' },
    { id: 'site-headline', label: 'Site headline is short enough for a phone', from: 'inputs' },
    { id: 'sections', label: 'Services near the top on a phone', from: 'inputs' },
    { id: 'action-bar', label: 'Call/Book bar on phones', from: 'inputs' },
    { id: 'hours', label: 'Hours on the site', from: 'inputs' },
    { id: 'theme-color', label: 'Browser bar in a brand color', from: 'inputs' },
    { id: 'icons', label: 'Home-screen icons inside the safe zone', from: 'skill' },
    { id: 'favicon', label: 'Favicon readable at 32 px', from: 'skill' },
    { id: 'logo-contrast', label: 'Logo stands out on the icon background', from: 'skill' },
    { id: 'tap-targets', label: 'Buttons and links at least 44 px', from: 'preview' },
    { id: 'text-size', label: 'Body text at least 16 px', from: 'preview' },
    { id: 'sideways-scroll', label: 'No sideways scrolling at 375 px', from: 'preview' },
  ],
  fixedNotes: {
    'text-capable': 'Confirm with the customer that this number takes texts (a landline can\'t). If it can\'t, drop the Text action.',
    'tap-targets': 'Check in preview: the browser measures tap targets, not this kit.',
    'text-size': 'Check in preview: measured in the browser at phone width.',
    'sideways-scroll': 'Check in preview: open the site at 375 px and swipe sideways.',
  },
  claimWords: [
    'best', 'top', 'rated', 'award', 'awards', 'winning', 'certified', 'certification', 'licensed', 'insured',
    'bonded', 'guarantee', 'guaranteed', 'warranty', 'voted', 'leading', 'premier', 'trusted', 'cheapest',
    'lowest', 'free', 'fastest', 'expert', 'experts', 'professional', 'professionals', 'pro', 'pros', 'elite',
    'ultimate', 'perfect', 'years', 'since', 'star', 'stars', 'official', 'verified', 'unbeatable', 'number',
    'first', 'only', 'original', 'favorite',
    // Price, speed, availability and quality promises (labels and the text
    // message are only checked against this list and for numbers).
    'cheap', 'affordable', 'discount', 'deal', 'deals', 'sale', 'special', 'specials', 'fast', 'quick', 'instant',
    'same', 'open', 'premium', 'luxury', 'eco', 'organic',
  ],
  glueWords: [
    'your', 'yours', 'with', 'near', 'from', 'into', 'onto', 'that', 'this', 'these', 'those', 'here', 'there',
    'they', 'them', 'their', 'what', 'when', 'where', 'while', 'just', 'more', 'than', 'then', 'also', 'every',
    'right', 'come', 'comes', 'done', 'make', 'made', 'over', 'back',
  ],
});

export const MOBILE_LIMITS = MOBILE_RULES.limits;
export const ACTION_KINDS = MOBILE_RULES.actionKinds;
export const DEFAULT_LABELS = MOBILE_RULES.defaultLabels;
export const MOBILE_CHECKS = MOBILE_RULES.checks;
export const MOBILE_ICONS = MOBILE_RULES.icons;
export const SAVE_HREF = MOBILE_RULES.saveHref;
export const PALETTE_ROLES = Object.freeze(['bg', 'secondary', 'text', 'muted', 'accent']);
export const ICON_SOURCES = Object.freeze(['logo', 'monogram', 'none']);
const CHECK_IDS = MOBILE_CHECKS.map((c) => c.id);
const CHECK_FROM = Object.fromEntries(MOBILE_CHECKS.map((c) => [c.id, c.from]));
const CHECK_LABEL = Object.fromEntries(MOBILE_CHECKS.map((c) => [c.id, c.label]));
const CLAIM_WORDS = new Set(MOBILE_RULES.claimWords);
const GLUE_WORDS = new Set(MOBILE_RULES.glueWords);
const ALWAYS_FIRST = 'hero';
const CHANGES_MAX = 8;

export const ACTION_KIND_LABELS = Object.freeze({
  call: 'Call',
  text: 'Text',
  book: 'Book',
  directions: 'Directions',
  save: 'Save contact',
});

// ─── The templates' sections ──────────────────────────────────────────

// Each template's sections in its default order (the module's `sections`
// export, or sectionManifest.js legacySections for older templates),
// whether it is theme-ready (theme-ready templates show the kit's Call/Book
// bar on phones) and the opt-in ids of the themes with live sites
// (`addedSections`: shown only once the owner turns the feature on). A
// mirror: the React templates can't load in a function bundle.
// mobile.test.js fails when a template changes and this doesn't.
const sec = (list) => Object.freeze(list.split(', ').map((p) => {
  const i = p.indexOf(':');
  return Object.freeze({ id: p.slice(0, i), label: p.slice(i + 1) });
}));
const tpl = (themeReady, list, added = []) => Object.freeze({ themeReady, sections: sec(list), added: Object.freeze(added) });
const STD = 'hero:Hero, statsBar:Stats Bar, services:Services, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA';
const STD_NO_STATS = 'hero:Hero, services:Services, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA';
const LIVE_THEME = 'hero:Hero, statsBar:Stats Bar, brands:Vehicle Makes, services:Services, featured:Featured Service, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA, awards:Awards';
// The live themes' sections with the Before & After band (Chrome Elite).
const CHROME = LIVE_THEME.replace('gallery:Gallery, ', 'gallery:Gallery, beforeAfter:Before & After, ');
// Bold & Sporty also has the reference-site bands: Vehicle Types and How It
// Works after the featured band, Detail Showcase and Comparison after the
// Before & After band, FAQ after the reviews.
const SPORTY = CHROME
  .replace('featured:Featured Service, ', 'featured:Featured Service, vehicleTypes:Vehicle Types, process:How It Works, ')
  .replace('beforeAfter:Before & After, ', 'beforeAfter:Before & After, showcase:Detail Showcase, comparison:Comparison, ')
  .replace('testimonials:Reviews, ', 'testimonials:Reviews, faq:FAQ, ');
const TINT_LEGACY = 'hero:Hero, statsBar:Stats Bar, services:Services, brands:Film Brands, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA';
const MECHANIC_KIT = 'hero:Hero, statsBar:Stats Bar, services:Services, about:About, gallery:Gallery, beforeAfter:Before & After, testimonials:Reviews, cta:Contact / CTA, awards:Awards';

export const TEMPLATE_SECTIONS = Object.freeze({
  detailing_sporty: tpl(true, SPORTY, ['brands', 'featured', 'beforeAfter', 'vehicleTypes', 'process', 'showcase', 'comparison', 'faq']),
  detailing_coastal: tpl(false, STD),
  mobile_bold: tpl(false, STD_NO_STATS),
  mobile_modern: tpl(false, STD),
  mobile_rugged: tpl(false, STD),
  mobile_chrome: tpl(true, CHROME, ['brands', 'featured', 'beforeAfter']),
  wheel_edge: tpl(false, 'hero:Hero, statsBar:Stats Bar, services:Services, brands:Brands, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA'),
  wheel_clean: tpl(false, 'hero:Hero, awards:Awards, statsBar:Stats Bar, services:Services, brands:Brands, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA'),
  tint_dark: tpl(false, TINT_LEGACY),
  tint_sleek: tpl(false, TINT_LEGACY),
  tint_elite: tpl(true, TINT_LEGACY.replace('gallery:Gallery, ', 'gallery:Gallery, beforeAfter:Before & After, '), ['beforeAfter']),
  mechanic_industrial: tpl(true, MECHANIC_KIT, ['beforeAfter']),
  mechanic_friendly: tpl(false, 'hero:Hero, whyUs:Why Choose Us, services:Services, about:About, gallery:Gallery, testimonials:Reviews, cta:Contact / CTA'),
  mechanic_garage: tpl(true, MECHANIC_KIT, ['beforeAfter']),
  mechanic_ironclad: tpl(true, 'hero:Hero, ticker:Service Ticker, ctaBand:CTA Banner, about:About / Shop, services:Services, gallery:Gallery, beforeAfter:Before & After, whyUs:Why Choose Us, testimonials:Reviews, cta:Contact & Hours', ['beforeAfter']),
  tint_obsidian: tpl(true, 'hero:Hero, shadeGuide:Shade Guide, services:Services, brands:Film Brands, process:Process Steps, about:About, gallery:Gallery, beforeAfter:Before & After, testimonials:Reviews, cta:Contact / CTA', ['beforeAfter']),
  mobile_sudsy: tpl(true, 'hero:Hero, brands:Vehicle Makes, services:Services, featured:Featured Service, process:How It Works, whyUs:Why Choose Us, about:About, gallery:Gallery, beforeAfter:Before & After, testimonials:Reviews, cta:Contact / CTA', ['brands', 'featured', 'beforeAfter']),
  wheel_apex: tpl(true, 'hero:Hero, trustBar:Trust Bar, ticker:Scrolling Ticker, products:Products, brands:Brands, about:About, gallery:Gallery, beforeAfter:Before & After, testimonials:Reviews, cta:Contact / CTA', ['beforeAfter']),
  detailing_autosync_dark: tpl(false, STD),
  detailing_autosync_white: tpl(false, STD_NO_STATS),
  carwash_bubble: tpl(true, 'hero:Hero, services:Packages, process:How It Works, about:About & Features, gallery:Gallery, beforeAfter:Before & After, testimonials:Reviews, cta:Contact / CTA', ['beforeAfter']),
  mobile_redline: tpl(true, 'hero:Hero & Quote, about:About, gallery:Gallery, beforeAfter:Before & After, brands:Vehicle Makes, services:Packages, featured:Featured Service, testimonials:Reviews, awards:Awards, locations:Service Area & Hours, cta:Contact / CTA', ['beforeAfter']),
  replica_9f02a6cb: tpl(true, 'hero:Hero, statsBar:Info Bar, about:About, services:Services, vehicleTypes:Vehicle Types, process:How It Works, beforeAfter:Before & After, gallery:Gallery, comparison:Comparison, testimonials:Reviews, faq:FAQ, cta:Contact / CTA'),
});
// An unknown template: the legacy default (sectionManifest.js STD).
const FALLBACK_TEMPLATE = tpl(false, STD);

export function templateSections(templateId) {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_SECTIONS, templateId) ? TEMPLATE_SECTIONS[templateId] : FALLBACK_TEMPLATE;
}

const listOf = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return v.split(/[\u00b7,;|]+/).map((s) => s.trim()).filter(Boolean);
  return [];
};

// The site's sections as the phone plan sees them: [{ id, label, hidden }]
// in the template's default order, and `order`, the ids the site shows now
// in the order it shows them (the editor's Sections list). Hidden: the
// owner hid it (copy.hiddenSections), Awards without an award (it never
// renders empty), and a live theme's opt-in section the owner never turned
// on (Vehicle Makes without makes, Featured Service without a service,
// Before & After without a pair that has both photos: `images` is the
// site's image map; the reference-site bands without an entry the
// published page shows, read with the kit's own helpers).
export function siteSections({ templateId, copy, businessInfo, images } = {}) {
  const t = templateSections(templateId);
  const c = isObject(copy) ? copy : {};
  const info = isObject(businessInfo) ? businessInfo : {};
  const ownerHidden = new Set((Array.isArray(c.hiddenSections) ? c.hiddenSections : []).filter((x) => typeof x === 'string'));
  const awards = listOf(info.awards).filter((a) => (isObject(a) ? typeof a.name === 'string' && a.name.trim() : typeof a === 'string' && a.trim()));
  const optInOn = {
    brands: listOf(c.vehicleMakes).some((m) => typeof m === 'string' && m.trim()),
    featured: isObject(c.featuredService) && typeof c.featuredService.serviceName === 'string' && !!c.featuredService.serviceName.trim(),
    beforeAfter: Boolean(beforeAfterPairs(c.beforeAfter, images)?.pairs.length),
    vehicleTypes: Boolean(vehicleTypesOf(c.vehicleTypes)?.items.length),
    process: Boolean(howItWorksSteps(c.howSteps)?.steps.length),
    showcase: Boolean(showcaseItems(c.showcase, images)?.items.length),
    comparison: Boolean(comparisonOf(c.comparison)?.rows.length),
    faq: Boolean(faqItems(c.faq)?.items.length),
  };
  const hiddenOf = (id) => ownerHidden.has(id)
    || (id === 'awards' && awards.length === 0)
    || (t.added.includes(id) && !optInOn[id]);
  const sections = t.sections.map((s) => ({ id: s.id, label: s.label, hidden: hiddenOf(s.id) }));
  const ids = sections.map((s) => s.id);
  const saved = Array.isArray(c.sectionOrder) ? c.sectionOrder.filter((x) => typeof x === 'string') : [];
  const order = mergeSectionOrder(saved, ids).filter((id) => !hiddenOf(id));
  return { templateId: typeof templateId === 'string' ? templateId : '', themeReady: t.themeReady, sections, order };
}

// ─── Text ─────────────────────────────────────────────────────────────

// One plain line: control characters and any run of whitespace become one
// space, trimmed (what the server stores; Python's one_line()).
export function oneLine(v) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

// Fact text as data: one line, no angle brackets (the request repeats the
// facts inside tags), capped.
function factText(v, max = 300) {
  const s = typeof v === 'number' && Number.isFinite(v) ? String(v) : v;
  return oneLine(s).replace(/</g, '\u2039').replace(/>/g, '\u203a').slice(0, max).trim();
}

// String length as JavaScript counts it (an emoji is 2).
export const jsLength = (v) => (typeof v === 'string' ? v.length : 0);

// Why `v` isn't a plain one-line string of at most `max`, or null.
export function lineProblem(v, where, max, required = true) {
  if (typeof v !== 'string') return `${where} must be a string`;
  if (!v.trim()) return required ? `${where} is empty` : null;
  if (v.length > max) return `${where} is ${v.length} characters (emoji count 2), max ${max}`;
  if (oneLine(v) !== v) return `${where} must be one plain line: no line breaks, tabs, doubled spaces or spaces at the ends`;
  return null;
}

// ─── Colors ───────────────────────────────────────────────────────────

// '#rrggbb' (lowercase) for #rgb / #rrggbb in any case, else ''.
export function normHex(v) {
  let s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return /^#[0-9a-f]{6}$/.test(s) ? s : '';
}

// ─── Tap links ────────────────────────────────────────────────────────

export const telHref = (dial) => (dial ? `tel:${dial}` : '');

// The text link both phones read: sms:<number>?&body=<encoded>. iOS takes
// the body after '&' (it ignores the '?'), Android the query '?&body=...' (an
// empty first parameter). encodeURIComponent writes spaces as %20: Android
// shows a '+' literally.
export const smsHref = (dial, body) => (dial ? `sms:${dial}?&body=${encodeURIComponent(body)}` : '');

const SMS_RE = /^sms:(\+?[0-9]{3,15})\?&body=([A-Za-z0-9_.!~*'()%-]*)$/;

// { number, body, problems } for a text link; no problems = it works on
// iPhone and Android.
export function parseSmsHref(href) {
  if (typeof href !== 'string' || !href.startsWith('sms:')) return { number: null, body: null, problems: ['the text link must start with sms:'] };
  const m = SMS_RE.exec(href);
  if (!m) {
    const problems = [];
    if (!href.includes('?&body=')) problems.push('the text link must be sms:<number>?&body=<text> (\'?&body=\' is the form both iPhone and Android read)');
    if (href.split('body=').slice(1).join('body=').includes('+')) problems.push('the body uses \'+\' for spaces: Android shows the plus signs; use %20');
    if (!/^sms:\+?[0-9]{3,15}\?/.test(href)) problems.push('the number in the text link must be digits only, with an optional leading +');
    return { number: null, body: null, problems: problems.length ? problems : ['the body has characters that must be percent-encoded'] };
  }
  const [, number, encoded] = m;
  let body;
  try {
    body = decodeURIComponent(encoded);
  } catch {
    return { number, body: null, problems: ['the body is not valid percent-encoded UTF-8'] };
  }
  const problems = encodeURIComponent(body) !== encoded ? ['the body is not encoded the way encodeURIComponent encodes it'] : [];
  return { number, body, problems };
}

// Google Maps' cross-platform search link: the Maps app on iPhone and
// Android when installed, the web map otherwise.
export const mapsHref = (line) => (line ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}` : '');

// ─── No new claims ────────────────────────────────────────────────────

// Lowercase words and numbers, accents and apostrophes dropped.
export function tokens(text) {
  const s = (typeof text === 'string' ? text : '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/['\u2019]/g, '');
  return s.match(/[a-z0-9]+/g) || [];
}

// A word and its plain variants (cars/car, detailing/detail, shined/shine).
export function forms(w) {
  const out = new Set([w]);
  if (w.length > 3) {
    if (w.endsWith('ies')) out.add(`${w.slice(0, -3)}y`);
    if (w.endsWith('es')) out.add(w.slice(0, -2));
    if (w.endsWith('s') && !w.endsWith('ss')) out.add(w.slice(0, -1));
    if (w.endsWith('ing') && w.length > 5) {
      out.add(w.slice(0, -3));
      out.add(`${w.slice(0, -3)}e`);
    }
    if (w.endsWith('ed') && w.length > 4) {
      out.add(w.slice(0, -2));
      out.add(w.slice(0, -1));
    }
  }
  return out;
}

function sourceForms(sources) {
  const toks = tokens((Array.isArray(sources) ? sources : []).filter((s) => typeof s === 'string').join(' '));
  const found = new Set();
  for (const t of toks) for (const f of forms(t)) found.add(f);
  return { raw: new Set(toks), src: found };
}

const meets = (set, src) => [...set].some((f) => src.has(f));
const dedupe = (list) => [...new Set(list)];

// Claim words (best, top, free, certified, ...) and numbers ("24/7",
// "$99", "5-star") the sources don't use: the action labels and the text
// message may word things freely, never add a fact.
export function claimProblems(text, sources, where) {
  const { raw, src } = sourceForms(sources);
  const out = [];
  for (const t of tokens(text)) {
    if (/[0-9]/.test(t)) {
      if (!raw.has(t)) out.push(`${where}: "${t}" is a number the site does not state`);
    } else if (CLAIM_WORDS.has(t) && !meets(forms(t), src)) {
      out.push(`${where}: "${t}" is a claim the site does not make`);
    }
  }
  return dedupe(out);
}

// The phone headline: one line, short, and made of the site's own words.
// Every number and claim word, and every word of 4+ letters (except plain
// glue words like "your", "with"), must appear in the sources.
export function headlineProblems(text, sources, where = 'phoneHeadline', max = MOBILE_LIMITS.phoneHeadline) {
  const p = lineProblem(text, where, max);
  if (p) return [p];
  const { raw, src } = sourceForms(sources);
  const out = [];
  for (const t of tokens(text)) {
    if (/[0-9]/.test(t)) {
      if (!raw.has(t)) out.push(`${where}: "${t}" is a number the site does not state`);
    } else if (CLAIM_WORDS.has(t) && !meets(forms(t), src)) {
      out.push(`${where}: "${t}" is a claim the site does not make`);
    } else if (t.length >= 4 && !GLUE_WORDS.has(t) && !meets(forms(t), src)) {
      out.push(`${where}: "${t}" is not in the site's headline or facts (condense, don't add)`);
    }
  }
  if (!tokens(text).length) out.push(`${where} has no words`);
  return dedupe(out);
}

// The home-screen label: at most 12 characters, made only of the business
// name's words (or two or three of them run together, or its initials).
export function shortNameProblems(name, business) {
  const p = lineProblem(name, 'shortName', MOBILE_LIMITS.shortName);
  if (p) return [p];
  const bt = tokens(business);
  const nt = tokens(name);
  if (!nt.length) return ['shortName has no letters or digits'];
  const initials = bt.map((t) => t[0]).join('');
  const joined = new Set();
  for (let i = 0; i < bt.length; i += 1) {
    for (let j = i + 2; j <= Math.min(bt.length, i + 3); j += 1) joined.add(bt.slice(i, j).join(''));
  }
  return nt.filter((t) => !(bt.includes(t) || joined.has(t) || (t.length >= 2 && initials.includes(t))))
    .map((t) => `shortName: "${t}" is not part of the business name`);
}

// ─── Facts ────────────────────────────────────────────────────────────

const str = (v) => (typeof v === 'string' ? v : '');

// The texts the phone headline may draw from: the site's hero and the
// business facts.
export function headlineSources(facts) {
  const site = facts?.site || {};
  const biz = facts?.business || {};
  const addr = facts?.address || {};
  const buttons = site.buttons || {};
  return [site.headline, site.subheadline, biz.name, biz.type, addr.city, addr.state, facts?.serviceArea,
    buttons.primary, buttons.secondary, ...(Array.isArray(site.services) ? site.services : [])]
    .filter((s) => typeof s === 'string' && s);
}

export function visibleIds(facts) {
  const sections = Array.isArray(facts?.site?.sections) ? facts.site.sections : [];
  return sections.filter((s) => isObject(s) && !s.hidden).map((s) => s.id);
}

// phoneSectionOrder must list every section the site shows, once, hero first.
export function orderProblems(order, facts) {
  const want = visibleIds(facts);
  if (!Array.isArray(order) || !order.every((i) => typeof i === 'string')) return ['phoneSectionOrder must be a list of section ids'];
  const out = [];
  const unknown = order.filter((i) => !want.includes(i));
  if (unknown.length) out.push(`phoneSectionOrder has ids the site does not show: ${unknown.join(', ')} (shown: ${want.join(', ')})`);
  const missing = want.filter((i) => !order.includes(i));
  if (missing.length) out.push(`phoneSectionOrder leaves out ${missing.join(', ')}`);
  if (new Set(order).size !== order.length) out.push('phoneSectionOrder lists an id twice');
  if (want.includes(ALWAYS_FIRST) && order.length && order[0] !== ALWAYS_FIRST) out.push(`phoneSectionOrder must start with "${ALWAYS_FIRST}"`);
  return out;
}

export function defaultSmsBody(name) {
  let body = MOBILE_RULES.defaultSmsBody.replace('{name}', name || '');
  if (!name || body.length > MOBILE_LIMITS.smsBody) body = MOBILE_RULES.defaultSmsBodyShort;
  return body;
}

// { kind: href } for every action the facts allow ('text' only with a body).
export function actionHrefs(facts, smsBody = null) {
  const phone = facts?.phone || {};
  const addr = facts?.address || {};
  const dial = phone.dial || '';
  const out = {};
  if (dial) {
    out.call = telHref(dial);
    if (typeof smsBody === 'string') out.text = smsHref(dial, smsBody);
  }
  if (facts?.booking) out.book = facts.booking;
  if (addr.street && addr.line) out.directions = mapsHref(addr.line);
  out.save = SAVE_HREF;
  return out;
}

// The contact card's fields, from the confirmed facts only. The card's
// phone is a number that dials (E.164, else as the site shows it), never
// text that isn't one number ("call or text 555-0100 or 555-0199").
export function vcardOf(facts) {
  const phone = facts?.phone || {};
  const addr = facts?.address || {};
  const name = str(facts?.business?.name);
  return {
    fn: name,
    org: name,
    tel: phone.dial ? phone.e164 || phone.display || phone.dial : '',
    email: str(facts?.email),
    url: str(facts?.website),
    adr: str(addr.line),
  };
}

// ─── Scorecard ────────────────────────────────────────────────────────

const check = (id, pass, note) => ({ id, check: CHECK_LABEL[id], pass, note });

// The phone checks in rules order. 'inputs' checks follow from the facts
// and the plan, 'skill' checks come from make_icons.py's measurements
// (skillChecks: { [id]: { pass, note } }), 'manual' and 'preview' ones are
// null: a person or the browser checks them.
export function scorecard(facts, plan, skillChecks = {}) {
  const phone = facts?.phone || {};
  const addr = facts?.address || {};
  const site = facts?.site || {};
  const palette = facts?.palette || {};
  const actions = {};
  for (const a of Array.isArray(plan?.actions) ? plan.actions : []) if (isObject(a)) actions[a.kind] = a;
  const sms = isObject(plan?.smsQuote) ? plan.smsQuote : null;
  const dial = phone.dial || '';
  const out = [];
  for (const id of CHECK_IDS) {
    const from = CHECK_FROM[id];
    if (from === 'manual' || from === 'preview') {
      out.push(check(id, null, MOBILE_RULES.fixedNotes[id] || ''));
      continue;
    }
    if (from === 'skill') {
      const given = isObject(skillChecks?.[id]) && Object.keys(skillChecks[id]).length ? skillChecks[id] : null;
      const pass = typeof given?.pass === 'boolean' ? given.pass : false;
      out.push(check(id, pass, (given && given.note) || (!given ? 'Not measured' : '')));
      continue;
    }
    if (id === 'call') {
      if (!dial) out.push(check(id, false, 'No phone number on the site'));
      else if (actions.call) out.push(check(id, true, `Calls ${phone.display || dial}`));
      else out.push(check(id, false, 'The Call action is missing'));
    } else if (id === 'phone-format') {
      if (!dial) out.push(check(id, false, 'No phone number on the site'));
      else if (phone.e164) out.push(check(id, true, `Dials as ${phone.e164}`));
      else out.push(check(id, false, 'No country code: phones outside the area may not reach it'));
    } else if (id === 'text') {
      const ok = !!(dial && sms && actions.text && sms.href && !parseSmsHref(sms.href).problems.length);
      let note;
      if (!dial) note = 'No phone number to text';
      else if (ok) note = 'Opens Messages with the quote text on iPhone and Android';
      else note = 'The Text action is missing or its link is broken';
      out.push(check(id, ok, note));
    } else if (id === 'book') {
      if (!facts?.booking) out.push(check(id, false, 'The site doesn\'t take bookings yet: turn on the scheduler for a Book button'));
      else if (actions.book) out.push(check(id, true, 'Opens the booking page'));
      else out.push(check(id, false, 'The Book action is missing'));
    } else if (id === 'directions') {
      if (!addr.street) out.push(check(id, true, 'Not needed: no shop address (mobile service)'));
      else if (actions.directions) out.push(check(id, true, `Opens maps to ${addr.line || ''}`));
      else out.push(check(id, false, 'The Directions action is missing'));
    } else if (id === 'contact-card') {
      const v = vcardOf(facts);
      const have = [['tel', 'phone'], ['email', 'email'], ['url', 'website'], ['adr', 'address']].filter(([k]) => v[k]).map(([, label]) => label);
      const ok = !!(v.fn && (v.tel || v.email));
      out.push(check(id, ok, ok ? `Name, ${have.join(', ')}` : 'The card has no phone or email'));
    } else if (id === 'phone-headline') {
      const text = plan?.phoneHeadline;
      const problems = typeof text === 'string' ? headlineProblems(text, headlineSources(facts)) : ['missing'];
      const n = typeof text === 'string' ? text.length : 0;
      out.push(check(id, !problems.length, problems.length ? 'Rewrite it from the site headline' : `${n} of ${MOBILE_LIMITS.phoneHeadline} characters`));
    } else if (id === 'site-headline') {
      const text = str(site.headline);
      if (!text) out.push(check(id, false, 'The site has no headline'));
      else if (text.length <= MOBILE_LIMITS.siteHeadlinePhone) out.push(check(id, true, `${text.length} characters`));
      else out.push(check(id, false, `${text.length} characters: long on a phone; the phone headline is shorter`));
    } else if (id === 'sections') {
      const order = Array.isArray(plan?.phoneSectionOrder) ? plan.phoneSectionOrder : [];
      const ids = order.filter((i) => MOBILE_RULES.servicesSectionIds.includes(i));
      if (!ids.length) {
        out.push(check(id, true, 'No services section on this template'));
      } else {
        const pos = order.indexOf(ids[0]) + 1;
        out.push(check(id, pos <= MOBILE_RULES.servicesWithin, `Services are section ${pos} of ${order.length}`));
      }
    } else if (id === 'action-bar') {
      if (site.themeReady) out.push(check(id, true, 'The template shows a Call/Book bar at the bottom of phone screens'));
      else out.push(check(id, null, 'Check in preview: an older template without the kit action bar'));
    } else if (id === 'hours') {
      const ok = !!facts?.hasHours;
      out.push(check(id, ok, ok ? 'Hours are on the site' : 'No hours on the site: phone visitors look for them first'));
    } else if (id === 'theme-color') {
      const color = plan?.themeColor;
      const roles = PALETTE_ROLES.filter((r) => palette[r] === color);
      out.push(check(id, roles.length > 0, roles.length ? `${color} (brand ${roles[0]})` : 'Not one of the brand colors'));
    }
  }
  return out;
}

// ─── Facts from the written site ──────────────────────────────────────

const NANP = /^[2-9][0-9]{2}[2-9][0-9]{6}$/;

// The number as the site shows it, what tap links dial (E.164 when the
// country is clear, else its digits) and its E.164 form or ''. An
// extension is dropped from what is dialed; something that isn't one
// phone number (two numbers, a word) dials nothing.
export function phoneFacts(raw) {
  const display = factText(raw, 40);
  const main = display.replace(/\s*(?:,|;)?\s*(?:ext\.?|extension|x|#)\s*[0-9]{1,6}\s*$/i, '');
  const digits = main.replace(/[^0-9]/g, '');
  if (!digits || /[a-wyz]/i.test(main.replace(/^\s*tel:/i, ''))) return { display: digits ? display : '', dial: '', e164: '' };
  const plus = /^\s*\+/.test(main);
  let e164 = '';
  if (plus) {
    if (digits.length >= 8 && digits.length <= 15) e164 = `+${digits}`;
  } else if (digits.length === 10 && NANP.test(digits)) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits[0] === '1' && NANP.test(digits.slice(1))) {
    e164 = `+${digits}`;
  }
  const dial = e164 || (!plus && digits.length >= 7 && digits.length <= 15 ? digits : '');
  return { display, dial, e164 };
}

// The shop address: { street, city, state, zip, line (one line), adr (the
// vCard's street, city, region and postal parts) }. A street that already
// names the city is the whole address, so the card doesn't repeat it.
export function addressFacts({ street, city, state, zip } = {}) {
  const a = { street: factText(street, 200), city: factText(city, 80), state: factText(state, 40), zip: factText(zip, 20) };
  const streetHasCity = !!(a.street && a.city && a.street.toLowerCase().includes(a.city.toLowerCase()));
  const adr = streetHasCity ? [a.street, '', '', ''] : [a.street, a.city, a.state, a.zip];
  const line = [adr[0], adr[1], [adr[2], adr[3]].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return { ...a, line, adr };
}

const SOCIAL = Object.freeze({
  instagram: { hosts: ['instagram.com'], url: (h) => `https://www.instagram.com/${h}/`, hide: 'hideInstagram' },
  facebook: { hosts: ['facebook.com', 'fb.com'], url: (h) => `https://www.facebook.com/${h}`, hide: 'hideFacebook' },
  tiktok: { hosts: ['tiktok.com'], url: (h) => `https://www.tiktok.com/@${h}`, hide: 'hideTiktok' },
  youtube: { hosts: ['youtube.com', 'youtu.be'], url: (h) => `https://www.youtube.com/@${h}`, hide: '' },
});

// The profile link for a handle or link the owner typed, or '' (a link to
// another site, or something that isn't a handle).
export function socialUrl(type, value) {
  const net = SOCIAL[type];
  const v = typeof value === 'string' ? value.trim() : '';
  if (!net || !v || v.length > 200) return '';
  const handle = /^@?([A-Za-z0-9._-]{1,60})$/.exec(v);
  if (handle && !/\.(com|be)$/i.test(handle[1])) return net.url(handle[1].replace(/^@/, ''));
  const href = safeHref(v);
  if (!href) return '';
  const host = new URL(href).hostname.toLowerCase().replace(/^(www|m)\./, '');
  return net.hosts.some((h) => host === h || host.endsWith(`.${h}`)) ? href : '';
}

// The social profiles the site links to: [{ type, url }].
export function socialProfiles(info, images) {
  const b = isObject(info) ? info : {};
  const im = isObject(images) ? images : {};
  const out = [];
  for (const type of Object.keys(SOCIAL)) {
    if (SOCIAL[type].hide && im[SOCIAL[type].hide]) continue;
    const url = socialUrl(type, b[type]);
    if (url) out.push({ type, url });
  }
  return out;
}

// A live link for the facts: http(s) only, and no doubled slash in the
// path (liveUrls joins "/book" onto a published address that may already
// end in one).
export function linkFact(v) {
  const href = safeHref(v);
  if (!href) return '';
  const u = new URL(href);
  u.pathname = u.pathname.replace(/\/{2,}/g, '/');
  return factText(u.href, 300);
}

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;

function hasHoursIn(hours) {
  if (typeof hours === 'string') return !!hours.trim();
  if (isObject(hours)) return Object.values(hours).some((v) => (typeof v === 'string' ? !!v.trim() : !!v));
  if (Array.isArray(hours)) return hours.some((v) => (typeof v === 'string' ? !!v.trim() : isObject(v)));
  return false;
}

function serviceNames(info, copy) {
  const out = [];
  const add = (v) => {
    const name = factText(isObject(v) ? v.name : v, 80);
    if (name && !out.some((n) => n.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  listOf(info?.services).forEach(add);
  (Array.isArray(copy?.servicesSection?.items) ? copy.servicesSection.items : []).forEach(add);
  return out.slice(0, 12);
}

// mobile-inputs.json: the confirmed facts one run may use. Only what the
// written site shows (its business_info, the copy's hero words, its
// sections, its live links) and the brand look; never the intake's
// personal contact fields. `look` is inputs.js brandLook(), `urls` its
// liveUrls(), `logos` / `fontFiles` the container names sent.
export function mobileFacts({ project, site, look = null, urls = {}, logos = [], fontFiles = [] } = {}) {
  const info = isObject(site?.businessInfo) ? site.businessInfo : {};
  const copy = isObject(site?.copy) ? site.copy : {};
  const typeValue = typeof info.businessType === 'string' ? info.businessType : '';
  const typeLabel = BUSINESS_TYPE_OPTIONS.find((o) => o.value === typeValue && o.value !== 'other')?.label || '';
  const email = factText(info.email, 200);
  const palette = isObject(look?.palette) ? Object.fromEntries(PALETTE_ROLES.map((r) => [r, normHex(look.palette[r])])) : null;
  const sections = siteSections({ templateId: site?.templateId, copy, businessInfo: info, images: site?.images });
  return {
    version: MOBILE_VERSION,
    business: {
      name: factText(info.businessName, 120) || factText(project?.business_name, 120),
      type: typeLabel,
    },
    phone: phoneFacts(info.phone),
    email: EMAIL_RE.test(email) ? email : '',
    website: linkFact(urls?.site),
    booking: linkFact(urls?.booking),
    address: addressFacts({ street: info.address, city: info.city, state: info.state, zip: info.zip || info.postalCode }),
    serviceArea: factText(info.serviceArea, 200),
    hasHours: hasHoursIn(info.hours),
    social: socialProfiles(info, site?.images),
    palette: palette && PALETTE_ROLES.every((r) => palette[r]) ? palette : null,
    fonts: { heading: factText(look?.fonts?.heading, 60), body: factText(look?.fonts?.body, 60) },
    logos: (Array.isArray(logos) ? logos : []).filter((n) => typeof n === 'string'),
    fontFiles: (Array.isArray(fontFiles) ? fontFiles : []).filter((n) => typeof n === 'string'),
    site: {
      templateId: sections.templateId,
      themeReady: sections.themeReady,
      headline: factText(copy.headline, 200),
      subheadline: factText(copy.subheadline, 300),
      buttons: { primary: factText(copy.ctaPrimary, 60), secondary: factText(copy.ctaSecondary, 60) },
      services: serviceNames(info, copy),
      sections: sections.sections,
      order: sections.order,
    },
  };
}

// ─── mobile.json (the skill's file) ───────────────────────────────────

export const MOBILE_JSON_KEYS = Object.freeze(['version', 'themeColor', 'shortName', 'phoneHeadline', 'phoneSectionOrder',
  'actions', 'smsQuote', 'vcard', 'icons', 'scorecard', 'notes']);
const VCARD_KEYS = ['fn', 'org', 'tel', 'email', 'url', 'adr'];

const line = (s) => ({ type: 'string', maxLength: s });

// mobile.json as a JSON schema, sent with every request so the skill and
// sanitizeMobile read the same contract.
export const MOBILE_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  required: [...MOBILE_JSON_KEYS],
  properties: {
    version: { const: MOBILE_VERSION },
    themeColor: { type: 'string', pattern: '^#[0-9a-f]{6}$', description: 'One of the palette\'s five colors, usually bg' },
    shortName: { ...line(MOBILE_LIMITS.shortName), description: 'Home-screen label: words of the business name, or its initials' },
    phoneHeadline: { ...line(MOBILE_LIMITS.phoneHeadline), description: 'The site headline condensed: only the site\'s own words, no new claims' },
    phoneSectionOrder: { type: 'array', items: { type: 'string' }, description: 'Every section id the site shows, once, hero first' },
    actions: {
      type: 'array',
      maxItems: ACTION_KINDS.length,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'label', 'href'],
        properties: { kind: { enum: [...ACTION_KINDS] }, label: line(MOBILE_LIMITS.label), href: { type: 'string' } },
      },
    },
    smsQuote: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['body', 'href'],
      properties: { body: line(MOBILE_LIMITS.smsBody), href: { type: 'string', pattern: '^sms:' } },
    },
    vcard: {
      type: 'object',
      additionalProperties: false,
      required: VCARD_KEYS,
      properties: Object.fromEntries(VCARD_KEYS.map((k) => [k, { type: 'string' }])),
    },
    icons: {
      type: 'object',
      additionalProperties: false,
      required: ['bg', 'source', 'logo', 'monogram'],
      properties: {
        bg: { type: 'string', pattern: '^#[0-9a-f]{6}$' },
        source: { enum: [...ICON_SOURCES] },
        logo: { type: ['string', 'null'] },
        monogram: { type: 'string', maxLength: MOBILE_LIMITS.monogram },
      },
    },
    scorecard: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'check', 'pass', 'note'],
        properties: {
          id: { enum: [...CHECK_IDS] },
          check: { type: 'string' },
          pass: { type: ['boolean', 'null'] },
          note: line(MOBILE_LIMITS.checkNote),
        },
      },
    },
    notes: { type: 'array', maxItems: MOBILE_LIMITS.notes, items: line(MOBILE_LIMITS.note) },
  },
});

// ─── The server's check of mobile.json ────────────────────────────────

// A shortName from the business name when the skill's breaks the rules:
// its first words that fit, else its initials.
export function shortNameFallback(business) {
  const words = oneLine(business).split(' ').filter((w) => tokens(w).length);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > MOBILE_LIMITS.shortName) break;
    out = next;
  }
  if (!out) out = words.map((w) => tokens(w)[0][0]).join('').toUpperCase().slice(0, MOBILE_LIMITS.shortName);
  return shortNameProblems(out, business).length ? '' : out;
}

const TAIL_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'your', 'right', 'from', 'by']);

// The site headline cut at the last whole word that fits, without a
// dangling "and", "in your" or punctuation at the end.
export function cutHeadline(text, max = MOBILE_LIMITS.phoneHeadline) {
  const words = oneLine(text).split(' ').filter(Boolean);
  const out = [];
  for (const w of words) {
    if ([...out, w].join(' ').length > max) break;
    out.push(w);
  }
  while (out.length) {
    const last = out[out.length - 1].replace(/[\s,;:.!?\-\u2013\u2014&/]+$/, '');
    if (!last || TAIL_WORDS.has(last.toLowerCase())) out.pop();
    else {
      out[out.length - 1] = last;
      break;
    }
  }
  return out.join(' ');
}

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;
const clip = (v, max) => oneLine(v).slice(0, max).trim();

function skillChecksOf(raw) {
  const out = {};
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!isObject(c) || CHECK_FROM[c.id] !== 'skill' || out[c.id]) continue;
    out[c.id] = { pass: typeof c.pass === 'boolean' ? c.pass : false, note: clip(c.note, MOBILE_LIMITS.checkNote) };
  }
  return out;
}

function iconsOf(raw, { logos = null, themeColor }) {
  const r = isObject(raw) ? raw : {};
  let source = ICON_SOURCES.includes(r.source) ? r.source : 'none';
  let logo = null;
  if (source === 'logo') {
    const name = typeof r.logo === 'string' ? r.logo : '';
    if (logos) logo = logos.includes(name) ? name : logos[0] || null;
    else logo = /^[A-Za-z0-9][A-Za-z0-9._()+-]{0,80}$/.test(name) ? name : null;
    // No logo was sent: the icons can't have come from one.
    if (!logo && logos) source = 'none';
  }
  const mono = typeof r.monogram === 'string' ? r.monogram.trim() : '';
  return {
    bg: normHex(r.bg) || themeColor,
    source,
    logo,
    monogram: source === 'monogram' && /^[\p{L}\p{N}]{1,3}$/u.test(mono) ? mono : '',
  };
}

// The stored data from the skill's mobile.json (untrusted), or null when it
// isn't one. With `facts` (the server, from this run's mobile-inputs.json)
// everything that follows from the facts is recomputed: the links, the
// contact card, the scorecard's facts checks; words that break the rules
// (a new claim, too long, not the business's name) are replaced by the
// site's own, and each correction is listed in `changes`. Without facts
// only the shapes are checked.
export function sanitizeMobile(raw, { facts = null } = {}) {
  if (!isObject(raw) || !MOBILE_JSON_KEYS.some((k) => k !== 'version' && k !== 'notes' && raw[k] !== undefined)) return null;
  return isObject(facts) ? sanitizeWithFacts(raw, facts) : sanitizeShape(raw);
}

function sanitizeWithFacts(raw, facts) {
  const changes = [];
  // Messages may quote the model's own values (an unknown section id):
  // one capped line each.
  const change = (msg) => { if (changes.length < CHANGES_MAX) changes.push(clip(msg, MOBILE_LIMITS.note)); };
  const business = str(facts.business?.name);
  const palette = isObject(facts.palette) ? facts.palette : null;
  const colors = palette ? PALETTE_ROLES.map((r) => normHex(palette[r])).filter(Boolean) : [];

  let themeColor = normHex(raw.themeColor);
  if (!themeColor || (colors.length && !colors.includes(themeColor))) {
    const fallback = (palette && normHex(palette.bg)) || normHex(raw.icons?.bg) || '#ffffff';
    change(`Replaced the browser bar color: ${themeColor ? `${themeColor} isn't one of the brand colors` : 'missing'}. Used ${fallback}.`);
    themeColor = fallback;
  }

  let shortName = typeof raw.shortName === 'string' ? raw.shortName : '';
  const nameIssues = shortNameProblems(shortName, business);
  if (nameIssues.length) {
    const next = shortNameFallback(business);
    change(`Replaced the home-screen name: ${nameIssues[0]}. Used "${next}".`);
    shortName = next;
  }

  const sources = headlineSources(facts);
  let phoneHeadline = typeof raw.phoneHeadline === 'string' ? raw.phoneHeadline : '';
  const headlineIssues = headlineProblems(phoneHeadline, sources);
  if (headlineIssues.length) {
    const site = str(facts.site?.headline);
    const next = [site, cutHeadline(site), business].find((c) => c && !headlineProblems(c, sources).length) || '';
    change(`Replaced the phone headline: ${headlineIssues[0]}. Used ${next ? `"${next}"` : 'none'}.`);
    phoneHeadline = next;
  }

  const want = visibleIds(facts);
  let phoneSectionOrder = Array.isArray(raw.phoneSectionOrder) ? raw.phoneSectionOrder : [];
  const orderIssues = orderProblems(phoneSectionOrder, facts);
  if (orderIssues.length) {
    const kept = dedupe(phoneSectionOrder.filter((id) => typeof id === 'string' && want.includes(id) && id !== ALWAYS_FIRST));
    const current = Array.isArray(facts.site?.order) ? facts.site.order.filter((id) => want.includes(id)) : want;
    const missing = [...current, ...want].filter((id, i, all) => all.indexOf(id) === i && id !== ALWAYS_FIRST && !kept.includes(id));
    phoneSectionOrder = [...(want.includes(ALWAYS_FIRST) ? [ALWAYS_FIRST] : []), ...kept, ...missing];
    change(`Repaired the phone section order: ${orderIssues[0]}.`);
  } else {
    phoneSectionOrder = [...phoneSectionOrder];
  }

  const dial = str(facts.phone?.dial);
  let smsQuote = null;
  let body = null;
  if (dial) {
    const given = isObject(raw.smsQuote) && typeof raw.smsQuote.body === 'string' ? raw.smsQuote.body : '';
    const issue = lineProblem(given, 'smsQuote.body', MOBILE_LIMITS.smsBody) || claimProblems(given, sources, 'smsQuote.body')[0];
    body = issue ? defaultSmsBody(business) : given;
    if (issue) change(`Replaced the text-for-a-quote message: ${issue}. Used the default.`);
    smsQuote = { body, href: smsHref(dial, body) };
    if (!issue && isObject(raw.smsQuote) && raw.smsQuote.href !== smsQuote.href) change('Rebuilt the text link from the phone number.');
  } else if (raw.smsQuote) {
    change('Removed the text link: the site has no phone number.');
  }

  const hrefs = actionHrefs(facts, body);
  const labelSources = [...sources, ...Object.values(DEFAULT_LABELS)];
  const actions = [];
  const given = Array.isArray(raw.actions) ? raw.actions : null;
  if (!given) change('Listed every action the facts allow: mobile.json had no actions list.');
  for (const a of given || ACTION_KINDS.map((kind) => ({ kind }))) {
    if (!isObject(a) || !ACTION_KINDS.includes(a.kind) || actions.some((x) => x.kind === a.kind)) continue;
    if (!hrefs[a.kind]) {
      if (given) change(`Removed the "${a.kind}" action: the facts don't support it.`);
      continue;
    }
    let label = typeof a.label === 'string' ? a.label : '';
    const issue = lineProblem(label, 'label', MOBILE_LIMITS.label) || claimProblems(label, labelSources, 'label')[0];
    if (issue) {
      if (given) change(`Replaced the "${a.kind}" action's label (${issue}). Used "${DEFAULT_LABELS[a.kind]}".`);
      label = DEFAULT_LABELS[a.kind];
    }
    if (given && a.href !== hrefs[a.kind]) change(`Rebuilt the "${a.kind}" link from the facts.`);
    actions.push({ kind: a.kind, label, href: hrefs[a.kind] });
  }

  const vcard = vcardOf(facts);
  if (!isObject(raw.vcard) || VCARD_KEYS.some((k) => raw.vcard[k] !== vcard[k])) change('Rebuilt the contact card fields from the facts.');

  const icons = iconsOf(raw.icons, { logos: Array.isArray(facts.logos) ? facts.logos : [], themeColor });
  const plan = { themeColor, phoneHeadline, phoneSectionOrder, actions, smsQuote };
  const card = scorecard(facts, plan, skillChecksOf(raw.scorecard));
  const rawCard = Array.isArray(raw.scorecard) ? raw.scorecard : [];
  const differs = card.filter((c) => CHECK_FROM[c.id] !== 'skill' && !rawCard.some((r) => isObject(r) && r.id === c.id && r.pass === c.pass)).length;
  if (differs) change(`Scorecard: ${differs} check${differs === 1 ? '' : 's'} recomputed from the facts.`);

  const labels = Object.fromEntries((Array.isArray(facts.site?.sections) ? facts.site.sections : []).filter(isObject).map((s) => [s.id, str(s.label) || s.id]));
  return {
    version: MOBILE_VERSION,
    themeColor,
    shortName,
    phoneHeadline,
    phoneSectionOrder,
    siteOrder: Array.isArray(facts.site?.order) ? facts.site.order.filter((id) => want.includes(id)) : [...want],
    sections: want.map((id) => ({ id, label: labels[id] || id })),
    actions,
    smsQuote,
    vcard,
    icons,
    scorecard: card,
    changes,
  };
}

// Without facts: keep what has the right shape, drop the rest.
function sanitizeShape(raw) {
  const themeColor = normHex(raw.themeColor) || normHex(raw.icons?.bg) || '#ffffff';
  const okLine = (v, max) => (typeof v === 'string' && !lineProblem(v, 'x', max) ? v : '');
  const order = dedupe((Array.isArray(raw.phoneSectionOrder) ? raw.phoneSectionOrder : []).filter((id) => typeof id === 'string' && ID_RE.test(id)));
  const sms = isObject(raw.smsQuote) ? raw.smsQuote : null;
  const parsed = sms && typeof sms.href === 'string' ? parseSmsHref(sms.href) : null;
  const smsQuote = parsed && !parsed.problems.length && okLine(sms.body, MOBILE_LIMITS.smsBody) && parsed.body === sms.body
    ? { body: sms.body, href: sms.href } : null;
  const hrefOk = {
    call: (h) => /^tel:\+?[0-9]{3,15}$/.test(h),
    text: (h) => !parseSmsHref(h).problems.length,
    book: (h) => /^https:\/\//.test(h) && safeHref(h) === h,
    directions: (h) => h.startsWith('https://www.google.com/maps/search/?api=1&query=') && !/\s/.test(h),
    save: (h) => h === SAVE_HREF,
  };
  const actions = [];
  for (const a of Array.isArray(raw.actions) ? raw.actions : []) {
    if (!isObject(a) || !ACTION_KINDS.includes(a.kind) || actions.some((x) => x.kind === a.kind)) continue;
    if (typeof a.href !== 'string' || !hrefOk[a.kind](a.href)) continue;
    actions.push({ kind: a.kind, label: okLine(a.label, MOBILE_LIMITS.label) || DEFAULT_LABELS[a.kind], href: a.href });
  }
  const v = isObject(raw.vcard) ? raw.vcard : {};
  const scorecardOut = [];
  for (const id of CHECK_IDS) {
    const c = (Array.isArray(raw.scorecard) ? raw.scorecard : []).find((x) => isObject(x) && x.id === id);
    if (!c) continue;
    const pass = typeof c.pass === 'boolean' ? c.pass : null;
    scorecardOut.push(check(id, CHECK_FROM[id] === 'manual' || CHECK_FROM[id] === 'preview' ? null : pass, clip(c.note, MOBILE_LIMITS.checkNote)));
  }
  return {
    version: MOBILE_VERSION,
    themeColor,
    shortName: okLine(raw.shortName, MOBILE_LIMITS.shortName),
    phoneHeadline: okLine(raw.phoneHeadline, MOBILE_LIMITS.phoneHeadline),
    phoneSectionOrder: order,
    siteOrder: [],
    sections: order.map((id) => ({ id, label: id })),
    actions,
    smsQuote,
    vcard: Object.fromEntries(VCARD_KEYS.map((k) => [k, clip(v[k], 300)])),
    icons: iconsOf(raw.icons, { themeColor }),
    scorecard: scorecardOut,
    changes: [],
  };
}

// ─── For the result view ──────────────────────────────────────────────

// The stored data in a shape the view can render whatever a record holds
// (an older or broken record never throws): counts per scorecard group,
// the phone order with each section's move against the site's order.
export function mobileView(data) {
  const d = isObject(data) ? data : {};
  const card = (Array.isArray(d.scorecard) ? d.scorecard : []).filter((c) => isObject(c) && typeof c.check === 'string');
  const labels = Object.fromEntries((Array.isArray(d.sections) ? d.sections : []).filter(isObject).map((s) => [s.id, str(s.label) || s.id]));
  const siteOrder = Array.isArray(d.siteOrder) ? d.siteOrder.filter((x) => typeof x === 'string') : [];
  const phone = (Array.isArray(d.phoneSectionOrder) ? d.phoneSectionOrder : []).filter((x) => typeof x === 'string');
  return {
    themeColor: normHex(d.themeColor),
    shortName: str(d.shortName),
    phoneHeadline: str(d.phoneHeadline),
    actions: (Array.isArray(d.actions) ? d.actions : []).filter((a) => isObject(a) && ACTION_KINDS.includes(a.kind) && typeof a.href === 'string'),
    smsQuote: isObject(d.smsQuote) && typeof d.smsQuote.href === 'string' ? { body: str(d.smsQuote.body), href: d.smsQuote.href } : null,
    vcard: Object.fromEntries(VCARD_KEYS.map((k) => [k, str(d.vcard?.[k])])),
    icons: isObject(d.icons) ? { bg: normHex(d.icons.bg), source: str(d.icons.source), monogram: str(d.icons.monogram), logo: str(d.icons.logo) } : null,
    order: phone.map((id, i) => {
      const was = siteOrder.indexOf(id);
      return { id, label: labels[id] || id, move: was < 0 ? 0 : was - i };
    }),
    siteOrder: siteOrder.map((id) => ({ id, label: labels[id] || id })),
    toFix: card.filter((c) => c.pass === false),
    passed: card.filter((c) => c.pass === true),
    toCheck: card.filter((c) => c.pass === null),
    changes: (Array.isArray(d.changes) ? d.changes : []).filter((c) => typeof c === 'string'),
  };
}

const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The <head> tags and the web app manifest that put the icons and the
// browser bar color on the site, once the files sit at the site's root.
export function headSnippet(data) {
  const v = mobileView(data);
  const name = v.vcard.fn || v.shortName;
  const tags = [
    v.themeColor ? `<meta name="theme-color" content="${v.themeColor}">` : '',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    v.shortName ? `<meta name="apple-mobile-web-app-title" content="${attr(v.shortName)}">` : '',
  ].filter(Boolean).join('\n');
  const icon = (size, purpose) => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose });
  const manifest = {
    name,
    short_name: v.shortName || name,
    start_url: '/',
    display: 'browser',
    ...(v.themeColor ? { theme_color: v.themeColor } : {}),
    ...(v.icons?.bg || v.themeColor ? { background_color: v.icons?.bg || v.themeColor } : {}),
    icons: [icon(192, 'any'), icon(512, 'any'), icon(192, 'maskable'), icon(512, 'maskable')],
  };
  return { tags, manifest: `${JSON.stringify(manifest, null, 2)}\n` };
}
