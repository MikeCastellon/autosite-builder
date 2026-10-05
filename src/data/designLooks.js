// Curated starting looks for the Design Studio: two or three per theme-ready
// template, each a complete set of style levers (designLevers.js): all five
// colors, a heading + body font pair, a section order and the hero / about
// layouts. Picking one gives the admin a finished direction to tweak instead
// of a blank set of controls.
//
// Every look is deliberately unlike its template's own default (a light take
// on a dark template or the reverse, a different type personality, a
// different section emphasis), so the three cards are real choices and not
// the stock theme again. Looks carry no business facts: aboutStats, facts and
// the Google place stay whatever the admin entered (applyLook keeps them).
//
// Palettes are picked so deriveTheme() (kit/theme.js) leaves the swatches
// alone: text and muted read at 4.5:1 on both the page and the surface, the
// text on a button reads at 4.5:1 on the accent, and the accent stands 3:1
// off the page. What the admin sees on the card is what the site paints. The
// one exception is Redline Cobalt: its blue keeps white button text but is
// under 4.5:1 on the navy page, so deriveTheme lightens it for accent-colored
// text (links, eyebrows) only.
// designLooks.test.js checks all of that, plus the same root-token contrast
// check theme:check runs, on every template with every look applied.
import { emptyLevers, sanitizeLevers } from '../lib/designLevers.js';
import { isDark } from '../components/preview/templates/kit/theme.js';

// Section orders in each template's own ids (templateSections.js). Every
// look keeps the hero on top and the contact section last (Redline's
// locations band and the awards strip stay next to it, as in the templates).
const LOOKS = [
  // ─── Bold & Sporty (detailing_sporty): black + race red, Inter ─────────
  {
    templateId: 'detailing_sporty', slug: 'daylight', name: 'Daylight',
    mood: ['bright', 'clean', 'bold', 'performance'],
    palette: { bg: '#f5f5f3', secondary: '#ffffff', text: '#141414', muted: '#545454', accent: '#c8102e' },
    fonts: ['Oswald', 'Barlow'],
    order: ['hero', 'statsBar', 'gallery', 'services', 'about', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'The race livery in daylight: paddock white and racing red with condensed type. The gallery moves up so the finished cars sell first.',
  },
  {
    templateId: 'detailing_sporty', slug: 'endurance', name: 'Endurance',
    mood: ['dark', 'performance', 'premium', 'precise'],
    palette: { bg: '#0b1622', secondary: '#13263a', text: '#f2f5f8', muted: '#9fb2c4', accent: '#f47b20' },
    fonts: ['Chakra Petch', 'Barlow'],
    order: ['hero', 'statsBar', 'services', 'testimonials', 'about', 'gallery', 'cta', 'awards'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'Endurance-racing navy and orange with a technical typeface. Reviews sit right under the services; About shows the stats box once stats are entered.',
  },
  {
    templateId: 'detailing_sporty', slug: 'pit-lane', name: 'Pit Lane',
    mood: ['dark', 'aggressive', 'energetic', 'modern'],
    palette: { bg: '#0e0f0c', secondary: '#1a1c17', text: '#f4f6ef', muted: '#a5ab9a', accent: '#c6f432' },
    fonts: ['Anton', 'Manrope'],
    order: ['hero', 'services', 'gallery', 'statsBar', 'about', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'Carbon black with an electric lime accent and tall poster headlines, for tuner and ceramic-coating shops that want to look loud.',
  },

  // ─── Industrial (mechanic_industrial): steel + safety yellow, Inter ────
  {
    templateId: 'mechanic_industrial', slug: 'workshop', name: 'Workshop',
    mood: ['clean', 'professional', 'honest', 'hardworking'],
    palette: { bg: '#f2f1ed', secondary: '#ffffff', text: '#1b1b1b', muted: '#57534e', accent: '#a64c08' },
    fonts: ['Archivo', 'Source Sans 3'],
    order: ['hero', 'statsBar', 'services', 'testimonials', 'about', 'gallery', 'cta', 'awards'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'A bright shop floor: warm off-white, burnt amber and sturdy grotesk type. Reviews follow the services, where trust matters most for repairs.',
  },
  {
    templateId: 'mechanic_industrial', slug: 'fleet', name: 'Fleet',
    mood: ['dark', 'industrial', 'reliable', 'tough'],
    palette: { bg: '#0f1720', secondary: '#1a2430', text: '#eef2f6', muted: '#9aa8b6', accent: '#ff6b1a' },
    fonts: ['Barlow Condensed', 'Barlow'],
    order: ['hero', 'services', 'statsBar', 'about', 'gallery', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'Deep navy and hi-vis orange with condensed signage type, for fleet, diesel and heavy-duty shops. Services lead.',
  },
  {
    templateId: 'mechanic_industrial', slug: 'heritage', name: 'Heritage',
    mood: ['dark', 'trustworthy', 'dependable', 'honest'],
    palette: { bg: '#102019', secondary: '#183022', text: '#f1efe6', muted: '#b2b8a6', accent: '#c9a227' },
    fonts: ['Big Shoulders Display', 'Lato'],
    order: ['hero', 'about', 'services', 'statsBar', 'gallery', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'Racing green and brass for the family garage with a long history. The shop story comes first.',
  },

  // ─── Raw Garage (mechanic_garage): concrete + orange, Inter ────────────
  {
    templateId: 'mechanic_garage', slug: 'clean-bay', name: 'Clean Bay',
    mood: ['clean', 'modern', 'professional', 'reliable'],
    palette: { bg: '#f4f3f0', secondary: '#e8e6e1', text: '#1c1b19', muted: '#55524c', accent: '#1d4ed8' },
    fonts: ['Space Grotesk', 'DM Sans'],
    order: ['hero', 'services', 'statsBar', 'about', 'gallery', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'The garage swept and lit: light concrete, service blue and a crisp modern sans. Services lead.',
  },
  {
    templateId: 'mechanic_garage', slug: 'night-shift', name: 'Night Shift',
    mood: ['dark', 'high-tech', 'precise', 'sleek'],
    palette: { bg: '#0e1116', secondary: '#181c24', text: '#f1f3f5', muted: '#a1a8b3', accent: '#22d3ee' },
    fonts: ['Rajdhani', 'Manrope'],
    order: ['hero', 'statsBar', 'gallery', 'services', 'about', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'Blue-black with a diagnostic cyan and technical type, for tuning, electrical and EV specialists.',
  },
  {
    templateId: 'mechanic_garage', slug: 'hot-rod', name: 'Hot Rod',
    mood: ['bold', 'classic', 'friendly', 'raw'],
    palette: { bg: '#f3ead8', secondary: '#ebdfc6', text: '#231a12', muted: '#5e4f40', accent: '#b3202a' },
    fonts: ['Bebas Neue', 'Lato'],
    order: ['hero', 'about', 'gallery', 'services', 'statsBar', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: 'Cream and cherry red with poster type: a retro, restoration-shop feel. Story and builds come before the service list.',
  },

  // ─── Chrome Elite (mobile_chrome): black + silver, Inter ───────────────
  {
    templateId: 'mobile_chrome', slug: 'showroom', name: 'Showroom',
    mood: ['luxury', 'clean', 'editorial', 'premium'],
    palette: { bg: '#f7f7f5', secondary: '#ecebe7', text: '#121212', muted: '#57575a', accent: '#1f2937' },
    fonts: ['Cormorant Garamond', 'Manrope'],
    order: ['hero', 'gallery', 'services', 'about', 'statsBar', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'A bright dealership showroom: gallery white, graphite buttons and a fine serif. The gallery opens the page.',
  },
  {
    templateId: 'mobile_chrome', slug: 'midnight', name: 'Midnight',
    mood: ['dark', 'luxury', 'sophisticated', 'exclusive'],
    palette: { bg: '#0a0f1a', secondary: '#121a2a', text: '#f3f5f9', muted: '#9aa6ba', accent: '#c9a96e' },
    fonts: ['Montserrat', 'Lato'],
    order: ['hero', 'statsBar', 'services', 'gallery', 'about', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'Midnight blue and champagne with a wide geometric face, for concierge detailers who serve luxury cars.',
  },
  {
    templateId: 'mobile_chrome', slug: 'ceramic', name: 'Ceramic',
    mood: ['clean', 'modern', 'fresh', 'precise'],
    palette: { bg: '#f3f6f7', secondary: '#ffffff', text: '#0f1a1c', muted: '#4e5d61', accent: '#0f766e' },
    fonts: ['Space Grotesk', 'Inter'],
    order: ['hero', 'services', 'gallery', 'statsBar', 'about', 'testimonials', 'cta', 'awards'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: 'Cool white and deep teal, clinical and modern, for coating and paint-correction specialists.',
  },

  // ─── Elite Gold (tint_elite): black + gold, Playfair / Inter ──────────
  {
    templateId: 'tint_elite', slug: 'ivory', name: 'Ivory',
    mood: ['luxury', 'bright', 'elegant', 'premium'],
    palette: { bg: '#f8f5ee', secondary: '#efe9dc', text: '#1a1712', muted: '#5f5646', accent: '#7f621d' },
    fonts: ['Cormorant Garamond', 'Lato'],
    order: ['hero', 'services', 'gallery', 'brands', 'about', 'statsBar', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'The gold leaf on ivory paper instead of black: a light, boutique take on the luxury tint studio.',
  },
  {
    templateId: 'tint_elite', slug: 'platinum', name: 'Platinum',
    mood: ['dark', 'modern', 'sleek', 'exclusive'],
    palette: { bg: '#111418', secondary: '#1b2027', text: '#f4f5f7', muted: '#a3abb6', accent: '#c0c7d1' },
    fonts: ['Montserrat', 'Manrope'],
    order: ['hero', 'statsBar', 'brands', 'services', 'gallery', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'Graphite and platinum with a clean geometric sans instead of the serif: premium without the gold. Film brands move up.',
  },
  {
    templateId: 'tint_elite', slug: 'bordeaux', name: 'Bordeaux',
    mood: ['dark', 'luxury', 'sophisticated', 'editorial'],
    palette: { bg: '#170b0f', secondary: '#241219', text: '#f7eef0', muted: '#c0a9af', accent: '#e0a387' },
    fonts: ['DM Serif Display', 'DM Sans'],
    order: ['hero', 'statsBar', 'about', 'services', 'brands', 'gallery', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'Deep wine and rose gold with an editorial serif, for studios that sell the experience. The studio story comes first.',
  },

  // ─── Obsidian Studio (tint_obsidian): void + violet, Syne / Outfit ────
  {
    templateId: 'tint_obsidian', slug: 'lab', name: 'Lab',
    mood: ['bright', 'clean', 'high-tech', 'precise'],
    palette: { bg: '#f5f6fa', secondary: '#ffffff', text: '#12131a', muted: '#525868', accent: '#5b21b6' },
    fonts: ['Space Grotesk', 'Inter'],
    order: ['hero', 'services', 'shadeGuide', 'process', 'brands', 'about', 'gallery', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'The studio with the lights on: lab white and deep violet, precise and technical. Services lead, then the shade guide.',
  },
  {
    templateId: 'tint_obsidian', slug: 'afterglow', name: 'Afterglow',
    mood: ['dark', 'mysterious', 'high-tech', 'sleek'],
    palette: { bg: '#04090b', secondary: '#0b1417', text: '#eefcfc', muted: '#8fb3b6', accent: '#14b8a6' },
    fonts: ['Chakra Petch', 'Manrope'],
    order: ['hero', 'shadeGuide', 'gallery', 'services', 'brands', 'process', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'A teal glow in the dark with angular technical type. Shade guide and gallery up front, so the results show first.',
  },
  {
    templateId: 'tint_obsidian', slug: 'ember', name: 'Ember',
    mood: ['dark', 'bold', 'energetic', 'premium'],
    palette: { bg: '#0b0706', secondary: '#17100d', text: '#fbf3ee', muted: '#b8a59b', accent: '#ff5a1f' },
    fonts: ['Sora', 'Inter'],
    order: ['hero', 'services', 'process', 'shadeGuide', 'brands', 'about', 'gallery', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'Warm black and molten orange: the same dark studio, hotter. Good for heat-rejection and ceramic-film shops.',
  },

  // ─── Bright & Bubbly (mobile_sudsy): cream + amber, Boogaloo / Nunito ─
  {
    templateId: 'mobile_sudsy', slug: 'night-wash', name: 'Night Wash',
    mood: ['dark', 'fun', 'friendly', 'energetic'],
    palette: { bg: '#1a1033', secondary: '#251847', text: '#fff8ee', muted: '#c4b8dd', accent: '#ffcf33' },
    fonts: ['Fredoka', 'Manrope'],
    order: ['hero', 'services', 'whyUs', 'process', 'gallery', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: 'The playful layout after dark: deep grape and sunny yellow with rounded type. Still friendly, less like a kids\' brand.',
  },
  {
    templateId: 'mobile_sudsy', slug: 'coastal', name: 'Coastal',
    mood: ['bright', 'fresh', 'approachable', 'clean'],
    palette: { bg: '#f0fbf7', secondary: '#dcf5ec', text: '#0f2a23', muted: '#456059', accent: '#0d727b' },
    fonts: ['Poppins', 'Nunito'],
    order: ['hero', 'services', 'process', 'about', 'whyUs', 'gallery', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'stats',
    note: 'Sea-glass mint and ocean teal with a calmer geometric heading: fresh and friendly for beach-town mobile detailers.',
  },
  {
    templateId: 'mobile_sudsy', slug: 'sorbet', name: 'Sorbet',
    mood: ['bright', 'cheerful', 'fun', 'bubbly'],
    palette: { bg: '#fff6f1', secondary: '#ffece3', text: '#2b1712', muted: '#6b4b40', accent: '#c04325' },
    fonts: ['Righteous', 'DM Sans'],
    order: ['hero', 'gallery', 'services', 'process', 'whyUs', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: 'Peach and burnt coral with a retro display face: warm and upbeat. The gallery opens the page.',
  },

  // ─── Forge Studio (wheel_apex): alloy + bronze, Bebas Neue / DM Sans ──
  {
    templateId: 'wheel_apex', slug: 'carbon', name: 'Carbon',
    mood: ['dark', 'premium', 'sleek', 'bold'],
    palette: { bg: '#0f1012', secondary: '#1a1c20', text: '#f2f2f0', muted: '#a0a3aa', accent: '#c9a55c' },
    fonts: ['Anton', 'Inter'],
    order: ['hero', 'products', 'trustBar', 'ticker', 'brands', 'gallery', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: 'The catalog on carbon black: bronze turns to brushed gold and the headlines get heavier. Products come straight after the hero.',
  },
  {
    templateId: 'wheel_apex', slug: 'editorial', name: 'Editorial',
    mood: ['editorial', 'luxury', 'clean', 'minimal'],
    palette: { bg: '#faf8f4', secondary: '#ffffff', text: '#161616', muted: '#5b5b5b', accent: '#b42318' },
    fonts: ['Playfair Display', 'Source Sans 3'],
    order: ['hero', 'trustBar', 'ticker', 'products', 'gallery', 'brands', 'about', 'testimonials', 'cta'], hidden: ['ticker'],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'A magazine spread: paper white, signal red and a high-contrast serif. The scrolling ticker is hidden for a calmer page.',
  },
  {
    templateId: 'wheel_apex', slug: 'tuner', name: 'Tuner',
    mood: ['dark', 'aggressive', 'energetic', 'modern'],
    palette: { bg: '#0d0f0e', secondary: '#181b19', text: '#f3f5f2', muted: '#9ea59f', accent: '#a3e635' },
    fonts: ['Chakra Petch', 'Barlow'],
    order: ['hero', 'ticker', 'products', 'gallery', 'brands', 'trustBar', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'stats',
    note: 'Black with an anodized lime accent and angular type, for tuner and off-road wheel shops. Builds show early.',
  },

  // ─── Ironclad (mechanic_ironclad): steel + rust red, Bebas / Barlow ───
  {
    templateId: 'mechanic_ironclad', slug: 'daylight', name: 'Daylight Shop',
    mood: ['clean', 'professional', 'trustworthy', 'hardworking'],
    palette: { bg: '#f3f2ef', secondary: '#ffffff', text: '#17181a', muted: '#55585e', accent: '#b3261e' },
    fonts: ['Oswald', 'Source Sans 3'],
    order: ['hero', 'about', 'services', 'ticker', 'gallery', 'whyUs', 'testimonials', 'ctaBand', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'The same no-nonsense shop on a light page: off-white, signal red, condensed headings. The banner moves down to close the page.',
  },
  {
    templateId: 'mechanic_ironclad', slug: 'navy-steel', name: 'Navy Steel',
    mood: ['dark', 'industrial', 'reliable', 'tough'],
    palette: { bg: '#0d1520', secondary: '#172231', text: '#f0f3f7', muted: '#9fadbd', accent: '#f59e0b' },
    fonts: ['Teko', 'Inter'],
    order: ['hero', 'ticker', 'services', 'whyUs', 'ctaBand', 'about', 'gallery', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'stats',
    note: 'Navy steel and amber with tall machined type. Services and the reasons to choose the shop come first.',
  },
  {
    templateId: 'mechanic_ironclad', slug: 'field', name: 'Field',
    mood: ['rugged', 'tough', 'dependable', 'raw'],
    palette: { bg: '#151a12', secondary: '#1f261b', text: '#eef0e6', muted: '#a9b09a', accent: '#e07b1f' },
    fonts: ['Archivo', 'Lato'],
    order: ['hero', 'services', 'ticker', 'ctaBand', 'about', 'gallery', 'whyUs', 'testimonials', 'cta'], hidden: ['ticker'],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'Olive drab and blaze orange, for 4x4, off-road and farm-equipment shops. The ticker is hidden for a steadier page.',
  },

  // ─── Bubble Rush (carwash_bubble): sky + cyan, Righteous / Nunito ─────
  {
    templateId: 'carwash_bubble', slug: 'neon-night', name: 'Neon Night',
    mood: ['dark', 'fun', 'energetic', 'modern'],
    palette: { bg: '#0b1026', secondary: '#141b3a', text: '#f3f6ff', muted: '#a9b3d6', accent: '#22d3ee' },
    fonts: ['Fredoka', 'Outfit'],
    order: ['hero', 'services', 'gallery', 'process', 'about', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'full', aboutLayout: 'image',
    note: 'The tunnel lit with neon: midnight blue and electric cyan, still playful. For express washes open late.',
  },
  {
    templateId: 'carwash_bubble', slug: 'express', name: 'Express',
    mood: ['clean', 'modern', 'professional', 'minimal'],
    palette: { bg: '#ffffff', secondary: '#f1f5f9', text: '#0f172a', muted: '#475569', accent: '#1d4ed8' },
    fonts: ['Plus Jakarta Sans', 'Inter'],
    order: ['hero', 'services', 'testimonials', 'process', 'about', 'gallery', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'stats',
    note: 'Crisp white and royal blue with a modern sans: less bubbly, more membership-plan wash. Reviews follow the packages.',
  },
  {
    templateId: 'carwash_bubble', slug: 'eco', name: 'Eco',
    mood: ['bright', 'fresh', 'friendly', 'honest'],
    palette: { bg: '#f4faf5', secondary: '#e3f3e6', text: '#10251a', muted: '#46604d', accent: '#137638' },
    fonts: ['Poppins', 'Nunito'],
    order: ['hero', 'about', 'services', 'process', 'gallery', 'testimonials', 'cta'], hidden: [],
    heroLayout: 'split', aboutLayout: 'image',
    note: 'Leaf green on a soft mint page, for water-saving and eco washes. The story behind the wash comes first.',
  },

  // ─── Redline (mobile_redline): near-black + signal red, Inter ─────────
  // Redline is hidden from the public template picker, so its looks are
  // only offered where custom projects can use it.
  {
    templateId: 'mobile_redline', slug: 'daylight', name: 'Daylight', customOnly: true,
    mood: ['bright', 'clean', 'bold', 'trustworthy'],
    palette: { bg: '#f7f6f4', secondary: '#ffffff', text: '#151313', muted: '#5a5555', accent: '#d61f26' },
    fonts: ['Montserrat', 'Inter'],
    order: ['hero', 'services', 'featured', 'gallery', 'about', 'brands', 'testimonials', 'awards', 'locations', 'cta'], hidden: [],
    heroLayout: '', aboutLayout: 'image',
    note: 'Redline on a light page: warm white, signal red, a wider geometric heading. Packages and the featured service lead.',
  },
  {
    templateId: 'mobile_redline', slug: 'cobalt', name: 'Cobalt', customOnly: true,
    mood: ['dark', 'modern', 'reliable', 'sleek'],
    palette: { bg: '#08101c', secondary: '#121c2c', text: '#f3f6fa', muted: '#9eabbd', accent: '#2563eb' },
    fonts: ['Archivo', 'Manrope'],
    order: ['hero', 'brands', 'services', 'featured', 'testimonials', 'about', 'gallery', 'awards', 'locations', 'cta'], hidden: [],
    heroLayout: '', aboutLayout: 'stats',
    note: 'Night navy and cobalt instead of red, for detailers whose brand is blue. Vehicle makes and packages come straight after the hero.',
  },
];

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

// The exported shape. `dark` is computed (white text reads better on the
// look's page color), so the picker can label Light / Dark without math.
export const DESIGN_LOOKS = deepFreeze(LOOKS.map((l) => ({
  id: `${l.templateId}-${l.slug}`,
  templateId: l.templateId,
  name: l.name,
  mood: l.mood,
  customOnly: l.customOnly === true,
  dark: isDark(l.palette.bg),
  levers: {
    palette: l.palette,
    fonts: { heading: l.fonts[0], body: l.fonts[1] },
    sections: { order: l.order, hidden: l.hidden },
    heroLayout: l.heroLayout,
    aboutLayout: l.aboutLayout,
  },
  note: l.note,
})));

const BY_ID = new Map(DESIGN_LOOKS.map((l) => [l.id, l]));

// The looks for one template, in curated order; [] for a template without
// looks (legacy, non-theme-ready templates have no levers to preset).
export function looksFor(templateId) {
  return DESIGN_LOOKS.filter((l) => l.templateId === templateId);
}

export function lookById(id) {
  return BY_ID.get(id) || null;
}

// The style levers a look sets. Everything else in the levers (aboutStats,
// facts, googlePlace) is business content and survives a look change.
const STYLE_KEYS = ['palette', 'fonts', 'sections', 'heroLayout', 'aboutLayout'];

// `levers` with a look's style applied, as clean levers for the look's
// template. Takes a look or its id, and always uses the library's own copy
// of that look (a look object handed back from the UI can't smuggle in
// other values). The result holds fresh copies: DESIGN_LOOKS is frozen, so
// editor state must never hold its arrays. An unknown look returns `levers`
// as they were.
export function applyLook(levers, lookOrId) {
  const look = lookById(typeof lookOrId === 'string' ? lookOrId : lookOrId?.id);
  const base = levers && typeof levers === 'object' ? levers : emptyLevers();
  if (!look) return base;
  const style = JSON.parse(JSON.stringify(look.levers));
  return sanitizeLevers({ ...base, ...style }, look.templateId);
}

// The id of the look these levers currently match exactly (so the picker can
// mark it), or '' once anything was changed by hand.
export function lookIdFor(levers, templateId) {
  const clean = sanitizeLevers(levers, templateId);
  const key = (l) => JSON.stringify(STYLE_KEYS.map((k) => (k === 'palette' ? Object.entries(l.palette).sort() : l[k])));
  const mine = key(clean);
  const hit = looksFor(templateId).find((look) => key(sanitizeLevers(look.levers, templateId)) === mine);
  return hit ? hit.id : '';
}
