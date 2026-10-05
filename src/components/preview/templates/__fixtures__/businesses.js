// Business fixtures for the template render tests (templates.render.test.jsx)
// and the screenshot renderer (scripts/theme-render.test.jsx).
// Shape: { businessInfo, generatedCopy, images, customColors, customFonts },
// i.e. what App.jsx holds before templateMeta is built from the registry.
import { DEMO_BUSINESS_INFO, DEMO_GENERATED_COPY } from '../../../../data/demoData.js';
import { HEADING_FONTS, BODY_FONTS } from '../../../../data/fontOptions.js';

// Self-contained stand-in photos (SVG data URIs) so renders need no network
// and hero scrims get tested against both light and dark imagery.
function photo(label, from, to, mid = 'rgba(255,255,255,0.18)') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="1600" height="1000" fill="url(#g)"/>
<circle cx="1180" cy="300" r="260" fill="${mid}"/>
<path d="M260 720c80-120 220-170 420-170h240c160 0 260 60 360 170l120 20c40 8 60 30 60 70v40H200v-60c0-40 20-60 60-70z" fill="rgba(0,0,0,0.35)"/>
<circle cx="480" cy="840" r="80" fill="rgba(0,0,0,0.55)"/><circle cx="1180" cy="840" r="80" fill="rgba(0,0,0,0.55)"/>
<text x="80" y="120" font-family="sans-serif" font-size="44" fill="rgba(255,255,255,0.6)">${label}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const FIXTURE_IMAGES = {
  hero: photo('hero photo', '#dfe6ee', '#6b7a8c'),
  about: photo('about photo', '#2b2f36', '#8a6b4a'),
  gallery0: photo('gallery 1', '#1f2933', '#52606d'),
  gallery1: photo('gallery 2', '#f0e6d8', '#a08060'),
  gallery2: photo('gallery 3', '#0f172a', '#334155'),
  gallery3: photo('gallery 4', '#e2e8f0', '#64748b'),
};

// The least a real site can have: wizard basics plus a thin AI draft.
// awards: [] catches templates that render an empty awards badge.
export const sparse = {
  businessInfo: {
    businessName: 'Rivera Auto Care',
    city: 'Tucson',
    state: 'AZ',
    phone: '(520) 555-0142',
    businessType: 'mobile_detailing',
    awards: [],
  },
  generatedCopy: {
    headline: 'Clean Cars, Done Right',
    subheadline: 'Mobile detailing across Tucson.',
    aboutText: 'Rivera Auto Care is a mobile detailing service in Tucson, AZ.',
    servicesSection: {
      items: [
        { name: 'Exterior Wash', description: 'Hand wash and dry.' },
        { name: 'Interior Detail', description: 'Vacuum and wipe-down of every surface.' },
      ],
    },
  },
  images: {},
  customColors: {},
  customFonts: {},
};

// A filled-in site: the demo business everyone sees in "Preview Demo",
// plus photos so every image slot renders.
export const full = {
  businessInfo: { ...DEMO_BUSINESS_INFO, businessType: 'detailing_shop' },
  generatedCopy: DEMO_GENERATED_COPY,
  images: FIXTURE_IMAGES,
  customColors: {},
  customFonts: {},
};

const pickFont = (list, name) => list.find((f) => f.family.includes(`'${name}'`)).family;

// Owner overrides on every role: distinctive colors no template ships with,
// fonts no template defaults to, and a reordered / partly hidden layout.
export const CUSTOM_COLORS = {
  bg: '#14213d',
  accent: '#fca311',
  text: '#f4f1ea',
  secondary: '#1d2d50',
  muted: '#a9b4c8',
};

export const CUSTOM_FONTS = {
  font: pickFont(HEADING_FONTS, 'Oswald'),
  bodyFont: pickFont(BODY_FONTS, 'Manrope'),
};

export const custom = {
  ...full,
  generatedCopy: {
    ...DEMO_GENERATED_COPY,
    sectionOrder: ['hero', 'about', 'services', 'testimonials', 'gallery', 'cta'],
    hiddenSections: ['statsBar', 'awards'],
  },
  customColors: CUSTOM_COLORS,
  customFonts: CUSTOM_FONTS,
};

// Every owner-editable feature set up (kit/features.js; Edit > Hero
// services, Google Rating, Footer, Headings, Featured Service, Vehicle
// Makes, package details, areas, insured, review sources, CTA photo). The
// themes with live sites show these only when the owner turns them on, so
// the contract checks their extra sections and colors with this fixture.
const FEATURE_SUMMARIES = [
  'Inside and out, top to bottom.',
  'Long-lasting gloss and protection.',
  'Swirls and scratches polished out.',
];
const FEATURE_SERVICES = DEMO_BUSINESS_INFO.services.map((s, i) => ({
  ...s,
  summary: FEATURE_SUMMARIES[i] || '',
  ...(i === 1 ? { badge: 'Most Popular' } : {}),
  includes: ['Interior:', 'Full vacuum', { text: 'Leather conditioning', highlight: true }, 'Exterior:', 'Hand wash and dry'],
  image: photo(`package ${i + 1}`, '#e7ecf2', '#55606e'),
}));

export const features = {
  businessInfo: {
    ...full.businessInfo,
    services: FEATURE_SERVICES,
    packages: FEATURE_SERVICES,
    serviceAreas: ['Northside', 'Lakeview', 'Riverbend'],
    insured: true,
    googlePlace: { placeId: 'ChIJfixture-features', placeName: DEMO_BUSINESS_INFO.businessName, rating: 4.8, reviewCount: 52 },
  },
  generatedCopy: {
    ...DEMO_GENERATED_COPY,
    heroCard: 'quote',
    heroServices: [FEATURE_SERVICES[0].name, FEATURE_SERVICES[1].name],
    googleBadge: { placements: ['hero', 'nav', 'about', 'reviews', 'footer'] },
    footer: {
      columns: [
        { type: 'brand', show: true },
        { type: 'contact', show: true },
        { type: 'hours', show: true },
        { type: 'links', title: 'More', show: true },
        { type: 'areas', show: true },
      ],
      showCta: true,
      ctaText: 'Book a Visit',
      bottomText: 'Licensed and insured',
    },
    sectionTitles: {
      services: { accent: 'Services' },
      featured: { eyebrow: 'Signature Service' },
      brands: { eyebrow: 'Every make welcome' },
    },
    featuredService: { serviceName: FEATURE_SERVICES[1].name, priceFrom: '$450', bullets: ['Deep gloss', 'Easier washing'] },
    vehicleMakes: ['BMW', 'Porsche', 'Rivian'],
    testimonialPlaceholders: DEMO_GENERATED_COPY.testimonialPlaceholders.map((q, i) => (i === 0 ? { ...q, source: 'google', rating: 5 } : q)),
  },
  images: {
    ...FIXTURE_IMAGES,
    featured: photo('featured photo', '#1b2430', '#7d8a99'),
    cta: photo('cta photo', '#30261c', '#8c7a66'),
  },
  customColors: {},
  customFonts: {},
};

export const FIXTURES = { sparse, full, custom, features };
