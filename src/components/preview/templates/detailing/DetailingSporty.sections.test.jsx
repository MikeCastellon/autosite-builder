// detailing_sporty's reference-site bands (kit blocks): Vehicle Types
// (copy.vehicleTypes), How It Works (copy.howSteps), Detail Showcase
// (copy.showcase + images showcase<i>), Comparison (copy.comparison), FAQ
// (copy.faq, with FAQPage JSON-LD) and the services in tabs by category
// (copy.serviceTabs + services[i].category). Opt-in like every feature of
// this live design: DetailingSporty.golden.test.jsx freezes the page of a
// site without the keys, and here odd values of them change nothing either.
// With its key a band adds only its own section, CSS and (Comparison) root
// variables, right after the section before it in `sections`.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as mod from './DetailingSporty.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { contrastRatio } from '../kit/theme.js';
import { FAQ_DEFAULTS, FAQ_HINTS, faqJsonLd } from '../kit/faq.js';
import { HOW_DEFAULTS, HOW_HINTS } from '../kit/howItWorks.js';
import { VT_DEFAULTS, VT_HINTS } from '../kit/vehicleTypes.js';
import { CMP_DEFAULTS, CMP_HINTS } from '../kit/comparison.js';
import { SHOWCASE_DEFAULTS, SHOWCASE_HINTS } from '../kit/showcase.js';
import { SERVICE_TABS_HINTS } from '../kit/serviceTabs.js';
import { FIXTURES, FIXTURE_IMAGES, CUSTOM_COLORS, CUSTOM_FONTS } from '../__fixtures__/businesses.js';

const Sporty = mod.default;
const ID = 'detailing_sporty';
const FULL = FIXTURES.full;
const LOW_CONTRAST_COLORS = { bg: '#f4f4f4', accent: '#f5f5a0', text: '#dcdcdc', secondary: '#ececec', muted: '#e6e6e6' };
// Same list as templates.render.test.jsx BANNED_CLAIMS (keep in sync).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[★☆⭐]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');

const decode = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ');
const markup = (html) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const styleText = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
const count = (html, needle) => html.split(needle).length - 1;

// fx: a fixture; biz / copy / images: keys merged over it.
function render(fx, { editor = false, biz, copy, images, customColors } = {}) {
  const el = createElement(Sporty, {
    businessInfo: normalizeBusinessInfo({ ...fx.businessInfo, ...biz }),
    generatedCopy: { ...fx.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(ID, customColors || fx.customColors, fx.customFonts),
    images: { ...(fx.images || {}), ...images },
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}
const sectionTag = (html, id) => {
  const m = html.match(new RegExp(`<[a-z]+\\b[^>]*\\bdata-section="${id}"[^>]*>`));
  return m ? { tag: m[0], at: m.index, order: Number((m[0].match(/order:(-?\d+)/) || [])[1]) } : null;
};
// A band's markup: its opening tag to the end of its <section>.
const band = (html, id) => {
  const s = sectionTag(html, id);
  return s ? html.slice(s.at, html.indexOf('</section>', s.at) + '</section>'.length) : '';
};
const rootVars = (html) => {
  const style = decode(html.match(/^<div[^>]*\bstyle="([^"]*)"/)[1]);
  const vars = {};
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) vars[decl.slice(0, i)] = decl.slice(i + 1);
  }
  return vars;
};

// Walt's-style sample content (the reference site): a mobile detailer that
// also does boats, RVs and pressure washing.
const SERVICES = [
  { name: 'Auto Detailing', price: '$180', category: 'Cars' },
  { name: 'Interior', price: '$120', category: 'Cars' },
  { name: 'Exterior', price: '$90', category: 'Cars' },
  { name: 'Hand Wax & Buff', price: '$150', category: 'Cars' },
  { name: 'Headlight Restoration', price: '$75', category: 'Cars' },
  { name: 'Engine Bay', price: '$60', category: 'Cars' },
  { name: 'Boat Detailing', price: '$15/ft', category: 'Boats & RVs' },
  { name: 'RV Detailing', price: '$12/ft', category: 'Boats & RVs' },
  { name: 'Pressure Washing', price: '$200', category: 'Pressure Washing' },
];
const BANDS = {
  vehicleTypes: {
    title: 'For the Everyday Drive. And the Weekend Escape.',
    items: [
      { name: 'Cars', icon: 'car' }, { name: 'SUVs', icon: 'suv' }, { name: 'Trucks', icon: 'truck' },
      { name: 'Boats', icon: 'boat' }, { name: 'RVs', icon: 'rv' }, { name: 'Fleet', desc: 'Company vehicles on a schedule.', icon: 'fleet' },
    ],
  },
  howSteps: [
    { emoji: '📱', title: 'Book online', desc: 'Pick a time that works for you.' },
    { emoji: '🚐', title: 'We come to you', desc: 'At home or at work.' },
    { emoji: '✨', title: 'Enjoy the shine', desc: 'Get back to your day.' },
  ],
  showcase: {
    items: [
      { title: 'Maintenance Wash', caption: 'Hand wash, wheels and glass.' },
      { title: 'Ceramic Protection' },
      { title: 'Interior Reset', caption: 'Seats, carpets and trim.' },
      { title: 'Hand Wax' },
    ],
  },
  comparison: {
    title: 'More Care. Less Compromise.',
    rows: [
      { label: 'Comes to you', us: true, them: false },
      { label: 'Hand wash & hand-applied wax', us: true, them: false },
      { label: 'Interior detailing', us: true, them: 'Vacuum only' },
      { label: 'Boats & RVs', us: true, them: false },
    ],
  },
  faq: {
    items: [
      { q: 'Do you offer same-day service?', a: 'Often, yes. Call us and we will fit you in when we can.' },
      { q: 'Can you restore faded paint?', a: 'Yes. Paint correction removes swirls and oxidation.' },
      { q: 'Do you clean engine bays?', a: 'Yes, with care around the electrics.' },
      { q: 'Is the wax applied by hand?', a: 'Always.' },
    ],
  },
};
const SHOWCASE_PHOTOS = {
  showcase0: FIXTURE_IMAGES.gallery0, showcase1: FIXTURE_IMAGES.gallery1, showcase2: FIXTURE_IMAGES.gallery2, showcase3: FIXTURE_IMAGES.gallery3,
};
const ALL = { copy: { ...BANDS, serviceTabs: { enabled: true } }, biz: { services: SERVICES }, images: SHOWCASE_PHOTOS };
const IDS = ['vehicleTypes', 'process', 'showcase', 'comparison', 'faq'];
// Kit CSS and this design's aliases, per band (each must follow its kit CSS).
const CSS = {
  vehicleTypes: ['.ds-vt-grid{', '.ds-vt-band{--ds-vt-text:'],
  process: ['.ds-how-steps{', '.ds-how-band{--ds-how-text:'],
  showcase: ['.ds-sc-grid{', '.ds-sc-band{--ds-sc-text:'],
  comparison: ['.ds-cmp-table{', '.ds-cmp-band{--ds-cmp-text:'],
  faq: ['.ds-faq-list{', '.ds-faq-band{--ds-faq-text:'],
  tabs: ['.ds-st-bar{', '.ds-st-tabs{--ds-st-text:'],
};
// One band at a time, over the full fixture.
const ONE = {
  vehicleTypes: { copy: { vehicleTypes: BANDS.vehicleTypes } },
  process: { copy: { howSteps: BANDS.howSteps } },
  showcase: { copy: { showcase: BANDS.showcase }, images: SHOWCASE_PHOTOS },
  comparison: { copy: { comparison: BANDS.comparison } },
  faq: { copy: { faq: BANDS.faq } },
};

describe('detailing_sporty reference bands: sites without them do not change', () => {
  const ODD = [undefined, null, '', 'yes', 42, true, [], [{ q: 'x', a: 'y', name: 'Cars', label: 'Row', title: 'T' }]];

  it.each(['faq', 'vehicleTypes', 'comparison', 'showcase'])('copy.%s that is not an object renders like the full fixture', (key) => {
    for (const editor of [false, true]) {
      const plain = render(FULL, { editor });
      for (const value of ODD) expect(render(FULL, { editor, copy: { [key]: value }, images: SHOWCASE_PHOTOS })).toBe(render(FULL, { editor, images: SHOWCASE_PHOTOS }));
      expect(render(FULL, { editor, images: SHOWCASE_PHOTOS })).toBe(plain);
    }
  });

  it('copy.howSteps that is not a non-empty list renders like the full fixture (no starter steps)', () => {
    for (const editor of [false, true]) {
      const plain = render(FULL, { editor });
      for (const value of [undefined, null, '', 'Book', 3, {}, []]) expect(render(FULL, { editor, copy: { howSteps: value } })).toBe(plain);
    }
  });

  it('categories without the switch, or a switch that is not { enabled: true }, change nothing', () => {
    for (const editor of [false, true]) {
      const plain = render(FULL, { editor, biz: { services: SERVICES } });
      expect(render(FULL, { editor, biz: { services: SERVICES.map(({ category, ...s }) => s) } })).toBe(plain);
      for (const value of [undefined, null, true, 'yes', {}, { enabled: 'true' }, { all: true }, [{ enabled: true }]]) {
        expect(render(FULL, { editor, biz: { services: SERVICES }, copy: { serviceTabs: value } })).toBe(plain);
      }
    }
  });

  it('the switch with fewer than two categories publishes nothing new, and the editor says why', () => {
    const one = SERVICES.map((s) => ({ ...s, category: 'Cars' }));
    expect(render(FULL, { biz: { services: one }, copy: { serviceTabs: { enabled: true } } })).toBe(render(FULL, { biz: { services: one } }));
    const ed = render(FULL, { editor: true, biz: { services: one }, copy: { serviceTabs: { enabled: true } } });
    expect(decode(ed).replace(/&gt;/g, '>')).toContain(SERVICE_TABS_HINTS.few);
    expect(ed).not.toContain('ds-st-');
  });

  it.each(['sparse', 'full', 'custom'])('adds no band, tab or CSS of theirs to the %s fixture', (name) => {
    for (const editor of [false, true]) {
      const html = render(FIXTURES[name], { editor });
      expect(html).not.toMatch(/data-section="(vehicleTypes|process|showcase|comparison|faq)"|ds-(vt|how|sc|cmp|faq|st)-|application\/ld\+json/);
    }
  });
});

describe('detailing_sporty reference bands: each on its own', () => {
  it.each(IDS)('%s adds only its own section and CSS, after the kit\'s', (id) => {
    for (const editor of [false, true]) {
      const html = render(FULL, { editor, ...ONE[id] });
      for (const other of IDS) expect({ id, other, on: Boolean(sectionTag(html, other)) }).toEqual({ id, other, on: other === id });
      const css = styleText(html);
      const [kit, theme] = CSS[id];
      expect(css).toContain(kit);
      expect(css).toContain(theme);
      expect(css.indexOf(theme)).toBeGreaterThan(css.indexOf(kit));
      for (const [k, [otherKit]] of Object.entries(CSS)) if (k !== id) expect({ id, k, css: css.includes(otherKit) }).toEqual({ id, k, css: false });
      // The template's own CSS is unchanged: the band's is appended to it.
      const first = (h) => h.match(/<style>([\s\S]*?)<\/style>/)[1];
      expect(first(html).startsWith(first(render(FULL, { editor })))).toBe(true);
      // Its markup is the only markup it adds (the page around it is as
      // before; the comparison's root variables are checked below).
      const page = (h) => markup(h).replace(/^(<div[^>]*?) style="[^"]*"/, '$1');
      expect(page(html).replace(band(page(html), id), '')).toBe(page(render(FULL, { editor })));
    }
  });

  it('only the comparison adds root variables (its tinted column), and only while it renders', () => {
    const plain = rootVars(render(FULL));
    for (const id of IDS) {
      const vars = rootVars(render(FULL, ONE[id]));
      const added = Object.keys(vars).filter((k) => !(k in plain));
      expect({ id, added }).toEqual({ id, added: id === 'comparison' ? ['--ds-cmp-us-bg', '--ds-cmp-us-text', '--ds-cmp-us-yes'] : [] });
    }
    expect(rootVars(render(FULL, { copy: { comparison: { rows: [{ us: true }] } } }))).toEqual(plain);
  });

  it('hides with the Sections list', () => {
    for (const id of IDS) {
      const copy = { ...ONE[id].copy, hiddenSections: [id] };
      expect(render(FULL, { ...ONE[id], copy })).toBe(render(FULL, { images: ONE[id].images }));
    }
    const html = render(FULL, { ...ALL, copy: { ...ALL.copy, hiddenSections: ['services'] } });
    expect(html).not.toContain('ds-st-');
  });
});

describe('detailing_sporty reference bands: placement and order', () => {
  const legacyIds = mod.sections.map((s) => s.id).filter((id) => !mod.addedSections.includes(id));
  // Each band, the section it follows in `sections` (whose order value it
  // shares while the saved order has no slot for it).
  const AFTER = { vehicleTypes: 'services', process: 'services', showcase: 'gallery', comparison: 'gallery', faq: 'testimonials' };

  it('sits where the reference design has it, right after the section before it', () => {
    const html = render(FULL, ALL);
    const ids = mod.sections.map((s) => s.id).filter((id) => sectionTag(html, id));
    expect(ids).toEqual(['hero', 'statsBar', 'services', 'vehicleTypes', 'process', 'about', 'gallery', 'showcase', 'comparison', 'testimonials', 'faq', 'cta', 'awards']);
    // DOM order = the page's order (ties keep DOM order).
    const byPage = [...ids].sort((a, b) => sectionTag(html, a).order - sectionTag(html, b).order || sectionTag(html, a).at - sectionTag(html, b).at);
    expect(byPage).toEqual(ids);
    for (const [id, pred] of Object.entries(AFTER)) expect({ id, order: sectionTag(html, id).order }).toEqual({ id, order: sectionTag(html, pred).order });
  });

  it.each([
    ['no saved order', {}],
    ['a saved order without the new ids', { sectionOrder: ['hero', 'about', 'services', 'testimonials', 'gallery', 'cta'] }],
    ['a full saved order', { sectionOrder: ['cta', ...legacyIds.filter((id) => id !== 'cta')] }],
  ])('keeps every older section on its old order value (%s)', (_, saved) => {
    const copy = { ...FULL.generatedCopy, ...ALL.copy, ...saved };
    const html = render(FULL, { ...ALL, copy });
    const old = buildSectionOrder(copy, legacyIds);
    for (const id of legacyIds) {
      const s = sectionTag(html, id);
      if (s) expect({ id, order: s.order }).toEqual({ id, order: old(id) });
    }
    for (const id of IDS) expect({ id, order: sectionTag(html, id).order }).toEqual({ id, order: sectionTag(html, AFTER[id]).order });
  });

  it('a slot the owner saved for a band wins', () => {
    const html = render(FULL, { ...ALL, copy: { ...ALL.copy, sectionOrder: ['faq', 'hero', 'statsBar', 'services', 'comparison', 'about'] } });
    expect(sectionTag(html, 'faq').order).toBe(0);
    expect(sectionTag(html, 'comparison').order).toBe(4);
  });
});

describe('detailing_sporty reference bands: published vs editor', () => {
  it('publishes only complete entries; the editor shows the rest with what each needs', () => {
    const copy = {
      faq: { items: [{ q: 'Do you come to me?', a: 'Yes.' }, { q: 'Unanswered?' }] },
      vehicleTypes: { items: [{ name: 'Cars' }, { desc: 'Pontoons' }] },
      comparison: { rows: [{ label: 'Comes to you', us: true, them: false }, { us: true }] },
      showcase: { items: [{ title: 'Wax' }, { title: 'No photo yet' }] },
      howSteps: [{ title: 'Book online' }, { title: '', desc: '' }],
    };
    const images = { showcase0: FIXTURE_IMAGES.gallery0 };
    const pub = render(FULL, { copy, images });
    const ed = render(FULL, { copy, images, editor: true });
    expect(pub).not.toContain('data-acg-editor-only');
    expect(visibleText(pub)).not.toMatch(/Unanswered|Pontoons|No photo yet|Edit >/);
    expect(count(band(pub, 'faq'), '<details')).toBe(1);
    expect(count(band(ed, 'faq'), '<details')).toBe(2);
    expect(band(ed, 'vehicleTypes')).toContain('ds-vt-todo');
    expect(band(ed, 'comparison')).toContain('ds-cmp-todo');
    expect(band(ed, 'showcase')).toContain('ds-sc-todo');
    expect(visibleText(ed)).toMatch(/Edit > FAQ/);
    // A blank step is left out on both (it would only shift the numbers).
    expect(count(band(pub, 'process'), '<li ')).toBe(1);
    expect(count(band(ed, 'process'), '<li ')).toBe(1);
  });

  it('a band with nothing complete is an editor-only section with its hint, and absent when published', () => {
    const empty = { faq: {}, vehicleTypes: {}, comparison: {}, showcase: {}, howSteps: [{ title: ' ' }] };
    const pub = render(FULL, { copy: empty });
    expect(markup(pub)).toBe(markup(render(FULL)));
    const ed = decode(render(FULL, { copy: empty, editor: true })).replace(/&gt;/g, '>');
    for (const id of IDS) expect({ id, editorOnly: sectionTag(ed, id).tag.includes('data-acg-editor-only=""') }).toEqual({ id, editorOnly: true });
    for (const hint of [FAQ_HINTS.empty, VT_HINTS.empty, CMP_HINTS.empty, HOW_HINTS.empty, SHOWCASE_HINTS.empty]) expect(ed).toContain(hint);
    // This design's hint look (EditorHint, .ds-hint), the showcase's photo placeholder.
    expect(band(ed, 'faq')).toContain(`<p class="ds-hint" data-acg-editor-only="">${FAQ_HINTS.empty}</p>`);
  });

  it('adds FAQPage JSON-LD for the printed questions on the published page only', () => {
    const pub = render(FULL, ALL);
    const faqBand = band(pub, 'faq');
    expect(count(pub, 'application/ld+json')).toBe(1);
    const ld = JSON.parse(faqBand.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    expect(ld).toEqual(faqJsonLd(BANDS.faq));
    expect(ld.mainEntity.map((q) => q.name)).toEqual([...faqBand.matchAll(/class="ds-faq-q-text">([^<]*)</g)].map((m) => decode(m[1])));
    expect(render(FULL, { ...ALL, editor: true })).not.toContain('application/ld+json');
  });

  it('publishes no editor UI or invented claims, in any palette', () => {
    for (const customColors of [{}, CUSTOM_COLORS, LOW_CONTRAST_COLORS]) {
      const html = render(FULL, { ...ALL, customColors });
      expect(html).not.toContain('data-acg-editor-only');
      expect(visibleText(html)).not.toMatch(/Edit >|Edit panel/);
      expect(visibleText(html)).not.toMatch(BANNED_CLAIMS);
      expect(decode(html)).not.toMatch(BANNED_CLAIMS);
    }
  });
});

describe('detailing_sporty reference bands: headings', () => {
  it('print the design\'s own heading (headingDefaults) in this design\'s look', () => {
    const html = markup(render(FULL, { ...ALL, copy: { ...ALL.copy, vehicleTypes: { items: BANDS.vehicleTypes.items }, comparison: { rows: BANDS.comparison.rows } } }));
    const hd = mod.headingDefaults(normalizeBusinessInfo(FULL.businessInfo), FULL.generatedCopy);
    const DEFAULTS = { vehicleTypes: VT_DEFAULTS, process: HOW_DEFAULTS, showcase: SHOWCASE_DEFAULTS, comparison: CMP_DEFAULTS, faq: FAQ_DEFAULTS };
    const NS = { vehicleTypes: 'vt', process: 'how', showcase: 'sc', comparison: 'cmp', faq: 'faq' };
    for (const id of IDS) {
      expect({ id, eyebrow: hd[id].eyebrow, title: hd[id].title }).toEqual({ id, eyebrow: DEFAULTS[id].eyebrow, title: DEFAULTS[id].title });
      const b = decode(band(html, id));
      expect(b).toContain(`<p class="ds-eyebrow">${hd[id].eyebrow}</p><div class="ds-fit ds-fit-h2"><h2 id="ds-${NS[id]}-h" class="ds-h2"`);
      expect(b).toMatch(new RegExp(`aria-labelledby="ds-${NS[id]}-h"`));
      expect(b).toContain(`>${hd[id].title}</h2>`);
    }
    // The comparison's heading is the table's caption, revealed with it.
    expect(band(html, 'comparison')).toMatch(/<table class="ds-cmp-table" aria-labelledby="ds-cmp-h" data-acg-reveal=""><caption class="ds-cmp-caption"><div class="ds-head ds-head-solo"><div>/);
  });

  it('the owner\'s title / intro on the band\'s key win; label and highlight come from Edit > Headings', () => {
    const sectionTitles = {
      faq: { eyebrow: 'Good to Know', title: 'Ignored', accent: 'Get Started', intro: 'Ignored too' },
      process: { eyebrow: 'Easy', title: 'A Better Detail. Three Simple Steps.', accent: 'Three Simple Steps', intro: 'Here is how.' },
      showcase: { eyebrow: 'Up Close', title: 'From Headings' },
    };
    const copy = {
      ...ALL.copy,
      faq: { ...BANDS.faq, title: 'Before We Get Started', intro: 'Quick answers.' },
      showcase: { ...BANDS.showcase, title: 'Every Detail Makes A Difference' },
      sectionTitles,
    };
    const html = decode(markup(render(FULL, { ...ALL, copy })));
    const faqBand = band(html, 'faq');
    expect(faqBand).toContain('<p class="ds-eyebrow">Good to Know</p>');
    expect(faqBand).toContain('Before We <span class="ds-em">Get Started</span></h2>');
    expect(faqBand).toContain('<p class="ds-intro">Quick answers.</p>');
    expect(faqBand).not.toContain('Ignored');
    const how = band(html, 'process');
    expect(how).toContain('A Better Detail. <span class="ds-em">Three Simple Steps</span>.</h2>');
    expect(how).toContain('<p class="ds-intro">Here is how.</p>');
    const sc = band(html, 'showcase');
    expect(sc).toContain('<p class="ds-eyebrow">Up Close</p>');
    expect(sc).toContain('>Every Detail Makes A Difference</h2>');
  });
});

describe('detailing_sporty services in tabs', () => {
  // The tab radios, attribute order aside.
  const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
  const radiosOf = (html) => [...html.matchAll(/<input type="radio"[^>]*\/>/g)].map(([tag]) => ({
    id: attr(tag, 'id'), checked: /\schecked=""/.test(tag), name: attr(tag, 'name'), controls: attr(tag, 'aria-controls'),
  }));
  const tabsHtml = (copy = {}, editor = false) => render(FULL, { editor, biz: { services: SERVICES }, copy: { serviceTabs: { enabled: true }, ...copy } });

  it('groups the cards by category under CSS-only tabs, the first one picked', () => {
    const html = markup(tabsHtml());
    const svc = band(html, 'services');
    expect(svc).toContain('<div class="ds-st-tabs" role="group" aria-label="Services by category">');
    expect([...svc.matchAll(/<label for="ds-st-t\d" id="ds-st-l\d" class="ds-st-tab ds-st-tab-\d">([^<]*)<\/label>/g)].map((m) => decode(m[1])))
      .toEqual(['Cars', 'Boats & RVs', 'Pressure Washing']);
    const radios = radiosOf(svc);
    expect(radios.map((r) => [r.id, r.checked, r.name, r.controls])).toEqual([
      ['ds-st-t0', true, 'ds-st-tab', 'ds-st-p0'], ['ds-st-t1', false, 'ds-st-tab', 'ds-st-p1'], ['ds-st-t2', false, 'ds-st-tab', 'ds-st-p2'],
    ]);
    // Every service once, each in its group's own grid, numbered in it.
    const panels = svc.split('<div id="ds-st-p').slice(1);
    expect(panels).toHaveLength(3);
    const names = (p) => [...p.matchAll(/class="ds-card-title"[^>]*>([^<]*)</g)].map((m) => decode(m[1]));
    expect(panels.map(names)).toEqual([SERVICES.slice(0, 6).map((s) => s.name), ['Boat Detailing', 'RV Detailing'], ['Pressure Washing']]);
    expect(panels.map((p) => [...p.matchAll(/class="ds-card-num" aria-hidden="true">(\d+)</g)].map((m) => m[1]))).toEqual([
      ['01', '02', '03', '04', '05', '06'], ['01', '02'], ['01'],
    ]);
    expect(panels.map((p) => (p.match(/class="ds-grid (ds-c\d)/) || [])[1])).toEqual(['ds-c3', 'ds-c2', 'ds-c1']);
    // The reveal stagger follows the card's place in its own grid.
    expect([...panels[1].matchAll(/--acg-delay:(\d+)ms/g)].map((m) => m[1])).toEqual(['0', '90']);
  });

  it('keeps each Read more toggle id unique: the service\'s place in the whole list', () => {
    const long = 'A long description that runs past two hundred characters so the card clamps it and offers a Read more toggle, '.repeat(3);
    const services = SERVICES.map((s) => ({ ...s, description: long }));
    const html = render(FULL, { biz: { services }, copy: { serviceTabs: { enabled: true } } });
    const ids = [...html.matchAll(/<input type="checkbox" id="(svc-more-[^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(SERVICES.map((_, i) => `svc-more-pkg-${i}`));
  });

  it('an "All" tab comes first and opens on every group', () => {
    const svc = markup(tabsHtml({ serviceTabs: { enabled: true, all: true } }));
    expect(radiosOf(svc)[0]).toEqual({ id: 'ds-st-all', checked: true, name: 'ds-st-tab', controls: 'ds-st-p0 ds-st-p1 ds-st-p2' });
    expect(radiosOf(svc).filter((r) => r.checked)).toHaveLength(1);
    expect(svc).toContain('<label for="ds-st-all" class="ds-st-tab ds-st-tab-all">All</label>');
  });

  it('adds the kit\'s tab CSS and this design\'s only while the tabs show; the same markup in the editor', () => {
    const css = styleText(tabsHtml());
    expect(css.indexOf(CSS.tabs[1])).toBeGreaterThan(css.indexOf(CSS.tabs[0]));
    expect(band(markup(tabsHtml({}, true)), 'services')).toBe(band(markup(tabsHtml()), 'services'));
    // Services hidden: no tabs, no tab CSS.
    expect(tabsHtml({ hiddenSections: ['services'] })).not.toContain('ds-st-');
  });
});

describe('detailing_sporty reference bands: colors', () => {
  // Each band's text / background pairs, by block variable (resolved
  // through the theme's aliases to the root tokens it repairs). bg null:
  // the section's own background (the page, or the surface for an
  // alternate section).
  const PAIRS = [
    ['--ds-vt-card-text', '--ds-vt-card-bg'], ['--ds-vt-card-muted', '--ds-vt-card-bg'],
    ['--ds-how-card-text', '--ds-how-card-bg'], ['--ds-how-card-muted', '--ds-how-card-bg'], ['--ds-how-card-accent', '--ds-how-card-bg'],
    ['--ds-faq-item-text', '--ds-faq-item-bg'], ['--ds-faq-item-muted', '--ds-faq-item-bg'], ['--ds-faq-item-accent', '--ds-faq-item-bg'], ['--ds-faq-hover', '--ds-faq-item-bg'],
    ['--ds-st-text', '--ds-st-tab-bg'], ['--ds-st-pick-text', '--ds-st-pick-bg'], ['--ds-st-muted', '--ds-bg'],
    ['--ds-cmp-us-head-text', '--ds-cmp-us-head-bg'], ['--ds-cmp-us-text', '--ds-cmp-us-bg'], ['--ds-cmp-text', '--ds-bg'], ['--ds-cmp-muted', '--ds-bg'],
    ['--ds-faq-text', '--ds-bg'], ['--ds-faq-muted', '--ds-bg'], ['--ds-how-text', '--ds-bg'], ['--ds-how-muted', '--ds-bg'], ['--ds-cmp-accent', '--ds-bg'],
  ];
  // Text in an alternate section (.ds-alt: --ds-text & co. are the
  // surface's) on the surface.
  const ALT_PAIRS = [
    ['--ds-vt-text', '--ds-sf-bg'], ['--ds-vt-muted', '--ds-sf-bg'], ['--ds-vt-accent', '--ds-sf-bg'],
    ['--ds-sc-text', '--ds-sf-bg'], ['--ds-sc-muted', '--ds-sf-bg'], ['--ds-sc-accent', '--ds-sf-bg'],
  ];
  const ALT = { '--ds-text': '--ds-sf-text', '--ds-muted': '--ds-sf-muted', '--ds-accent-text': '--ds-sf-accent' };

  it.each([
    ['default', {}],
    ['custom', CUSTOM_COLORS],
    ['low-contrast', LOW_CONTRAST_COLORS],
  ])('every pair reads at 4.5:1 (%s palette); check marks at 3:1', (_, customColors) => {
    const html = render({ ...FULL, customFonts: CUSTOM_FONTS }, { ...ALL, customColors });
    const root = rootVars(html);
    const css = styleText(html);
    const alias = {};
    for (const m of css.matchAll(/(--ds-(?:vt|how|sc|cmp|faq|st)-[\w-]+):([^;}]+)/g)) if (!(m[1] in alias)) alias[m[1]] = m[2].trim();
    const resolve = (name, scope = {}, seen = 0) => {
      if (seen > 8) return null;
      const v = alias[name] ?? root[scope[name] || name];
      const ref = typeof v === 'string' && v.match(/^var\((--[\w-]+)\)$/);
      return ref ? resolve(ref[1], scope, seen + 1) : v;
    };
    for (const [fg, bg] of PAIRS) {
      const [f, b] = [resolve(fg), resolve(bg)];
      expect({ fg, bg, ok: /^#[0-9a-f]{6}$/i.test(f) && /^#[0-9a-f]{6}$/i.test(b) }).toEqual({ fg, bg, ok: true });
      expect({ fg, bg, ratio: contrastRatio(f, b) >= 4.5 }).toEqual({ fg, bg, ratio: true });
    }
    for (const [fg, bg] of ALT_PAIRS) {
      const [f, b] = [resolve(fg, ALT), resolve(bg, ALT)];
      expect({ fg, bg, ratio: contrastRatio(f, b) >= 4.5 }).toEqual({ fg, bg, ratio: true });
    }
    expect(contrastRatio(root['--ds-cmp-us-yes'], root['--ds-cmp-us-bg'])).toBeGreaterThanOrEqual(3);
  });

  it('aliases only theme tokens (no colors of its own) and keeps square corners', () => {
    const css = styleText(render(FULL, ALL));
    for (const m of css.matchAll(/(--ds-(?:vt|how|sc|cmp|faq|st)-[\w-]+):([^;}]+)/g)) {
      const value = m[2].trim();
      expect({ v: m[1], value, ok: /^(var\(--ds-[\w-]+\)|0px|uppercase|clamp\([\d.a-z,() ]+\)|\d+px|transparent|0 14px 28px -16px var\(--ds-glow\))$/.test(value) })
        .toEqual({ v: m[1], value, ok: true });
    }
    for (const r of ['--ds-vt-r', '--ds-how-r', '--ds-sc-r', '--ds-cmp-r', '--ds-faq-r', '--ds-st-tab-r']) expect(css).toContain(`${r}:0px`);
  });
});
