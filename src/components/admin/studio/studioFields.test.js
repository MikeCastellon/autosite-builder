import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PALETTE_ROLES, normalizeHex, effectivePalette, setPaletteRole, resetPaletteRole, hasPalettePicks, brandAccentFor,
  readabilityRows, readabilityNote, ratioLabel, repairsContrast,
  toFamily, setFontSlot, applyPairing, fontOptionGroups, fontLinkHrefs,
  sectionsSupported, currentSectionOrder, sectionRows, moveSection, toggleSectionHidden, resetSectionOrder,
  layoutOptions, layoutPart, setStat, addStat, removeStat, incompleteStats, MAX_STATS,
  FACT_TEXT_FIELDS, FACT_LIST_FIELDS, splitFactList, parseFactList, formatFactList, sameList,
  setFactText, setFactList, insuredChoice, setInsured, factTextWarning,
} from './studioFields.js';
import { COLOR_ROLES, FACT_LISTS, FACT_TEXTS, sanitizeLevers } from '../../../lib/designLevers.js';
import { brandAccent } from '../../../lib/customSiteDesign.js';
import { buildFontHref } from '../../../lib/fontCatalog.js';
import { FONT_PAIRINGS, pairingById } from '../../../data/fontPairings.js';
import { sectionIdsFor } from '../../../data/templateSections.js';
import { contrastRatio } from '../../preview/templates/kit/theme.js';
import PaletteField from './PaletteField.jsx';
import FontField from './FontField.jsx';
import SectionsField from './SectionsField.jsx';
import LayoutField from './LayoutField.jsx';
import FactsField from './FactsField.jsx';

const LIGHT = { bg: '#ffffff', secondary: '#f4f4f5', text: '#111111', muted: '#555555', accent: '#1d4ed8' };
const noop = () => {};

describe('palette', () => {
  it('lists the five roles in the levers order', () => {
    expect(PALETTE_ROLES.map((r) => r.role)).toEqual([...COLOR_ROLES]);
    expect(PALETTE_ROLES.map((r) => r.label)).toEqual(['Background', 'Surface / Secondary', 'Text', 'Muted text', 'Accent']);
  });

  it('reads typed hex codes the way people paste them', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHex(' aabbcc ')).toBe('#aabbcc');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('abc')).toBe('#aabbcc');
    for (const junk of ['#ab', 'blue', '#abcd', '#gggggg', '', null, undefined, 12]) expect(normalizeHex(junk)).toBe('');
  });

  it('puts picks over the template colors and derives roles neither gives', () => {
    expect(effectivePalette({ accent: '#E11D48' }, LIGHT)).toEqual({ ...LIGHT, accent: '#e11d48' });
    const c = effectivePalette({}, { bg: '#ffffff', text: '#111111', accent: '#2563eb' });
    for (const role of COLOR_ROLES) expect(c[role]).toMatch(/^#[0-9a-f]{6}$/);
    expect(effectivePalette(null, null).bg).toBe('#ffffff');
  });

  it('sets, ignores half-typed values, and resets one role without touching the input', () => {
    const start = { bg: '#000000' };
    const next = setPaletteRole(start, 'accent', '#F00');
    expect(next).toEqual({ bg: '#000000', accent: '#ff0000' });
    expect(start).toEqual({ bg: '#000000' });
    expect(setPaletteRole(next, 'accent', '#ff')).toEqual(next);
    expect(setPaletteRole(next, 'evil', '#ffffff')).toEqual(next);
    expect(resetPaletteRole(next, 'accent')).toEqual({ bg: '#000000' });
    expect(setPaletteRole(next, 'bg', '')).toEqual({ accent: '#ff0000' });
    expect(hasPalettePicks({})).toBe(false);
    expect(hasPalettePicks({ muted: 'nope' })).toBe(false);
    expect(hasPalettePicks(next)).toBe(true);
  });

  it('takes the brand accent against the background the page will have', () => {
    const hexes = ['#ffd400', '#222222'];
    expect(brandAccentFor({ bg: '#ffffff' }, { bg: '#111111' }, hexes)).toBe(brandAccent('#ffffff', hexes).accent);
    expect(brandAccentFor({}, { bg: '#111111' }, hexes)).toBe(brandAccent('#111111', hexes).accent);
    expect(brandAccentFor({}, LIGHT, ['#000000', '#ffffff', '#777777'])).toBe('');
  });
});

describe('readability', () => {
  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

  it('passes a well-built palette', () => {
    const rows = readabilityRows({}, LIGHT);
    expect(rows.map((r) => r.id)).toEqual(['text', 'muted', 'surface', 'onAccent', 'accent']);
    for (const r of rows) expect(r.status, r.id).toBe('pass');
    expect(readabilityNote(rows[0])).toMatch(/^Reads well \(\d+\.\d:1\)\.$/);
  });

  it('says when the site repairs a faint text color, and to what', () => {
    const r = byId(readabilityRows({ text: '#aaaaaa' }, LIGHT)).text;
    expect(r.status).toBe('adjusted');
    expect(r.ratio).toBeLessThan(4.5);
    expect(r.shown.ratio).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(r.shown.fg, r.shown.bg)).toBe(r.shown.ratio);
    expect(readabilityNote(r)).toContain(`darkens it to ${r.shown.fg}`);
    const dark = byId(readabilityRows({ bg: '#111111', muted: '#333333' }, LIGHT)).muted;
    expect(dark.status).toBe('adjusted');
    expect(readabilityNote(dark)).toContain('lightens');
  });

  it('fails fills the site never changes', () => {
    // Mid-gray: neither white nor dark button text reaches 4.5:1.
    const mid = byId(readabilityRows({ accent: '#797979' }, LIGHT));
    expect(mid.onAccent.status).toBe('fail');
    expect(readabilityNote(mid.onAccent)).toMatch(/needs 4\.5:1.*darker or lighter/);
    const faint = byId(readabilityRows({ accent: '#eeeeee' }, LIGHT)).accent;
    expect(faint.status).toBe('fail');
    expect(faint.min).toBe(3);
    expect(readabilityNote(faint)).toContain('blend into the page');
    // Dark cards on a white page: no one text color reads on both.
    const cards = byId(readabilityRows({ secondary: '#555555' }, LIGHT)).surface;
    expect(cards.status).toBe('fail');
    expect(readabilityNote(cards)).toContain('bring the surface closer');
    // White cards on a black page: the site finds a gray that reads on both.
    const both = byId(readabilityRows({ bg: '#000000', secondary: '#ffffff', text: '#ffffff' }, LIGHT)).surface;
    expect(both.status).toBe('adjusted');
    expect(contrastRatio(both.shown.fg, '#000000')).toBeGreaterThanOrEqual(4.5);
  });

  it('never claims a repair on templates that paint the picks as they are', () => {
    // Exactly the theme-ready templates paint through deriveTheme().
    expect(repairsContrast('mobile_chrome')).toBe(true);
    expect(repairsContrast('mobile_redline')).toBe(true);
    expect(repairsContrast('detailing_coastal')).toBe(false);
    expect(repairsContrast('')).toBe(false);
    const legacy = byId(readabilityRows({ text: '#aaaaaa' }, LIGHT, { repairs: false }));
    expect(legacy.text.status).toBe('fail');
    expect(legacy.text.shown).toEqual({ fg: '#aaaaaa', bg: '#ffffff', ratio: legacy.text.ratio });
    for (const r of readabilityRows({ text: '#aaaaaa', muted: '#dddddd', secondary: '#555555' }, LIGHT, { repairs: false })) {
      expect(r.status, r.id).not.toBe('adjusted');
    }
    for (const r of readabilityRows({}, LIGHT, { repairs: false })) expect(r.status, r.id).toBe('pass');
  });

  it('rounds ratios down so a near miss never shows as the bar', () => {
    expect(ratioLabel(4.4999)).toBe('4.4:1');
    expect(ratioLabel(21)).toBe('21.0:1');
    expect(ratioLabel(NaN)).toBe('0.0:1');
  });
});

describe('fonts', () => {
  it('reads families from names and stacks, catalog only', () => {
    expect(toFamily("'Inter', sans-serif")).toBe('Inter');
    expect(toFamily('playfair display')).toBe('Playfair Display');
    expect(toFamily('Papyrus')).toBe('');
    expect(toFamily(undefined)).toBe('');
  });

  it('sets and clears one slot', () => {
    expect(setFontSlot({}, 'heading', "'Fraunces', serif")).toEqual({ heading: 'Fraunces' });
    expect(setFontSlot({ heading: 'Fraunces', body: 'Lato' }, 'body', '')).toEqual({ heading: 'Fraunces' });
    expect(setFontSlot({ body: 'Lato' }, 'body', 'Comic Sans MS')).toEqual({});
    expect(setFontSlot({ body: 'Lato' }, 'nav', 'Inter')).toEqual({ body: 'Lato' });
  });

  it('applies every pairing to both slots, as sanitizeLevers keeps them', () => {
    expect(applyPairing(pairingById('street'))).toEqual({ heading: 'Bebas Neue', body: 'Barlow' });
    for (const p of FONT_PAIRINGS) {
      const fonts = applyPairing(p);
      expect(fonts, p.id).toEqual({ heading: p.heading, body: p.body });
      expect(sanitizeLevers({ fonts }, 'mobile_chrome').fonts).toEqual(fonts);
    }
    expect(applyPairing(null)).toEqual({});
  });

  it('offers text faces for the body and keeps a current outsider selectable', () => {
    const families = (groups) => groups.flatMap((g) => g.families.map((f) => f.family));
    expect(families(fontOptionGroups('heading'))).toContain('Bebas Neue');
    expect(families(fontOptionGroups('body'))).not.toContain('Bebas Neue');
    expect(families(fontOptionGroups('body'))).toContain('Inter');
    const withCurrent = fontOptionGroups('body', "'Anton', sans-serif");
    expect(withCurrent[0]).toEqual({ id: 'current', label: 'Current', families: [{ family: 'Anton' }] });
    expect(fontOptionGroups('body', 'Inter')[0].id).not.toBe('current');
  });

  it('builds one stylesheet link per family, deduped', () => {
    expect(fontLinkHrefs(['Inter', "'Inter', sans-serif", 'Nope', '', null, 'Fraunces']))
      .toEqual([buildFontHref(['Inter']), buildFontHref(['Fraunces'])]);
    expect(fontLinkHrefs(undefined)).toEqual([]);
  });
});

describe('sections', () => {
  const T = 'carwash_bubble';
  const DEFAULT = ['hero', 'services', 'process', 'about', 'gallery', 'beforeAfter', 'testimonials', 'cta'];

  it('knows which templates have section controls', () => {
    expect(sectionsSupported(T)).toBe(true);
    expect(sectionsSupported('detailing_coastal')).toBe(false);
    expect(sectionRows({ order: [], hidden: [] }, 'detailing_coastal')).toEqual([]);
  });

  it('lists the template order with labels, locks and ends', () => {
    expect(sectionIdsFor(T)).toEqual(DEFAULT);
    const rows = sectionRows({ order: [], hidden: ['gallery', 'hero'] }, T);
    expect(rows.map((r) => r.id)).toEqual(DEFAULT);
    expect(rows[1]).toMatchObject({ id: 'services', label: 'Packages', index: 1, hidden: false, locked: false });
    expect(rows.find((r) => r.id === 'gallery').hidden).toBe(true);
    expect(rows[0]).toMatchObject({ id: 'hero', locked: true, hidden: false, first: true, last: false });
    expect(rows[7]).toMatchObject({ id: 'cta', locked: true, last: true });
    expect(sectionRows(undefined, T).map((r) => r.id)).toEqual(DEFAULT);
  });

  it('moves up and down, and stores the template order as no lever', () => {
    const up = moveSection({ order: [], hidden: [] }, T, 'gallery', -1);
    expect(up.order).toEqual(['hero', 'services', 'process', 'gallery', 'about', 'beforeAfter', 'testimonials', 'cta']);
    expect(currentSectionOrder(up, T)).toEqual(up.order);
    expect(moveSection(up, T, 'gallery', 1)).toEqual({ order: [], hidden: [] });
    expect(moveSection({ order: [], hidden: [] }, T, 'hero', -1)).toEqual({ order: [], hidden: [] });
    expect(moveSection({ order: [], hidden: [] }, T, 'cta', 1)).toEqual({ order: [], hidden: [] });
    expect(moveSection({ order: [], hidden: [] }, T, 'nope', 1)).toEqual({ order: [], hidden: [] });
    // What the field produces is what sanitizeLevers keeps.
    expect(sanitizeLevers({ sections: up }, T).sections).toEqual(up);
  });

  it('hides and shows, never the hero or the contact section', () => {
    const hidden = toggleSectionHidden({ order: [], hidden: [] }, T, 'gallery');
    expect(hidden.hidden).toEqual(['gallery']);
    expect(toggleSectionHidden(hidden, T, 'gallery').hidden).toEqual([]);
    expect(toggleSectionHidden(hidden, T, 'hero').hidden).toEqual(['gallery']);
    expect(toggleSectionHidden(hidden, T, 'cta').hidden).toEqual(['gallery']);
    expect(toggleSectionHidden(hidden, T, 'shadeGuide').hidden).toEqual(['gallery']);
  });

  it('resets the order but keeps what is hidden', () => {
    const s = toggleSectionHidden(moveSection({ order: [], hidden: [] }, T, 'gallery', -1), T, 'process');
    expect(s.order.length).toBe(DEFAULT.length);
    expect(resetSectionOrder(s, T)).toEqual({ order: [], hidden: ['process'] });
  });
});

describe('layout', () => {
  it('offers only the layout levers that reach the template', () => {
    expect(layoutOptions('mobile_chrome')).toEqual({ hero: true, about: true, stats: true });
    expect(layoutOptions('mobile_redline')).toEqual({ hero: false, about: true, stats: true });
    expect(layoutOptions('detailing_coastal')).toEqual({ hero: false, about: false, stats: true });
    expect(layoutOptions('mobile_rugged')).toEqual({ hero: false, about: false, stats: false });
  });

  it('reads the layout slice with every key present', () => {
    expect(layoutPart(undefined)).toEqual({ heroLayout: '', aboutLayout: '', aboutStats: [] });
    expect(layoutPart({ heroLayout: 'split', palette: {}, aboutStats: [{ value: '1', label: 'a' }] }))
      .toEqual({ heroLayout: 'split', aboutLayout: '', aboutStats: [{ value: '1', label: 'a' }] });
  });

  it('adds up to three stats, edits and removes them', () => {
    let stats = [];
    for (let i = 0; i < 5; i++) stats = addStat(stats);
    expect(stats).toHaveLength(MAX_STATS);
    stats = setStat(stats, 1, { value: '12 ' });
    stats = setStat(stats, 1, { label: 'Years in business' });
    expect(stats[1]).toEqual({ value: '12 ', label: 'Years in business' });
    expect(setStat(stats, 0, { value: 'x'.repeat(50) })[0].value).toHaveLength(20);
    stats = setStat(stats, 2, { label: 'Cars' });
    expect(incompleteStats(stats)).toEqual([2]);
    expect(removeStat(stats, 0)).toEqual([stats[1], stats[2]]);
    expect(sanitizeLevers({ aboutStats: stats }, 'mobile_chrome').aboutStats).toEqual([{ value: '12', label: 'Years in business' }]);
  });
});

describe('facts', () => {
  it('covers exactly the facts the levers keep', () => {
    expect(FACT_TEXT_FIELDS.map((f) => f.key)).toEqual(Object.keys(FACT_TEXTS));
    expect(FACT_LIST_FIELDS.map((f) => f.key)).toEqual(Object.keys(FACT_LISTS));
  });

  it('splits lists the same way sanitizeLevers does', () => {
    const inputs = [
      'Best of Austin, Readers Pick\nbest of austin; Top Shop · Gold | Silver',
      '  Visa ,, Cash\n\nZelle , Apple Pay, Venmo, Check, Amex, Discover, Mastercard, PayPal, Crypto, Barter',
      Array.from({ length: 30 }, (_, i) => `Town ${i}`).join('\n'),
      `${'x'.repeat(120)}, ok`,
      '',
    ];
    for (const key of Object.keys(FACT_LISTS)) {
      for (const text of inputs) {
        const kept = sanitizeLevers({ facts: { [key]: text } }, 'mobile_chrome').facts[key] || [];
        expect(parseFactList(text, key), `${key}: ${text.slice(0, 20)}`).toEqual(kept);
      }
    }
    expect(splitFactList('a, b\nA')).toEqual(['a', 'b']);
    expect(parseFactList('a,b,c,d,e,f,g,h,i,j', 'awards')).toHaveLength(FACT_LISTS.awards);
    expect(formatFactList(['a', 'b'])).toBe('a\nb');
    expect(sameList(['a'], ['a'])).toBe(true);
    expect(sameList(['a'], undefined)).toBe(false);
    expect(sameList(undefined, [])).toBe(true);
  });

  it('keeps text facts as typed, capped, and drops blank ones', () => {
    expect(setFactText({}, 'tagline', 'Shine ')).toEqual({ tagline: 'Shine ' });
    expect(setFactText({ tagline: 'x' }, 'tagline', '   ')).toEqual({});
    expect(setFactText({}, 'warranty', 'w'.repeat(500)).warranty).toHaveLength(FACT_TEXTS.warranty);
    expect(setFactText({}, 'evil', 'x')).toEqual({});
  });

  it('warns when years in business is not a plain number', () => {
    for (const ok of ['12', ' 8 ', '', undefined]) expect(factTextWarning('yearsInBusiness', ok)).toBe('');
    for (const bad of ['Since 2009', '12+', '10 years', '2009!']) expect(factTextWarning('yearsInBusiness', bad)).toMatch(/just the number/);
    expect(factTextWarning('warranty', 'Lifetime')).toBe('');
  });

  it('sets and clears list facts and the insured answer', () => {
    expect(setFactList({}, 'awards', ['Best of Austin', ''])).toEqual({ awards: ['Best of Austin'] });
    expect(setFactList({ awards: ['x'] }, 'awards', [])).toEqual({});
    expect(setFactList({}, 'nope', ['x'])).toEqual({});
    expect(insuredChoice({})).toBe('');
    expect(insuredChoice(setInsured({}, 'yes'))).toBe('yes');
    expect(insuredChoice(setInsured({}, 'no'))).toBe('no');
    expect(setInsured({ insured: true, tagline: 't' }, '')).toEqual({ tagline: 't' });
    expect(sanitizeLevers({ facts: setInsured({}, 'no') }, 'mobile_chrome').facts).toEqual({ insured: false });
  });
});

describe('components render', () => {
  const render = (el) => renderToStaticMarkup(el);

  it('PaletteField shows every role, the brand helper and the readability check', () => {
    const html = render(h(PaletteField, { value: { accent: '#e11d48' }, onChange: noop, templateId: 'mobile_chrome', defaults: LIGHT, brandHexes: ['#ffd400', 'junk'] }));
    for (const r of PALETTE_ROLES) expect(html).toContain(`${r.label} hex code`);
    expect(html).toContain('Use their brand colors');
    expect(html).toContain('Text on background');
    expect(html).toContain('value="#e11d48"');
    expect(html).toContain('Reset all colors');
    expect(html).not.toContain('exactly as picked');
    const legacy = render(h(PaletteField, { value: { text: '#aaaaaa' }, onChange: noop, templateId: 'detailing_coastal', defaults: LIGHT }));
    expect(legacy).not.toContain('Use their brand colors');
    expect(legacy).toContain('exactly as picked');
    expect(legacy).not.toContain('Auto-fixed');
  });

  it('FontField shows pairings, both pickers and the sample', () => {
    const html = render(h(FontField, {
      value: { heading: 'Fraunces' }, onChange: noop, defaults: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
      styles: ['Bold & sporty'], businessType: 'wheel_shop', sample: 'Gloss Bros',
    }));
    expect(html).toContain('Template default (Inter)');
    expect(html).toContain('Gloss Bros');
    expect(html).toContain('Best match');
    expect(html).toContain('Heading: Fraunces');
    expect(html).toContain('Body: Inter (template)');
    expect(html).toContain(`Show all ${FONT_PAIRINGS.length} pairings`);
  });

  it('SectionsField lists the sections with move and show controls', () => {
    const html = render(h(SectionsField, { templateId: 'carwash_bubble', value: { order: [], hidden: ['gallery'] }, onChange: noop }));
    expect(html).toContain('Move Packages up');
    expect(html).toContain('aria-label="Show Gallery"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('Always on');
    expect(html).toContain('Reset to template order');
    expect(render(h(SectionsField, { templateId: 'detailing_coastal', value: null, onChange: noop }))).toContain('keeps its own section order');
  });

  it('LayoutField hides Full/Split on Redline and shows the stats note', () => {
    const redline = render(h(LayoutField, { templateId: 'mobile_redline', value: { aboutLayout: 'stats', aboutStats: [{ value: '12', label: '' }] }, onChange: noop }));
    expect(redline).not.toContain('Split');
    expect(redline).toContain('Stats');
    expect(redline).toContain('facts the owner gave you');
    expect(redline).toContain('Needs both a number and a label');
    expect(render(h(LayoutField, { templateId: 'mobile_chrome', value: {}, onChange: noop }))).toContain('Split');
    expect(render(h(LayoutField, { templateId: 'mobile_rugged', value: {}, onChange: noop }))).toContain('no layout options');
  });

  it('FactsField shows every fact with its current value', () => {
    const html = render(h(FactsField, { value: { tagline: 'Shine on', awards: ['Best of Austin', 'Readers Pick'], insured: true }, onChange: noop }));
    expect(html).not.toContain('just the number of years');
    expect(render(h(FactsField, { value: { yearsInBusiness: 'Since 2009' }, onChange: noop }))).toContain('just the number of years');
    for (const f of [...FACT_TEXT_FIELDS, ...FACT_LIST_FIELDS]) expect(html).toContain(f.label);
    expect(html).toContain('value="Shine on"');
    expect(html).toContain('Best of Austin\nReaders Pick');
    expect(html).toContain('2 of 8');
    const radios = html.match(/<input type="radio"[^>]*>/g);
    expect(radios.filter((tag) => tag.includes('checked=""'))).toEqual([expect.stringContaining('value="yes"')]);
  });
});
