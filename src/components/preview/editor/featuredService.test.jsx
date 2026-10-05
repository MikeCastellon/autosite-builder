// Featured Service: the automatic pick is MobileRedline's (first ceramic /
// coating service), copy.featuredService is stored cleaned, and the panel
// and the CTA photo field render on the server (node, no DOM).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURES } from '../templates/__fixtures__/businesses.js';
import { featuredMatch, setFeaturedField, MAX_BULLETS, leftoverFields, clearLeftovers, featuredSummaryService } from './featuredService.js';
import * as sporty from '../templates/detailing/DetailingSporty.jsx';
import { createElement } from 'react';
import { buildTemplateMeta } from '../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../lib/normalizeBusinessInfo.js';
import * as redline from '../templates/mobile/MobileRedline.jsx';
import { serviceList } from './serviceRefs.js';
import FeaturedServicePanel from './FeaturedServicePanel.jsx';
import CtaPhotoField from './CtaPhotoField.jsx';

const SERVICES = [
  { name: 'Full Detail', price: '$149', summary: '' },
  { name: 'Ceramic Coating', price: '$299', summary: '' },
  { name: 'Graphene Coating', price: '$899', summary: '' },
];
const noop = () => {};
const panel = (props) => renderToStaticMarkup(
  <FeaturedServicePanel copy={{}} setCopy={noop} businessInfo={{ services: SERVICES }} images={{}} setImage={noop} siteId="s" {...props} />,
);

describe('featuredMatch', () => {
  it('features the first ceramic / coating service automatically', () => {
    expect(featuredMatch({}, SERVICES)).toEqual({ name: 'Ceramic Coating', service: SERVICES[1], automatic: true });
    expect(featuredMatch({ featuredService: { serviceName: '  ' } }, SERVICES).automatic).toBe(true);
  });

  it('uses the chosen name, matched by key', () => {
    expect(featuredMatch({ featuredService: { serviceName: 'full-detail' } }, SERVICES)).toEqual({ name: 'full-detail', service: SERVICES[0], automatic: false });
    expect(featuredMatch({ featuredService: { serviceName: 'Window Tint' } }, SERVICES)).toEqual({ name: 'Window Tint', service: null, automatic: false });
  });

  it('features nothing when no service matches', () => {
    expect(featuredMatch({}, [{ name: 'Wash', price: '$20' }])).toEqual({ name: '', service: null, automatic: true });
    expect(featuredMatch(null, null)).toEqual({ name: '', service: null, automatic: true });
  });
});

describe('setFeaturedField', () => {
  it('sets and removes one field, returning a new object', () => {
    const copy = { featuredService: { serviceName: 'Ceramic Coating', priceFrom: '$600' } };
    expect(setFeaturedField(copy, 'buttonText', 'Explore')).toEqual({ serviceName: 'Ceramic Coating', priceFrom: '$600', buttonText: 'Explore' });
    expect(setFeaturedField(copy, 'priceFrom', '')).toEqual({ serviceName: 'Ceramic Coating' });
    expect(setFeaturedField(copy, 'priceFrom', null)).toEqual({ serviceName: 'Ceramic Coating' });
    expect(copy.featuredService).toEqual({ serviceName: 'Ceramic Coating', priceFrom: '$600' });
  });

  it('keeps benefit rows as typed and drops an empty list', () => {
    expect(setFeaturedField({}, 'bullets', ['Gloss', ''])).toEqual({ bullets: ['Gloss', ''] });
    expect(setFeaturedField({ featuredService: { bullets: ['Gloss'], buttonUrl: '#contact' } }, 'bullets', [])).toEqual({ buttonUrl: '#contact' });
  });

  it('cleans leftovers and returns null when nothing is left', () => {
    expect(setFeaturedField({ featuredService: { serviceName: 'X', buttonText: '', bullets: [] } }, 'serviceName', '')).toBe(null);
    expect(setFeaturedField({}, 'priceFrom', '   ')).toBe(null);
    expect(setFeaturedField({ featuredService: 'bad' }, 'buttonUrl', 'https://example.com')).toEqual({ buttonUrl: 'https://example.com' });
    // Unknown keys are not written.
    expect(setFeaturedField({}, 'headline', 'Hi')).toBe(null);
  });

  it('caps the benefits at 8', () => {
    expect(MAX_BULLETS).toBe(8);
  });
});

describe('FeaturedServicePanel', () => {
  it('offers the automatic match for the full fixture business', () => {
    const { businessInfo, generatedCopy } = FIXTURES.full;
    expect(serviceList(businessInfo, generatedCopy).map((s) => s.name)).toContain('Ceramic Coating');
    const out = panel({ businessInfo, copy: generatedCopy });
    expect(out).toContain('<option value="" selected="">Automatic (Ceramic Coating)</option>');
    expect(out).toContain('<option value="Full Detail">Full Detail</option>');
    expect(out).toContain('Something else…');
    expect(out).toContain('placeholder="$299"');
    expect(out).toContain('placeholder="Book Ceramic Coating"');
    expect(out).not.toContain('Pick a service to feature.');
  });

  it('selects a chosen service', () => {
    const out = panel({ copy: { featuredService: { serviceName: 'full detail' } } });
    expect(out).toContain('<option value="Full Detail" selected="">Full Detail</option>');
    expect(out).not.toContain('>Name<');
  });

  it("selects 'Something else' for a name that is no service and shows it", () => {
    const out = panel({ copy: { featuredService: { serviceName: 'Window Tint' } } });
    expect(out).toContain('<option value="__other" selected="">Something else…</option>');
    expect(out).toContain('value="Window Tint"');
    expect(out).toContain('Clear featured settings');
  });

  it('asks for a pick when nothing matches', () => {
    const out = panel({ businessInfo: { services: [{ name: 'Wash', price: '$20' }] } });
    expect(out).toContain('Automatic (none found)');
    expect(out).toContain('Pick a service to feature. Until then this band only shows when one of your services is a ceramic coating.');
    expect(out).toContain('placeholder="e.g. $600"');
    expect(out).toContain('placeholder="Book Now"');
    expect(out).not.toContain('Clear featured settings');
  });

  it('lists the benefit rows', () => {
    const out = panel({ copy: { featuredService: { bullets: ['Long-lasting protection', 'Enhanced gloss'] } } });
    expect(out).toContain('value="Long-lasting protection"');
    expect(out).toContain('aria-label="benefit 2"');
    expect(out).toContain('+ Add benefit');
  });

  it('has the Featured Photo upload slot', () => {
    expect(panel()).toContain('Upload Featured Photo');
    expect(panel({ images: { featured: '/f.jpg' } })).toContain('src="/f.jpg"');
  });

  it('notes a band switched off in Sections', () => {
    expect(panel({ copy: { hiddenSections: ['featured'] } })).toContain('This band is switched off in Sections.');
    expect(panel({ copy: { hiddenSections: ['gallery'] } })).not.toContain('switched off');
  });

  it('points at the Headings tab only when there is one', () => {
    expect(panel({ hasHeadingsTab: true })).toContain('Edit &gt; Headings');
    expect(panel()).not.toContain('Headings');
  });
});

describe('CtaPhotoField', () => {
  it('renders the CTA Background upload slot', () => {
    const out = renderToStaticMarkup(<CtaPhotoField images={{}} setImage={noop} siteId="s" />);
    expect(out).toContain('Upload CTA Background');
    expect(out).toContain('darkened so the text stays readable');
    expect(renderToStaticMarkup(<CtaPhotoField images={{ cta: '/c.jpg' }} setImage={noop} siteId="s" />)).toContain('src="/c.jpg"');
    expect(renderToStaticMarkup(<CtaPhotoField images={{}} setImage={noop} siteId="s" hidden />)).toContain('This band is switched off in Sections.');
    expect(renderToStaticMarkup(<CtaPhotoField images={{}} setImage={noop} siteId="s" />)).not.toContain('switched off');
  });
});

describe('another service picked (leftover settings)', () => {
  const copy = {
    featuredService: { serviceName: 'Premium Detail', priceFrom: '$600', bullets: ['3-5 year coating', ''], buttonText: 'Explore Ceramic Coating', buttonUrl: '/x' },
    sectionTitles: { featured: { eyebrow: '3-5 Year Coating', title: 'Protect Your Vehicle' }, about: { title: 'Us' } },
  };

  it('lists the settings written for one service, the heading included', () => {
    expect(leftoverFields(copy).map((f) => f.key)).toEqual(['priceFrom', 'bullets', 'buttonText', 'heading']);
    expect(leftoverFields({ featuredService: { serviceName: 'X', bullets: [' '] } })).toEqual([]);
    expect(leftoverFields({})).toEqual([]);
  });

  it('lists the band photo last, only when there is one', () => {
    expect(leftoverFields(copy, { featured: 'https://x/featured.jpg' }).map((f) => f.key)).toEqual(['priceFrom', 'bullets', 'buttonText', 'heading', 'photo']);
    expect(leftoverFields({}, { featured: 'https://x/featured.jpg' })).toEqual([{ key: 'photo', label: 'Featured Photo' }]);
    expect(leftoverFields(copy, { featured: null }).map((f) => f.key)).not.toContain('photo');
    expect(leftoverFields(copy, { hero: 'https://x/hero.jpg' }).map((f) => f.key)).not.toContain('photo');
  });

  it('clears them in one value, keeping the name and the link', () => {
    expect(clearLeftovers(copy)).toEqual({ serviceName: 'Premium Detail', buttonUrl: '/x' });
    expect(clearLeftovers({ featuredService: { priceFrom: '$1' } })).toBe(null);
  });

  it('shows the heading the band has now, the design\'s or the owner\'s', () => {
    const out = panel({ hasHeadingsTab: true, headingDefaults: redline.headingDefaults });
    expect(out).toContain('Heading on the page: <span class="text-gray-700">“Protect Your Vehicle With Ceramic Coating”</span>');
    expect(panel({ hasHeadingsTab: true, headingDefaults: redline.headingDefaults, copy: { sectionTitles: { featured: { title: 'Our Coating' } } } })).toContain('“Our Coating”');
  });

  it('flags a starting price without a number and a link that will not work', () => {
    expect(panel({ copy: { featuredService: { priceFrom: 'Call for quote' } } })).toContain('without &#x27;Starting at&#x27;');
    expect(panel({ copy: { featuredService: { buttonUrl: 'calendly' } } })).toContain('Start the link with https://');
    expect(panel({ copy: { featuredService: { buttonUrl: 'calendly.com/x' } } })).not.toContain('Start the link with');
  });
});

// Themes whose band is opt-in (editorCapabilities FEATURED_AUTOMATIC false):
// no chosen service means no band, never an automatic ceramic pick.
describe('opt-in band (automatic: false)', () => {
  it('featuredMatch picks nothing without a chosen name', () => {
    expect(featuredMatch({}, SERVICES, { automatic: false })).toEqual({ name: '', service: null, automatic: true });
    expect(featuredMatch({ featuredService: { serviceName: 'full detail' } }, SERVICES, { automatic: false }).service).toBe(SERVICES[0]);
    expect(featuredMatch({}, SERVICES).name).toBe('Ceramic Coating');
  });

  it("the panel offers 'None (no band)' and asks for a pick", () => {
    const out = panel({ automatic: false });
    expect(out).toContain('<option value="" selected="">None (no band)</option>');
    expect(out).not.toContain('Automatic (');
    expect(out).toContain('Pick a service to add this band to your page.');
    expect(out).not.toContain('ceramic coating.');
    // Nothing else to set until a service is picked: the band is not on the
    // page, so price, benefits, button and photo would change nothing.
    expect(out).toContain('Its price, benefits, button and photo can be set once you pick a service.');
    expect(out).not.toContain('Starting price');
    expect(out).not.toContain('Featured Photo');
    expect(out).not.toContain('placeholder="Book Now"');
    // Saved details without a service can still be cleared.
    expect(panel({ copy: { featuredService: { priceFrom: '$450' } }, automatic: false })).toContain('Clear featured settings');
    // An automatic band keeps every field.
    expect(panel({})).toContain('Starting price');
  });

  it('the template can word the empty button link (linkHelp)', () => {
    const copy = { featuredService: { serviceName: 'Ceramic Coating' } };
    expect(panel({ copy, automatic: false })).toContain('or calls you while booking is off.');
    expect(panel({ copy, automatic: false, linkHelp: 'Goes to your contact section.' })).toContain('Goes to your contact section.');
  });

  it('a chosen service reads the same as with an automatic band', () => {
    const copy = { featuredService: { serviceName: 'Ceramic Coating' } };
    const out = panel({ copy, automatic: false });
    expect(out).toContain('<option value="Ceramic Coating" selected="">Ceramic Coating</option>');
    expect(out).toContain('placeholder="$299"');
    expect(out).not.toContain('Pick a service');
  });
});

describe('featuredSummaryService', () => {
  const pkgs = [
    { name: 'Full Detail', price: '$149', summary: 'Inside and out.' },
    { name: 'Ceramic Coating', price: '$899', summary: 'Gloss for years.' },
  ];
  const chosen = (fs, extra = {}) => ({ featuredService: { serviceName: 'ceramic coating', ...fs }, ...extra });

  it('names the band\'s service while the band lists no benefits and has no intro of its own', () => {
    expect(featuredSummaryService(chosen({}), pkgs, { automatic: false })).toBe('Ceramic Coating');
    expect(featuredSummaryService(chosen({ bullets: ['Gloss'] }), pkgs, { automatic: false })).toBe('');
    expect(featuredSummaryService(chosen({ bullets: [' ', ''] }), pkgs, { automatic: false })).toBe('Ceramic Coating');
    expect(featuredSummaryService(chosen({}, { sectionTitles: { featured: { intro: 'Our best.' } } }), pkgs, { automatic: false })).toBe('');
    // The package's own included items are the band's benefits; a group heading alone is not.
    const withIncludes = pkgs.map((p, i) => (i === 1 ? { ...p, includes: ['Paint:', 'Clay bar'] } : p));
    expect(featuredSummaryService(chosen({}), withIncludes, { automatic: false })).toBe('');
    expect(featuredSummaryService(chosen({}), pkgs.map((p, i) => (i === 1 ? { ...p, includes: ['Paint:'] } : p)), { automatic: false })).toBe('Ceramic Coating');
  });

  it('follows the opt-in rule: no choice is no band, unless the design picks a coating itself', () => {
    expect(featuredSummaryService({}, pkgs, { automatic: false })).toBe('');
    expect(featuredSummaryService({}, pkgs, { automatic: true })).toBe('Ceramic Coating');
    expect(featuredSummaryService(chosen({}, { featuredService: { serviceName: 'Window Tint' } }), pkgs, { automatic: false })).toBe('');
  });

  it('matches what an opt-in design prints: the summary is the band\'s intro exactly then', () => {
    const render = (copy, services) => renderToStaticMarkup(createElement(sporty.default, {
      businessInfo: normalizeBusinessInfo({ ...FIXTURES.full.businessInfo, services }),
      generatedCopy: { ...FIXTURES.full.generatedCopy, ...copy },
      templateMeta: buildTemplateMeta('detailing_sporty', {}, {}),
      images: {},
    }));
    const band = (html) => {
      const at = html.indexOf('data-section="featured"');
      return at < 0 ? '' : html.slice(at, html.indexOf('</section>', at));
    };
    const withIncludes = pkgs.map((p, i) => (i === 1 ? { ...p, includes: ['Clay bar'] } : p));
    for (const [copy, services] of [[chosen({}), pkgs], [chosen({ bullets: ['Gloss'] }), pkgs], [chosen({}), withIncludes], [chosen({}, { sectionTitles: { featured: { intro: 'Our best.' } } }), pkgs]]) {
      const named = featuredSummaryService(copy, services, { automatic: false });
      expect({ copy, shown: band(render(copy, services)).includes('Gloss for years.') }).toEqual({ copy, shown: named === 'Ceramic Coating' });
    }
  });
});
