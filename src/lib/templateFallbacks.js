// Centralized fallback text for templates — keyed by businessType.
// When a user picks a template from a different business type,
// these ensure the fallback copy matches their actual business, not the template's original type.

const FALLBACK_MAP = {
  tint_shop: {
    shopName: 'Premium Tint',
    navSubtitle: 'Tint & Protection',
    heroBadge: 'Premium Tint & Film Protection',
    headline: 'Precision Tinting. Premium Results.',
    subheadline: 'Professional window tinting and paint protection film.',
    statLabel: 'Cars Tinted',
    aboutFallback: 'premium window tinting and film protection',
    ctaHeadline: 'Get a Free Quote',
    footerDesc: 'Professional Tinting',
    statLabel2: 'Cars Transformed',
    guaranteeLabel: 'Satisfaction Guaranteed',
    tickerItems: ['Window Tinting', 'Paint Protection Film', 'Ceramic Coating', 'UV Protection'],
    defaultProducts: [
      { name: 'Window Tinting', description: 'Premium film installation', price: '$199+', badge: 'Popular' },
      { name: 'Paint Protection', description: 'Full-body film coverage', price: '$499+' },
      { name: 'Ceramic Coating', description: 'Long-lasting paint protection', price: '$349+' },
    ],
    whyUsTitle: 'Precision Work',
  },
  detailing_shop: {
    shopName: 'Elite Detailing',
    navSubtitle: 'Auto Detailing',
    heroBadge: 'Professional Auto Detailing',
    headline: 'Flawless Detail. Every Time.',
    subheadline: 'Professional auto detailing that exceeds expectations.',
    statLabel: 'Cars Detailed',
    aboutFallback: 'professional auto detailing services',
    ctaHeadline: 'Reserve Your Detail Session',
    footerDesc: 'Professional Vehicle Detailing',
    statLabel2: 'Cars Transformed',
    guaranteeLabel: 'Satisfaction Guaranteed',
    tickerItems: ['Full Detail', 'Ceramic Coating', 'Paint Correction', 'Interior Deep Clean'],
    defaultProducts: [
      { name: 'Full Detail', description: 'Complete interior & exterior', price: '$199+', badge: 'Popular' },
      { name: 'Ceramic Coating', description: 'Long-lasting paint protection', price: '$499+' },
      { name: 'Paint Correction', description: 'Swirl & scratch removal', price: '$349+' },
    ],
    whyUsTitle: 'Professional Results',
  },
  mobile_detailing: {
    shopName: 'Mobile Detail',
    navSubtitle: 'Mobile Detailing',
    heroBadge: 'Professional Mobile Detailing',
    headline: 'Premium Detail. We Come To You.',
    subheadline: 'Professional mobile detailing at your door.',
    statLabel: 'Cars Detailed',
    aboutFallback: 'professional mobile detailing services',
    ctaHeadline: 'Schedule a Mobile Detail',
    footerDesc: 'Mobile Detailing',
    statLabel2: 'Cars Transformed',
    guaranteeLabel: 'Satisfaction Guaranteed',
    tickerItems: ['Full Detail', 'Interior Clean', 'Ceramic Coating', 'Paint Protection'],
    defaultProducts: [
      { name: 'Full Detail', description: 'Complete mobile service', price: '$149+', badge: 'Popular' },
      { name: 'Interior Deep Clean', description: 'Seats, carpets & dash', price: '$99+' },
      { name: 'Ceramic Coating', description: 'Long-lasting protection', price: '$399+' },
    ],
    whyUsTitle: 'We Come To You',
  },
  mechanic_shop: {
    shopName: 'Auto Repair',
    navSubtitle: 'Auto Repair',
    heroBadge: 'Trusted Auto Repair',
    headline: 'Honest Repairs. Expert Service.',
    subheadline: 'Reliable auto repair with honest pricing and expert technicians.',
    statLabel: 'Cars Repaired',
    aboutFallback: 'expert auto repair',
    ctaHeadline: 'Schedule Your Repair',
    footerDesc: 'Auto Repair',
    statLabel2: 'Satisfied Customers',
    guaranteeLabel: 'Guaranteed Work',
    tickerItems: ['Engine Repair', 'Brake Service', 'Oil Change', 'Diagnostics'],
    defaultProducts: [
      { name: 'Engine Repair', description: 'Full diagnostics & repair', price: '$299+', badge: 'Popular' },
      { name: 'Brake Service', description: 'Pads, rotors & fluid', price: '$199+' },
      { name: 'Full Inspection', description: 'Comprehensive vehicle check', price: '$99+' },
    ],
    whyUsTitle: 'Expert Technicians',
  },
  car_wash: {
    shopName: 'Car Wash',
    navSubtitle: 'Car Wash',
    heroBadge: 'Professional Car Wash',
    headline: 'Spotless Clean. Every Visit.',
    subheadline: 'A top-tier car wash experience every time.',
    statLabel: 'Cars Washed',
    aboutFallback: 'a top-tier car wash',
    ctaHeadline: 'Get Washed Today',
    footerDesc: 'Car Wash',
    statLabel2: 'Happy Customers',
    guaranteeLabel: 'Satisfaction Guaranteed',
    tickerItems: ['Express Wash', 'Full Service', 'Interior Clean', 'Wax & Shine'],
    defaultProducts: [
      { name: 'Express Wash', description: 'Quick exterior clean', price: '$15+', badge: 'Popular' },
      { name: 'Full Service', description: 'Interior & exterior', price: '$35+' },
      { name: 'Premium Detail', description: 'The works — inside & out', price: '$79+' },
    ],
    whyUsTitle: 'Spotless Results',
  },
  wheel_shop: {
    shopName: 'Wheel Shop',
    navSubtitle: 'Wheels & Tires',
    heroBadge: 'Custom Wheels & Tires',
    headline: 'Custom Wheels. Perfect Fitment.',
    subheadline: 'Expert wheel and tire services for every ride.',
    statLabel: 'Wheels Installed',
    aboutFallback: 'expert wheel and tire services',
    ctaHeadline: 'Get a Quote',
    footerDesc: 'Wheel & Tire Shop',
    statLabel2: 'Happy Customers',
    guaranteeLabel: 'Fitment Guaranteed',
    tickerItems: ['Custom Wheels', 'Tire Mounting', 'Wheel Balancing', 'Fitment Guaranteed'],
    defaultProducts: [
      { name: 'Custom Wheels', description: '18"–24" alloy wheels', price: '$349+', badge: 'Popular' },
      { name: 'Mount & Balance', description: 'Professional fitment', price: '$89' },
      { name: 'Wheel Repair', description: 'Curb rash & bend fix', price: '$149+' },
    ],
    whyUsTitle: 'Expert Fitment',
  },
};

const GENERIC_FALLBACK = {
  shopName: 'Auto Shop',
  navSubtitle: 'Auto Services',
  heroBadge: 'Professional Auto Services',
  headline: 'Quality Service. Every Time.',
  subheadline: 'Professional automotive services you can trust.',
  statLabel: 'Vehicles Serviced',
  aboutFallback: 'professional automotive services',
  ctaHeadline: 'Get a Free Quote',
  footerDesc: 'Auto Services',
  statLabel2: 'Happy Customers',
  guaranteeLabel: 'Satisfaction Guaranteed',
  tickerItems: ['Professional Service', 'Quality Work', 'Satisfaction Guaranteed', 'Trusted Locally'],
  defaultProducts: [
    { name: 'Service Package', description: 'Our most popular option', price: 'Call', badge: 'Popular' },
    { name: 'Premium Package', description: 'Full-service treatment', price: 'Call' },
    { name: 'Custom Service', description: 'Tailored to your needs', price: 'Call' },
  ],
  whyUsTitle: 'Quality Service',
};

export function getFallbacks(businessType) {
  return FALLBACK_MAP[businessType] || GENERIC_FALLBACK;
}

// ---- How It Works steps / Why Us cards, per business type -----------------
// What the editor's How It Works and Why Us panels (ContentEditor.jsx) start
// from when the owner has not saved their own (copy.howSteps /
// copy.whyCards). They used to seed six mobile-detailing cards for every
// type, so one edit wrote "We come to your door" onto mechanic and car-wash
// sites (audit arch-5). Plain descriptions of how working with the business
// goes: no speed promises, guarantees, product brands or eco claims the
// owner never made. The six known types match MobileSudsy's own defaults
// word for word (templateFallbacks.test.js keeps them in sync).
// Shapes: steps { emoji, title, desc }, cards { icon, title, desc }.

const BUBBLES = '\u{1FAE7}';
const CLEANING_TYPES = ['mobile_detailing', 'detailing_shop', 'car_wash'];
const KNOWN_TYPES = [...CLEANING_TYPES, 'tint_shop', 'wheel_shop', 'mechanic_shop'];

// Older sites store free-form types ("detailing"): map them onto the
// wizard's ids so they still get fitting defaults.
export function businessKind(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || KNOWN_TYPES.includes(raw)) return raw;
  if (/mobile/i.test(raw)) return 'mobile_detailing';
  if (/wash/i.test(raw)) return 'car_wash';
  if (/detail/i.test(raw)) return 'detailing_shop';
  if (/tint|film/i.test(raw)) return 'tint_shop';
  if (/wheel|tire|rim/i.test(raw)) return 'wheel_shop';
  if (/mechanic|repair/i.test(raw)) return 'mechanic_shop';
  return raw;
}

const STEP_BOOK = { emoji: '📱', title: 'You Book', desc: 'Call, text or tap Book and pick a time that works for you.' };
const STEP_DROP_OFF = { emoji: '🚗', title: 'Drop It Off', desc: 'Bring your car to us at your appointment time.' };
const STEP_LOVE = { emoji: '😍', title: 'You Love It', desc: 'Drive off in a car that looks and feels its best.' };
const stepWork = (desc) => ({ emoji: '✨', title: 'We Get To Work', desc });

const HOW_STEPS = {
  mobile_detailing: [
    STEP_BOOK,
    { emoji: '🚐', title: 'We Show Up', desc: 'We come to your driveway, parking lot or office.' },
    { emoji: BUBBLES, title: 'We Clean', desc: 'We get to work while you get on with your day.' },
    { ...STEP_LOVE, desc: 'Hop back into a car that looks and feels fresh.' },
  ],
  car_wash: [
    { emoji: '🚗', title: 'Pull In', desc: 'Swing by and pick the wash that suits your car.' },
    { emoji: BUBBLES, title: 'We Wash', desc: 'Soap, rinse and a careful dry, inside and out.' },
    { emoji: '✨', title: 'You Shine', desc: 'Drive off clean and ready for the road.' },
  ],
  detailing_shop: [STEP_BOOK, STEP_DROP_OFF, stepWork('We clean, correct and protect every surface with care.'), STEP_LOVE],
  tint_shop: [STEP_BOOK, STEP_DROP_OFF, stepWork('We prep the glass and install your film with care.'), STEP_LOVE],
  wheel_shop: [STEP_BOOK, STEP_DROP_OFF, stepWork('We mount, balance and fit everything properly.'), STEP_LOVE],
  mechanic_shop: [STEP_BOOK, STEP_DROP_OFF, stepWork('We diagnose, explain what we find and get it fixed.'), STEP_LOVE],
};
const GENERIC_HOW_STEPS = [STEP_BOOK, STEP_DROP_OFF, stepWork('We take care of the work carefully, one step at a time.'), STEP_LOVE];

const CARD_BOOKING = { icon: '📅', title: 'Easy Booking', desc: 'Call or message us and pick a time that suits you.' };
const CARD_TALK = { icon: '💬', title: 'Straight Talk', desc: 'We tell you what your car needs, and what it doesn’t, before we start.' };
const CARD_OBSESSED = { icon: '🧽', title: 'Detail-Obsessed', desc: 'Every panel, seat and crevice gets real attention, not a quick once-over.' };
const CARD_DONE_RIGHT = { icon: '🧰', title: 'Done Right', desc: 'Careful work on exactly what your car needs, nothing more.' };

const WHY_LEAD = {
  mobile_detailing: { icon: '🏠', title: 'We Come To You', desc: 'Home, work or wherever your car is parked: we bring the detail to you.' },
  detailing_shop: { icon: '✨', title: 'Careful Work', desc: 'Hands-on detailing for paint, glass and interior, done properly.' },
  car_wash: { icon: BUBBLES, title: 'Spotless Results', desc: 'A thorough clean inside and out, with care for your paint.' },
  tint_shop: { icon: '🕶️', title: 'Precision Installs', desc: 'Clean, careful film installs cut to fit your vehicle.' },
  wheel_shop: { icon: '🛞', title: 'The Right Fit', desc: 'We help you choose wheels and tires that suit your car and your style.' },
  mechanic_shop: { icon: '🔧', title: 'Honest Diagnosis', desc: 'We explain what we find and what it costs before any work starts.' },
};
const GENERIC_WHY_LEAD = { icon: '✨', title: GENERIC_FALLBACK.whyUsTitle, desc: 'Careful, hands-on work on every vehicle we see.' };

// Fresh copies, safe to edit and save.
export function defaultHowSteps(businessType) {
  const type = businessKind(businessType);
  return (HOW_STEPS[type] || GENERIC_HOW_STEPS).map((s) => ({ ...s }));
}

export function defaultWhyCards(businessType) {
  const type = businessKind(businessType);
  const second = CLEANING_TYPES.includes(type) ? CARD_OBSESSED : CARD_DONE_RIGHT;
  return [WHY_LEAD[type] || GENERIC_WHY_LEAD, second, CARD_BOOKING, CARD_TALK].map((c) => ({ ...c }));
}
