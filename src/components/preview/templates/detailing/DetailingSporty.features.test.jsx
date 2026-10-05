// detailing_sporty's owner-editable features (Redline's set, through the
// kit's feature blocks: hero services card, Google rating, footer builder,
// package details, headings, featured and makes bands, service areas,
// insured, Google review labels, contact photo). This design has live
// sites, so every feature is opt-in: a site that saved none of the new keys
// renders exactly as before, and a feature, once set, adds only its own
// markup. The shared contract is in templates.render.test.jsx.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './DetailingSporty.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { contrastRatio } from '../kit/theme.js';
import { FIXTURES, FIXTURE_IMAGES, CUSTOM_COLORS, CUSTOM_FONTS } from '../__fixtures__/businesses.js';

const Sporty = mod.default;
const ID = 'detailing_sporty';

// Same list as templates.render.test.jsx BANNED_CLAIMS (keep in sync).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[★☆⭐]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');
const LOW_CONTRAST_COLORS = { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' };

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
// The rendered elements without the <style> block (whose selectors name
// every class), and the <style> block alone.
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const styleText = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
const count = (html, needle) => html.split(needle).length - 1;

// fx: a fixture; biz / copy / images: keys merged over it.
function render(fx, { editor = false, biz, copy, images } = {}) {
  const el = createElement(Sporty, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, fx.customColors, fx.customFonts),
    images: { ...(fx.images || {}), ...images },
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

const rootVars = (html) => {
  const style = decode(html.match(/^<div[^>]*\bstyle="([^"]*)"/)[1]);
  const vars = {};
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) vars[decl.slice(0, i)] = decl.slice(i + 1);
  }
  return vars;
};
const sectionTag = (html, id) => {
  const m = html.match(new RegExp(`<[a-z]+\\b[^>]*\\bdata-section="${id}"[^>]*>`));
  return m ? { tag: m[0], at: m.index, order: Number((m[0].match(/order:(-?\d+)/) || [])[1]) } : null;
};

const PLACE = { placeId: 'ChIJsporty-test', placeName: 'AutoSite Demo Shop', rating: 4.8, reviewCount: 52 };
const FULL = FIXTURES.full;
const SERVICES = FULL.businessInfo.services;
const QUOTES = FULL.generatedCopy.testimonialPlaceholders;

// One feature at a time, over the full fixture (no saved order). Each entry
// is the data that switches it on and the markup only it may add.
const FEATURES = {
  heroCard: { copy: { heroCard: 'quote' }, marker: 'id="quote"', css: '.ds-hq-sr{' },
  badge: { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: ['hero'] } }, marker: 'acg-gbadge' },
  footer: { copy: { footer: { columns: [{ type: 'contact' }, { type: 'brand' }, { type: 'hours' }, { type: 'links' }] } }, marker: 'ds-fb' },
  packages: {
    biz: { services: SERVICES.map((s, i) => (i === 1 ? { ...s, badge: 'Most Popular', includes: ['Paint:', 'Clay bar', { text: 'Sealant', highlight: true }] } : s)) },
    marker: 'ds-pk-',
    css: '.ds-pk-card-photo img{',
  },
  headings: { copy: { sectionTitles: { about: { eyebrow: 'Who We Are' } } }, marker: 'Who We Are' },
  featured: { copy: { featuredService: { serviceName: 'Ceramic Coating', priceFrom: '$299' } }, marker: 'data-section="featured"', css: '.ds-ft-feat-list li{' },
  makes: { copy: { vehicleMakes: ['BMW', 'Porsche'] }, marker: 'data-section="brands"', css: '@keyframes ds-mk-scroll' },
  areas: { biz: { serviceAreas: ['Northside', 'Lakeview'] }, marker: 'Areas we serve' },
  insured: { biz: { insured: true }, marker: 'Fully insured' },
  reviews: { copy: { testimonialPlaceholders: [{ ...QUOTES[0], source: 'google', rating: 5 }, ...QUOTES.slice(1)] }, marker: 'ds-rev-' },
  ctaPhoto: { images: { cta: FIXTURE_IMAGES.gallery0 }, marker: 'ds-band-has-photo' },
};
const BLOCK_CSS = Object.values(FEATURES).map((f) => f.css).filter(Boolean);

describe('detailing_sporty features: sites without them do not change', () => {
  it.each([false, true])('a googlePlace alone (stored by the wizard since March) changes nothing (editor %s)', (editor) => {
    expect(render(FULL, { editor, biz: { googlePlace: PLACE } })).toBe(render(FULL, { editor }));
  });

  it.each([
    ['heroCard off', { copy: { heroCard: 'off' } }],
    ['heroCard unknown', { copy: { heroCard: 'banner' } }],
    ['heroServices without heroCard', { copy: { heroServices: ['Full Detail'] } }],
    ['footer null', { copy: { footer: null } }],
    ['featuredService empty', { copy: { featuredService: {} } }],
    ['vehicleMakes empty', { copy: { vehicleMakes: [] } }],
    ['vehicleMakes blank string', { copy: { vehicleMakes: ' ' } }],
    ['googleBadge empty', { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: [] } } }],
    ['googleBadge without a place', { copy: { googleBadge: { placements: ['hero', 'nav', 'about', 'reviews', 'footer'] } } }],
    ['sectionTitles empty', { copy: { sectionTitles: {} } }],
    ['serviceAreas empty', { biz: { serviceAreas: [] } }],
    ['insured false', { biz: { insured: false } }],
    ['insured "yes"', { biz: { insured: 'yes' } }],
    ['review from another source', { copy: { testimonialPlaceholders: [{ ...QUOTES[0], source: 'yelp', rating: 5 }, ...QUOTES.slice(1)] } }],
  ])('%s renders like the full fixture', (_, delta) => {
    for (const editor of [false, true]) expect(render(FULL, { editor, ...delta })).toBe(render(FULL, { editor }));
  });

  // The shared fixtures that hold none of the new keys (FIXTURES.features
  // sets them all up).
  it.each(['sparse', 'full', 'custom'])('adds no feature markup or CSS to the %s fixture', (name) => {
    for (const editor of [false, true]) {
      const html = render(FIXTURES[name], { editor });
      for (const f of Object.values(FEATURES)) expect(markup(html)).not.toContain(f.marker);
      for (const css of [...BLOCK_CSS, '.ds-gpill{']) expect(styleText(html)).not.toContain(css);
      expect(html).not.toMatch(/data-section="(brands|featured)"/);
    }
  });
});

describe('detailing_sporty features: each one alone adds only its own markup', () => {
  it.each(Object.keys(FEATURES))('%s', (key) => {
    const f = FEATURES[key];
    for (const editor of [false, true]) {
      const html = render(FULL, { editor, biz: f.biz, copy: f.copy, images: f.images });
      expect(markup(html), key).toContain(f.marker);
      for (const [other, g] of Object.entries(FEATURES)) {
        if (other !== key) expect({ key, other, found: markup(html).includes(g.marker) }).toEqual({ key, other, found: false });
      }
      // Only this feature's kit CSS joins the <style>, plus FEATURE_CSS.
      const css = styleText(html);
      for (const block of BLOCK_CSS) expect({ key, block, found: css.includes(block) }).toEqual({ key, block, found: block === f.css });
      expect(css).toContain('.ds-gpill{');
    }
  });
});

describe('detailing_sporty features: section order', () => {
  const legacyIds = mod.sections.map((s) => s.id).filter((id) => !mod.addedSections.includes(id));
  const ALL = { ...FEATURES.featured.copy, ...FEATURES.makes.copy };

  it('declares the added ids, and only ids it has', () => {
    expect(mod.addedSections).toEqual(['brands', 'featured']);
    expect(legacyIds).toEqual(['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta', 'awards']);
    expect(mod.sections.map((s) => s.id)).toEqual(['hero', 'statsBar', 'brands', 'services', 'featured', 'about', 'gallery', 'testimonials', 'cta', 'awards']);
  });

  it('puts an unsaved band right after the section before it (same order, next in the DOM)', () => {
    const html = render(FULL, { copy: ALL });
    const [services, featured, about] = ['services', 'featured', 'about'].map((id) => sectionTag(html, id));
    expect(featured.order).toBe(services.order);
    expect(featured.at).toBeGreaterThan(services.at);
    expect(featured.at).toBeLessThan(about.at);
    const [stats, brands] = ['statsBar', 'brands'].map((id) => sectionTag(html, id));
    expect(brands.order).toBe(stats.order);
    expect(brands.at).toBeGreaterThan(stats.at);
    expect(brands.at).toBeLessThan(services.at);
  });

  it.each([
    ['no saved order', {}],
    ['a saved order without the new ids', { sectionOrder: ['hero', 'about', 'services', 'testimonials', 'gallery', 'cta'] }],
    ['a full saved order', { sectionOrder: ['cta', ...legacyIds.filter((id) => id !== 'cta')] }],
  ])('keeps every older section on its old order value (%s)', (_, saved) => {
    const copy = { ...FULL.generatedCopy, ...ALL, ...saved };
    const html = render(FULL, { copy });
    const old = buildSectionOrder(copy, legacyIds);
    for (const id of legacyIds) {
      const s = sectionTag(html, id);
      if (s) expect({ id, order: s.order }).toEqual({ id, order: old(id) });
    }
  });

  it('a slot the owner saved for a band wins', () => {
    const html = render(FULL, { copy: { ...ALL, sectionOrder: ['featured', 'hero', 'statsBar', 'services', 'brands', 'about'] } });
    expect(sectionTag(html, 'featured').order).toBe(0);
    expect(sectionTag(html, 'brands').order).toBe(4);
  });

  it('hiding a band removes it', () => {
    const html = render(FULL, { copy: { ...ALL, hiddenSections: ['featured', 'brands'] } });
    expect(sectionTag(html, 'featured')).toBe(null);
    expect(sectionTag(html, 'brands')).toBe(null);
  });
});

describe('detailing_sporty features: hero services card', () => {
  it('shows the price card with the owner\'s priced picks, beside the copy, never revealed', () => {
    const html = render(FULL, { copy: { heroCard: 'quote', heroServices: ['Paint Correction', 'Full Detail', 'Nope'] } });
    const hero = html.slice(sectionTag(html, 'hero').at, html.indexOf('</header>'));
    expect(hero).toContain('ds-hero-offer');
    expect(hero).toContain('class="ds-wrap ds-hq-grid"');
    expect(count(hero, 'name="ds-hq-pkg"')).toBe(2);
    expect(hero.indexOf('Paint Correction')).toBeLessThan(hero.indexOf('Full Detail'));
    expect(hero).not.toContain('data-acg-reveal');
    expect(styleText(html)).toContain('@container (min-width:1024px){');
  });

  it('list mode lists the packages and links to them', () => {
    const html = render(FULL, { copy: { heroCard: 'list' } });
    expect(html).toContain('class="ds-hq-quote ds-hq-hlist"');
    expect(html).toMatch(/<a class="ds-hq-hl-cta" href="#services">See All Services<svg/);
  });

  it('sits under the copy in the split hero', () => {
    const html = render(FULL, { copy: { heroCard: 'quote', heroLayout: 'split' } });
    const hero = html.slice(sectionTag(html, 'hero').at, html.indexOf('</header>'));
    expect(hero).toContain('class="ds-split-text"');
    expect(hero).toContain('class="ds-hq-slot"');
    expect(hero).not.toContain('data-acg-reveal');
  });

  it('without priced packages: no card, and the editor says why', () => {
    const biz = { services: SERVICES.map((s) => ({ ...s, price: '' })) };
    const pub = render(FULL, { biz, copy: { heroCard: 'quote' } });
    expect(pub).not.toContain('id="quote"');
    expect(markup(pub)).toBe(markup(render(FULL, { biz })));
    expect(render(FULL, { editor: true, biz, copy: { heroCard: 'quote' } })).toContain('Your price card needs services with a price');
  });
});

describe('detailing_sporty features: Google rating badge', () => {
  const WRAP = { hero: 'ds-hero-g', nav: 'ds-nav-g', about: 'ds-about-g', reviews: 'ds-rev-g', footer: 'ds-foot-g' };

  it('shows nowhere by default', () => {
    expect(render(FULL, { biz: { googlePlace: PLACE } })).not.toContain('acg-gbadge');
    expect(mod.footerSpec.cta).toBe(false);
  });

  it.each(Object.keys(WRAP))('shows in %s only when switched on there', (spot) => {
    const html = markup(render(FULL, { biz: { googlePlace: PLACE }, copy: { googleBadge: { placements: [spot] } } }));
    for (const [other, cls] of Object.entries(WRAP)) expect({ other, on: html.includes(`class="${cls}"`) }).toEqual({ other, on: other === spot });
    expect(count(html, 'acg-gbadge ')).toBe(1);
    expect(visibleText(html)).toMatch(/4\.8 · 52/);
  });

  it('moves the footer rating to the bottom bar when the brand column is off', () => {
    const html = markup(render(FULL, {
      biz: { googlePlace: PLACE },
      copy: { googleBadge: { placements: ['footer'] }, footer: { columns: [{ type: 'brand', show: false }, { type: 'contact' }] } },
    }));
    const bottom = html.slice(html.indexOf('class="ds-foot-bottom"'));
    expect(bottom).toContain('class="ds-foot-g"');
    expect(html).not.toContain('ds-foot-brand');
  });
});

describe('detailing_sporty features: footer builder', () => {
  const heads = (html) => [...markup(html).matchAll(/<p class="ds-foot-h">([^<]*)<\/p>/g)].map((m) => m[1]);

  it('follows the owner\'s columns, order and titles; Service Areas lists their areas', () => {
    const html = render(FULL, {
      biz: { serviceAreas: ['Northside', 'Lakeview'] },
      copy: { footer: { columns: [{ type: 'contact', title: 'Reach Us' }, { type: 'hours' }, { type: 'brand', show: false }, { type: 'links', title: 'More' }, { type: 'areas' }] } },
    });
    expect(heads(html)).toEqual(['Reach Us', 'Hours', 'More', 'Service Areas']);
    expect(markup(html)).not.toContain('ds-foot-brand');
    expect(markup(html)).toContain('style="--ds-fcols:repeat(4,minmax(0,1fr))"');
    expect(markup(html)).not.toContain('ds-foot-cta');
  });

  it('keeps the design\'s columns while the owner saved none, and the brand column first is wider', () => {
    expect(heads(render(FULL))).toEqual(['Explore', 'Contact', 'Hours']);
    const html = render(FULL, { copy: { footer: { showCta: false } } });
    expect(heads(html)).toEqual(['Explore', 'Contact', 'Hours']);
    expect(markup(html)).toContain('--ds-fcols:minmax(0,1.4fr) repeat(3,minmax(0,1fr))');
  });

  it('shows the footer button only once the owner turns it on', () => {
    expect(markup(render(FULL, { copy: { footer: { ctaText: 'Book a Visit' } } }))).not.toContain('ds-foot-cta');
    const books = markup(render(FULL, { copy: { footer: { showCta: true } } }));
    expect(books).toMatch(/<a class="ds-btn ds-btn-primary ds-btn-sm ds-foot-cta" href="#contact" data-scheduler-trigger="">Book Now<\/a>/);
    const own = markup(render(FULL, { copy: { footer: { showCta: true, ctaText: 'Get Started', ctaUrl: 'https://example.com/book' } } }));
    expect(own).toMatch(/<a class="ds-btn ds-btn-primary ds-btn-sm ds-foot-cta" href="https:\/\/example.com\/book">Get Started<\/a>/);
  });

  it('prints the owner\'s bottom line and keeps the copyright the last <p> (the "Site owner" link goes there)', () => {
    const html = markup(render(FULL, { copy: { footer: { bottomText: 'Licensed and insured' } } }));
    const footer = html.slice(html.indexOf('<footer'));
    expect(footer).toContain('<div class="ds-foot-note">Licensed and insured</div>');
    expect(footer).not.toContain('Serving 30-mile');
    const ps = [...footer.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
    expect(ps[ps.length - 1][1]).toContain('All rights reserved.');
  });
});

describe('detailing_sporty features: package details', () => {
  const biz = {
    services: [
      { ...SERVICES[0], image: FIXTURE_IMAGES.gallery1 },
      { ...SERVICES[1], badge: 'Most Popular', includes: ['Paint:', 'Clay bar', { text: 'Sealant', highlight: true }] },
      SERVICES[2],
    ],
  };

  it('shows the badge, photo and included list only where the owner set them', () => {
    const html = markup(render(FULL, { biz }));
    expect(count(html, 'class="ds-pk-badge"')).toBe(1);
    expect(count(html, 'class="ds-pk-inc"')).toBe(1);
    expect(html).toContain('<li class="ds-pk-inc-h">Paint:</li>');
    expect(html).toContain('<span class="ds-pk-inc-hl">Sealant</span>');
    expect(html).toContain('ds-card ds-card-feat ds-card-ph');
    expect(html).toContain('class="ds-grid ds-c3 ds-pk-row"');
    // The cards without a photo keep an empty well on the published page.
    expect(count(html, 'ds-pk-card-well')).toBe(2);
    expect(visibleText(html)).toContain("What's Included");
  });

  it('marks where to upload in the editor instead of the well', () => {
    const html = render(FULL, { biz, editor: true });
    expect(count(visibleText(html), PHOTO_HINTS.service)).toBe(2);
    expect(markup(html)).not.toContain('ds-pk-card-well');
  });

  it('never turns a description into an included list', () => {
    const html = markup(render(FULL, { biz: { services: [{ name: 'Wash', price: '$20', description: '• Foam bath\n• Tire shine\n• Windows' }] } }));
    expect(html).not.toContain('ds-pk-');
  });
});

describe('detailing_sporty features: headings', () => {
  it('uses the owner\'s eyebrow, title, highlight and intro, else today\'s text', () => {
    const copy = {
      sectionTitles: {
        hero: { eyebrow: 'Since 2016', accent: 'Most Trusted' },
        services: { eyebrow: 'The Menu', accent: 'Services' },
        about: { title: 'The Crew Behind The Shine', accent: 'The Shine' },
        gallery: { eyebrow: 'Results', title: 'Fresh Off The Line' },
        testimonials: { title: 'What Drivers Say', accent: 'Drivers Say' },
        cta: { eyebrow: 'Book', accent: 'Book' },
      },
    };
    const html = markup(render(FULL, { copy }));
    expect(html).toContain('<p class="ds-tag">Since 2016</p>');
    expect(html).not.toContain('data-acg-awards=""><svg');
    expect(html).toMatch(/Miami&#x27;s <span class="ds-em">Most Trusted<\/span> Auto Detailing Studio<\/h1>/);
    expect(html).toContain('<p class="ds-eyebrow">The Menu</p>');
    expect(html).toContain('The Crew Behind <span class="ds-em">The Shine</span></h2>');
    expect(html).toMatch(/<h2 id="ds-gallery-h" class="ds-h2" style="--ds-lw:[\d.]+">Fresh Off The Line<\/h2>/);
    expect(html).toContain('What <span class="ds-em">Drivers Say</span></h2>');
    expect(html).toContain('<p class="ds-eyebrow">Book</p>');
    expect(html).toContain('Our <span class="ds-em">Services</span></h2>');
    // A highlight that is not whole words of the heading leaves it plain.
    const plain = markup(render(FULL, { copy: { sectionTitles: { about: { accent: 'Perfect' } } } }));
    expect(plain).toContain('>Where Perfection Meets Passion</h2>');
  });

  it('headingFields name real sections; headingDefaults never throws and matches the page', () => {
    const ids = mod.sections.map((s) => s.id);
    for (const sid of Object.keys(mod.headingFields)) expect(ids).toContain(sid);
    for (const junk of [null, undefined, 'x', 42, { awards: 'x', sectionTitles: 'bad', featuredService: 'bad' }]) {
      expect(() => mod.headingDefaults(junk, junk)).not.toThrow();
    }
    const hd = mod.headingDefaults(normalizeBusinessInfo(FULL.businessInfo), FULL.generatedCopy);
    expect(Object.keys(hd).sort()).toEqual(Object.keys(mod.headingFields).sort());
    expect(hd.hero).toEqual({ eyebrow: 'Best Detail Shop 2024 — Miami New Times', title: "Miami's Most Trusted Auto Detailing Studio", accent: 'Detailing Studio' });
    expect(hd.about.title).toBe('Where Perfection Meets Passion');
    expect(hd.featured).toEqual({});
    const html = markup(render(FULL));
    expect(html).toContain(`<span class="ds-em">${hd.hero.accent}</span>`);
    expect(decode(html)).toContain(`>${hd.about.title}</h2>`);
    expect(mod.headingDefaults(normalizeBusinessInfo(FULL.businessInfo), { featuredService: { serviceName: 'Ceramic Coating' } }).featured)
      .toEqual({ title: 'Protect Your Vehicle With Ceramic Coating', accent: 'Ceramic Coating' });
  });
});

describe('detailing_sporty features: featured band', () => {
  it('features the owner\'s pick with their price and benefits, booking that service', () => {
    const html = markup(render(FULL, {
      copy: { featuredService: { serviceName: 'Ceramic Coating', priceFrom: '$299', bullets: ['Deep gloss', 'Easier washing'] }, sectionTitles: { featured: { eyebrow: 'Signature Service' } } },
      images: { featured: FIXTURE_IMAGES.gallery2 },
    }));
    const band = html.slice(sectionTag(html, 'featured').at);
    expect(band).toContain('<p class="ds-eyebrow">Signature Service</p>');
    expect(band).toContain('Protect Your Vehicle With <span class="ds-em">Ceramic Coating</span>');
    expect(band).toContain('Starting at <strong>$299</strong>');
    expect(count(band.slice(0, band.indexOf('</section>')), '<li>')).toBe(2);
    expect(band).toContain('class="ds-ft-in ds-ft-feat-grid ds-ft-duo"');
    expect(band).toMatch(/data-scheduler-trigger="" data-scheduler-service="Ceramic Coating">Book Ceramic Coating<\/a>/);
  });

  it('skips a band with nothing to say on the published page; the editor keeps it with a hint', () => {
    const copy = { featuredService: { serviceName: 'Gift Cards' } };
    expect(render(FULL, { copy })).not.toContain('data-section="featured"');
    const editor = render(FULL, { copy, editor: true });
    expect(editor).toContain('data-section="featured"');
    expect(editor).toContain('This band shows on your site once it has a photo, a price or a list of benefits');
  });

  it('never picks a service on its own', () => {
    expect(render(FULL, { editor: true })).not.toContain('data-section="featured"');
  });
});

describe('detailing_sporty features: makes, areas, insured, reviews, contact photo', () => {
  it('lists only the makes the owner ticked, under the design\'s line', () => {
    const html = markup(render(FULL, { copy: { vehicleMakes: 'BMW, Porsche, Rivian' } }));
    const band = html.slice(sectionTag(html, 'brands').at, html.indexOf('</section>', sectionTag(html, 'brands').at));
    expect(band).toContain('We Detail All Vehicle Makes &amp; Models');
    expect(band).toContain('id="ds-mk-mk-bmw"');
    expect(band).toContain('id="ds-mk-mk-porsche"');
    expect(band).not.toContain('Tesla');
  });

  it('shows the owner\'s service areas and the insured fact', () => {
    const html = markup(render(FULL, { biz: { serviceAreas: ['Northside', 'Lakeview'], insured: true } }));
    expect(html).toContain('<span class="ds-chip">Northside</span><span class="ds-chip">Lakeview</span>');
    expect(html).toContain('<li>Fully insured</li>');
    expect(html).toContain('<span class="ds-label">Insurance</span>');
  });

  it('labels only the quotes marked as Google reviews, with stars only for a 1-5 rating', () => {
    const copy = { testimonialPlaceholders: [{ ...QUOTES[0], source: 'google', rating: 5 }, QUOTES[1], { ...QUOTES[2], source: 'google', rating: 'lots' }] };
    const html = markup(render(FULL, { biz: { googlePlace: PLACE }, copy }));
    expect(count(html, '>Google review<span class="ds-sr"> (opens Google Maps)</span></a>')).toBe(2);
    expect(count(html, 'class="ds-rev-stars"')).toBe(1);
    expect(html).toContain('>See our Google reviews<span class="ds-sr"> (opens Google Maps)</span></a>');
    const noPlace = markup(render(FULL, { copy }));
    expect(count(noPlace, '<span class="ds-rev-src">Google review</span>')).toBe(2);
    expect(noPlace).not.toContain('ds-rev-more');
  });

  it('puts the contact photo behind a scrim, with text repaired on every palette', () => {
    for (const fx of [FULL, { ...FULL, customColors: CUSTOM_COLORS, customFonts: CUSTOM_FONTS }, { ...FULL, customColors: LOW_CONTRAST_COLORS }]) {
      const html = render(fx, { images: { cta: FIXTURE_IMAGES.gallery0 } });
      expect(markup(html)).toContain('class="ds-band ds-band-has-photo"');
      const v = rootVars(html);
      for (const k of ['--ds-ctaph-text', '--ds-ctaph-muted']) {
        expect(contrastRatio(v[k], v['--ds-ctaph-bg'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(v[k], v['--ds-band-bg'])).toBeGreaterThanOrEqual(4.5);
      }
      expect(v['--ds-ctaph-scrim']).toMatch(/^linear-gradient\(90deg/);
    }
    expect(Object.keys(rootVars(render(FULL))).some((k) => k.startsWith('--ds-ctaph'))).toBe(false);
  });
});

describe('detailing_sporty features: everything on', () => {
  const RICH = {
    ...FULL,
    businessInfo: {
      ...FULL.businessInfo,
      businessType: 'mobile_detailing',
      googlePlace: PLACE,
      serviceAreas: ['Northside', 'Lakeview', 'Riverbend'],
      insured: true,
      services: [
        { ...SERVICES[0], summary: 'Inside and out', image: FIXTURE_IMAGES.gallery1 },
        { ...SERVICES[1], summary: 'Years of gloss', badge: 'Most Popular', includes: ['Paint:', 'Clay bar', { text: 'Ceramic layer', highlight: true }], image: FIXTURE_IMAGES.gallery2 },
        { ...SERVICES[2], summary: 'Swirls gone', image: FIXTURE_IMAGES.gallery3 },
      ],
    },
    generatedCopy: {
      ...FULL.generatedCopy,
      heroCard: 'quote',
      heroServices: ['Full Detail', 'Ceramic Coating'],
      googleBadge: { placements: ['hero', 'nav', 'about', 'reviews', 'footer'] },
      footer: { columns: [{ type: 'brand' }, { type: 'contact' }, { type: 'hours' }, { type: 'links', title: 'More' }, { type: 'areas' }], showCta: true, ctaText: 'Book a Visit', bottomText: 'Licensed and insured' },
      sectionTitles: { services: { accent: 'Services' }, featured: { eyebrow: 'Signature Service' }, brands: { eyebrow: 'Every make welcome' } },
      featuredService: { serviceName: 'Ceramic Coating', priceFrom: '$299', bullets: ['Deep gloss', 'Easier washing'] },
      vehicleMakes: ['BMW', 'Porsche', 'Rivian'],
      testimonialPlaceholders: [{ ...QUOTES[0], source: 'google', rating: 5 }, ...QUOTES.slice(1)],
    },
    images: { ...FIXTURE_IMAGES, featured: FIXTURE_IMAGES.gallery0, cta: FIXTURE_IMAGES.about },
  };

  it('renders every feature', () => {
    const html = markup(render(RICH));
    for (const [key, f] of Object.entries(FEATURES)) {
      if (key !== 'headings') expect({ key, found: html.includes(f.marker) }).toEqual({ key, found: true });
    }
    expect(count(html, 'acg-gbadge ')).toBe(5);
    expect(count(html, 'name="ds-hq-pkg"')).toBe(2);
    expect(html).toContain('<p class="ds-mk-makes-eye">Every make welcome</p>');
    expect(html).toContain('Our <span class="ds-em">Services</span>');
    expect(html).toContain('>Book a Visit</a>');
    expect(html).toContain('<p class="ds-foot-h">More</p>');
    const styles = styleText(render(RICH));
    for (const css of BLOCK_CSS) expect(styles).toContain(css);
  });

  it('publishes no editor UI or invented claims, in any palette', () => {
    for (const fx of [RICH, { ...RICH, customColors: CUSTOM_COLORS, customFonts: CUSTOM_FONTS }, { ...RICH, customColors: LOW_CONTRAST_COLORS }]) {
      const html = render(fx);
      expect(html).not.toContain('data-acg-editor-only');
      expect(visibleText(html)).not.toMatch(/Edit >/);
      expect(visibleText(html)).not.toMatch(BANNED_CLAIMS);
    }
  });

  it('keeps the root contrast tokens readable with every feature on', () => {
    for (const fx of [RICH, { ...RICH, customColors: CUSTOM_COLORS }, { ...RICH, customColors: LOW_CONTRAST_COLORS }]) {
      const v = rootVars(render(fx));
      for (const [fg, bg] of [['--ds-ctaph-text', '--ds-ctaph-bg'], ['--ds-ctaph-muted', '--ds-ctaph-bg'], ['--ds-sf-text', '--ds-sf-bg'], ['--ds-sf-muted', '--ds-sf-bg'], ['--ds-pg-text', '--ds-pg-bg'], ['--ds-on-accent', '--ds-accent']]) {
        expect({ fg, ok: contrastRatio(v[fg], v[bg]) >= 4.5 }).toEqual({ fg, ok: true });
      }
    }
  });
});

describe('detailing_sporty features: round-1 layout and wording fixes', () => {
  it('puts the split hero card in its own grid cell after the photo, so the hero does not grow by its height', () => {
    const split = markup(render(FULL, { copy: { heroLayout: 'split', heroCard: 'quote' } }));
    expect(split).toContain('class="ds-split ds-split-offer"');
    expect(split).toMatch(/<div class="ds-split-text">((?!ds-hq-slot)[\s\S])*<div class="ds-split-photo[^"]*">[\s\S]*?<div class="ds-hq-slot">/);
    expect(styleText(render(FULL, { copy: { heroLayout: 'split', heroCard: 'quote' } }))).toContain('.ds-split-offer>.ds-hq-slot{grid-column:2;grid-row:1;');
    // No card: the split hero's markup is today's.
    expect(markup(render(FULL, { copy: { heroLayout: 'split' } }))).toContain('<header data-section="hero" class="ds-split" ');
  });

  it("draws the owner's highlighted words as an underline, and keeps the design's highlight when they no longer match", () => {
    const own = markup(render(FULL, { copy: { sectionTitles: { hero: { accent: 'Trusted' } } } }));
    expect(own).toMatch(/<h1 class="ds-h1[^"]* ds-h1-own"[^>]*>Miami&#x27;s Most <span class="ds-em">Trusted<\/span> Auto Detailing Studio<\/h1>/);
    const stale = markup(render(FULL, { copy: { sectionTitles: { hero: { accent: 'Gone Words' } } } }));
    expect(stale).not.toContain('ds-h1-own');
    expect(stale).toMatch(/<h1 class="ds-h1[^"]*"[^>]*>Miami&#x27;s Most Trusted Auto <span class="ds-em">Detailing Studio<\/span><\/h1>/);
  });

  it('sends booking links without a phone or contact section to an email, else the top', () => {
    const copy = { heroCard: 'quote', hiddenSections: ['cta'], featuredService: { serviceName: SERVICES[0].name, priceFrom: '$99' } };
    const mail = markup(render(FULL, { biz: { phone: '', email: 'shop@example.com' }, copy }));
    expect(mail).toMatch(/class="ds-btn ds-btn-inv" href="mailto:/);
    expect(mail).toMatch(/ds-hq-q-book[^"]*" href="mailto:/);
    expect(mail).not.toMatch(/ds-hq-q-book[^"]*" href="#contact"/);
    const top = markup(render(FULL, { biz: { phone: '', email: '' }, copy }));
    expect(top).toMatch(/class="ds-btn ds-btn-inv" href="#top"/);
    // With the contact section on, it stays the fallback.
    expect(markup(render(FULL, { biz: { phone: '' }, copy: { ...copy, hiddenSections: [] } }))).toMatch(/class="ds-btn ds-btn-inv" href="#contact"/);
  });

  it('moves the social icons to the contact column while the logo column is off', () => {
    const footer = { columns: [{ type: 'brand', show: false }, { type: 'contact' }, { type: 'links' }] };
    const off = markup(render(FULL, { copy: { footer } }));
    const foot = off.slice(off.indexOf('<footer'));
    expect(foot).toContain('class="ds-social"');
    expect(foot).toContain('instagram.com/autositedemo');
    // Social links alone keep the column.
    const socialOnly = markup(render(FULL, { biz: { phone: '', email: '', address: '', city: '', state: '' }, copy: { footer } }));
    expect(socialOnly.slice(socialOnly.indexOf('<footer'))).toContain('class="ds-social"');
    // With the logo column on they stay there, once.
    const on = markup(render(FULL, { copy: { footer: { columns: [{ type: 'brand' }, { type: 'contact' }] } } }));
    expect(count(on.slice(on.indexOf('<footer')), 'class="ds-social"')).toBe(1);
  });

  it('shows the Reviews heading badge with the Google reviews widget too', () => {
    const html = markup(render(FULL, { biz: { googlePlace: PLACE }, copy: { googleWidgetKey: 'w-1', googleBadge: { placements: ['reviews'] } } }));
    const rev = html.slice(html.indexOf('data-section="testimonials"'));
    expect(rev.slice(0, rev.indexOf('</section>'))).toContain('class="ds-rev-g"');
  });

  it('folds the free-text service area into the areas row', () => {
    const html = markup(render(FULL, { biz: { address: '', serviceAreas: ['Northside', 'Lakeview'] } }));
    const contact = visibleText(html.slice(html.indexOf('data-section="cta"')));
    expect(contact).toContain(`Areas we serve ${FULL.businessInfo.serviceArea} Northside Lakeview`);
    expect(contact).not.toContain('Service area');
  });
});
