// A reference site's outline: what our browser measured on the rendered
// page (netlify/functions/_lib/capture.js PAGE_SCRIPTS.outline) when it
// took the screenshots. The screenshots show the look; the outline gives
// what a picture can't: the exact fonts, the sections top to bottom with
// their layout, the spacing, the header's menu, and the features (a
// booking widget, an FAQ, a map, the chat button the capture hides).
//
// custom-site-capture-background stores it on part 1 of a capture's
// screenshots (project.assets[i].outline). It never holds a color (a
// reference's colors are never taken), an image or other address, or body
// text: the page title, headings, menu labels and the header button's
// label only.
//
// Pure module: the capture (server) and the admin page (browser) import it.
//
// The shape (v1):
//   { v: 1,
//     title          the page's <title>, one line, at most 120
//     width          the content's max-width in px (0: none found), 0..3000
//     stickyHeader   the header stays on screen while the page scrolls
//     fonts: {
//       heading      { family, weight, size } of the first heading, or null
//       body         the same for the body text, or null
//       button       { family, weight, size, uppercase, radius } of the
//                    page's first button below the header (filled before
//                    outlined; the header's when there is no other), or
//                    null
//     }              family: the first family of the computed stack (at
//                    most 60); weight 100..900; size px 8..200; radius px
//                    0..999, 999 for a pill
//     sections: [{ kind, heading, height, layout, cards }]
//                    top to bottom, at most 30: kind SECTION_KINDS, heading
//                    its first heading (at most 80), height px, layout
//                    SECTION_LAYOUTS ('' when none was recognized), cards
//                    the repeated similar items in it (0..50)
//     nav: { items, labels, cta }
//                    the header's menu links (0..50), the first 12 labels
//                    (each at most 30), its button's label (at most 30)
//     spacing: { sectionGap }
//                    the median whitespace between one section's content
//                    and the next one's (padding + margin + padding), px
//                    0..400
//     features: [{ id, provider }]
//                    FEATURE_IDS, each once, in that order; provider the
//                    vendor when known ('Square', 'Calendly', 'Elfsight'),
//                    else '' (at most 40)
//   }

export const OUTLINE_VERSION = 1;

export const FEATURE_IDS = Object.freeze([
  'sticky-header', 'hero-video', 'hero-slider', 'carousel', 'gallery', 'before-after', 'reviews', 'reviews-widget', 'faq',
  'tabs', 'pricing', 'booking-widget', 'quote-form', 'contact-form', 'map', 'video', 'instagram-feed', 'chat', 'stats',
  'newsletter', 'service-area',
]);

export const SECTION_KINDS = Object.freeze([
  'header', 'hero', 'services', 'pricing', 'gallery', 'reviews', 'faq', 'about', 'process', 'stats', 'contact', 'booking',
  'cta', 'footer', 'other',
]);

export const SECTION_LAYOUTS = Object.freeze(['full', 'split', 'grid-2', 'grid-3', 'grid-4', 'list', 'carousel', '']);

const MAX = Object.freeze({
  title: 120, family: 60, heading: 80, label: 30, provider: 40, sections: 30, labels: 12,
});

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// One line of text, at most `max` characters (never half an emoji): line
// breaks and control characters become spaces, invisible formatting
// characters go, whitespace collapses. A web address is taken out too, so
// an outline never carries one, whatever the page wrote in a heading.
function line(v, max) {
  if (typeof v !== 'string') return '';
  const s = v.slice(0, max * 8)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .replace(/\b(?:https?:\/\/|data:|blob:|www\.)\S*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, max).join('').trim();
}

// A finite number (a numeric string too) clamped to [min, max] and
// rounded to `decimals`; `fallback` for anything else.
function clampNum(v, min, max, fallback, decimals = 0) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const f = 10 ** decimals;
  return Math.min(max, Math.max(min, Math.round(n * f) / f));
}

// A font family as the page's CSS names it: the first of a stack, quotes
// and stray characters out, and a family next/font renamed
// ("__Inter_d65c78", "__Space_Grotesk_Fallback_6c6f8a") back to the one it
// loads.
function cleanFamily(v) {
  let s = line(v, 200).split(',')[0].replace(/[^\p{L}\p{N} ._-]/gu, '').trim();
  const next = /^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$/i.exec(s);
  if (next) s = next[1].replace(/_/g, ' ').trim();
  return Array.from(s).slice(0, MAX.family).join('').trim();
}

function cleanFont(f, button = false) {
  if (!isObject(f)) return null;
  const family = cleanFamily(f.family);
  if (!family) return null;
  const out = { family, weight: clampNum(f.weight, 100, 900, 400), size: clampNum(f.size, 8, 200, 16, 1) };
  if (button) {
    out.uppercase = f.uppercase === true;
    out.radius = clampNum(f.radius, 0, 999, 0);
  }
  return out;
}

function cleanSection(s) {
  if (!isObject(s)) return null;
  return {
    kind: SECTION_KINDS.includes(s.kind) ? s.kind : 'other',
    heading: line(s.heading, MAX.heading),
    height: clampNum(s.height, 0, 20000, 0),
    layout: SECTION_LAYOUTS.includes(s.layout) ? s.layout : '',
    cards: clampNum(s.cards, 0, 50, 0),
  };
}

function cleanNav(n) {
  const src = isObject(n) ? n : {};
  const labels = [];
  for (const l of Array.isArray(src.labels) ? src.labels.slice(0, 100) : []) {
    const t = line(l, MAX.label);
    if (t && !labels.includes(t)) labels.push(t);
    if (labels.length >= MAX.labels) break;
  }
  // At least one menu link per label.
  return { items: Math.max(clampNum(src.items, 0, 50, 0), labels.length), labels, cta: line(src.cta, MAX.label) };
}

// Known ids only, the first of each, in FEATURE_IDS order. A bare id
// stands for { id, provider: '' }.
function cleanFeatures(list) {
  const byId = new Map();
  for (const f of Array.isArray(list) ? list.slice(0, 200) : []) {
    const id = typeof f === 'string' ? f : isObject(f) ? f.id : null;
    if (!FEATURE_IDS.includes(id) || byId.has(id)) continue;
    byId.set(id, { id, provider: isObject(f) ? line(f.provider, MAX.provider) : '' });
  }
  return FEATURE_IDS.filter((id) => byId.has(id)).map((id) => byId.get(id));
}

// The outline in its v1 shape (above), or null for anything that isn't
// an object or names another version. Strict: unknown keys are dropped,
// text is one line and capped, numbers are finite and clamped, lists are
// capped. The same answer when run again on its own output.
export function sanitizeOutline(raw) {
  if (!isObject(raw)) return null;
  if (raw.v !== undefined && raw.v !== OUTLINE_VERSION) return null;
  const fonts = isObject(raw.fonts) ? raw.fonts : {};
  const spacing = isObject(raw.spacing) ? raw.spacing : {};
  const features = cleanFeatures(raw.features);
  // The flag and the feature say the same thing.
  const stickyHeader = raw.stickyHeader === true || features.some((f) => f.id === 'sticky-header');
  if (stickyHeader && !features.some((f) => f.id === 'sticky-header')) features.unshift({ id: 'sticky-header', provider: '' });
  return {
    v: OUTLINE_VERSION,
    title: line(raw.title, MAX.title),
    width: clampNum(raw.width, 0, 3000, 0),
    stickyHeader,
    fonts: { heading: cleanFont(fonts.heading), body: cleanFont(fonts.body), button: cleanFont(fonts.button, true) },
    sections: (Array.isArray(raw.sections) ? raw.sections.slice(0, 200) : []).map(cleanSection).filter(Boolean).slice(0, MAX.sections),
    nav: cleanNav(raw.nav),
    spacing: { sectionGap: clampNum(spacing.sectionGap, 0, 400, 0) },
    features,
  };
}

// The heading and body font families an outline names ('' when unknown),
// cleaned like sanitizeOutline cleans them.
export function outlineFonts(outline) {
  const fonts = isObject(outline) && isObject(outline.fonts) ? outline.fonts : {};
  const family = (f) => (isObject(f) ? cleanFamily(f.family) : '');
  return { heading: family(fonts.heading), body: family(fonts.body) };
}
