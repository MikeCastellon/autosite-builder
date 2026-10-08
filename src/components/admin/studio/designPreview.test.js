import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// exportHtml only needs the client for widget_configs lookups, which the
// preview never makes (it passes no widget ids).
vi.mock('../../../lib/supabase.js', () => ({ supabase: {}, isImpersonationTab: false }));

// Bold & Sporty with its Before & After section and the More sections (a
// no-op once templateSections.js lists them; service tabs through the
// editor's capability table) and Chrome Elite without.
const { MORE } = vi.hoisted(() => ({ MORE: ['faq', 'process', 'vehicleTypes', 'comparison', 'showcase'] }));
vi.mock('../../../data/templateSections.js', async (importOriginal) => {
  const m = await importOriginal();
  const sectionIdsFor = (id) => {
    const real = m.sectionIdsFor(id);
    if (id === 'detailing_sporty') return [...real, ...['beforeAfter', ...MORE].filter((s) => !real.includes(s))];
    return id === 'mobile_chrome' ? real.filter((s) => s !== 'beforeAfter' && !MORE.includes(s)) : real;
  };
  return { ...m, sectionIdsFor };
});
vi.mock('../../preview/editorCapabilities.js', async (importOriginal) => {
  const m = await importOriginal();
  const templateReads = (id, key) => (key === 'serviceTabs' && ['detailing_sporty', 'mobile_chrome'].includes(id)
    ? id === 'detailing_sporty' : m.templateReads(id, key));
  return { ...m, templateReads };
});

const {
  PREVIEW_SANDBOX, PREVIEW_SCROLL_MESSAGE, SAMPLE_TAG,
  buildPreviewInput, framePreviewHtml, hasWrittenCopy, previewBeforeAfter, previewExtraSections, publishedTabHtml, renderPreviewHtml, sampleCopy,
  slotImages,
} = await import('./designPreview.js');
const { TEMPLATE_COMPONENT_MAP } = await import('../../../data/templates.js');
const { default: DesignPreview } = await import('./DesignPreview.jsx');
const { leverPatch } = await import('../../../lib/designLevers.js');
const { extraSectionsWrite, sanitizeDesign, siteBusinessInfo, withServiceCategories } = await import('../../../lib/customSiteDesign.js');
const { normalizeExtraSections, groundingText } = await import('../../../lib/customSiteSections.js');
const { TEMPLATES } = await import('../../../data/templates.js');

// The setup page's details (design.businessInfo shape).
const details = {
  businessName: 'Rivera Auto Care',
  businessType: 'mechanic_shop',
  phone: '(520) 555-0142',
  city: 'Tucson',
  state: 'AZ',
  address: '',
  serviceArea: 'Tucson & Marana',
  hours: 'Mon-Fri 8am-6pm · Sat 9am-2pm',
  tagline: '',
  specialties: 'Straight answers before any work starts.',
  services: [{ name: 'Brake repair', price: '$199', description: '' }, { name: 'Diagnostics', price: '', description: '' }],
  instagram: '',
  facebook: '',
  tiktok: '',
};
const detailer = { ...details, businessType: 'detailing_shop', services: [{ name: 'Full detail', price: '250', description: '' }] };

const levers = {
  palette: { accent: '#2563eb', bg: '#101010' },
  fonts: { heading: 'Oswald', body: 'Manrope' },
  sections: { order: ['hero', 'services'], hidden: ['gallery', 'cta'] },
  heroLayout: 'split',
  aboutLayout: 'stats',
  facts: { yearsInBusiness: '12', awards: ['Best of Tucson 2025'] },
};

const written = {
  headline: 'Honest brakes in Tucson',
  subheadline: 'Straight answers first.',
  aboutText: 'We fix it right.',
  servicesSection: { intro: 'What we do.', items: [{ name: 'Full detail', description: 'Every surface, inside and out.' }] },
};

describe('buildPreviewInput', () => {
  it('needs a known template', () => {
    expect(buildPreviewInput({ templateId: '', businessInfo: details })).toBeNull();
    expect(buildPreviewInput({ templateId: 'nope', businessInfo: details })).toBeNull();
    expect(buildPreviewInput()).toBeNull();
    // Only the registry's own ids, not what every object inherits.
    for (const id of ['constructor', 'toString', '__proto__']) expect(buildPreviewInput({ templateId: id, businessInfo: details })).toBeNull();
    expect(buildPreviewInput({ templateId: 42, businessInfo: details })).toBeNull();
  });

  it('shapes the business details the way the run stores them', () => {
    const input = buildPreviewInput({ templateId: 'mechanic_garage', businessInfo: details, levers, projectId: 'p-1' });
    const design = { ...sanitizeDesign({ businessInfo: details, templateId: 'mechanic_garage' }), levers };
    expect(input.businessInfo).toEqual({ ...siteBusinessInfo(design, 'p-1'), ...leverPatch(levers, 'mechanic_garage').info });
    // Name-list business type: services are names, no packages; empty keys go.
    expect(input.businessInfo.services).toEqual(['Brake repair', 'Diagnostics']);
    expect(input.businessInfo).not.toHaveProperty('packages');
    expect(input.businessInfo).not.toHaveProperty('address');
    expect(input.businessInfo.customProjectId).toBe('p-1');

    const shop = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: detailer });
    expect(shop.businessInfo.packages).toEqual([{ name: 'Full detail', price: '$250', description: '' }]);
    expect(shop.businessInfo).not.toHaveProperty('customProjectId');
  });

  it('applies the levers where the run puts them', () => {
    const input = buildPreviewInput({
      templateId: 'mechanic_garage', businessInfo: details, levers, customColors: { accent: '#ff0000', text: '#eeeeee' },
    });
    const patch = leverPatch(levers, 'mechanic_garage');
    // Copy keys into the copy (cta can't be hidden).
    expect(input.generatedCopy).toMatchObject(patch.copy);
    expect(input.generatedCopy.hiddenSections).toEqual(['gallery']);
    expect(input.generatedCopy.sectionOrder.slice(0, 2)).toEqual(['hero', 'services']);
    expect(input.generatedCopy.heroLayout).toBe('split');
    // Facts into business_info.
    expect(input.businessInfo.yearsInBusiness).toBe('12');
    expect(input.businessInfo.awards).toEqual(['Best of Tucson 2025']);
    // Lever colors over the brand accent; the rest stays the template's.
    expect(input.customColors).toEqual({ accent: '#2563eb', text: '#eeeeee', bg: '#101010' });
    expect(input.templateMeta.colors).toEqual({ ...TEMPLATES.mechanic_garage.colors, accent: '#2563eb', text: '#eeeeee', bg: '#101010' });
    // Fonts as catalog stacks.
    expect(input.templateMeta.font).toBe("'Oswald', sans-serif");
    expect(input.templateMeta.bodyFont).toBe("'Manrope', sans-serif");
  });

  it('keeps the template defaults without levers, and drops junk colors and fonts', () => {
    const input = buildPreviewInput({
      templateId: 'mechanic_garage', businessInfo: details,
      customColors: { accent: 'red', bg: '#ABCDEF', glow: '#000000' }, customFonts: { font: '', bodyFont: 7 },
    });
    expect(input.customColors).toEqual({ bg: '#abcdef' });
    expect(input.customFonts).toEqual({});
    expect(input.templateMeta.font).toBe(TEMPLATES.mechanic_garage.font);
    expect(input.generatedCopy).not.toHaveProperty('sectionOrder');
    expect(input.generatedCopy).not.toHaveProperty('hiddenSections');
  });

  it('uses marked sample copy until the site is written', () => {
    const input = buildPreviewInput({ templateId: 'mechanic_garage', businessInfo: details, levers });
    expect(input.sample).toBe(true);
    expect(input.generatedCopy.headline).toBe('Rivera Auto Care');
    expect(input.generatedCopy.servicesSection.items.map((i) => i.name)).toEqual(['Brake repair', 'Diagnostics']);
    // Levers still apply to sample copy.
    expect(input.generatedCopy.hiddenSections).toEqual(['gallery']);
    // Lever keys alone are not written copy.
    expect(buildPreviewInput({ templateId: 'mechanic_garage', businessInfo: details, copy: { sectionOrder: ['hero'] } }).sample).toBe(true);
  });

  it('shows written copy as it is and fills package descriptions from it', () => {
    const input = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: detailer, copy: written, levers: { heroLayout: 'full' } });
    expect(input.sample).toBe(false);
    expect(input.generatedCopy).toEqual({ ...written, heroLayout: 'full' });
    expect(input.businessInfo.packages[0].description).toBe('Every surface, inside and out.');
  });

  it('keeps business facts the Design step does not own on a rewrite', () => {
    const existingInfo = { businessName: 'Old name', hours: { Mon: '9-5' }, awards: ['Editor award'], insured: true };
    const input = buildPreviewInput({ templateId: 'mechanic_garage', businessInfo: details, existingInfo });
    expect(input.businessInfo.businessName).toBe('Rivera Auto Care');
    expect(input.businessInfo.hours).toBe(details.hours);
    expect(input.businessInfo.awards).toEqual(['Editor award']);
    expect(input.businessInfo.insured).toBe(true);
    // A lever fact wins over the site's own.
    const withLever = buildPreviewInput({ templateId: 'mechanic_garage', businessInfo: details, existingInfo, levers });
    expect(withLever.businessInfo.awards).toEqual(['Best of Tucson 2025']);
  });
});

describe('sampleCopy', () => {
  it('invents no facts and marks every placeholder sentence', () => {
    const c = sampleCopy(details);
    // No ratings, years, counts or prices: the details' only digits are the
    // phone and a price, which sample copy never uses.
    expect(JSON.stringify(c)).not.toMatch(/\d|★|award|certified|guarantee|review/i);
    expect(c.testimonialPlaceholders).toEqual([]);
    for (const text of [c.subheadline, c.aboutText, c.servicesSection.intro, c.ctaSubtext, c.metaTitle]) {
      expect(text.startsWith(SAMPLE_TAG)).toBe(true);
    }
    expect(c.aboutText).toBe(`${SAMPLE_TAG} Rivera Auto Care, serving Tucson & Marana. The about story is written from the customer's answers.`);
    // The page's JSON-LD type, as normalizeDesignCopy sets it.
    expect(c.schemaType).toBe('AutoRepair');
    expect(sampleCopy(detailer).schemaType).toBe('AutoWash');
  });

  it('works from empty details', () => {
    const c = sampleCopy(null);
    expect(c.headline).toBe('Business name');
    expect(c.servicesSection.items).toEqual([]);
    expect(c.aboutText).toBe(`${SAMPLE_TAG} Business name. The about story is written from the customer's answers.`);
  });

  it('hasWrittenCopy looks only at the main text', () => {
    expect(hasWrittenCopy(null)).toBe(false);
    expect(hasWrittenCopy({ headline: '  ' })).toBe(false);
    expect(hasWrittenCopy({ aboutText: 'x' })).toBe(true);
  });
});

describe('slotImages', () => {
  const P = (n) => `11111111-1111-1111-1111-111111111111/photo/${String(n).padStart(8, '0')}-2222-2222-2222-222222222222.jpg`;
  const files = [P(1), P(2), P(3), P(4)].map((path, i) => ({ path, url: `https://signed.example/${i + 1}` }));

  it('maps the picks to signed links, galleries in order', () => {
    expect(slotImages({ slots: { logo: '', hero: P(1), about: P(2), gallery: [P(4), P(3)] }, files })).toEqual({
      hero: 'https://signed.example/1',
      about: 'https://signed.example/2',
      gallery0: 'https://signed.example/4',
      gallery1: 'https://signed.example/3',
    });
  });

  it('prefers the copy already imported from the same upload', () => {
    const out = slotImages({
      slots: { hero: P(1), about: P(2), gallery: [] },
      files,
      images: { hero: 'https://public.example/hero.webp', about: 'https://public.example/about.webp' },
      imported: { hero: P(1), about: P(3) },
    });
    expect(out).toEqual({ hero: 'https://public.example/hero.webp', about: 'https://signed.example/2' });
  });

  it('skips picks without a link', () => {
    expect(slotImages({ slots: { hero: P(9) }, files })).toEqual({});
    expect(slotImages()).toEqual({});
  });

  it('leaves the Before & After pairs to previewBeforeAfter', () => {
    expect(slotImages({ slots: { hero: P(1), beforeAfter: [{ before: P(2), after: P(3), caption: '' }] }, files })).toEqual({ hero: 'https://signed.example/1' });
  });
});

describe('the Before & After pairs in the preview', () => {
  const P = (n) => `11111111-1111-1111-1111-111111111111/photo/${String(n).padStart(8, '0')}-2222-2222-2222-222222222222.jpg`;
  const files = [1, 2, 3, 4, 5].map((n) => ({ path: P(n), url: `https://signed.example/${n}` }));
  const slots = {
    hero: P(1),
    gallery: [],
    beforeAfter: [
      { before: P(2), after: P(3), caption: 'Paint correction on the hood' },
      { before: P(4), after: '', caption: 'Half picked' },
      { before: P(4), after: P(5), caption: '' },
    ],
  };

  it('maps the complete pairs to the run\'s keys, linked like the gallery, with the copy the run writes', () => {
    const out = previewBeforeAfter({
      templateId: 'detailing_sporty', slots, text: { title: 'Real work', intro: '' }, files,
      // Pair 1's before was copied into the site from the same upload: its public link.
      images: { baBefore0: 'https://public.example/b0.webp', baAfter0: 'https://public.example/old.webp' },
      imported: { baBefore0: P(2), baAfter0: P(9) },
    });
    expect(out.images).toEqual({
      baBefore0: 'https://public.example/b0.webp', baAfter0: 'https://signed.example/3',
      baBefore1: 'https://signed.example/4', baAfter1: 'https://signed.example/5',
    });
    expect(out.copy).toEqual({ title: 'Real work', pairs: [{ caption: 'Paint correction on the hood' }, {}] });
  });

  it('turns the section off without a complete pair with both links, or on a template without it', () => {
    expect(previewBeforeAfter({ templateId: 'detailing_sporty', slots, files: [] })).toEqual({ images: {}, copy: null });
    expect(previewBeforeAfter({ templateId: 'mobile_chrome', slots, files }).copy).toBeNull();
    expect(previewBeforeAfter()).toEqual({ images: {}, copy: null });
  });

  it('buildPreviewInput puts them in place of the site\'s own set, or leaves the site\'s', () => {
    const own = { ...written, beforeAfter: { title: 'Owner\'s', pairs: [{ caption: 'Owner\'s' }, {}, {}] } };
    const siteImages = { hero: 'https://public.example/hero.webp', baBefore2: 'https://public.example/b2.webp', baAfter2: 'https://public.example/a2.webp' };
    const pairs = previewBeforeAfter({ templateId: 'detailing_sporty', slots, files });
    const input = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: detailer, copy: own, images: siteImages, beforeAfter: pairs });
    expect(input.generatedCopy.beforeAfter).toEqual({ pairs: [{ caption: 'Paint correction on the hood' }, {}] });
    expect(input.images).toEqual({ hero: 'https://public.example/hero.webp', ...pairs.images });
    // The setup removed them all: the section goes, photos too.
    const none = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: detailer, copy: own, images: siteImages, beforeAfter: { images: {}, copy: null } });
    expect(none.generatedCopy).not.toHaveProperty('beforeAfter');
    expect(none.images).toEqual({ hero: 'https://public.example/hero.webp' });
    // Not applied (a rewrite keeping the site's): as the site has them.
    const kept = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: detailer, copy: own, images: siteImages });
    expect(kept.generatedCopy.beforeAfter).toEqual(own.beforeAfter);
    expect(kept.images).toEqual(siteImages);
    // Sample copy before the first write gets them too.
    const first = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: detailer, beforeAfter: pairs });
    expect(first.sample).toBe(true);
    expect(first.generatedCopy.beforeAfter).toEqual(pairs.copy);
  });

  it('shows the pairs\' photos on the page of every template whose module has the section', async () => {
    const pairs = previewBeforeAfter({ templateId: 'detailing_sporty', slots, files });
    for (const id of Object.keys(TEMPLATES)) {
      const mod = await TEMPLATE_COMPONENT_MAP[id]();
      const listed = [...(mod.sections || []), ...(mod.addedSections || []).map((s) => ({ id: s }))].some((s) => s.id === 'beforeAfter');
      if (!listed) continue;
      const input = buildPreviewInput({ templateId: id, businessInfo: { ...detailer, businessType: TEMPLATES[id].businessType }, copy: written, beforeAfter: pairs });
      const html = await renderPreviewHtml(input);
      expect(html, id).toContain('data-section="beforeAfter"');
      for (const link of Object.values(pairs.images)) expect(html, id).toContain(link);
    }
  });
});

describe('the More sections in the preview', () => {
  const P = (n) => `11111111-1111-1111-1111-111111111111/photo/${String(n).padStart(8, '0')}-2222-2222-2222-222222222222.jpg`;
  const files = [1, 2, 3].map((n) => ({ path: P(n), url: `https://signed.example/${n}` }));
  const ALL = ['faq', 'process', 'vehicleTypes', 'comparison', 'showcase', 'serviceTabs'];
  const services = [
    { name: 'Hand Wash', price: '$40', description: '', category: 'Cars' },
    { name: 'Hull Wash', price: '$200', description: '', category: 'Boats' },
    { name: 'RV Wash', price: '', description: '' },
  ];
  const info = { ...detailer, businessType: 'mobile_detailing', services };
  const design = (extra = {}) => ({
    templateId: 'detailing_sporty',
    businessInfo: info,
    extraSections: { faq: true, showcase: true, serviceTabs: true },
    slots: { showcase: [{ path: P(1), title: 'Ceramic coating', caption: 'Two coats' }, { path: P(2), title: '', caption: '' }, { path: P(9), title: 'No link' }] },
    ...extra,
  });
  // The site as the editor left it.
  const own = {
    ...written,
    faq: { items: [{ q: 'Owner\'s question?', a: 'Owner\'s answer.' }] },
    howSteps: [{ title: 'Owner step', desc: 'Theirs.' }],
    showcase: { items: [{ title: 'Owner card' }] },
    serviceTabs: { enabled: true, all: true },
  };
  const siteImages = { hero: 'https://public.example/hero.webp', showcase0: 'https://public.example/sc0.webp' };
  const existingInfo = { services: [{ name: 'RV Wash', category: 'RVs' }], packages: [{ name: 'RV Wash', category: 'RVs' }] };

  it('applies every section the template has before the first write, the changed ones on a rewrite', () => {
    const first = previewExtraSections({ design: design(), files });
    expect(first.applies).toEqual(ALL);
    expect(first.on).toEqual({ faq: true, process: false, vehicleTypes: false, comparison: false, showcase: true, serviceTabs: true });
    // The showcase as the setup has it: linked picks in order, the admin's words only.
    expect(first.showcase).toEqual({
      images: { showcase0: 'https://signed.example/1', showcase1: 'https://signed.example/2' },
      copy: { items: [{ title: 'Ceramic coating', caption: 'Two coats' }, {}] },
    });
    // A pick already copied from the same upload shows the public copy.
    const copied = previewExtraSections({ design: design(), files, images: { showcase1: 'https://public.example/sc1.webp' }, imported: { showcase1: P(2) } });
    expect(copied.showcase.images.showcase1).toBe('https://public.example/sc1.webp');
    const rewrite = previewExtraSections({ design: design({ extraSectionsChanged: ['process'] }), existing: true, files });
    expect(rewrite.applies).toEqual(['process']);
    expect(rewrite.showcase).toBeNull();
    expect(previewExtraSections({ design: design({ templateId: 'mobile_chrome' }), files }).applies).toEqual([]);
    expect(previewExtraSections()).toEqual({ applies: [], on: Object.fromEntries(ALL.map((id) => [id, false])), showcase: null });
  });

  it('buildPreviewInput: an applied section off comes off; an applied showcase and service tabs show the setup\'s; drafts never show as placeholders', () => {
    const sections = previewExtraSections({ design: design(), files });
    const input = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: info, copy: own, images: siteImages, existingInfo, extraSections: sections });
    // Off and applied: off the page (How it works).
    expect(input.generatedCopy).not.toHaveProperty('howSteps');
    // On, but Claude drafts it on the run: as the site has it now.
    expect(input.generatedCopy.faq).toEqual(own.faq);
    expect(input.generatedCopy.showcase).toEqual(sections.showcase.copy);
    // On, as the run writes them; the editor's "All" tab kept.
    expect(input.generatedCopy.serviceTabs).toEqual({ enabled: true, all: true });
    expect(input.images).toEqual({ hero: 'https://public.example/hero.webp', ...sections.showcase.images });
    // Applied service tabs: the setup's categories.
    expect(input.businessInfo.services.map((x) => x.category)).toEqual(['Cars', 'Boats', undefined]);
    // Before the first write the sample copy has nothing to show for a draft.
    const sample = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: info, extraSections: sections });
    expect(sample.sample).toBe(true);
    expect(sample.generatedCopy).not.toHaveProperty('faq');
    expect(sample.generatedCopy.showcase).toEqual(sections.showcase.copy);
    expect(sample.generatedCopy.serviceTabs).toEqual({ enabled: true });
  });

  it('buildPreviewInput: what the write doesn\'t apply stays as the site has it, categories too', () => {
    const sections = previewExtraSections({ design: design({ extraSectionsChanged: [] }), existing: true, files });
    const input = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: info, copy: own, images: siteImages, existingInfo, extraSections: sections });
    expect(input.generatedCopy.howSteps).toEqual(own.howSteps);
    expect(input.generatedCopy.showcase).toEqual(own.showcase);
    expect(input.generatedCopy.serviceTabs).toEqual(own.serviceTabs);
    expect(input.images).toEqual(siteImages);
    expect(input.businessInfo.services.map((x) => x.category)).toEqual([undefined, undefined, 'RVs']);
    // A showcase switched off (and changed): its photos come off too.
    const off = previewExtraSections({ design: design({ extraSections: { faq: true }, extraSectionsChanged: ['showcase'] }), existing: true, files });
    const gone = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: info, copy: own, images: siteImages, existingInfo, extraSections: off });
    expect(gone.generatedCopy).not.toHaveProperty('showcase');
    expect(gone.images).toEqual({ hero: 'https://public.example/hero.webp' });
  });

  it('a site the run writes shows every section on the page of a template whose module has them', async () => {
    // What the run keeps of Claude's answer (checked), and what it writes.
    const source = groundingText(['Gloss Boss', 'Mobile detailing', 'Austin', 'Hand Wash $40', 'Hull Wash $200', 'Cash or Zelle'], {});
    const fields = ['faqItems', 'howSteps', 'vehicleTypes', 'comparisonRows', 'showcaseTitles', 'serviceCategories'];
    const drafted = normalizeExtraSections({
      faqItems: [{ q: 'How do I pay?', a: 'Cash or Zelle.' }],
      howSteps: [{ title: 'Book', desc: 'Call or send a request.' }, { title: 'We come to you', desc: 'Anywhere in Austin.' }, { title: 'Enjoy', desc: 'Drive off clean.' }],
      vehicleTypes: { title: 'Vehicles We Detail', items: [{ name: 'Cars', desc: '', icon: 'car' }, { name: 'Boats', desc: '', icon: 'boat' }] },
      comparisonRows: [{ label: 'Comes to you', us: 'Yes', them: '—' }, { label: 'Hand wash', us: 'Yes', them: '—' }],
      showcaseTitles: [{ photo: 1, title: 'Hull Wash' }],
      serviceCategories: [],
    }, { fields, services, source, photos: [1] });
    const PUBLIC = 'https://public.example/';
    const d = design({
      extraSections: Object.fromEntries(ALL.map((id) => [id, true])),
      images: { showcase0: `${PUBLIC}sc0.webp`, showcase1: `${PUBLIC}sc1.webp` },
      imported: { showcase0: P(1), showcase1: P(2) },
    });
    const extra = extraSectionsWrite(d, drafted, { photos: [{ number: 1, index: 1 }] });
    expect(extra.applied).toEqual(ALL);
    const businessInfo = withServiceCategories(info, extra.categories);
    const input = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo, copy: { ...written, ...extra.copy }, images: extra.images });
    const html = await renderPreviewHtml(input);
    const mod = await TEMPLATE_COMPONENT_MAP.detailing_sporty();
    const listed = [...(mod.sections || []).map((x) => x.id), ...(mod.addedSections || [])];
    const shows = {
      faq: () => html.includes('data-section="faq"') && html.includes('How do I pay?'),
      process: () => html.includes('data-section="process"') && html.includes('We come to you'),
      vehicleTypes: () => html.includes('data-section="vehicleTypes"') && html.includes('Vehicles We Detail'),
      comparison: () => html.includes('data-section="comparison"') && html.includes('Automated car wash'),
      showcase: () => html.includes('data-section="showcase"') && html.includes(`${PUBLIC}sc1.webp`) && html.includes('Hull Wash'),
    };
    for (const [id, check] of Object.entries(shows)) {
      if (listed.includes(id)) expect(check(), id).toBe(true);
    }
    expect(html).not.toContain('data-acg-editor-only');
  });

  it('shows the showcase\'s photos and the service tabs on the page of a template whose module has them', async () => {
    const mod = await TEMPLATE_COMPONENT_MAP.detailing_sporty();
    const listed = [...(mod.sections || []).map((x) => x.id), ...(mod.addedSections || [])];
    const sections = previewExtraSections({ design: design(), files });
    const input = buildPreviewInput({ templateId: 'detailing_sporty', businessInfo: info, copy: written, extraSections: sections });
    const html = await renderPreviewHtml(input);
    expect(html).not.toContain('data-acg-editor-only');
    if (listed.includes('showcase')) {
      expect(html).toContain('data-section="showcase"');
      expect(html).toContain('https://signed.example/1');
      expect(html).toContain('Ceramic coating');
      // An untitled card waits for Claude's title: not on the page yet.
      expect(html).not.toContain('https://signed.example/2');
    }
    // The template groups its services where its source calls the kit's serviceTabsOf.
    const source = readFileSync(new URL('../../preview/templates/detailing/DetailingSporty.jsx', import.meta.url), 'utf8');
    if (/\bserviceTabsOf\(/.test(source)) {
      expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>Cars<\/label>/);
      expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>Boats<\/label>/);
    }
  });
});

describe('renderPreviewHtml', () => {
  it('builds the published page with the levers applied', async () => {
    const input = buildPreviewInput({ templateId: 'mechanic_garage', businessInfo: details, levers });
    const html = await renderPreviewHtml(input);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('data-section="hero"');
    expect(html).toContain('data-section="services"');
    expect(html).not.toContain('data-section="gallery"');
    expect(html).toContain(SAMPLE_TAG);
    expect(html).toMatch(/family=Oswald/);
    expect(html).toMatch(/family=Manrope/);
    expect(html).toContain('#101010');
    // No live site: no booking or contact widget scripts, no editor markup.
    expect(html).not.toContain('scheduler.js');
    expect(html).not.toContain('contact-form.js');
    expect(html).not.toContain('data-acg-editor-only');
    // Free-text hours are never turned into "Closed" days.
    expect(html).not.toContain('Closed');
    // The free-plan bar only when asked for.
    expect(html).not.toContain('id="acg-powered-by"');
    expect(await renderPreviewHtml(input, { isPro: false })).toContain('id="acg-powered-by"');
  });

  // The sample copy has the shape the run writes, so every template must
  // render it (a throw would leave the panel on "could not be built").
  it('renders every template with sample copy and levers', async () => {
    for (const id of Object.keys(TEMPLATES)) {
      const info = TEMPLATES[id].businessType === 'mechanic_shop' || TEMPLATES[id].businessType === 'wheel_shop' ? details : detailer;
      const input = buildPreviewInput({ templateId: id, businessInfo: { ...info, businessType: TEMPLATES[id].businessType }, levers });
      const html = await renderPreviewHtml(input);
      expect(html, id).toContain('</html>');
      expect(html, id).toContain(SAMPLE_TAG);
      expect(html, id).not.toContain('data-acg-editor-only');
      if (input.generatedCopy.hiddenSections?.includes('gallery')) expect(html, id).not.toContain('data-section="gallery"');
    }
  });

  it('renders nothing without an input', async () => {
    expect(await renderPreviewHtml(null)).toBe('');
  });
});

describe('framePreviewHtml', () => {
  const page = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<title>T</title>\n</head>\n<body><p>Costs $& and $1</p></body>\n</html>';

  it('puts the helper script first in <head>', () => {
    const out = framePreviewHtml(page);
    expect(out.indexOf('<head><script>')).toBeGreaterThan(0);
    expect(out.indexOf('<script>')).toBe(out.indexOf('<head>') + '<head>'.length);
    expect(out).toContain(PREVIEW_SCROLL_MESSAGE);
    // "$" in the page stays literal.
    expect(out).toContain('<p>Costs $& and $1</p>');
    expect(out.replace(/<script>[\s\S]*?<\/script>/, '')).toBe(page);
  });

  it('reopens at the reported scroll position only when there is one', () => {
    expect(framePreviewHtml(page, { scrollY: 640.4 })).toContain('top:640');
    expect(framePreviewHtml(page)).not.toContain("addEventListener('load'");
    expect(framePreviewHtml(page, { scrollY: -20 })).not.toContain("addEventListener('load'");
    expect(framePreviewHtml(page, { scrollY: 'x' })).not.toContain("addEventListener('load'");
  });

  it('copes with a page without <head>', () => {
    expect(framePreviewHtml('<p>x</p>').endsWith('</script><p>x</p>')).toBe(true);
    // A <header> is not a <head>.
    expect(framePreviewHtml('<header class="h">x</header>').endsWith('</script><header class="h">x</header>')).toBe(true);
    expect(framePreviewHtml('<html><head lang="en"><title>T</title>')).toMatch(/^<html><head lang="en"><script>/);
  });
});

describe('publishedTabHtml', () => {
  const page = '<!DOCTYPE html><html><head><title>Rivera &amp; Sons "Auto"</title><link rel="icon" type="image/svg+xml" href="data:x" /></head><body><a href="#cta">Go</a></body></html>';

  it('frames the page in a sandbox that keeps the admin origin out', () => {
    const out = publishedTabHtml(page);
    expect(PREVIEW_SANDBOX).toContain('allow-scripts');
    expect(PREVIEW_SANDBOX).not.toContain('allow-same-origin');
    expect(out).toContain(`sandbox="${PREVIEW_SANDBOX}"`);
    const m = /srcdoc="([^"]*)"/.exec(out);
    const unescaped = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    expect(unescaped).toBe(framePreviewHtml(page));
    // The wrapper itself runs no script.
    expect(out.replace(m[0], '')).not.toContain('<script');
  });

  it('names the tab after the page', () => {
    const out = publishedTabHtml(page);
    expect(out).toContain('<title>Preview · Rivera &amp; Sons "Auto"</title>');
    expect(out).toContain('<link rel="icon" type="image/svg+xml" href="data:x" />');
    expect(publishedTabHtml('')).toContain('<title>Preview</title>');
  });
});

describe('DesignPreview', () => {
  it('renders the toolbar and the sample notice before the first build', () => {
    const html = renderToStaticMarkup(createElement(DesignPreview, { templateId: 'mechanic_garage', businessInfo: details, levers }));
    expect(html).toContain('Open as published');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Desktop/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Phone/);
    expect(html).toContain('Sample text: the site hasn');
    expect(html).toContain(`marked &quot;${SAMPLE_TAG}&quot;`);
    expect(html).toContain('Building the preview');
  });

  it('asks for a template first', () => {
    const html = renderToStaticMarkup(createElement(DesignPreview, { templateId: '', businessInfo: details, defaultDevice: 'phone' }));
    expect(html).toContain('Pick a template to see the preview.');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Phone/);
    expect(html).not.toContain('Sample text: the site hasn');
  });

  it('shows no sample notice for written copy', () => {
    const html = renderToStaticMarkup(createElement(DesignPreview, { templateId: 'detailing_sporty', businessInfo: detailer, copy: written }));
    expect(html).not.toContain('Sample text: the site hasn');
  });
});
