// Curated heading + body font pairings for the custom-site Design Studio.
// A pairing is a starting point the admin (or the "Suggest a design" run)
// picks in one click; it only fills levers.fonts { heading, body }, so
// designLevers.js stays the one place that turns fonts into CSS stacks.
//
// Every family comes from FONT_CATALOG (fontPairings.test.js checks it): a
// family missing there silently falls back on the published page. Custom
// sites may use all of the catalog, not just the 20 the owner's editor
// lists (fontOptions.js); the editor shows any other family as "Current".
//
// Pure data + pure functions, no React: the admin page and the Netlify
// design run can both import it.
import { FONT_CATALOG, familyFromStack } from '../lib/fontCatalog.js';
import { fontStack } from '../lib/designLevers.js';
import { HEADING_FONTS, BODY_FONTS } from './fontOptions.js';

// The intake form's style chips (customSiteForm.js STYLE_OPTIONS) as mood
// words. Same vocabulary as the templates' `mood` strings
// (src/data/templates.js), so one matcher serves both. The test fails when
// the form gains a style this map doesn't know.
export const STYLE_MOODS = Object.freeze({
  'Bold & sporty': ['bold', 'sporty', 'energetic', 'aggressive', 'performance'],
  'Clean & minimal': ['clean', 'minimal', 'modern', 'fresh', 'professional'],
  'Luxury & high-end': ['luxury', 'premium', 'elite', 'exclusive', 'editorial', 'elegant'],
  'Dark & moody': ['dark', 'mysterious', 'sophisticated', 'sleek'],
  'Bright & friendly': ['bright', 'friendly', 'fun', 'cheerful', 'approachable', 'bubbly'],
  'Rugged & industrial': ['rugged', 'industrial', 'tough', 'gritty', 'raw', 'hardworking'],
  'Modern & techy': ['high-tech', 'techy', 'modern', 'sleek', 'precise'],
  'Classic & trusted': ['classic', 'trustworthy', 'reliable', 'honest', 'dependable'],
});

// Order matters: with nothing to rank by, this is the order the picker
// shows, so the safest all-rounders come before the niche looks.
// `types` are the business types (customSiteDesign.js SITE_BUSINESS_TYPES)
// a pairing suits best; it is only a tie-breaker next to the styles.
const PAIRINGS = [
  {
    id: 'main_street',
    name: 'Main Street',
    heading: 'Montserrat',
    body: 'Open Sans',
    mood: ['classic', 'trustworthy', 'reliable', 'professional', 'dependable', 'clean'],
    types: ['mechanic_shop', 'mobile_detailing', 'wheel_shop', 'car_wash'],
    note: 'One of the most familiar pairings on the web: nothing to get used to and easy to read on any phone.',
  },
  {
    id: 'minimal',
    name: 'Clean room',
    heading: 'Sora',
    body: 'Inter',
    mood: ['clean', 'minimal', 'modern', 'fresh', 'precise', 'professional'],
    types: ['detailing_shop', 'mobile_detailing', 'tint_shop'],
    note: 'Two quiet modern sans faces: no decoration, just a tidy hierarchy that lets the photos lead.',
  },
  {
    id: 'street',
    name: 'Street',
    heading: 'Bebas Neue',
    body: 'Barlow',
    mood: ['bold', 'sporty', 'aggressive', 'energetic', 'performance', 'street'],
    types: ['wheel_shop', 'detailing_shop', 'mobile_detailing'],
    note: 'Tall all-caps headlines that hold their own on a phone screen; Barlow\'s road-sign shapes keep the rest easy to read.',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    heading: 'Oswald',
    body: 'Source Sans 3',
    mood: ['rugged', 'industrial', 'hardworking', 'reliable', 'honest', 'dependable'],
    types: ['mechanic_shop', 'wheel_shop'],
    note: 'Sturdy condensed headings like painted shop signage; Source Sans 3 stays clear in long repair lists and hours.',
  },
  {
    id: 'showroom',
    name: 'Showroom',
    heading: 'Playfair Display',
    body: 'Manrope',
    mood: ['luxury', 'premium', 'elegant', 'sophisticated', 'polished', 'exclusive'],
    types: ['detailing_shop', 'tint_shop', 'mobile_detailing'],
    note: 'High-contrast serif headlines read like a dealership brochure; Manrope keeps package names and prices crisp.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    heading: 'DM Serif Display',
    body: 'DM Sans',
    mood: ['editorial', 'classic', 'sophisticated', 'trustworthy', 'premium', 'clean'],
    types: ['detailing_shop', 'wheel_shop', 'tint_shop'],
    note: 'Drawn as one family, so the serif headlines and sans text sit together like a car-magazine spread.',
  },
  {
    id: 'neighborhood',
    name: 'Neighborhood',
    heading: 'Fraunces',
    body: 'Lato',
    mood: ['friendly', 'welcoming', 'honest', 'local', 'classic', 'approachable', 'warm'],
    types: ['mechanic_shop', 'car_wash', 'detailing_shop'],
    note: 'A soft, warm serif for the shop everyone in town knows by name; Lato keeps the details plain and readable.',
  },
  {
    id: 'coastal',
    name: 'Coastal',
    heading: 'Poppins',
    body: 'Nunito',
    mood: ['bright', 'fresh', 'clean', 'friendly', 'approachable', 'coastal', 'relaxed'],
    types: ['detailing_shop', 'mobile_detailing', 'car_wash'],
    note: 'Round, open headings over soft Nunito text: sunny and approachable without looking childish.',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    heading: 'Syne',
    body: 'Outfit',
    mood: ['dark', 'mysterious', 'sleek', 'sophisticated', 'modern', 'premium'],
    types: ['tint_shop', 'detailing_shop'],
    note: 'Wide, unusual headings with an after-hours gallery feel; Outfit\'s even strokes stay legible on dark backgrounds.',
  },
  {
    id: 'track_day',
    name: 'Track day',
    heading: 'Chakra Petch',
    body: 'Archivo',
    mood: ['sporty', 'performance', 'racing', 'techy', 'bold', 'precise'],
    types: ['wheel_shop', 'tint_shop', 'detailing_shop'],
    note: 'Squared-off headings straight off a race livery; Archivo is a sturdy grotesque that holds up in spec lists.',
  },
  {
    id: 'lab',
    name: 'Lab',
    heading: 'Unbounded',
    body: 'Plus Jakarta Sans',
    mood: ['high-tech', 'techy', 'modern', 'futuristic', 'precise', 'sleek'],
    types: ['tint_shop', 'detailing_shop', 'wheel_shop'],
    note: 'Wide, rounded-square headings for ceramic coating, PPF and tech-forward shops; Plus Jakarta Sans reads clean and current.',
  },
  {
    id: 'heavy_duty',
    name: 'Heavy duty',
    heading: 'Anton',
    body: 'Roboto',
    mood: ['tough', 'industrial', 'bold', 'gritty', 'raw', 'no-nonsense', 'rugged'],
    types: ['mechanic_shop', 'wheel_shop', 'mobile_detailing'],
    note: 'Heavy condensed headlines like truck-door lettering, over Roboto, which everyone already reads every day.',
  },
  {
    id: 'studio',
    name: 'Studio',
    heading: 'Instrument Serif',
    body: 'DM Sans',
    mood: ['minimal', 'editorial', 'elegant', 'modern', 'luxury', 'clean'],
    types: ['detailing_shop', 'tint_shop'],
    note: 'A narrow, quiet serif over neutral DM Sans: understated luxury that leaves the room to big photos of the work.',
  },
  {
    id: 'concours',
    name: 'Concours',
    heading: 'Cormorant Garamond',
    body: 'Montserrat',
    mood: ['luxury', 'elite', 'exclusive', 'elegant', 'classic', 'premium'],
    types: ['detailing_shop', 'mobile_detailing', 'tint_shop'],
    note: 'A fine, high-fashion serif for ultra-premium work; it needs large sizes, and Montserrat carries everything small.',
  },
  {
    id: 'suds',
    name: 'Suds',
    heading: 'Fredoka',
    body: 'Nunito',
    mood: ['fun', 'playful', 'cheerful', 'bubbly', 'bright', 'friendly', 'family'],
    types: ['car_wash', 'mobile_detailing'],
    note: 'Bubbly rounded headings and a rounded body face to match: family-friendly and impossible to take too seriously.',
  },
  {
    id: 'drive_in',
    name: 'Drive-in',
    heading: 'Righteous',
    body: 'Poppins',
    mood: ['retro', 'fun', 'bold', 'friendly', 'classic', 'playful'],
    types: ['car_wash', 'detailing_shop'],
    note: 'Fifties drive-in sign shapes for the headline only; Poppins keeps menus and prices modern and clear.',
  },
];

export const FONT_PAIRINGS = Object.freeze(PAIRINGS.map((p) => Object.freeze({
  ...p,
  mood: Object.freeze([...p.mood]),
  types: Object.freeze([...p.types]),
})));

const BY_ID = new Map(FONT_PAIRINGS.map((p) => [p.id, p]));

export function pairingById(id) {
  return BY_ID.get(id) || null;
}

// The pairing whose heading and body are exactly these families (e.g.
// levers.fonts), so the picker can mark the active one. null otherwise,
// including when only one of the two slots is set.
export function pairingFor(fonts) {
  const heading = fonts?.heading;
  const body = fonts?.body;
  if (!heading || !body) return null;
  return FONT_PAIRINGS.find((p) => p.heading === heading && p.body === body) || null;
}

// Free text ("bold, energetic, performance-driven") as lowercase words.
// Hyphens stay inside a word so 'high-tech' and 'no-nonsense' survive.
function moodWords(text) {
  return String(text || '').toLowerCase().split(/[^a-z-]+/).filter(Boolean);
}

// Does a pairing mood word appear among these words? A hyphenated word
// also matches its parts, so a template's 'ultra-premium' finds 'premium'
// and 'family-friendly' finds 'friendly'.
function hits(pairingMood, words) {
  return pairingMood.filter((m) => words.some((w) => w === m || w.split('-').includes(m)));
}

// A style's mood words: the intake label's list, or the text itself. Own
// keys only: free text such as 'constructor' must not find Object's
// prototype (a function, which would throw in hits()).
function styleWords(style) {
  return Object.prototype.hasOwnProperty.call(STYLE_MOODS, style) ? STYLE_MOODS[style] : moodWords(style);
}

function styleList(styles) {
  const list = Array.isArray(styles) ? styles : typeof styles === 'string' ? styles.split(',') : [];
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const v = typeof s === 'string' ? s.trim() : '';
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

// Pairings best first, for the customer's intake style picks (the form's
// labels, e.g. ['Bold & sporty']; any other string counts as mood words),
// their business type, and optionally the chosen template's mood string
// (TEMPLATES[id].mood).
//   fits   how many of the picked styles the pairing matches at all. It
//          sorts first: a pairing that fits two of the customer's styles
//          always beats one that fits a single style very well.
//   score  then: +1 per matching mood word of each fitted style, +1 when
//          the pairing suits the business type, +1 per mood word it
//          shares with the template.
// Equal pairings keep the curated order, so the result is deterministic
// and the order of `styles` never changes it.
// Returns copies: { ...pairing, fits, score, reasons }.
export function rankPairings({ styles, businessType, mood } = {}) {
  const picks = styleList(styles);
  const templateWords = moodWords(mood);
  return FONT_PAIRINGS.map((p, index) => {
    let fits = 0;
    let score = 0;
    const reasons = [];
    for (const style of picks) {
      const matched = hits(p.mood, styleWords(style));
      if (!matched.length) continue;
      fits += 1;
      score += matched.length;
      reasons.push(style);
    }
    if (businessType && p.types.includes(businessType)) {
      score += 1;
      reasons.push('Suits this business type');
    }
    const shared = hits(p.mood, templateWords);
    if (shared.length) {
      score += shared.length;
      reasons.push('Matches the template\'s mood');
    }
    return { pairing: p, index, fits, score, reasons };
  })
    .sort((a, b) => b.fits - a.fits || b.score - a.score || a.index - b.index)
    .map(({ pairing, fits, score, reasons }) => ({ ...pairing, fits, score, reasons }));
}

// ─── Full picker ─────────────────────────────────────────────────────

export const FONT_CATEGORIES = Object.freeze([
  { id: 'sans', label: 'Sans serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'mono', label: 'Monospace' },
]);

const EDITOR_FAMILIES = new Set([...HEADING_FONTS, ...BODY_FONTS].map((o) => familyFromStack(o.family)));

// Good enough for paragraphs: a text face (not display or mono) with a
// regular and a bold weight. Single-weight faces would get a faux bold the
// browser draws itself, and display/mono faces tire the eye in long text.
export function isBodyFamily(family) {
  const f = FONT_CATALOG[family];
  if (!f || !['sans', 'serif'].includes(f.category)) return false;
  return f.weights.includes(400) && f.weights.includes(700);
}

// Every catalog family grouped by category for a full picker, A-Z within
// a group: [{ id, label, families: [{ family, stack, body, inEditor }] }].
// `stack` is what leverPatch() will write; `body` says it can carry
// paragraphs; `inEditor` says the owner's own editor lists it (others still
// work there, shown as "Current"). { role: 'body' } keeps only body faces.
// Empty groups are left out.
export function allFontFamilies({ role } = {}) {
  const families = Object.keys(FONT_CATALOG).sort((a, b) => a.localeCompare(b));
  return FONT_CATEGORIES.map(({ id, label }) => ({
    id,
    label,
    families: families
      .filter((family) => FONT_CATALOG[family].category === id)
      .map((family) => ({ family, stack: fontStack(family), body: isBodyFamily(family), inEditor: EDITOR_FAMILIES.has(family) }))
      .filter((f) => role !== 'body' || f.body),
  })).filter((g) => g.families.length > 0);
}
