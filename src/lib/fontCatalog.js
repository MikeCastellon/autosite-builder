// Every Google Font the site builder may load, with the weights (and
// italics) to request. The published page builds ONE Google Fonts URL from
// the families a site actually uses (buildFontHref), so a font missing here
// silently falls back on live sites: add it here before using it anywhere.
// Weight lists were checked against the Google Fonts css2 API (2026-09);
// an empty `weights` list means a single-weight face (request the family
// bare). `italics` are the italic weights worth loading.

const W300_900 = [300, 400, 500, 600, 700, 800, 900];

export const FONT_CATALOG = {
  // Heading options (src/data/fontOptions.js)
  'Inter': { category: 'sans', weights: W300_900, italics: [] },
  'Montserrat': { category: 'sans', weights: W300_900, italics: [] },
  'Poppins': { category: 'sans', weights: W300_900, italics: [] },
  'Playfair Display': { category: 'serif', weights: [400, 500, 600, 700, 800, 900], italics: [400, 700] },
  'DM Serif Display': { category: 'serif', weights: [], italics: [400] },
  'Cormorant Garamond': { category: 'serif', weights: [300, 400, 500, 600, 700], italics: [300, 400, 600] },
  'Bebas Neue': { category: 'display', weights: [], italics: [] },
  'Oswald': { category: 'sans', weights: [300, 400, 500, 600, 700], italics: [] },
  'Syne': { category: 'sans', weights: [400, 500, 600, 700, 800], italics: [] },
  'Righteous': { category: 'display', weights: [], italics: [] },
  'Boogaloo': { category: 'display', weights: [], italics: [] },

  // Body options
  'DM Sans': { category: 'sans', weights: W300_900, italics: [300, 400] },
  'Nunito': { category: 'sans', weights: W300_900, italics: [400, 700] },
  'Lato': { category: 'sans', weights: [300, 400, 700, 900], italics: [] },
  'Open Sans': { category: 'sans', weights: [300, 400, 500, 600, 700, 800], italics: [] },
  'Barlow': { category: 'sans', weights: W300_900, italics: [400] },
  'Outfit': { category: 'sans', weights: W300_900, italics: [] },
  'Manrope': { category: 'sans', weights: [300, 400, 500, 600, 700, 800], italics: [] },
  'Source Sans 3': { category: 'sans', weights: W300_900, italics: [] },
  'Roboto': { category: 'sans', weights: W300_900, italics: [] },

  // Used by templates / mockups
  'Barlow Condensed': { category: 'sans', weights: W300_900, italics: [] },
  'Syne Mono': { category: 'mono', weights: [], italics: [] },

  // Extra display/text faces available to new theme designs (extraFonts)
  'Space Grotesk': { category: 'sans', weights: [300, 400, 500, 600, 700], italics: [] },
  'Archivo': { category: 'sans', weights: W300_900, italics: [] },
  'Anton': { category: 'display', weights: [], italics: [] },
  'Rajdhani': { category: 'sans', weights: [300, 400, 500, 600, 700], italics: [] },
  'Teko': { category: 'display', weights: [300, 400, 500, 600, 700], italics: [] },
  'Chakra Petch': { category: 'sans', weights: [300, 400, 500, 600, 700], italics: [] },
  'Fredoka': { category: 'sans', weights: [300, 400, 500, 600, 700], italics: [] },
  'Sora': { category: 'sans', weights: [300, 400, 500, 600, 700, 800], italics: [] },
  'Plus Jakarta Sans': { category: 'sans', weights: [300, 400, 500, 600, 700, 800], italics: [] },
  'Fraunces': { category: 'serif', weights: W300_900, italics: [400] },
  'Instrument Serif': { category: 'serif', weights: [], italics: [400] },
  'Unbounded': { category: 'display', weights: W300_900, italics: [] },
  'Big Shoulders Display': { category: 'display', weights: W300_900, italics: [] },
  'JetBrains Mono': { category: 'mono', weights: [300, 400, 500, 600, 700, 800], italics: [] },
  'Space Mono': { category: 'mono', weights: [400, 700], italics: [] },
};

// The 13 families every published page loaded before theme-ready
// templates existed. Legacy (non-themeReady) templates hardcode some of
// these outside templateMeta, so exportHtml keeps loading them.
export const LEGACY_EXPORT_FAMILIES = [
  'Inter', 'Playfair Display', 'Outfit', 'Syne', 'Barlow Condensed', 'Barlow',
  'Cormorant Garamond', 'DM Serif Display', 'DM Sans', 'Bebas Neue',
  'Righteous', 'Boogaloo', 'Nunito',
];

const BY_LOWER = Object.fromEntries(Object.keys(FONT_CATALOG).map((f) => [f.toLowerCase(), f]));

const GENERIC = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
  'fangsong', '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial',
]);

// Every named family in a CSS font stack, generics dropped, in order.
export function familiesFromStack(stack) {
  if (typeof stack !== 'string') return [];
  return stack
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, '').trim())
    .filter((name) => name && !GENERIC.has(name.toLowerCase()));
}

// "'Inter', sans-serif" -> "Inter"; "Inter" -> "Inter"; junk -> null.
export function familyFromStack(stack) {
  return familiesFromStack(stack)[0] || null;
}

// Canonical catalog name for a family (case-insensitive), or null.
export function catalogFamily(name) {
  if (typeof name !== 'string') return null;
  return BY_LOWER[name.trim().toLowerCase()] || null;
}

function familyParam(family) {
  const { weights, italics } = FONT_CATALOG[family];
  const name = family.replace(/ /g, '+');
  if (italics.length === 0) {
    return weights.length ? `${name}:wght@${weights.join(';')}` : name;
  }
  // ital,wght tuples must be sorted: all upright weights, then italics.
  // A single-weight face with an italic (DM Serif Display) uses ital@0;1.
  if (weights.length === 0) return `${name}:ital@0;1`;
  const tuples = [...weights.map((w) => `0,${w}`), ...italics.map((w) => `1,${w}`)];
  return `${name}:ital,wght@${tuples.join(';')}`;
}

// One Google Fonts stylesheet URL for every distinct catalog family named
// in the given stacks/family names (nested arrays and junk tolerated;
// unknown families ignored). null when nothing is loadable.
export function buildFontHref(stacksOrFamilies) {
  const list = Array.isArray(stacksOrFamilies) ? stacksOrFamilies.flat(Infinity) : [stacksOrFamilies];
  const families = new Set();
  for (const entry of list) {
    for (const name of familiesFromStack(entry)) {
      const known = catalogFamily(name);
      if (known) families.add(known);
    }
  }
  if (families.size === 0) return null;
  const params = [...families].sort().map((f) => `family=${familyParam(f)}`);
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
