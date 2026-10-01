// Which optional editor controls each template actually reads, so the Edit
// panel (ContentEditor.jsx) never offers a control that changes nothing on
// the site (audit 4.3: editor-3, t-tint-4, ai-10). Each entry lists the
// copy keys the template's source reads; editorCapabilities.test.js checks
// this table against every template file, so a template that starts or
// stops reading a key fails the test until the table follows.
//
// Keys (the copy fields behind each control):
//   ctaPrimaryUrl / ctaSecondaryUrl  Hero button URLs (Button 2's URL is also
//                                    the Contact section's second button)
//   ctaSecondaryText                 Contact > Phone / Secondary Button text
//   servicesTitle                    Services > Services Heading
//                                    (copy.servicesSection.title)
//   aboutStats                       About > Stats Box values
//   howSteps / whyCards              How It Works / Why Us tabs
//   products                         Products tab (copy.products, showProducts)
//   wheelBrands                      Brands tab (wheelBrands, tireBrandsList)
//   filmBrandsList                   Film Brands tab
//   shadeGuide                       Shades tab (shadeGuide, showShadeGuide)
//   trustBar / tickerItems           Trust Bar / Ticker tabs
//   reviewMode                       Reviews > Review Source switch
//   heroServices                     Hero > Services in the hero
//                                    (heroServices, heroCard)
//   googleBadge                      Google Rating tab
//   footerBuilder                    Footer > columns (copy.footer)
//   sectionTitles                    Headings tab
//   featuredService                  Featured Service tab
//   vehicleMakes                     Vehicle Makes tab
//
// SOURCE_CAPABILITIES (below) covers controls whose data is not a copy key
// (business facts, per-service and per-review fields, images); the same
// test checks those patterns against the template sources.

export const CAPABILITY_KEYS = {
  ctaPrimaryUrl: ['ctaPrimaryUrl'],
  ctaSecondaryUrl: ['ctaSecondaryUrl'],
  ctaSecondaryText: ['ctaSecondaryText'],
  servicesTitle: ['servicesSection\\??\\.title'],
  aboutStats: ['aboutStats'],
  howSteps: ['howSteps'],
  whyCards: ['whyCards'],
  products: ['products', 'showProducts'],
  wheelBrands: ['wheelBrands', 'tireBrandsList'],
  filmBrandsList: ['filmBrandsList'],
  shadeGuide: ['shadeGuide', 'showShadeGuide'],
  trustBar: ['trustBar'],
  tickerItems: ['tickerItems'],
  reviewMode: ['reviewMode'],
  // \bcopy\??\.footer\b does not match copy.footerTagline.
  heroServices: ['heroServices', 'heroCard'],
  googleBadge: ['googleBadge'],
  footerBuilder: ['footer'],
  sectionTitles: ['sectionTitles'],
  featuredService: ['featuredService'],
  vehicleMakes: ['vehicleMakes'],
};

// Controls that depend on data other than a copy key (business facts,
// per-service and per-review fields, images): full regexes over the
// template source, all of which must match. editorCapabilities.test.js
// checks them like CAPABILITY_KEYS.
export const SOURCE_CAPABILITIES = {
  serviceDetails: ['\\bserviceIncludes\\('],
  serviceAreas: ['\\bserviceAreasOf\\('],
  insured: ['\\b(?:biz|businessInfo|info)\\??\\.insured\\b'],
  ctaImage: ['\\bimages\\??\\.cta\\b'],
  reviewSources: ["\\.source\\s*===\\s*'google'"],
};

const KIT = ['ctaPrimaryUrl', 'ctaSecondaryUrl', 'ctaSecondaryText', 'servicesTitle', 'aboutStats'];

export const TEMPLATE_READS = {
  // Theme-ready (visible) templates.
  detailing_sporty: KIT,
  mechanic_industrial: KIT,
  mechanic_garage: KIT,
  mobile_chrome: KIT,
  tint_elite: [...KIT, 'filmBrandsList', 'reviewMode'],
  tint_obsidian: [...KIT, 'howSteps', 'filmBrandsList', 'shadeGuide'],
  mobile_sudsy: [...KIT, 'howSteps', 'whyCards'],
  wheel_apex: [...KIT, 'products', 'wheelBrands', 'trustBar', 'tickerItems'],
  mechanic_ironclad: [...KIT, 'whyCards'],
  carwash_bubble: [...KIT, 'howSteps', 'whyCards'],
  mobile_redline: [
    ...KIT, 'trustBar', 'reviewMode', 'heroServices', 'googleBadge', 'footerBuilder', 'sectionTitles', 'featuredService', 'vehicleMakes',
    'serviceDetails', 'serviceAreas', 'insured', 'ctaImage', 'reviewSources',
  ],
  // Legacy templates (hidden from the picker; some saved sites use them).
  detailing_coastal: ['ctaPrimaryUrl', 'ctaSecondaryUrl', 'aboutStats'],
  detailing_autosync_dark: ['ctaPrimaryUrl', 'ctaSecondaryUrl', 'aboutStats'],
  detailing_autosync_white: ['ctaPrimaryUrl', 'ctaSecondaryUrl', 'aboutStats'],
  mobile_bold: ['ctaPrimaryUrl', 'ctaSecondaryUrl', 'aboutStats'],
  mobile_modern: ['aboutStats'],
  mobile_rugged: [],
  wheel_edge: ['ctaPrimaryUrl', 'aboutStats', 'wheelBrands'],
  wheel_clean: ['ctaPrimaryUrl', 'ctaSecondaryUrl', 'aboutStats', 'wheelBrands'],
  tint_dark: ['ctaPrimaryUrl', 'filmBrandsList'],
  tint_sleek: ['ctaPrimaryUrl', 'filmBrandsList'],
  mechanic_friendly: ['ctaPrimaryUrl', 'ctaSecondaryUrl'],
};

// An unknown template id gets the kit's common controls and no
// template-specific tabs.
export function templateReads(templateId, key) {
  const reads = TEMPLATE_READS[templateId] || KIT;
  return reads.includes(key);
}

// Help text that describes the other designs and is wrong for one: most
// templates turn a 4th gallery photo into a carousel, show a trust bar and
// send Button 2 to the phone. Keyed by template id, then by the spot in
// ContentEditor that shows it (templateHelp falls back to the shared text).
export const TEMPLATE_HELP = {
  mobile_redline: {
    gallery: 'Your photos show as a grid on your site, as many as you add.',
    trustBar: 'With none of your own, the chips under your headline show facts from Business Info: We Come to You for a mobile business, and Fully Insured when that switch is on. Your own items (up to 4) replace them.',
    button2Url: 'Button 2 URL (default: from its text)',
  },
};
export function templateHelp(templateId, spot) {
  return TEMPLATE_HELP[templateId]?.[spot] || null;
}

// Where each template shows the Google badge while copy.googleBadge is
// unset: the default list of its googleBadgePlacements call
// (editorCapabilities.test.js parses it from the source).
export const GOOGLE_BADGE_DEFAULTS = { mobile_redline: ['hero', 'footer'] };
export function googleBadgeDefaults(templateId) {
  return GOOGLE_BADGE_DEFAULTS[templateId] || [];
}

// The Edit panel's tabs, top to bottom. `needs`: the capability a tab
// depends on; `group`: where the icon rail files it. Labels are what
// template hints and PhotoSlot's PHOTO_HINTS call them ("Edit > Shades"),
// which editorCapabilities.test.js checks.
export const EDITOR_TABS = [
  { id: 'visibility', label: 'Sections', group: 'top' },
  { id: 'hero', label: 'Hero', group: 'content' },
  { id: 'headings', label: 'Headings', group: 'content', needs: 'sectionTitles' },
  { id: 'services', label: 'Services', group: 'content' },
  { id: 'featured', label: 'Featured Service', group: 'content', needs: 'featuredService' },
  { id: 'howItWorks', label: 'How It Works', group: 'content', needs: 'howSteps' },
  { id: 'whyUs', label: 'Why Us', group: 'content', needs: 'whyCards' },
  { id: 'products', label: 'Products', group: 'content', needs: 'products' },
  { id: 'brands', label: 'Brands', group: 'content', needs: 'wheelBrands' },
  { id: 'filmBrands', label: 'Film Brands', group: 'content', needs: 'filmBrandsList' },
  { id: 'makes', label: 'Vehicle Makes', group: 'content', needs: 'vehicleMakes' },
  { id: 'shadeGuide', label: 'Shades', group: 'content', needs: 'shadeGuide' },
  { id: 'trustBar', label: 'Trust Bar', group: 'content', needs: 'trustBar' },
  { id: 'ticker', label: 'Ticker', group: 'content', needs: 'tickerItems' },
  { id: 'about', label: 'About', group: 'content' },
  { id: 'gallery', label: 'Gallery', group: 'content' },
  { id: 'testimonials', label: 'Reviews', group: 'content' },
  { id: 'google', label: 'Google Rating', group: 'content', needs: 'googleBadge' },
  // (An Instagram tab stays off pending Meta App Review.)
  { id: 'contact', label: 'Contact', group: 'content' },
  { id: 'colors', label: 'Colors & Fonts', group: 'design' },
  { id: 'footer', label: 'Footer', group: 'design' },
  { id: 'business', label: 'Business Info', group: 'settings', needs: 'businessInfo' },
  { id: 'template', label: 'Template', group: 'settings', needs: 'switchTemplate' },
];

// Tabs for this template. canEditBusiness / canSwitchTemplate: whether the
// editor was given the matching callbacks.
export function editorTabs(templateId, { canEditBusiness = false, canSwitchTemplate = false } = {}) {
  return EDITOR_TABS.filter((tab) => {
    if (!tab.needs) return true;
    if (tab.needs === 'businessInfo') return canEditBusiness;
    if (tab.needs === 'switchTemplate') return canSwitchTemplate;
    return templateReads(templateId, tab.needs);
  });
}

// Tint shade guide (tint_obsidian): whether the published page shows it,
// mirroring TintObsidian's rule. The starter shades only appear for a
// business that sells tint (tint shop, a service named for tint or window
// film, or the tint wizard's "Film Brands Used"); the owner's own shades or
// showShadeGuide === true show it anywhere; showShadeGuide === false or
// hiding the section removes it.
export function shadeGuideState(copy, businessInfo) {
  const txt = (v) => (typeof v === 'string' ? v.trim() : '');
  const list = (v) => (Array.isArray(v) ? v : []);
  const biz = businessInfo || {};
  const ownShades = list(copy?.shadeGuide).filter((s) => s && (txt(String(s.vlt ?? '')) || txt(s.name)));
  const tintService = [...list(biz.packages), ...list(biz.services)]
    .some((s) => /\btint(s|ed|ing)?\b|window film/i.test(typeof s === 'string' ? s : txt(s?.name)));
  const filmBrands = Array.isArray(biz.filmBrands)
    ? biz.filmBrands.some((b) => txt(b))
    : Boolean(txt(biz.filmBrands));
  const sellsTint = /tint/i.test(txt(biz.businessType)) || tintService || filmBrands;
  const hiddenInSections = list(copy?.hiddenSections).includes('shadeGuide');
  const switchedOff = copy?.showShadeGuide === false;
  const shown = !hiddenInSections && !switchedOff
    && (ownShades.length > 0 || sellsTint || copy?.showShadeGuide === true);
  return { shown, sellsTint, hasOwnShades: ownShades.length > 0, hiddenInSections, switchedOff };
}
